/** @responsibility Describes the Agent Client Protocol envelope — one protocol, several agents — without interpreting it. */

import type { JsonValue } from "../json"

/**
 * The protocol revision this module reads.
 *
 * Deliberately not a [`WireProvenance`]: unlike every other wire here, this
 * module is not true of one build of one CLI. Three different agents speak it
 * — Claude Code and Codex through adapters, opencode and Cursor Agent
 * natively — so the build belongs to each of them and lives on their
 * transport descriptors instead.
 *
 * ACP is also the one wire that does not need a constant to answer the
 * question: `initialize` replies with `agentInfo: { name, version }`, so a
 * consumer can read which process it is actually talking to.
 */
export const ACP_PROTOCOL_VERSION = 1

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
  /** Cursor's ACP requires this after initialize; other agents skip it. */
  Authenticate: "authenticate",
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
   * A session's own status.
   *
   * Codex's adapter puts its payload under `_meta.codex`; Cursor may send a
   * top-level `title` instead. Both are agent-specific extensions the protocol
   * does not define, so a reader must tolerate them rather than treat them as
   * unknown frames.
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
