/** @responsibility Describes the `opencode run --format json` envelope and decodes one line into it without interpreting it. */

import type { WireProvenance } from "../../events"
import { parseJsonLine } from "../../json"
import type { JsonValue } from "../../json"

/**
 * The build this envelope was read from.
 *
 * opencode publishes no version on this stream, so this constant is the only
 * record of which build the fixtures describe. `opencode --version` is what a
 * maintainer compares it against. The server's bus is a *different* protocol
 * with its own version — see `server/wire.ts` — which is why the two are
 * described separately rather than as one provider's wire.
 */
export const OPENCODE_RUN_PROVENANCE: WireProvenance = Object.freeze({
  cli: "opencode",
  version: "1.18.25",
  command: "opencode run --format json",
  capturedOn: "2026-08-29",
})

/**
 * The line kinds `opencode run --format json` emits.
 *
 * A turn is a run of **steps**: a step opens, produces parts, and finishes with
 * its own stop reason and usage. A prompt that calls tools is therefore several
 * steps, and only the last says `stop` — so unlike Claude and Codex there is no
 * single terminator line, which is the one shape difference a consumer must
 * care about.
 */
export const OpencodeRunType = Object.freeze({
  StepStart: "step_start",
  StepFinish: "step_finish",
  Text: "text",
  Reasoning: "reasoning",
  ToolUse: "tool_use",
  Error: "error",
  /**
   * Not on the live stream.
   *
   * `run --format json` never echoes the prompt — the host is the only thing
   * that knows what it asked. An exported session does contain it, as a text
   * part on a user message, and the export reader rebuilds it as this so one
   * reader handles both instead of two disagreeing about one conversation.
   */
  UserMessage: "user_message",
} as const)

export type OpencodeRunType = (typeof OpencodeRunType)[keyof typeof OpencodeRunType]

/** The envelope every line of this wire shares. */
export interface OpencodeRunLine {
  readonly type: string
  readonly timestamp?: number
  readonly sessionID?: string
  readonly part?: JsonValue
}

/** Any decoded line, before anything past `type` has been checked. */
export interface OpencodeRawLine {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

export interface OpencodeParseFailure {
  readonly ok: false
  readonly line: string
  readonly reason: string
}

export interface OpencodeParseSuccess {
  readonly ok: true
  /**
   * What the parser actually verified: an object with a string `type`.
   *
   * Not one of the shapes above — returning those would claim `part.id` and the
   * rest are present when nothing checked them. They stay exported as a
   * description of the wire; a consumer narrows to one after checking, the way
   * this package's own mapper does.
   */
  readonly line: OpencodeRawLine
}

export type OpencodeParseResult = OpencodeParseSuccess | OpencodeParseFailure

/**
 * Decodes one line of opencode's one-way stream.
 *
 * The decoding itself is shared — every provider's wire is newline-delimited
 * JSON, and one copy per provider is one place per provider for a bug in it to
 * live. What stays here is the naming and the return type.
 */
export function parseOpencodeLine(line: string): OpencodeParseResult {
  const result = parseJsonLine(line)
  return result.ok ? { ok: true, line: result.line as OpencodeRawLine } : result
}

/** Decodes a whole capture, keeping failures in place. */
export function parseOpencodeLines(text: string): readonly OpencodeParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseOpencodeLine)
}
