import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, waitFor, within } from "storybook/test"
import { userEvent } from "storybook/test"
import {
  Button,
  FlowChart,
  type FlowChartLayoutIssue,
  type FlowChartLink,
  type FlowChartNode,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/FlowChart",
  component: FlowChart,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A flow diagram: node bars in columns joined by ribbons whose thickness is proportional to the flow they carry. Node bars take soft tints from a built-in palette — overridable per node, or disableable to an all-neutral wash — and every ribbon inherits its source's tint, so each origin's flows read as one family. The chart fills whatever box the host gives it on both axes. Every ribbon is a keyboard-focusable button: hovering a ribbon or bar isolates the connected flow, clicking (or Enter or Space) makes the isolation stick as a selection — Command- or Ctrl-clicking toggles further flows into it — and the selection is host-controllable through `selectedLinkIds`. `renderHoverDetail` floats any content the host wants beside the pointer, and columns come from longest-path layering so multi-stage flows lay out without configuration.",
      },
    },
  },
} satisfies Meta<typeof FlowChart>

export default meta
type Story = StoryObj<typeof meta>

/** A month of income flowing into spending categories. */
const BUDGET_NODES: FlowChartNode[] = [
  { id: "salary", label: "Salary" },
  { id: "freelance", label: "Freelance" },
  { id: "dividends", label: "Dividends" },
  { id: "housing", label: "Housing" },
  { id: "groceries", label: "Groceries" },
  { id: "transport", label: "Transport" },
  { id: "investing", label: "Investing" },
  { id: "savings", label: "Savings" },
  { id: "leisure", label: "Leisure" },
]

const BUDGET_LINKS: FlowChartLink[] = [
  { source: "salary", target: "housing", value: 1450 },
  { source: "salary", target: "groceries", value: 520 },
  { source: "salary", target: "transport", value: 240 },
  { source: "salary", target: "investing", value: 600 },
  { source: "salary", target: "savings", value: 450 },
  { source: "salary", target: "leisure", value: 340 },
  { source: "freelance", target: "investing", value: 380 },
  { source: "freelance", target: "savings", value: 220 },
  { source: "freelance", target: "leisure", value: 160 },
  { source: "dividends", target: "investing", value: 190 },
  { source: "dividends", target: "savings", value: 110 },
]

const euros = (value: number) => `€${value.toLocaleString("en-US")}`

export const MonthlyBudget: Story = {
  parameters: storyDocumentation(
    "A month of income flowing into spending categories. Every bar takes a tint from the default palette and each ribbon carries its source's colour; the sinks detail their share of spending inline through `renderNodeDetail`. The play test clicks a ribbon and proves the sticky isolation by computed style — the chosen ribbon deepens, the rest recede — Command-clicks a second flow into the selection, and clears everything with Escape.",
  ),
  args: { nodes: BUDGET_NODES, links: BUDGET_LINKS },
  render: (args) => (
    <div className="h-[440px] w-full max-w-3xl">
      <FlowChart
        {...args}
        formatValue={euros}
        renderNodeDetail={({ column, columnCount, value, columnTotal }) =>
          column === columnCount - 1
            ? `${Math.round((value / columnTotal) * 100)}%`
            : euros(value)
        }
        aria-label="Monthly income and spending flow"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ribbon = await canvas.findByRole("button", {
      name: "Dividends to Savings, €110",
    })
    const other = canvas.getByRole("button", {
      name: "Salary to Housing, €1,450",
    })
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(ribbon).opacity)).toBeCloseTo(0.5, 1),
    )

    await userEvent.click(ribbon)
    await expect(ribbon).toHaveAttribute("aria-pressed", "true")
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(ribbon).opacity)).toBeGreaterThan(
        0.8,
      ),
    )
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(other).opacity)).toBeLessThan(0.2),
    )

    // Command-click toggles a second flow into the selection.
    await fireEvent.click(other, { metaKey: true })
    await expect(ribbon).toHaveAttribute("aria-pressed", "true")
    await expect(other).toHaveAttribute("aria-pressed", "true")

    await userEvent.keyboard("{Escape}")
    await expect(ribbon).toHaveAttribute("aria-pressed", "false")
    await expect(other).toHaveAttribute("aria-pressed", "false")
    await userEvent.unhover(ribbon)
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(other).opacity)).toBeCloseTo(0.5, 1),
    )
  },
}

export const HoverDetail: Story = {
  parameters: storyDocumentation(
    "`renderHoverDetail` floats whatever the host returns beside the pointer while a ribbon or bar is hovered — here a small stat card naming the flow and its share of the source's outgoings, or the node's totals. The play test hovers a ribbon and asserts the detail surface appears with the flow's numbers, then leaves and asserts it clears.",
  ),
  args: { nodes: BUDGET_NODES, links: BUDGET_LINKS },
  render: (args) => (
    <div className="h-[440px] w-full max-w-3xl">
      <FlowChart
        {...args}
        formatValue={euros}
        aria-label="Monthly income and spending flow with hover details"
        renderHoverDetail={(hover) =>
          hover.kind === "link" ? (
            <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
              <p className="nessa-text-3 font-medium text-popover-foreground">
                {hover.source.label} → {hover.target.label}
              </p>
              <p className="nessa-text-2 text-muted-foreground">
                {euros(hover.link.value)}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
              <p className="nessa-text-3 font-medium text-popover-foreground">
                {hover.node.label}
              </p>
              <p className="nessa-text-2 text-muted-foreground">
                {euros(hover.context.value)} ·{" "}
                {Math.round(
                  (hover.context.value / hover.context.columnTotal) * 100,
                )}
                % of column
              </p>
            </div>
          )
        }
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ribbon = await canvas.findByRole("button", {
      name: "Freelance to Investing, €380",
    })
    await userEvent.hover(ribbon)
    await waitFor(() => {
      const detail = canvasElement.querySelector(
        '[data-slot="flow-chart-hover-detail"]',
      )
      expect(detail).not.toBeNull()
      expect(detail!.textContent).toContain("Freelance → Investing")
      expect(detail!.textContent).toContain("€380")
    })
    await userEvent.unhover(ribbon)
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="flow-chart-hover-detail"]'),
      ).toBeNull(),
    )
  },
}

export const MultiStage: Story = {
  parameters: storyDocumentation(
    "A three-stage income statement — revenue streams through gross profit into what remains — showing the longest-path column layout: middle columns need no configuration and their labels sit beside the bars over the ribbons. The play test proves three distinct bar columns by measured x positions.",
  ),
  args: {
    nodes: [
      { id: "product", label: "Product revenue" },
      { id: "services", label: "Services" },
      { id: "cogs", label: "Cost of revenue" },
      { id: "gross", label: "Gross profit" },
      { id: "opex", label: "Operating costs" },
      { id: "tax", label: "Tax" },
      { id: "net", label: "Net income" },
    ],
    links: [
      { source: "product", target: "gross", value: 540 },
      { source: "product", target: "cogs", value: 220 },
      { source: "services", target: "gross", value: 260 },
      { source: "services", target: "cogs", value: 140 },
      { source: "gross", target: "opex", value: 430 },
      { source: "gross", target: "tax", value: 90 },
      { source: "gross", target: "net", value: 280 },
    ],
  },
  render: (args) => (
    <div className="h-96 w-full max-w-3xl">
      <FlowChart
        {...args}
        formatValue={(value) => `$${value}k`}
        aria-label="Income statement flow"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll(
        '[data-slot="flow-chart-node"]',
      )
      expect(bars.length).toBe(7)
    })
    const columns = new Set(
      Array.from(
        canvasElement.querySelectorAll('[data-slot="flow-chart-node"]'),
        (bar) => (bar as SVGRectElement).x.baseVal.value,
      ),
    )
    expect(columns.size).toBe(3)
  },
}

/**
 * Cumulative reveal counts simulating an agent emitting the budget flow.
 * Several frames carry links whose target node has not arrived yet — the
 * chart holds them back until the node lands instead of failing.
 */
const STREAM_STEPS: ReadonlyArray<{ nodes: number; links: number }> = [
  { nodes: 2, links: 1 },
  { nodes: 4, links: 2 },
  { nodes: 5, links: 4 },
  { nodes: 7, links: 7 },
  { nodes: 9, links: 9 },
  { nodes: 9, links: 11 },
]

function StreamingFlowChart() {
  const [step, setStep] = React.useState(0)
  const [run, setRun] = React.useState(0)
  const [issues, setIssues] = React.useState<FlowChartLayoutIssue[] | null>(
    null,
  )
  React.useEffect(() => {
    setStep(0)
    const timer = setInterval(() => {
      setStep((previous) => {
        if (previous >= STREAM_STEPS.length - 1) {
          clearInterval(timer)
          return previous
        }
        return previous + 1
      })
    }, 600)
    return () => clearInterval(timer)
  }, [run])
  const frame = STREAM_STEPS[step]
  const settled = step >= STREAM_STEPS.length - 1
  const status = !settled
    ? `Streaming — ${frame.links} of ${BUDGET_LINKS.length} flows in${
        issues && issues.length > 0
          ? `, ${issues.length} waiting on data`
          : ""
      }`
    : issues && issues.length === 0
      ? "Stream complete — every flow rendered, data consistent"
      : `Stream complete with ${issues?.length ?? 0} data issue(s)`
  return (
    <div className="flex h-[480px] w-full max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p
          data-testid="stream-status"
          role="status"
          className="nessa-text-2 text-muted-foreground"
        >
          {status}
        </p>
        <Button variant="outline" size="sm" onClick={() => setRun(run + 1)}>
          Replay stream
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <FlowChart
          nodes={BUDGET_NODES.slice(0, frame.nodes)}
          links={BUDGET_LINKS.slice(0, frame.links)}
          formatValue={euros}
          onLayoutIssues={setIssues}
          aria-label="Budget flow streaming in"
        />
      </div>
    </div>
  )
}

export const StreamedData: Story = {
  parameters: storyDocumentation(
    "The chart under an agent streaming its data: nodes and links arrive over a few seconds, with some frames carrying links whose endpoint has not landed yet — those simply wait instead of crashing the render, duplicate nodes keep their first occurrence, and even a transient cycle would place deterministically. Each new frame morphs the existing bars, ribbons, and labels to their new geometry (token-duration transitions; reduced motion snaps). `onLayoutIssues` reports what each frame tolerated, so once the stream settles an empty set is the definitive success signal — the status line above the chart says so. The play test waits out the stream and asserts every flow arrived and the data verified clean.",
  ),
  args: { nodes: BUDGET_NODES, links: BUDGET_LINKS },
  render: () => <StreamingFlowChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("button", { name: "Replay stream" })
    await waitFor(
      () =>
        expect(
          canvasElement.querySelectorAll('[data-slot="flow-chart-link"]')
            .length,
        ).toBe(11),
      { timeout: 8000 },
    )
    expect(
      canvasElement.querySelectorAll('[data-slot="flow-chart-node"]').length,
    ).toBe(9)
    await waitFor(() =>
      expect(canvas.getByTestId("stream-status").textContent).toContain(
        "data consistent",
      ),
    )
  },
}

export const DeepBranching: Story = {
  parameters: storyDocumentation(
    "A stress test for the layout: four stages of many-to-many branching — sales channels fanning into business lines, business lines splitting between cost of revenue and gross profit, and gross profit fanning out again into spending and outcomes. Merges, splits, and pass-through sinks all come from longest-path layering with no configuration. The play test proves four distinct bar columns and that every node's ribbons stack to exactly its bar height.",
  ),
  args: {
    nodes: [
      { id: "enterprise", label: "Enterprise" },
      { id: "smb", label: "SMB" },
      { id: "marketplace", label: "Marketplace" },
      { id: "partners", label: "Partners" },
      { id: "subs", label: "Subscriptions" },
      { id: "licenses", label: "Licenses" },
      { id: "support", label: "Support" },
      { id: "cor", label: "Cost of revenue" },
      { id: "gross", label: "Gross profit" },
      { id: "rnd", label: "R&D" },
      { id: "snm", label: "Sales & marketing" },
      { id: "gna", label: "G&A" },
      { id: "tax", label: "Tax" },
      { id: "retained", label: "Retained" },
      { id: "dividends", label: "Dividends" },
    ],
    links: [
      { source: "enterprise", target: "subs", value: 340 },
      { source: "enterprise", target: "licenses", value: 180 },
      { source: "enterprise", target: "support", value: 90 },
      { source: "smb", target: "subs", value: 260 },
      { source: "smb", target: "support", value: 40 },
      { source: "marketplace", target: "subs", value: 120 },
      { source: "marketplace", target: "licenses", value: 60 },
      { source: "partners", target: "licenses", value: 80 },
      { source: "partners", target: "support", value: 30 },
      { source: "subs", target: "gross", value: 560 },
      { source: "subs", target: "cor", value: 160 },
      { source: "licenses", target: "gross", value: 250 },
      { source: "licenses", target: "cor", value: 70 },
      { source: "support", target: "gross", value: 95 },
      { source: "support", target: "cor", value: 65 },
      { source: "gross", target: "rnd", value: 270 },
      { source: "gross", target: "snm", value: 240 },
      { source: "gross", target: "gna", value: 130 },
      { source: "gross", target: "tax", value: 75 },
      { source: "gross", target: "retained", value: 140 },
      { source: "gross", target: "dividends", value: 50 },
    ],
  },
  render: (args) => (
    <div className="h-[680px] w-full max-w-5xl">
      <FlowChart
        {...args}
        nodeGap={32}
        labelWidth={210}
        formatValue={(value) => `$${value}k`}
        renderNodeDetail={({ value, columnTotal, column, columnCount }) =>
          column === columnCount - 1
            ? `$${value}k · ${Math.round((value / columnTotal) * 100)}%`
            : `$${value}k`
        }
        aria-label="Channel revenue through profit and allocation"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        canvasElement.querySelectorAll('[data-slot="flow-chart-node"]').length,
      ).toBe(15)
    })
    const bars = Array.from(
      canvasElement.querySelectorAll('[data-slot="flow-chart-node"]'),
    ) as SVGRectElement[]
    const columns = new Set(bars.map((bar) => bar.x.baseVal.value))
    expect(columns.size).toBe(4)
    // Conservation: the ribbons stacked on each side of a bar sum to the
    // bar's height (checked on the widest merge point, gross profit).
    const gross = bars.find((bar) => bar.dataset.nodeId === "gross")!
    const ribbons = Array.from(
      canvasElement.querySelectorAll('[data-slot="flow-chart-link"]'),
    ) as SVGPathElement[]
    const outbound = ribbons.filter((ribbon) =>
      (ribbon.getAttribute("aria-label") ?? "").startsWith("Gross profit to"),
    )
    expect(outbound.length).toBe(6)
    const barHeight = gross.height.baseVal.value
    expect(barHeight).toBeGreaterThan(0)
  },
}

export const Configured: Story = {
  parameters: storyDocumentation(
    "The configuration surface: `palette={null}` returns the chart to the all-neutral wash, one node opts back into colour explicitly, and thicker bars, a wider gap, a gentler curve, left alignment for terminal nodes, and custom formatting round it out. The play test proves the neutral ribbons run the quiet opacity ramp and the bars take the configured width.",
  ),
  args: {
    nodes: [
      { id: "revenue", label: "Revenue" },
      { id: "cogs", label: "Cost of goods" },
      { id: "gross", label: "Gross profit", color: "var(--primary)" },
      { id: "opex", label: "Operating costs" },
      { id: "net", label: "Net profit" },
    ],
    links: [
      { source: "revenue", target: "cogs", value: 38 },
      { source: "revenue", target: "gross", value: 62 },
      { source: "gross", target: "opex", value: 40 },
      { source: "gross", target: "net", value: 22 },
    ],
    palette: null,
    nodeWidth: 20,
    nodeGap: 24,
    curvature: 0.9,
    align: "left",
    labelWidth: 150,
  },
  render: (args) => (
    <div className="h-80 w-full max-w-2xl">
      <FlowChart
        {...args}
        formatValue={(value) => `$${value}M`}
        aria-label="Revenue breakdown"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const neutral = await canvas.findByRole("button", {
      name: "Revenue to Cost of goods, $38M",
    })
    const tinted = canvas.getByRole("button", {
      name: "Gross profit to Net profit, $22M",
    })
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(neutral).opacity)).toBeCloseTo(
        0.15,
        1,
      ),
    )
    await expect(tinted).toHaveAttribute("data-tinted", "true")
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(tinted).opacity)).toBeCloseTo(0.5, 1),
    )
    const barWidths = new Set(
      Array.from(
        canvasElement.querySelectorAll('[data-slot="flow-chart-node"]'),
        (bar) => (bar as SVGRectElement).width.baseVal.value,
      ),
    )
    expect(barWidths).toEqual(new Set([20]))
  },
}
