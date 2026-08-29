/** @responsibility Emits normalized events in order, holding the small amount of state that requires. */

import type { AgentEvent, AgentEventPayload } from "./events"
import { asString } from "./json"
import type { JsonValue } from "./json"

/**
 * The bookkeeping every mapper needs, and nothing else.
 *
 * Five wires across three agents all have to do the same four things: number
 * their events, remember which session a frame belongs to, announce a session
 * once, and give a streamed chunk a block to be superseded on. Written once
 * because a second copy is a second place for the ordering to drift.
 */
export class EventSink {
  private seq: number
  /** The session a line belongs to, so every event is stamped with its own. */
  current: string | null = null
  /** The first session seen, which is what a single-session consumer means by "the" session. */
  primary: string | null = null
  /** Sessions already announced. The server's bus carries more than one. */
  readonly openedSessions = new Set<string>()
  /** Messages the server said were the user's, so their text parts read as the prompt. */
  readonly userMessages = new Set<string>()
  /** The model in force per session, so a change is reported as one rather than restated. */
  readonly models = new Map<string, string>()
  /**
   * Which index each streamed part holds in its message.
   *
   * The server identifies a block by a part id; a `BlockRef` identifies one by
   * position. Assigning positions in order of first appearance keeps a delta
   * joinable to the part that supersedes it, without widening the shared
   * contract for one provider's id scheme.
   */
  private readonly partIndex = new Map<string, number>()

  constructor(startSeq = 0) {
    this.seq = startSeq
  }

  build(payload: AgentEventPayload, raw: JsonValue, ts: string | null): AgentEvent {
    const seq = this.seq
    this.seq += 1
    const sessionId = this.current ?? this.primary ?? "unknown"
    return { id: `${sessionId}:${seq}`, sessionId, seq, ts, agentPath: [], payload, raw }
  }

  /** A part's position in its message, assigned in order of first appearance. */
  indexOf(messageId: string, partId: string): number {
    const key = `${messageId}:${partId}`
    const existing = this.partIndex.get(key)
    if (existing !== undefined) return existing
    let next = 0
    for (const stored of this.partIndex.keys()) if (stored.startsWith(`${messageId}:`)) next += 1
    this.partIndex.set(key, next)
    return next
  }

  /** The block a settled part occupies, so a preview can be superseded by it. */
  blockOf(part: Record<string, JsonValue>): { messageId: string; index: number } | null {
    const messageId = asString(part.messageID)
    const partId = asString(part.id)
    if (messageId === null || partId === null) return null
    return { messageId, index: this.indexOf(messageId, partId) }
  }
}
