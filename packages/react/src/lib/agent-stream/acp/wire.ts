/** @responsibility Describes the `opencode acp` JSON-RPC envelope and decodes one frame into it without interpreting it. */

import type { WireProvenance } from "../events"
import { parseJsonObjectLine } from "../json"
import type { JsonValue } from "../json"
import type { AcpParseResult, AcpRawFrame } from "./frame"

/**
 * The build this envelope was read from.
 *
 * ACP is the only one of opencode's three wires that states its own version:
 * `initialize` replies with `agentInfo: { name, version }`, so a consumer can
 * compare the process it is talking to against what was modelled without being
 * told out of band. `protocolVersion` is the protocol's own number, which moves
 * independently of both the agent and the server API.
 */
export const ACP_PROVENANCE: WireProvenance & { readonly protocolVersion: number } = Object.freeze({
  cli: "opencode",
  version: "1.18.25",
  /** The ACP revision the agent negotiated. */
  protocolVersion: 1,
  command: "opencode acp",
  capturedOn: "2026-08-29",
})

/**
 * The JSON-RPC methods this wire uses.
 *
 * Not a stream at all: ACP is a conversation between a client and an agent, and
 * two of these travel the *other* way — the agent asks the client for
 * permission, and the client answers. A reader that assumed one direction would
 * hang the first time a tool needed approving.
 */
export const AcpMethod = Object.freeze({
  Initialize: "initialize",
  SessionNew: "session/new",
  SessionLoad: "session/load",
  SessionPrompt: "session/prompt",
  SessionCancel: "session/cancel",
  /** Everything the agent reports mid-turn. */
  SessionUpdate: "session/update",
  /** Agent → client. Blocks the tool until answered. */
  SessionRequestPermission: "session/request_permission",
  SessionSetMode: "session/set_mode",
  SessionSetModel: "session/set_model",
} as const)

export type AcpMethod = (typeof AcpMethod)[keyof typeof AcpMethod]

/**
 * The kinds of `session/update`.
 *
 * ACP normalizes where opencode's own wires do not: prose and reasoning arrive
 * as separate chunk kinds, a tool call carries a `kind` the protocol defines
 * rather than a tool name to be guessed at, and usage arrives with the context
 * window's size beside it — which neither other transport reports at all.
 */
export const AcpUpdate = Object.freeze({
  AgentMessageChunk: "agent_message_chunk",
  AgentThoughtChunk: "agent_thought_chunk",
  UserMessageChunk: "user_message_chunk",
  ToolCall: "tool_call",
  ToolCallUpdate: "tool_call_update",
  Plan: "plan",
  AvailableCommandsUpdate: "available_commands_update",
  CurrentModeUpdate: "current_mode_update",
  UsageUpdate: "usage_update",
  /**
   * A session's own status, sent by Codex's adapter.
   *
   * Its payload is entirely under `_meta.codex`, which is the protocol's
   * escape hatch for things one agent knows and the protocol does not. A
   * reader must tolerate it rather than treat an agent-specific extension as
   * an unknown frame.
   */
  SessionInfoUpdate: "session_info_update",
} as const)

export type AcpUpdate = (typeof AcpUpdate)[keyof typeof AcpUpdate]

/**
 * A tool call's kind, as the protocol defines it.
 *
 * The protocol's own vocabulary, not opencode's tool names — which is why an
 * ACP client renders a call the same way whichever agent it is talking to.
 */
export const AcpToolKind = Object.freeze({
  Read: "read",
  Edit: "edit",
  Delete: "delete",
  Move: "move",
  Search: "search",
  Execute: "execute",
  Think: "think",
  Fetch: "fetch",
  SwitchMode: "switch_mode",
  Other: "other",
} as const)

export type AcpToolKind = (typeof AcpToolKind)[keyof typeof AcpToolKind]

/**
 * Tool names seen across the agents that speak this protocol.
 *
 * ACP's own `kind` vocabulary is deliberately coarse — `task` arrives as
 * `think`, a todo list and a web search both as `other` — which is right for a
 * client that knows nothing about the agent behind it. These are the names
 * observed on the wire from Claude Code, Codex and opencode, used to sharpen a
 * kind where one is recognised and ignored where it is not.
 */
export const ACP_TOOL_NAME = Object.freeze({
  Bash: "bash",
  Shell: "shell",
  Read: "read",
  Write: "write",
  Edit: "edit",
  Glob: "glob",
  Grep: "grep",
  WebSearch: "websearch",
  WebFetch: "webfetch",
  TodoWrite: "todowrite",
  Task: "task",
} as const)

export type ACP_TOOL_NAME = (typeof ACP_TOOL_NAME)[keyof typeof ACP_TOOL_NAME]

/** A tool call's status, which unlike the other wires does open before it settles. */
export const AcpToolStatus = Object.freeze({
  Pending: "pending",
  InProgress: "in_progress",
  Completed: "completed",
  Failed: "failed",
} as const)

export type AcpToolStatus = (typeof AcpToolStatus)[keyof typeof AcpToolStatus]

/** How a client answered a permission request. */
export const AcpPermissionKind = Object.freeze({
  AllowOnce: "allow_once",
  AllowAlways: "allow_always",
  RejectOnce: "reject_once",
  RejectAlways: "reject_always",
} as const)

export type AcpPermissionKind = (typeof AcpPermissionKind)[keyof typeof AcpPermissionKind]

/** One JSON-RPC frame, in either direction. */
export interface AcpFrame {
  readonly jsonrpc?: string
  readonly id?: JsonValue
  readonly method?: string
  readonly params?: JsonValue
  readonly result?: JsonValue
  readonly error?: JsonValue
}

/**
 * Decodes one ACP frame.
 *
 * The transport is newline-delimited JSON over stdio, so the decoding is the
 * shared one; what belongs here is the naming and the fact that a frame may be
 * a request, a response or a notification, which is what the mapper turns on.
 */
export function parseAcpLine(line: string): AcpParseResult | null {
  const trimmed = line.trim()
  if (trimmed.length === 0) return null
  const result = parseJsonObjectLine(trimmed)
  if (!result.ok) return result
  // A JSON-RPC frame has no `type`; the shared decoder only promises an object,
  // and that is all this claims too.
  return { ok: true, line: result.line as AcpRawFrame }
}

/** Decodes a whole ACP capture, dropping only blank lines. */
export function parseAcp(text: string): readonly AcpParseResult[] {
  const results: AcpParseResult[] = []
  for (const line of text.split("\n")) {
    const result = parseAcpLine(line)
    if (result !== null) results.push(result)
  }
  return results
}
