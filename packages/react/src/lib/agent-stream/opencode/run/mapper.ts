/** @responsibility Turns `opencode run --format json` lines into normalized agent events. */

import type { AgentEvent, AgentStreamMapper, MapperOptions } from "../../events"
import { asNumber, asRecord, asString } from "../../json"
import type { JsonValue } from "../../json"
import { EventSink } from "../../emitter"
import { OpencodeFinishReason, bareSession, usageOf, toolEvents } from "../parts"
import { OpencodeRunType, parseOpencodeLine } from "./wire"
import type { OpencodeRawLine } from "./wire"

/**
 * Reads the one-way stream.
 *
 * What is specific to this transport, and nothing else: it never announces a
 * session, it never streams a partial, and a turn ends when a step stops for
 * its own sake rather than because the tool loop went round again.
 */
export class OpencodeRunMapper implements AgentStreamMapper {
  private readonly emit: EventSink

  constructor(options: MapperOptions = {}) {
    this.emit = new EventSink(options.startSeq ?? 0)
  }

  /** Decodes and maps one line. An unreadable line becomes a single `error` event rather than nothing. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseOpencodeLine(line)
    if (!parsed.ok) {
      return [this.emit.build({ type: "error", message: `unreadable line: ${parsed.reason}` }, { line: parsed.line }, null)]
    }
    return this.map(parsed.line)
  }

  /** Maps an already-decoded line. */
  map(event: OpencodeRawLine): readonly AgentEvent[] {
    const raw = event as JsonValue
    const line = asRecord(raw)
    const type = asString(line.type) ?? "unknown"
    const part = asRecord(line.part)
    // opencode stamps every line with epoch milliseconds — the only one of the
    // three providers that times its whole stream.
    const stamp = asNumber(line.timestamp)
    const ts = stamp === null ? null : new Date(stamp).toISOString()

    const opened = this.open(asString(line.sessionID), raw, ts)

    switch (type) {
      case OpencodeRunType.StepStart:
        // The session event is the whole of what an opening step says; a later
        // one starts another model call inside the same turn and adds nothing.
        return opened

      case OpencodeRunType.StepFinish: {
        const reason = asString(part.reason)
        // A tool loop finishes a step per call, so only a step that stopped for
        // its own sake ends the turn. Treating every step as a turn would break
        // one answer into four — but every reason that is *not* the loop going
        // round again is terminal, including the two that end a turn badly.
        // Listing only `stop` left a run that hit the token ceiling open for
        // ever.
        if (reason === null || reason === OpencodeFinishReason.ToolCalls) return opened
        return [
          ...opened,
          this.emit.build(
            {
              type: "turn_completed",
              status: reason === OpencodeFinishReason.Stop ? "completed" : "error",
              stopReason: reason,
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

      case OpencodeRunType.UserMessage: {
        const text = asString(part.text)
        if (text === null || text === "") return opened
        return [...opened, this.emit.build({ type: "user_message", text, synthetic: false }, raw, ts)]
      }

      case OpencodeRunType.Text: {
        const text = asString(part.text)
        if (text === null || text === "") return opened
        // No partials on this wire, so there is no preview to supersede and no
        // block to join one to.
        return [...opened, this.emit.build({ type: "assistant_text", text, block: null }, raw, ts)]
      }

      case OpencodeRunType.Reasoning: {
        const text = asString(part.text)
        return [...opened, this.emit.build({ type: "reasoning", text: text ?? "", block: null }, raw, ts)]
      }

      case OpencodeRunType.Error: {
        // The failure is nested: `error.data.message`, itself a JSON string
        // from whatever upstream refused. Reading `error` as a string — which
        // it never is — reported every failure as the word "error".
        const error = asRecord(line.error)
        const message =
          asString(asRecord(error.data).message) ?? asString(error.name) ?? asString(part.error) ?? "error"
        return [...opened, this.emit.build({ type: "error", message }, raw, ts)]
      }

      case OpencodeRunType.ToolUse:
        return [...opened, ...toolEvents(this.emit, part, raw, ts)]

      default:
        return [...opened, this.emit.build({ type: "unknown", wireType: type, subtype: asString(part.type) }, raw, ts)]
    }
  }

  /**
   * Announces the session the first time a line names one.
   *
   * This wire publishes no init at all: not the model, not the working
   * directory, not the tools it loaded. The first line therefore *is* the start
   * of the session as far as it is concerned, and saying so once is what gives
   * a consumer the same opening event the other providers send. Everything the
   * wire does not say stays null rather than becoming a placeholder.
   */
  private open(sessionId: string | null, raw: JsonValue, ts: string | null): readonly AgentEvent[] {
    if (sessionId === null) return []
    this.emit.current = sessionId
    if (this.emit.openedSessions.has(sessionId)) return []
    this.emit.openedSessions.add(sessionId)
    this.emit.primary ??= sessionId
    return [
      this.emit.build({ type: "session_started", session: bareSession(sessionId, this.emit.openedSessions.size - 1) }, raw, ts),
    ]
  }
}

/** Maps a whole capture in one pass, for a persisted log or a fixture. */
export function mapOpencodeStream(text: string, options?: MapperOptions): readonly AgentEvent[] {
  const mapper = new OpencodeRunMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    events.push(...mapper.push(line))
  }
  return events
}
