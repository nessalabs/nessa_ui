/** @responsibility Verifies that observeSize reports every way an element's size can change, once per frame, and stops cleanly. */

import assert from "node:assert/strict"
import test from "node:test"

import { observeSize, type SizeChangeCause } from "./size-observer"

/**
 * A window with hand-driven observers, fonts and frames, so each trigger can
 * be fired on its own and the frame it lands in run on demand.
 */
function fakeWindow() {
  const resizeObservers: FakeResizeObserver[] = []
  const mutationObservers: FakeMutationObserver[] = []
  let frames = new Map<number, () => void>()
  let nextFrame = 1

  class FakeResizeObserver {
    observed = new Set<unknown>()
    disconnected = false
    constructor(readonly callback: () => void) {
      resizeObservers.push(this)
    }
    observe(target: unknown) {
      this.observed.add(target)
    }
    unobserve(target: unknown) {
      this.observed.delete(target)
    }
    disconnect() {
      this.observed.clear()
      this.disconnected = true
    }
  }

  class FakeMutationObserver {
    target: unknown = null
    init: MutationObserverInit | null = null
    pending = 0
    disconnected = false
    constructor(readonly callback: () => void) {
      mutationObservers.push(this)
    }
    observe(target: unknown, init: MutationObserverInit) {
      this.target = target
      this.init = init
    }
    takeRecords() {
      const taken = this.pending
      this.pending = 0
      return Array.from({ length: taken })
    }
    disconnect() {
      this.disconnected = true
    }
  }

  let resolveReady: () => void = () => {}
  const fonts = Object.assign(new EventTarget(), {
    ready: new Promise<void>((resolve) => {
      resolveReady = resolve
    }),
  })

  const view = {
    ResizeObserver: FakeResizeObserver,
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame(callback: () => void) {
      const id = nextFrame++
      frames.set(id, callback)
      return id
    },
    cancelAnimationFrame(id: number) {
      frames.delete(id)
    },
    setTimeout,
    clearTimeout,
  }
  const document = { defaultView: view, fonts }
  const element = { ownerDocument: document } as unknown as Element

  return {
    element,
    fonts,
    resolveReady: () => resolveReady(),
    resizeObserver: () => resizeObservers[0]!,
    mutationObserver: () => mutationObservers[0]!,
    pendingFrames: () => frames.size,
    /** Runs every frame scheduled so far, as the browser would next frame. */
    runFrame() {
      const due = frames
      frames = new Map()
      for (const callback of due.values()) callback()
    },
  }
}

function record() {
  const causes: SizeChangeCause[] = []
  return { causes, onChange: (cause: SizeChangeCause) => causes.push(cause) }
}

test("a box resize is reported at once, in the frame it is laid out", () => {
  const env = fakeWindow()
  const { causes, onChange } = record()
  observeSize(env.element, onChange)

  assert.ok(env.resizeObserver().observed.has(env.element))
  env.resizeObserver().callback()

  assert.deepEqual(causes, ["resize"])
  assert.equal(env.pendingFrames(), 0)
})

test("a content change is reported on the next frame", () => {
  const env = fakeWindow()
  const { causes, onChange } = record()
  observeSize(env.element, onChange)

  const mutations = env.mutationObserver()
  assert.equal(mutations.target, env.element)
  assert.equal(mutations.init?.childList, true)
  assert.equal(mutations.init?.subtree, true)
  assert.equal(mutations.init?.characterData, true)
  assert.deepEqual(mutations.init?.attributeFilter, ["class", "style", "dir", "hidden"])

  mutations.callback()
  assert.deepEqual(causes, [])
  env.runFrame()
  assert.deepEqual(causes, ["content"])
})

test("a web font finishing its load is reported", () => {
  const env = fakeWindow()
  const { causes, onChange } = record()
  observeSize(env.element, onChange)

  env.fonts.dispatchEvent(new Event("loadingdone"))
  env.runFrame()

  assert.deepEqual(causes, ["fonts"])
})

test("the document's fonts settling is reported once", async () => {
  const env = fakeWindow()
  const { causes, onChange } = record()
  observeSize(env.element, onChange)

  env.resolveReady()
  await Promise.resolve()
  env.runFrame()

  assert.deepEqual(causes, ["fonts"])
})

test("a burst of changes in one frame is measured once, with the cause that started it", () => {
  const env = fakeWindow()
  const { causes, onChange } = record()
  observeSize(env.element, onChange)

  env.mutationObserver().callback()
  env.mutationObserver().callback()
  env.fonts.dispatchEvent(new Event("loadingdone"))
  env.mutationObserver().callback()
  assert.equal(env.pendingFrames(), 1)

  env.runFrame()
  assert.deepEqual(causes, ["content"])

  env.fonts.dispatchEvent(new Event("loadingdone"))
  env.runFrame()
  assert.deepEqual(causes, ["content", "fonts"])
})

test("what the measurement writes into the subtree is not reported back", () => {
  const env = fakeWindow()
  const mutations = () => env.mutationObserver()
  const causes: SizeChangeCause[] = []
  observeSize(env.element, (cause) => {
    causes.push(cause)
    // The measurement moves something inside the element.
    mutations().pending += 1
  })

  env.resizeObserver().callback()
  assert.equal(mutations().pending, 0)

  mutations().callback()
  env.runFrame()
  assert.equal(mutations().pending, 0)
  assert.deepEqual(causes, ["resize", "content"])
})

test("further boxes are followed, and collected again after content changes", () => {
  const env = fakeWindow()
  const first = { name: "first" }
  const second = { name: "second" }
  let rows: object[] = [first]
  observeSize(env.element, () => {}, {
    boxes: () => rows as unknown as Element[],
  })
  const observed = () => env.resizeObserver().observed

  assert.deepEqual([...observed()], [env.element, first])

  rows = [second]
  env.mutationObserver().callback()
  env.runFrame()
  assert.deepEqual([...observed()], [env.element, second])
})

test("stopping tears everything down and reports nothing after", async () => {
  const env = fakeWindow()
  const { causes, onChange } = record()
  const stop = observeSize(env.element, onChange)

  env.mutationObserver().callback()
  assert.equal(env.pendingFrames(), 1)
  stop()

  assert.equal(env.pendingFrames(), 0)
  assert.equal(env.resizeObserver().disconnected, true)
  assert.equal(env.mutationObserver().disconnected, true)
  assert.equal(env.resizeObserver().observed.size, 0)

  env.fonts.dispatchEvent(new Event("loadingdone"))
  env.resolveReady()
  await Promise.resolve()
  env.resizeObserver().callback()
  env.runFrame()
  assert.deepEqual(causes, [])
  assert.doesNotThrow(stop)
})

test("without a window, as on a server, nothing is observed and stopping is safe", () => {
  const { causes, onChange } = record()
  const detached = { ownerDocument: { defaultView: null } } as unknown as Element
  const bare = {} as unknown as Element

  const stopDetached = observeSize(detached, onChange)
  const stopBare = observeSize(bare, onChange)

  assert.doesNotThrow(stopDetached)
  assert.doesNotThrow(stopBare)
  assert.deepEqual(causes, [])
})

test("a window missing one API still uses the others", () => {
  const env = fakeWindow()
  const view = env.element.ownerDocument.defaultView as unknown as Record<string, unknown>
  delete view.ResizeObserver
  const { causes, onChange } = record()
  const stop = observeSize(env.element, onChange)

  env.mutationObserver().callback()
  env.runFrame()
  assert.deepEqual(causes, ["content"])
  stop()
})
