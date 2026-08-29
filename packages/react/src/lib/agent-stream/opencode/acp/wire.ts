/** @responsibility Describes the `opencode acp` JSON-RPC envelope and decodes one frame into it without interpreting it. */

import type { WireProvenance } from "../../events"
import { parseJsonObjectLine } from "../../json"
import type { JsonValue } from "../../json"
import type { OpencodeParseResult, OpencodeRawLine } from "../run/wire"

/**
 * The build this envelope was read from.
 *
 * ACP is the only one of opencode's three wires that states its own version:
 * `initialize` replies with `agentInfo: { name, version }`, so a consumer can
 * compare the process it is talking to against what was modelled without being
 * told out of band. `protocolVersion` is the protocol's own number, which moves
 * independently of both the agent and the server API.
 */
export const OPENCODE_ACP_PROVENANCE: WireProvenance & { readonly protocolVersion: number } = Object.freeze({
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
export const OpencodeAcpMethod = Object.freeze({
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

export type OpencodeAcpMethod = (typeof OpencodeAcpMethod)[keyof typeof OpencodeAcpMethod]

/**
 * The kinds of `session/update`.
 *
 * ACP normalizes where opencode's own wires do not: prose and reasoning arrive
 * as separate chunk kinds, a tool call carries a `kind` the protocol defines
 * rather than a tool name to be guessed at, and usage arrives with the context
 * window's size beside it — which neither other transport reports at all.
 */
export const OpencodeAcpUpdate = Object.freeze({
  AgentMessageChunk: "agent_message_chunk",
  AgentThoughtChunk: "agent_thought_chunk",
  UserMessageChunk: "user_message_chunk",
  ToolCall: "tool_call",
  ToolCallUpdate: "tool_call_update",
  Plan: "plan",
  AvailableCommandsUpdate: "available_commands_update",
  CurrentModeUpdate: "current_mode_update",
  UsageUpdate: "usage_update",
} as const)

export type OpencodeAcpUpdate = (typeof OpencodeAcpUpdate)[keyof typeof OpencodeAcpUpdate]

/**
 * A tool call's kind, as the protocol defines it.
 *
 * The protocol's own vocabulary, not opencode's tool names — which is why an
 * ACP client renders a call the same way whichever agent it is talking to.
 */
export const OpencodeAcpToolKind = Object.freeze({
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

export type OpencodeAcpToolKind = (typeof OpencodeAcpToolKind)[keyof typeof OpencodeAcpToolKind]

/** A tool call's status, which unlike the other wires does open before it settles. */
export const OpencodeAcpToolStatus = Object.freeze({
  Pending: "pending",
  InProgress: "in_progress",
  Completed: "completed",
  Failed: "failed",
} as const)

export type OpencodeAcpToolStatus = (typeof OpencodeAcpToolStatus)[keyof typeof OpencodeAcpToolStatus]

/** How a client answered a permission request. */
export const OpencodeAcpPermissionKind = Object.freeze({
  AllowOnce: "allow_once",
  AllowAlways: "allow_always",
  RejectOnce: "reject_once",
  RejectAlways: "reject_always",
} as const)

export type OpencodeAcpPermissionKind = (typeof OpencodeAcpPermissionKind)[keyof typeof OpencodeAcpPermissionKind]

/** One JSON-RPC frame, in either direction. */
export interface OpencodeAcpFrame {
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
export function parseOpencodeAcpLine(line: string): OpencodeParseResult | null {
  const trimmed = line.trim()
  if (trimmed.length === 0) return null
  const result = parseJsonObjectLine(trimmed)
  if (!result.ok) return result
  // A JSON-RPC frame has no `type`; the shared decoder only promises an object,
  // and that is all this claims too.
  return { ok: true, line: result.line as OpencodeRawLine }
}

/** Decodes a whole ACP capture, dropping only blank lines. */
export function parseOpencodeAcp(text: string): readonly OpencodeParseResult[] {
  const results: OpencodeParseResult[] = []
  for (const line of text.split("\n")) {
    const result = parseOpencodeAcpLine(line)
    if (result !== null) results.push(result)
  }
  return results
}
