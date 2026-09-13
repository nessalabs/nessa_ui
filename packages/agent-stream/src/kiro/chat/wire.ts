/** @responsibility Describes Kiro CLI `--output-format stream-json` wire shapes and decodes one line into them without interpreting it. */

import { parseJsonLine } from "../../json"
import type { JsonValue } from "../../json"
import type { WireProvenance } from "../../events"

/**
 * The build these shapes were modelled from.
 *
 * Kiro's `--output-format stream-json` mode requires V2 or V3 (`--engine v2`
 * or `--engine v3`). The CLI stamps its own version in the `init` event.
 * The fixtures beside this mapper are synthetic — there was no live CLI
 * capture in this environment — so the version here is the one the fixtures
 * advertise, not a build that was observed on disk. When a live capture is
 * retaken, bump this constant and `capturedOn` in the same commit.
 *
 * Capture command:
 *   kiro-cli chat --no-interactive --trust-all-tools \
 *     --output-format stream-json "your prompt" > capture.jsonl
 *
 * TODO(kiro-live): When kiro-cli credits/access return, replace the synthetic
 * fixtures under apps/storybook/stories/fixtures/agent-stream/kiro/ with live
 * captures (printed, tools, failing, plus task/todowrite/extension lines if
 * reachable), then set `version`/`capturedOn` from the real `system/init`.
 */
export const KIRO_CHAT_PROVENANCE: WireProvenance = Object.freeze({
  cli: "kiro-cli",
  version: "3.0.0",
  command: "kiro-cli chat --no-interactive --trust-all-tools --output-format stream-json",
  capturedOn: "2026-09-04",
})

/**
 * The top-level line kinds Kiro CLI emits on `--output-format stream-json`.
 *
 * Headless chat publishes ACP-shaped session updates as top-level JSONL
 * (`system`, `user`, `assistant`, `tool_call`, `tool_call_update`, `turn_end`)
 * rather than wrapping them in JSON-RPC `session/update` notifications. Kiro
 * also emits its own extension events under the `_kiro.dev/` prefix.
 *
 * Frozen object plus derived union rather than a TypeScript `enum` — an `enum`
 * is nominal and does not survive JSON.
 */
export const KiroWireType = Object.freeze({
  System: "system",
  User: "user",
  Assistant: "assistant",
  ToolCall: "tool_call",
  ToolCallUpdate: "tool_call_update",
  TurnEnd: "turn_end",
  /** Kiro-specific extension lines. */
  KiroExtension: "_kiro.dev",
} as const)

export type KiroWireType = (typeof KiroWireType)[keyof typeof KiroWireType]

/** The `system` subtypes emitted by Kiro on `--output-format stream-json`. */
export const KiroSystemSubtype = Object.freeze({
  /**
   * The session initialisation line: session id, model, cwd, tools, skills,
   * agents, MCP servers, slash commands, and the CLI version.
   */
  Init: "init",
} as const)

export type KiroSystemSubtype = (typeof KiroSystemSubtype)[keyof typeof KiroSystemSubtype]

/** The `tool_call` lifecycle subtypes. */
export const KiroToolCallSubtype = Object.freeze({
  /** The call is opening; input may not be fully received yet. */
  Started: "started",
  /** The call has settled with a result. */
  Completed: "completed",
  /** The call failed — the tool threw, was refused, or was aborted. */
  Failed: "failed",
} as const)

export type KiroToolCallSubtype = (typeof KiroToolCallSubtype)[keyof typeof KiroToolCallSubtype]

/**
 * The `_kiro.dev/` extension subtypes observed on the stream.
 *
 * These are Kiro-specific and may be added between releases; unrecognised
 * ones fall through to `unknown`.
 */
export const KiroExtensionSubtype = Object.freeze({
  CompactionStatus: "_kiro.dev/compaction/status",
  ClearStatus: "_kiro.dev/clear/status",
  CommandsAvailable: "_kiro.dev/commands/available",
  McpServerInitialized: "_kiro.dev/mcp/server_initialized",
} as const)

export type KiroExtensionSubtype = (typeof KiroExtensionSubtype)[keyof typeof KiroExtensionSubtype]

/**
 * The tool-call kind vocabulary Kiro publishes on its stream.
 *
 * These are the ACP tool kinds Kiro uses natively (it implements ACP), plus
 * any Kiro-specific names observed in captures. The set is open: unrecognised
 * names fall through to `"other"`.
 */
export const KiroToolKind = Object.freeze({
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

export type KiroToolKind = (typeof KiroToolKind)[keyof typeof KiroToolKind]

/** Kiro tool names seen on the stream (ACP-standard names). */
export const KiroToolName = Object.freeze({
  Bash: "bash",
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

export type KiroToolName = (typeof KiroToolName)[keyof typeof KiroToolName]

/** Tool-call status values published on `tool_call_update`. */
export const KiroToolStatus = Object.freeze({
  Pending: "pending",
  InProgress: "in_progress",
  Completed: "completed",
  Failed: "failed",
} as const)

export type KiroToolStatus = (typeof KiroToolStatus)[keyof typeof KiroToolStatus]

/** Any decoded line, before fields past `type` have been verified. */
export interface KiroRawLine {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

export interface KiroParseFailure {
  readonly ok: false
  readonly line: string
  readonly reason: string
}

export interface KiroParseSuccess {
  readonly ok: true
  /**
   * What the decoder verified: an object with a string `type`.
   *
   * Not a fully narrowed union; the mapper narrows after reading.
   */
  readonly line: KiroRawLine
}

export type KiroParseResult = KiroParseSuccess | KiroParseFailure

/**
 * Decodes one line of Kiro CLI's `--output-format stream-json` stream.
 *
 * Returns a failure rather than throwing: one malformed line must not end the
 * transcript.
 */
export function parseKiroLine(line: string): KiroParseResult {
  const result = parseJsonLine(line)
  return result.ok ? { ok: true, line: result.line as KiroRawLine } : result
}

/** Decodes a whole capture, keeping failures in place. */
export function parseKiroLines(text: string): readonly KiroParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseKiroLine)
}
