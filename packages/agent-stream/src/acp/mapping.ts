/** @responsibility States, as data, which Agent Client Protocol frame becomes which normalized event. */

import { AgentEventType, ToolKind } from "../events"
import type { MappingEntry } from "../mapping"
import { ACP_TOOL_NAME, AcpMethod, AcpToolKind, AcpUpdate } from "./wire"

/**
 * ACP's own table.
 *
 * Keyed by method, and by update kind where the method is `session/update`.
 * Separate from the other two transports' because it is a separate protocol
 * with a separate version, against the same contract on the other side.
 */
export const ACP_MAPPING: Readonly<Record<string, MappingEntry>> = Object.freeze({
  [AcpMethod.Initialize]: {
    emits: [],
    note: "the handshake. Its reply carries the agent's name, version and negotiated capabilities, which is capability rather than conversation",
  },
  [AcpMethod.Authenticate]: {
    emits: [],
    note: "Cursor's login step after initialize; other agents skip it. Capability, not conversation",
  },
  [AcpMethod.SessionNew]: {
    emits: [AgentEventType.SessionStarted],
    note: "opens a session; the reply names it and carries the config options, including the model in force and every model it could switch to",
  },
  [AcpMethod.SessionLoad]: {
    emits: [AgentEventType.SessionStarted],
    note: "reopens an existing session, which is how a resume is visible here rather than inferred",
  },
  [AcpMethod.SessionPrompt]: {
    emits: [AgentEventType.UserMessage, AgentEventType.TurnCompleted],
    note: "the request carries the prompt — the one wire that shows what was asked — and its reply ends the turn with a stop reason and usage",
  },
  [AcpMethod.SessionCancel]: {
    emits: [],
    note: "a client-side interrupt; the turn's own reply reports how it ended",
  },
  [AcpMethod.SessionRequestPermission]: {
    emits: [AgentEventType.PermissionRequested],
    note: "agent to client, and it blocks the tool until answered — the options it offers are the answers a surface must present",
  },
  [AcpMethod.SessionSetMode]: {
    emits: [],
    note: "a client switching the agent's mode; the agent confirms with a current_mode_update",
  },
  [AcpMethod.SessionSetModel]: {
    emits: [],
    note: "a client switching the model; the agent confirms through its session config",
  },

  // ---------- session/update ----------
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.AgentMessageChunk}`]: {
    emits: [AgentEventType.Delta],
    note: "streamed prose, one chunk at a time, superseded by nothing — ACP publishes no committed message, so the chunks are the answer",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.AgentThoughtChunk}`]: {
    emits: [AgentEventType.Delta],
    note: "streamed reasoning, kept apart from prose by the protocol rather than by a guess about which block it belongs to",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.UserMessageChunk}`]: {
    emits: [AgentEventType.UserMessage],
    note: "the prompt echoed back, when a client did not send it itself",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.ToolCall}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a call opens, with the protocol's own kind rather than a tool name to be guessed at",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.ToolCallUpdate}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "the call moves; a terminal status settles it. Paths may arrive mid-flight as locations or on a completed diff content block",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.Plan}`]: {
    emits: [AgentEventType.PlanUpdated],
    note: "the plan republished whole, the shape TodoWrite uses",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.AvailableCommandsUpdate}`]: {
    emits: [],
    note: "the slash commands, on the stream — capability rather than conversation, so it feeds a picker instead of the transcript",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.CurrentModeUpdate}`]: {
    emits: [AgentEventType.StatusChanged],
    note: "the agent's mode changed — plan or build — which is the closest thing any of these wires has to a permission mode",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.SessionInfoUpdate}`]: {
    emits: [],
    note: "an agent-specific status carried under `_meta`; the protocol says nothing about it, so nothing is claimed from it",
  },
  [`${AcpMethod.SessionUpdate}/${AcpUpdate.UsageUpdate}`]: {
    emits: [],
    note: "running totals with the context window's size beside them, which no other transport reports; the turn's own reply carries the usage that closes it",
  },
})

/** What a frame kind is declared to produce, or null for one nobody decided about. */
export function acpMappingFor(kind: string): MappingEntry | null {
  return ACP_MAPPING[kind] ?? null
}

/**
 * ACP's tool kinds, mapped to ours.
 *
 * The protocol already normalized this, so the mapping is a rename rather than
 * a guess — the one wire where a call's kind is not inferred from a tool's name.
 */
export const ACP_TOOL_KIND: Readonly<Record<AcpToolKind, ToolKind>> = Object.freeze({
  [AcpToolKind.Read]: "file_read",
  [AcpToolKind.Edit]: "file_edit",
  [AcpToolKind.Delete]: "file_edit",
  [AcpToolKind.Move]: "file_edit",
  [AcpToolKind.Search]: "search",
  [AcpToolKind.Execute]: "shell",
  [AcpToolKind.Think]: "other",
  [AcpToolKind.Fetch]: "web",
  [AcpToolKind.SwitchMode]: "other",
  [AcpToolKind.Other]: "other",
})

/** Reads an ACP tool kind as one of ours. */
export function acpToolKind(kind: string | null): ToolKind {
  if (kind === null) return "other"
  return ACP_TOOL_KIND[kind as AcpToolKind] ?? "other"
}

/**
 * A call's kind from the agent's own tool name, where the name is one this
 * build recognises. Null means "no opinion", so the protocol's kind decides.
 */
const BY_NAME: Readonly<Record<string, ToolKind>> = Object.freeze({
  [ACP_TOOL_NAME.Bash]: "shell",
  [ACP_TOOL_NAME.Shell]: "shell",
  [ACP_TOOL_NAME.Read]: "file_read",
  [ACP_TOOL_NAME.Write]: "file_edit",
  [ACP_TOOL_NAME.Edit]: "file_edit",
  [ACP_TOOL_NAME.Glob]: "search",
  [ACP_TOOL_NAME.Grep]: "search",
  [ACP_TOOL_NAME.WebSearch]: "web",
  [ACP_TOOL_NAME.WebFetch]: "web",
  [ACP_TOOL_NAME.TodoWrite]: "plan",
  [ACP_TOOL_NAME.Task]: "subagent",
})

export function acpToolKindByName(name: string | null): ToolKind | null {
  if (name === null) return null
  return BY_NAME[name] ?? null
}
