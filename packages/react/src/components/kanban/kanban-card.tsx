"use client"

/** @responsibility Renders one draggable kanban card, owning its pointer drag gesture and the keyboard lift-move-drop flow. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  KanbanColumnContext,
  composeKanbanRefs,
  useKanban,
} from "./kanban-context"

/** State snapshotted for the lifetime of one card pointer gesture. */
interface KanbanCardPointerState {
  /** The pointer that started the gesture; other pointers are ignored. */
  pointerId: number
  startClientX: number
  startClientY: number
  /** Whether the pointer travelled far enough to count as a drag. */
  started: boolean
}

/** Properties accepted by one kanban card. */
interface KanbanCardProps extends React.ComponentProps<"div"> {
  /** The card's unique id within its board, referenced by moves. */
  cardId: string
  /**
   * Whether this card is pinned in place: it still takes focus and still
   * holds a slot other cards move around, but it cannot itself be picked
   * up by pointer or keyboard.
   * @defaultValue false
   */
  disabled?: boolean
}

/**
 * Reads whether a pointer-down landed on something that owns its own
 * gesture — a control, editable text, or anything marked
 * `data-kanban-no-drag` — so dragging never steals from it.
 *
 * @param target - The event target.
 * @returns Whether the card should leave the gesture alone.
 */
function targetOwnsGesture(target: Element): boolean {
  return (
    target.closest(
      'button, a, input, textarea, select, [contenteditable="true"], [data-kanban-no-drag]',
    ) !== null
  )
}

/**
 * One card on a kanban board: a focusable container rendering any content.
 * It drags with the pointer — floating from its spot while the drop
 * indicator marks where it will land — and moves with the keyboard: Space
 * or Enter lifts the focused card, the arrow keys walk it through
 * positions and columns, Space drops it, and Escape cancels. Label it with
 * `aria-label`; announcements read it. Controls inside the card, and
 * anything marked `data-kanban-no-drag`, never start a drag.
 *
 * @param props - The card id and native container properties.
 * @returns The card element.
 */
function KanbanCard({
  cardId,
  disabled = false,
  className,
  style,
  ref,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  onClick,
  onBlur,
  ...props
}: KanbanCardProps) {
  const board = useKanban("KanbanCard")
  const column = React.useContext(KanbanColumnContext)

  if (column === null) {
    throw new Error("KanbanCard must be used within a KanbanColumn.")
  }

  const { columnId } = column
  const elementRef = React.useRef<HTMLDivElement>(null)
  const composedRef = React.useMemo(
    () => composeKanbanRefs(elementRef, ref),
    [ref],
  )
  const pointerStateRef = React.useRef<KanbanCardPointerState | null>(null)
  const suppressClickRef = React.useRef(false)

  React.useLayoutEffect(() => {
    const element = elementRef.current

    if (!element) {
      return
    }

    return board.registerCard(cardId, columnId, element)
  }, [board, cardId, columnId])

  // The snapshot is this card's own drag state or a stable null, so drags
  // of other cards never re-render this one.
  const dragState = React.useSyncExternalStore(
    board.drag.subscribe,
    () => {
      const state = board.drag.get()

      return state && state.cardId === cardId ? state : null
    },
    () => null,
  )

  const isPointerDragging = dragState?.mode === "pointer"
  const isLifted = dragState?.mode === "keyboard"

  // How far this card slides to open the slot for the card being moved.
  // The snapshot is a plain number, so cards that are not moving never
  // re-render as the drag travels.
  const shift = React.useSyncExternalStore(
    board.drag.subscribe,
    () => {
      const state = board.drag.get()

      return state?.over?.shiftedCardIds.has(cardId) ? state.over.gapHeight : 0
    },
    () => 0,
  )

  // A drag beginning (or settling) puts the board in a net-zero pose: the
  // moved card leaves (or re-enters) the flow and this shift exactly
  // cancels the layout change, both landing in the same paint. Easing the
  // shift then would make every card dip and slide back — the whole board
  // appearing to move on a mere pickup — so in those poses it applies
  // instantly, and only genuine re-targeting mid-drag animates.
  const wholeDrag = board.drag.get()
  const shiftIsInstant =
    wholeDrag === null ||
    (wholeDrag.over !== null &&
      wholeDrag.over.columnId === wholeDrag.fromColumn &&
      wholeDrag.over.index === wholeDrag.fromIndex &&
      wholeDrag.deltaX === 0 &&
      wholeDrag.deltaY === 0)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event)

    // A touch drag ends without a trailing click, so any suppression left
    // armed from a previous gesture retires when a new one begins.
    suppressClickRef.current = false

    if (
      event.defaultPrevented ||
      disabled ||
      board.readOnly ||
      event.button !== 0 ||
      pointerStateRef.current ||
      targetOwnsGesture(event.target as Element)
    ) {
      return
    }

    const inFlight = board.drag.get()

    if (inFlight !== null) {
      // Reaching for the pointer abandons a keyboard lift rather than
      // leaving it stranded — pressing a card is a clear change of intent,
      // and the press then arms normally. A pointer drag already owns the
      // board, so this press stays inert until it settles.
      if (inFlight.mode === "keyboard") {
        board.cancelDrag()
      } else {
        return
      }
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointer events (tests) have no capturable pointer id;
      // dragging still works through the element's own move events.
    }

    pointerStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      started: false,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event)

    const pointerState = pointerStateRef.current

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return
    }

    if (!pointerState.started) {
      // A tiny wobble under the pointer stays a click, not a drag.
      if (
        Math.hypot(
          event.clientX - pointerState.startClientX,
          event.clientY - pointerState.startClientY,
        ) < 3
      ) {
        return
      }

      // The board may refuse — another pointer or a keyboard lift already
      // owns it — and a refused gesture disarms itself for good.
      const rect = event.currentTarget.getBoundingClientRect()

      if (
        !board.beginPointerDrag(cardId, columnId, event.clientX, event.clientY, {
          left: rect.left,
          top: rect.top,
          width: event.currentTarget.offsetWidth,
          height: event.currentTarget.offsetHeight,
        })
      ) {
        pointerStateRef.current = null

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        return
      }

      pointerState.started = true

      // Chrome focuses a pressed tabindex element, Safari and Firefox do
      // not — and the Escape-cancels-drag path needs the key to land
      // here, so the drag takes focus explicitly.
      event.currentTarget.focus({ preventScroll: true })

      // This event's few pixels are not applied: the begin commit must
      // render the pure net-zero pose (delta 0, slot at origin) so the
      // compensating shifts apply without easing — otherwise every other
      // card visibly dips on a mere pickup. The float catches up on the
      // very next move.
      return
    }

    board.movePointerDrag(
      cardId,
      pointerState.startClientX,
      pointerState.startClientY,
      event.clientX,
      event.clientY,
    )
  }

  const handlePointerEnd = (
    event: React.PointerEvent<HTMLDivElement>,
    cancelled: boolean,
  ) => {
    const pointerState = pointerStateRef.current

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return
    }

    pointerStateRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!pointerState.started) {
      return
    }

    if (cancelled) {
      // A cancelled gesture produces no trailing click; arming the
      // suppression here would swallow the next genuine click instead.
      // Only this card's own drag is cancelled — never someone else's.
      if (board.drag.get()?.cardId === cardId) {
        board.cancelDrag()
      }
    } else {
      suppressClickRef.current = true
      // The threshold-crossing move deliberately renders the net-zero
      // pose without travelling, so a gesture whose whole journey arrived
      // in that one event would otherwise settle back at its origin. The
      // release position always has the final say; both updates batch into
      // this handler, so nothing paints in between.
      board.movePointerDrag(
        cardId,
        pointerState.startClientX,
        pointerState.startClientY,
        event.clientX,
        event.clientY,
      )
      board.endPointerDrag(cardId)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)

    // Movement keys act on the card itself, never on a focused control
    // inside it.
    if (event.defaultPrevented || event.target !== event.currentTarget) {
      return
    }

    if (event.key === " " || event.key === "Enter") {
      // A lift already in flight always settles, even if the card turned
      // disabled underneath it: refusing the drop would strand the card
      // in a state the arrow keys can still move but nothing can end.
      if (isLifted) {
        // Held keys still scroll nothing, but only the first press acts:
        // auto-repeat would otherwise toggle lift and drop tens of times
        // a second, flooding the live region.
        event.preventDefault()

        if (!event.repeat) {
          board.dropLift()
        }

        return
      }

      if (disabled || board.readOnly) {
        return
      }

      event.preventDefault()

      if (!event.repeat && board.drag.get() === null) {
        board.liftCard(cardId, columnId)
      }

      return
    }

    // Escape abandons a pointer drag the same way it abandons a lift —
    // the press focused the card, so the key lands here.
    if (isPointerDragging && event.key === "Escape") {
      event.preventDefault()
      pointerStateRef.current = null
      // The mouse button is still down; its eventual release fires a
      // trailing click that belongs to the abandoned drag, not to the card.
      suppressClickRef.current = true
      board.cancelDrag()
      return
    }

    if (isLifted) {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          board.moveLift("up")
          return
        case "ArrowDown":
          event.preventDefault()
          board.moveLift("down")
          return
        case "ArrowLeft":
          event.preventDefault()
          board.moveLift("left")
          return
        case "ArrowRight":
          event.preventDefault()
          board.moveLift("right")
          return
        case "Escape":
          event.preventDefault()
          board.cancelDrag()
          return
      }
    }
  }

  return (
    // Consumer props spread first so the attributes the card owns
    // (slot, drag transform, gesture handlers) always win.
    <div
      {...props}
      ref={composedRef}
      role="listitem"
      tabIndex={0}
      data-slot="kanban-card"
      data-card-id={cardId}
      data-dragging={isPointerDragging ? "true" : undefined}
      data-lifted={isLifted ? "true" : undefined}
      data-disabled={disabled || board.readOnly ? "true" : undefined}
      className={cn(
        // touch-none keeps the browser from claiming touch drags for
        // scrolling; column areas outside cards still scroll by touch.
        "box-border cursor-grab touch-none select-none data-[disabled=true]:cursor-default",
        // A dragged card leaves the flow entirely — its old slot closes and
        // the cards below rise — and floats above every column, clear of
        // any scrollable list that would otherwise clip it.
        "data-[dragging=true]:fixed data-[dragging=true]:z-50 data-[dragging=true]:cursor-grabbing data-[dragging=true]:shadow-xl",
        // A keyboard lift leaves the flow exactly as a pointer drag does,
        // so the column measures the same either way and the slot preview
        // lands where the card will actually go.
        "data-[lifted=true]:fixed data-[lifted=true]:z-50 data-[lifted=true]:shadow-xl",
        // Cards slide aside to open the slot. The card under the pointer
        // is placed every frame and opts out below, so it never lags.
        "transition-transform [transition-duration:var(--nessa-kanban-motion-duration,var(--nessa-motion-duration-fast))] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      style={{
        ...style,
        ...(isPointerDragging || isLifted
          ? {
              // A transformed/filtered ancestor becomes the containing
              // block for position: fixed; its offset is subtracted so
              // the float lands where the card visually sat.
              left: dragState.origin.left - dragState.fixedOffset.x,
              top: dragState.origin.top - dragState.fixedOffset.y,
              width: dragState.origin.width,
              height: dragState.origin.height,
            }
          : null),
        // The floating card tracks the pointer directly; easing it would
        // make it swim behind the cursor — and net-zero poses (pickup,
        // settle) must not ease either, or the board visibly wobbles.
        // Only the kit's own duration is zeroed: `transition: none` would
        // also kill whatever the consumer styles on their card, and an
        // idle board is in exactly this state the whole time.
        ...(isPointerDragging || shiftIsInstant
          ? ({ "--nessa-kanban-motion-duration": "0s" } as React.CSSProperties)
          : null),
        // The float and the slide compose with (never replace) any
        // transform the consumer styles on, such as a tilt or hover scale.
        transform:
          [
            isPointerDragging
              ? `translate3d(${dragState.deltaX}px, ${dragState.deltaY}px, 0)`
              : null,
            shift > 0 ? `translate3d(0, ${shift}px, 0)` : null,
            typeof style?.transform === "string" ? style.transform : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        onPointerUp?.(event)
        handlePointerEnd(event, false)
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        handlePointerEnd(event, true)
      }}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        // The click that ends a drag is part of the drag, not an activation.
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          event.preventDefault()
          event.stopPropagation()
          return
        }

        onClick?.(event)
      }}
      onBlur={(event) => {
        onBlur?.(event)

        // A lifted card whose focus walks away settles back where it was.
        if (isLifted) {
          board.cancelDrag()
        }
      }}
    />
  )
}

export { KanbanCard, type KanbanCardProps }
