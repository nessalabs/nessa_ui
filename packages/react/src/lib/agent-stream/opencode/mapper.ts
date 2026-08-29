/** @responsibility Turns opencode `run --format json` lines into normalized agent events, holding the little state that requires. */

import type {
  AgentEvent,
  AgentEventPayload,
  AgentPath,
  AgentStreamMapper,
  FileEdit,
  MapperOptions,
  PlanStep,
  SessionInfo,
  ToolResult,
  Usage,
} from "../events"
import { asArray, asNumber, asObject, asRecord, asString, shortenPath } from "../json"
import type { JsonValue } from "../json"
import { OPENCODE_TASK_KIND, opencodePlanStatus, opencodeToolKind } from "./mapping"
import {
  OpencodeDeltaField,
  OpencodeFinishReason,
  OpencodePartType,
  OpencodeServerEventType,
  OpencodeToolName,
  OpencodeToolStatus,
  OpencodeWireType,
  isOpencodeServerEvent,
  parseOpencodeLine,
} from "./wire"
import type { OpencodeRawLine } from "./wire"

/** One line naming what a call does, from its own input. */
function toolTitle(tool: string, input: Record<string, JsonValue>, fallback: string | null): string {
  if (fallback !== null && fallback !== "") return fallback
  switch (tool) {
    case OpencodeToolName.Bash:
      return asString(input.command) ?? "command"
    case OpencodeToolName.Read:
    case OpencodeToolName.Write:
    case OpencodeToolName.Edit: {
      const path = asString(input.filePath) ?? asString(input.path)
      return path === null ? tool : shortenPath(path)
    }
    case OpencodeToolName.Task:
      return asString(input.description) ?? asString(input.subagent_type) ?? "subagent"
    case OpencodeToolName.Grep:
    case OpencodeToolName.Glob:
      return asString(input.pattern) ?? tool
    default:
      return tool
  }
}

/** The paths a call wrote, read off its own input rather than any result text. */
function editsOf(tool: string, input: Record<string, JsonValue>): readonly FileEdit[] {
  const path = asString(input.filePath) ?? asString(input.path)
  if (path === null) return []
  return [
    {
      path,
      // opencode does not say whether a write created or replaced the file, and
      // guessing from the tool name would be wrong exactly when a `write`
      // overwrites something. `update` is the honest weaker claim.
      change: tool === OpencodeToolName.Write ? "add" : "update",
      // opencode publishes which file a call touched, never the text of the
      // change, so there is no diff to hand a viewer.
      unifiedDiff: null,
    },
  ]
}

/** Reads a `todowrite` call's list into the shared plan shape. */
function planOf(input: Record<string, JsonValue>): readonly PlanStep[] {
  const steps: PlanStep[] = []
  for (const entry of asArray(input.todos)) {
    const todo = asRecord(entry)
    const content = asString(todo.content)
    if (content === null) continue
    steps.push({
      id: asString(todo.id),
      content,
      status: opencodePlanStatus(asString(todo.status)),
    })
  }
  return steps
}

/** Reads a step's token counts, leaving absent ones null rather than zero. */
function usageOf(part: Record<string, JsonValue>): Usage | null {
  const tokens = asObject(part.tokens)
  if (tokens === null) return null
  const cache = asRecord(tokens.cache)
  return {
    totalTokens: asNumber(tokens.total),
    inputTokens: asNumber(tokens.input),
    outputTokens: asNumber(tokens.output),
    reasoningTokens: asNumber(tokens.reasoning),
    cacheReadTokens: asNumber(cache.read),
    cacheCreationTokens: asNumber(cache.write),
    totalCostUsd: asNumber(part.cost) ?? undefined,
  }
}

/**
 * Whether a settled call failed, and with what.
 *
 * The status alone is not the answer. opencode marks a call `error` when the
 * call itself did not run — it threw, or a permission rule refused it — but a
 * shell command that ran and exited non-zero settles as `completed`, with the
 * failure only in `metadata.exit`. Reading the status alone would draw every
 * failed build as a success.
 */
function resultOf(state: Record<string, JsonValue>): ToolResult {
  const status = asString(state.status)
  const metadata = asRecord(state.metadata)
  const exit = asNumber(metadata.exit)
  const failed = status === OpencodeToolStatus.Error || (exit !== null && exit !== 0)
  const error = asString(state.error)
  return {
    text: error ?? asString(state.output) ?? "",
    isError: failed,
    // The whole metadata block, so a detail view can show the exit code, the
    // child session id a delegation names, or whatever a plugin's tool put
    // there — none of which flattens into the text without losing its shape.
    structured: Object.keys(metadata).length === 0 ? null : (state.metadata ?? null),
    // opencode returns no images on this wire.
    images: [],
  }
}

export class OpencodeStreamMapper implements AgentStreamMapper {
  private seq: number
  private sessionId: string | null = null
  private session: SessionInfo | null = null
  /**
   * Whether a session has been announced.
   *
   * opencode publishes no session line: the id rides on every event and there
   * is no init to read a model or a cwd from. The first line therefore *is* the
   * start of the session as far as this stream is concerned, and saying so once
   * is what gives a consumer the same opening event the other providers send.
   */
  private started = false
  /**
   * Sessions already announced.
   *
   * The server's `/event` endpoint is a bus, not one session's stream: every
   * session on the server publishes to it, background ones included. Each is
   * announced once, and every event is stamped with the session that produced
   * it rather than with whichever one happened to open the stream — otherwise
   * a second session's work is filed under the first.
   */
  private readonly openedSessions = new Set<string>()
  /**
   * Which index each streamed part holds in its message.
   *
   * The server identifies a block by a part id; a `BlockRef` identifies one by
   * position. Assigning positions in order of first appearance keeps the join
   * stable and keeps a delta joinable to the settled part that supersedes it,
   * without widening the shared contract for one provider's id scheme.
   */
  private readonly partIndex = new Map<string, number>()
  /** Messages the server said were the user's, so their text parts read as the prompt. */
  private readonly userMessages = new Set<string>()
  /** The model in force per session, so a change can be reported as one rather than restated. */
  private readonly models = new Map<string, string>()
  /** The session the line being mapped belongs to, so `build` can stamp it. */
  private current: string | null = null

  constructor(options: MapperOptions = {}) {
    this.seq = options.startSeq ?? 0
  }

  /** Decodes and maps one line. An unreadable line becomes a single `error` event rather than nothing. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseOpencodeLine(line)
    if (!parsed.ok) {
      return [this.build({ type: "error", message: `unreadable line: ${parsed.reason}` }, [], { line: parsed.line })]
    }
    return this.map(parsed.line)
  }

  /** Maps an already-decoded line. */
  map(event: OpencodeRawLine): readonly AgentEvent[] {
    const raw = event as JsonValue
    const line = asRecord(raw)
    const type = asString(line.type) ?? "unknown"
    const part = asRecord(line.part)

    // A bus line names its session inside `properties`; the one-way stream puts
    // it at the top level. Either way the event belongs to that session, not to
    // whichever one opened the stream.
    const properties = asRecord(line.properties)
    const lineSession =
      asString(line.sessionID) ?? asString(properties.sessionID) ?? asString(asRecord(properties.info).id)
    this.current = lineSession ?? this.sessionId
    const opened = this.open(lineSession, raw, isOpencodeServerEvent(type))

    switch (type) {
      case OpencodeWireType.StepStart:
        // The session event is the whole of what an opening step says; a later
        // one starts another model call inside the same turn and adds nothing.
        return opened

      case OpencodeWireType.StepFinish: {
        const reason = asString(part.reason)
        // A tool loop finishes a step per call, so only a step that stopped for
        // its own sake ends the turn. Treating every step as a turn would break
        // one answer into four.
        if (reason !== OpencodeFinishReason.Stop && reason !== OpencodeFinishReason.Error) return opened
        return [
          ...opened,
          this.build(
            {
              type: "turn_completed",
              status: reason === OpencodeFinishReason.Error ? "error" : "completed",
              stopReason: reason,
              terminalReason: null,
              finalText: null,
              usage: usageOf(part),
              durationMs: null,
              numTurns: null,
              permissionDenials: [],
            },
            [],
            raw,
          ),
        ]
      }

      case OpencodeWireType.UserMessage: {
        const text = asString(part.text)
        if (text === null || text === "") return opened
        return [...opened, this.build({ type: "user_message", text, synthetic: false }, [], raw)]
      }

      case OpencodeWireType.Text: {
        const text = asString(part.text)
        if (text === null || text === "") return opened
        return [...opened, this.build({ type: "assistant_text", text, block: null }, [], raw)]
      }

      case OpencodeWireType.Reasoning: {
        const text = asString(part.text)
        return [...opened, this.build({ type: "reasoning", text: text ?? "", block: null }, [], raw)]
      }

      case OpencodeWireType.Error:
        return [
          ...opened,
          this.build({ type: "error", message: asString(part.error) ?? asString(line.error) ?? "error" }, [], raw),
        ]

      case OpencodeWireType.ToolUse:
        return [...opened, ...this.tool(part, raw)]

      // ---------- the server's own wire ----------
      case OpencodeServerEventType.SessionCreated:
        // Deliberately nothing. The line carries an id, a directory and a
        // build, but no model and no agent — the update that follows it
        // immediately is the first line that actually describes the session,
        // and announcing a session whose model is unknown would publish a
        // `SessionInfo` that has to be corrected a millisecond later.
        return opened

      case OpencodeServerEventType.SessionUpdated: {
        const info = asRecord(properties.info)
        const sessionId = asString(info.id)
        if (sessionId === null) return opened
        const model = asString(asRecord(info.model).id)
        const previous = this.models.get(sessionId) ?? null
        if (model !== null) this.models.set(sessionId, model)

        // The first full description opens the session.
        if (!this.openedSessions.has(sessionId)) return [...opened, ...this.openFromServer(info, raw)]

        // Afterwards it is republished on every change, so only an actual
        // change to the model is worth an event.
        if (model === null || previous === null || model === previous) return opened
        return [...opened, this.build({ type: "model_changed", from: previous, to: model }, [], raw)]
      }

      case OpencodeServerEventType.SessionStatus:
        return [
          ...opened,
          this.build(
            {
              type: "status_changed",
              status: asString(asRecord(asRecord(line.properties).status).type),
              permissionMode: null,
            },
            [],
            raw,
          ),
        ]

      case OpencodeServerEventType.SessionIdle:
        // The turn's real end on this transport. A step finishing is the tool
        // loop; going idle is the agent stopping.
        return [
          ...opened,
          this.build(
            {
              type: "turn_completed",
              status: "completed",
              stopReason: "idle",
              terminalReason: null,
              finalText: null,
              usage: null,
              durationMs: null,
              numTurns: null,
              permissionDenials: [],
            },
            [],
            raw,
          ),
        ]

      case OpencodeServerEventType.MessagePartUpdated:
        return [...opened, ...this.serverPart(asRecord(line.properties), raw)]

      case OpencodeServerEventType.MessagePartDelta:
        return [...opened, ...this.serverDelta(asRecord(line.properties), raw)]

      case OpencodeServerEventType.PermissionAsked: {
        const properties = asRecord(line.properties)
        const tool = asRecord(properties.tool)
        return [
          ...opened,
          this.build(
            {
              type: "permission_requested",
              requestId: asString(properties.id) ?? "",
              callId: asString(tool.callID) ?? "",
              // The rule's name is what opencode escalates on — the tool's own
              // name is not on the ask.
              toolName: asString(properties.permission) ?? "",
              input: properties.metadata ?? null,
              reason: asString(properties.permission),
              displayName: null,
              description: null,
            },
            [],
            raw,
          ),
        ]
      }

      case OpencodeServerEventType.PermissionReplied: {
        const properties = asRecord(line.properties)
        const reply = asString(properties.reply)
        return [
          ...opened,
          this.build(
            {
              type: "permission_decided",
              requestId: asString(properties.requestID) ?? "",
              // opencode says "reject"; the contract says "deny". One
              // vocabulary reaches the consumer, whichever provider spoke.
              decision: reply === null ? null : reply === "reject" ? "deny" : "allow",
              message: null,
            },
            [],
            raw,
          ),
        ]
      }

      case OpencodeServerEventType.MessageUpdated: {
        const info = asRecord(asRecord(line.properties).info)
        const id = asString(info.id)
        // Remembered rather than acted on: a message's totals are republished
        // as it grows, but which side sent it is what makes its text a prompt
        // or an answer.
        if (id !== null && asString(info.role) === "user") this.userMessages.add(id)
        return opened
      }
      case OpencodeServerEventType.ServerConnected:
      case OpencodeServerEventType.ServerHeartbeat:
      case OpencodeServerEventType.SessionDiff:
      case OpencodeServerEventType.PluginAdded:
      case OpencodeServerEventType.CatalogUpdated:
      case OpencodeServerEventType.ReferenceUpdated:
      case OpencodeServerEventType.IntegrationUpdated:
        return opened

      default:
        return [...opened, this.build({ type: "unknown", wireType: type, subtype: asString(part.type) }, [], raw)]
    }
  }

  /**
   * A settled part from the server, which is the same shape the one-way stream
   * sends — so it is routed back through the same code rather than read twice.
   */
  private serverPart(properties: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const part = asRecord(properties.part)
    switch (asString(part.type)) {
      case OpencodePartType.Text: {
        const text = asString(part.text)
        if (text === null || text === "") return []
        // A text part on the *user's* message is the prompt echoed back — the
        // one thing this transport carries that the one-way stream does not.
        const isPrompt = this.userMessages.has(asString(part.messageID) ?? "")
        return [
          this.build(
            isPrompt ? { type: "user_message", text, synthetic: false } : { type: "assistant_text", text, block: this.blockOf(part) },
            [],
            raw,
          ),
        ]
      }
      case OpencodePartType.Reasoning: {
        const text = asString(part.text)
        return [this.build({ type: "reasoning", text: text ?? "", block: this.blockOf(part) }, [], raw)]
      }
      case OpencodePartType.Tool:
        return this.tool(part, raw)
      case OpencodePartType.StepFinish: {
        const reason = asString(part.reason)
        if (reason !== OpencodeFinishReason.Error) return []
        return [
          this.build(
            {
              type: "turn_completed",
              status: "error",
              stopReason: reason,
              terminalReason: null,
              finalText: null,
              usage: usageOf(part),
              durationMs: null,
              numTurns: null,
              permissionDenials: [],
            },
            [],
            raw,
          ),
        ]
      }
      default:
        return []
    }
  }

  /** One streamed chunk, joined to the part it will be superseded by. */
  private serverDelta(properties: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const messageId = asString(properties.messageID)
    const partId = asString(properties.partID)
    const delta = asString(properties.delta)
    if (messageId === null || partId === null || delta === null) return []
    const block = { messageId, index: this.indexOf(messageId, partId) }
    const field = asString(properties.field)
    // Arguments arrive as partial JSON, exactly as Claude's `input_json_delta`
    // does, so they take the same arm rather than being pasted into prose.
    if (field === OpencodeDeltaField.Input) {
      return [this.build({ type: "delta", delta: "input", block, partialJson: delta }, [], raw)]
    }
    return [this.build({ type: "delta", delta: "text", block, text: delta }, [], raw)]
  }

  /** A part's position in its message, assigned in order of first appearance. */
  private indexOf(messageId: string, partId: string): number {
    const key = `${messageId}:${partId}`
    const existing = this.partIndex.get(key)
    if (existing !== undefined) return existing
    let next = 0
    for (const stored of this.partIndex.keys()) if (stored.startsWith(`${messageId}:`)) next += 1
    this.partIndex.set(key, next)
    return next
  }

  /** The block a settled part occupies, so a preview can be superseded by it. */
  private blockOf(part: Record<string, JsonValue>): { messageId: string; index: number } | null {
    const messageId = asString(part.messageID)
    const partId = asString(part.id)
    if (messageId === null || partId === null) return null
    return { messageId, index: this.indexOf(messageId, partId) }
  }

  /** The session as the server describes it, which is everything the one-way stream omits. */
  private openFromServer(info: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const sessionId = asString(info.id)
    if (sessionId === null || this.openedSessions.has(sessionId)) return []
    this.openedSessions.add(sessionId)
    this.started = true
    this.sessionId ??= sessionId
    this.current = sessionId
    const session: SessionInfo = {
      sessionId,
      model: asString(asRecord(info.model).id),
      cwd: asString(info.directory),
      tools: [],
      slashCommands: [],
      terminalSlashCommands: [],
      agents: [],
      skills: [],
      plugins: [],
      mcpServers: [],
      // The rules themselves are on the wire; naming a single "mode" for a
      // list of patterned rules would flatten away what they actually say, and
      // the raw line keeps them for a surface that wants to show them.
      permissionMode: null,
      version: asString(info.version),
      outputStyle: null,
      initIndex: this.openedSessions.size - 1,
    }
    this.session ??= session
    return [this.build({ type: "session_started", session }, [], raw)]
  }

  /**
   * One settled call, as the pair of events a consumer's tool row expects.
   *
   * opencode publishes the call once, with input and result together. Emitting
   * only a completion would leave a row that never opened; emitting both keeps
   * every provider's tool rows built the same way, and the two simply share a
   * line here.
   */
  private tool(part: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const tool = asString(part.tool) ?? "unknown"
    const callId = asString(part.callID) ?? asString(part.id) ?? "unknown"
    const state = asRecord(part.state)
    const input = asRecord(state.input)
    const status = asString(state.status)
    const events: AgentEvent[] = [
      this.build(
        {
          type: "tool_call_started",
          callId,
          name: tool,
          kind: opencodeToolKind(tool),
          input: state.input ?? null,
          title: toolTitle(tool, input, asString(state.title)),
        },
        [],
        raw,
      ),
    ]

    // A call still running has opened but not settled. It arrives complete in
    // this mode; the guard is what keeps a future streaming build from
    // reporting a result nobody produced.
    if (status === OpencodeToolStatus.Pending || status === OpencodeToolStatus.Running) return events

    const metadata = asRecord(state.metadata)

    if (tool === OpencodeToolName.Task) {
      const childSession = asString(metadata.sessionId)
      events.push(
        this.build(
          {
            type: "task_started",
            taskId: callId,
            callId,
            taskKind: OPENCODE_TASK_KIND,
            // The agent's own name, which opencode puts on the call's input —
            // so a delegation can be labelled without waiting for its result.
            label: asString(input.subagent_type) ?? tool,
            description: asString(input.description) ?? asString(state.title) ?? "",
            prompt: asString(input.prompt),
            // Unlike the other two providers this names the child's own
            // session, and `opencode export <id>` reads it. Delegated work here
            // is readable, not merely watchable.
            transcriptId: childSession,
          },
          [],
          raw,
        ),
      )
    }

    events.push(this.build({ type: "tool_call_completed", callId, result: resultOf(state) }, [], raw))

    if (tool === OpencodeToolName.TodoWrite) {
      const steps = planOf(input)
      if (steps.length > 0) events.push(this.build({ type: "plan_updated", steps }, [], raw))
    }

    if (
      tool === OpencodeToolName.Write ||
      tool === OpencodeToolName.Edit ||
      tool === OpencodeToolName.Patch
    ) {
      // Only a call that actually ran changed anything: a refused write must
      // not be reported as an edit that happened.
      const edits = status === OpencodeToolStatus.Error ? [] : editsOf(tool, input)
      if (edits.length > 0) events.push(this.build({ type: "file_edits", callId, edits }, [], raw))
    }

    if (tool === OpencodeToolName.Task) {
      const result = resultOf(state)
      events.push(
        this.build(
          {
            type: "task_completed",
            taskId: callId,
            callId,
            status: status ?? "completed",
            summary: result.text === "" ? null : result.text,
            usage: null,
          },
          [],
          raw,
        ),
      )
    }

    return events
  }

  /** Announces the session the first time a line names one. */
  private open(sessionId: string | null, raw: JsonValue, fromServer: boolean): readonly AgentEvent[] {
    if (sessionId === null || this.openedSessions.has(sessionId)) return []
    // The bus describes a session properly on its own line; this fallback is
    // for the one-way stream, which never describes one at all.
    if (fromServer) return []
    this.openedSessions.add(sessionId)
    this.started = true
    this.sessionId ??= sessionId
    // Everything here is null because the wire says none of it. opencode
    // publishes no init line: not the model, not the working directory, not the
    // tools it loaded. A placeholder would state something the stream never
    // did, and `opencode models` / `agent list` are where those answers live.
    const session: SessionInfo = {
      sessionId,
      model: null,
      cwd: null,
      tools: [],
      slashCommands: [],
      terminalSlashCommands: [],
      agents: [],
      skills: [],
      plugins: [],
      mcpServers: [],
      permissionMode: null,
      version: null,
      outputStyle: null,
      initIndex: 0,
    }
    this.session = session
    return [this.build({ type: "session_started", session }, [], raw)]
  }

  private build(payload: AgentEventPayload, path: AgentPath, raw: JsonValue): AgentEvent {
    const seq = this.seq
    this.seq += 1
    const sessionId = this.current ?? this.sessionId ?? this.session?.sessionId ?? "unknown"
    const ts = asNumber(asRecord(raw).timestamp)
    return {
      id: `${sessionId}:${seq}`,
      sessionId,
      seq,
      // opencode stamps every line with epoch milliseconds — the only one of
      // the three that times its whole stream.
      ts: ts === null ? null : new Date(ts).toISOString(),
      agentPath: path,
      payload,
      raw,
    }
  }
}

/** Maps a whole capture in one pass, for a persisted log or a fixture. */
export function mapOpencodeStream(text: string, options?: MapperOptions): readonly AgentEvent[] {
  const mapper = new OpencodeStreamMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    events.push(...mapper.push(line))
  }
  return events
}
