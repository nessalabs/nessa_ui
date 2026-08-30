"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** @responsibility Renders a categorical stacked-bar history with fixed-slot series colors, a hover and focus breakdown, and a legend. */

/**
 * One series in the chart. Its position in the `series` array is its color
 * slot: slot `i` always wears `--nessa-chart-{i + 1}`, and a series keeps
 * that color when its values drop to zero. Keep the array stable across
 * renders — to filter a series out, zero its values instead of removing
 * it, because removing an entry shifts every later series into a new slot.
 */
export interface StackedBarChartSeries {
  /**
   * Identifier used to read this series' value from each sample. Must be
   * unique within one chart's `series` array.
   */
  id: string
  /** Human-readable name shown in the legend and the breakdown tooltip. */
  label: string
}

/** One ordered observation: a named sample carrying a value per series. */
export interface StackedBarChartSample {
  /**
   * Names the sample in the breakdown tooltip and the column's accessible
   * description (a timestamp, a tick label). Not required to be unique.
   */
  key: string | number
  /**
   * Values keyed by series id. A missing, non-finite, zero, or negative
   * entry renders no segment; the series keeps its slot color everywhere
   * else it appears.
   */
  values: Record<string, number>
}

export interface StackedBarChartProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * The stacked series in fixed order: index 0 is the bottom segment of
   * every column and wears `--nessa-chart-1`, index 1 sits above it in
   * `--nessa-chart-2`, and so on. At most six series render — the size of
   * the categorical chart-token palette; further entries are ignored.
   */
  series: readonly StackedBarChartSeries[]
  /** The ordered history, one thin column per sample, oldest first. */
  samples: readonly StackedBarChartSample[]
  /**
   * Formats a raw value for the gridline labels, the breakdown tooltip, and
   * each column's accessible description — for example rendering `42` as
   * `"42%"`.
   */
  formatValue: (value: number) => string
  /**
   * The value the plot's top gridline represents. Defaults to a "nice"
   * ceiling (1/2/2.5/5 × a power of ten) of the largest stack total. A
   * stack exceeding an explicit `max` is compressed to fit rather than
   * overflowing the plot.
   */
  max?: number
  /** Accessible name for the chart group (for example "CPU usage by service"). */
  label: string
  /** Plot height in pixels. The legend adds its own height below. */
  height?: number
  /** Shown centered in the plot when `samples` is empty. Defaults to "No data yet". */
  emptyMessage?: React.ReactNode
  /**
   * Optional per-series value slot rendered after the legend label — the
   * place for a "current" reading beside each series name.
   */
  legendValue?: (seriesId: string) => React.ReactNode
}

/**
 * The categorical chart slots in palette order. A series' index in the
 * `series` prop selects its class here, and nothing in the component ever
 * re-assigns it — zero values and empty samples leave the mapping alone.
 */
const seriesSlotClasses = Object.freeze([
  "bg-(--nessa-chart-1)",
  "bg-(--nessa-chart-2)",
  "bg-(--nessa-chart-3)",
  "bg-(--nessa-chart-4)",
  "bg-(--nessa-chart-5)",
  "bg-(--nessa-chart-6)",
])

/** The smallest 1/2/2.5/5 × 10^n value at or above `value`, and 1 for empty data. */
function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

/** A sample's value for one series, sanitized to a positive finite number or 0. */
function positiveValue(sample: StackedBarChartSample, seriesId: string): number {
  const value = sample.values[seriesId]
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * A categorical stacked-bar history chart: thin columns over ordered
 * samples, segments stacked bottom-up in fixed series order with hairline
 * surface gaps, recessive gridlines at zero, midpoint, and the ceiling, and
 * a required legend below the plot.
 *
 * Each column is keyboard-focusable in plain tab order and describes its
 * full breakdown to assistive technology; a fine-pointer (mouse or pen)
 * hover or keyboard focus highlights the column's track and opens a
 * per-series breakdown tooltip (label, value, and stack total) on the
 * popover surface. All text wears text tokens — series color appears only
 * on segments and legend chips. Transitions ride the motion tokens, so
 * they collapse under reduced motion.
 *
 * @param props - Chart data and presentation options plus host `div` props.
 * @returns A labelled chart group containing the plot and its legend.
 */
function StackedBarChart({
  className,
  emptyMessage,
  formatValue,
  height = 112,
  label,
  legendValue,
  max,
  samples,
  series,
  ...props
}: StackedBarChartProps) {
  // Hover and focus each own an index so a pointer sweeping off a column
  // cannot close the breakdown a keyboard user still has focused.
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
  const [focusIndex, setFocusIndex] = React.useState<number | null>(null)
  const visibleSeries = series.slice(0, seriesSlotClasses.length)

  const stackTotal = (sample: StackedBarChartSample): number =>
    visibleSeries.reduce((sum, entry) => sum + positiveValue(sample, entry.id), 0)

  const largestTotal = samples.reduce(
    (largest, sample) => Math.max(largest, stackTotal(sample)),
    0,
  )
  const ceiling =
    max !== undefined && Number.isFinite(max) && max > 0
      ? max
      : niceCeiling(largestTotal)

  // A history that shrinks below a remembered index unmounts that column
  // without its leave/blur events; drop the stale index for good so it
  // cannot resurrect a breakdown when the history grows back.
  const hoverStale = hoverIndex !== null && hoverIndex >= samples.length
  const focusStale = focusIndex !== null && focusIndex >= samples.length
  React.useEffect(() => {
    if (hoverStale) setHoverIndex(null)
    if (focusStale) setFocusIndex(null)
  }, [hoverStale, focusStale])

  const active = (hoverStale ? null : hoverIndex) ?? (focusStale ? null : focusIndex)
  const activeSample = active !== null ? samples[active] : undefined
  const activePercent =
    active !== null ? ((active + 0.5) / samples.length) * 100 : 0

  return (
    <div
      data-slot="stacked-bar-chart"
      role="group"
      aria-label={label}
      className={cn("flex w-full min-w-0 flex-col gap-2 font-sans", className)}
      {...props}
    >
      <div
        data-slot="stacked-bar-chart-plot"
        className="relative w-full"
        style={{ height }}
      >
        {samples.length === 0 ? (
          <div
            data-slot="stacked-bar-chart-empty"
            className="absolute inset-0 flex items-center justify-center rounded-sm border border-dashed border-border nessa-text-2 text-muted-foreground"
          >
            {emptyMessage ?? "No data yet"}
          </div>
        ) : (
          <>
            {/* Recessive gridlines behind the columns: ceiling, midpoint, baseline. */}
            <div
              aria-hidden="true"
              data-slot="stacked-bar-chart-grid"
              className="pointer-events-none absolute inset-0"
            >
              <div className="absolute inset-x-0 top-0 border-t border-border/70" />
              <div className="absolute inset-x-0 top-1/2 border-t border-border/70" />
              <div className="absolute inset-x-0 bottom-0 border-t border-border" />
            </div>
            <div
              data-slot="stacked-bar-chart-columns"
              className="absolute inset-0 flex items-stretch gap-px"
            >
              {samples.map((sample, index) => {
                const total = stackTotal(sample)
                // An explicit max below the stack total compresses the whole
                // stack to fit instead of overflowing the plot.
                const compression = total > ceiling ? ceiling / total : 1
                const nonZero = visibleSeries.filter(
                  (entry) => positiveValue(sample, entry.id) > 0,
                )
                const topSeriesId = nonZero.at(-1)?.id
                const description = `${sample.key}: ${[
                  ...visibleSeries.map(
                    (entry) =>
                      `${entry.label} ${formatValue(positiveValue(sample, entry.id))}`,
                  ),
                  `total ${formatValue(total)}`,
                ].join(", ")}`
                return (
                  <div
                    key={index}
                    role="img"
                    tabIndex={0}
                    aria-label={description}
                    data-slot="stacked-bar-chart-column"
                    data-active={active === index ? "" : undefined}
                    className="group/column relative flex min-w-0 flex-1 flex-col-reverse justify-start gap-px rounded-[2px] outline-none transition-[background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] data-active:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                    onPointerEnter={(event) => {
                      // Mouse and pen hover; touch has no hover to track.
                      if (event.pointerType !== "touch") setHoverIndex(index)
                    }}
                    onPointerLeave={(event) => {
                      if (event.pointerType !== "touch") {
                        setHoverIndex((current) =>
                          current === index ? null : current,
                        )
                      }
                    }}
                    onFocus={() => setFocusIndex(index)}
                    onBlur={() =>
                      setFocusIndex((current) =>
                        current === index ? null : current,
                      )
                    }
                  >
                    {visibleSeries.map((entry, slot) => {
                      const value = positiveValue(sample, entry.id)
                      if (value === 0) return null
                      return (
                        // Segments keep their default flex shrink: when a
                        // full stack's percentage heights plus the hairline
                        // gaps exceed the column, the overflow is absorbed
                        // proportionally instead of poking past the plot.
                        <div
                          key={entry.id}
                          data-slot="stacked-bar-chart-segment"
                          className={cn(
                            "w-full",
                            seriesSlotClasses[slot],
                            entry.id === topSeriesId && "rounded-t-[2px]",
                          )}
                          style={{
                            height: `${(value / ceiling) * compression * 100}%`,
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
            {/* Value labels ride above the columns so a full stack cannot
                swallow them; the translucent wash keeps them legible while
                staying recessive. */}
            <div
              aria-hidden="true"
              data-slot="stacked-bar-chart-grid-labels"
              className="pointer-events-none absolute inset-0 font-mono nessa-text-1 text-muted-foreground"
            >
              <span className="absolute end-0 top-0 rounded-[2px] bg-background/75 px-1">
                {formatValue(ceiling)}
              </span>
              <span className="absolute end-0 top-1/2 rounded-[2px] bg-background/75 px-1">
                {formatValue(ceiling / 2)}
              </span>
              <span className="absolute end-0 bottom-0 rounded-[2px] bg-background/75 px-1">
                {formatValue(0)}
              </span>
            </div>
            {activeSample !== undefined ? (
              <div
                aria-hidden="true"
                data-slot="stacked-bar-chart-tooltip"
                // Anchored at the column center and grown toward the plot
                // interior, so it cannot cross the near edge and only an
                // implausibly wide breakdown could reach the far one.
                className="pointer-events-none absolute top-1 z-10 w-max max-w-full min-w-36 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
                style={
                  activePercent > 50
                    ? { right: `${100 - activePercent}%` }
                    : { left: `${activePercent}%` }
                }
              >
                <div className="nessa-text-1 font-medium text-muted-foreground">
                  {activeSample.key}
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {visibleSeries.map((entry, slot) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-1.5 nessa-text-1"
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-[2px]",
                          seriesSlotClasses[slot],
                        )}
                      />
                      <span className="text-muted-foreground">
                        {entry.label}
                      </span>
                      <span className="ms-auto ps-3 font-mono tabular-nums">
                        {formatValue(positiveValue(activeSample, entry.id))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-1 nessa-text-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className="ms-auto ps-3 font-mono font-medium tabular-nums">
                    {formatValue(stackTotal(activeSample))}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      <ul
        data-slot="stacked-bar-chart-legend"
        className="flex flex-wrap items-center gap-x-4 gap-y-1"
      >
        {visibleSeries.map((entry, slot) => (
          <li key={entry.id} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 shrink-0 rounded-[2px]",
                seriesSlotClasses[slot],
              )}
            />
            <span className="nessa-text-2 text-muted-foreground">
              {entry.label}
            </span>
            {legendValue ? (
              <span className="nessa-text-2 font-medium tabular-nums text-foreground">
                {legendValue(entry.id)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { StackedBarChart }
