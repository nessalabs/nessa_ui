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
  return `color-mix(in oklab, ${color} 36%, white)`
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
 * reading: oversized corner-and-centre blooms that melt together.
 * `"aurora"` stretches them into horizontal bands. `"orb"` keeps fewer,
 * larger nodes around the centre for a softer glow.
 */
export type MorphingMeshGradientType = "mesh" | "aurora" | "orb"

/** Every layout type, in display order — for building pickers. */
const morphingMeshGradientTypes = Object.freeze([
  "mesh",
  "aurora",
  "orb",
] as const satisfies readonly MorphingMeshGradientType[])

/**
 * Named palettes for the morphing wash. Colours are luminous mid-tones —
 * the Apple glass-mesh reading — not dark Material grounds. Pass
 * `inverted` to lift the same hues further toward white. They are
 * starting points; any CSS colour array works the same way.
 *
 * Order matches the default mesh stations: top-left, top-right, centre,
 * bottom-left, bottom-right, mid wash.
 */
const morphingMeshGradientPresets = Object.freeze({
  /**
   * Default glass mesh — tuned to the Apple setup wash: magenta top-left,
   * soft lavender top-right, warm amber centre glow, deep indigo
   * bottom-left, peach bottom-right, muted sky edge.
   */
  glass: ["#b24d6e", "#9a86b8", "#d89848", "#3a4d82", "#e8c078", "#6b88b0"],
  /** Cool violet → magenta edge → soft amber undertow → lavender floor. */
  aurora: ["#6a4aa8", "#b85a9a", "#e8b86a", "#7a9ab8", "#c8b4d8", "#8e6ab8"],
  /** Warm coral → lilac → gold → terracotta. */
  ember: ["#d46a5c", "#a878b8", "#e8b86a", "#c47848", "#f0d090", "#8a6a98"],
  /** Burnt dusk: copper, magenta, amber, earth violet. */
  dusk: ["#c45a48", "#9a6ab0", "#e0a050", "#8a5840", "#d4b070", "#6a4a88"],
  /** Soft bloom: magenta, peach, lavender, indigo. */
  bloom: ["#d07098", "#f0b8a0", "#c8a0d8", "#6a70b0", "#e8c8b0", "#90a0d0"],
  /** Horizon: sky, lavender, rose, amber. */
  horizon: ["#e8a0a8", "#b8a0d0", "#70b0d8", "#e0a858", "#8090c0", "#f0d080"],
  /**
   * Pale glass reading of `glass`. Prefer this preset when the host wants
   * the light treatment without also setting `inverted`.
   */
  glassInverted: [
    "color-mix(in oklab, #b24d6e 36%, white)",
    "color-mix(in oklab, #9a86b8 36%, white)",
    "color-mix(in oklab, #d89848 36%, white)",
    "color-mix(in oklab, #3a4d82 36%, white)",
    "color-mix(in oklab, #e8c078 36%, white)",
    "color-mix(in oklab, #6b88b0 36%, white)",
  ],
} as const satisfies Record<string, readonly [string, ...string[]]>)

type MeshNode = {
  /** Starting placement as CSS `left` / `top` percentages of the frame. */
  left: number
  top: number
  /** Blob size as a percentage of the frame — oversized so edges melt. */
  size: number
  /** Drift keyframes as translate/scale pairs, in % of the blob itself. */
  drift: ReadonlyArray<{ transform: string }>
}

/**
 * Node stations per layout type. Positions are percentages of the frame;
 * sizes run well past 100% so neighbouring blooms overlap into one wash.
 * Drifts are de-phased and large enough to read as a slow morph.
 */
const meshLayouts = Object.freeze({
  mesh: [
    {
      left: -28,
      top: -34,
      size: 118,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(18%, 12%) scale(1.12)" },
        { transform: "translate(-8%, 16%) scale(0.94)" },
      ],
    },
    {
      left: 28,
      top: -40,
      size: 124,
      drift: [
        { transform: "translate(0%, 0%) scale(1.04)" },
        { transform: "translate(-16%, 14%) scale(0.9)" },
        { transform: "translate(10%, 6%) scale(1.14)" },
      ],
    },
    {
      left: 4,
      top: -10,
      size: 148,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(10%, -10%) scale(1.1)" },
        { transform: "translate(-12%, 8%) scale(0.92)" },
      ],
    },
    {
      left: -36,
      top: 18,
      size: 120,
      drift: [
        { transform: "translate(0%, 0%) scale(0.98)" },
        { transform: "translate(14%, -8%) scale(1.16)" },
        { transform: "translate(6%, 12%) scale(1.02)" },
      ],
    },
    {
      left: 22,
      top: 16,
      size: 128,
      drift: [
        { transform: "translate(0%, 0%) scale(1.06)" },
        { transform: "translate(-12%, -10%) scale(0.9)" },
        { transform: "translate(8%, 8%) scale(1.12)" },
      ],
    },
    {
      left: -10,
      top: 32,
      size: 110,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(12%, -12%) scale(1.14)" },
        { transform: "translate(-10%, 6%) scale(0.94)" },
      ],
    },
  ],
  aurora: [
    {
      left: -30,
      top: -48,
      size: 140,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(20%, 8%) scale(1.1)" },
        { transform: "translate(-6%, 10%) scale(0.94)" },
      ],
    },
    {
      left: 10,
      top: -42,
      size: 136,
      drift: [
        { transform: "translate(0%, 0%) scale(1.04)" },
        { transform: "translate(-14%, 12%) scale(0.9)" },
        { transform: "translate(10%, 4%) scale(1.12)" },
      ],
    },
    {
      left: 36,
      top: -28,
      size: 130,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(-16%, 10%) scale(1.1)" },
        { transform: "translate(8%, -4%) scale(0.92)" },
      ],
    },
    {
      left: -28,
      top: 4,
      size: 128,
      drift: [
        { transform: "translate(0%, 0%) scale(0.98)" },
        { transform: "translate(16%, 8%) scale(1.14)" },
        { transform: "translate(4%, -6%) scale(1)" },
      ],
    },
    {
      left: 18,
      top: 10,
      size: 134,
      drift: [
        { transform: "translate(0%, 0%) scale(1.06)" },
        { transform: "translate(-10%, -8%) scale(0.9)" },
        { transform: "translate(8%, 10%) scale(1.12)" },
      ],
    },
  ],
  orb: [
    {
      left: -18,
      top: -28,
      size: 130,
      drift: [
        { transform: "translate(0%, 0%) scale(1)" },
        { transform: "translate(12%, 10%) scale(1.12)" },
        { transform: "translate(-8%, 6%) scale(0.94)" },
      ],
    },
    {
      left: 8,
      top: -16,
      size: 142,
      drift: [
        { transform: "translate(0%, 0%) scale(1.05)" },
        { transform: "translate(-10%, 8%) scale(0.9)" },
        { transform: "translate(8%, -6%) scale(1.14)" },
      ],
    },
    {
      left: -24,
      top: 8,
      size: 124,
      drift: [
        { transform: "translate(0%, 0%) scale(0.98)" },
        { transform: "translate(12%, -6%) scale(1.12)" },
        { transform: "translate(4%, 10%) scale(1)" },
      ],
    },
    {
      left: 20,
      top: 12,
      size: 128,
      drift: [
        { transform: "translate(0%, 0%) scale(1.06)" },
        { transform: "translate(-10%, 8%) scale(0.9)" },
        { transform: "translate(6%, -8%) scale(1.1)" },
      ],
    },
  ],
} as const satisfies Record<MorphingMeshGradientType, readonly MeshNode[]>)

/**
 * Film grain as a repeating tile: monochrome fractal noise rendered by an
 * SVG filter and inlined as a data URI, so there is no asset to fetch.
 * Finer base frequency than a print tile — the Apple glass finish is a
 * soft dither, not a coarse film grain.
 */
const grainTexture = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E")`

export interface MorphingMeshGradientProps extends React.ComponentProps<"div"> {
  /**
   * The pigment nodes, assigned in order to the layout stations (top-left,
   * top-right, centre, …). Each colour becomes an oversized soft bloom;
   * with fewer colours than stations the layout cycles, with more the
   * surplus is unused. Defaults to `morphingMeshGradientPresets.glass`.
   * Build a custom range with `meshGradientFromRange(start, end, count)`.
   */
  colors?: readonly string[]
  /**
   * How the colour nodes are arranged: `"mesh"` (oversized corner-and-
   * centre melt, the default), `"aurora"` (horizontal bands), or `"orb"`
   * (large centred glows).
   */
  type?: MorphingMeshGradientType
  /**
   * Lifts every pigment toward white via `color-mix`, producing the pale
   * glass reading of the same hues. Always applied when true — including
   * over an already-light palette such as `glassInverted`, which will
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
   * default `120` is the soft Apple-setup melt; lower values keep more
   * distinct colour islands, higher values dissolve them further.
   */
  blur?: number
  /**
   * How much film grain sits over the frame. `0.55` is the default soft
   * glass dither; `0` removes it. The grain covers the whole surface —
   * content included — in soft-light blend.
   */
  grain?: number
}

/**
 * A morphing mesh-gradient backdrop in the Apple glass-mesh register:
 * oversized luminous colour blooms melt into one another and drift
 * behind content. Built from a swappable palette and layout type. Use it
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
  colors = morphingMeshGradientPresets.glass,
  type = "mesh",
  inverted = false,
  animated = true,
  speed = 1,
  blur = 120,
  grain = 0.55,
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
  const blurRadius = finite(blur, 120)
  const grainStrength = finite(grain, 0.55)
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
    // The morph itself is deliberately slow: Apple's wash drifts, it does
    // not pulse.
    const duration = (baseDuration * 4.2) / finite(speedFactor, 1, 0.05)
    const animations = Array.from(node.children, (child, index) => {
      const station = layout[index % layout.length]!
      return (child as HTMLElement).animate([...station.drift], {
        duration: duration * (1.1 + (index % 5) * 0.28),
        delay: -(index * duration * 0.22),
        easing: "ease-in-out",
        direction: "alternate",
        iterations: Infinity,
        fill: "both",
      })
    })
    return () => animations.forEach((animation) => animation.cancel())
  }, [shouldAnimate, layout, speedFactor, palette.length])

  // Ground leans on the amber centre so the floor stays warm and
  // luminous — matching Apple's amber-glow mesh — rather than a cool
  // Material slab of the darkest pigment.
  const groundAnchor = paletteSource[2] ?? paletteSource[0]!
  const groundEdge = paletteSource[3] ?? paletteSource[0]!
  const ground = inverted
    ? `color-mix(in oklab, ${groundAnchor} 30%, white)`
    : `color-mix(in oklab, ${groundAnchor} 62%, ${groundEdge})`

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
        // The stage is oversized and recentred so bloom edges never hard-
        // clip against the frame — the melt continues past the crop. A
        // light saturate keeps mid-tone pigments vivid after heavy blur.
        className="pointer-events-none absolute -inset-[20%] overflow-visible saturate-[1.28]"
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
                "absolute rounded-full will-change-transform",
                "bg-[image:var(--nessa-mesh-bloom)]",
                "[filter:blur(var(--nessa-mesh-blur))]",
              )}
              style={
                {
                  left: `${station.left}%`,
                  top: `${station.top}%`,
                  width: `${station.size}%`,
                  height: `${station.size}%`,
                  // Saturated core held longer, then a long dissolve —
                  // neighbouring blooms melt into one wash without
                  // washing the chroma out of the colour fields.
                  "--nessa-mesh-bloom": `radial-gradient(closest-side, ${color} 0%, ${color} 52%, color-mix(in oklab, ${color} 45%, transparent) 74%, transparent 100%)`,
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
            "pointer-events-none absolute inset-0 mix-blend-soft-light",
            "bg-[image:var(--nessa-mesh-grain)] bg-[length:180px_180px]",
          )}
          style={
            {
              "--nessa-mesh-grain": grainTexture,
              opacity: Math.min(1, 0.42 * grainStrength),
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
