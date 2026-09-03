/** @responsibility Turns Cursor Agent `stream-json` lines into normalized agent events, holding the little state that requires. */

import type {
  AgentEvent,
  AgentEventPayload,
  AgentPath,
  AgentStreamMapper,
  BlockRef,
  FileEdit,
  MapperOptions,
  SessionInfo,
  ToolResult,
  Usage,
} from "../../events"
import { asArray, asBoolean, asNumber, asObject, asRecord, asString, shortenPath } from "../../json"
import type { JsonValue } from "../../json"
import {
  CURSOR_TASK_KIND,
  cursorFileChange,
  cursorMappingFor,
  cursorToolEnvelopeOf,
  cursorToolKind,
  cursorToolName,
  cursorWireKind,
} from "./mapping"
import {
  CursorSystemSubtype,
  CursorThinkingSubtype,
  CursorToolCallSubtype,
  CursorToolEnvelope,
  CursorWireType,
  parseCursorLine,
} from "./wire"
import type { CursorRawLine } from "./wire"

/** Flattens user/assistant message content blocks to text. */
function messageText(message: Record<string, JsonValue>): string {
  const content = message.content
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

/** Cursor reports usage in camelCase on `result`. */
function normalizeUsage(usage: JsonValue | undefined): Usage | null {
  const fields = asObject(usage)
  if (fields === null) return null
  const input = asNumber(fields.inputTokens)
  const output = asNumber(fields.outputTokens)
  const cacheRead = asNumber(fields.cacheReadTokens)
  const cacheWrite = asNumber(fields.cacheWriteTokens)
  const counters = [input, output, cacheRead, cacheWrite].filter((count): count is number => count !== null)
  return {
    totalTokens: counters.length === 0 ? null : counters.reduce((sum, count) => sum + count, 0),
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    // Cursor's `cacheWriteTokens` is the creation side Anthropic splits out.
    cacheCreationTokens: cacheWrite,
    reasoningTokens: null,
  }
}

/** One-line title from a tool's own arguments. */
function toolTitle(envelope: string, args: Record<string, JsonValue>): string {
  switch (envelope) {
    case CursorToolEnvelope.Shell:
      return asString(args.description) ?? asString(args.command) ?? "command"
    case CursorToolEnvelope.Edit:
    case CursorToolEnvelope.Read: {
      const path = asString(args.path)
      return path === null ? cursorToolName(envelope) : shortenPath(path)
    }
    case CursorToolEnvelope.Grep: {
      const pattern = asString(args.pattern)
      return pattern === null || pattern === "" ? "grep" : pattern
    }
    case CursorToolEnvelope.Task:
      return asString(args.description) ?? "task"
    default:
      return cursorToolName(envelope)
  }
}

/**
 * A call's arguments, as arguments.
 *
 * The envelope also carries lifecycle plumbing — toolCallId, parsingResult,
 * requestId — that describes the call rather than what it was asked to do.
 * Stripping those here is what keeps a drawer from printing them as "input".
 */
function callInput(envelope: string, args: Record<string, JsonValue>): JsonValue {
  switch (envelope) {
    case CursorToolEnvelope.Shell:
      return {
        command: args.command ?? null,
        workingDirectory: args.workingDirectory ?? null,
        timeout: args.timeout ?? null,
        description: args.description ?? null,
      }
    case CursorToolEnvelope.Edit:
      return {
        path: args.path ?? null,
        streamContent: args.streamContent ?? null,
      }
    case CursorToolEnvelope.Read:
      return { path: args.path ?? null }
    case CursorToolEnvelope.Grep:
      return {
        pattern: args.pattern ?? null,
        path: args.path ?? null,
        caseInsensitive: args.caseInsensitive ?? null,
        multiline: args.multiline ?? null,
      }
    case CursorToolEnvelope.Task:
      return {
        description: args.description ?? null,
        prompt: args.prompt ?? null,
        subagentType: args.subagentType ?? null,
        model: args.model ?? null,
      }
    default:
      return args
  }
}

/** Subagent type from Task args: `{ explore: {} }` → `"explore"`. */
function taskSubagentType(args: Record<string, JsonValue>): string | null {
  const typed = asRecord(args.subagentType)
  const keys = Object.keys(typed)
  return keys[0] ?? null
}

/** What a settled tool handed back. */
function readResult(envelope: string, body: Record<string, JsonValue>): ToolResult {
  const result = asRecord(body.result)
  const success = asRecord(result.success)
  const failure = asRecord(result.failure ?? result.error)
  const failed = Object.keys(failure).length > 0 && Object.keys(success).length === 0

  if (envelope === CursorToolEnvelope.Shell) {
    const exitCode = asNumber(success.exitCode)
    const stdout = asString(success.stdout) ?? asString(success.interleavedOutput) ?? ""
    const stderr = asString(success.stderr) ?? ""
    const text = stdout.length > 0 ? stdout : stderr
    return {
      text,
      isError: failed || (exitCode !== null && exitCode !== 0),
      structured: Object.keys(success).length > 0 ? success : result,
      images: [],
    }
  }

  if (envelope === CursorToolEnvelope.Edit) {
    const message = asString(success.message) ?? ""
    const diff = asString(success.diffString) ?? ""
    return {
      text: message.length > 0 ? message : diff,
      isError: failed,
      structured: Object.keys(success).length > 0 ? success : result,
      images: [],
    }
  }

  if (envelope === CursorToolEnvelope.Read) {
    const content = asString(success.content) ?? asString(success.rawContent) ?? ""
    return {
      text: content,
      isError: failed,
      structured: Object.keys(success).length > 0 ? success : result,
      images: [],
    }
  }

  if (envelope === CursorToolEnvelope.Grep) {
    return {
      text: "",
      isError: failed,
      structured: Object.keys(success).length > 0 ? success : result,
      images: [],
    }
  }

  if (envelope === CursorToolEnvelope.Task) {
    const steps = asArray(success.conversationSteps)
    const parts: string[] = []
    for (const step of steps) {
      const entry = asRecord(step)
      const assistant = asRecord(entry.assistantMessage)
      const text = asString(assistant.text)
      if (text !== null && text.length > 0) parts.push(text)
    }
    return {
      text: parts.join("\n"),
      isError: failed,
      structured: Object.keys(success).length > 0 ? success : result,
      images: [],
    }
  }

  return {
    text: "",
    isError: failed,
    structured: Object.keys(result).length > 0 ? result : null,
    images: [],
  }
}

/** Structured file edit from an Edit completion, when the wire supplies one. */
function readEdits(body: Record<string, JsonValue>): readonly FileEdit[] {
  const success = asRecord(asRecord(body.result).success)
  const path = asString(success.path) ?? asString(asRecord(body.args).path)
  if (path === null) return []
  const diff = asString(success.diffString)
  return [
    {
      path,
      change: cursorFileChange(diff),
      unifiedDiff: diff,
    },
  ]
}

/**
 * Maps one Cursor Agent session's stdout into normalized events.
 *
 * Stateful for the pieces the wire leaves implicit: which thinking block is
 * open (deltas arrive without an id), which assistant text block the
 * timestamped fragments belong to, and how many `init` lines have been seen.
 */
export class CursorStreamMapper implements AgentStreamMapper {
  private seq: number
  private sessionId: string | null = null
  private session: SessionInfo | null = null
  private initCount = 0

  /** Text accumulated across `thinking/delta` until `thinking/completed`. */
  private thinkingText = ""
  private thinkingBlock: BlockRef | null = null
  private thinkingMessageIndex = 0

  /** Open assistant text preview, keyed by the synthetic message it belongs to. */
  private textBlock: BlockRef | null = null
  private textMessageIndex = 0

  constructor(options: MapperOptions = {}) {
    this.seq = options.startSeq ?? 0
  }

  /** Decodes and maps one line. An unreadable line becomes a single `error` event rather than nothing. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseCursorLine(line)
    if (!parsed.ok) {
      return [this.build({ type: "error", message: `unreadable line: ${parsed.reason}` }, [], { line: parsed.line })]
    }
    return this.map(parsed.line)
  }

  /** Maps an already-decoded line. */
  map(event: CursorRawLine): readonly AgentEvent[] {
    const raw = event as JsonValue
    const line = asRecord(raw)
    const type = asString(line.type) ?? "unknown"
    const kind = cursorWireKind(event)

    // Remember the session id early so every later event can stamp it.
    const sessionId = asString(line.session_id)
    if (sessionId !== null) this.sessionId = sessionId

    // The table is the authority on what a line kind produces. A kind missing
    // from it is a line nobody decided about — carry it as unknown.
    if (cursorMappingFor(kind) === null) {
      return [this.build({ type: "unknown", wireType: type, subtype: asString(line.subtype) }, [], raw)]
    }

    switch (type) {
      case CursorWireType.System:
        return this.mapSystem(line, raw)
      case CursorWireType.User:
        return this.mapUser(line, raw)
      case CursorWireType.Assistant:
        return this.mapAssistant(line, raw)
      case CursorWireType.Thinking:
        return this.mapThinking(line, raw)
      case CursorWireType.ToolCall:
        return this.mapToolCall(line, raw)
      case CursorWireType.Result:
        return this.mapResult(line, raw)
      default:
        return [this.build({ type: "unknown", wireType: type, subtype: asString(line.subtype) }, [], raw)]
    }
  }

  private mapSystem(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const subtype = asString(line.subtype)
    if (subtype !== CursorSystemSubtype.Init) {
      return [this.build({ type: "unknown", wireType: CursorWireType.System, subtype }, [], raw)]
    }

    const sessionId = asString(line.session_id) ?? this.sessionId ?? "unknown"
    this.sessionId = sessionId
    const model = asString(line.model)
    const previousModel = this.session?.model ?? null
    const session: SessionInfo = {
      sessionId,
      model,
      cwd: asString(line.cwd),
      tools: [],
      slashCommands: [],
      terminalSlashCommands: [],
      agents: [],
      skills: [],
      plugins: [],
      mcpServers: [],
      permissionMode: asString(line.permissionMode),
      // Cursor does not stamp a CLI version on init; provenance holds the build.
      version: null,
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
    const message = asRecord(line.message)
    return [
      this.build(
        {
          type: "user_message",
          text: messageText(message),
          synthetic: false,
        },
        [],
        raw,
      ),
    ]
  }

  private mapAssistant(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const text = messageText(asRecord(line.message))
    // Timestamped fragments are previews. A timestamped line that also carries
    // model_call_id is the mid-turn snapshot of that message — the commit —
    // and the final line of the turn has no timestamp at all.
    const streaming =
      line.timestamp_ms !== undefined &&
      line.timestamp_ms !== null &&
      asString(line.model_call_id) === null

    if (streaming) {
      const events: AgentEvent[] = []
      if (this.textBlock === null) {
        const messageId = `${this.sessionId ?? "unknown"}:text:${this.textMessageIndex}`
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

  private mapThinking(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const subtype = asString(line.subtype)
    if (subtype === CursorThinkingSubtype.Delta) {
      const text = asString(line.text) ?? ""
      this.thinkingText += text
      const events: AgentEvent[] = []
      if (this.thinkingBlock === null) {
        const messageId = `${this.sessionId ?? "unknown"}:thinking:${this.thinkingMessageIndex}`
        this.thinkingMessageIndex += 1
        this.thinkingBlock = { messageId, index: 0 }
        events.push(
          this.build(
            { type: "delta", delta: "block_start", block: this.thinkingBlock, blockType: "thinking" },
            [],
            raw,
          ),
        )
      }
      events.push(
        this.build({ type: "delta", delta: "text", block: this.thinkingBlock, text }, [], raw),
      )
      return events
    }

    if (subtype === CursorThinkingSubtype.Completed) {
      const text = this.thinkingText
      const block = this.thinkingBlock
      this.thinkingText = ""
      this.thinkingBlock = null
      return [this.build({ type: "reasoning", text, block }, [], raw)]
    }

    return [this.build({ type: "unknown", wireType: CursorWireType.Thinking, subtype }, [], raw)]
  }

  private mapToolCall(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const subtype = asString(line.subtype)
    const callId = asString(line.call_id) ?? asString(asRecord(line.tool_call).toolCallId)
    const toolCall = asRecord(line.tool_call)
    const envelope = cursorToolEnvelopeOf(toolCall)
    if (callId === null || envelope === null) {
      return [this.build({ type: "unknown", wireType: CursorWireType.ToolCall, subtype }, [], raw)]
    }

    const body = asRecord(toolCall[envelope])
    const args = asRecord(body.args)

    if (subtype === CursorToolCallSubtype.Started) {
      const events: AgentEvent[] = [
        this.build(
          {
            type: "tool_call_started",
            callId,
            name: cursorToolName(envelope),
            kind: cursorToolKind(envelope),
            input: callInput(envelope, args),
            title: toolTitle(envelope, args),
          },
          [],
          raw,
        ),
      ]
      if (envelope === CursorToolEnvelope.Task) {
        const taskId = asString(args.agentId) ?? callId
        events.push(
          this.build(
            {
              type: "task_started",
              taskId,
              callId,
              taskKind: CURSOR_TASK_KIND,
              label: taskSubagentType(args),
              description: asString(args.description) ?? "",
              prompt: asString(args.prompt),
              // Cursor's child transcript is not addressable from this stream.
              transcriptId: null,
            },
            [],
            raw,
          ),
        )
      }
      return events
    }

    if (subtype === CursorToolCallSubtype.Completed) {
      const events: AgentEvent[] = [
        this.build(
          {
            type: "tool_call_completed",
            callId,
            result: readResult(envelope, body),
          },
          [],
          raw,
        ),
      ]
      if (envelope === CursorToolEnvelope.Edit) {
        const edits = readEdits(body)
        if (edits.length > 0) {
          events.push(this.build({ type: "file_edits", callId, edits }, [], raw))
        }
      }
      if (envelope === CursorToolEnvelope.Task) {
        const success = asRecord(asRecord(body.result).success)
        // Stable across start and complete: the completion's success.agentId is
        // a different id on the wire, and keying the run on it would look like
        // two runs for one spawn. The completion id stays on structured/raw.
        const taskId = asString(args.agentId) ?? callId
        const summary = readResult(envelope, body).text
        events.push(
          this.build(
            {
              type: "task_completed",
              taskId,
              callId,
              status: Object.keys(success).length > 0 ? "completed" : "error",
              summary: summary.length > 0 ? summary : null,
              usage: null,
            },
            [],
            raw,
          ),
        )
      }
      return events
    }

    return [this.build({ type: "unknown", wireType: CursorWireType.ToolCall, subtype }, [], raw)]
  }

  private mapResult(line: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const isError = asBoolean(line.is_error) === true
    return [
      this.build(
        {
          type: "turn_completed",
          status: isError ? "error" : "completed",
          stopReason: asString(line.subtype),
          terminalReason: null,
          // Cursor concatenates every assistant message into `result` with no
          // separator. Drawing that as finalText would both mash the turn and
          // fight the fold's "drop the last assistant_text when it matches"
          // rule. The string stays on raw; the last assistant_text is the answer.
          finalText: null,
          usage: normalizeUsage(line.usage),
          durationMs: asNumber(line.duration_ms),
          numTurns: null,
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
    const ts = null
    return { id: `${sessionId}:${seq}`, sessionId, seq, ts, agentPath: path, payload, raw }
  }
}

/** Maps a whole capture in one shot. */
export function mapCursorStream(text: string, options?: MapperOptions): readonly AgentEvent[] {
  const mapper = new CursorStreamMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    events.push(...mapper.push(line))
  }
  return events
}
