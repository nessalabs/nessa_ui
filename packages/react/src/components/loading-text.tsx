"use client"

import * as React from "react"

import { shimmerClasses, useShimmer } from "@/lib/shimmer"
import { cn } from "@/lib/utils"

export interface LoadingTextProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /**
   * What is loading, shown and announced. Plain text only: the status
   * region repeats it, and a copy of an element tree there would mount
   * its effects, ids and focus stops twice. Defaults to "Loading".
   */
  children?: string
  /**
   * Whether the text is announced to assistive technology. Turn it off
   * when the host already carries the status, as GeneratingSurface does.
   * Defaults to true.
   */
  announce?: boolean
}

/**
 * Text with a highlight sweeping across it, for anything still loading:
 * the default loader wherever a frame has nothing to show yet. The
 * gradient is clipped to the glyphs, so the label stays real text; under
 * reduced motion it is plain muted text. It is announced politely after
 * it mounts (a live region only reads changes made after it joins the
 * accessibility tree), and again whenever the label changes.
 */
function LoadingText({
  children = "Loading",
  announce = true,
  className,
  ...props
}: LoadingTextProps) {
  const { ref, shimmering } = useShimmer<HTMLSpanElement>(true)
  // Starts empty and fills after mount, and empties again whenever
  // announcing is off, so a region that appears always receives its text
  // as a change it can read out.
  const [announced, setAnnounced] = React.useState(false)
  React.useEffect(() => setAnnounced(announce), [announce])
  return (
    <span data-slot="loading-text" className={cn("relative", className)} {...props}>
      <span
        ref={ref}
        aria-hidden={announce || undefined}
        data-shimmer={shimmering ? "true" : undefined}
        className={cn("nessa-text-4 text-muted-foreground", shimmerClasses)}
      >
        {children}
      </span>
      {announce && (
        <span role="status" className="sr-only">
          {announced ? children : null}
        </span>
      )}
    </span>
  )
}

export { LoadingText }
