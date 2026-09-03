/** @responsibility Describes Cursor Agent `stream-json` wire shapes and decodes one line into them without interpreting it. */

import { parseJsonLine } from "../../json"
import type { JsonValue } from "../../json"
import type { WireProvenance } from "../../events"

/**
 * The build these shapes were read from.
 *
 * Cursor Agent does not stamp a CLI version on `system/init`, so this constant
 * is the only record of which build the fixtures describe. `agent --version`
 * is what a recapture must bump in the same commit.
 */
export const CURSOR_STREAM_PROVENANCE: WireProvenance = Object.freeze({
  cli: "cursor-agent",
  version: "2026.09.02-c22c1a3",
  command: "agent -p --output-format stream-json --stream-partial-output",
  capturedOn: "2026-09-02",
})

export type { JsonValue }

/**
 * The line kinds Cursor Agent emits on `--output-format stream-json`.
 *
 * Provider-specific by design. Frozen object plus derived union rather than a
 * TypeScript `enum` — an `enum` is nominal and does not survive JSON.
 */
export const CursorWireType = Object.freeze({
  System: "system",
  User: "user",
  Assistant: "assistant",
  Thinking: "thinking",
  ToolCall: "tool_call",
  Result: "result",
} as const)

export type CursorWireType = (typeof CursorWireType)[keyof typeof CursorWireType]

/** The `system` subtypes this build models. */
export const CursorSystemSubtype = Object.freeze({
  Init: "init",
} as const)

export type CursorSystemSubtype = (typeof CursorSystemSubtype)[keyof typeof CursorSystemSubtype]

/** The `thinking` subtypes. */
export const CursorThinkingSubtype = Object.freeze({
  Delta: "delta",
  Completed: "completed",
} as const)

export type CursorThinkingSubtype = (typeof CursorThinkingSubtype)[keyof typeof CursorThinkingSubtype]

/** The `tool_call` lifecycle subtypes. */
export const CursorToolCallSubtype = Object.freeze({
  Started: "started",
  Completed: "completed",
} as const)

export type CursorToolCallSubtype = (typeof CursorToolCallSubtype)[keyof typeof CursorToolCallSubtype]

/** The `result` subtypes observed so far. */
export const CursorResultSubtype = Object.freeze({
  Success: "success",
} as const)

export type CursorResultSubtype = (typeof CursorResultSubtype)[keyof typeof CursorResultSubtype]

/**
 * The camelCase tool envelopes nested under `tool_call.tool_call`.
 *
 * Naming them does not close the set: the CLI adds tools between releases, so
 * a parser matches on these and lets everything else fall through to
 * `unknown`.
 */
export const CursorToolEnvelope = Object.freeze({
  Shell: "shellToolCall",
  Edit: "editToolCall",
  Read: "readToolCall",
  Grep: "grepToolCall",
  Task: "taskToolCall",
} as const)

export type CursorToolEnvelope = (typeof CursorToolEnvelope)[keyof typeof CursorToolEnvelope]

/** Cursor's token accounting on `result`, camelCase rather than Anthropic's snake_case. */
export interface CursorUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}

/** Any decoded line, before anything past `type` has been checked. */
export interface CursorRawLine {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

export interface CursorParseFailure {
  readonly ok: false
  readonly line: string
  readonly reason: string
}

export interface CursorParseSuccess {
  readonly ok: true
  /**
   * What the parser actually verified: an object with a string `type`.
   *
   * Not a fully narrowed union. Returning one would claim fields the decoder
   * never checked; the mapper narrows after reading.
   */
  readonly line: CursorRawLine
}

export type CursorParseResult = CursorParseSuccess | CursorParseFailure

/**
 * Decodes one line of Cursor Agent's `--output-format stream-json` stream.
 *
 * Failure is returned rather than thrown: a stream is read for as long as the
 * process runs, and one malformed line must not end the transcript.
 */
export function parseCursorLine(line: string): CursorParseResult {
  const result = parseJsonLine(line)
  return result.ok ? { ok: true, line: result.line as CursorRawLine } : result
}

/** Decodes a whole capture, keeping failures in place. */
export function parseCursorLines(text: string): readonly CursorParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseCursorLine)
}
