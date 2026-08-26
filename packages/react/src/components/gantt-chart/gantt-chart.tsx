"use client"

/** @responsibility The Gantt chart's root: task, scale, collapse, selection and pending-move state, the dependency cascade, timeline range and scrolling, plus the toolbar that drives them. */

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "../button"
import { SegmentedControl, SegmentedControlOption } from "../segmented-control"
import {
  GanttChartContext,
  SCALE_DAY_WIDTH,
  flattenTasks,
  ganttChartDefaultLabels,
  useGanttChart,
  type GanttChartContextValue,
  type GanttChartLabels,
  type GanttChartMoveConfirmContext,
  type DraftRange,
  type GanttChartDependencyRef,
  type GanttChartQuickCreateContext,
  type GanttChartScale,
  type GanttChartTaskRenderContext,
  type GanttRow,
  type LinkSession,
  type PendingMove,
  type ResolvedGanttChartColumn,
} from "./gantt-chart-context"
import {
  DEFAULT_SHORTCUTS,
  isEditableShortcutTarget,
  matchesShortcut,
  type GanttChartKeyboardShortcut,
  type GanttChartShortcutAction,
  type GanttChartShortcuts,
  type ResolvedShortcuts,
} from "./gantt-chart-shortcuts"
import {
  WEEK_LENGTH,
  addDays,
  cascadeShiftDays,
  dependencyViolations,
  dependentTaskIds,
  differenceInCalendarDays,
  ganttChartCriticalTaskIds,
  isSummaryTask,
  resolveDependency,
  startOfDay,
  startOfWeek,
  taskDependencies,
  wouldCreateDependencyCycle,
  type GanttChartDependencyType,
  type GanttChartRange,
  type GanttChartTask,
} from "./gantt-chart-scheduling"

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
   * Whether a committed move or resize also carries the tasks that
   * depend on it, following each relation from the predecessor edge that
   * drives it — so a whole-task move slides the chain, an end-only resize
   * pushes the finish-driven links, and a start-only resize pushes the
   * start-driven ones. Off by default so dependency arrows stay purely
   * visual.
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
  /**
   * Whether the chart's dependency editing is available: bars carry link
   * handles that draw a new relation when dragged onto another task, and
   * arrows become focusable so they can be selected and deleted. Off by
   * default, so a read-only plan stays read-only and its arrows add no
   * tab stops.
   */
  linkable?: boolean
  /** Controlled critical-path highlighting. */
  showCriticalPath?: boolean
  /** Initial critical-path highlighting when uncontrolled. Defaults to false. */
  defaultShowCriticalPath?: boolean
  onShowCriticalPathChange?: (show: boolean) => void
  /** Fires with the link a completed drag or keyboard gesture created. */
  onDependencyCreate?: (dependency: GanttChartDependencyRef) => void
  /** Fires with the link a Delete on a selected arrow removed. */
  onDependencyDelete?: (dependency: GanttChartDependencyRef) => void
  /** Fires when an arrow is activated. */
  onDependencySelect?: (dependency: GanttChartDependencyRef) => void
  /**
   * The relation a new link is created with. Defaults to
   * `"finish-to-start"` whichever handle the drag left from; hosts that
   * want the industry edge mapping (a drag off the start handle making a
   * start-to-start link, say) read `fromEdge` and return the type they
   * want.
   */
  dependencyTypeForNewLink?: (context: {
    predecessor: GanttChartTask
    successor: GanttChartTask
    /** Which edge of the predecessor the link was drawn from. */
    fromEdge: "start" | "finish"
  }) => GanttChartDependencyType
  /**
   * Renders the host's own quick-create UI, positioned at a completed
   * drag across an empty stretch of a lane. Pointer-only for now — there
   * is no keyboard route to open a draft yet. The chart owns the gesture,
   * placement, Escape handling, and focus return; the host owns every
   * pixel of the card and resolves it through the context's
   * `createTask`/`cancel`. Omit to render nothing — the draft then just
   * stays highlighted and `onSelectRange` is the only signal.
   */
  renderQuickCreate?: (
    context: GanttChartQuickCreateContext,
  ) => React.ReactNode
  /** Fires when a drag across an empty lane completes. */
  onSelectRange?: (range: GanttChartRange) => void
  /** Fires with each task added through a quick-create `createTask`. */
  onCreateTask?: (task: GanttChartTask) => void
  /**
   * Extra columns shown in the task list beside the name. Each is given a
   * width and a renderer; the built-in `ganttChartDateColumns` covers the
   * usual start/finish/duration trio.
   */
  columns?: GanttChartColumn[]
}

/** One host-defined column of the task list. */
export interface GanttChartColumn {
  /** Stable key, also used for the React key. */
  key: string
  /** Column heading. */
  header: string
  /** Rendered width in pixels. Defaults to 96. */
  width?: number
  /** Text alignment inside the cell. Defaults to `"start"`. */
  align?: "start" | "end"
  /** Renders one cell. Omit to show the task's own `meta[key]`. */
  render?: (task: GanttChartTask, row: GanttRow) => React.ReactNode
}

/**
 * The usual start / finish / duration columns, formatted for a locale.
 * Pass the result (or a slice of it) to the chart's `columns` prop.
 */
export function ganttChartDateColumns(
  locale?: string,
  headers: { start?: string; finish?: string; duration?: string } = {},
): GanttChartColumn[] {
  const format = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  })
  return [
    {
      key: "start",
      header: headers.start ?? "Start",
      width: 84,
      render: (_task, row) => format.format(row.span.start),
    },
    {
      key: "finish",
      header: headers.finish ?? "Finish",
      width: 84,
      render: (_task, row) =>
        format.format(
          row.milestone ? row.span.end : addDays(row.span.end, -1),
        ),
    },
    {
      key: "duration",
      header: headers.duration ?? "Days",
      width: 56,
      align: "end",
      render: (_task, row) =>
        differenceInCalendarDays(row.span.end, row.span.start) || 0,
    },
  ]
}

/** Produces a collision-safe identity for a quick-created task. */
function createTaskId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `task-${uuid ?? Math.random().toString(36).slice(2)}`
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
  linkable = false,
  showCriticalPath: showCriticalPathProp,
  defaultShowCriticalPath = false,
  onShowCriticalPathChange,
  onDependencyCreate,
  onDependencyDelete,
  onDependencySelect,
  dependencyTypeForNewLink,
  renderQuickCreate,
  onSelectRange,
  onCreateTask,
  columns: columnsProp,
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

  const dependentIdsOf = React.useCallback(
    (taskId: string) => dependentTaskIds(tasks, taskId),
    [tasks],
  )

  /**
   * The day each dependent slides by for a proposed move — the single
   * derivation the commit applies and the confirmation UI reports, so the
   * two can never disagree about what a cascade would touch.
   */
  const shiftsFor = React.useCallback(
    (task: GanttChartTask, start: Date, end: Date) =>
      cascadeShiftDays(
        tasks,
        task.id,
        differenceInCalendarDays(start, task.start),
        differenceInCalendarDays(end, task.end),
      ),
    [tasks],
  )

  const shiftedIdsFor = React.useCallback(
    (move: { task: GanttChartTask; start: Date; end: Date }) => [
      ...shiftsFor(move.task, move.start, move.end).keys(),
    ],
    [shiftsFor],
  )

  const commitMove = (
    task: GanttChartTask,
    start: Date,
    end: Date,
    cascade: boolean = moveDependents,
  ) => {
    const moved = { ...task, start, end }
    // Each relation follows the predecessor edge that drives it, so a
    // whole-task move slides the chain by one delta while an end-only
    // resize pushes just the links hanging off the finish.
    const shifts = cascade
      ? shiftsFor(task, start, end)
      : new Map<string, number>()
    const next = tasks.map((candidate) => {
      if (candidate.id === task.id) return moved
      const shift = shifts.get(candidate.id)
      if (!shift) return candidate
      return {
        ...candidate,
        start: addDays(candidate.start, shift),
        end: addDays(candidate.end, shift),
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

  const [uncontrolledShowCriticalPath, setUncontrolledShowCriticalPath] =
    React.useState(defaultShowCriticalPath)
  const showCriticalPath =
    showCriticalPathProp ?? uncontrolledShowCriticalPath
  const setShowCriticalPath = (show: boolean) => {
    if (showCriticalPathProp === undefined) {
      setUncontrolledShowCriticalPath(show)
    }
    onShowCriticalPathChange?.(show)
  }

  // Float is a whole-plan derivation, so it is computed once per task list
  // rather than per row; the highlight only decides whether to show it.
  const criticalTaskIds = React.useMemo(
    () => ganttChartCriticalTaskIds(tasks),
    [tasks],
  )

  const violationBySuccessor = React.useMemo(() => {
    const bySuccessor = new Map<string, Map<string, number>>()
    for (const violation of dependencyViolations(tasks)) {
      const byPredecessor =
        bySuccessor.get(violation.successorId) ?? new Map<string, number>()
      byPredecessor.set(violation.predecessorId, violation.days)
      bySuccessor.set(violation.successorId, byPredecessor)
    }
    return bySuccessor
  }, [tasks])

  const [linkSession, setLinkSession] = React.useState<LinkSession | null>(
    null,
  )
  const [selectedDependency, setSelectedDependency] =
    React.useState<GanttChartDependencyRef | null>(null)

  const canLinkTo = React.useCallback(
    (successorId: string) => {
      if (!linkSession) return false
      const { predecessorId } = linkSession
      if (wouldCreateDependencyCycle(tasks, predecessorId, successorId)) {
        return false
      }
      // A relation that already exists is not offered a second time.
      const successor = tasks.find((task) => task.id === successorId)
      if (!successor) return false
      // A summary's dates roll up from its children, so it has nothing of
      // its own for a relation to constrain.
      if (isSummaryTask(successor, tasks)) return false
      return !taskDependencies(successor).some(
        (dependency) => dependency.taskId === predecessorId,
      )
    },
    [linkSession, tasks],
  )

  const beginLink = (session: LinkSession) => {
    setSelectedDependency(null)
    setLinkSession(session)
  }

  const updateLink = (patch: Partial<LinkSession>) => {
    setLinkSession((current) => (current ? { ...current, ...patch } : current))
  }

  const cancelLink = () => setLinkSession(null)

  const completeLink = (successorId: string) => {
    const session = linkSession
    setLinkSession(null)
    if (!session || !canLinkTo(successorId)) return
    const predecessor = tasks.find((task) => task.id === session.predecessorId)
    const successor = tasks.find((task) => task.id === successorId)
    if (!predecessor || !successor) return
    const type =
      dependencyTypeForNewLink?.({
        predecessor,
        successor,
        fromEdge: session.fromEdge,
      }) ?? "finish-to-start"
    const next = tasks.map((task) =>
      task.id === successorId
        ? {
            ...task,
            dependsOn: [
              ...(task.dependsOn ?? []),
              type === "finish-to-start"
                ? session.predecessorId
                : { taskId: session.predecessorId, type },
            ],
          }
        : task,
    )
    if (tasksProp === undefined) setUncontrolledTasks(next)
    onTasksChange?.(next)
    onDependencyCreate?.({
      predecessorId: session.predecessorId,
      successorId,
    })
  }

  const deleteDependency = (dependency: GanttChartDependencyRef) => {
    const next = tasks.map((task) => {
      if (task.id !== dependency.successorId) return task
      const remaining = (task.dependsOn ?? []).filter(
        (entry) =>
          resolveDependency(entry).taskId !== dependency.predecessorId,
      )
      return { ...task, dependsOn: remaining }
    })
    setSelectedDependency(null)
    if (tasksProp === undefined) setUncontrolledTasks(next)
    onTasksChange?.(next)
    onDependencyDelete?.(dependency)
  }

  const [draft, setDraft] = React.useState<DraftRange | null>(null)

  const openDraft = (next: DraftRange) => {
    setDraft(next)
    onSelectRange?.({ start: next.start, end: next.end })
  }

  const cancelDraft = () => setDraft(null)

  const createFromDraft = (
    details?: Partial<Omit<GanttChartTask, "id" | "start" | "end">>,
  ) => {
    if (!draft) return
    const parent = draft.rowTaskId
      ? tasks.find((task) => task.id === draft.rowTaskId)
      : undefined
    const created: GanttChartTask = {
      id: createTaskId(),
      name: labels.untitledTask,
      // A task drawn inside a group joins it; one drawn on a group's own
      // lane becomes its child rather than a sibling of the group.
      parentId: parent
        ? isSummaryTask(parent, tasks)
          ? parent.id
          : parent.parentId
        : undefined,
      ...details,
      start: draft.start,
      end: draft.end,
    }
    const next = [...tasks, created]
    setDraft(null)
    if (tasksProp === undefined) setUncontrolledTasks(next)
    onTasksChange?.(next)
    onCreateTask?.(created)
  }

  const columns = React.useMemo<ResolvedGanttChartColumn[]>(
    () =>
      (columnsProp ?? []).map((column) => ({
        key: column.key,
        header: column.header,
        width: column.width ?? 96,
        align: column.align ?? "start",
        render:
          column.render ??
          ((task) => (task.meta?.[column.key] as React.ReactNode) ?? null),
      })),
    [columnsProp],
  )

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
    shiftedIdsFor,
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
    criticalTaskIds,
    showCriticalPath,
    setShowCriticalPath,
    violationBySuccessor,
    linkable,
    linkSession,
    beginLink,
    updateLink,
    completeLink,
    cancelLink,
    selectedDependency,
    selectDependency: setSelectedDependency,
    onDependencySelect,
    deleteDependency,
    canLinkTo,
    renderQuickCreate,
    draft,
    openDraft,
    createFromDraft,
    cancelDraft,
    columns,
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
    showCriticalPath,
    setShowCriticalPath,
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
      <Button
        variant={showCriticalPath ? "secondary" : "ghost"}
        size="sm"
        className="ms-auto h-7"
        data-slot="gantt-chart-critical-path-toggle"
        aria-pressed={showCriticalPath}
        onClick={() => setShowCriticalPath(!showCriticalPath)}
      >
        {labels.criticalPath}
      </Button>
      <SegmentedControl
        aria-label={labels.scale}
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

export { GanttChart, GanttChartToolbar }
