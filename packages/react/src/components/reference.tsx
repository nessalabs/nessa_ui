"use client"

import * as React from "react"
import { HoverCard } from "radix-ui"
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * One cited source rendered by `ReferenceCard`.
 */
export interface ReferenceSource {
  /**
   * Stable key for the source. Falls back to the array index when omitted,
   * which is fine for the usual static citation lists.
   */
  id?: string
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

export interface ReferenceProps
  extends React.ComponentProps<typeof HoverCard.Root> {}

/**
 * An inline citation for agent and research surfaces: a small chip embedded
 * in flowing text that reveals its supporting evidence in a floating card on
 * hover or keyboard focus, and navigates to the source when clicked.
 *
 * Compose `ReferenceTrigger` (the chip) with `ReferenceContent` (the card).
 * Inside the content, `ReferenceCard` renders the batteries-included
 * source view — title, excerpt, locator, source link, and a pager when a
 * claim cites several sources — or pass any custom node instead.
 *
 * Built on Radix `HoverCard`: the card opens on pointer hover or trigger
 * focus, stays open while the pointer is over it, and dismisses on Escape.
 * The trigger itself is a real link (or button), so keyboard and screen
 * reader users can always follow the citation even without the preview.
 */
function Reference({ openDelay = 150, closeDelay = 200, ...props }: ReferenceProps) {
  return (
    <HoverCard.Root
      openDelay={openDelay}
      closeDelay={closeDelay}
      {...props}
    />
  )
}

export interface ReferenceTriggerProps extends React.ComponentProps<"a"> {
  /**
   * Merges the trigger behavior and chip styling onto the child element
   * instead of rendering the built-in chip. Use it to promote an existing
   * inline element (for example a superscript) into the trigger.
   */
  asChild?: boolean
}

/**
 * The inline chip that anchors the citation. Renders an `<a>` when `href`
 * is given (clicking follows the source) and a `<button>` otherwise; either
 * way it stays baseline-friendly so it can sit inside a sentence. Give it a
 * short label as children — a citation number, favicon, or domain.
 */
function ReferenceTrigger({
  asChild = false,
  className,
  href,
  children,
  ...props
}: ReferenceTriggerProps) {
  const chipClassName = cn(
    "mx-0.5 box-border inline-flex max-w-48 shrink-0 cursor-pointer items-center gap-1 truncate rounded-full border border-border bg-background px-1.5 py-px align-baseline font-sans text-xs font-medium text-muted-foreground no-underline transition-colors hover:border-ring/60 hover:text-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring/60 data-[state=open]:text-foreground [&>svg]:size-3 [&>svg]:shrink-0",
    className,
  )

  if (asChild) {
    return (
      <HoverCard.Trigger data-slot="reference-trigger" asChild {...props}>
        {children}
      </HoverCard.Trigger>
    )
  }

  return (
    <HoverCard.Trigger asChild>
      {href !== undefined ? (
        <a
          data-slot="reference-trigger"
          href={href}
          className={chipClassName}
          {...props}
        >
          {children}
        </a>
      ) : (
        <button
          data-slot="reference-trigger"
          type="button"
          className={chipClassName}
          {...(props as React.ComponentProps<"button">)}
        >
          {children}
        </button>
      )}
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
 * The floating card revealed on hover or focus. A popover-toned surface
 * positioned above the chip by default, with collision-aware flipping from
 * Radix. Put a `ReferenceCard` inside for the standard source view, or any
 * custom node for bespoke previews.
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
  ...props
}: ReferenceContentProps) {
  return (
    <HoverCard.Portal container={portalContainer}>
      <HoverCard.Content
        data-slot="reference-content"
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
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
}

/**
 * The standard citation view: header with the source title (a link when the
 * source has an `href`) and a pager across sibling sources, the quoted
 * excerpt as the body, and a footer holding the locator chip ("Page 14")
 * and an explicit source link. State is internal — feed it `sources` and it
 * handles paging; hosts needing a different layout compose their own
 * content instead.
 *
 * The card keeps a stable silhouette while paging: with several sources the
 * excerpt region takes a fixed height and scrolls overflow instead of
 * resizing the card, and the excerpt and footer rows render whenever any
 * sibling source needs them so a sparse source cannot collapse them away.
 * A scrolling excerpt gains a tab stop (and a labelled region role) so
 * keyboard users can reach the clipped text.
 */
function ReferenceCard({
  sources,
  defaultIndex = 0,
  excerptClassName,
  className,
  ...props
}: ReferenceCardProps) {
  const lastIndex = Math.max(0, sources.length - 1)
  const [index, setIndex] = React.useState(() =>
    Math.min(Math.max(defaultIndex, 0), lastIndex),
  )
  const source = sources[Math.min(index, lastIndex)]

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
              aria-label="Previous source"
              disabled={index === 0}
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
              className={pagerButtonClassName}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <span
              aria-live="polite"
              className="text-xs tabular-nums text-muted-foreground"
            >
              {Math.min(index, lastIndex) + 1} of {sources.length}
            </span>
            <button
              type="button"
              aria-label="Next source"
              disabled={index >= lastIndex}
              onClick={() =>
                setIndex((current) => Math.min(lastIndex, current + 1))
              }
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
            typeof source.title === "string"
              ? `Excerpt from ${source.title}`
              : "Source excerpt"
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
          className="flex min-h-6 items-center justify-between gap-2"
        >
          {source.meta !== undefined ? (
            <span
              data-slot="reference-card-meta"
              className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {source.meta}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          {source.href !== undefined ? (
            <a
              data-slot="reference-card-source-link"
              href={source.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-popover-foreground no-underline hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:size-3"
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
