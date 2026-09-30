"use client"

/** @responsibility Renders a hover card on the popover surface, anchored to a point in a chart and kept inside a boundary the host names — flipping to the other side of the point and shifting along the edge wherever the preferred placement would cross it. Placement comes from lib/chart-geometry. */

import * as React from "react"

import {
  intersectChartRects,
  placeChartTooltip,
  type ChartRect,
  type ChartTooltipSide,
} from "@/lib/chart-geometry"
import { useComposedRefs } from "@/lib/compose"
import { cn } from "@/lib/utils"

import { PopoverSurface } from "./popover-surface"

/**
 * What a ChartTooltip must stay inside: an element (measured each time the
 * card is placed), a ref to one, or a rectangle in viewport pixels such as a
 * `DOMRect`.
 */
export type ChartTooltipBoundary =
  | Element
  | React.RefObject<Element | null>
  | ChartRect

/** Properties accepted by the ChartTooltip. */
export interface ChartTooltipProps extends React.ComponentProps<"div"> {
  /**
   * The point the card describes, in pixels, in the coordinate space of the
   * card's containing block: the chart's own positioned (`relative`) wrapper,
   * which the host must provide. That is the space a chart's own scales
   * already produce, so a host passes `{ x: scale.x(value), y: scale.y(value) }`
   * unchanged. The card is absolutely positioned inside that wrapper; it
   * cannot be made `fixed`, and it stays hidden while it has no containing
   * block to measure from.
   */
  anchor: { x: number; y: number }
  /**
   * What the card must stay inside — the pane, card or scroll area the chart
   * sits in. Always intersected with the viewport, and the viewport alone
   * when omitted. The card is told its boundary; it never searches its
   * ancestors for one.
   */
  boundary?: ChartTooltipBoundary | null
  /**
   * The side of the anchor the card prefers. It flips to the opposite side
   * when it would cross the boundary there. Defaults to `right`.
   */
  side?: ChartTooltipSide
  /** Gap between the anchor and the card, in pixels. Defaults to 12. */
  offset?: number
  /** Distance the card keeps from every boundary edge, in pixels. Defaults to 8. */
  padding?: number
}

/** Where the card is drawn, in its containing block's coordinates. */
interface Placement {
  left: number
  top: number
  side: ChartTooltipSide
}

/** Whether a boundary is a ref to an element rather than an element or a rectangle. */
function isRefObject(
  boundary: ChartTooltipBoundary,
): boundary is React.RefObject<Element | null> {
  return "current" in boundary
}

/** The boundary as a viewport rectangle, or null when a ref has not attached. */
function boundaryRect(boundary: ChartTooltipBoundary): ChartRect | null {
  if (isRefObject(boundary)) {
    return boundary.current ? boundary.current.getBoundingClientRect() : null
  }
  if ("getBoundingClientRect" in boundary) {
    return boundary.getBoundingClientRect()
  }
  return boundary
}

/**
 * A hover card for a point in a chart. The host renders it inside the chart's
 * positioned wrapper, gives it the point and the boundary it must stay inside,
 * and puts the content in `children`. It takes the preferred `side` of the
 * point, flips to the opposite side at an edge, shifts along the edge to stay
 * whole, and re-places itself when its content resizes or anything scrolls.
 * The card is not interactive — pointer events pass through to the chart — and
 * it carries `role="tooltip"`, so a focused mark can name it with
 * `aria-describedby`.
 */
function ChartTooltip({
  anchor,
  boundary,
  side = "right",
  offset = 12,
  padding = 8,
  className,
  style,
  children,
  ref: forwardedRef,
  ...props
}: ChartTooltipProps) {
  const cardRef = React.useRef<HTMLDivElement>(null)
  const composedRef = useComposedRefs(cardRef, forwardedRef)
  const [placement, setPlacement] = React.useState<Placement | null>(null)

  const place = React.useCallback(() => {
    const card = cardRef.current
    // The containing block is where `left` and `top` are measured from, so it
    // is the one ancestor this reads — found by layout, not by name.
    const container = card?.offsetParent
    if (!card || !container) return
    const origin = container.getBoundingClientRect()
    // Absolute offsets start inside the container's border and move with its
    // scrolled content.
    const originX = origin.left + container.clientLeft - container.scrollLeft
    const originY = origin.top + container.clientTop - container.scrollTop
    // The layout viewport, without classic scrollbars: `innerWidth` counts
    // them, and a card placed by it can land under one.
    const root = card.ownerDocument.documentElement
    const viewport: ChartRect = {
      left: 0,
      top: 0,
      width: root.clientWidth,
      height: root.clientHeight,
    }
    const given = boundary ? boundaryRect(boundary) : null
    const placed = placeChartTooltip({
      anchor: { x: originX + anchor.x, y: originY + anchor.y },
      size: { width: card.offsetWidth, height: card.offsetHeight },
      boundary: given ? intersectChartRects(given, viewport) : viewport,
      side,
      offset,
      padding,
    })
    const next = {
      left: placed.x - originX,
      top: placed.y - originY,
      side: placed.side,
    }
    setPlacement((previous) =>
      previous &&
      previous.left === next.left &&
      previous.top === next.top &&
      previous.side === next.side
        ? previous
        : next,
    )
  }, [anchor.x, anchor.y, boundary, side, offset, padding])

  // Before paint, so the card never shows at an unplaced position.
  React.useLayoutEffect(place)

  // A rectangle boundary cannot resize on its own; only an element (or a ref
  // to one) is worth observing, and a rectangle literal must not resubscribe
  // on every render.
  const observedBoundary =
    boundary && (isRefObject(boundary) || "getBoundingClientRect" in boundary)
      ? boundary
      : null

  // Content that grows, a boundary or wrapper that resizes (a split dragged, a
  // sidebar collapsed), a window that resizes and a pane that scrolls all
  // move the card relative to its boundary without a render of its own.
  const placeRef = React.useRef(place)
  React.useLayoutEffect(() => {
    placeRef.current = place
  })
  React.useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const ownerDocument = card.ownerDocument
    const view = ownerDocument.defaultView
    const replace = () => placeRef.current()
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(replace)
    observer?.observe(card)
    if (card.offsetParent) observer?.observe(card.offsetParent)
    const boundaryElement =
      observedBoundary && isRefObject(observedBoundary)
        ? observedBoundary.current
        : observedBoundary
    if (boundaryElement) observer?.observe(boundaryElement)
    ownerDocument.addEventListener("scroll", replace, {
      capture: true,
      passive: true,
    })
    view?.addEventListener("resize", replace)
    return () => {
      observer?.disconnect()
      ownerDocument.removeEventListener("scroll", replace, { capture: true })
      view?.removeEventListener("resize", replace)
    }
  }, [observedBoundary])

  return (
    <PopoverSurface
      ref={composedRef}
      role="tooltip"
      data-slot="chart-tooltip"
      data-side={placement?.side ?? side}
      data-placed={placement ? "true" : "false"}
      radius="lg"
      className={cn(
        "pointer-events-none absolute z-10 w-max max-w-72 p-3 nessa-text-2 data-[placed=false]:invisible",
        className,
      )}
      style={{
        ...style,
        left: placement?.left ?? anchor.x,
        top: placement?.top ?? anchor.y,
      }}
      {...props}
    >
      {children}
    </PopoverSurface>
  )
}

export { ChartTooltip }
