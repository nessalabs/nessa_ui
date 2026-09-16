/** @responsibility Verifies that one hung Mermaid render can never strand the diagrams queued behind it. */

import assert from "node:assert/strict"
import test from "node:test"

import { MermaidRenderQueue, type RenderQueueClock } from "./mermaid-render-queue"

/** A clock the test advances by hand, so no test waits on a real timeout. */
function manualClock() {
  const pending = new Map<number, () => void>()
  let next = 1
  const clock: RenderQueueClock = {
    setTimeout: (handler) => {
      const handle = next++
      pending.set(handle, handler)
      return handle
    },
    clearTimeout: (handle) => {
      if (handle !== undefined) pending.delete(handle)
    },
  }
  return {
    clock,
    /** Fires every armed deadline, as a real clock reaching the timeout would. */
    expire: () => {
      const due = [...pending.values()]
      pending.clear()
      for (const handler of due) handler()
    },
    get armed() {
      return pending.size
    },
  }
}

/** A render that resolves, so ordinary progress is covered too. */
const settles = <T,>(value: T) => () => Promise.resolve(value)
/** A render that never settles, the way a wedged Mermaid parse behaves. */
const hangs = () => () => new Promise<never>(() => {})
/** Lets already-resolved promise jobs drain. */
const flush = () => new Promise((resolve) => setImmediate(resolve))

test("a render that finishes in time reports its value", async () => {
  const { clock } = manualClock()
  const queue = new MermaidRenderQueue(clock)
  assert.deepEqual(await queue.run(settles("<svg/>"), 10), { status: "rendered", value: "<svg/>" })
  assert.equal(queue.quarantined, false)
})

test("a render that throws is reported, and the queue keeps going", async () => {
  const { clock } = manualClock()
  const queue = new MermaidRenderQueue(clock)
  const boom = new Error("unparseable")
  const outcome = await queue.run(() => Promise.reject(boom), 10)
  assert.deepEqual(outcome, { status: "failed", error: boom })
  assert.equal(queue.quarantined, false)
  assert.deepEqual(await queue.run(settles("<svg/>"), 10), { status: "rendered", value: "<svg/>" })
})

/**
 * The deadlock this class exists to prevent, and the one a caller-owned
 * timeout reintroduces: if the hung render's deadline can be cancelled from
 * outside, neither side of the race ever settles, the queue link never
 * completes, and every diagram behind it waits forever.
 */
test("a hung render never strands the diagrams queued behind it", async () => {
  const { clock, expire } = manualClock()
  const queue = new MermaidRenderQueue(clock)

  const first = queue.run(hangs(), 10)
  await flush()
  expire()
  assert.deepEqual(await first, { status: "timed-out" })
  assert.equal(queue.quarantined, true)

  // The next diagram settles immediately rather than waiting for a turn that
  // is not coming — and without calling `start`, because the hung render
  // still owns the global config.
  let started = false
  const second = await queue.run(() => { started = true; return Promise.resolve("<svg/>") }, 10)
  assert.deepEqual(second, { status: "quarantined" })
  assert.equal(started, false)
})

test("the quarantine lifts when the stuck render finally settles", async () => {
  const { clock, expire } = manualClock()
  const queue = new MermaidRenderQueue(clock)
  let release: (value: string) => void = () => {}
  const first = queue.run(() => new Promise<string>((resolve) => { release = resolve }), 10)
  await flush()
  expire()
  assert.deepEqual(await first, { status: "timed-out" })
  assert.equal(queue.quarantined, true)

  release("<svg/>")
  await flush()
  assert.equal(queue.quarantined, false)
  assert.deepEqual(await queue.run(settles("<svg/>"), 10), { status: "rendered", value: "<svg/>" })
})

/**
 * Two hangs in a row: the first render settling late must not lift a
 * quarantine the second one is still holding, which a boolean flag would.
 */
test("a late settlement cannot lift a quarantine another render is holding", async () => {
  const { clock, expire } = manualClock()
  const queue = new MermaidRenderQueue(clock)
  let releaseFirst: (value: string) => void = () => {}
  const first = queue.run(() => new Promise<string>((resolve) => { releaseFirst = resolve }), 10)
  await flush()
  expire()
  await first

  // The first settles, lifting its own quarantine.
  releaseFirst("<svg/>")
  await flush()
  assert.equal(queue.quarantined, false)

  // A second render hangs and raises its own.
  const second = queue.run(hangs(), 10)
  await flush()
  expire()
  assert.deepEqual(await second, { status: "timed-out" })
  assert.equal(queue.quarantined, true)

  // The first settling again (it cannot, but a stale handler would) must not
  // clear the second's quarantine.
  await flush()
  assert.equal(queue.quarantined, true)
})

/**
 * Cancelling queued work is not the same as interrupting active work, and
 * conflating them fails in both directions. A job whose caller went away
 * while it waited must not take a turn: it would mutate the global config
 * nobody is waiting on, and — if it then hung — quarantine the diagram behind
 * it, which is still mounted and still wants its render.
 */
test("a job cancelled while queued never starts, and never blocks the one behind it", async () => {
  const { clock, expire } = manualClock()
  const queue = new MermaidRenderQueue(clock)

  let releaseFirst: (value: string) => void = () => {}
  const first = queue.run(() => new Promise<string>((resolve) => { releaseFirst = resolve }), 10)
  await flush()

  // B queues behind A, then its component unmounts.
  let obsoleteStarted = false
  let wanted = true
  const obsolete = queue.run(
    () => { obsoleteStarted = true; return new Promise<string>(() => {}) },
    10,
    () => wanted,
  )
  wanted = false

  // C queues behind B and stays mounted.
  let liveStarted = false
  const live = queue.run(() => { liveStarted = true; return Promise.resolve("<svg/>") }, 10, () => true)

  releaseFirst("<svg/>")
  assert.deepEqual(await first, { status: "rendered", value: "<svg/>" })
  assert.deepEqual(await obsolete, { status: "cancelled" })
  assert.equal(obsoleteStarted, false, "an unwanted job must not touch the renderer")
  assert.deepEqual(await live, { status: "rendered", value: "<svg/>" })
  assert.equal(liveStarted, true)
  assert.equal(queue.quarantined, false, "a job that never ran cannot quarantine the queue")
  assert.equal(expire, expire)
})

/**
 * The other half of the same line: cancellation applies while a job waits,
 * never once it is running. A render that has started owns the global config,
 * so its deadline has to survive its caller walking away.
 */
test("cancellation after the render starts does not disarm the deadline", async () => {
  const { clock, expire } = manualClock()
  const queue = new MermaidRenderQueue(clock)
  let wanted = true
  const running = queue.run(hangs(), 10, () => wanted)
  await flush()
  // The component unmounts mid-render. The job is already past the question.
  wanted = false
  expire()
  assert.deepEqual(await running, { status: "timed-out" })
  assert.equal(queue.quarantined, true)
})

test("each dequeued render arms its deadline and clears it on settlement", async () => {
  const state = manualClock()
  const queue = new MermaidRenderQueue(state.clock)
  await queue.run(settles("<svg/>"), 10)
  assert.equal(state.armed, 0, "a settled render leaves no timer behind")
})
