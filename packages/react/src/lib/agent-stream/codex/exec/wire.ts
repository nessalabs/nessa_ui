/** @responsibility Describes Codex's `exec --json` wire shapes and decodes one line into them without interpreting it. */

import { parseJsonLine } from "../../json"
import type { JsonValue } from "../../json"
import type { WireProvenance } from "../../events"

/**
 * The build these shapes were read from.
 *
 * Codex publishes no version on `exec --json`, so this constant is the only
 * record of which build the fixtures describe. `codex --version` is what a
 * maintainer compares it against. The app-server is a different protocol with
 * its own schema — see `app-server/` — which is why the two are described
 * separately rather than as one provider's wire.
 */
export const CODEX_EXEC_PROVENANCE: WireProvenance = Object.freeze({
  cli: "codex-cli",
  version: "0.144.1",
  command: "codex exec --json",
  capturedOn: "2026-08-29",
})

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
  Rename: "rename",
} as const)

export type CodexFileChangeKind = (typeof CodexFileChangeKind)[keyof typeof CodexFileChangeKind]

/**
 * The collab tool that opens a delegated run.
 *
 * Other collab tools — `wait` — act on a run that already exists, so only this
 * one starts a task; treating them all as spawns makes one agent look like two.
 */
export const CODEX_SPAWN_TOOL = "spawn_agent"

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

/**
 * The shapes below describe the wire; they do not police it.
 *
 * A declared type is a claim about bytes, not a check on them, so the mapper
 * still reads every field through the shared readers rather than trusting these
 * — see `json.ts`. What they buy is a reader's map of what a line can contain,
 * autocomplete while writing a consumer, and one place to update when the CLI
 * moves. Every union keeps an open arm for the same reason the vocabularies are
 * checklists: a kind from a later release must still parse.
 */

/** One file an agent touched, as `file_change.changes[]` reports it. */
export interface CodexFileChangeEntry {
  readonly path: string
  readonly kind: CodexFileChangeKind | string
  /** Present only when the agent supplies one; Codex reports paths, not text. */
  readonly diff?: string
}

/** One step of `todo_list.items[]`. A boolean, not a three-state status. */
export interface CodexTodoItem {
  readonly text: string
  readonly completed: boolean
}

/** Fields every item carries. */
interface CodexItemBase {
  readonly id: string
  readonly status?: CodexItemStatus | string
}

/** Committed prose from the agent. Codex sends no partial text in this mode. */
export interface CodexAgentMessageItem extends CodexItemBase {
  readonly type: "agent_message"
  readonly text: string
}

/** Committed reasoning. */
export interface CodexReasoningItem extends CodexItemBase {
  readonly type: "reasoning"
  readonly text?: string
  readonly summary?: readonly JsonValue[]
  readonly content?: readonly JsonValue[]
}

/**
 * A shell command.
 *
 * Richer than Claude's tool result: the exit code is reported, so failure is a
 * fact the wire states rather than something inferred from output prose.
 */
export interface CodexCommandExecutionItem extends CodexItemBase {
  readonly type: "command_execution"
  readonly command: string
  readonly aggregated_output?: string
  readonly exit_code?: number | null
  readonly cwd?: string
}

/** Structured edits — which files changed and how. Claude Code reports no equivalent. */
export interface CodexFileChangeItem extends CodexItemBase {
  readonly type: "file_change"
  readonly changes: readonly CodexFileChangeEntry[]
}

/** The plan, republished whole on every update. Steps have no ids; position is identity. */
export interface CodexTodoListItem extends CodexItemBase {
  readonly type: "todo_list"
  readonly items: readonly CodexTodoItem[]
}

export interface CodexWebSearchItem extends CodexItemBase {
  readonly type: "web_search"
  readonly query?: string
  readonly action?: JsonValue
}

export interface CodexMcpToolCallItem extends CodexItemBase {
  readonly type: "mcp_tool_call"
  readonly tool?: string
  readonly server?: string
  readonly result?: JsonValue
}

/**
 * Delegation.
 *
 * The spawned agent writes nothing to this stream: `receiver_thread_ids` is the
 * address of its own transcript, and `agents_states` is the only live signal
 * the parent gets about it.
 */
export interface CodexCollabToolCallItem extends CodexItemBase {
  readonly type: "collab_tool_call"
  readonly tool?: string
  readonly prompt?: string | null
  readonly sender_thread_id?: string
  readonly receiver_thread_ids?: readonly string[]
  readonly agents_states?: Readonly<Record<string, JsonValue>>
}

export interface CodexErrorItem extends CodexItemBase {
  readonly type: "error"
  readonly message?: string
}

/** An item kind this build does not model. Kept open so a later release still parses. */
export interface CodexUnknownItem extends CodexItemBase {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

/** Everything an `item.*` line can carry. */
export type CodexItem =
  | CodexAgentMessageItem
  | CodexReasoningItem
  | CodexCommandExecutionItem
  | CodexFileChangeItem
  | CodexTodoListItem
  | CodexWebSearchItem
  | CodexMcpToolCallItem
  | CodexCollabToolCallItem
  | CodexErrorItem
  | CodexUnknownItem

/** Opens the thread and names it. A resume reuses the same id and says nothing else. */
export interface CodexThreadStartedLine {
  readonly type: "thread.started"
  readonly thread_id: string
}

/** A bare marker; the turn's own items say everything it does. */
export interface CodexTurnStartedLine {
  readonly type: "turn.started"
}

/** The turn terminator, carrying usage. */
export interface CodexTurnCompletedLine {
  readonly type: "turn.completed"
  readonly usage?: CodexUsage
  readonly duration_ms?: number
}

export interface CodexTurnFailedLine {
  readonly type: "turn.failed"
  readonly error?: { readonly message?: string }
  readonly usage?: CodexUsage
}

/** An item opening, changing, or settling. The item's own `id` is the call id. */
export interface CodexItemLine {
  readonly type: "item.started" | "item.updated" | "item.completed"
  readonly item: CodexItem
}

/** A thread-level failure outside any item. */
export interface CodexErrorLine {
  readonly type: "error"
  readonly message?: string
}

/** Any decoded line, before anything past `type` has been checked. */
export interface CodexRawLine {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

/** A line kind this build does not model. */
export interface CodexUnknownLine {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

/** One decoded line. */
export type CodexWireEvent =
  | CodexThreadStartedLine
  | CodexTurnStartedLine
  | CodexTurnCompletedLine
  | CodexTurnFailedLine
  | CodexItemLine
  | CodexErrorLine
  | CodexUnknownLine

export interface CodexParseFailure {
  readonly ok: false
  readonly line: string
  readonly reason: string
}

export interface CodexParseSuccess {
  readonly ok: true
  /**
   * What the parser actually verified: an object with a string `type`.
   *
   * Not one of the arms above. Returning the union would claim
   * `thread_id`, `item.id` and the rest are present when nothing checked
   * them — and a consumer trusting that claim reads `undefined` from a field
   * typed `string`. The arms stay exported as a description of the wire; a
   * consumer that wants one narrows to it after checking, the way this
   * package's own mapper does.
   */
  readonly line: CodexRawLine
}

export type CodexParseResult = CodexParseSuccess | CodexParseFailure

/**
 * Decodes one line of `codex exec --json`.
 *
 * Failure is returned rather than thrown, for the reason the Claude wire gives:
 * a stream is read for as long as the process runs, and one malformed line must
 * not end the transcript.
 */
/**
 * Decodes one line of Codex's stream.
 *
 * The decoding itself is shared — every provider's wire is newline-delimited
 * JSON, and one copy per provider is one place per provider for a bug in it to
 * live. What stays here is the naming and the return type.
 */
export function parseCodexLine(line: string): CodexParseResult {
  const result = parseJsonLine(line)
  return result.ok ? { ok: true, line: result.line as CodexRawLine } : result
}

/** Decodes a whole capture, keeping failures in place. */
export function parseCodexLines(text: string): readonly CodexParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseCodexLine)
}
