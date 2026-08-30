/** @responsibility Decodes one Agent Client Protocol frame without interpreting it. */

import { parseJsonObjectLine } from "../json"
import type { JsonValue } from "../json"

/** Any decoded frame, before anything past "it is an object" has been checked. */
export interface AcpRawFrame {
  readonly [key: string]: JsonValue | undefined
}

export interface AcpParseFailure {
  readonly ok: false
  readonly line: string
  readonly reason: string
}

export interface AcpParseSuccess {
  readonly ok: true
  /**
   * What the parser actually verified: an object.
   *
   * Less than the stream wires promise, and deliberately: a JSON-RPC frame is
   * identified by `method`, `id` and `result`, so insisting on a `type` — which
   * the shared line decoder does — would reject every valid frame.
   */
  readonly line: AcpRawFrame
}

export type AcpParseResult = AcpParseSuccess | AcpParseFailure

/** One frame of newline-delimited JSON-RPC. A blank line is not a frame. */
export function parseAcpLine(line: string): AcpParseResult | null {
  const trimmed = line.trim()
  if (trimmed.length === 0) return null
  const result = parseJsonObjectLine(trimmed)
  return result.ok ? { ok: true, line: result.line as AcpRawFrame } : result
}

/** Decodes a whole capture, dropping only blank lines. */
export function parseAcp(text: string): readonly AcpParseResult[] {
  const results: AcpParseResult[] = []
  for (const line of text.split("\n")) {
    const result = parseAcpLine(line)
    if (result !== null) results.push(result)
  }
  return results
}
