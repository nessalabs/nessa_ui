import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
import { Sparkline, type ChartPoint } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Charts/Sparkline",
  component: Sparkline,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A small chart sized by its container — give it a height with a class, or size its parent. The **step** variant draws the best value so far: it keeps the running maximum when `better` is `up` and the running minimum when it is `down`, so the line only ever moves in the direction of improvement and steps exactly where a point set a new record. The **line** variant joins every point. Optional dots mark the record-setting points (`markers=\"records\"`) or every point with the records drawn stronger (`markers=\"all\"`), plus where the line ends; `reference` draws a dashed horizontal line at a value that is always kept in range, and `yDomain` pins the range so a column of sparklines shares one scale. The line takes the current text colour, so a text utility tints it. It is not interactive. The host names it with `aria-label`; without a name it is treated as decoration and hidden from assistive technology.",
      },
    },
  },
} satisfies Meta<typeof Sparkline>

export default meta
type Story = StoryObj<typeof meta>

/** Pixel y of every vertical move in a step path, in drawing order. */
function verticalMoves(d: string) {
  return [...d.matchAll(/V(-?[\d.]+)/g)].map((match) => Number(match[1]))
}

/** The drawn line, once the sparkline has measured its box. */
async function drawnLine(canvasElement: HTMLElement) {
  return waitFor(() => {
    const line = canvasElement.querySelector<SVGPathElement>(
      '[data-slot="sparkline-line"]',
    )
    expect(line).not.toBeNull()
    return line!
  })
}

/** Scores across attempts: noisy, with a best that climbs in steps. */
const CLIMB: ChartPoint[] = [
  { x: 1, y: 61.2 },
  { x: 2, y: 59.8 },
  { x: 3, y: 64.5 },
  { x: 4, y: 63.1 },
  { x: 5, y: 64.5 },
  { x: 6, y: 68.9 },
  { x: 7, y: 66.0 },
  { x: 8, y: 67.4 },
  { x: 9, y: 71.3 },
  { x: 10, y: 70.2 },
]

export const BestSoFar: Story = {
  parameters: storyDocumentation(
    "The best score so far over ten attempts, with every attempt as a dot and the four that set a record drawn stronger, against a dashed reference at 75. A tie with the best (attempt 5) is not a record, so it draws no step. The play test proves the line only ever rises, that exactly the four records are marked as such, and that the reference sits above the whole line.",
  ),
  args: {
    points: CLIMB,
    markers: "all",
    reference: 75,
    "aria-label": "Best score by attempt: 61.2 at the start, 71.3 now, target 75",
  },
  render: (args) => (
    <div className="w-72">
      <Sparkline {...args} className="h-14 text-(--nessa-chart-series-1-strong)" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("img", { name: /^Best score by attempt/ })
    const line = await drawnLine(canvasElement)
    const moves = verticalMoves(line.getAttribute("d")!)
    // Records at attempts 3, 6 and 9 after the start: three steps, each higher
    // on screen (a smaller pixel y) than the last.
    await expect(moves).toHaveLength(3)
    for (let index = 1; index < moves.length; index += 1) {
      await expect(moves[index]!).toBeLessThan(moves[index - 1]!)
    }
    const markers = canvasElement.querySelectorAll('[data-slot="sparkline-marker"]')
    await expect(markers).toHaveLength(CLIMB.length)
    const records = canvasElement.querySelectorAll(
      '[data-slot="sparkline-marker"][data-record="true"]',
    )
    await expect(records).toHaveLength(4)
    const reference = canvasElement.querySelector('[data-slot="sparkline-reference"]')!
    await expect(Number(reference.getAttribute("y1"))).toBeLessThan(Math.min(...moves))
    await expect(canvasElement.querySelector('[data-slot="sparkline-end"]')).not.toBeNull()
  },
}

/** Response times after each change: lower is better. */
const LATENCY: ChartPoint[] = [
  { x: 0, y: 840 },
  { x: 1, y: 910 },
  { x: 2, y: 760 },
  { x: 3, y: 780 },
  { x: 4, y: 610 },
  { x: 5, y: 655 },
  { x: 6, y: 540 },
  { x: 7, y: 590 },
]

export const Descending: Story = {
  parameters: storyDocumentation(
    "`better=\"down\"` keeps the running minimum instead: a response time after each change, where every record is a new low, so the step line only ever falls. Only the records are marked. The play test reads the path and proves every vertical move goes down the screen, that it starts at the first point and runs to the last, and that the regressions (910, 780, 655, 590) draw no step.",
  ),
  args: {
    points: LATENCY,
    better: "down",
    markers: "records",
    "aria-label": "Fastest response so far: 840 ms at the start, 540 ms now",
  },
  render: (args) => (
    <div className="w-72">
      <Sparkline {...args} className="h-14 text-(--nessa-chart-series-6-strong)" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const root = await canvas.findByRole("img", { name: /^Fastest response so far/ })
    await expect(root).toHaveAttribute("data-better", "down")
    const line = await drawnLine(canvasElement)
    const d = line.getAttribute("d")!
    const moves = verticalMoves(d)
    // New lows at 760, 610 and 540.
    await expect(moves).toHaveLength(3)
    for (let index = 1; index < moves.length; index += 1) {
      await expect(moves[index]!).toBeGreaterThan(moves[index - 1]!)
    }
    const width = root.getBoundingClientRect().width
    const start = Number(/^M(-?[\d.]+)/.exec(d)![1])
    const end = Number(/H(-?[\d.]+)$/.exec(d)![1])
    await expect(start).toBeLessThan(8)
    await expect(end).toBeGreaterThan(width - 8)
    const records = canvasElement.querySelectorAll('[data-slot="sparkline-marker"]')
    await expect(records).toHaveLength(4)
    for (const record of records) {
      await expect(record).toHaveAttribute("data-record", "true")
    }
  },
}

/** Requests per minute across a day, sampled hourly. */
const TRAFFIC: ChartPoint[] = [
  220, 180, 150, 140, 160, 240, 420, 610, 700, 680, 650, 720, 690, 640, 600,
  590, 630, 710, 660, 520, 430, 350, 290, 250,
].map((y, x) => ({ x, y }))

export const Line: Story = {
  parameters: storyDocumentation(
    "`variant=\"line\"` joins every point in order, for a series whose shape matters more than its best. Without an `aria-label` the sparkline is decoration — here it sits beside a figure that already states the value — so it is hidden from assistive technology. The play test proves every point is joined and the decorative sparkline is hidden.",
  ),
  args: { points: TRAFFIC, variant: "line" },
  render: (args) => (
    <div className="flex w-80 items-center gap-3 font-sans">
      <div className="flex flex-col">
        <span className="nessa-text-2 text-muted-foreground">Requests / min</span>
        <span className="nessa-text-5 font-medium tabular-nums">250</span>
      </div>
      <Sparkline {...args} className="h-10 flex-1 text-muted-foreground" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="sparkline"]')!
    await expect(root).toHaveAttribute("aria-hidden", "true")
    await expect(root).not.toHaveAttribute("role")
    const line = await drawnLine(canvasElement)
    const segments = line.getAttribute("d")!.match(/L/g) ?? []
    await expect(segments).toHaveLength(TRAFFIC.length - 1)
    await expect(canvasElement.querySelector('[data-slot="sparkline-marker"]')).toBeNull()
  },
}

export const SharedScale: Story = {
  parameters: storyDocumentation(
    "`yDomain` pins the value range, so a column of sparklines is compared by eye on one scale rather than each stretching to fill its own box. The play test proves the same score lands at the same height in both rows.",
  ),
  args: { points: CLIMB },
  render: () => (
    <div className="flex w-72 flex-col gap-3 font-sans">
      {[
        { name: "Team A", points: CLIMB },
        { name: "Team B", points: CLIMB.map((point) => ({ ...point, y: point.y - 12 })) },
      ].map((row) => (
        <div key={row.name} className="flex items-center gap-3">
          <span className="w-16 nessa-text-2 text-muted-foreground">{row.name}</span>
          <Sparkline
            points={row.points}
            yDomain={[40, 80]}
            reference={61.2}
            aria-label={`${row.name} best score by attempt`}
            className="h-12 flex-1"
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("img", { name: "Team A best score by attempt" })
    await drawnLine(canvasElement)
    const references = canvasElement.querySelectorAll('[data-slot="sparkline-reference"]')
    await expect(references).toHaveLength(2)
    await expect(references[0]!.getAttribute("y1")).toBe(references[1]!.getAttribute("y1"))
  },
}
