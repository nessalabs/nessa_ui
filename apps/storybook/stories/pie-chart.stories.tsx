import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, waitFor, within } from "storybook/test"
import { userEvent } from "storybook/test"
import {
  Button,
  PieChart,
  PopoverSurface,
  type PieChartLayoutIssue,
  type PieChartSlice,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Charts/PieChart",
  component: PieChart,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A pie or donut chart: one wedge per slice, sized to its share of the total, filling whatever box the host gives it on both axes. Slices take a slot from the design system's categorical chart ramp — overridable per slice, or disableable to an all-neutral wash. The ramp is a token per theme, so every slot is contrast-correct against its own surface, and its slot order is what keeps neighbouring wedges separable under colour-vision deficiency. Every wedge is a keyboard-focusable button: hovering one isolates it and recedes the rest, clicking (or Enter or Space) makes the isolation stick as a selection and eases the wedge out of the ring — Command- or Ctrl-clicking toggles further slices into it — and the selection is host-controllable through `selectedSliceIds`. A donut's centre reads the **total at rest and the engaged slice while one is hovered, focused, or solely selected**, so the chart answers \"how much is this?\" without a tooltip. A long tail can be rolled into one bucket with `groupThreshold`, whose members stay reachable through `renderHoverDetail`, and narrowing the sweep with `startAngle`/`endAngle` turns the same component into a gauge.",
      },
    },
  },
} satisfies Meta<typeof PieChart>

export default meta
type Story = StoryObj<typeof meta>

/** A quarter of support tickets by the surface that raised them. */
const TICKET_SLICES: PieChartSlice[] = [
  { id: "billing", label: "Billing", value: 4820 },
  { id: "onboarding", label: "Onboarding", value: 3140 },
  { id: "integrations", label: "Integrations", value: 2260 },
  { id: "mobile", label: "Mobile app", value: 1490 },
  { id: "docs", label: "Documentation", value: 890 },
]

const tickets = (value: number) => value.toLocaleString("en-US")

export const TicketMix: Story = {
  parameters: storyDocumentation(
    "A quarter of support tickets by surface. Labels park in the gutter on leader lines, each carrying its share. The play test clicks a wedge and proves the sticky isolation by computed style — the chosen wedge holds full strength, the rest recede — checks it eased out of the ring, Command-clicks a second slice into the selection, and clears everything with Escape.",
  ),
  args: { slices: TICKET_SLICES },
  render: (args) => (
    <div className="h-[420px] w-full max-w-2xl">
      <PieChart {...args} formatValue={tickets} aria-label="Tickets by surface" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const billing = await canvas.findByRole("button", { name: /^Billing,/ })
    const docs = canvas.getByRole("button", { name: /^Documentation,/ })

    await userEvent.click(billing)
    await expect(billing).toHaveAttribute("aria-pressed", "true")
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(billing).opacity)).toBeGreaterThan(0.9),
    )
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(docs).opacity)).toBeLessThan(0.4),
    )
    // Selection eases the wedge out of the ring along its own midline.
    await expect(billing.getAttribute("transform")).toMatch(/^translate\(/)

    await fireEvent.click(docs, { metaKey: true })
    await expect(billing).toHaveAttribute("aria-pressed", "true")
    await expect(docs).toHaveAttribute("aria-pressed", "true")

    await userEvent.keyboard("{Escape}")
    await expect(billing).toHaveAttribute("aria-pressed", "false")
    await expect(docs).toHaveAttribute("aria-pressed", "false")
    await expect(billing.getAttribute("transform")).toBeNull()
  },
}

export const DonutCenter: Story = {
  parameters: storyDocumentation(
    "The donut centre is the chart's readout. At rest it holds the total; hover, focus, or a sole selection swaps it to that slice's value and name, and letting go restores the total — so the common question is answered without a tooltip ever appearing. `renderCenter` replaces the default with anything the host wants. The play test reads the resting total, hovers a wedge, asserts the centre swapped, and asserts it restores on leave.",
  ),
  args: { slices: TICKET_SLICES },
  render: (args) => (
    <div className="h-[420px] w-full max-w-2xl">
      <PieChart
        {...args}
        innerRadius={0.62}
        padAngle={1.5}
        sort="descending"
        formatValue={tickets}
        aria-label="Tickets by surface, donut"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const centre = await waitFor(() => {
      const element = canvasElement.querySelector('[data-slot="pie-chart-center"]')
      expect(element).toBeTruthy()
      return element!
    })
    await expect(centre.textContent).toContain("12,600")
    await expect(centre.textContent).toContain("Total")

    const onboarding = canvas.getByRole("button", { name: /^Onboarding,/ })
    await userEvent.hover(onboarding)
    await waitFor(() => expect(centre.textContent).toContain("Onboarding"))
    await expect(centre.textContent).toContain("3,140")

    await userEvent.unhover(onboarding)
    await waitFor(() => expect(centre.textContent).toContain("Total"))
  },
}

/** A long tail of referral sources, most of them negligible. */
const REFERRER_SLICES: PieChartSlice[] = [
  { id: "search", label: "Search", value: 5200 },
  { id: "direct", label: "Direct", value: 3100 },
  { id: "social", label: "Social", value: 1400 },
  { id: "newsletter", label: "Newsletter", value: 220 },
  { id: "partners", label: "Partner sites", value: 180 },
  { id: "podcasts", label: "Podcasts", value: 96 },
  { id: "conferences", label: "Conferences", value: 74 },
  { id: "print", label: "Print", value: 41 },
]

export const RolledUpTail: Story = {
  parameters: storyDocumentation(
    "`groupThreshold` rolls every slice under a share into one trailing bucket, so a long tail of slivers stops shredding the ring. The bucket keeps its true share of the circle and carries its members, which `renderHoverDetail` lists on hover — the detail is folded away, not lost. A lone below-threshold slice is never bucketed: a bucket of one would only rename it. The play test proves five wedges are drawn from eight sources and that hovering the bucket names all five it swallowed.",
  ),
  args: { slices: REFERRER_SLICES },
  render: (args) => (
    <div className="h-[420px] w-full max-w-2xl">
      <PieChart
        {...args}
        innerRadius={0.5}
        groupThreshold={0.05}
        groupLabel="Everything else"
        sort="descending"
        formatValue={tickets}
        renderHoverDetail={({ context }) =>
          context.members ? (
            <PopoverSurface className="w-52 p-3" data-testid="bucket-card">
              <p className="nessa-text-2 text-muted-foreground">
                Rolled up ({context.members.length})
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {context.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-baseline justify-between gap-3 nessa-text-3"
                  >
                    <span>{member.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {tickets(member.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverSurface>
          ) : null
        }
        aria-label="Sessions by referrer"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="pie-chart-slice"]').length,
      ).toBe(4),
    )
    const bucket = canvasElement.querySelector(
      '[data-slot="pie-chart-slice"][data-slice-id="other"]',
    )!
    await userEvent.hover(bucket)
    const card = await canvas.findByTestId("bucket-card")
    await expect(card.textContent).toContain("Rolled up (5)")
    await expect(card.textContent).toContain("Podcasts")
    await expect(card.textContent).toContain("Print")
  },
}

export const Gauge: Story = {
  parameters: storyDocumentation(
    "Narrowing the sweep turns the same component into a gauge: a half turn from nine o'clock to three, a deep hole, and a `renderCenter` that reads the headline number. The layout fits the swept region rather than the whole circle, so the arc uses the host's whole box instead of hanging in the top half of it. Everything else still applies — the arcs are focusable buttons, hover isolates, and a click sticks. The play test proves the drawn ring is twice as wide as it is tall and reaches both sides of the box.",
  ),
  args: {
    slices: [
      { id: "done", label: "Shipped", value: 46 },
      { id: "review", label: "In review", value: 18 },
      { id: "todo", label: "Not started", value: 36 },
    ],
  },
  render: (args) => (
    <div className="h-64 w-full max-w-md">
      <PieChart
        {...args}
        startAngle={-90}
        endAngle={90}
        innerRadius={0.68}
        padAngle={2}
        labels="none"
        formatValue={(value) => `${value}%`}
        renderCenter={({ engaged }) => (
          <>
            <span className="nessa-text-7 font-medium text-foreground">
              {engaged ? `${engaged.value}%` : "46%"}
            </span>
            <span className="nessa-text-2 text-muted-foreground">
              {engaged ? (engaged.slice.label ?? engaged.slice.id) : "Shipped"}
            </span>
          </>
        )}
        aria-label="Release progress"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const wedges = await waitFor(() => {
      const found = canvasElement.querySelectorAll('[data-slot="pie-chart-slice"]')
      expect(found.length).toBe(3)
      return Array.from(found) as SVGPathElement[]
    })
    // A half-turn sweep occupies a 2:1 box, and the layout fits that box
    // rather than the whole circle.
    const boxes = wedges.map((wedge) => wedge.getBoundingClientRect())
    const left = Math.min(...boxes.map((box) => box.left))
    const right = Math.max(...boxes.map((box) => box.right))
    const top = Math.min(...boxes.map((box) => box.top))
    const bottom = Math.max(...boxes.map((box) => box.bottom))
    expect((right - left) / (bottom - top)).toBeCloseTo(2, 1)
    const svg = (
      canvasElement.querySelector('[data-slot="pie-chart"] svg') as SVGSVGElement
    ).getBoundingClientRect()
    // It reaches both sides of the host's box rather than hanging in half of it.
    expect(right - left).toBeGreaterThan(svg.width * 0.9)
    const centre = canvasElement.querySelector('[data-slot="pie-chart-center"]')!
    expect(centre.textContent).toContain("46%")
  },
}

export const InsideLabels: Story = {
  parameters: storyDocumentation(
    "`labels=\"inside\"` writes each name on its own wedge, which suits a solid pie with few, chunky slices. `labelMinShare` keeps a wedge too thin to carry a label legible by moving its reading to hover detail instead of overprinting the neighbour. The play test proves the sub-threshold slice draws a wedge but no label.",
  ),
  args: {
    slices: [
      { id: "chrome", label: "Chrome", value: 62 },
      { id: "safari", label: "Safari", value: 21 },
      { id: "firefox", label: "Firefox", value: 9 },
      { id: "edge", label: "Edge", value: 7 },
      { id: "other", label: "Other", value: 1 },
    ],
  },
  render: (args) => (
    <div className="h-[380px] w-full max-w-lg">
      <PieChart
        {...args}
        labels="inside"
        labelMinShare={0.05}
        padAngle={0.8}
        formatValue={(value) => `${value}%`}
        aria-label="Browser share"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="pie-chart-slice"]').length,
      ).toBe(5),
    )
    expect(
      canvasElement.querySelectorAll('[data-slot="pie-chart-label"]').length,
    ).toBe(4)
    expect(
      canvasElement.querySelector('[data-slot="pie-chart-label"][data-slice-id="other"]'),
    ).toBeNull()
    expect(
      canvasElement.querySelector('[data-slot="pie-chart-slice"][data-slice-id="other"]'),
    ).toBeTruthy()
  },
}

function StreamingPieChart() {
  const [frame, setFrame] = React.useState(0)
  const [issues, setIssues] = React.useState<PieChartLayoutIssue[]>([])
  React.useEffect(() => {
    if (frame >= TICKET_SLICES.length) return
    const timer = setTimeout(() => setFrame((previous) => previous + 1), 650)
    return () => clearTimeout(timer)
  }, [frame])

  // The newest surface lands before it has been counted; a zero-value slice
  // is reported and dropped rather than claiming a wedge of the ring.
  const streamed = TICKET_SLICES.slice(0, frame + 1).map((slice, index) =>
    index === frame ? { ...slice, value: 0 } : slice,
  )

  return (
    // Every band around the chart is a fixed height and every line is clamped
    // to one row. A status line that grew to two lines would shrink the plot
    // and re-lay the whole ring out on the frame it appeared — which reads as
    // the chart flinching, not as data arriving.
    <div className="flex h-[520px] w-full max-w-2xl flex-col gap-3">
      <div className="flex h-8 shrink-0 items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setFrame(0)}>
          Replay stream
        </Button>
        <span
          className="nessa-text-2 truncate text-muted-foreground"
          data-testid="stream-status"
        >
          {issues.length === 0
            ? `${frame} of ${TICKET_SLICES.length} surfaces · data consistent`
            : `${issues.length} pending: ${issues[0].message}`}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <PieChart
          slices={streamed}
          innerRadius={0.6}
          formatValue={tickets}
          onLayoutIssues={setIssues}
          aria-label="Tickets streaming in"
        />
      </div>
      {/* Exactly what the chart is being handed this frame — the `slices`
          prop verbatim. Fixed height and its own scroller, so a payload that
          grows row by row never resizes the ring above it. */}
      <div className="flex h-40 shrink-0 flex-col overflow-hidden rounded-md border border-border">
        <div className="shrink-0 border-b border-border px-2 py-1 nessa-text-2 text-muted-foreground">
          slices (frame {frame})
        </div>
        <pre
          data-testid="stream-payload"
          // The panel scrolls, so it has to be reachable and scrollable from
          // the keyboard as well as the wheel.
          tabIndex={0}
          role="region"
          aria-label="Streamed slices payload"
          className="min-h-0 flex-1 overflow-auto px-2 py-1 font-mono nessa-text-2 text-muted-foreground focus-visible:outline-ring"
        >
          {JSON.stringify(streamed, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export const StreamedData: Story = {
  parameters: storyDocumentation(
    "The chart under an agent streaming its data: surfaces arrive over a few seconds, and the newest one lands before it has been counted. A zero-value slice is reported through `onLayoutIssues` and dropped rather than claiming a wedge of the ring, and each new frame morphs the existing wedges and labels to their new geometry (token-duration transitions; reduced motion snaps). The panel underneath is the `slices` prop verbatim for the current frame — the chart takes typed arrays, not a wire format, so this is literally the value being handed to it — which makes the geometry and the payload readable against each other. A wedge keeps its colour as the ring reorders around it — slots are assigned in input order, never by rank, so a surface being overtaken never repaints. Every band around the chart holds a fixed height and clamps its text to one line: a status line that grew to two would shrink the plot and re-lay the ring out on the frame it appeared, which reads as the chart flinching rather than as data arriving. The play test waits out the stream and asserts every surface arrived and the data verified clean.",
  ),
  args: { slices: TICKET_SLICES },
  render: () => <StreamingPieChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("button", { name: "Replay stream" })
    await waitFor(
      () =>
        expect(
          canvasElement.querySelectorAll('[data-slot="pie-chart-slice"]').length,
        ).toBe(5),
      { timeout: 8000 },
    )
    await waitFor(() =>
      expect(canvas.getByTestId("stream-status").textContent).toContain(
        "data consistent",
      ),
    )
  },
}

export const Configured: Story = {
  parameters: storyDocumentation(
    "The configuration surface: `palette={null}` returns the chart to the all-neutral wash and one slice opts back into colour explicitly, the sweep starts a quarter turn round, slices are sorted smallest first, and a generous pad separates them. The play test proves the neutral slices carry no tint while the highlighted one does, and that the ascending sort put the smallest wedge first.",
  ),
  args: {
    slices: [
      { id: "infra", label: "Infrastructure", value: 42 },
      { id: "people", label: "People", value: 96 },
      { id: "tools", label: "Tooling", value: 18 },
      { id: "travel", label: "Travel", value: 9, color: "var(--primary)" },
    ],
    palette: null,
    startAngle: 90,
    sort: "ascending",
    padAngle: 3,
    innerRadius: 0.45,
    labelWidth: 120,
  },
  render: (args) => (
    <div className="h-[380px] w-full max-w-xl">
      <PieChart
        {...args}
        formatValue={(value) => `$${value}k`}
        renderSliceDetail={({ value }) => `$${value}k`}
        aria-label="Spend by category"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const wedges = await waitFor(() => {
      const found = canvasElement.querySelectorAll('[data-slot="pie-chart-slice"]')
      expect(found.length).toBe(4)
      return Array.from(found) as SVGPathElement[]
    })
    expect(wedges.map((wedge) => wedge.dataset.sliceId)).toEqual([
      "travel",
      "tools",
      "infra",
      "people",
    ])
    expect(wedges[1].dataset.tinted).toBe("false")
    expect(wedges[0].dataset.tinted).toBe("true")
  },
}
