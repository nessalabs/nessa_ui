/** @responsibility States, as data, which `run --format json` line kind becomes which normalized event. */

import { AgentEventType } from "../../events"
import type { OpencodeMappingEntry, OpencodeWireKind } from "../mapping"
import { asRecord, asString } from "../../json"
import type { JsonValue } from "../../json"
import { OpencodeToolName } from "../parts"
import { OpencodeRunType } from "./wire"
import type { OpencodeRawLine } from "./wire"

/**
 * The provider-to-contract mapping, as data.
 *
 * The same shape the Claude and Codex tables use, against the same
 * [`AgentEventType`] values — which is what makes "swap the mapper, keep the
 * components" checkable rather than aspirational. A kind missing from here is a
 * line nobody decided about.
 */
export const OPENCODE_RUN_MAPPING: Readonly<Record<string, OpencodeMappingEntry>> = Object.freeze({
  [OpencodeRunType.StepStart]: {
    emits: [AgentEventType.SessionStarted],
    note: "the first step opens the session; later ones start a model call inside the same turn and emit nothing",
  },
  [OpencodeRunType.StepFinish]: {
    emits: [AgentEventType.TurnCompleted],
    note: "a step's usage and stop reason; only a `stop` reason ends the turn, since a tool loop finishes a step per call",
  },
  [OpencodeRunType.Text]: {
    emits: [AgentEventType.AssistantText],
    note: "committed prose; this wire carries no partials, so there is no preview to supersede",
  },
  [OpencodeRunType.Reasoning]: {
    emits: [AgentEventType.Reasoning],
    note: "committed reasoning, reported the same way prose is",
  },
  [OpencodeRunType.UserMessage]: {
    emits: [AgentEventType.UserMessage],
    note: "the prompt, which only an exported session carries; the live stream never echoes it",
  },
  [OpencodeRunType.Error]: {
    emits: [AgentEventType.Error],
    note: "a run-level failure outside any tool",
  },

  // ---------- tools ----------
  //
  // One line per call, carrying input and result together: opencode publishes a
  // call once it has settled rather than opening and closing it. The started
  // event is still emitted so a consumer's tool row exists to be completed —
  // the two simply arrive on the same line.
  [OpencodeRunType.ToolUse]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted],
    note: "a settled call: opencode reports input and result on one line, so the row opens and closes together",
  },
  [`${OpencodeRunType.ToolUse}/${OpencodeToolName.TodoWrite}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.PlanUpdated],
    note: "the plan republished whole as a tool call; latest wins",
  },
  [`${OpencodeRunType.ToolUse}/${OpencodeToolName.Write}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "a file written; the path is on the call's own input",
  },
  [`${OpencodeRunType.ToolUse}/${OpencodeToolName.Edit}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "a file edited in place",
  },
  [`${OpencodeRunType.ToolUse}/${OpencodeToolName.Patch}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "a patch applied across files",
  },
  [`${OpencodeRunType.ToolUse}/${OpencodeToolName.Task}`]: {
    emits: [
      AgentEventType.ToolCallStarted,
      AgentEventType.ToolCallCompleted,
      AgentEventType.TaskStarted,
      AgentEventType.TaskCompleted,
    ],
    note: "delegation: a call on this session, and a run whose own work never reaches this stream — its metadata names the child session, which is readable on its own",
  },
})

/** The mapping key for one decoded line. */
export function opencodeWireKind(event: OpencodeRawLine): OpencodeWireKind {
  const line = asRecord(event as JsonValue)
  const type = asString(line.type) ?? "unknown"
  if (type !== OpencodeRunType.ToolUse) return type
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
  const exact = OPENCODE_RUN_MAPPING[kind]
  if (exact !== undefined) return exact
  if (kind.startsWith(`${OpencodeRunType.ToolUse}/`)) return OPENCODE_RUN_MAPPING[OpencodeRunType.ToolUse] ?? null
  return null
}
