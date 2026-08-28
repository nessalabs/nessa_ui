"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The pattern canvas. Every overlay is drawn once in this coordinate space
 * and sliced to cover whatever box the host gives the surface, so the
 * drawing never stretches — a wide hero and a square card crop the same
 * picture rather than distorting it.
 */
const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 675
const CANVAS_CX = CANVAS_WIDTH / 2
const CANVAS_CY = CANVAS_HEIGHT / 2

/**
 * Rounds a coordinate to a hundredth of a canvas unit before it reaches a
 * path string. `Math.sin`/`Math.cos` are not required to return the same
 * bits on every engine, so a path built during SSR and rebuilt by the
 * browser could differ in the last decimal place, which React reports as a
 * hydration mismatch. A hundredth of a 1200-unit canvas is far below a
 * device pixel at any plausible size, so nothing about the drawing changes.
 */
function quantise(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Coerces a numeric prop to something safe to paint with: `NaN` survives
 * `Math.max` and would otherwise end up in an inline style, so every
 * host-supplied number passes through here first.
 */
function finite(value: number, fallback: number, floor = 0): number {
  return Number.isFinite(value) ? Math.max(floor, value) : fallback
}

/**
 * One contour ring: an ellipse with a gentle low-frequency wobble, the way
 * a topographic map's elevation lines wander without ever forming a corner.
 * `phase` de-phases the wobble per ring so neighbouring rings drift apart
 * and back together instead of nesting concentrically. Sampled as a fine
 * polyline rather than fitted with curves: at hairline stroke widths the
 * facets are below visibility and the path stays trivially deterministic.
 */
function contourRingPath(rx: number, ry: number, phase: number): string {
  const samples = 180
  let path = ""
  for (let index = 0; index <= samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2
    const wobble =
      1 +
      0.07 * Math.sin(3 * angle + phase) +
      0.045 * Math.sin(5 * angle - phase * 1.7)
    const x = quantise(CANVAS_CX + rx * wobble * Math.cos(angle))
    const y = quantise(CANVAS_CY + ry * wobble * Math.sin(angle))
    path += `${index === 0 ? "M" : "L"}${x} ${y}`
  }
  return `${path}Z`
}

/** One flowing horizontal line: a sampled sine drifting across the canvas. */
function wavePath(
  baseY: number,
  amplitude: number,
  phase: number,
  wavelength: number,
): string {
  let path = ""
  for (let x = -48; x <= CANVAS_WIDTH + 48; x += 16) {
    const y = quantise(baseY + amplitude * Math.sin(x / wavelength + phase))
    path += `${path === "" ? "M" : "L"}${x} ${y}`
  }
  return path
}

/** One concentric circle around the canvas centre, as a two-arc path. */
function ringPath(radius: number): string {
  const r = quantise(radius)
  const west = quantise(CANVAS_CX - r)
  const east = quantise(CANVAS_CX + r)
  return `M${east} ${CANVAS_CY}A${r} ${r} 0 1 1 ${west} ${CANVAS_CY}A${r} ${r} 0 1 1 ${east} ${CANVAS_CY}`
}

/**
 * The overlay drawings, built once at module scope so every surface shares
 * the same strings and SSR markup matches the client byte for byte.
 *
 * `contours` nests softly wobbled rings from the centre out past the
 * corners — de-phased so they drift toward and away from each other, which
 * is the classic contour-map hero texture with no corners anywhere.
 * `waves` stacks de-phased sines with drifting wavelengths so no two lines
 * run parallel. `rings` are plain concentric circles; the largest radius
 * clears the corner of a 16:9 crop so no band of the canvas is bare.
 */
const gradientSurfacePatternPaths = Object.freeze({
  contours: Array.from({ length: 9 }, (_unused, index) => {
    const radius = 96 * 1.32 ** index
    return contourRingPath(radius, radius * 0.88, index * 0.9)
  }),
  waves: Array.from({ length: 10 }, (_unused, index) =>
    wavePath(
      -30 + index * 82,
      34 + (index % 3) * 12,
      index * 1.1,
      210 + (index % 4) * 28,
    ),
  ),
  rings: Array.from({ length: 11 }, (_unused, index) => ringPath(55 + index * 82)),
} as const satisfies Record<string, readonly string[]>)

/**
 * Which line drawing sits over the wash. `"none"` leaves the gradient and
 * grain alone.
 */
export type GradientSurfacePattern =
  | keyof typeof gradientSurfacePatternPaths
  | "none"

/** Every pattern name, in display order — for building pickers. */
const gradientSurfacePatterns = Object.freeze([
  "contours",
  "waves",
  "rings",
  "none",
] as const satisfies readonly GradientSurfacePattern[])

/**
 * The named palettes, deepest pigment first. The first colour is the ground
 * the whole surface sits on; each later colour becomes a soft bloom, with
 * the last — brightest — colour blooming at the centre. They are starting
 * points, not a closed set: any array of CSS colours in the same
 * dark-to-light order works.
 */
const gradientSurfacePresets = Object.freeze({
  meadow: ["#0c5c2e", "#2f9e44", "#48b45c"],
  ocean: ["#0b3560", "#1868ae", "#3aa4d8"],
  ember: ["#6d1a0c", "#c73f12", "#ee8f0c"],
  dusk: ["#241b4d", "#5f3dc4", "#a06be0"],
  orchid: ["#4a1160", "#9c36b5", "#d47ae8"],
  graphite: ["#101216", "#30363e", "#565e68"],
} as const satisfies Record<string, readonly [string, ...string[]]>)

/**
 * Where each bloom is dropped, in order of assignment from the centre out.
 * The centre station is listed first because the brightest colour claims
 * it; later stations alternate corners so a four- or five-colour palette
 * spreads into a mesh instead of piling up on one side.
 */
const bloomStations = Object.freeze([
  { at: "50% 42%", size: "118% 92%" },
  { at: "86% 8%", size: "78% 82%" },
  { at: "12% 96%", size: "84% 88%" },
  { at: "90% 92%", size: "66% 72%" },
  { at: "8% 6%", size: "62% 66%" },
] as const)

/**
 * Builds the wash: the deepest colour floods the box, and every remaining
 * colour becomes a large soft radial bloom. The list is reversed so the
 * last (brightest) colour renders topmost at the centre station — the
 * light-in-the-middle, deep-at-the-edges reading a hero wants.
 *
 * The paint leaves as custom properties rather than as `background*`
 * declarations: the palette is a runtime value, but the properties it feeds
 * are fixed, so the utilities on the root own the painting and only the
 * colours travel through `style`.
 */
function gradientBackground(colors: readonly string[]): React.CSSProperties {
  const palette = colors.length > 0 ? colors : gradientSurfacePresets.meadow
  // Reversed before stations are assigned: the last (brightest) colour must
  // claim the centre station and paint topmost, so it leads both the
  // station walk and the layer list. With more colours than stations the
  // surplus drops off the dark end, never the bright one.
  const blooms = palette
    .slice(1)
    .reverse()
    .slice(0, bloomStations.length)
    .map(
      (color, index) =>
        `radial-gradient(${bloomStations[index]!.size} at ${bloomStations[index]!.at}, ${color} 0%, transparent 74%)`,
    )
  return {
    "--nessa-gradient-surface-ground": palette[0],
    // `none` rather than an absent property: a one-colour palette has no
    // blooms, and the utility referencing this must still resolve.
    "--nessa-gradient-surface-blooms": blooms.length > 0 ? blooms.join(", ") : "none",
  } as React.CSSProperties
}

/**
 * Film grain as a repeating tile: monochrome fractal noise rendered by an
 * SVG filter and inlined as a data URI, so there is no asset to fetch and
 * the tile stitches seamlessly. It is laid over the whole frame — content
 * included — in overlay blend, which is what makes a flat CSS gradient read
 * as printed rather than rendered.
 */
const grainTexture = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23g)'/%3E%3C/svg%3E")`

export interface GradientSurfaceProps extends React.ComponentProps<"div"> {
  /**
   * The palette, deepest colour first: the first colour is the ground, each
   * later colour a soft bloom, the last one centred. Any CSS colours work —
   * pick a `gradientSurfacePresets` entry or pass your own. There are five
   * bloom stations, so of a palette longer than six colours the darkest
   * middle entries are dropped. Defaults to `gradientSurfacePresets.meadow`.
   */
  colors?: readonly string[]
  /**
   * The line drawing over the wash: `"contours"` (soft topographic rings,
   * the default), `"waves"`, `"rings"`, or `"none"`.
   */
  pattern?: GradientSurfacePattern
  /**
   * What the pattern is drawn with. Defaults to white, which reads as a
   * light emboss over any of the deep palettes; on a pale custom palette a
   * dark ink works the same way.
   */
  patternColor?: string
  /**
   * How present the line drawing is, `0`–`1`. The default `0.2` keeps it a
   * texture rather than a diagram.
   */
  patternOpacity?: number
  /**
   * How much film grain is laid over the frame. `1` is the default print
   * finish, `0` removes the layer entirely, higher values strengthen it —
   * the texture itself stays the same, it just presses harder, saturating
   * at full strength around `3.5`.
   */
  grain?: number
}

/**
 * A decorative gradient backdrop for heroes, empty states, and banners: a
 * deep colour wash built from a swappable palette, an optional line-drawing
 * overlay (topographic contours, waves, or rings), and film grain over the
 * whole frame. Everything is deterministic CSS and inline SVG — no images
 * to fetch, nothing random between server and client.
 *
 * It sizes itself from the box: give it a height (or let content set one)
 * through `className`, and the drawing crops rather than stretches, so one
 * surface works as a full-bleed hero and a card header alike. The root owns
 * its `display` (a grid whose sole item is the content layer) — that is
 * what makes an inner `h-full` resolve against a `min-h-*` box, so lay
 * content out with an inner wrapper rather than passing `flex` or another
 * display class through `className`, which would silently replace the grid.
 * `children` render above the wash and the pattern; the grain sits over
 * everything,
 * the way film grain covers a whole photograph. The surface is purely
 * decorative — it announces nothing, and the overlays are hidden from the
 * accessibility tree — so text contrast on top of it belongs to the host.
 */
function GradientSurface({
  colors = gradientSurfacePresets.meadow,
  pattern = "contours",
  patternColor = "#ffffff",
  patternOpacity = 0.2,
  grain = 1,
  className,
  style,
  children,
  ...props
}: GradientSurfaceProps) {
  const grainStrength = finite(grain, 1)
  // An own-property check, not a plain lookup: an untyped caller can feed
  // `pattern` from config, and a value like `"constructor"` would otherwise
  // resolve through the prototype chain to a function and crash the render.
  const paths = Object.hasOwn(gradientSurfacePatternPaths, pattern)
    ? gradientSurfacePatternPaths[pattern as keyof typeof gradientSurfacePatternPaths]
    : null
  return (
    <div
      data-slot="gradient-surface"
      data-pattern={pattern}
      className={cn(
        "relative isolate grid overflow-hidden",
        "bg-[var(--nessa-gradient-surface-ground)] bg-[image:var(--nessa-gradient-surface-blooms)]",
        className,
      )}
      style={{ ...gradientBackground(colors), ...style }}
      {...props}
    >
      {paths === null ? null : (
        <svg
          data-slot="gradient-surface-pattern"
          aria-hidden="true"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 size-full"
          focusable="false"
        >
          <g
            fill="none"
            stroke={patternColor}
            strokeWidth={1}
            opacity={Math.min(1, finite(patternOpacity, 0.2))}
          >
            {paths.map((d, index) => (
              // Hairlines stay hairlines at any surface size: the slice
              // scaling that crops the drawing would otherwise thicken the
              // strokes with it.
              <path key={index} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </svg>
      )}
      {/* Positioned, so it paints above the pattern layer; the pattern is
          scenery behind the content, only the grain covers it. As the sole
          grid item it stretches to the root's real box — including a
          min-height the host sets — which is what lets content use
          `h-full` and vertical centring; a plain `h-full` here would
          resolve against an auto height and collapse. */}
      <div data-slot="gradient-surface-content" className="relative">
        {children}
      </div>
      {grainStrength > 0 ? (
        <div
          data-slot="gradient-surface-grain"
          aria-hidden="true"
          // The tile, its size, and the blend are fixed, so they are
          // utilities; only the strength is computed. The texture itself
          // rides a custom property because a data URI cannot survive being
          // spelled as an arbitrary utility value.
          className={cn(
            "pointer-events-none absolute inset-0 mix-blend-overlay",
            "bg-[image:var(--nessa-gradient-surface-grain)] bg-[length:240px_240px]",
          )}
          style={{
            "--nessa-gradient-surface-grain": grainTexture,
            opacity: Math.min(1, 0.28 * grainStrength),
          } as React.CSSProperties}
        />
      ) : null}
    </div>
  )
}

export { GradientSurface, gradientSurfacePatterns, gradientSurfacePresets }
