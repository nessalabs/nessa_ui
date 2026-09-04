/** @responsibility Describes the raw Messages API streaming shapes and decodes one frame into them without interpreting it. */

import { parseJsonLine } from "../../json"
import type { JsonValue } from "../../json"
import type { WireProvenance } from "../../events"

/**
 * The build these shapes were read from.
 *
 * Unlike Claude Code's stream, this wire stamps no version on itself — there is
 * no `init` line to carry one, because there is no session to announce. The
 * only version that can be recorded is the SDK the capture was taken through,
 * which is why re-capturing on an SDK bump is the *only* way to notice drift
 * here. That is a weaker guarantee than the CLI wires give, and it is the
 * reason to state it plainly rather than imply parity.
 */
export const CLAUDE_MESSAGES_PROVENANCE: WireProvenance = Object.freeze({
  cli: "@anthropic-ai/sdk",
  version: "0.123.0",
  command: "client.messages.stream({ ... }) — see scripts in the capture notes",
  capturedOn: "2026-09-04",
})

/** Re-exported so one import gives a consumer this wire's whole vocabulary. */
export type { JsonValue }

/**
 * The frame kinds the Messages API streams.
 *
 * This is the Anthropic SSE vocabulary itself, not a CLI's framing of it.
 * Claude Code carries these same six frames *nested inside* a `stream_event`
 * line, alongside line kinds of its own (`system`, `assistant`, `result`);
 * here they arrive bare and they are the entire wire. A reader written for one
 * cannot be pointed at the other, which is why this is a separate module and
 * not a flag on the existing one.
 *
 * Frozen object plus derived union rather than a TypeScript `enum` — an `enum`
 * is a nominal type that does not survive JSON, so a value read off the wire
 * could never *be* one without a cast.
 */
export const MessagesFrameType = Object.freeze({
  MessageStart: "message_start",
  ContentBlockStart: "content_block_start",
  ContentBlockDelta: "content_block_delta",
  ContentBlockStop: "content_block_stop",
  MessageDelta: "message_delta",
  MessageStop: "message_stop",
} as const)

export type MessagesFrameType = (typeof MessagesFrameType)[keyof typeof MessagesFrameType]

/**
 * The content block kinds observed in the captures.
 *
 * Naming them does not close the set: server tools ship new result blocks on
 * their own schedule, so a parser matches on these and lets everything else
 * fall through to an `unknown` event rather than failing the frame.
 */
export const MessagesBlockType = Object.freeze({
  Text: "text",
  Thinking: "thinking",
  ToolUse: "tool_use",
  /**
   * A tool Anthropic runs server-side. It is *not* a call the host executes:
   * no `tool_result` is ever sent back for one, and its outcome arrives on the
   * same stream as a result block. Drawing it as a pending client tool call
   * would leave a spinner that never resolves.
   */
  ServerToolUse: "server_tool_use",
  WebSearchToolResult: "web_search_tool_result",
  CodeExecutionToolResult: "code_execution_tool_result",
} as const)

export type MessagesBlockType = (typeof MessagesBlockType)[keyof typeof MessagesBlockType]

/** The delta kinds an open content block streams. */
export const MessagesDeltaType = Object.freeze({
  Text: "text_delta",
  Thinking: "thinking_delta",
  Signature: "signature_delta",
  InputJson: "input_json_delta",
} as const)

export type MessagesDeltaType = (typeof MessagesDeltaType)[keyof typeof MessagesDeltaType]

/**
 * Why a message stopped, as reported on `message_delta`.
 *
 * `tool_use` is the one that matters structurally: it means the host now owes
 * the conversation a `tool_result`, and the stream will not continue on its
 * own. Everything else ends the turn.
 */
export const MessagesStopReason = Object.freeze({
  EndTurn: "end_turn",
  MaxTokens: "max_tokens",
  StopSequence: "stop_sequence",
  ToolUse: "tool_use",
  PauseTurn: "pause_turn",
  Refusal: "refusal",
} as const)

export type MessagesStopReason = (typeof MessagesStopReason)[keyof typeof MessagesStopReason]

/**
 * Anthropic's token accounting on this wire.
 *
 * Reported in two places with different fields filled in: `message_start`
 * carries the input side and a placeholder output count, `message_delta`
 * carries the final output count. Note `output_tokens_details.thinking_tokens`
 * — this wire *does* separate reasoning tokens, which Claude Code's stream
 * does not, so a mapper here can report `reasoningTokens` honestly instead of
 * null.
 */
export interface WireUsage {
  readonly input_tokens?: number
  readonly output_tokens?: number
  readonly cache_read_input_tokens?: number
  readonly cache_creation_input_tokens?: number
  readonly cache_creation?: {
    readonly ephemeral_5m_input_tokens?: number
    readonly ephemeral_1h_input_tokens?: number
  }
  readonly output_tokens_details?: {
    readonly thinking_tokens?: number
  }
  readonly server_tool_use?: {
    readonly web_search_requests?: number
    readonly web_fetch_requests?: number
  }
  readonly service_tier?: string
  readonly inference_geo?: string
}

/** A content block as it appears at `content_block_start`, before any delta is applied. */
export type WireContentBlock =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "thinking"; readonly thinking?: string; readonly signature?: string }
  | {
      readonly type: "tool_use"
      readonly id: string
      readonly name: string
      readonly input?: JsonValue
    }
  | {
      readonly type: "server_tool_use"
      readonly id: string
      readonly name: string
      readonly input?: JsonValue
      /**
       * Set when this server tool was invoked from inside another one — the
       * search capture has `web_search` called by `code_execution`. Server
       * tools nest; client tools do not.
       */
      readonly caller?: { readonly type?: string; readonly tool_id?: string }
    }
  | {
      readonly type: "web_search_tool_result" | "code_execution_tool_result"
      readonly tool_use_id: string
      readonly content?: JsonValue
    }
  | { readonly type: string; readonly [key: string]: JsonValue | undefined }

/** One incremental update to an open content block. */
export type WireContentDelta =
  | { readonly type: "text_delta"; readonly text: string }
  | { readonly type: "thinking_delta"; readonly thinking: string }
  | { readonly type: "signature_delta"; readonly signature: string }
  /**
   * Fragments of a tool call's arguments. These are *not* individually
   * parseable — only the concatenation of every fragment for one block is
   * valid JSON.
   */
  | { readonly type: "input_json_delta"; readonly partial_json: string }
  | { readonly type: string }

/** The message envelope opened by `message_start`. */
export interface WireMessage {
  readonly id: string
  readonly model: string
  readonly role: string
  readonly type?: string
  readonly content?: readonly WireContentBlock[]
  readonly stop_reason?: string | null
  readonly usage?: WireUsage
}

/**
 * One decoded frame. Every arm keeps the fields this library reads and
 * tolerates the rest.
 *
 * These shapes describe the wire; they do not police it. A declared type is a
 * claim about bytes, not a check on them, so the mapper reads every field
 * through the shared readers rather than trusting the declaration.
 */
export type WireEvent =
  | { readonly type: "message_start"; readonly message: WireMessage }
  | {
      readonly type: "content_block_start"
      readonly index: number
      readonly content_block: WireContentBlock
    }
  | {
      readonly type: "content_block_delta"
      readonly index: number
      readonly delta: WireContentDelta
    }
  | { readonly type: "content_block_stop"; readonly index: number }
  | {
      readonly type: "message_delta"
      readonly delta: {
        readonly stop_reason?: string | null
        readonly stop_sequence?: string | null
        readonly stop_details?: JsonValue
      }
      readonly usage?: WireUsage
    }
  | { readonly type: "message_stop" }
  | { readonly type: string; readonly [key: string]: JsonValue | undefined }

/** Any decoded frame, before anything past `type` has been checked. */
export interface WireLine {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

/** What a line that could not be decoded at all becomes. */
export interface WireParseFailure {
  readonly ok: false
  readonly line: string
  readonly reason: string
}

export interface WireParseSuccess {
  readonly ok: true
  /**
   * What the parser actually verified: an object with a string `type`. Not one
   * of the arms above — returning the union would claim fields nothing checked.
   */
  readonly line: WireLine
}

export type WireParseResult = WireParseSuccess | WireParseFailure

/**
 * Decodes one line of a captured Messages API stream.
 *
 * A host consuming the SDK live has objects already and should use the
 * mapper's frame entry instead of serializing them just to parse them back.
 * This exists for captures on disk, which is how the fixtures are read.
 */
export function parseWireLine(line: string): WireParseResult {
  const result = parseJsonLine(line)
  return result.ok ? { ok: true, line: result.line as WireLine } : result
}

/** Decodes a whole capture, keeping failures in place. */
export function parseWireLines(text: string): readonly WireParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseWireLine)
}
