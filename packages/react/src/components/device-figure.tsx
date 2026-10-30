import * as React from "react"

import { cn } from "@/lib/utils"

/** The kinds of machine a figure can draw. */
export type DeviceFigureKind = "desktop" | "laptop" | "server" | "monitor" | "phone" | "cloud"

/** Every kind, in the order a list of devices would show them. */
export const deviceFigureKinds: readonly DeviceFigureKind[] = Object.freeze([
  "desktop",
  "laptop",
  "server",
  "monitor",
  "phone",
  "cloud",
])

export interface DeviceFigureProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Which machine to draw. */
  kind: DeviceFigureKind
  /**
   * Whether the machine is away: drawn faded, its lights out. The figure
   * does not say why; the status belongs beside it, in words.
   */
  dimmed?: boolean
}

/** The shared paint ids of one figure, unique on the page. */
interface Paint {
  body: string
  screen: string
  sheen: string
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

const drawings: Record<DeviceFigureKind, (props: { paint: Paint }) => React.ReactElement> = {
  desktop: Desktop,
  laptop: Laptop,
  server: Server,
  monitor: Monitor,
  phone: Phone,
  cloud: Cloud,
}

/**
 * A machine drawn as a small object under one soft top light: a desktop
 * box, a laptop, a rack server, a monitor, a phone or a cloud. No maker's
 * logo, so one drawing stands for every brand of it. For a list or page of
 * devices, beside each device's name.
 *
 * It is decoration, hidden from assistive technology: the name and status
 * beside it say what it shows. It fills its box at 4:3; give it a width.
 * Its paint is the `--nessa-device-*` tokens, graphite in dark and
 * aluminium in light.
 */
function DeviceFigure({ kind, dimmed = false, className, ...props }: DeviceFigureProps) {
  const id = React.useId().replace(/:/g, "")
  const paint: Paint = { body: `${id}-body`, screen: `${id}-screen`, sheen: `${id}-sheen` }
  const Drawing = drawings[kind]
  return (
    <span
      aria-hidden="true"
      data-slot="device-figure"
      data-kind={kind}
      data-dimmed={dimmed || undefined}
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
        <Drawing paint={paint} />
      </svg>
    </span>
  )
}

export { DeviceFigure }
