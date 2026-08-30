import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, within } from "storybook/test"
import { StackedBarChart } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

/** "10:00", "10:05", … — five-minute ticks starting at 10:00. */
const timeLabel = (index: number) => {
  const minutes = 600 + index * 5
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

const cpuServices = [
  { id: "gateway", label: "gateway" },
  { id: "indexer", label: "indexer" },
  { id: "postgres", label: "postgres" },
]

// Deterministic shapes: the gateway breathes with request load, the indexer
// runs a hot multi-core reindex burst mid-window that pushes the stack past
// the pinned 100% axis, postgres idles along the bottom.
const cpuSamples = Array.from({ length: 40 }, (_, index) => ({
  key: timeLabel(index),
  values: {
    gateway: 14 + 9 * Math.sin(index / 4) + (index % 5),
    indexer:
      index > 21 && index < 30
        ? 95 + 3 * Math.sin(index)
        : 8 + 4 * Math.cos(index / 3) + 4,
    postgres: 6 + 2 * Math.sin(index / 2) + 2,
  },
}))

const formatPercent = (value: number) => `${Math.round(value)}%`

const meta = {
  title: "Components/StackedBarChart",
  component: StackedBarChart,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A categorical stacked-bar history chart: thin columns over ordered samples, segments stacked bottom-up in fixed series order with hairline surface gaps, recessive gridlines at zero, midpoint, and the ceiling, and a required legend. A series' index picks its color slot (`--nessa-chart-1` through `--nessa-chart-6`) and zero values leave that mapping alone — keep the series array stable and zero out a filtered series' values, so the surviving series keep their colors. Hovering with a fine pointer or tabbing to a column highlights its track and opens a per-series breakdown on the popover surface; the same breakdown is the column's accessible description.",
      },
    },
  },
  args: {
    label: "CPU usage by service",
    series: cpuServices,
    samples: cpuSamples,
    formatValue: formatPercent,
  },
} satisfies Meta<typeof StackedBarChart>

export default meta
type Story = StoryObj<typeof meta>

export const CpuByService: Story = {
  parameters: storyDocumentation(
    "Canopy's per-service CPU panel: one column per sample against a pinned 0–100% axis. Hover a column with the mouse, or tab onto it, to read the per-service breakdown and stack total. The mid-window reindex burst runs past 100% of a core, and the chart compresses that stack to the axis instead of overflowing the plot — the tooltip still reports the raw values.",
  ),
  render: () => (
    <div className="w-[36rem]">
      <StackedBarChart
        label="CPU usage by service"
        series={cpuServices}
        samples={cpuSamples}
        formatValue={formatPercent}
        max={100}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chart = canvas.getByRole("group", { name: "CPU usage by service" })
    const columns = within(chart).getAllByRole("img")
    await expect(columns).toHaveLength(40)

    // Each column narrates its full breakdown to assistive technology.
    await expect(columns[8]).toHaveAccessibleName(
      /10:40: gateway \d+%, indexer \d+%, postgres \d+%, total \d+%/,
    )

    // Keyboard focus opens the same breakdown tooltip hover does. The
    // unfocused test frame swallows the focus events a real keyboard user
    // produces, so the play dispatches them alongside the focus move.
    columns[8].focus()
    await fireEvent.focusIn(columns[8])
    await expect(canvas.getByText("10:40")).toBeVisible()
    await expect(canvas.getByText("Total")).toBeVisible()
    columns[8].blur()
    await fireEvent.focusOut(columns[8])
    await expect(canvas.queryByText("10:40")).not.toBeInTheDocument()

    await userEvent.hover(columns[20])
    await expect(canvas.getByText("11:40")).toBeVisible()
    await userEvent.unhover(columns[20])
    await expect(canvas.queryByText("11:40")).not.toBeInTheDocument()

    // The gridline labels stay on the fixed ceiling.
    await expect(canvas.getByText("100%")).toBeVisible()
    await expect(canvas.getByText("50%")).toBeVisible()

    // Fixed slots: the first series' bottom segment wears chart slot 1.
    const firstSegment = columns[0].querySelector(
      '[data-slot="stacked-bar-chart-segment"]',
    )
    await expect(firstSegment).toHaveClass("bg-(--nessa-chart-1)")

    // The burst stack exceeds the pinned axis, so its segment heights are
    // compressed to sum to exactly the plot height; a calm column stays
    // proportional and below it.
    const segmentHeights = (column: HTMLElement) =>
      Array.from(
        column.querySelectorAll<HTMLElement>(
          '[data-slot="stacked-bar-chart-segment"]',
        ),
      ).reduce((sum, segment) => sum + parseFloat(segment.style.height), 0)
    await expect(segmentHeights(columns[25])).toBeCloseTo(100, 3)
    await expect(segmentHeights(columns[0])).toBeLessThan(100)
  },
}

const memoryServices = [
  { id: "gateway", label: "gateway" },
  { id: "indexer", label: "indexer" },
  { id: "postgres", label: "postgres" },
  { id: "redis", label: "redis" },
]

// Mebibytes: slow indexer growth toward a flush, everything else steady.
const memorySamples = Array.from({ length: 32 }, (_, index) => ({
  key: timeLabel(index),
  values: {
    gateway: 320 + 12 * Math.sin(index / 3),
    indexer: 540 + index * 22 - (index > 25 ? (index - 25) * 90 : 0),
    postgres: 880 + 8 * Math.sin(index / 5),
    redis: 140,
  },
}))

const formatMebibytes = (value: number) =>
  value >= 1024 ? `${(value / 1024).toFixed(1)} GiB` : `${Math.round(value)} MiB`

const currentMemory = memorySamples[memorySamples.length - 1].values

export const MemoryByService: Story = {
  parameters: storyDocumentation(
    "The memory panel leans on the defaults: the ceiling snaps to a nice round value above the largest stack, and legendValue puts each service's current reading beside its name, so the legend doubles as a live readout while the columns carry the history.",
  ),
  render: () => (
    <div className="w-[36rem]">
      <StackedBarChart
        label="Memory usage by service"
        series={memoryServices}
        samples={memorySamples}
        formatValue={formatMebibytes}
        legendValue={(seriesId) =>
          formatMebibytes(currentMemory[seriesId as keyof typeof currentMemory])
        }
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chart = canvas.getByRole("group", { name: "Memory usage by service" })
    await expect(within(chart).getAllByRole("img")).toHaveLength(32)

    // The default ceiling snaps to the nice value above the largest stack
    // (about 2433 MiB here), and the top gridline label formats it.
    await expect(canvas.getByText("2.4 GiB")).toBeVisible()

    // The legend pairs every series chip with its current reading, and the
    // fourth series' chip wears the fourth chart slot.
    const legendItems = within(chart).getAllByRole("listitem")
    await expect(legendItems).toHaveLength(4)
    await expect(legendItems[3]).toHaveTextContent("redis")
    await expect(legendItems[3]).toHaveTextContent(formatMebibytes(140))
    await expect(legendItems[3].querySelector("span")).toHaveClass(
      "bg-(--nessa-chart-4)",
    )
  },
}

const sloServices = [
  { id: "gateway", label: "gateway" },
  { id: "indexer", label: "indexer" },
  { id: "postgres", label: "postgres" },
  { id: "redis", label: "redis" },
  { id: "scheduler", label: "scheduler" },
  { id: "vector-store", label: "vector-store" },
  // Beyond the six chart-token slots: deliberately ignored by the chart.
  { id: "overflow", label: "overflow" },
]

const sloSamples = Array.from({ length: 16 }, (_, index) => ({
  key: timeLabel(index),
  values: Object.fromEntries(
    sloServices.map((service, slot) => [
      service.id,
      8 + slot * 2 + 3 * Math.sin(index / 2 + slot),
    ]),
  ),
}))

export const AllSixSlots: Story = {
  parameters: storyDocumentation(
    "The full categorical palette: six services occupy the six fixed chart-token slots, bottom-up in declaration order. The palette is the hard ceiling — a seventh series is ignored rather than given a generated color, so an overloaded panel degrades predictably instead of inventing hues.",
  ),
  render: () => (
    <div className="w-[36rem]">
      <StackedBarChart
        label="CPU usage across all services"
        series={sloServices}
        samples={sloSamples}
        formatValue={formatPercent}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chart = canvas.getByRole("group", {
      name: "CPU usage across all services",
    })
    // Six slots render; the seventh series is dropped, not recolored — it
    // is absent from the legend, the breakdown, and the stack totals.
    const legendItems = within(chart).getAllByRole("listitem")
    await expect(legendItems).toHaveLength(6)
    await expect(legendItems[5].querySelector("span")).toHaveClass(
      "bg-(--nessa-chart-6)",
    )
    await expect(canvas.queryByText("overflow")).not.toBeInTheDocument()
    const columns = within(chart).getAllByRole("img")
    await expect(columns[0].getAttribute("aria-label")).not.toContain(
      "overflow",
    )
  },
}

export const Empty: Story = {
  parameters: storyDocumentation(
    "Before the first sample arrives the plot keeps its reserved height and shows the empty message in muted ink, while the legend already names the series in their fixed colors — so the panel does not reflow when data starts streaming.",
  ),
  render: () => (
    <div className="w-[36rem]">
      <StackedBarChart
        label="CPU usage by service"
        series={cpuServices}
        samples={[]}
        formatValue={formatPercent}
        emptyMessage="Waiting for the first sample"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chart = canvas.getByRole("group", { name: "CPU usage by service" })
    await expect(
      within(chart).getByText("Waiting for the first sample"),
    ).toBeVisible()
    await expect(within(chart).queryAllByRole("img")).toHaveLength(0)
    // The legend still names every series while the plot waits.
    await expect(within(chart).getAllByRole("listitem")).toHaveLength(3)
  },
}
