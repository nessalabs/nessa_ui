"use client"

import * as React from "react"
import { Maximize2, Minimize2, X } from "lucide-react"

import { cn } from "@/lib/utils"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

/** Parses a CSS duration token value into milliseconds. */
function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

/** Reads the sheet's duration and standard easing from theme tokens. */
function sheetMotion(
  node: HTMLElement,
  durationToken: string,
  fallback: number,
) {
  const styles = getComputedStyle(node)
  return {
    duration: cssDurationInMilliseconds(
      styles.getPropertyValue(durationToken),
      fallback,
    ),
    easing:
      styles.getPropertyValue("--nessa-motion-easing-standard").trim() ||
      "ease-out",
  }
}

function cancelAnimations(animations: Animation[]) {
  for (const animation of animations) animation.cancel()
}

/**
 * How many open sheets are covering each sibling. Sheets can stack — a
 * details panel over a queue — and whichever closes first must not uncover
 * content the survivor is still drawn over. Elements a host inerted itself
 * never enter the map, and so are never un-inerted by a sheet closing.
 */
const coverCounts = new WeakMap<HTMLElement, number>()

const SheetContext = React.createContext<{
  close: () => void
  expanded: boolean
  setExpanded: (expanded: boolean) => void
}>({
  close: () => {},
  expanded: false,
  setExpanded: () => {},
})

/**
 * Reads the enclosing sheet: dismiss, whether the panel fills its ancestor,
 * and the expand toggle. SheetExpand, SheetClose, and SheetAction use it.
 */
function useSheet() {
  return React.useContext(SheetContext)
}

export interface SheetProps extends React.ComponentProps<"div"> {
  /** Dismisses the sheet; the backdrop, Escape, and SheetClose all call it. */
  onClose: () => void
  /** The accessible name of the dialog. */
  label?: string
  /**
   * Puts focus back where it belongs on close, when the control that opened
   * the sheet is gone by then. The sheet returns focus to its opener whenever
   * that element is still in the document, and calls this instead when it is
   * not.
   */
  onReturnFocus?: () => void
  /**
   * Controlled expand: `true` fills the positioned ancestor, `false` is the
   * bottom drawer. Pair with `onExpandedChange`.
   */
  expanded?: boolean
  /** Uncontrolled initial expand. Drawer by default. */
  defaultExpanded?: boolean
  /** Fires when SheetExpand toggles the panel between drawer and filled. */
  onExpandedChange?: (expanded: boolean) => void
  /**
   * When true (the default), the sheet is modal to its positioned ancestor:
   * `aria-modal`, Tab stays inside the panel, and siblings go inert. Queue
   * and details use this. When false, Tab is not trapped and `aria-modal` is
   * omitted so chrome outside the ancestor — a tab strip and composer around
   * a transcript-scoped sheet — stays reachable. Annotations use this.
   */
  modal?: boolean
}

/**
 * A bottom sheet that rises over its nearest positioned ancestor — typically
 * a chat window — without leaving that frame. By default it is a modal
 * dialog: the backdrop and Escape dismiss it, Tab stays inside, focus moves
 * into the panel on open and returns to the opener on close, and the
 * siblings it covers go inert so nothing behind it takes a pointer or a
 * keystroke. Pass `modal={false}` for a contained extra-details surface that
 * still covers its siblings but leaves surrounding chrome in the tab order.
 *
 * Compose the panel from SheetHandle, SheetHeader, SheetTitle, SheetClose,
 * SheetExpand, SheetAction, and SheetBody. SheetExpand toggles the drawer
 * into a filled extra-details surface over the same ancestor — the host
 * that positions the transcript (rather than the whole window) keeps its
 * tab strip and composer when the panel expands. The drawer lifts a short
 * way from the bottom on open; expand and minimize interpolate height so
 * the panel grows and recedes in place. Both use the slow duration and
 * standard easing so the motion stays one language. Reduced motion skips
 * them. The sheet draws the chrome and owns dismissal; the host owns what
 * the panel shows.
 */
function Sheet({
  onClose,
  label = "Sheet",
  onReturnFocus,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  modal = true,
  className,
  children,
  onKeyDown,
  ...props
}: SheetProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const backdropRef = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  const onReturnFocusRef = React.useRef(onReturnFocus)
  const onExpandedChangeRef = React.useRef(onExpandedChange)
  const [uncontrolledExpanded, setUncontrolledExpanded] =
    React.useState(defaultExpanded)
  const isExpandedControlled = expandedProp !== undefined
  const expanded = isExpandedControlled ? expandedProp : uncontrolledExpanded
  React.useEffect(() => {
    onCloseRef.current = onClose
    onReturnFocusRef.current = onReturnFocus
    onExpandedChangeRef.current = onExpandedChange
  })
  const close = React.useCallback(() => onCloseRef.current(), [])
  const setExpanded = React.useCallback((next: boolean) => {
    if (!isExpandedControlled) setUncontrolledExpanded(next)
    onExpandedChangeRef.current?.(next)
  }, [isExpandedControlled])
  const context = React.useMemo(
    () => ({ close, expanded, setExpanded }),
    [close, expanded, setExpanded],
  )
  const openedExpanded = React.useRef(expanded)
  const enterAnimationsRef = React.useRef<Animation[]>([])
  const prevExpandedRef = React.useRef(expanded)
  const prevHeightRef = React.useRef<number | null>(null)
  const collapsedRadiusRef = React.useRef("0px")

  React.useEffect(() => {
    const panel = panelRef.current
    const backdrop = backdropRef.current
    if (!panel || typeof panel.animate !== "function") return
    if (window.matchMedia(reducedMotionQuery).matches) return
    const { duration, easing } = sheetMotion(
      panel,
      "--nessa-motion-duration-slow",
      300,
    )
    if (duration === 0) return
    const animations: Animation[] = []
    if (openedExpanded.current) {
      animations.push(
        panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing }),
      )
    } else {
      // A short lift — a fraction of the panel, not a full-height slide —
      // plus a fade, so the drawer arrives from below without rushing.
      animations.push(
        panel.animate(
          [
            { opacity: 0, translate: "0 8%" },
            { opacity: 1, translate: "0 0" },
          ],
          { duration, easing },
        ),
      )
      if (backdrop) {
        animations.push(
          backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration,
            easing,
          }),
        )
      }
    }
    enterAnimationsRef.current = animations
    return () => {
      cancelAnimations(animations)
      enterAnimationsRef.current = []
    }
  }, [])

  React.useLayoutEffect(() => {
    const panel = panelRef.current
    const backdrop = backdropRef.current
    if (!panel) return
    if (!expanded) {
      collapsedRadiusRef.current = getComputedStyle(panel).borderTopLeftRadius
    }
    const nextHeight = panel.getBoundingClientRect().height
    const prevHeight = prevHeightRef.current
    prevHeightRef.current = nextHeight
    const wasExpanded = prevExpandedRef.current
    prevExpandedRef.current = expanded
    if (wasExpanded === expanded) return
    cancelAnimations(enterAnimationsRef.current)
    enterAnimationsRef.current = []
    if (window.matchMedia(reducedMotionQuery).matches) return
    if (
      prevHeight == null ||
      typeof panel.animate !== "function" ||
      Math.abs(prevHeight - nextHeight) < 0.5
    ) {
      return
    }
    const { duration, easing } = sheetMotion(
      panel,
      "--nessa-motion-duration-slow",
      300,
    )
    if (duration === 0) return
    const collapsedRadius = `${collapsedRadiusRef.current} ${collapsedRadiusRef.current} 0 0`
    const fromRadius = wasExpanded ? "0px" : collapsedRadius
    const toRadius = expanded ? "0px" : collapsedRadius
    panel.style.height = `${prevHeight}px`
    panel.style.flexGrow = "0"
    panel.style.flexShrink = "0"
    panel.style.overflow = "hidden"
    const animations: Animation[] = [
      panel.animate(
        [
          { height: `${prevHeight}px`, borderRadius: fromRadius },
          { height: `${nextHeight}px`, borderRadius: toRadius },
        ],
        { duration, easing, fill: "forwards" },
      ),
    ]
    if (backdrop) {
      const fromOpacity = wasExpanded ? 0 : 1
      const toOpacity = expanded ? 0 : 1
      backdrop.style.opacity = String(fromOpacity)
      animations.push(
        backdrop.animate([{ opacity: fromOpacity }, { opacity: toOpacity }], {
          duration,
          easing,
          fill: "forwards",
        }),
      )
    }
    const clearInline = () => {
      panel.style.height = ""
      panel.style.flexGrow = ""
      panel.style.flexShrink = ""
      panel.style.overflow = ""
      if (backdrop) backdrop.style.opacity = ""
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearInline()
      cancelAnimations(animations)
    }
    void Promise.all(animations.map((animation) => animation.finished)).then(
      finish,
      () => {},
    )
    return () => {
      settled = true
      cancelAnimations(animations)
      clearInline()
    }
  }, [expanded])

  React.useEffect(() => {
    const node = ref.current
    const ownerDocument = node?.ownerDocument
    if (!node || !ownerDocument) return
    const opener =
      ownerDocument.activeElement instanceof HTMLElement
        ? ownerDocument.activeElement
        : null
    const firstControl = node.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ;(firstControl ?? node).focus()

    const parent = node.parentElement
    const covered = new Set<HTMLElement>()
    const release = (sibling: HTMLElement) => {
      covered.delete(sibling)
      const count = (coverCounts.get(sibling) ?? 1) - 1
      if (count > 0) return coverCounts.set(sibling, count)
      coverCounts.delete(sibling)
      sibling.removeAttribute("inert")
    }
    const coverSiblings = () => {
      for (const sibling of covered) if (!sibling.isConnected) release(sibling)
      for (const sibling of parent?.children ?? []) {
        if (sibling === node || !(sibling instanceof HTMLElement)) continue
        if (sibling.getAttribute("role") === "dialog") continue
        if (covered.has(sibling)) continue
        const count = coverCounts.get(sibling)
        if (count === undefined && sibling.hasAttribute("inert")) continue
        coverCounts.set(sibling, (count ?? 0) + 1)
        sibling.setAttribute("inert", "")
        covered.add(sibling)
      }
    }
    coverSiblings()
    const observer = parent ? new MutationObserver(coverSiblings) : null
    if (parent && observer) observer.observe(parent, { childList: true })
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"))
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const order = focusables()
      if (order.length === 0) return
      const first = order[0]!
      const last = order[order.length - 1]!
      const current = ownerDocument.activeElement
      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }
    if (modal) {
      ownerDocument.addEventListener("keydown", handleTab, { capture: true })
    }
    return () => {
      observer?.disconnect()
      if (modal) {
        ownerDocument.removeEventListener("keydown", handleTab, {
          capture: true,
        })
      }
      for (const sibling of [...covered]) release(sibling)
      if (opener?.isConnected) opener.focus()
      else onReturnFocusRef.current?.()
    }
    // Mount-once by design; modal is the value at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.key !== "Escape" || event.defaultPrevented) return
    event.preventDefault()
    onCloseRef.current()
  }

  return (
    <SheetContext.Provider value={context}>
      <div
        ref={ref}
        role="dialog"
        aria-modal={modal || undefined}
        aria-label={label}
        data-slot="sheet"
        data-expanded={expanded ? "true" : "false"}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "absolute inset-0 z-30 flex flex-col justify-end overflow-hidden rounded-[inherit] font-sans",
          className,
        )}
        {...props}
      >
        <div
          ref={backdropRef}
          aria-hidden="true"
          data-slot="sheet-backdrop"
          onClick={close}
          className={cn(
            "absolute inset-0 bg-foreground/40",
            expanded && "pointer-events-none opacity-0",
          )}
        />
        <div
          ref={panelRef}
          data-slot="sheet-panel"
          data-expanded={expanded ? "true" : "false"}
          className={cn(
            "relative z-10 flex w-full flex-col bg-card text-card-foreground shadow-[0_-8px_32px] shadow-(color:--foreground)/20",
            expanded
              ? "min-h-0 flex-1 overflow-hidden rounded-none"
              : "max-h-[85%] overflow-y-auto rounded-t-3xl",
          )}
        >
          {children}
        </div>
      </div>
    </SheetContext.Provider>
  )
}

/** The grab bar that marks the panel as a drawer. Recedes while expanded. */
function SheetHandle({ className, ...props }: React.ComponentProps<"div">) {
  const { expanded } = useSheet()
  return (
    <div
      aria-hidden="true"
      data-slot="sheet-handle"
      className={cn(
        "flex shrink-0 justify-center overflow-hidden pt-2 transition-[max-height,padding,opacity] [transition-duration:var(--nessa-motion-duration-slow)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
        expanded ? "max-h-0 pt-0 opacity-0" : "max-h-6 opacity-100",
        className,
      )}
      {...props}
    >
      <span className="h-1 w-10 rounded-full bg-muted-foreground/50" />
    </div>
  )
}

export interface SheetHeaderProps extends React.ComponentProps<"div"> {}

/**
 * The sheet's title row. Hosts place SheetClose or SheetExpand, SheetTitle,
 * and SheetAction as children; the side columns share leftover width so the
 * title stays optically centered whether or not the side controls are present.
 */
function SheetHeader({ className, ...props }: SheetHeaderProps) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-1 pt-1",
        className,
      )}
      {...props}
    />
  )
}

export interface SheetTitleProps extends React.ComponentProps<"h2"> {}

/** The sheet's heading, centered in the header. */
function SheetTitle({ className, ...props }: SheetTitleProps) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn(
        "col-start-2 m-0 min-w-0 truncate text-center font-sans nessa-text-5 font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  )
}

const sheetControlClassName =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-muted text-foreground outline-none transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3.5"

/**
 * The circular dismiss control. Closes the enclosing sheet, so hosts pass
 * no handler unless they need to intercept the click.
 */
function SheetClose({
  className,
  children,
  onClick,
  "aria-label": ariaLabel = "Close",
  ...props
}: React.ComponentProps<"button">) {
  const { close } = useSheet()
  return (
    <button
      type="button"
      data-slot="sheet-close"
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) close()
      }}
      className={cn(sheetControlClassName, "col-start-1 justify-self-start", className)}
      {...props}
    >
      {children ?? <X aria-hidden="true" />}
    </button>
  )
}

/**
 * Toggles the panel between the bottom drawer and a surface that fills the
 * sheet's positioned ancestor. The same control reads Expand or Minimize.
 */
function SheetExpand({
  className,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { expanded, setExpanded } = useSheet()
  return (
    <button
      type="button"
      data-slot="sheet-expand"
      aria-label={expanded ? "Minimize" : "Expand"}
      aria-expanded={expanded}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setExpanded(!expanded)
      }}
      className={cn(sheetControlClassName, "col-start-1 justify-self-start", className)}
      {...props}
    >
      {expanded ? (
        <Minimize2 aria-hidden="true" />
      ) : (
        <Maximize2 aria-hidden="true" />
      )}
    </button>
  )
}

/**
 * A trailing header control — typically "Done". Closes the enclosing sheet
 * unless the click is cancelled.
 */
function SheetAction({
  className,
  children = "Done",
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { close } = useSheet()
  return (
    <button
      type="button"
      data-slot="sheet-action"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) close()
      }}
      className={cn(
        "col-start-3 inline-flex h-8 min-w-8 cursor-pointer items-center justify-center justify-self-end rounded-full border-0 bg-muted px-2.5 font-sans nessa-text-3 font-semibold text-foreground outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * The sheet's scrolling body. In the drawer it sizes to its content; while
 * expanded it fills under the header and hides its scrollbar.
 */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  const { expanded } = useSheet()
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "flex flex-col gap-3 px-5 pb-6 pt-2",
        expanded &&
          "min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetAction,
  SheetBody,
  SheetClose,
  SheetExpand,
  SheetHandle,
  SheetHeader,
  SheetTitle,
  useSheet,
}
