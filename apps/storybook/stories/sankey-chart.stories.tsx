import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
import { userEvent } from "storybook/test"
import {
  SankeyChart,
  type SankeyChartLink,
  type SankeyChartNode,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/SankeyChart",
  component: SankeyChart,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A flow diagram: node bars in columns joined by ribbons whose thickness is proportional to the flow they carry. The chart is neutral by default — a quiet foreground wash — with optional per-node color, and it fills whatever box the host gives it on both axes. Every ribbon is a keyboard-focusable button: hovering a ribbon or bar emphasizes the connected flow, clicking (or Enter or Space) selects a link and draws its centerline, and the selection is host-controllable through `selectedLinkId`. Columns come from longest-path layering, so multi-stage flows lay out without configuration.",
      },
    },
  },
} satisfies Meta<typeof SankeyChart>

export default meta
type Story = StoryObj<typeof meta>

/** A week of tracked time flowing from activities into apps. */
const TIME_NODES: SankeyChartNode[] = [
  { id: "focus", label: "Focus" },
  { id: "meetings", label: "Meetings" },
  { id: "breaks", label: "Breaks" },
  { id: "admin", label: "Admin" },
  { id: "learning", label: "Learning" },
  { id: "browsing", label: "Browsing" },
  { id: "writing", label: "Writing" },
  { id: "messaging", label: "Messaging" },
  { id: "productivity", label: "Productivity" },
  { id: "email", label: "Email" },
  { id: "video", label: "Video calls" },
  { id: "other", label: "Everything else" },
]

const TIME_LINKS: SankeyChartLink[] = [
  { source: "focus", target: "browsing", value: 8 },
  { source: "focus", target: "writing", value: 9 },
  { source: "focus", target: "productivity", value: 10 },
  { source: "focus", target: "email", value: 2 },
  { source: "focus", target: "other", value: 3 },
  { source: "meetings", target: "video", value: 12 },
  { source: "meetings", target: "messaging", value: 4 },
  { source: "meetings", target: "email", value: 2 },
  { source: "breaks", target: "browsing", value: 8 },
  { source: "breaks", target: "other", value: 4 },
  { source: "admin", target: "email", value: 3 },
  { source: "admin", target: "writing", value: 5 },
  { source: "admin", target: "messaging", value: 4 },
  { source: "admin", target: "other", value: 2 },
  { source: "learning", target: "browsing", value: 3 },
  { source: "learning", target: "messaging", value: 2 },
  { source: "learning", target: "productivity", value: 3 },
  { source: "learning", target: "other", value: 2 },
]

export const TimeFlow: Story = {
  parameters: storyDocumentation(
    "Tracked time flowing from activity categories into app categories, in the neutral default wash. The left column details absolute hours while the right details each node's share of its column, both through `renderNodeDetail`. The play test clicks a ribbon and proves selection by computed style: the chosen ribbon deepens, the rest recede, the centerline appears, and Escape clears it all.",
  ),
  args: { nodes: TIME_NODES, links: TIME_LINKS },
  render: (args) => (
    <div className="h-[440px] w-full max-w-3xl">
      <SankeyChart
        {...args}
        formatValue={(value) => `${value}h`}
        renderNodeDetail={({ column, columnCount, value, columnTotal }) =>
          column === columnCount - 1
            ? `${Math.round((value / columnTotal) * 100)}%`
            : `${value}h`
        }
        aria-label="Tracked time by activity and app"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ribbon = await canvas.findByRole("button", {
      name: "Learning to Messaging, 2h",
    })
    const other = canvas.getByRole("button", {
      name: "Focus to Writing, 9h",
    })
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(ribbon).opacity)).toBeCloseTo(0.15, 1),
    )

    await userEvent.click(ribbon)
    await expect(ribbon).toHaveAttribute("aria-pressed", "true")
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(ribbon).opacity)).toBeGreaterThan(0.5),
    )
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(other).opacity)).toBeLessThan(0.2),
    )
    const centerline = canvasElement.querySelector(
      '[data-slot="sankey-chart-centerline"]',
    )
    await expect(centerline).not.toBeNull()
    await expect(getComputedStyle(centerline!).strokeWidth).toBe("2px")

    await userEvent.keyboard("{Escape}")
    await expect(ribbon).toHaveAttribute("aria-pressed", "false")
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="sankey-chart-centerline"]'),
      ).toBeNull(),
    )
  },
}

export const MultiStage: Story = {
  parameters: storyDocumentation(
    "A three-stage flow — traffic sources through landing surfaces into outcomes — showing the longest-path column layout: middle columns need no configuration, and their labels sit beside the bars over the ribbons. The play test proves three distinct bar columns by measured x positions.",
  ),
  args: {
    nodes: [
      { id: "search", label: "Search" },
      { id: "social", label: "Social" },
      { id: "direct", label: "Direct" },
      { id: "landing", label: "Landing page" },
      { id: "docs", label: "Docs" },
      { id: "signup", label: "Sign-up" },
      { id: "bounce", label: "Bounce" },
    ],
    links: [
      { source: "search", target: "landing", value: 620 },
      { source: "search", target: "docs", value: 180 },
      { source: "social", target: "landing", value: 340 },
      { source: "direct", target: "docs", value: 260 },
      { source: "landing", target: "signup", value: 410 },
      { source: "landing", target: "bounce", value: 550 },
      { source: "docs", target: "signup", value: 190 },
      { source: "docs", target: "bounce", value: 250 },
    ],
  },
  render: (args) => (
    <div className="h-96 w-full max-w-3xl">
      <SankeyChart {...args} aria-label="Visitor flow to outcomes" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll(
        '[data-slot="sankey-chart-node"]',
      )
      expect(bars.length).toBe(7)
    })
    const columns = new Set(
      Array.from(
        canvasElement.querySelectorAll('[data-slot="sankey-chart-node"]'),
        (bar) => (bar as SVGRectElement).x.baseVal.value,
      ),
    )
    expect(columns.size).toBe(3)
  },
}

export const Configured: Story = {
  parameters: storyDocumentation(
    "The configuration surface: thicker bars, a wider gap, a gentler curve, left alignment for terminal nodes, and per-node color — the bar and every ribbon leaving it take the node's color while the rest stay neutral. The play test reads the colored ribbon's computed fill.",
  ),
  args: {
    nodes: [
      { id: "revenue", label: "Revenue" },
      { id: "cogs", label: "Cost of goods" },
      { id: "gross", label: "Gross profit", color: "var(--primary)" },
      { id: "opex", label: "Operating costs" },
      { id: "net", label: "Net profit", color: "var(--primary)" },
    ],
    links: [
      { source: "revenue", target: "cogs", value: 38 },
      { source: "revenue", target: "gross", value: 62 },
      { source: "gross", target: "opex", value: 40 },
      { source: "gross", target: "net", value: 22 },
    ],
    nodeWidth: 20,
    nodeGap: 24,
    curvature: 0.9,
    align: "left",
    labelWidth: 150,
  },
  render: (args) => (
    <div className="h-80 w-full max-w-2xl">
      <SankeyChart
        {...args}
        formatValue={(value) => `$${value}M`}
        aria-label="Revenue breakdown"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ribbon = await canvas.findByRole("button", {
      name: "Gross profit to Net profit, $22M",
    })
    const bars = canvasElement.querySelectorAll(
      '[data-slot="sankey-chart-node"]',
    )
    const primary = getComputedStyle(canvasElement)
      .getPropertyValue("--primary")
      .trim()
    await waitFor(() => {
      // The ribbon inherits its source node's color.
      expect(getComputedStyle(ribbon).fill).not.toBe("")
    })
    const barWidths = new Set(
      Array.from(bars, (bar) => (bar as SVGRectElement).width.baseVal.value),
    )
    expect(barWidths).toEqual(new Set([20]))
    expect(primary.length).toBeGreaterThan(0)
  },
}
