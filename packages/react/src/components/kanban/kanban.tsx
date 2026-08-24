"use client"

/** @responsibility Renders the kanban board container and orchestrates card movement: drop-target resolution, pointer and keyboard moves, commit and cancel, focus restoration, and screen-reader announcements. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  KanbanContext,
  composeKanbanRefs,
  createKanbanColumnDragStore,
  createKanbanDragStore,
  kanbanFixedOffset,
  type KanbanColumnMove,
  type KanbanContextValue,
  type KanbanDragState,
  type KanbanDropTarget,
} from "./kanban-context"
import {
  clampKanbanNumber,
  kanbanGapTop,
  kanbanInsertionIndex,
  type KanbanMove,
} from "./kanban-math"

/** One board event a screen-reader announcement describes. */
interface KanbanAnnouncement {
  /** The moment being announced. */
  type: "lift" | "move" | "drop" | "cancel"
  /**
   * What is being moved.
   * @defaultValue "card"
   */
  kind?: "card" | "column"
  /** The moved card's — or column's — accessible label. */
  cardLabel: string
  /** The target column's accessible label. */
  columnLabel: string
  /** The card's 1-based position in the target column. */
  position: number
  /** How many positions the target column offers. */
  count: number
}

/** Properties accepted by the kanban board. */
interface KanbanBoardProps extends React.ComponentProps<"div"> {
  /**
   * Called once per settled move — pointer drop or keyboard drop — with the
   * card, source column, target column, and insertion index (counted with
   * the card removed from its source position). Apply it to consumer state;
   * `applyKanbanMove` performs the standard column-map transform.
   */
  onCardMove?: (move: KanbanMove) => void
  /**
   * Called once per settled column move with the column and its
   * destination index, counted with the column already removed from its
   * original position. Columns become movable as soon as this is provided
   * and a `KanbanColumnHandle` is composed into the column.
   */
  onColumnMove?: (move: KanbanColumnMove) => void
  /**
   * Builds the screen-reader announcement for a board event. The default
   * describes lifts, moves, drops, and cancels in English.
   */
  getAnnouncement?: (announcement: KanbanAnnouncement) => string
  /**
   * Whether the board only presents its cards: nothing can be picked up by
   * pointer or keyboard, and no move is reported. Useful for a viewer role
   * or while a save is in flight.
   */
  readOnly?: boolean
  /**
   * How a dragged column may travel. "free" — the default — lets the
   * column follow the pointer on both axes, while its destination is
   * still decided by horizontal position alone; "x" rails the float to
   * the row for a stricter feel.
   */
  columnDragAxis?: "free" | "x"
}

interface RegisteredKanbanColumn {
  columnId: string
  element: HTMLElement
  /** Whether this column accepts cards dropped into it. */
  accepts: boolean
}

interface RegisteredKanbanCard {
  cardId: string
  columnId: string
  element: HTMLElement
}

/** One column's laid-out card geometry, in its own content coordinates. */
interface KanbanColumnLayout {
  element: HTMLElement
  cards: readonly RegisteredKanbanCard[]
  extents: readonly { top: number; height: number }[]
  spacing: number
}

/**
 * Orders registered entries by their element's position in the document, so
 * computed indexes always match what the user sees.
 *
 * @param entries - The registered entries to order.
 * @returns The entries sorted in document order.
 */
function sortByDocumentPosition<Entry extends { element: HTMLElement }>(
  entries: readonly Entry[],
): Entry[] {
  return [...entries].sort((a, b) => {
    const position = a.element.compareDocumentPosition(b.element)

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
  })
}

/**
 * Builds the default English announcement for a board event.
 *
 * @param announcement - The event to describe.
 * @returns The announcement text.
 */
function defaultAnnouncement(announcement: KanbanAnnouncement): string {
  // A column moves among its siblings rather than into another column, so
  // its wording names a position instead of a destination column.
  const destination =
    announcement.kind === "column"
      ? `position ${announcement.position} of ${announcement.count}`
      : `${announcement.columnLabel}, position ${announcement.position} of ${announcement.count}`

  switch (announcement.type) {
    case "lift":
      return `Picked up ${announcement.cardLabel}. Use the arrow keys to move it, space to drop it, escape to cancel.`
    case "move":
      return `Move ${announcement.cardLabel} to ${destination}.`
    case "drop":
      return `Dropped ${announcement.cardLabel} ${announcement.kind === "column" ? "at" : "in"} ${destination}.`
    case "cancel":
      return `Movement cancelled. ${announcement.cardLabel} returned to its original position.`
  }
}

/**
 * A kanban board: columns of cards that move by pointer drag or keyboard.
 *
 * Compose `KanbanColumn` children, each with a `KanbanColumnList` holding
 * `KanbanCard` children. The board owns no card data — it reports every
 * settled move through `onCardMove` and the consumer renders the new order,
 * so any state shape works. Dragging shows a drop indicator in the hovered
 * column; a focused card lifts with Space or Enter, moves with the arrow
 * keys, drops with Space, and cancels with Escape, with every step
 * announced to screen readers.
 *
 * @param props - The move callback, an optional announcement builder, and
 * native container properties.
 * @returns The board container providing kanban context.
 */
function KanbanBoard({
  onCardMove,
  onColumnMove,
  getAnnouncement,
  readOnly = false,
  columnDragAxis = "free",
  className,
  children,
  ref,
  ...props
}: KanbanBoardProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const composedRef = React.useMemo(
    () => composeKanbanRefs(rootRef, ref),
    [ref],
  )
  const [drag] = React.useState(createKanbanDragStore)
  const [columnDrag] = React.useState(createKanbanColumnDragStore)
  const registrationsRef = React.useRef({
    columns: new Map<string, RegisteredKanbanColumn>(),
    columnRoots: new Map<string, RegisteredKanbanColumn>(),
    cards: new Map<string, RegisteredKanbanCard>(),
  })
  // Column layout is read once per gesture rather than on every pointer
  // step: the cards that part to open a slot move with transforms, which
  // leave the laid-out offsets this cache holds untouched.
  const measurementsRef = React.useRef(new Map<string, KanbanColumnLayout>())
  const pendingFocusRef = React.useRef<{
    cardId: string
    fromColumn: string
    fromIndex: number
    toColumn: string
    index: number
  } | null>(null)
  const pendingColumnFocusRef = React.useRef<{
    columnId: string
    index: number
  } | null>(null)
  const [announcement, setAnnouncement] = React.useState({
    text: "",
    nonce: 0,
  })
  // Bumped only when a card the focus-restoration pass is waiting for
  // registers, so that pass runs even when the consumer applies the move
  // in a commit that never re-renders the board itself.
  const [, setRestorationTick] = React.useState(0)

  const callbacksRef = React.useRef({
    onCardMove,
    onColumnMove,
    getAnnouncement,
  })
  callbacksRef.current = { onCardMove, onColumnMove, getAnnouncement }

  const columnDragAxisRef = React.useRef(columnDragAxis)
  columnDragAxisRef.current = columnDragAxis

  // After every render, focus returns to a card whose move just settled.
  // Cross-column moves remount the card (its registration focuses it);
  // same-column reorders keep the element and are handled here, since
  // moving a node with insertBefore can silently drop its focus.
  React.useLayoutEffect(() => {
    const pending = pendingFocusRef.current

    if (pending === null) {
      return
    }

    const card = registrationsRef.current.cards.get(pending.cardId)

    // The card left the board altogether — the consumer archived or
    // filtered it. The request can never be honoured, and leaving it armed
    // would steal focus whenever that id next appears.
    if (!card) {
      pendingFocusRef.current = null
      return
    }

    // Focus the user has since moved elsewhere is never reclaimed. A move
    // the consumer refuses (validation, a rolled-back optimistic apply)
    // never lands, so without this the request would stay armed for good
    // and snatch focus at some unrelated later render.
    const cardDocument = card.element.ownerDocument
    const active = cardDocument.activeElement

    if (
      active !== null &&
      active !== cardDocument.body &&
      !card.element.contains(active)
    ) {
      pendingFocusRef.current = null
      return
    }

    // The consumer may apply the move in a later commit than the one this
    // render belongs to, so the request waits for the card to arrive in
    // the column it was dropped into. A same-column reorder never changes
    // the column, so only the order reveals that the move has landed —
    // and any order other than the untouched one counts, because a
    // consumer that sorts its column normalizes the card to a position of
    // its own choosing. Focus follows the card there rather than waiting
    // forever for a coordinate that never comes.
    const landedIndex = orderedCardsIn(pending.toColumn).findIndex(
      (candidate) => candidate.cardId === pending.cardId,
    )

    if (
      !card.element.isConnected ||
      card.columnId !== pending.toColumn ||
      (pending.fromColumn === pending.toColumn &&
        landedIndex === pending.fromIndex &&
        landedIndex !== pending.index)
    ) {
      return
    }

    pendingFocusRef.current = null
    card.element.focus({ preventScroll: true })
  })

  const orderedColumns = React.useCallback(
    () =>
      sortByDocumentPosition([
        ...registrationsRef.current.columnRoots.values(),
      ]),
    [],
  )

  /** The gap the board keeps between its columns. */
  const boardSpacing = React.useCallback(
    () =>
      rootRef.current
        ? parseFloat(getComputedStyle(rootRef.current).columnGap) || 0
        : 0,
    [],
  )

  const orderedCardsIn = React.useCallback(
    (columnId: string, excludeCardId?: string) =>
      sortByDocumentPosition(
        [...registrationsRef.current.cards.values()].filter(
          (card) =>
            card.columnId === columnId && card.cardId !== excludeCardId,
        ),
      ),
    [],
  )

  const columnLabel = React.useCallback((columnId: string) => {
    const column = registrationsRef.current.columns.get(columnId)

    return (
      column?.element
        .closest('[data-slot="kanban-column"]')
        ?.getAttribute("aria-label") ?? columnId
    )
  }, [])

  const cardLabel = React.useCallback((cardId: string) => {
    const card = registrationsRef.current.cards.get(cardId)

    return card?.element.getAttribute("aria-label") ?? cardId
  }, [])

  const announce = React.useCallback((event: KanbanAnnouncement) => {
    // The nonce guarantees a DOM mutation even when the text repeats, so
    // the live region re-fires for identical consecutive outcomes.
    setAnnouncement((previous) => ({
      text: (callbacksRef.current.getAnnouncement ?? defaultAnnouncement)(
        event,
      ),
      nonce: previous.nonce + 1,
    }))
  }, [])

  /**
   * Measures a column in its own content coordinates, reading laid-out
   * offsets rather than rendered rectangles. The cards that open a slot
   * are moved with transforms, which rectangles would report and indexes
   * would then chase; offsets stay still, so the target never oscillates.
   */
  const measureColumn = React.useCallback(
    (columnId: string, excludeCardId: string): KanbanColumnLayout | null => {
      const cached = measurementsRef.current.get(columnId)

      if (cached) {
        return cached
      }

      const column = registrationsRef.current.columns.get(columnId)

      if (!column) {
        return null
      }

      const cards = orderedCardsIn(columnId, excludeCardId)
      const spacing = parseFloat(getComputedStyle(column.element).rowGap) || 0

      // At the instant a gesture begins, the moved card has not yet left
      // the flow — that render is still coming — so the cards below it sit
      // one slot lower than they are about to. Discounting the slot the
      // card still occupies makes this measurement identical to the
      // post-collapse one, so nothing computed from it jumps a frame later.
      const excluded = registrationsRef.current.cards.get(excludeCardId)
      const inFlow =
        excluded &&
        excluded.columnId === columnId &&
        getComputedStyle(excluded.element).position !== "fixed"
      const removalTop = inFlow ? excluded.element.offsetTop : Infinity
      const removalDelta = inFlow
        ? excluded.element.offsetHeight + spacing
        : 0

      const layout: KanbanColumnLayout = {
        element: column.element,
        cards,
        extents: cards.map((card) => {
          const top = card.element.offsetTop

          return {
            top: top > removalTop ? top - removalDelta : top,
            height: card.element.offsetHeight,
          }
        }),
        spacing,
      }

      measurementsRef.current.set(columnId, layout)

      return layout
    },
    [orderedCardsIn],
  )

  /** Drops cached column layouts so the next read measures the DOM again. */
  const invalidateMeasurements = React.useCallback(() => {
    measurementsRef.current.clear()
  }, [])

  // The dragged card leaves the flow when the gesture starts, which moves
  // every card below it; the layout captured a moment earlier is stale, so
  // it is dropped once the gesture has rendered.
  const draggingCardId = React.useSyncExternalStore(
    drag.subscribe,
    () => drag.get()?.cardId ?? null,
    () => null,
  )

  // A moved column leaves the flow while its siblings step aside with
  // transforms, which do not grow the board. Reserving the column's width
  // keeps the row exactly as wide as it will be once the column lands.
  const reservedColumnWidth = React.useSyncExternalStore(
    columnDrag.subscribe,
    () => columnDrag.get()?.over?.gapWidth ?? 0,
    () => 0,
  )

  // The slot a moved column will drop into, previewed the same way a
  // card's slot is. Packed into a string so the snapshot stays stable.
  const columnSlot = React.useSyncExternalStore(
    columnDrag.subscribe,
    () => {
      const over = columnDrag.get()?.over

      return over ? `${over.gapLeft}:${over.gapWidth}:${over.spacing}` : null
    },
    () => null,
  )
  const [slotLeft, slotWidth, slotSpacing] = columnSlot
    ? columnSlot.split(":").map(Number)
    : [null, null, null]

  React.useLayoutEffect(() => {
    invalidateMeasurements()
  }, [draggingCardId, invalidateMeasurements])

  /** Converts a client y into one column list's content coordinates. */
  const contentY = React.useCallback(
    (element: HTMLElement, clientY: number) =>
      clientY -
      element.getBoundingClientRect().top -
      element.clientTop +
      element.scrollTop,
    [],
  )

  /**
   * Resolves the drop target for a column and insertion index: where the
   * slot opens, how tall it is, and which cards move to make room.
   */
  const targetFor = React.useCallback(
    (
      columnId: string,
      index: number,
      excludeCardId: string,
      cardHeight: number,
    ): KanbanDropTarget | null => {
      const measured = measureColumn(columnId, excludeCardId)

      if (!measured) {
        return null
      }

      const { cards, extents, spacing } = measured
      const clamped = clampKanbanNumber(index, 0, extents.length)

      return {
        columnId,
        index: clamped,
        gapTop: kanbanGapTop(extents, clamped, 0, spacing),
        gapHeight: cardHeight + spacing,
        spacing,
        // Every card from the insertion point down slides away to open
        // the slot, so the space previews exactly where the card lands.
        shiftedCardIds: new Set(
          cards.slice(clamped).map((card) => card.cardId),
        ),
      }
    },
    [measureColumn],
  )

  /**
   * Resolves the drop target for a card being moved, measured from the
   * card's own centre rather than the pointer. Grabbing a card near its
   * edge would otherwise mean dragging it most of its own length past a
   * neighbour before the slot moved.
   */
  const targetUnderPointer = React.useCallback(
    (
      clientX: number,
      clientY: number,
      excludeCardId: string,
      cardHeight: number,
      fromColumn: string,
    ): KanbanDropTarget | null => {
      const board = rootRef.current
      const boardRect = board?.getBoundingClientRect()

      // Released away from the board altogether — the movement is
      // abandoned. Bounding both axes also stops a column's vertical
      // extent reaching to infinity: a card dragged far above or below
      // the board no longer resolves to whatever column shares its x.
      if (
        !boardRect ||
        clientX < boardRect.left ||
        clientX > boardRect.right ||
        clientY < boardRect.top ||
        clientY > boardRect.bottom
      ) {
        return null
      }

      // A closed column refuses arrivals but never its own card: the
      // source column stays a valid target for reordering and for
      // dropping back, exactly as settle() and the keyboard path allow.
      // A column only takes drops once its list has registered: without
      // one there is nothing to measure, and resolving to it would return
      // no target at all — a dead strip the nearest-column fallback below
      // never gets to cover.
      const eligible = orderedColumns().filter(({ columnId }) => {
        const registration = registrationsRef.current.columns.get(columnId)

        return (
          registration !== undefined &&
          (columnId === fromColumn || registration.accepts !== false)
        )
      })
      const column =
        eligible.find(({ element }) => {
          const rect = element.getBoundingClientRect()

          return clientX >= rect.left && clientX <= rect.right
        }) ??
        // The board's own gutters belong to no column root, as do the
        // strips beside the first and last column. Inside the board they
        // are not dead zones: the nearest column takes the drop, so a
        // gesture that crosses a gap never blinks out or cancels.
        eligible.reduce<{ column: (typeof eligible)[number]; gap: number } | null>(
          (nearest, candidate) => {
            const rect = candidate.element.getBoundingClientRect()
            const gap = Math.max(rect.left - clientX, clientX - rect.right, 0)

            return nearest === null || gap < nearest.gap
              ? { column: candidate, gap }
              : nearest
          },
          null,
        )?.column

      if (!column) {
        return null
      }

      const measured = measureColumn(column.columnId, excludeCardId)

      if (!measured) {
        return null
      }

      // The moved card has left the flow, so the cards after it have
      // already risen into its slot. Comparing its centre directly would
      // then flip the order on the first pixel of travel; discounting half
      // the slot it vacated restores the familiar rule — a card displaces
      // its neighbour once it has travelled half a card past it.
      return targetFor(
        column.columnId,
        kanbanInsertionIndex(
          measured.extents,
          contentY(measured.element, clientY) -
            (cardHeight + measured.spacing) / 2,
        ),
        excludeCardId,
        cardHeight,
      )
    },
    [contentY, measureColumn, orderedColumns, targetFor],
  )

  const settle = React.useCallback(
    (state: KanbanDragState) => {
      drag.set(null)

      // The origin index is re-read rather than trusted: cards arriving or
      // leaving mid-drag reshape the source column, and the index frozen
      // at pickup would then describe a list that no longer exists —
      // making a real move look like a return to origin. The dragged card
      // still sits in its original slot, so its present index is the
      // origin in removed-space too.
      const liveFromIndex = orderedCardsIn(state.fromColumn).findIndex(
        (card) => card.cardId === state.cardId,
      )
      const fromIndex = liveFromIndex === -1 ? state.fromIndex : liveFromIndex

      let over = state.over

      // Released over no column at all — or over a column that closed
      // while the gesture was in flight: the movement is abandoned.
      if (
        over &&
        over.columnId !== state.fromColumn &&
        registrationsRef.current.columns.get(over.columnId)?.accepts === false
      ) {
        over = null
      }

      if (!over) {
        announce({
          type: "cancel",
          cardLabel: cardLabel(state.cardId),
          columnLabel: columnLabel(state.fromColumn),
          position: fromIndex + 1,
          count: orderedCardsIn(state.fromColumn).length,
        })
        return
      }

      // Dropped deliberately back where it started: nothing to report to
      // the consumer, but the drop did happen and is announced as one.
      if (
        over.columnId === state.fromColumn &&
        over.index === fromIndex
      ) {
        announce({
          type: "drop",
          cardLabel: cardLabel(state.cardId),
          columnLabel: columnLabel(state.fromColumn),
          position: fromIndex + 1,
          count: orderedCardsIn(state.fromColumn).length,
        })
        return
      }

      // A keyboard mover always holds focus on the card, and a pointer
      // press focused it too — either way the move is about to remount the
      // focused node, so the drop would silently strand focus on the body
      // without a restoration request.
      const heldFocus =
        registrationsRef.current.cards
          .get(state.cardId)
          ?.element.contains(document.activeElement) === true

      if (state.mode === "keyboard" || heldFocus) {
        pendingFocusRef.current = {
          cardId: state.cardId,
          fromColumn: state.fromColumn,
          fromIndex,
          toColumn: over.columnId,
          index: over.index,
        }
      }
      announce({
        type: "drop",
        cardLabel: cardLabel(state.cardId),
        columnLabel: columnLabel(over.columnId),
        position: over.index + 1,
        count: orderedCardsIn(over.columnId, state.cardId).length + 1,
      })
      callbacksRef.current.onCardMove?.({
        cardId: state.cardId,
        fromColumn: state.fromColumn,
        toColumn: over.columnId,
        index: over.index,
      })
    },
    [announce, cardLabel, columnLabel, drag, orderedCardsIn],
  )

  /**
   * The logical-space mirror for the column axis: null on an LTR board;
   * on an RTL board, the constant that converts a physical left offset
   * into a distance from the row's inline start, so insertion indexes,
   * slot positions, and shifts all stay in document order.
   */
  const rowMirror = React.useCallback(() => {
    const board = rootRef.current

    if (!board || getComputedStyle(board).direction !== "rtl") {
      return null
    }

    return board.clientWidth
  }, [])

  /** The moved column's position among its siblings. */
  const columnIndexOf = React.useCallback(
    (columnId: string) =>
      orderedColumns().findIndex((column) => column.columnId === columnId),
    [orderedColumns],
  )

  // After every render, focus returns to the handle of a column whose
  // keyboard move just settled. React reorders keyed siblings by moving
  // the node with insertBefore, which silently blurs the focused handle
  // inside it — and a column is never remounted by a reorder, so only a
  // board-level pass can restore it.
  React.useLayoutEffect(() => {
    const pending = pendingColumnFocusRef.current

    if (pending === null) {
      return
    }

    const column = registrationsRef.current.columnRoots.get(pending.columnId)

    // The column left the board altogether; the request can never be
    // honoured, and leaving it armed would steal focus later.
    if (!column) {
      pendingColumnFocusRef.current = null
      return
    }

    // Focus the user has since moved elsewhere is never reclaimed. A move
    // the consumer refuses never lands, so without this the request would
    // stay armed for good and snatch focus at some unrelated later render.
    const columnDocument = column.element.ownerDocument
    const activeNearColumn = columnDocument.activeElement

    if (
      activeNearColumn !== null &&
      activeNearColumn !== columnDocument.body &&
      !column.element.contains(activeNearColumn)
    ) {
      pendingColumnFocusRef.current = null
      return
    }

    // The consumer may apply the move in a later commit; the request
    // waits until the column actually sits at its dropped position.
    if (
      !column.element.isConnected ||
      columnIndexOf(pending.columnId) !== pending.index
    ) {
      return
    }

    pendingColumnFocusRef.current = null
    column.element
      .querySelector<HTMLElement>('[data-slot="kanban-column-handle"]')
      ?.focus({ preventScroll: true })
  })

  /**
   * Resolves a column drop target: where the moved column lands, and which
   * of its siblings slide aside — and which way — to open the space.
   */
  const columnTargetAt = React.useCallback(
    (index: number, movingColumnId: string, movingWidth: number) => {
      const columns = orderedColumns()
      const others = columns.filter(
        (column) => column.columnId !== movingColumnId,
      )
      const clamped = clampKanbanNumber(Math.round(index), 0, others.length)

      if (!columns.some((column) => column.columnId === movingColumnId)) {
        return null
      }

      // The moved column has left the flow, so its siblings have already
      // closed the space it came from. Only the destination remains to be
      // opened: everything from the insertion point onward steps aside.
      const spacing = boardSpacing()
      const following = others[clamped]
      const preceding = others[clamped - 1]

      // At gesture start the moved column has not yet left the flow, so
      // its right-hand siblings sit one pitch further right than they are
      // about to; discounting its still-occupied slot keeps every value
      // in post-collapse space from the first frame.
      const moving = registrationsRef.current.columnRoots.get(movingColumnId)
      const inFlow =
        moving && getComputedStyle(moving.element).position !== "fixed"
      // Logical space: on an RTL board the physical offsets run against
      // document order, so every x mirrors into distance-from-inline-start
      // before any comparison.
      const mirror = rowMirror()
      const logicalLeft = (element: HTMLElement) =>
        mirror === null
          ? element.offsetLeft
          : mirror - (element.offsetLeft + element.offsetWidth)
      const removalLeft = inFlow ? logicalLeft(moving.element) : Infinity
      const removalDelta = inFlow ? movingWidth + spacing : 0
      const layoutLeft = (element: HTMLElement) =>
        logicalLeft(element) > removalLeft
          ? logicalLeft(element) - removalDelta
          : logicalLeft(element)

      return {
        index: clamped,
        // Siblings step toward the row's inline end, which is physically
        // leftward on an RTL board.
        shift: (mirror === null ? 1 : -1) * (movingWidth + spacing),
        // The slot begins where the first stepped-aside column sits now,
        // or after the last column when the move lands at the end.
        gapLeft: following
          ? layoutLeft(following.element)
          : preceding
            ? layoutLeft(preceding.element) + preceding.element.offsetWidth + spacing
            : 0,
        gapWidth: movingWidth + spacing,
        spacing,
        shiftedColumnIds: new Set(
          others.slice(clamped).map((column) => column.columnId),
        ),
      }
    },
    [boardSpacing, orderedColumns, rowMirror],
  )

  /**
   * Resolves the column drop target from the moved column's centre, so a
   * column swaps as soon as it passes a neighbour's midpoint rather than
   * having to travel its whole width.
   */
  const columnTargetUnder = React.useCallback(
    (clientX: number, movingColumnId: string, movingWidth: number) => {
      const board = rootRef.current

      if (!board) {
        return null
      }

      const others = orderedColumns().filter(
        (column) => column.columnId !== movingColumnId,
      )
      // Laid-out offsets, not rendered rectangles: the columns that step
      // aside do so with transforms, which a rectangle would report and
      // the threshold would then chase. At gesture start the moved column
      // still occupies its slot, so that slot is discounted to keep the
      // measurement in post-collapse space from the first frame.
      const moving = registrationsRef.current.columnRoots.get(movingColumnId)
      const inFlow =
        moving && getComputedStyle(moving.element).position !== "fixed"
      // Logical space: physical offsets mirror on an RTL board so the
      // insertion count is a document index in both directions.
      const mirror = rowMirror()
      const logicalLeft = (element: HTMLElement) =>
        mirror === null
          ? element.offsetLeft
          : mirror - (element.offsetLeft + element.offsetWidth)
      const removalLeft = inFlow ? logicalLeft(moving.element) : Infinity
      const removalDelta = inFlow ? movingWidth + boardSpacing() : 0
      const extents = others.map((column) => ({
        top:
          logicalLeft(column.element) > removalLeft
            ? logicalLeft(column.element) - removalDelta
            : logicalLeft(column.element),
        height: column.element.offsetWidth,
      }))
      const boardRect = board.getBoundingClientRect()
      const physicalX =
        clientX - boardRect.left - board.clientLeft + board.scrollLeft
      const logicalX = mirror === null ? physicalX : mirror - physicalX

      // The moved column has left the flow, so its siblings have closed
      // up into its slot; discounting half that slot keeps the threshold
      // where it feels right — half a column past a neighbour, either way.
      return columnTargetAt(
        kanbanInsertionIndex(
          extents,
          logicalX - (movingWidth + boardSpacing()) / 2,
        ),
        movingColumnId,
        movingWidth,
      )
    },
    [boardSpacing, columnTargetAt, orderedColumns, rowMirror],
  )

  const settleColumn = React.useCallback(
    (state: {
      columnId: string
      fromIndex: number
      mode: "pointer" | "keyboard"
      over: { index: number } | null
    }) => {
      const over = state.over

      columnDrag.set(null)

      if (!over) {
        announce({
          type: "cancel",
          kind: "column",
          cardLabel: columnLabel(state.columnId),
          columnLabel: columnLabel(state.columnId),
          position: state.fromIndex + 1,
          count: orderedColumns().length,
        })
        return
      }

      announce({
        type: "drop",
        kind: "column",
        cardLabel: columnLabel(state.columnId),
        columnLabel: columnLabel(state.columnId),
        position: over.index + 1,
        count: orderedColumns().length,
      })

      if (over.index !== state.fromIndex) {
        // The mover keeps their place: React's reorder moves the node
        // with insertBefore, which silently blurs the handle inside it, so
        // the board restores focus once the move has landed. A pointer
        // drag focused that handle itself at pickup, so it has just as
        // much to put back as a keyboard move.
        const heldFocus =
          registrationsRef.current.columnRoots
            .get(state.columnId)
            ?.element.contains(document.activeElement) === true

        if (state.mode === "keyboard" || heldFocus) {
          pendingColumnFocusRef.current = {
            columnId: state.columnId,
            index: over.index,
          }
        }

        callbacksRef.current.onColumnMove?.({
          columnId: state.columnId,
          index: over.index,
        })
      }
    },
    [announce, columnDrag, columnLabel, orderedColumns],
  )

  /**
   * Re-derives an in-flight column drag's target after the row's shape
   * changed. The stored index, slot position, and shifted set all describe
   * the row as it was; a sibling arriving or leaving invalidates every one
   * of them.
   *
   * @param changedColumnId - The column that just mounted or unmounted.
   */
  const refreshColumnTarget = React.useCallback(
    (changedColumnId: string) => {
      const state = columnDrag.get()

      if (!state || !state.over || state.columnId === changedColumnId) {
        return
      }

      // The moved column's own position among its (new) siblings is what
      // the stored index was counted against, so it re-anchors there.
      const over = columnTargetAt(
        state.over.index,
        state.columnId,
        state.origin.width,
      )

      columnDrag.set({ ...state, over })
    },
    [columnDrag, columnTargetAt],
  )

  const cancelColumnDrag = React.useCallback(() => {
    const state = columnDrag.get()

    if (!state) {
      return
    }

    columnDrag.set(null)
    announce({
      type: "cancel",
      kind: "column",
      cardLabel: columnLabel(state.columnId),
      columnLabel: columnLabel(state.columnId),
      position: state.fromIndex + 1,
      count: orderedColumns().length,
    })
  }, [announce, columnDrag, columnLabel, orderedColumns])

  const cancelDrag = React.useCallback(() => {
    const state = drag.get()

    if (!state) {
      return
    }

    drag.set(null)
    announce({
      type: "cancel",
      cardLabel: cardLabel(state.cardId),
      columnLabel: columnLabel(state.fromColumn),
      position: state.fromIndex + 1,
      count: orderedCardsIn(state.fromColumn).length,
    })
  }, [announce, cardLabel, columnLabel, drag, orderedCardsIn])

  // A board turning read-only abandons whatever gesture is in flight;
  // it must not keep converting moves it can no longer accept.
  React.useEffect(() => {
    if (readOnly) {
      cancelDrag()
      cancelColumnDrag()
    }
  }, [readOnly, cancelDrag, cancelColumnDrag])

  const contextValue = React.useMemo<KanbanContextValue>(
    () => ({
      drag,
      readOnly,
      columnDrag,
      registerColumn: (columnId, element, accepts) => {
        registrationsRef.current.columns.set(columnId, {
          columnId,
          element,
          accepts,
        })
        invalidateMeasurements()

        return () => {
          // A re-registration may already have replaced this entry; only
          // the registration that still owns it may tear it down.
          if (
            registrationsRef.current.columns.get(columnId)?.element !== element
          ) {
            return
          }

          registrationsRef.current.columns.delete(columnId)
          invalidateMeasurements()

          // A drag hovering this column has nowhere to drop any more; it
          // falls back to its origin slot rather than settling into a
          // column that no longer exists.
          const state = drag.get()

          if (state?.over?.columnId === columnId) {
            drag.set({
              ...state,
              over:
                columnId === state.fromColumn
                  ? null
                  : targetFor(
                      state.fromColumn,
                      state.fromIndex,
                      state.cardId,
                      state.origin.height,
                    ),
            })
          }
        }
      },
      registerColumnRoot: (columnId, element) => {
        registrationsRef.current.columnRoots.set(columnId, {
          columnId,
          element,
          accepts: true,
        })
        refreshColumnTarget(columnId)

        return () => {
          const current = registrationsRef.current.columnRoots.get(columnId)

          if (current?.element !== element) {
            return
          }

          // A column drag can't finish once its column is gone; leaving it
          // in flight would refuse every later column gesture.
          if (columnDrag.get()?.columnId === columnId) {
            cancelColumnDrag()
          }

          registrationsRef.current.columnRoots.delete(columnId)
          refreshColumnTarget(columnId)
        }
      },
      registerCard: (cardId, columnId, element) => {
        registrationsRef.current.cards.set(cardId, {
          cardId,
          columnId,
          element,
        })
        invalidateMeasurements()

        // A cross-column move remounts the card here; if the board is not
        // re-rendering for it, nothing else would run the restoration
        // pass that puts focus back.
        if (pendingFocusRef.current?.cardId === cardId) {
          setRestorationTick((tick) => tick + 1)
        }

        // A card arriving mid-gesture reshapes the hovered column; the
        // stored target (index, slot position, parted cards) describes a
        // layout that no longer exists, so it re-derives against the
        // fresh one.
        const inFlight = drag.get()

        if (inFlight?.over && inFlight.cardId !== cardId) {
          drag.set({
            ...inFlight,
            over: targetFor(
              inFlight.over.columnId,
              inFlight.over.index,
              inFlight.cardId,
              inFlight.origin.height,
            ),
          })
        }

        return () => {
          const current = registrationsRef.current.cards.get(cardId)

          if (current?.element !== element) {
            // A card that re-registered under a new column must not be
            // disturbed by its old registration's cleanup.
            return
          }

          // A drag can't finish once its card is gone; the cancellation is
          // announced (with labels read before the registration goes) so
          // the movement never just evaporates.
          const state = drag.get()

          if (state && state.cardId === cardId) {
            const event = {
              type: "cancel",
              cardLabel: cardLabel(cardId),
              columnLabel: columnLabel(state.fromColumn),
              position: state.fromIndex + 1,
              count: orderedCardsIn(state.fromColumn).length,
            } as const

            drag.set(null)
            announce(event)
          }

          registrationsRef.current.cards.delete(cardId)
          invalidateMeasurements()

          // A departing sibling reshapes the hovered column the same way
          // an arriving one does; the in-flight target re-derives.
          const remaining = drag.get()

          if (remaining?.over && remaining.cardId !== cardId) {
            drag.set({
              ...remaining,
              over: targetFor(
                remaining.over.columnId,
                remaining.over.index,
                remaining.cardId,
                remaining.origin.height,
              ),
            })
          }
        }
      },
      beginPointerDrag: (cardId, columnId, clientX, clientY, origin) => {
        // One gesture owns the board at a time: a second pointer, a
        // pointer racing a keyboard lift, or a card racing a column move
        // is refused, never a hijack.
        if (readOnly || drag.get() !== null || columnDrag.get() !== null) {
          return false
        }

        pendingFocusRef.current = null
        pendingColumnFocusRef.current = null

        const fromIndex = orderedCardsIn(columnId).findIndex(
          (card) => card.cardId === cardId,
        )

        drag.set({
          cardId,
          fromColumn: columnId,
          fromIndex: Math.max(fromIndex, 0),
          mode: "pointer",
          deltaX: 0,
          deltaY: 0,
          origin,
          fixedOffset: (() => {
            const element = registrationsRef.current.cards.get(cardId)?.element

            return element ? kanbanFixedOffset(element) : { x: 0, y: 0 }
          })(),
          over: targetUnderPointer(
            origin.left + origin.width / 2,
            origin.top + origin.height / 2,
            cardId,
            origin.height,
            columnId,
          ),
        })

        return true
      },
      movePointerDrag: (cardId, startClientX, startClientY, clientX, clientY) => {
        const state = drag.get()

        if (!state || state.mode !== "pointer" || state.cardId !== cardId) {
          return
        }

        const deltaX = clientX - startClientX
        const deltaY = clientY - startClientY

        drag.set({
          ...state,
          deltaX,
          deltaY,
          over: targetUnderPointer(
            state.origin.left + deltaX + state.origin.width / 2,
            state.origin.top + deltaY + state.origin.height / 2,
            state.cardId,
            state.origin.height,
            state.fromColumn,
          ),
        })
      },
      endPointerDrag: (cardId) => {
        const state = drag.get()

        if (state && state.mode === "pointer" && state.cardId === cardId) {
          settle(state)
        }
      },
      liftCard: (cardId, columnId) => {
        if (readOnly || drag.get() !== null || columnDrag.get() !== null) {
          return
        }

        // A new gesture supersedes any focus restoration still waiting on
        // a consumer commit that may never come.
        pendingFocusRef.current = null
        pendingColumnFocusRef.current = null

        const fromIndex = orderedCardsIn(columnId).findIndex(
          (card) => card.cardId === cardId,
        )
        const index = Math.max(fromIndex, 0)
        const element = registrationsRef.current.cards.get(cardId)?.element
        const rect = element?.getBoundingClientRect()
        const origin = {
          left: rect?.left ?? 0,
          top: rect?.top ?? 0,
          width: element?.offsetWidth ?? 0,
          height: element?.offsetHeight ?? 0,
        }
        const liftOffset = element
          ? kanbanFixedOffset(element)
          : { x: 0, y: 0 }

        drag.set({
          cardId,
          fromColumn: columnId,
          fromIndex: index,
          mode: "keyboard",
          deltaX: 0,
          deltaY: 0,
          origin,
          fixedOffset: liftOffset,
          over: targetFor(columnId, index, cardId, origin.height),
        })
        announce({
          type: "lift",
          cardLabel: cardLabel(cardId),
          columnLabel: columnLabel(columnId),
          position: index + 1,
          count: orderedCardsIn(columnId).length,
        })
      },
      moveLift: (direction) => {
        const state = drag.get()

        if (!state || state.mode !== "keyboard") {
          return
        }

        // An orphaned hover (its column unmounted) re-anchors at the
        // origin slot so the keyboard lift never dead-ends.
        const anchor =
          state.over ??
          targetFor(
            state.fromColumn,
            state.fromIndex,
            state.cardId,
            state.origin.height,
          )

        if (!anchor) {
          return
        }

        let { columnId, index } = anchor

        if (direction === "up" || direction === "down") {
          index += direction === "up" ? -1 : 1
        } else {
          const columns = orderedColumns()
          // Arrow keys move visually; on an RTL board visual left is the
          // next document position, not the previous one.
          const step =
            (direction === "left" ? -1 : 1) * (rowMirror() === null ? 1 : -1)
          let position =
            columns.findIndex((column) => column.columnId === columnId) + step

          // Closed columns are walked past, exactly as the pointer path
          // skips them — the keyboard reaches the next open column or
          // stays put when none remains in that direction. The card's own
          // column is never skipped: a closed column refuses arrivals but
          // always takes its own card back, as the pointer path and
          // settle() both allow.
          while (columns[position]) {
            const candidate = columns[position].columnId
            const registration = registrationsRef.current.columns.get(candidate)
            // A column with no registered list can never be measured, so
            // the walk passes over it rather than dead-ending there —
            // exactly as the pointer path refuses it as a drop target.
            const skip =
              registration === undefined ||
              (candidate !== state.fromColumn && registration.accepts === false)

            if (!skip) {
              break
            }

            position += step
          }

          if (!columns[position]) {
            return
          }

          columnId = columns[position].columnId
        }

        const over = targetFor(
          columnId,
          index,
          state.cardId,
          state.origin.height,
        )

        // A step past the first or last slot clamps back to where the
        // lift already sits: nothing moved, so nothing is announced. The
        // horizontal walk and the column path both stop the same way —
        // without this, holding an arrow at a column's end floods the
        // live region with a move that never happens.
        if (
          !over ||
          (over.columnId === anchor.columnId && over.index === anchor.index)
        ) {
          return
        }

        drag.set({ ...state, over })
        announce({
          type: "move",
          cardLabel: cardLabel(state.cardId),
          columnLabel: columnLabel(over.columnId),
          position: over.index + 1,
          count: orderedCardsIn(over.columnId, state.cardId).length + 1,
        })
      },
      dropLift: () => {
        const state = drag.get()

        if (state && state.mode === "keyboard") {
          settle(state)
        }
      },
      beginColumnDrag: (columnId, clientX, origin) => {
        // Column gestures exist only when the board can report them.
        if (
          readOnly ||
          !callbacksRef.current.onColumnMove ||
          columnDrag.get() !== null ||
          drag.get() !== null
        ) {
          return false
        }

        pendingFocusRef.current = null
        pendingColumnFocusRef.current = null

        columnDrag.set({
          columnId,
          fromIndex: Math.max(columnIndexOf(columnId), 0),
          mode: "pointer",
          deltaX: 0,
          deltaY: 0,
          origin,
          fixedOffset: (() => {
            const element =
              registrationsRef.current.columnRoots.get(columnId)?.element

            return element ? kanbanFixedOffset(element) : { x: 0, y: 0 }
          })(),
          over: columnTargetUnder(
            origin.left + origin.width / 2,
            columnId,
            origin.width,
          ),
        })

        return true
      },
      moveColumnDrag: (columnId, startClientX, startClientY, clientX, clientY) => {
        const state = columnDrag.get()

        if (!state || state.mode !== "pointer" || state.columnId !== columnId) {
          return
        }

        const deltaX = clientX - startClientX

        columnDrag.set({
          ...state,
          deltaX,
          // Vertical travel is visual freedom only — the drop is decided
          // by X — and it disappears entirely when the board rails drags.
          deltaY:
            columnDragAxisRef.current === "x" ? 0 : clientY - startClientY,
          over: columnTargetUnder(
            state.origin.left + deltaX + state.origin.width / 2,
            columnId,
            state.origin.width,
          ),
        })
      },
      endColumnDrag: (columnId) => {
        const state = columnDrag.get()

        if (state && state.mode === "pointer" && state.columnId === columnId) {
          settleColumn(state)
        }
      },
      liftColumn: (columnId) => {
        // Column gestures exist only when the board can report them.
        if (
          readOnly ||
          !callbacksRef.current.onColumnMove ||
          columnDrag.get() !== null ||
          drag.get() !== null
        ) {
          return
        }

        pendingFocusRef.current = null
        pendingColumnFocusRef.current = null

        const index = Math.max(columnIndexOf(columnId), 0)
        const element = registrationsRef.current.columnRoots.get(columnId)
          ?.element
        const rect = element?.getBoundingClientRect()
        const columnOrigin = {
          left: rect?.left ?? 0,
          top: rect?.top ?? 0,
          width: element?.offsetWidth ?? 0,
          height: element?.offsetHeight ?? 0,
        }
        const columnFixedOffset = element
          ? kanbanFixedOffset(element)
          : { x: 0, y: 0 }

        columnDrag.set({
          columnId,
          fromIndex: index,
          mode: "keyboard",
          deltaX: 0,
          deltaY: 0,
          origin: columnOrigin,
          fixedOffset: columnFixedOffset,
          over: columnTargetAt(index, columnId, columnOrigin.width),
        })
        announce({
          type: "lift",
          kind: "column",
          cardLabel: columnLabel(columnId),
          columnLabel: columnLabel(columnId),
          position: index + 1,
          count: orderedColumns().length,
        })
      },
      moveColumnLift: (direction) => {
        const state = columnDrag.get()

        if (!state || state.mode !== "keyboard" || !state.over) {
          return
        }

        const over = columnTargetAt(
          state.over.index +
            (direction === "left" ? -1 : 1) * (rowMirror() === null ? 1 : -1),
          state.columnId,
          state.origin.width,
        )

        if (!over || over.index === state.over.index) {
          return
        }

        columnDrag.set({ ...state, over })
        announce({
          type: "move",
          kind: "column",
          cardLabel: columnLabel(state.columnId),
          columnLabel: columnLabel(state.columnId),
          position: over.index + 1,
          count: orderedColumns().length,
        })
      },
      dropColumnLift: () => {
        const state = columnDrag.get()

        if (state && state.mode === "keyboard") {
          settleColumn(state)
        }
      },
      cancelColumnDrag,
      cancelDrag,
    }),
    [
      announce,
      cancelColumnDrag,
      cancelDrag,
      cardLabel,
      columnDrag,
      columnIndexOf,
      columnLabel,
      columnTargetAt,
      columnTargetUnder,
      drag,
      invalidateMeasurements,
      orderedCardsIn,
      orderedColumns,
      readOnly,
      settle,
      settleColumn,
      targetFor,
      targetUnderPointer,
    ],
  )

  return (
    <KanbanContext.Provider value={contextValue}>
      {/* Consumer props spread first so the attributes the board owns
          (slot, ref) always win. */}
      <div
        {...props}
        ref={composedRef}
        data-slot="kanban-board"
        className={cn("relative flex items-start gap-4", className)}
        style={
          reservedColumnWidth > 0
            ? { ...props.style, paddingInlineEnd: reservedColumnWidth }
            : props.style
        }
      >
        {children}
        {slotLeft !== null && slotWidth !== null ? (
          <span
            aria-hidden="true"
            data-slot="kanban-column-drop-indicator"
            className="pointer-events-none absolute top-0 bottom-0 rounded-2xl border-2 border-dashed border-ring/50 bg-ring/5"
            style={{
              insetInlineStart: slotLeft,
              // The board's own measured gap, not a literal: the slot is
              // column + spacing, and the outline previews the column.
              width: Math.max(slotWidth - (slotSpacing ?? 0), 0),
            }}
          />
        ) : null}
        <span aria-live="polite" className="sr-only">
          {announcement.text}
          {announcement.nonce % 2 === 1 ? "\u200b" : ""}
        </span>
      </div>
    </KanbanContext.Provider>
  )
}

export { KanbanBoard, type KanbanAnnouncement, type KanbanBoardProps }
