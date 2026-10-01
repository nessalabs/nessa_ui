/**
 * A story `beforeEach` that replaces `ResizeObserver` with one that never
 * reports, and restores the real one afterwards. It reproduces, in every
 * engine, what WebKit does to resizes caused by a web font or a content
 * change: nothing. A story run under it proves a component still measures
 * through the shared size observer's other triggers.
 */
export function silenceResizeObserver() {
  const real = window.ResizeObserver
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  return () => {
    window.ResizeObserver = real
  }
}

/**
 * Tells the document a web font finished loading, as `document.fonts` does
 * when one lands.
 */
export function announceFontLoaded(canvasElement: HTMLElement) {
  canvasElement.ownerDocument.fonts.dispatchEvent(new Event("loadingdone"))
}

/** Resolves after the browser has run `count` animation frames. */
export async function frames(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

/**
 * Resolves once the document's fonts have finished loading and every
 * measurement that scheduled has run, so a play test's next change is the
 * only thing left to measure for. Web fonts load lazily, and one landing
 * mid-test is a real measurement the test did not cause.
 */
export async function settleMeasurements(canvasElement: HTMLElement) {
  await canvasElement.ownerDocument.fonts.ready
  await frames(2)
}
