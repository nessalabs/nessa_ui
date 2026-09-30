import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChartTooltip,
  linearScale,
  niceTicks,
  stepPath,
  type ChartPoint,
  type ChartTooltipSide,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Charts/ChartTooltip",
  component: ChartTooltip,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A hover card for a point in a chart, on the popover surface. The host renders it inside the chart's positioned wrapper, passes the point in that wrapper's coordinates — the space its own scales already produce — and passes the **boundary** the card must stay inside: the pane, card or scroll area the chart sits in, as an element, a ref or a viewport rectangle, always intersected with the viewport. The card is told its boundary; it never searches its ancestors for one. It takes the preferred `side` of the point, **flips** to the opposite side when it would cross the boundary there, **shifts** along the edge to stay whole, and re-places itself when its content resizes or anything scrolls. It is not interactive: pointer events pass through to the chart. Content is `children`, so every string and number format is the host's.",
      },
    },
  },
} satisfies Meta<typeof ChartTooltip>

export default meta
type Story = StoryObj<typeof meta>

/** Asserts the card lies wholly inside the boundary, padding included. */
async function expectInside(card: Element, boundary: Element, padding = 8) {
  const inner = card.getBoundingClientRect()
  const outer = boundary.getBoundingClientRect()
  // Half a pixel of slack for subpixel layout.
  await expect(inner.left).toBeGreaterThanOrEqual(outer.left + padding - 0.5)
  await expect(inner.top).toBeGreaterThanOrEqual(outer.top + padding - 0.5)
  await expect(inner.right).toBeLessThanOrEqual(outer.right - padding + 0.5)
  await expect(inner.bottom).toBeLessThanOrEqual(outer.bottom - padding + 0.5)
}

interface EdgeCase {
  name: string
  /** Where the point sits, as fractions of the boundary. */
  at: { x: number; y: number }
  /** The side the card prefers — always the one that would leave the box. */
  side: ChartTooltipSide
  /** The side it must end up on. */
  flipsTo: ChartTooltipSide
}

const EDGES: EdgeCase[] = [
  { name: "Right edge", at: { x: 0.97, y: 0.12 }, side: "right", flipsTo: "left" },
  { name: "Left edge", at: { x: 0.03, y: 0.88 }, side: "left", flipsTo: "right" },
  { name: "Top edge", at: { x: 0.94, y: 0.04 }, side: "top", flipsTo: "bottom" },
  { name: "Bottom edge", at: { x: 0.06, y: 0.96 }, side: "bottom", flipsTo: "top" },
]

/** A small box that is both the chart's positioned wrapper and the card's boundary. */
function EdgeBox({ edge }: { edge: EdgeCase }) {
  const boundaryRef = React.useRef<HTMLDivElement>(null)
  const width = 256
  const height = 144
  const anchor = { x: edge.at.x * width, y: edge.at.y * height }
  return (
    <div
      ref={boundaryRef}
      data-testid={edge.name}
      className="relative rounded-lg border border-border bg-card"
      style={{ width, height }}
    >
      <span className="absolute left-2 top-2 nessa-text-2 text-muted-foreground">
        {edge.name}
      </span>
      <span
        aria-hidden="true"
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
        style={{ left: anchor.x, top: anchor.y }}
      />
      <ChartTooltip
        anchor={anchor}
        boundary={boundaryRef}
        side={edge.side}
        className="max-w-44"
      >
        <p className="m-0 font-medium">Prefers {edge.side}</p>
        <p className="m-0 text-muted-foreground">Flipped and shifted to stay inside the box.</p>
      </ChartTooltip>
    </div>
  )
}

export const EdgesOfABoundary: Story = {
  parameters: storyDocumentation(
    "A card at each edge of a small boundary, each preferring the side that would leave it, and each near a corner so the cross axis has to shift as well. The play test proves every card flipped to the opposite side and lies wholly inside its boundary, padding included.",
  ),
  args: { anchor: { x: 0, y: 0 } },
  render: () => (
    <div className="grid w-max grid-cols-2 gap-6 font-sans">
      {EDGES.map((edge) => (
        <EdgeBox key={edge.name} edge={edge} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const edge of EDGES) {
      const box = canvasElement.querySelector(`[data-testid="${edge.name}"]`)!
      const card = within(box as HTMLElement).getByRole("tooltip")
      await waitFor(() => expect(card).toHaveAttribute("data-placed", "true"))
      await expect(card).toHaveAttribute("data-side", edge.flipsTo)
      await expectInside(card, box)
    }
  },
}

/** Best score after each attempt, as a small domain chart would hold it. */
const ATTEMPTS: ChartPoint[] = [
  { x: 1, y: 42.5 },
  { x: 2, y: 47.1 },
  { x: 3, y: 45.8 },
  { x: 4, y: 53.0 },
  { x: 5, y: 51.2 },
  { x: 6, y: 58.4 },
  { x: 7, y: 57.9 },
  { x: 8, y: 61.7 },
]

/**
 * A host's own chart, assembled from the geometry helpers: round ticks over
 * the data's actual range, a best-so-far step line, and a dot per attempt that
 * shows a ChartTooltip bounded by the pane the chart sits in.
 */
function AttemptsChart() {
  const paneRef = React.useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = React.useState<ChartPoint | null>(null)
  const width = 300
  const height = 160
  const margin = { top: 12, right: 12, bottom: 12, left: 32 }
  const ticks = niceTicks(
    Math.min(...ATTEMPTS.map((point) => point.y)),
    Math.max(...ATTEMPTS.map((point) => point.y)),
    4,
  )
  const scale = {
    x: linearScale([1, ATTEMPTS.length], [margin.left, width - margin.right]),
    y: linearScale(
      [ticks[0]!, ticks[ticks.length - 1]!],
      [height - margin.bottom, margin.top],
    ),
  }
  return (
    <div
      ref={paneRef}
      data-testid="pane"
      className="w-max rounded-lg border border-border bg-card p-3 font-sans"
    >
      <p className="m-0 mb-2 nessa-text-2 text-muted-foreground">Best score by attempt</p>
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={scale.y(tick)}
                y2={scale.y(tick)}
                className="stroke-border"
              />
              <text
                x={margin.left - 6}
                y={scale.y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground nessa-text-1"
              >
                {tick}
              </text>
            </g>
          ))}
          <path
            d={stepPath(ATTEMPTS, scale, { better: "up" })}
            fill="none"
            strokeWidth={1.75}
            className="stroke-(--nessa-chart-series-1-strong)"
          />
        </svg>
        {ATTEMPTS.map((point) => (
          <button
            key={point.x}
            type="button"
            aria-label={`Attempt ${point.x}: ${point.y}`}
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left: scale.x(point.x), top: scale.y(point.y) }}
            onPointerEnter={() => setHovered(point)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(point)}
            onBlur={() => setHovered(null)}
          />
        ))}
        {hovered ? (
          <ChartTooltip
            anchor={{ x: scale.x(hovered.x), y: scale.y(hovered.y) }}
            boundary={paneRef}
          >
            <p className="m-0 text-muted-foreground">Attempt {hovered.x}</p>
            <p className="m-0 nessa-text-4 font-medium tabular-nums">{hovered.y.toFixed(1)}</p>
          </ChartTooltip>
        ) : null}
      </div>
    </div>
  )
}

export const InAChart: Story = {
  parameters: storyDocumentation(
    "A host's own chart built from the geometry helpers — `niceTicks` over the data's real range (40 to 65, not 0 to 100), `stepPath` deriving the best so far with `better: \"up\"` — with a ChartTooltip on every attempt, bounded by the card the chart sits in. The play test hovers the last attempt, whose preferred right-hand placement would leave the card, proves the tooltip flipped left and stays inside it, and proves it is gone once the pointer leaves.",
  ),
  args: { anchor: { x: 0, y: 0 } },
  render: () => <AttemptsChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const last = await canvas.findByRole("button", { name: "Attempt 8: 61.7" })
    await userEvent.hover(last)
    const card = await canvas.findByRole("tooltip")
    await waitFor(() => expect(card).toHaveAttribute("data-placed", "true"))
    await expect(card).toHaveAttribute("data-side", "left")
    await expect(card.textContent).toContain("61.7")
    await expectInside(card, canvas.getByTestId("pane"))

    await userEvent.unhover(last)
    await waitFor(() => expect(canvas.queryByRole("tooltip")).toBeNull())
  },
}
