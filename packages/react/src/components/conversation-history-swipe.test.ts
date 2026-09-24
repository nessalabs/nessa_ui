/** @responsibility Verifies the ConversationHistory swipe rules: axis lock, thresholds, which action a full swipe commits, and that a destructive action never fires from a gesture. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  actionNeedsConfirm,
  clampSwipeDisplacement,
  committableSwipeAction,
  presentedSwipeDisplacement,
  resolveSwipeAxis,
  settleSwipe,
  swipeArmed,
  swipeAxisSlop,
  swipeContentOpacity,
  swipeDisplacement,
  swipeGeometry,
  swipeVelocity,
  wheelDeltaInPixels,
  wheelSwipeDisplacement,
  type SwipeCommitCandidate,
} from "./conversation-history-swipe"

const archive = { id: "archive" }
const remove = { id: "delete", tone: "destructive" as const }
// A 360 × 64 row with two actions: rests open at 128, commits past 216.
const geometry = swipeGeometry(360, 64, 2)

describe("resolveSwipeAxis", () => {
  test("stays undecided inside the slop", () => {
    assert.equal(resolveSwipeAxis(0, 0), "pending")
    assert.equal(resolveSwipeAxis(swipeAxisSlop - 1, swipeAxisSlop - 1), "pending")
  })

  test("locks to the dominant axis once the slop is crossed", () => {
    assert.equal(resolveSwipeAxis(-12, 3), "x")
    assert.equal(resolveSwipeAxis(12, -3), "x")
    assert.equal(resolveSwipeAxis(3, 12), "y")
  })

  test("gives a diagonal to the scroll, so vertical scrolling never swipes", () => {
    assert.equal(resolveSwipeAxis(10, 10), "y")
    assert.equal(resolveSwipeAxis(-10, -10), "y")
  })

  test("a wheel's pixel of sideways wobble before a scroll is not a swipe", () => {
    // Wheel deltas are summed and judged by the same slop as a pointer.
    assert.equal(resolveSwipeAxis(1, 0), "pending")
    assert.equal(resolveSwipeAxis(1, 40), "y")
  })
})

describe("swipeGeometry", () => {
  test("gives each action a slot as tall as the row", () => {
    assert.deepEqual(geometry, { rowWidth: 360, openWidth: 128, commitWidth: 216 })
  })

  test("never lets the tray take more than three quarters of the row", () => {
    const crowded = swipeGeometry(200, 64, 4)
    assert.equal(crowded.openWidth, 150)
  })

  test("keeps committing strictly beyond resting open", () => {
    const crowded = swipeGeometry(200, 64, 3)
    assert.ok(crowded.commitWidth > crowded.openWidth)
    assert.ok(crowded.commitWidth <= crowded.rowWidth)
  })
})

describe("direction", () => {
  test("a leftward drag reveals actions in LTR and hides them in RTL", () => {
    assert.equal(swipeDisplacement(-40, "ltr"), 40)
    assert.equal(swipeDisplacement(-40, "rtl"), -40)
    assert.equal(swipeDisplacement(40, "rtl"), 40)
  })

  test("a two-finger swipe toward the leading edge reveals actions", () => {
    assert.equal(wheelSwipeDisplacement(30, "ltr"), 30)
    assert.equal(wheelSwipeDisplacement(-30, "rtl"), 30)
  })

  test("line and page wheel deltas are read as pixels", () => {
    assert.equal(wheelDeltaInPixels(3, 0, 360), 3)
    assert.equal(wheelDeltaInPixels(3, 1, 360), 48)
    assert.equal(wheelDeltaInPixels(1, 2, 360), 360)
  })
})

describe("clampSwipeDisplacement", () => {
  test("never slides toward the trailing edge", () => {
    assert.equal(clampSwipeDisplacement(-50, geometry, true), 0)
    assert.equal(clampSwipeDisplacement(Number.NaN, geometry, true), 0)
  })

  test("follows the pointer across the row when the primary can commit", () => {
    assert.equal(clampSwipeDisplacement(300, geometry, true), 300)
    assert.equal(clampSwipeDisplacement(900, geometry, true), 360)
  })

  test("resists past the resting width when nothing can commit", () => {
    assert.equal(clampSwipeDisplacement(100, geometry, false), 100)
    assert.equal(clampSwipeDisplacement(228, geometry, false), 153)
    assert.ok(clampSwipeDisplacement(10_000, geometry, false) <= geometry.rowWidth)
  })
})

describe("committableSwipeAction", () => {
  test("a full swipe commits the first action", () => {
    assert.equal(committableSwipeAction([archive, remove]), "archive")
  })

  test("a destructive primary never fires from a full swipe", () => {
    assert.equal(committableSwipeAction([remove, archive]), null)
    assert.equal(committableSwipeAction([remove]), null)
  })

  test("an action that asks for confirmation never fires from a full swipe", () => {
    assert.equal(committableSwipeAction([{ id: "mute", confirm: true }, archive]), null)
  })

  test("a destructive action that opts out of confirming still never swipe-commits", () => {
    assert.equal(committableSwipeAction([{ ...remove, confirm: false }]), null)
    assert.equal(actionNeedsConfirm({ ...remove, confirm: false }), false)
    assert.equal(actionNeedsConfirm(remove), true)
    assert.equal(actionNeedsConfirm(archive), false)
  })

  test("a row with no actions commits nothing", () => {
    assert.equal(committableSwipeAction([]), null)
  })
})

describe("settleSwipe", () => {
  const settle = (
    displacement: number,
    velocity = 0,
    actions: readonly SwipeCommitCandidate[] = [archive, remove],
  ) =>
    settleSwipe({
      displacement,
      velocity,
      geometry,
      committable: committableSwipeAction(actions),
    })

  test("springs back below half the resting width", () => {
    assert.deepEqual(settle(63), { kind: "closed" })
    assert.deepEqual(settle(0), { kind: "closed" })
  })

  test("snaps open from half the resting width up to the commit threshold", () => {
    assert.deepEqual(settle(64), { kind: "open" })
    assert.deepEqual(settle(215), { kind: "open" })
  })

  test("commits the primary action past the commit threshold", () => {
    assert.deepEqual(settle(216), { kind: "commit", actionId: "archive" })
    assert.deepEqual(settle(360, -5), { kind: "commit", actionId: "archive" })
  })

  test("a destructive primary rests open however far it is swiped", () => {
    assert.deepEqual(settle(360, 0, [remove]), { kind: "open" })
    assert.deepEqual(settle(360, 5, [remove, archive]), { kind: "open" })
  })

  test("a flick settles the way it was thrown but never commits", () => {
    assert.deepEqual(settle(20, 1), { kind: "open" })
    assert.deepEqual(settle(200, -1), { kind: "closed" })
    assert.deepEqual(settle(100, 10), { kind: "open" })
  })

  test("a release that must not commit rests open instead", () => {
    assert.deepEqual(
      settleSwipe({ displacement: 360, velocity: 0, geometry, committable: null }),
      { kind: "open" },
    )
  })

  test("closes when there is nothing to reveal", () => {
    const empty = swipeGeometry(360, 64, 0)
    assert.deepEqual(
      settleSwipe({ displacement: 200, velocity: 5, geometry: empty, committable: null }),
      { kind: "closed" },
    )
  })
})

describe("swipeArmed", () => {
  test("arms only past the commit threshold and only when something can commit", () => {
    assert.equal(swipeArmed(215, geometry, true), false)
    assert.equal(swipeArmed(216, geometry, true), true)
    assert.equal(swipeArmed(300, geometry, false), false)
  })
})

describe("swipeVelocity", () => {
  test("measures speed over the recent window", () => {
    const samples = [
      { time: 0, displacement: 0 },
      { time: 100, displacement: 10 },
      { time: 150, displacement: 40 },
      { time: 200, displacement: 70 },
    ]
    assert.equal(swipeVelocity(samples, 200), 0.6)
  })

  test("a pointer that paused before letting go has no speed", () => {
    const samples = [
      { time: 0, displacement: 0 },
      { time: 16, displacement: 50 },
    ]
    assert.equal(swipeVelocity(samples, 400), 0)
    assert.equal(swipeVelocity([], 0), 0)
  })
})

describe("presentedSwipeDisplacement", () => {
  test("follows the gesture exactly when motion is allowed", () => {
    assert.equal(presentedSwipeDisplacement(37, geometry, false), 37)
  })

  test("draws only the resting positions under reduced motion", () => {
    assert.equal(presentedSwipeDisplacement(37, geometry, true), 0)
    assert.equal(presentedSwipeDisplacement(64, geometry, true), 128)
    assert.equal(presentedSwipeDisplacement(300, geometry, true), 128)
  })
})

describe("swipeContentOpacity", () => {
  test("keeps an arriving action's label clear until it can be read", () => {
    assert.equal(swipeContentOpacity(0, geometry), 0)
    assert.equal(swipeContentOpacity(40, geometry), 0)
  })

  test("is fully visible by the resting width and stays so beyond it", () => {
    assert.equal(swipeContentOpacity(128, geometry), 1)
    assert.equal(swipeContentOpacity(300, geometry), 1)
    const partway = swipeContentOpacity(96, geometry)
    assert.ok(partway > 0 && partway < 1)
  })

  test("shows nothing when there is nothing to reveal", () => {
    assert.equal(swipeContentOpacity(50, swipeGeometry(360, 64, 0)), 0)
  })
})
