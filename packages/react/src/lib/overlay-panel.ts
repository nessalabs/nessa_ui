import * as React from "react"

/**
 * The mechanics every Nessa overlay panel needs and none of them should own
 * privately: reading motion out of the theme rather than out of a duplicated
 * constant, returning focus to whatever opened the panel, and following a
 * pointer that has left the small target it pressed.
 *
 * The panels themselves stay separate, because their frames are what makes
 * them different components — Sheet rises over its nearest positioned
 * ancestor and inerts only its siblings, Drawer is portalled, viewport-fixed
 * and modal to the whole document. Everything below is the part underneath
 * that split, and is shared verbatim.
 */

/**
 * A CSS time in milliseconds, or null for a value that is not one. `s` is the
 * unit a bare number is *not*: CSS requires the unit, so anything unparsed is
 * rejected rather than read as seconds.
 */
function parseCssDuration(value: string) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return null
  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

/** A CSS time in milliseconds, falling back for a value that is not one. */
export function cssDurationInMilliseconds(value: string, fallback: number) {
  return parseCssDuration(value) ?? fallback
}

export interface PanelMotion {
  /** The token's duration in milliseconds. `0` under reduced motion. */
  duration: number
  /** The token's easing, as a CSS timing function. */
  easing: string
}

/**
 * Reads one duration token and one easing token off an element, for motion a
 * panel drives from script rather than from CSS. The tokens collapse to `0ms`
 * under reduced motion, so a caller that skips a zero-duration animation
 * honours the preference without querying it separately.
 */
export function panelMotion(
  node: HTMLElement,
  durationToken: string,
  fallback: number,
  easingToken = "--nessa-motion-easing-standard",
): PanelMotion {
  const styles = getComputedStyle(node)
  return {
    duration: cssDurationInMilliseconds(
      styles.getPropertyValue(durationToken),
      fallback,
    ),
    easing: styles.getPropertyValue(easingToken).trim() || "ease-out",
  }
}

/**
 * How long the element's transition of one property runs, in milliseconds, so
 * a panel that must outlive its own exit is timed from its own CSS rather
 * than from a duplicated constant. The motion-duration tokens collapse to 0ms
 * under reduced motion, which a caller reads back as an immediate unmount.
 */
export function longestTransitionMs(node: HTMLElement, property: string) {
  const style = getComputedStyle(node)
  const list = (value: string) => value.split(",").map((entry) => entry.trim())
  const properties = list(style.transitionProperty)
  const durations = list(style.transitionDuration)
  const delays = list(style.transitionDelay)
  return properties.reduce((longest, candidate, index) => {
    // Only the named property keeps the panel mounted. A host className that
    // replaces the transition property — `transition-none`,
    // `transition-colors` — means there is nothing to wait for, however long
    // the duration says.
    if (candidate !== property && candidate !== "all") return longest
    // CSS repeats the shorter of the property and duration lists rather than
    // padding it, so the index wraps.
    const duration = parseCssDuration(durations[index % durations.length] ?? "") ?? 0
    const delay = parseCssDuration(delays[index % delays.length] ?? "") ?? 0
    return Math.max(longest, duration + delay)
  }, 0)
}

/**
 * The element a panel should hand focus back to when it closes, read at the
 * moment it opens.
 *
 * The body — and the documentElement behind it — is where focus sits when
 * nothing holds it: a programmatic open, a `defaultOpen`, or a browser that
 * does not focus a button on click (Safari, Firefox). It is the resting
 * state, not an opener, so it is reported as no opener at all and the panel's
 * own fallback decides instead.
 */
export function openerFromFocus(ownerDocument: Document | undefined | null) {
  const active = ownerDocument?.activeElement
  if (!(active instanceof HTMLElement)) return null
  if (active === ownerDocument?.body || active === ownerDocument?.documentElement) {
    return null
  }
  return active
}

/**
 * Hands focus back to the opener, or to the host's fallback when the opener
 * cannot take it — a row deleted from inside the panel it opened, a trigger
 * that unmounted while the panel was up.
 *
 * @returns whether focus actually landed on the opener, which a caller inside
 * another library's focus management uses to decide whether to claim the
 * restore or leave it alone.
 */
export function restoreFocusToOpener(
  opener: HTMLElement | null,
  onReturnFocus?: () => void,
) {
  if (!opener?.isConnected) {
    onReturnFocus?.()
    return false
  }
  opener.focus()
  return opener.ownerDocument.activeElement === opener
}

/**
 * The elements a panel's own Tab order can land on.
 *
 * The candidate selector is deliberately wide and the filtering is done in
 * script, because the things that disqualify a control are not expressible as
 * a selector: an element is out of the tab order when it is `display:none` or
 * `visibility:hidden`, when it or an ancestor is `inert` or `hidden`, when it
 * sits inside a closed `<details>`, or when it carries a negative
 * `tabindex` — including a `<button tabindex="-1">`, which every
 * `[tabindex]:not([tabindex="-1"])` selector still matches through its *tag*
 * clause and which a browser will never Tab to.
 *
 * Getting this wrong is not cosmetic. A trap that believes a hidden control
 * is first sends opening focus somewhere invisible, and one that believes a
 * `tabindex="-1"` button is last wraps onto an element Tab cannot reach, so
 * the next keystroke escapes the panel entirely.
 *
 * @param root - The panel whose descendants are searched. Excluded itself.
 * @returns The tabbable descendants, in document order.
 */
export function tabbableWithin(root: HTMLElement): HTMLElement[] {
  const candidates = root.querySelectorAll<HTMLElement>(
    "a[href], area[href], button, input, select, textarea, iframe, audio[controls], video[controls], summary, [contenteditable]:not([contenteditable=\"false\"]), [tabindex]",
  )
  return Array.from(candidates).filter((element) => isTabbable(element, root))
}

/** Whether Tab can reach this element, given the panel it is inside. */
function isTabbable(element: HTMLElement, root: HTMLElement): boolean {
  if (element.tabIndex < 0) return false
  // `disabled` is only a disqualifier on the elements that have it; an
  // attribute check alone would also reject `<div disabled>`, which is
  // focusable, and accept nothing it should.
  if ("disabled" in element && (element as { disabled?: boolean }).disabled) {
    return false
  }
  // `inert` and `hidden` are inherited by descendants, so the walk goes up to
  // the panel rather than looking at the element alone.
  for (
    let node: HTMLElement | null = element;
    node && node !== root.parentElement;
    node = node.parentElement
  ) {
    if (node.hasAttribute("inert") || node.hidden) return false
    if (
      node.parentElement instanceof HTMLDetailsElement &&
      !node.parentElement.open &&
      node.tagName !== "SUMMARY"
    ) {
      return false
    }
  }
  // Rendered-ness last: it is the only branch that costs layout or style
  // resolution. `checkVisibility` is the one call that answers for the whole
  // ancestor chain — `getComputedStyle(element).display` reports the
  // element's own value even inside a `display:none` ancestor, and
  // `offsetParent` is null for `position: fixed` content that is perfectly
  // visible. Where it is unavailable, a box-free element stands in: nothing
  // that generates no box can be Tabbed to.
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({
      checkVisibilityCSS: true,
      contentVisibilityAuto: true,
    })
  }
  return element.getClientRects().length > 0
}

/**
 * Moves focus into a panel that has just opened: its first tabbable control,
 * or the panel itself when it has none.
 *
 * The panel must carry `tabIndex={-1}` for the fallback to work; a panel that
 * cannot take focus leaves it on whatever opened the panel, outside the
 * boundary the panel is about to defend.
 *
 * @param root - The panel to move focus into.
 */
export function focusFirstWithin(root: HTMLElement) {
  ;(tabbableWithin(root)[0] ?? root).focus()
}

/**
 * The elements that own focus for whatever is inside them.
 *
 * A panel is not the only layer on the page. A menu, a listbox, or a dialog
 * that a control *inside* the panel opened is usually portalled to the body,
 * so it is not a descendant of the panel even though it belongs to it. Those
 * layers run their own focus management, and the panel underneath has to
 * stand down rather than compete with them.
 *
 * The popper wrapper is listed because that is the shape Radix portals take:
 * the role-bearing content sits inside a plain positioning wrapper, so a
 * check that only looked at roles would miss the element actually holding
 * the layer.
 */
const focusLayerSelector =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="menubar"], [role="listbox"], [role="tree"], [role="grid"], [data-radix-popper-content-wrapper], [data-nessa-layer]'

/**
 * The layer currently holding focus, when it is one the panel does not own.
 *
 * A layer nested *within* the panel is the panel's own business and is not
 * reported; only a layer outside it — the portalled menu its own trigger
 * opened — counts, because that is the case where the panel must not act.
 *
 * @param root - The panel asking.
 * @returns The foreign layer holding focus, or null.
 */
function foreignLayerWithFocus(root: HTMLElement): HTMLElement | null {
  const active = root.ownerDocument.activeElement
  if (!(active instanceof HTMLElement) || root.contains(active)) return null
  const layer = active.closest<HTMLElement>(focusLayerSelector)
  return layer && !root.contains(layer) ? layer : null
}

/**
 * Keeps Tab inside a panel for as long as the panel is open.
 *
 * Both directions wrap, and both directions also *recover*: focus that is
 * already outside the panel — moved there programmatically, or left on the
 * body after the focused control was removed — is pulled back in on the next
 * Tab rather than continuing out through the document. A panel with no
 * tabbable controls at all keeps focus on itself instead of letting the
 * keystroke through, which is the case a trap that returns early gets wrong.
 *
 * Recovery stops at another layer. Focus sitting in a portalled menu, popover
 * or dialog belongs to that layer, not to this panel, and the trap leaves it
 * alone until it closes and hands focus back.
 *
 * @param root - The panel Tab may not leave.
 * @returns The disposer that stops trapping.
 */
export function trapTabWithin(root: HTMLElement) {
  const ownerDocument = root.ownerDocument
  const handleTab = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || event.defaultPrevented) return
    // Only the topmost layer moves focus. A menu or dialog that something
    // inside this panel opened is portalled out of it, so `root.contains`
    // reads as "outside" and the recovery below would drag focus out of the
    // layer the user is actually in — off the search field of a picker on
    // the very first keystroke.
    if (foreignLayerWithFocus(root)) return
    const order = tabbableWithin(root)
    const current = ownerDocument.activeElement
    const inside = root.contains(current)
    if (order.length === 0) {
      // Nothing to move to, and letting the keystroke through would hand the
      // next control outside the panel a focus ring behind a modal surface.
      event.preventDefault()
      if (!inside) root.focus()
      return
    }
    const first = order[0]!
    const last = order[order.length - 1]!
    if (!inside) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
      return
    }
    if (event.shiftKey && current === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      first.focus()
    }
  }
  // Capture, so a control inside the panel that handles Tab itself still
  // cannot carry focus past the boundary.
  ownerDocument.addEventListener("keydown", handleTab, { capture: true })
  return () => {
    ownerDocument.removeEventListener("keydown", handleTab, { capture: true })
  }
}

/** A drag in progress, measured along the axis the gesture was opened on. */
export interface DragGesture {
  /** The pointer's position along the axis when the press landed. */
  origin: number
  /** Signed distance from the origin, in CSS pixels. */
  delta: number
}

export interface UseDragGestureOptions {
  /** The axis the gesture is measured along: `x` for `clientX`, `y` for `clientY`. */
  axis: "x" | "y"
  /**
   * Runs on the press, before the gesture opens. Return `false` to refuse it —
   * a handle whose panel has not been measured yet, say — and no drag starts.
   */
  onStart?: (event: React.PointerEvent<HTMLElement>) => boolean | void
  /** Runs on every pointer move while the gesture is open. */
  onMove?: (gesture: DragGesture) => void
  /**
   * Runs when the pointer is released. It is given the last *move*, not the
   * release: `clientY` is 0 on synthetic events and on some touch releases,
   * and reading the end from there looks like a large fling in whichever
   * direction the origin happens to lie.
   */
  onEnd?: (gesture: DragGesture) => void
  /** Runs when the platform cancels the gesture, and on an explicit `cancel()`. */
  onCancel?: () => void
}

/**
 * A pointer drag that survives leaving the element it started on.
 *
 * The gesture is followed on the document, not on the handle: a small target
 * is left behind by the first fast movement, and a pointer capture the
 * platform refuses would otherwise strand a drag that can never be ended.
 * Capture is still requested, as an affordance — it keeps the cursor and the
 * hover state on the handle for the whole drag — but nothing depends on it,
 * so synthetic events in tests drag and settle like real ones.
 *
 * One gesture at a time: a second finger landing on the handle must not drive
 * the drag from the first finger's origin.
 */
export function useDragGesture({
  axis,
  onStart,
  onMove,
  onEnd,
  onCancel,
}: UseDragGestureOptions) {
  const [dragging, setDragging] = React.useState(false)
  const gestureRef = React.useRef<{
    pointerId: number
    origin: number
    delta: number
    handle: HTMLElement
  } | null>(null)

  // The callbacks are reached through a box so the document listeners below
  // attach once per gesture: an inline `onMove` / `onStart` changes identity
  // on every render, and every drag step is a render.
  const handlers = React.useRef({ onStart, onMove, onEnd, onCancel })
  React.useLayoutEffect(() => {
    handlers.current = { onStart, onMove, onEnd, onCancel }
  })

  const release = React.useCallback(() => {
    const gesture = gestureRef.current
    gestureRef.current = null
    setDragging(false)
    if (!gesture) return null
    if (gesture.handle.hasPointerCapture(gesture.pointerId)) {
      gesture.handle.releasePointerCapture(gesture.pointerId)
    }
    return gesture
  }, [])

  /** Ends the gesture without settling it — for a handle whose panel is going away. */
  const cancel = React.useCallback(() => {
    if (!gestureRef.current) return
    release()
    handlers.current.onCancel?.()
  }, [release])

  const start = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || gestureRef.current) return
      if (handlers.current.onStart?.(event) === false) return
      const handle = event.currentTarget
      const origin = axis === "x" ? event.clientX : event.clientY
      gestureRef.current = { pointerId: event.pointerId, origin, delta: 0, handle }
      try {
        handle.setPointerCapture(event.pointerId)
      } catch {
        // Capture is optional; the document listeners below are not. A
        // synthetic pointer event (a play test) has no active pointer id.
      }
      setDragging(true)
    },
    [axis],
  )

  React.useEffect(() => {
    if (!dragging) return
    const gesture = gestureRef.current
    if (!gesture) return
    const ownerDocument = gesture.handle.ownerDocument
    const move = (event: PointerEvent) => {
      const current = gestureRef.current
      if (!current || current.pointerId !== event.pointerId) return
      const position = axis === "x" ? event.clientX : event.clientY
      current.delta = position - current.origin
      handlers.current.onMove?.({ origin: current.origin, delta: current.delta })
    }
    const end = (event: PointerEvent) => {
      if (gestureRef.current?.pointerId !== event.pointerId) return
      const settled = release()
      if (!settled) return
      handlers.current.onEnd?.({ origin: settled.origin, delta: settled.delta })
    }
    const abort = (event: PointerEvent) => {
      if (gestureRef.current?.pointerId !== event.pointerId) return
      release()
      handlers.current.onCancel?.()
    }
    ownerDocument.addEventListener("pointermove", move)
    ownerDocument.addEventListener("pointerup", end)
    ownerDocument.addEventListener("pointercancel", abort)
    return () => {
      ownerDocument.removeEventListener("pointermove", move)
      ownerDocument.removeEventListener("pointerup", end)
      ownerDocument.removeEventListener("pointercancel", abort)
    }
  }, [axis, dragging, release])

  return { dragging, start, cancel }
}
