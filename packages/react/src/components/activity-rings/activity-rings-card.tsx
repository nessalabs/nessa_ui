"use client"

/** @responsibility Pairs one figure — activity rings by default, any component on request — with a per-metric legend inside a Card, either beside the figure or listed beneath it, and keeps the highlight on the figure and its legend row in step. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card"
import {
  ActivityRings,
  activityRingsInkPalette,
  activityRingsPalette,
  type ActivityRing,
  type ActivityRingContext,
  type ActivityRingsCenterContext,
} from "./activity-rings"
import type { ActivityRingsArrangement } from "./activity-rings-geometry"

/**
 * Where the legend sits. "beside" runs the readings down the right of the
 * figure, one compact pair each — the summary-tile form. "stacked" puts the
 * figure and the headline on top and lists the readings underneath as
 * separated rows, which is the form that has room for a second detail line
 * per metric.
 */
export type ActivityRingsCardLayout = "beside" | "stacked"

/** Properties accepted by ActivityRingsCard. */
export interface ActivityRingsCardProps
  extends Omit<React.ComponentProps<typeof Card>, "title"> {
  /** The metrics, in the order they take ring slots and legend rows. */
  rings: readonly ActivityRing[]
  /** Legend placement. Defaults to "beside". */
  layout?: ActivityRingsCardLayout
  /** Card headline. In the stacked layout it sits beside the figure. */
  title?: React.ReactNode
  /** Second line under the headline. */
  description?: React.ReactNode
  /** Control parked in the card's top corner, such as an info button. */
  action?: React.ReactNode
  /**
   * Replaces the rings with any component — a gauge, a sparkline, an avatar.
   * The legend still describes `rings`, so a figure that shows something else
   * entirely should come with a legend that says so.
   */
  figure?: React.ReactNode
  /**
   * Edge length of the square the figure fills, in pixels. The default rings
   * scale their bands to whatever box they are given, so this one number
   * sizes the whole figure.
   */
  figureSize?: number
  /** How the default rings are placed. Defaults to "concentric". */
  arrangement?: ActivityRingsArrangement
  /** Content for the middle of the default rings. */
  renderCenter?: (context: ActivityRingsCenterContext) => React.ReactNode
  /** Formats a reading wherever one is shown. */
  formatValue?: (value: number, ring: ActivityRing) => string
  /**
   * The row's right-hand readout. Defaults to "450/800 CAL" — the reading,
   * its goal, and the ring's unit.
   */
  renderReading?: (context: ActivityRingContext) => React.ReactNode
}

const ROW_CLASSES = cn(
  "flex min-w-0 flex-col transition-opacity [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=dim]:opacity-45",
)

/**
 * A Card that reads a set of metrics as one figure plus a legend: activity
 * rings on the left with their readings beside them, or the rings and a
 * headline on top with the readings listed underneath. Hovering a ring lifts
 * its legend row and recedes the others, and hovering a row does the same to
 * the rings, so the two halves always name the same metric.
 *
 * The figure is decoration here — the legend already writes every reading as
 * text — so the rings do not repeat themselves to a screen reader. Pass
 * `figure` to put any other component in the figure's place.
 */
function ActivityRingsCard({
  rings,
  layout = "beside",
  title,
  description,
  action,
  figure,
  figureSize = 132,
  arrangement = "concentric",
  renderCenter,
  formatValue = (value) => String(value),
  renderReading,
  className,
  ...props
}: ActivityRingsCardProps) {
  const [active, setActive] = React.useState<string | null>(null)

  // Rows take their tint the way the rings do — by input order, so the row
  // beside a name is the band that names it. The row writes in the ring's
  // INK, not its band colour: a band is a graphical mark held to the 3:1
  // non-text floor, and the same colour as text would miss the 4.5:1 one.
  const paintOf = React.useMemo(() => {
    const paints = new Map<string, { color?: string; ink?: string }>()
    const seen = new Set<string>()
    let slot = 0
    for (const ring of rings) {
      if (seen.has(ring.id)) continue
      seen.add(ring.id)
      const index = slot % activityRingsPalette.length
      const ink = ring.ink ?? activityRingsInkPalette[index]
      paints.set(ring.id, {
        color: ring.color ?? activityRingsPalette[index],
        ...(ink ? { ink } : {}),
      })
      slot += 1
    }
    return paints
  }, [rings])

  const rows = React.useMemo(() => {
    const seen = new Set<string>()
    const result: ActivityRingContext[] = []
    rings.forEach((ring, index) => {
      if (seen.has(ring.id)) return
      seen.add(ring.id)
      const value = Math.max(0, ring.value)
      const progress = ring.goal > 0 ? value / ring.goal : 0
      result.push({
        ring,
        index,
        value,
        goal: ring.goal,
        progress,
        // A segment cannot pass its own end, so only a concentric ring laps.
        // A goal met exactly reads as a closed ring, not a lap.
        laps:
          arrangement === "segmented"
            ? 0
            : Math.max(0, Math.ceil(progress) - 1),
        ...(paintOf.get(ring.id)?.color
          ? { color: paintOf.get(ring.id)!.color }
          : {}),
      })
    })
    return result
  }, [rings, paintOf, arrangement])

  const defaultReading = (context: ActivityRingContext) =>
    `${formatValue(context.value, context.ring)}/${formatValue(context.goal, context.ring)}${context.ring.unit ? ` ${context.ring.unit}` : ""}`

  const figureNode = figure ?? (
    <ActivityRings
      rings={rings}
      arrangement={arrangement}
      renderCenter={renderCenter}
      formatValue={formatValue}
      highlightOnHover
      activeRingId={active}
      onActiveRingChange={setActive}
      // The legend below writes every reading as text; announcing the rings
      // as well would read the same numbers twice.
      describeValues={false}
    />
  )

  const figureBox = (
    <div
      data-slot="activity-rings-card-figure"
      className="shrink-0"
      style={{ width: figureSize, height: figureSize }}
    >
      {figureNode}
    </div>
  )

  const emphasisOf = (id: string) =>
    active === null ? "rest" : active === id ? "active" : "dim"

  const rowHandlers = (id: string) => ({
    onPointerEnter: () => setActive(id),
    onPointerLeave: () =>
      setActive((previous) => (previous === id ? null : previous)),
  })

  const swatch = (context: ActivityRingContext) => (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full bg-[var(--nessa-activity-rings-row-color,var(--muted-foreground))]"
      style={
        context.color
          ? ({
              "--nessa-activity-rings-row-color": context.color,
            } as React.CSSProperties)
          : undefined
      }
    />
  )

  /** The ring's ink as a row-scoped custom property, when it carries one. */
  const inkStyle = (context: ActivityRingContext) => {
    const ink = paintOf.get(context.ring.id)?.ink
    return ink
      ? ({ "--nessa-activity-rings-row-ink": ink } as React.CSSProperties)
      : undefined
  }

  const reading = (context: ActivityRingContext) =>
    renderReading ? renderReading(context) : defaultReading(context)

  const header =
    title != null || description != null || action != null ? (
      <CardHeader>
        {title != null ? <CardTitle className="nessa-text-5">{title}</CardTitle> : null}
        {description != null ? <CardDescription>{description}</CardDescription> : null}
        {action != null ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
    ) : null

  return (
    <Card
      data-slot="activity-rings-card"
      data-layout={layout}
      // The figure carries the card's weight, so the headline sits closer to
      // it than the Card's own six-step rhythm would put it.
      className={cn("gap-3", className)}
      {...props}
    >
      {layout === "beside" ? (
        <>
          {header}
          <CardContent className="flex items-center gap-5">
            {figureBox}
            <ul
              data-slot="activity-rings-card-legend"
              className="flex min-w-0 flex-1 flex-col gap-3"
            >
              {rows.map((context) => (
                <li
                  key={context.ring.id}
                  data-slot="activity-rings-card-row"
                  data-ring-id={context.ring.id}
                  data-emphasis={emphasisOf(context.ring.id)}
                  className={ROW_CLASSES}
                  style={inkStyle(context)}
                  {...rowHandlers(context.ring.id)}
                >
                  <span className="nessa-text-3 truncate text-muted-foreground">
                    {context.ring.label ?? context.ring.id}
                  </span>
                  <span className="nessa-text-4 truncate font-medium tabular-nums text-[var(--nessa-activity-rings-row-ink,var(--foreground))]">
                    {reading(context)}
                  </span>
                  {context.ring.detail != null ? (
                    <span className="nessa-text-2 truncate text-muted-foreground">
                      {context.ring.detail}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader>
            <div className="flex items-center gap-4">
              {figureBox}
              <div className="flex min-w-0 flex-col gap-1">
                {title != null ? (
                  <CardTitle className="nessa-text-7">{title}</CardTitle>
                ) : null}
                {description != null ? (
                  <CardDescription>{description}</CardDescription>
                ) : null}
              </div>
            </div>
            {action != null ? <CardAction>{action}</CardAction> : null}
          </CardHeader>
          <CardContent>
            <ul
              data-slot="activity-rings-card-legend"
              className="flex flex-col"
            >
              {rows.map((context) => (
                <li
                  key={context.ring.id}
                  data-slot="activity-rings-card-row"
                  data-ring-id={context.ring.id}
                  data-emphasis={emphasisOf(context.ring.id)}
                  className={cn(
                    ROW_CLASSES,
                    "gap-0.5 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0",
                  )}
                  {...rowHandlers(context.ring.id)}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {swatch(context)}
                      <span className="nessa-text-4 truncate font-medium">
                        {context.ring.label ?? context.ring.id}
                      </span>
                    </span>
                    <span className="nessa-text-4 shrink-0 font-medium tabular-nums">
                      {reading(context)}
                    </span>
                  </span>
                  {context.ring.detail != null ? (
                    <span className="nessa-text-3 truncate pl-4.5 text-muted-foreground">
                      {context.ring.detail}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </>
      )}
    </Card>
  )
}

export { ActivityRingsCard }
