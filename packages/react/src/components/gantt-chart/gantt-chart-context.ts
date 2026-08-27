"use client"

/** @responsibility Shared state and vocabulary for the Gantt chart: the labels and keyboard-shortcut contracts, the row model the grid renders, timeline header cells, tone variants, and the context every part reads. */

import * as React from "react"
import { cva } from "class-variance-authority"

import {
  WEEK_LENGTH,
  addDays,
  addMonths,
  descendantLeaves,
  differenceInCalendarDays,
  ganttChartTaskProgress,
  ganttChartTaskSpan,
  isMilestoneTask,
  startOfMonth,
  startOfWeek,
  type GanttChartDependencyType,
  type GanttChartRange,
  type GanttChartTask,
} from "./gantt-chart-scheduling"
import type { ResolvedShortcuts } from "./gantt-chart-shortcuts"

/** The three zoom levels of the timeline's column grid. */
export type GanttChartScale = "day" | "week" | "month"

/**
 * What the `renderTask` prop receives for each bar it draws: the task,
 * which timeline shape is drawing it, and its selection state. The
 * returned nodes replace the bar's interior only — the chart still owns
 * the bar's geometry, tone/className surface, drag, resize, focus, and
 * selection behavior.
 */
export interface GanttChartTaskRenderContext {
  task: GanttChartTask
  /** Which timeline shape is drawing the task. */
  surface: "bar" | "milestone" | "summary"
  /** Whether this task is the currently selected one. */
  selected: boolean
}

/**
 * What a host's move-confirmation UI receives while a reschedule is
 * pending: the task, its proposed new range, and the two resolutions.
 * `confirm` commits the move (firing `onTaskMove`) and `cancel` keeps the
 * task where it was; both dismiss the pending state.
 */
export interface GanttChartMoveConfirmContext {
  task: GanttChartTask
  range: GanttChartRange
  /**
   * Exactly the tasks a cascading commit would shift, derived from the
   * proposed dates through each relation's own driving edge — so a
   * start-only resize lists the start-driven links it pushes and an
   * end-only one lists none of them. Listed regardless of the
   * `moveDependents` default so a host's own confirmation UI can offer
   * the choice either way; empty when nothing would follow.
   */
  dependentTaskIds: string[]
  /**
   * Commits the move. `moveDependents` chooses per commit whether the
   * dependents in `dependentTaskIds` shift along; omitted, it falls back
   * to the chart's `moveDependents` prop.
   */
  confirm: (options?: { moveDependents?: boolean }) => void
  cancel: () => void
}

/** A reschedule in flight: adjusting under the keyboard, or confirming. */
export interface PendingMove {
  task: GanttChartTask
  start: Date
  end: Date
  /**
   * `adjusting` while keyboard nudges are still repositioning the ghost;
   * `confirming` once the move awaits the confirmation UI.
   */
  stage: "adjusting" | "confirming"
}

/**
 * Every user-facing string the chart renders or announces, so hosts can
 * localize or re-voice the whole surface. Interpolated strings are
 * functions rather than templates, keeping grammar and word order fully
 * in the host's control. Merge partial overrides over
 * `ganttChartDefaultLabels` via the `labels` prop.
 */
export interface GanttChartLabels {
  /** Toolbar button scrolling the timeline back to the current date. */
  today: string
  /** Day option in the scale switcher. */
  day: string
  /** Week option in the scale switcher. */
  week: string
  /** Month option in the scale switcher. */
  month: string
  /** Accessible name of the scale switcher group. */
  scale: string
  /** Toolbar pager scrolling the timeline one screen earlier. */
  previousPeriod: string
  /** Toolbar pager scrolling the timeline one screen later. */
  nextPeriod: string
  /** Accessible name of the scrollable timeline region. */
  timeline: string
  /** Heading of the task-list column. */
  taskListHeader: string
  /** Name given to a quick-created task with an empty name field. */
  untitledTask: string
  /** Confirm button of the built-in dialog for a same-duration move. */
  moveAction: string
  /** Confirm button of the built-in dialog for a duration change. */
  resizeAction: string
  /** Cascading commit button while the dialog offers the choice. */
  moveAllAction: string
  /** This-task-only commit button while the dialog offers the choice. */
  moveOnlyAction: string
  /** Dismiss button of the built-in confirmation dialog. */
  keepAction: string
  /** Accessible name of the built-in dialog for a move. */
  confirmMoveLabel: string
  /** Accessible name of the built-in dialog for a resize. */
  confirmResizeLabel: string
  confirmMoveTitle: (taskName: string) => string
  confirmResizeTitle: (taskName: string) => string
  /**
   * Line in the confirmation dialog naming how many dependent tasks will
   * shift along, shown while `moveDependents` is enabled.
   */
  cascadeNote: (taskCount: number) => string
  /** Announcement of a summary row's collapse toggle while expanded. */
  collapseGroup: (taskName: string) => string
  /** Announcement of a summary row's collapse toggle while collapsed. */
  expandGroup: (taskName: string) => string
  /** Announcement of a plain task bar. */
  taskBar: (name: string, start: string, end: string) => string
  /** Announcement of a milestone diamond. */
  milestone: (name: string, date: string) => string
  /** Announcement of a summary bracket. */
  summary: (
    name: string,
    start: string,
    end: string,
    taskCount: number,
  ) => string
  /** Progress fragment appended to a bar's announcement. */
  taskProgress: (percent: number) => string
  /** Move-shortcut hint appended to a bar's announcement. */
  taskMoveHint: (shortcuts: string) => string
  /** Resize-shortcut hint appended to a bar's announcement. */
  taskResizeHint: (shortcuts: string) => string
  /** Names one relation type, used inside a link's announcement. */
  dependencyType: (type: GanttChartDependencyType) => string
  /** Announcement of a dependency arrow. */
  dependency: (
    predecessorName: string,
    successorName: string,
    typeName: string,
    lagDays: number,
  ) => string
  /** Fragment appended to a link's announcement while it is violated. */
  dependencyViolated: (days: number) => string
  /** Accessible name of a bar's link handle. */
  linkFrom: (taskName: string, edge: string) => string
  /** Names the start edge inside a link handle's announcement. */
  linkEdgeStart: string
  /** Names the finish edge inside a link handle's announcement. */
  linkEdgeFinish: string
  /** Announced while a link gesture is looking for its target. */
  linkInProgress: (taskName: string) => string
  /** Announcement of an empty lane's keyboard quick-create surface. */
  laneSchedule: (taskName: string) => string
  /** Announcement of a lane holding an active draft selection. */
  laneSelection: (taskName: string, start: string, end: string) => string
  /** Accessible name of the task-list resize splitter. */
  taskListSplitter: string
  /** Fragment marking a bar that sits on the critical path. */
  criticalTask: string
  /** Toolbar toggle that turns critical-path highlighting on and off. */
  criticalPath: string
}

/** The out-of-the-box English strings. */
export const ganttChartDefaultLabels: GanttChartLabels = Object.freeze({
  today: "Today",
  day: "Day",
  week: "Week",
  month: "Month",
  scale: "Timeline scale",
  previousPeriod: "Scroll earlier",
  nextPeriod: "Scroll later",
  timeline: "Project timeline",
  taskListHeader: "Task",
  untitledTask: "(No name)",
  moveAction: "Move",
  resizeAction: "Resize",
  moveAllAction: "Move all",
  moveOnlyAction: "Only this",
  keepAction: "Keep",
  confirmMoveLabel: "Confirm move",
  confirmResizeLabel: "Confirm resize",
  confirmMoveTitle: (taskName: string) => `Move “${taskName}”?`,
  confirmResizeTitle: (taskName: string) => `Resize “${taskName}”?`,
  cascadeNote: (taskCount: number) =>
    taskCount === 1
      ? "Also moves 1 dependent task."
      : `Also moves ${taskCount} dependent tasks.`,
  collapseGroup: (taskName: string) => `Collapse ${taskName}`,
  expandGroup: (taskName: string) => `Expand ${taskName}`,
  taskBar: (name: string, start: string, end: string) =>
    `${name}, ${start} to ${end}`,
  milestone: (name: string, date: string) => `${name}, milestone on ${date}`,
  summary: (name: string, start: string, end: string, taskCount: number) =>
    `${name}, group of ${taskCount === 1 ? "1 task" : `${taskCount} tasks`}, ${start} to ${end}`,
  taskProgress: (percent: number) => `${percent}% complete`,
  taskMoveHint: (shortcuts: string) =>
    `Move with ${shortcuts}, then press Enter to place it.`,
  taskResizeHint: (shortcuts: string) => `Resize with ${shortcuts}.`,
  dependencyType: (type: GanttChartDependencyType) =>
    ({
      "finish-to-start": "finish to start",
      "start-to-start": "start to start",
      "finish-to-finish": "finish to finish",
      "start-to-finish": "start to finish",
    })[type],
  dependency: (
    predecessorName: string,
    successorName: string,
    typeName: string,
    lagDays: number,
  ) => {
    const lag =
      lagDays === 0
        ? ""
        : lagDays > 0
          ? `, ${lagDays === 1 ? "1 day" : `${lagDays} days`} lag`
          : `, ${lagDays === -1 ? "1 day" : `${-lagDays} days`} lead`
    return `${predecessorName} to ${successorName}, ${typeName}${lag}`
  },
  dependencyViolated: (days: number) =>
    ` Violated by ${days === 1 ? "1 day" : `${days} days`}.`,
  linkFrom: (taskName: string, edge: string) =>
    `Link from the ${edge} of ${taskName}`,
  linkEdgeStart: "start",
  linkEdgeFinish: "finish",
  linkInProgress: (taskName: string) =>
    `Linking from ${taskName}. Choose a task to finish the link, or press Escape to cancel.`,
  laneSchedule: (taskName: string) =>
    `Add to the ${taskName} row. Use arrow keys to choose days, then press Enter to add a task.`,
  laneSelection: (taskName: string, start: string, end: string) =>
    `${taskName} row, selected ${start} to ${end}. Press Enter to add a task.`,
  taskListSplitter: "Resize the task list",
  criticalTask: " On the critical path.",
  criticalPath: "Critical path",
})

/** Formats an announced date; always month-first so it stays unambiguous. */
export function formatDayLabel(locale: string | undefined, day: Date) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(day)
}

/**
 * Bar tone classes; every pairing is contrast-governed. Exported — like
 * `buttonVariants` — so hosts can reuse the tones on their own surfaces
 * (legends, filters, status chips).
 */
export const ganttChartToneVariants = cva("", {
  variants: {
    tone: {
      primary: "bg-primary text-primary-foreground",
      secondary: "border border-border bg-secondary text-secondary-foreground",
      muted: "border border-border bg-muted text-muted-foreground",
      destructive: "bg-destructive text-destructive-foreground",
    },
  },
  defaultVariants: {
    tone: "primary",
  },
})

/** Horizontal pixels one day occupies at each scale. */
export const SCALE_DAY_WIDTH: Record<GanttChartScale, number> = {
  day: 40,
  week: 12,
  month: 4,
}

/** Bounds the splitter may move the task list between. */
export const TASK_LIST_MIN_WIDTH = 120
export const TASK_LIST_MAX_WIDTH = 560

/** Height of the two-tier timeline header. */
export const HEADER_HEIGHT = 44
/** Height of the header's upper (coarse) tier. */
export const PRIMARY_TIER_HEIGHT = 20
/** Vertical inset of a task bar inside its row. */
export const BAR_INSET = 7
/** Side length of a milestone diamond. */
export const MILESTONE_SIZE = 14
/** Pointer travel, in pixels, that turns a bar press into a move. */
export const MOVE_THRESHOLD_PX = 4
/** Width reserved for the built-in confirmation card's clamp. */
export const CONFIRM_CARD_CLEARANCE_PX = 272

/** One visible row of the chart, in flattened tree order. */
export interface GanttRow {
  task: GanttChartTask
  /** Nesting depth, 0 for roots. */
  depth: number
  /** Whether the task rolls up children (renders as a bracket). */
  summary: boolean
  /** Whether the task marks a single day (renders as a diamond). */
  milestone: boolean
  /** The timeline span the row occupies (rolled up for summaries). */
  span: GanttChartRange
  /** Leaf-count under a summary, for its announcement. */
  leafCount: number
  /** Rolled-up or own progress, when known. */
  progress: number | undefined
}

/**
 * Flattens the task tree into visible rows: depth-first in the order the
 * tasks array provides, skipping the subtrees of collapsed summaries.
 * Tasks whose `parentId` names a missing task render as roots rather
 * than vanishing.
 */
export function flattenTasks(
  tasks: GanttChartTask[],
  collapsedIds: ReadonlySet<string>,
): GanttRow[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const childrenOf = new Map<string, GanttChartTask[]>()
  const roots: GanttChartTask[] = []
  for (const task of tasks) {
    if (task.parentId && byId.has(task.parentId)) {
      const siblings = childrenOf.get(task.parentId) ?? []
      siblings.push(task)
      childrenOf.set(task.parentId, siblings)
    } else {
      roots.push(task)
    }
  }
  const rows: GanttRow[] = []
  const visit = (task: GanttChartTask, depth: number, seen: Set<string>) => {
    if (seen.has(task.id)) return
    seen.add(task.id)
    const summary = childrenOf.has(task.id)
    rows.push({
      task,
      depth,
      summary,
      milestone: !summary && isMilestoneTask(task),
      span: ganttChartTaskSpan(task, tasks),
      leafCount: summary ? descendantLeaves(task, tasks).length : 0,
      progress: ganttChartTaskProgress(task, tasks),
    })
    if (summary && !collapsedIds.has(task.id)) {
      for (const child of childrenOf.get(task.id) ?? []) {
        visit(child, depth + 1, seen)
      }
    }
  }
  const seen = new Set<string>()
  for (const root of roots) visit(root, 0, seen)
  return rows
}

/** One cell of a header tier: a run of days with a label. */
export interface HeaderCell {
  key: string
  /** Day offset from the range start. */
  offsetDays: number
  days: number
  label: string
}

/** Builds the month run covering the range. */
export function monthCells(
  range: GanttChartRange,
  locale: string | undefined,
  withYear: boolean,
): HeaderCell[] {
  const format = new Intl.DateTimeFormat(
    locale,
    withYear ? { month: "short", year: "numeric" } : { month: "short" },
  )
  const cells: HeaderCell[] = []
  let cursor = startOfMonth(range.start)
  while (cursor < range.end) {
    const next = addMonths(cursor, 1)
    const cellStart = cursor < range.start ? range.start : cursor
    const cellEnd = next > range.end ? range.end : next
    cells.push({
      key: `month-${cursor.getFullYear()}-${cursor.getMonth()}`,
      offsetDays: differenceInCalendarDays(cellStart, range.start),
      days: differenceInCalendarDays(cellEnd, cellStart),
      label: format.format(cursor),
    })
    cursor = next
  }
  return cells
}

/** Builds the year run covering the range. */
export function yearCells(
  range: GanttChartRange,
  locale: string | undefined,
): HeaderCell[] {
  const format = new Intl.DateTimeFormat(locale, { year: "numeric" })
  const cells: HeaderCell[] = []
  let cursor = new Date(range.start.getFullYear(), 0, 1)
  while (cursor < range.end) {
    const next = new Date(cursor.getFullYear() + 1, 0, 1)
    const cellStart = cursor < range.start ? range.start : cursor
    const cellEnd = next > range.end ? range.end : next
    cells.push({
      key: `year-${cursor.getFullYear()}`,
      offsetDays: differenceInCalendarDays(cellStart, range.start),
      days: differenceInCalendarDays(cellEnd, cellStart),
      label: format.format(cursor),
    })
    cursor = next
  }
  return cells
}

/** Builds the fine tier for a scale: days, weeks, or months. */
export function fineCells(
  range: GanttChartRange,
  scale: GanttChartScale,
  locale: string | undefined,
  weekStartsOn: number,
): HeaderCell[] {
  const totalDays = differenceInCalendarDays(range.end, range.start)
  if (scale === "day") {
    const format = new Intl.DateTimeFormat(locale, { day: "numeric" })
    return Array.from({ length: totalDays }, (_, index) => {
      const day = addDays(range.start, index)
      return {
        key: `day-${index}`,
        offsetDays: index,
        days: 1,
        label: format.format(day),
      }
    })
  }
  if (scale === "week") {
    const format = new Intl.DateTimeFormat(locale, { day: "numeric" })
    const cells: HeaderCell[] = []
    let cursor = startOfWeek(range.start, weekStartsOn)
    while (cursor < range.end) {
      const next = addDays(cursor, WEEK_LENGTH)
      const cellStart = cursor < range.start ? range.start : cursor
      const cellEnd = next > range.end ? range.end : next
      cells.push({
        key: `week-${differenceInCalendarDays(cellStart, range.start)}`,
        offsetDays: differenceInCalendarDays(cellStart, range.start),
        days: differenceInCalendarDays(cellEnd, cellStart),
        label: format.format(cellStart),
      })
      cursor = next
    }
    return cells
  }
  return monthCells(range, locale, false)
}

export interface GanttChartContextValue {
  tasks: GanttChartTask[]
  rows: GanttRow[]
  range: GanttChartRange
  totalDays: number
  dayWidth: number
  rowHeight: number
  taskListWidth: number
  setTaskListWidth: (width: number) => void
  scale: GanttChartScale
  setScale: (scale: GanttChartScale) => void
  now: Date
  locale?: string
  weekStartsOn: number
  labels: GanttChartLabels
  shortcuts: ResolvedShortcuts
  collapsedIds: ReadonlySet<string>
  toggleCollapsed: (taskId: string) => void
  selectedTaskId: string | null
  selectTask: (taskId: string | null) => void
  onTaskSelect?: (
    task: GanttChartTask,
    domEvent: React.MouseEvent<HTMLButtonElement>,
  ) => void
  renderTask?: (context: GanttChartTaskRenderContext) => React.ReactNode
  taskClassName?: (
    context: GanttChartTaskRenderContext,
  ) => string | undefined
  moveDependents: boolean
  /** Transitive dependents of a task, in dependency-graph order. */
  dependentIdsOf: (taskId: string) => string[]
  /** The tasks a proposed move would carry with it, cascade or not. */
  shiftedIdsFor: (move: {
    task: GanttChartTask
    start: Date
    end: Date
  }) => string[]
  pendingMove: PendingMove | null
  requestMove: (task: GanttChartTask, start: Date, end: Date) => void
  adjustMove: (task: GanttChartTask, start: Date, end: Date) => void
  promotePendingMove: () => void
  confirmPendingMove: (options?: { moveDependents?: boolean }) => void
  cancelPendingMove: () => void
  confirmMoves: boolean
  renderMoveConfirm?: (
    context: GanttChartMoveConfirmContext,
  ) => React.ReactNode
  scrollerRef: React.RefObject<HTMLDivElement | null>
  scrollToDate: (date: Date) => void
  pageTimeline: (direction: 1 | -1) => void
  /** Ids of the tasks with no float left, whether or not they are shown. */
  criticalTaskIds: ReadonlySet<string>
  showCriticalPath: boolean
  setShowCriticalPath: (show: boolean) => void
  /** Violated relations, keyed by successor then predecessor id. */
  violationBySuccessor: ReadonlyMap<string, ReadonlyMap<string, number>>
  /** Whether the linking gesture and its handles are available. */
  linkable: boolean
  linkSession: LinkSession | null
  beginLink: (session: LinkSession) => void
  updateLink: (session: Partial<LinkSession>) => void
  completeLink: (successorId: string) => void
  cancelLink: () => void
  selectedDependency: GanttChartDependencyRef | null
  selectDependency: (dependency: GanttChartDependencyRef | null) => void
  onDependencySelect?: (dependency: GanttChartDependencyRef) => void
  deleteDependency: (dependency: GanttChartDependencyRef) => void
  /** Whether a link from the open session may land on this task. */
  canLinkTo: (successorId: string) => boolean
  renderQuickCreate?: (
    context: GanttChartQuickCreateContext,
  ) => React.ReactNode
  draft: DraftRange | null
  /** Repositions a keyboard draft without treating it as completed. */
  adjustDraft: (draft: DraftRange) => void
  openDraft: (draft: DraftRange) => void
  createFromDraft: (
    details?: Partial<Omit<GanttChartTask, "id" | "start" | "end">>,
  ) => void
  cancelDraft: () => void
  columns: ResolvedGanttChartColumn[]
}

/** Names one link between two tasks. */
export interface GanttChartDependencyRef {
  predecessorId: string
  successorId: string
}

/** A linking gesture in flight. */
export interface LinkSession {
  /** The task the link leaves. */
  predecessorId: string
  /** Which of its edges the link leaves from. */
  fromEdge: "start" | "finish"
  /** Pointer position in canvas coordinates, for the rubber-band line. */
  pointer: { x: number; y: number } | null
  /** The task currently under the pointer, when it can take the link. */
  targetId: string | null
  /** True once a keyboard link is waiting for its target. */
  keyboard: boolean
  /** The pointer that owns a dragged link; null for the keyboard path. */
  pointerId: number | null
}

/** A drag across an empty lane, before the host resolves it. */
export interface DraftRange {
  /** Row the drag started on, so the new task can inherit its parent. */
  rowTaskId: string | null
  start: Date
  end: Date
  /** Whether the host's quick-create UI is open for this draft. */
  open: boolean
}

/**
 * What a host's quick-create UI receives while a drag across an empty
 * lane is open: the proposed range plus the two ways to resolve it.
 * `createTask` adds a task over the range (merging any partial details on
 * top of the defaults) and `cancel` abandons the draft.
 */
export interface GanttChartQuickCreateContext {
  range: GanttChartRange
  createTask: (
    details?: Partial<Omit<GanttChartTask, "id" | "start" | "end">>,
  ) => void
  cancel: () => void
}

/** One column of the task list, after its defaults are filled in. */
export interface ResolvedGanttChartColumn {
  key: string
  header: string
  width: number
  align: "start" | "end"
  render: (task: GanttChartTask, row: GanttRow) => React.ReactNode
}

export const GanttChartContext = React.createContext<GanttChartContextValue | null>(
  null,
)

/**
 * Reads the surrounding chart context.
 *
 * @param consumer - Component name used in the error when rendered outside
 * a `GanttChart`.
 */
export function useGanttChart(consumer: string) {
  const context = React.useContext(GanttChartContext)
  if (!context) {
    throw new Error(`${consumer} must be used within a GanttChart.`)
  }
  return context
}
