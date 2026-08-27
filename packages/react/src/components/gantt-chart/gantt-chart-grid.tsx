"use client"

/** @responsibility The Gantt chart's scrollable body: the pinned task list, two-tier time header, task bars, milestones and summary brackets, dependency arrows, the drag and keyboard rescheduling gestures, and the move-confirmation slot. */

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "../button"
import { PopoverSurface } from "../popover-surface"
import {
  TimelineHeader,
  TimelineHeaderCell,
} from "../timeline-header"
import {
  BAR_INSET,
  CONFIRM_CARD_CLEARANCE_PX,
  HEADER_HEIGHT,
  MILESTONE_SIZE,
  MOVE_THRESHOLD_PX,
  PRIMARY_TIER_HEIGHT,
  TASK_LIST_MAX_WIDTH,
  TASK_LIST_MIN_WIDTH,
  fineCells,
  formatDayLabel,
  ganttChartToneVariants,
  monthCells,
  useGanttChart,
  yearCells,
  type GanttChartLabels,
  type GanttChartMoveConfirmContext,
  type GanttChartTaskRenderContext,
  type GanttRow,
} from "./gantt-chart-context"
import {
  barShortcutHints,
  matchesShortcut,
  type GanttChartKeyboardShortcut,
  type ResolvedShortcuts,
} from "./gantt-chart-shortcuts"
import {
  addDays,
  clamp,
  dependencyEdges,
  differenceInCalendarDays,
  isWeekend,
  startOfDay,
  taskDependencies,
  type GanttChartRange,
  type GanttChartTask,
} from "./gantt-chart-scheduling"

/**
 * Inset focus outline shared by the grid's interactive layers. Everything
 * sits inside the scrolling timeline, so every outline draws inward where
 * the overflow edges cannot swallow it. Kept in this module because a
 * governed class surface must be readable where it is rendered.
 */
const insetFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

/** Token-driven hover/selection transition shared by grid surfaces. */
const surfaceTransitionClassName =
  "transition-[background-color,color,border-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"

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
  /** The pointer that owns this gesture; others are ignored. */
  pointerId: number
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
    criticalTaskIds,
    showCriticalPath,
    linkable,
    linkSession,
    beginLink,
    updateLink,
    completeLink,
    cancelLink,
    canLinkTo,
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
  const critical = showCriticalPath && criticalTaskIds.has(task.id)
  // While a link is looking for its target, every bar that could take it
  // becomes a drop zone and the rest read as unavailable.
  const linking = Boolean(linkSession)
  const linkTarget = linking && canLinkTo(task.id)
  const linkSource = linkSession?.predecessorId === task.id

  const sharedButtonProps = {
    type: "button" as const,
    "data-task-id": task.id,
    "data-tone": tone,
    "data-moving": moving || undefined,
    "data-selected": (selectable && selected) || undefined,
    "data-critical": critical || undefined,
    "data-link-target": linkTarget || undefined,
    "aria-pressed": selectable ? selected : undefined,
    "aria-label": `${label}${critical ? labels.criticalTask : ""}`,
    onKeyDown: (keyEvent: React.KeyboardEvent<HTMLButtonElement>) => {
      // A link waiting for its target takes Enter before anything else.
      if (linkSession?.keyboard && keyEvent.key === "Enter" && linkTarget) {
        keyEvent.preventDefault()
        keyEvent.stopPropagation()
        completeLink(task.id)
        return
      }
      if (linkSession && keyEvent.key === "Escape") {
        keyEvent.stopPropagation()
        cancelLink()
        return
      }
      handleKeyDown(keyEvent)
    },
    onPointerEnter: () => {
      if (linking) updateLink({ targetId: linkTarget ? task.id : null })
    },
    onPointerLeave: () => {
      if (linking && linkSession?.targetId === task.id) {
        updateLink({ targetId: null })
      }
    },
    onBlur: () => {
      if (barPending?.stage === "adjusting") cancelPendingMove()
    },
    onClick: (domEvent: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      if (linkSession?.keyboard) {
        if (linkTarget) completeLink(task.id)
        else cancelLink()
        return
      }
      if (selectable) selectTask(task.id)
      onTaskSelect?.(task, domEvent)
    },
  }

  /**
   * The two link handles, drawn just outside a bar's edges. They are real
   * buttons so the gesture has a keyboard path: activating one opens a
   * link that the next task activated closes.
   */
  const linkHandles =
    linkable && !row.summary ? (
      <>
        {(["start", "finish"] as const).map((edge) => {
          const anchor = row.milestone
            ? left + (edge === "start" ? -MILESTONE_SIZE : MILESTONE_SIZE / 2)
            : edge === "start"
              ? left - 10
              : left + width
          return (
            <button
              key={edge}
              type="button"
              data-slot="gantt-chart-link-handle"
              data-task-id={task.id}
              data-edge={edge}
              data-active={
                (linkSource && linkSession?.fromEdge === edge) || undefined
              }
              aria-label={labels.linkFrom(
                task.name,
                edge === "start" ? labels.linkEdgeStart : labels.linkEdgeFinish,
              )}
              title={labels.linkFrom(
                task.name,
                edge === "start" ? labels.linkEdgeStart : labels.linkEdgeFinish,
              )}
              className={cn(
                "absolute z-10 size-2.5 rounded-full border border-background bg-muted-foreground opacity-0 hover:bg-foreground",
                "group-hover/lane:opacity-100 focus-visible:opacity-100 data-[active=true]:opacity-100",
                surfaceTransitionClassName,
                insetFocusClassName,
              )}
              style={{ left: anchor, top: rowHeight / 2 - 5 }}
              onPointerDown={(pointerEvent) => {
                if (pointerEvent.button !== 0) return
                if (pointerEvent.pointerType === "touch") return
                // No pointer capture: the drag needs enter/leave events on
                // the bars it passes over to find its drop target.
                pointerEvent.stopPropagation()
                beginLink({
                  predecessorId: task.id,
                  fromEdge: edge,
                  pointer: null,
                  targetId: null,
                  keyboard: false,
                  pointerId: pointerEvent.pointerId,
                })
              }}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                // A plain activation (keyboard, or a click that never
                // dragged) opens the link and waits for a target.
                if (!linkSession) {
                  beginLink({
                    predecessorId: task.id,
                    fromEdge: edge,
                    pointer: null,
                    targetId: null,
                    keyboard: true,
                    pointerId: null,
                  })
                }
              }}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Escape" && linkSession) {
                  keyEvent.stopPropagation()
                  cancelLink()
                }
              }}
            />
          )
        })}
      </>
    ) : null

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
                critical
                  ? "bg-destructive"
                  : ganttChartToneVariants({ tone }),
              )}
            />
            <span
              className={cn(
                "absolute -bottom-1 left-0 size-2 rounded-[2px] border-none",
                critical
                  ? "bg-destructive"
                  : ganttChartToneVariants({ tone }),
              )}
            />
            <span
              className={cn(
                "absolute -bottom-1 right-0 size-2 rounded-[2px] border-none",
                critical
                  ? "bg-destructive"
                  : ganttChartToneVariants({ tone }),
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
            critical && "ring-2 ring-destructive ring-offset-1 ring-offset-background",
            linkTarget && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            linking && !linkTarget && !linkSource && "opacity-40",
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
        {linkHandles}
      </>
    )
  }

  return (
    <>
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
        critical && "ring-2 ring-destructive ring-offset-1 ring-offset-background",
        linkTarget && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        linking && !linkTarget && !linkSource && "opacity-40",
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
      {linkHandles}
    </>
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

/** Stub length before an arrow turns away from the bar it leaves. */
const ARROW_STUB_PX = 8
/** Gap left between an arrowhead's tip and the bar edge it points at. */
const ARROW_GAP_PX = 5

/**
 * Routes one relation as an elbowed path. `exitDir` is the direction the
 * arrow leaves the predecessor in and `enterDir` the direction it travels
 * as it arrives, both taken from which edges the relation ties together —
 * so the same router draws all four types, and the arrowhead's
 * `orient="auto"` turns itself to match.
 */
export function dependencyPath({
  fromX,
  fromY,
  toX,
  toY,
  exitDir,
  enterDir,
  rowHeight,
  gap = ARROW_GAP_PX,
}: {
  fromX: number
  fromY: number
  toX: number
  toY: number
  exitDir: 1 | -1
  enterDir: 1 | -1
  rowHeight: number
  /** Distance left between the arrow's tip and the edge it points at. */
  gap?: number
}) {
  const endX = toX - enterDir * gap
  const outX = fromX + exitDir * ARROW_STUB_PX
  const approachX = endX - enterDir * ARROW_STUB_PX
  const hasRoom = enterDir === 1 ? outX <= approachX : outX >= approachX
  if (hasRoom) {
    // Out, across, and straight in.
    return `M ${fromX} ${fromY} H ${outX} V ${toY} H ${endX}`
  }
  // The target sits behind the arrow's exit: run out, drop to the boundary
  // between the two rows, travel back past the target, then come in.
  const midY = fromY + (toY > fromY ? rowHeight / 2 : -rowHeight / 2)
  return `M ${fromX} ${fromY} H ${outX} V ${midY} H ${approachX} V ${toY} H ${endX}`
}

/**
 * Dependency arrows, drawn under the bars and routed by relation type.
 * Arrows whose endpoint rows are hidden inside a collapsed summary simply
 * stay off the canvas until the rows return. A relation the current dates
 * violate draws dashed, and one on the critical path draws in the
 * critical treatment while `showCriticalPath` is on.
 */
function DependencyLayer() {
  const {
    rows,
    range,
    dayWidth,
    rowHeight,
    labels,
    criticalTaskIds,
    showCriticalPath,
    violationBySuccessor,
    selectedDependency,
    selectDependency,
    onDependencySelect,
    linkable,
  } = useGanttChart("GanttChartGrid")
  // Instance-scoped marker ids so several charts on one page never collide.
  const baseId = React.useId()
  const markerId = `${baseId}-arrowhead`
  const criticalMarkerId = `${baseId}-arrowhead-critical`
  const rowIndexById = new Map(rows.map((row, index) => [row.task.id, index]))

  /** The x of one edge of a row's shape, diamonds included. */
  const edgeX = (row: GanttRow, edge: "start" | "finish") => {
    const day = edge === "start" ? row.span.start : row.span.end
    const x = differenceInCalendarDays(day, range.start) * dayWidth
    if (!row.milestone) return x
    return edge === "start" ? x - MILESTONE_SIZE / 2 : x + MILESTONE_SIZE / 2
  }

  const arrows: Array<{
    key: string
    d: string
    predecessorId: string
    successorId: string
    label: string
    violated: boolean
    critical: boolean
  }> = []

  for (const row of rows) {
    const toIndex = rowIndexById.get(row.task.id)
    if (toIndex === undefined) continue
    const violations = violationBySuccessor.get(row.task.id)
    for (const dependency of taskDependencies(row.task)) {
      const fromIndex = rowIndexById.get(dependency.taskId)
      if (fromIndex === undefined) continue
      const from = rows[fromIndex]
      const { from: fromEdge, to: toEdge } = dependencyEdges(dependency.type)
      const critical =
        showCriticalPath &&
        criticalTaskIds.has(dependency.taskId) &&
        criticalTaskIds.has(row.task.id)
      const violatedDays = violations?.get(dependency.taskId) ?? 0
      arrows.push({
        key: `${dependency.taskId}->${row.task.id}-${dependency.type}`,
        d: dependencyPath({
          fromX: edgeX(from, fromEdge),
          fromY: fromIndex * rowHeight + rowHeight / 2,
          toX: edgeX(row, toEdge),
          toY: toIndex * rowHeight + rowHeight / 2,
          exitDir: fromEdge === "finish" ? 1 : -1,
          enterDir: toEdge === "start" ? 1 : -1,
          rowHeight,
        }),
        predecessorId: dependency.taskId,
        successorId: row.task.id,
        label: (() => {
          const base = labels.dependency(
            from.task.name,
            row.task.name,
            labels.dependencyType(dependency.type),
            dependency.lagDays,
          )
          return violatedDays
            ? `${base}.${labels.dependencyViolated(violatedDays)}`
            : base
        })(),
        violated: violatedDays > 0,
        critical,
      })
    }
  }

  if (!arrows.length) return null

  return (
    <svg
      data-slot="gantt-chart-dependencies"
      className="pointer-events-none absolute top-0 overflow-visible"
      style={{
        left: 0,
        width: differenceInCalendarDays(range.end, range.start) * dayWidth,
        height: rows.length * rowHeight,
      }}
    >
      <defs>
        {[
          { id: markerId, className: "fill-muted-foreground" },
          { id: criticalMarkerId, className: "fill-destructive" },
        ].map((marker) => (
          <marker
            key={marker.id}
            id={marker.id}
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 Z" className={marker.className} />
          </marker>
        ))}
      </defs>
      {arrows.map((arrow) => {
        const selected =
          selectedDependency?.predecessorId === arrow.predecessorId &&
          selectedDependency?.successorId === arrow.successorId
        const attention = arrow.violated || arrow.critical
        return (
          <g
            key={arrow.key}
            data-slot="gantt-chart-dependency"
            data-predecessor-id={arrow.predecessorId}
            data-successor-id={arrow.successorId}
            data-violated={arrow.violated || undefined}
            data-critical={arrow.critical || undefined}
            data-selected={selected || undefined}
          >
            <path
              role={linkable ? undefined : "img"}
              aria-label={linkable ? undefined : arrow.label}
              d={arrow.d}
              fill="none"
              strokeWidth="1.5"
              strokeDasharray={arrow.violated ? "4 3" : undefined}
              className={cn(
                attention ? "stroke-destructive" : "stroke-muted-foreground",
                selected && "stroke-[2.5]",
              )}
              markerEnd={`url(#${arrow.critical ? criticalMarkerId : markerId})`}
            />
            {/* A fat transparent copy makes the hairline easy to hit and
                carries the button semantics; the drawn path stays thin.
                Only an editable chart offers it, so a read-only plan adds
                no tab stops. */}
            {linkable ? (
            <path
              role="button"
              tabIndex={0}
              aria-label={arrow.label}
              aria-pressed={selected}
              d={arrow.d}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
              className="[pointer-events:stroke] cursor-pointer outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              onClick={() => {
                selectDependency({
                  predecessorId: arrow.predecessorId,
                  successorId: arrow.successorId,
                })
                onDependencySelect?.({
                  predecessorId: arrow.predecessorId,
                  successorId: arrow.successorId,
                })
              }}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                  keyEvent.preventDefault()
                  selectDependency({
                    predecessorId: arrow.predecessorId,
                    successorId: arrow.successorId,
                  })
                }
              }}
            />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The line a pointer link drags behind it, from the handle it left to
 * wherever the cursor is. Purely decorative — the drop itself is decided
 * by whichever bar reported itself as the target.
 */
function LinkRubberBand() {
  const { rows, range, dayWidth, rowHeight, linkSession } =
    useGanttChart("GanttChartGrid")
  if (!linkSession?.pointer) return null
  const fromIndex = rows.findIndex(
    (row) => row.task.id === linkSession.predecessorId,
  )
  if (fromIndex === -1) return null
  const from = rows[fromIndex]
  const day =
    linkSession.fromEdge === "start" ? from.span.start : from.span.end
  const fromX =
    differenceInCalendarDays(day, range.start) * dayWidth +
    (from.milestone
      ? (linkSession.fromEdge === "start" ? -1 : 1) * (MILESTONE_SIZE / 2)
      : 0)
  const fromY = fromIndex * rowHeight + rowHeight / 2

  return (
    <svg
      aria-hidden="true"
      data-slot="gantt-chart-link-band"
      className="pointer-events-none absolute top-0 overflow-visible"
      style={{
        left: 0,
        width: differenceInCalendarDays(range.end, range.start) * dayWidth,
        height: rows.length * rowHeight,
      }}
    >
      <path
        // Previewing with the same elbow router the committed arrow uses,
        // so the drag shows the shape it is about to draw rather than a
        // node-editor diagonal.
        d={dependencyPath({
          fromX,
          fromY,
          toX: linkSession.pointer.x,
          toY: linkSession.pointer.y,
          exitDir: linkSession.fromEdge === "finish" ? 1 : -1,
          enterDir: linkSession.pointer.x >= fromX ? 1 : -1,
          rowHeight,
          gap: 0,
        })}
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        className="stroke-ring"
      />
      <circle
        cx={linkSession.pointer.x}
        cy={linkSession.pointer.y}
        r="3"
        className="fill-ring"
      />
    </svg>
  )
}

/**
 * Positions the host's quick-create UI at the open draft. The wrapper owns
 * only geometry and dismissal — clamped into the timeline and closed on
 * Escape — while the rendered content comes entirely from
 * `renderQuickCreate`.
 */
function QuickCreateSlot({ rowIndex }: { rowIndex: number }) {
  const {
    range,
    dayWidth,
    rowHeight,
    totalDays,
    draft,
    renderQuickCreate,
    createFromDraft,
    cancelDraft,
  } = useGanttChart("GanttChartGrid")
  if (!draft?.open || !renderQuickCreate) return null
  const left = differenceInCalendarDays(draft.start, range.start) * dayWidth

  return (
    <div
      data-slot="gantt-chart-quick-create"
      // z-10 keeps the card above the bars but beneath the pinned task
      // cells, so it slides under the sidebar like the rest of the
      // timeline instead of painting over it.
      className="absolute z-10"
      style={{
        left: clamp(
          left,
          0,
          Math.max(totalDays * dayWidth - CONFIRM_CARD_CLEARANCE_PX, 0),
        ),
        top: rowIndex * rowHeight + rowHeight - 2,
      }}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Escape") {
          keyEvent.stopPropagation()
          cancelDraft()
        }
      }}
    >
      {renderQuickCreate({
        range: { start: draft.start, end: draft.end },
        createTask: createFromDraft,
        cancel: cancelDraft,
      })}
    </div>
  )
}

export interface GanttChartGridProps extends React.ComponentProps<"div"> {}

/**
 * The chart's scrollable body: the pinned task list, the two-tier time
 * header, one lane per visible task, dependency arrows, weekend shading,
 * and the today marker. Fills whatever box the host gives the chart —
 * size the `GanttChart` (or a parent) and the grid takes the height left
 * after the toolbar and scrolls both axes inside it; leave the chart
 * unsized and it simply grows with its rows.
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
    shiftedIdsFor,
    pendingMove,
    requestMove,
    confirmPendingMove,
    cancelPendingMove,
    renderMoveConfirm,
    taskClassName,
    scrollerRef,
    scrollToDate,
    linkSession,
    updateLink,
    completeLink,
    cancelLink,
    selectedDependency,
    selectDependency,
    deleteDependency,
    linkable,
    renderQuickCreate,
    draft,
    adjustDraft,
    openDraft,
    createFromDraft,
    cancelDraft,
    columns,
    setTaskListWidth,
  } = useGanttChart("GanttChartGrid")

  const timelineWidth = totalDays * dayWidth
  const canvasRef = React.useRef<HTMLDivElement>(null)

  /** Pointer position in the canvas's own coordinates. */
  const canvasPoint = React.useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left - taskListWidth, y: clientY - rect.top }
  }, [taskListWidth])

  // A pointer-driven link tracks the cursor for its rubber band and
  // settles on whichever bar reported itself as the target.
  const linkSessionRef = React.useRef(linkSession)
  React.useEffect(() => {
    linkSessionRef.current = linkSession
  })
  const pointerLinking = Boolean(linkSession && !linkSession.keyboard)
  React.useEffect(() => {
    if (!pointerLinking) return

    const handleMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== linkSessionRef.current?.pointerId) return
      // A pointerup lost to an alt-tab or context menu would otherwise
      // leave the band glued to the cursor for good.
      if (pointerEvent.buttons === 0) {
        cancelLink()
        return
      }
      updateLink({
        pointer: canvasPoint(pointerEvent.clientX, pointerEvent.clientY),
      })
    }
    const ownsPointer = (pointerEvent: PointerEvent) =>
      pointerEvent.pointerId === linkSessionRef.current?.pointerId
    const handleUp = (pointerEvent: PointerEvent) => {
      if (!ownsPointer(pointerEvent)) return
      const session = linkSessionRef.current
      if (session?.targetId) completeLink(session.targetId)
      else cancelLink()
    }
    const handleCancel = (pointerEvent: PointerEvent) => {
      if (ownsPointer(pointerEvent)) cancelLink()
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleCancel)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
    }
  }, [pointerLinking, updateLink, completeLink, cancelLink, canvasPoint])

  // Initial position only: later date or scale changes keep the user's
  // own scroll, with the Today button as the way back.
  const initialScrollDone = React.useRef(false)
  React.useEffect(() => {
    if (initialScrollDone.current) return
    initialScrollDone.current = true
    scrollToDate(now)
  }, [scrollToDate, now])

  // The lanes' keyboard entry point: one roving tab stop, arrows to pick
  // days, Enter to open the host's card — the calendar's day-surface
  // pattern laid on its side. Only offered while quick-create exists.
  const [focusedLane, setFocusedLane] = React.useState(0)
  const activeLane = clamp(focusedLane, 0, Math.max(rows.length - 1, 0))

  const focusLane = (index: number) => {
    const surfaces = canvasRef.current?.querySelectorAll<HTMLElement>(
      '[data-slot="gantt-chart-lane-surface"]',
    )
    surfaces?.[index]?.focus()
  }

  /** Today's day index, clamped into the range — the cursor's home. */
  const homeDay = clamp(
    differenceInCalendarDays(now, range.start),
    0,
    totalDays - 1,
  )

  const handleLaneKeyDown = (
    keyEvent: React.KeyboardEvent<HTMLDivElement>,
    row: GanttRow,
    rowIndex: number,
  ) => {
    const rowDraft =
      draft && !draft.open && draft.rowTaskId === row.task.id ? draft : null
    const startDay = rowDraft
      ? differenceInCalendarDays(rowDraft.start, range.start)
      : null

    if (keyEvent.key === "ArrowUp" || keyEvent.key === "ArrowDown") {
      keyEvent.preventDefault()
      const next = clamp(
        rowIndex + (keyEvent.key === "ArrowDown" ? 1 : -1),
        0,
        rows.length - 1,
      )
      if (next !== rowIndex) {
        setFocusedLane(next)
        focusLane(next)
      }
      return
    }
    if (keyEvent.key === "ArrowLeft" || keyEvent.key === "ArrowRight") {
      keyEvent.preventDefault()
      const direction = keyEvent.key === "ArrowRight" ? 1 : -1
      if (keyEvent.shiftKey && rowDraft && startDay !== null) {
        // Shift grows or shrinks the selection's end, never below a day.
        const days = differenceInCalendarDays(rowDraft.end, rowDraft.start)
        const nextDays = clamp(days + direction, 1, totalDays - startDay)
        adjustDraft({
          ...rowDraft,
          end: addDays(rowDraft.start, nextDays),
        })
        return
      }
      const nextStart =
        startDay === null
          ? homeDay
          : clamp(startDay + direction, 0, totalDays - 1)
      adjustDraft({
        rowTaskId: row.task.id,
        start: addDays(range.start, nextStart),
        end: addDays(range.start, nextStart + 1),
        open: false,
      })
      return
    }
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault()
      // Enter opens the card over the chosen days — or over today when
      // pressed before any arrows moved the cursor.
      openDraft(
        rowDraft
          ? { ...rowDraft, open: true }
          : {
              rowTaskId: row.task.id,
              start: addDays(range.start, homeDay),
              end: addDays(range.start, homeDay + 1),
              open: true,
            },
      )
      return
    }
    if (keyEvent.key === "Escape" && rowDraft) {
      keyEvent.stopPropagation()
      cancelDraft()
    }
  }

  // A drag across empty lane background proposes a new task's dates.
  const [draftSession, setDraftSession] = React.useState<{
    rowTaskId: string | null
    /** The pointer that owns this gesture; others are ignored. */
    pointerId: number
    anchorDay: number
    startDay: number
    endDay: number
  } | null>(null)
  const draftSessionRef = React.useRef(draftSession)
  React.useEffect(() => {
    draftSessionRef.current = draftSession
  })

  /** The day index under a client x, clamped into the rendered range. */
  const dayIndexAt = React.useCallback(
    (clientX: number) => {
      const point = canvasPoint(clientX, 0)
      if (!point) return 0
      return clamp(Math.floor(point.x / dayWidth), 0, totalDays - 1)
    },
    [canvasPoint, dayWidth, totalDays],
  )

  const beginDraft = (
    pointerEvent: React.PointerEvent<HTMLDivElement>,
    row: GanttRow,
  ) => {
    const day = dayIndexAt(pointerEvent.clientX)
    setDraftSession({
      rowTaskId: row.task.id,
      pointerId: pointerEvent.pointerId,
      anchorDay: day,
      startDay: day,
      endDay: day + 1,
    })
  }

  React.useEffect(() => {
    if (!draftSession) return

    const handleMove = (pointerEvent: PointerEvent) => {
      const session = draftSessionRef.current
      if (!session) return
      if (pointerEvent.pointerId !== session.pointerId) return
      if (pointerEvent.buttons === 0) {
        setDraftSession(null)
        return
      }
      const day = dayIndexAt(pointerEvent.clientX)
      setDraftSession({
        ...session,
        startDay: Math.min(session.anchorDay, day),
        endDay: Math.max(session.anchorDay, day) + 1,
      })
    }
    const handleUp = (pointerEvent: PointerEvent) => {
      const session = draftSessionRef.current
      if (!session || pointerEvent.pointerId !== session.pointerId) return
      setDraftSession(null)
      openDraft({
        rowTaskId: session.rowTaskId,
        start: addDays(range.start, session.startDay),
        end: addDays(range.start, session.endDay),
        open: true,
      })
    }
    const handleCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === draftSessionRef.current?.pointerId) {
        setDraftSession(null)
      }
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleCancel)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
    }
  }, [draftSession, dayIndexAt, openDraft, range.start])

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
      pointerId: pointerEvent.pointerId,
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
      if (pointerEvent.pointerId !== session.pointerId) return
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

    const handleUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === moveSessionRef.current?.pointerId) {
        settle(true)
      }
    }
    const handleCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === moveSessionRef.current?.pointerId) {
        settle(false)
      }
    }

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

  // The task-list / timeline boundary follows the SplitView separator's
  // window-splitter contract: focusable, value-reporting, resizable by
  // pointer capture or arrow keys. It rides the wrapper (not the pinned
  // cells), since the boundary never scrolls horizontally.
  const [splitterSession, setSplitterSession] = React.useState<{
    pointerId: number
    originX: number
    originWidth: number
  } | null>(null)
  // Mirrored in a ref so a move arriving before the state commit (the
  // first frame of a drag, or a synthetic test dispatch) still applies.
  const splitterSessionRef = React.useRef(splitterSession)

  const handleSplitterKeyDown = (
    keyEvent: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    const steps: Record<string, number> = {
      ArrowLeft: -16,
      ArrowRight: 16,
    }
    if (keyEvent.key in steps) {
      keyEvent.preventDefault()
      setTaskListWidth(taskListWidth + steps[keyEvent.key])
    } else if (keyEvent.key === "Home") {
      keyEvent.preventDefault()
      setTaskListWidth(TASK_LIST_MIN_WIDTH)
    } else if (keyEvent.key === "End") {
      keyEvent.preventDefault()
      setTaskListWidth(TASK_LIST_MAX_WIDTH)
    }
  }

  return (
    <div data-slot="gantt-chart-grid" className="relative min-h-0 flex-1">
    <div
      ref={scrollerRef}
      data-slot="gantt-chart-scroll"
      role="region"
      aria-label={labels.timeline}
      tabIndex={0}
      className={cn(
        "relative h-full overflow-auto overscroll-contain",
        insetFocusClassName,
        className,
      )}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Escape") {
          if (linkSession) {
            keyEvent.stopPropagation()
            cancelLink()
          } else if (selectedDependency) {
            keyEvent.stopPropagation()
            selectDependency(null)
          } else if (draft) {
            keyEvent.stopPropagation()
            cancelDraft()
          }
          return
        }
        if (
          linkable &&
          selectedDependency &&
          (keyEvent.key === "Delete" || keyEvent.key === "Backspace")
        ) {
          keyEvent.preventDefault()
          keyEvent.stopPropagation()
          deleteDependency(selectedDependency)
        }
      }}
      {...props}
    >
      <div
        ref={canvasRef}
        data-slot="gantt-chart-canvas"
        className="relative flex min-h-full min-w-full flex-col"
        style={{ width: taskListWidth + timelineWidth }}
      >
        <div
          data-slot="gantt-chart-header"
          className="sticky top-0 z-30 flex shrink-0 border-b border-border bg-background"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="sticky left-0 z-10 flex shrink-0 items-end gap-1 border-r border-border bg-background pe-3 ps-3 pb-1 text-xs font-medium text-muted-foreground"
            style={{ width: taskListWidth }}
          >
            <span className="min-w-0 flex-1 truncate">
              {labels.taskListHeader}
            </span>
            {columns.map((column) => (
              <span
                key={column.key}
                data-slot="gantt-chart-column-header"
                data-column={column.key}
                className={cn(
                  "shrink-0 truncate",
                  column.align === "end" && "text-end",
                )}
                style={{ width: column.width }}
              >
                {column.header}
              </span>
            ))}
          </div>
          <TimelineHeader
            className="shrink-0"
            style={{ width: timelineWidth }}
            aria-hidden="true"
          >
            {primaryCells.map((cell) => (
              <TimelineHeaderCell
                key={cell.key}
                start={cell.offsetDays * dayWidth}
                width={cell.days * dayWidth}
                // Pinned within its own cell, so the label stays readable
                // while any part of the month is in view.
                pinLabelInset={taskListWidth + 8}
                className="top-0 px-2 font-medium"
                style={{ height: PRIMARY_TIER_HEIGHT }}
              >
                {cell.label}
              </TimelineHeaderCell>
            ))}
            {secondaryCells.map((cell) => (
              <TimelineHeaderCell
                key={cell.key}
                start={cell.offsetDays * dayWidth}
                width={cell.days * dayWidth}
                className="bottom-0 justify-center"
                style={{ height: HEADER_HEIGHT - PRIMARY_TIER_HEIGHT }}
              >
                <span className="truncate">{cell.label}</span>
              </TimelineHeaderCell>
            ))}
          </TimelineHeader>
        </div>
        <div data-slot="gantt-chart-body" className="relative flex flex-1 flex-col">
          <div
            aria-hidden="true"
            data-slot="gantt-chart-underlay"
            className="pointer-events-none absolute inset-y-0"
            style={{ left: taskListWidth, width: timelineWidth }}
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
            <LinkRubberBand />
          </div>
          <div
            data-slot="gantt-chart-link-status"
            aria-live="polite"
            className="sr-only"
          >
            {linkSession
              ? labels.linkInProgress(
                  rows.find((row) => row.task.id === linkSession.predecessorId)
                    ?.task.name ?? "",
                )
              : ""}
          </div>
          {draft?.open ? (
            <div
              className="absolute top-0"
              style={{ left: taskListWidth }}
            >
              <QuickCreateSlot
                rowIndex={Math.max(
                  rows.findIndex((row) => row.task.id === draft.rowTaskId),
                  0,
                )}
              />
            </div>
          ) : null}
          {(() => {
            // One highlight serves all three draft states: the live drag,
            // a keyboard selection being adjusted, and an open card.
            const highlight = draftSession
              ? {
                  rowTaskId: draftSession.rowTaskId,
                  startDay: draftSession.startDay,
                  endDay: draftSession.endDay,
                }
              : draft
                ? {
                    rowTaskId: draft.rowTaskId,
                    startDay: differenceInCalendarDays(
                      draft.start,
                      range.start,
                    ),
                    endDay: differenceInCalendarDays(draft.end, range.start),
                  }
                : null
            if (!highlight) return null
            const rowIndex = rows.findIndex(
              (row) => row.task.id === highlight.rowTaskId,
            )
            if (rowIndex === -1) return null
            return (
              <div
                aria-hidden="true"
                data-slot="gantt-chart-draft"
                className="pointer-events-none absolute z-10 rounded-md border-2 border-primary bg-primary/15"
                style={{
                  left: taskListWidth + highlight.startDay * dayWidth,
                  width: (highlight.endDay - highlight.startDay) * dayWidth,
                  top: rowIndex * rowHeight + BAR_INSET,
                  height: rowHeight - BAR_INSET * 2,
                }}
              />
            )
          })()}
          {rows.map((row, rowIndex) => {
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
                className="flex shrink-0"
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
                      "min-w-0 flex-1 truncate",
                      row.summary && "font-medium",
                    )}
                  >
                    {row.task.name}
                  </span>
                  {columns.map((column) => (
                    <span
                      key={column.key}
                      data-slot="gantt-chart-task-cell-column"
                      data-column={column.key}
                      className={cn(
                        "shrink-0 truncate text-xs tabular-nums text-muted-foreground",
                        column.align === "end" && "text-end",
                      )}
                      style={{ width: column.width }}
                    >
                      {column.render(row.task, row)}
                    </span>
                  ))}
                </div>
                <div
                  data-slot="gantt-chart-lane"
                  data-task-id={row.task.id}
                  className="group/lane relative shrink-0 border-b border-border/40"
                  style={{ width: timelineWidth }}
                >
                  {renderQuickCreate ? (
                    // The surface sits under the bars, so empty background
                    // takes the drag and the keyboard while every press on
                    // a bar, handle or ghost still belongs to that gesture.
                    <div
                      role="button"
                      tabIndex={rowIndex === activeLane ? 0 : -1}
                      data-slot="gantt-chart-lane-surface"
                      aria-label={
                        draft && !draft.open && draft.rowTaskId === row.task.id
                          ? labels.laneSelection(
                              row.task.name,
                              formatDayLabel(locale, draft.start),
                              formatDayLabel(locale, addDays(draft.end, -1)),
                            )
                          : labels.laneSchedule(row.task.name)
                      }
                      className={cn(
                        "absolute inset-0 cursor-default",
                        insetFocusClassName,
                      )}
                      onPointerDown={(pointerEvent) => {
                        if (pointerEvent.button !== 0) return
                        if (pointerEvent.pointerType === "touch") return
                        beginDraft(pointerEvent, row)
                      }}
                      onKeyDown={(keyEvent) =>
                        handleLaneKeyDown(keyEvent, row, rowIndex)
                      }
                      onFocus={() => setFocusedLane(rowIndex)}
                      onBlur={() => {
                        if (
                          draft &&
                          !draft.open &&
                          draft.rowTaskId === row.task.id
                        ) {
                          cancelDraft()
                        }
                      }}
                    />
                  ) : null}
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
                          "pointer-events-none absolute z-10 rotate-45 rounded-[3px] ring-2 ring-ring",
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
                          "pointer-events-none absolute z-10 rounded-md ring-2 ring-ring",
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
                      className="absolute z-10"
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
                        // Asked from the same typed propagation the
                        // commit runs, so a start-only resize that pushes
                        // start-driven links still gets the choice, and an
                        // end-only one never over-reports.
                        dependentTaskIds: shiftedIdsFor(pendingMove),
                        confirm: confirmPendingMove,
                        cancel: cancelPendingMove,
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
          {/* When the host's box is taller than the rows, the pinned
              column and its divider keep going — an expanded chart never
              shows the task list falling short of its own frame. */}
          <div
            aria-hidden="true"
            data-slot="gantt-chart-filler"
            className="flex min-h-0 flex-1"
          >
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-border bg-background"
              style={{ width: taskListWidth }}
            />
            <div className="shrink-0" style={{ width: timelineWidth }} />
          </div>
        </div>
      </div>
    </div>
      <div
        role="separator"
        tabIndex={0}
        data-slot="gantt-chart-splitter"
        data-resizing={splitterSession ? true : undefined}
        aria-label={labels.taskListSplitter}
        aria-orientation="vertical"
        aria-valuenow={Math.round(taskListWidth)}
        aria-valuemin={TASK_LIST_MIN_WIDTH}
        aria-valuemax={TASK_LIST_MAX_WIDTH}
        className={cn(
          "absolute inset-y-0 z-40 w-px cursor-col-resize touch-none select-none bg-border outline-none",
          "after:absolute after:inset-y-0 after:-start-1 after:-end-1",
          "hover:bg-ring/60 data-resizing:bg-ring",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        )}
        style={{ left: taskListWidth - 1 }}
        onPointerDown={(pointerEvent) => {
          if (pointerEvent.button !== 0) return
          try {
            pointerEvent.currentTarget.setPointerCapture(
              pointerEvent.pointerId,
            )
          } catch {
            // Synthetic pointer events in tests carry untracked ids.
          }
          const session = {
            pointerId: pointerEvent.pointerId,
            originX: pointerEvent.clientX,
            originWidth: taskListWidth,
          }
          splitterSessionRef.current = session
          setSplitterSession(session)
        }}
        onPointerMove={(pointerEvent) => {
          const session = splitterSessionRef.current
          if (session?.pointerId !== pointerEvent.pointerId) return
          setTaskListWidth(
            session.originWidth +
              (pointerEvent.clientX - session.originX),
          )
        }}
        onPointerUp={(pointerEvent) => {
          if (splitterSessionRef.current?.pointerId === pointerEvent.pointerId) {
            splitterSessionRef.current = null
            setSplitterSession(null)
          }
        }}
        onPointerCancel={(pointerEvent) => {
          if (splitterSessionRef.current?.pointerId === pointerEvent.pointerId) {
            splitterSessionRef.current = null
            setSplitterSession(null)
          }
        }}
        onLostPointerCapture={() => {
          splitterSessionRef.current = null
          setSplitterSession(null)
        }}
        onKeyDown={handleSplitterKeyDown}
      />
    </div>
  )
}

export { GanttChartGrid }
