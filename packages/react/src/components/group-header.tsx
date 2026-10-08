"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

type HeadingLevel = 2 | 3 | 4 | 5 | 6

/**
 * Reveal for an action that waits for the pointer. Only a fine pointer has a
 * hover to reveal on, so a touch screen always shows it; keyboard focus inside
 * the header reveals it too, through `:focus-visible` so a click elsewhere in
 * the header does not keep it shown.
 */
const revealOnHoverClassName =
  "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/group-header:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-has-[:focus-visible]/group-header:opacity-100"

interface GroupHeaderBaseProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The group's name. */
  label: React.ReactNode
  /** How many items the group holds, drawn after the label and read with it. */
  count?: React.ReactNode
  /**
   * `quiet` writes the label small in muted ink, as a list's section label;
   * `strong` writes it in full ink, for a group that asks to be read first.
   * @defaultValue "quiet"
   */
  tone?: "quiet" | "strong"
  /**
   * `default` is a 28px header in level-2 type; `dense` is a caption header
   * (level 1, semibold) 24px tall, for the tight section labels of a
   * sidebar, whose disclosure fills the header's height. Either height is a
   * minimum a host can retune with `--nessa-group-header-height`; below 24px
   * a disclosure is under the target-size floor, which a host that does so
   * answers for (by spacing such headers apart).
   * @defaultValue "default"
   */
  size?: "default" | "dense"
  /** A control at the end of the header — add, filter, more. */
  action?: React.ReactNode
  /**
   * Hides `action` until the header is hovered or holds keyboard focus, on a
   * fine pointer. A touch screen always shows it.
   * @defaultValue false
   */
  actionOnHover?: boolean
  /**
   * The heading level the label is announced at.
   * @defaultValue 2
   */
  level?: HeadingLevel
}

/** A header whose label is a disclosure: `open` comes with its handler. */
interface GroupHeaderDisclosureProps {
  /**
   * The disclosure's glyph, decorative. Draw it pointing down: the header
   * shows it as drawn while open and turns it a quarter toward the inline
   * end while closed, as it does the default chevron.
   * @defaultValue a down chevron
   */
  chevron?: React.ReactNode
  /**
   * Props for the disclosure button itself — `data-*` attributes a host's
   * keyboard navigation reads, a `ref`, handlers. The header still owns
   * `type`, `aria-expanded` and `aria-controls`, and an `onClick` here runs
   * first: calling `preventDefault()` in it keeps the group as it is.
   */
  toggleProps?: Omit<
    React.ComponentPropsWithRef<"button">,
    "type" | "aria-expanded" | "aria-controls" | "children"
  > & { [key: `data-${string}`]: string | number | boolean | undefined }
  /**
   * Whether the group is open. Passing it makes the label a disclosure
   * button with a chevron; the host shows or hides the group's content.
   */
  open: boolean
  /**
   * Called with the next open state when the disclosure is operated.
   * Required with `open`, so a disclosure is never a button that does
   * nothing.
   */
  onOpenChange: (open: boolean) => void
  /** The id of the content the disclosure shows and hides. */
  controls?: string
}

/** A plain header: no disclosure. */
interface GroupHeaderStaticProps {
  chevron?: undefined
  toggleProps?: undefined
  open?: undefined
  onOpenChange?: undefined
  controls?: undefined
}

export type GroupHeaderProps = GroupHeaderBaseProps &
  (GroupHeaderDisclosureProps | GroupHeaderStaticProps)

/**
 * The label above a group of rows: a heading with an optional count, an
 * optional disclosure that collapses the group, and an optional action at
 * the end. It draws only the header; the rows are the host's.
 *
 * A host retunes it from any ancestor with custom properties, each
 * defaulting to the kit's value: `--nessa-group-header-height` (minimum
 * height; 28px, or 24px dense), `--nessa-group-header-ink` (the quiet label;
 * muted foreground), `--nessa-group-header-strong-ink` (the strong label;
 * foreground), `--nessa-group-header-count-ink` (muted foreground),
 * `--nessa-group-header-chevron-ink` (muted foreground) and
 * `--nessa-group-header-hover-ink` (the disclosure's hover; foreground).
 *
 * With `open`, the heading holds a button that announces its expanded state
 * and names `controls` as the region it toggles, the pattern an accordion
 * header uses; the action stays outside that button so each is its own
 * target.
 */
function GroupHeader({
  label,
  count,
  tone = "quiet",
  open,
  onOpenChange,
  controls,
  action,
  actionOnHover = false,
  level = 2,
  size = "default",
  chevron,
  toggleProps,
  className,
  ...props
}: GroupHeaderProps) {
  const Heading = `h${level}` as const
  // A disclosure needs both halves; a plain JS caller passing `open` alone gets a plain heading.
  const collapsible = open !== undefined && onOpenChange !== undefined
  const text = (
    <>
      <span data-slot="group-header-label" className="min-w-0 truncate">
        {label}
      </span>
      {count !== undefined ? (
        // A space the name reads but the layout already draws as the gap,
        // so the heading is "Projects 4", not "Projects4".
        <span data-slot="group-header-separator" className="sr-only"> </span>
      ) : null}
      {count !== undefined ? (
        <span
          data-slot="group-header-count"
          className="shrink-0 font-normal text-[color:var(--nessa-group-header-count-ink,var(--muted-foreground))] tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </>
  )

  return (
    <div
      {...props}
      data-slot="group-header"
      data-tone={tone}
      data-size={size}
      data-state={collapsible ? (open ? "open" : "closed") : undefined}
      className={cn(
        "group/group-header flex min-w-0 items-center gap-1 ps-2 pe-1 font-sans",
        size === "dense"
          ? "min-h-[var(--nessa-group-header-height,calc(var(--spacing)*6))]"
          : "min-h-[var(--nessa-group-header-height,calc(var(--spacing)*7))]",
        className,
      )}
    >
      <Heading
        className={cn(
          "m-0 flex min-w-0 flex-1 items-center self-stretch",
          size === "dense" ? "nessa-text-1 font-semibold" : "nessa-text-2 font-medium",
          tone === "strong"
            ? "text-[color:var(--nessa-group-header-strong-ink,var(--foreground))]"
            : "text-[color:var(--nessa-group-header-ink,var(--muted-foreground))]",
        )}
      >
        {collapsible ? (
          <button
            {...toggleProps}
            type="button"
            aria-expanded={open}
            aria-controls={controls}
            onClick={(event) => {
              toggleProps?.onClick?.(event)
              if (!event.defaultPrevented) onOpenChange?.(!open)
            }}
            className={cn(
              "-ms-1 flex min-w-0 cursor-default appearance-none items-center gap-1.5 rounded-sm border-0 bg-transparent px-1 font-[inherit] text-inherit outline-none transition-[color] [transition-duration:var(--nessa-motion-duration-fast)] hover:text-[color:var(--nessa-group-header-hover-ink,var(--foreground))] focus-visible:outline-solid focus-visible:outline-(length:--nessa-focus-outline-width) focus-visible:outline-offset-1 focus-visible:outline-ring",
              // A dense disclosure fills the header's height, so its target is
              // the header itself and never reaches into the rows beside it.
              size === "dense" ? "min-h-0 self-stretch" : "min-h-6",
              toggleProps?.className,
            )}
          >
            {text}
            <span
              aria-hidden="true"
              data-slot="group-header-chevron"
              className={cn(
                "flex shrink-0 text-[color:var(--nessa-group-header-chevron-ink,var(--muted-foreground))] transition-transform [transition-duration:var(--nessa-motion-duration-fast)] motion-reduce:transition-none [&_svg:not([class*='size-'])]:size-3",
                !open && "ltr:-rotate-90 rtl:rotate-90",
              )}
            >
              {chevron ?? <ChevronDown />}
            </span>
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">{text}</span>
        )}
      </Heading>
      {action !== undefined ? (
        <div
          data-slot="group-header-action"
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity [transition-duration:var(--nessa-motion-duration-fast)]",
            actionOnHover && revealOnHoverClassName,
          )}
        >
          {action}
        </div>
      ) : null}
    </div>
  )
}

export { GroupHeader }
