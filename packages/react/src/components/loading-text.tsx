"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

/** Returns the live, server-safe reduced-motion preference. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

/** Parses a CSS duration token value into milliseconds. */
function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

/**
 * The sweep is painted with theme tokens — muted-foreground body,
 * foreground crest — so it reads in both schemes without `dark:` variants.
 */
const shimmerClasses =
  "data-[shimmer=true]:[background-image:linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_38%,var(--foreground)_50%,var(--muted-foreground)_62%,var(--muted-foreground)_100%)] data-[shimmer=true]:bg-[length:200%_100%] data-[shimmer=true]:bg-[position:150%_0] data-[shimmer=true]:bg-clip-text data-[shimmer=true]:[-webkit-background-clip:text] data-[shimmer=true]:text-transparent"

export interface LoadingTextProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /** What is loading, shown and announced. Defaults to "Loading". */
  children?: React.ReactNode
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
 * reduced motion it is plain muted text. It is announced politely once,
 * after it mounts, since a live region only reads changes made after it
 * joins the accessibility tree.
 */
function LoadingText({
  children = "Loading",
  announce = true,
  className,
  ...props
}: LoadingTextProps) {
  const reducedMotion = useReducedMotion()
  const ref = React.useRef<HTMLSpanElement>(null)
  const [announced, setAnnounced] = React.useState(false)
  React.useEffect(() => setAnnounced(true), [])
  React.useEffect(() => {
    const node = ref.current
    if (!node || reducedMotion) return
    const duration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue("--nessa-motion-duration-ambient"),
      3200,
    )
    if (duration === 0) return
    // The highlight sits at the center of a double-width background, so
    // sliding the position from 150% to -50% carries it once across the
    // text per cycle, left to right.
    const animation = node.animate(
      [{ backgroundPosition: "150% 0" }, { backgroundPosition: "-50% 0" }],
      { duration, easing: "linear", iterations: Infinity },
    )
    return () => animation.cancel()
  }, [reducedMotion])
  return (
    <span data-slot="loading-text" className={cn("relative", className)} {...props}>
      <span
        ref={ref}
        aria-hidden={announce || undefined}
        data-shimmer={reducedMotion ? undefined : "true"}
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
