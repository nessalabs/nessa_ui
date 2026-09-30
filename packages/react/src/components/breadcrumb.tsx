import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "./button"

/** One step of a `Breadcrumb` trail. */
export interface BreadcrumbItem {
  /** The step's name. Shown truncated when space runs out; the full text stays its accessible name and hover text. */
  label: string
  /**
   * Returns to this step. Earlier steps with a handler render as buttons;
   * without one they read as plain text. Ignored on the last step, which is
   * the current place.
   */
  onSelect?: () => void
}

export interface BreadcrumbProps
  extends Omit<React.ComponentProps<"nav">, "children"> {
  /**
   * The trail from its first step to the current place. The last item is
   * where the reader is now and is marked `aria-current="page"`.
   */
  items: readonly BreadcrumbItem[]
  /** Names the trail for assistive technology, such as "Where this was opened from". */
  label: string
  /**
   * Leads the first step with a back chevron, for a trail whose first step is
   * the way out rather than just the top of a hierarchy.
   */
  back?: boolean
}

/**
 * A way-back trail: the steps that led to the current place, each earlier one
 * a button that returns to it, and the last the place itself, marked
 * `aria-current="page"`. The trail is a `nav` landmark named by `label` and
 * reads in order as a list.
 *
 * It keeps to one line. When space runs out every step truncates, in
 * proportion to its length, and earlier steps are capped so the current place
 * keeps the most room; each keeps its full label as its accessible name and
 * hover text. Tab visits each earlier step and Enter or Space returns to
 * it; the current place is text and takes no focus.
 */
function Breadcrumb({
  items,
  label,
  back = false,
  className,
  ...props
}: BreadcrumbProps) {
  const lastIndex = items.length - 1

  return (
    <nav
      aria-label={label}
      data-slot="breadcrumb"
      className={cn("flex min-w-0", className)}
      {...props}
    >
      <ol className="m-0 flex min-w-0 list-none items-center gap-0.5 p-0 nessa-text-2">
        {items.map((item, index) => {
          const current = index === lastIndex
          const chevron =
            back && index === 0 ? (
              <ChevronLeft aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null
          return (
            <li
              // Labels may repeat along a trail; the position is the step.
              key={index}
              data-slot="breadcrumb-item"
              // Every step gives up width in proportion to its length; an
              // earlier step is also capped, so a long ancestor cannot take
              // the line from the place the reader is in.
              className={cn(
                "flex min-w-0 shrink items-center gap-0.5",
                !current && "max-w-40",
              )}
            >
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  data-slot="breadcrumb-separator"
                  className="size-3 shrink-0 text-muted-foreground"
                />
              ) : null}
              {current ? (
                <span
                  aria-current="page"
                  data-slot="breadcrumb-current"
                  title={item.label}
                  className="flex min-w-0 items-center gap-1 px-1.5 font-medium text-foreground"
                >
                  {chevron}
                  <span className="truncate">{item.label}</span>
                </span>
              ) : item.onSelect ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-slot="breadcrumb-link"
                  title={item.label}
                  onClick={item.onSelect}
                  className="h-7 min-w-0 shrink gap-1 px-1.5 font-normal text-muted-foreground hover:text-foreground"
                >
                  {chevron}
                  <span className="truncate">{item.label}</span>
                </Button>
              ) : (
                <span
                  data-slot="breadcrumb-step"
                  title={item.label}
                  className="flex min-w-0 items-center gap-1 px-1.5 text-muted-foreground"
                >
                  {chevron}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Breadcrumb }
