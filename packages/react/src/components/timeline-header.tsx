"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface TimelineHeaderProps extends React.ComponentProps<"div"> {}

/**
 * The band a horizontal scale lives on: a relatively positioned strip
 * that `TimelineHeaderCell`s lay out inside by pixel offset. Born as the
 * GanttChart's two-tier time header and extracted — like PopoverSurface
 * and SegmentedControl before it — so any horizontally scrolled surface
 * (a ruler, grouped table headers, an audio timeline) can reuse the
 * layout and its pinned-label trick. Give the band its height and width,
 * stack tiers by anchoring cells `top-0` / `bottom-0`, and make it
 * `aria-hidden` when the scale is decoration for content that announces
 * itself.
 */
function TimelineHeader({ className, ...props }: TimelineHeaderProps) {
  return (
    <div
      data-slot="timeline-header"
      className={cn("relative", className)}
      {...props}
    />
  )
}

export interface TimelineHeaderCellProps
  extends React.ComponentProps<"div"> {
  /** Left edge of the cell, in pixels from the band's start. */
  start: number
  /** Rendered width in pixels. */
  width: number
  /**
   * Pins the cell's label this many pixels from the scroll viewport's
   * left edge while any part of the cell is in view — the trick that
   * keeps a month readable after its own left edge has scrolled away.
   * The inset is where the label rests, so a band beside a pinned column
   * passes that column's width plus its padding. Omit for a label that
   * scrolls with its cell.
   */
  pinLabelInset?: number
}

/**
 * One run of a `TimelineHeader` scale: an absolutely positioned cell with
 * the band's hairline and type treatment. With `pinLabelInset`, the label
 * is sticky inside its own cell, so it stays put at the inset until the
 * cell itself runs out — pinning needs the cell unclipped, so only an
 * unpinned cell truncates its label.
 */
function TimelineHeaderCell({
  className,
  style,
  start,
  width,
  pinLabelInset,
  children,
  ...props
}: TimelineHeaderCellProps) {
  return (
    <div
      data-slot="timeline-header-cell"
      className={cn(
        "absolute flex items-center border-l border-border/60 text-xs text-muted-foreground",
        pinLabelInset === undefined && "overflow-hidden",
        className,
      )}
      style={{ left: start, width, ...style }}
      {...props}
    >
      {pinLabelInset === undefined ? (
        children
      ) : (
        <span
          data-slot="timeline-header-label"
          className="sticky whitespace-nowrap"
          style={{ left: pinLabelInset }}
        >
          {children}
        </span>
      )}
    </div>
  )
}

export { TimelineHeader, TimelineHeaderCell }
