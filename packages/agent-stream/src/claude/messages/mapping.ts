/** @responsibility States, as data, which Messages API frame kind becomes which normalized event. */

import { asRecord, asString } from "../../json"
import { AgentEventType } from "../../events"
import { MessagesBlockType, MessagesDeltaType, MessagesFrameType, MessagesStopReason } from "./wire"
import type { WireEvent } from "./wire"

/**
 * A frame's kind, at the granularity the mapping actually turns on.
 *
 * Not just `type`: a `content_block_start` means nothing without its block
 * kind, and a `content_block_delta` nothing without its delta kind. The key is
 * the smallest thing that determines the answer.
 */
export type MessagesWireKind = string

/** What one kind of frame produces. */
export interface MessagesMappingEntry {
  /** The normalized events this kind can produce. Empty means it deliberately produces nothing. */
  readonly emits: readonly AgentEventType[]
  /** Why, in one line. For an empty `emits` this is the whole justification. */
  readonly note: string
}

/**
 * The wire-to-contract mapping, as data.
 *
 * Written down rather than left implicit in the mapper's switches so the
 * translation can be *read*, and tested: the suite walks every fixture frame,
 * computes its kind, and asserts the mapper emitted exactly what this promises.
 * A kind missing from here is a frame nobody decided about.
 *
 * The striking thing about this table next to Claude Code's is how much of the
 * contract it leaves empty. There is no session to start, no turn result, no
 * delegated work, no plan, no approval — because this wire is one model
 * response, not a session. Those absences are facts about the transport, and
 * the transports table is where a surface reads them.
 */
export const CLAUDE_MESSAGES_EVENT_MAPPING: Readonly<Record<MessagesWireKind, MessagesMappingEntry>> = Object.freeze({
  // ---------- message lifecycle ----------
  [MessagesFrameType.MessageStart]: {
    emits: [AgentEventType.SessionStarted, AgentEventType.ModelChanged],
    note: "the only frame naming the model; synthesizes the session this wire never announces",
  },
  [MessagesFrameType.MessageDelta]: {
    emits: [AgentEventType.TurnCompleted],
    note: "the turn terminator, carrying stop reason and the final output count — except where the turn continues",
  },
  /**
   * The same frame, for the two stop reasons that are not endings.
   *
   * Keyed separately because they produce nothing. Both hand control back to
   * the host mid-turn and the conversation resumes in the very next request —
   * `tool_use` waiting for a result, `pause_turn` for a long-running
   * server-tool flow the host resumes by resending. Treating either as a
   * completed turn would split one turn into as many turns as it paused.
   */
  [`${MessagesFrameType.MessageDelta}/${MessagesStopReason.ToolUse}`]: {
    emits: [],
    note: "not a turn ending — the model is waiting for a tool result the host owes it",
  },
  [`${MessagesFrameType.MessageDelta}/${MessagesStopReason.PauseTurn}`]: {
    emits: [],
    note: "also not a turn ending — a long-running server-tool flow the host resumes by resending",
  },
  [MessagesFrameType.MessageStop]: {
    emits: [],
    note: "a bare end marker; message_delta already reported everything it could say",
  },

  // ---------- content blocks ----------
  [`${MessagesFrameType.ContentBlockStart}/${MessagesBlockType.Text}`]: {
    emits: [AgentEventType.Delta],
    note: "opens a text block; the committed text arrives at content_block_stop",
  },
  [`${MessagesFrameType.ContentBlockStart}/${MessagesBlockType.Thinking}`]: {
    emits: [AgentEventType.Delta],
    note: "opens a thinking block; committed at content_block_stop",
  },
  [`${MessagesFrameType.ContentBlockStart}/${MessagesBlockType.ToolUse}`]: {
    emits: [AgentEventType.Delta],
    note: "names the call, but its arguments have not streamed yet — the call is emitted at block stop",
  },
  [`${MessagesFrameType.ContentBlockStart}/${MessagesBlockType.ServerToolUse}`]: {
    emits: [AgentEventType.Delta],
    note: "same as tool_use, but nothing will ever send a result back for it",
  },
  [`${MessagesFrameType.ContentBlockStart}/${MessagesBlockType.WebSearchToolResult}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "the server tool's own answer, arriving inline as content rather than from the host",
  },
  [`${MessagesFrameType.ContentBlockStart}/${MessagesBlockType.CodeExecutionToolResult}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "as above; the payload is often encrypted, and is passed through rather than decoded",
  },

  // ---------- deltas ----------
  [`${MessagesFrameType.ContentBlockDelta}/${MessagesDeltaType.Text}`]: {
    emits: [AgentEventType.Delta],
    note: "a token-level preview, superseded by the assistant_text at block stop",
  },
  [`${MessagesFrameType.ContentBlockDelta}/${MessagesDeltaType.Thinking}`]: {
    emits: [AgentEventType.Delta],
    note: "as above, for reasoning",
  },
  [`${MessagesFrameType.ContentBlockDelta}/${MessagesDeltaType.Signature}`]: {
    emits: [],
    note: "a cryptographic signature over the thinking block; carried for replay, never rendered",
  },
  [`${MessagesFrameType.ContentBlockDelta}/${MessagesDeltaType.InputJson}`]: {
    emits: [AgentEventType.Delta],
    note: "one fragment of the call's arguments; only the concatenation is valid JSON",
  },

  // ---------- block completion ----------
  [`${MessagesFrameType.ContentBlockStop}/${MessagesBlockType.Text}`]: {
    emits: [AgentEventType.Delta, AgentEventType.AssistantText],
    note: "the joined text, committed — this is the event a transcript renders",
  },
  [`${MessagesFrameType.ContentBlockStop}/${MessagesBlockType.Thinking}`]: {
    emits: [AgentEventType.Delta, AgentEventType.Reasoning],
    note: "the joined reasoning, committed",
  },
  [`${MessagesFrameType.ContentBlockStop}/${MessagesBlockType.ToolUse}`]: {
    emits: [AgentEventType.Delta, AgentEventType.ToolCallStarted],
    note: "the call is only whole here: its arguments finished streaming as fragments",
  },
  [`${MessagesFrameType.ContentBlockStop}/${MessagesBlockType.ServerToolUse}`]: {
    emits: [AgentEventType.Delta, AgentEventType.ToolCallStarted],
    note: "as above; its result block follows on this same stream",
  },
  [`${MessagesFrameType.ContentBlockStop}/${MessagesBlockType.WebSearchToolResult}`]: {
    emits: [AgentEventType.Delta],
    note: "the result block was whole when it opened; nothing further to commit",
  },
  [`${MessagesFrameType.ContentBlockStop}/${MessagesBlockType.CodeExecutionToolResult}`]: {
    emits: [AgentEventType.Delta],
    note: "as above",
  },
})

/**
 * The kind of one frame, at the granularity [`CLAUDE_MESSAGES_EVENT_MAPPING`] keys on.
 *
 * A `content_block_stop` names no block kind of its own — it carries only an
 * index — so the caller passes the kind it recorded when the block opened.
 * That is the mapper's state, not the frame's, and pretending otherwise is how
 * a stop frame ends up unclassifiable.
 */
export function messagesWireKind(event: WireEvent, openBlockType?: string | null): MessagesWireKind {
  const frame = asRecord(event as never)
  const type = asString(frame.type) ?? "unknown"

  if (type === MessagesFrameType.ContentBlockStart) {
    const block = asRecord(frame.content_block)
    return `${type}/${asString(block.type) ?? "unknown"}`
  }
  if (type === MessagesFrameType.ContentBlockDelta) {
    const delta = asRecord(frame.delta)
    return `${type}/${asString(delta.type) ?? "unknown"}`
  }
  if (type === MessagesFrameType.ContentBlockStop) {
    return `${type}/${openBlockType ?? "unknown"}`
  }
  if (type === MessagesFrameType.MessageDelta) {
    // The two "conversation continues" stop reasons are a different outcome
    // from every other one, so they are different kinds — see the table.
    const stopReason = asString(asRecord(frame.delta).stop_reason)
    if (stopReason === MessagesStopReason.ToolUse || stopReason === MessagesStopReason.PauseTurn) {
      return `${type}/${stopReason}`
    }
  }
  return type
}

/** The mapping for one kind, or null when nobody has decided about it. */
export function messagesMappingFor(kind: MessagesWireKind): MessagesMappingEntry | null {
  return CLAUDE_MESSAGES_EVENT_MAPPING[kind] ?? null
}
