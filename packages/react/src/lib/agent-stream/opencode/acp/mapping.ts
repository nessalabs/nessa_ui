/** @responsibility States, as data, which `opencode acp` frame becomes which normalized event. */

import { AgentEventType, ToolKind } from "../../events"
import type { OpencodeMappingEntry } from "../mapping"
import { OpencodeAcpMethod, OpencodeAcpToolKind, OpencodeAcpUpdate } from "./wire"

/**
 * ACP's own table.
 *
 * Keyed by method, and by update kind where the method is `session/update`.
 * Separate from the other two transports' because it is a separate protocol
 * with a separate version, against the same contract on the other side.
 */
export const OPENCODE_ACP_MAPPING: Readonly<Record<string, OpencodeMappingEntry>> = Object.freeze({
  [OpencodeAcpMethod.Initialize]: {
    emits: [],
    note: "the handshake. Its reply carries the agent's name, version and negotiated capabilities, which is capability rather than conversation",
  },
  [OpencodeAcpMethod.SessionNew]: {
    emits: [AgentEventType.SessionStarted],
    note: "opens a session; the reply names it and carries the config options, including the model in force and every model it could switch to",
  },
  [OpencodeAcpMethod.SessionLoad]: {
    emits: [AgentEventType.SessionStarted],
    note: "reopens an existing session, which is how a resume is visible here rather than inferred",
  },
  [OpencodeAcpMethod.SessionPrompt]: {
    emits: [AgentEventType.UserMessage, AgentEventType.TurnCompleted],
    note: "the request carries the prompt — the one wire that shows what was asked — and its reply ends the turn with a stop reason and usage",
  },
  [OpencodeAcpMethod.SessionCancel]: {
    emits: [],
    note: "a client-side interrupt; the turn's own reply reports how it ended",
  },
  [OpencodeAcpMethod.SessionRequestPermission]: {
    emits: [AgentEventType.PermissionRequested],
    note: "agent to client, and it blocks the tool until answered — the options it offers are the answers a surface must present",
  },
  [OpencodeAcpMethod.SessionSetMode]: {
    emits: [],
    note: "a client switching the agent's mode; the agent confirms with a current_mode_update",
  },
  [OpencodeAcpMethod.SessionSetModel]: {
    emits: [],
    note: "a client switching the model; the agent confirms through its session config",
  },

  // ---------- session/update ----------
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.AgentMessageChunk}`]: {
    emits: [AgentEventType.Delta],
    note: "streamed prose, one chunk at a time, superseded by nothing — ACP publishes no committed message, so the chunks are the answer",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.AgentThoughtChunk}`]: {
    emits: [AgentEventType.Delta],
    note: "streamed reasoning, kept apart from prose by the protocol rather than by a guess about which block it belongs to",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.UserMessageChunk}`]: {
    emits: [AgentEventType.UserMessage],
    note: "the prompt echoed back, when a client did not send it itself",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.ToolCall}`]: {
    emits: [AgentEventType.ToolCallStarted],
    note: "a call opens, with the protocol's own kind rather than a tool name to be guessed at",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.ToolCallUpdate}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.FileEdits],
    note: "the call moves; a terminal status settles it, and the locations it names are the files it touched",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.Plan}`]: {
    emits: [AgentEventType.PlanUpdated],
    note: "the plan republished whole, the shape TodoWrite uses",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.AvailableCommandsUpdate}`]: {
    emits: [],
    note: "the slash commands, on the stream — capability rather than conversation, so it feeds a picker instead of the transcript",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.CurrentModeUpdate}`]: {
    emits: [AgentEventType.StatusChanged],
    note: "the agent's mode changed — plan or build — which is the closest thing any of these wires has to a permission mode",
  },
  [`${OpencodeAcpMethod.SessionUpdate}/${OpencodeAcpUpdate.UsageUpdate}`]: {
    emits: [],
    note: "running totals with the context window's size beside them, which no other transport reports; the turn's own reply carries the usage that closes it",
  },
})

/** What a frame kind is declared to produce, or null for one nobody decided about. */
export function opencodeAcpMappingFor(kind: string): OpencodeMappingEntry | null {
  return OPENCODE_ACP_MAPPING[kind] ?? null
}

/**
 * ACP's tool kinds, mapped to ours.
 *
 * The protocol already normalized this, so the mapping is a rename rather than
 * a guess — the one wire of the three where a call's kind is not inferred from
 * a tool's name.
 */
export const OPENCODE_ACP_TOOL_KIND: Readonly<Record<OpencodeAcpToolKind, ToolKind>> = Object.freeze({
  [OpencodeAcpToolKind.Read]: "file_read",
  [OpencodeAcpToolKind.Edit]: "file_edit",
  [OpencodeAcpToolKind.Delete]: "file_edit",
  [OpencodeAcpToolKind.Move]: "file_edit",
  [OpencodeAcpToolKind.Search]: "search",
  [OpencodeAcpToolKind.Execute]: "shell",
  [OpencodeAcpToolKind.Think]: "other",
  [OpencodeAcpToolKind.Fetch]: "web",
  [OpencodeAcpToolKind.SwitchMode]: "other",
  [OpencodeAcpToolKind.Other]: "other",
})

/** Reads an ACP tool kind as one of ours. */
export function opencodeAcpToolKind(kind: string | null): ToolKind {
  if (kind === null) return "other"
  return OPENCODE_ACP_TOOL_KIND[kind as OpencodeAcpToolKind] ?? "other"
}
