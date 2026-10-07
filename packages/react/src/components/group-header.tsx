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

export interface GroupHeaderProps
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
   * Whether the group is open. Passing it makes the label a disclosure
   * button with a chevron; the host shows or hides the group's content.
   */
  open?: boolean
  /** Called with the next open state when the disclosure is operated. */
  onOpenChange?: (open: boolean) => void
  /** The id of the content the disclosure shows and hides. */
  controls?: string
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

/**
 * The label above a group of rows: a heading with an optional count, an
 * optional disclosure that collapses the group, and an optional action at
 * the end. It draws only the header; the rows are the host's.
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
  className,
  ...props
}: GroupHeaderProps) {
  const Heading = `h${level}` as const
  const collapsible = open !== undefined
  const text = (
    <>
      <span data-slot="group-header-label" className="min-w-0 truncate">
        {label}
      </span>
      {count !== undefined ? (
        // A space the name reads but the layout already draws as the gap,
        // so the heading is "Projects 4", not "Projects4".
        <span className="sr-only"> </span>
      ) : null}
      {count !== undefined ? (
        <span
          data-slot="group-header-count"
          className="shrink-0 font-normal text-muted-foreground tabular-nums"
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
      data-state={collapsible ? (open ? "open" : "closed") : undefined}
      className={cn("group/group-header flex min-h-7 min-w-0 items-center gap-1 ps-2 pe-1 font-sans", className)}
    >
      <Heading
        className={cn(
          "m-0 flex min-w-0 flex-1 items-center nessa-text-2 font-medium",
          tone === "strong" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={controls}
            onClick={() => onOpenChange?.(!open)}
            className="-ms-1 flex min-h-6 min-w-0 cursor-default appearance-none items-center gap-1.5 rounded-sm border-0 bg-transparent px-1 font-[inherit] text-inherit outline-none transition-[color] [transition-duration:var(--nessa-motion-duration-fast)] hover:text-foreground focus-visible:outline-solid focus-visible:outline-(length:--nessa-focus-outline-width) focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            {text}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 text-muted-foreground transition-transform [transition-duration:var(--nessa-motion-duration-fast)] motion-reduce:transition-none",
                !open && "ltr:-rotate-90 rtl:rotate-90",
              )}
            />
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
