"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import { PopoverSurface } from "./popover-surface"
import { SegmentedControl, SegmentedControlOption } from "./segmented-control"

/**
 * One row of the plan. Tasks are plain serializable data: grouping comes
 * from `parentId`, milestones and summaries are derived from the dates and
 * the tree rather than stored as flags that could disagree with them.
 */
export interface GanttChartTask {
  /** Stable identity used for React keys, selection, and dependencies. */
  id: string
  /** Name drawn in the task list and inside the bar. */
  name: string
  /** Inclusive start day (times below day precision are ignored). */
  start: Date
  /**
   * Exclusive end day, matching `EventCalendarEvent`: a one-day task ends
   * at the next day's midnight, and a task whose `end` equals its `start`
   * is a milestone. Displayed and announced as the inclusive last day.
   */
  end: Date
  /** Fraction complete, 0–1, drawn as a fill inside the bar. */
  progress?: number
  /**
   * Built-in semantic color treatment for the bar. Defaults to
   * `"primary"`. The tones are conveniences, not a ceiling: restyle any
   * bar with the chart's `taskClassName` prop, or take over the bar's
   * interior entirely with `renderTask`.
   */
  tone?: GanttChartTone
  /**
   * Ids of tasks this one depends on, drawn as finish-to-start arrows.
   * Purely visual — the chart never reschedules tasks to satisfy them.
   */
  dependsOn?: string[]
  /**
   * Id of the task this one nests under. A task that others name as their
   * parent renders as a summary row whose span and progress roll up from
   * its descendants.
   */
  parentId?: string
}

/**
 * Whether a task is a milestone: its start and end name the same instant,
 * so it marks a point in time rather than a span — derived from the dates
 * themselves, so hosts never set a flag that could disagree with them.
 */
export function isMilestoneTask(task: GanttChartTask) {
  return startOfDay(task.start).getTime() === startOfDay(task.end).getTime()
}

/**
 * Whether a task is a summary: at least one other task names it as its
 * `parentId`. Summary rows render as roll-up brackets, collapse their
 * subtree, and derive their span and progress from their descendants.
 */
export function isSummaryTask(task: GanttChartTask, tasks: GanttChartTask[]) {
  return tasks.some((candidate) => candidate.parentId === task.id)
}

/**
 * The span a task occupies on the timeline. For a summary this is the
 * union of its descendants' spans (the task's own dates are ignored, so
 * they can never disagree with the roll-up); for anything else it is the
 * task's own start and end.
 */
export function ganttChartTaskSpan(
  task: GanttChartTask,
  tasks: GanttChartTask[],
): GanttChartRange {
  const descendants = descendantLeaves(task, tasks)
  if (!descendants.length) {
    return { start: startOfDay(task.start), end: startOfDay(task.end) }
  }
  let start: Date | null = null
  let end: Date | null = null
  for (const leaf of descendants) {
    const leafStart = startOfDay(leaf.start)
    const leafEnd = startOfDay(leaf.end)
    if (!start || leafStart < start) start = leafStart
    if (!end || leafEnd > end) end = leafEnd
  }
  return { start: start as Date, end: end as Date }
}

/**
 * A summary's rolled-up completion: the duration-weighted mean progress of
 * its leaf descendants, treating a leaf without `progress` as 0. Returns
 * the task's own `progress` for a non-summary, and undefined when nothing
 * under the summary carries duration.
 */
export function ganttChartTaskProgress(
  task: GanttChartTask,
  tasks: GanttChartTask[],
): number | undefined {
  const leaves = descendantLeaves(task, tasks)
  if (!leaves.length) return task.progress
  let weighted = 0
  let totalDays = 0
  for (const leaf of leaves) {
    const days = differenceInCalendarDays(leaf.end, leaf.start)
    if (days <= 0) continue
    weighted += (leaf.progress ?? 0) * days
    totalDays += days
  }
  if (totalDays === 0) return undefined
  return weighted / totalDays
}

/** Collects a task's leaf descendants (empty for a non-summary). */
function descendantLeaves(
  task: GanttChartTask,
  tasks: GanttChartTask[],
): GanttChartTask[] {
  const childrenOf = new Map<string, GanttChartTask[]>()
  for (const candidate of tasks) {
    if (!candidate.parentId) continue
    const siblings = childrenOf.get(candidate.parentId) ?? []
    siblings.push(candidate)
    childrenOf.set(candidate.parentId, siblings)
  }
  const leaves: GanttChartTask[] = []
  const visit = (parent: GanttChartTask, seen: Set<string>) => {
    if (seen.has(parent.id)) return
    seen.add(parent.id)
    for (const child of childrenOf.get(parent.id) ?? []) {
      if (childrenOf.has(child.id)) visit(child, seen)
      else leaves.push(child)
    }
  }
  if (!childrenOf.has(task.id)) return []
  visit(task, new Set())
  return leaves
}

/**
 * Built-in semantic bar treatments, each a full-strength token pairing.
 * A starting palette rather than a constraint — see the `taskClassName`
 * and `renderTask` props for anything beyond them.
 */
export type GanttChartTone =
  | "primary"
  | "secondary"
  | "muted"
  | "destructive"

/** The three zoom levels of the timeline's column grid. */
export type GanttChartScale = "day" | "week" | "month"

/** A concrete start/end pair, end exclusive like the tasks themselves. */
export interface GanttChartRange {
  start: Date
  end: Date
}

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
   * Ids of the task's transitive dependents whenever the proposed dates
   * change its finish (empty otherwise) — the tasks a cascading commit
   * would shift, listed regardless of the `moveDependents` default so a
   * host's own confirmation UI can offer the choice either way.
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
interface PendingMove {
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
})

/** Primary modifier choices supported by chart keyboard shortcuts. */
export type GanttChartShortcutModifier = "control" | "meta" | "mod"

/** Describes one exact keyboard shortcut, in the design system's shape. */
export interface GanttChartKeyboardShortcut {
  /** KeyboardEvent key, matched without case sensitivity. */
  key: string
  /**
   * Primary modifier. `mod` accepts exactly one of Meta or Control; omit
   * for neither.
   * @defaultValue undefined
   */
  modifier?: GanttChartShortcutModifier
  /**
   * Whether Alt must be pressed.
   * @defaultValue false
   */
  altKey?: boolean
  /**
   * Whether Shift must be pressed.
   * @defaultValue false
   */
  shiftKey?: boolean
  /**
   * Prevents the matched browser event by default. Set false to keep it.
   * @defaultValue true
   */
  preventDefault?: boolean
}

/**
 * The chart's shortcut map. Every action ships a sensible default —
 * vim-flavored navigation, Shift+Arrow to move a focused task; hosts
 * replace any entry with their own shortcut or `false` to disable it, and
 * `shortcuts={false}` on the chart turns the whole map off.
 */
export interface GanttChartShortcuts {
  /** Scrolls the timeline one screen earlier. @defaultValue `h` */
  previousPeriod?: GanttChartKeyboardShortcut | false
  /** Scrolls the timeline one screen later. @defaultValue `l` */
  nextPeriod?: GanttChartKeyboardShortcut | false
  /** Scrolls the current date into view. @defaultValue `t` */
  today?: GanttChartKeyboardShortcut | false
  /** Switches to the day scale. @defaultValue `d` */
  dayScale?: GanttChartKeyboardShortcut | false
  /** Switches to the week scale. @defaultValue `w` */
  weekScale?: GanttChartKeyboardShortcut | false
  /** Switches to the month scale. @defaultValue `m` */
  monthScale?: GanttChartKeyboardShortcut | false
  /** Nudges a focused task one day earlier. @defaultValue `Shift+ArrowLeft` */
  moveTaskLeft?: GanttChartKeyboardShortcut | false
  /** Nudges a focused task one day later. @defaultValue `Shift+ArrowRight` */
  moveTaskRight?: GanttChartKeyboardShortcut | false
  /** Grows a focused task one day longer. @defaultValue `Mod+Alt+J` */
  resizeTaskLonger?: GanttChartKeyboardShortcut | false
  /** Shrinks a focused task one day shorter. @defaultValue `Mod+Alt+K` */
  resizeTaskShorter?: GanttChartKeyboardShortcut | false
}

type GanttChartShortcutAction = keyof GanttChartShortcuts

type ResolvedShortcuts = Record<
  GanttChartShortcutAction,
  GanttChartKeyboardShortcut | undefined
>

/**
 * The out-of-the-box keymap: vim-flavored navigation (h/l/t/d/w/m, the
 * same letters the calendar binds) and Shift+Arrow to move a focused
 * task along the timeline.
 */
const DEFAULT_SHORTCUTS: Record<
  GanttChartShortcutAction,
  GanttChartKeyboardShortcut
> = Object.freeze({
  previousPeriod: { key: "h" },
  nextPeriod: { key: "l" },
  today: { key: "t" },
  dayScale: { key: "d" },
  weekScale: { key: "w" },
  monthScale: { key: "m" },
  moveTaskLeft: { key: "ArrowLeft", shiftKey: true },
  moveTaskRight: { key: "ArrowRight", shiftKey: true },
  resizeTaskLonger: { key: "j", modifier: "mod", altKey: true },
  resizeTaskShorter: { key: "k", modifier: "mod", altKey: true },
})

/**
 * Checks whether a keyboard event carries exactly the requested primary
 * modifier (Control / Meta), and no unrequested one.
 */
function matchesShortcutModifier(
  event: React.KeyboardEvent | KeyboardEvent,
  modifier: GanttChartShortcutModifier | undefined,
) {
  switch (modifier) {
    case "mod":
      return event.metaKey !== event.ctrlKey
    case "meta":
      return event.metaKey && !event.ctrlKey
    case "control":
      return event.ctrlKey && !event.metaKey
    case undefined:
      return !event.metaKey && !event.ctrlKey
    default: {
      const exhaustiveModifier: never = modifier
      return exhaustiveModifier
    }
  }
}

/**
 * Checks whether a keyboard event's key satisfies a shortcut key. When Alt
 * is required, macOS transforms `event.key` into a special character, so
 * single alphanumeric keys also match by physical `event.code`.
 */
function matchesShortcutKey(
  event: React.KeyboardEvent | KeyboardEvent,
  key: string,
  altKeyRequired: boolean,
) {
  const normalizedKey = key.toLowerCase()
  if (event.key.toLowerCase() === normalizedKey) return true
  if (!altKeyRequired || !/^[a-z0-9]$/.test(normalizedKey)) return false
  const physicalCode = /^[0-9]$/.test(normalizedKey)
    ? `digit${normalizedKey}`
    : `key${normalizedKey}`
  return event.code.toLowerCase() === physicalCode
}

/** Checks whether a keyboard event exactly matches a shortcut descriptor. */
function matchesShortcut(
  event: React.KeyboardEvent | KeyboardEvent,
  shortcut: GanttChartKeyboardShortcut,
) {
  return (
    matchesShortcutKey(event, shortcut.key, Boolean(shortcut.altKey)) &&
    matchesShortcutModifier(event, shortcut.modifier) &&
    event.altKey === Boolean(shortcut.altKey) &&
    event.shiftKey === Boolean(shortcut.shiftKey)
  )
}

/**
 * Checks whether a keyboard event comes from a place where the user is
 * typing text, so plain single-character shortcuts never steal keystrokes.
 */
function isEditableShortcutTarget(event: React.KeyboardEvent | KeyboardEvent) {
  const target = event.target

  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Renders a run of shortcuts as "Shift+ArrowLeft, ArrowRight" style text. */
function shortcutRunHint(
  shortcuts: Array<GanttChartKeyboardShortcut | undefined>,
) {
  const present = shortcuts.filter(
    (shortcut): shortcut is GanttChartKeyboardShortcut => Boolean(shortcut),
  )
  if (!present.length) return null
  const [first, ...rest] = present
  const restKeys = rest.map((shortcut) =>
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
  )
  return [shortcutHint(first), ...restKeys].join(", ")
}

/** Composes the bar announcement's shortcut hints from the keymap. */
function barShortcutHints(
  shortcuts: ResolvedShortcuts,
  labels: GanttChartLabels,
  resizable: boolean,
) {
  const parts: string[] = []
  const moveKeys = shortcutRunHint([
    shortcuts.moveTaskLeft,
    shortcuts.moveTaskRight,
  ])
  if (moveKeys) parts.push(labels.taskMoveHint(moveKeys))
  if (resizable) {
    const resizeKeys = shortcutRunHint([
      shortcuts.resizeTaskLonger,
      shortcuts.resizeTaskShorter,
    ])
    if (resizeKeys) parts.push(labels.taskResizeHint(resizeKeys))
  }
  return parts.length ? ` ${parts.join(" ")}` : ""
}

/** Renders a shortcut descriptor as announcement text. */
function shortcutHint(shortcut: GanttChartKeyboardShortcut) {
  const parts: string[] = []
  if (shortcut.modifier === "meta") parts.push("Command")
  else if (shortcut.modifier === "control") parts.push("Control")
  else if (shortcut.modifier === "mod") parts.push("Command or Control")
  if (shortcut.altKey) parts.push("Alt")
  if (shortcut.shiftKey) parts.push("Shift")
  parts.push(
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
  )
  return parts.join("+")
}

const DAY_MS = 86_400_000
const WEEK_LENGTH = 7

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date: Date, weekStartsOn: number) {
  const day = startOfDay(date)
  const offset = (day.getDay() - weekStartsOn + WEEK_LENGTH) % WEEK_LENGTH
  return addDays(day, -offset)
}

function startOfMonth(date: Date) {
  const next = startOfDay(date)
  next.setDate(1)
  return next
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

/**
 * Whole calendar days between two instants' midnights. Rounding absorbs
 * the ±1 hour a DST transition adds or removes, so day indexes never
 * drift against the header cells.
 */
function differenceInCalendarDays(later: Date, earlier: Date) {
  return Math.round(
    (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS,
  )
}

function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Formats an announced date; always month-first so it stays unambiguous. */
function formatDayLabel(locale: string | undefined, day: Date) {
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
const ganttChartToneVariants = cva("", {
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

/**
 * Inset focus outline shared by the chart's custom interactive layers.
 * Everything sits inside the scrolling timeline, so every outline draws
 * inward where the overflow edges cannot swallow it.
 */
const insetFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

/** Token-driven hover/selection transition shared by chart surfaces. */
const surfaceTransitionClassName =
  "transition-[background-color,color,border-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"

/** Horizontal pixels one day occupies at each scale. */
const SCALE_DAY_WIDTH: Record<GanttChartScale, number> = {
  day: 40,
  week: 12,
  month: 4,
}

/** Height of the two-tier timeline header. */
const HEADER_HEIGHT = 44
/** Height of the header's upper (coarse) tier. */
const PRIMARY_TIER_HEIGHT = 20
/** Vertical inset of a task bar inside its row. */
const BAR_INSET = 7
/** Side length of a milestone diamond. */
const MILESTONE_SIZE = 14
/** Pointer travel, in pixels, that turns a bar press into a move. */
const MOVE_THRESHOLD_PX = 4
/** Width reserved for the built-in confirmation card's clamp. */
const CONFIRM_CARD_CLEARANCE_PX = 272

/** One visible row of the chart, in flattened tree order. */
interface GanttRow {
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
function flattenTasks(
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
interface HeaderCell {
  key: string
  /** Day offset from the range start. */
  offsetDays: number
  days: number
  label: string
}

/** Builds the month run covering the range. */
function monthCells(
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
function yearCells(
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
function fineCells(
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

interface GanttChartContextValue {
  tasks: GanttChartTask[]
  rows: GanttRow[]
  range: GanttChartRange
  totalDays: number
  dayWidth: number
  rowHeight: number
  taskListWidth: number
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
}

const GanttChartContext = React.createContext<GanttChartContextValue | null>(
  null,
)

/**
 * Reads the surrounding chart context.
 *
 * @param consumer - Component name used in the error when rendered outside
 * a `GanttChart`.
 */
function useGanttChart(consumer: string) {
  const context = React.useContext(GanttChartContext)
  if (!context) {
    throw new Error(`${consumer} must be used within a GanttChart.`)
  }
  return context
}

export interface GanttChartProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** Controlled task list. Omit to let the chart own rescheduled tasks. */
  tasks?: GanttChartTask[]
  /** Initial tasks when the task list is uncontrolled. */
  defaultTasks?: GanttChartTask[]
  /** Fires with the next uncontrolled task list after a committed move. */
  onTasksChange?: (tasks: GanttChartTask[]) => void
  /** Controlled timeline scale. */
  scale?: GanttChartScale
  /** Initial scale when uncontrolled. Defaults to `"week"`. */
  defaultScale?: GanttChartScale
  onScaleChange?: (scale: GanttChartScale) => void
  /**
   * First day the timeline renders. Defaults to a week before the
   * earliest task (or the current date), snapped back to a week start.
   */
  rangeStart?: Date
  /**
   * Exclusive day the timeline renders up to. Defaults to a week past the
   * latest task (or the current date), snapped forward to a week start.
   */
  rangeEnd?: Date
  /**
   * Fixed "current date" for the today marker and Today button. Omit to
   * track the real clock with a once-a-minute refresh.
   */
  now?: Date
  /** BCP 47 locale for every formatted label. Defaults to the browser's. */
  locale?: string
  /** First weekday of week cells and range snapping, `0` Sunday–`6`. Defaults to 1. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Rendered height of one task row in pixels. Defaults to 36. */
  rowHeight?: number
  /** Width of the pinned task-list column in pixels. Defaults to 224. */
  taskListWidth?: number
  /** Controlled ids of collapsed summary tasks. */
  collapsedTaskIds?: string[]
  /** Initial collapsed summaries when uncontrolled. */
  defaultCollapsedTaskIds?: string[]
  /** Fires with the next collapsed-summary ids after a toggle. */
  onCollapsedTaskIdsChange?: (taskIds: string[]) => void
  /** Controlled id of the visually selected task, or null for none. */
  selectedTaskId?: string | null
  /** Initial selected task when uncontrolled. */
  defaultSelectedTaskId?: string | null
  /** Fires with the newly selected task id, or null when cleared. */
  onSelectedTaskChange?: (taskId: string | null) => void
  /** Fires when a task bar is activated. */
  onTaskSelect?: (
    task: GanttChartTask,
    domEvent: React.MouseEvent<HTMLButtonElement>,
  ) => void
  /** Fires with the rescheduled task once a drag or keyboard move commits. */
  onTaskMove?: (task: GanttChartTask) => void
  /**
   * Overrides for the chart's user-facing strings, merged over
   * `ganttChartDefaultLabels` — the localization and voice hook for every
   * rendered and announced string.
   */
  labels?: Partial<GanttChartLabels>
  /**
   * The chart's keyboard shortcuts. Merged over the defaults (`h`/`l`
   * scroll, `t` today, `d`/`w`/`m` switch scales,
   * `Shift+ArrowLeft/Right` move a focused task, `Mod+Alt+J/K` resize
   * it) — override any action with a different shortcut, disable one with
   * `false`, or pass `false` for the whole prop to turn every shortcut
   * off.
   */
  shortcuts?: GanttChartShortcuts | false
  /**
   * Whether finishing a drag or keyboard move asks for confirmation
   * before committing. Defaults to true, showing the built-in dialog at
   * the proposed dates; disable to commit every move immediately.
   */
  confirmMoves?: boolean
  /**
   * Whether a committed move or resize that shifts a task's finish also
   * shifts every task that transitively depends on it (`dependsOn`,
   * followed through the graph) by the same number of days — finish-to-
   * start scheduling in its simplest push-and-pull form, in both
   * directions. Off by default so dependency arrows stay purely visual.
   * While it is on, the built-in confirmation dialog turns the choice
   * per-move — "Move all" versus "Only this" — and either way a host's
   * own `renderMoveConfirm` UI can decide with
   * `confirm({ moveDependents })`; this prop is the default for commits
   * made without an explicit choice.
   */
  moveDependents?: boolean
  /**
   * Replaces the built-in move-confirmation dialog with the host's own
   * UI, positioned at the proposed dates. While it is open the move is
   * only pending, and the context's `confirm`/`cancel` commit or abandon
   * it. Only consulted while `confirmMoves` is enabled.
   */
  renderMoveConfirm?: (
    context: GanttChartMoveConfirmContext,
  ) => React.ReactNode
  /**
   * Replaces every task bar's interior with the host's own rendering —
   * assignee avatars, status dots, badges, whatever the product needs —
   * while the chart keeps the bar geometry and interactions. Keep the
   * returned content non-interactive: the bar itself is already a button.
   * Omit to use the built-in name-and-progress interior.
   */
  renderTask?: (context: GanttChartTaskRenderContext) => React.ReactNode
  /**
   * Computes extra classes for a task's bar from the task and its render
   * context, merged after the tone classes so they win conflicts. Styling
   * policy stays with the chart usage — tasks remain plain serializable
   * data — and applies on every surface, the drag ghost included.
   */
  taskClassName?: (
    context: GanttChartTaskRenderContext,
  ) => string | undefined
}

/**
 * A project-plan timeline in the industry's Gantt shape: a pinned task
 * list beside a scrollable day/week/month timeline of bars, milestones,
 * and roll-up summary brackets, with finish-to-start dependency arrows, a
 * today marker, and weekend shading. Hosts stack a `GanttChartToolbar`
 * (Today, paging, range label, scale switcher) above a `GanttChartGrid`.
 * Bars reschedule by pointer drag, edge-drag resizing, or the configured
 * keyboard chords — gated by default behind a built-in confirmation
 * dialog that hosts can replace with `renderMoveConfirm` or disable with
 * `confirmMoves` — and every step is mirrored through `onTaskMove`,
 * `onTasksChange`, and the selection callbacks so hosts own their
 * planning flows end to end.
 */
function GanttChart({
  className,
  children,
  tasks: tasksProp,
  defaultTasks,
  onTasksChange,
  scale: scaleProp,
  defaultScale = "week",
  onScaleChange,
  rangeStart: rangeStartProp,
  rangeEnd: rangeEndProp,
  now: nowProp,
  locale,
  weekStartsOn = 1,
  rowHeight = 36,
  taskListWidth = 224,
  collapsedTaskIds: collapsedTaskIdsProp,
  defaultCollapsedTaskIds,
  onCollapsedTaskIdsChange,
  selectedTaskId: selectedTaskIdProp,
  defaultSelectedTaskId = null,
  onSelectedTaskChange,
  onTaskSelect,
  onTaskMove,
  labels: labelsProp,
  shortcuts: shortcutsProp,
  confirmMoves = true,
  moveDependents = false,
  renderMoveConfirm,
  renderTask,
  taskClassName,
  ...props
}: GanttChartProps) {
  const [uncontrolledTasks, setUncontrolledTasks] = React.useState(
    () => defaultTasks ?? [],
  )
  const tasks = tasksProp ?? uncontrolledTasks

  const [uncontrolledScale, setUncontrolledScale] =
    React.useState(defaultScale)
  const scale = scaleProp ?? uncontrolledScale
  const setScale = (next: GanttChartScale) => {
    if (scaleProp === undefined) setUncontrolledScale(next)
    onScaleChange?.(next)
  }

  const [fallbackNow, setFallbackNow] = React.useState(() => new Date())
  React.useEffect(() => {
    if (nowProp) return
    const timer = window.setInterval(() => setFallbackNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [nowProp])
  const now = nowProp ?? fallbackNow

  const [uncontrolledCollapsed, setUncontrolledCollapsed] = React.useState<
    string[]
  >(() => defaultCollapsedTaskIds ?? [])
  const collapsedList = collapsedTaskIdsProp ?? uncontrolledCollapsed
  const collapsedIds = React.useMemo(
    () => new Set(collapsedList),
    [collapsedList],
  )
  const toggleCollapsed = (taskId: string) => {
    const next = collapsedList.includes(taskId)
      ? collapsedList.filter((id) => id !== taskId)
      : [...collapsedList, taskId]
    if (collapsedTaskIdsProp === undefined) setUncontrolledCollapsed(next)
    onCollapsedTaskIdsChange?.(next)
  }

  const [uncontrolledSelectedId, setUncontrolledSelectedId] = React.useState(
    defaultSelectedTaskId,
  )
  const selectedTaskId =
    selectedTaskIdProp !== undefined ? selectedTaskIdProp : uncontrolledSelectedId
  const selectTask = (taskId: string | null) => {
    if (selectedTaskIdProp === undefined) setUncontrolledSelectedId(taskId)
    onSelectedTaskChange?.(taskId)
  }

  const labels = React.useMemo(
    () => ({ ...ganttChartDefaultLabels, ...labelsProp }),
    [labelsProp],
  )

  const shortcuts = React.useMemo<ResolvedShortcuts>(() => {
    const actions = Object.keys(DEFAULT_SHORTCUTS) as GanttChartShortcutAction[]
    return Object.fromEntries(
      actions.map((action) => {
        if (shortcutsProp === false) return [action, undefined]
        const override = shortcutsProp?.[action]
        if (override === false) return [action, undefined]
        return [action, override ?? DEFAULT_SHORTCUTS[action]]
      }),
    ) as ResolvedShortcuts
  }, [shortcutsProp])

  const range = React.useMemo<GanttChartRange>(() => {
    let min = startOfDay(now)
    let max = startOfDay(now)
    for (const task of tasks) {
      const start = startOfDay(task.start)
      const end = startOfDay(task.end)
      if (start < min) min = start
      if (end > max) max = end
    }
    const start =
      rangeStartProp !== undefined
        ? startOfDay(rangeStartProp)
        : startOfWeek(addDays(min, -WEEK_LENGTH), weekStartsOn)
    const end =
      rangeEndProp !== undefined
        ? startOfDay(rangeEndProp)
        : addDays(
            startOfWeek(addDays(max, WEEK_LENGTH), weekStartsOn),
            WEEK_LENGTH,
          )
    return { start, end }
  }, [tasks, now, rangeStartProp, rangeEndProp, weekStartsOn])

  const totalDays = Math.max(
    differenceInCalendarDays(range.end, range.start),
    1,
  )
  const dayWidth = SCALE_DAY_WIDTH[scale]

  const rows = React.useMemo(
    () => flattenTasks(tasks, collapsedIds),
    [tasks, collapsedIds],
  )

  const [pendingMove, setPendingMove] = React.useState<PendingMove | null>(
    null,
  )

  // A task list changing under a pending move (controlled hosts) leaves
  // the ghost pointing at a task that may be gone — drop it.
  React.useEffect(() => {
    if (!pendingMove) return
    if (!tasks.some((task) => task.id === pendingMove.task.id)) {
      setPendingMove(null)
    }
  }, [tasks, pendingMove])

  /**
   * A task's transitive dependents: every task reachable by following
   * `dependsOn` edges away from it, cycle-safe, in breadth-first order.
   */
  const dependentIdsOf = React.useCallback(
    (taskId: string) => {
      const successorsOf = new Map<string, string[]>()
      for (const task of tasks) {
        for (const predecessorId of task.dependsOn ?? []) {
          const successors = successorsOf.get(predecessorId) ?? []
          successors.push(task.id)
          successorsOf.set(predecessorId, successors)
        }
      }
      const dependents: string[] = []
      const seen = new Set([taskId])
      const queue = [taskId]
      while (queue.length) {
        const id = queue.shift() as string
        for (const successorId of successorsOf.get(id) ?? []) {
          if (seen.has(successorId)) continue
          seen.add(successorId)
          dependents.push(successorId)
          queue.push(successorId)
        }
      }
      return dependents
    },
    [tasks],
  )

  const commitMove = (
    task: GanttChartTask,
    start: Date,
    end: Date,
    cascade: boolean = moveDependents,
  ) => {
    const moved = { ...task, start, end }
    // Dependents follow the finish: a whole-task move or an end resize
    // shifts them by the same day count, a start-only resize leaves the
    // finish — and therefore the chain — untouched.
    const finishDelta = differenceInCalendarDays(end, task.end)
    const shiftedIds =
      cascade && finishDelta !== 0
        ? new Set(dependentIdsOf(task.id))
        : new Set<string>()
    const next = tasks.map((candidate) => {
      if (candidate.id === task.id) return moved
      if (!shiftedIds.has(candidate.id)) return candidate
      return {
        ...candidate,
        start: addDays(candidate.start, finishDelta),
        end: addDays(candidate.end, finishDelta),
      }
    })
    if (tasksProp === undefined) setUncontrolledTasks(next)
    onTasksChange?.(next)
    onTaskMove?.(moved)
  }

  const requestMove = (task: GanttChartTask, start: Date, end: Date) => {
    if (
      startOfDay(task.start).getTime() === start.getTime() &&
      startOfDay(task.end).getTime() === end.getTime()
    ) {
      setPendingMove(null)
      return
    }
    if (confirmMoves) {
      setPendingMove({ task, start, end, stage: "confirming" })
    } else {
      setPendingMove(null)
      commitMove(task, start, end)
    }
  }

  const adjustMove = (task: GanttChartTask, start: Date, end: Date) => {
    setPendingMove({ task, start, end, stage: "adjusting" })
  }

  const promotePendingMove = () => {
    setPendingMove((current) => {
      if (!current) return current
      if (!confirmMoves) {
        commitMove(current.task, current.start, current.end)
        return null
      }
      return { ...current, stage: "confirming" }
    })
  }

  const confirmPendingMove = (options?: { moveDependents?: boolean }) => {
    if (!pendingMove) return
    commitMove(
      pendingMove.task,
      pendingMove.start,
      pendingMove.end,
      options?.moveDependents ?? moveDependents,
    )
    setPendingMove(null)
  }

  const cancelPendingMove = () => setPendingMove(null)

  const scrollerRef = React.useRef<HTMLDivElement>(null)

  const scrollToDate = React.useCallback(
    (date: Date) => {
      const scroller = scrollerRef.current
      if (!scroller) return
      const offset =
        differenceInCalendarDays(date, range.start) * SCALE_DAY_WIDTH[scale]
      const visibleTimeline = scroller.clientWidth - taskListWidth
      scroller.scrollLeft = Math.max(offset - visibleTimeline / 3, 0)
    },
    [range.start, scale, taskListWidth],
  )

  const pageTimeline = React.useCallback(
    (direction: 1 | -1) => {
      const scroller = scrollerRef.current
      if (!scroller) return
      const visibleTimeline = scroller.clientWidth - taskListWidth
      scroller.scrollLeft += direction * visibleTimeline * 0.8
    },
    [taskListWidth],
  )

  const handleShortcuts = (keyEvent: React.KeyboardEvent<HTMLDivElement>) => {
    if (keyEvent.defaultPrevented) return
    if (isEditableShortcutTarget(keyEvent)) return
    const actions: Array<
      [GanttChartKeyboardShortcut | undefined, () => void]
    > = [
      [shortcuts.previousPeriod, () => pageTimeline(-1)],
      [shortcuts.nextPeriod, () => pageTimeline(1)],
      [shortcuts.today, () => scrollToDate(now)],
      [shortcuts.dayScale, () => setScale("day")],
      [shortcuts.weekScale, () => setScale("week")],
      [shortcuts.monthScale, () => setScale("month")],
    ]
    for (const [shortcut, run] of actions) {
      if (!shortcut || !matchesShortcut(keyEvent, shortcut)) continue
      if (shortcut.preventDefault !== false) keyEvent.preventDefault()
      run()
      return
    }
  }

  const context: GanttChartContextValue = {
    tasks,
    rows,
    range,
    totalDays,
    dayWidth,
    rowHeight,
    taskListWidth,
    scale,
    setScale,
    now,
    locale,
    weekStartsOn,
    labels,
    shortcuts,
    collapsedIds,
    toggleCollapsed,
    selectedTaskId,
    selectTask,
    onTaskSelect,
    renderTask,
    taskClassName,
    moveDependents,
    dependentIdsOf,
    pendingMove,
    requestMove,
    adjustMove,
    promotePendingMove,
    confirmPendingMove,
    cancelPendingMove,
    confirmMoves,
    renderMoveConfirm,
    scrollerRef,
    scrollToDate,
    pageTimeline,
  }

  return (
    <GanttChartContext.Provider value={context}>
      <div
        data-slot="gantt-chart"
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-border bg-background font-sans text-foreground",
          className,
        )}
        onKeyDown={handleShortcuts}
        {...props}
      >
        {children}
      </div>
    </GanttChartContext.Provider>
  )
}

export interface GanttChartToolbarProps extends React.ComponentProps<"div"> {}

/** Formats the toolbar's heading from the rendered range. */
function formatRangeLabel(locale: string | undefined, range: GanttChartRange) {
  const format = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  })
  const lastDay = addDays(range.end, -1)
  const first = format.format(range.start)
  const last = format.format(lastDay)
  return first === last ? first : `${first} – ${last}`
}

/**
 * The chart's command row: a Today button that scrolls the current date
 * into view, previous/next paging that scrolls the timeline a screen at a
 * time, a range heading, and a Day/Week/Month scale switcher. Extra
 * children render after the switcher for host actions such as filters.
 */
function GanttChartToolbar({
  className,
  children,
  ...props
}: GanttChartToolbarProps) {
  const {
    scale,
    setScale,
    range,
    now,
    locale,
    labels,
    scrollToDate,
    pageTimeline,
  } = useGanttChart("GanttChartToolbar")

  return (
    <div
      data-slot="gantt-chart-toolbar"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2",
        className,
      )}
      {...props}
    >
      <Button variant="outline" size="sm" onClick={() => scrollToDate(now)}>
        {labels.today}
      </Button>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={labels.previousPeriod}
          title={labels.previousPeriod}
          onClick={() => pageTimeline(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={labels.nextPeriod}
          title={labels.nextPeriod}
          onClick={() => pageTimeline(1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <p
        data-slot="gantt-chart-range-label"
        className="ms-1 truncate text-sm font-semibold"
      >
        {formatRangeLabel(locale, range)}
      </p>
      <SegmentedControl
        aria-label={labels.scale}
        className="ms-auto"
        value={scale}
        onValueChange={(next) => setScale(next as GanttChartScale)}
      >
        {(["day", "week", "month"] as const).map((candidate) => (
          <SegmentedControlOption key={candidate} value={candidate}>
            {labels[candidate]}
          </SegmentedControlOption>
        ))}
      </SegmentedControl>
      {children}
    </div>
  )
}

/** Composes a bar's full announcement from its row and the keymap. */
function rowLabel(
  locale: string | undefined,
  labels: GanttChartLabels,
  shortcuts: ResolvedShortcuts,
  row: GanttRow,
) {
  const start = formatDayLabel(locale, row.span.start)
  const end = formatDayLabel(locale, addDays(row.span.end, -1))
  let base: string
  if (row.summary) {
    base = labels.summary(row.task.name, start, end, row.leafCount)
  } else if (row.milestone) {
    base = labels.milestone(row.task.name, start)
  } else {
    base = labels.taskBar(row.task.name, start, end)
  }
  const progress =
    row.progress !== undefined && !row.milestone
      ? ` ${labels.taskProgress(Math.round(row.progress * 100))}.`
      : ""
  const hints = row.summary
    ? ""
    : barShortcutHints(shortcuts, labels, !row.milestone)
  return `${base}.${progress}${hints}`
}

/** A drag in flight on one task bar. */
interface MoveSession {
  /**
   * `move` relocates the whole task; the resize kinds drag one boundary
   * while the opposite one stays fixed.
   */
  kind: "move" | "resize-start" | "resize-end"
  task: GanttChartTask
  /** Whole-task length in days, preserved through a move. */
  durationDays: number
  originX: number
  /** Becomes true once the pointer travels past the drag threshold. */
  started: boolean
  targetStart: Date
  targetEnd: Date
}

function TaskBar({
  row,
  moving,
  onBeginDrag,
  suppressClickRef,
}: {
  row: GanttRow
  moving: boolean
  onBeginDrag: (
    kind: MoveSession["kind"],
    pointerEvent: React.PointerEvent<Element>,
    row: GanttRow,
  ) => void
  suppressClickRef: React.RefObject<boolean>
}) {
  const {
    range,
    dayWidth,
    rowHeight,
    locale,
    labels,
    shortcuts,
    selectedTaskId,
    selectTask,
    onTaskSelect,
    renderTask,
    taskClassName,
    pendingMove,
    adjustMove,
    promotePendingMove,
    cancelPendingMove,
    confirmMoves,
  } = useGanttChart("GanttChartGrid")
  const { task } = row
  const tone = task.tone ?? "primary"
  const selected = selectedTaskId === task.id
  const surface: GanttChartTaskRenderContext["surface"] = row.summary
    ? "summary"
    : row.milestone
      ? "milestone"
      : "bar"
  const renderContext: GanttChartTaskRenderContext = {
    task,
    surface,
    selected,
  }

  const startOffset = differenceInCalendarDays(row.span.start, range.start)
  const spanDays = differenceInCalendarDays(row.span.end, row.span.start)
  const left = startOffset * dayWidth
  const width = Math.max(spanDays * dayWidth, dayWidth)

  const barPending = pendingMove?.task.id === task.id ? pendingMove : null
  const interactive = !row.summary

  const beginResize = (
    kind: "resize-start" | "resize-end",
    pointerEvent: React.PointerEvent<HTMLSpanElement>,
  ) => {
    if (pointerEvent.button !== 0) return
    if (pointerEvent.pointerType === "touch") return
    pointerEvent.stopPropagation()
    try {
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
    } catch {
      // Synthetic pointer events in tests carry untracked pointer ids.
    }
    onBeginDrag(kind, pointerEvent, row)
  }

  /** Refocuses this task's bar after a commit re-renders it elsewhere. */
  const refocusBar = (currentTarget: HTMLElement) => {
    const grid = currentTarget.closest('[data-slot="gantt-chart-scroll"]')
    window.setTimeout(() => {
      grid
        ?.querySelector<HTMLElement>(
          `[data-task-id="${CSS.escape(task.id)}"]`,
        )
        ?.focus()
    }, 0)
  }

  const handleKeyDown = (
    keyEvent: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!interactive) return
    const base = barPending ?? {
      start: startOfDay(task.start),
      end: startOfDay(task.end),
    }
    const durationDays = differenceInCalendarDays(base.end, base.start)

    const nudges: Array<[GanttChartKeyboardShortcut | undefined, number]> = [
      [shortcuts.moveTaskLeft, -1],
      [shortcuts.moveTaskRight, 1],
    ]
    for (const [shortcut, dayDelta] of nudges) {
      if (!shortcut || !matchesShortcut(keyEvent, shortcut)) continue
      if (shortcut.preventDefault !== false) keyEvent.preventDefault()
      keyEvent.stopPropagation()
      const start = addDays(base.start, dayDelta)
      const end = addDays(base.end, dayDelta)
      // A nudge only lands where the timeline can show the ghost.
      if (start < range.start || end > range.end) return
      adjustMove(task, start, end)
      return
    }

    const resizes: Array<[GanttChartKeyboardShortcut | undefined, number]> = [
      [shortcuts.resizeTaskLonger, 1],
      [shortcuts.resizeTaskShorter, -1],
    ]
    for (const [shortcut, endDelta] of resizes) {
      if (!shortcut || !matchesShortcut(keyEvent, shortcut)) continue
      if (shortcut.preventDefault !== false) keyEvent.preventDefault()
      keyEvent.stopPropagation()
      // Milestones mark instants: they move, but never grow.
      if (row.milestone) return
      const nextDuration = durationDays + endDelta
      if (nextDuration < 1) return
      const end = addDays(base.start, nextDuration)
      if (end > range.end) return
      adjustMove(task, base.start, end)
      return
    }

    if (!barPending) return
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault()
      keyEvent.stopPropagation()
      promotePendingMove()
      // With confirmation on, the dialog takes focus (Enter again commits
      // via its focused Move button); without it the commit re-renders
      // the bar, which needs its focus restored.
      if (!confirmMoves) refocusBar(keyEvent.currentTarget)
    } else if (keyEvent.key === "Escape") {
      keyEvent.stopPropagation()
      cancelPendingMove()
    }
  }

  const label = rowLabel(locale, labels, shortcuts, row)
  const progressPercent =
    row.progress !== undefined
      ? Math.round(clamp(row.progress, 0, 1) * 100)
      : null

  // Summary brackets are derived roll-ups: activating one has no built-in
  // effect, so it never takes the pressed/selected treatment — the click
  // still reaches onTaskSelect for hosts that give it a meaning.
  const selectable = !row.summary

  const sharedButtonProps = {
    type: "button" as const,
    "data-task-id": task.id,
    "data-tone": tone,
    "data-moving": moving || undefined,
    "data-selected": (selectable && selected) || undefined,
    "aria-pressed": selectable ? selected : undefined,
    "aria-label": label,
    onKeyDown: handleKeyDown,
    onBlur: () => {
      if (barPending?.stage === "adjusting") cancelPendingMove()
    },
    onClick: (domEvent: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      if (selectable) selectTask(task.id)
      onTaskSelect?.(task, domEvent)
    },
  }

  const beginMove = (pointerEvent: React.PointerEvent<HTMLButtonElement>) => {
    if (!interactive) return
    if (pointerEvent.button !== 0) return
    if (pointerEvent.pointerType === "touch") return
    try {
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
    } catch {
      // Synthetic pointer events in tests carry untracked pointer ids.
    }
    onBeginDrag("move", pointerEvent, row)
  }

  if (row.summary) {
    return (
      <button
        {...sharedButtonProps}
        data-slot="gantt-chart-summary"
        className={cn(
          "absolute inset-y-0 rounded-md",
          surfaceTransitionClassName,
          insetFocusClassName,
          taskClassName?.(renderContext),
        )}
        style={{ left, width }}
      >
        {renderTask?.(renderContext) ?? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-3 block h-1.5"
          >
            <span
              className={cn(
                "absolute inset-0 rounded-sm border-none",
                ganttChartToneVariants({ tone }),
              )}
            />
            <span
              className={cn(
                "absolute -bottom-1 left-0 size-2 rounded-[2px] border-none",
                ganttChartToneVariants({ tone }),
              )}
            />
            <span
              className={cn(
                "absolute -bottom-1 right-0 size-2 rounded-[2px] border-none",
                ganttChartToneVariants({ tone }),
              )}
            />
          </span>
        )}
      </button>
    )
  }

  if (row.milestone) {
    return (
      <>
        <button
          {...sharedButtonProps}
          data-slot="gantt-chart-milestone"
          className={cn(
            "absolute rotate-45 cursor-grab rounded-[3px]",
            ganttChartToneVariants({ tone }),
            surfaceTransitionClassName,
            insetFocusClassName,
            taskClassName?.(renderContext),
            moving && "opacity-40",
            selected &&
              "ring-2 ring-ring ring-offset-1 ring-offset-background",
          )}
          style={{
            left: left - MILESTONE_SIZE / 2,
            top: (rowHeight - MILESTONE_SIZE) / 2,
            width: MILESTONE_SIZE,
            height: MILESTONE_SIZE,
          }}
          onPointerDown={beginMove}
        >
          {renderTask?.(renderContext)}
        </button>
        <span
          aria-hidden="true"
          data-slot="gantt-chart-milestone-name"
          className="pointer-events-none absolute top-0 flex h-full max-w-48 items-center truncate text-xs font-medium text-foreground"
          style={{ left: left + MILESTONE_SIZE }}
        >
          {task.name}
        </span>
      </>
    )
  }

  return (
    <button
      {...sharedButtonProps}
      data-slot="gantt-chart-bar"
      className={cn(
        "absolute flex cursor-grab items-center overflow-hidden rounded-md px-2 text-start text-xs font-medium leading-4 shadow-xs",
        ganttChartToneVariants({ tone }),
        surfaceTransitionClassName,
        insetFocusClassName,
        taskClassName?.(renderContext),
        moving && "opacity-40",
        selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
      )}
      style={{
        left,
        top: BAR_INSET,
        height: rowHeight - BAR_INSET * 2,
        width,
      }}
      onPointerDown={beginMove}
    >
      {progressPercent !== null ? (
        // Progress draws as a slim current-color meter inside the bar, so
        // the bar stays a single tone in both modes — never the two-tone
        // done/remaining split that reads as white-on-white in dark.
        <span
          aria-hidden="true"
          data-slot="gantt-chart-bar-progress"
          className="absolute inset-x-2 bottom-[2px] h-[3px] overflow-hidden rounded-full bg-current/25"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-current/70"
            style={{ width: `${progressPercent}%` }}
          />
        </span>
      ) : null}
      <span className="relative z-10 flex w-full min-w-0 items-center pb-1">
        {renderTask?.(renderContext) ?? (
          <span className="w-full truncate">{task.name}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        data-slot="gantt-chart-bar-resize-start"
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
        onPointerDown={(pointerEvent) =>
          beginResize("resize-start", pointerEvent)
        }
      />
      <span
        aria-hidden="true"
        data-slot="gantt-chart-bar-resize-end"
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
        onPointerDown={(pointerEvent) =>
          beginResize("resize-end", pointerEvent)
        }
      />
    </button>
  )
}

/**
 * The built-in move-confirmation dialog: a compact popover-surface card
 * naming the task and its proposed dates, with a focused Move button and
 * a Keep escape hatch. Hosts replace it wholesale via `renderMoveConfirm`.
 */
function DefaultMoveConfirm({
  context,
}: {
  context: GanttChartMoveConfirmContext
}) {
  const { locale, labels, moveDependents } = useGanttChart("GanttChartGrid")
  const confirmRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  const durationChanged =
    differenceInCalendarDays(context.range.end, context.range.start) !==
    differenceInCalendarDays(context.task.end, context.task.start)
  const milestone =
    context.range.start.getTime() === context.range.end.getTime()

  return (
    <PopoverSurface
      role="dialog"
      aria-label={
        durationChanged ? labels.confirmResizeLabel : labels.confirmMoveLabel
      }
      data-slot="gantt-chart-move-confirm-card"
      radius="lg"
      className="flex w-64 flex-col gap-2 p-3"
    >
      <p className="text-xs font-medium">
        {durationChanged
          ? labels.confirmResizeTitle(context.task.name)
          : labels.confirmMoveTitle(context.task.name)}
      </p>
      <p className="text-xs text-muted-foreground">
        {milestone
          ? formatDayLabel(locale, context.range.start)
          : `${formatDayLabel(locale, context.range.start)} – ${formatDayLabel(
              locale,
              addDays(context.range.end, -1),
            )}`}
      </p>
      {moveDependents && context.dependentTaskIds.length ? (
        <p className="text-xs text-muted-foreground">
          {labels.cascadeNote(context.dependentTaskIds.length)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {moveDependents && context.dependentTaskIds.length ? (
          // With the cascade option on and dependents in play, the choice
          // is per move: take the chain along, or reschedule just this
          // task. Hosts build their own version of this ask through
          // renderMoveConfirm and confirm({ moveDependents }).
          <>
            <Button
              ref={confirmRef}
              size="sm"
              className="h-7"
              onClick={() => context.confirm({ moveDependents: true })}
            >
              {labels.moveAllAction}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => context.confirm({ moveDependents: false })}
            >
              {labels.moveOnlyAction}
            </Button>
          </>
        ) : (
          <Button
            ref={confirmRef}
            size="sm"
            className="h-7"
            onClick={() => context.confirm()}
          >
            {durationChanged ? labels.resizeAction : labels.moveAction}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={context.cancel}
        >
          {labels.keepAction}
        </Button>
      </div>
    </PopoverSurface>
  )
}

/**
 * Finish-to-start dependency arrows, drawn under the bars. Arrows whose
 * endpoint rows are hidden inside a collapsed summary simply stay off the
 * canvas until the rows return.
 */
function DependencyLayer() {
  const { rows, range, dayWidth, rowHeight } = useGanttChart("GanttChartGrid")
  // Instance-scoped marker id so several charts on one page never collide.
  const markerId = `${React.useId()}-arrowhead`
  const rowIndexById = new Map(rows.map((row, index) => [row.task.id, index]))

  const paths: Array<{ key: string; d: string }> = []
  for (const row of rows) {
    for (const predecessorId of row.task.dependsOn ?? []) {
      const fromIndex = rowIndexById.get(predecessorId)
      const toIndex = rowIndexById.get(row.task.id)
      if (fromIndex === undefined || toIndex === undefined) continue
      const from = rows[fromIndex]
      const fromEndX =
        differenceInCalendarDays(from.span.end, range.start) * dayWidth +
        (from.milestone ? MILESTONE_SIZE / 2 : 0)
      const toStartX =
        differenceInCalendarDays(row.span.start, range.start) * dayWidth -
        (row.milestone ? MILESTONE_SIZE / 2 : 0)
      const fromY = fromIndex * rowHeight + rowHeight / 2
      const toY = toIndex * rowHeight + rowHeight / 2
      const arrowGap = 5
      let d: string
      if (toStartX >= fromEndX + 14) {
        // Room for a plain elbow: out, across, and into the successor.
        const bendX = fromEndX + 7
        d = `M ${fromEndX} ${fromY} H ${bendX} V ${toY} H ${toStartX - arrowGap}`
      } else {
        // The successor starts at or before the predecessor's finish:
        // route out, drop to the row boundary, run back, and come in.
        const outX = fromEndX + 7
        const backX = toStartX - 12
        const midY = fromY + (toY > fromY ? rowHeight / 2 : -rowHeight / 2)
        d = `M ${fromEndX} ${fromY} H ${outX} V ${midY} H ${backX} V ${toY} H ${toStartX - arrowGap}`
      }
      paths.push({ key: `${predecessorId}->${row.task.id}`, d })
    }
  }

  if (!paths.length) return null

  return (
    <svg
      aria-hidden="true"
      data-slot="gantt-chart-dependencies"
      className="pointer-events-none absolute top-0 text-muted-foreground"
      style={{
        left: 0,
        width: differenceInCalendarDays(range.end, range.start) * dayWidth,
        height: rows.length * rowHeight,
      }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 6 3 L 0 6 Z" fill="currentColor" />
        </marker>
      </defs>
      {paths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd={`url(#${markerId})`}
        />
      ))}
    </svg>
  )
}

export interface GanttChartGridProps extends React.ComponentProps<"div"> {}

/**
 * The chart's scrollable body: the pinned task list, the two-tier time
 * header, one lane per visible task, dependency arrows, weekend shading,
 * and the today marker. Scrolls both axes inside a built-in height cap
 * that hosts override with `className`.
 */
function GanttChartGrid({ className, ...props }: GanttChartGridProps) {
  const {
    rows,
    range,
    totalDays,
    dayWidth,
    rowHeight,
    taskListWidth,
    scale,
    now,
    locale,
    weekStartsOn,
    labels,
    collapsedIds,
    toggleCollapsed,
    moveDependents,
    dependentIdsOf,
    pendingMove,
    requestMove,
    confirmPendingMove,
    cancelPendingMove,
    renderMoveConfirm,
    taskClassName,
    scrollerRef,
    scrollToDate,
  } = useGanttChart("GanttChartGrid")

  const timelineWidth = totalDays * dayWidth

  // Initial position only: later date or scale changes keep the user's
  // own scroll, with the Today button as the way back.
  const initialScrollDone = React.useRef(false)
  React.useEffect(() => {
    if (initialScrollDone.current) return
    initialScrollDone.current = true
    scrollToDate(now)
  }, [scrollToDate, now])

  const [moveSession, setMoveSession] = React.useState<MoveSession | null>(
    null,
  )
  const moveSessionRef = React.useRef(moveSession)
  React.useEffect(() => {
    moveSessionRef.current = moveSession
  })
  const suppressClickRef = React.useRef(false)

  const beginDrag = (
    kind: MoveSession["kind"],
    pointerEvent: React.PointerEvent<Element>,
    row: GanttRow,
  ) => {
    // One gesture owns the chart at a time; a second pointer cannot
    // hijack and settle the first one's session.
    if (moveSessionRef.current) return
    setMoveSession({
      kind,
      task: row.task,
      durationDays: differenceInCalendarDays(row.span.end, row.span.start),
      originX: pointerEvent.clientX,
      started: false,
      targetStart: row.span.start,
      targetEnd: row.span.end,
    })
  }

  React.useEffect(() => {
    if (!moveSession) return

    const handleMove = (pointerEvent: PointerEvent) => {
      const session = moveSessionRef.current
      if (!session) return
      if (pointerEvent.buttons === 0) {
        setMoveSession(null)
        return
      }
      const dx = pointerEvent.clientX - session.originX
      const started = session.started || Math.abs(dx) > MOVE_THRESHOLD_PX
      const dayDelta = Math.round(dx / dayWidth)
      const baseStart = startOfDay(session.task.start)
      const baseEnd = startOfDay(session.task.end)
      let targetStart = baseStart
      let targetEnd = baseEnd
      if (session.kind === "move") {
        targetStart = addDays(baseStart, dayDelta)
        targetEnd = addDays(baseEnd, dayDelta)
        const overflowLeft = differenceInCalendarDays(
          range.start,
          targetStart,
        )
        if (overflowLeft > 0) {
          targetStart = addDays(targetStart, overflowLeft)
          targetEnd = addDays(targetEnd, overflowLeft)
        }
        const overflowRight = differenceInCalendarDays(targetEnd, range.end)
        if (overflowRight > 0) {
          targetStart = addDays(targetStart, -overflowRight)
          targetEnd = addDays(targetEnd, -overflowRight)
        }
      } else if (session.kind === "resize-end") {
        const minEnd = addDays(baseStart, 1)
        targetEnd = addDays(baseEnd, dayDelta)
        if (targetEnd < minEnd) targetEnd = minEnd
        if (targetEnd > range.end) targetEnd = range.end
      } else {
        const maxStart = addDays(baseEnd, -1)
        targetStart = addDays(baseStart, dayDelta)
        if (targetStart > maxStart) targetStart = maxStart
        if (targetStart < range.start) targetStart = range.start
      }
      setMoveSession({ ...session, started, targetStart, targetEnd })
    }

    const settle = (commit: boolean) => {
      const session = moveSessionRef.current
      setMoveSession(null)
      if (!session?.started) return
      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
      if (commit) {
        requestMove(session.task, session.targetStart, session.targetEnd)
      }
    }

    const handleUp = () => settle(true)
    const handleCancel = () => settle(false)

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleCancel)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
    }
  }, [moveSession, dayWidth, range.start, range.end, requestMove])

  const primaryCells =
    scale === "month"
      ? yearCells(range, locale)
      : monthCells(range, locale, true)
  const secondaryCells = fineCells(range, scale, locale, weekStartsOn)

  const todayOffset = differenceInCalendarDays(now, range.start)
  const todayVisible = todayOffset >= 0 && todayOffset < totalDays

  const rowsHeight = rows.length * rowHeight

  /** The ghost's proposed span while dragging or keyboard-adjusting. */
  const ghostFor = (row: GanttRow): GanttChartRange | null => {
    if (moveSession?.started && moveSession.task.id === row.task.id) {
      return { start: moveSession.targetStart, end: moveSession.targetEnd }
    }
    if (pendingMove?.task.id === row.task.id) {
      return { start: pendingMove.start, end: pendingMove.end }
    }
    return null
  }

  return (
    <div
      ref={scrollerRef}
      data-slot="gantt-chart-scroll"
      role="region"
      aria-label={labels.timeline}
      tabIndex={0}
      className={cn(
        "relative max-h-[480px] overflow-auto overscroll-contain",
        insetFocusClassName,
        className,
      )}
      {...props}
    >
      <div
        data-slot="gantt-chart-canvas"
        className="relative min-w-full"
        style={{ width: taskListWidth + timelineWidth }}
      >
        <div
          data-slot="gantt-chart-header"
          className="sticky top-0 z-30 flex border-b border-border bg-background"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="sticky left-0 z-10 flex shrink-0 items-end border-r border-border bg-background px-3 pb-1 text-xs font-medium text-muted-foreground"
            style={{ width: taskListWidth }}
          >
            {labels.taskListHeader}
          </div>
          <div
            className="relative shrink-0"
            style={{ width: timelineWidth }}
            aria-hidden="true"
          >
            {primaryCells.map((cell) => (
              <div
                key={cell.key}
                className="absolute top-0 flex items-center border-l border-border/60 px-2 text-xs font-medium text-muted-foreground"
                style={{
                  left: cell.offsetDays * dayWidth,
                  width: cell.days * dayWidth,
                  height: PRIMARY_TIER_HEIGHT,
                }}
              >
                {/* Pinned within its own cell, so the label stays readable
                    while any part of the month is in view. */}
                <span
                  className="sticky whitespace-nowrap"
                  style={{ left: taskListWidth + 8 }}
                >
                  {cell.label}
                </span>
              </div>
            ))}
            {secondaryCells.map((cell) => (
              <div
                key={cell.key}
                className="absolute bottom-0 flex items-center justify-center overflow-hidden border-l border-border/60 text-xs text-muted-foreground"
                style={{
                  left: cell.offsetDays * dayWidth,
                  width: cell.days * dayWidth,
                  height: HEADER_HEIGHT - PRIMARY_TIER_HEIGHT,
                }}
              >
                <span className="truncate">{cell.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div data-slot="gantt-chart-body" className="relative">
          <div
            aria-hidden="true"
            data-slot="gantt-chart-underlay"
            className="pointer-events-none absolute top-0"
            style={{
              left: taskListWidth,
              width: timelineWidth,
              height: rowsHeight,
            }}
          >
            {secondaryCells.map((cell) => (
              <div
                key={cell.key}
                className="absolute inset-y-0 border-l border-border/40"
                style={{
                  left: cell.offsetDays * dayWidth,
                  width: cell.days * dayWidth,
                }}
              />
            ))}
            {scale === "day"
              ? Array.from({ length: totalDays }, (_, index) =>
                  isWeekend(addDays(range.start, index)) ? (
                    <div
                      key={`weekend-${index}`}
                      data-slot="gantt-chart-weekend"
                      className="absolute inset-y-0 bg-muted/50"
                      style={{ left: index * dayWidth, width: dayWidth }}
                    />
                  ) : null,
                )
              : null}
            {todayVisible ? (
              <div
                data-slot="gantt-chart-today"
                className="absolute inset-y-0 w-px bg-primary"
                style={{ left: (todayOffset + 0.5) * dayWidth }}
              />
            ) : null}
          </div>
          <div className="absolute top-0" style={{ left: taskListWidth }}>
            <DependencyLayer />
          </div>
          {rows.map((row) => {
            const ghost = ghostFor(row)
            const rowMoving = Boolean(
              (moveSession?.started &&
                moveSession.task.id === row.task.id) ||
                pendingMove?.task.id === row.task.id,
            )
            const confirming =
              pendingMove?.task.id === row.task.id &&
              pendingMove.stage === "confirming"
            const ghostLeft = ghost
              ? differenceInCalendarDays(ghost.start, range.start) * dayWidth
              : 0
            const ghostWidth = ghost
              ? Math.max(
                  differenceInCalendarDays(ghost.end, ghost.start) * dayWidth,
                  dayWidth,
                )
              : 0
            const milestoneGhost =
              ghost && ghost.start.getTime() === ghost.end.getTime()
            return (
              <div
                key={row.task.id}
                data-slot="gantt-chart-row"
                data-summary={row.summary || undefined}
                className="flex"
                style={{ height: rowHeight }}
              >
                {/* The cell and the lane each own their bottom border: a
                    border on the row itself is a 1px seam the opaque sticky
                    cell cannot cover, and the dependency arrows bleed
                    through it across the pinned column. */}
                <div
                  data-slot="gantt-chart-task-cell"
                  className="sticky left-0 z-20 flex shrink-0 items-center gap-1 border-b border-r border-border/40 border-r-border bg-background pe-3 text-sm"
                  style={{
                    width: taskListWidth,
                    paddingInlineStart: 8 + row.depth * 16,
                  }}
                >
                  {row.summary ? (
                    <button
                      type="button"
                      data-slot="gantt-chart-collapse-toggle"
                      aria-expanded={!collapsedIds.has(row.task.id)}
                      aria-label={
                        collapsedIds.has(row.task.id)
                          ? labels.expandGroup(row.task.name)
                          : labels.collapseGroup(row.task.name)
                      }
                      title={
                        collapsedIds.has(row.task.id)
                          ? labels.expandGroup(row.task.name)
                          : labels.collapseGroup(row.task.name)
                      }
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        surfaceTransitionClassName,
                        insetFocusClassName,
                      )}
                      onClick={() => toggleCollapsed(row.task.id)}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          "size-3.5 transition-transform [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
                          !collapsedIds.has(row.task.id) && "rotate-90",
                        )}
                      />
                    </button>
                  ) : (
                    <span aria-hidden="true" className="size-5 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "truncate",
                      row.summary && "font-medium",
                    )}
                  >
                    {row.task.name}
                  </span>
                </div>
                <div
                  data-slot="gantt-chart-lane"
                  className="relative shrink-0 border-b border-border/40"
                  style={{ width: timelineWidth }}
                >
                  <TaskBar
                    row={row}
                    moving={rowMoving}
                    onBeginDrag={beginDrag}
                    suppressClickRef={suppressClickRef}
                  />
                  {ghost ? (
                    milestoneGhost ? (
                      <div
                        aria-hidden="true"
                        data-slot="gantt-chart-ghost"
                        className={cn(
                          "pointer-events-none absolute z-30 rotate-45 rounded-[3px] ring-2 ring-ring",
                          ganttChartToneVariants({
                            tone: row.task.tone ?? "primary",
                          }),
                          taskClassName?.({
                            task: row.task,
                            surface: "milestone",
                            selected: false,
                          }),
                        )}
                        style={{
                          left: ghostLeft - MILESTONE_SIZE / 2,
                          top: (rowHeight - MILESTONE_SIZE) / 2,
                          width: MILESTONE_SIZE,
                          height: MILESTONE_SIZE,
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        data-slot="gantt-chart-ghost"
                        className={cn(
                          "pointer-events-none absolute z-30 rounded-md ring-2 ring-ring",
                          ganttChartToneVariants({
                            tone: row.task.tone ?? "primary",
                          }),
                          taskClassName?.({
                            task: row.task,
                            surface: "bar",
                            selected: false,
                          }),
                        )}
                        style={{
                          left: ghostLeft,
                          top: BAR_INSET,
                          height: rowHeight - BAR_INSET * 2,
                          width: ghostWidth,
                        }}
                      />
                    )
                  ) : null}
                  {confirming && pendingMove ? (
                    <div
                      data-slot="gantt-chart-move-confirm"
                      className="absolute z-50"
                      style={{
                        left: clamp(
                          ghostLeft,
                          0,
                          Math.max(
                            timelineWidth - CONFIRM_CARD_CLEARANCE_PX,
                            0,
                          ),
                        ),
                        top: rowHeight - 2,
                      }}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === "Escape") {
                          keyEvent.stopPropagation()
                          cancelPendingMove()
                        }
                      }}
                    >
                      {(renderMoveConfirm ?? ((context) => (
                        <DefaultMoveConfirm context={context} />
                      )))({
                        task: pendingMove.task,
                        range: {
                          start: pendingMove.start,
                          end: pendingMove.end,
                        },
                        dependentTaskIds:
                          differenceInCalendarDays(
                            pendingMove.end,
                            pendingMove.task.end,
                          ) !== 0
                            ? dependentIdsOf(pendingMove.task.id)
                            : [],
                        confirm: confirmPendingMove,
                        cancel: cancelPendingMove,
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export {
  GanttChart,
  GanttChartGrid,
  GanttChartToolbar,
  ganttChartToneVariants,
}
