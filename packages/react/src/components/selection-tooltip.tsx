"use client"

import * as React from "react"
import { ArrowRight, ChevronRight } from "lucide-react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import {
  useNessaLayerScope,
  usePortalContainer,
} from "@/lib/portal-container"
import { cn } from "@/lib/utils"

export type SelectionTooltipSide = "top" | "bottom"

/**
 * The shared morph timing: everything that swaps in or out of the action row
 * moves on the same duration and curve, so the exchange reads as one gesture.
 */
const morphTransition =
  "transition-[opacity,filter,translate,background-color,color] [transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"

/**
 * Moves focus to an element the pill chose, rather than one the user
 * reached: the ring is suppressed on the compose trigger, since focus it
 * puts back is not a keyboard arrival. A detached node is refused, because
 * focusing one silently leaves focus on the body.
 */
function handBackFocus(
  node: HTMLElement | null,
  trigger: HTMLButtonElement | null,
) {
  if (node === null || !node.isConnected) return
  if (node === trigger) node.dataset.focusRing = "off"
  node.focus({ preventScroll: true })
}

/** Row items the composer displaces: they slip left and dissolve. */
const composingOut =
  "group-data-[composing=true]/selection-tooltip:pointer-events-none group-data-[composing=true]/selection-tooltip:-translate-x-2 group-data-[composing=true]/selection-tooltip:opacity-0 group-data-[composing=true]/selection-tooltip:blur-[2px]"

interface SelectionTooltipContextValue {
  expanded: boolean
  /**
   * Requests a shelf reveal or collapse. Collapsing while focus is inside the
   * shelf moves focus back to the SelectionTooltipMore toggle first, so
   * keyboard users never lose their place to a hidden element.
   */
  setExpanded: (expanded: boolean) => void
  shelfId: string
  shelfMounted: boolean
  setShelfMounted: (mounted: boolean) => void
  moreRef: React.RefObject<HTMLButtonElement | null>
  shelfRef: React.RefObject<HTMLDivElement | null>
  shelfHadFocusRef: React.RefObject<boolean>
  /** Whether the in-place composer has taken over the action row. */
  composing: boolean
  /**
   * Opens or closes the composer. Opening collapses the shelf and
   * remembers where focus came from; closing hands focus back there — or
   * to the SelectionTooltipComposeTrigger — whenever focus is still
   * inside the composer.
   */
  setComposing: (composing: boolean) => void
  composeId: string
  composeMounted: boolean
  setComposeMounted: (mounted: boolean) => void
  composeRef: React.RefObject<HTMLDivElement | null>
  composeTriggerRef: React.RefObject<HTMLButtonElement | null>
  composeHadFocusRef: React.RefObject<boolean>
  rowRef: React.RefObject<HTMLDivElement | null>
}

const SelectionTooltipContext =
  React.createContext<SelectionTooltipContextValue | null>(null)

/**
 * The surrounding SelectionTooltip's own state: the shelf reveal
 * (`expanded` / `setExpanded`, so a host can collapse the shelf after acting
 * on one of its items) and the composer takeover (`composing` /
 * `setComposing`, so a host can open or close it from its own UI). The two
 * are exclusive — turning either on puts the other away. Must be called
 * under a SelectionTooltip.
 */
function useSelectionTooltip(): SelectionTooltipContextValue {
  const context = React.useContext(SelectionTooltipContext)
  if (context === null) {
    throw new Error(
      "useSelectionTooltip must be used within a SelectionTooltip",
    )
  }
  return context
}

export interface SelectionTooltipProps
  extends Omit<React.ComponentProps<"div">, "aria-label"> {
  /** Accessible name for the action group. Defaults to "Selection actions". */
  "aria-label"?: string
  /**
   * Which side of the target the tooltip floats on; the arrow points at the
   * opposite edge. `top` (the default) draws the arrow underneath. Exposed as
   * `data-side` for host styling.
   */
  side?: SelectionTooltipSide
  /** Hides the pointer arrow when false. */
  arrow?: boolean
  /** Controls the SelectionTooltipShelf reveal; omit for uncontrolled use. */
  expanded?: boolean
  /** Initial shelf reveal for uncontrolled use. */
  defaultExpanded?: boolean
  /**
   * Called with the requested reveal whenever SelectionTooltipMore or
   * `setExpanded` from useSelectionTooltip toggles the shelf, in controlled
   * and uncontrolled use alike.
   */
  onExpandedChange?: (expanded: boolean) => void
  /**
   * Controls the SelectionTooltipCompose takeover; omit for uncontrolled use.
   * While it is on, the actions slide out and the composer takes the row.
   */
  composing?: boolean
  /** Initial composer takeover for uncontrolled use. */
  defaultComposing?: boolean
  /**
   * Called with the requested takeover whenever SelectionTooltipComposeTrigger
   * or `setComposing` from useSelectionTooltip opens or closes the composer,
   * in controlled and uncontrolled use alike.
   */
  onComposingChange?: (composing: boolean) => void
  /**
   * Keeps the document selection alive while the pill's controls are used:
   * pointer presses on the action row are prevented unless they land in a
   * text field, so the range the pill acts on survives the click that acts
   * on it. Buttons are activated by click rather than by focus, and keyboard
   * navigation is unaffected. The guard covers the action row only — text in
   * a SelectionTooltipPanel stays selectable, because the panel is content
   * rather than controls. An `onMouseDown` of your own still reaches the
   * pill's root as usual; to pre-empt the guard, use `onMouseDownCapture`,
   * which runs before it. Turn the whole thing off for a pill that is not
   * driven by a document selection.
   */
  preserveSelection?: boolean
}

/**
 * A floating selection-callout pill, in the spirit of the iOS text-selection
 * menu: SelectionTooltipAction buttons separated by SelectionTooltipSeparator
 * rules, a SelectionTooltipMore chevron, and a SelectionTooltipShelf that the
 * chevron reveals. Purely presentational — the host positions it over the
 * selection (it is not portalled and does no anchoring), and what each action
 * does stays host-owned through `onClick`. Expanding keeps the pill at its
 * collapsed width — SelectionTooltipLabels hide, the shelf fills the freed
 * space and scrolls, and the chevron never moves, so collapsing again needs no
 * cursor travel.
 *
 * Writing — a comment, a question, a prompt — happens in the pill rather than
 * beside it: a SelectionTooltipComposeTrigger slides the actions out and a
 * SelectionTooltipCompose input into the same row, and a
 * SelectionTooltipPanel grows beneath it for whatever the writing produced.
 * Give SelectionTooltipPanel as a direct child; every other child belongs to
 * the action row.
 */
function SelectionTooltip({
  "aria-label": ariaLabel = "Selection actions",
  side = "top",
  arrow = true,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  composing,
  defaultComposing = false,
  onComposingChange,
  preserveSelection = true,
  className,
  style,
  ref,
  children,
  ...props
}: SelectionTooltipProps) {
  const shelfId = React.useId()
  const composeId = React.useId()
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const idleWidthRef = React.useRef<number | null>(null)
  const moreRef = React.useRef<HTMLButtonElement | null>(null)
  const shelfRef = React.useRef<HTMLDivElement | null>(null)
  const shelfHadFocusRef = React.useRef(false)
  const composeRef = React.useRef<HTMLDivElement | null>(null)
  const composeTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const composeReturnRef = React.useRef<HTMLElement | null>(null)
  // Whether the composer held focus when it last lost it. A controlled close
  // leaves `document.activeElement` on the body either way — the browser
  // blurring the now-inert input looks exactly like the user clicking blank
  // page — so the body alone is not evidence that focus belongs back here.
  const composeHadFocusRef = React.useRef(false)
  // Set when a close leaves focus inside the composer, consumed by the
  // layout effect below once the row is interactive again.
  const restorePendingRef = React.useRef(false)
  // Focus the pill puts back is never ringed. A focus ring answers "where
  // did my keyboard land?", and nobody's keyboard landed here — the composer
  // closed and the pill returned focus to where it came from, by pointer or
  // by Enter alike. The browser's :focus-visible heuristic cannot tell the
  // two apart (it counts the typing that came before), so the return is
  // marked and the ring suppressed until the element is left and focused
  // again — tabbing to it still rings it, which is the case the ring is for.
  // Where focus was when the composer opened, so closing can hand it back.
  // Only somewhere inside the pill counts: focus out in the document belongs
  // to the document, and the pill has no business pulling it in.
  const rememberFocusOrigin = React.useCallback(() => {
    const active = document.activeElement
    composeReturnRef.current =
      active instanceof HTMLElement &&
      rootRef.current !== null &&
      rootRef.current.contains(active) &&
      composeRef.current?.contains(active) !== true
        ? active
        : null
  }, [])
  // Hands focus to the remembered origin, or to the trigger when that origin
  // is gone — a host may well have dropped the action that opened the
  // composer while it was open, and focus() on a detached node is a silent
  // no-op that would leave focus on the body.
  const restoreFocus = React.useCallback(() => {
    const remembered = composeReturnRef.current
    composeReturnRef.current = null
    const node =
      remembered !== null &&
      remembered.isConnected &&
      rootRef.current?.contains(remembered) === true
        ? remembered
        : composeTriggerRef.current
    handBackFocus(node, composeTriggerRef.current)
  }, [])
  const [shelfMounted, setShelfMounted] = React.useState(false)
  const [composeMounted, setComposeMounted] = React.useState(false)
  const [uncontrolledExpanded, setUncontrolledExpanded] =
    React.useState(defaultExpanded)
  const [uncontrolledComposing, setUncontrolledComposing] =
    React.useState(defaultComposing)
  const isControlled = expanded !== undefined
  const isComposingControlled = composing !== undefined
  const resolvedExpanded = expanded ?? uncontrolledExpanded
  const resolvedComposing = composing ?? uncontrolledComposing
  // Closing the composer is the piece both takeovers need, so it stands on
  // its own: the shelf's opener calls it, and setComposing dispatches to it.
  // Written as a callback rather than a ref assigned during render, which
  // would hand a discarded concurrent render's closure to the next caller.
  const closeComposing = React.useCallback(() => {
    if (
      composeRef.current !== null &&
      composeRef.current.contains(document.activeElement)
    ) {
      // Closing while focus is in the composer would strand it in an inert
      // subtree, so focus has to move — but not yet. The row items are
      // still inert for this render, and focus() on an inert element is a
      // no-op, so the hand-back waits for the commit that revives them.
      restorePendingRef.current = true
    }
    if (!isComposingControlled) setUncontrolledComposing(false)
    onComposingChange?.(false)
  }, [isComposingControlled, onComposingChange])
  const setExpanded = React.useCallback(
    (next: boolean) => {
      // The other half of the one-takeover rule: revealing the shelf puts
      // the composer away, exactly as opening the composer collapses the
      // shelf, so the row never runs both at once.
      if (next) closeComposing()
      // Re-measure at the moment of expansion, while the row is still at its
      // idle width: commit-time measurements go stale when late layout shifts
      // (a web font swapping in) resize the row without a React commit.
      if (next && !previousExpandedRef.current && rowRef.current !== null) {
        const width = rowRef.current.getBoundingClientRect().width
        // A hidden pill measures 0; locking that would collapse the pill
        // entirely, so only positive measurements replace the last good one.
        if (width > 0) idleWidthRef.current = width
      }
      // Rescue focus before the shelf goes display:none, while its focused
      // item is still visible and focusable.
      if (
        !next &&
        shelfRef.current !== null &&
        shelfRef.current.contains(document.activeElement)
      ) {
        moreRef.current?.focus()
      }
      if (!isControlled) setUncontrolledExpanded(next)
      onExpandedChange?.(next)
    },
    [closeComposing, isControlled, onExpandedChange],
  )
  const setComposing = React.useCallback(
    (next: boolean) => {
      if (!next) {
        closeComposing()
        return
      }
      // Same stale-measurement guard as the shelf: the composer fills the
      // row the actions vacate, so the row must already know its width.
      if (!previousComposingRef.current && rowRef.current !== null) {
        const width = rowRef.current.getBoundingClientRect().width
        if (width > 0) idleWidthRef.current = width
      }
      // The shelf and the composer both take the row; opening one closes
      // the other rather than stacking two takeovers on top of each other.
      if (resolvedExpanded) setExpanded(false)
      rememberFocusOrigin()
      if (!isComposingControlled) setUncontrolledComposing(true)
      onComposingChange?.(true)
    },
    [
      closeComposing,
      isComposingControlled,
      onComposingChange,
      rememberFocusOrigin,
      resolvedExpanded,
      setExpanded,
    ],
  )
  // Covers the controlled path, where a host flips `expanded` without going
  // through setExpanded: by this point the shelf is already hidden and focus
  // has fallen to the body, so the shelf's own focus tracking says whether it
  // held focus a moment ago.
  const previousExpandedRef = React.useRef(resolvedExpanded)
  React.useLayoutEffect(() => {
    if (previousExpandedRef.current && !resolvedExpanded) {
      // Focus lost to the hidden shelf lands on the host root; anywhere else
      // means the user has since focused something real, which is kept.
      const active = document.activeElement
      if (
        shelfHadFocusRef.current &&
        (active === null || active.tagName === "BODY")
      ) {
        moreRef.current?.focus()
      }
      shelfHadFocusRef.current = false
    }
    previousExpandedRef.current = resolvedExpanded
  }, [resolvedExpanded])
  // The controlled counterpart for the composer: a host that flips
  // `composing` off leaves the browser to blur the now-inert input, which
  // drops focus to the body. The trigger is where that focus belongs.
  const previousComposingRef = React.useRef(resolvedComposing)
  React.useLayoutEffect(() => {
    // A host that declines a close — a "discard this draft?" confirmation,
    // say — leaves the request behind. It must not survive to steal focus at
    // some later close the user did not connect to it.
    if (resolvedComposing) restorePendingRef.current = false
    // Opened by a host flipping `composing` rather than through
    // setComposing: the origin was never captured, so capture it now, while
    // the composer has not taken focus yet.
    if (!previousComposingRef.current && resolvedComposing) {
      if (composeReturnRef.current === null) rememberFocusOrigin()
    }
    if (previousComposingRef.current && !resolvedComposing) {
      // Focus lost to the inert composer lands on the body; anywhere else
      // means the user has since focused something real, which is kept. The
      // composer's own focus tracking is what separates that from a click on
      // blank page, which also leaves the body focused but never asked for
      // the pill to take focus back.
      const active = document.activeElement
      if (
        restorePendingRef.current ||
        (composeHadFocusRef.current &&
          (active === null ||
            active.tagName === "BODY" ||
            composeRef.current?.contains(active) === true))
      ) {
        // Now that the row is interactive again, focus can land where it
        // came from — the action or toggle that opened the composer.
        restoreFocus()
      }
      composeReturnRef.current = null
      restorePendingRef.current = false
      composeHadFocusRef.current = false
    }
    previousComposingRef.current = resolvedComposing
  }, [rememberFocusOrigin, resolvedComposing, restoreFocus])
  // Remember the row's width every commit spent idle, so the moment the shelf
  // or the composer takes the row it can hold exactly that width: the chevron
  // stays put, the shelf scrolls inside the freed space, and the composer
  // lands on the footprint the actions left.
  const morphing = resolvedExpanded || resolvedComposing
  React.useLayoutEffect(() => {
    if (!morphing) {
      // Subpixel-exact width, so locking it cannot shift the pill by the
      // fraction offsetWidth would round away. A hidden pill measures 0 and
      // is skipped, keeping the last good measurement.
      const width = rowRef.current?.getBoundingClientRect().width
      if (width !== undefined && width > 0) idleWidthRef.current = width
    }
  })
  // Commit-time measurements alone go stale when layout shifts without a
  // React commit (a web font swapping in). setExpanded and setComposing
  // re-measure for the toggle paths; this observer keeps the measurement
  // fresh for controlled hosts that flip the props directly.
  React.useLayoutEffect(() => {
    const node = rowRef.current
    if (morphing || node === null) return
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      const width = node.getBoundingClientRect().width
      // A pill hidden via CSS resizes to 0; that must not poison the lock.
      if (width > 0) idleWidthRef.current = width
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [morphing])
  const composedRef = React.useCallback(
    (node: HTMLDivElement) => {
      rootRef.current = node
      let consumerCleanup: (() => void) | void
      if (typeof ref === "function") consumerCleanup = ref(node)
      else if (ref) ref.current = node
      return () => {
        rootRef.current = null
        if (typeof consumerCleanup === "function") consumerCleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [ref],
  )
  const lockedWidth = morphing ? idleWidthRef.current : null
  const context = React.useMemo(
    () => ({
      expanded: resolvedExpanded,
      setExpanded,
      shelfId,
      shelfMounted,
      setShelfMounted,
      moreRef,
      shelfRef,
      shelfHadFocusRef,
      composing: resolvedComposing,
      setComposing,
      composeId,
      composeMounted,
      setComposeMounted,
      composeRef,
      composeTriggerRef,
      composeHadFocusRef,
      rowRef,
    }),
    [
      resolvedExpanded,
      setExpanded,
      shelfId,
      shelfMounted,
      resolvedComposing,
      setComposing,
      composeId,
      composeMounted,
    ],
  )
  // The panel is a band under the action row rather than an item inside it,
  // so it is lifted out of the row's children by type. Anything else — the
  // actions, the separators, the shelf, the composer — stays in the row.
  const rowChildren: React.ReactNode[] = []
  const panelChildren: React.ReactNode[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === SelectionTooltipPanel) {
      panelChildren.push(child)
    } else {
      rowChildren.push(child)
    }
  })
  return (
    <SelectionTooltipContext.Provider value={context}>
      <div
        role="group"
        aria-label={ariaLabel}
        ref={composedRef}
        style={style}
        data-slot="selection-tooltip"
        data-side={side}
        data-expanded={resolvedExpanded ? "true" : "false"}
        data-composing={resolvedComposing ? "true" : "false"}
        className={cn(
          "group/selection-tooltip relative inline-flex w-fit max-w-full flex-col rounded-xl bg-popover font-sans text-popover-foreground shadow-lg",
          className,
        )}
        {...props}
      >
        <div
          ref={rowRef}
          data-slot="selection-tooltip-row"
          style={lockedWidth === null ? undefined : { width: lockedWidth }}
          onMouseDown={(event) => {
            if (!preserveSelection || event.defaultPrevented) return
            // A press inside a text field must still place the caret; every
            // other press on a control would only collapse the range the
            // pill acts on. The guard covers the action row alone — the
            // panel below it is content, and its text stays selectable.
            if (
              (event.target as HTMLElement).closest(
                "input, textarea, select, [contenteditable=''], [contenteditable='true']",
              ) === null
            ) {
              event.preventDefault()
            }
          }}
          className="relative flex max-w-full items-stretch gap-0.5 p-1"
        >
          {rowChildren}
        </div>
        {panelChildren}
        {arrow && (
          <span
            aria-hidden="true"
            data-slot="selection-tooltip-arrow"
            className={cn(
              "pointer-events-none absolute left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-popover",
              side === "top" && "top-full -translate-y-1/2",
              side === "bottom" && "bottom-full translate-y-1/2",
            )}
          />
        )}
      </div>
    </SelectionTooltipContext.Provider>
  )
}

/**
 * The surrounding pill's composing state, or false when there is no pill.
 * Read through the raw context rather than useSelectionTooltip so a part
 * rendered on its own — a documentation example, a visual test — still
 * renders instead of throwing.
 */
function useComposingRow(): boolean {
  return React.useContext(SelectionTooltipContext)?.composing ?? false
}

export interface SelectionTooltipActionProps
  extends React.ComponentProps<"button"> {
  /**
   * Hover/focus tooltip naming the action — keep it a short label. Portalled
   * with an arrow pointing back at the action, so it escapes the shelf's
   * overflow clipping. Icon-only actions should carry one alongside their
   * `aria-label`.
   */
  tooltip?: React.ReactNode
}

/**
 * One action in the pill. Children carry the label — text, an icon, or both;
 * icon-only actions must name themselves with `aria-label` and should
 * describe themselves with `tooltip`. Wrapping the visible text in
 * SelectionTooltipLabel collapses the action to its icon while the shelf is
 * expanded. What clicking it does stays host-owned through `onClick`. The
 * focus outline draws inset so the shelf's overflow clipping can never
 * swallow it.
 */
function SelectionTooltipAction({
  tooltip,
  className,
  type = "button",
  ...props
}: SelectionTooltipActionProps) {
  // No prop of its own: a layer with no opinion belongs to whatever panel
  // it was opened from, and to the body when there is none.
  const portalContainer = usePortalContainer()
  const layerScope = useNessaLayerScope()
  const composing = useComposingRow()
  const button = (
    <button
      type={type}
      // Displaced by the composer: invisible, so it leaves the tab sequence
      // with the rest of the row rather than handing a keyboard user a
      // control nobody can see.
      inert={composing ? true : undefined}
      data-slot="selection-tooltip-action"
      className={cn(
        "inline-flex h-8 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-lg border-0 bg-transparent px-2.5 nessa-text-4 font-medium text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        morphTransition,
        composingOut,
        className,
      )}
      {...props}
    />
  )
  if (tooltip == null) return button
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      {/* Forced shut while the composer has the row: the action beneath has
          slid out and gone inert, so it never receives the pointerleave
          that would otherwise dismiss its tip. */}
      <TooltipPrimitive.Root open={composing ? false : undefined}>
        <TooltipPrimitive.Trigger asChild>{button}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={portalContainer}>
          <TooltipPrimitive.Content
            {...layerScope}
            side="top"
            sideOffset={6}
            data-slot="selection-tooltip-action-tip"
            className="z-50 max-w-56 rounded-lg bg-primary px-2.5 py-1 text-center font-sans nessa-text-2 font-medium text-primary-foreground shadow-md"
          >
            {tooltip}
            <TooltipPrimitive.Arrow
              width={10}
              height={5}
              className="fill-primary"
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export interface SelectionTooltipLabelProps
  extends React.ComponentProps<"span"> {}

/**
 * The visible text of an action that collapses to icon-only while the shelf
 * is expanded, keeping the pill compact once the extra items appear. The span
 * is presentation-only (`aria-hidden`): give the surrounding action a
 * matching `aria-label`, since its accessible name must survive the label
 * hiding.
 */
function SelectionTooltipLabel({
  className,
  ...props
}: SelectionTooltipLabelProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="selection-tooltip-label"
      className={cn(
        "group-data-[expanded=true]/selection-tooltip:hidden group-data-[composing=true]/selection-tooltip:hidden",
        className,
      )}
      {...props}
    />
  )
}

export interface SelectionTooltipSeparatorProps
  extends React.ComponentProps<"span"> {}

/** The hairline rule between actions. */
function SelectionTooltipSeparator({
  className,
  ...props
}: SelectionTooltipSeparatorProps) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      data-slot="selection-tooltip-separator"
      className={cn(
        "my-1.5 w-px shrink-0 self-stretch bg-border",
        morphTransition,
        composingOut,
        className,
      )}
      {...props}
    />
  )
}

export interface SelectionTooltipMoreProps
  extends Omit<React.ComponentProps<"button">, "children" | "aria-label"> {
  /** Accessible name for the toggle. Defaults to "More actions". */
  "aria-label"?: string
}

/**
 * The chevron toggle that reveals the SelectionTooltipShelf. The chevron
 * turns to point back at the pill while the shelf is open, and the reveal
 * state lives on the surrounding SelectionTooltip. Compose it after the
 * shelf — `…actions, Shelf, More` — so the toggle holds the pill's right
 * edge and the shelf expands between the always-visible actions and it.
 */
function SelectionTooltipMore({
  "aria-label": ariaLabel = "More actions",
  className,
  type = "button",
  onClick,
  ref,
  ...props
}: SelectionTooltipMoreProps) {
  const { expanded, setExpanded, shelfId, shelfMounted, moreRef, composing } =
    useSelectionTooltip()
  // Forwards to the consumer's ref while honoring the callback-ref cleanup
  // contract: a consumer-returned cleanup is invoked on detach, otherwise
  // callback refs are called with `null` and object refs are reset.
  const composedRef = React.useCallback(
    (node: HTMLButtonElement) => {
      moreRef.current = node
      let consumerCleanup: (() => void) | void
      if (typeof ref === "function") consumerCleanup = ref(node)
      else if (ref) ref.current = node
      return () => {
        moreRef.current = null
        if (typeof consumerCleanup === "function") consumerCleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [moreRef, ref],
  )
  return (
    <button
      type={type}
      ref={composedRef}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={shelfMounted ? shelfId : undefined}
      inert={composing ? true : undefined}
      data-slot="selection-tooltip-more"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform aria-expanded:[&_svg]:rotate-180",
        morphTransition,
        composingOut,
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setExpanded(!expanded)
      }}
      {...props}
    >
      <ChevronRight aria-hidden="true" />
    </button>
  )
}

export interface SelectionTooltipShelfProps
  extends Omit<React.ComponentProps<"div">, "aria-label"> {
  /** Accessible name for the shelf region. Defaults to "More actions". */
  "aria-label"?: string
}

/**
 * The horizontally scrollable tray of extra items that SelectionTooltipMore
 * reveals, its scrollbar hidden so the pill stays clean. Children are
 * arbitrary components — more actions, pickers, whole controls. It fills the
 * space the pill's collapsed width allows (the pill does not widen on
 * expand), scrolling whatever overflows. The shelf itself takes keyboard
 * focus, keeping the scroll region operable even when its content is not.
 * Hidden entirely while collapsed.
 */
function SelectionTooltipShelf({
  "aria-label": ariaLabel = "More actions",
  className,
  ref,
  onFocus,
  onBlur,
  ...props
}: SelectionTooltipShelfProps) {
  const {
    expanded,
    shelfId,
    setShelfMounted,
    shelfRef,
    shelfHadFocusRef,
    composing,
  } = useSelectionTooltip()
  React.useLayoutEffect(() => {
    setShelfMounted(true)
    return () => setShelfMounted(false)
  }, [setShelfMounted])
  // Forwards to the consumer's ref while honoring the callback-ref cleanup
  // contract: a consumer-returned cleanup is invoked on detach, otherwise
  // callback refs are called with `null` and object refs are reset.
  const composedRef = React.useCallback(
    (node: HTMLDivElement) => {
      shelfRef.current = node
      let consumerCleanup: (() => void) | void
      if (typeof ref === "function") consumerCleanup = ref(node)
      else if (ref) ref.current = node
      return () => {
        shelfRef.current = null
        if (typeof consumerCleanup === "function") consumerCleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [ref, shelfRef],
  )
  return (
    <div
      id={shelfId}
      role="group"
      aria-label={ariaLabel}
      tabIndex={0}
      inert={composing ? true : undefined}
      ref={composedRef}
      onFocus={(event) => {
        onFocus?.(event)
        shelfHadFocusRef.current = true
      }}
      onBlur={(event) => {
        onBlur?.(event)
        // Focus leaving for another element clears the flag; a blur straight
        // to the body keeps it, because that is what hiding the shelf looks
        // like and the collapse effect needs to know focus was in here.
        if (
          event.relatedTarget !== null &&
          shelfRef.current !== null &&
          !shelfRef.current.contains(event.relatedTarget)
        ) {
          shelfHadFocusRef.current = false
        }
      }}
      data-slot="selection-tooltip-shelf"
      data-expanded={expanded ? "true" : "false"}
      className={cn(
        "min-w-0 grow items-center gap-0.5 overflow-x-auto outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-scrollbar]:hidden",
        morphTransition,
        composingOut,
        expanded ? "flex" : "hidden",
        className,
      )}
      {...props}
    />
  )
}

export interface SelectionTooltipComposeTriggerProps
  extends React.ComponentProps<"button"> {}

/**
 * The action that hands the row to SelectionTooltipCompose — a comment, a
 * question, a prompt. It is the one row item that stays put while the
 * composer is open, because it is the composer's own affordance and the
 * anchor the input slides out from: children carry its mark (an avatar, a
 * brand orb, an icon) and an optional SelectionTooltipLabel that hides for
 * the duration. It toggles: pressing it again, or Escape while it holds
 * focus, puts the composer away — and once the label hides, the trigger's
 * padding evens out so the mark sits centred in what is left rather than
 * off to one side. Closing the composer hands focus back to whatever opened
 * it, which is this trigger unless a host opened it from elsewhere in the
 * pill. Compose it first in the row, so the composer opens to its right.
 */
function SelectionTooltipComposeTrigger({
  className,
  type = "button",
  onBlur,
  onClick,
  onKeyDown,
  ref,
  ...props
}: SelectionTooltipComposeTriggerProps) {
  const {
    composing,
    setComposing,
    composeId,
    composeMounted,
    composeTriggerRef,
  } = useSelectionTooltip()
  // Forwards to the consumer's ref while honoring the callback-ref cleanup
  // contract: a consumer-returned cleanup is invoked on detach, otherwise
  // callback refs are called with `null` and object refs are reset.
  const composedRef = React.useCallback(
    (node: HTMLButtonElement) => {
      composeTriggerRef.current = node
      let consumerCleanup: (() => void) | void
      if (typeof ref === "function") consumerCleanup = ref(node)
      else if (ref) ref.current = node
      return () => {
        composeTriggerRef.current = null
        if (typeof consumerCleanup === "function") consumerCleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [composeTriggerRef, ref],
  )
  // The composer starts where the trigger ends. Publishing that edge as a
  // row-level custom property keeps the input's left edge exact through the
  // trigger's own width changes — its label hiding as the composer opens —
  // without a render per measurement.
  React.useLayoutEffect(() => {
    const node = composeTriggerRef.current
    // Resolved from the DOM rather than from the row's ref: a child's layout
    // effect runs before its parent's ref is attached, so the ref is still
    // empty on the first pass — exactly the pass that must publish the edge.
    const row =
      node?.closest<HTMLElement>('[data-slot="selection-tooltip-row"]') ?? null
    if (node === null || row === null) return
    const measure = () => {
      row.style.setProperty(
        "--selection-tooltip-compose-start",
        `${node.offsetLeft + node.offsetWidth + 2}px`,
      )
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
      row.style.removeProperty("--selection-tooltip-compose-start")
    }
  }, [composeTriggerRef])
  return (
    <button
      type={type}
      ref={composedRef}
      aria-expanded={composing}
      aria-controls={composeMounted ? composeId : undefined}
      data-slot="selection-tooltip-compose-trigger"
      onBlur={(event) => {
        onBlur?.(event)
        // Left the trigger: the next arrival is the user's own doing, and
        // gets the ring it deserves.
        delete event.currentTarget.dataset.focusRing
      }}
      // Icons default to 16px, but only icons: the same `[&_svg]` opt-out as
      // Button, so a child that sizes its own svg keeps it. A RandomAvatar's
      // paint surface is an `svg` that fills its disc; a plain descendant
      // rule would shrink it inside the disc and draw the mark off-centre.
      className={cn(
        "inline-flex h-8 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-transparent pl-1.5 pr-2.5 nessa-text-4 font-medium text-popover-foreground outline-none group-data-[expanded=true]/selection-tooltip:pr-1.5 group-data-[composing=true]/selection-tooltip:pr-1.5 hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[focus-ring=off]:focus-visible:[outline-style:none] disabled:pointer-events-none disabled:opacity-50 group-data-[composing=true]/selection-tooltip:hover:bg-transparent group-data-[composing=true]/selection-tooltip:hover:text-popover-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        morphTransition,
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        // A toggle, as `aria-expanded` promises: pressing it again puts the
        // composer away rather than doing nothing.
        if (!event.defaultPrevented) setComposing(!composing)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        // Escape closes the composer from the trigger too, for a keyboard
        // user who has tabbed back out of the field.
        if (!event.defaultPrevented && event.key === "Escape" && composing) {
          event.preventDefault()
          setComposing(false)
        }
      }}
      {...props}
    />
  )
}

export interface SelectionTooltipComposeProps
  extends Omit<
    React.ComponentProps<"div">,
    "onSubmit" | "children" | "aria-label"
  > {
  /** Accessible name for the input. Defaults to "Write a comment". */
  "aria-label"?: string
  /** Placeholder text for the input. Defaults to "Add a comment…". */
  placeholder?: string
  /** Controlled draft; omit for uncontrolled use. */
  value?: string
  /** Initial draft for uncontrolled use. */
  defaultValue?: string
  /** Called with the draft on every keystroke. */
  onValueChange?: (value: string) => void
  /**
   * Called with the trimmed draft when the user presses Enter or the send
   * button. An empty draft never submits. An uncontrolled draft is cleared
   * afterwards — as is a draft abandoned by closing the composer; a
   * controlled draft is the host's to clear. Whether the composer
   * stays open is the host's too — leave `composing` on to keep writing, or
   * turn it off to hand the row back to the actions.
   */
  onSubmit?: (value: string) => void
  /** Accessible name for the send button. Defaults to "Send". */
  submitLabel?: string
  /** Contents of the send button. Defaults to an arrow. */
  submitIcon?: React.ReactNode
  /** Extra controls between the input and the send button. */
  children?: React.ReactNode
}

/**
 * The input that takes over the action row while the pill is composing: it
 * lies over the row, between the SelectionTooltipComposeTrigger and the
 * pill's right edge, and slides in as the actions slide out. Enter and the
 * send button submit; Escape closes the composer, which hands focus back to
 * whatever opened it and falls back to the SelectionTooltipComposeTrigger.
 * It is inert and unreachable while the pill is not composing, and the
 * actions it displaces go inert in their turn, so the row keeps exactly one
 * tab sequence either way. Give it as a direct child of SelectionTooltip,
 * beside the trigger.
 */
function SelectionTooltipCompose({
  "aria-label": ariaLabel = "Write a comment",
  placeholder = "Add a comment…",
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  submitLabel = "Send",
  submitIcon,
  className,
  style,
  ref,
  children,
  onFocus,
  onBlur,
  ...props
}: SelectionTooltipComposeProps) {
  const {
    composing,
    setComposing,
    composeId,
    setComposeMounted,
    composeRef,
    composeHadFocusRef,
  } = useSelectionTooltip()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const draft = value ?? uncontrolledValue
  React.useLayoutEffect(() => {
    setComposeMounted(true)
    return () => setComposeMounted(false)
  }, [setComposeMounted])
  // Opening the composer is a request to write: the caret belongs in the
  // input, not on the trigger the press landed on. Closing it abandons what
  // was being written, so an uncontrolled draft does not come back next time
  // — a controlled one stays the host's to keep or clear.
  const wasComposingRef = React.useRef(composing)
  React.useEffect(() => {
    if (composing) inputRef.current?.focus({ preventScroll: true })
    // Only the close itself abandons a draft. Clearing on every render spent
    // closed would eat `defaultValue` before it was ever shown.
    else if (wasComposingRef.current && !isControlled) setUncontrolledValue("")
    wasComposingRef.current = composing
  }, [composing, isControlled])
  // Forwards to the consumer's ref while honoring the callback-ref cleanup
  // contract: a consumer-returned cleanup is invoked on detach, otherwise
  // callback refs are called with `null` and object refs are reset.
  const composedRef = React.useCallback(
    (node: HTMLDivElement) => {
      composeRef.current = node
      let consumerCleanup: (() => void) | void
      if (typeof ref === "function") consumerCleanup = ref(node)
      else if (ref) ref.current = node
      return () => {
        composeRef.current = null
        if (typeof consumerCleanup === "function") consumerCleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [composeRef, ref],
  )
  const submit = () => {
    const trimmed = draft.trim()
    if (trimmed.length === 0) return
    if (!isControlled) setUncontrolledValue("")
    onSubmit?.(trimmed)
  }
  return (
    <div
      id={composeId}
      ref={composedRef}
      onFocus={(event) => {
        onFocus?.(event)
        composeHadFocusRef.current = true
      }}
      onBlur={(event) => {
        onBlur?.(event)
        // Focus leaving for another element clears the flag; a blur straight
        // to the body keeps it, because that is what the composer going
        // inert looks like and the close path needs to know focus was here.
        if (
          event.relatedTarget !== null &&
          composeRef.current !== null &&
          !composeRef.current.contains(event.relatedTarget)
        ) {
          composeHadFocusRef.current = false
        }
      }}
      inert={composing ? undefined : true}
      data-slot="selection-tooltip-compose"
      data-composing={composing ? "true" : "false"}
      style={{
        left: "var(--selection-tooltip-compose-start, 0.25rem)",
        ...style,
      }}
      className={cn(
        "absolute inset-y-1 right-1 flex translate-x-2 items-center gap-1 opacity-0 blur-[2px] group-data-[composing=true]/selection-tooltip:translate-x-0 group-data-[composing=true]/selection-tooltip:opacity-100 group-data-[composing=true]/selection-tooltip:blur-none",
        morphTransition,
        className,
      )}
      {...props}
    >
      <input
        ref={inputRef}
        type="text"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        data-slot="selection-tooltip-compose-input"
        onChange={(event) => {
          if (!isControlled) setUncontrolledValue(event.target.value)
          onValueChange?.(event.target.value)
        }}
        onKeyDown={(event) => {
          // Enter confirms an IME candidate before it ever means "send".
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            setComposing(false)
          }
        }}
        // No focus ring of its own: the composer opens focused, so a ring
        // would box the field every time the pill morphs, and the caret
        // already marks where typing goes. The buttons beside it keep theirs.
        className="h-8 min-w-0 grow border-0 bg-transparent px-1.5 font-sans nessa-text-4 text-popover-foreground outline-none placeholder:text-muted-foreground"
      />
      {children}
      <button
        type="button"
        aria-label={submitLabel}
        onClick={submit}
        disabled={draft.trim().length === 0}
        data-slot="selection-tooltip-compose-submit"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-primary p-0 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
          morphTransition,
        )}
      >
        {submitIcon ?? <ArrowRight aria-hidden="true" />}
      </button>
    </div>
  )
}

export interface SelectionTooltipPanelProps extends React.ComponentProps<"div"> {
  /**
   * Whether the band is open. Defaults to true, so a panel that is mounted
   * when it is needed grows open on arrival; hosts that keep it mounted can
   * animate it shut instead by flipping this.
   */
  open?: boolean
}

/**
 * The band that grows beneath the action row for whatever the pill produced —
 * a posted comment, a thread, a streaming answer. It animates between its
 * closed height and its content's height, and it is inert while closed, so
 * nothing inside it can be tabbed into behind the user's back, and it is
 * out of flow while shut, so a band wider than the action row never widens
 * the pill at rest. Give it as a direct child of SelectionTooltip; it is
 * lifted out of the row by type, so a panel behind a fragment or a host
 * wrapper would stay in the row instead. `className`, `style`, `ref` and
 * every other prop reach the band's content element, not the animated
 * height wrapper around it.
 */
function SelectionTooltipPanel({
  open = true,
  className,
  children,
  onFocus,
  onBlur,
  ...props
}: SelectionTooltipPanelProps) {
  const pill = React.useContext(SelectionTooltipContext)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const hadFocusRef = React.useRef(false)
  const wasOpenRef = React.useRef(open)
  const [height, setHeight] = React.useState(0)
  // Closing the band makes it inert, and a control the user was standing on
  // often closes it — the last comment's delete button, a Clear all. Left
  // alone that drops focus to the document body and the next Tab restarts
  // at the top of the page, so focus is handed back to the row first.
  React.useLayoutEffect(() => {
    if (wasOpenRef.current && !open) {
      const active = document.activeElement
      if (
        hadFocusRef.current &&
        (active === null ||
          active.tagName === "BODY" ||
          contentRef.current?.contains(active) === true)
      ) {
        handBackFocus(
          pill?.composeTriggerRef.current ?? pill?.moreRef.current ?? null,
          pill?.composeTriggerRef.current ?? null,
        )
      }
      hadFocusRef.current = false
    }
    wasOpenRef.current = open
  }, [open, pill])
  // Content height rather than a fixed one: the band follows a thread that
  // grows, an answer that streams in, a reply that wraps at a new width.
  React.useLayoutEffect(() => {
    const node = contentRef.current
    if (node === null) return
    const measure = () => setHeight(node.getBoundingClientRect().height)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      data-slot="selection-tooltip-panel"
      data-open={open ? "true" : "false"}
      style={{ height: open ? height : 0 }}
      className="relative overflow-hidden rounded-b-xl transition-[height] [transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"
    >
      <div
        ref={contentRef}
        inert={open ? undefined : true}
        onFocus={(event) => {
          onFocus?.(event)
          hadFocusRef.current = true
        }}
        onBlur={(event) => {
          onBlur?.(event)
          // A blur to another element means the user moved on; a blur to
          // nothing is what closing the band looks like, and the effect
          // above needs to know focus was in here when that happens.
          if (
            event.relatedTarget !== null &&
            contentRef.current !== null &&
            !contentRef.current.contains(event.relatedTarget)
          ) {
            hadFocusRef.current = false
          }
        }}
        data-slot="selection-tooltip-panel-content"
        className={cn(
          "border-t border-border bg-muted/40 px-3 py-2.5 font-sans nessa-text-3 text-popover-foreground",
          // Out of flow while shut, so a band wider than the action row
          // cannot widen the pill it is not showing in — the row's own width
          // is what the pill holds at rest, and what the lock hands to the
          // composer.
          open ? "" : "absolute inset-x-0 top-0",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export {
  SelectionTooltip,
  SelectionTooltipAction,
  SelectionTooltipCompose,
  SelectionTooltipComposeTrigger,
  SelectionTooltipLabel,
  SelectionTooltipMore,
  SelectionTooltipPanel,
  SelectionTooltipSeparator,
  SelectionTooltipShelf,
  useSelectionTooltip,
}
