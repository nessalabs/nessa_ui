"use client"

/** @responsibility Shares a SwipeRowGroup's single-open-row store, trace sink, and announcer with the SwipeRows inside it. Private to swipe-row and the Nessa components built on it; nothing here is exported from the package root. */

import * as React from "react"

/** One flat trace entry; see `SwipeRowGroup`'s `debug`. */
export type SwipeRowTraceEntry = Record<string, string | number | boolean | null>

/** The trace sink: `null` unless the group is in `debug`. */
export type Trace = ((entry: SwipeRowTraceEntry) => void) | null

/** What a registered row lends its group: its elements, read when needed. */
export interface RowHandle {
  row: () => HTMLElement | null
  content: () => HTMLElement | null
}

/**
 * Which single row of a group is open, and which rows have actions at all.
 * Rows subscribe to their own `open` bit, so opening one row re-renders that
 * row and the one it closes — never every row in the list.
 */
export interface SwipeRowStore {
  subscribe: (listener: () => void) => () => void
  openId: () => string | null
  /** Whether any row in the group has actions; the group adds nothing until one does. */
  active: () => boolean
  /** Makes one row the open row, or frees the slot if that row held it. */
  setOpen: (value: string, open: boolean) => void
  /** Closes whichever row is open. */
  close: () => void
  register: (value: string, handle: RowHandle) => () => void
  rows: () => ReadonlyMap<string, RowHandle>
}

export interface SwipeRowGroupContextValue {
  store: SwipeRowStore
  trace: Trace
  reducedMotion: boolean
  /** Speaks a short status through the group's live region; "" clears it. */
  announce: (message: string) => void
}

export const SwipeRowGroupContext = React.createContext<SwipeRowGroupContextValue | null>(
  null,
)

/**
 * The trace sink of the enclosing `SwipeRowGroup`, for a Nessa component
 * built on it to record its own events beside the rows' — `null` unless the
 * group is in `debug`, or outside any group.
 *
 * @internal Not part of the public API: it is not exported from the package
 * root and may change without notice.
 */
export function useSwipeRowTrace(): Trace {
  return React.useContext(SwipeRowGroupContext)?.trace ?? null
}
