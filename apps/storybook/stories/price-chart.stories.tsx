import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  expect,
  fireEvent,
  userEvent,
  waitFor,
  within,
} from "storybook/test"
import { PriceChart } from "@nessa-ui/react"

import { candleSeries, priceSeries, SESSION_START } from "./market-demo-data"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/PriceChart",
  component: PriceChart,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A price plot in the language brokerage apps use: one hairline stroke in the market's colour, a dotted reference rule, a price scale down the right edge over faint gridlines, a time scale along the bottom, and a cursor that follows a finger, a pointer, or the arrow keys across the series. Switching the view to candles draws open/high/low/close bars over the same scale; dragging across the plot zooms into that window and re-labels both scales for it. The chart fills the box its host gives it and re-measures on resize, so one element serves a phone-width card and a full-width desk layout.",
      },
    },
  },
} satisfies Meta<typeof PriceChart>

export default meta
type Story = StoryObj<typeof meta>

/** Five-minute bars through one rising session. */
const INTRADAY = priceSeries({
  seed: 7,
  count: 78,
  start: 96.4,
  startTime: SESSION_START,
  stepMs: 5 * 60 * 1000,
  drift: 0.0009,
})

/** The same session inverted, for the losing tone. */
const DECLINE = priceSeries({
  seed: 21,
  count: 78,
  start: 132.4,
  startTime: SESSION_START,
  stepMs: 5 * 60 * 1000,
  drift: -0.0011,
})

const DAILY_CANDLES = candleSeries({
  seed: 11,
  count: 44,
  start: 88,
  startTime: Date.UTC(2026, 5, 1),
  stepMs: 24 * 60 * 60 * 1000,
  drift: 0.002,
})

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
})
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

export const Playground: Story = {
  parameters: storyDocumentation(
    "One session of trade prices with the previous close as the dotted baseline: the line and its wash take the gain colour because the last print sits above that close. The cursor is a real control — the play test tabs to it, walks it with the arrow keys, and reads back the announced time and price, then hovers the plot with a pointer to prove the same cursor follows the mouse.",
  ),
  args: {
    series: INTRADAY,
    baseline: 96.4,
    fill: true,
    live: true,
    formatValue: (value: number) => `$${value.toFixed(2)}`,
    formatTime: (time: number) => timeFormatter.format(new Date(time)),
  },
  render: (args) => (
    <div className="h-64 w-full max-w-3xl">
      <PriceChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cursor = canvas.getByRole("slider")

    cursor.focus()
    await expect(cursor).toHaveFocus()

    // With no cursor yet the control announces the newest bar, and the first
    // arrow press steps back from it.
    await expect(cursor).toHaveAttribute(
      "aria-valuenow",
      String(INTRADAY.length - 1),
    )
    await fireEvent.keyDown(cursor, { key: "ArrowLeft" })
    await expect(cursor).toHaveAttribute("aria-valuenow", "76")

    await fireEvent.keyDown(cursor, { key: "Home" })
    await expect(cursor).toHaveAttribute("aria-valuenow", "0")
    await expect(cursor).toHaveAttribute(
      "aria-valuetext",
      `${timeFormatter.format(new Date(SESSION_START))}, $${INTRADAY[0]?.value?.toFixed(2)}`,
    )

    // The crosshair marks the position and the reading is announced; the
    // time scale under the plot already prints where the cursor is.
    await expect(
      canvasElement.querySelector('[data-slot="price-chart-time-axis"]'),
    ).toHaveTextContent(timeFormatter.format(new Date(SESSION_START)))

    // A pointer moves the same cursor without pressing: the middle of the
    // plot resolves to the middle bar.
    const bounds = cursor.getBoundingClientRect()
    await fireEvent.pointerMove(cursor, {
      pointerType: "mouse",
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    })
    // Half a bar of sub-pixel rounding either way is still the middle.
    await waitFor(async () => {
      await expect(["38", "39"]).toContain(cursor.getAttribute("aria-valuenow"))
    })

    // The streaming marker sits on the newest bar, not merely somewhere.
    const marker = canvasElement.querySelector(
      '[data-slot="price-chart"] svg circle:not([class])',
    ) as SVGCircleElement
    await expect(Number(marker.getAttribute("cx"))).toBeGreaterThan(0)

    // Leaving the plot returns the cursor to the newest bar, which is where
    // the next arrow press starts.
    // React derives onPointerLeave from pointerout, so the pointer has to
    // actually move off the plot rather than be handed a synthetic leave.
    await userEvent.unhover(cursor)
    await waitFor(async () => {
      await expect(cursor).toHaveAttribute(
        "aria-valuenow",
        String(INTRADAY.length - 1),
      )
    })
  },
}

export const Candlesticks: Story = {
  parameters: storyDocumentation(
    "The same geometry drawn as open/high/low/close bars: each candle is toned by its own direction, so a red body inside a rising stretch stays legible. Candles are slot-centred rather than edge-to-edge, and the cursor resolves to the candle under the pointer. The play test walks to the last candle and reads its announced close.",
  ),
  args: {
    series: DAILY_CANDLES,
    view: "candle",
    formatValue: (value: number) => `$${value.toFixed(2)}`,
    formatTime: (time: number) => dayFormatter.format(new Date(time)),
  },
  render: (args) => (
    <div className="h-72 w-full max-w-3xl">
      <PriceChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cursor = canvas.getByRole("slider")
    const last = DAILY_CANDLES[DAILY_CANDLES.length - 1]

    cursor.focus()
    await fireEvent.keyDown(cursor, { key: "End" })
    await expect(cursor).toHaveAttribute(
      "aria-valuenow",
      String(DAILY_CANDLES.length - 1),
    )
    await expect(cursor).toHaveAttribute(
      "aria-valuetext",
      `${dayFormatter.format(new Date(last?.time as number))}, $${last?.close?.toFixed(2)}`,
    )
  },
}

export const Sparklines: Story = {
  parameters: storyDocumentation(
    "The same component at watchlist size. Each row hands the chart a small box, turns the scales off and turns scrubbing off, so the plot exposes itself as one labelled image instead of a control — the shape a dense list wants. The falling row takes the loss colour from its own data with no configuration.",
  ),
  args: { series: INTRADAY, scrubbable: false, axes: false },
  render: (args) => (
    <ul className="m-0 grid max-w-md list-none gap-1 p-0">
      {[
        { symbol: "HOOD", last: "$132.19", change: "+7.4%", series: INTRADAY },
        { symbol: "COIN", last: "$118.02", change: "−5.1%", series: DECLINE },
      ].map((row) => (
        <li
          key={row.symbol}
          className="grid grid-cols-[4rem_1fr_6rem] items-center gap-3 rounded-lg border border-border px-3 py-2"
        >
          <span className="nessa-text-4 font-semibold">{row.symbol}</span>
          <PriceChart
            {...args}
            series={row.series}
            aria-label={`${row.symbol} price history`}
            className="h-10 min-h-0"
          />
          <span className="grid justify-items-end nessa-text-4 tabular-nums">
            <span>{row.last}</span>
            {/* The sign carries direction without colour, which is the
                relief a bare plot owes when it has no header to read. */}
            <span className="nessa-text-2 text-muted-foreground">
              {row.change}
            </span>
          </span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("slider")).toBeNull()
    await expect(
      canvas.getByRole("img", { name: "COIN price history" }),
    ).toBeInTheDocument()
  },
}

export const ZoomToSelection: Story = {
  parameters: storyDocumentation(
    "Dragging across the plot draws a window — a shaded band with the span and the move across it — and releasing zooms the chart into it. The clear control in the corner (or Escape) returns to the full series; a keyboard user draws the same window with Shift+Arrow and commits it with Enter. The play test drags out a window, proves the chart re-plots on those bars alone, then clears it.",
  ),
  args: {
    series: INTRADAY,
    baseline: 96.4,
    fill: true,
    formatValue: (value: number) => `$${value.toFixed(2)}`,
    formatTime: (time: number) => timeFormatter.format(new Date(time)),
  },
  render: (args) => (
    <div className="h-64 w-full max-w-3xl">
      <PriceChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cursor = canvas.getByRole("slider")
    const bounds = cursor.getBoundingClientRect()
    const at = (ratio: number) => ({
      pointerId: 1,
      pointerType: "mouse",
      clientX: bounds.left + bounds.width * ratio,
      clientY: bounds.top + bounds.height / 2,
    })

    await expect(cursor).toHaveAttribute("aria-valuemin", "0")
    // The plot has to be measured before a press can resolve to a bar.
    await waitFor(async () => {
      await expect(
        canvasElement.querySelector('[data-slot="price-chart"] svg'),
      ).toBeInTheDocument()
    })

    await fireEvent.pointerDown(cursor, at(0.3))
    await fireEvent.pointerMove(cursor, at(0.65))

    // The band shows exactly two vertical rules — its own edges. The hover
    // crosshair stands down while a window is being drawn rather than
    // drawing a third line through it.
    const verticals = () =>
      [
        ...(canvasElement.querySelectorAll(
          '[data-slot="price-chart"] svg line',
        ) as NodeListOf<SVGLineElement>),
      ].filter(
        (line) => line.getAttribute("x1") === line.getAttribute("x2"),
      ).length
    await waitFor(async () => {
      await expect(verticals()).toBe(2)
    })

    // Dragged to the very end, the summary pulls back inside the plot
    // instead of running off it.
    await fireEvent.pointerMove(cursor, at(1))
    await waitFor(async () => {
      const summary = canvasElement.querySelector(
        '[data-slot="price-chart-selection-summary"]',
      ) as HTMLElement
      const plot = summary.parentElement as HTMLElement
      await expect(
        summary.getBoundingClientRect().right,
      ).toBeLessThanOrEqual(plot.getBoundingClientRect().right + 1)
    })
    await fireEvent.pointerMove(cursor, at(0.65))
    // Released off the plot entirely: a drag that ends anywhere still
    // commits, rather than leaving its band stranded on the chart.
    await fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 0,
      clientY: 0,
    })

    await waitFor(async () => {
      await expect(
        canvasElement.querySelector(
          '[data-slot="price-chart-selection-summary"]',
        ),
      ).toBeNull()
    })

    // The window becomes the whole plot: the cursor can now only reach the
    // bars inside it.
    await waitFor(async () => {
      await expect(
        Number(cursor.getAttribute("aria-valuemin")),
      ).toBeGreaterThan(0)
    })
    const zoomedMin = Number(cursor.getAttribute("aria-valuemin"))
    const zoomedMax = Number(cursor.getAttribute("aria-valuemax"))
    await expect(zoomedMax).toBeLessThan(INTRADAY.length - 1)
    await expect(zoomedMax - zoomedMin).toBeGreaterThan(1)

    // Clearing restores the full series and hands focus back to the cursor,
    // rather than dropping it on the body when the control unmounts itself.
    await userEvent.click(canvas.getByRole("button", { name: "Clear selection" }))
    await waitFor(async () => {
      await expect(cursor).toHaveAttribute("aria-valuemin", "0")
    })
    await expect(cursor).toHaveAttribute(
      "aria-valuemax",
      String(INTRADAY.length - 1),
    )
    await expect(cursor).toHaveFocus()

    // The same window by keyboard: Shift+Arrow draws it, Enter commits it,
    // Escape puts the whole series back.
    await fireEvent.keyDown(cursor, { key: "Home" })
    for (let step = 0; step < 6; step += 1) {
      await fireEvent.keyDown(cursor, { key: "ArrowRight", shiftKey: true })
    }
    await waitFor(async () => {
      await expect(
        canvasElement.querySelector(
          '[data-slot="price-chart-selection-summary"]',
        ),
      ).toBeInTheDocument()
    })
    await fireEvent.keyDown(cursor, { key: "Enter" })
    await waitFor(async () => {
      await expect(cursor).toHaveAttribute("aria-valuemax", "6")
    })
    await fireEvent.keyDown(cursor, { key: "Escape" })
    await waitFor(async () => {
      await expect(cursor).toHaveAttribute(
        "aria-valuemax",
        String(INTRADAY.length - 1),
      )
    })

    // Shift+End extends the window in progress rather than discarding it:
    // the anchor stays where the walk began, so the committed window starts
    // there and not at the bar Home left the cursor on.
    await fireEvent.keyDown(cursor, { key: "Home" })
    for (let step = 0; step < 10; step += 1) {
      await fireEvent.keyDown(cursor, { key: "ArrowRight" })
    }
    await fireEvent.keyDown(cursor, { key: "ArrowRight", shiftKey: true })
    await fireEvent.keyDown(cursor, { key: "End", shiftKey: true })
    await fireEvent.keyDown(cursor, { key: "Enter" })
    await waitFor(async () => {
      await expect(cursor).toHaveAttribute("aria-valuemin", "10")
    })
    await expect(cursor).toHaveAttribute(
      "aria-valuemax",
      String(INTRADAY.length - 1),
    )
  },
}

export const NoData: Story = {
  parameters: storyDocumentation(
    "An empty series still occupies its box and says so, rather than collapsing or drawing an axis for prices that do not exist. The cursor stays present but disabled, so a keyboard user who reaches it hears the same thing the plot shows.",
  ),
  args: { series: [] },
  render: (args) => (
    <div className="h-48 w-full max-w-3xl">
      <PriceChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No price data")).toBeInTheDocument()
    const cursor = canvas.getByRole("slider")
    await expect(cursor).toHaveAttribute("aria-disabled", "true")
    await expect(cursor).toHaveAttribute("aria-valuetext", "No price data")
    // No scale is printed for an empty plot.
    await expect(
      canvasElement.querySelector('[data-slot="price-chart-value-axis"]')
        ?.textContent,
    ).toBe("")
  },
}
