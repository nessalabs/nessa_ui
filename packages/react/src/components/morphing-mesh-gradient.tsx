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
 * Coerces a numeric prop to something safe to paint with: `NaN` survives
 * `Math.max` and would otherwise end up in an inline style.
 */
function finite(value: number, fallback: number, floor = 0): number {
  return Number.isFinite(value) ? Math.max(floor, value) : fallback
}

/**
 * Softens a pigment toward white while keeping its hue. Used when
 * `inverted` is set so a deep aurora becomes the pale glass treatment
 * without requiring the host to hand-author a second palette.
 */
function invertMeshColor(color: string): string {
  return `color-mix(in oklab, ${color} 38%, white)`
}

/**
 * Builds a stepped palette between two CSS colours via `color-mix`. Any
 * CSS colour the browser understands works — hex, oklch, tokens — so a
 * brand can feed its endpoints and get a mesh-ready range without a
 * colour library.
 */
function meshGradientFromRange(
  start: string,
  end: string,
  count = 5,
): string[] {
  const steps = Math.max(2, Math.floor(finite(count, 5, 2)))
  return Array.from({ length: steps }, (_unused, index) => {
    const endShare = Math.round((index / (steps - 1)) * 100)
    const startShare = 100 - endShare
    if (endShare === 0) return start
    if (startShare === 0) return end
    return `color-mix(in oklab, ${start} ${startShare}%, ${end})`
  })
}

/**
 * How the colour nodes are laid out. `"mesh"` spreads blooms across a
 * corner-and-centre grid (the Apple-setup look). `"aurora"` stretches
 * them into horizontal bands. `"orb"` keeps fewer, larger nodes around
 * the centre for a softer glow.
 */
export type MorphingMeshGradientType = "mesh" | "aurora" | "orb"

/** Every layout type, in display order — for building pickers. */
const morphingMeshGradientTypes = Object.freeze([
  "mesh",
  "aurora",
  "orb",
] as const satisfies readonly MorphingMeshGradientType[])

/**
 * Named palettes for the morphing wash. Values are saturated pigments
 * intended for the default (deep) reading; pass `inverted` to lift the
 * same hues into the pale glass treatment. They are starting points —
 * any CSS colour array works the same way.
 */
const morphingMeshGradientPresets = Object.freeze({
  /** Cool indigo → violet → magenta with a warm amber undertow. */
  aurora: ["#1a237e", "#5c2d91", "#9c27b0", "#e91e8c", "#ffb74d"],
  /** Warm crimson → orange → gold with a violet edge. */
  ember: ["#7a0c1a", "#c62828", "#ef6c00", "#ffb300", "#8e24aa"],
  /** Burnt dusk: copper, magenta, amber, earth. */
  dusk: ["#4a148c", "#ad1457", "#e65100", "#ff8f00", "#5d4037"],
  /** Soft bloom: magenta, peach, lavender, indigo. */
  bloom: ["#880e4f", "#ec407a", "#ffab91", "#ce93d8", "#3949ab"],
  /** Horizon: sky, lavender, rose, amber. */
  horizon: ["#0d47a1", "#7e57c2", "#ec407a", "#ffcc80", "#90caf9"],
  /**
   * The pale glass reading of `aurora` — same hues, lifted. Prefer this
   * preset when the host wants the light treatment without also setting
   * `inverted` (which would wash the pigments a second time).
   */
  auroraInverted: [
    "color-mix(in oklab, #1a237e 38%, white)",
    "color-mix(in oklab, #5c2d91 38%, white)",
    "color-mix(in oklab, #9c27b0 38%, white)",
    "color-mix(in oklab, #e91e8c 38%, white)",
    "color-mix(in oklab, #ffb74d 38%, white)",
  ],
} as const satisfies Record<string, readonly [string, ...string[]]>)

type MeshNode = {
  /** Starting placement as CSS `left` / `top` percentages of the frame. */
  left: number
  top: number
  /** Blob size as a percentage of the frame's shorter axis feel. */
  size: number
  /** Drift keyframes as translate/scale pairs, in % of the blob itself. */
  drift: ReadonlyArray<{ transform: string }>
}

/**
 * Node stations per layout type. Positions are percentages of the frame;
 * drifts are de-phased so neighbouring blooms never pulse as one.
 */
const meshLayouts = Object.freeze({
  mesh: [
    {
      left: 8,
      top: 12,
      size: 72,
      drift: [
        { transform: "translate(-6%, 4%) scale(1)" },
        { transform: "translate(14%, -10%) scale(1.18)" },
        { transform: "translate(-4%, 12%) scale(0.92)" },
      ],
    },
    {
      left: 62,
      top: -8,
      size: 78,
      drift: [
        { transform: "translate(4%, 6%) scale(1.05)" },
        { transform: "translate(-16%, 10%) scale(0.88)" },
        { transform: "translate(10%, -8%) scale(1.2)" },
      ],
    },
    {
      left: 28,
      top: 28,
      size: 88,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(8%, -12%) scale(1.14)" },
        { transform: "translate(-10%, 8%) scale(0.9)" },
      ],
    },
    {
      left: -10,
      top: 48,
      size: 70,
      drift: [
        { transform: "translate(8%, -4%) scale(0.95)" },
        { transform: "translate(-6%, 14%) scale(1.16)" },
        { transform: "translate(12%, 2%) scale(1)" },
      ],
    },
    {
      left: 54,
      top: 52,
      size: 76,
      drift: [
        { transform: "translate(-8%, -6%) scale(1.08)" },
        { transform: "translate(12%, 8%) scale(0.86)" },
        { transform: "translate(-4%, -12%) scale(1.12)" },
      ],
    },
    {
      left: 18,
      top: 68,
      size: 64,
      drift: [
        { transform: "translate(6%, 4%) scale(1)" },
        { transform: "translate(-12%, -8%) scale(1.22)" },
        { transform: "translate(8%, 10%) scale(0.9)" },
      ],
    },
  ],
  aurora: [
    {
      left: -12,
      top: -18,
      size: 96,
      drift: [
        { transform: "translate(4%, 8%) scale(1)" },
        { transform: "translate(18%, -4%) scale(1.15)" },
        { transform: "translate(-6%, 6%) scale(0.94)" },
      ],
    },
    {
      left: 28,
      top: -8,
      size: 90,
      drift: [
        { transform: "translate(-8%, 4%) scale(1.05)" },
        { transform: "translate(10%, 10%) scale(0.9)" },
        { transform: "translate(-4%, -8%) scale(1.18)" },
      ],
    },
    {
      left: 58,
      top: 8,
      size: 92,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(-14%, 8%) scale(1.12)" },
        { transform: "translate(8%, -6%) scale(0.88)" },
      ],
    },
    {
      left: -8,
      top: 38,
      size: 84,
      drift: [
        { transform: "translate(10%, -4%) scale(0.96)" },
        { transform: "translate(-8%, 12%) scale(1.2)" },
        { transform: "translate(6%, 2%) scale(1)" },
      ],
    },
    {
      left: 42,
      top: 48,
      size: 88,
      drift: [
        { transform: "translate(-6%, 6%) scale(1.08)" },
        { transform: "translate(12%, -10%) scale(0.86)" },
        { transform: "translate(-10%, 4%) scale(1.14)" },
      ],
    },
  ],
  orb: [
    {
      left: 18,
      top: 8,
      size: 86,
      drift: [
        { transform: "translate(-4%, 6%) scale(1)" },
        { transform: "translate(10%, -8%) scale(1.16)" },
        { transform: "translate(-8%, 4%) scale(0.92)" },
      ],
    },
    {
      left: 42,
      top: 22,
      size: 98,
      drift: [
        { transform: "translate(0%, 0%) scale(1.05)" },
        { transform: "translate(-8%, 10%) scale(0.9)" },
        { transform: "translate(6%, -6%) scale(1.18)" },
      ],
    },
    {
      left: 8,
      top: 42,
      size: 80,
      drift: [
        { transform: "translate(8%, -4%) scale(0.96)" },
        { transform: "translate(-10%, 8%) scale(1.14)" },
        { transform: "translate(4%, 6%) scale(1)" },
      ],
    },
    {
      left: 52,
      top: 48,
      size: 84,
      drift: [
        { transform: "translate(-6%, -6%) scale(1.08)" },
        { transform: "translate(8%, 10%) scale(0.88)" },
        { transform: "translate(-4%, -8%) scale(1.12)" },
      ],
    },
  ],
} as const satisfies Record<MorphingMeshGradientType, readonly MeshNode[]>)

/**
 * Film grain as a repeating tile: monochrome fractal noise rendered by an
 * SVG filter and inlined as a data URI, so there is no asset to fetch.
 */
const grainTexture = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23g)'/%3E%3C/svg%3E")`

export interface MorphingMeshGradientProps extends React.ComponentProps<"div"> {
  /**
   * The pigment nodes, in any order. Each colour becomes a soft blurred
   * bloom; with fewer colours than stations the layout cycles, with more
   * the surplus is unused. Defaults to `morphingMeshGradientPresets.aurora`.
   * Build a custom range with `meshGradientFromRange(start, end, count)`.
   */
  colors?: readonly string[]
  /**
   * How the colour nodes are arranged: `"mesh"` (corner-and-centre grid,
   * the default), `"aurora"` (horizontal bands), or `"orb"` (large
   * centred glows).
   */
  type?: MorphingMeshGradientType
  /**
   * Lifts every pigment toward white via `color-mix`, producing the pale
   * glass reading of the same hues. Always applied when true — including
   * over an already-light palette such as `auroraInverted`, which will
   * wash further. Prefer either this flag on a deep preset, or the light
   * preset alone, not both.
   */
  inverted?: boolean
  /**
   * When true (the default), the blooms drift on de-phased ambient
   * cycles. Under `prefers-reduced-motion` the wash still paints but
   * stays still, regardless of this prop.
   */
  animated?: boolean
  /**
   * Multiplier on ambient drift pace. `1` is the default morph; higher
   * values hurry it, lower values slow it. Values at or below `0` freeze
   * the wash the same way `animated={false}` does.
   */
  speed?: number
  /**
   * Gaussian blur radius applied to each bloom, in CSS pixels. The
   * default `72` is the soft Apple-setup look; lower values keep more
   * distinct colour islands, higher values melt them into one wash.
   */
  blur?: number
  /**
   * How much film grain sits over the frame. `0` (the default) leaves
   * the wash clean; `1` is a light print finish. The grain covers the
   * whole surface — content included — in overlay blend.
   */
  grain?: number
}

/**
 * A morphing mesh-gradient backdrop: soft colour blooms drift and blend
 * behind content, built from a swappable palette and layout type. Use it
 * anywhere a living wash belongs — heroes, empty states, modal cards,
 * full-bleed backgrounds — by giving the root a size through `className`
 * and dropping children on top.
 *
 * The wash is purely decorative: blooms are hidden from the accessibility
 * tree and inert to the pointer. Text contrast on top belongs to the host.
 * Motion follows `--nessa-motion-duration-ambient` and cancels under
 * `prefers-reduced-motion`, leaving the settled paint visible.
 *
 * The root owns its `display` (a grid whose sole item is the content
 * layer) — lay content out with an inner wrapper rather than passing
 * `flex` through `className`, which would silently replace the grid.
 */
function MorphingMeshGradient({
  colors = morphingMeshGradientPresets.aurora,
  type = "mesh",
  inverted = false,
  animated = true,
  speed = 1,
  blur = 72,
  grain = 0,
  className,
  style,
  children,
  ...props
}: MorphingMeshGradientProps) {
  const reducedMotion = useReducedMotion()
  const stageRef = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(true)

  const layout = Object.hasOwn(meshLayouts, type)
    ? meshLayouts[type as MorphingMeshGradientType]
    : meshLayouts.mesh
  const paletteSource = colors.length > 0 ? colors : morphingMeshGradientPresets.aurora
  const palette = inverted
    ? paletteSource.map(invertMeshColor)
    : paletteSource
  const blurRadius = finite(blur, 72)
  const grainStrength = finite(grain, 0)
  const speedFactor = finite(speed, 1)
  const shouldAnimate =
    animated && !reducedMotion && speedFactor > 0 && visible

  // Pause off-screen so a showcase grid of morphing washes does not keep
  // every card's WAAPI cycles alive while the host scrolls past them.
  React.useEffect(() => {
    const node = stageRef.current
    if (node === null || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting !== false),
      { rootMargin: "64px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    const node = stageRef.current
    if (!node || !shouldAnimate) return
    const baseDuration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue("--nessa-motion-duration-ambient"),
      3200,
    )
    if (baseDuration === 0) return
    // Higher `speed` shortens the period — same polarity as RandomAvatar —
    // so a host that already tunes other ambient surfaces keeps one mental
    // model. Floor the divisor so a tiny positive speed cannot explode.
    const duration = (baseDuration * 2.4) / finite(speedFactor, 1, 0.05)
    const animations = Array.from(node.children, (child, index) => {
      const station = layout[index % layout.length]!
      return (child as HTMLElement).animate([...station.drift], {
        duration: duration * (1.15 + (index % 5) * 0.35),
        delay: -(index * duration * 0.28),
        easing: "ease-in-out",
        direction: "alternate",
        iterations: Infinity,
        fill: "both",
      })
    })
    return () => animations.forEach((animation) => animation.cancel())
  }, [shouldAnimate, layout, speedFactor, palette.length])

  // Ground is the deepest (first) pigment, or a soft wash of it when
  // inverted so the pale glass treatment still has a coloured floor.
  const ground = inverted
    ? `color-mix(in oklab, ${paletteSource[0]} 22%, white)`
    : paletteSource[0]!

  return (
    <div
      data-slot="morphing-mesh-gradient"
      data-type={type}
      data-inverted={inverted ? "true" : undefined}
      data-animated={shouldAnimate ? "true" : "false"}
      className={cn(
        "relative isolate grid overflow-hidden",
        "bg-[var(--nessa-mesh-ground)]",
        className,
      )}
      style={
        {
          "--nessa-mesh-ground": ground,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <div
        ref={stageRef}
        data-slot="morphing-mesh-gradient-stage"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {layout.map((station, index) => {
          const color = palette[index % palette.length]!
          return (
            <div
              key={`${type}-${index}`}
              data-slot="morphing-mesh-gradient-bloom"
              // Paint and blur ride custom properties so STYLE-003 stays
              // geometry-only on the style attribute; the utilities own
              // the declarations.
              className={cn(
                "absolute rounded-full opacity-90 will-change-transform",
                "bg-[image:var(--nessa-mesh-bloom)]",
                "[filter:blur(var(--nessa-mesh-blur))]",
              )}
              style={
                {
                  left: `${station.left}%`,
                  top: `${station.top}%`,
                  width: `${station.size}%`,
                  height: `${station.size}%`,
                  "--nessa-mesh-bloom": `radial-gradient(closest-side, ${color} 0%, transparent 78%)`,
                  "--nessa-mesh-blur": `${blurRadius}px`,
                  // Seed the first keyframe as the inline transform so the
                  // first paint matches the WAAPI start and never snaps.
                  transform: station.drift[0]!.transform,
                } as React.CSSProperties
              }
            />
          )
        })}
      </div>
      <div data-slot="morphing-mesh-gradient-content" className="relative">
        {children}
      </div>
      {grainStrength > 0 ? (
        <div
          data-slot="morphing-mesh-gradient-grain"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 mix-blend-overlay",
            "bg-[image:var(--nessa-mesh-grain)] bg-[length:240px_240px]",
          )}
          style={
            {
              "--nessa-mesh-grain": grainTexture,
              opacity: Math.min(1, 0.28 * grainStrength),
            } as React.CSSProperties
          }
        />
      ) : null}
    </div>
  )
}

export {
  MorphingMeshGradient,
  meshGradientFromRange,
  morphingMeshGradientPresets,
  morphingMeshGradientTypes,
}
