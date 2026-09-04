/** @responsibility Normalizes the objects yielded by an OpenAI Agents SDK streamed run. */

import { EventSink } from "../../emitter"
import type { AgentEvent, AgentStreamMapper, MapperOptions, SessionInfo, ToolResult, Usage } from "../../events"
import { asArray, asNumber, asObject, asRecord, asString } from "../../json"
import type { JsonValue } from "../../json"
import { openAIToolKind } from "./mapping"
import { OpenAIAgentsEventType, OpenAIAgentsRunItemName, OpenAIRawModelEventType, parseOpenAIAgentsLine } from "./wire"

export interface OpenAIAgentsMapperOptions extends MapperOptions {
  /** Stable host-owned run/session id. The SDK's first event carries none. */
  readonly sessionId?: string
  /** Model configured on the Agent; stream events do not serialize it. */
  readonly model?: string
  /** Names passed to `agent.asTool()`; the SDK serializes them as ordinary function tools. */
  readonly agentToolNames?: readonly string[]
}

export interface OpenAIAgentsFinishOptions {
  readonly status?: "completed" | "interrupted" | "error"
  readonly error?: string | null
}

function jsonString(value: JsonValue | undefined): JsonValue {
  const text = asString(value)
  if (text === null) return value ?? null
  try { return JSON.parse(text) as JsonValue } catch { return text }
}

function textOfContent(value: JsonValue | undefined): string {
  return asArray(value).flatMap((part) => {
    const item = asRecord(part)
    return [asString(item.text) ?? asString(item.refusal) ?? ""]
  }).join("")
}

function rawItemOf(item: Record<string, JsonValue>): Record<string, JsonValue> {
  return asRecord(item.rawItem)
}

function callIdOf(item: Record<string, JsonValue>): string {
  const raw = rawItemOf(item)
  return asString(raw.callId) ?? asString(raw.call_id) ?? asString(raw.id) ?? "unknown-call"
}

function resultOf(item: Record<string, JsonValue>): ToolResult {
  const raw = rawItemOf(item)
  const output = item.output ?? raw.output
  const text = asString(output) ?? asString(asRecord(output).text) ?? (output === undefined ? "" : JSON.stringify(output))
  const status = asString(raw.status)
  const executionStatus = asString(item.executionStatus)
  return { text, isError: status === "failed" || status === "incomplete" || (executionStatus !== null && executionStatus !== "executed"), structured: output ?? null, images: [] }
}

/**
 * Sums one counter across a usage detail block, or across several of them.
 *
 * The keys are *alternative spellings* of the same counter, not separate
 * counters: the SDK reports `cachedTokens` where the raw API says
 * `cached_tokens`. So the first spelling present in a record wins, and only
 * then are records summed. Adding every matching key instead double-counts any
 * payload that carries both spellings — which reports twice the cache reads
 * that actually happened, silently, because a doubled token count still looks
 * like a plausible token count.
 */
function detailTotal(value: JsonValue | undefined, ...keys: readonly string[]): number | null {
  const records = Array.isArray(value) ? value.map(asRecord) : [asRecord(value)]
  const values = records
    .map((record) => {
      for (const key of keys) {
        const found = asNumber(record[key])
        if (found !== null) return found
      }
      return null
    })
    .filter((entry): entry is number => entry !== null)
  return values.length === 0 ? null : values.reduce((sum, entry) => sum + entry, 0)
}

function usageOf(value: JsonValue | undefined): Usage | null {
  const usage = asObject(value)
  if (usage === null) return null
  return {
    totalTokens: asNumber(usage.totalTokens), inputTokens: asNumber(usage.inputTokens), outputTokens: asNumber(usage.outputTokens),
    cacheReadTokens: detailTotal(usage.inputTokensDetails, "cached_tokens", "cachedTokens"),
    cacheCreationTokens: detailTotal(usage.inputTokensDetails, "cache_write_tokens", "cacheWriteTokens"),
    reasoningTokens: detailTotal(usage.outputTokensDetails, "reasoning_tokens", "reasoningTokens"),
  }
}

function inputOf(raw: Record<string, JsonValue>): JsonValue {
  if (raw.arguments !== undefined) return jsonString(raw.arguments)
  if (raw.action !== undefined) return raw.action
  if (raw.actions !== undefined) return raw.actions
  if (raw.operation !== undefined) return raw.operation
  if (raw.command !== undefined) return { command: raw.command }
  if (raw.code !== undefined) return { code: raw.code }
  return null
}

export class OpenAIAgentsMapper implements AgentStreamMapper {
  private readonly emit: EventSink
  private readonly session: SessionInfo
  private opened = false
  private accumulated: Usage | null = null
  private finalText: string | null = null
  private finished = false
  private readonly agentToolNames: ReadonlySet<string>
  private readonly blockIndex = new Map<string, number>()

  constructor(options: OpenAIAgentsMapperOptions = {}) {
    this.emit = new EventSink(options.startSeq ?? 0)
    const sessionId = options.sessionId ?? "openai-agents"
    this.emit.current = sessionId
    this.emit.primary = sessionId
    this.agentToolNames = new Set(options.agentToolNames ?? [])
    this.session = { sessionId, model: options.model ?? null, cwd: null, tools: [], slashCommands: [], terminalSlashCommands: [], agents: [], skills: [], plugins: [], mcpServers: [], permissionMode: null, version: null, outputStyle: null, initIndex: 0 }
  }

  push(line: string): readonly AgentEvent[] {
    const parsed = parseOpenAIAgentsLine(line)
    if (!parsed.ok) return [this.emit.build({ type: "error", message: `unreadable event: ${parsed.reason}` }, { line: parsed.line }, null)]
    return this.map(parsed.line)
  }

  /** Accepts `JSON.parse(JSON.stringify(event))` from the SDK iterator without importing the SDK. */
  map(event: Record<string, JsonValue | undefined>): readonly AgentEvent[] {
    const raw = event as JsonValue
    const type = asString(event.type) ?? "unknown"
    if (type === OpenAIAgentsEventType.RawModel) return this.raw(asRecord(event.data), raw)
    if (type === OpenAIAgentsEventType.AgentUpdated) {
      const name = asString(asRecord(event.agent).name)
      return name === null ? [] : [this.emit.build({ type: "status_changed", status: `agent:${name}`, permissionMode: null }, raw, null)]
    }
    if (type !== OpenAIAgentsEventType.RunItem) return [this.emit.build({ type: "unknown", wireType: type, subtype: null }, raw, null)]
    return this.item(asString(event.name) ?? "unknown", asRecord(event.item), raw)
  }

  /** Record the host's matching `state.approve()` or `state.reject()` mutation. */
  decideApproval(requestId: string, decision: "allow" | "deny", message: string | null = null): AgentEvent {
    return this.emit.build({ type: "permission_decided", requestId, decision, message }, { source: "openai-agents.run-state", requestId, decision, message }, null)
  }

  /** Call after `await stream.completed`; iteration alone has no run-level terminal event. */
  finish(options: OpenAIAgentsFinishOptions = {}): readonly AgentEvent[] {
    if (this.finished) return []
    this.finished = true
    const raw = { source: "openai-agents.finish", status: options.status ?? "completed", error: options.error ?? null } as const
    const events: AgentEvent[] = []
    if (!this.opened) {
      this.opened = true
      this.emit.openedSessions.add(this.session.sessionId)
      events.push(this.emit.build({ type: "session_started", session: this.session }, raw, null))
    }
    events.push(this.emit.build({ type: "turn_completed", status: options.status ?? "completed", stopReason: null, terminalReason: options.error ?? null, finalText: this.finalText, usage: this.accumulated, durationMs: null, numTurns: null, permissionDenials: [] }, raw, null))
    return events
  }

  private raw(data: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const type = asString(data.type) ?? "unknown"
    if (type === OpenAIRawModelEventType.ResponseStarted && !this.opened) {
      this.opened = true
      this.emit.openedSessions.add(this.session.sessionId)
      return [this.emit.build({ type: "session_started", session: this.session }, raw, null)]
    }
    if (type === OpenAIRawModelEventType.OutputTextDelta) {
      const id = asString(data.itemId) ?? "message"
      const index = this.blockIndex.get(id) ?? 0
      this.blockIndex.set(id, index)
      return [this.emit.build({ type: "delta", delta: "text", block: { messageId: id, index }, text: asString(data.delta) ?? "" }, raw, null)]
    }
    if (type === OpenAIRawModelEventType.ResponseDone) {
      const next = usageOf(asRecord(data.response).usage)
      if (next !== null) this.accumulated = this.addUsage(this.accumulated, next)
    }
    return []
  }

  private item(name: string, item: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const rawItem = rawItemOf(item)
    const rawType = asString(rawItem.type) ?? "unknown"
    const callId = callIdOf(item)
    const toolName = asString(rawItem.name) ?? asString(item.toolName) ?? rawType
    if (name === OpenAIAgentsRunItemName.MessageOutputCreated) {
      const text = textOfContent(rawItem.content)
      this.finalText = text
      return [this.emit.build({ type: "assistant_text", text, block: { messageId: asString(rawItem.id) ?? "message", index: 0 } }, raw, null)]
    }
    if (name === OpenAIAgentsRunItemName.ToolCalled || name === OpenAIAgentsRunItemName.ToolSearchCalled) {
      const call = this.emit.build({ type: "tool_call_started", callId, name: toolName, kind: this.agentToolNames.has(toolName) ? "subagent" : openAIToolKind(toolName, rawType), input: inputOf(rawItem), title: toolName }, raw, null)
      if (!this.agentToolNames.has(toolName)) return [call]
      return [call, this.emit.build({ type: "task_started", taskId: callId, callId, taskKind: "agent", label: toolName, description: `agent tool ${toolName}`, prompt: asString(rawItem.arguments), transcriptId: null }, raw, null)]
    }
    if (name === OpenAIAgentsRunItemName.ToolOutput || name === OpenAIAgentsRunItemName.ToolSearchOutputCreated) {
      const result = resultOf(item)
      const completed = this.emit.build({ type: "tool_call_completed", callId, result }, raw, null)
      if (!this.agentToolNames.has(toolName)) return [completed]
      return [completed, this.emit.build({ type: "task_completed", taskId: callId, callId, status: result.isError ? "failed" : "completed", summary: result.text || null, usage: null }, raw, null)]
    }
    if (name === OpenAIAgentsRunItemName.ReasoningItemCreated) {
      const content = textOfContent(rawItem.content) || textOfContent(rawItem.rawContent)
      return content === "" ? [] : [this.emit.build({ type: "reasoning", text: content, block: { messageId: asString(rawItem.id) ?? "reasoning", index: 0 } }, raw, null)]
    }
    if (name === OpenAIAgentsRunItemName.CompactionItemCreated) {
      return [this.emit.build({ type: "context_compacted", trigger: "automatic", preTokens: null, postTokens: null, droppedTokens: null, durationMs: null }, raw, null)]
    }
    if (name === OpenAIAgentsRunItemName.ToolApprovalRequested) {
      return [this.emit.build({ type: "permission_requested", requestId: callId, callId, toolName, input: inputOf(rawItem), reason: "tool approval required", displayName: null, description: null }, raw, null)]
    }
    if (name === OpenAIAgentsRunItemName.HandoffRequested) {
      return [this.emit.build({ type: "tool_call_started", callId, name: toolName, kind: "other", input: jsonString(rawItem.arguments), title: toolName }, raw, null)]
    }
    if (name === OpenAIAgentsRunItemName.HandoffOccurred) {
      return [this.emit.build({ type: "tool_call_completed", callId, result: { text: "active agent transferred", isError: false, structured: rawItem.output ?? null, images: [] } }, raw, null)]
    }
    return [this.emit.build({ type: "unknown", wireType: OpenAIAgentsEventType.RunItem, subtype: name }, raw, null)]
  }

  private addUsage(left: Usage | null, right: Usage): Usage {
    const add = (a: number | null, b: number | null) => a === null && b === null ? null : (a ?? 0) + (b ?? 0)
    return { totalTokens: add(left?.totalTokens ?? null, right.totalTokens), inputTokens: add(left?.inputTokens ?? null, right.inputTokens), outputTokens: add(left?.outputTokens ?? null, right.outputTokens), cacheReadTokens: add(left?.cacheReadTokens ?? null, right.cacheReadTokens), cacheCreationTokens: add(left?.cacheCreationTokens ?? null, right.cacheCreationTokens), reasoningTokens: add(left?.reasoningTokens ?? null, right.reasoningTokens) }
  }
}

export function mapOpenAIAgentsStream(text: string, options?: OpenAIAgentsMapperOptions, finish?: OpenAIAgentsFinishOptions): readonly AgentEvent[] {
  const mapper = new OpenAIAgentsMapper(options)
  const events = text.split("\n").filter((line) => line.trim()).flatMap((line) => mapper.push(line))
  return [...events, ...mapper.finish(finish)]
}
