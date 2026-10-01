import * as React from "react"

/**
 * The one place that decides when an element's size may have changed.
 *
 * A `ResizeObserver` alone is not enough. WebKit does not always report a
 * resize that a web font or a content change causes: a glass segmented
 * control's lens stayed at the fallback font's width after Geist loaded, and a
 * selection tooltip's comment band stayed at its empty height after a comment
 * rendered into it. So the element's content and the document's fonts are
 * watched directly as well, and every component that measures text or content
 * subscribes here rather than wiring its own observers.
 */

/**
 * What may have changed an element's size: its box was reported resized, its
 * content changed, or a web font finished loading.
 */
export type SizeChangeCause = "resize" | "content" | "fonts"

export interface ObserveSizeOptions {
  /**
   * Further elements whose own resize matters, such as the rows inside a
   * container that can grow while the container holds its size. Collected when
   * observation starts and again after every content change, so a row added
   * later is followed too.
   */
  boxes?: (element: Element) => Iterable<Element | null | undefined>
}

/**
 * Attributes that can lay an element out: its classes and inline style, its
 * direction, and whether it is hidden.
 */
const LAYOUT_ATTRIBUTES = ["class", "style", "dir", "hidden"]

const noop = () => {}

/**
 * Calls `onChange` whenever `element`'s size may have changed, until the
 * returned function is called.
 *
 * - A box resize is reported in the frame it is laid out, before paint, as
 *   `resize`. That includes the report a `ResizeObserver` makes when
 *   observation starts.
 * - A change to the element's subtree (children, text, or an attribute that
 *   lays it out) is reported as `content`, and a web font finishing its load,
 *   or the document's fonts settling, as `fonts`. Any burst of these is
 *   reported once, on the next animation frame, with the cause that started
 *   it.
 *
 * `onChange` measures and acts; it is not called when observation starts, so
 * the caller takes its first measurement itself. Changes `onChange` makes to
 * the element's subtree while it runs are not reported back to it.
 *
 * Each API is used only where the element's window has it. Where it has none
 * — an element from a server render, a document without a view — nothing is
 * observed and the returned function does nothing.
 */
export function observeSize(
  element: Element,
  onChange: (cause: SizeChangeCause) => void,
  options: ObserveSizeOptions = {},
): () => void {
  const document = element.ownerDocument as Document | undefined
  const view = document?.defaultView as (Window & typeof globalThis) | null | undefined
  if (!document || !view) return noop

  let stopped = false
  // Cancels the scheduled flush, or null when none is scheduled.
  let cancelFlush: (() => void) | null = null
  let pendingCause: SizeChangeCause | null = null
  let contentChanged = false

  const resizes =
    typeof view.ResizeObserver === "function"
      ? new view.ResizeObserver(() => {
          if (stopped) return
          report("resize")
        })
      : null
  const mutations =
    typeof view.MutationObserver === "function"
      ? new view.MutationObserver(() => {
          contentChanged = true
          schedule("content")
        })
      : null

  // The boxes followed besides the element itself. Kept as a set and diffed
  // rather than disconnected and re-observed: re-observing every box would
  // make each one report again, which is a measurement for nothing.
  const observedBoxes = new Set<Element>()
  const followBoxes = () => {
    if (!resizes || !options.boxes) return
    const next = new Set<Element>()
    for (const box of options.boxes(element)) {
      if (box && box !== element) next.add(box)
    }
    for (const box of observedBoxes) {
      if (!next.has(box)) resizes.unobserve(box)
    }
    for (const box of next) {
      if (!observedBoxes.has(box)) resizes.observe(box)
    }
    observedBoxes.clear()
    for (const box of next) observedBoxes.add(box)
  }

  function report(cause: SizeChangeCause) {
    onChange(cause)
    // What the measurement wrote into the subtree itself — a lens moved, a
    // textarea's height set — is its own doing, not a change to measure for.
    mutations?.takeRecords()
  }

  function flush() {
    cancelFlush = null
    const cause = pendingCause
    pendingCause = null
    if (stopped || cause === null) return
    if (contentChanged) {
      contentChanged = false
      followBoxes()
    }
    report(cause)
  }

  function schedule(cause: SizeChangeCause) {
    if (stopped) return
    pendingCause ??= cause
    if (cancelFlush !== null) return
    const host = view!
    if (typeof host.requestAnimationFrame === "function") {
      const id = host.requestAnimationFrame(flush)
      cancelFlush = () => host.cancelAnimationFrame(id)
    } else {
      const id = host.setTimeout(flush, 0)
      cancelFlush = () => host.clearTimeout(id)
    }
  }

  resizes?.observe(element)
  followBoxes()
  mutations?.observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: LAYOUT_ATTRIBUTES,
  })

  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  const onFonts = () => schedule("fonts")
  fonts?.addEventListener?.("loadingdone", onFonts)
  // Once, for a font that finished loading before this subscribed but after
  // the caller measured.
  void fonts?.ready?.then(onFonts, noop)

  return () => {
    if (stopped) return
    stopped = true
    cancelFlush?.()
    cancelFlush = null
    fonts?.removeEventListener?.("loadingdone", onFonts)
    resizes?.disconnect()
    mutations?.disconnect()
    observedBoxes.clear()
  }
}

/** An element's content-box size, in whole CSS pixels. */
export interface MeasuredSize {
  width: number
  height: number
}

/**
 * The element's content-box size in whole pixels, kept current through
 * {@link observeSize}, or `null` until the first measurement — which never
 * happens on a server.
 *
 * The size is taken from layout, not from the element's painted rectangle, so
 * a transform on an ancestor (a dialog scaling in) does not shrink it. The
 * returned object keeps its identity until the size actually changes.
 */
export function useMeasuredSize(
  ref: React.RefObject<HTMLElement | null>,
): MeasuredSize | null {
  const [size, setSize] = React.useState<MeasuredSize | null>(null)
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const next = contentBoxSize(element)
      setSize((previous) =>
        previous &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      )
    }
    measure()
    return observeSize(element, measure)
  }, [ref])
  return size
}

/**
 * The element's content box from layout: its client size, which excludes
 * borders and scrollbars and ignores transforms, less its padding.
 */
function contentBoxSize(element: HTMLElement): MeasuredSize {
  const css = element.ownerDocument.defaultView?.getComputedStyle(element)
  const pixels = (value: string | undefined) => Number.parseFloat(value ?? "") || 0
  const width =
    element.clientWidth - pixels(css?.paddingLeft) - pixels(css?.paddingRight)
  const height =
    element.clientHeight - pixels(css?.paddingTop) - pixels(css?.paddingBottom)
  return {
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  }
}
