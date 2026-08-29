/** @responsibility States, as data, which Codex line kind becomes which normalized event. */

import { AgentEventType, FileChange, PlanStepStatus, TaskKind, ToolKind } from "../../events"
import { asRecord, asString } from "../../json"
import type { JsonValue } from "../../json"
import { CodexFileChangeKind, CodexItemType, CodexWireType } from "./wire"
import type { CodexRawLine } from "./wire"

/** A line's kind at the granularity the mapping turns on: the line type, plus the item kind where there is one. */
export type CodexWireKind = string

export interface CodexMappingEntry {
  /** The normalized events this kind can produce. Empty means it deliberately produces nothing. */
  readonly emits: readonly AgentEventType[]
  /** Why, in one line. For an empty `emits` this is the whole justification. */
  readonly note: string
}

/**
 * The provider-to-contract mapping, as data.
 *
 * The same shape `CLAUDE_EVENT_MAPPING` uses, against the same
 * [`AgentEventType`] values — which is what makes "swap the mapper, keep the
 * components" checkable rather than aspirational. A kind missing from here is a
 * line nobody decided about.
 */
export const CODEX_EVENT_MAPPING: Readonly<Record<CodexWireKind, CodexMappingEntry>> = Object.freeze({
  [CodexWireType.ThreadStarted]: {
    emits: [AgentEventType.SessionStarted],
    note: "opens the thread and names it; a resume reuses the same thread id",
  },
  [CodexWireType.TurnStarted]: {
    emits: [],
    note: "a bare marker carrying nothing the turn's own events do not already say",
  },
  [CodexWireType.TurnCompleted]: {
    emits: [AgentEventType.TurnCompleted],
    note: "the turn terminator, carrying usage",
  },
  [CodexWireType.TurnFailed]: {
    emits: [AgentEventType.TurnCompleted],
    note: "the same terminator with an error status",
  },
  [CodexWireType.Error]: {
    emits: [AgentEventType.Error],
    note: "a thread-level failure outside any item",
  },

  // ---------- conversation ----------
  [`${CodexWireType.ItemCompleted}/${CodexItemType.AgentMessage}`]: {
    emits: [AgentEventType.AssistantText],
    note: "committed prose; Codex does not stream it in this mode, so there is no preview to supersede",
  },
  [`${CodexWireType.ItemStarted}/${CodexItemType.AgentMessage}`]: {
    emits: [],
    note: "the message is reported whole on completion",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.Reasoning}`]: {
    emits: [AgentEventType.Reasoning],
    note: "committed reasoning",
  },
  [`${CodexWireType.ItemStarted}/${CodexItemType.Reasoning}`]: {
    emits: [],
    note: "reported whole on completion",
  },

  // ---------- tools ----------
  [`${CodexWireType.ItemUpdated}/${CodexItemType.CommandExecution}`]: {
    emits: [],
    note: "incremental output on a long command; the completion carries the whole of it, so a partial adds nothing a consumer can use yet",
  },
  [`${CodexWireType.ItemUpdated}/${CodexItemType.AgentMessage}`]: {
    emits: [],
    note: "the message is reported whole on completion",
  },
  [`${CodexWireType.ItemUpdated}/${CodexItemType.Reasoning}`]: {
    emits: [],
    note: "reported whole on completion",
  },
  [`${CodexWireType.ItemUpdated}/${CodexItemType.FileChange}`]: {
    emits: [],
    note: "the completion publishes the paths",
  },
  [`${CodexWireType.ItemUpdated}/${CodexItemType.WebSearch}`]: {
    emits: [],
    note: "the completion settles the search",
  },
  [`${CodexWireType.ItemUpdated}/${CodexItemType.CollabToolCall}`]: {
    emits: [AgentEventType.TaskCompleted],
    note: "a live agents_states update; a terminal state closes the run the spawn opened",
  },
  [`${CodexWireType.ItemStarted}/${CodexItemType.CommandExecution}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a shell command begins; the item id is the call id",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.CommandExecution}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "output and exit code, which Codex reports where Claude sends only text",
  },
  [`${CodexWireType.ItemStarted}/${CodexItemType.WebSearch}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a search begins",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.WebSearch}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "the search settles",
  },
  [`${CodexWireType.ItemStarted}/${CodexItemType.McpToolCall}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "an MCP tool call begins",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.McpToolCall}`]: {
    emits: [AgentEventType.ToolCallCompleted],
    note: "the MCP tool call settles",
  },

  // ---------- file changes ----------
  [`${CodexWireType.ItemStarted}/${CodexItemType.FileChange}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "an edit begins; the paths are known up front",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.FileChange}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "structured edits, which Claude Code does not report at all — the call settles and the paths are published",
  },

  // ---------- plan ----------
  [`${CodexWireType.ItemStarted}/${CodexItemType.TodoList}`]: {
    emits: [AgentEventType.PlanUpdated],
    note: "the plan republished whole, the shape TodoWrite used",
  },
  [`${CodexWireType.ItemUpdated}/${CodexItemType.TodoList}`]: {
    emits: [AgentEventType.PlanUpdated],
    note: "republished again as steps complete; latest wins",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.TodoList}`]: {
    emits: [AgentEventType.PlanUpdated],
    note: "the final state of the plan",
  },

  // ---------- delegation ----------
  [`${CodexWireType.ItemStarted}/${CodexItemType.CollabToolCall}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.TaskStarted],
    note: "a spawned agent: a call on this thread, and a run whose own work never reaches this stream",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.CollabToolCall}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.TaskCompleted],
    note: "the spawn settles and names the receiver threads, which is where the run's transcript lives",
  },

  // ---------- fallback ----------
  [`${CodexWireType.ItemStarted}/${CodexItemType.Error}`]: {
    emits: [],
    note: "an error opens and settles in one step; the completion carries the message",
  },
  [`${CodexWireType.ItemCompleted}/${CodexItemType.Error}`]: {
    emits: [AgentEventType.Error],
    note: "an item-level failure",
  },
})

/** The mapping key for one decoded line. */
export function codexWireKind(event: CodexRawLine): CodexWireKind {
  const line = asRecord(event as JsonValue)
  const type = asString(line.type) ?? "unknown"
  const item = asRecord(line.item)
  const itemType = asString(item.type)
  return itemType === null ? type : `${type}/${itemType}`
}

/** What a line kind is declared to produce, or null for a kind nobody has decided about. */
export function codexMappingFor(kind: CodexWireKind): CodexMappingEntry | null {
  return CODEX_EVENT_MAPPING[kind] ?? null
}

/**
 * Codex's item kinds mapped to our tool rendering hints.
 *
 * A lookup rather than a chain of comparisons, for the reason the Claude table
 * gives: the mapping is data, and written as data the compiler checks it
 * against the provider's own union.
 */
export const CODEX_TOOL_KIND: Readonly<Partial<Record<CodexItemType, ToolKind>>> = Object.freeze({
  [CodexItemType.CommandExecution]: "shell",
  [CodexItemType.FileChange]: "file_edit",
  [CodexItemType.WebSearch]: "web",
  [CodexItemType.McpToolCall]: "mcp",
  [CodexItemType.CollabToolCall]: "subagent",
})

/** Reads an item kind as one of our tool kinds. */
export function codexToolKind(itemType: string | null): ToolKind {
  if (itemType === null) return "other"
  // Keyed by the provider's own union, so a renamed kind fails to compile
  // rather than silently rendering every call as "other".
  return CODEX_TOOL_KIND[itemType as CodexItemType] ?? "other"
}

/** Codex's file-change words, mapped to ours. */
export const CODEX_FILE_CHANGE: Readonly<Record<CodexFileChangeKind, FileChange>> = Object.freeze({
  [CodexFileChangeKind.Add]: "add",
  [CodexFileChangeKind.Update]: "update",
  [CodexFileChangeKind.Delete]: "delete",
  [CodexFileChangeKind.Rename]: "rename",
})

/** Reads a change kind as one of ours, defaulting to an update. */
export function codexFileChange(kind: string | null): FileChange {
  if (kind === null) return "update"
  return CODEX_FILE_CHANGE[kind as CodexFileChangeKind] ?? "update"
}

/** A todo item is a boolean here, not a three-state status; a run's current step is not distinguishable. */
export function codexPlanStatus(completed: boolean): PlanStepStatus {
  return completed ? PlanStepStatus.Completed : PlanStepStatus.Pending
}

/** Every Codex delegation is an agent run; it has no workflow or background-shell kind. */
export const CODEX_TASK_KIND: TaskKind = TaskKind.Agent
