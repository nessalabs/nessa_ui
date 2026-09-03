import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  expect,
  fireEvent,
  fn,
  userEvent,
  waitFor,
  within,
} from "storybook/test"
import { StockQuote } from "@nessa-ui/react"

import { candleSeries, priceSeries, SESSION_START } from "./market-demo-data"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Charts/StockQuote",
  component: StockQuote,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A brokerage-style quote panel: ticker, name, the price in large type with its change in the market's colour, a scrubbable and zoomable PriceChart with its price and time scales, the range and chart-type controls, an after-hours line, and a strip of key figures. Hovering the chart replaces the headline with the bar under the cursor; dragging across it zooms into that window, and the headline reports the window until it is cleared. Trading state is announced rather than drawn — a live quote shows it by pulsing the newest point. The panel is a display surface — an agent or application feeds it prices as they arrive and reloads the series when the range changes — and it reflows from a phone-width card to a full-width desk layout on its own container's width.",
      },
    },
  },
} satisfies Meta<typeof StockQuote>

export default meta
type Story = StoryObj<typeof meta>

const SESSION = candleSeries({
  seed: 5,
  count: 78,
  start: 96.4,
  startTime: SESSION_START,
  stepMs: 5 * 60 * 1000,
  drift: 0.0011,
  volatility: 0.005,
})

const LAST = SESSION[SESSION.length - 1]?.close as number

/**
 * One window per range, the shape a host that already holds every window
 * passes in. The panel reads the active range's bars straight out of the map,
 * so every tab redraws the chart with no host round trip.
 */
const WINDOWS = {
  "1D": SESSION,
  "1W": candleSeries({
    seed: 12,
    count: 35,
    start: 92.1,
    startTime: Date.UTC(2026, 7, 21),
    stepMs: 5 * 60 * 60 * 1000,
    drift: 0.0018,
  }),
  "1M": candleSeries({
    seed: 30,
    count: 44,
    start: 84.6,
    startTime: Date.UTC(2026, 6, 28),
    stepMs: 16 * 60 * 60 * 1000,
    drift: 0.0035,
  }),
  "3M": candleSeries({
    seed: 61,
    count: 60,
    start: 71.4,
    startTime: Date.UTC(2026, 4, 28),
    stepMs: 36 * 60 * 60 * 1000,
    drift: 0.0045,
    volatility: 0.03,
  }),
  YTD: candleSeries({
    seed: 77,
    count: 68,
    start: 58.9,
    startTime: Date.UTC(2026, 0, 2),
    stepMs: 3 * 24 * 60 * 60 * 1000,
    drift: 0.0075,
    volatility: 0.04,
  }),
  "1Y": candleSeries({
    seed: 44,
    count: 52,
    start: 41.2,
    startTime: Date.UTC(2025, 8, 1),
    stepMs: 7 * 24 * 60 * 60 * 1000,
    drift: 0.014,
    volatility: 0.05,
  }),
  ALL: candleSeries({
    seed: 91,
    count: 60,
    start: 9.4,
    startTime: Date.UTC(2021, 6, 29),
    stepMs: 30 * 24 * 60 * 60 * 1000,
    drift: 0.036,
    volatility: 0.11,
  }),
} as const

/** Each window's own opening reference, so every tab measures from its own. */
const WINDOW_CLOSES = Object.fromEntries(
  Object.entries(WINDOWS).map(([id, bars]) => [id, bars[0]?.open as number]),
)

const WATCHLIST = [
  {
    symbol: "HOOD",
    name: "Robinhood Markets",
    seed: 7,
    start: 118.2,
    drift: 0.0012,
  },
  { symbol: "COIN", name: "Coinbase", seed: 21, start: 244.6, drift: -0.0015 },
  { symbol: "NVDA", name: "NVIDIA", seed: 33, start: 176.4, drift: 0.0004 },
].map((entry) => {
  const series = priceSeries({
    seed: entry.seed,
    count: 60,
    start: entry.start,
    startTime: SESSION_START,
    stepMs: 5 * 60 * 1000,
    drift: entry.drift,
  })
  return {
    ...entry,
    series,
    price: series[series.length - 1]?.value as number,
    previousClose: series[0]?.value as number,
  }
})

export const Playground: Story = {
  args: {
    symbol: "HOOD",
    name: "Robinhood Markets",
    price: LAST,
    previousClose: WINDOW_CLOSES,
    series: WINDOWS,
    status: "live",
    extendedHours: { price: Number((LAST - 0.43).toFixed(2)) },
    stats: [
      { label: "Open", value: `$${SESSION[0]?.open?.toFixed(2)}` },
      { label: "Volume", value: "37.2M" },
      { label: "Market cap", value: "$116.4B" },
      { label: "P/E ratio", value: "48.3" },
    ],
    onRangeChange: fn(),
    onSelectionChange: fn(),
  },
  parameters: storyDocumentation(
    "The flagship panel: a live session with an after-hours print, and four key figures. It is handed one window per range, so the range control redraws the chart on its own. The play test scrubs with the keyboard and proves the headline follows the cursor — the interaction the whole panel exists for — then switches to candles, and finally picks a range and proves the chart is plotting different bars.",
  ),
  render: (args) => (
    <div className="h-[30rem] w-full max-w-3xl">
      <StockQuote {...args} />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const live = `$${LAST.toFixed(2)}`
    await expect(canvas.getByText(live)).toBeInTheDocument()

    // Scrubbing rewrites the headline with the bar under the cursor.
    const cursor = canvas.getByRole("slider")
    cursor.focus()
    await fireEvent.keyDown(cursor, { key: "Home" })
    const first = `$${(SESSION[0]?.close as number).toFixed(2)}`
    await waitFor(async () => {
      await expect(canvas.getByText(first)).toBeInTheDocument()
    })

    // A window drawn on the chart zooms it, and scrubbing inside that window
    // keeps reading prices out — the cursor outranks the selection.
    const plotBounds = cursor.getBoundingClientRect()
    const at = (ratio: number) => ({
      pointerId: 1,
      pointerType: "mouse",
      clientX: plotBounds.left + plotBounds.width * ratio,
      clientY: plotBounds.top + plotBounds.height / 2,
    })
    await fireEvent.pointerDown(cursor, at(0.3))
    await fireEvent.pointerMove(cursor, at(0.7))
    await fireEvent.pointerUp(cursor, at(0.7))
    await waitFor(async () => {
      await expect(
        Number(cursor.getAttribute("aria-valuemin")),
      ).toBeGreaterThan(0)
    })
    // The window reaches the host with the bars at each end and the move
    // across them — what it needs to fetch that span at a finer resolution.
    await expect(args.onSelectionChange).toHaveBeenCalled()
    const reported = (args.onSelectionChange as ReturnType<typeof fn>).mock
      .calls.at(-1)?.[0] as {
      start: number
      end: number
      startBar: { time: number }
      endBar: { time: number }
      changeAmount: number
    }
    await expect(reported.end).toBeGreaterThan(reported.start)
    await expect(reported.startBar.time).toBe(SESSION[reported.start]?.time)
    await expect(reported.endBar.time).toBe(SESSION[reported.end]?.time)
    // The reported move is the one between the window's own ends.
    const openPrice = SESSION[reported.start]?.close as number
    const closePrice = SESSION[reported.end]?.close as number
    await expect(reported.changeAmount).toBeCloseTo(closePrice - openPrice, 6)

    const zoomedHeadline = canvasElement.querySelector(
      '[data-slot="stock-quote-price"]',
    )?.textContent
    cursor.focus()
    await fireEvent.keyDown(cursor, { key: "Home" })
    await waitFor(async () => {
      await expect(
        canvasElement.querySelector('[data-slot="stock-quote-price"]')
          ?.textContent,
      ).not.toBe(zoomedHeadline)
    })
    await fireEvent.keyDown(cursor, { key: "Escape" })

    // Releasing the cursor restores the live price.
    await userEvent.tab()
    await waitFor(async () => {
      await expect(canvas.getByText(live)).toBeInTheDocument()
    })

    // The chart type control switches the plot in place.
    await userEvent.click(canvas.getByRole("button", { name: "Candles" }))
    await waitFor(async () => {
      await expect(
        canvasElement.querySelector('[data-slot="price-chart"]'),
      ).toHaveAttribute("data-view", "candle")
    })

    // Picking a range redraws the chart from that window's own bars, and
    // still tells the host which window is showing.
    const barsBefore = canvas.getByRole("slider").getAttribute("aria-valuemax")
    await userEvent.click(canvas.getByRole("button", { name: "1M" }))
    await expect(args.onRangeChange).toHaveBeenCalledWith("1M")
    await waitFor(async () => {
      await expect(
        canvas.getByRole("slider").getAttribute("aria-valuemax"),
      ).not.toBe(barsBefore)
    })
    await expect(canvas.getByRole("slider")).toHaveAttribute(
      "aria-valuemax",
      String(WINDOWS["1M"].length - 1),
    )
  },
}

export const Phone: Story = {
  args: {
    symbol: "HOOD",
    name: "Robinhood Markets",
    price: LAST,
    previousClose: WINDOW_CLOSES,
    series: WINDOWS,
    status: "delayed",
    stats: [
      { label: "Open", value: `$${SESSION[0]?.open?.toFixed(2)}` },
      { label: "Volume", value: "37.2M" },
    ],
  },
  parameters: storyDocumentation(
    "The same panel in a phone-width box. The layout answers to its own container rather than the viewport, so the figures fall to two columns and the padding tightens without the host writing a media query. Scrubbing here is a press-and-drag: a vertical swipe still scrolls the page.",
  ),
  render: (args) => (
    <div className="h-[32rem] w-[375px] max-w-full">
      <StockQuote {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const stats = canvasElement.querySelector('[data-slot="stock-quote-stats"]')
    await expect(stats).toBeInTheDocument()
    await expect(canvas.getByText("Delayed")).toBeInTheDocument()
  },
}

export const Watchlist: Story = {
  args: {
    symbol: WATCHLIST[0]?.symbol as string,
    price: WATCHLIST[0]?.price as number,
    series: WATCHLIST[0]?.series ?? [],
    // Every card below is built from its own row; these satisfy the required
    // props on the story's own type and are not what the story renders.
    ranges: [],
    status: "live",
  },
  parameters: storyDocumentation(
    "Three panels in a responsive grid, the shape an agent answering “how did my watchlist do today?” produces. Each card sizes its own chart, and each takes its colour from its own data — no shared tone, no per-card configuration. The ranges are dropped here because one control above the grid would own them in a real screen.",
  ),
  render: () => (
    <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
      {WATCHLIST.map((entry) => (
        <StockQuote
          key={entry.symbol}
          symbol={entry.symbol}
          name={entry.name}
          price={entry.price}
          previousClose={entry.previousClose}
          series={entry.series}
          ranges={[]}
          status="live"
          className="h-72"
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("slider")).toHaveLength(3)
    await expect(canvas.getByText("NVDA")).toBeInTheDocument()
  },
}

/**
 * Replays the recorded session one bar at a time, the way an agent hands the
 * panel each quote as it arrives. The replay is deterministic — the same bars
 * in the same order — so the story never drifts between runs.
 */
function StreamingQuote() {
  const [barCount, setBarCount] = React.useState(40)
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setBarCount((current) => Math.min(SESSION.length, current + 1))
    }, 700)
    return () => window.clearInterval(timer)
  }, [])
  const series = SESSION.slice(0, barCount)
  const price = series[series.length - 1]?.close as number

  return (
    <StockQuote
      symbol="HOOD"
      name="Robinhood Markets"
      price={price}
      previousClose={SESSION[0]?.open}
      series={series}
      status={barCount < SESSION.length ? "live" : "closed"}
      ranges={[]}
      className="h-[26rem]"
    />
  )
}

export const Streaming: Story = {
  // The replay owns every prop, so the story renders `StreamingQuote` rather
  // than the args; these satisfy the required props on the story's type.
  args: {
    symbol: "HOOD",
    price: LAST,
    series: SESSION,
  },
  parameters: storyDocumentation(
    "A quote arriving bar by bar, which is how an agent drives this panel: it holds the series it has fetched, appends each new print, and lets the panel redraw. The headline price, the change, and the market colour all follow the last bar, and a window drawn on the chart survives the prints that land under it — the bars it names are still the same bars. The play test zooms into a window, waits for more prints, proves the window did not move, then clears it onto a series that has grown.",
  ),
  render: () => (
    <div className="w-full max-w-2xl">
      <StreamingQuote />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cursor = canvas.getByRole("slider")
    const startingBars = Number(cursor.getAttribute("aria-valuemax"))
    await expect(startingBars).toBe(39)

    // A window drawn on a live feed has to survive the prints that arrive
    // under it: the bars it names are still the same bars.
    const bounds = cursor.getBoundingClientRect()
    const at = (ratio: number) => ({
      pointerId: 1,
      pointerType: "mouse",
      clientX: bounds.left + bounds.width * ratio,
      clientY: bounds.top + bounds.height / 2,
    })
    await fireEvent.pointerDown(cursor, at(0.2))
    await fireEvent.pointerMove(cursor, at(0.6))
    await fireEvent.pointerUp(cursor, at(0.6))
    await waitFor(async () => {
      await expect(
        Number(cursor.getAttribute("aria-valuemin")),
      ).toBeGreaterThan(0)
    })
    const zoomedMin = cursor.getAttribute("aria-valuemin")
    const zoomedMax = cursor.getAttribute("aria-valuemax")

    // Long enough for two more prints to land under the open window.
    await new Promise((resolve) => {
      setTimeout(resolve, 1600)
    })
    await expect(cursor).toHaveAttribute("aria-valuemin", zoomedMin as string)
    await expect(cursor).toHaveAttribute("aria-valuemax", zoomedMax as string)

    // Clearing it returns to the full series, which by now has grown.
    await userEvent.click(canvas.getByRole("button", { name: "Clear selection" }))
    await waitFor(
      async () => {
        await expect(
          Number(cursor.getAttribute("aria-valuemax")),
        ).toBeGreaterThan(startingBars)
      },
      { timeout: 5000 },
    )
  },
}

export const Website: Story = {
  args: {
    symbol: "HOOD",
    name: "Robinhood Markets",
    price: LAST,
    previousClose: WINDOW_CLOSES,
    series: WINDOWS,
    status: "live",
  },
  parameters: {
    layout: "fullscreen",
    ...storyDocumentation(
      "The panel at page scale, the way a desk or a marketing site would run it: a full-bleed section with the quote taking the main column and a watchlist beside it. It is the same component as the phone card — only the box it is given changes — and at this width the scales, the range tabs and the drag-to-zoom all have room to work.",
    ),
  },
  render: (args) => (
    <div className="min-h-dvh w-full bg-background p-6 font-sans text-foreground @container md:p-10">
      <header className="mx-auto mb-6 flex w-full max-w-6xl items-baseline justify-between gap-4">
        {/* A heading, not the page's own `h1`: this canvas is embedded in a
            docs page that already owns that level. */}
        <h2 className="m-0 nessa-text-7 font-semibold">Markets</h2>
        <p className="m-0 nessa-text-3 text-muted-foreground">
          Prices delayed by up to 15 minutes
        </p>
      </header>
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <StockQuote {...args} className="h-[34rem]" />
        <aside className="flex min-w-0 flex-col gap-4">
          {WATCHLIST.slice(1).map((entry) => (
            <StockQuote
              key={entry.symbol}
              symbol={entry.symbol}
              name={entry.name}
              price={entry.price}
              previousClose={entry.previousClose}
              series={entry.series}
              ranges={[]}
              status="live"
              className="h-64"
            />
          ))}
        </aside>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const main = canvas.getAllByRole("slider")[0] as HTMLElement

    // Every range tab redraws the main chart from its own window.
    for (const [range, bars] of [
      ["1Y", WINDOWS["1Y"]],
      ["3M", WINDOWS["3M"]],
      ["ALL", WINDOWS.ALL],
    ] as const) {
      await userEvent.click(canvas.getByRole("button", { name: range }))
      await waitFor(async () => {
        await expect(main).toHaveAttribute(
          "aria-valuemax",
          String(bars.length - 1),
        )
      })
    }
  },
}
