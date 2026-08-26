/** @responsibility Verifies the Gantt scheduling math: dependency resolution and edges, relation violations, cascade shifts through typed relations, critical-path float, and the cycle guard. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  cascadeShiftDays,
  dependencyEarliestDay,
  dependencyEdges,
  dependencyViolationDays,
  dependencyViolations,
  dependentTaskIds,
  ganttChartCriticalTaskIds,
  ganttChartTaskFloatDays,
  ganttChartTaskProgress,
  ganttChartTaskSpan,
  isMilestoneTask,
  isSummaryTask,
  resolveDependency,
  taskDependencies,
  wouldCreateDependencyCycle,
  type GanttChartTask,
} from "./gantt-chart-scheduling"

/** A day in January 2026, so every fixture reads as a plain date. */
function day(dayOfMonth: number) {
  return new Date(2026, 0, dayOfMonth)
}

function task(
  id: string,
  start: number,
  end: number,
  extra: Partial<GanttChartTask> = {},
): GanttChartTask {
  return { id, name: id, start: day(start), end: day(end), ...extra }
}

describe("resolveDependency", () => {
  test("reads a bare id as a zero-lag finish-to-start link", () => {
    assert.deepEqual(resolveDependency("a"), {
      taskId: "a",
      type: "finish-to-start",
      lagDays: 0,
    })
  })

  test("fills the defaults of a partial relation", () => {
    assert.deepEqual(resolveDependency({ taskId: "a" }), {
      taskId: "a",
      type: "finish-to-start",
      lagDays: 0,
    })
    assert.deepEqual(
      resolveDependency({ taskId: "a", type: "start-to-start", lagDays: -2 }),
      { taskId: "a", type: "start-to-start", lagDays: -2 },
    )
  })

  test("resolves every entry a task declares", () => {
    const subject = task("b", 5, 8, {
      dependsOn: ["a", { taskId: "c", type: "finish-to-finish", lagDays: 1 }],
    })
    assert.deepEqual(taskDependencies(subject), [
      { taskId: "a", type: "finish-to-start", lagDays: 0 },
      { taskId: "c", type: "finish-to-finish", lagDays: 1 },
    ])
  })
})

describe("dependencyEdges", () => {
  test("names the driving and constrained edge of every type", () => {
    assert.deepEqual(dependencyEdges("finish-to-start"), {
      from: "finish",
      to: "start",
    })
    assert.deepEqual(dependencyEdges("start-to-start"), {
      from: "start",
      to: "start",
    })
    assert.deepEqual(dependencyEdges("finish-to-finish"), {
      from: "finish",
      to: "finish",
    })
    assert.deepEqual(dependencyEdges("start-to-finish"), {
      from: "start",
      to: "finish",
    })
  })
})

describe("dependencyEarliestDay", () => {
  const span = { start: day(1), end: day(5) }

  test("offsets the driving edge by the lag", () => {
    assert.equal(
      dependencyEarliestDay(span, {
        taskId: "a",
        type: "finish-to-start",
        lagDays: 2,
      }).getTime(),
      day(7).getTime(),
    )
    assert.equal(
      dependencyEarliestDay(span, {
        taskId: "a",
        type: "start-to-start",
        lagDays: 0,
      }).getTime(),
      day(1).getTime(),
    )
  })

  test("treats a negative lag as a lead", () => {
    assert.equal(
      dependencyEarliestDay(span, {
        taskId: "a",
        type: "finish-to-start",
        lagDays: -2,
      }).getTime(),
      day(3).getTime(),
    )
  })
})

describe("dependencyViolationDays", () => {
  const predecessor = { start: day(1), end: day(5) }

  test("reports zero while the relation is satisfied", () => {
    assert.equal(
      dependencyViolationDays(
        predecessor,
        { start: day(5), end: day(9) },
        { taskId: "a", type: "finish-to-start", lagDays: 0 },
      ),
      0,
    )
  })

  test("counts the days a successor starts too early by", () => {
    assert.equal(
      dependencyViolationDays(
        predecessor,
        { start: day(3), end: day(7) },
        { taskId: "a", type: "finish-to-start", lagDays: 0 },
      ),
      2,
    )
  })

  test("measures the constrained edge the relation names", () => {
    // Finish-to-finish looks at the successor's finish, not its start.
    assert.equal(
      dependencyViolationDays(
        predecessor,
        { start: day(1), end: day(3) },
        { taskId: "a", type: "finish-to-finish", lagDays: 0 },
      ),
      2,
    )
  })

  test("collects every violated relation in the plan", () => {
    const tasks = [
      task("a", 1, 5),
      task("b", 3, 7, { dependsOn: ["a"] }),
      task("c", 8, 9, { dependsOn: ["a"] }),
    ]
    const violations = dependencyViolations(tasks)
    assert.equal(violations.length, 1)
    assert.equal(violations[0].successorId, "b")
    assert.equal(violations[0].days, 2)
  })
})

describe("dependentTaskIds", () => {
  const tasks = [
    task("a", 1, 3),
    task("b", 3, 5, { dependsOn: ["a"] }),
    task("c", 5, 7, { dependsOn: ["b"] }),
    task("d", 1, 2),
  ]

  test("walks the graph transitively", () => {
    assert.deepEqual(dependentTaskIds(tasks, "a"), ["b", "c"])
    assert.deepEqual(dependentTaskIds(tasks, "c"), [])
    assert.deepEqual(dependentTaskIds(tasks, "d"), [])
  })

  test("survives a cycle", () => {
    const cyclic = [
      task("a", 1, 3, { dependsOn: ["c"] }),
      task("b", 3, 5, { dependsOn: ["a"] }),
      task("c", 5, 7, { dependsOn: ["b"] }),
    ]
    assert.deepEqual(dependentTaskIds(cyclic, "a"), ["b", "c"])
  })
})

describe("cascadeShiftDays", () => {
  const tasks = [
    task("a", 1, 5),
    task("b", 5, 9, { dependsOn: ["a"] }),
    task("c", 9, 11, { dependsOn: ["b"] }),
    task("parallel", 1, 4, {
      dependsOn: [{ taskId: "a", type: "start-to-start" }],
    }),
  ]

  test("slides the whole chain when the task moves whole", () => {
    const shifts = cascadeShiftDays(tasks, "a", 3, 3)
    assert.equal(shifts.get("b"), 3)
    assert.equal(shifts.get("c"), 3)
    assert.equal(shifts.get("parallel"), 3)
  })

  test("an end-only resize pushes finish-driven links but not start-driven ones", () => {
    const shifts = cascadeShiftDays(tasks, "a", 0, 2)
    assert.equal(shifts.get("b"), 2)
    assert.equal(shifts.get("c"), 2)
    assert.equal(shifts.has("parallel"), false)
  })

  test("a start-only resize pushes start-driven links only", () => {
    const shifts = cascadeShiftDays(tasks, "a", -1, 0)
    assert.equal(shifts.get("parallel"), -1)
    assert.equal(shifts.has("b"), false)
  })

  test("takes the furthest shift in the move's direction when paths converge", () => {
    const converging = [
      task("a", 1, 5),
      task("near", 5, 6, { dependsOn: ["a"] }),
      task("far", 6, 7, { dependsOn: ["near"] }),
      // "join" hangs off both the original task and the end of the chain.
      task("join", 7, 8, { dependsOn: ["a", "far"] }),
    ]
    const shifts = cascadeShiftDays(converging, "a", 4, 4)
    assert.equal(shifts.get("join"), 4)
  })

  test("never shifts the moved task itself and survives a cycle", () => {
    const cyclic = [
      task("a", 1, 3),
      task("b", 3, 5, { dependsOn: ["a"] }),
      task("c", 5, 7, { dependsOn: ["b"] }),
    ]
    cyclic[0].dependsOn = ["c"]
    const shifts = cascadeShiftDays(cyclic, "a", 2, 2)
    assert.equal(shifts.has("a"), false)
    assert.equal(shifts.get("b"), 2)
    assert.equal(shifts.get("c"), 2)
  })
})

describe("ganttChartTaskFloatDays", () => {
  test("gives a dependency chain no float and a short branch slack", () => {
    const tasks = [
      task("a", 1, 5),
      task("b", 5, 10, { dependsOn: ["a"] }),
      task("side", 1, 3),
    ]
    const floats = ganttChartTaskFloatDays(tasks)
    assert.equal(floats.get("a"), 0)
    assert.equal(floats.get("b"), 0)
    assert.equal(floats.get("side"), 7)
  })

  test("counts the slack a gap in the chain leaves", () => {
    const tasks = [
      task("a", 1, 3),
      // Starts three days after "a" finishes, so "a" could slip three days.
      task("b", 6, 10, { dependsOn: ["a"] }),
    ]
    const floats = ganttChartTaskFloatDays(tasks)
    assert.equal(floats.get("a"), 3)
    assert.equal(floats.get("b"), 0)
  })

  test("respects lag when handing float back down the chain", () => {
    const tasks = [
      task("a", 1, 3),
      task("b", 5, 9, {
        dependsOn: [{ taskId: "a", type: "finish-to-start", lagDays: 2 }],
      }),
    ]
    const floats = ganttChartTaskFloatDays(tasks)
    assert.equal(floats.get("a"), 0)
  })

  test("reports a violated relation as negative float", () => {
    const tasks = [
      task("a", 1, 6),
      task("b", 4, 10, { dependsOn: ["a"] }),
    ]
    const floats = ganttChartTaskFloatDays(tasks)
    assert.equal(floats.get("a"), -2)
  })

  test("passes a constraint on a summary down to its children", () => {
    const tasks = [
      task("group", 1, 2),
      task("early", 1, 5, { parentId: "group" }),
      task("late", 3, 7, { parentId: "group" }),
      // Depends on the group, so the group's last child drives it.
      task("after", 7, 12, { dependsOn: ["group"] }),
    ]
    const floats = ganttChartTaskFloatDays(tasks)
    assert.equal(floats.get("late"), 0)
    assert.equal(floats.get("group"), 0)
    assert.equal(floats.get("early"), 2)
    assert.deepEqual(
      [...ganttChartCriticalTaskIds(tasks)].sort(),
      ["after", "group", "late"],
    )
  })

  test("gives a summary the tightest float beneath it", () => {
    const tasks = [
      task("group", 1, 2),
      task("tight", 1, 5, { parentId: "group" }),
      task("loose", 1, 2, { parentId: "group" }),
      task("after", 5, 9, { dependsOn: ["tight"] }),
    ]
    const floats = ganttChartTaskFloatDays(tasks)
    assert.equal(floats.get("tight"), 0)
    assert.equal(floats.get("group"), 0)
  })
})

describe("start-to-finish and finish-to-finish behaviour", () => {
  test("a start-to-finish relation constrains the successor's finish", () => {
    const predecessor = { start: day(5), end: day(9) }
    // The successor may not finish before the predecessor starts.
    assert.equal(
      dependencyViolationDays(
        predecessor,
        { start: day(1), end: day(3) },
        { taskId: "a", type: "start-to-finish", lagDays: 0 },
      ),
      2,
    )
    assert.equal(
      dependencyViolationDays(
        predecessor,
        { start: day(1), end: day(6) },
        { taskId: "a", type: "start-to-finish", lagDays: 0 },
      ),
      0,
    )
  })

  test("a start-to-finish link cascades off the predecessor's start", () => {
    const tasks = [
      task("a", 5, 9),
      task("b", 1, 6, {
        dependsOn: [{ taskId: "a", type: "start-to-finish" }],
      }),
    ]
    assert.equal(cascadeShiftDays(tasks, "a", 2, 0).get("b"), 2)
    assert.equal(cascadeShiftDays(tasks, "a", 0, 2).has("b"), false)
  })

  test("float flows back through a finish-to-finish link", () => {
    const tasks = [
      task("a", 1, 5),
      task("b", 1, 5, {
        dependsOn: [{ taskId: "a", type: "finish-to-finish" }],
      }),
      task("last", 5, 9, { dependsOn: ["b"] }),
    ]
    const floats = ganttChartTaskFloatDays(tasks)
    assert.equal(floats.get("a"), 0)
    assert.equal(floats.get("b"), 0)
  })

  test("a negative lag lets the successor start early without violating", () => {
    const predecessor = { start: day(1), end: day(10) }
    assert.equal(
      dependencyViolationDays(
        predecessor,
        { start: day(8), end: day(12) },
        { taskId: "a", type: "finish-to-start", lagDays: -2 },
      ),
      0,
    )
    // One day earlier than the lead allows is still a violation.
    assert.equal(
      dependencyViolationDays(
        predecessor,
        { start: day(7), end: day(12) },
        { taskId: "a", type: "finish-to-start", lagDays: -2 },
      ),
      1,
    )
  })

  test("a milestone carries a chain like any other predecessor", () => {
    const tasks = [
      task("gate", 5, 5),
      task("after", 5, 9, { dependsOn: ["gate"] }),
    ]
    assert.equal(cascadeShiftDays(tasks, "gate", 3, 3).get("after"), 3)
    assert.equal(ganttChartTaskFloatDays(tasks).get("gate"), 0)
  })

  test("a shrinking resize pulls finish-driven dependents back", () => {
    const tasks = [
      task("a", 1, 9),
      task("b", 9, 12, { dependsOn: ["a"] }),
      task("c", 12, 14, { dependsOn: ["b"] }),
    ]
    const shifts = cascadeShiftDays(tasks, "a", 0, -3)
    assert.equal(shifts.get("b"), -3)
    assert.equal(shifts.get("c"), -3)
  })
})

describe("ganttChartCriticalTaskIds", () => {
  test("marks the chain that carries the plan's finish", () => {
    const tasks = [
      task("a", 1, 5),
      task("b", 5, 10, { dependsOn: ["a"] }),
      task("side", 1, 3),
    ]
    const critical = ganttChartCriticalTaskIds(tasks)
    assert.deepEqual([...critical].sort(), ["a", "b"])
  })

  test("puts only the last-finishing tasks on it without dependencies", () => {
    const tasks = [task("a", 1, 5), task("b", 1, 9), task("c", 2, 9)]
    const critical = ganttChartCriticalTaskIds(tasks)
    assert.deepEqual([...critical].sort(), ["b", "c"])
  })
})

describe("wouldCreateDependencyCycle", () => {
  const tasks = [
    task("a", 1, 3),
    task("b", 3, 5, { dependsOn: ["a"] }),
    task("c", 5, 7, { dependsOn: ["b"] }),
  ]

  test("refuses a self link", () => {
    assert.equal(wouldCreateDependencyCycle(tasks, "a", "a"), true)
  })

  test("refuses a link that closes an existing chain", () => {
    assert.equal(wouldCreateDependencyCycle(tasks, "c", "a"), true)
  })

  test("allows a link that extends the graph forward", () => {
    assert.equal(wouldCreateDependencyCycle(tasks, "a", "c"), false)
  })
})

describe("task derivations", () => {
  test("reads a zero-length task as a milestone", () => {
    assert.equal(isMilestoneTask(task("m", 4, 4)), true)
    assert.equal(isMilestoneTask(task("t", 4, 5)), false)
  })

  test("reads a parent named by another task as a summary", () => {
    const tasks = [task("group", 1, 2), task("child", 1, 5, { parentId: "group" })]
    assert.equal(isSummaryTask(tasks[0], tasks), true)
    assert.equal(isSummaryTask(tasks[1], tasks), false)
  })

  test("rolls a summary's span up from its descendants", () => {
    const tasks = [
      task("group", 20, 21),
      task("first", 3, 6, { parentId: "group" }),
      task("last", 8, 12, { parentId: "group" }),
    ]
    const span = ganttChartTaskSpan(tasks[0], tasks)
    assert.equal(span.start.getTime(), day(3).getTime())
    assert.equal(span.end.getTime(), day(12).getTime())
  })

  test("weights a summary's progress by duration", () => {
    const tasks = [
      task("group", 1, 2),
      task("long", 1, 5, { parentId: "group", progress: 1 }),
      task("short", 5, 6, { parentId: "group", progress: 0 }),
    ]
    assert.equal(ganttChartTaskProgress(tasks[0], tasks), 0.8)
  })
})
