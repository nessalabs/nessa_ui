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
 * `inverted` is set so a deep wash becomes the pale glass treatment
 * without requiring the host to hand-author a second palette.
 */
function invertMeshColor(color: string): string {
  return `color-mix(in oklab, ${color} 42%, white)`
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
 * How the colour nodes are laid out. `"mesh"` is the default Apple-setup
 * reading: solid colour fields melted by one parent blur. `"aurora"`
 * stretches them into horizontal bands. `"orb"` keeps fewer, larger
 * nodes around the centre.
 */
export type MorphingMeshGradientType = "mesh" | "aurora" | "orb"

/** Every layout type, in display order — for building pickers. */
const morphingMeshGradientTypes = Object.freeze([
  "mesh",
  "aurora",
  "orb",
] as const satisfies readonly MorphingMeshGradientType[])

/**
 * Named palettes — saturated colour *fields*, not pastel washes. The
 * melt comes from a single parent blur over solid blooms, so pigments
 * stay vivid the way Apple's setup mesh does. Pass `inverted` to lift
 * the same hues toward white.
 *
 * Order matches the default mesh stations: top-left, top-right,
 * centre-right glow, bottom-left, bottom-right, mid.
 */
const morphingMeshGradientPresets = Object.freeze({
  /**
   * Default — matched to the Apple setup mesh: rose/magenta top-left,
   * violet top-right, warm amber centre-right glow, cerulean
   * bottom-left, peach bottom-right, soft indigo mid.
   */
  glass: ["#c23d68", "#7a5fb0", "#e08a3a", "#3a7ec8", "#f0c070", "#5a4a9a"],
  /** Cool violet → magenta → amber undertow. */
  aurora: ["#5c3d9e", "#c44d8a", "#e0a050", "#4a88c0", "#d8b8e0", "#7a5ab0"],
  /** Warm coral → lilac → gold. */
  ember: ["#d45540", "#9a68b8", "#f0a830", "#c07040", "#f0d080", "#8a5890"],
  /** Burnt dusk: copper, magenta, amber, violet. */
  dusk: ["#c04838", "#8a4aa0", "#e09030", "#7a4838", "#d4a868", "#5a3880"],
  /** Soft bloom: magenta, peach, lavender, indigo. */
  bloom: ["#d05088", "#f0a890", "#b880d0", "#4868b0", "#f0c8b0", "#8090d0"],
  /** Horizon: rose, violet, sky, amber. */
  horizon: ["#e090a0", "#9070c0", "#50a0d8", "#e09840", "#7080b8", "#f0c870"],
  /**
   * Pale reading of `glass`. Prefer this preset when the host wants the
   * light treatment without also setting `inverted`.
   */
  glassInverted: [
    "color-mix(in oklab, #c23d68 42%, white)",
    "color-mix(in oklab, #7a5fb0 42%, white)",
    "color-mix(in oklab, #e08a3a 42%, white)",
    "color-mix(in oklab, #3a7ec8 42%, white)",
    "color-mix(in oklab, #f0c070 42%, white)",
    "color-mix(in oklab, #5a4a9a 42%, white)",
  ],
} as const satisfies Record<string, readonly [string, ...string[]]>)

type MeshNode = {
  /** Placement as CSS `left` / `top` percentages of the stage. */
  left: number
  top: number
  /** Width as a percentage of the stage. */
  width: number
  /** Height as a percentage of the stage — ellipses, not circles. */
  height: number
  /**
   * Closed-loop drift keyframes (last pose matches first). Include
   * opacity so fields gently dissolve as they migrate.
   */
  drift: ReadonlyArray<{ transform: string; opacity: number }>
}

/**
 * Solid colour-field stations. Each drift is a *closed loop* — the last
 * keyframe matches the first — so WAAPI can run `direction: "normal"`
 * forever without the ping-pong reverse that reads as "stop and come
 * back". Paths wander through nearby space like pigment dissolving;
 * staggered periods keep the composition from phase-locking.
 */
const meshLayouts = Object.freeze({
  mesh: [
    {
      left: -18,
      top: -28,
      width: 72,
      height: 78,
      drift: [
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.92 },
        { transform: "translate(34%, 18%) scale(1.14)", opacity: 1 },
        { transform: "translate(22%, 42%) scale(0.94)", opacity: 0.88 },
        { transform: "translate(-16%, 30%) scale(1.08)", opacity: 1 },
        { transform: "translate(-22%, 8%) scale(0.96)", opacity: 0.9 },
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.92 },
      ],
    },
    {
      left: 42,
      top: -32,
      width: 70,
      height: 74,
      drift: [
        { transform: "translate(0%, 0%) scale(1.02)", opacity: 0.9 },
        { transform: "translate(-30%, 24%) scale(0.92)", opacity: 1 },
        { transform: "translate(-38%, 46%) scale(1.12)", opacity: 0.86 },
        { transform: "translate(-8%, 28%) scale(0.96)", opacity: 1 },
        { transform: "translate(18%, 10%) scale(1.08)", opacity: 0.92 },
        { transform: "translate(0%, 0%) scale(1.02)", opacity: 0.9 },
      ],
    },
    {
      left: 28,
      top: 8,
      width: 86,
      height: 90,
      drift: [
        { transform: "translate(0%, 0%) scale(1)", opacity: 1 },
        { transform: "translate(-26%, -18%) scale(1.1)", opacity: 0.9 },
        { transform: "translate(16%, -8%) scale(0.9)", opacity: 1 },
        { transform: "translate(24%, 22%) scale(1.08)", opacity: 0.88 },
        { transform: "translate(-10%, 20%) scale(0.96)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(1)", opacity: 1 },
      ],
    },
    {
      left: -22,
      top: 38,
      width: 68,
      height: 72,
      drift: [
        { transform: "translate(0%, 0%) scale(0.98)", opacity: 0.88 },
        { transform: "translate(28%, -28%) scale(1.12)", opacity: 1 },
        { transform: "translate(40%, -10%) scale(0.94)", opacity: 0.9 },
        { transform: "translate(18%, 14%) scale(1.06)", opacity: 1 },
        { transform: "translate(-12%, 8%) scale(0.96)", opacity: 0.92 },
        { transform: "translate(0%, 0%) scale(0.98)", opacity: 0.88 },
      ],
    },
    {
      left: 48,
      top: 42,
      width: 66,
      height: 70,
      drift: [
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 0.9 },
        { transform: "translate(-32%, -26%) scale(0.92)", opacity: 1 },
        { transform: "translate(-20%, -8%) scale(1.12)", opacity: 0.86 },
        { transform: "translate(10%, -18%) scale(0.96)", opacity: 1 },
        { transform: "translate(16%, 8%) scale(1.06)", opacity: 0.92 },
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 0.9 },
      ],
    },
    {
      left: 8,
      top: 18,
      width: 58,
      height: 62,
      drift: [
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.94 },
        { transform: "translate(28%, -32%) scale(1.14)", opacity: 1 },
        { transform: "translate(-18%, -16%) scale(0.92)", opacity: 0.88 },
        { transform: "translate(-24%, 20%) scale(1.08)", opacity: 1 },
        { transform: "translate(14%, 16%) scale(0.96)", opacity: 0.9 },
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.94 },
      ],
    },
  ],
  aurora: [
    {
      left: -24,
      top: -40,
      width: 90,
      height: 70,
      drift: [
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.92 },
        { transform: "translate(30%, 14%) scale(1.1)", opacity: 1 },
        { transform: "translate(16%, 32%) scale(0.94)", opacity: 0.88 },
        { transform: "translate(-12%, 18%) scale(1.06)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.92 },
      ],
    },
    {
      left: 20,
      top: -36,
      width: 88,
      height: 68,
      drift: [
        { transform: "translate(0%, 0%) scale(1.02)", opacity: 0.9 },
        { transform: "translate(-28%, 22%) scale(0.92)", opacity: 1 },
        { transform: "translate(14%, 18%) scale(1.1)", opacity: 0.88 },
        { transform: "translate(-8%, 6%) scale(0.96)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(1.02)", opacity: 0.9 },
      ],
    },
    {
      left: 40,
      top: -8,
      width: 84,
      height: 72,
      drift: [
        { transform: "translate(0%, 0%) scale(1)", opacity: 1 },
        { transform: "translate(-32%, 18%) scale(1.08)", opacity: 0.9 },
        { transform: "translate(12%, -12%) scale(0.92)", opacity: 1 },
        { transform: "translate(-10%, 8%) scale(1.04)", opacity: 0.92 },
        { transform: "translate(0%, 0%) scale(1)", opacity: 1 },
      ],
    },
    {
      left: -20,
      top: 20,
      width: 82,
      height: 70,
      drift: [
        { transform: "translate(0%, 0%) scale(0.98)", opacity: 0.9 },
        { transform: "translate(30%, -16%) scale(1.12)", opacity: 1 },
        { transform: "translate(14%, 14%) scale(0.94)", opacity: 0.88 },
        { transform: "translate(-8%, -6%) scale(1.04)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(0.98)", opacity: 0.9 },
      ],
    },
    {
      left: 24,
      top: 28,
      width: 86,
      height: 74,
      drift: [
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 0.92 },
        { transform: "translate(-24%, -18%) scale(0.92)", opacity: 1 },
        { transform: "translate(14%, 16%) scale(1.1)", opacity: 0.88 },
        { transform: "translate(-8%, 4%) scale(0.96)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 0.92 },
      ],
    },
  ],
  orb: [
    {
      left: -12,
      top: -20,
      width: 78,
      height: 82,
      drift: [
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.92 },
        { transform: "translate(24%, 18%) scale(1.12)", opacity: 1 },
        { transform: "translate(-10%, 14%) scale(0.94)", opacity: 0.88 },
        { transform: "translate(8%, -6%) scale(1.06)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(1)", opacity: 0.92 },
      ],
    },
    {
      left: 18,
      top: -8,
      width: 88,
      height: 92,
      drift: [
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 1 },
        { transform: "translate(-22%, 16%) scale(0.92)", opacity: 0.9 },
        { transform: "translate(12%, -10%) scale(1.12)", opacity: 1 },
        { transform: "translate(-6%, 6%) scale(0.96)", opacity: 0.92 },
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 1 },
      ],
    },
    {
      left: -16,
      top: 24,
      width: 74,
      height: 78,
      drift: [
        { transform: "translate(0%, 0%) scale(0.98)", opacity: 0.9 },
        { transform: "translate(26%, -16%) scale(1.1)", opacity: 1 },
        { transform: "translate(6%, 16%) scale(0.94)", opacity: 0.88 },
        { transform: "translate(-6%, 4%) scale(1.04)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(0.98)", opacity: 0.9 },
      ],
    },
    {
      left: 32,
      top: 28,
      width: 76,
      height: 80,
      drift: [
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 0.92 },
        { transform: "translate(-24%, 14%) scale(0.92)", opacity: 1 },
        { transform: "translate(10%, -16%) scale(1.1)", opacity: 0.88 },
        { transform: "translate(-4%, 4%) scale(0.96)", opacity: 1 },
        { transform: "translate(0%, 0%) scale(1.04)", opacity: 0.92 },
      ],
    },
  ],
} as const satisfies Record<MorphingMeshGradientType, readonly MeshNode[]>)

/**
 * Fine soft dither — Apple's mesh carries a whisper of grain, not a
 * print finish. Inlined SVG so there is no asset to fetch.
 */
const grainTexture = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E")`

export interface MorphingMeshGradientProps extends React.ComponentProps<"div"> {
  /**
   * The pigment fields, assigned in order to the layout stations
   * (top-left, top-right, centre-right, …). Each colour is a solid
   * ellipse melted by the parent blur. Defaults to
   * `morphingMeshGradientPresets.glass`. Build a custom range with
   * `meshGradientFromRange(start, end, count)`.
   */
  colors?: readonly string[]
  /**
   * How the colour fields are arranged: `"mesh"` (default Apple-setup
   * melt), `"aurora"` (horizontal bands), or `"orb"` (centred glows).
   */
  type?: MorphingMeshGradientType
  /**
   * Lifts every pigment toward white via `color-mix`. Always applied
   * when true — including over an already-light palette such as
   * `glassInverted`. Prefer either this flag on a deep preset, or the
   * light preset alone, not both.
   */
  inverted?: boolean
  /**
   * When true (the default), colour fields migrate across the card on
   * de-phased cycles — the morph the reference frames capture. Under
   * `prefers-reduced-motion` the wash still paints but stays still.
   */
  animated?: boolean
  /**
   * Multiplier on morph pace. `1` is the default; higher values hurry
   * the colour shift, lower values slow it. Values at or below `0`
   * freeze the wash the same way `animated={false}` does.
   */
  speed?: number
  /**
   * Gaussian blur radius on each solid colour field, in CSS pixels. The
   * default `72` melts neighbouring fields together while keeping the
   * transform animation on the same element so the morph stays visible.
   */
  blur?: number
  /**
   * How much soft dither sits over the frame. `0.35` is the default
   * whisper; `0` removes it. The grain covers the whole surface —
   * content included — in soft-light blend.
   */
  grain?: number
}

/**
 * A morphing mesh-gradient backdrop in the Apple glass-mesh register:
 * solid colour fields, each softly blurred, circulating on closed-loop
 * paths so the wash dissolves forward continuously — no ping-pong
 * reverse. Use it anywhere a living wash belongs — heroes, empty
 * states, modal cards, full-bleed backgrounds — by giving the root a
 * size through `className` and dropping children on top.
 *
 * The wash is purely decorative: the stage is hidden from the
 * accessibility tree and inert to the pointer. Text contrast on top
 * belongs to the host. Motion follows `--nessa-motion-duration-ambient`
 * and cancels under `prefers-reduced-motion`.
 *
 * The root owns its `display` (a grid whose sole item is the content
 * layer) — lay content out with an inner wrapper rather than passing
 * `flex` through `className`, which would silently replace the grid.
 */
function MorphingMeshGradient({
  colors = morphingMeshGradientPresets.glass,
  type = "mesh",
  inverted = false,
  animated = true,
  speed = 1,
  blur = 72,
  grain = 0.35,
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
  const paletteSource =
    colors.length > 0 ? colors : morphingMeshGradientPresets.glass
  const palette = inverted
    ? paletteSource.map(invertMeshColor)
    : paletteSource
  const blurRadius = finite(blur, 72)
  const grainStrength = finite(grain, 0.35)
  const speedFactor = finite(speed, 1)
  const shouldAnimate =
    animated && !reducedMotion && speedFactor > 0 && visible

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
    // Continuous closed-loop morph — not alternate. Alternate reverses at
    // the end of each cycle and reads as "stop and come back"; a loop
    // whose last keyframe matches the first dissolves forward forever.
    // ~10–16s periods, heavily de-phased, so fields never lock step.
    const duration = (baseDuration * 3.2) / finite(speedFactor, 1, 0.05)
    const animations = Array.from(node.children, (child, index) => {
      const station = layout[index % layout.length]!
      return (child as HTMLElement).animate([...station.drift], {
        duration: duration * (1.15 + (index % 6) * 0.38),
        delay: -(index * duration * 0.31),
        // Soft continuous easing — avoids the hard decelerate-at-ends
        // of ease-in-out that makes reverse points feel sticky.
        easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
        direction: "normal",
        iterations: Infinity,
        fill: "both",
      })
    })
    return () => animations.forEach((animation) => animation.cancel())
  }, [shouldAnimate, layout, speedFactor, palette.length])

  // Warm amber-leaning floor so the melt has a luminous base rather than
  // a dark hole behind the blurred fields.
  const groundAnchor = paletteSource[2] ?? paletteSource[0]!
  const groundEdge = paletteSource[5] ?? paletteSource[1] ?? paletteSource[0]!
  const ground = inverted
    ? `color-mix(in oklab, ${groundAnchor} 32%, white)`
    : `color-mix(in oklab, ${groundAnchor} 48%, ${groundEdge})`

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
          "--nessa-mesh-blur": `${blurRadius}px`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {/*
        Blur lives on each solid field, not the parent. A filtered parent
        flattens its children into one cached layer, so their transforms
        stop reading as motion — which is why the morph looked static.
        Solid fills + per-field blur keep chroma and let WAAPI travel.
      */}
      <div
        ref={stageRef}
        data-slot="morphing-mesh-gradient-stage"
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[35%] overflow-visible saturate-[1.35]"
      >
        {layout.map((station, index) => {
          const color = palette[index % palette.length]!
          return (
            <div
              key={`${type}-${index}`}
              data-slot="morphing-mesh-gradient-bloom"
              className={cn(
                "absolute rounded-full bg-[var(--nessa-mesh-field)] will-change-transform",
                "[filter:blur(var(--nessa-mesh-blur))]",
              )}
              style={
                {
                  left: `${station.left}%`,
                  top: `${station.top}%`,
                  width: `${station.width}%`,
                  height: `${station.height}%`,
                  "--nessa-mesh-field": color,
                  // Seed the first keyframe so the first paint matches
                  // the WAAPI start and never snaps.
                  transform: station.drift[0]!.transform,
                  opacity: station.drift[0]!.opacity,
                } as React.CSSProperties
              }
            />
          )
        })}
      </div>
      <div data-slot="morphing-mesh-gradient-content" className="relative min-h-0">
        {children}
      </div>
      {grainStrength > 0 ? (
        <div
          data-slot="morphing-mesh-gradient-grain"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 mix-blend-soft-light",
            "bg-[image:var(--nessa-mesh-grain)] bg-[length:160px_160px]",
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
