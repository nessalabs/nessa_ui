import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  GanttChart,
  GanttChartGrid,
  GanttChartToolbar,
  Input,
  PopoverSurface,
  ganttChartDateColumns,
  type GanttChartProps,
  type GanttChartQuickCreateContext,
  type GanttChartTask,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

/** Pixels one day occupies at the stories' default week scale. */
const WEEK_SCALE_DAY_WIDTH = 12

/** Fixed clock all stories share: Tuesday, August 18, 2026. */
const storyNow = new Date(2026, 7, 18)

/** Builds a day in the stories' fixed 2026 window (0-based month). */
function d(month: number, day: number) {
  return new Date(2026, month, day)
}

/**
 * A believable release plan for the design system itself. Summary rows
 * derive their span and progress from their children (their own dates
 * are ignored), milestones are zero-duration, and every relation the
 * plan declares is satisfied by its dates — a plan that contradicts its
 * own links draws them dashed, which the DependencyViolations story
 * shows on purpose.
 */
const demoTasks: GanttChartTask[] = [
  { id: "design", name: "Design", start: d(7, 3), end: d(7, 22) },
  {
    id: "discovery",
    name: "Discovery & audit",
    start: d(7, 3),
    end: d(7, 15),
    progress: 1,
    parentId: "design",
  },
  {
    id: "visual-language",
    name: "Visual language",
    start: d(7, 10),
    end: d(7, 22),
    progress: 0.75,
    parentId: "design",
    dependsOn: [
      { taskId: "discovery", type: "start-to-start", lagDays: 7 },
    ],
  },
  {
    id: "design-review",
    name: "Design review",
    start: d(7, 22),
    end: d(7, 22),
    parentId: "design",
    dependsOn: ["visual-language"],
  },
  { id: "engineering", name: "Engineering", start: d(7, 17), end: d(9, 3) },
  {
    id: "primitives",
    name: "Primitives",
    start: d(7, 22),
    end: d(8, 3),
    progress: 0.6,
    parentId: "engineering",
    dependsOn: ["design-review"],
  },
  {
    id: "composites",
    name: "Composites",
    start: d(8, 3),
    end: d(8, 22),
    progress: 0.15,
    parentId: "engineering",
    dependsOn: ["primitives"],
  },
  {
    id: "code-freeze",
    name: "Code freeze",
    start: d(8, 22),
    end: d(8, 22),
    tone: "destructive",
    parentId: "engineering",
    dependsOn: ["composites"],
  },
  {
    id: "hardening",
    name: "Hardening & QA",
    start: d(8, 22),
    end: d(9, 3),
    tone: "muted",
    parentId: "engineering",
    dependsOn: ["composites"],
  },
  { id: "launch", name: "Launch", start: d(8, 14), end: d(9, 17) },
  {
    id: "docs",
    name: "Docs sprint",
    start: d(8, 14),
    end: d(8, 26),
    tone: "secondary",
    parentId: "launch",
  },
  {
    id: "beta",
    name: "Beta release",
    start: d(9, 3),
    end: d(9, 3),
    parentId: "launch",
    dependsOn: ["hardening"],
  },
  {
    id: "ga",
    name: "v1.0 GA",
    start: d(9, 16),
    end: d(9, 16),
    parentId: "launch",
    dependsOn: ["beta", "docs"],
  },
]

/** The stories' standard composition: toolbar over grid, fixed clock. */
function PlanChart(props: Partial<GanttChartProps>) {
  return (
    <GanttChart
      now={storyNow}
      defaultTasks={demoTasks}
      className="h-[540px] w-[880px] max-w-full"
      {...props}
    >
      <GanttChartToolbar />
      <GanttChartGrid />
    </GanttChart>
  )
}

const meta = {
  title: "Components/GanttChart",
  component: GanttChart,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A project-plan timeline in the industry's Gantt shape: a pinned task list beside a scrollable day/week/month timeline of bars, milestones, and roll-up summary brackets, with finish-to-start dependency arrows, a today marker, weekend shading, and collapsible groups. Bars reschedule by drag, edge-drag resizing, or keyboard chords behind a confirmable move gate, the toolbar composes the SegmentedControl primitive for its scale switcher, and labels plus shortcuts are fully host-overridable.",
      },
    },
  },
} satisfies Meta<typeof GanttChart>

export default meta
type Story = StoryObj<typeof meta>

export const ProjectPlan: Story = {
  parameters: storyDocumentation(
    "The flagship composition at the default week scale: grouped bars with progress fills, milestone diamonds, dependency arrows, and the today marker. The play test proves the surfaces by computed style — a painted bar, a painted today line, a non-empty progress fill — and that activating a bar takes the selected state.",
  ),
  render: () => <PlanChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = await canvas.findByRole("button", { name: /^Primitives,/ })
    await expect(getComputedStyle(bar).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    )

    // Primitives is 60% done: the in-bar meter paints its track and its
    // fill spans 60% of it (computed styles, not class names).
    const meter = bar.querySelector<HTMLElement>(
      '[data-slot="gantt-chart-bar-progress"]',
    )
    await expect(meter).not.toBeNull()
    await expect(
      getComputedStyle(meter as HTMLElement).backgroundColor,
    ).not.toBe("rgba(0, 0, 0, 0)")
    const meterFill = (meter as HTMLElement)
      .firstElementChild as HTMLElement
    await expect(
      parseFloat(getComputedStyle(meterFill).width),
    ).toBeCloseTo(
      parseFloat(getComputedStyle(meter as HTMLElement).width) * 0.6,
      0,
    )

    const today = canvasElement.querySelector<HTMLElement>(
      '[data-slot="gantt-chart-today"]',
    )
    await expect(today).not.toBeNull()
    await expect(
      getComputedStyle(today as HTMLElement).backgroundColor,
    ).not.toBe("rgba(0, 0, 0, 0)")

    const arrows = canvasElement.querySelectorAll(
      '[data-slot="gantt-chart-dependencies"] path[marker-end]',
    )
    await expect(arrows.length).toBeGreaterThanOrEqual(5)

    await userEvent.click(bar)
    await expect(bar).toHaveAttribute("aria-pressed", "true")
  },
}

export const DayScale: Story = {
  parameters: storyDocumentation(
    "The day scale zooms each column to a single day and shades weekends. The play test asserts the weekend underlay actually paints (computed background, not class names) and that the scale switcher reports the day option pressed.",
  ),
  render: () => <PlanChart defaultScale="day" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "Day" }),
    ).toHaveAttribute("aria-pressed", "true")
    const weekends = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="gantt-chart-weekend"]',
    )
    await expect(weekends.length).toBeGreaterThan(10)
    await expect(
      getComputedStyle(weekends[0]).backgroundColor,
    ).not.toBe("rgba(0, 0, 0, 0)")
  },
}

export const MonthScale: Story = {
  parameters: storyDocumentation(
    "The month scale compresses the plan to a portfolio overview: month columns under a year tier. A short plan never huddles in a corner — when a scale's natural width comes up under the viewport, the days stretch to fill the host's box. The play test asserts the fit (the lane spans the viewport) and that bar widths keep their day-count proportions.",
  ),
  render: () => <PlanChart defaultScale="month" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The timeline fills the viewport rather than stopping at the
    // scale's natural width (task list is the default 224px).
    const scroller = canvas.getByRole("region", { name: "Project timeline" })
    const lane = canvasElement.querySelector(
      '[data-slot="gantt-chart-lane"]',
    ) as HTMLElement
    await waitFor(async () => {
      await expect(
        parseFloat(getComputedStyle(lane).width),
      ).toBeGreaterThanOrEqual(scroller.clientWidth - 224 - 1)
    })
    // Widths keep their day-count proportions: Composites (19 days)
    // against Primitives (12 days).
    const composites = await canvas.findByRole("button", {
      name: /^Composites,/,
    })
    const primitives = canvas.getByRole("button", { name: /^Primitives,/ })
    await expect(
      parseFloat(getComputedStyle(composites).width) /
        parseFloat(getComputedStyle(primitives).width),
    ).toBeCloseTo(19 / 12, 1)
  },
}

export const GroupCollapse: Story = {
  parameters: storyDocumentation(
    "Summary rows collapse their subtree from the task list's chevron toggles; the Launch group starts collapsed here. The play test expands it, proves the chevron actually rotates by computed style, asserts the hidden rows return, and checks a summary bracket spans its children's union.",
  ),
  render: () => <PlanChart defaultCollapsedTaskIds={["launch"]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.queryByRole("button", { name: /^Docs sprint,/ }),
    ).toBeNull()

    // With rows collapsed away, the host's box is taller than the rows:
    // the filler carries the pinned column to the bottom, so the task
    // list never falls short of its own frame.
    const filler = canvasElement.querySelector(
      '[data-slot="gantt-chart-filler"]',
    ) as HTMLElement
    await waitFor(async () => {
      await expect(
        parseFloat(getComputedStyle(filler).height),
      ).toBeGreaterThan(20)
    })
    const fillerCell = filler.firstElementChild as HTMLElement
    await expect(
      getComputedStyle(fillerCell).backgroundColor,
    ).not.toBe("rgba(0, 0, 0, 0)")
    await expect(getComputedStyle(fillerCell).borderRightStyle).toBe("solid")

    const toggle = canvas.getByRole("button", { name: "Expand Launch" })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(toggle)

    await canvas.findByRole("button", { name: /^Docs sprint,/ })
    const collapseToggle = canvas.getByRole("button", {
      name: "Collapse Launch",
    })
    await expect(collapseToggle).toHaveAttribute("aria-expanded", "true")
    const chevron = collapseToggle.querySelector("svg") as SVGElement
    await waitFor(async () => {
      await expect(getComputedStyle(chevron).rotate).toBe("90deg")
    })

    // Engineering rolls up Aug 22 – Oct 3 exclusive: 42 days × 12px.
    const summary = canvas.getByRole("button", { name: /^Engineering,/ })
    await expect(parseFloat(getComputedStyle(summary).width)).toBeCloseTo(
      42 * WEEK_SCALE_DAY_WIDTH,
      0,
    )
  },
}

export const KeyboardRescheduling: Story = {
  parameters: storyDocumentation(
    "The keyboard path: Shift+Arrow nudges reposition a pending ghost without committing, Enter raises the confirmation dialog with its Move button focused, and Escape abandons an adjustment. The play test walks a two-day nudge through the dialog and asserts the bar's committed position by computed left offset, then switches scales with the global `d` shortcut.",
  ),
  render: () => <PlanChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = await canvas.findByRole("button", { name: /^Docs sprint,/ })
    const initialLeft = parseFloat(getComputedStyle(bar).left)

    bar.focus()
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}")
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}")
    const ghost = canvasElement.querySelector<HTMLElement>(
      '[data-slot="gantt-chart-ghost"]',
    )
    await expect(ghost).not.toBeNull()
    await expect(
      parseFloat(getComputedStyle(ghost as HTMLElement).left),
    ).toBeCloseTo(initialLeft + 2 * WEEK_SCALE_DAY_WIDTH, 0)

    await userEvent.keyboard("{Enter}")
    const dialog = await canvas.findByRole("dialog", { name: "Confirm move" })
    const moveButton = within(dialog).getByRole("button", { name: "Move" })
    await expect(moveButton).toHaveFocus()
    await userEvent.click(moveButton)

    await waitFor(async () => {
      const movedBar = canvas.getByRole("button", { name: /^Docs sprint,/ })
      await expect(parseFloat(getComputedStyle(movedBar).left)).toBeCloseTo(
        initialLeft + 2 * WEEK_SCALE_DAY_WIDTH,
        0,
      )
    })
    await expect(
      canvasElement.querySelector('[data-slot="gantt-chart-ghost"]'),
    ).toBeNull()

    // An adjustment abandoned with Escape leaves the task untouched.
    const movedBar = canvas.getByRole("button", { name: /^Docs sprint,/ })
    movedBar.focus()
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}")
    await expect(
      canvasElement.querySelector('[data-slot="gantt-chart-ghost"]'),
    ).not.toBeNull()
    await userEvent.keyboard("{Escape}")
    await expect(
      canvasElement.querySelector('[data-slot="gantt-chart-ghost"]'),
    ).toBeNull()

    // The global scale shortcut works from the focusable timeline region.
    const region = canvas.getByRole("region", { name: "Project timeline" })
    region.focus()
    await userEvent.keyboard("d")
    await expect(
      canvas.getByRole("button", { name: "Day" }),
    ).toHaveAttribute("aria-pressed", "true")
  },
}

export const PointerRescheduling: Story = {
  parameters: storyDocumentation(
    "The pointer path: dragging a bar proposes new dates behind the confirmation dialog, and the edge handles resize instead of move. The play test drags a bar two days out and Keeps it (asserting nothing changed), then drags the end handle and commits the Resize, asserting the grown width by computed style. Synthetic drags must carry buttons: 1 — the chart aborts a session whose buttons report released.",
  ),
  render: () => <PlanChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = await canvas.findByRole("button", { name: /^Primitives,/ })
    const initialLeft = parseFloat(getComputedStyle(bar).left)
    const initialWidth = parseFloat(getComputedStyle(bar).width)

    // Drag the whole bar two days later, then keep the original dates.
    fireEvent.pointerDown(bar, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 300,
    })
    fireEvent.pointerMove(window, {
      buttons: 1,
      pointerId: 1,
      clientX: 300 + 2 * WEEK_SCALE_DAY_WIDTH,
    })
    fireEvent.pointerUp(window, { pointerId: 1 })
    const moveDialog = await canvas.findByRole("dialog", {
      name: "Confirm move",
    })
    await userEvent.click(
      within(moveDialog).getByRole("button", { name: "Keep" }),
    )
    await expect(parseFloat(getComputedStyle(bar).left)).toBeCloseTo(
      initialLeft,
      0,
    )
    await expect(bar).toHaveAttribute("aria-pressed", "false")

    // Drag the end handle two days out and commit the resize.
    const endHandle = bar.querySelector(
      '[data-slot="gantt-chart-bar-resize-end"]',
    ) as HTMLElement
    fireEvent.pointerDown(endHandle, {
      button: 0,
      buttons: 1,
      pointerId: 2,
      clientX: 400,
    })
    fireEvent.pointerMove(window, {
      buttons: 1,
      pointerId: 2,
      clientX: 400 + 2 * WEEK_SCALE_DAY_WIDTH,
    })
    fireEvent.pointerUp(window, { pointerId: 2 })
    const resizeDialog = await canvas.findByRole("dialog", {
      name: "Confirm resize",
    })
    await userEvent.click(
      within(resizeDialog).getByRole("button", { name: "Resize" }),
    )
    await waitFor(async () => {
      const resizedBar = canvas.getByRole("button", { name: /^Primitives,/ })
      await expect(parseFloat(getComputedStyle(resizedBar).width)).toBeCloseTo(
        initialWidth + 2 * WEEK_SCALE_DAY_WIDTH,
        0,
      )
    })
  },
}

function CascadeDemo() {
  // The story lands with the cascade on so the Move all / Only this ask
  // is one drag away; the toolbar button hands the choice to the user.
  const [moveDependents, setMoveDependents] = React.useState(true)
  return (
    <GanttChart
      now={storyNow}
      defaultTasks={demoTasks}
      moveDependents={moveDependents}
      className="h-[540px] w-[880px] max-w-full"
    >
      <GanttChartToolbar>
        <Button
          variant={moveDependents ? "secondary" : "outline"}
          size="sm"
          aria-pressed={moveDependents}
          onClick={() => setMoveDependents((current) => !current)}
        >
          Cascade dependents
        </Button>
      </GanttChartToolbar>
      <GanttChartGrid />
    </GanttChart>
  )
}

export const DependentCascade: Story = {
  parameters: storyDocumentation(
    "The moveDependents option: while it is on, the built-in confirmation asks per move — Move all takes every transitive dependent along by the same day count (simplest finish-to-start push scheduling), Only this reschedules just the task — and names how many tasks would follow; while it is off, arrows stay purely visual and the dialog shows its plain Move. The host owns the toggle (a toolbar button here), the built-in ask is only the example: renderMoveConfirm plus confirm({ moveDependents }) and the context's dependentTaskIds let hosts build their own chooser. The play test commits a Move all and asserts Composites followed by computed offset, then an Only this and proves the chain stayed put.",
  ),
  render: () => <CascadeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "Cascade dependents" }),
    ).toHaveAttribute("aria-pressed", "true")

    const composites = await canvas.findByRole("button", {
      name: /^Composites,/,
    })
    const compositesLeft = parseFloat(getComputedStyle(composites).left)

    const primitives = canvas.getByRole("button", { name: /^Primitives,/ })
    primitives.focus()
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}")
    await userEvent.keyboard("{Enter}")
    const dialog = await canvas.findByRole("dialog", { name: "Confirm move" })
    // Primitives feeds Composites → Code freeze / Hardening → Beta → GA.
    await expect(
      within(dialog).getByText("Also moves 5 dependent tasks."),
    ).toBeInTheDocument()
    await expect(
      within(dialog).getByRole("button", { name: "Move all" }),
    ).toHaveFocus()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Move all" }),
    )
    await waitFor(async () => {
      const moved = canvas.getByRole("button", { name: /^Composites,/ })
      await expect(parseFloat(getComputedStyle(moved).left)).toBeCloseTo(
        compositesLeft + WEEK_SCALE_DAY_WIDTH,
        0,
      )
    })

    // Only this: the task moves again, the chain stays where it landed.
    const primitivesAgain = canvas.getByRole("button", {
      name: /^Primitives,/,
    })
    primitivesAgain.focus()
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}")
    await userEvent.keyboard("{Enter}")
    const secondDialog = await canvas.findByRole("dialog", {
      name: "Confirm move",
    })
    await userEvent.click(
      within(secondDialog).getByRole("button", { name: "Only this" }),
    )
    await waitFor(async () => {
      const settled = canvas.getByRole("button", { name: /^Composites,/ })
      await expect(parseFloat(getComputedStyle(settled).left)).toBeCloseTo(
        compositesLeft + WEEK_SCALE_DAY_WIDTH,
        0,
      )
    })

    // A start-only resize that pushes a start-driven link must ask too:
    // the dialog gate reads the same typed propagation the commit runs.
    const startDriven = canvas.getByRole("button", {
      name: /^Visual language,/,
    })
    startDriven.focus()
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}")
    await userEvent.keyboard("{Enter}")
    const cascadeDialog = await canvas.findByRole("dialog", {
      name: "Confirm move",
    })
    await expect(
      within(cascadeDialog).getByRole("button", { name: "Move all" }),
    ).toBeInTheDocument()
    await userEvent.click(
      within(cascadeDialog).getByRole("button", { name: "Keep" }),
    )

    // With the option off, the dialog goes back to its plain Move.
    await userEvent.click(
      canvas.getByRole("button", { name: "Cascade dependents" }),
    )
    const primitivesThird = canvas.getByRole("button", {
      name: /^Primitives,/,
    })
    primitivesThird.focus()
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}")
    await userEvent.keyboard("{Enter}")
    const thirdDialog = await canvas.findByRole("dialog", {
      name: "Confirm move",
    })
    await expect(
      within(thirdDialog).queryByRole("button", { name: "Move all" }),
    ).toBeNull()
    await userEvent.click(
      within(thirdDialog).getByRole("button", { name: "Keep" }),
    )
  },
}

/** A small plan whose four links show one relation type each. */
const relationTasks: GanttChartTask[] = [
  { id: "spec", name: "Spec", start: d(7, 3), end: d(7, 10) },
  {
    id: "build",
    name: "Build",
    start: d(7, 10),
    end: d(7, 21),
    dependsOn: ["spec"],
  },
  {
    id: "docs",
    name: "Docs",
    start: d(7, 10),
    end: d(7, 17),
    tone: "secondary",
    dependsOn: [{ taskId: "build", type: "start-to-start" }],
  },
  {
    id: "review",
    name: "Review",
    start: d(7, 17),
    end: d(7, 21),
    tone: "secondary",
    dependsOn: [{ taskId: "build", type: "finish-to-finish" }],
  },
  {
    id: "handover",
    name: "Handover",
    start: d(7, 24),
    end: d(7, 28),
    tone: "muted",
    dependsOn: [{ taskId: "build", type: "finish-to-start", lagDays: 3 }],
  },
]

/**
 * A plan with one tight chain and one branch that has slack, so the
 * critical path is worth looking at: Draft → Review → Sign-off run
 * end-to-end into the launch, while Assets finishes early.
 */
const criticalPathTasks: GanttChartTask[] = [
  { id: "draft", name: "Draft", start: d(7, 3), end: d(7, 12) },
  {
    id: "cp-review",
    name: "Review",
    start: d(7, 12),
    end: d(7, 19),
    dependsOn: ["draft"],
  },
  {
    id: "assets",
    name: "Assets",
    start: d(7, 5),
    end: d(7, 12),
    tone: "secondary",
  },
  {
    id: "signoff",
    name: "Sign-off",
    start: d(7, 19),
    end: d(7, 24),
    dependsOn: ["cp-review", { taskId: "assets", type: "finish-to-start" }],
  },
  {
    id: "cp-launch",
    name: "Launch",
    start: d(7, 24),
    end: d(7, 24),
    dependsOn: ["signoff"],
  },
]

export const DependencyTypes: Story = {
  parameters: storyDocumentation(
    "All four industry relation types on one plan, plus a lag. `dependsOn` takes a bare id as the finish-to-start shorthand or `{ taskId, type, lagDays }` for the rest, and each arrow leaves and arrives at the edges its relation names — so a start-to-start link runs left edge to left edge rather than pretending to be finish-to-start. Shown with `linkable={false}`: a read-only plan's arrows announce as images and add no tab stops. The play test asserts one arrow per relation, reads their announcements, and verifies the routing by each path's own endpoints.",
  ),
  render: () => (
    <PlanChart
      defaultTasks={relationTasks}
      defaultScale="day"
      linkable={false}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const arrows = canvasElement.querySelectorAll(
      '[data-slot="gantt-chart-dependency"]',
    )
    await expect(arrows).toHaveLength(4)
    // Read-only arrows announce as images: the relation still reaches
    // assistive tech, but adds no tab stop.
    await expect(
      canvas.getByRole("img", { name: "Spec to Build, finish to start" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("img", { name: "Build to Docs, start to start" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("img", { name: "Build to Review, finish to finish" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("img", {
        name: "Build to Handover, finish to start, 3 days lag",
      }),
    ).toBeInTheDocument()
    await expect(
      canvasElement.querySelectorAll(
        '[data-slot="gantt-chart-dependencies"] [role="button"]',
      ),
    ).toHaveLength(0)

    // Routing, not just labelling: each arrow has to leave and arrive at
    // the edges its relation names, which the path's own endpoints show.
    const endpoints = (predecessorId: string, successorId: string) => {
      const path = canvasElement
        .querySelector(
          `[data-slot="gantt-chart-dependency"][data-predecessor-id="${predecessorId}"][data-successor-id="${successorId}"] path`,
        )
        ?.getAttribute("d") as string
      const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
      return { fromX: numbers[0], toX: numbers[numbers.length - 1] }
    }
    const dayX = (monthDay: number) =>
      ((d(7, monthDay).getTime() - d(6, 27).getTime()) / 86_400_000) * 40

    // Finish-to-start leaves Spec's finish and arrives at Build's start.
    const fs = endpoints("spec", "build")
    await expect(fs.fromX).toBeCloseTo(dayX(10), 0)
    // Start-to-start leaves Build's start, running back to Docs's start.
    const ss = endpoints("build", "docs")
    await expect(ss.fromX).toBeCloseTo(dayX(10), 0)
    // Finish-to-finish leaves Build's finish and arrives at Review's finish.
    const ff = endpoints("build", "review")
    await expect(ff.fromX).toBeCloseTo(dayX(21), 0)
    await expect(ff.toX).toBeGreaterThan(dayX(20))
  },
}

export const CriticalPath: Story = {
  parameters: storyDocumentation(
    "Critical-path highlighting, on from the start here and toggled from the toolbar. Float is derived from the dependency graph — a task with none left cannot slip without pushing the plan's finish — so the chain that carries the finish takes the destructive treatment while everything with slack stays in its own tone. The play test asserts the toggle's pressed state, that a chain task is marked and a slack task is not, and that turning it off clears the marks.",
  ),
  render: () => (
    <PlanChart
      defaultTasks={criticalPathTasks}
      defaultScale="day"
      defaultShowCriticalPath
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole("button", { name: "Critical path" })
    await expect(toggle).toHaveAttribute("aria-pressed", "true")

    // Draft → Review → Sign-off → Launch runs without a gap, so no link in
    // the chain can slip without moving the launch.
    const onPath = canvas.getByRole("button", { name: /^Draft,/ })
    await expect(onPath).toHaveAttribute("data-critical", "true")
    await expect(onPath.getAttribute("aria-label")).toContain(
      "On the critical path",
    )
    // The house rule: prove a visual claim by computed style, since the
    // class name exists whether or not Tailwind generated the rule.
    const slack = canvas.getByRole("button", { name: /^Assets,/ })
    await waitFor(async () => {
      await expect(getComputedStyle(onPath).boxShadow).not.toBe("none")
      await expect(getComputedStyle(onPath).boxShadow).not.toBe(
        getComputedStyle(slack).boxShadow,
      )
    })
    // Assets finishes a week before sign-off needs it: seven days of float.
    await expect(
      canvas.getByRole("button", { name: /^Assets,/ }),
    ).not.toHaveAttribute("data-critical")

    await userEvent.click(toggle)
    await waitFor(async () => {
      await expect(
        canvas.getByRole("button", { name: /^Draft,/ }),
      ).not.toHaveAttribute("data-critical")
    })
  },
}

export const DependencyLinking: Story = {
  parameters: storyDocumentation(
    "Dependency editing is on by default: every bar grows a link handle at each edge — drag one onto another task to draw a relation, or activate it and pick the target from the keyboard. Links that would close a loop are refused, so the target never lights up. Selecting an arrow and pressing Delete removes it; `linkable={false}` turns all of it off for a read-only plan. The play test draws a link with the keyboard path, asserts the new arrow exists, then selects and deletes it.",
  ),
  render: () => <PlanChart />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Keyboard path: activate a handle, then activate the target task.
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Link from the finish of Docs sprint",
      }),
    )
    await userEvent.click(
      canvas.getByRole("button", { name: /^Beta release,/ }),
    )

    const arrow = await canvas.findByRole("button", {
      name: "Docs sprint to Beta release, finish to start",
    })

    // Selecting the arrow and pressing Delete takes the link back out.
    await userEvent.click(arrow)
    await expect(arrow).toHaveAttribute("aria-pressed", "true")
    await userEvent.keyboard("{Delete}")
    await waitFor(async () => {
      await expect(
        canvas.queryByRole("button", {
          name: "Docs sprint to Beta release, finish to start",
        }),
      ).toBeNull()
    })
  },
}

/** The stories' quick-create card — a host composition, not part of the chart. */
function QuickCreateCard({ context }: { context: GanttChartQuickCreateContext }) {
  const [name, setName] = React.useState("")
  const format = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })
  return (
    <PopoverSurface
      radius="lg"
      role="dialog"
      aria-label="Add task"
      className="flex w-64 flex-col gap-2 p-3"
    >
      <p className="text-xs text-muted-foreground">
        {format.format(context.range.start)} –{" "}
        {format.format(new Date(context.range.end.getTime() - 86_400_000))}
      </p>
      <Input
        autoFocus
        aria-label="Task name"
        placeholder="Task name"
        className="h-7"
        value={name}
        onChange={(changeEvent) => setName(changeEvent.target.value)}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Enter") {
            keyEvent.preventDefault()
            context.createTask(name ? { name } : undefined)
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7"
          onClick={() => context.createTask(name ? { name } : undefined)}
        >
          Add task
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={context.cancel}
        >
          Cancel
        </Button>
      </div>
    </PopoverSurface>
  )
}

export const QuickCreate: Story = {
  parameters: storyDocumentation(
    "Dragging across empty lane background proposes a new task's dates and opens the host's own quick-create card through `renderQuickCreate` — the chart owns the gesture, the highlight, placement and Escape, the host owns every pixel of the card and resolves it with `createTask`/`cancel`. Providing the prop also gives every lane a keyboard surface: arrow keys choose days, Shift extends the selection, Enter opens the card. A task drawn on a group's lane joins that group. The play test exercises both paths and asserts each created task lands with its chosen dates by computed width.",
  ),
  render: () => (
    <PlanChart
      defaultScale="day"
      renderQuickCreate={(context) => <QuickCreateCard context={context} />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The gesture lives on the lane's focusable surface, where a real
    // pointer lands; the bare lane div underneath no longer listens.
    const lane = canvasElement.querySelector<HTMLElement>(
      '[data-slot="gantt-chart-lane"][data-task-id="code-freeze"] [data-slot="gantt-chart-lane-surface"]',
    ) as HTMLElement
    const laneRect = lane.getBoundingClientRect()

    fireEvent.pointerDown(lane, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: laneRect.left + 200,
      clientY: laneRect.top + 10,
    })
    fireEvent.pointerMove(window, {
      buttons: 1,
      pointerId: 1,
      clientX: laneRect.left + 320,
      clientY: laneRect.top + 10,
    })
    fireEvent.pointerUp(window, { pointerId: 1 })

    // One-shot change + an immediately re-queried click: the dev canvas
    // can abort and restart a play mid-run on a story's first visit
    // (storybook module loading suspends), and a long userEvent.type
    // window loses its keystrokes to the remount — which used to leave a
    // ghost "(No name)" task behind. vitest never interleaves, but the
    // story should hold up in both.
    const card = await canvas.findByRole("dialog", { name: "Add task" })
    fireEvent.change(
      within(card).getByRole("textbox", { name: "Task name" }),
      { target: { value: "Release notes" } },
    )
    await userEvent.click(
      within(
        await canvas.findByRole("dialog", { name: "Add task" }),
      ).getByRole("button", { name: "Add task" }),
    )

    const created = await canvas.findByRole("button", {
      name: /^Release notes,/,
    })
    await expect(
      canvas.queryByRole("dialog", { name: "Add task" }),
    ).toBeNull()
    // The task lands on the dragged range, counted in whole days: a drag
    // from inside day 5 to inside day 8 covers four days at 40px each.
    await expect(parseFloat(getComputedStyle(created).width)).toBeCloseTo(
      160,
      0,
    )

    // Keyboard path: the lane surface takes arrows for the days, Shift to
    // extend, and Enter for the card.
    const surface = canvas.getByRole("button", {
      name: /^Add to the Docs sprint row/,
    })
    surface.focus()
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}")
    await expect(surface.getAttribute("aria-label")).toContain(
      "Docs sprint row, selected",
    )
    const highlight = canvasElement.querySelector<HTMLElement>(
      '[data-slot="gantt-chart-draft"]',
    )
    await expect(highlight).not.toBeNull()
    await expect(
      parseFloat(getComputedStyle(highlight as HTMLElement).width),
    ).toBeCloseTo(80, 0)

    await userEvent.keyboard("{Enter}")
    const keyboardCard = await canvas.findByRole("dialog", {
      name: "Add task",
    })
    fireEvent.change(
      within(keyboardCard).getByRole("textbox", { name: "Task name" }),
      { target: { value: "QA checklist" } },
    )
    await userEvent.click(
      within(
        await canvas.findByRole("dialog", { name: "Add task" }),
      ).getByRole("button", { name: "Add task" }),
    )
    const typed = await canvas.findByRole("button", {
      name: /^QA checklist,/,
    })
    // Two days selected at the day scale's 40px each.
    await expect(parseFloat(getComputedStyle(typed).width)).toBeCloseTo(
      80,
      0,
    )
  },
}

export const TaskColumns: Story = {
  parameters: storyDocumentation(
    "The task list takes host-defined columns beside the name; `ganttChartDateColumns` covers the usual start/finish/duration trio, and any column can render whatever it likes from the task (here an owner read from `meta`). The hairline between the list and the timeline is a real window splitter — focusable, value-reporting, resizable by drag or arrow keys, following the SplitView separator's contract. The play test reads a leaf row's duration cell and a summary's rolled-up finish, then steps the splitter and asserts the pinned column's computed width followed.",
  ),
  render: () => (
    <PlanChart
      defaultTaskListWidth={420}
      columns={[
        ...ganttChartDateColumns("en-US"),
        {
          key: "owner",
          header: "Owner",
          width: 72,
          render: (task) => (task.meta?.owner as string) ?? "—",
        },
      ]}
      defaultTasks={demoTasks.map((task) =>
        task.id === "primitives"
          ? { ...task, meta: { owner: "Ada" } }
          : task.id === "composites"
            ? { ...task, meta: { owner: "Lin" } }
            : task,
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvasElement.querySelector(
        '[data-slot="gantt-chart-column-header"][data-column="owner"]',
      )?.textContent,
    ).toBe("Owner")
    const rows = canvasElement.querySelectorAll(
      '[data-slot="gantt-chart-row"]',
    )
    // Primitives runs Aug 22 – Sep 3 exclusive: 12 days, owned by Ada.
    const primitivesRow = Array.from(rows).find((row) =>
      row.textContent?.startsWith("Primitives"),
    ) as HTMLElement
    await expect(
      primitivesRow.querySelector('[data-column="duration"]')?.textContent,
    ).toBe("12")
    await expect(
      primitivesRow.querySelector('[data-column="owner"]')?.textContent,
    ).toBe("Ada")
    // The Engineering summary shows the union of its children, not its own.
    const engineeringRow = Array.from(rows).find((row) =>
      row.textContent?.startsWith("Engineering"),
    ) as HTMLElement
    await expect(
      engineeringRow.querySelector('[data-column="start"]')?.textContent,
    ).toBe("Aug 22")

    // The splitter steps 16px per arrow and the pinned column follows.
    const splitter = canvas.getByRole("separator", {
      name: "Resize the task list",
    })
    await expect(splitter).toHaveAttribute("aria-valuenow", "420")
    splitter.focus()
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
    await expect(splitter).toHaveAttribute("aria-valuenow", "388")
    await waitFor(async () => {
      const cell = canvasElement.querySelector(
        '[data-slot="gantt-chart-task-cell"]',
      ) as HTMLElement
      await expect(parseFloat(getComputedStyle(cell).width)).toBeCloseTo(
        388,
        0,
      )
    })

    // The pointer path uses capture on the splitter itself, and the very
    // first move already applies — no committed-state lag.
    fireEvent.pointerDown(splitter, { button: 0, pointerId: 7, clientX: 500 })
    fireEvent.pointerMove(splitter, { pointerId: 7, clientX: 460 })
    fireEvent.pointerUp(splitter, { pointerId: 7, clientX: 460 })
    await expect(splitter).toHaveAttribute("aria-valuenow", "348")
  },
}

export const DependencyViolations: Story = {
  parameters: storyDocumentation(
    "A relation the dates contradict draws dashed in the critical treatment, so a plan that has drifted out of sequence says so instead of drawing a confident arrow backwards. Here Build starts three days before Spec finishes. Nothing is auto-corrected — hosts read the same list through the exported `dependencyViolations` helper and decide what to do. The play test asserts the arrow renders dashed while a satisfied one does not.",
  ),
  render: () => (
    <PlanChart
      defaultScale="day"
      defaultTasks={[
        { id: "spec", name: "Spec", start: d(7, 3), end: d(7, 12) },
        {
          id: "build",
          name: "Build",
          start: d(7, 9),
          end: d(7, 20),
          dependsOn: ["spec"],
        },
        {
          id: "ship",
          name: "Ship",
          start: d(7, 20),
          end: d(7, 24),
          tone: "secondary",
          dependsOn: ["build"],
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const violated = canvasElement.querySelector(
      '[data-slot="gantt-chart-dependency"][data-violated="true"]',
    ) as SVGGElement
    await expect(violated).not.toBeNull()
    await expect(violated.getAttribute("data-predecessor-id")).toBe("spec")
    await expect(
      getComputedStyle(violated.querySelector("path") as SVGPathElement)
        .strokeDasharray,
    ).not.toBe("none")

    // The satisfied link beside it stays solid.
    const satisfied = canvasElement.querySelector(
      '[data-slot="gantt-chart-dependency"][data-predecessor-id="build"]',
    ) as SVGGElement
    await expect(satisfied).not.toHaveAttribute("data-violated")
    await expect(
      getComputedStyle(satisfied.querySelector("path") as SVGPathElement)
        .strokeDasharray,
    ).toBe("none")
  },
}

export const CustomTaskContent: Story = {
  parameters: storyDocumentation(
    "renderTask replaces every bar's interior — here a name with a live percent readout — while the chart keeps geometry, drag, and selection; taskClassName layers styling policy (dimming completed work) without touching the task data. The play test asserts the custom interior renders inside a bar the chart still positions.",
  ),
  render: () => (
    <PlanChart
      renderTask={({ task, surface }) =>
        surface === "bar" ? (
          <span className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{task.name}</span>
            {task.progress !== undefined ? (
              <span className="shrink-0 font-normal tabular-nums">
                {Math.round(task.progress * 100)}%
              </span>
            ) : null}
          </span>
        ) : null
      }
      taskClassName={({ task }) =>
        task.progress === 1 ? "opacity-80" : undefined
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = await canvas.findByRole("button", { name: /^Primitives,/ })
    await expect(within(bar).getByText("60%")).toBeInTheDocument()
    const done = await canvas.findByRole("button", {
      name: /^Discovery & audit,/,
    })
    await waitFor(async () => {
      await expect(parseFloat(getComputedStyle(done).opacity)).toBeCloseTo(
        0.8,
        1,
      )
    })
  },
}

export const LocalizedLabels: Story = {
  parameters: storyDocumentation(
    "Every rendered and announced string routes through the labels prop — interpolated ones as functions so translators own word order. A French chart: toolbar, scale switcher, timeline region, and confirmation verbs all re-voiced, with dates formatted by the fr-FR locale.",
  ),
  render: () => (
    <PlanChart
      locale="fr-FR"
      labels={{
        today: "Aujourd’hui",
        day: "Jour",
        week: "Semaine",
        month: "Mois",
        scale: "Échelle de temps",
        previousPeriod: "Défiler plus tôt",
        nextPeriod: "Défiler plus tard",
        timeline: "Chronologie du projet",
        taskListHeader: "Tâche",
        moveAction: "Déplacer",
        resizeAction: "Redimensionner",
        moveAllAction: "Tout déplacer",
        moveOnlyAction: "Celle-ci seulement",
        keepAction: "Conserver",
        confirmMoveLabel: "Confirmer le déplacement",
        confirmResizeLabel: "Confirmer le redimensionnement",
        confirmMoveTitle: (name) => `Déplacer « ${name} » ?`,
        confirmResizeTitle: (name) => `Redimensionner « ${name} » ?`,
        cascadeNote: (count) =>
          `Déplace aussi ${count} tâche${count === 1 ? "" : "s"} dépendante${count === 1 ? "" : "s"}.`,
        collapseGroup: (name) => `Réduire ${name}`,
        expandGroup: (name) => `Développer ${name}`,
        taskBar: (name, start, end) => `${name}, du ${start} au ${end}`,
        milestone: (name, date) => `${name}, jalon le ${date}`,
        summary: (name, start, end, count) =>
          `${name}, groupe de ${count} tâche${count === 1 ? "" : "s"}, du ${start} au ${end}`,
        taskProgress: (percent) => `Avancement ${percent} %`,
        taskMoveHint: (shortcuts) =>
          `Déplacer avec ${shortcuts}, puis Entrée pour valider.`,
        taskResizeHint: (shortcuts) =>
          `Redimensionner avec ${shortcuts}.`,
        laneSchedule: (name) =>
          `Ajouter à la ligne ${name}. Choisissez les jours avec les flèches, puis Entrée.`,
        laneSelection: (name, start, end) =>
          `Ligne ${name}, du ${start} au ${end} sélectionné. Entrée pour ajouter.`,
        taskListSplitter: "Redimensionner la liste des tâches",
        linkFrom: (name, edge) => `Lier depuis ${edge} de ${name}`,
        linkEdgeStart: "le début",
        linkEdgeFinish: "la fin",
        linkInProgress: (name) =>
          `Liaison depuis ${name}. Choisissez une tâche pour terminer, ou Échap pour annuler.`,
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "Aujourd’hui" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("region", { name: "Chronologie du projet" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("button", { name: "Réduire Design" }),
    ).toBeInTheDocument()
    await canvas.findByRole("button", { name: /^Docs sprint, du/ })
  },
}
