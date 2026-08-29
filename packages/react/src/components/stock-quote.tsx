"use client"

import * as React from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartCandlestick,
  ChartLine,
} from "lucide-react"

import { cn } from "@/lib/utils"

import {
  PriceChart,
  priceChartBarValue,
  priceChartHasCandles,
  priceChartTone,
  type PriceChartBar,
  type PriceChartSelectionContext,
  type PriceChartTone,
  type PriceChartView,
} from "./price-chart"
import { SegmentedControl, SegmentedControlOption } from "./segmented-control"

/** One selectable window of history, such as a day, a year, or all of it. */
export interface StockQuoteRange {
  /** Identifies the range in `range`/`onRangeChange`. */
  id: string
  /** The short label shown on the control, such as `1D`. */
  label: string
  /** The accessible name, when the short label is not self-explanatory. */
  description?: string
}

/** The ranges brokerages offer by default, from one day to the full history. */
export const stockQuoteDefaultRanges: readonly StockQuoteRange[] = Object.freeze(
  [
    { id: "1D", label: "1D", description: "One day" },
    { id: "1W", label: "1W", description: "One week" },
    { id: "1M", label: "1M", description: "One month" },
    { id: "3M", label: "3M", description: "Three months" },
    { id: "YTD", label: "YTD", description: "Year to date" },
    { id: "1Y", label: "1Y", description: "One year" },
    { id: "ALL", label: "ALL", description: "All time" },
  ],
)

/** A quote's trading state, shown as a badge beside the symbol. */
export type StockQuoteStatus = "live" | "delayed" | "closed"

/** A labelled figure in the strip under the chart. */
export interface StockQuoteStat {
  label: string
  value: React.ReactNode
}

/** A price observed outside regular hours, shown as a second change line. */
export interface StockQuoteExtendedHours {
  /** The most recent extended-hours price. */
  price: number
  /** Names the session, such as `After-hours`. Defaults to the label set. */
  label?: string
}

/**
 * The strings StockQuote produces itself, so hosts can localize them. Merge
 * partial overrides over `stockQuoteDefaultLabels` through the `labels` prop.
 */
export interface StockQuoteLabels {
  /** Names the range control. */
  ranges: string
  /** Names the line/candle control. */
  views: string
  /** The line-view option. */
  lineView: string
  /** The candle-view option. */
  candleView: string
  /** Suffix on the primary change line when nothing is scrubbed. */
  change: string
  /** Names the extended-hours change line. */
  extendedHours: string
  /** Announced while quotes are streaming. */
  live: string
  /** Announced while quotes are delayed. */
  delayed: string
  /** Announced while the market is closed. */
  closed: string
  /** Announced for a rise, before the amount. */
  up: string
  /** Announced for a fall, before the amount. */
  down: string
  /** Names the change line while a window of the chart is selected. */
  selected: string
}

/** The out-of-the-box English strings. */
export const stockQuoteDefaultLabels: StockQuoteLabels = Object.freeze({
  ranges: "Chart range",
  views: "Chart type",
  lineView: "Line",
  candleView: "Candles",
  change: "Today",
  extendedHours: "After-hours",
  live: "Live",
  delayed: "Delayed",
  closed: "Closed",
  up: "Up",
  down: "Down",
  selected: "Selected",
})

const toneTextClass: Record<PriceChartTone, string> = {
  gain: "text-(--nessa-market-gain)",
  loss: "text-(--nessa-market-loss)",
  neutral: "text-muted-foreground",
}

export interface StockQuoteProps
  extends Omit<React.ComponentProps<"section">, "onChange"> {
  /** The ticker, shown above the name. */
  symbol: string
  /** The issuer's display name. */
  name?: string
  /** The latest price, shown large until the chart is scrubbed. */
  price: number
  /**
   * The reference the headline change is measured from, and the chart's
   * dotted baseline — the previous close for an intraday chart. Like
   * `series` it accepts a map keyed by range id; any window without one
   * falls back to its own first price.
   */
  previousClose?: number | Readonly<Record<string, number>>
  /** ISO 4217 code for the price formatter. */
  currency?: string
  /**
   * BCP 47 tag for number and time formatting. It defaults to `en-US` rather
   * than the ambient locale so server and client render the same text.
   */
  locale?: string
  /**
   * The bars behind the chart, oldest first. Pass one array for the window
   * currently loaded, or a map keyed by range id — `{ "1D": [...], "1M":
   * [...] }` — and the range control switches windows on its own, without
   * the host round-tripping through `onRangeChange`.
   */
  series:
    | readonly PriceChartBar[]
    | Readonly<Record<string, readonly PriceChartBar[]>>
  /** Controlled chart type. */
  view?: PriceChartView
  /** Initial chart type when uncontrolled. */
  defaultView?: PriceChartView
  /** Fires with the newly selected chart type. */
  onViewChange?: (view: PriceChartView) => void
  /**
   * Whether to offer the line/candle control. It defaults to on whenever the
   * series carries a full open/high/low/close set, so a host that only has
   * trade prices shows no control it cannot honor.
   */
  viewToggle?: boolean
  /**
   * The selectable history windows. Defaults to the keys of a `series` map
   * when one is given, and to `stockQuoteDefaultRanges` otherwise.
   */
  ranges?: readonly StockQuoteRange[]
  /** Controlled range id. */
  range?: string
  /** Initial range id when uncontrolled. Defaults to the first range. */
  defaultRange?: string
  /** Fires with the newly selected range id — the cue to fetch that window. */
  onRangeChange?: (range: string) => void
  /** A second change line for pre-market or after-hours trading. */
  extendedHours?: StockQuoteExtendedHours
  /**
   * The trading state. It is announced rather than shown, and `live` pulses
   * the newest point on the chart.
   */
  status?: StockQuoteStatus
  /**
   * Whether dragging across the chart selects a window. While one is
   * selected the headline reports that window instead of the session.
   */
  selectable?: boolean
  /** Figures shown in the strip under the chart. */
  stats?: readonly StockQuoteStat[]
  /** Overrides for the strings the component itself produces. */
  labels?: Partial<StockQuoteLabels>
  /** Actions for the header's trailing edge, such as a trade button. */
  children?: React.ReactNode
}

/**
 * A brokerage-style quote panel: ticker and name, the price in large type
 * with its change in the market's color, a `PriceChart` beneath it, the range
 * and chart-type controls, and an optional strip of figures. Dragging or
 * hovering the chart replaces the headline with the scrubbed bar and its
 * change from the baseline, then restores the live price on release.
 *
 * The panel is a display surface, not a data source: an agent or application
 * feeds it `price`, `series`, and `status` as quotes arrive, and reacts to
 * `onRangeChange` by loading that window. It fills the box its host gives it
 * and reflows from a phone-width card to a full-width desk layout on its own
 * container's width, so the same element serves both.
 */
function StockQuote({
  symbol,
  name,
  price,
  previousClose,
  currency = "USD",
  locale = "en-US",
  series: seriesProp,
  view: viewProp,
  defaultView = "line",
  onViewChange,
  viewToggle,
  ranges: rangesProp,
  range: rangeProp,
  defaultRange,
  onRangeChange,
  extendedHours,
  status,
  selectable = true,
  stats,
  labels: labelsProp,
  className,
  children,
  ...props
}: StockQuoteProps) {
  const labels = React.useMemo<StockQuoteLabels>(
    () => ({ ...stockQuoteDefaultLabels, ...labelsProp }),
    [labelsProp],
  )

  // A map of windows is its own list of ranges: the data decides what the
  // control can offer, so the two can never disagree.
  const seriesByRange = Array.isArray(seriesProp)
    ? null
    : (seriesProp as Readonly<Record<string, readonly PriceChartBar[]>>)
  const ranges: readonly StockQuoteRange[] =
    rangesProp ??
    (seriesByRange
      ? Object.keys(seriesByRange).map((id) => ({ id, label: id }))
      : stockQuoteDefaultRanges)

  const [uncontrolledView, setUncontrolledView] =
    React.useState<PriceChartView>(defaultView)
  const view = viewProp ?? uncontrolledView
  const [uncontrolledRange, setUncontrolledRange] = React.useState(
    defaultRange ?? ranges[0]?.id ?? "",
  )
  const range = rangeProp ?? uncontrolledRange
  const [scrubIndex, setScrubIndex] = React.useState<number | null>(null)
  const [selection, setSelection] =
    React.useState<PriceChartSelectionContext | null>(null)

  const series = React.useMemo<readonly PriceChartBar[]>(
    () =>
      seriesByRange
        ? (seriesByRange[range] ?? seriesByRange[ranges[0]?.id ?? ""] ?? [])
        : (seriesProp as readonly PriceChartBar[]),
    [seriesByRange, seriesProp, range, ranges],
  )

  const changeRange = (next: string) => {
    // A window drawn on one range means nothing on another.
    setSelection(null)
    setScrubIndex(null)
    if (rangeProp === undefined) setUncontrolledRange(next)
    onRangeChange?.(next)
  }

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale, currency],
  )
  const percentFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )
  const timeFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale],
  )

  // The bottom scale wants the shortest label that still separates the bars:
  // a clock inside a day, a date across more than one.
  const compactTimeFormatter = React.useMemo(
    () => ({
      clock: new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
      date: new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
      }),
    }),
    [locale],
  )

  const formatPrice = React.useCallback(
    (value: number) => currencyFormatter.format(value),
    [currencyFormatter],
  )
  const formatTime = React.useCallback(
    (time: number) => timeFormatter.format(new Date(time)),
    [timeFormatter],
  )

  const firstValue = React.useMemo(() => {
    for (const bar of series) {
      const value = priceChartBarValue(bar)
      if (value !== null) return value
    }
    return null
  }, [series])
  const spansMoreThanADay =
    series.length > 1 &&
    (series[series.length - 1] as PriceChartBar).time -
      (series[0] as PriceChartBar).time >
      24 * 60 * 60 * 1000
  const formatAxisTime = React.useCallback(
    (time: number) =>
      (spansMoreThanADay
        ? compactTimeFormatter.date
        : compactTimeFormatter.clock
      ).format(new Date(time)),
    [spansMoreThanADay, compactTimeFormatter],
  )

  const rangeClose =
    typeof previousClose === "number" || previousClose === undefined
      ? previousClose
      : previousClose[range]
  const baseline = rangeClose ?? firstValue ?? undefined

  const scrubbedBar =
    scrubIndex !== null && scrubIndex >= 0 && scrubIndex < series.length
      ? series[scrubIndex]
      : null
  const scrubbedValue = scrubbedBar ? priceChartBarValue(scrubbedBar) : null

  // Three readings, most specific first: the bar under the cursor, then the
  // zoomed window's own last bar, then the live session. The cursor outranks
  // the window — scrubbing inside a zoom has to keep reading out prices —
  // while the window still rules what the change is measured from. All of it
  // is derived here so the headline, its colour, and the chart agree.
  const selectionValue = selection
    ? priceChartBarValue(selection.endBar)
    : null
  const selectionOpen = selection
    ? priceChartBarValue(selection.startBar)
    : null
  const shownPrice = scrubbedValue ?? selectionValue ?? price
  const reference = selection
    ? (selectionOpen ?? shownPrice)
    : (baseline ?? price)
  const changeAmount = shownPrice - reference
  const changePercent = reference === 0 ? 0 : (changeAmount / reference) * 100
  const tone = priceChartTone(shownPrice, reference)
  // With the time scale under the plot the span is already on screen, so the
  // change line only has to say which reading this is.
  const changeContext = scrubbedBar
    ? formatTime(scrubbedBar.time)
    : selection
      ? labels.selected
      : labels.change

  const extendedChange = extendedHours ? extendedHours.price - price : 0
  const extendedTone = extendedHours
    ? priceChartTone(extendedHours.price, price)
    : "neutral"

  const showViewToggle = viewToggle ?? priceChartHasCandles(series)
  const statusLabel = status ? labels[status] : null

  return (
    <section
      data-slot="stock-quote"
      data-tone={tone}
      className={cn(
        "@container flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background font-sans text-foreground",
        className,
      )}
      {...props}
    >
      <header className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-2 px-4 pt-4 @md:px-6 @md:pt-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              data-slot="stock-quote-symbol"
              className="nessa-text-2 font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {symbol}
            </span>
            {statusLabel ? (
              // The trading state carries no chrome: the pulsing marker on
              // the newest bar is the visible tell, and this is what a
              // screen reader hears in its place.
              <span
                data-slot="stock-quote-status"
                data-status={status}
                className="sr-only"
              >
                {statusLabel}
              </span>
            ) : null}
          </div>
          {name ? (
            <h2
              data-slot="stock-quote-name"
              className="m-0 truncate nessa-text-6 font-semibold text-foreground"
            >
              {name}
            </h2>
          ) : null}
          <div className="nessa-text-7">
            <span
              data-slot="stock-quote-price"
              // The em size keeps the headline on the coordinated ramp: it
              // multiplies the level its row already carries, so the Nessa
              // scale presets still move it.
              className="text-[1.7em] font-medium tabular-nums text-foreground transition-colors duration-(--nessa-motion-duration-fast)"
            >
              {formatPrice(shownPrice)}
            </span>
          </div>
          <p
            data-slot="stock-quote-change"
            className={cn(
              "m-0 flex flex-wrap items-center gap-x-1.5 nessa-text-4 font-medium tabular-nums transition-colors duration-(--nessa-motion-duration-fast)",
              toneTextClass[tone],
            )}
          >
            {/* The slot is always occupied: a mark that appears and
                disappears mid-scrub reflows the whole line. */}
            {tone === "loss" ? (
              <ArrowDownRight aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <ArrowUpRight
                aria-hidden="true"
                className={cn("size-4 shrink-0", tone === "neutral" && "invisible")}
              />
            )}
            <span className="sr-only">
              {tone === "gain" ? labels.up : tone === "loss" ? labels.down : ""}
            </span>
            <span>{formatPrice(Math.abs(changeAmount))}</span>
            <span>{`(${percentFormatter.format(Math.abs(changePercent))}%)`}</span>
            <span className="font-normal text-muted-foreground">
              {changeContext}
            </span>
          </p>
          {extendedHours ? (
            <p
              data-slot="stock-quote-extended-change"
              className={cn(
                "m-0 flex flex-wrap items-center gap-x-1.5 nessa-text-3 tabular-nums",
                toneTextClass[extendedTone],
              )}
            >
              <span>{formatPrice(extendedHours.price)}</span>
              <span>
                {`${extendedChange < 0 ? "−" : "+"}${formatPrice(Math.abs(extendedChange))}`}
              </span>
              <span className="text-muted-foreground">
                {extendedHours.label ?? labels.extendedHours}
              </span>
            </p>
          ) : null}
        </div>
        {children ? (
          <div
            data-slot="stock-quote-actions"
            className="flex shrink-0 items-center gap-2"
          >
            {children}
          </div>
        ) : null}
      </header>

      <div className="mt-3 min-h-0 flex-1 px-1 @md:px-2">
        <PriceChart
          series={series}
          view={view}
          baseline={baseline}
          tone={tone}
          live={status === "live"}
          fill
          scrubIndex={scrubIndex}
          onScrubChange={setScrubIndex}
          selectable={selectable}
          selection={
            selection ? { start: selection.start, end: selection.end } : null
          }
          onSelectionChange={setSelection}
          formatValue={formatPrice}
          formatTime={formatTime}
          formatAxisTime={formatAxisTime}
          aria-label={name ? `${name} price chart` : `${symbol} price chart`}
          className="h-full min-h-24"
        />
      </div>

      {ranges.length || showViewToggle ? (
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 @md:px-6">
        {ranges.length ? (
          <SegmentedControl
            aria-label={labels.ranges}
            value={range}
            onValueChange={changeRange}
            className="min-w-0 flex-wrap border-transparent p-0"
          >
            {ranges.map((entry) => (
              <SegmentedControlOption
                key={entry.id}
                value={entry.id}
                aria-label={entry.description}
                className="px-2.5 tabular-nums"
              >
                {entry.label}
              </SegmentedControlOption>
            ))}
          </SegmentedControl>
        ) : null}
        {showViewToggle ? (
          <SegmentedControl
            aria-label={labels.views}
            value={view}
            onValueChange={(next) => {
              const nextView = next as PriceChartView
              if (viewProp === undefined) setUncontrolledView(nextView)
              onViewChange?.(nextView)
            }}
            className="ml-auto"
          >
            <SegmentedControlOption
              value="line"
              aria-label={labels.lineView}
              title={labels.lineView}
              className="px-2"
            >
              <ChartLine aria-hidden="true" className="size-4" />
            </SegmentedControlOption>
            <SegmentedControlOption
              value="candle"
              aria-label={labels.candleView}
              title={labels.candleView}
              className="px-2"
            >
              <ChartCandlestick aria-hidden="true" className="size-4" />
            </SegmentedControlOption>
          </SegmentedControl>
        ) : null}
      </div>
      ) : null}

      {stats?.length ? (
        <dl
          data-slot="stock-quote-stats"
          className="m-0 grid shrink-0 grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3 @md:grid-cols-4 @md:px-6"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="truncate nessa-text-2 text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="m-0 truncate nessa-text-4 font-medium tabular-nums text-foreground">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

export { StockQuote }
