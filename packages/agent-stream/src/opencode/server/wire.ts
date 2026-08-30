/** @responsibility Describes the `opencode serve` SSE envelope and decodes one frame into it without interpreting it. */

import type { WireProvenance } from "../../events"
import { parseJsonLine } from "../../json"
import type { OpencodeParseResult, OpencodeRawLine } from "../run/wire"

/**
 * The build this envelope was read from.
 *
 * Two versions apply here, not one: the CLI that shipped the server, and the
 * API the server itself declares at `GET /doc`. They move independently — the
 * CLI is on its 1.18.x line while the API still calls itself 1.0.0 — so a
 * consumer checking whether its parser matches the server it is talking to has
 * to compare the one it can actually read.
 */
export const OPENCODE_SERVER_PROVENANCE: WireProvenance & { readonly apiVersion: string } = Object.freeze({
  cli: "opencode",
  version: "1.18.25",
  /** `info.version` from the server's own OpenAPI document. */
  apiVersion: "1.0.0",
  command: "opencode serve  →  GET /event",
  capturedOn: "2026-08-29",
})

/**
 * The event names the headless server publishes on its SSE stream.
 *
 * A second wire for the same agent, and a much richer one. `opencode serve`
 * (and `opencode acp`, which speaks the same bus) streams token deltas, names
 * the model, reports its permission rules, and asks before running what those
 * rules cover — none of which the one-way stream does. A consumer should be
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
  /** The todo list, republished whole — the bus's own plan event. */
  TodoUpdated: "todo.updated",
  /** A file the agent changed, and the watcher noticing one that changed under it. */
  FileEdited: "file.edited",
  FileWatcherUpdated: "file.watcher.updated",
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
 * Whether a line came from the server's bus rather than from the one-way stream.
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
  const result = parseJsonLine(body)
  // The same decoded shape the one-way stream produces: an object with a
  // string `type`, and nothing else verified.
  return result.ok ? { ok: true, line: result.line as OpencodeRawLine } : result
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
