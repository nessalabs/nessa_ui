import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
import { TimelineHeader, TimelineHeaderCell } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Agents/TimelineHeader",
  component: TimelineHeader,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The band a horizontal scale lives on: pixel-offset cells with hairline dividers, and labels that pin at a chosen inset while any part of their cell is in view. Born as the GanttChart's two-tier time header and extracted — like PopoverSurface and SegmentedControl before it — so any horizontally scrolled surface (rulers, grouped table headers, audio timelines) can reuse the layout. The band is purely presentational: the consumer owns the scroll container, tier heights, and whether the scale is aria-hidden decoration.",
      },
    },
  },
} satisfies Meta<typeof TimelineHeader>

export default meta
type Story = StoryObj<typeof meta>

/** Four quarters of pixel-offset cells over a day-tick tier. */
const QUARTERS = [
  { label: "Q1 2026", start: 0, width: 720 },
  { label: "Q2 2026", start: 720, width: 728 },
  { label: "Q3 2026", start: 1448, width: 736 },
  { label: "Q4 2026", start: 2184, width: 736 },
]

export const PinnedScale: Story = {
  parameters: storyDocumentation(
    "A two-tier ruler inside an ordinary horizontal scroller: quarter labels pin eight pixels from the viewport's left edge while any part of their quarter is in view, and week ticks scroll freely underneath. The play test scrolls the container past a quarter's own left edge and proves the pin by measured positions — the label holds at the inset while its cell's edge has left the viewport — then confirms the label yields once its quarter runs out.",
  ),
  render: () => (
    <div
      data-testid="scale-scroller"
      role="region"
      aria-label="2026 delivery ruler"
      tabIndex={0}
      className="w-[720px] max-w-full overflow-x-auto rounded-lg border border-border outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <TimelineHeader
        aria-hidden="true"
        style={{ width: 2920, height: 44 }}
        className="border-b border-border bg-background"
      >
        {QUARTERS.map((quarter) => (
          <TimelineHeaderCell
            key={quarter.label}
            start={quarter.start}
            width={quarter.width}
            pinLabelInset={8}
            className="top-0 h-5 px-2 font-medium"
          >
            {quarter.label}
          </TimelineHeaderCell>
        ))}
        {Array.from({ length: 73 }, (_, index) => (
          <TimelineHeaderCell
            key={`week-${index}`}
            start={index * 40}
            width={40}
            className="bottom-0 h-6 justify-center"
          >
            <span className="truncate">{index + 1}</span>
          </TimelineHeaderCell>
        ))}
      </TimelineHeader>
      <div className="h-16 w-[2920px] bg-muted/30" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scroller = canvas.getByTestId("scale-scroller")
    const q1 = canvas.getByText("Q1 2026")

    // Scroll well past Q1's left edge: its label pins at the 8px inset
    // even though the cell's own edge is far off-screen.
    scroller.scrollLeft = 400
    await waitFor(async () => {
      const scrollerLeft = scroller.getBoundingClientRect().left
      const labelLeft = q1.getBoundingClientRect().left
      // The 8px inset, give or take the cell's own hairline border.
      await expect(Math.abs(labelLeft - scrollerLeft - 8)).toBeLessThanOrEqual(
        2,
      )
      await expect(
        (q1.parentElement as HTMLElement).getBoundingClientRect().left,
      ).toBeLessThan(scrollerLeft)
    })

    // Once Q1 has almost run out, the label yields with its cell rather
    // than overlapping Q2's territory.
    scroller.scrollLeft = 700
    await waitFor(async () => {
      const scrollerLeft = scroller.getBoundingClientRect().left
      await expect(
        q1.getBoundingClientRect().left - scrollerLeft,
      ).toBeLessThan(8)
    })

    // The unpinned tick tier scrolls freely: tick 1 is long gone.
    const tick = canvas.getByText("1", { selector: "span" })
    await expect(tick.getBoundingClientRect().right).toBeLessThan(
      scroller.getBoundingClientRect().left,
    )
  },
}
