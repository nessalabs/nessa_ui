/** @responsibility Turns Kiro CLI `stream-json` lines into normalized agent events, holding the little state that requires. */

import type {
  AgentEvent,
  AgentEventPayload,
  AgentPath,
  AgentStreamMapper,
  BlockRef,
  FileEdit,
  MapperOptions,
  PlanStep,
  SessionInfo,
  ToolResult,
  Usage,
} from "../../events"
import { FileChange, PlanStepStatus, TaskKind } from "../../events"
import { asArray, asBoolean, asNumber, asObject, asRecord, asString, shortenPath } from "../../json"
import type { JsonValue } from "../../json"
import {
  KIRO_TASK_KIND,
  kiroMappingFor,
  kiroToolKind,
  kiroWireKind,
} from "./mapping"
import {
  KiroSystemSubtype,
  KiroToolCallSubtype,
  KiroToolName,
  KiroToolStatus,
  KiroWireType,
  parseKiroLine,
} from "./wire"
import type { KiroRawLine } from "./wire"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flattens content blocks to text. */
function messageText(content: JsonValue | undefined): string {
  const flat = asString(content)
  if (flat !== null) return flat
  if (!Array.isArray(content)) return ""
  const parts: string[] = []
  for (const entry of content) {
    const block = asRecord(entry)
    const text = asString(block.text)
    if (text !== null) parts.push(text)
  }
  return parts.join("")
}

/** Normalizes Kiro's usage object to our contract shape. */
function normalizeUsage(usage: JsonValue | undefined): Usage | null {
  if (asObject(usage) === null) return null
  const fields = asRecord(usage)
  const input = asNumber(fields.inputTokens)
  const output = asNumber(fields.outputTokens)
  const cacheRead = asNumber(fields.cacheReadTokens) ?? asNumber(fields.cachedReadTokens)
  const cacheWrite = asNumber(fields.cacheCreationTokens) ?? asNumber(fields.cacheWriteTokens)
  const reasoning = asNumber(fields.reasoningTokens) ?? asNumber(fields.thoughtTokens)
  const total =
    asNumber(fields.totalTokens) ??
    ([input, output, cacheRead, cacheWrite]
      .filter((n): n is number => n !== null)
      .reduce((sum, n) => sum + n, 0) || null)
  return {
    totalTokens: total,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheWrite,
    reasoningTokens: reasoning,
  }
}

/** One-line title derived from a tool call's own arguments. */
function toolTitle(name: string | null, input: Record<string, JsonValue>): string {
  if (name === KiroToolName.Bash) {
    return asString(input.command) ?? asString(input.description) ?? "command"
  }
  if (name === KiroToolName.Read || name === KiroToolName.Write || name === KiroToolName.Edit) {
    const path = asString(input.path)
    return path !== null ? shortenPath(path) : (name ?? "file")
  }
  if (name === KiroToolName.Grep) {
    const pattern = asString(input.pattern)
    return pattern !== null && pattern !== "" ? pattern : "grep"
  }
  if (name === KiroToolName.Glob) {
    return asString(input.pattern) ?? "glob"
  }
  if (name === KiroToolName.WebSearch) {
    return asString(input.query) ?? "web search"
  }
  if (name === KiroToolName.WebFetch) {
    return asString(input.url) ?? "web fetch"
  }
  if (name === KiroToolName.Task) {
    return asString(input.description) ?? "task"
  }
  return name ?? "tool"
}

/**
 * The tool's arguments, stripped of lifecycle plumbing fields.
 *
 * Tool call frames can carry `toolCallId`, `requestId`, and other fields the
 * host added.  Stripping them keeps the input drawer focused on what the call
 * was actually asked to do.
 */
function callInput(name: string | null, raw: Record<string, JsonValue>): JsonValue {
  if (name === KiroToolName.Bash) {
    return {
      command: raw.command ?? null,
      workingDirectory: raw.workingDirectory ?? null,
      timeout: raw.timeout ?? null,
      description: raw.description ?? null,
    }
  }
  if (name === KiroToolName.Read) return { path: raw.path ?? null }
  if (name === KiroToolName.Write || name === KiroToolName.Edit) {
    return { path: raw.path ?? null, content: raw.content ?? null }
  }
  if (name === KiroToolName.Grep) {
    return {
      pattern: raw.pattern ?? null,
      path: raw.path ?? null,
      caseInsensitive: raw.caseInsensitive ?? null,
    }
  }
  if (name === KiroToolName.Glob) {
    return { pattern: raw.pattern ?? null, path: raw.path ?? null }
  }
  if (name === KiroToolName.WebSearch) return { query: raw.query ?? null }
  if (name === KiroToolName.WebFetch) return { url: raw.url ?? null }
  if (name === KiroToolName.Task) {
    return {
      description: raw.description ?? null,
      prompt: raw.prompt ?? null,
    }
  }
  return raw
}

/** Reads a tool call result from a settled `tool_call_update` frame. */
function readResult(line: Record<string, JsonValue>): ToolResult {
  const status = asString(line.status)
  const isError = status === KiroToolStatus.Failed
  const rawOutput = asRecord(line.rawOutput)
  const content = asArray(line.content)

  // Try structured content blocks first.
  if (content.length > 0) {
    const parts: string[] = []
    for (const entry of content) {
      const block = asRecord(entry)
      const text = asString(block.text) ?? asString(asRecord(block.content).text)
      if (text !== null) parts.push(text)
    }
    return {
      text: parts.join(""),
      isError,
      structured: line.rawOutput ?? null,
      images: [],
    }
  }

  // Fall back to rawOutput fields (shell stdout/stderr pattern).
  const stdout = asString(rawOutput.stdout) ?? ""
  const stderr = asString(rawOutput.stderr) ?? ""
  const exitCode = asNumber(rawOutput.exitCode)
  const text = stdout.length > 0 ? stdout : stderr
  return {
    text,
    isError: isError || (exitCode !== null && exitCode !== 0),
    structured: line.rawOutput ?? null,
    images: [],
  }
}

/** File edits from a settled edit-tool `tool_call_update` frame. */
function readFileEdits(line: Record<string, JsonValue>): readonly FileEdit[] {
  const edits: FileEdit[] = []
  // Kiro may report edits as `diff` content blocks (ACP-style) or via rawOutput.
  for (const entry of asArray(line.content)) {
    const block = asRecord(entry)
    if (asString(block.type) !== "diff") continue
    const path = asString(block.path)
    if (path === null) continue
    const oldText = asString(block.oldText)
    const newText = asString(block.newText)
    const change = isCreate(oldText) ? FileChange.Add : FileChange.Update
    edits.push({ path, change, unifiedDiff: buildDiff(path, oldText, newText) })
  }
  if (edits.length > 0) return edits

  // Fall back to the rawOutput or rawInput path when no diff block was present.
  const rawOutput = asRecord(line.rawOutput)
  const path = asString(rawOutput.path) ?? asString(asRecord(line.rawInput).path)
  if (path !== null) {
    edits.push({ path, change: FileChange.Update, unifiedDiff: null })
  }
  return edits
}

function isCreate(oldText: string | null): boolean {
  if (oldText === null || oldText === "") return true
  return oldText === "-- /dev/null" || oldText === "--- /dev/null"
}

function buildDiff(path: string, oldText: string | null, newText: string | null): string | null {
  if (!isCreate(oldText)) return null
  if (newText === null) return null
  // Strip ACP mangled header if present.
  let body = newText
  if (body.startsWith("++ b/") || body.startsWith("+++ b/")) {
    const nl = body.indexOf("\n")
    body = nl === -1 ? "" : body.slice(nl + 1)
  }
  if (body === "") return null
  const lines = body.split("\n")
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  const plus = path.startsWith("/") ? path.slice(1) : path
  const hunk = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)]
  return ["--- /dev/null", `+++ b/${plus}`, ...hunk].join("\n")
}

/** Reads a plan from a `todowrite` tool's raw input. */
function readPlan(input: Record<string, JsonValue>): readonly PlanStep[] {
  const steps: PlanStep[] = []
  for (const entry of asArray(input.todos ?? input.items)) {
    const item = asRecord(entry)
    const content = asString(item.content)
    if (content === null) continue
    steps.push({
      id: asString(item.id),
      content,
      status: todoStatus(asString(item.status)),
    })
  }
  return steps
}

function todoStatus(status: string | null): PlanStepStatus {
  if (status === "in_progress") return PlanStepStatus.InProgress
  if (status === "completed" || status === "done") return PlanStepStatus.Completed
  return PlanStepStatus.Pending
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Maps one Kiro CLI `--output-format stream-json` session into normalized events.
 *
 * State held:
 * - sessionId — stamped on every event envelope
 * - initCount — to derive model changes across two inits
 * - textBlock — the open streaming block ref, cleared by a committed message
 * - toolNames / toolKinds / rawInputs — per-call id, for update→completion pairing
 */
export class KiroChatMapper implements AgentStreamMapper {
  private seq: number
  private sessionId: string | null = null
  private session: SessionInfo | null = null
  private initCount = 0

  /** Open streaming text block; cleared when the committed assistant line arrives. */
  private textBlock: BlockRef | null = null
  private textMessageIndex = 0

  /** Tool metadata remembered across start→update pairs, keyed by call id. */
  private readonly toolNames = new Map<string, string>()
  private readonly toolKinds = new Map<string, string>()
  private readonly rawInputs = new Map<string, Record<string, JsonValue>>()

  constructor(options: MapperOptions = {}) {
    this.seq = options.startSeq ?? 0
  }

  /** Decodes and maps one line.  An unreadable line becomes a single `error` event. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseKiroLine(line)
    if (!parsed.ok) {
      return [this.build({ type: "error", message: `unreadable line: ${parsed.reason}` }, [], { line: parsed.line })]
    }
    return this.map(parsed.line)
  }

  /** Maps an already-decoded line. */
  map(event: KiroRawLine): readonly AgentEvent[] {
    const raw = event as JsonValue
    const line = asRecord(raw)
    const type = asString(line.type) ?? "unknown"
    const kind = kiroWireKind(event)

    // Capture session id early so every subsequent event can stamp it.
    const sessionId = asString(line.sessionId) ?? asString(line.session_id)
    if (sessionId !== null) this.sessionId = sessionId

    // The mapping table is the authority.  A kind absent from it is a line
    // nobody decided about — carry it as unknown rather than dropping it silently.
    if (kiroMappingFor(kind) === null) {
      return [
        this.build(
          { type: "unknown", wireType: type, subtype: asString(line.subtype) ?? asString(line.method) ?? null },
          [],
          raw,
        ),
      ]
    }

    switch (type) {
      case KiroWireType.System:
        return this.mapSystem(line, raw)
      case KiroWireType.User:
        return this.mapUser(line, raw)
      case KiroWireType.Assistant:
        return this.mapAssistant(line, raw)
      case KiroWireType.ToolCall:
        return this.mapToolCall(line, raw)
      case KiroWireType.ToolCallUpdate:
        return this.mapToolCallUpdate(line, raw)
      case KiroWireType.TurnEnd:
        return this.mapTurnEnd(line, raw)
      default:
        // Extension lines (_kiro.dev/*) are in the mapping table with empty
        // `emits`; reaching this branch means the kind was recognised but
        // deliberately suppressed.
        return []
    }
  }

  // -------------------------------------------------------------------------

  private mapSystem(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const subtype = asString(line.subtype)
    if (subtype !== KiroSystemSubtype.Init) {
      return [this.build({ type: "unknown", wireType: KiroWireType.System, subtype }, [], raw)]
    }

    const sessionId = asString(line.sessionId) ?? asString(line.session_id) ?? this.sessionId ?? "unknown"
    this.sessionId = sessionId
    const model = asString(line.model)
    const previousModel = this.session?.model ?? null

    const tools: string[] = []
    for (const entry of asArray(line.tools)) {
      const name = asString(asRecord(entry).name) ?? asString(entry)
      if (name !== null) tools.push(name)
    }

    const slashCommands: string[] = []
    for (const entry of asArray(line.slashCommands ?? line.slash_commands)) {
      const name = asString(asRecord(entry).name) ?? asString(entry)
      if (name !== null) slashCommands.push(name)
    }

    const agents: string[] = []
    for (const entry of asArray(line.agents)) {
      const name = asString(asRecord(entry).name) ?? asString(entry)
      if (name !== null) agents.push(name)
    }

    const skills: string[] = []
    for (const entry of asArray(line.skills)) {
      const name = asString(asRecord(entry).name) ?? asString(entry)
      if (name !== null) skills.push(name)
    }

    type McpEntry = { readonly name: string; readonly status: string }
    const mcpServers: McpEntry[] = []
    for (const entry of asArray(line.mcpServers ?? line.mcp_servers)) {
      const rec = asRecord(entry)
      const name = asString(rec.name)
      if (name === null) continue
      mcpServers.push({ name, status: asString(rec.status) ?? "unknown" })
    }

    const session: SessionInfo = {
      sessionId,
      model,
      cwd: asString(line.cwd),
      tools,
      slashCommands,
      terminalSlashCommands: [],
      agents,
      skills,
      plugins: [],
      mcpServers,
      permissionMode: asString(line.permissionMode ?? line.permission_mode),
      version: asString(line.version),
      outputStyle: null,
      initIndex: this.initCount,
    }
    this.initCount += 1
    this.session = session

    const events: AgentEvent[] = [this.build({ type: "session_started", session }, [], raw)]
    if (previousModel !== null && model !== null && previousModel !== model) {
      events.push(this.build({ type: "model_changed", from: previousModel, to: model }, [], raw))
    }
    return events
  }

  private mapUser(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const content = line.content ?? line.message
    return [
      this.build(
        {
          type: "user_message",
          text: messageText(content),
          synthetic: asBoolean(line.synthetic) === true,
        },
        [],
        raw,
      ),
    ]
  }

  private mapAssistant(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    // A streaming chunk carries `streaming: true`; the committed final message does not.
    // Do not treat `messageId` alone as a chunk signal — a committed frame may
    // also name the message it replaces.
    const streaming = line.streaming === true
    const content = line.content ?? line.message
    const text = messageText(content)

    if (streaming) {
      const events: AgentEvent[] = []
      if (this.textBlock === null) {
        const messageId =
          asString(line.messageId) ?? `${this.sessionId ?? "kiro"}:text:${this.textMessageIndex}`
        this.textMessageIndex += 1
        this.textBlock = { messageId, index: 0 }
        events.push(
          this.build(
            { type: "delta", delta: "block_start", block: this.textBlock, blockType: "text" },
            [],
            raw,
          ),
        )
      }
      events.push(this.build({ type: "delta", delta: "text", block: this.textBlock, text }, [], raw))
      return events
    }

    const block = this.textBlock
    this.textBlock = null
    return [this.build({ type: "assistant_text", text, block }, [], raw)]
  }

  private mapToolCall(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const subtype = asString(line.subtype)
    const callId = asString(line.toolCallId) ?? asString(line.callId) ?? asString(line.id) ?? "unknown"
    const name = asString(line.title) ?? asString(line.name)
    const kind = asString(line.kind)
    const rawInput = asRecord(line.rawInput ?? line.input ?? {})

    // Store for lookup when the update arrives.
    if (name !== null) this.toolNames.set(callId, name)
    if (kind !== null) this.toolKinds.set(callId, kind)
    this.rawInputs.set(callId, rawInput)

    if (subtype !== KiroToolCallSubtype.Started) {
      return [this.build({ type: "unknown", wireType: KiroWireType.ToolCall, subtype }, [], raw)]
    }

    const input = callInput(name, rawInput)
    const title = toolTitle(name, rawInput)

    const events: AgentEvent[] = [
      this.build(
        {
          type: "tool_call_started",
          callId,
          name: name ?? kind ?? "tool",
          kind: kiroToolKind(name, kind),
          input,
          title,
        },
        [],
        raw,
      ),
    ]

    // A todowrite call carries the plan in its input; emit plan_updated immediately.
    if (name === KiroToolName.TodoWrite) {
      const steps = readPlan(rawInput)
      if (steps.length > 0) {
        events.push(this.build({ type: "plan_updated", steps }, [], raw))
      }
    }

    // Open a delegated run for task calls.
    if (name === KiroToolName.Task || kiroToolKind(name, kind) === "subagent") {
      events.push(
        this.build(
          {
            type: "task_started",
            taskId: callId,
            callId,
            taskKind: KIRO_TASK_KIND,
            label: name ?? kind ?? "task",
            description: asString(rawInput.description) ?? "",
            prompt: asString(rawInput.prompt),
            // Kiro does not surface the child session id on this wire.
            transcriptId: null,
          },
          [],
          raw,
        ),
      )
    }

    return events
  }

  private mapToolCallUpdate(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const status = asString(line.status)
    const callId = asString(line.toolCallId) ?? asString(line.callId) ?? asString(line.id) ?? "unknown"

    // In-progress / pending: suppress — the opened row covers it.
    if (status === KiroToolStatus.InProgress || status === KiroToolStatus.Pending) {
      return []
    }

    const isCompleted = status === KiroToolStatus.Completed
    const isFailed = status === KiroToolStatus.Failed

    if (!isCompleted && !isFailed) {
      // Unknown status: let it surface as unknown.
      return [this.build({ type: "unknown", wireType: KiroWireType.ToolCallUpdate, subtype: status }, [], raw)]
    }

    // Prefer remembered state over what the update frame carries, to handle
    // agents that rename a call as it runs (ACP pattern).
    const rememberedName = this.toolNames.get(callId)
    const rememberedKind = this.toolKinds.get(callId)
    const rememberedInput = this.rawInputs.get(callId) ?? {}
    const name = rememberedName ?? asString(line.title)
    const kind = rememberedKind ?? asString(line.kind)

    const result = readResult(line)
    const events: AgentEvent[] = [
      this.build({ type: "tool_call_completed", callId, result }, [], raw),
    ]

    // File edits for edit-kind tools.
    if (kind === "edit" || name === KiroToolName.Write || name === KiroToolName.Edit) {
      const edits = readFileEdits(line)
      if (edits.length > 0) {
        events.push(this.build({ type: "file_edits", callId, edits }, [], raw))
      } else {
        // Fall back to the remembered input path.
        const path = asString(rememberedInput.path)
        if (path !== null) {
          events.push(
            this.build(
              { type: "file_edits", callId, edits: [{ path, change: FileChange.Update, unifiedDiff: null }] },
              [],
              raw,
            ),
          )
        }
      }
    }

    // Task completion: determined from remembered state, not the raw frame.
    if (name === KiroToolName.Task || kiroToolKind(name ?? null, kind ?? null) === "subagent") {
      events.push(
        this.build(
          {
            type: "task_completed",
            taskId: callId,
            callId,
            status: isCompleted ? "completed" : "error",
            summary: result.text.length > 0 ? result.text : null,
            usage: null,
          },
          [],
          raw,
        ),
      )
    }

    // Clean up per-call state.
    this.toolNames.delete(callId)
    this.toolKinds.delete(callId)
    this.rawInputs.delete(callId)

    return events
  }

  private mapTurnEnd(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const stop = asString(line.stopReason)
    const isError = asBoolean(line.isError) === true
    return [
      this.build(
        {
          type: "turn_completed",
          status: isError ? "error" : stop === "cancelled" ? "interrupted" : "completed",
          stopReason: stop,
          terminalReason: asString(line.terminalReason),
          finalText: null,
          usage: normalizeUsage(line.usage),
          durationMs: asNumber(line.durationMs ?? line.duration_ms),
          numTurns: asNumber(line.numTurns),
          permissionDenials: [],
        },
        [],
        raw,
      ),
    ]
  }

  private build(payload: AgentEventPayload, path: AgentPath, raw: JsonValue): AgentEvent {
    const seq = this.seq
    this.seq += 1
    const sessionId = this.sessionId ?? "unknown"
    return { id: `${sessionId}:${seq}`, sessionId, seq, ts: null, agentPath: path, payload, raw }
  }
}

/** Maps a whole Kiro CLI stream-json capture in one shot. */
export function mapKiroChatStream(text: string, options?: MapperOptions): readonly AgentEvent[] {
  const mapper = new KiroChatMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    events.push(...mapper.push(line))
  }
  return events
}
