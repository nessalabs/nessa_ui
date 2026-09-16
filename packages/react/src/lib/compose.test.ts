/** @responsibility Verifies that composed refs and event handlers never silently drop one side. */

import assert from "node:assert/strict"
import test from "node:test"

import { composeEventHandler, composeRefs } from "./compose"

/**
 * A stand-in for the object ref a component keeps for itself, and for the
 * callback ref a consumer may pass instead.
 */
function objectRef<T>() {
  return { current: null as T | null }
}

test("every ref receives the element, whatever kind it is", () => {
  const own = objectRef<string>()
  const theirs = objectRef<string>()
  const seen: (string | null)[] = []
  const attach = composeRefs<string>(own, (element) => {
    seen.push(element)
  }, theirs)

  attach("element")

  assert.equal(own.current, "element")
  assert.equal(theirs.current, "element")
  assert.deepEqual(seen, ["element"])
})

test("a missing consumer ref is not an error, and the component keeps its own", () => {
  const own = objectRef<string>()
  composeRefs<string>(own, undefined)("element")
  assert.equal(own.current, "element")
  composeRefs<string>(own, null)("replacement")
  assert.equal(own.current, "replacement")
})

test("detaching clears object refs and runs a callback ref's React 19 cleanup", () => {
  const own = objectRef<string>()
  let cleaned = 0
  const detach = composeRefs<string>(own, () => () => {
    cleaned += 1
  })("element")

  assert.equal(own.current, "element")
  assert.equal(cleaned, 0)
  detach?.()
  assert.equal(own.current, null)
  assert.equal(cleaned, 1)
})

test("a legacy callback ref that returns nothing is still called with null", () => {
  const seen: (string | null)[] = []
  const detach = composeRefs<string>((element) => {
    seen.push(element)
  })("element")
  detach?.()
  assert.deepEqual(seen, ["element", null])
})

/**
 * The failure this guards is invisible in the common case: with one object
 * ref and one callback ref the indices happen to line up often enough that a
 * naive implementation looks correct. It only goes wrong once an object ref
 * sits *before* a callback ref and a second callback follows, at which point
 * a ref runs somebody else's cleanup.
 */
test("each callback ref runs its own cleanup, even behind an object ref", () => {
  const own = objectRef<string>()
  const ran: string[] = []
  const detach = composeRefs<string>(
    own,
    () => () => { ran.push("first") },
    () => () => { ran.push("second") },
  )("element")

  detach?.()
  // Reverse order: the ref attached last is torn down first.
  assert.deepEqual(ran, ["second", "first"])
})

test("a host handler runs before the component's own behavior", () => {
  const order: string[] = []
  composeEventHandler<{ defaultPrevented: boolean }>(
    () => { order.push("host") },
    () => { order.push("component") },
  )({ defaultPrevented: false })
  assert.deepEqual(order, ["host", "component"])
})

test("preventDefault in the host handler suppresses the component's behavior", () => {
  let ours = 0
  const event = { defaultPrevented: false }
  composeEventHandler<typeof event>(
    (incoming) => { incoming.defaultPrevented = true },
    () => { ours += 1 },
  )(event)
  assert.equal(ours, 0)
})

test("the component's behavior still runs when the host passes no handler", () => {
  let ours = 0
  composeEventHandler<{ defaultPrevented: boolean }>(undefined, () => { ours += 1 })({ defaultPrevented: false })
  assert.equal(ours, 1)
})
