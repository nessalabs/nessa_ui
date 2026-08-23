import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  GanttChart,
  GanttChartGrid,
  GanttChartToolbar,
  type GanttChartProps,
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
 * are ignored), milestones are zero-duration, and `dependsOn` draws the
 * finish-to-start arrows.
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
    dependsOn: ["discovery"],
  },
  {
    id: "design-review",
    name: "Design review",
    start: d(7, 21),
    end: d(7, 21),
    parentId: "design",
    dependsOn: ["visual-language"],
  },
  { id: "engineering", name: "Engineering", start: d(7, 17), end: d(9, 3) },
  {
    id: "primitives",
    name: "Primitives",
    start: d(7, 17),
    end: d(7, 29),
    progress: 0.6,
    parentId: "engineering",
    dependsOn: ["design-review"],
  },
  {
    id: "composites",
    name: "Composites",
    start: d(7, 31),
    end: d(8, 19),
    progress: 0.15,
    parentId: "engineering",
    dependsOn: ["primitives"],
  },
  {
    id: "code-freeze",
    name: "Code freeze",
    start: d(8, 28),
    end: d(8, 28),
    tone: "destructive",
    parentId: "engineering",
    dependsOn: ["composites"],
  },
  {
    id: "hardening",
    name: "Hardening & QA",
    start: d(8, 21),
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
    start: d(9, 5),
    end: d(9, 5),
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
      className="w-[880px] max-w-full"
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

    const progressFill = bar.querySelector<HTMLElement>(
      '[data-slot="gantt-chart-bar-progress"]',
    )
    await expect(progressFill).not.toBeNull()
    await expect(
      parseFloat(getComputedStyle(progressFill as HTMLElement).width),
    ).toBeGreaterThan(0)

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
    "The month scale compresses the plan to a portfolio overview: month columns under a year tier. The play test asserts a known bar's computed width matches the scale's four pixels per day.",
  ),
  render: () => <PlanChart defaultScale="month" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Composites spans Aug 31 – Sep 19 exclusive: 19 days × 4px.
    const bar = await canvas.findByRole("button", { name: /^Composites,/ })
    await expect(parseFloat(getComputedStyle(bar).width)).toBeCloseTo(76, 0)
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

    // Engineering rolls up Aug 17 – Oct 3 exclusive: 47 days × 12px.
    const summary = canvas.getByRole("button", { name: /^Engineering,/ })
    await expect(parseFloat(getComputedStyle(summary).width)).toBeCloseTo(
      47 * WEEK_SCALE_DAY_WIDTH,
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
        keepAction: "Conserver",
        confirmMoveLabel: "Confirmer le déplacement",
        confirmResizeLabel: "Confirmer le redimensionnement",
        confirmMoveTitle: (name) => `Déplacer « ${name} » ?`,
        confirmResizeTitle: (name) => `Redimensionner « ${name} » ?`,
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
