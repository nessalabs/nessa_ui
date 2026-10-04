"use client"

import * as React from "react"

import { ORB_CORE_RADIUS, ORB_RIM_RADIUS, ORB_RINGS, ORB_SECTORS, encodeOrbCode } from "@/lib/orb-code"
import { cn } from "@/lib/utils"

/** A small, stable hash, so every dot lands in the same place on every render. */
function noise(index: number, salt: number): number {
  let x = (index + 1) * 374761393 + salt * 668265263
  x = (x ^ (x >>> 13)) * 1274126177
  x ^= x >>> 16
  return ((x >>> 0) % 100000) / 100000
}

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** The orb's dots: blue, light or deep. Art, so they do not follow the theme. */
const blues = ["rgb(52 132 255)", "rgb(98 164 255)", "rgb(30 104 228)", "rgb(140 190 255)"] as const

/** How much of each region, from either edge, blends into its neighbour. */
const BLEND = 0.2

/**
 * How far into the neighbouring cell's value a point at `u` (0–1 across its
 * cell) is blended: none across the cell's middle, half at its edge, so the
 * field is continuous and region centres — where a reader samples — keep
 * their own value.
 */
function edgeWeight(u: number): { weight: number; toward: -1 | 1 } {
  const s = u - 0.5
  return { weight: 0.5 * smooth((Math.abs(s) - (0.5 - BLEND)) / BLEND), toward: s < 0 ? -1 : 1 }
}

/**
 * How dense the orb is meant to be at a point, 0 (sparse) to 1 (dense): the
 * regions' values, blended smoothly across their edges so no seams show.
 * `a` runs clockwise from twelve o'clock.
 */
function regionField(regions: readonly (0 | 1)[], r: number, a: number): number {
  const inner2 = ORB_CORE_RADIUS ** 2
  const ringPosition = ((r * r - inner2) / (ORB_RIM_RADIUS ** 2 - inner2)) * ORB_RINGS
  const ring = Math.min(ORB_RINGS - 1, Math.max(0, Math.floor(ringPosition)))
  const span = (Math.PI * 2) / ORB_SECTORS
  const sectorPosition = a / span
  const sector = Math.floor(sectorPosition) % ORB_SECTORS
  const across = edgeWeight(sectorPosition - Math.floor(sectorPosition))
  const value = (row: number) => {
    const here = regions[row * ORB_SECTORS + sector]!
    const there = regions[row * ORB_SECTORS + ((sector + across.toward + ORB_SECTORS) % ORB_SECTORS)]!
    return here * (1 - across.weight) + there * across.weight
  }
  const along = edgeWeight(ringPosition - ring)
  const neighbour = ring + along.toward
  if (neighbour < 0 || neighbour >= ORB_RINGS) return value(ring)
  return value(ring) * (1 - along.weight) + value(neighbour) * along.weight
}

type Dot = {
  /** Resting place: radius as a fraction of the orb's, angle clockwise from twelve o'clock. */
  r: number
  a: number
  size: number
  alpha: number
  color: string
  index: number
}

/** Dots per unit of the orb's area, before each band thins them. */
const DENSITY = 26000

/**
 * Every dot of the orb: light at the centre and densest in a thick outer
 * ring, with each region dense where its value is 1 and sparse where it is
 * 0, then a band that grows into the always-dense edge a reader measures
 * the orb's size by, and a few strays past it.
 */
function orbDots(regions: readonly (0 | 1)[]): Dot[] {
  const dots: Dot[] = []
  let index = 0
  const scatter = (
    r0: number,
    r1: number,
    density: number,
    keep: (r: number, a: number, at: number) => number | null,
    grow: (r: number, a: number) => number = () => 1,
  ) => {
    const count = Math.round((r1 * r1 - r0 * r0) * density)
    for (let i = 0; i < count; i++) {
      const at = index++
      const r = Math.sqrt(r0 * r0 + noise(at, 1) * (r1 * r1 - r0 * r0))
      const a = noise(at, 2) * Math.PI * 2
      const alpha = keep(r, a, at)
      if (alpha === null) continue
      dots.push({
        r,
        a,
        size: (0.3 + noise(at, 3) * 0.45) * grow(r, a),
        alpha,
        color: blues[Math.floor(noise(at, 5) * blues.length) % blues.length]!,
        index: at,
      })
    }
  }
  /** How full the orb is at radius `r`: light at the centre, densest in its outer ring. */
  const body = (r: number) =>
    0.18 + 0.82 * smooth((r - ORB_CORE_RADIUS * 0.5) / (ORB_RIM_RADIUS - ORB_CORE_RADIUS * 0.5)) ** 1.6

  scatter(0, ORB_CORE_RADIUS, DENSITY, (r, _a, at) =>
    noise(at, 8) < body(r) * 0.55 ? 0.45 + noise(at, 4) * 0.35 : null,
  )
  // Dense regions are several times denser than sparse ones at every radius.
  // Dots in dense regions are a little larger too, so a dense patch covers
  // markedly more of the screen than a sparse one and reads through glare.
  scatter(
    ORB_CORE_RADIUS,
    ORB_RIM_RADIUS,
    DENSITY,
    (r, a, at) =>
      noise(at, 8) < (0.14 + regionField(regions, r, a) * 0.86) * body(r) ? 0.55 + noise(at, 4) * 0.45 : null,
    (r, a) => 1 + regionField(regions, r, a) * 0.45,
  )
  scatter(ORB_RIM_RADIUS, ORB_RIM_RADIUS + 0.045, DENSITY, (r, _a, at) =>
    noise(at, 8) < 0.45 * body(r) ? 0.5 + noise(at, 4) * 0.4 : null,
  )
  scatter(ORB_RIM_RADIUS + 0.045, 0.995, DENSITY * 0.85, (_r, _a, at) => 0.65 + noise(at, 4) * 0.35)
  scatter(1.01, OUTER, DENSITY * 0.035, (_r, _a, at) => 0.12 + noise(at, 4) * 0.18)
  return dots
}

/** The canvas reaches past the orb's edge to this radius, for the strays. */
const OUTER = 1.12

/** How long the dots take to gather. */
const GATHER_MS = 1400

function easeOut(t: number): number {
  return 1 - (1 - t) ** 4
}

export interface SignalOrbProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * The pairing code the orb carries, as the gateway shows it ("ABCD-2345").
   * A reader recovers it with `readOrbFrame`. It is not exposed as text.
   */
  code: string
  /** The orb's diameter in CSS pixels. Defaults to 320. */
  size?: number
  /**
   * Draw the orb settled and still: no gathering and no ripple. Reduced
   * motion always draws it still.
   */
  still?: boolean
  /** Called once the dots have gathered and the orb can be read. */
  onReady?: () => void
}

/**
 * A pairing code carried by an orb of fine blue dots, like a phone's setup
 * screen. The code is hidden in where the dots gather densely and where they
 * thin out — four invisible rings of sectors, with error correction — so it
 * reads as a cloud, not as a code. Only a reader that knows the layout
 * (`readOrbFrame`, the same module the scanning device runs) can recover
 * it; a stock camera app cannot.
 *
 * The dots gather on mount, then ripple in place in a slow wave; the orb
 * does not turn. With `still` or reduced motion it is drawn settled.
 * Drawing pauses while it is off screen.
 */
function SignalOrb({
  code,
  size = 320,
  still = false,
  onReady,
  className,
  "aria-label": ariaLabel,
  ...props
}: SignalOrbProps) {
  const regions = React.useMemo(() => encodeOrbCode(code), [code])
  const dots = React.useMemo(() => (regions ? orbDots(regions) : []), [regions])
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [state, setState] = React.useState<"gathering" | "live" | "still">("gathering")
  const onReadyRef = React.useRef(onReady)
  React.useEffect(() => {
    onReadyRef.current = onReady
  })

  React.useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context || dots.length === 0) return
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    const pixels = Math.round(size * ratio)
    canvas.width = pixels
    canvas.height = pixels
    const centre = pixels / 2
    // One orb radius, in pixels: the edge sits at 1, the strays reach OUTER.
    const unit = pixels / 2 / OUTER
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const animate = !still && !reduced

    const draw = (elapsed: number) => {
      const gather = animate ? Math.min(1, elapsed / GATHER_MS) : 1
      const seconds = elapsed / 1000
      context.clearRect(0, 0, pixels, pixels)
      for (const dot of dots) {
        const t = easeOut(Math.min(1, Math.max(0, gather * 1.35 - noise(dot.index, 7) * 0.35)))
        // The wave: each dot breathes in and out along its radius, in a
        // ripple that travels outward and around the ring.
        const wave = animate ? Math.sin(seconds * 1.7 - dot.r * 13 + dot.a * 3) * 0.014 : 0
        const r = (dot.r + wave) * (1.25 - 0.25 * t)
        context.globalAlpha = dot.alpha * t
        context.fillStyle = dot.color
        context.beginPath()
        context.arc(centre + Math.sin(dot.a) * r * unit, centre - Math.cos(dot.a) * r * unit, dot.size * ratio, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
    }

    if (!animate) {
      draw(0)
      setState("still")
      onReadyRef.current?.()
      return
    }

    setState("gathering")
    let frame = 0
    let start: number | null = null
    let ready = false
    let visible = true
    const tick = (now: number) => {
      start ??= now
      draw(now - start)
      if (!ready && now - start >= GATHER_MS) {
        ready = true
        setState("live")
        onReadyRef.current?.()
      }
      frame = visible && !document.hidden ? requestAnimationFrame(tick) : 0
    }
    const resume = () => {
      if (frame === 0 && visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true
            resume()
          })
        : null
    observer?.observe(canvas)
    document.addEventListener("visibilitychange", resume)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      document.removeEventListener("visibilitychange", resume)
    }
  }, [dots, size, still])

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? "Pairing orb"}
      data-slot="signal-orb"
      data-state={state}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <canvas ref={canvasRef} aria-hidden="true" data-slot="signal-orb-canvas" className="size-full" />
    </div>
  )
}

export { SignalOrb }
