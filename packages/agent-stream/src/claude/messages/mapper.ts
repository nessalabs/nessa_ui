/** @responsibility Turns raw Messages API frames into normalized agent events, holding the block state that requires. */

import type {
  AgentEvent,
  AgentEventPayload,
  AgentStreamMapper,
  BlockRef,
  MapperOptions,
  SessionInfo,
  ToolResult,
  Usage,
} from "../../events"
import { asArray, asNumber, asObject, asRecord, asString } from "../../json"
import { toolKind, toolTitle } from "../tools"
import type { JsonValue, WireEvent } from "./wire"
import { MessagesBlockType, MessagesDeltaType, MessagesFrameType, MessagesStopReason, parseWireLine } from "./wire"

/**
 * A block held open between its start and stop frames.
 *
 * The wire addresses blocks by index within the current message and sends a
 * block's identity exactly once, up front. Everything after that — every text
 * fragment, every argument fragment — carries only the index, so a mapper that
 * does not remember what index 1 *was* cannot interpret a single delta.
 */
interface OpenBlock {
  readonly type: string
  readonly index: number
  /** Set for tool_use and server_tool_use. */
  readonly toolId: string | null
  readonly toolName: string | null
  /** Joined text or thinking fragments. */
  text: string
  /** Joined argument fragments. Only the concatenation is valid JSON. */
  partialJson: string
}

export interface ClaudeMessagesMapperOptions extends MapperOptions {
  /**
   * The session id to stamp on every event.
   *
   * This wire has no session: it is one model response, and a conversation is
   * several of them stitched together by the host that resends the history.
   * Only that host knows which responses belong together, so it supplies the
   * id. The default keeps a lone capture self-consistent rather than pretending
   * to know better.
   */
  readonly sessionId?: string
}

const DEFAULT_SESSION_ID = "messages-api"

/** Flattens a server tool's result payload to text, without pretending to decode what is encrypted. */
function readServerToolResult(content: JsonValue | undefined): ToolResult {
  const parts: string[] = []

  // A web search result is a list of hits; a code execution result is one
  // object, usually with its stdout encrypted. Neither is worth inventing a
  // renderer for here — the raw payload rides along on the event, and a host
  // that wants to draw hits reads it from there.
  for (const entry of asArray(content)) {
    const item = asRecord(entry)
    const title = asString(item.title)
    const url = asString(item.url)
    if (title !== null && url !== null) parts.push(`${title} — ${url}`)
  }

  const single = asObject(content)
  if (parts.length === 0 && single !== null) {
    const type = asString(single.type)
    if (type !== null) parts.push(type)
  }

  return {
    text: parts.join("\n"),
    isError: false,
    structured: content ?? null,
    images: [],
  }
}

/**
 * Normalizes this wire's usage.
 *
 * Unlike Claude Code's stream, this one reports reasoning tokens separately, so
 * `reasoningTokens` is a real figure here rather than an unreported null. It is
 * deliberately *not* added into the total: the API already counts thinking
 * inside `output_tokens`, and adding it again would inflate every turn.
 */
function normalizeUsage(usage: JsonValue | undefined): Usage | null {
  const fields = asObject(usage)
  if (fields === null) return null

  const input = asNumber(fields.input_tokens)
  const output = asNumber(fields.output_tokens)
  const cacheRead = asNumber(fields.cache_read_input_tokens)
  const cacheCreation = asNumber(fields.cache_creation_input_tokens)
  const counters = [input, output, cacheRead, cacheCreation].filter((count): count is number => count !== null)

  return {
    totalTokens: counters.length === 0 ? null : counters.reduce((sum, count) => sum + count, 0),
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheCreation,
    reasoningTokens: asNumber(asRecord(fields.output_tokens_details).thinking_tokens),
  }
}

/**
 * Merges the usage from `message_start` with the usage from `message_delta`.
 *
 * Neither frame carries the whole picture: the first has the input side and a
 * placeholder output count of 1, the second has the real output count and
 * repeats the input. Reporting either alone would understate the turn.
 */
function mergeUsage(start: Usage | null, end: Usage | null): Usage | null {
  if (start === null) return end
  if (end === null) return start
  const pick = (a: number | null, b: number | null): number | null => (b !== null ? b : a)
  const merged = {
    inputTokens: pick(start.inputTokens, end.inputTokens),
    outputTokens: pick(start.outputTokens, end.outputTokens),
    cacheReadTokens: pick(start.cacheReadTokens, end.cacheReadTokens),
    cacheCreationTokens: pick(start.cacheCreationTokens, end.cacheCreationTokens),
    reasoningTokens: pick(start.reasoningTokens, end.reasoningTokens),
  }
  const counters = [
    merged.inputTokens,
    merged.outputTokens,
    merged.cacheReadTokens,
    merged.cacheCreationTokens,
  ].filter((count): count is number => count !== null)
  return {
    ...merged,
    totalTokens: counters.length === 0 ? null : counters.reduce((sum, count) => sum + count, 0),
  }
}

/**
 * Maps the raw Anthropic Messages API stream.
 *
 * Two things make this wire different from every CLI one in this package, and
 * both shape the API below.
 *
 * **It is one response, not a session.** There is no init line, no session id,
 * no turn result, no delegated work. A conversation is several of these
 * streams, and the thing that makes them one conversation is the host resending
 * the history — so the host, not the stream, names the session.
 *
 * **It is only half the conversation.** Tool *results* never appear on it: the
 * host runs the tool and puts the result in the next request. A mapper that
 * only read frames would leave every tool call pending forever, which is why
 * [`recordToolResult`] exists. It is not a convenience — without it this wire
 * cannot produce a complete transcript at all.
 */
export class ClaudeMessagesMapper implements AgentStreamMapper {
  private seq: number
  private readonly sessionId: string

  /** The message currently open, and the blocks open within it, addressed by index. */
  private messageId: string | null = null
  private readonly open = new Map<number, OpenBlock>()

  /** The model named by the most recent `message_start`, for `model_changed`. */
  private model: string | null = null
  private announced = false

  /** Usage from `message_start`, held until `message_delta` completes the picture. */
  private startUsage: Usage | null = null

  /** Text committed during this message, joined for the turn's `finalText`. */
  private finalText: string[] = []

  constructor(options: ClaudeMessagesMapperOptions = {}) {
    this.seq = options.startSeq ?? 0
    this.sessionId = options.sessionId ?? DEFAULT_SESSION_ID
  }

  /** Decodes and maps one line of a captured stream. An undecodable line becomes a single `error` event. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseWireLine(line)
    if (!parsed.ok) {
      return [this.build({ type: "error", message: `unreadable line: ${parsed.reason}` }, { line: parsed.line })]
    }
    return this.map(parsed.line as WireEvent)
  }

  /**
   * Maps one already-decoded frame.
   *
   * This is the entry a live host uses. The SDK hands back objects, and
   * serializing them to JSON just to parse them back would be pure loss — of
   * time, and of any value JSON cannot represent.
   */
  map(event: WireEvent): readonly AgentEvent[] {
    const frame = asRecord(event as never)
    const type = asString(frame.type)

    switch (type) {
      case MessagesFrameType.MessageStart:
        return this.onMessageStart(frame)
      case MessagesFrameType.ContentBlockStart:
        return this.onBlockStart(frame)
      case MessagesFrameType.ContentBlockDelta:
        return this.onBlockDelta(frame)
      case MessagesFrameType.ContentBlockStop:
        return this.onBlockStop(frame)
      case MessagesFrameType.MessageDelta:
        return this.onMessageDelta(frame)
      case MessagesFrameType.MessageStop:
        // Everything this frame could report was already reported by
        // `message_delta`. Emitting a second terminator would make a consumer
        // count two turns where the wire described one.
        return []
      default:
        return [this.build({ type: "unknown", wireType: type ?? "unknown", subtype: null }, event as JsonValue)]
    }
  }

  /**
   * Records a tool result the host produced, completing a call this stream opened.
   *
   * The Messages API never sends one: the host executes the tool and puts the
   * result into its *next* request. Without this the transcript would show
   * every call as permanently pending, which is a lie about a call that
   * finished seconds ago.
   *
   * Pass exactly what went back in the `tool_result` block, so the transcript
   * and the conversation cannot disagree.
   */
  recordToolResult(
    callId: string,
    result: { readonly content: JsonValue; readonly isError?: boolean },
  ): readonly AgentEvent[] {
    const flat = asString(result.content)
    const parts: string[] = []
    if (flat !== null) {
      parts.push(flat)
    } else {
      for (const entry of asArray(result.content)) {
        const item = asRecord(entry)
        const text = asString(item.text)
        if (text !== null) parts.push(text)
      }
    }

    return [
      this.build(
        {
          type: "tool_call_completed",
          callId,
          result: {
            text: parts.join("\n"),
            isError: result.isError === true,
            structured: result.content,
            images: [],
          },
        },
        { tool_use_id: callId, content: result.content, is_error: result.isError === true },
      ),
    ]
  }

  /** Records a prompt the host sent. The wire carries only the response half, so this is the other one. */
  recordUserMessage(text: string): readonly AgentEvent[] {
    return [this.build({ type: "user_message", text, synthetic: false }, { role: "user", content: text })]
  }

  // ---------- frame handlers ----------

  private onMessageStart(frame: Record<string, JsonValue>): readonly AgentEvent[] {
    const message = asRecord(frame.message)
    const model = asString(message.model)
    const events: AgentEvent[] = []

    this.messageId = asString(message.id)
    this.open.clear()
    this.finalText = []
    this.startUsage = normalizeUsage(message.usage)

    if (!this.announced) {
      this.announced = true
      events.push(this.build({ type: "session_started", session: this.sessionInfo(model) }, frame as JsonValue))
    } else if (model !== null && this.model !== null && model !== this.model) {
      // Two responses in one conversation naming different models is a real
      // thing a host can do, and it is the only session-level change this wire
      // can actually evidence.
      events.push(this.build({ type: "model_changed", from: this.model, to: model }, frame as JsonValue))
    }

    if (model !== null) this.model = model
    return events
  }

  private onBlockStart(frame: Record<string, JsonValue>): readonly AgentEvent[] {
    const index = asNumber(frame.index) ?? 0
    const block = asRecord(frame.content_block)
    const type = asString(block.type) ?? "unknown"
    const toolId = asString(block.id)
    const toolName = asString(block.name)

    this.open.set(index, {
      type,
      index,
      toolId,
      toolName,
      text: asString(block.text) ?? asString(block.thinking) ?? "",
      partialJson: "",
    })

    const ref = this.blockRef(index)

    // A server tool's result block arrives whole and is never followed by
    // fragments — it is the answer, so it completes the call immediately.
    if (type === MessagesBlockType.WebSearchToolResult || type === MessagesBlockType.CodeExecutionToolResult) {
      const callId = asString(block.tool_use_id)
      if (callId !== null) {
        return [
          this.build({ type: "tool_call_completed", callId, result: readServerToolResult(block.content) }, frame as JsonValue),
        ]
      }
      return []
    }

    if (type === MessagesBlockType.ToolUse || type === MessagesBlockType.ServerToolUse) {
      return [
        this.build(
          {
            type: "delta",
            delta: "block_start",
            block: ref,
            blockType: "tool_use",
            toolId: toolId ?? "",
            toolName: toolName ?? "",
          },
          frame as JsonValue,
        ),
      ]
    }

    if (type === MessagesBlockType.Text || type === MessagesBlockType.Thinking) {
      return [
        this.build(
          { type: "delta", delta: "block_start", block: ref, blockType: type === MessagesBlockType.Text ? "text" : "thinking" },
          frame as JsonValue,
        ),
      ]
    }

    return [
      this.build(
        { type: "unknown", wireType: MessagesFrameType.ContentBlockStart, subtype: type },
        frame as JsonValue,
      ),
    ]
  }

  private onBlockDelta(frame: Record<string, JsonValue>): readonly AgentEvent[] {
    const index = asNumber(frame.index) ?? 0
    const delta = asRecord(frame.delta)
    const type = asString(delta.type)
    const block = this.open.get(index)
    const ref = this.blockRef(index)

    if (type === MessagesDeltaType.Text) {
      const text = asString(delta.text) ?? ""
      if (block) block.text += text
      return [this.build({ type: "delta", delta: "text", block: ref, text }, frame as JsonValue)]
    }

    if (type === MessagesDeltaType.Thinking) {
      const text = asString(delta.thinking) ?? ""
      if (block) block.text += text
      return [this.build({ type: "delta", delta: "text", block: ref, text }, frame as JsonValue)]
    }

    if (type === MessagesDeltaType.InputJson) {
      const partialJson = asString(delta.partial_json) ?? ""
      if (block) block.partialJson += partialJson
      return [this.build({ type: "delta", delta: "input", block: ref, partialJson }, frame as JsonValue)]
    }

    if (type === MessagesDeltaType.Signature) {
      // Carried so a thinking block can be replayed to the API unchanged.
      // Nothing renders it, and it is not text — appending it to the block
      // would put base64 in the transcript.
      return []
    }

    return [
      this.build(
        { type: "unknown", wireType: MessagesFrameType.ContentBlockDelta, subtype: type },
        frame as JsonValue,
      ),
    ]
  }

  private onBlockStop(frame: Record<string, JsonValue>): readonly AgentEvent[] {
    const index = asNumber(frame.index) ?? 0
    const block = this.open.get(index)
    const ref = this.blockRef(index)
    const events: AgentEvent[] = [this.build({ type: "delta", delta: "block_stop", block: ref }, frame as JsonValue)]

    if (!block) return events
    this.open.delete(index)

    if (block.type === MessagesBlockType.Text) {
      this.finalText.push(block.text)
      events.push(this.build({ type: "assistant_text", text: block.text, block: ref }, frame as JsonValue))
    } else if (block.type === MessagesBlockType.Thinking) {
      events.push(this.build({ type: "reasoning", text: block.text, block: ref }, frame as JsonValue))
    } else if (block.type === MessagesBlockType.ToolUse || block.type === MessagesBlockType.ServerToolUse) {
      // Only here is the call whole: its arguments arrived as fragments, and
      // only their concatenation is parseable. Emitting the call at block
      // start would emit it with no arguments at all.
      const input = parseArguments(block.partialJson)
      const name = block.toolName ?? ""
      events.push(
        this.build(
          {
            type: "tool_call_started",
            callId: block.toolId ?? "",
            name,
            kind: toolKind(name),
            input,
            title: toolTitle(name, input),
          },
          frame as JsonValue,
        ),
      )
    }

    return events
  }

  private onMessageDelta(frame: Record<string, JsonValue>): readonly AgentEvent[] {
    const delta = asRecord(frame.delta)
    const stopReason = asString(delta.stop_reason)
    const usage = mergeUsage(this.startUsage, normalizeUsage(frame.usage))

    // Two stop reasons are not turn endings, and both mean the same thing: the
    // model has handed control back mid-turn and the conversation continues in
    // the very next request. `tool_use` waits for a result the host owes it;
    // `pause_turn` is a long-running server-tool flow the host resumes by
    // resending. Reporting either as a completed turn would split one turn
    // into as many turns as it paused.
    if (stopReason === MessagesStopReason.ToolUse || stopReason === MessagesStopReason.PauseTurn) return []

    return [
      this.build(
        {
          type: "turn_completed",
          status: stopReason === MessagesStopReason.Refusal ? "error" : "completed",
          stopReason,
          terminalReason: null,
          finalText: this.finalText.length === 0 ? null : this.finalText.join("\n"),
          usage,
          durationMs: null,
          numTurns: null,
          // This wire has no approval channel at all, so nothing was refused
          // *by an operator* — an empty list is the honest answer, and it is
          // the same one a clean CLI run gives.
          permissionDenials: [],
        },
        frame as JsonValue,
      ),
    ]
  }

  // ---------- helpers ----------

  private sessionInfo(model: string | null): SessionInfo {
    // Almost every field is null or empty, and deliberately so: this wire
    // advertises nothing. Filling `tools` from the request would state
    // something the *stream* never said, and the request is not this parser's
    // to read.
    return {
      sessionId: this.sessionId,
      model,
      cwd: null,
      tools: [],
      slashCommands: [],
      agents: [],
      skills: [],
      mcpServers: [],
      terminalSlashCommands: [],
      plugins: [],
      permissionMode: null,
      version: null,
      outputStyle: null,
      initIndex: 0,
    }
  }

  private blockRef(index: number): BlockRef {
    return { messageId: this.messageId ?? "unknown", index }
  }

  private build(payload: AgentEventPayload, raw: JsonValue): AgentEvent {
    const seq = this.seq
    this.seq += 1
    return {
      id: `${this.sessionId}:${seq}`,
      sessionId: this.sessionId,
      seq,
      // No frame on this wire carries a timestamp. Stamping `Date.now()` would
      // record when the parser ran, not when anything happened.
      ts: null,
      // There is no delegation on this wire: every event is the main thread.
      agentPath: [],
      payload,
      raw,
    }
  }
}

/**
 * Joins a tool call's argument fragments back into a value.
 *
 * A call with no arguments streams no fragments at all, which is `{}` and not
 * a parse failure. A genuinely malformed join is returned as the raw string so
 * the call still renders — losing the arguments is better than losing the call.
 */
function parseArguments(partialJson: string): JsonValue {
  const trimmed = partialJson.trim()
  if (trimmed.length === 0) return {}
  try {
    return JSON.parse(trimmed) as JsonValue
  } catch {
    return trimmed
  }
}

/** Maps a whole capture in one pass, for a persisted log or a fixture. */
export function mapClaudeMessagesStream(
  text: string,
  options?: ClaudeMessagesMapperOptions,
): readonly AgentEvent[] {
  const mapper = new ClaudeMessagesMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    events.push(...mapper.push(line))
  }
  return events
}
