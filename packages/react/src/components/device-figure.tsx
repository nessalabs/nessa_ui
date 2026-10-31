"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** The kinds of machine a figure can draw. */
export type DeviceFigureKind =
  | "desktop"
  | "laptop"
  | "server"
  | "monitor"
  | "phone"
  | "cloud"
  | "boat"

/** Every kind, in the order a list of devices would show them. */
export const deviceFigureKinds: readonly DeviceFigureKind[] = Object.freeze([
  "desktop",
  "laptop",
  "server",
  "monitor",
  "phone",
  "cloud",
  "boat",
])

export interface DeviceFigureProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Which machine to draw. */
  kind: DeviceFigureKind
  /**
   * Whether the machine is away: drawn faded, its lights out. The figure
   * does not say why; the status belongs beside it, in words.
   */
  dimmed?: boolean
  /**
   * Whether a boat bobs on its water: a slow, small rise and roll, and the
   * swell drifting past. Still when dimmed, and under reduced motion. Only
   * the boat moves; every other kind ignores it.
   */
  afloat?: boolean
}

/** The shared paint ids of one figure, unique on the page. */
interface Paint {
  body: string
  screen: string
  sheen: string
  /** The boat's water, its fade toward both sides, and that fade as a mask. */
  water: string
}

/** A soft shadow under a figure, `rx` wide at `cy`. */
function Shadow({ cy, rx }: { cy: number; rx: number }) {
  return <ellipse cx="80" cy={cy} rx={rx} ry="4.5" fill="var(--nessa-device-shadow)" />
}

function Desktop({ paint }: { paint: Paint }) {
  return (
    <>
      <Shadow cy={96} rx={64} />
      <rect x="16" y="54" width="128" height="38" rx="11" fill={`url(#${paint.body})`} stroke="var(--nessa-device-rim)" />
      <rect x="26" y="54.5" width="108" height="1" fill={`url(#${paint.sheen})`} />
      <circle data-slot="device-figure-light" cx="30" cy="80" r="1.6" fill="var(--nessa-device-led)" opacity="0.85" />
      <rect x="112" y="78.5" width="7" height="3" rx="1.5" fill="var(--nessa-device-detail)" />
      <rect x="122" y="78.5" width="7" height="3" rx="1.5" fill="var(--nessa-device-detail)" />
    </>
  )
}

function Laptop({ paint }: { paint: Paint }) {
  return (
    <>
      <Shadow cy={96} rx={66} />
      <rect x="32" y="20" width="96" height="64" rx="6" fill="var(--nessa-device-screen-bottom)" stroke="var(--nessa-device-rim)" />
      <rect x="36" y="24" width="88" height="56" rx="2.5" fill={`url(#${paint.screen})`} />
      <rect x="74" y="24" width="12" height="2.6" rx="1.3" fill="var(--nessa-device-screen-bottom)" />
      <path d="M18 84 H142 V87 Q142 92 136 92 H24 Q18 92 18 87 Z" fill={`url(#${paint.body})`} stroke="var(--nessa-device-rim)" />
      <rect x="68" y="84" width="24" height="2.4" rx="1.2" fill="var(--nessa-device-detail)" />
    </>
  )
}

function Server({ paint }: { paint: Paint }) {
  const unit = (y: number) => (
    <g key={y}>
      <rect x="16" y={y} width="128" height="26" rx="6" fill={`url(#${paint.body})`} stroke="var(--nessa-device-rim)" />
      <path
        d={[28, 33, 38, 43, 48, 53].map((x) => `M${x} ${y + 7} V${y + 19}`).join(" ")}
        stroke="var(--nessa-device-detail)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="64" y={y + 10.5} width="44" height="7" rx="2" fill="var(--nessa-device-detail)" opacity="0.8" />
      <circle data-slot="device-figure-light" cx="124" cy={y + 14} r="2" fill="var(--nessa-device-led)" />
      <circle cx="132" cy={y + 14} r="2" fill="var(--nessa-device-led)" opacity="0.25" />
    </g>
  )
  return (
    <>
      <Shadow cy={98} rx={64} />
      {unit(36)}
      {unit(66)}
    </>
  )
}

function Monitor({ paint }: { paint: Paint }) {
  return (
    <>
      <Shadow cy={99} rx={40} />
      <rect x="22" y="14" width="116" height="70" rx="5" fill="var(--nessa-device-screen-bottom)" stroke="var(--nessa-device-rim)" />
      <rect x="26" y="18" width="108" height="62" rx="2" fill={`url(#${paint.screen})`} />
      <path d="M73 84 H87 L89 94 H71 Z" fill={`url(#${paint.body})`} />
      <rect x="56" y="94" width="48" height="4" rx="2" fill={`url(#${paint.body})`} stroke="var(--nessa-device-rim)" />
    </>
  )
}

function Phone({ paint }: { paint: Paint }) {
  return (
    <>
      <Shadow cy={102} rx={28} />
      <rect x="59" y="10" width="42" height="88" rx="10" fill={`url(#${paint.body})`} stroke="var(--nessa-device-rim)" />
      <rect x="62" y="13" width="36" height="82" rx="8" fill={`url(#${paint.screen})`} />
      <rect x="73.5" y="17" width="13" height="4" rx="2" fill="var(--nessa-device-screen-bottom)" />
    </>
  )
}

function Cloud({ paint }: { paint: Paint }) {
  return (
    <>
      <Shadow cy={100} rx={56} />
      <path
        d="M46 90 H118 A20 20 0 0 0 121 50.2 A30 30 0 0 0 64.5 42 A22 22 0 0 0 46 90 Z"
        fill={`url(#${paint.body})`}
        stroke="var(--nessa-device-rim)"
      />
      <path
        d="M66 64 H96 M66 71 H104 M66 78 H90"
        stroke="var(--nessa-device-light)"
        strokeOpacity="0.32"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  )
}

/** One wavelength of swell, 24 wide, repeated past both edges so a drift of one wavelength loops unseen. */
const swell = (y: number) =>
  `M-24 ${y}` + Array.from({ length: 9 }, () => " q6 -1.6 12 0 t12 0").join("")

function Boat({ paint, moving }: { paint: Paint; moving: boolean }) {
  const wave = (y: number, opacity: number, reverse = false) => (
    <path
      data-slot="device-figure-swell"
      d={swell(y)}
      className={cn(moving && "motion-safe:animate-nessa-swell", reverse && "[animation-direction:reverse]")}
      stroke="var(--nessa-boat-foam)"
      strokeOpacity={opacity}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  )
  return (
    <>
      <linearGradient id={paint.water} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--nessa-boat-water-top)" />
        <stop offset="1" stopColor="var(--nessa-boat-water-bottom)" />
      </linearGradient>
      <linearGradient id={`${paint.water}-fade`} gradientUnits="userSpaceOnUse" x1="10" y1="0" x2="150" y2="0">
        <stop offset="0" stopColor="white" stopOpacity="0" />
        <stop offset="0.3" stopColor="white" />
        <stop offset="0.7" stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <mask id={`${paint.water}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="120">
        <rect width="160" height="120" fill={`url(#${paint.water}-fade)`} />
      </mask>
      <g mask={`url(#${paint.water}-mask)`}>
        <ellipse cx="80" cy="97" rx="70" ry="11" fill={`url(#${paint.water})`} />
        {wave(102, 0.22, true)}
      </g>
      {/* Two white sails over a dark hull, rocking on one point at the waterline. */}
      <g
        data-slot="device-figure-hull"
        className={cn(
          "[transform-box:fill-box] [transform-origin:50%_92%]",
          moving && "motion-safe:animate-nessa-float",
        )}
      >
        <path d="M80 18 V82" stroke="var(--nessa-boat-mast)" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M83 20 L83 78 L120 78 Z" fill="var(--nessa-boat-sail)" stroke="var(--nessa-boat-sail-rim)" strokeLinejoin="round" />
        <path d="M77 34 L77 78 L50 78 Z" fill="var(--nessa-boat-sail)" stroke="var(--nessa-boat-sail-rim)" strokeLinejoin="round" />
        <path d="M42 82 H124 Q121 90 112 94 H54 Q46 90 42 82 Z" fill="var(--nessa-boat-hull)" stroke="var(--nessa-boat-sail-rim)" />
        <rect x="50" y="82.5" width="66" height="1" fill={`url(#${paint.sheen})`} />
      </g>
      <g mask={`url(#${paint.water}-mask)`}>{wave(94, 0.6)}</g>
    </>
  )
}

const drawings: Record<
  DeviceFigureKind,
  (props: { paint: Paint; moving: boolean }) => React.ReactElement
> = {
  desktop: Desktop,
  laptop: Laptop,
  server: Server,
  monitor: Monitor,
  phone: Phone,
  cloud: Cloud,
  boat: Boat,
}

/**
 * A machine drawn as a small object under one soft top light: a desktop
 * box, a laptop, a rack server, a monitor, a phone, a cloud, or a white
 * two-sail boat on blue water (cloud machines rented from Boat). No maker's
 * logo, so one drawing stands for every brand of it. For a list or page of
 * devices, beside each device's name.
 *
 * It is decoration, hidden from assistive technology: the name and status
 * beside it say what it shows. It fills its box at 4:3; give it a width.
 * Its paint is the `--nessa-device-*` tokens, graphite in dark and
 * aluminium in light; the boat's is `--nessa-boat-*`, Boat's indigo.
 */
function DeviceFigure({
  kind,
  dimmed = false,
  afloat = false,
  className,
  ...props
}: DeviceFigureProps) {
  const id = React.useId().replace(/:/g, "")
  const paint: Paint = {
    body: `${id}-body`,
    screen: `${id}-screen`,
    sheen: `${id}-sheen`,
    water: `${id}-water`,
  }
  const Drawing = drawings[kind]
  return (
    <span
      aria-hidden="true"
      data-slot="device-figure"
      data-kind={kind}
      data-dimmed={dimmed || undefined}
      data-afloat={(kind === "boat" && afloat && !dimmed) || undefined}
      className={cn(
        "inline-block aspect-[4/3] shrink-0 transition-opacity duration-(--nessa-motion-duration-slow) data-[dimmed]:opacity-45 motion-reduce:transition-none [&_[data-slot=device-figure-light]]:transition-opacity [&_[data-slot=device-figure-light]]:duration-(--nessa-motion-duration-slow) motion-reduce:[&_[data-slot=device-figure-light]]:transition-none data-[dimmed]:[&_[data-slot=device-figure-light]]:opacity-0",
        className,
      )}
      {...props}
    >
      <svg viewBox="0 0 160 120" className="block size-full" fill="none">
        <defs>
          <linearGradient id={paint.body} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--nessa-device-body-top)" />
            <stop offset="1" stopColor="var(--nessa-device-body-bottom)" />
          </linearGradient>
          <linearGradient id={paint.screen} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--nessa-device-screen-top)" />
            <stop offset="1" stopColor="var(--nessa-device-screen-bottom)" />
          </linearGradient>
          <linearGradient id={paint.sheen} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--nessa-device-light)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--nessa-device-light)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--nessa-device-light)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <Drawing paint={paint} moving={kind === "boat" && afloat && !dimmed} />
      </svg>
    </span>
  )
}

export { DeviceFigure }
