"use client"

/** @responsibility Pure scheduling math for the Gantt chart: day arithmetic, task derivations (milestone, summary, span, progress), typed dependency constraints with lag, cascade shifts through the dependency graph, and critical-path float. */

/** One row of the plan. Tasks are plain serializable data: grouping comes
 * from `parentId`, and milestones and summaries are derived from the dates
 * and the tree rather than stored as flags that could disagree with them.
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
  /** Fraction complete, 0–1, drawn as a meter inside the bar. */
  progress?: number
  /**
   * Built-in semantic color treatment for the bar. Defaults to
   * `"primary"`. The tones are conveniences, not a ceiling: restyle any
   * bar with the chart's `taskClassName` prop, or take over the bar's
   * interior entirely with `renderTask`.
   */
  tone?: GanttChartTone
  /**
   * Tasks this one depends on, drawn as arrows. A bare string is the
   * finish-to-start shorthand; the object form carries the relation type
   * and a lag in days (negative for a lead). Relations are visual and
   * inform the cascade — the chart never silently reschedules to satisfy
   * them.
   */
  dependsOn?: GanttChartDependencyInput[]
  /**
   * Id of the task this one nests under. A task that others name as their
   * parent renders as a summary row whose span and progress roll up from
   * its descendants.
   */
  parentId?: string
  /** Free-form host data (assignee, status, links) carried through untouched. */
  meta?: Record<string, unknown>
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

/**
 * The four industry relation types, named in full rather than by their
 * FS/SS/FF/SF initials so the data reads without a legend.
 *
 * - `finish-to-start` — the successor starts after the predecessor finishes
 * - `start-to-start` — the two start together
 * - `finish-to-finish` — the two finish together
 * - `start-to-finish` — the successor finishes after the predecessor starts
 */
export type GanttChartDependencyType =
  | "finish-to-start"
  | "start-to-start"
  | "finish-to-finish"
  | "start-to-finish"

/** A link to a predecessor task, with its relation type and lag. */
export interface GanttChartDependency {
  /** Id of the predecessor task. */
  taskId: string
  /** Relation type. @defaultValue `"finish-to-start"` */
  type?: GanttChartDependencyType
  /**
   * Days of lag between the two constrained edges; negative values are
   * leads (overlap). @defaultValue 0
   */
  lagDays?: number
}

/** What `dependsOn` accepts: a bare id, or a full relation. */
export type GanttChartDependencyInput = string | GanttChartDependency

/** A dependency with every optional field resolved. */
export interface ResolvedGanttChartDependency {
  taskId: string
  type: GanttChartDependencyType
  lagDays: number
}

/** An inclusive start / exclusive end day pair. */
export interface GanttChartRange {
  start: Date
  end: Date
}

export const DAY_MS = 86_400_000
export const WEEK_LENGTH = 7

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function startOfWeek(date: Date, weekStartsOn: number) {
  const day = startOfDay(date)
  const offset = (day.getDay() - weekStartsOn + WEEK_LENGTH) % WEEK_LENGTH
  return addDays(day, -offset)
}

export function startOfMonth(date: Date) {
  const next = startOfDay(date)
  next.setDate(1)
  return next
}

export function addMonths(date: Date, amount: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

/**
 * Whole calendar days between two instants' midnights. Rounding absorbs
 * the ±1 hour a DST transition adds or removes, so day indexes never
 * drift against the header cells.
 */
export function differenceInCalendarDays(later: Date, earlier: Date) {
  return Math.round(
    (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS,
  )
}

export function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Whether a task is a milestone: its start and end name the same day, so
 * it marks a point in time rather than a span — derived from the dates
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

/** Indexes tasks by parent, ignoring parents that are not in the list. */
function childrenByParent(tasks: GanttChartTask[]) {
  const byId = new Set(tasks.map((task) => task.id))
  const childrenOf = new Map<string, GanttChartTask[]>()
  for (const task of tasks) {
    if (!task.parentId || !byId.has(task.parentId)) continue
    const siblings = childrenOf.get(task.parentId) ?? []
    siblings.push(task)
    childrenOf.set(task.parentId, siblings)
  }
  return childrenOf
}

/** Collects a task's leaf descendants (empty for a non-summary). */
export function descendantLeaves(
  task: GanttChartTask,
  tasks: GanttChartTask[],
): GanttChartTask[] {
  const childrenOf = childrenByParent(tasks)
  if (!childrenOf.has(task.id)) return []
  const leaves: GanttChartTask[] = []
  const visit = (parent: GanttChartTask, seen: Set<string>) => {
    if (seen.has(parent.id)) return
    seen.add(parent.id)
    for (const child of childrenOf.get(parent.id) ?? []) {
      if (childrenOf.has(child.id)) visit(child, seen)
      else leaves.push(child)
    }
  }
  visit(task, new Set())
  return leaves
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

/** Resolves one `dependsOn` entry to its full form. */
export function resolveDependency(
  input: GanttChartDependencyInput,
): ResolvedGanttChartDependency {
  if (typeof input === "string") {
    return { taskId: input, type: "finish-to-start", lagDays: 0 }
  }
  return {
    taskId: input.taskId,
    type: input.type ?? "finish-to-start",
    lagDays: input.lagDays ?? 0,
  }
}

/** Resolves every dependency a task declares. */
export function taskDependencies(
  task: GanttChartTask,
): ResolvedGanttChartDependency[] {
  return (task.dependsOn ?? []).map(resolveDependency)
}

/**
 * Which edge of the predecessor drives a relation ("start" for the
 * start-to-* types, "finish" for the finish-to-* types), and which edge of
 * the successor it constrains. Arrow routing and cascade propagation both
 * read the relation through this one description.
 */
export function dependencyEdges(type: GanttChartDependencyType): {
  from: "start" | "finish"
  to: "start" | "finish"
} {
  switch (type) {
    case "finish-to-start":
      return { from: "finish", to: "start" }
    case "start-to-start":
      return { from: "start", to: "start" }
    case "finish-to-finish":
      return { from: "finish", to: "finish" }
    case "start-to-finish":
      return { from: "start", to: "finish" }
    default: {
      const exhaustive: never = type
      return exhaustive
    }
  }
}

/** Reads one edge of a task's span as a day. */
function edgeDay(range: GanttChartRange, edge: "start" | "finish") {
  return edge === "start" ? startOfDay(range.start) : startOfDay(range.end)
}

/**
 * The earliest day a relation allows the successor's constrained edge to
 * sit on: the predecessor's driving edge plus the lag.
 */
export function dependencyEarliestDay(
  predecessorSpan: GanttChartRange,
  dependency: ResolvedGanttChartDependency,
) {
  const { from } = dependencyEdges(dependency.type)
  return addDays(edgeDay(predecessorSpan, from), dependency.lagDays)
}

/**
 * How many days a relation is violated by — 0 when satisfied, positive
 * when the successor's constrained edge sits earlier than the relation
 * allows.
 */
export function dependencyViolationDays(
  predecessorSpan: GanttChartRange,
  successorSpan: GanttChartRange,
  dependency: ResolvedGanttChartDependency,
) {
  const { to } = dependencyEdges(dependency.type)
  const earliest = dependencyEarliestDay(predecessorSpan, dependency)
  const actual = edgeDay(successorSpan, to)
  return Math.max(differenceInCalendarDays(earliest, actual), 0)
}

/** Indexes successors by the predecessor they name. */
function successorsByPredecessor(tasks: GanttChartTask[]) {
  const byId = new Set(tasks.map((task) => task.id))
  const successorsOf = new Map<
    string,
    Array<{ task: GanttChartTask; dependency: ResolvedGanttChartDependency }>
  >()
  for (const task of tasks) {
    for (const dependency of taskDependencies(task)) {
      if (!byId.has(dependency.taskId)) continue
      const successors = successorsOf.get(dependency.taskId) ?? []
      successors.push({ task, dependency })
      successorsOf.set(dependency.taskId, successors)
    }
  }
  return successorsOf
}

/**
 * A task's transitive dependents: every task reachable by following
 * `dependsOn` edges away from it, cycle-safe, in breadth-first order.
 */
export function dependentTaskIds(tasks: GanttChartTask[], taskId: string) {
  const successorsOf = successorsByPredecessor(tasks)
  const dependents: string[] = []
  const seen = new Set([taskId])
  const queue = [taskId]
  while (queue.length) {
    const id = queue.shift() as string
    for (const { task } of successorsOf.get(id) ?? []) {
      if (seen.has(task.id)) continue
      seen.add(task.id)
      dependents.push(task.id)
      queue.push(task.id)
    }
  }
  return dependents
}

/**
 * How far each transitive dependent slides when a task's edges move,
 * keyed by task id and measured in days.
 *
 * Each relation follows the predecessor edge that drives it — the
 * finish-to-* types follow the finish, the start-to-* types follow the
 * start — so a whole-task move slides the entire chain by one delta while
 * an end-only resize pushes just the relations that hang off the finish.
 * A dependent reached by several paths takes the furthest shift in the
 * move's own direction, which is the one that keeps every relation it
 * carries as least as satisfied as it was.
 */
export function cascadeShiftDays(
  tasks: GanttChartTask[],
  taskId: string,
  startDelta: number,
  endDelta: number,
) {
  const successorsOf = successorsByPredecessor(tasks)
  const forward = Math.max(startDelta, endDelta) > 0
  const shifts = new Map<string, number>()
  // Deltas of the edges each visited task moved by, seeding with the
  // task that was actually dragged.
  const queue: Array<{ id: string; startDelta: number; endDelta: number }> = [
    { id: taskId, startDelta, endDelta },
  ]
  // A cycle would otherwise keep re-queueing the same ids; every task is
  // allowed to be re-visited only while its shift is still growing.
  let guard = tasks.length * tasks.length + tasks.length
  while (queue.length && guard-- > 0) {
    const current = queue.shift() as {
      id: string
      startDelta: number
      endDelta: number
    }
    for (const { task, dependency } of successorsOf.get(current.id) ?? []) {
      if (task.id === taskId) continue
      const { from } = dependencyEdges(dependency.type)
      const shift = from === "start" ? current.startDelta : current.endDelta
      if (shift === 0) continue
      const previous = shifts.get(task.id)
      const next =
        previous === undefined
          ? shift
          : forward
            ? Math.max(previous, shift)
            : Math.min(previous, shift)
      if (previous === next) continue
      shifts.set(task.id, next)
      // A dependent slides whole, so both of its edges carry the shift on.
      queue.push({ id: task.id, startDelta: next, endDelta: next })
    }
  }
  return shifts
}

/**
 * Every dependency in the plan that its two tasks' current dates violate,
 * with the number of days each is short by. Hosts surface these as
 * warnings; the chart marks the offending arrows.
 */
export function dependencyViolations(tasks: GanttChartTask[]) {
  const spanById = new Map(
    tasks.map((task) => [task.id, ganttChartTaskSpan(task, tasks)]),
  )
  const violations: Array<{
    predecessorId: string
    successorId: string
    dependency: ResolvedGanttChartDependency
    days: number
  }> = []
  for (const task of tasks) {
    const successorSpan = spanById.get(task.id)
    if (!successorSpan) continue
    for (const dependency of taskDependencies(task)) {
      const predecessorSpan = spanById.get(dependency.taskId)
      if (!predecessorSpan) continue
      const days = dependencyViolationDays(
        predecessorSpan,
        successorSpan,
        dependency,
      )
      if (days > 0) {
        violations.push({
          predecessorId: dependency.taskId,
          successorId: task.id,
          dependency,
          days,
        })
      }
    }
  }
  return violations
}

/**
 * Total float per task, in days: how far each task could finish later
 * before it would push the plan's own finish out.
 *
 * The dates on a Gantt task are already scheduled, so this is a backward
 * pass only — a task with no successors may run to the plan's finish, and
 * anything feeding it inherits the latest finish its relations allow,
 * including the ones sitting on the summaries above it. Float 0 (or less,
 * when a relation is already violated) marks the critical chain. Summary
 * rows take the smallest float under them, and a task caught in a
 * dependency cycle is held to its own finish rather than looping.
 */
export function ganttChartTaskFloatDays(tasks: GanttChartTask[]) {
  const spanById = new Map(
    tasks.map((task) => [task.id, ganttChartTaskSpan(task, tasks)]),
  )
  const successorsOf = successorsByPredecessor(tasks)
  const childrenOf = childrenByParent(tasks)
  const planFinish = tasks.reduce<Date | null>((latest, task) => {
    const span = spanById.get(task.id)
    if (!span) return latest
    return !latest || span.end > latest ? span.end : latest
  }, null)

  const latestFinish = new Map<string, number>()
  const visiting = new Set<string>()

  /** The latest day this task may finish on, as a day offset from epoch. */
  const resolveLatestFinish = (task: GanttChartTask): number => {
    const cached = latestFinish.get(task.id)
    if (cached !== undefined) return cached
    const span = spanById.get(task.id) as GanttChartRange
    if (visiting.has(task.id)) {
      // Inside a cycle: fall back to the task's own finish so the chain
      // reads as fully constrained instead of recursing forever.
      return span.end.getTime()
    }
    visiting.add(task.id)
    const successors = successorsOf.get(task.id) ?? []
    let latest = (planFinish ?? span.end).getTime()
    const durationDays = differenceInCalendarDays(span.end, span.start)
    for (const { task: successor, dependency } of successors) {
      const successorSpan = spanById.get(successor.id) as GanttChartRange
      const successorLatestFinish = resolveLatestFinish(successor)
      const successorDuration = differenceInCalendarDays(
        successorSpan.end,
        successorSpan.start,
      )
      const successorLatestStart = addDays(
        new Date(successorLatestFinish),
        -successorDuration,
      ).getTime()
      const { from, to } = dependencyEdges(dependency.type)
      // Read the successor's constrained edge at its latest position,
      // walk back over the lag, and turn that into this task's finish.
      const constrainedEdge =
        to === "start" ? successorLatestStart : successorLatestFinish
      const drivingEdge = addDays(
        new Date(constrainedEdge),
        -dependency.lagDays,
      ).getTime()
      const candidate =
        from === "finish"
          ? drivingEdge
          : addDays(new Date(drivingEdge), durationDays).getTime()
      if (candidate < latest) latest = candidate
    }
    visiting.delete(task.id)
    latestFinish.set(task.id, latest)
    return latest
  }

  const byId = new Map(tasks.map((task) => [task.id, task]))

  /**
   * A leaf also inherits every constraint sitting on the summaries above
   * it: a summary's finish is its latest child's, so a relation hanging
   * off the group holds each child to the same date.
   */
  const inheritedLatestFinish = (task: GanttChartTask) => {
    let latest = resolveLatestFinish(task)
    const seen = new Set([task.id])
    let parentId = task.parentId
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId)
      const parent = byId.get(parentId)
      if (!parent) break
      latest = Math.min(latest, resolveLatestFinish(parent))
      parentId = parent.parentId
    }
    return latest
  }

  const floats = new Map<string, number>()
  for (const task of tasks) {
    if (childrenOf.has(task.id)) continue
    const span = spanById.get(task.id) as GanttChartRange
    floats.set(
      task.id,
      differenceInCalendarDays(
        new Date(inheritedLatestFinish(task)),
        span.end,
      ),
    )
  }
  // A summary is exactly as critical as the tightest task beneath it.
  for (const task of tasks) {
    if (!childrenOf.has(task.id)) continue
    const leafFloats = descendantLeaves(task, tasks)
      .map((leaf) => floats.get(leaf.id))
      .filter((value): value is number => value !== undefined)
    if (leafFloats.length) floats.set(task.id, Math.min(...leafFloats))
  }
  return floats
}

/**
 * The ids on the critical path: every task with no float left, so any
 * slip pushes the plan's finish. Derived from
 * `ganttChartTaskFloatDays` — a plan with no dependencies puts only the
 * tasks that finish last on it.
 */
export function ganttChartCriticalTaskIds(tasks: GanttChartTask[]) {
  const floats = ganttChartTaskFloatDays(tasks)
  const critical = new Set<string>()
  for (const [id, float] of floats) {
    if (float <= 0) critical.add(id)
  }
  return critical
}

/**
 * Whether adding a dependency from `predecessorId` to `successorId` would
 * close a loop — the guard the linking gesture runs before it offers a
 * drop.
 */
export function wouldCreateDependencyCycle(
  tasks: GanttChartTask[],
  predecessorId: string,
  successorId: string,
) {
  if (predecessorId === successorId) return true
  // The new edge points predecessor → successor, so a cycle exists when
  // the predecessor already depends on the successor.
  return dependentTaskIds(tasks, successorId).includes(predecessorId)
}
