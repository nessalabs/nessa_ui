import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** How large a stat is drawn: a dense row, a tile, or a hero figure. */
export type StatSize = "sm" | "md" | "lg"

/**
 * Creates the class names for each part of a stat, by size.
 *
 * `sm` and `md` sit on the coordinated levels. `lg`, the hero figure, is a
 * display size the seven levels do not reach, so it is written as a multiple
 * of the level its line carries rather than a fixed rem: the Nessa scale
 * presets still move it, and it stays tied to the ramp instead of standing
 * beside it.
 */
const statVariants = {
  figure: cva(
    "flex min-w-0 flex-wrap items-baseline gap-x-2 whitespace-nowrap",
    {
      variants: {
        size: {
          sm: "nessa-text-4",
          md: "nessa-text-7",
          lg: "nessa-text-7",
        } satisfies Record<StatSize, string>,
      },
    },
  ),
  value: cva("font-medium tabular-nums text-foreground", {
    variants: {
      size: {
        sm: "",
        md: "tracking-tight",
        lg: "text-[2.5em] leading-none tracking-tight",
      } satisfies Record<StatSize, string>,
    },
  }),
  of: cva("font-normal text-muted-foreground", {
    variants: {
      size: {
        sm: "",
        md: "text-[0.7em]",
        lg: "text-[0.45em]",
      } satisfies Record<StatSize, string>,
    },
  }),
  delta: cva("font-medium tabular-nums", {
    variants: {
      size: {
        sm: "nessa-text-2",
        md: "nessa-text-3",
        lg: "nessa-text-5",
      } satisfies Record<StatSize, string>,
    },
  }),
  caption: cva("block min-w-0 truncate text-muted-foreground", {
    variants: {
      size: {
        sm: "nessa-text-2",
        md: "nessa-text-2",
        lg: "nessa-text-3",
      } satisfies Record<StatSize, string>,
    },
  }),
}

interface StatSizeProp {
  /**
   * `sm` for an inline figure in a dense row, `md` (the default) for a
   * dashboard tile, `lg` for the hero figure a view leads with.
   */
  size?: StatSize
}

export interface StatProps
  extends Omit<React.ComponentProps<"div">, "children">,
    StatSizeProp {
  /** The figure, already formatted: "71.6", "$0.049", or any node. */
  value: React.ReactNode
  /**
   * The whole the figure is part of, drawn after it in a quieter ink. Pass it
   * with its separator — "/14", " of 14" — since Stat writes no text of its
   * own.
   */
  of?: React.ReactNode
  /** A change beside the figure, usually a `Delta`. */
  delta?: React.ReactNode
  /** What the figure is. A caption longer than the stat's width truncates. */
  caption: React.ReactNode
  /**
   * Which side of the figure the caption sits on, as in CSS `caption-side`:
   * `top` labels the figure before it is read ("Seats", then "42/60"),
   * `bottom` qualifies it after ("+9.5", then "this week"). Defaults to `top`.
   */
  captionSide?: "top" | "bottom"
  /**
   * Supporting content below the figure and caption, such as a `Meter` or a
   * footnote.
   */
  children?: React.ReactNode
}

/**
 * A figure with its caption: a headline number, optionally the whole it is
 * part of ("5/14") and the change that moved it, named by a muted caption.
 *
 * `sm` is an inline figure for dense rows, `md` a dashboard tile, and `lg` the
 * hero figure a view leads with. Figures use tabular numerals, so a column of
 * stats aligns and a changing value does not jitter. The stat stretches to its
 * container; its caption truncates rather than wrapping, while the figure
 * never truncates, because a clipped number reads as a different one.
 */
function Stat({
  className,
  size = "md",
  value,
  of,
  delta,
  caption,
  captionSide = "top",
  children,
  ...props
}: StatProps) {
  const captionNode = (
    <span data-slot="stat-caption" className={statVariants.caption({ size })}>
      {caption}
    </span>
  )

  return (
    <div
      data-slot="stat"
      data-size={size}
      className={cn(
        "flex min-w-0 flex-col gap-1 font-sans",
        size === "lg" && "gap-2",
        className,
      )}
      {...props}
    >
      {captionSide === "top" ? captionNode : null}
      <span data-slot="stat-figure" className={statVariants.figure({ size })}>
        <span data-slot="stat-value" className={statVariants.value({ size })}>
          {value}
          {of !== undefined && of !== null ? (
            <span data-slot="stat-of" className={statVariants.of({ size })}>
              {of}
            </span>
          ) : null}
        </span>
        {delta !== undefined && delta !== null ? (
          <span data-slot="stat-delta" className={statVariants.delta({ size })}>
            {delta}
          </span>
        ) : null}
      </span>
      {captionSide === "bottom" ? captionNode : null}
      {children}
    </div>
  )
}

export { Stat }
