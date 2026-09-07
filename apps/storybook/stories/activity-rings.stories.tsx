import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, waitFor, within } from "storybook/test"
import { userEvent } from "storybook/test"
import {
  ActivityRings,
  ActivityRingsCard,
  Button,
  type ActivityRing,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Charts/ActivityRings",
  component: ActivityRings,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Closing rings for goal-tracking metrics: one band per metric, swept up from empty on first paint and eased to every later reading. `arrangement=\"concentric\"` nests a full circle per ring, outside-in in input order, and a ring that beats its goal **laps its own track** — the completed lap stays visible behind the leading arc rather than being clamped away. `arrangement=\"segmented\"` splits one circle between the rings instead, each taking a share of the sweep proportional to its goal, so the ring reads as a scorecard. The first three rings take the design system's **closing-ring trio** — energy, effort, uprightness, the register people already read as activity — which is a named token set rather than three slots borrowed from the categorical chart ramp; past the third, the palette continues into that ramp. Each role carries two steps: the band, a graphical mark, and the ink a legend writes its name in, which is the deepest hue-true version of the band that still clears text contrast. The sweep runs on Nessa's motion duration tokens, which `prefers-reduced-motion` collapses to zero — no host involvement, no JavaScript animation loop. The bands themselves are decoration: the readings reach a screen reader as an off-screen list, which a host already writing the same numbers as text turns off with `describeValues`. **ActivityRingsCard** is the composition that does exactly that — it pairs the rings, or any component put in their place, with a per-metric legend inside a `Card`, beside the figure or listed beneath it, and keeps the highlight on the figure and its legend row in step.",
      },
    },
  },
} satisfies Meta<typeof ActivityRings>

export default meta
type Story = StoryObj<typeof meta>

/** A day's movement, exercise, and standing against their daily goals. */
const DAY_RINGS: ActivityRing[] = [
  { id: "move", label: "Move", value: 450, goal: 800, unit: "CAL" },
  { id: "exercise", label: "Exercise", value: 19, goal: 30, unit: "MIN" },
  { id: "stand", label: "Stand", value: 4, goal: 12, unit: "HRS" },
]

/** Long enough for the slowest ring's staggered sweep to finish. */
const SWEPT = { timeout: 4000 }

/** The reading a band settles on, as the browser sees it. */
function bandOffset(canvasElement: HTMLElement, ringId: string): number {
  const band = canvasElement.querySelector(
    `[data-slot="activity-rings-band"][data-ring-id="${ringId}"]`,
  )
  expect(band).toBeTruthy()
  return Number.parseFloat(getComputedStyle(band!).strokeDashoffset)
}

export const ClosingRings: Story = {
  parameters: storyDocumentation(
    "Three concentric rings against their daily goals, in the closing-ring trio's own colours. Each band sweeps up from empty on first paint, one after another from the outside in. The play test waits for every band to settle and reads its dash offset out of the computed style — 1 minus the fraction of the goal met — which is the value the sweep actually lands on rather than a proxy for it, then checks the off-screen list carries all three readings.",
  ),
  args: { rings: DAY_RINGS },
  render: (args) => (
    <div className="size-[280px]">
      <ActivityRings {...args} aria-label="Today's activity" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(bandOffset(canvasElement, "move")).toBeCloseTo(1 - 450 / 800, 3),
      SWEPT,
    )
    await waitFor(
      () => expect(bandOffset(canvasElement, "exercise")).toBeCloseTo(1 - 19 / 30, 3),
      SWEPT,
    )
    await waitFor(
      () => expect(bandOffset(canvasElement, "stand")).toBeCloseTo(1 - 4 / 12, 3),
      SWEPT,
    )

    const readings = canvasElement.querySelector(
      '[data-slot="activity-rings-readings"]',
    )
    await expect(readings?.textContent).toContain("Move: 450 of 800 CAL, 56 percent")
    await expect(readings?.textContent).toContain("Stand: 4 of 12 HRS, 33 percent")
  },
}

export const AllRingsClosed: Story = {
  parameters: storyDocumentation(
    "Every goal met: three closed circles. A ring that lands exactly on its goal draws a full arc rather than an empty one — reading the remainder literally would empty the one ring whose meaning must never be ambiguous. The play test proves all three settled at a full circle and that none of them drew a lap band, because meeting a goal is not passing it.",
  ),
  args: {
    rings: [
      { id: "move", label: "Move", value: 800, goal: 800, unit: "CAL" },
      { id: "exercise", label: "Exercise", value: 30, goal: 30, unit: "MIN" },
      { id: "stand", label: "Stand", value: 12, goal: 12, unit: "HRS" },
    ],
  },
  render: (args) => (
    <div className="size-[280px]">
      <ActivityRings {...args} aria-label="Every goal met" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const id of ["move", "exercise", "stand"]) {
      await waitFor(
        () => expect(bandOffset(canvasElement, id)).toBeCloseTo(0, 3),
        SWEPT,
      )
    }
    await expect(
      canvasElement.querySelectorAll('[data-slot="activity-rings-lap"]'),
    ).toHaveLength(0)
  },
}

export const BeatenGoal: Story = {
  parameters: storyDocumentation(
    "All three goals met, and the move goal beaten by 40%. A reading past its goal is not clamped: the ring goes round again, the completed lap stays at full strength — it was completed — and the leading cap's shadow is what separates a ring at 140% from the two beside it that simply closed. The play test proves both halves: the lap band exists under the move ring and its leading arc settled on the 0.4 left over, while the ring that only met its goal closed with no lap under it.",
  ),
  args: {
    rings: [
      { id: "move", label: "Move", value: 1120, goal: 800, unit: "CAL" },
      { id: "exercise", label: "Exercise", value: 30, goal: 30, unit: "MIN" },
      { id: "stand", label: "Stand", value: 12, goal: 12, unit: "HRS" },
    ],
  },
  render: (args) => (
    <div className="size-[280px]">
      <ActivityRings {...args} aria-label="A day past its move goal" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const lapOf = (id: string) =>
      canvasElement.querySelector(
        `[data-slot="activity-rings-ring"][data-ring-id="${id}"] [data-slot="activity-rings-lap"]`,
      )
    await waitFor(() => expect(lapOf("move")).toBeTruthy(), SWEPT)
    await waitFor(
      () => expect(bandOffset(canvasElement, "move")).toBeCloseTo(0.6, 3),
      SWEPT,
    )

    await expect(lapOf("exercise")).toBeNull()
    await waitFor(
      () => expect(bandOffset(canvasElement, "exercise")).toBeCloseTo(0, 3),
      SWEPT,
    )
  },
}

export const NewReading: Story = {
  parameters: storyDocumentation(
    "Rings ease to a new reading the same way they arrive at the first one — the fill is a transitionable presentation attribute, so a streamed update animates without any host animation code. The play test waits for the move ring to settle, clicks a button that adds to the reading, and waits for it to settle further round.",
  ),
  args: { rings: DAY_RINGS },
  render: (args) => {
    const RingsWithUpdate = () => {
      const [moved, setMoved] = React.useState(450)
      return (
        <div className="flex flex-col items-start gap-4">
          <div className="size-[240px]">
            <ActivityRings
              {...args}
              rings={DAY_RINGS.map((ring) =>
                ring.id === "move" ? { ...ring, value: moved } : ring,
              )}
              aria-label="Today's activity"
            />
          </div>
          <Button onClick={() => setMoved((previous) => previous + 200)}>
            Log a walk
          </Button>
        </div>
      )
    }
    return <RingsWithUpdate />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(
      () => expect(bandOffset(canvasElement, "move")).toBeCloseTo(1 - 450 / 800, 3),
      SWEPT,
    )
    await userEvent.click(canvas.getByRole("button", { name: "Log a walk" }))
    await waitFor(
      () => expect(bandOffset(canvasElement, "move")).toBeCloseTo(1 - 650 / 800, 3),
      SWEPT,
    )
  },
}

/** The same day read at four points, from untouched to lapped. */
const PROGRESSIONS: { label: string; rings: ActivityRing[] }[] = [
  { label: "Not started", rings: [0, 0, 0] },
  { label: "Mid-morning", rings: [180, 8, 3] },
  { label: "Evening", rings: [450, 19, 9] },
  { label: "All closed", rings: [980, 41, 12] },
].map(({ label, rings }) => ({
  label,
  rings: DAY_RINGS.map((ring, index) => ({ ...ring, value: rings[index] })),
}))

export const Progression: Story = {
  parameters: storyDocumentation(
    "The same three goals read at four points in a day, side by side: untouched, part-way, nearly there, and every goal closed with the move ring lapped past its own. Ring position carries identity here, not just colour — the outer band is the move goal in all four. The play test checks each set settled on its own readings, so the four really are four states of one day rather than one picture repeated.",
  ),
  args: { rings: DAY_RINGS },
  render: () => (
    <div className="flex flex-wrap gap-6">
      {PROGRESSIONS.map((entry) => (
        <div
          key={entry.label}
          data-testid={`progression-${entry.label}`}
          className="flex flex-col items-center gap-2"
        >
          <div className="size-[140px]">
            <ActivityRings
              rings={entry.rings}
              aria-label={`${entry.label} activity`}
            />
          </div>
          <span className="nessa-text-2 text-muted-foreground">{entry.label}</span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const set = (label: string) =>
      canvasElement.querySelector<HTMLElement>(
        `[data-testid="progression-${label}"]`,
      )!
    await waitFor(
      () => expect(bandOffset(set("Not started"), "move")).toBeCloseTo(1, 3),
      SWEPT,
    )
    await waitFor(
      () => expect(bandOffset(set("Evening"), "move")).toBeCloseTo(1 - 450 / 800, 3),
      SWEPT,
    )
    // The last set has lapped its move goal and closed the other two.
    await waitFor(
      () =>
        expect(bandOffset(set("All closed"), "move")).toBeCloseTo(1 - 180 / 800, 3),
      SWEPT,
    )
    await expect(
      set("All closed").querySelector('[data-slot="activity-rings-lap"]'),
    ).toBeTruthy()
    await expect(
      set("Evening").querySelector('[data-slot="activity-rings-lap"]'),
    ).toBeNull()
  },
}

export const SummaryCard: Story = {
  parameters: storyDocumentation(
    "`ActivityRingsCard` in its `beside` layout: the rings on the left, one reading per ring down the right, inside the design system's own `Card`. Each reading is written in its ring's ink — the deepest hue-true version of the band that clears text contrast — so the row reads as the ring it names without setting text in a colour too light to read. The legend writes every number as text, so the rings stop repeating themselves to a screen reader. Hovering a row lifts its ring and recedes the others, and hovering a ring does the same to the rows. The play test drives the pointer over a legend row and reads the emphasis off both halves, then checks it clears on the way out.",
  ),
  args: { rings: DAY_RINGS },
  render: (args) => (
    <ActivityRingsCard
      rings={args.rings}
      className="w-[320px]"
      title="Activity Rings"
    />
  ),
  play: async ({ canvasElement }) => {
    const row = (id: string) =>
      canvasElement.querySelector(
        `[data-slot="activity-rings-card-row"][data-ring-id="${id}"]`,
      )!
    const ring = (id: string) =>
      canvasElement.querySelector(
        `[data-slot="activity-rings-ring"][data-ring-id="${id}"]`,
      )!

    await expect(row("move").textContent).toContain("450/800 CAL")
    await expect(row("stand").textContent).toContain("4/12 HRS")
    await waitFor(() => expect(ring("move")).toBeTruthy(), SWEPT)

    // React derives enter and leave from over and out, so those are the
    // events a pointer actually delivers to the row.
    await fireEvent.pointerOver(row("move"))
    await waitFor(() =>
      expect(ring("move")).toHaveAttribute("data-emphasis", "active"),
    )
    await expect(ring("stand")).toHaveAttribute("data-emphasis", "dim")
    await expect(row("stand")).toHaveAttribute("data-emphasis", "dim")

    await fireEvent.pointerOut(row("move"), { relatedTarget: document.body })
    await waitFor(() =>
      expect(ring("move")).toHaveAttribute("data-emphasis", "rest"),
    )
    await expect(ring("stand")).toHaveAttribute("data-emphasis", "rest")
  },
}

/** A night's sleep scored out of 100, with each contribution's own ceiling. */
const SLEEP_RINGS: ActivityRing[] = [
  {
    id: "duration",
    label: "Duration",
    value: 42,
    goal: 50,
    detail: "6h 40m",
  },
  {
    id: "bedtime",
    label: "Bedtime",
    value: 26,
    goal: 30,
    detail: "34m later than average",
  },
  {
    id: "interruptions",
    label: "Interruptions",
    value: 18,
    goal: 20,
    detail: "5 wake-ups, 9m total",
  },
]

export const ScoreBreakdownCard: Story = {
  parameters: storyDocumentation(
    "The same card in its `stacked` layout with `arrangement=\"segmented\"`: one ring split between the three contributions, each segment as wide as its share of the hundred points and filled to what it actually scored. The headline sits beside the ring, the contributions are listed beneath it with their own second line, and `renderCenter` puts the total in the middle. The play test reads the centre, checks each row carries its detail line, and proves the segments are goal-weighted — the 50-point contribution draws a longer track than the 20-point one.",
  ),
  args: { rings: SLEEP_RINGS },
  render: (args) => (
    <ActivityRingsCard
      rings={args.rings}
      layout="stacked"
      arrangement="segmented"
      className="w-[340px]"
      figureSize={116}
      title="High"
      description="Sleep score"
      action={
        <Button variant="ghost" size="sm" aria-label="About this score">
          Info
        </Button>
      }
      renderCenter={({ rings }) => (
        <span className="nessa-text-6 font-semibold">
          {rings.reduce((sum, entry) => sum + entry.value, 0)}
        </span>
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-slot="activity-rings-center"]')
            ?.textContent,
        ).toBe("86"),
      SWEPT,
    )

    const row = (id: string) =>
      canvasElement.querySelector(
        `[data-slot="activity-rings-card-row"][data-ring-id="${id}"]`,
      )!
    await expect(row("duration").textContent).toContain("42/50")
    await expect(row("duration").textContent).toContain("6h 40m")
    await expect(row("interruptions").textContent).toContain(
      "5 wake-ups, 9m total",
    )

    // A segment's track is as long as the goal it carries.
    const track = (id: string) =>
      canvasElement
        .querySelector<SVGPathElement>(
          `[data-slot="activity-rings-ring"][data-ring-id="${id}"] [data-slot="activity-rings-track"]`,
        )!
        .getTotalLength()
    await waitFor(
      () => expect(track("duration")).toBeGreaterThan(track("interruptions")),
      SWEPT,
    )
    await expect(track("bedtime")).toBeGreaterThan(track("interruptions"))
  },
}

export const AnyFigure: Story = {
  parameters: storyDocumentation(
    "`figure` puts any component where the rings would go, and the legend keeps describing the same metrics — the card is a figure-plus-legend layout that happens to default to rings. Here one ring is pulled out on its own as an oversized single gauge. The play test proves the host's figure is what rendered and that the legend still carries every reading.",
  ),
  args: { rings: DAY_RINGS },
  render: (args) => (
    <ActivityRingsCard
      rings={args.rings}
      className="w-[340px]"
      figureSize={140}
      title="Move goal"
      figure={
        <ActivityRings
          rings={[args.rings[0]]}
          thickness={22}
          describeValues={false}
          data-testid="single-gauge"
          renderCenter={({ completion }) => (
            <span className="nessa-text-6 font-semibold">
              {Math.round(completion * 100)}%
            </span>
          )}
        />
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId("single-gauge")).toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-slot="activity-rings-center"]')
            ?.textContent,
        ).toBe("56%"),
      SWEPT,
    )
    const legend = canvasElement.querySelector(
      '[data-slot="activity-rings-card-legend"]',
    )
    await expect(legend?.textContent).toContain("19/30 MIN")
  },
}
