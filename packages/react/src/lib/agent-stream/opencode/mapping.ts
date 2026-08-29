/** @responsibility States, as data, which opencode line kind becomes which normalized event. */

import { AgentEventType, PlanStepStatus, TaskKind, ToolKind } from "../events"
import { asRecord, asString } from "../json"
import type { JsonValue } from "../json"
import { OpencodeToolName, OpencodeWireType } from "./wire"
import { OpencodeServerEventType } from "./wire"
import type { OpencodeRawLine } from "./wire"

/** A line's kind at the granularity the mapping turns on: the line type, plus the tool name where there is one. */
export type OpencodeWireKind = string

export interface OpencodeMappingEntry {
  /** The normalized events this kind can produce. Empty means it deliberately produces nothing. */
  readonly emits: readonly AgentEventType[]
  /** Why, in one line. For an empty `emits` this is the whole justification. */
  readonly note: string
}

/**
 * The provider-to-contract mapping, as data.
 *
 * The same shape the Claude and Codex tables use, against the same
 * [`AgentEventType`] values — which is what makes "swap the mapper, keep the
 * components" checkable rather than aspirational. A kind missing from here is a
 * line nobody decided about.
 */
export const OPENCODE_EVENT_MAPPING: Readonly<Record<OpencodeWireKind, OpencodeMappingEntry>> = Object.freeze({
  [OpencodeWireType.StepStart]: {
    emits: [AgentEventType.SessionStarted],
    note: "the first step opens the session; later ones start a model call inside the same turn and emit nothing",
  },
  [OpencodeWireType.StepFinish]: {
    emits: [AgentEventType.TurnCompleted],
    note: "a step's usage and stop reason; only a `stop` reason ends the turn, since a tool loop finishes a step per call",
  },
  [OpencodeWireType.Text]: {
    emits: [AgentEventType.AssistantText],
    note: "committed prose; this wire carries no partials, so there is no preview to supersede",
  },
  [OpencodeWireType.Reasoning]: {
    emits: [AgentEventType.Reasoning],
    note: "committed reasoning, reported the same way prose is",
  },
  [OpencodeWireType.UserMessage]: {
    emits: [AgentEventType.UserMessage],
    note: "the prompt, which only an exported session carries; the live stream never echoes it",
  },
  [OpencodeWireType.Error]: {
    emits: [AgentEventType.Error],
    note: "a run-level failure outside any tool",
  },

  // ---------- tools ----------
  //
  // One line per call, carrying input and result together: opencode publishes a
  // call once it has settled rather than opening and closing it. The started
  // event is still emitted so a consumer's tool row exists to be completed —
  // the two simply arrive on the same line.
  [OpencodeWireType.ToolUse]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted],
    note: "a settled call: opencode reports input and result on one line, so the row opens and closes together",
  },
  [`${OpencodeWireType.ToolUse}/${OpencodeToolName.TodoWrite}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.PlanUpdated],
    note: "the plan republished whole as a tool call; latest wins",
  },
  [`${OpencodeWireType.ToolUse}/${OpencodeToolName.Write}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "a file written; the path is on the call's own input",
  },
  [`${OpencodeWireType.ToolUse}/${OpencodeToolName.Edit}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "a file edited in place",
  },
  [`${OpencodeWireType.ToolUse}/${OpencodeToolName.Patch}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "a patch applied across files",
  },
  [`${OpencodeWireType.ToolUse}/${OpencodeToolName.Task}`]: {
    emits: [
      AgentEventType.ToolCallStarted,
      AgentEventType.ToolCallCompleted,
      AgentEventType.TaskStarted,
      AgentEventType.TaskCompleted,
    ],
    note: "delegation: a call on this session, and a run whose own work never reaches this stream — its metadata names the child session, which is readable on its own",
  },

  // ---------- the server's own wire ----------
  //
  // `opencode serve` publishes a different, richer vocabulary over SSE. It is
  // declared in the same table because it is the same provider and the same
  // contract on the other side; what changes is which transport a host chose.
  [OpencodeServerEventType.SessionCreated]: {
    emits: [],
    note: "an id, a directory and a build, but no model and no agent — the update that follows immediately is the first line that describes the session",
  },
  [OpencodeServerEventType.SessionUpdated]: {
    emits: [AgentEventType.SessionStarted, AgentEventType.ModelChanged],
    note: "the init `run --format json` never sends: model, agent, working directory, version and the session's own permission rules. Republished on every change, so only a different model is an event after the first",
  },
  [OpencodeServerEventType.SessionStatus]: {
    emits: [AgentEventType.StatusChanged],
    note: "busy or idle, which is what says whether the agent is working",
  },
  [OpencodeServerEventType.SessionIdle]: {
    emits: [AgentEventType.TurnCompleted],
    note: "the turn's real terminator on this transport: the agent has stopped, whatever its last step said",
  },
  [OpencodeServerEventType.MessageUpdated]: {
    emits: [],
    note: "a message's running totals, republished as it grows; the step that finishes carries the same counts and closes something",
  },
  [OpencodeServerEventType.MessagePartUpdated]: {
    emits: [
      AgentEventType.UserMessage,
      AgentEventType.AssistantText,
      AgentEventType.Reasoning,
      AgentEventType.ToolCallStarted,
      AgentEventType.ToolCallCompleted,
      AgentEventType.PlanUpdated,
      AgentEventType.FileEdits,
      AgentEventType.TaskStarted,
      AgentEventType.TaskCompleted,
      AgentEventType.TurnCompleted,
    ],
    note: "a settled part, in exactly the shapes the one-way stream sends — so the same code reads both, and what it emits depends on which part arrived",
  },
  [OpencodeServerEventType.MessagePartDelta]: {
    emits: [AgentEventType.Delta],
    note: "the token stream: one chunk of a part's text, reasoning or arguments, superseded by the settled part",
  },
  [OpencodeServerEventType.PermissionAsked]: {
    emits: [AgentEventType.PermissionRequested],
    note: "the ask the one-way stream never makes — held open here rather than auto-rejected",
  },
  [OpencodeServerEventType.PermissionReplied]: {
    emits: [AgentEventType.PermissionDecided],
    note: "the answer, and which way it went",
  },
  [OpencodeServerEventType.ServerConnected]: {
    emits: [],
    note: "the stream is open; it says nothing about any session",
  },
  [OpencodeServerEventType.ServerHeartbeat]: {
    emits: [],
    note: "a keep-alive",
  },
  [OpencodeServerEventType.SessionDiff]: {
    emits: [],
    note: "the working tree against its snapshot; the file edits are already reported by the calls that made them",
  },
  [OpencodeServerEventType.PluginAdded]: {
    emits: [],
    note: "a plugin loaded, which belongs to capabilities rather than to the conversation",
  },
  [OpencodeServerEventType.CatalogUpdated]: {
    emits: [],
    note: "the model catalogue refreshed",
  },
  [OpencodeServerEventType.ReferenceUpdated]: {
    emits: [],
    note: "the reference index refreshed",
  },
  [OpencodeServerEventType.IntegrationUpdated]: {
    emits: [],
    note: "an integration's state changed",
  },
})

/** The mapping key for one decoded line. */
export function opencodeWireKind(event: OpencodeRawLine): OpencodeWireKind {
  const line = asRecord(event as JsonValue)
  const type = asString(line.type) ?? "unknown"
  if (type !== OpencodeWireType.ToolUse) return type
  const tool = asString(asRecord(line.part).tool)
  return tool === null ? type : `${type}/${tool}`
}

/**
 * What a line kind is declared to produce, or null for a kind nobody decided about.
 *
 * A tool with no entry of its own falls back to the bare `tool_use` row: every
 * opencode install has its own plugins and MCP servers, so an unlisted tool
 * name is the normal case here rather than an oversight, and it should still
 * render as a call.
 */
export function opencodeMappingFor(kind: OpencodeWireKind): OpencodeMappingEntry | null {
  const exact = OPENCODE_EVENT_MAPPING[kind]
  if (exact !== undefined) return exact
  if (kind.startsWith(`${OpencodeWireType.ToolUse}/`)) return OPENCODE_EVENT_MAPPING[OpencodeWireType.ToolUse] ?? null
  return null
}

/**
 * opencode's tool names mapped to our rendering hints.
 *
 * A lookup rather than a chain of comparisons, for the reason the other tables
 * give: the mapping is data, and written as data the compiler checks it against
 * the provider's own union.
 */
export const OPENCODE_TOOL_KIND: Readonly<Partial<Record<OpencodeToolName, ToolKind>>> = Object.freeze({
  [OpencodeToolName.Bash]: "shell",
  [OpencodeToolName.Read]: "file_read",
  [OpencodeToolName.Write]: "file_edit",
  [OpencodeToolName.Edit]: "file_edit",
  [OpencodeToolName.Patch]: "file_edit",
  [OpencodeToolName.Glob]: "search",
  [OpencodeToolName.Grep]: "search",
  [OpencodeToolName.List]: "search",
  [OpencodeToolName.WebFetch]: "web",
  [OpencodeToolName.TodoWrite]: "plan",
  [OpencodeToolName.TodoRead]: "plan",
  [OpencodeToolName.Task]: "subagent",
})

/** Reads a tool name as one of our tool kinds. */
export function opencodeToolKind(tool: string | null): ToolKind {
  if (tool === null) return "other"
  // Keyed by the provider's own union, so a renamed tool fails to compile
  // rather than silently rendering every call as "other". An MCP tool arrives
  // under its server's own name and is correctly "other" until named here.
  return OPENCODE_TOOL_KIND[tool as OpencodeToolName] ?? "other"
}

/** opencode's todo statuses, mapped to ours. */
export const OPENCODE_PLAN_STATUS: Readonly<Record<string, PlanStepStatus>> = Object.freeze({
  pending: PlanStepStatus.Pending,
  in_progress: PlanStepStatus.InProgress,
  completed: PlanStepStatus.Completed,
  cancelled: PlanStepStatus.Completed,
})

/** Reads a todo status as one of ours, defaulting to pending. */
export function opencodePlanStatus(status: string | null): PlanStepStatus {
  if (status === null) return PlanStepStatus.Pending
  return OPENCODE_PLAN_STATUS[status] ?? PlanStepStatus.Pending
}

/** Every opencode delegation is an agent run; it has no workflow or background-shell kind. */
export const OPENCODE_TASK_KIND: TaskKind = TaskKind.Agent
