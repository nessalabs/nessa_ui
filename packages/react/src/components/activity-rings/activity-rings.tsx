"use client"

/** @responsibility Renders one closing ring per metric — concentric tracks or goal-weighted segments of one track — that sweep up from empty on mount and ease to every later reading, with an optional centred readout and optional hover isolation. Geometry comes from activity-rings-geometry. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  activityRingTrackPath,
  computeActivityRingsLayout,
  type ActivityRingsArrangement,
  type ActivityRingsLayout,
  type ActivityRingsLayoutIssue,
  type ActivityRingsLayoutRing,
} from "./activity-rings-geometry"

/** One metric's progress toward its goal. */
export interface ActivityRing {
  /** Unique id. */
  id: string
  /** Name used in readouts and legends. Defaults to the id. */
  label?: string
  /**
   * How much has been done. A reading past the goal is not clamped: a
   * concentric ring laps its track, and a segment fills its own span.
   */
  value: number
  /**
   * What counts as complete. Must be positive. In the "segmented"
   * arrangement the goal also sets the segment's share of the circle, so
   * goals there must share one unit.
   */
  goal: number
  /**
   * Optional CSS color for the band. Omitted, rings cycle through the
   * component's `palette`.
   */
  color?: string
  /**
   * Optional CSS color for text that names this ring in a legend. Omitted,
   * rings take the matching slot of `activityRingsInkPalette`. Set it
   * alongside `color` whenever a custom band colour is too light to read as
   * text on the card's own surface.
   */
  ink?: string
  /** Unit appended to a reading, such as "CAL". Used by legends. */
  unit?: string
  /**
   * Secondary line a legend may show under the ring's name, such as
   * "34m later than average". Ignored by the rings themselves.
   */
  detail?: React.ReactNode
}

/**
 * The closing-ring trio, in the register people already read as activity:
 * energy, effort, uprightness. It is a named set of roles rather than three
 * slots borrowed from the categorical chart ramp, for the same reason the
 * market gain/loss pair has its own tokens — a ring set means one thing
 * wherever it appears. Past the third ring the palette continues into the
 * categorical ramp's solid step, which is the right answer for a set that
 * has stopped being the canonical three.
 *
 * Rings take a slot in input order and a slot always names the same metric,
 * so a reading that overtakes another never repaints the rings around it.
 */
export const activityRingsPalette: readonly string[] = Object.freeze([
  "var(--nessa-activity-ring-1)",
  "var(--nessa-activity-ring-2)",
  "var(--nessa-activity-ring-3)",
  "var(--nessa-chart-series-4-strong)",
  "var(--nessa-chart-series-5-strong)",
  "var(--nessa-chart-series-6-strong)",
  "var(--nessa-chart-series-7-strong)",
  "var(--nessa-chart-series-8-strong)",
])

/**
 * The ink a legend writes a ring's name in, slot for slot with
 * `activityRingsPalette`. A band is a graphical mark, held to the 3:1
 * non-text floor against its own track; the same colour set as text misses
 * the 4.5:1 one, and a lime ring's own value would be unreadable on a white
 * card. Each ink is the deepest hue-true version of its band that clears
 * text contrast, so a legend row still reads as the ring it names.
 *
 * The categorical ramp has no such step — it is a fill/edge pair, both
 * marks — so slots past the trio fall back to the surface's own foreground.
 */
export const activityRingsInkPalette: readonly (string | null)[] = Object.freeze([
  "var(--nessa-activity-ring-1-ink)",
  "var(--nessa-activity-ring-2-ink)",
  "var(--nessa-activity-ring-3-ink)",
  null,
  null,
  null,
  null,
  null,
])

/** Everything known about one ring when a readout or legend row is rendered. */
export interface ActivityRingContext {
  /** The input row. */
  ring: ActivityRing
  /** Index into the original `rings` input. */
  index: number
  /** The reading, clamped to zero at the bottom. */
  value: number
  goal: number
  /** `value / goal`, never clamped at the top. */
  progress: number
  /** Whole times the ring has been round its track. */
  laps: number
  /** The tint the band is drawn with, when the ring carries one. */
  color?: string
}

/** What the centred readout is asked to render. */
export interface ActivityRingsCenterContext {
  /** Every drawn ring, in input order. */
  rings: ActivityRingContext[]
  /** The ring currently hovered, or null at rest. */
  active: ActivityRingContext | null
  /**
   * Mean progress across the rings with each one capped at its own goal,
   * 0..1 — the "how close is the whole set to closed" reading. Beating one
   * goal cannot make up for missing another.
   */
  completion: number
}

/** Emphasis a band is drawn with. */
type ActivityRingEmphasis = "rest" | "active" | "dim"

/** Properties accepted by ActivityRings. */
export interface ActivityRingsProps extends React.ComponentProps<"div"> {
  rings: readonly ActivityRing[]
  /**
   * How the rings are placed. "concentric" (default) nests one full circle
   * per ring, outside-in in input order, and lets a ring lap its track.
   * "segmented" splits one circle between them, each taking a share of the
   * sweep proportional to its goal.
   */
  arrangement?: ActivityRingsArrangement
  /**
   * Band width, in pixels. Left out, it scales with the box the rings fill,
   * so a set reads the same at any size — which is what a host wants unless
   * it is matching a band to something else on the page.
   */
  thickness?: number
  /**
   * Gap between neighbouring concentric tracks, in pixels. Left out, it is a
   * fraction of the band width, so the tracks stay tight against each other
   * as the band grows.
   */
  ringGap?: number
  /** Gap between neighbouring segments, in degrees. Segmented only. */
  segmentGap?: number
  /** Where the tracks start, in degrees clockwise from straight up. */
  startAngle?: number
  /** Opacity of the unfilled track behind each band, 0..1. */
  trackOpacity?: number
  /**
   * Tints rings cycle through in input order; a ring's own `color` wins.
   * Pass null for an all-neutral set, which then needs another way to tell
   * the rings apart.
   */
  palette?: readonly string[] | null
  /**
   * Sweeps the bands up from empty on first paint. Turn it off for a ring
   * that is already on screen when its host mounts, such as one inside a
   * list that virtualises. The sweep runs on Nessa's motion duration tokens,
   * so `prefers-reduced-motion` removes it without any host involvement.
   */
  animateOnMount?: boolean
  /**
   * Recedes every other ring while one is hovered. Off by default: bare
   * rings are a summary, not a control. Hosts that pair the rings with a
   * legend — ActivityRingsCard does — turn it on and mirror the highlight.
   */
  highlightOnHover?: boolean
  /** Controlled highlighted ring, or null for none. */
  activeRingId?: string | null
  /** Initial highlight when uncontrolled. */
  defaultActiveRingId?: string | null
  /** Called as the highlight moves, with null when it clears. */
  onActiveRingChange?: (
    ringId: string | null,
    context: ActivityRingContext | null,
  ) => void
  /** Formats a reading wherever one is shown. */
  formatValue?: (value: number, ring: ActivityRing) => string
  /**
   * Content for the middle of the rings. Nothing is drawn there by default —
   * a bare ring set carries no derived headline of its own.
   */
  renderCenter?: (context: ActivityRingsCenterContext) => React.ReactNode
  /**
   * The sentence one ring contributes to the off-screen reading. Defaults to
   * "Move: 450 of 800 CAL, 56 percent".
   */
  ringDescription?: (context: ActivityRingContext) => string
  /**
   * Called whenever the set of tolerated data problems changes — a dropped
   * ring, a negative reading read as zero, a ring with no room left at this
   * size — and once after the first layout to establish the initial state.
   * While data streams in, transient issues come and go; once the stream
   * settles, an empty array is the definitive "everything rendered" signal
   * and anything else is a data error worth surfacing.
   */
  onLayoutIssues?: (issues: ActivityRingsLayoutIssue[]) => void
  /**
   * Renders the off-screen list of readings that carries the rings to a
   * screen reader. Turn it off in a host that already writes the same
   * numbers as text — ActivityRingsCard does — so they are not announced
   * twice.
   */
  describeValues?: boolean
}

function useMeasuredBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = React.useState<{ width: number; height: number } | null>(
    null,
  )
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1].contentRect
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      setBox((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return box
}

/**
 * True once the browser has painted at least one frame, so a value change
 * transitions instead of arriving finished. Two frames are needed, not one:
 * the empty state has to reach the screen before the target replaces it.
 */
function useAfterFirstPaint(enabled: boolean) {
  const [painted, setPainted] = React.useState(!enabled)
  React.useEffect(() => {
    if (!enabled) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPainted(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [enabled])
  return painted
}

const BAND_CLASSES = cn(
  "fill-none stroke-[var(--nessa-activity-ring-color,var(--muted-foreground))]",
  // `stroke-dashoffset` and `d` are transitionable presentation attributes, so
  // the sweep and every later reading animate without a JavaScript loop.
  "transition-[stroke-dashoffset,d] [transition-timing-function:var(--nessa-motion-easing-arrival)]",
  // A ring sweeps a whole circle, not a few pixels, so it is paced at a
  // multiple of the slow token rather than at the token itself — derived from
  // it, so `prefers-reduced-motion` still collapses the sweep to nothing.
  "[transition-duration:calc(var(--nessa-motion-duration-slow)*var(--nessa-activity-ring-sweep-steps))] [transition-delay:var(--nessa-activity-ring-delay)]",
  "motion-reduce:transition-none",
)

/**
 * Emphasis is carried by the group rather than the bands, because each band
 * already sets its own opacity — the track's wash, the completed lap's
 * recession — and a class on the band would replace those readings instead of
 * receding them.
 */
const SHADOW_CLASSES = cn(
  "transition-transform [transition-timing-function:var(--nessa-motion-easing-arrival)]",
  "[transition-duration:calc(var(--nessa-motion-duration-slow)*var(--nessa-activity-ring-sweep-steps))] [transition-delay:var(--nessa-activity-ring-delay)]",
  "motion-reduce:transition-none",
)

const RING_GROUP_CLASSES = cn(
  "transition-opacity [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=dim]:opacity-25",
)

/**
 * How many of the slow token's steps one ring's sweep takes. A ring travels a
 * whole circle, not a few pixels, so it is paced at a multiple of the token
 * rather than at the token itself — still derived from it, so
 * `prefers-reduced-motion` collapses the sweep to nothing.
 */
const SWEEP_STEPS = 3

/**
 * Band width as a fraction of the box's shorter edge, and the gap between
 * tracks as a fraction of that band. Both are proportions rather than pixel
 * defaults because a ring set is read as one object: a band that keeps its
 * pixel width while the figure grows stops looking like the same thing.
 */
const BAND_FRACTION = 0.122
const RING_GAP_FRACTION = 0.18

/**
 * How much of one sweep each ring waits before starting, so a set closes
 * outside-in rather than all at once.
 */
const STAGGER_FRACTION = 0.15

/**
 * How far the leading cap's shadow is thrown ahead of the cap, and how soft
 * it is, as fractions of the band's width. The completed lap stays at full
 * strength — it was completed — so this shadow is the only thing separating a
 * ring at 100% from one at 200%, both of which are a closed circle.
 */
const CAP_SHADOW_THROW = 0.32
const CAP_SHADOW_BLUR = 0.22

/**
 * Concentric activity rings, or one ring split into goal-weighted segments:
 * a band per metric, swept up from empty on mount and eased to every later
 * reading. A concentric ring that beats its goal laps its own track, drawing
 * the completed lap behind the leading arc; a segment fills its own span and
 * stops. Rings take a slot from the design system's categorical ramp in input
 * order, so a slot always names the same metric.
 *
 * The bands are decoration: the readings reach a screen reader as an
 * off-screen list, which a host already writing the same numbers as text can
 * turn off with `describeValues`. Name the set through `aria-label`.
 */
function ActivityRings({
  rings,
  arrangement = "concentric",
  thickness,
  ringGap,
  segmentGap = 6,
  startAngle = 0,
  trackOpacity = 0.2,
  palette = activityRingsPalette,
  animateOnMount = true,
  highlightOnHover = false,
  activeRingId,
  defaultActiveRingId = null,
  onActiveRingChange,
  formatValue = (value) => String(value),
  renderCenter,
  ringDescription,
  onLayoutIssues,
  describeValues = true,
  className,
  ...props
}: ActivityRingsProps) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const box = useMeasuredBox(plotRef)
  const painted = useAfterFirstPaint(animateOnMount)
  // Filter ids are document-global, so two ring sets on one page would share
  // one blur if the id were a constant.
  const shadowFilterId = `${React.useId()}-activity-ring-cap-shadow`

  const [uncontrolledActive, setUncontrolledActive] = React.useState<
    string | null
  >(defaultActiveRingId)
  const active = activeRingId !== undefined ? activeRingId : uncontrolledActive

  // Duplicate ids keep their FIRST occurrence, matching the geometry's own
  // dedupe — the tint and the reading must describe the row the band was
  // struck from.
  const uniqueRings = React.useMemo(() => {
    const seen = new Set<string>()
    const result: ActivityRing[] = []
    for (const ring of rings) {
      if (seen.has(ring.id)) continue
      seen.add(ring.id)
      result.push(ring)
    }
    return result
  }, [rings])
  const ringById = React.useMemo(
    () => new Map(uniqueRings.map((ring) => [ring.id, ring])),
    [uniqueRings],
  )

  const layout: ActivityRingsLayout | null = React.useMemo(() => {
    if (!box || box.width <= 0 || box.height <= 0) return null
    const band =
      thickness ?? Math.min(box.width, box.height) * BAND_FRACTION
    return computeActivityRingsLayout({
      rings,
      width: box.width,
      height: box.height,
      arrangement,
      thickness: band,
      ringGap: ringGap ?? band * RING_GAP_FRACTION,
      segmentGap,
      startAngle,
    })
  }, [box, rings, arrangement, thickness, ringGap, segmentGap, startAngle])

  // Rings take their slot in INPUT order, never laid-out order: a slot names
  // an entity, so a reading that overtakes another must not repaint it.
  const colorOf = React.useMemo(() => {
    const colors = new Map<string, string>()
    if (!palette || palette.length === 0) {
      for (const ring of uniqueRings) {
        if (ring.color) colors.set(ring.id, ring.color)
      }
      return colors
    }
    uniqueRings.forEach((ring, index) => {
      colors.set(ring.id, ring.color ?? palette[index % palette.length])
    })
    return colors
  }, [uniqueRings, palette])

  const contextOf = React.useCallback(
    (laid: ActivityRingsLayoutRing): ActivityRingContext => ({
      ring: ringById.get(laid.id) ?? {
        id: laid.id,
        value: laid.value,
        goal: laid.goal,
      },
      index: laid.index,
      value: laid.value,
      goal: laid.goal,
      progress: laid.progress,
      laps: laid.laps,
      ...(colorOf.has(laid.id) ? { color: colorOf.get(laid.id) } : {}),
    }),
    [ringById, colorOf],
  )

  // The browser fires no pointerleave for an element removed from the DOM, so
  // a frame that drops the highlighted ring would leave its id behind — every
  // other band dimmed with nothing active. Whatever the layout no longer
  // contains is not active.
  const drawnIds = React.useMemo(
    () => new Set((layout?.rings ?? []).map((laid) => laid.id)),
    [layout],
  )
  const liveActive = active !== null && drawnIds.has(active) ? active : null
  const onActiveRingChangeRef = React.useRef(onActiveRingChange)
  onActiveRingChangeRef.current = onActiveRingChange
  React.useEffect(() => {
    if (active !== null && liveActive === null) {
      setUncontrolledActive(null)
      onActiveRingChangeRef.current?.(null, null)
    }
  }, [active, liveActive])

  const changeActive = (ringId: string | null, laid: ActivityRingsLayoutRing | null) => {
    if (activeRingId === undefined) setUncontrolledActive(ringId)
    onActiveRingChange?.(ringId, laid ? contextOf(laid) : null)
  }

  // Report tolerated data problems whenever their set changes — including the
  // change back to none, which is the "everything rendered" signal.
  const onLayoutIssuesRef = React.useRef(onLayoutIssues)
  onLayoutIssuesRef.current = onLayoutIssues
  const issuesKey = layout
    ? layout.issues
        .map((issue) => `${issue.kind}@${issue.ringId ?? ""}:${issue.message}`)
        .join("\n")
    : null
  React.useEffect(() => {
    if (issuesKey === null || !layout) return
    onLayoutIssuesRef.current?.(layout.issues)
    // The layout object changes identity on every resize; only a changed
    // issue set should re-notify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuesKey])

  const emphasisOf = (id: string): ActivityRingEmphasis => {
    if (liveActive === null) return "rest"
    return liveActive === id ? "active" : "dim"
  }

  const ringContexts = React.useMemo(
    () =>
      [...(layout?.rings ?? [])]
        .sort((left, right) => left.index - right.index)
        .map(contextOf),
    [layout, contextOf],
  )

  const defaultRingDescription = (context: ActivityRingContext) => {
    const unit = context.ring.unit ? ` ${context.ring.unit}` : ""
    return `${context.ring.label ?? context.ring.id}: ${formatValue(context.value, context.ring)} of ${formatValue(context.goal, context.ring)}${unit}, ${Math.round(context.progress * 100)} percent`
  }

  const centerContent = renderCenter
    ? renderCenter({
        rings: ringContexts,
        active:
          liveActive === null
            ? null
            : (ringContexts.find((context) => context.ring.id === liveActive) ??
              null),
        completion: ringContexts.length
          ? ringContexts.reduce(
              (sum, context) => sum + Math.min(1, context.progress),
              0,
            ) / ringContexts.length
          : 0,
      })
    : null

  return (
    <div
      data-slot="activity-rings"
      // The host names the set through aria-label, which a role-less generic
      // element may not carry.
      role="group"
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 font-sans text-foreground",
        className,
      )}
      {...props}
    >
      <div ref={plotRef} className="relative min-h-0 min-w-0 flex-1">
        {layout ? (
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full"
            width={box!.width}
            height={box!.height}
          >
            <defs>
              <filter
                id={shadowFilterId}
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
              >
                <feGaussianBlur
                  stdDeviation={layout.thickness * CAP_SHADOW_BLUR}
                />
              </filter>
            </defs>
            {layout.rings.map((laid, placement) => {
              const track = activityRingTrackPath(
                layout.cx,
                layout.cy,
                laid.radius,
                laid.trackStart,
                laid.trackEnd,
              )
              if (!track) return null
              const tint = colorOf.get(laid.id)
              const band = {
                d: track,
                strokeWidth: layout.thickness,
                strokeLinecap: "round",
                className: BAND_CLASSES,
                style: {
                  // Rings start their sweeps one after another, so a set
                  // closes outside-in. The stagger is expressed against the
                  // motion token, so reduced motion removes it with the sweep.
                  "--nessa-activity-ring-sweep-steps": String(SWEEP_STEPS),
                  "--nessa-activity-ring-delay": `calc(var(--nessa-motion-duration-slow) * ${(placement * STAGGER_FRACTION * SWEEP_STEPS).toFixed(3)})`,
                  ...(tint ? { "--nessa-activity-ring-color": tint } : {}),
                } as React.CSSProperties,
              } as const
              return (
                <g
                  key={laid.id}
                  data-slot="activity-rings-ring"
                  data-ring-id={laid.id}
                  data-emphasis={emphasisOf(laid.id)}
                  className={RING_GROUP_CLASSES}
                >
                  <path
                    data-slot="activity-rings-track"
                    {...band}
                    opacity={trackOpacity}
                  />
                  {laid.laps > 0 ? (
                    <path data-slot="activity-rings-lap" {...band} />
                  ) : null}
                  {laid.laps > 0 ? (
                    <g
                      data-slot="activity-rings-cap-shadow"
                      aria-hidden="true"
                      // Rotating the whole group carries the shadow along the
                      // arc, so it follows the cap round instead of cutting
                      // the chord a moving centre would take.
                      transform={`rotate(${(laid.capAngle * 180) / Math.PI} ${layout.cx} ${layout.cy})`}
                      className={SHADOW_CLASSES}
                      style={band.style}
                    >
                      <circle
                        cx={layout.cx + layout.thickness * CAP_SHADOW_THROW}
                        cy={layout.cy - laid.radius}
                        r={layout.thickness / 2}
                        fill="var(--nessa-activity-ring-cap-shadow)"
                        filter={`url(#${shadowFilterId})`}
                      />
                    </g>
                  ) : null}
                  <path
                    data-slot="activity-rings-band"
                    data-ring-id={laid.id}
                    {...band}
                    // A metric at nothing draws nothing: a full-length dash
                    // pushed entirely off the path still leaves a hairline at
                    // the seam, and a round cap on it paints a whole dot — the
                    // same mark a ring just begun would show. A ring on its
                    // way somewhere keeps both, so its sweep starts from a dot.
                    strokeLinecap={laid.fill > 0 ? "round" : "butt"}
                    // Normalising the path to a length of 1 makes one dash
                    // pattern describe any arc, so the fill fraction is the
                    // dash offset whatever the radius or sweep.
                    pathLength={1}
                    strokeDasharray={laid.fill > 0 ? "1 1" : "0 1"}
                    strokeDashoffset={1 - (painted ? laid.fill : 0)}
                  />
                  {highlightOnHover ? (
                    <path
                      data-slot="activity-rings-target"
                      d={track}
                      strokeWidth={layout.thickness}
                      strokeLinecap="round"
                      // A transparent stroke is not hit by the default
                      // `visiblePainted`, so the band would never answer the
                      // pointer without naming the stroke as its hit area.
                      className="cursor-pointer fill-none stroke-transparent [pointer-events:stroke]"
                      onPointerEnter={() => changeActive(laid.id, laid)}
                      onPointerLeave={() => {
                        if (liveActive === laid.id) changeActive(null, null)
                      }}
                    />
                  ) : null}
                </g>
              )
            })}
          </svg>
        ) : null}
        {centerContent != null && layout ? (
          <div
            data-slot="activity-rings-center"
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center leading-tight"
            style={{
              left: layout.cx,
              top: layout.cy,
              maxWidth: layout.centerRadius * 2,
            }}
          >
            {centerContent}
          </div>
        ) : null}
      </div>
      {describeValues ? (
        <ul data-slot="activity-rings-readings" className="sr-only">
          {ringContexts.map((context) => (
            <li key={context.ring.id}>
              {(ringDescription ?? defaultRingDescription)(context)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export { ActivityRings }
