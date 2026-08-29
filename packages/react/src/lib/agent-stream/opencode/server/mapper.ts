/** @responsibility Turns `opencode serve` SSE frames into normalized agent events. */

import type { AgentEvent, AgentStreamMapper, MapperOptions, SessionInfo } from "../../events"
import { asNumber, asRecord, asString } from "../../json"
import type { JsonValue } from "../../json"
import { EventSink } from "../../emitter"
import { OpencodeFinishReason, OpencodePartType, blockOf, planOf, toolEvents, usageOf } from "../parts"
import type { OpencodeRawLine } from "../run/wire"
import { OpencodeDeltaField, OpencodeServerEventType, parseOpencodeSseLine } from "./wire"

/**
 * Reads the server's bus.
 *
 * Everything specific to this transport lives here, and it disagrees with the
 * one-way stream on all three of the things that matter: it describes the
 * session, it streams, and a turn ends when the session goes idle rather than
 * when a step stops.
 */
export class OpencodeServerMapper implements AgentStreamMapper {
  private readonly emit: EventSink
  /** Messages the bus said were the user's, so their text parts read as the prompt. */
  private readonly userMessages = new Set<string>()
  /**
   * Tool names by call id.
   *
   * A permission ask names the *rule* that escalated and the call it belongs
   * to, never the tool. The tool part that opened that call did, so the name
   * is remembered from there rather than the rule being reported as one.
   */
  private readonly toolNames = new Map<string, string>()
  /** The model in force per session, so a change is reported as one rather than restated. */
  private readonly models = new Map<string, string>()
  /**
   * Sessions whose current turn has already ended.
   *
   * A failed step ends the turn, and the session then goes idle as it always
   * does — two terminators for one turn, which closes it twice and lets the
   * later idle make a failure look like a clean finish. Cleared when the next
   * step opens.
   */
  private readonly finishedTurns = new Set<string>()

  constructor(options: MapperOptions = {}) {
    this.emit = new EventSink(options.startSeq ?? 0)
  }

  /** Decodes and maps one SSE frame. A frame carrying no payload maps to nothing. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseOpencodeSseLine(line)
    if (parsed === null) return []
    if (!parsed.ok) {
      return [this.emit.build({ type: "error", message: `unreadable frame: ${parsed.reason}` }, { line: parsed.line }, null)]
    }
    return this.map(parsed.line)
  }

  /** Maps an already-decoded frame. */
  map(event: OpencodeRawLine): readonly AgentEvent[] {
    const raw = event as JsonValue
    const line = asRecord(raw)
    const type = asString(line.type) ?? "unknown"
    const properties = asRecord(line.properties)

    // A bus frame names its session inside `properties`. The event belongs to
    // that session, not to whichever one opened the stream: `/event` is
    // server-wide, so a background run's work would otherwise be filed under
    // the conversation someone is reading.
    const sessionId =
      asString(properties.sessionID) ?? asString(asRecord(properties.info).id) ?? this.emit.primary
    this.emit.current = sessionId
    const ts = asNumber(properties.time)
    const stamp = ts === null ? null : new Date(ts).toISOString()

    switch (type) {
      case OpencodeServerEventType.SessionCreated:
        // Deliberately nothing. The frame carries an id, a directory and a
        // build, but no model and no agent — the update that follows it
        // immediately is the first frame that describes the session, and
        // announcing one whose model is unknown would publish a `SessionInfo`
        // that has to be corrected a millisecond later.
        return []

      case OpencodeServerEventType.SessionUpdated: {
        const info = asRecord(properties.info)
        const id = asString(info.id)
        if (id === null) return []
        const model = asString(asRecord(info.model).id)
        const previous = this.models.get(id) ?? null
        if (model !== null) this.models.set(id, model)

        if (!this.emit.openedSessions.has(id)) return this.open(info, raw, stamp)

        // Afterwards it is republished on every change, so only an actual
        // change to the model is worth an event.
        if (model === null || previous === null || model === previous) return []
        return [this.emit.build({ type: "model_changed", from: previous, to: model }, raw, stamp)]
      }

      case OpencodeServerEventType.SessionStatus:
        return [
          this.emit.build(
            { type: "status_changed", status: asString(asRecord(properties.status).type), permissionMode: null },
            raw,
            stamp,
          ),
        ]

      case OpencodeServerEventType.SessionIdle: {
        // The turn's real end on this transport. A step finishing is the tool
        // loop; going idle is the agent stopping — unless a failed step has
        // already ended it, in which case this idle is the same turn's echo.
        const already = sessionId !== null && this.finishedTurns.has(sessionId)
        if (sessionId !== null) this.finishedTurns.add(sessionId)
        if (already) return []
        return [
          this.emit.build(
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
            raw,
            stamp,
          ),
        ]
      }

      case OpencodeServerEventType.MessageUpdated: {
        const info = asRecord(properties.info)
        const id = asString(info.id)
        // Remembered rather than acted on: a message's totals are republished
        // as it grows, but which side sent it is what makes its text a prompt
        // or an answer.
        if (id !== null && asString(info.role) === "user") this.userMessages.add(id)
        return []
      }

      case OpencodeServerEventType.TodoUpdated: {
        const steps = planOf(properties)
        if (steps.length === 0) return []
        return [this.emit.build({ type: "plan_updated", steps }, raw, stamp)]
      }

      case OpencodeServerEventType.MessagePartUpdated:
        return this.part(asRecord(properties.part), raw, stamp)

      case OpencodeServerEventType.MessagePartDelta:
        return this.delta(properties, raw, stamp)

      case OpencodeServerEventType.PermissionAsked: {
        const tool = asRecord(properties.tool)
        return [
          this.emit.build(
            {
              type: "permission_requested",
              requestId: asString(properties.id) ?? "",
              callId: asString(tool.callID) ?? "",
              // The tool the call is for, remembered from the part that opened
              // it. Reporting the rule here instead made every ask look like a
              // call to a tool named `external_directory`.
              toolName: this.toolNames.get(asString(tool.callID) ?? "") ?? "",
              input: properties.metadata ?? null,
              // What escalated: the rule's own name.
              reason: asString(properties.permission),
              displayName: null,
              description: null,
            },
            raw,
            stamp,
          ),
        ]
      }

      case OpencodeServerEventType.PermissionReplied: {
        const reply = asString(properties.reply)
        return [
          this.emit.build(
            {
              type: "permission_decided",
              requestId: asString(properties.requestID) ?? "",
              // opencode says "reject"; the contract says "deny". One
              // vocabulary reaches the consumer, whichever provider spoke.
              decision: reply === null ? null : reply === "reject" ? "deny" : "allow",
              message: null,
            },
            raw,
            stamp,
          ),
        ]
      }

      case OpencodeServerEventType.ServerConnected:
      case OpencodeServerEventType.ServerHeartbeat:
      case OpencodeServerEventType.SessionDiff:
      case OpencodeServerEventType.FileEdited:
      case OpencodeServerEventType.FileWatcherUpdated:
      case OpencodeServerEventType.PluginAdded:
      case OpencodeServerEventType.CatalogUpdated:
      case OpencodeServerEventType.ReferenceUpdated:
      case OpencodeServerEventType.IntegrationUpdated:
        return []

      default:
        return [this.emit.build({ type: "unknown", wireType: type, subtype: null }, raw, stamp)]
    }
  }

  /**
   * A settled part, which is the same shape the one-way stream sends — so it is
   * routed through the same code rather than read twice.
   */
  private part(part: Record<string, JsonValue>, raw: JsonValue, ts: string | null): readonly AgentEvent[] {
    switch (asString(part.type)) {
      case OpencodePartType.Text: {
        const text = asString(part.text)
        if (text === null || text === "") return []
        // A text part on the *user's* message is the prompt echoed back — the
        // one thing this transport carries that the one-way stream does not.
        const isPrompt = this.userMessages.has(asString(part.messageID) ?? "")
        return [
          this.emit.build(
            isPrompt
              ? { type: "user_message", text, synthetic: false }
              : { type: "assistant_text", text, block: blockOf(this.emit, part) },
            raw,
            ts,
          ),
        ]
      }
      case OpencodePartType.Reasoning: {
        const text = asString(part.text)
        return [this.emit.build({ type: "reasoning", text: text ?? "", block: blockOf(this.emit, part) }, raw, ts)]
      }
      case OpencodePartType.Tool: {
        const callId = asString(part.callID) ?? asString(part.id)
        const tool = asString(part.tool)
        if (callId !== null && tool !== null) this.toolNames.set(callId, tool)
        return toolEvents(this.emit, part, raw, ts)
      }
      case OpencodePartType.StepStart:
        // A new step means a new turn is under way, so a previous terminal no
        // longer applies.
        if (this.emit.current !== null) this.finishedTurns.delete(this.emit.current)
        return []

      case OpencodePartType.StepFinish: {
        // A step ending mid-turn is the tool loop; `session.idle` is what ends
        // the turn here. Only a failed step is worth reporting on its own.
        if (asString(part.reason) !== OpencodeFinishReason.Error) return []
        if (this.emit.current !== null) this.finishedTurns.add(this.emit.current)
        return [
          this.emit.build(
            {
              type: "turn_completed",
              status: "error",
              stopReason: OpencodeFinishReason.Error,
              terminalReason: null,
              finalText: null,
              usage: usageOf(part),
              durationMs: null,
              numTurns: null,
              permissionDenials: [],
            },
            raw,
            ts,
          ),
        ]
      }
      default:
        return []
    }
  }

  /** One streamed chunk, joined to the part it will be superseded by. */
  private delta(properties: Record<string, JsonValue>, raw: JsonValue, ts: string | null): readonly AgentEvent[] {
    const messageId = asString(properties.messageID)
    const partId = asString(properties.partID)
    const delta = asString(properties.delta)
    if (messageId === null || partId === null || delta === null) return []
    const block = { messageId, index: this.emit.indexOf(messageId, partId) }
    // Arguments arrive as partial JSON, exactly as Claude's `input_json_delta`
    // does, so they take the same arm rather than being pasted into prose.
    if (asString(properties.field) === OpencodeDeltaField.Input) {
      return [this.emit.build({ type: "delta", delta: "input", block, partialJson: delta }, raw, ts)]
    }
    return [this.emit.build({ type: "delta", delta: "text", block, text: delta }, raw, ts)]
  }

  /** The session as the server describes it, which is everything the one-way stream omits. */
  private open(info: Record<string, JsonValue>, raw: JsonValue, ts: string | null): readonly AgentEvent[] {
    const sessionId = asString(info.id)
    if (sessionId === null) return []
    this.emit.openedSessions.add(sessionId)
    this.emit.primary ??= sessionId
    this.emit.current = sessionId
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
      // The rules themselves are on the wire; naming a single "mode" for a list
      // of patterned rules would flatten away what they actually say, and the
      // raw frame keeps them for a surface that wants to show them.
      permissionMode: null,
      version: asString(info.version),
      outputStyle: null,
      initIndex: this.emit.openedSessions.size - 1,
    }
    return [this.emit.build({ type: "session_started", session }, raw, ts)]
  }
}

/** Maps a whole SSE capture in one pass, for a saved stream or a fixture. */
export function mapOpencodeServerStream(text: string, options?: MapperOptions): readonly AgentEvent[] {
  const mapper = new OpencodeServerMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) events.push(...mapper.push(line))
  return events
}
