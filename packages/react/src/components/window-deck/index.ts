"use client"

/** @responsibility Re-exports the public surface of the WindowDeck component system. */

export {
  WindowDeck,
  windowDeckDefaultLabels,
  type WindowDeckLabels,
  type WindowDeckProps,
} from "./window-deck"
export { WindowDeckPane, type WindowDeckPaneProps } from "./window-deck-pane"
export {
  useWindowDeck,
  type WindowDeckContentMount,
  type WindowDeckContextValue,
  type WindowDeckDismissDirection,
  type WindowDeckDismissal,
  type WindowDeckMode,
} from "./window-deck-context"
export {
  computeOverviewColumns,
  computeOverviewLayout,
  computeOverviewTiles,
  computeOverviewVisibleCount,
  type WindowDeckOverviewInsets,
  type WindowDeckOverviewLayout,
  type WindowDeckOverviewOptions,
  type WindowDeckRect,
  type WindowDeckTile,
  type WindowDeckViewport,
} from "./window-deck-layout"
export {
  DEFAULT_WINDOW_DECK_SHORTCUTS,
  matchesWindowDeckShortcut,
  resolveWindowDeckShortcuts,
  type WindowDeckKeyboardShortcut,
  type WindowDeckShortcutAction,
  type WindowDeckShortcutModifier,
  type WindowDeckShortcuts,
} from "./window-deck-shortcuts"
