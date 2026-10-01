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

/**
 * Every cause behind one report. A frame can hold several — a content change
 * and a web font landing together — and none is folded into another, so a
 * caller that acts on one cause (a font rewrapping text) still sees it.
 */
export type SizeChanges = ReadonlySet<SizeChangeCause>

export interface ObserveSizeOptions {
  /**
   * Further elements whose own resize matters, such as the rows inside a
   * container that can grow while the container holds its size. Collected when
   * observation starts and again after every content change, so a row added
   * later is followed too. A box `onChange` adds itself is picked up at the
   * next content change.
   */
  boxes?: (element: Element) => Iterable<Element | null | undefined>
  /**
   * Content changes that cannot change the size being measured, such as the
   * component's own positioning style or a region the measurement excludes.
   * A batch of mutation records is reported only if one of them is not
   * ignored. Changes `onChange` makes itself are already left out.
   */
  ignoreMutation?: (record: MutationRecord) => boolean
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
 *   or the document's fonts settling while a load is under way, as `fonts`.
 *   Any burst of these is reported once, on the next animation frame, with
 *   every cause it held.
 *
 * A report says the size *may* have changed. `onChange` measures, compares
 * with what it last acted on, and acts only on a real difference; that is
 * what keeps a report it did not need cheap. It is not called when
 * observation starts, so the caller takes its first measurement itself.
 * Mutations queued while `onChange` runs are treated as its own and not
 * reported back to it — including anything a `flushSync` inside it commits.
 *
 * Each API is used only where the element's window has it. Where it has none
 * — an element from a server render, a document without a view — nothing is
 * observed and the returned function does nothing.
 */
export function observeSize(
  element: Element,
  onChange: (changes: SizeChanges) => void,
  options: ObserveSizeOptions = {},
): () => void {
  const document = element.ownerDocument as Document | undefined
  const view = document?.defaultView as (Window & typeof globalThis) | null | undefined
  if (!document || !view) return noop

  let stopped = false
  // Cancels the scheduled flush, or null when none is scheduled.
  let cancelFlush: (() => void) | null = null
  let pending = new Set<SizeChangeCause>()
  let contentChanged = false

  const resizes =
    typeof view.ResizeObserver === "function"
      ? new view.ResizeObserver(() => {
          if (stopped) return
          report(new Set(["resize"]))
        })
      : null
  const mutations =
    typeof view.MutationObserver === "function"
      ? new view.MutationObserver((records) => {
          const ignore = options.ignoreMutation
          if (ignore && records.every((record) => ignore(record))) return
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

  function report(changes: SizeChanges) {
    onChange(changes)
    // What the measurement wrote into the subtree itself — a lens moved, a
    // textarea's height set — is its own doing, not a change to measure for.
    mutations?.takeRecords()
  }

  function flush() {
    cancelFlush = null
    const changes = pending
    pending = new Set()
    if (stopped || changes.size === 0) return
    if (contentChanged) {
      contentChanged = false
      followBoxes()
    }
    report(changes)
  }

  function schedule(cause: SizeChangeCause) {
    if (stopped) return
    pending.add(cause)
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
    attributeOldValue: true,
  })

  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  const onFonts = () => schedule("fonts")
  fonts?.addEventListener?.("loadingdone", onFonts)
  // Once more when a load already under way settles. A settled set has
  // nothing left to land, and its resolved promise would only schedule a
  // measurement for nothing on every subscription.
  if (fonts?.status === "loading") void fonts.ready?.then(onFonts, noop)

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

/**
 * Whether `record` is a change to an element's inline style that touched
 * nothing but `properties` — positioning a component writes on every frame,
 * such as `transform` or `left`, which cannot change the element's size.
 * Every other inline style change, including one a host makes through the
 * same `style` attribute, is not matched. For {@link ObserveSizeOptions}'
 * `ignoreMutation`.
 */
export function changesOnlyStyle(
  record: MutationRecord,
  properties: readonly string[],
): boolean {
  if (record.type !== "attributes" || record.attributeName !== "style") {
    return false
  }
  const ignored = new Set(properties.map(propertyKey))
  const rest = (value: string | null) =>
    declarations(value ?? "")
      .filter((declaration) => {
        const colon = declaration.indexOf(":")
        return colon === -1 || !ignored.has(propertyKey(declaration.slice(0, colon)))
      })
      .join(";")
  return (
    rest(record.oldValue) === rest((record.target as Element).getAttribute("style"))
  )
}

/**
 * A property name as CSS compares it: standard names ignore case, custom
 * properties (`--name`) do not.
 */
function propertyKey(name: string) {
  const trimmed = name.trim()
  return trimmed.startsWith("--") ? trimmed : trimmed.toLowerCase()
}

/**
 * The declarations of an inline style string, split on the semicolons that
 * end them — not on one inside a quoted string or a function such as `url()`.
 */
function declarations(style: string) {
  const parts: string[] = []
  let current = ""
  let quote: string | null = null
  let depth = 0
  for (const character of style) {
    if (quote) {
      if (character === quote) quote = null
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === "(") {
      depth += 1
    } else if (character === ")") {
      depth = Math.max(0, depth - 1)
    } else if (character === ";" && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ""
      continue
    }
    current += character
  }
  if (current.trim()) parts.push(current.trim())
  return parts
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
