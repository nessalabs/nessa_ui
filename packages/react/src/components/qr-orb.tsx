"use client"

import * as React from "react"
import qrcode from "qrcode-generator"

import { cn } from "@/lib/utils"

/** Modules of empty light kept around the code, so a camera finds its edge. */
const QUIET = 4

/** A small, stable hash so every grain's path is the same on server and client. */
function noise(index: number, salt: number): number {
  let x = (index + 1) * 374761393 + salt * 668265263
  x = (x ^ (x >>> 13)) * 1274126177
  x ^= x >>> 16
  return ((x >>> 0) % 10000) / 10000
}

/** Inside one of the three 7×7 finder squares, which are drawn separately. */
function isFinder(row: number, col: number, count: number): boolean {
  const top = row < 7
  const left = col < 7
  return (top && left) || (top && col >= count - 7) || (row >= count - 7 && left)
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

type Grain = {
  x: number
  y: number
  r: number
  /** Part of the code a camera reads, or decoration around it. */
  code: boolean
  /** Ink strength for decoration, fading toward the rim. */
  fade: number
  index: number
}

/** The grains of an orb for `value`: the code's dark modules, then decoration out to the rim. */
function orbGrains(value: string) {
  const qr = qrcode(0, "M")
  qr.addData(value)
  qr.make()
  const count = qr.getModuleCount()
  const centre = count / 2 + QUIET
  // The disc just contains the code square and its quiet zone.
  const radius = ((count + QUIET * 2) / 2) * Math.SQRT2 + 0.5
  // Decoration sits on the code's own module grid, extended out to the rim.
  const reach = Math.ceil(radius - centre) + 1
  const grains: Grain[] = []
  let index = 0
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col) || isFinder(row, col, count)) continue
      grains.push({ x: col + QUIET + 0.5, y: row + QUIET + 0.5, r: 0.5, code: true, fade: 1, index: index++ })
    }
  }
  const edge = count + QUIET * 2
  for (let gy = -reach; gy < edge + reach; gy++) {
    for (let gx = -reach; gx < edge + reach; gx++) {
      // Leave the code and its whole quiet zone clean.
      if (gx >= 0 && gx < edge && gy >= 0 && gy < edge) continue
      const x = gx + 0.5
      const y = gy + 0.5
      const distance = Math.hypot(x - centre, y - centre)
      if (distance > radius - 0.6) continue
      const fade = 1 - (distance - (count / 2 + QUIET)) / (radius - (count / 2 + QUIET))
      const cell = (gx + reach) * 977 + (gy + reach)
      if (noise(cell, 7) > 0.35 + fade * 0.3) continue
      grains.push({ x, y, r: 0.22 + noise(cell, 13) * 0.18, code: false, fade: Math.max(0.15, fade), index: index++ })
    }
  }
  return { count, centre, radius, grains }
}

/** The three finder squares, drawn as rounded rings so a camera locks on to them. */
function Finders({ count }: { count: number }) {
  const corners = [
    [QUIET, QUIET],
    [QUIET + count - 7, QUIET],
    [QUIET, QUIET + count - 7],
  ] as const
  return (
    <>
      {corners.map(([x, y]) => (
        <g key={`${x}-${y}`} data-slot="qr-orb-finder">
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.8} fill="none" strokeWidth={1} className="stroke-current" />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} className="fill-current" />
        </g>
      ))}
    </>
  )
}

export interface QrOrbProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * What a camera reads. It is not exposed as text, since it may be a
   * secret such as a pairing link. A value too long for a QR code (about
   * 2,300 characters) draws an empty orb and sets `data-state="invalid"`.
   */
  value: string
  /** The orb's diameter in CSS pixels. Defaults to 320. */
  size?: number
  /** Called once the grains have settled and the code can be scanned. */
  onSettled?: () => void
}

/**
 * A QR code drawn as an orb of sand. Its centre is a real code — dark
 * grains on a light disc, crisp finder corners, and a clean quiet zone — and
 * the rest of the sphere is decoration that fades toward the rim, so any
 * phone camera reads the code and a person sees an orb.
 *
 * On mount the grains spiral in and settle, then hold still: nothing moves
 * once the code is readable, and with reduced motion it is drawn settled.
 * The disc stays light with dark ink in both themes, because scanners need
 * dark on light.
 */
function QrOrb({ value, size = 320, onSettled, className, style, "aria-label": ariaLabel, ...props }: QrOrbProps) {
  // A value too long for any QR code cannot be drawn; the orb is left empty.
  const orb = React.useMemo(() => {
    try {
      return orbGrains(value)
    } catch {
      return null
    }
  }, [value])
  const { count, centre, radius, grains } = orb ?? { count: 21, centre: 14.5, radius: 20, grains: [] }
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [settled, setSettled] = React.useState(false)
  const onSettledRef = React.useRef(onSettled)
  React.useEffect(() => {
    onSettledRef.current = onSettled
  })

  useIsomorphicLayoutEffect(() => {
    const svg = svgRef.current
    setSettled(false)
    if (!svg || !orb) return
    const done = () => {
      setSettled(true)
      onSettledRef.current?.()
    }
    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof svg.animate !== "function"
    if (still) {
      done()
      return
    }
    const animations: Animation[] = []
    const nodes = svg.querySelectorAll<SVGElement>("[data-grain]")
    for (const node of nodes) {
      const at = Number(node.dataset.grain)
      const x = Number(node.dataset.x) - centre
      const y = Number(node.dataset.y) - centre
      const distance = Math.hypot(x, y)
      // Sand starts on a wider spiral, turned back from where it lands.
      const turn = 1.4 + noise(at, 3) * 1.2
      const angle = Math.atan2(y, x) - turn
      const reach = distance * 0.4 + radius * (0.9 + noise(at, 5) * 0.5)
      const dx = Math.cos(angle) * reach - x
      const dy = Math.sin(angle) * reach - y
      const ink = Number(node.getAttribute("opacity") ?? 1)
      animations.push(
        node.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 },
            { opacity: ink, offset: 0.4 },
            { transform: "translate(0, 0) scale(1)", opacity: ink },
          ],
          {
            duration: 1100 + noise(at, 9) * 500,
            delay: (1 - distance / radius) * 500 + noise(at, 11) * 250,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "backwards",
          },
        ),
      )
    }
    let live = true
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => live && done(),
      () => {},
    )
    return () => {
      live = false
      for (const animation of animations) animation.cancel()
    }
  }, [orb, grains, centre, radius])

  const shadeId = `qr-orb-shade-${React.useId().replace(/[^\w-]/g, "")}`
  const view = radius * 2
  const origin = centre - radius
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? "QR code"}
      data-slot="qr-orb"
      data-state={orb === null ? "invalid" : settled ? "settled" : "settling"}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      {...props}
      style={{ width: size, height: size, ...style }}
    >
      {/* The halo the orb sits in. Behind the disc, so it never touches the code's contrast. */}
      <span
        aria-hidden="true"
        data-slot="qr-orb-glow"
        className="pointer-events-none absolute -inset-[18%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ring)_55%,transparent),transparent)] blur-xl"
      />
      <svg
        ref={svgRef}
        aria-hidden="true"
        viewBox={`${origin} ${origin} ${view} ${view}`}
        className="relative size-full overflow-visible text-foreground dark:text-background"
      >
        <defs>
          <radialGradient id={shadeId} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0.08} />
          </radialGradient>
        </defs>
        <circle cx={centre} cy={centre} r={radius} className="fill-background dark:fill-foreground" />
        <circle cx={centre} cy={centre} r={radius} fill={`url(#${shadeId})`} />
        {orb && <Finders count={count} />}
        {grains.map((grain) => (
          <circle
            key={grain.index}
            data-grain={grain.index}
            data-x={grain.x}
            data-y={grain.y}
            cx={grain.x}
            cy={grain.y}
            r={grain.r}
            className="fill-current"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            opacity={grain.code ? 1 : 0.18 + grain.fade * 0.4}
          />
        ))}
      </svg>
    </div>
  )
}

export { QrOrb }
