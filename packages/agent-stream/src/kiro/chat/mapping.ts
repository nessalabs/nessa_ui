/** @responsibility States, as data, which Kiro CLI stream-json line kind becomes which normalized event. */

import { AgentEventType, TaskKind, ToolKind } from "../../events"
import { asRecord, asString } from "../../json"
import type { JsonValue } from "../../json"
import {
  KiroExtensionSubtype,
  KiroSystemSubtype,
  KiroToolCallSubtype,
  KiroToolKind,
  KiroToolName,
  KiroToolStatus,
  KiroWireType,
} from "./wire"
import type { KiroRawLine } from "./wire"

/** A line's kind at the granularity the mapping turns on. */
export type KiroWireKind = string

export interface KiroMappingEntry {
  /** The normalized events this kind can produce. Empty means it deliberately produces nothing. */
  readonly emits: readonly AgentEventType[]
  /** Why, in one line. For an empty `emits` this is the whole justification. */
  readonly note: string
}

/**
 * The provider-to-contract mapping, as data.
 *
 * Same shape as Claude, Codex, Cursor, and opencode — against the same
 * [`AgentEventType`] values — so swapping the mapper keeps all components.
 *
 * Lines that produce nothing do so for a stated reason; a line not in this
 * table falls through to `unknown` so nothing is silently dropped.
 */
export const KIRO_EVENT_MAPPING: Readonly<Record<KiroWireKind, KiroMappingEntry>> = Object.freeze({
  // ---------- session and turn ----------
  [`${KiroWireType.System}/${KiroSystemSubtype.Init}`]: {
    emits: [AgentEventType.SessionStarted, AgentEventType.ModelChanged],
    note: "opens the session and advertises model, cwd, tools, skills, agents, MCP servers, slash commands, and CLI version; a later init with a different model is a model change",
  },
  [KiroWireType.TurnEnd]: {
    emits: [AgentEventType.TurnCompleted],
    note: "signals the agent turn has completed; carries usage counters and stop reason",
  },

  // ---------- conversation ----------
  [`${KiroWireType.User}/text`]: {
    emits: [AgentEventType.UserMessage],
    note: "what the user typed",
  },
  [`${KiroWireType.Assistant}/chunk`]: {
    emits: [AgentEventType.Delta],
    note: "an AgentMessageChunk — streaming text fragment, delivered before the committed assistant text",
  },
  [`${KiroWireType.Assistant}/text`]: {
    emits: [AgentEventType.AssistantText],
    note: "committed prose; the final assistant message for the turn",
  },

  // ---------- tools ----------
  [`${KiroWireType.ToolCall}/${KiroToolCallSubtype.Started}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a tool call opens; kind and title are on the frame",
  },
  [`${KiroWireType.ToolCall}/${KiroToolCallSubtype.Started}/todowrite`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.PlanUpdated],
    note: "todowrite opens with the whole plan on its input — a call, and a plan update in the same frame",
  },
  [`${KiroWireType.ToolCall}/${KiroToolCallSubtype.Started}/task`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.TaskStarted],
    note: "a spawned Kiro subagent: a call on this thread, and a run whose own work does not reach this stream",
  },
  [`${KiroWireType.ToolCallUpdate}/${KiroToolStatus.Completed}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.FileEdits, AgentEventType.TaskCompleted],
    note: "the tool settled; FileEdits when the remembered call was a write/edit (even if this frame omits kind), TaskCompleted when it was a task — both from per-call state, not this frame alone",
  },
  [`${KiroWireType.ToolCallUpdate}/${KiroToolStatus.Completed}/edit`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "a file edit settled; the kind is on the update frame itself so the mapping can promise FileEdits",
  },
  [`${KiroWireType.ToolCallUpdate}/${KiroToolStatus.Failed}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.TaskCompleted],
    note: "the tool failed (threw, was refused, or aborted); TaskCompleted when the remembered call was a task",
  },
  [`${KiroWireType.ToolCallUpdate}/${KiroToolStatus.InProgress}`]: {
    emits: [],
    note: "mid-flight progress update; no event emitted — the opened row covers it",
  },
  [`${KiroWireType.ToolCallUpdate}/${KiroToolStatus.Pending}`]: {
    emits: [],
    note: "pending — call is queued but has not started; no event emitted",
  },

  // ---------- Kiro extensions (produce nothing — not in a capture) ----------
  [KiroExtensionSubtype.CompactionStatus]: {
    emits: [],
    note: "compaction progress notification; deliberately suppressed until a capture shows what a consumer should do with it",
  },
  [KiroExtensionSubtype.ClearStatus]: {
    emits: [],
    note: "session history clear notification; no normalized event",
  },
  [KiroExtensionSubtype.CommandsAvailable]: {
    emits: [],
    note: "slash command list; carried on the ACP transport's capabilities, not this stream",
  },
  [KiroExtensionSubtype.McpServerInitialized]: {
    emits: [],
    note: "MCP server finished initializing; no normalized event",
  },
})

/**
 * The mapping key for one decoded line.
 *
 * Kiro's stream-json wire uses:
 * - `system/<subtype>` for session events
 * - `user` for user messages
 * - `assistant` with a `streaming` flag or absence thereof to distinguish
 *   chunks from committed text
 * - `tool_call/<subtype>` for call open/close
 * - `tool_call_update/<status>` for progress
 * - `turn_end` for the turn terminator
 * - `_kiro.dev/<extension>` for Kiro-specific notifications
 */
export function kiroWireKind(event: KiroRawLine): KiroWireKind {
  const line = asRecord(event as JsonValue)
  const type = asString(line.type) ?? "unknown"

  if (type === KiroWireType.System) {
    const subtype = asString(line.subtype)
    return `${type}/${subtype ?? "unknown"}`
  }

  if (type === KiroWireType.User) {
    return `${type}/text`
  }

  if (type === KiroWireType.Assistant) {
    // Streaming chunks carry `streaming: true`; the committed final message does not.
    return line.streaming === true ? `${type}/chunk` : `${type}/text`
  }

  if (type === KiroWireType.ToolCall) {
    const subtype = asString(line.subtype)
    if (subtype === KiroToolCallSubtype.Started) {
      const title = asString(line.title)
      const kind = asString(line.kind)
      if (title === KiroToolName.TodoWrite) return `${type}/${subtype}/todowrite`
      const isTask = title === KiroToolName.Task || kind === KiroToolKind.Think
      return isTask ? `${type}/${subtype}/task` : `${type}/${subtype}`
    }
    return subtype !== null ? `${type}/${subtype}` : type
  }

  if (type === KiroWireType.ToolCallUpdate) {
    const status = asString(line.status)
    if (status === KiroToolStatus.Completed || status === KiroToolStatus.Failed) {
      // Sharpen for edit-kind: the ACP kind is on the frame itself, so the
      // mapping table can promise FileEdits for it.
      // Task completion is determined from remembered per-call state in the mapper,
      // not from this frame alone, so we do not sharpen for it here.
      const kind = asString(line.kind)
      if (status === KiroToolStatus.Completed && kind === "edit") return `${type}/${status}/edit`
      return `${type}/${status}`
    }
    return status !== null ? `${type}/${status}` : type
  }

  if (type === KiroWireType.TurnEnd) {
    return type
  }

  // _kiro.dev/* extension lines arrive with their full method as the type.
  if (type.startsWith("_kiro.dev/")) {
    return type
  }

  return type
}

/** What a line kind is declared to produce, or null for a kind nobody has decided about. */
export function kiroMappingFor(kind: KiroWireKind): KiroMappingEntry | null {
  return KIRO_EVENT_MAPPING[kind] ?? null
}

/**
 * Kiro's ACP tool kinds mapped to our tool rendering hints.
 *
 * ACP's vocabulary is deliberately coarse — `task` arrives as `think` — so
 * we also check the tool name to sharpen where we can.
 */
export const KIRO_TOOL_KIND_BY_KIND: Readonly<Partial<Record<string, ToolKind>>> = Object.freeze({
  [KiroToolKind.Read]: "file_read",
  [KiroToolKind.Edit]: "file_edit",
  [KiroToolKind.Delete]: "file_edit",
  [KiroToolKind.Move]: "file_edit",
  [KiroToolKind.Search]: "search",
  [KiroToolKind.Execute]: "shell",
  [KiroToolKind.Think]: "subagent",
  [KiroToolKind.Fetch]: "web",
  [KiroToolKind.SwitchMode]: "other",
  [KiroToolKind.Other]: "other",
})

/**
 * Well-known tool names that sharpen the coarse ACP kind.
 */
export const KIRO_TOOL_KIND_BY_NAME: Readonly<Partial<Record<string, ToolKind>>> = Object.freeze({
  [KiroToolName.Bash]: "shell",
  [KiroToolName.Read]: "file_read",
  [KiroToolName.Write]: "file_edit",
  [KiroToolName.Edit]: "file_edit",
  [KiroToolName.Glob]: "search",
  [KiroToolName.Grep]: "search",
  [KiroToolName.WebSearch]: "web",
  [KiroToolName.WebFetch]: "web",
  [KiroToolName.TodoWrite]: "plan",
  [KiroToolName.Task]: "subagent",
})

/** Resolves a tool kind hint, preferring a name match over the coarser ACP kind. */
export function kiroToolKind(name: string | null, kind: string | null): ToolKind {
  if (name !== null) {
    const byName = KIRO_TOOL_KIND_BY_NAME[name]
    if (byName !== undefined) return byName
  }
  if (kind !== null) {
    const byKind = KIRO_TOOL_KIND_BY_KIND[kind]
    if (byKind !== undefined) return byKind
  }
  return "other"
}

/** Every Kiro Task spawn is an agent run. */
export const KIRO_TASK_KIND: TaskKind = TaskKind.Agent
