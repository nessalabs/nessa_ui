"use client"

/** @responsibility Coordinates pane registration, presentation mode, selection, and dismissal between a WindowDeck and its panes. */

import * as React from "react"

import type { WindowDeckTile } from "./window-deck-layout"

/** How the deck presents its panes. */
export type WindowDeckMode = "carousel" | "overview"

/** The edge a pane is thrown towards to dismiss it. */
export type WindowDeckDismissDirection = "up" | "down" | "left" | "right"

/** Why a pane was dismissed, and how far and fast it was thrown. */
export interface WindowDeckDismissal {
  /** The pane that left. */
  paneId: string
  /** The edge it was thrown towards. A shortcut reports the first direction the pane allows. */
  direction: WindowDeckDismissDirection
  /** Whether the user threw it or used the keyboard. */
  reason: "gesture" | "shortcut"
  /** How far it travelled before release, in pixels. Zero for a shortcut. */
  distance: number
  /** Its speed at release, in pixels per millisecond. Zero for a shortcut. */
  velocity: number
}

/** A pane registered with its owning deck. */
export interface RegisteredWindowDeckPane {
  /** The pane's unique id within the deck. */
  id: string
  /** The pane's rendered element, used for ordering and measurement. */
  element: HTMLElement
}

/** Shared state and handlers provided by one WindowDeck. */
export interface WindowDeckContextValue {
  /** How the deck currently presents its panes. */
  mode: WindowDeckMode
  /** The pane the carousel is centred on. */
  activePaneId: string | undefined
  /** The pane leaving the overview returns to, when nothing else is chosen. */
  restorePaneId: string | undefined
  /** Pane ids in visual order. */
  paneIds: readonly string[]
  /**
   * Whether the deck is mid-return from the overview. Panes stay
   * non-interactive across the settle so a stray click cannot land on a
   * surface that is still moving.
   */
  settling: boolean
  /** The overview transform for one pane, while the overview is open. */
  tileFor: (paneId: string) => WindowDeckTile | undefined
  /** Registers a pane; returns its disposer. */
  registerPane: (pane: RegisteredWindowDeckPane) => () => void
  /**
   * Opens one pane: centres it in the carousel, or returns the deck from the
   * overview to it.
   */
  selectPane: (paneId: string) => void
  /**
   * The pane the deck has asked to leave, from the keyboard, and a nonce
   * that makes each request distinct. The pane plays its own exit, so a
   * thrown pane and a dismissed one move identically.
   */
  dismissRequest: { paneId: string; nonce: number } | undefined
  /**
   * Told by a pane once it has finished playing a dismissal, and again if it
   * is still mounted afterwards — which is how the deck learns that the host
   * declined the removal and that there is nothing to announce or refocus.
   */
  reportDismissal: (paneId: string, outcome: "left" | "retained") => void
}

const WindowDeckContext = React.createContext<WindowDeckContextValue | null>(
  null,
)

/**
 * Reads the state of the nearest WindowDeck: which pane is focused, whether
 * the deck is a carousel or an overview, and how to open a pane. Content
 * inside a pane uses it to adapt to being a tile — a photograph dropping to
 * a thumbnail, a card hiding its call to action.
 *
 * @returns The current WindowDeck context value.
 * @throws When called outside a WindowDeck.
 */
function useWindowDeck(): WindowDeckContextValue {
  const context = React.useContext(WindowDeckContext)

  if (!context) {
    throw new Error("useWindowDeck must be used within a WindowDeck.")
  }

  return context
}

/**
 * Builds one ref callback that feeds an element to our internal ref and to a
 * ref the consumer may have passed, so neither side loses it.
 *
 * @param internal - The component's own element ref.
 * @param forwarded - The consumer's ref, if any.
 * @returns A ref callback serving both.
 */
function composeRefs<Element>(
  internal: React.RefObject<Element | null>,
  forwarded: React.Ref<Element> | undefined,
): React.RefCallback<Element> {
  return (element) => {
    internal.current = element

    if (typeof forwarded === "function") {
      forwarded(element)
    } else if (forwarded) {
      forwarded.current = element
    }
  }
}

/**
 * Orders registered panes by their position in the document, so pane order
 * always matches what the user sees regardless of mount order.
 *
 * @param panes - The registered panes to order.
 * @returns The panes sorted in document order.
 */
function sortByDocumentPosition(
  panes: readonly RegisteredWindowDeckPane[],
): RegisteredWindowDeckPane[] {
  return [...panes].sort((a, b) => {
    const position = a.element.compareDocumentPosition(b.element)

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
  })
}

export {
  WindowDeckContext,
  composeRefs,
  sortByDocumentPosition,
  useWindowDeck,
}
