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
 * Every panel currently trapping Tab, so a nested one can be recognized as a
 * real owner rather than guessed at from its markup.
 */
const activeTraps = new Set<HTMLElement>()

/**
 * Foreign layers that genuinely own the focus inside them.
 *
 * Every entry here is a *declaration*, not a shape. A menu and a Radix popper
 * wrapper manage their own keyboard navigation by construction, and
 * `aria-modal="true"` is the element saying outright that focus is contained
 * within it — which is exactly what a panel needs to know before standing
 * down.
 *
 * `role="dialog"` on its own is deliberately absent, and the reason is in
 * this package: ChatOverlay is a `role="dialog"` that does *not* trap Tab, on
 * purpose, so the chrome around it stays reachable. Treating the role as
 * ownership would make a modal Sheet defer to an inner trap that does not
 * exist, and Tab would leave the modal entirely — a worse failure than the
 * one the delegation was added to fix, because it is silent.
 *
 * In-flow widgets with their own arrow-key navigation are absent for a
 * different reason: Tab past a listbox or a tree is the panel's job.
 */
const foreignFocusOwnerSelector =
  '[role="menu"], [data-radix-popper-content-wrapper], [aria-modal="true"]'

/**
 * The thing that owns focus right now, when it is something nested inside or
 * beside this panel rather than the panel itself.
 *
 * Walks outward from the focused element and stops at whichever comes first:
 * a nested owner, or `root`. Reaching `root` first means focus is in the
 * panel's own content and the panel owns it.
 *
 * @param root - The panel asking.
 * @returns The nested owner holding focus, or null when the panel owns it.
 */
function focusOwnerWithin(root: HTMLElement): HTMLElement | null {
  const active = root.ownerDocument.activeElement
  if (!(active instanceof HTMLElement)) return null
  for (
    let node: HTMLElement | null = active;
    node;
    node = node.parentElement
  ) {
    if (node === root) return null
    if (activeTraps.has(node) || node.matches(foreignFocusOwnerSelector)) {
      return node
    }
  }
  return null
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
 * Recovery stops at a nested owner. Focus sitting in a menu, a popover, or
 * another trap belongs to that owner, not to this panel, and the trap leaves
 * it alone until it closes and hands focus back — whether that owner
 * portalled into the panel, as Nessa's own layers do, or sits somewhere else
 * entirely. Ownership is read from what a surface actually does, never from
 * its role alone: a nonmodal dialog nested inside a modal panel is still the
 * modal panel's to contain.
 *
 * @param root - The panel Tab may not leave.
 * @returns The disposer that stops trapping.
 */
export function trapTabWithin(root: HTMLElement) {
  const ownerDocument = root.ownerDocument
  const handleTab = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || event.defaultPrevented) return
    // Only the innermost owner moves focus. While a menu or popover this
    // panel's own content opened holds focus, that layer owns the keystroke —
    // including its own Tab handling — and the containment below would drag
    // focus off the search field of a picker on its very first keystroke.
    // A nested surface that owns nothing does not qualify, so the panel keeps
    // containing Tab through it.
    if (focusOwnerWithin(root)) return
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
  // Announced, so an enclosing panel can tell a real nested trap from a
  // surface that merely looks like one.
  activeTraps.add(root)
  return () => {
    activeTraps.delete(root)
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
