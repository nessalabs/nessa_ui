/** @responsibility Verifies the ConversationHistory swipe rules: axis lock, thresholds, which action a full swipe commits, that a destructive action never fires from a gesture, and that trackpad inertia never commits a row. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  actionNeedsConfirm,
  clampSwipeDisplacement,
  committableSwipeAction,
  presentedSwipeDisplacement,
  resolveSwipeAxis,
  settleSwipe,
  settleWheelSwipe,
  startWheelSwipe,
  stepWheelSwipe,
  swipeArmed,
  swipeAxisSlop,
  swipeContentOpacity,
  swipeDisplacement,
  swipeGeometry,
  swipeVelocity,
  wheelDeltaInPixels,
  wheelSwipeDisplacement,
  type SwipeCommitCandidate,
  type SwipeGeometry,
  type SwipeRelease,
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

/** A macOS inertia tail: each delta a fixed fraction of the last, down to nothing. */
function momentumTail(from: number, decay = 0.96) {
  const tail: number[] = []
  for (let delta = from * decay; delta >= 0.5; delta *= decay) tail.push(delta)
  return tail
}

/**
 * Replays wheel deltas, one per frame, the way the row reads them: the first
 * delta decides the axis, every later one steps the gesture, and the row is
 * released as soon as the deltas turn out to be inertia — or, failing that,
 * when they stop.
 */
function replayWheel(
  deltas: readonly number[],
  {
    at = geometry,
    start = 0,
    frameMs = 16,
    committable = "archive" as string | null,
  }: { at?: SwipeGeometry; start?: number; frameMs?: number; committable?: string | null } = {},
): { release: SwipeRelease; coasted: boolean } {
  const [first = 0, ...rest] = deltas
  let track = startWheelSwipe(first, 0)
  for (const [index, delta] of rest.entries()) {
    const step = stepWheelSwipe(track, delta, (index + 1) * frameMs)
    track = step.track
    if (step.event === "coast") {
      return {
        release: settleWheelSwipe({ track, start, geometry: at, committable }),
        coasted: true,
      }
    }
  }
  return {
    release: settleWheelSwipe({ track, start, geometry: at, committable }),
    coasted: false,
  }
}

describe("wheel swipes and trackpad inertia", () => {
  // The Messages panel: a 560 px list of 72 px rows with Archive and Delete.
  // It rests open at 144 and commits past 336.
  const panel = swipeGeometry(560, 72, 2)
  // The fingers travel 60 px and lift at speed; the trackpad keeps going.
  const fingers = [2, 6, 12, 18, 22]
  const flick = [...fingers, ...momentumTail(22)]

  test("a short flick's inertia tail is several times the flick itself", () => {
    const total = flick.reduce((sum, delta) => sum + delta, 0)
    // Summing every delta, as the row once did, carries it past the commit
    // threshold: the bug this guards against.
    assert.ok(total > panel.commitWidth, `${total} should exceed ${panel.commitWidth}`)
  })

  test("a short flick with an inertia tail reveals the actions and never commits", () => {
    const { release, coasted } = replayWheel(flick, { at: panel })
    assert.equal(coasted, true)
    assert.deepEqual(release, { kind: "open" })
  })

  test("a short flick at 120 Hz, where inertia decays more slowly per event, never commits", () => {
    const fast = [1, 3, 6, 9, 11, ...momentumTail(11, 0.98)]
    assert.ok(fast.reduce((sum, delta) => sum + delta, 0) > panel.commitWidth)
    assert.deepEqual(replayWheel(fast, { at: panel, frameMs: 8 }).release, { kind: "open" })
  })

  test("inertia never carries an open row into a commit", () => {
    const { release } = replayWheel(flick, { at: panel, start: panel.openWidth })
    assert.deepEqual(release, { kind: "open" })
  })

  test("a flick back toward the trailing edge closes an open row", () => {
    const back = flick.map((delta) => -delta)
    const { release } = replayWheel(back, { at: panel, start: panel.openWidth })
    assert.deepEqual(release, { kind: "closed" })
  })

  test("a coalesced pair of inertia events does not read as the fingers speeding up", () => {
    const tail = momentumTail(22)
    // Two frames delivered as one: twice the delta, over twice the time.
    const [first = 0, ...rest] = fingers
    let track = startWheelSwipe(first, 0)
    let time = 0
    for (const delta of rest) track = stepWheelSwipe(track, delta, (time += 16)).track
    let coasted = false
    for (const [index, delta] of tail.entries()) {
      if (index === 3) continue
      const merged = index === 2
      time += merged ? 32 : 16
      const step = stepWheelSwipe(track, merged ? delta + tail[3]! : delta, time)
      track = step.track
      if (step.event === "coast") {
        coasted = true
        break
      }
    }
    assert.equal(coasted, true)
    // The reach stops where the fingers lifted, not at the merged frame.
    assert.equal(track.reach, 60)
    assert.deepEqual(
      settleWheelSwipe({ track, start: 0, geometry: panel, committable: "archive" }),
      { kind: "open" },
    )
  })

  test("a deliberate long drag commits once the fingers themselves cross the threshold", () => {
    // Steady, wobbling finger travel well past 336, then a pause.
    const drag = [3, 6, 9, ...Array.from({ length: 36 }, (_, index) => (index % 2 ? 9 : 11))]
    assert.ok(drag.reduce((sum, delta) => sum + delta, 0) > panel.commitWidth)
    const { release, coasted } = replayWheel(drag, { at: panel })
    assert.equal(coasted, false)
    assert.deepEqual(release, { kind: "commit", actionId: "archive" })
  })

  test("a deliberate drag past the threshold still commits when the fingers ease off and lift", () => {
    const drag = [
      3, 6, 9,
      ...Array.from({ length: 36 }, (_, index) => (index % 2 ? 9 : 11)),
      8, 6, 4, 2, ...momentumTail(2),
    ]
    assert.deepEqual(replayWheel(drag, { at: panel }).release, {
      kind: "commit",
      actionId: "archive",
    })
  })

  test("a drag that stops short of the threshold rests open", () => {
    const drag = [3, 6, 9, ...Array.from({ length: 16 }, (_, index) => (index % 2 ? 9 : 11))]
    assert.deepEqual(replayWheel(drag, { at: panel }).release, { kind: "open" })
  })

  test("while inertia may be carrying the row, only the fingers' reach counts", () => {
    let track = startWheelSwipe(300, 0, { previous: 20, grew: true })
    for (const [index, delta] of [19, 18, 17].entries()) {
      track = stepWheelSwipe(track, delta, (index + 1) * 16).track
    }
    // Drawn where the deltas put it, judged where the fingers left it.
    assert.equal(track.travel, 354)
    assert.equal(track.reach, 300)
    assert.equal(track.phase, "fingers")
    // A pixel's rise is inside inertia's rounding and proves nothing.
    track = stepWheelSwipe(track, 18, 64).track
    assert.equal(track.reach, 300)
    // A delta that clearly grows again is the fingers', and the reach
    // catches up.
    track = stepWheelSwipe(track, 22, 80).track
    assert.equal(track.reach, 394)
  })

  test("inertia left over from an earlier gesture never opens a row", () => {
    // The row under the pointer changed mid-flick: this gesture is only tail.
    const { release } = replayWheel(momentumTail(20), { at: panel })
    assert.deepEqual(release, { kind: "closed" })
  })

  test("fingers back on the trackpad after a flick start a fresh gesture", () => {
    let track = replayTrack(flick)
    assert.equal(track.phase, "coasting")
    // Inertia keeps shrinking and is swallowed.
    let step = stepWheelSwipe(track, 1, 2000)
    assert.equal(step.event, "ignore")
    // Inertia never speeds up: fingers landing do.
    step = stepWheelSwipe(step.track, 3, 2016)
    assert.equal(step.event, "resume")
    assert.equal(step.track.phase, "fingers")
    assert.equal(step.track.travel, 3)
    // Turning around is always the fingers.
    track = replayTrack(flick)
    assert.equal(stepWheelSwipe(track, -3, 2000).event, "resume")
  })

  test("inertia arriving at uneven intervals is still inertia", () => {
    // Deltas follow the time each event covers, so a late event is larger
    // than the one before even as the scroll slows down.
    const gaps = [7, 10, 8, 11, 7, 9]
    const fingerDeltas = [1, 3, 6, 9, 12, 14]
    let track = startWheelSwipe(fingerDeltas[0]!, 0)
    let time = 0
    for (const delta of fingerDeltas.slice(1)) {
      track = stepWheelSwipe(track, delta, (time += 8)).track
    }
    let speed = 14 / 8.33
    let coasted = false
    for (let index = 0; speed * 8 >= 0.5; index += 1) {
      const gap = gaps[index % gaps.length]!
      speed *= 0.96 ** (gap / 8.33)
      const step = stepWheelSwipe(track, speed * gap, (time += gap))
      track = step.track
      if (step.event === "coast") {
        coasted = true
        break
      }
    }
    assert.equal(coasted, true)
    assert.equal(track.reach, 45)
    assert.notEqual(
      settleWheelSwipe({ track, start: 0, geometry: panel, committable: "archive" }).kind,
      "commit",
    )
  })

  test("inertia whose rounding ticks up a pixel is still inertia", () => {
    const tail = [18, 17, 15, 16, 14, 13, 11, 12, 10, 9, 8, 8, 7, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1]
    const { release, coasted } = replayWheel([2, 6, 12, 18, ...tail], {
      at: panel,
      frameMs: 1,
    })
    assert.equal(coasted, true)
    assert.deepEqual(release, { kind: "open" })
  })

  test("fingers that ease off and creep on keep driving the row", () => {
    // Steady, then slowing while still down — which reads as inertia — then
    // creeping on toward the commit threshold.
    let track = replayTrack([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 8, 6, 5, 4, 3])
    assert.equal(track.phase, "coasting")
    let time = track.time
    let step = stepWheelSwipe(track, 2, (time += 16))
    assert.equal(step.event, "ignore")
    step = stepWheelSwipe(step.track, 3, (time += 16))
    assert.equal(step.event, "resume")
    track = step.track
    for (const delta of [2, 3, 2, 3, 2, 3]) {
      step = stepWheelSwipe(track, delta, (time += 16))
      assert.notEqual(step.event, "coast")
      track = step.track
    }
    assert.equal(track.reach, 3 + 15)
  })

  test("a mouse's equal horizontal notches are all the fingers' travel", () => {
    const { release, coasted } = replayWheel([40, 40, 40, 40], { at: panel })
    assert.equal(coasted, false)
    assert.deepEqual(release, { kind: "open" })
    let track = startWheelSwipe(40, 0)
    for (const [index, delta] of [40, 40, 40].entries()) {
      track = stepWheelSwipe(track, delta, (index + 1) * 16).track
    }
    assert.equal(track.reach, 160)
  })

  test("equal notches from a mouse wheel that is slowing down are still travel", () => {
    let track = startWheelSwipe(40, 0)
    let time = 0
    for (const gap of [20, 25, 35, 45, 60, 80, 100, 120, 130]) {
      const step = stepWheelSwipe(track, 40, (time += gap))
      assert.equal(step.event, "move")
      track = step.track
    }
    assert.equal(track.reach, 400)
  })

  test("inertia at gaps either side of the timing floor is still inertia", () => {
    for (const gaps of [[3, 9], [3.5, 13]]) {
      let track = startWheelSwipe(1, 0)
      let time = 0
      for (const delta of [3, 6, 9, 12, 14]) track = stepWheelSwipe(track, delta, (time += 8)).track
      let speed = 14 / 8
      let coasted = false
      for (let index = 0; speed >= 0.05 && !coasted; index += 1) {
        const gap = gaps[index % 2]!
        speed *= 0.96 ** (gap / 8.33)
        const step = stepWheelSwipe(track, speed * gap, (time += gap))
        track = step.track
        coasted = step.event === "coast"
      }
      assert.equal(coasted, true, `gaps ${gaps.join("/")}`)
      assert.ok(track.reach < panel.commitWidth)
    }
  })

  test("fingers easing off gently right after a gesture begins or resumes keep driving it", () => {
    for (const [seed, deltas] of [
      [{ travel: 30, previous: 14, grew: true }, [13.6, 13.2, 12.8, 12.4, 12.4, 12.4, 12.4]],
      [{ travel: 12, previous: 12, grew: true }, [11.7, 11.4, 11.1, 10.8, 10.8, 10.8, 10.8]],
    ] as const) {
      let track = startWheelSwipe(seed.travel, 0, { previous: seed.previous, grew: seed.grew })
      for (const [index, delta] of deltas.entries()) {
        const step = stepWheelSwipe(track, delta, (index + 1) * 8.33)
        assert.equal(step.event, "move")
        track = step.track
      }
    }
  })

  test("a steady drag that wobbles a few percent is all the fingers' travel", () => {
    // A deterministic stand-in for Math.random.
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const wobble = [1.0, 0.96, 1.03, 0.97, 1.05, 0.95, 1.02, 0.98, 1.04, 0.96]
    const drags = [
      Array.from({ length: 48 }, (_, index) => 10 * wobble[index % 10]!),
      ...[0.03, 0.05, 0.08].flatMap((spread) =>
        Array.from({ length: 20 }, () =>
          Array.from({ length: 48 }, () => 10 * (1 + (random() * 2 - 1) * spread)),
        ),
      ),
    ]
    for (const steady of drags) {
      // Timestamps summed frame by frame, as a browser's are never exact.
      let track = startWheelSwipe(2, 0)
      let time = 0
      for (const delta of [5, 8, ...steady]) {
        const step = stepWheelSwipe(track, delta, (time += 8.33))
        assert.notEqual(step.event, "coast")
        track = step.track
      }
      // At most a trend's two stretches of deltas lag: a drag can end
      // partway into a dip that has not yet shown itself to be a wobble.
      assert.ok(track.travel - track.reach < 100, `${track.travel} vs ${track.reach}`)
      assert.equal(
        settleWheelSwipe({ track, start: 0, geometry: panel, committable: "archive" }).kind,
        "commit",
      )
    }
  })

  test("inertia on a fast display, decaying as slowly per event as it does, never commits", () => {
    // macOS inertia keeps about 0.998 of its speed per millisecond; at 240
    // and 360 Hz that is barely any loss from one event to the next.
    for (const hz of [60, 120, 240, 360]) {
      const frame = 1000 / hz
      let track = startWheelSwipe(1 * (frame / 8.33), 0)
      let time = 0
      for (const delta of [3, 6, 9, 12, 14]) {
        track = stepWheelSwipe(track, delta * (frame / 8.33), (time += frame)).track
      }
      let speed = 14 / 8.33
      let coasted = false
      while (speed > 0.02 && !coasted) {
        speed *= 0.998 ** frame
        const step = stepWheelSwipe(track, speed * frame, (time += frame))
        track = step.track
        coasted = step.event === "coast"
      }
      assert.equal(coasted, true, `${hz} Hz`)
      assert.ok(track.reach < panel.commitWidth, `${hz} Hz reach ${track.reach}`)
    }
  })

  test("a zero delta moves nothing", () => {
    const track = startWheelSwipe(10, 0)
    assert.equal(stepWheelSwipe(track, 0, 16).track, track)
  })
})

/** The gesture a sequence of deltas leaves behind, stopping at the first coast. */
function replayTrack(deltas: readonly number[]) {
  const [first = 0, ...rest] = deltas
  let track = startWheelSwipe(first, 0)
  for (const [index, delta] of rest.entries()) {
    const step = stepWheelSwipe(track, delta, (index + 1) * 16)
    track = step.track
    if (step.event === "coast") break
  }
  return track
}
