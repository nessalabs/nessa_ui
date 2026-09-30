"use client"

/** @responsibility Renders parts of a whole as one horizontal bar of segments sized by share — linearly, or log-weighted so small parts stay visible — coloured from the chart series ramp or named tones, with an optional legend of labels and host-formatted values and an accessible summary. Weights come from lib/chart-geometry. */

import * as React from "react"

import {
  proportionWeights,
  type ProportionWeighting,
} from "@/lib/chart-geometry"
import { cn } from "@/lib/utils"

/**
 * A named colour for a segment: a slot of the categorical chart ramp, or one
 * of two neutrals for parts that are context rather than a category —
 * `neutral` for a part that should still read (the unchanged majority),
 * `muted` for one that should recede (what is left of a track).
 */
export type ProportionBarTone =
  | "series-1"
  | "series-2"
  | "series-3"
  | "series-4"
  | "series-5"
  | "series-6"
  | "series-7"
  | "series-8"
  | "neutral"
  | "muted"

/**
 * The colour each tone paints, as CSS. Ramp slots take the ramp's **strong**
 * step: a bar is a band a few pixels tall, which reads as a mark rather than a
 * wash, and the pale fill step is too close to the surface at that size to
 * separate a segment from the track. Exported, like `pieChartPalette`, so a
 * legend or a key drawn elsewhere matches the bar without naming a token
 * twice.
 */
export const proportionBarTones: Readonly<Record<ProportionBarTone, string>> =
  Object.freeze({
    "series-1": "var(--nessa-chart-series-1-strong)",
    "series-2": "var(--nessa-chart-series-2-strong)",
    "series-3": "var(--nessa-chart-series-3-strong)",
    "series-4": "var(--nessa-chart-series-4-strong)",
    "series-5": "var(--nessa-chart-series-5-strong)",
    "series-6": "var(--nessa-chart-series-6-strong)",
    "series-7": "var(--nessa-chart-series-7-strong)",
    "series-8": "var(--nessa-chart-series-8-strong)",
    neutral: "color-mix(in oklab, var(--foreground) 40%, transparent)",
    muted: "color-mix(in oklab, var(--foreground) 10%, transparent)",
  })

/** The ramp slots, in slot order, that segments without a tone cycle through. */
const RAMP: readonly ProportionBarTone[] = [
  "series-1",
  "series-2",
  "series-3",
  "series-4",
  "series-5",
  "series-6",
  "series-7",
  "series-8",
]

/** One part of the whole. */
export interface ProportionBarSegment {
  /** Unique within the bar. */
  id: string
  /** Name shown in the legend and the accessible summary. */
  label: string
  /** Magnitude of the part. Zero, negative and non-finite values draw no segment. */
  value: number
  /**
   * The segment's colour. Omitted, segments take ramp slots by input
   * position, so a segment keeps its colour while values change and while
   * segments are appended after it; removing or reordering segments shifts
   * the slots of those after the change, so a host that does either pins
   * colours with a tone. A segment's `color` wins over its tone.
   */
  tone?: ProportionBarTone
  /** Any CSS colour, for a colour the tones do not name. */
  color?: string
}

/** Properties accepted by the ProportionBar. */
export interface ProportionBarProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * The parts, in the order they are drawn left to right and listed in the
   * legend. Ids must be unique.
   */
  segments: readonly ProportionBarSegment[]
  /**
   * How values become widths. `linear` (default) makes widths the shares.
   * `log` sizes each segment by `ln(1 + value / smallest)`, where `smallest`
   * is the smallest positive value in the bar: order and equality are kept,
   * units do not matter, and a part a thousand times larger than the
   * smallest is drawn about ten times wider rather than a thousand, so a tiny
   * part stays visible beside a huge one. Log widths are not shares — pair
   * them with the legend or a summary that says the exact values.
   */
  weighting?: ProportionWeighting
  /**
   * The value a full track stands for. Omitted, the segments fill the track.
   * Given, they fill `sum / max` of it and the rest stays empty — for a
   * column of bars measured against the largest. The fill never drops below
   * what its segments' minimum widths and gaps need (about 4px a segment and
   * 2px between), so a row far below the maximum reads a little long rather
   * than losing a part.
   */
  max?: number
  /** Shows a legend of every segment's label and formatted value. */
  legend?: boolean
  /**
   * Formats a value for the legend and the default summary — units,
   * grouping and locale are the host's.
   */
  formatValue: (value: number, segment: ProportionBarSegment) => string
  /**
   * What a screen reader hears for the bar itself. The default reads each
   * segment's label and formatted value, joined by commas; a host whose
   * language wants other wording passes its own sentence. The bar is hidden
   * from assistive technology while the legend is shown, since the legend
   * already says the same thing.
   */
  summary?: string
  /** Bar thickness. `sm` is 6px, `md` (default) 10px. */
  size?: "sm" | "md"
}

/** The colour a segment paints, given its position among the segments. */
function colorOf(segment: ProportionBarSegment, index: number): string {
  if (segment.color) return segment.color
  const tone =
    segment.tone && Object.hasOwn(proportionBarTones, segment.tone)
      ? segment.tone
      : RAMP[index % RAMP.length]!
  return proportionBarTones[tone]
}

/**
 * Parts of a whole as one bar. Each segment takes a width by its share —
 * or, with `weighting="log"`, by a logarithmic weight that keeps small parts
 * visible — and keeps at least a few pixels however small, so no part with a
 * value disappears. Segments take the categorical chart ramp in input order
 * unless given a tone or colour. An optional legend lists each label with its
 * value formatted by the host, and the bar carries a spoken summary of the
 * same values; the host names the whole with `aria-label`.
 */
function ProportionBar({
  segments,
  weighting = "linear",
  max,
  legend = false,
  formatValue,
  summary,
  size = "md",
  className,
  ...props
}: ProportionBarProps) {
  const weights = React.useMemo(
    () => proportionWeights(segments.map((segment) => segment.value), weighting),
    [segments, weighting],
  )
  const total = segments.reduce(
    (sum, segment) =>
      Number.isFinite(segment.value) && segment.value > 0
        ? sum + segment.value
        : sum,
    0,
  )
  const fill =
    max !== undefined && Number.isFinite(max) && max > 0
      ? Math.min(total / max, 1)
      : total > 0
        ? 1
        : 0
  const spoken =
    summary ??
    segments
      .map((segment) => `${segment.label} ${formatValue(segment.value, segment)}`)
      .join(", ")

  const named =
    props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined

  return (
    <div
      data-slot="proportion-bar"
      // A group only when it has a name to carry; unnamed, it is plain layout.
      role={named ? "group" : undefined}
      className={cn("flex min-w-0 flex-col gap-2 font-sans", className)}
      {...props}
    >
      <div
        data-slot="proportion-bar-track"
        role={legend ? undefined : "img"}
        aria-label={legend ? undefined : spoken}
        aria-hidden={legend ? true : undefined}
        className={cn(
          "flex w-full overflow-hidden rounded-full bg-(--nessa-proportion-bar-track)",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
        style={
          {
            "--nessa-proportion-bar-track":
              max !== undefined ? proportionBarTones.muted : "transparent",
          } as React.CSSProperties
        }
      >
        <div
          data-slot="proportion-bar-fill"
          // Never narrower than the segments' minimum widths and gaps, or
          // they would overflow the fill and the row would read longer than
          // its share without the fill knowing.
          className="flex h-full min-w-max gap-0.5"
          style={{ width: `${fill * 100}%` }}
        >
          {segments.map((segment, index) =>
            weights[index]! > 0 ? (
              <span
                key={segment.id}
                data-slot="proportion-bar-segment"
                data-segment-id={segment.id}
                className="h-full min-w-1 basis-0 bg-(--nessa-proportion-bar-color)"
                style={
                  {
                    flexGrow: weights[index],
                    "--nessa-proportion-bar-color": colorOf(segment, index),
                  } as React.CSSProperties
                }
              />
            ) : null,
          )}
        </div>
      </div>
      {legend ? (
        <ul
          data-slot="proportion-bar-legend"
          className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 nessa-text-2 text-muted-foreground"
        >
          {segments.map((segment, index) => (
            <li
              key={segment.id}
              data-slot="proportion-bar-legend-item"
              data-segment-id={segment.id}
              className="inline-flex items-center gap-1.5"
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full bg-(--nessa-proportion-bar-color)"
                style={
                  {
                    "--nessa-proportion-bar-color": colorOf(segment, index),
                  } as React.CSSProperties
                }
              />
              <span>{segment.label}</span>
              <span className="tabular-nums text-foreground">
                {formatValue(segment.value, segment)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export { ProportionBar }
