"use client"

import * as React from "react"
import { HoverCard, Slot } from "radix-ui"
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * One cited source rendered by `ReferenceCard`.
 */
export interface ReferenceSource {
  /** Display name of the cited document ("Stripe Investor Letter"). */
  title: React.ReactNode
  /**
   * Destination of the source. Renders the title as a link and adds the
   * footer "View source" link when present.
   */
  href?: string
  /** Quoted excerpt (or any node) shown as the card body. */
  excerpt?: React.ReactNode
  /** Locator detail shown in the footer ("Page 14", "§3.2", "12:04"). */
  meta?: React.ReactNode
  /**
   * Label for the footer link.
   *
   * @default "View source"
   */
  sourceLabel?: React.ReactNode
}

/**
 * Shared state between a `Reference` root and the trigger and content
 * composed inside it, so touch taps can open the card and the content can
 * report where it lives for the focus-within hold.
 */
interface ReferenceContextValue {
  /** Whether the card is currently open. */
  open: boolean
  /** Opens the card (used by the trigger's touch-tap path). */
  openCard: () => void
  /**
   * Closes the card unconditionally (Escape, focus leaving the card),
   * returning focus to the trigger when it was inside the card so keyboard
   * users are not stranded on `body`.
   */
  closeCard: () => void
  /** Registers (or with `null`, unregisters) the trigger element. */
  registerTrigger: (element: HTMLElement | null) => void
  /** Registers (or with `null`, unregisters) the mounted content element. */
  registerContent: (element: HTMLElement | null) => void
  /** Whether the node lives inside the trigger element. */
  isWithinTrigger: (node: Node) => boolean
  /**
   * Re-arms opening after a close-time focus return. The programmatic
   * focus schedules a Radix open that would undo the dismissal, so it is
   * swallowed once; a fresh hover or a blur re-arms opening.
   */
  clearOpenSuppression: () => void
}

const ReferenceContext = React.createContext<ReferenceContextValue | null>(
  null,
)

/**
 * Reads the surrounding reference's context.
 *
 * @param consumer - Component name used in the error when rendered outside a
 * `Reference`.
 */
function useReference(consumer: string) {
  const context = React.useContext(ReferenceContext)
  if (!context) {
    throw new Error(`${consumer} must be used within a Reference.`)
  }
  return context
}

export interface ReferenceProps
  extends React.ComponentProps<typeof HoverCard.Root> {}

/**
 * An inline citation for agent and research surfaces: a small chip embedded
 * in flowing text that reveals its supporting evidence in a floating card,
 * and navigates to the source when clicked.
 *
 * Compose `ReferenceTrigger` (the chip) with `ReferenceContent` (the card).
 * Inside the content, `ReferenceCard` renders the batteries-included
 * source view — title, excerpt, locator, source link, and a pager when a
 * claim cites several sources — or pass any custom node instead.
 *
 * Built on Radix `HoverCard`. The card opens on pointer hover or trigger
 * focus. On touch — where hover does not exist — the first tap reveals the
 * card instead of navigating, and a second tap (or the card's links)
 * follows the source; tapping outside dismisses. It stays open while the
 * pointer — or focus — is inside it, and Escape dismisses it, returning
 * focus to the chip. The card itself is a pointer-first affordance:
 * sequential keyboard navigation cannot reliably reach the portaled card
 * from the chip, which is why the chip is a real link — keyboard and screen
 * reader users follow the citation through the chip itself.
 *
 * @param openDelay - Hover delay before the card opens, in milliseconds.
 * Deliberately faster than the Radix default of 700. @default 150
 * @param closeDelay - Delay before the card closes after the pointer
 * leaves, in milliseconds (Radix default is 300). @default 200
 */
function Reference({
  openDelay = 150,
  closeDelay = 200,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: ReferenceProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)
  // True while the next Radix open request should be ignored: returning
  // focus to the trigger on close fires the trigger's focus-open, which
  // would reopen the card ~openDelay after an Escape dismissal.
  const suppressOpenRef = React.useRef(false)

  const setOpen = React.useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  /**
   * Radix closes the card when the trigger blurs, which would also fire
   * while focus is moving into the card (clicking the scrollable excerpt,
   * focusing a pager button). Holding the card open while focus is inside
   * it keeps those interactions alive; Escape and focus leaving the card
   * close it through `closeCard`.
   */
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (next && suppressOpenRef.current) {
        suppressOpenRef.current = false
        return
      }
      if (
        !next &&
        contentRef.current?.contains(document.activeElement)
      ) {
        return
      }
      setOpen(next)
    },
    [setOpen],
  )

  const context = React.useMemo<ReferenceContextValue>(
    () => ({
      open,
      openCard: () => setOpen(true),
      closeCard: () => {
        // Capture before the state update unmounts the content.
        const focusWasInside = contentRef.current?.contains(
          document.activeElement,
        )
        setOpen(false)
        if (focusWasInside) {
          // The focus return fires the trigger's focus-open; swallow that
          // one request so the dismissal sticks.
          suppressOpenRef.current = true
          triggerRef.current?.focus()
        }
      },
      registerTrigger: (element) => {
        triggerRef.current = element
      },
      registerContent: (element) => {
        contentRef.current = element
      },
      isWithinTrigger: (node) => triggerRef.current?.contains(node) ?? false,
      clearOpenSuppression: () => {
        suppressOpenRef.current = false
      },
    }),
    [open, setOpen],
  )

  return (
    <ReferenceContext.Provider value={context}>
      <HoverCard.Root
        openDelay={openDelay}
        closeDelay={closeDelay}
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </ReferenceContext.Provider>
  )
}

export interface ReferenceTriggerProps extends React.ComponentProps<"a"> {
  /**
   * Merges the trigger behavior and chip styling onto the child element
   * instead of rendering the built-in `<a>`/`<button>`. Use it to promote
   * an existing inline element into the trigger; pass a link-like child
   * when combining with `href`.
   */
  asChild?: boolean
}

/**
 * The inline chip that anchors the citation. Renders an `<a>` when `href`
 * is given (clicking follows the source) and a `<button>` otherwise; either
 * way it stays baseline-friendly so it can sit inside a sentence. Give it a
 * short label as children — a citation number, favicon, or domain. Long
 * labels clip at `max-w-48` (an inline-flex box cannot ellipsize), so keep
 * chip labels short and put full titles in the card.
 *
 * The chip is intentionally smaller than 24px: as an inline target inside a
 * sentence it relies on the WCAG 2.5.8 (Target Size, Minimum) inline
 * exception. A chip rendered standalone — outside flowing text — should be
 * given a larger hit area via `className`.
 *
 * On touch, the first tap opens the card instead of navigating and a
 * second tap follows the source (see `Reference`); the card's links also
 * carry navigation for touch users.
 */
function ReferenceTrigger({
  asChild = false,
  className,
  href,
  children,
  onClick,
  onPointerEnter,
  onBlur,
  ref,
  ...props
}: ReferenceTriggerProps) {
  const { open, openCard, registerTrigger, clearOpenSuppression } =
    useReference("ReferenceTrigger")
  const Comp = (
    asChild ? Slot.Root : href !== undefined ? "a" : "button"
  ) as React.ElementType

  /**
   * Registers the element for close-time focus return and forwards it to
   * the consumer's ref, honoring the callback-ref cleanup contract.
   */
  const composedRef = React.useCallback(
    (element: HTMLAnchorElement | null) => {
      registerTrigger(element)
      let consumerCleanup: (() => void) | void
      if (typeof ref === "function") consumerCleanup = ref(element)
      else if (ref) ref.current = element
      return () => {
        registerTrigger(null)
        if (typeof consumerCleanup === "function") consumerCleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [registerTrigger, ref],
  )

  return (
    <HoverCard.Trigger asChild>
      <Comp
        ref={composedRef}
        data-slot="reference-trigger"
        {...(href !== undefined ? { href } : {})}
        {...(!asChild && href === undefined ? { type: "button" } : {})}
        className={cn(
          "mx-0.5 box-border inline-flex max-w-48 shrink-0 cursor-pointer items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-px align-baseline font-sans text-xs font-medium text-muted-foreground no-underline transition-colors hover:border-ring/60 hover:text-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring/60 data-[state=open]:text-foreground [&>svg]:size-3 [&>svg]:shrink-0",
          className,
        )}
        onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
          // Touch has no hover to reveal the card, so the tap's synthesized
          // click does it: the first tap opens instead of navigating, a
          // second tap falls through to the link. Scroll gestures never
          // synthesize a click, so they cannot open the card spuriously.
          const pointerType = (event.nativeEvent as PointerEvent).pointerType
          if (pointerType === "touch" && !open) {
            event.preventDefault()
            openCard()
          }
          onClick?.(event)
        }}
        onPointerEnter={(event: React.PointerEvent<HTMLAnchorElement>) => {
          // A fresh hover is new intent to open; re-arm a suppressed open.
          clearOpenSuppression()
          onPointerEnter?.(event)
        }}
        onBlur={(event: React.FocusEvent<HTMLAnchorElement>) => {
          // Once focus leaves the trigger, any later focus-open is fresh
          // user intent, not the close-time focus return.
          clearOpenSuppression()
          onBlur?.(event)
        }}
        {...props}
      >
        {children}
      </Comp>
    </HoverCard.Trigger>
  )
}

export interface ReferenceContentProps
  extends React.ComponentProps<typeof HoverCard.Content> {
  /** Portal container, for hosts that scope rendering (dialogs, shells). */
  portalContainer?: HTMLElement | null
  /**
   * Draws the caret pointing at the chip.
   *
   * @default true
   */
  arrow?: boolean
}

/**
 * The floating card revealed on hover, focus, or touch tap. A popover-toned
 * surface positioned above the chip by default, with collision-aware
 * flipping from Radix. Put a `ReferenceCard` inside for the standard source
 * view, or any custom node for bespoke previews.
 *
 * While focus is inside the card it stays open; it closes when focus moves
 * out of it, and Escape closes it from anywhere.
 */
function ReferenceContent({
  portalContainer,
  arrow = true,
  side = "top",
  align = "center",
  sideOffset = 6,
  collisionPadding = 12,
  className,
  children,
  ref,
  onBlur,
  onEscapeKeyDown,
  onPointerDownOutside,
  ...props
}: ReferenceContentProps) {
  const { closeCard, registerContent, isWithinTrigger } =
    useReference("ReferenceContent")

  /**
   * Registers the content element for the root's focus-within hold and
   * forwards it to the consumer's ref, honoring the callback-ref cleanup
   * contract: a consumer-returned cleanup is invoked on detach, otherwise
   * callback refs are called with `null` and object refs are reset.
   */
  const composedRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      registerContent(element)
      let consumerCleanup: (() => void) | void
      if (typeof ref === "function") consumerCleanup = ref(element)
      else if (ref) ref.current = element
      return () => {
        registerContent(null)
        if (typeof consumerCleanup === "function") consumerCleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [registerContent, ref],
  )

  return (
    <HoverCard.Portal container={portalContainer}>
      <HoverCard.Content
        ref={composedRef}
        data-slot="reference-content"
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        onBlur={(event) => {
          onBlur?.(event)
          // The root holds the card open while focus is inside it, so the
          // card owns closing itself when focus moves back out. A null
          // relatedTarget is not treated as leaving: it also fires when
          // focus falls to `body` from in-card interactions (clicking the
          // excerpt text, a pager button disabling itself), where closing
          // would yank the card out from under the pointer — pointer-out
          // and outside-press dismissal cover those endings instead.
          if (
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget as Node)
          ) {
            closeCard()
          }
        }}
        onEscapeKeyDown={(event) => {
          // Escape pressed while focus is inside the card would be vetoed
          // by the focus-within hold, so the card closes itself — unless
          // the consumer prevented the dismissal (the Radix contract).
          onEscapeKeyDown?.(event)
          if (!event.defaultPrevented) closeCard()
        }}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event)
          if (event.defaultPrevented) return
          // A press on the trigger itself is not an outside dismissal: on
          // touch, dismissing here would flush the card closed before the
          // tap's synthesized click, making the second tap reopen instead
          // of following the link. The click decides what the tap means.
          const target = event.target as Node | null
          if (target && isWithinTrigger(target)) event.preventDefault()
        }}
        className={cn(
          "z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-popover font-sans text-sm text-popover-foreground shadow-xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      >
        {children}
        {arrow ? (
          <HoverCard.Arrow
            data-slot="reference-arrow"
            width={12}
            height={6}
            className="fill-border"
          />
        ) : null}
      </HoverCard.Content>
    </HoverCard.Portal>
  )
}

export interface ReferenceCardProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The cited sources. With more than one, a pager appears in the header. */
  sources: readonly ReferenceSource[]
  /**
   * Index of the source shown first.
   *
   * @default 0
   */
  defaultIndex?: number
  /**
   * Classes merged onto the excerpt region. By default the region scrolls
   * inside a fixed height while a pager is present — so stepping between
   * sources never shifts the card — and hugs a lone source's excerpt up to
   * a scroll cap. Override the height utilities (for example
   * `"h-auto max-h-64"`) to retune or release it.
   */
  excerptClassName?: string
  /**
   * Accessible name for the scrollable excerpt region.
   *
   * @default "Excerpt from <title>" when the title is a string, otherwise
   * "Source excerpt"
   */
  excerptLabel?: string
  /**
   * Accessible name for the pager's previous button.
   *
   * @default "Previous source"
   */
  previousLabel?: string
  /**
   * Accessible name for the pager's next button.
   *
   * @default "Next source"
   */
  nextLabel?: string
}

/**
 * The standard citation view: header with the source title (a link when the
 * source has an `href`) and a pager across sibling sources, the quoted
 * excerpt as the body, and a footer holding the locator chip ("Page 14")
 * and an explicit source link. State is internal — feed it `sources` and it
 * handles paging; hosts needing a different layout compose their own
 * content instead. The pager counter uses the locale-neutral "1 / 2" form
 * (matching `MessageAttachments`), and the pager and excerpt accessible
 * names are overridable for localized hosts.
 *
 * The card keeps a stable silhouette while paging: with several sources the
 * excerpt region takes a fixed height and scrolls overflow instead of
 * resizing the card, and the excerpt and footer rows render whenever any
 * sibling source needs them so a sparse source cannot collapse them away.
 * A scrolling excerpt gains a tab stop (and a labelled region role) so the
 * clipped text is focusable; note the card overall is a pointer-first
 * surface (see `Reference`).
 */
function ReferenceCard({
  sources,
  defaultIndex = 0,
  excerptClassName,
  excerptLabel,
  previousLabel = "Previous source",
  nextLabel = "Next source",
  className,
  ...props
}: ReferenceCardProps) {
  const lastIndex = Math.max(0, sources.length - 1)
  const [rawIndex, setRawIndex] = React.useState(() =>
    Math.min(Math.max(defaultIndex, 0), lastIndex),
  )
  // Clamp once and use everywhere, so a shrinking sources array cannot
  // desync the pager buttons from the displayed source.
  const index = Math.min(rawIndex, lastIndex)
  const source = sources[index]

  const excerptRef = React.useRef<HTMLDivElement>(null)
  // Scroll regions must be keyboard-reachable, but a tab stop is only owed
  // while the excerpt actually overflows its height.
  const [excerptScrollable, setExcerptScrollable] = React.useState(false)

  const updateExcerptScrollable = React.useCallback(() => {
    const element = excerptRef.current
    if (!element) return
    // The 1px tolerance keeps fractional content heights from minting a
    // phantom tab stop on an excerpt that cannot actually scroll.
    setExcerptScrollable(element.scrollHeight - element.clientHeight > 1)
  }, [])

  // Paging swaps the excerpt without remounting the region, so overflow is
  // re-measured after every commit; the observer covers non-React resizes.
  React.useEffect(() => {
    updateExcerptScrollable()
  })

  React.useEffect(() => {
    const element = excerptRef.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(updateExcerptScrollable)
    observer.observe(element)
    return () => observer.disconnect()
  }, [updateExcerptScrollable])

  if (!source) return null

  const hasExcerpts = sources.some(
    (candidate) => candidate.excerpt !== undefined,
  )
  const hasFooter = sources.some(
    (candidate) => candidate.meta !== undefined || candidate.href !== undefined,
  )

  const pagerButtonClassName =
    "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-3.5"

  return (
    <div
      data-slot="reference-card"
      className={cn("flex flex-col gap-2 p-3", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {source.href !== undefined ? (
          <a
            data-slot="reference-card-title"
            href={source.href}
            className="min-w-0 flex-1 truncate font-medium text-popover-foreground no-underline hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {source.title}
          </a>
        ) : (
          <span
            data-slot="reference-card-title"
            className="min-w-0 flex-1 truncate font-medium text-popover-foreground"
          >
            {source.title}
          </span>
        )}
        {sources.length > 1 ? (
          <div
            data-slot="reference-card-pager"
            className="flex shrink-0 items-center gap-0.5"
          >
            <button
              type="button"
              aria-label={previousLabel}
              disabled={index === 0}
              onClick={() => setRawIndex(Math.max(0, index - 1))}
              className={pagerButtonClassName}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <span
              aria-live="polite"
              className="text-xs tabular-nums text-muted-foreground"
            >
              {index + 1} / {sources.length}
            </span>
            <button
              type="button"
              aria-label={nextLabel}
              disabled={index >= lastIndex}
              onClick={() => setRawIndex(Math.min(lastIndex, index + 1))}
              className={pagerButtonClassName}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      {hasExcerpts ? (
        <div
          ref={excerptRef}
          data-slot="reference-card-excerpt"
          role="region"
          aria-label={
            excerptLabel ??
            (typeof source.title === "string"
              ? `Excerpt from ${source.title}`
              : "Source excerpt")
          }
          tabIndex={excerptScrollable ? 0 : undefined}
          className={cn(
            "overflow-y-auto text-sm leading-relaxed text-popover-foreground outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&_p]:m-0",
            // A fixed height while paging keeps the card silhouette still as
            // sources swap; a lone source hugs its excerpt up to the cap.
            sources.length > 1 ? "h-32" : "max-h-48",
            excerptClassName,
          )}
        >
          {source.excerpt}
        </div>
      ) : null}
      {hasFooter ? (
        <div
          data-slot="reference-card-footer"
          className="flex min-h-6 items-center gap-2"
        >
          {source.meta !== undefined ? (
            <span
              data-slot="reference-card-meta"
              className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {source.meta}
            </span>
          ) : null}
          {source.href !== undefined ? (
            <a
              data-slot="reference-card-source-link"
              href={source.href}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-popover-foreground no-underline hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:size-3"
            >
              {source.sourceLabel ?? "View source"}
              <ArrowUpRight aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export { Reference, ReferenceCard, ReferenceContent, ReferenceTrigger }
