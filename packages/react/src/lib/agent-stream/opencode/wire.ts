/** @responsibility Describes opencode's `run --format json` wire shapes and decodes one line into them without interpreting it. */

import { parseJsonLine } from "../json"
import type { WireProvenance } from "../events"
import type { JsonValue } from "../json"

/** Re-exported so one import gives a consumer this wire's whole vocabulary. */
export type { JsonValue }

/**
 * The build these shapes were read from.
 *
 * opencode publishes no version on its stream, so this constant is the only
 * record of which build the fixtures describe. `opencode --version` is what a
 * maintainer compares it against.
 */
export const OPENCODE_WIRE_PROVENANCE: WireProvenance = Object.freeze({
  cli: "opencode",
  version: "1.18.25",
  command: "opencode run --format json",
  capturedOn: "2026-08-29",
})

/**
 * The line kinds `opencode run --format json` emits.
 *
 * opencode reports a message as **parts**, and a turn as a run of **steps**: a
 * step opens, produces parts, and finishes with its own stop reason and usage.
 * A prompt that calls tools is therefore several steps, and only the last one
 * says `stop` — so unlike Claude and Codex there is no single terminator line
 * for the turn, which is the one shape difference a consumer has to care about.
 */
export const OpencodeWireType = Object.freeze({
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
   * mapper reads both shapes instead of two readers disagreeing about one
   * conversation.
   */
  UserMessage: "user_message",
} as const)

export type OpencodeWireType = (typeof OpencodeWireType)[keyof typeof OpencodeWireType]

/**
 * The `part.type` values observed on the wire.
 *
 * Hyphenated, where the line's own `type` is underscored — the same fact spelt
 * two ways on one line, so both are named rather than derived from each other.
 */
export const OpencodePartType = Object.freeze({
  StepStart: "step-start",
  StepFinish: "step-finish",
  Text: "text",
  Reasoning: "reasoning",
  Tool: "tool",
} as const)

export type OpencodePartType = (typeof OpencodePartType)[keyof typeof OpencodePartType]

/**
 * A tool call's lifecycle, as opencode reports it.
 *
 * `error` means the *call* did not run — it threw, or a permission rule
 * refused it. A shell command that ran and exited non-zero is `completed`,
 * with the failure in `metadata.exit`. Reading failure from the status alone
 * would call every failed build a success.
 */
export const OpencodeToolStatus = Object.freeze({
  Pending: "pending",
  Running: "running",
  Completed: "completed",
  Error: "error",
} as const)

export type OpencodeToolStatus = (typeof OpencodeToolStatus)[keyof typeof OpencodeToolStatus]

/**
 * The tool names observed on the wire.
 *
 * A checklist of what is handled, never a claim about what exists: opencode
 * ships plugins and MCP servers that add their own, and anything unlisted must
 * still reach the log as a call of unknown kind rather than failing the line.
 */
export const OpencodeToolName = Object.freeze({
  Bash: "bash",
  Read: "read",
  Write: "write",
  Edit: "edit",
  Patch: "patch",
  Glob: "glob",
  Grep: "grep",
  List: "list",
  WebFetch: "webfetch",
  TodoWrite: "todowrite",
  TodoRead: "todoread",
  /** Delegation. Its metadata names the child session, which is readable on its own. */
  Task: "task",
} as const)

export type OpencodeToolName = (typeof OpencodeToolName)[keyof typeof OpencodeToolName]

/** A step's stop reason, as reported on `step_finish`. */
export const OpencodeFinishReason = Object.freeze({
  Stop: "stop",
  ToolCalls: "tool-calls",
  Length: "length",
  ContentFilter: "content-filter",
  Error: "error",
} as const)

export type OpencodeFinishReason = (typeof OpencodeFinishReason)[keyof typeof OpencodeFinishReason]

/**
 * The event names the headless server publishes on its SSE stream.
 *
 * A second wire for the same agent, and a much richer one. `opencode serve`
 * (and `opencode acp`, which speaks the same bus) streams token deltas, names
 * the model, reports its permission rules, and asks before running what those
 * rules cover — none of which `run --format json` does. A consumer should be
 * told which transport it is reading rather than inferring capability from the
 * provider's name.
 */
export const OpencodeServerEventType = Object.freeze({
  ServerConnected: "server.connected",
  ServerHeartbeat: "server.heartbeat",
  SessionCreated: "session.created",
  SessionUpdated: "session.updated",
  SessionStatus: "session.status",
  SessionIdle: "session.idle",
  SessionDiff: "session.diff",
  MessageUpdated: "message.updated",
  MessagePartUpdated: "message.part.updated",
  /** One token, or one chunk of a tool's arguments. The only streaming opencode does. */
  MessagePartDelta: "message.part.delta",
  PermissionAsked: "permission.asked",
  PermissionReplied: "permission.replied",
  PluginAdded: "plugin.added",
  CatalogUpdated: "catalog.updated",
  ReferenceUpdated: "reference.updated",
  IntegrationUpdated: "integration.updated",
} as const)

export type OpencodeServerEventType = (typeof OpencodeServerEventType)[keyof typeof OpencodeServerEventType]

/** The server's vocabulary as a set, so a reader can tell which of the two wires a line came from. */
const SERVER_EVENT_TYPES: ReadonlySet<string> = new Set(Object.values(OpencodeServerEventType))

/**
 * Whether a line came from the server's bus rather than from `run --format json`.
 *
 * Asked explicitly rather than inferred from the spelling: the two vocabularies
 * happen to differ in punctuation today, and a rule resting on that would break
 * silently the first time either side named an event differently.
 */
export function isOpencodeServerEvent(type: string): boolean {
  return SERVER_EVENT_TYPES.has(type)
}

/** Which field of a part a delta extends. */
export const OpencodeDeltaField = Object.freeze({
  Text: "text",
  /** A tool's arguments, arriving as partial JSON the way Claude's `input_json_delta` does. */
  Input: "input",
} as const)

export type OpencodeDeltaField = (typeof OpencodeDeltaField)[keyof typeof OpencodeDeltaField]

/** Token counts, as a step reports them. */
export interface OpencodeTokens {
  readonly total?: number
  readonly input?: number
  readonly output?: number
  readonly reasoning?: number
  readonly cache?: { readonly read?: number; readonly write?: number }
}

/** The envelope every line shares. */
export interface OpencodeLine {
  readonly type: string
  readonly timestamp?: number
  readonly sessionID?: string
  readonly part?: JsonValue
}

export interface OpencodeStepStartPart {
  readonly type: "step-start"
  readonly id: string
  readonly messageID?: string
  readonly sessionID?: string
}

export interface OpencodeStepFinishPart {
  readonly type: "step-finish"
  readonly id: string
  readonly messageID?: string
  readonly sessionID?: string
  readonly reason?: string
  readonly tokens?: OpencodeTokens
  readonly cost?: number
}

export interface OpencodeTextPart {
  readonly type: "text"
  readonly id: string
  readonly messageID?: string
  readonly sessionID?: string
  readonly text?: string
  readonly time?: { readonly start?: number; readonly end?: number }
}

/**
 * A tool call, reported once it has settled.
 *
 * `state` carries the whole call — the input it ran with and the output or
 * error it produced — so one line is the entire row rather than the opening
 * half of one.
 */
export interface OpencodeToolPart {
  readonly type: "tool"
  readonly id: string
  readonly callID?: string
  readonly tool?: string
  readonly messageID?: string
  readonly sessionID?: string
  readonly state?: {
    readonly status?: string
    readonly input?: JsonValue
    readonly output?: string
    readonly error?: string
    readonly title?: string
    readonly metadata?: JsonValue
    readonly time?: { readonly start?: number; readonly end?: number }
  }
}

/** Any decoded line, before anything past `type` has been checked. */
export interface OpencodeRawLine {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

/** One decoded line. */
export type OpencodeWireEvent = OpencodeLine | OpencodeRawLine

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
   * Not one of the part shapes above — returning those would claim `part.id`
   * and the rest are present when nothing checked them. They stay exported as
   * a description of the wire; a consumer narrows to one after checking, the
   * way this package's own mapper does.
   */
  readonly line: OpencodeRawLine
}

export type OpencodeParseResult = OpencodeParseSuccess | OpencodeParseFailure

/**
 * Decodes one line of opencode's stream.
 *
 * The decoding itself is shared — every provider's wire is newline-delimited
 * JSON, and one copy per provider is one place per provider for a bug in it to
 * live. What stays here is the naming and the return type.
 */
export function parseOpencodeLine(line: string): OpencodeParseResult {
  const result = parseJsonLine(line)
  return result.ok ? { ok: true, line: result.line as OpencodeRawLine } : result
}

/**
 * Decodes one frame of the server's SSE stream.
 *
 * An SSE frame prefixes its payload with `data: `, and a capture written
 * straight to a file keeps that prefix. Stripping it here means one reader
 * handles a live connection and a saved stream alike; a comment or a keep-alive
 * line decodes to nothing rather than to an error.
 */
export function parseOpencodeSseLine(line: string): OpencodeParseResult | null {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.startsWith(":")) return null
  const body = trimmed.startsWith("data:") ? trimmed.slice("data:".length).trim() : trimmed
  if (body.length === 0) return null
  return parseOpencodeLine(body)
}

/** Decodes a whole SSE capture, dropping only the frames that carry no payload. */
export function parseOpencodeSse(text: string): readonly OpencodeParseResult[] {
  const results: OpencodeParseResult[] = []
  for (const line of text.split("\n")) {
    const result = parseOpencodeSseLine(line)
    if (result !== null) results.push(result)
  }
  return results
}

/** Decodes a whole capture, keeping failures in place. */
export function parseOpencodeLines(text: string): readonly OpencodeParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseOpencodeLine)
}
