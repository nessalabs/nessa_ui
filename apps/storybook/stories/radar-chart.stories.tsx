import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, waitFor, within } from "storybook/test"
import { userEvent } from "storybook/test"
import {
  Button,
  PopoverSurface,
  RadarChart,
  type RadarChartAxis,
  type RadarChartLayoutIssue,
  type RadarChartSeries,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Charts/RadarChart",
  component: RadarChart,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A radar chart: values plotted along spokes radiating from one centre, one closed outline per series. Series take a slot from the design system's categorical chart ramp — overridable per series, or disableable to an all-neutral wash — and the area wash is derived from each outline's own colour, so a custom tint stays coherent. The ramp is a token per theme, so every slot is contrast-correct against its own surface, and its slot order is what keeps neighbouring series separable under colour-vision deficiency. The chart fills whatever box the host gives it on both axes. Every outline is a keyboard-focusable button: hovering one isolates it and recedes the rest, clicking (or Enter or Space) makes the isolation stick as a selection — Command- or Ctrl-clicking toggles further series into it — and the selection is host-controllable through `selectedSeriesIds`. Hovering a spoke instead **probes that axis**: the spoke lights up, every series is marked where it crosses, and `renderHoverDetail` receives the readings ranked, so one axis can be compared across series without isolating anything. `scale` switches between one shared maximum (ring distance comparable everywhere) and per-axis normalisation (shape reads as rank), and `curve` controls how rounded the outline is — it defaults to a slight rounding, and the spline interpolates, so a value stays exactly on its own spoke at any setting.",
      },
    },
  },
} satisfies Meta<typeof RadarChart>

export default meta
type Story = StoryObj<typeof meta>

/** Engineering-candidate scorecards on a shared 0–10 rubric. */
const RUBRIC_AXES: RadarChartAxis[] = [
  { id: "systems", label: "Systems", max: 10 },
  { id: "product", label: "Product", max: 10 },
  { id: "testing", label: "Testing", max: 10 },
  { id: "comms", label: "Communication", max: 10 },
  { id: "review", label: "Code review", max: 10 },
  { id: "ops", label: "Operations", max: 10 },
]

const RUBRIC_SERIES: RadarChartSeries[] = [
  {
    id: "avery",
    label: "Avery",
    values: { systems: 9, product: 5, testing: 8, comms: 6, review: 7, ops: 8 },
  },
  {
    id: "blake",
    label: "Blake",
    values: { systems: 5, product: 9, testing: 6, comms: 9, review: 8, ops: 4 },
  },
  {
    id: "casey",
    label: "Casey",
    values: { systems: 7, product: 7, testing: 4, comms: 7, review: 5, ops: 9 },
  },
]

const outOfTen = (value: number) => `${value}/10`

export const Scorecards: Story = {
  parameters: storyDocumentation(
    "Three candidates against one shared rubric. Every axis pins `max: 10`, so ring distance means the same thing on every spoke and the shapes are directly comparable. The play test clicks a series and proves the sticky isolation by computed style — the chosen outline holds full strength, the rest recede — Command-clicks a second series into the selection, and clears everything with Escape.",
  ),
  args: { axes: RUBRIC_AXES, series: RUBRIC_SERIES },
  render: (args) => (
    <div className="h-[460px] w-full max-w-2xl">
      <RadarChart
        {...args}
        formatValue={outOfTen}
        renderAxisDetail={() => null}
        aria-label="Candidate scorecards"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const avery = await canvas.findByRole("button", { name: /^Avery,/ })
    const blake = canvas.getByRole("button", { name: /^Blake,/ })
    const averyOutline = canvasElement.querySelector(
      '[data-slot="radar-chart-outline"][data-series-id="avery"]',
    )!
    const blakeOutline = canvasElement.querySelector(
      '[data-slot="radar-chart-outline"][data-series-id="blake"]',
    )!

    await userEvent.click(avery)
    await expect(avery).toHaveAttribute("aria-pressed", "true")
    await waitFor(() =>
      expect(
        parseFloat(getComputedStyle(averyOutline).opacity),
      ).toBeGreaterThan(0.9),
    )
    await waitFor(() =>
      expect(parseFloat(getComputedStyle(blakeOutline).opacity)).toBeLessThan(
        0.3,
      ),
    )

    // Command-click toggles a second series into the selection.
    await fireEvent.click(blake, { metaKey: true })
    await expect(avery).toHaveAttribute("aria-pressed", "true")
    await expect(blake).toHaveAttribute("aria-pressed", "true")

    await userEvent.keyboard("{Escape}")
    await expect(avery).toHaveAttribute("aria-pressed", "false")
    await expect(blake).toHaveAttribute("aria-pressed", "false")
    // The clicked outline still holds keyboard focus, which isolates it just
    // like hover — blur it to reach the true resting state.
    await userEvent.unhover(avery)
    ;(avery as unknown as SVGElement).blur()
    await waitFor(() =>
      expect(
        parseFloat(getComputedStyle(blakeOutline).opacity),
      ).toBeGreaterThan(0.9),
    )
  },
}

export const AxisProbe: Story = {
  parameters: storyDocumentation(
    "The axis probe. Hovering a spoke — or its label — lights the spoke, marks every series where it crosses, and hands `renderHoverDetail` the readings ranked largest first, so a single axis can be compared across series without isolating any of them. Series emphasis deliberately stays at rest during a probe: the point is the comparison. A spoke is not something a keyboard can point at, so the axis label is its handle: focusing it probes, and activating it with Enter or Space pins the probe so the comparison outlives the focus — Escape clears it. The play test hovers the Testing spoke and asserts the ranked card, leaves and asserts it goes away, then reaches the same probe from the keyboard, pins it, and clears it.",
  ),
  args: { axes: RUBRIC_AXES, series: RUBRIC_SERIES },
  render: (args) => (
    <div className="h-[460px] w-full max-w-2xl">
      <RadarChart
        {...args}
        formatValue={outOfTen}
        renderAxisDetail={() => null}
        renderHoverDetail={(hover) =>
          hover.kind === "axis" ? (
            <PopoverSurface className="w-48 p-3" data-testid="probe-card">
              <p className="nessa-text-2 text-muted-foreground">
                {hover.context.axis.label}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {hover.context.readings.map((reading) => (
                  <li
                    key={reading.series.id}
                    className="flex items-baseline justify-between gap-3 nessa-text-3"
                  >
                    <span>{reading.series.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {outOfTen(reading.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverSurface>
          ) : null
        }
        aria-label="Candidate scorecards with axis probe"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const probe = await waitFor(() => {
      const element = canvasElement.querySelector(
        '[data-slot="radar-chart-axis-probe"][data-axis-id="testing"]',
      )
      expect(element).toBeTruthy()
      return element!
    })
    await userEvent.hover(probe)
    const card = await canvas.findByTestId("probe-card")
    // Ranked largest first: Avery 8, Blake 6, Casey 4.
    await expect(card.textContent).toContain("Avery")
    const rows = Array.from(card.querySelectorAll("li"), (row) => row.textContent)
    await expect(rows[0]).toContain("8/10")
    await expect(rows[2]).toContain("4/10")
    const spoke = canvasElement.querySelector(
      '[data-slot="radar-chart-spoke"][data-emphasis="active"]',
    )
    await expect(spoke).toBeTruthy()

    await userEvent.unhover(probe)
    await waitFor(() => expect(canvas.queryByTestId("probe-card")).toBeNull())

    // A spoke is not something a keyboard can point at, so the axis label is
    // its handle: focusing probes, and activating pins.
    const label = canvasElement.querySelector(
      '[data-slot="radar-chart-axis-label"][data-axis-id="testing"]',
    ) as HTMLElement
    const litSpoke = () =>
      canvasElement.querySelector(
        '[data-slot="radar-chart-spoke"][data-axis-id="testing"][data-emphasis="active"]',
      )
    label.focus()
    await waitFor(() => expect(litSpoke()).toBeTruthy())
    await userEvent.keyboard("{Enter}")
    await expect(label).toHaveAttribute("aria-pressed", "true")
    // Pinned, the probe outlives the blur that would otherwise end it.
    label.blur()
    await waitFor(() => expect(litSpoke()).toBeTruthy())
    // Escape is handled on the chart, so it only reaches it while focus is
    // inside — the same contract the series selection has.
    label.focus()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(label).toHaveAttribute("aria-pressed", "false"))
    label.blur()
    await waitFor(() => expect(litSpoke()).toBeNull())

    // A click on the background unpins too, which is the pointer's way out.
    await userEvent.click(label)
    await waitFor(() => expect(label).toHaveAttribute("aria-pressed", "true"))
    label.blur()
    const plot = canvasElement.querySelector(
      '[data-slot="radar-chart"] svg',
    ) as SVGSVGElement
    await fireEvent.pointerDown(plot)
    await waitFor(() => expect(litSpoke()).toBeNull())
  },
}

/** One product's telemetry, where each axis carries its own unit. */
const TELEMETRY_AXES: RadarChartAxis[] = [
  { id: "latency", label: "Latency" },
  { id: "throughput", label: "Throughput" },
  { id: "errors", label: "Errors" },
  { id: "cost", label: "Cost" },
  { id: "saturation", label: "Saturation" },
]

const TELEMETRY_SERIES: RadarChartSeries[] = [
  {
    id: "eu",
    label: "eu-west",
    values: { latency: 180, throughput: 42000, errors: 12, cost: 3400, saturation: 0.62 },
  },
  {
    id: "us",
    label: "us-east",
    values: { latency: 95, throughput: 91000, errors: 31, cost: 7100, saturation: 0.81 },
  },
]

export const PerAxisScale: Story = {
  parameters: storyDocumentation(
    "`scale=\"axis\"` for readings that share no unit. Requests per second, milliseconds, dollars and a saturation ratio cannot sit on one scale — under the default shared maximum every axis but throughput would collapse onto the centre. Normalising each spoke against its own largest reading turns the shape into a rank comparison, and each axis label carries the value that reaches the outer ring so the absolute numbers stay on screen. The play test proves the two regions swap the outer ring axis by axis.",
  ),
  args: { axes: TELEMETRY_AXES, series: TELEMETRY_SERIES },
  render: (args) => (
    <div className="h-[440px] w-full max-w-2xl">
      <RadarChart
        {...args}
        scale="axis"
        dots="always"
        curve={0.6}
        labelWidth={104}
        formatValue={(value) =>
          value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
        }
        aria-label="Regional telemetry, each axis on its own scale"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="radar-chart-dot"]').length,
      ).toBe(10),
    )
    const dot = (seriesId: string, axisId: string) =>
      canvasElement.querySelector(
        `[data-slot="radar-chart-dot"][data-series-id="${seriesId}"][data-axis-id="${axisId}"]`,
      ) as SVGCircleElement
    const centre = (
      canvasElement.querySelector(
        '[data-slot="radar-chart-ring"]',
      ) as SVGPathElement
    ).getBBox()
    const distance = (element: SVGCircleElement) =>
      Math.hypot(
        element.cx.baseVal.value - (centre.x + centre.width / 2),
        element.cy.baseVal.value - (centre.y + centre.height / 2),
      )
    // us-east owns the outer ring on throughput; eu-west owns it on latency.
    expect(distance(dot("us", "throughput"))).toBeGreaterThan(
      distance(dot("eu", "throughput")),
    )
    expect(distance(dot("eu", "latency"))).toBeGreaterThan(
      distance(dot("us", "latency")),
    )
  },
}

export const CurvedOutlines: Story = {
  parameters: storyDocumentation(
    "`curve` at its maximum, against the slight rounding every chart gets by default. With only four axes a hard polygon reads as a bare diamond; a curve gives the shape a silhouette the eye can hold. Because the spline is a closed Catmull-Rom it interpolates, so each vertex still sits exactly on its spoke at the value it reports — rounding changes the join, never the reading. The grid stays angular so the reading lines remain exact, and `curve={0}` returns the strict polygon. The play test proves the outline is drawn with curve commands rather than straight segments.",
  ),
  args: {
    axes: [
      { id: "reach", label: "Reach", max: 100 },
      { id: "depth", label: "Depth", max: 100 },
      { id: "speed", label: "Speed", max: 100 },
      { id: "cost", label: "Cost", max: 100 },
    ],
    series: [
      { id: "now", label: "Today", values: { reach: 70, depth: 40, speed: 85, cost: 55 } },
      { id: "goal", label: "Target", values: { reach: 90, depth: 75, speed: 80, cost: 35 } },
    ],
  },
  render: (args) => (
    <div className="h-96 w-full max-w-xl">
      <RadarChart
        {...args}
        curve={1}
        rings={5}
        renderAxisDetail={() => null}
        aria-label="Today against target"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const outline = await waitFor(() => {
      const element = canvasElement.querySelector(
        '[data-slot="radar-chart-outline"][data-series-id="goal"]',
      )
      expect(element).toBeTruthy()
      return element!
    })
    const d = outline.getAttribute("d") ?? ""
    expect(d).toContain("C")
    expect(d).not.toContain("L")
  },
}

export const LinesOnly: Story = {
  parameters: storyDocumentation(
    "`fill={false}` drops the area wash so many series can share one plot without the washes muddying each other, and a circular grid keeps a busy chart calm. The outlines stay full-strength and interactive; hover still isolates. The play test proves every wash is transparent while the outlines keep their stroke.",
  ),
  args: {
    axes: RUBRIC_AXES,
    series: [
      ...RUBRIC_SERIES,
      {
        id: "devon",
        label: "Devon",
        values: { systems: 6, product: 6, testing: 9, comms: 5, review: 9, ops: 6 },
      },
      {
        id: "ellis",
        label: "Ellis",
        values: { systems: 8, product: 8, testing: 5, comms: 8, review: 6, ops: 5 },
      },
    ],
  },
  render: (args) => (
    <div className="h-[460px] w-full max-w-2xl">
      <RadarChart
        {...args}
        fill={false}
        dots="none"
        grid="circle"
        curve={0.5}
        formatValue={outOfTen}
        renderAxisDetail={() => null}
        aria-label="Five candidates, outlines only"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const outlines = await waitFor(() => {
      const found = canvasElement.querySelectorAll(
        '[data-slot="radar-chart-outline"]',
      )
      expect(found.length).toBe(5)
      return Array.from(found)
    })
    for (const outline of outlines) {
      expect(getComputedStyle(outline).fill).toBe("rgba(0, 0, 0, 0)")
      expect(getComputedStyle(outline).strokeWidth).not.toBe("0px")
    }
    expect(
      canvasElement.querySelectorAll('[data-slot="radar-chart-dot"]').length,
    ).toBe(0)
  },
}

function StreamingRadarChart() {
  const [frame, setFrame] = React.useState(0)
  const [issues, setIssues] = React.useState<RadarChartLayoutIssue[]>([])
  React.useEffect(() => {
    if (frame >= RUBRIC_SERIES.length) return
    const timer = setTimeout(() => setFrame((previous) => previous + 1), 700)
    return () => clearTimeout(timer)
  }, [frame])

  // Only the scorecard still arriving is partial; once the stream finishes,
  // every series is whole and the issue set empties.
  const streamed = RUBRIC_SERIES.slice(0, frame).map((entry, index) =>
    index === frame - 1 && frame < RUBRIC_SERIES.length
      ? {
          ...entry,
          values: {
            systems: entry.values.systems,
            product: entry.values.product,
          },
        }
      : entry,
  )

  return (
    // Every band around the chart is a fixed height and every line is clamped
    // to one row. A status line that grows to two lines would shrink the plot
    // and re-lay the whole diagram out on the frame it appeared — which reads
    // as the chart flinching, not as data arriving.
    <div className="flex h-[560px] w-full max-w-2xl flex-col gap-3">
      <div className="flex h-8 shrink-0 items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setFrame(0)}>
          Replay stream
        </Button>
        <span
          className="nessa-text-2 truncate text-muted-foreground"
          data-testid="stream-status"
        >
          {issues.length === 0
            ? `${frame} of ${RUBRIC_SERIES.length} scorecards · data consistent`
            : `${issues.length} pending: ${issues[0].message}`}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <RadarChart
          axes={RUBRIC_AXES}
          series={streamed}
          formatValue={outOfTen}
          renderAxisDetail={() => null}
          onLayoutIssues={setIssues}
          aria-label="Scorecards streaming in"
        />
      </div>
      {/* Exactly what the chart is being handed this frame — the `series`
          prop verbatim. Fixed height and its own scroller, so a payload that
          grows row by row never resizes the plot above it. */}
      <div className="flex h-40 shrink-0 flex-col overflow-hidden rounded-md border border-border">
        <div className="shrink-0 border-b border-border px-2 py-1 nessa-text-2 text-muted-foreground">
          series (frame {frame})
        </div>
        <pre
          data-testid="stream-payload"
          // The panel scrolls, so it has to be reachable and scrollable from
          // the keyboard as well as the wheel.
          tabIndex={0}
          role="region"
          aria-label="Streamed series payload"
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
    "The chart under an agent streaming its data: scorecards arrive over a few seconds, and the newest one lands with most of its axes still missing. Those read as zero and are reported through `onLayoutIssues` rather than dropping the frame, and each new frame morphs the existing outlines to their new geometry (token-duration transitions; reduced motion snaps). The panel underneath is the `series` prop verbatim for the current frame — the chart takes typed arrays, not a wire format, so this is literally the value being handed to it — which makes the geometry and the payload readable against each other. Every band around the chart holds a fixed height and clamps its text to one line: a status line that grew to two would shrink the plot and re-lay the diagram out on the frame it appeared, which reads as the chart flinching rather than as data arriving. Once the stream settles, an empty issue set is the definitive success signal. The play test waits out the stream and asserts every series arrived and the data verified clean.",
  ),
  args: { axes: RUBRIC_AXES, series: RUBRIC_SERIES },
  render: () => <StreamingRadarChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("button", { name: "Replay stream" })
    await waitFor(
      () =>
        expect(
          canvasElement.querySelectorAll('[data-slot="radar-chart-series"]')
            .length,
        ).toBe(3),
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
    "The configuration surface: `palette={null}` returns the chart to the all-neutral wash and one series opts back into colour explicitly, `grid=\"none\"` strips the rings and spokes, the sweep starts a half step round so a label sits at the top-right, and a narrower gutter gives the plot more of the box. The play test proves the neutral series carries no tint while the highlighted one does, and that no grid ring was drawn.",
  ),
  args: {
    axes: [
      { id: "q1", label: "Q1", max: 100 },
      { id: "q2", label: "Q2", max: 100 },
      { id: "q3", label: "Q3", max: 100 },
      { id: "q4", label: "Q4", max: 100 },
      { id: "q5", label: "Q5", max: 100 },
    ],
    series: [
      { id: "plan", label: "Plan", values: { q1: 60, q2: 70, q3: 80, q4: 90, q5: 95 } },
      {
        id: "actual",
        label: "Actual",
        color: "var(--primary)",
        values: { q1: 55, q2: 78, q3: 62, q4: 88, q5: 70 },
      },
    ],
    palette: null,
    grid: "none",
    startAngle: 36,
    labelWidth: 56,
    curve: 0.4,
  },
  render: (args) => (
    <div className="h-96 w-full max-w-lg">
      <RadarChart
        {...args}
        formatValue={(value) => `${value}%`}
        aria-label="Plan against actual"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="radar-chart-outline"]')
          .length,
      ).toBe(2),
    )
    const plan = canvasElement.querySelector(
      '[data-slot="radar-chart-outline"][data-series-id="plan"]',
    )!
    const actual = canvasElement.querySelector(
      '[data-slot="radar-chart-outline"][data-series-id="actual"]',
    )!
    expect(plan.getAttribute("data-tinted")).toBe("false")
    expect(actual.getAttribute("data-tinted")).toBe("true")
    expect(
      canvasElement.querySelectorAll('[data-slot="radar-chart-ring"]').length,
    ).toBe(0)
    expect(
      canvasElement.querySelectorAll('[data-slot="radar-chart-spoke"]').length,
    ).toBe(0)
  },
}
