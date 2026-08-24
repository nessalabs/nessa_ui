"use client"

/** @responsibility Coordinates the kanban board's shared state: the in-flight drag with targeted subscriptions, column and card registration, and the actions columns and cards use to talk to their board. */

import * as React from "react"

/** Where an in-flight drag would currently drop. */
interface KanbanDropTarget {
  /** The column the card would land in. */
  columnId: string
  /** The insertion index, counted with the dragged card removed. */
  index: number
  /** The opened slot's top, in the column list's content coordinates. */
  gapTop: number
  /** The opened slot's height: the moved card plus the column's spacing. */
  gapHeight: number
  /** The column's measured gap between cards, in pixels. */
  spacing: number
  /** The cards that shift down to open the slot. */
  shiftedCardIds: ReadonlySet<string>
}

/** The in-flight state of one card being moved, by pointer or keyboard. */
interface KanbanDragState {
  /** The card being moved. */
  cardId: string
  /** The column the card started in. */
  fromColumn: string
  /** The card's index in its column when the move started. */
  fromIndex: number
  /** Whether a pointer drag or a keyboard lift is moving the card. */
  mode: "pointer" | "keyboard"
  /** How far the pointer has travelled, in client pixels (pointer mode). */
  deltaX: number
  deltaY: number
  /**
   * Where the card sat when the drag began, in client pixels — the anchor
   * the floating card is positioned from (pointer mode).
   */
  origin: { left: number; top: number; width: number; height: number }
  /**
   * The fixed-position containing block's viewport offset (zero in a
   * plain document). Rendering subtracts it; hit-testing, which works in
   * viewport coordinates, uses `origin` as-is.
   */
  fixedOffset: { x: number; y: number }
  /** Where the card would drop right now, or null over no column. */
  over: KanbanDropTarget | null
}

/**
 * A single-value subscription store for the in-flight drag, so only the
 * dragged card and the hovered column's indicator re-render while it moves.
 */
interface KanbanDragStore {
  /** Reads the drag state; stable by reference until it changes. */
  get: () => KanbanDragState | null
  /** Replaces the drag state. */
  set: (state: KanbanDragState | null) => void
  /** Subscribes to drag-state changes; returns the disposer. */
  subscribe: (listener: () => void) => () => void
}

/**
 * Builds the drag store backing one board.
 *
 * @returns A fresh store with no drag in flight.
 */
function createKanbanDragStore(): KanbanDragStore {
  let state: KanbanDragState | null = null
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set: (next) => {
      if (next === state) {
        return
      }

      state = next

      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Where an in-flight column drag would currently drop. */
interface KanbanColumnDropTarget {
  /** The column's destination index among its siblings. */
  index: number
  /** The opened slot's left edge, in the board's own coordinates. */
  gapLeft: number
  /** The opened slot's width: the moved column plus the board's spacing. */
  gapWidth: number
  /** The board's measured gap between columns, in pixels. */
  spacing: number
  /** How far, and which way, the parted columns slide. */
  shift: number
  /** The columns that shift to open the slot. */
  shiftedColumnIds: ReadonlySet<string>
}

/** The in-flight state of one column being moved. */
interface KanbanColumnDragState {
  /** The column being moved. */
  columnId: string
  /** The column's index when the move started. */
  fromIndex: number
  /** Whether a pointer drag or a keyboard lift is moving the column. */
  mode: "pointer" | "keyboard"
  /** How far the pointer has travelled, in client pixels (pointer mode). */
  deltaX: number
  /**
   * Vertical travel of the float. Always 0 when the board rails column
   * drags to the row; the destination is decided by X alone either way.
   */
  deltaY: number
  /** Where the column sat when the drag began, in client pixels. */
  origin: { left: number; top: number; width: number; height: number }
  /** The fixed-position containing block's viewport offset. */
  fixedOffset: { x: number; y: number }
  /** Where the column would drop right now. */
  over: KanbanColumnDropTarget | null
}

/** A settled column move reported to the board consumer. */
interface KanbanColumnMove {
  /** The column that moved. */
  columnId: string
  /**
   * The column's destination position, counted with the moved column
   * already removed from its original position.
   */
  index: number
}

/** A single-value subscription store for the in-flight column drag. */
interface KanbanColumnDragStore {
  get: () => KanbanColumnDragState | null
  set: (state: KanbanColumnDragState | null) => void
  subscribe: (listener: () => void) => () => void
}

/**
 * Builds the column-drag store backing one board.
 *
 * @returns A fresh store with no column drag in flight.
 */
function createKanbanColumnDragStore(): KanbanColumnDragStore {
  let state: KanbanColumnDragState | null = null
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set: (next) => {
      if (next === state) {
        return
      }

      state = next

      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Shared state and actions provided by one KanbanBoard. */
interface KanbanContextValue {
  /**
   * Whether the board is a read-only view: nothing can be picked up, by
   * pointer or keyboard, and no move is ever reported.
   */
  readOnly: boolean
  /** The in-flight card drag. */
  drag: KanbanDragStore
  /** The in-flight column drag. */
  columnDrag: KanbanColumnDragStore
  /** Registers a column's outer element; returns the disposer. */
  registerColumnRoot: (columnId: string, element: HTMLElement) => () => void
  /** Starts a pointer drag of a whole column. */
  beginColumnDrag: (
    columnId: string,
    clientX: number,
    origin: { left: number; top: number; width: number; height: number },
  ) => boolean
  /** Continues the column drag this column owns. */
  moveColumnDrag: (
    columnId: string,
    startClientX: number,
    startClientY: number,
    clientX: number,
    clientY: number,
  ) => void
  /** Settles the column drag this column owns. */
  endColumnDrag: (columnId: string) => void
  /** Lifts a column for keyboard movement. */
  liftColumn: (columnId: string) => void
  /** Moves a keyboard-lifted column one step. */
  moveColumnLift: (direction: "left" | "right") => void
  /** Drops a keyboard-lifted column at its current target. */
  dropColumnLift: () => void
  /** Abandons the in-flight column drag or lift. */
  cancelColumnDrag: () => void
  /**
   * Registers a column's card-list element and whether it accepts drops;
   * returns the disposer.
   */
  registerColumn: (
    columnId: string,
    element: HTMLElement,
    accepts: boolean,
  ) => () => void
  /** Registers a card element in a column; returns the disposer. */
  registerCard: (
    cardId: string,
    columnId: string,
    element: HTMLElement,
  ) => () => void
  /**
   * Starts a pointer drag once the pointer commits to moving. Returns
   * false — and starts nothing — while another gesture already owns the
   * board, so a second pointer can disarm itself.
   */
  beginPointerDrag: (
    cardId: string,
    columnId: string,
    clientX: number,
    clientY: number,
    origin: { left: number; top: number; width: number; height: number },
  ) => boolean
  /** Continues the pointer drag this card owns at a client point. */
  movePointerDrag: (
    cardId: string,
    startClientX: number,
    startClientY: number,
    clientX: number,
    clientY: number,
  ) => void
  /**
   * Settles the pointer drag this card owns: commits over a column,
   * cancels elsewhere.
   */
  endPointerDrag: (cardId: string) => void
  /** Lifts a card for keyboard movement. */
  liftCard: (cardId: string, columnId: string) => void
  /** Moves a keyboard-lifted card one step. */
  moveLift: (direction: "up" | "down" | "left" | "right") => void
  /** Drops a keyboard-lifted card at its current target. */
  dropLift: () => void
  /** Abandons the in-flight drag or lift. */
  cancelDrag: () => void
}

const KanbanContext = React.createContext<KanbanContextValue | null>(null)

/** The column a card or list part belongs to. */
interface KanbanColumnContextValue {
  /** The owning column's id. */
  columnId: string
}

const KanbanColumnContext =
  React.createContext<KanbanColumnContextValue | null>(null)

/**
 * Reads the coordination state of the nearest KanbanBoard.
 *
 * @param consumer - The component name reported when used outside a board.
 * @returns The current board context value.
 * @throws When called outside a KanbanBoard.
 */
function useKanban(consumer: string): KanbanContextValue {
  const context = React.useContext(KanbanContext)

  if (context === null) {
    throw new Error(`${consumer} must be used within a KanbanBoard.`)
  }

  return context
}

/**
 * Subscribes to the in-flight card drag, re-rendering the caller only
 * while a drag is active.
 *
 * @returns The drag state, or null when no card is being moved.
 */
function useKanbanDragState(): KanbanDragState | null {
  const { drag } = useKanban("useKanbanDragState")

  return React.useSyncExternalStore(drag.subscribe, drag.get, () => null)
}

/**
 * Subscribes to the in-flight column drag, re-rendering the caller only
 * while a column is being moved.
 *
 * @returns The column drag state, or null when no column is being moved.
 */
function useKanbanColumnDragState(): KanbanColumnDragState | null {
  const { columnDrag } = useKanban("useKanbanColumnDragState")

  return React.useSyncExternalStore(
    columnDrag.subscribe,
    columnDrag.get,
    () => null,
  )
}

/**
 * Finds the offset of the coordinate space `position: fixed` will actually
 * use for an element. An ancestor with a transform, filter, perspective,
 * or paint containment becomes the fixed-position containing block, so
 * viewport coordinates must be shifted by its origin or the float lands
 * in the wrong place. (A scaling ancestor also scales the space — that
 * remains a documented limitation, as it is for every fixed-overlay drag.)
 *
 * @param element - The element about to become fixed.
 * @returns The containing block's viewport offset, or zero when the
 * viewport itself is the containing block.
 */
function kanbanFixedOffset(element: HTMLElement): { x: number; y: number } {
  let ancestor = element.parentElement

  while (ancestor) {
    const style = getComputedStyle(ancestor)

    // The individual transform properties (translate/rotate/scale) and
    // layout containment establish fixed-position containing blocks while
    // leaving computed `transform`/`contain` untouched — Tailwind v4's
    // translate-*/rotate-*/scale-* utilities emit exactly these longhands,
    // so they are as reachable as `transform` itself.
    const longhandTransform = (value: string | undefined) =>
      value !== undefined && value !== "" && value !== "none"

    if (
      style.transform !== "none" ||
      longhandTransform(style.translate) ||
      longhandTransform(style.rotate) ||
      longhandTransform(style.scale) ||
      style.filter !== "none" ||
      style.backdropFilter !== "none" ||
      style.perspective !== "none" ||
      style.willChange.includes("transform") ||
      style.willChange.includes("translate") ||
      style.willChange.includes("rotate") ||
      style.willChange.includes("scale") ||
      style.willChange.includes("filter") ||
      style.willChange.includes("perspective") ||
      /layout|paint|content|strict/.test(style.contain) ||
      (style.contentVisibility !== undefined &&
        style.contentVisibility !== "" &&
        style.contentVisibility !== "visible")
    ) {
      const rect = ancestor.getBoundingClientRect()

      return {
        x: rect.left + ancestor.clientLeft,
        y: rect.top + ancestor.clientTop,
      }
    }

    ancestor = ancestor.parentElement
  }

  return { x: 0, y: 0 }
}

/**
 * Builds one ref callback that feeds an element to our internal ref and to
 * a ref the consumer may have passed, so neither side loses it.
 *
 * @param internal - The component's own element ref.
 * @param forwarded - The consumer's ref, if any.
 * @returns A ref callback serving both.
 */
function composeKanbanRefs<Element>(
  internal: React.RefObject<Element | null>,
  forwarded: React.Ref<Element> | undefined,
): React.RefCallback<Element> {
  return (element) => {
    internal.current = element

    if (typeof forwarded === "function") {
      const cleanup = forwarded(element)

      // A consumer ref returning a cleanup (React 19) never receives a
      // null call, so the composed ref honours the same contract.
      if (typeof cleanup === "function") {
        return () => {
          internal.current = null
          cleanup()
        }
      }
    } else if (forwarded) {
      forwarded.current = element
    }
  }
}

export {
  KanbanColumnContext,
  KanbanContext,
  composeKanbanRefs,
  createKanbanColumnDragStore,
  createKanbanDragStore,
  kanbanFixedOffset,
  useKanban,
  useKanbanColumnDragState,
  useKanbanDragState,
  type KanbanColumnContextValue,
  type KanbanColumnDragState,
  type KanbanColumnDragStore,
  type KanbanColumnDropTarget,
  type KanbanColumnMove,
  type KanbanContextValue,
  type KanbanDragState,
  type KanbanDragStore,
  type KanbanDropTarget,
}
