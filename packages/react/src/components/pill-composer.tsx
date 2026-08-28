"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  ChatComposerContext,
  type ChatComposerInputAdapter,
} from "./chat-composer"

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
 * One revolution of iridescence wrapping the whole rim: the
 * Apple-Intelligence-style spectrum — amber through pink and purple into
 * cyan — decays continuously from the crisp near-white head all the way
 * around, faintest just behind the head's sharp cutoff. The stops are the
 * --nessa-chat-rim-* tokens, identical in both themes — a light source.
 */
const pillComposerRimSpinnerClassName =
  "absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,var(--nessa-chat-rim-0)_0deg,var(--nessa-chat-rim-1)_90deg,var(--nessa-chat-rim-2)_180deg,var(--nessa-chat-rim-3)_260deg,var(--nessa-chat-rim-4)_320deg,var(--nessa-chat-rim-head)_356deg,transparent_360deg)]"

/** Masks a full-bleed layer down to an edge band `inset` pixels deep. */
function rimBandMask(inset: number): React.CSSProperties {
  return {
    padding: inset,
    WebkitMaskImage:
      "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
    WebkitMaskClip: "content-box, border-box",
    WebkitMaskComposite: "xor",
    maskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
    maskClip: "content-box, border-box",
    maskComposite: "exclude",
  }
}

// The spinner square is twice the pill's width, so rotating it never
// exposes a corner on any wider-than-tall pill.

export type PillComposerRimVariant = "orbit" | "comet" | "pulse" | "aurora"

/**
 * The traveling-light overlay: a thin crisp gradient band on the pill's
 * rim, plus a blurred copy bleeding a few pixels inward as a soft glow —
 * nothing renders outside the pill. It fades in and out with `active` and
 * keeps animating until the fade-out finishes, so toggling reads as the
 * light dimming, not stopping. The motion itself comes in variants:
 * `orbit` revolves the trail at constant speed, `comet` laps faster with
 * an eased surge each revolution, `pulse` holds still and breathes, and
 * `aurora` revolves while the whole spectrum slowly cycles hue.
 */
function PillComposerRim({
  active,
  variant = "orbit",
}: {
  active: boolean
  variant?: PillComposerRimVariant
}) {
  const reducedMotion = useReducedMotion()
  const [present, setPresent] = React.useState(false)
  const ringSpinRef = React.useRef<HTMLSpanElement>(null)
  const glowSpinRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    // With reduced motion the opacity transition is suppressed, so no
    // transitionend will retire the presence flag; mirror `active` directly.
    if (active || reducedMotion) setPresent(active)
  }, [active, reducedMotion])

  const spinning = present && !reducedMotion
  React.useEffect(() => {
    const ring = ringSpinRef.current
    const glow = glowSpinRef.current
    if (!ring || !glow || !spinning) return
    const ambient = cssDurationInMilliseconds(
      getComputedStyle(ring).getPropertyValue("--nessa-motion-duration-ambient"),
      3200,
    )
    if (ambient === 0) return
    const spin = [{ rotate: "0deg" }, { rotate: "360deg" }]
    const animations: Animation[] = []
    if (variant !== "pulse") {
      const duration = variant === "comet" ? ambient * 0.55 : ambient
      const easing =
        variant === "comet" ? "cubic-bezier(0.6, 0.15, 0.4, 0.85)" : "linear"
      const options = { duration, easing, iterations: Infinity }
      animations.push(ring.animate(spin, options), glow.animate(spin, options))
    }
    if (variant === "pulse") {
      const options = {
        duration: ambient / 2,
        easing: "ease-in-out",
        iterations: Infinity,
      }
      animations.push(
        ring.animate(
          [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }],
          options,
        ),
        glow.animate(
          [{ opacity: 0.35 }, { opacity: 0.12 }, { opacity: 0.35 }],
          options,
        ),
      )
    }
    if (variant === "aurora") {
      const options = {
        duration: ambient * 1.6,
        easing: "linear",
        iterations: Infinity,
      }
      animations.push(
        ring.animate(
          [{ filter: "hue-rotate(0deg)" }, { filter: "hue-rotate(360deg)" }],
          options,
        ),
        // The glow's blur rides along in the keyframes: animating `filter`
        // replaces the class value for the animation's duration.
        glow.animate(
          [
            { filter: "blur(6px) hue-rotate(0deg)" },
            { filter: "blur(6px) hue-rotate(360deg)" },
          ],
          options,
        ),
      )
    }
    return () => animations.forEach((animation) => animation.cancel())
  }, [spinning, variant])

  return (
    <span
      aria-hidden="true"
      data-slot="pill-composer-rim"
      data-active={active || undefined}
      data-variant={variant}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && !active) setPresent(false)
      }}
      className="pointer-events-none absolute -inset-px z-10 rounded-[inherit] opacity-0 transition-opacity [transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)] data-[active]:opacity-100 motion-reduce:transition-none"
    >
      <span
        data-slot="pill-composer-rim-glow"
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        style={rimBandMask(5)}
      >
        <span
          ref={glowSpinRef}
          className={cn(pillComposerRimSpinnerClassName, "blur-[6px] opacity-35")}
        />
      </span>
      <span
        data-slot="pill-composer-rim-ring"
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        style={rimBandMask(2)}
      >
        <span ref={ringSpinRef} className={pillComposerRimSpinnerClassName} />
      </span>
    </span>
  )
}

/** A compact pill-shaped message-entry form with a traveling-light working state. */
export interface PillComposerProps extends React.ComponentProps<"form"> {
  /**
   * Shows the iridescent light traveling the pill's rim while the agent
   * works. Toggling fades the light in and out rather than switching it.
   */
  generating?: boolean
  /** Chooses the rim's motion while generating. Defaults to `orbit`. */
  rimVariant?: PillComposerRimVariant
  /** Sets the preferred width in CSS pixels while preserving host containment. */
  width?: number
  submitOnEnter?: boolean
}

/**
 * Renders the pill form and provides the ChatComposer slot context, so
 * ChatComposerInput, ChatComposerAttachments, ChatComposerAction, and
 * ChatComposerTrigger compose inside it unchanged. Lay the single control
 * row out with PillComposerRow; attachments stack above it and round the
 * pill's corners as it grows.
 */
function PillComposer({
  generating = false,
  rimVariant = "orbit",
  width,
  submitOnEnter = true,
  className,
  children,
  style,
  ...props
}: PillComposerProps) {
  const [inputAdapter, setInputAdapter] =
    React.useState<ChatComposerInputAdapter | null>(null)

  // The pill reads as `constrained` so ChatComposerInput drops its min-height
  // floor and hugs a single line, growing only with content; the attachments
  // row inherits its scroll cap the same way.
  const context = React.useMemo(
    () => ({
      composerMaxHeight: undefined,
      constrained: true,
      submitOnEnter,
      size: "compact" as const,
      inputAdapter,
      registerInput: setInputAdapter,
    }),
    [inputAdapter, submitOnEnter],
  )

  return (
    <ChatComposerContext.Provider value={context}>
      <form
        data-slot="pill-composer"
        data-generating={generating || undefined}
        aria-busy={generating || undefined}
        className={cn(
          // No focus-within ring or border shift: the caret carries focus, as
          // in ChatComposer's borderMode "none" (owner preference, Aug 2026).
          "relative flex min-w-0 w-full max-w-full flex-col gap-1.5 rounded-[1.625rem] border border-border bg-card p-1.5 font-sans text-card-foreground",
          className,
        )}
        style={{
          ...style,
          ...(width === undefined ? undefined : { width: `min(${width}px, 100%)` }),
        }}
        {...props}
      >
        <PillComposerRim active={generating} variant={rimVariant} />
        {children}
      </form>
    </ChatComposerContext.Provider>
  )
}

/** Lays out the pill's single control row: leading actions, input, trailing actions. */
function PillComposerRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="pill-composer-row"
      className={cn("flex min-w-0 max-w-full items-end gap-1", className)}
      {...props}
    />
  )
}

export { PillComposer, PillComposerRow }
