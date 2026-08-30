"use client"

import * as React from "react"
import { Dialog } from "radix-ui"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "./button"

/** The viewport edge a drawer is anchored to, and slides in from. */
type DrawerSide = "right" | "left" | "top" | "bottom"

/**
 * A CSS length the drawer measures along its own axis: width for a left or
 * right drawer, height for a top or bottom one. Absolute (`28rem`, `480px`)
 * and viewport (`60dvh`) units are resolved as written; a percentage
 * resolves against the drawer's containing block, the portal container.
 */
type DrawerLength = string

interface DrawerAxisDefaults {
  size: DrawerLength
  minSize: DrawerLength
  maxSize: DrawerLength
}

/**
 * Per-axis defaults. A side drawer is a reading column, so it defaults
 * narrower than the viewport; a top or bottom sheet defaults to a band
 * rather than a full-height cover.
 */
const axisDefaults: Record<"horizontal" | "vertical", DrawerAxisDefaults> = {
  horizontal: { size: "28rem", minSize: "18rem", maxSize: "42rem" },
  vertical: { size: "24rem", minSize: "10rem", maxSize: "36rem" },
}

/** How far one arrow key moves the resize handle, in CSS pixels. */
const resizeStep = 16
/** The coarse step, for Shift + arrow. */
const resizeCoarseStep = 64

interface DrawerContextValue {
  side: DrawerSide
  open: boolean
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

/**
 * Reads the enclosing drawer's edge and open state, for content that has to
 * follow them — a header that flips its layout by side, or a body that stops
 * work while the drawer is closed.
 *
 * @param consumer - Component name used in the error when called outside a
 * `Drawer`.
 */
function useDrawer(consumer: string) {
  const context = React.useContext(DrawerContext)
  if (!context) {
    throw new Error(`${consumer} must be used within a Drawer.`)
  }
  return context
}

function isHorizontal(side: DrawerSide) {
  return side === "right" || side === "left"
}

/**
 * How long the element's transition of one property runs, in milliseconds, so
 * the exit is timed from the drawer's own CSS rather than a duplicated
 * constant. The motion-duration tokens collapse to 0ms under reduced motion,
 * which this reads back as an immediate unmount.
 */
function transitionMs(node: HTMLElement, property: string) {
  const style = getComputedStyle(node)
  const list = (value: string) => value.split(",").map((entry) => entry.trim())
  const milliseconds = (entry: string) => {
    const parsed = Number.parseFloat(entry)
    if (!Number.isFinite(parsed)) return 0
    return entry.endsWith("ms") ? parsed : parsed * 1000
  }
  const properties = list(style.transitionProperty)
  const durations = list(style.transitionDuration)
  const delays = list(style.transitionDelay)
  return properties.reduce((longest, candidate, index) => {
    // Only the slide keeps the panel mounted. A host className that replaces
    // the transition property — `transition-none`, `transition-colors` —
    // means there is no slide to wait for, however long the duration says.
    if (candidate !== property && candidate !== "all") return longest
    // CSS repeats the shorter of the property and duration lists rather
    // than padding it, so the index wraps.
    const duration = milliseconds(durations[index % durations.length] ?? "0s")
    const delay = milliseconds(delays[index % delays.length] ?? "0s")
    return Math.max(longest, duration + delay)
  }, 0)
}

/**
 * Resolves a CSS length to pixels by measuring a probe that shares the
 * panel's containing block, so `rem`, `dvh`, `min()`, and percentages resolve
 * exactly as the panel's own `clamp()` resolves them. The probe is fixed for
 * the same reason the panel is: a positioned portal container would otherwise
 * resolve percentages against itself while the panel resolves against the
 * viewport. Returns null for a length the CSSOM rejects, so a bad value falls
 * back instead of clamping every resize to zero. Runs on layout changes and
 * at the start of a gesture, never per pointer move.
 */
function resolveCssLength(
  panel: HTMLElement,
  value: DrawerLength,
  axis: "width" | "height",
) {
  const host = panel.parentElement ?? panel
  const probe = host.ownerDocument.createElement("div")
  probe.style.position = "fixed"
  probe.style.top = "0"
  probe.style.left = "0"
  probe.style.visibility = "hidden"
  probe.style.pointerEvents = "none"
  probe.style[axis] = value
  if (!probe.style[axis]) return null
  host.appendChild(probe)
  const measured = axis === "width" ? probe.offsetWidth : probe.offsetHeight
  probe.remove()
  return Number.isFinite(measured) && measured >= 0 ? measured : null
}

export interface DrawerProps extends React.ComponentProps<typeof Dialog.Root> {
  /**
   * The edge the drawer is anchored to and slides in from.
   * @defaultValue "right"
   */
  side?: DrawerSide
}

/**
 * A modal panel anchored to one edge of the viewport: the layer other
 * components are composed onto — a record's detail view, a filter panel, a
 * form. The drawer owns the overlay, the focus trap, dismissal, the slide
 * transition, and its own resizing; everything inside it is the consumer's
 * composition.
 *
 * State may be controlled through `open`/`onOpenChange` or left to the
 * drawer with `defaultOpen`. Pass `modal={false}` for a panel the page
 * beside it stays usable behind.
 *
 * ```tsx
 * <Drawer>
 *   <DrawerTrigger asChild>
 *     <Button>Open</Button>
 *   </DrawerTrigger>
 *   <DrawerContent resizable>
 *     <DrawerHeader>
 *       <DrawerTitle>Sara Mendez</DrawerTitle>
 *       <DrawerDescription>Contact details</DrawerDescription>
 *     </DrawerHeader>
 *     <DrawerBody>…</DrawerBody>
 *   </DrawerContent>
 * </Drawer>
 * ```
 */
function Drawer({
  side = "right",
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: DrawerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false,
  )
  const isOpen = open ?? uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [open, onOpenChange],
  )

  const context = React.useMemo(
    () => ({ side, open: isOpen }),
    [side, isOpen],
  )

  return (
    <DrawerContext.Provider value={context}>
      <Dialog.Root open={isOpen} onOpenChange={handleOpenChange} {...props} />
    </DrawerContext.Provider>
  )
}

/** The control that opens the drawer. Use `asChild` to project onto a Button. */
function DrawerTrigger(props: React.ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger data-slot="drawer-trigger" {...props} />
}

/**
 * A control that closes the drawer from inside it. Use `asChild` to project
 * onto a Button; the built-in close affordance uses this too.
 */
function DrawerClose(props: React.ComponentProps<typeof Dialog.Close>) {
  return <Dialog.Close data-slot="drawer-close" {...props} />
}

/**
 * Mount state for the panel across its slide, given the panel node once it
 * attaches. React unmounts on close immediately, which would cut the exit
 * transition, so the panel stays present until its own transition ends.
 *
 * The entrance mounts the panel at its closed offset and only then writes
 * the open state, since a transition needs a computed start value to move
 * from. The offset is flushed by reading layout rather than by waiting a
 * frame: an animation frame never arrives while the document is hidden, and
 * a drawer opened in a background tab would be stranded off-screen.
 */
function useDrawerPresence(
  open: boolean,
  panel: HTMLDivElement | null,
  overlay: HTMLDivElement | null,
) {
  const [present, setPresent] = React.useState(open)
  const [status, setStatus] = React.useState<"open" | "closed">("closed")

  React.useLayoutEffect(() => {
    if (open) {
      setPresent(true)
      // Until the portal has mounted the panel there is nothing to slide;
      // the effect runs again with the node, which is when the slide starts.
      if (!panel) return
      // Reading layout is the flush: it forces the closed offset to be
      // computed, so the class change below has a value to transition from.
      void panel.getBoundingClientRect()
      setStatus("open")
      return
    }

    setStatus("closed")
    if (!panel) {
      setPresent(false)
      return
    }
    // Both halves of the exit are waited out: a host that lengthens the
    // overlay's fade through `overlayClassName` must not have its backdrop
    // destroyed at partial opacity when the panel's slide ends first.
    const duration = Math.max(
      transitionMs(panel, "translate"),
      overlay ? transitionMs(overlay, "opacity") : 0,
    )
    if (duration === 0) {
      setPresent(false)
      return
    }
    // The timer is the authority and `transitionend` only shortens it: a
    // panel in a hidden tab runs no transition and fires no event.
    const timer = window.setTimeout(() => setPresent(false), duration + 50)
    const finish = (event: TransitionEvent) => {
      // The slide, on the panel itself: a descendant's transition, or another
      // property of the panel finishing first, must not cut the exit short.
      if (event.target !== panel || event.propertyName !== "translate") return
      setPresent(false)
    }
    panel.addEventListener("transitionend", finish)
    return () => {
      window.clearTimeout(timer)
      panel.removeEventListener("transitionend", finish)
    }
  }, [open, overlay, panel])

  return { present, status }
}

const closedOffset: Record<DrawerSide, string> = {
  right: "translate-x-full",
  left: "-translate-x-full",
  top: "-translate-y-full",
  bottom: "translate-y-full",
}

const anchor: Record<DrawerSide, string> = {
  right: "inset-y-0 right-0 h-full border-l",
  left: "inset-y-0 left-0 h-full border-r",
  top: "inset-x-0 top-0 w-full border-b",
  bottom: "inset-x-0 bottom-0 w-full border-t",
}

export interface DrawerContentProps
  extends Omit<React.ComponentProps<typeof Dialog.Content>, "forceMount"> {
  /**
   * The drawer's size along its own axis — width for a side drawer, height
   * for a top or bottom one — as a CSS length. Pass it to control sizing;
   * with `resizable`, pair it with `onSizeChange` to persist what the user
   * drags to. Omit for the uncontrolled default.
   */
  size?: DrawerLength
  /**
   * The uncontrolled starting size, and the size a double-click on the
   * resize handle restores.
   * @defaultValue "28rem" for a side drawer, "24rem" for a top or bottom one
   */
  defaultSize?: DrawerLength
  /**
   * Fires with the drawer's new size at each step of a resize: a `px` length
   * while the handle is being dragged or stepped, and `defaultSize` verbatim
   * when it is restored — by a double-click, by Enter, or by the drawer
   * itself when `side` moves to the other axis and an uncontrolled size
   * cannot carry over. Only an open, resizable drawer reports sizes.
   */
  onSizeChange?: (size: DrawerLength) => void
  /**
   * Gives the drawer a resize handle on its inner edge: drag it, or focus it
   * and use the arrow keys (Shift for a coarse step, Home and End for the
   * bounds, Enter to restore the default size). Double-clicking it restores
   * the default size too.
   *
   * The handle takes a 12px pointer target, under WCAG 2.5.8's 24px
   * minimum. The exception claimed is Essential: a target that size has
   * nowhere valid to go. Grown inward it swallows the scrolling body's own
   * content, and on a left drawer the classic scrollbar that platforms
   * without overlay scrollbars draw in that same strip — which the 12px
   * target already overlaps. Grown outward it reaches the overlay, where a
   * press dismisses the drawer and loses whatever was in it. What softens
   * it: the whole target lies inside the panel, a press that starts a
   * resize and does not move changes nothing, the same resize is available
   * from the keyboard, and the drawer works with no resizing at all. The
   * one adjacency worth knowing is a left drawer's built-in close button,
   * which ends exactly where the handle begins, with no gap between them.
   * @defaultValue false
   */
  resizable?: boolean
  /**
   * The smallest size a resize may reach, and the floor of the panel's own
   * clamp.
   * @defaultValue "18rem" for a side drawer, "10rem" for a top or bottom one
   */
  minSize?: DrawerLength
  /**
   * The largest size a resize may reach. The viewport caps it regardless, so
   * a drawer never grows past the edge it is anchored to.
   * @defaultValue "42rem" for a side drawer, "36rem" for a top or bottom one
   */
  maxSize?: DrawerLength
  /** Names the resize handle for assistive technology. */
  resizeLabel?: string
  /**
   * Renders the close affordance in the panel's top corner.
   * @defaultValue true
   */
  showCloseButton?: boolean
  /** Names the close affordance for assistive technology. */
  closeLabel?: string
  /**
   * Puts focus back where it belongs on close when the control that opened
   * the drawer is gone by then — a row deleted from inside its own drawer, a
   * trigger that unmounts while the panel is open. The drawer returns focus
   * to its opener whenever that element is still in the document, and calls
   * this instead when it is not.
   *
   * It is also the last resort when nothing was focused at open time — a
   * programmatic open, or a browser that does not focus a button on click —
   * and no trigger reclaimed focus. That check runs one tick after the close,
   * so a callback with side effects beyond moving focus may run against a
   * tree the host has already torn down.
   */
  onReturnFocus?: () => void
  /** Extends the overlay behind the panel. */
  overlayClassName?: string
  /** The element the drawer portals into. Defaults to the document body. */
  container?: React.ComponentProps<typeof Dialog.Portal>["container"]
}

/**
 * The drawer panel and the overlay behind it, portalled out of the tree it
 * is written in. Compose a `DrawerHeader`, `DrawerBody`, and `DrawerFooter`
 * inside it — or any layout of Nessa components; the panel is a column that
 * clips its own overflow, so a scrolling body scrolls inside the panel while
 * the header and footer stay put.
 *
 * A drawer must name itself: include a `DrawerTitle`, visually or with
 * `sr-only`.
 */
function DrawerContent({
  className,
  overlayClassName,
  children,
  container,
  size: sizeProp,
  defaultSize,
  onSizeChange,
  resizable = false,
  minSize,
  maxSize,
  resizeLabel = "Resize drawer",
  onReturnFocus,
  showCloseButton = true,
  closeLabel = "Close",
  style,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ref,
  ...props
}: DrawerContentProps) {
  const { side, open } = useDrawer("DrawerContent")
  // The portal renders its children only after its own layout effect has a
  // container, so the panel is absent from the DOM on the commit that mounts
  // it. Attachment is therefore state, not a ref read: the slide and the
  // measurements both start when the node actually arrives.
  const [panelNode, setPanelNode] = React.useState<HTMLDivElement | null>(null)
  // The consumer's ref is reached through a box so this callback keeps one
  // identity for the life of the panel. An inline `ref={(node) => …}` would
  // otherwise detach and re-attach the node on every host render, which drops
  // the panel mid-slide and rebuilds the resize observer each time.
  const consumerRef = React.useRef(ref)
  React.useLayoutEffect(() => {
    consumerRef.current = ref
  })
  const composedRef = React.useCallback((node: HTMLDivElement | null) => {
    setPanelNode(node)
    const consumer = consumerRef.current
    if (typeof consumer === "function") consumer(node)
    else if (consumer) consumer.current = node
  }, [])
  const [overlayNode, setOverlayNode] = React.useState<HTMLDivElement | null>(
    null,
  )
  const { present, status } = useDrawerPresence(open, panelNode, overlayNode)

  // Radix restores focus to its own trigger, so a drawer opened from
  // anything else — a row, a menu item, a controlled host — would drop focus
  // onto the body. The opener is captured here, before focus moves, and
  // restored by the close handler below, which explains how the two restores
  // compose.
  const openerRef = React.useRef<HTMLElement | null>(null)
  const [keyboardOpened, setKeyboardOpened] = React.useState(false)

  // A dialog with no name is announced as "dialog" and nothing else. Radix
  // dropped its own warning for this, so the drawer checks the rendered node.
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || !panelNode) return
    if (
      panelNode.getAttribute("aria-labelledby") ||
      panelNode.getAttribute("aria-label")
    ) {
      return
    }
    console.warn(
      "DrawerContent has no accessible name: render a DrawerTitle inside it (sr-only is fine), or pass aria-label.",
    )
  }, [panelNode])

  const horizontal = isHorizontal(side)
  const axis = horizontal ? "width" : "height"
  const defaults = axisDefaults[horizontal ? "horizontal" : "vertical"]
  const resolvedMin = minSize ?? defaults.minSize
  const resolvedMax = maxSize ?? defaults.maxSize
  const initialSize = defaultSize ?? defaults.size

  // Keyed by axis: a drawer that moves from a side to the top or bottom is
  // measuring a different dimension, so an uncontrolled width must not become
  // the sheet's height. Changing `side` restarts from that axis's default.
  const [uncontrolled, setUncontrolled] = React.useState({
    axis,
    value: initialSize,
  })
  if (uncontrolled.axis !== axis) setUncontrolled({ axis, value: initialSize })
  const size = sizeProp ?? uncontrolled.value
  const reportedRef = React.useRef(size)
  const setSize = React.useCallback(
    (next: DrawerLength) => {
      if (sizeProp === undefined) setUncontrolled({ axis, value: next })
      reportedRef.current = next
      onSizeChange?.(next)
    },
    [axis, sizeProp, onSizeChange],
  )

  // The axis reset above is the one size change that does not pass through
  // `setSize` — it happens during render, where a callback must not run. A
  // host persisting sizes would otherwise keep storing the width a drawer
  // had before it became a sheet, having never been told it changed.
  React.useEffect(() => {
    if (!resizable || !present) return
    if (sizeProp !== undefined || size === reportedRef.current) return
    reportedRef.current = size
    onSizeChange?.(size)
  }, [onSizeChange, present, resizable, size, sizeProp])

  // The rendered size and the resolved bounds are measured rather than
  // derived: the panel's size is a `clamp()` of CSS lengths, so only layout
  // knows what the drawer actually occupies — and the handle reports exactly
  // that through `aria-valuenow`.
  const [measured, setMeasured] = React.useState({ now: 0, min: 0, max: 0 })
  const warnedLengthsRef = React.useRef(new Set<string>())
  const measure = React.useCallback(() => {
    const panel = panelNode
    if (!panel) return
    const box = panel.getBoundingClientRect()
    const rendered = Math.round(horizontal ? box.width : box.height)
    // The viewport cap is resolved from the same length the panel's clamp
    // uses, not from a JS viewport constant: `100dvh` and `clientHeight`
    // disagree by the height of a mobile URL bar, and a cap the CSS will not
    // honour would make End request a size the drawer cannot reach.
    const viewport =
      resolveCssLength(panel, horizontal ? "100vw" : "100dvh", axis) ?? rendered
    const resolvedMaxPx = resolveCssLength(panel, resolvedMax, axis)
    const resolvedMinPx = resolveCssLength(panel, resolvedMin, axis)
    if (process.env.NODE_ENV !== "production") {
      // The same rejected length also invalidates the panel's own clamp, so
      // the drawer falls back to content size and the handle would otherwise
      // report a size the panel never took, with nothing to correct it.
      // Warned once per value: `measure` also runs on every resize record.
      for (const [name, value, resolved] of [
        ["minSize", resolvedMin, resolvedMinPx],
        ["maxSize", resolvedMax, resolvedMaxPx],
      ] as const) {
        const key = `${name}:${value}`
        if (resolved !== null || warnedLengthsRef.current.has(key)) continue
        warnedLengthsRef.current.add(key)
        console.warn(
          `DrawerContent ${name}="${value}" is not a CSS length the browser accepts; the drawer cannot size or clamp itself.`,
        )
      }
    }
    const max = Math.min(resolvedMaxPx ?? viewport, viewport)
    const min = Math.min(resolvedMinPx ?? 0, max)
    setMeasured({ now: rendered, min, max })
  }, [axis, horizontal, panelNode, resolvedMax, resolvedMin])

  React.useLayoutEffect(() => {
    if (!panelNode) return
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(panelNode)
    return () => observer.disconnect()
  }, [measure, panelNode])

  const [resizing, setResizing] = React.useState(false)
  const gestureRef = React.useRef<{
    pointerId: number
    origin: number
    size: number
  } | null>(null)

  const applySize = React.useCallback(
    (next: number) => {
      const clamped = Math.round(
        Math.min(Math.max(next, measured.min), Math.max(measured.max, measured.min)),
      )
      setSize(`${clamped}px`)
      // Reported straight away rather than waiting for the observer: a
      // document that is not being rendered delivers no resize records, and
      // the handle must never announce a stale size while it is being moved.
      // Only when the drawer owns its size, though — a controlled host may
      // refuse or snap the value, and the handle must not announce a width
      // the panel never took. There, layout remains the only authority.
      if (sizeProp === undefined) {
        setMeasured((current) => ({ ...current, now: clamped }))
      }
    },
    [measured.max, measured.min, setSize, sizeProp],
  )

  // Dragging the handle away from the anchored edge grows the drawer, so how
  // a movement in screen space changes the size is signed by which edge the
  // panel is pinned to. Both pointer and keyboard resizing use this sign.
  const growthPerPixel = side === "right" || side === "bottom" ? -1 : 1

  const handleRef = React.useRef<HTMLDivElement>(null)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // One gesture at a time: a second finger landing on the handle must not
    // drive the resize from the first finger's origin.
    if (event.button !== 0 || gestureRef.current) return
    measure()
    if (!panelNode) return
    const box = panelNode.getBoundingClientRect()
    gestureRef.current = {
      pointerId: event.pointerId,
      origin: horizontal ? event.clientX : event.clientY,
      size: horizontal ? box.width : box.height,
    }
    try {
      // Capture keeps the cursor and the hover state on the handle for the
      // whole drag. It is an affordance, not the mechanism: the gesture is
      // driven by document listeners, so a pointer id the platform refuses
      // to capture (synthetic events in tests) still resizes, and still ends.
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture is optional; the document listeners below are not.
    }
    setResizing(true)
  }

  // The drag is followed on the document, not on the handle: a 12px strip is
  // left behind by the first fast movement, and a capture the platform
  // refused would otherwise strand a gesture that can never be ended.
  // Read through a ref so the listeners below are attached once per gesture:
  // an inline `onSizeChange` changes `applySize`'s identity on every render,
  // and every drag step is a render.
  const applySizeRef = React.useRef(applySize)
  React.useLayoutEffect(() => {
    applySizeRef.current = applySize
  })

  React.useEffect(() => {
    if (!resizing || !panelNode) return
    const ownerDocument = panelNode.ownerDocument
    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      const position = horizontal ? event.clientX : event.clientY
      applySizeRef.current(
        gesture.size + (position - gesture.origin) * growthPerPixel,
      )
    }
    const end = (event: PointerEvent) => {
      if (gestureRef.current?.pointerId !== event.pointerId) return
      gestureRef.current = null
      setResizing(false)
      const handle = handleRef.current
      if (handle?.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId)
      }
    }
    ownerDocument.addEventListener("pointermove", move)
    ownerDocument.addEventListener("pointerup", end)
    ownerDocument.addEventListener("pointercancel", end)
    return () => {
      ownerDocument.removeEventListener("pointermove", move)
      ownerDocument.removeEventListener("pointerup", end)
      ownerDocument.removeEventListener("pointercancel", end)
    }
  }, [growthPerPixel, horizontal, panelNode, resizing])

  // A drawer dismissed mid-drag — Escape, an outside press, a host closing
  // it — unmounts the handle while it still holds the pointer, so no pointer
  // event ever reaches `endGesture`. Without this the gesture would outlive
  // the panel: the next hover over a reopened handle would resize from a
  // stale origin, having never seen a press.
  React.useEffect(() => {
    if (panelNode && resizable) return
    gestureRef.current = null
    setResizing(false)
  }, [panelNode, resizable])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? resizeCoarseStep : resizeStep
    // Arrow keys move the handle the way a drag would, so they take the same
    // sign: on a right drawer, left grows and right shrinks.
    const back = horizontal ? "ArrowLeft" : "ArrowUp"
    const forward = horizontal ? "ArrowRight" : "ArrowDown"

    if (event.key === back) applySize(measured.now - step * growthPerPixel)
    else if (event.key === forward)
      applySize(measured.now + step * growthPerPixel)
    else if (event.key === "Home") applySize(measured.min)
    else if (event.key === "End") applySize(measured.max)
    // The double-click reset, reachable without a pointer.
    else if (event.key === "Enter") setSize(initialSize)
    else return

    event.preventDefault()
  }

  if (!present) return null

  return (
    <Dialog.Portal forceMount container={container}>
      <Dialog.Overlay
        forceMount
        ref={setOverlayNode}
        data-slot="drawer-overlay"
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-xs transition-opacity [transition-duration:var(--nessa-motion-duration-slow)] [transition-timing-function:var(--nessa-motion-easing-emphasized)] motion-reduce:transition-none",
          status === "closed" && "opacity-0",
          overlayClassName,
        )}
      />
      <Dialog.Content
        forceMount
        ref={composedRef}
        onOpenAutoFocus={(event) => {
          const ownerDocument = panelNode?.ownerDocument
          const active = ownerDocument?.activeElement
          // The body is where focus sits when nothing has it — a programmatic
          // open, `defaultOpen`, or a browser that does not focus a button on
          // click (Safari, Firefox). It is not an opener to return to.
          const opener =
            active instanceof HTMLElement &&
            active !== ownerDocument?.body &&
            active !== ownerDocument?.documentElement
              ? active
              : null
          openerRef.current = opener
          // Read now, not in a state updater: an updater runs during the
          // render it schedules, by which point the focus move below has
          // already blurred the opener and nothing matches `:focus-visible`.
          let openedByKeyboard = false
          try {
            openedByKeyboard = Boolean(opener?.matches(":focus-visible"))
          } catch {
            // A browser without :focus-visible draws no indicator here.
          }
          setKeyboardOpened(openedByKeyboard)
          onOpenAutoFocus?.(event)
          if (event.defaultPrevented) return
          // The panel takes focus, not its first control: a screen reader
          // then reads the drawer's name and description before landing on
          // a control, and no keystroke can act on the drawer by accident.
          event.preventDefault()
          panelNode?.focus()
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (event.defaultPrevented) return
          const opener = openerRef.current
          openerRef.current = null
          // Nothing was focused when the drawer opened — a programmatic open,
          // or a browser that does not focus a button on click. Radix's own
          // trigger restore is the right outcome when there is a trigger, so
          // this defers to it rather than reporting a missing opener. The
          // host's fallback is the last resort, and only if that restore
          // left focus on the body.
          if (!opener) {
            if (!onReturnFocus) return
            const ownerDocument = panelNode?.ownerDocument
            window.setTimeout(() => {
              const body = ownerDocument?.body
              // The resting state, not a destination: a host that parks focus
              // on the body itself makes it focusable first, and that choice
              // is deliberate and left alone.
              if (!body || ownerDocument.activeElement !== body) return
              if (body.hasAttribute("tabindex")) return
              onReturnFocus()
            }, 0)
            return
          }
          // A control that is gone cannot take focus back; hosts that unmount
          // the opener from inside the drawer say where focus should land.
          if (!opener.isConnected) {
            if (!onReturnFocus) return
            // The host owns the fallback, so it also owns the outcome: Radix
            // would otherwise focus a still-mounted trigger afterwards and
            // undo wherever the host just put focus.
            event.preventDefault()
            onReturnFocus()
            return
          }
          opener.focus()
          // Claimed only if it took. Radix prevents this event's default and
          // focuses its own trigger, and it composes with
          // `checkForDefaultPrevented`, so preventing here *replaces* that
          // restore rather than following it — worth doing only when focus
          // actually moved.
          if (opener.ownerDocument.activeElement === opener) {
            event.preventDefault()
          }
        }}
        data-slot="drawer-content"
        data-side={side}
        data-resizing={resizing || undefined}
        // The size properties are merged under the consumer's own style, not
        // spread with the rest of the props: a host that passes `style` for
        // anything else must not silently drop the panel's sizing.
        style={
          {
            "--nessa-drawer-size": size,
            "--nessa-drawer-min-size": resolvedMin,
            "--nessa-drawer-max-size": resolvedMax,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          // Deliberately not clipped: the panel has no rounded corners to clip
          // to, and `overflow-hidden` here would eat the outward half of the
          // resize handle's focus ring and pointer target, both of which sit
          // on the panel's own edge. The scrolling body owns its own clip.
          "fixed z-50 flex max-w-full flex-col border-border bg-card font-sans text-card-foreground shadow-xl outline-none",
          // The panel takes focus on open, so a keyboard open carries an
          // indicator like any other focus target. `:focus-visible` cannot
          // express this on its own: a programmatically focused container
          // matches it even when the drawer was opened by a pointer, so the
          // opener's own modality decides. The outline draws inset — an
          // outset one on a panel flush with the viewport edge would be half
          // off-screen — and restates `outline-style`, which `outline-none`
          // otherwise leaves at `none` for the whole rule.
          keyboardOpened &&
            "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          // Only `translate` transitions, so a drag on the size never has to
          // suspend it — and the exit timing is read from this one property.
          "transition-[translate] [transition-duration:var(--nessa-motion-duration-slow)] [transition-timing-function:var(--nessa-motion-easing-emphasized)] motion-reduce:transition-none",
          anchor[side],
          horizontal
            ? "w-[clamp(var(--nessa-drawer-min-size),var(--nessa-drawer-size),min(var(--nessa-drawer-max-size),100vw))]"
            : "h-[clamp(var(--nessa-drawer-min-size),var(--nessa-drawer-size),min(var(--nessa-drawer-max-size),100dvh))]",
          status === "closed" && closedOffset[side],
          className,
        )}
        {...props}
      >
        {children}
        {resizable ? (
          <div
            role="separator"
            tabIndex={0}
            aria-label={resizeLabel}
            aria-orientation={horizontal ? "vertical" : "horizontal"}
            // Radix owns the panel's id and wires the trigger to it, so the
            // handle reads that id off the node instead of imposing one.
            aria-controls={panelNode?.id || undefined}
            aria-valuenow={measured.now}
            aria-valuemin={measured.min}
            aria-valuemax={measured.max}
            data-slot="drawer-resize-handle"
            data-resizing={resizing || undefined}
            className={cn(
              // The target is a 12px strip lying wholly inside the panel,
              // and the hairline the reader sees is drawn by ::before on its
              // outer edge. A hit area that overhung the panel would put a
              // near-miss on the overlay, where a press dismisses the drawer.
              "absolute z-10 outline-none select-none touch-none before:absolute before:bg-border before:transition-colors before:[transition-duration:var(--nessa-motion-duration-fast)] before:[transition-timing-function:var(--nessa-motion-easing-standard)] hover:before:bg-ring/60 data-resizing:before:bg-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 motion-reduce:before:transition-none",
              horizontal
                ? "inset-y-0 w-3 cursor-col-resize before:inset-y-0 before:w-px"
                : "inset-x-0 h-3 cursor-row-resize before:inset-x-0 before:h-px",
              side === "right" && "left-0 before:left-0",
              side === "left" && "right-0 before:right-0",
              side === "top" && "bottom-0 before:bottom-0",
              side === "bottom" && "top-0 before:top-0",
            )}
            ref={handleRef}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            onDoubleClick={() => setSize(initialSize)}
          />
        ) : null}
        {showCloseButton ? (
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={closeLabel}
              className="absolute right-3 top-3 size-8 text-muted-foreground"
            >
              <X />
            </Button>
          </DrawerClose>
        ) : null}
      </Dialog.Content>
    </Dialog.Portal>
  )
}

/**
 * The panel's fixed top block: the title, its description, and room for the
 * close affordance beside them.
 */
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex shrink-0 flex-col gap-1 border-b border-border p-4 pr-14",
        className,
      )}
      {...props}
    />
  )
}

/**
 * The panel's scrolling middle. Everything the drawer is opened to show
 * belongs here, so the header and footer stay pinned while it scrolls.
 */
function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-body"
      className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)}
      {...props}
    />
  )
}

/** The panel's fixed bottom block, for the drawer's actions. */
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-border p-4",
        className,
      )}
      {...props}
    />
  )
}

/** The drawer's accessible name. Required, and may be `sr-only`. */
function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      data-slot="drawer-title"
      className={cn("nessa-text-5 font-semibold text-foreground", className)}
      {...props}
    />
  )
}

/** Supporting copy under the title, announced with the drawer. */
function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof Dialog.Description>) {
  return (
    <Dialog.Description
      data-slot="drawer-description"
      className={cn("nessa-text-4 text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  useDrawer,
  type DrawerSide,
}
