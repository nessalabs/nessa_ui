/** @responsibility States, as data, which Cursor Agent line kind becomes which normalized event. */

import { AgentEventType, FileChange, TaskKind, ToolKind } from "../../events"
import { asRecord, asString } from "../../json"
import type { JsonValue } from "../../json"
import {
  CursorResultSubtype,
  CursorSystemSubtype,
  CursorThinkingSubtype,
  CursorToolCallSubtype,
  CursorToolEnvelope,
  CursorWireType,
} from "./wire"
import type { CursorRawLine } from "./wire"

/** A line's kind at the granularity the mapping turns on. */
export type CursorWireKind = string

export interface CursorMappingEntry {
  /** The normalized events this kind can produce. Empty means it deliberately produces nothing. */
  readonly emits: readonly AgentEventType[]
  /** Why, in one line. For an empty `emits` this is the whole justification. */
  readonly note: string
}

/**
 * The provider-to-contract mapping, as data.
 *
 * Same shape as Claude and Codex, against the same [`AgentEventType`] values —
 * which is what makes "swap the mapper, keep the components" checkable.
 */
export const CURSOR_EVENT_MAPPING: Readonly<Record<CursorWireKind, CursorMappingEntry>> = Object.freeze({
  // ---------- session and turn ----------
  [`${CursorWireType.System}/${CursorSystemSubtype.Init}`]: {
    emits: [AgentEventType.SessionStarted, AgentEventType.ModelChanged],
    note: "opens the session and names the model; a later init with a different model is a model change",
  },
  [`${CursorWireType.Result}/${CursorResultSubtype.Success}`]: {
    emits: [AgentEventType.TurnCompleted],
    note: "the turn terminator, carrying camelCase usage; the concatenated result string is left on raw rather than drawn as finalText",
  },

  // ---------- conversation ----------
  [`${CursorWireType.User}/text`]: {
    emits: [AgentEventType.UserMessage],
    note: "what the user typed",
  },
  [`${CursorWireType.Assistant}/delta`]: {
    emits: [AgentEventType.Delta],
    note: "a text fragment with timestamp_ms and no model_call_id; the snapshot that carries model_call_id supersedes it",
  },
  [`${CursorWireType.Assistant}/text`]: {
    emits: [AgentEventType.AssistantText],
    note: "committed prose — either the mid-turn snapshot that carries model_call_id, or the final line with no timestamp",
  },

  // ---------- reasoning ----------
  [`${CursorWireType.Thinking}/${CursorThinkingSubtype.Delta}`]: {
    emits: [AgentEventType.Delta],
    note: "a reasoning fragment; accumulated until thinking/completed",
  },
  [`${CursorWireType.Thinking}/${CursorThinkingSubtype.Completed}`]: {
    emits: [AgentEventType.Reasoning],
    note: "closes the open thinking block with the text the deltas built",
  },

  // ---------- tools ----------
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Started}/${CursorToolEnvelope.Shell}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a shell command begins",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Completed}/${CursorToolEnvelope.Shell}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "stdout/stderr and exit code",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Started}/${CursorToolEnvelope.Edit}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a file write begins",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Completed}/${CursorToolEnvelope.Edit}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "settles and publishes the unified diff Cursor reports",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Started}/${CursorToolEnvelope.Read}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a file read begins",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Completed}/${CursorToolEnvelope.Read}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "the file contents settle",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Started}/${CursorToolEnvelope.Grep}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a search begins",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Completed}/${CursorToolEnvelope.Grep}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "match results settle as structured output",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Started}/${CursorToolEnvelope.Task}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.TaskStarted],
    note: "a spawned Cursor agent: a call on this thread, and a run whose own work never reaches this stream",
  },
  [`${CursorWireType.ToolCall}/${CursorToolCallSubtype.Completed}/${CursorToolEnvelope.Task}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.TaskCompleted],
    note: "the spawn settles; the child's transcript is not on this stream",
  },
})

/** The mapping key for one decoded line. */
export function cursorWireKind(event: CursorRawLine): CursorWireKind {
  const line = asRecord(event as JsonValue)
  const type = asString(line.type) ?? "unknown"
  const subtype = asString(line.subtype)

  if (type === CursorWireType.System) {
    return `${type}/${subtype ?? "unknown"}`
  }
  if (type === CursorWireType.Thinking) {
    return subtype === null ? type : `${type}/${subtype}`
  }
  if (type === CursorWireType.Result) {
    return subtype === null ? type : `${type}/${subtype}`
  }
  if (type === CursorWireType.ToolCall) {
    const envelope = cursorToolEnvelopeOf(asRecord(line.tool_call))
    if (subtype === null) return type
    return envelope === null ? `${type}/${subtype}` : `${type}/${subtype}/${envelope}`
  }
  if (type === CursorWireType.User) {
    return `${type}/text`
  }
  if (type === CursorWireType.Assistant) {
    // Three shapes: timestamped fragments, a timestamped snapshot that carries
    // model_call_id (the mid-turn commit), and a final line with no timestamp.
    const streaming =
      line.timestamp_ms !== undefined &&
      line.timestamp_ms !== null &&
      asString(line.model_call_id) === null
    return streaming ? `${type}/delta` : `${type}/text`
  }
  return type
}

/** What a line kind is declared to produce, or null for a kind nobody has decided about. */
export function cursorMappingFor(kind: CursorWireKind): CursorMappingEntry | null {
  return CURSOR_EVENT_MAPPING[kind] ?? null
}

/** Cursor's tool envelopes mapped to our tool rendering hints. */
export const CURSOR_TOOL_KIND: Readonly<Partial<Record<CursorToolEnvelope, ToolKind>>> = Object.freeze({
  [CursorToolEnvelope.Shell]: "shell",
  [CursorToolEnvelope.Edit]: "file_edit",
  [CursorToolEnvelope.Read]: "file_read",
  [CursorToolEnvelope.Grep]: "search",
  [CursorToolEnvelope.Task]: "subagent",
})

/** Stable display names for the envelopes. */
export const CURSOR_TOOL_NAME: Readonly<Partial<Record<CursorToolEnvelope, string>>> = Object.freeze({
  [CursorToolEnvelope.Shell]: "Shell",
  [CursorToolEnvelope.Edit]: "Edit",
  [CursorToolEnvelope.Read]: "Read",
  [CursorToolEnvelope.Grep]: "Grep",
  [CursorToolEnvelope.Task]: "Task",
})

/** Reads a tool envelope key as one of our tool kinds. */
export function cursorToolKind(envelope: string | null): ToolKind {
  if (envelope === null) return "other"
  return CURSOR_TOOL_KIND[envelope as CursorToolEnvelope] ?? "other"
}

/** Reads a tool envelope key as a display name. */
export function cursorToolName(envelope: string | null): string {
  if (envelope === null) return "tool"
  return CURSOR_TOOL_NAME[envelope as CursorToolEnvelope] ?? envelope
}

/** Every Cursor Task spawn is an agent run. */
export const CURSOR_TASK_KIND: TaskKind = TaskKind.Agent

/**
 * Edit results do not say add versus update; a missing before-content and a
 * `/dev/null` diff header are the only signals that this is a create.
 */
export function cursorFileChange(diff: string | null): FileChange {
  if (diff !== null && diff.includes("--- /dev/null")) return FileChange.Add
  return FileChange.Update
}

/** The envelope key nested under `tool_call`, or null when none is recognised. */
export function cursorToolEnvelopeOf(toolCall: Record<string, JsonValue>): string | null {
  for (const key of Object.values(CursorToolEnvelope)) {
    if (key in toolCall) return key
  }
  // An unknown camelCase *ToolCall is not in the mapping table, so returning it
  // here would only produce `unknown` events. Leave it null and let the mapper
  // say so explicitly.
  return null
}
