/** @responsibility Describes Codex's `exec --json` wire shapes and decodes one line into them without interpreting it. */

import type { JsonValue } from "../json"

/** Re-exported so one import gives a consumer this wire's whole vocabulary. */
export type { JsonValue }

/**
 * The line kinds `codex exec --json` emits.
 *
 * Codex reports a thread of **items** rather than a stream of content blocks:
 * a line either moves the thread or the turn, or reports one item's lifecycle.
 * That is a smaller vocabulary than Claude Code's, and a flatter one — there is
 * no separate system channel and no SSE frame layer.
 */
export const CodexWireType = Object.freeze({
  ThreadStarted: "thread.started",
  TurnStarted: "turn.started",
  TurnCompleted: "turn.completed",
  TurnFailed: "turn.failed",
  ItemStarted: "item.started",
  ItemUpdated: "item.updated",
  ItemCompleted: "item.completed",
  Error: "error",
} as const)

export type CodexWireType = (typeof CodexWireType)[keyof typeof CodexWireType]

/**
 * The item kinds observed on the wire.
 *
 * A checklist of what is handled, never a claim about what exists: Codex adds
 * item kinds between releases, and anything unlisted must still reach the log
 * as an unknown event rather than failing the line.
 */
export const CodexItemType = Object.freeze({
  AgentMessage: "agent_message",
  Reasoning: "reasoning",
  CommandExecution: "command_execution",
  FileChange: "file_change",
  TodoList: "todo_list",
  WebSearch: "web_search",
  McpToolCall: "mcp_tool_call",
  /** Delegation: `spawn_agent` and friends, addressed by thread id rather than call id. */
  CollabToolCall: "collab_tool_call",
  Error: "error",
} as const)

export type CodexItemType = (typeof CodexItemType)[keyof typeof CodexItemType]

/**
 * An item's lifecycle status.
 *
 * Carried on the item rather than implied by the line kind, so a completed line
 * can still report a failure — which is how a non-zero command reports itself.
 */
export const CodexItemStatus = Object.freeze({
  InProgress: "in_progress",
  Completed: "completed",
  Failed: "failed",
} as const)

export type CodexItemStatus = (typeof CodexItemStatus)[keyof typeof CodexItemStatus]

/** How a file changed, as `file_change.changes[].kind` reports it. */
export const CodexFileChangeKind = Object.freeze({
  Add: "add",
  Update: "update",
  Delete: "delete",
} as const)

export type CodexFileChangeKind = (typeof CodexFileChangeKind)[keyof typeof CodexFileChangeKind]

/**
 * Codex's token accounting, as carried on `turn.completed`.
 *
 * Every field is optional: the counters are a different set from Anthropic's —
 * `cached_input_tokens` rather than a cache read/creation split, plus a
 * reasoning count that has no Claude counterpart — and a parser that assumes
 * any of them is present reports a confident zero for a turn that said nothing.
 */
export interface CodexUsage {
  readonly input_tokens?: number
  readonly cached_input_tokens?: number
  readonly output_tokens?: number
  readonly reasoning_output_tokens?: number
}

/** One decoded line. Fields this library reads are named; the rest is tolerated. */
export type CodexWireEvent = {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

export interface CodexParseFailure {
  readonly ok: false
  readonly line: string
  readonly reason: string
}

export interface CodexParseSuccess {
  readonly ok: true
  readonly event: CodexWireEvent
}

export type CodexParseResult = CodexParseSuccess | CodexParseFailure

/**
 * Decodes one line of `codex exec --json`.
 *
 * Failure is returned rather than thrown, for the reason the Claude wire gives:
 * a stream is read for as long as the process runs, and one malformed line must
 * not end the transcript.
 */
export function parseCodexLine(line: string): CodexParseResult {
  const trimmed = line.trim()
  if (trimmed.length === 0) return { ok: false, line, reason: "empty line" }

  let decoded: unknown
  try {
    decoded = JSON.parse(trimmed)
  } catch (error) {
    return { ok: false, line, reason: error instanceof Error ? error.message : "invalid JSON" }
  }

  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    return { ok: false, line, reason: "line is not a JSON object" }
  }
  const event = decoded as { type?: unknown }
  if (typeof event.type !== "string") return { ok: false, line, reason: "line has no `type`" }

  return { ok: true, event: decoded as CodexWireEvent }
}

/** Splits a whole capture into lines and decodes each one, keeping failures in place. */
export function parseCodexLines(text: string): readonly CodexParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseCodexLine)
}
