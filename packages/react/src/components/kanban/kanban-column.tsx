"use client"

/** @responsibility Renders one kanban column and its registered card list, including the drop indicator that marks where an in-flight card would land. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  KanbanColumnContext,
  composeKanbanRefs,
  useKanban,
  type KanbanColumnContextValue,
} from "./kanban-context"

/** Properties accepted by one kanban column. */
interface KanbanColumnProps extends React.ComponentProps<"div"> {
  /** The column's unique id within its board, referenced by moves. */
  columnId: string
}

/**
 * One column on a kanban board. Renders any content — typically a header
 * row followed by a `KanbanColumnList` holding the column's cards. Label it
 * with `aria-label`; announcements and the accessibility tree read it.
 *
 * @param props - The column id and native container properties.
 * @returns The column element providing column context.
 */
function KanbanColumn({
  columnId,
  className,
  style,
  ref,
  ...props
}: KanbanColumnProps) {
  const board = useKanban("KanbanColumn")
  const elementRef = React.useRef<HTMLDivElement>(null)
  const composedRef = React.useMemo(
    () => composeKanbanRefs(elementRef, ref),
    [ref],
  )
  const contextValue = React.useMemo<KanbanColumnContextValue>(
    () => ({ columnId }),
    [columnId],
  )

  React.useLayoutEffect(() => {
    const element = elementRef.current

    if (!element) {
      return
    }

    return board.registerColumnRoot(columnId, element)
  }, [board, columnId])

  // This column's own move, or the sideways slide it makes to open a slot
  // for another column. The snapshot collapses to a string so columns that
  // are not moving never re-render as a drag travels.
  const motion = React.useSyncExternalStore(
    board.columnDrag.subscribe,
    () => {
      const state = board.columnDrag.get()

      if (!state) {
        return null
      }

      if (state.columnId === columnId) {
        const box = `${state.origin.left - state.fixedOffset.x}:${
          state.origin.top - state.fixedOffset.y
        }:${state.origin.width}:${state.origin.height}`

        return state.mode === "pointer"
          ? `drag:${state.deltaX}:${state.deltaY}:${box}`
          : `lift:0:0:${box}`
      }

      return state.over?.shiftedColumnIds.has(columnId)
        ? `shift:${state.over.shift}`
        : null
    },
    () => null,
  )

  const [kind, ...values] = motion?.split(":") ?? []
  const numbers = values.map(Number)
  const isDragging = kind === "drag"
  const isLifted = kind === "lift"

  // At gesture start (and on settle) the shift exactly cancels the layout
  // change from the moved column leaving (or re-entering) the flow, both
  // landing in the same paint — easing the shift then would make the whole
  // board lurch on pickup, so net-zero poses apply instantly.
  const columnDragState = board.columnDrag.get()
  const shiftIsInstant =
    columnDragState === null ||
    (columnDragState.over !== null &&
      columnDragState.over.index === columnDragState.fromIndex &&
      columnDragState.deltaX === 0)

  return (
    <KanbanColumnContext.Provider value={contextValue}>
      <div
        role="group"
        {...props}
        ref={composedRef}
        data-slot="kanban-column"
        data-column-id={columnId}
        data-dragging={isDragging ? "true" : undefined}
        data-lifted={isLifted ? "true" : undefined}
        className={cn(
          "box-border flex flex-col",
          // A lifted column leaves the flow exactly as a dragged one does,
          // so the sibling math is identical for both input modes.
          "data-[dragging=true]:fixed data-[dragging=true]:z-50 data-[dragging=true]:cursor-grabbing data-[dragging=true]:shadow-xl",
          "data-[lifted=true]:fixed data-[lifted=true]:z-50 data-[lifted=true]:shadow-xl",
          "transition-transform [transition-duration:var(--nessa-kanban-motion-duration,var(--nessa-motion-duration-fast))] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
          className,
        )}
        style={
          {
            ...style,
            ...(isDragging || isLifted
              ? {
                  left: numbers[2],
                  top: numbers[3],
                  width: numbers[4],
                  height: numbers[5],
                  "--nessa-kanban-motion-duration": "0s",
                  transform: `translate3d(${numbers[0]}px, ${numbers[1]}px, 0)`,
                }
              : null),
            ...(kind === "shift"
              ? { transform: `translate3d(${numbers[0]}px, 0, 0)` }
              : null),
            // Only the kit's own duration is zeroed — `transition: none`
            // would also kill the consumer's, on every idle render.
            ...(shiftIsInstant && !isDragging
              ? { "--nessa-kanban-motion-duration": "0s" }
              : null),
          } as React.CSSProperties
        }
      />
    </KanbanColumnContext.Provider>
  )
}

/** Properties accepted by the column drag handle. */
interface KanbanColumnHandleProps extends React.ComponentProps<"button"> {}

/**
 * The grip that moves a whole column. Place it in the column's header;
 * dragging it slides the column while its siblings part to show where it
 * will land, and releasing reports the new position through the board's
 * `onColumnMove`. It is keyboard-operable the same way cards are: Space or
 * Enter lifts the column, the left and right arrows walk it between
 * positions, Space drops it, and Escape cancels.
 *
 * @param props - Native button properties; children replace the default
 * grip glyph.
 * @returns The handle button element.
 */
function KanbanColumnHandle({
  className,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  onBlur,
  onClick,
  ...props
}: KanbanColumnHandleProps) {
  const board = useKanban("KanbanColumnHandle")
  const column = React.useContext(KanbanColumnContext)

  if (column === null) {
    throw new Error("KanbanColumnHandle must be used within a KanbanColumn.")
  }

  const { columnId } = column
  // A drag ends with a trailing click on this button; it belongs to the
  // gesture, not to whatever the consumer wired to the handle.
  const suppressClickRef = React.useRef(false)
  const pointerRef = React.useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    started: boolean
  } | null>(null)

  const isLifted = React.useSyncExternalStore(
    board.columnDrag.subscribe,
    () => {
      const state = board.columnDrag.get()

      return state?.columnId === columnId && state.mode === "keyboard"
    },
    () => false,
  )

  return (
    <button
      type="button"
      aria-label="Move column"
      aria-pressed={isLifted}
      {...props}
      data-slot="kanban-column-handle"
      className={cn(
        "box-border inline-flex cursor-grab appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground",
        "touch-none aria-pressed:cursor-grabbing",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      onPointerDown={(event) => {
        onPointerDown?.(event)

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          pointerRef.current
        ) {
          return
        }

        // Reaching for the pointer abandons a keyboard lift rather than
        // leaving it stranded — pressing the handle is a clear change of
        // intent, and the press then arms normally. A gesture a pointer
        // already owns keeps the board, so this press stays inert until it
        // settles. Without this the press arms, the begin is refused at
        // the threshold, and every retry is swallowed while still
        // delivering a click to the consumer.
        const inFlightColumn = board.columnDrag.get()
        const inFlightCard = board.drag.get()

        if (inFlightColumn !== null) {
          if (inFlightColumn.mode === "keyboard") {
            board.cancelColumnDrag()
          } else {
            return
          }
        } else if (inFlightCard !== null) {
          if (inFlightCard.mode === "keyboard") {
            board.cancelDrag()
          } else {
            return
          }
        }

        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic pointer events (tests) have no capturable pointer id;
          // moving still works through the element's own move events.
        }

        suppressClickRef.current = false
        pointerRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          started: false,
        }
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)

        const pointer = pointerRef.current

        if (!pointer || pointer.pointerId !== event.pointerId) {
          return
        }

        if (!pointer.started) {
          if (Math.abs(event.clientX - pointer.startClientX) < 3) {
            return
          }

          const root = event.currentTarget.closest<HTMLElement>(
            '[data-slot="kanban-column"]',
          )
          const rect = root?.getBoundingClientRect()

          if (
            !root ||
            !rect ||
            !board.beginColumnDrag(columnId, event.clientX, {
              left: rect.left,
              top: rect.top,
              width: root.offsetWidth,
              height: root.offsetHeight,
            })
          ) {
            pointerRef.current = null

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }

            return
          }

          pointer.started = true
          suppressClickRef.current = true

          // Safari and Firefox do not focus a pressed button, and the
          // Escape-cancels-drag path needs the key to land here.
          event.currentTarget.focus({ preventScroll: true })

          // The begin commit renders the pure net-zero pose so sibling
          // shifts apply without easing; the float catches up next move.
          return
        }

        board.moveColumnDrag(
          columnId,
          pointer.startClientX,
          pointer.startClientY,
          event.clientX,
          event.clientY,
        )
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event)

        const pointer = pointerRef.current

        if (!pointer || pointer.pointerId !== event.pointerId) {
          return
        }

        pointerRef.current = null

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        if (pointer.started) {
          // The threshold-crossing move deliberately renders the net-zero
          // pickup pose without travelling, so a gesture whose whole
          // journey arrived in that one event would otherwise settle back
          // at its origin. The release position always has the final say;
          // both updates batch into this handler, so nothing paints in
          // between — exactly as a card drag settles.
          board.moveColumnDrag(
            columnId,
            pointer.startClientX,
            pointer.startClientY,
            event.clientX,
            event.clientY,
          )
          board.endColumnDrag(columnId)
        }
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)

        if (pointerRef.current?.pointerId !== event.pointerId) {
          return
        }

        const started = pointerRef.current.started

        pointerRef.current = null

        // Only this handle's own gesture is abandoned — a press that never
        // became a drag must not cancel someone else's.
        if (started && board.columnDrag.get()?.columnId === columnId) {
          board.cancelColumnDrag()
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)

        if (event.defaultPrevented) {
          return
        }

        // Escape abandons a pointer drag the same way it abandons a lift —
        // the press focused the handle, so the key lands here.
        if (pointerRef.current?.started && event.key === "Escape") {
          event.preventDefault()
          pointerRef.current = null

          if (board.columnDrag.get()?.columnId === columnId) {
            board.cancelColumnDrag()
          }

          return
        }

        if (event.key === " " || event.key === "Enter") {
          // Held keys still scroll nothing, but only the first press
          // acts: auto-repeat would otherwise toggle lift and drop tens
          // of times a second, flooding the live region.
          event.preventDefault()

          if (event.repeat) {
            return
          }

          if (isLifted) {
            board.dropColumnLift()
          } else {
            board.liftColumn(columnId)
          }

          return
        }

        if (!isLifted) {
          return
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault()
          board.moveColumnLift(event.key === "ArrowLeft" ? "left" : "right")
        } else if (event.key === "Escape") {
          event.preventDefault()
          board.cancelColumnDrag()
        }
      }}
      onClick={(event) => {
        // Only a pointer-trailing click (detail >= 1) can conclude a drag;
        // a keyboard activation arrives with detail 0 and must never be
        // eaten by suppression a click-less touch drag left armed.
        if (suppressClickRef.current && event.detail !== 0) {
          suppressClickRef.current = false
          event.preventDefault()
          event.stopPropagation()
          return
        }

        onClick?.(event)
      }}
      onBlur={(event) => {
        onBlur?.(event)

        // A lifted column whose focus walks away settles back where it
        // was, rather than leaving the board stuck mid-move.
        if (isLifted) {
          board.cancelColumnDrag()
        }
      }}
    >
      {children ?? (
        <svg aria-hidden="true" viewBox="0 0 10 10" className="size-3.5">
          <path
            d="M3 2.5h.01M3 5h.01M3 7.5h.01M7 2.5h.01M7 5h.01M7 7.5h.01"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}

/** Properties accepted by a column's card list. */
interface KanbanColumnListProps extends React.ComponentProps<"div"> {
  /**
   * Whether this column takes cards dropped into it. A closed column is
   * skipped when resolving drop targets and when a keyboard move walks
   * between columns — the way a WIP limit or a locked stage behaves.
   * @defaultValue true
   */
  accepts?: boolean
}

/**
 * The drop area of a column: the region cards live in, drags measure
 * against, and the drop indicator draws inside. Compose the column's
 * `KanbanCard` children here. The list keeps a minimum height so an empty
 * column still accepts drops.
 *
 * @param props - Native container properties; children are the cards.
 * @returns The registered list element.
 */
function KanbanColumnList({
  accepts = true,
  className,
  children,
  ref,
  ...props
}: KanbanColumnListProps) {
  const board = useKanban("KanbanColumnList")
  const column = React.useContext(KanbanColumnContext)

  if (column === null) {
    throw new Error("KanbanColumnList must be used within a KanbanColumn.")
  }

  const { columnId } = column
  const elementRef = React.useRef<HTMLDivElement>(null)
  const composedRef = React.useMemo(
    () => composeKanbanRefs(elementRef, ref),
    [ref],
  )

  React.useLayoutEffect(() => {
    const element = elementRef.current

    if (!element) {
      return
    }

    return board.registerColumn(columnId, element, accepts)
  }, [accepts, board, columnId])

  // The snapshot collapses to this column's opened slot (or null), so
  // drags over other columns never re-render this list. The two numbers
  // are packed into one string so the snapshot stays reference-stable
  // between identical reads.
  const slot = React.useSyncExternalStore(
    board.drag.subscribe,
    () => {
      const state = board.drag.get()

      return state?.over && state.over.columnId === columnId
        ? `${state.over.gapTop}:${state.over.gapHeight}:${state.over.spacing}`
        : null
    },
    () => null,
  )
  const [gapTop, gapHeight, gapSpacing] = slot
    ? slot.split(":").map(Number)
    : [null, null, null]

  return (
    <div
      role="list"
      {...props}
      ref={composedRef}
      data-slot="kanban-column-list"
      data-accepts={accepts ? undefined : "false"}
      data-drop-target={gapTop !== null ? "true" : undefined}
      className={cn(
        "relative box-border flex min-h-10 flex-col gap-2",
        className,
      )}
      // The cards part with transforms, which open the slot without
      // growing the list. Reserving the slot's height as padding lets the
      // column stretch to its dropped size — and padding, unlike a real
      // element, leaves every card's measured offset untouched, so the
      // insertion index can never chase its own preview.
      style={
        gapHeight !== null
          ? { ...props.style, paddingBottom: gapHeight }
          : props.style
      }
    >
      {children}
      {gapTop !== null && gapHeight !== null ? (
        // The cards have parted to leave exactly this space; the outline
        // fills it so the drop reads as a preview of the resting place.
        <span
          aria-hidden="true"
          data-slot="kanban-drop-indicator"
          className="pointer-events-none absolute inset-x-0 rounded-xl border-2 border-dashed border-ring/50 bg-ring/5"
          // The column's own measured gap is subtracted, not a literal:
          // the slot is card + spacing, and the outline previews the card.
          style={{
            top: gapTop,
            height: Math.max(gapHeight - (gapSpacing ?? 0), 0),
          }}
        />
      ) : null}
    </div>
  )
}

export {
  KanbanColumn,
  KanbanColumnHandle,
  KanbanColumnList,
  type KanbanColumnHandleProps,
  type KanbanColumnListProps,
  type KanbanColumnProps,
}
