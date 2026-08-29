/** @responsibility The shape both of opencode's mapping tables are written in. */

import type { AgentEventType } from "../events"

/** A line's kind at the granularity a mapping turns on. */
export type OpencodeWireKind = string

/**
 * One row of a provider-to-contract table.
 *
 * opencode has two of these — one per transport — because it has two wires.
 * They share this shape and the [`AgentEventType`] values they point at, which
 * is what makes "swap the transport, keep the components" checkable rather
 * than aspirational.
 */
export interface OpencodeMappingEntry {
  /** The normalized events this kind can produce. Empty means it deliberately produces nothing. */
  readonly emits: readonly AgentEventType[]
  /** Why, in one line. For an empty `emits` this is the whole justification. */
  readonly note: string
}
