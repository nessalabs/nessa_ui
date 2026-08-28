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
 * One revolution of iridescence: a long transparent stretch, a soft
 * spectral tail that brightens toward the direction of travel, and a crisp
 * near-white head that cuts off sharply so the light reads as led rather
 * than smeared. Fixed spectral colors, not theme tokens — the effect is a
 * light source and should look identical over light and dark surfaces.
 */
const pillComposerRimGradient =
  "conic-gradient(from 0deg, transparent 0deg, transparent 190deg, rgba(94, 234, 212, 0) 190deg, rgba(94, 234, 212, 0.75) 252deg, rgba(96, 165, 250, 0.9) 288deg, rgba(196, 181, 253, 0.95) 318deg, rgba(244, 114, 182, 1) 342deg, rgba(255, 255, 255, 1) 356deg, transparent 360deg)"

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

/**
 * Covers the layer with a rotatable square large enough that spinning it
 * never exposes a corner: twice the pill's width exceeds the diagonal of
 * any wider-than-tall pill.
 */
const rimSpinnerStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "200%",
  aspectRatio: "1",
  translate: "-50% -50%",
  backgroundImage: pillComposerRimGradient,
}

/**
 * The traveling-light overlay: a thin crisp gradient band on the pill's
 * rim, plus a blurred copy bleeding a few pixels inward as a soft glow —
 * nothing renders outside the pill. It fades in and out with `active` and
 * keeps revolving until the fade-out finishes, so toggling reads as the
 * light dimming, not stopping.
 */
function PillComposerRim({ active }: { active: boolean }) {
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
    const duration = cssDurationInMilliseconds(
      getComputedStyle(ring).getPropertyValue("--nessa-motion-duration-ambient"),
      3200,
    )
    if (duration === 0) return
    const keyframes = [{ rotate: "0deg" }, { rotate: "360deg" }]
    const options = {
      duration,
      easing: "linear",
      iterations: Infinity,
    } as const
    const animations = [ring.animate(keyframes, options), glow.animate(keyframes, options)]
    return () => animations.forEach((animation) => animation.cancel())
  }, [spinning])

  return (
    <span
      aria-hidden="true"
      data-slot="pill-composer-rim"
      data-active={active || undefined}
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
          style={{ ...rimSpinnerStyle, filter: "blur(6px)", opacity: 0.35 }}
        />
      </span>
      <span
        data-slot="pill-composer-rim-ring"
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        style={rimBandMask(2)}
      >
        <span ref={ringSpinRef} style={rimSpinnerStyle} />
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
        <PillComposerRim active={generating} />
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
