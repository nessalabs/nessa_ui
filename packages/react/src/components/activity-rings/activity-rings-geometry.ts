/** @responsibility Pure activity-ring geometry: sanitises rings, places them as concentric tracks or as goal-weighted segments of one track, resolves each ring's progress into completed laps plus a leading arc fraction, and draws the track paths. No React, no DOM. */

/** One metric's progress toward its goal. */
export interface ActivityRingInput {
  /** Unique id. */
  id: string
  /**
   * How much has been done. Negative readings are clamped to zero and
   * reported; a non-finite one drops the ring.
   */
  value: number
  /**
   * What counts as complete. Must be positive — a ring with no goal has no
   * progress to show, so it is dropped and reported. In the "segmented"
   * arrangement the goal doubles as the segment's share of the circle, so
   * goals there must share one unit.
   */
  goal: number
}

/**
 * How the rings are placed. "concentric" gives every ring its own full circle,
 * nested outside-in in input order — the Activity-ring form, where a ring can
 * lap its track. "segmented" splits one circle between the rings, each taking
 * a share of the sweep proportional to its goal, and no segment can exceed its
 * own span.
 */
export type ActivityRingsArrangement = "concentric" | "segmented"

/** Inputs the layout is computed from. */
export interface ActivityRingsLayoutOptions {
  rings: readonly ActivityRingInput[]
  /** Pixel width of the area the rings fill. */
  width: number
  /** Pixel height of the area the rings fill. */
  height: number
  arrangement: ActivityRingsArrangement
  /** Band width of a ring, in pixels. */
  thickness: number
  /** Gap between neighbouring concentric tracks, in pixels. */
  ringGap: number
  /** Gap between neighbouring segments, in degrees. Segmented only. */
  segmentGap: number
  /** Where the first ring's track starts, in degrees clockwise from straight up. */
  startAngle: number
}

/** A placed ring. */
export interface ActivityRingsLayoutRing {
  id: string
  /** Index into the original `rings` input. */
  index: number
  /** The reading, clamped to zero at the bottom. */
  value: number
  goal: number
  /** `value / goal`, never clamped at the top — 1.4 means the goal was beaten. */
  progress: number
  /** Radius of the band's centreline. */
  radius: number
  /**
   * Start of the drawn track, in radians clockwise from straight up. A
   * concentric ring's track is the whole circle; a segment's is inset from
   * its share of the circle by the round cap's overhang, so the gap between
   * neighbours is the one the host asked for.
   */
  trackStart: number
  /** End of the drawn track. */
  trackEnd: number
  /**
   * Whole times the ring has already been round its track, drawn as a solid
   * ring beneath the leading arc. Always 0 in the segmented arrangement,
   * where a segment cannot pass its own end.
   */
  laps: number
  /**
   * Fraction of the track the leading arc covers, 0..1. A ring that lands
   * exactly on a whole lap reads as a full arc over one lap fewer, so a
   * completed goal is never drawn as an empty ring.
   */
  fill: number
  /** Angle the leading cap sits at, in radians clockwise from straight up. */
  capAngle: number
}

/**
 * A data problem the layout tolerated instead of failing on. Transient while
 * data streams in; whatever remains once the stream settles is a real data
 * error the host should surface.
 */
export interface ActivityRingsLayoutIssue {
  kind:
    | "duplicate-ring"
    | "invalid-value"
    | "invalid-goal"
    | "no-room"
    | "empty"
  /** Human-readable summary of what was dropped or repaired. */
  message: string
  /** Offending ring id, for ring-scoped issues. */
  ringId?: string
}

/** The computed ring geometry. */
export interface ActivityRingsLayout {
  /** Centre every track is struck from. */
  cx: number
  cy: number
  /** Radius of the outermost band's centreline. */
  outerRadius: number
  /** Radius of the innermost band's centreline. */
  innerRadius: number
  /** Band width the tracks were struck with, after fitting. */
  thickness: number
  /** Largest radius a centred readout can occupy without meeting a band. */
  centerRadius: number
  rings: ActivityRingsLayoutRing[]
  /**
   * Everything the layout dropped or repaired to render this frame — empty
   * when the data was fully consistent.
   */
  issues: ActivityRingsLayoutIssue[]
}

const TAU = Math.PI * 2

function polar(
  cx: number,
  cy: number,
  angle: number,
  distance: number,
): { x: number; y: number } {
  return {
    x: cx + Math.sin(angle) * distance,
    y: cy - Math.cos(angle) * distance,
  }
}

/**
 * Splits `progress` into the whole laps drawn beneath and the leading arc
 * drawn on top. A whole-numbered progress is deliberately read as one lap
 * fewer plus a full arc: taking the remainder literally would draw a met goal
 * as an empty ring, which is the one reading that must never be ambiguous.
 */
function lapsAndFill(progress: number): { laps: number; fill: number } {
  if (!(progress > 0)) return { laps: 0, fill: 0 }
  const whole = Math.floor(progress)
  const remainder = progress - whole
  if (remainder === 0) return { laps: whole - 1, fill: 1 }
  return { laps: whole, fill: remainder }
}

/**
 * Places the rings and resolves each one's progress. Rings are laid outside-in
 * in input order, so the first ring is the outer one and a ring's position
 * keeps naming the same metric however the readings move.
 */
export function computeActivityRingsLayout(
  options: ActivityRingsLayoutOptions,
): ActivityRingsLayout {
  const {
    arrangement,
    ringGap,
    segmentGap,
    startAngle,
    width,
    height,
  } = options
  const issues: ActivityRingsLayoutIssue[] = []

  // Duplicate ids keep their first occurrence so the band, its tint, and its
  // legend row all describe the same input row.
  const seen = new Set<string>()
  const kept: { id: string; index: number; value: number; goal: number }[] = []
  options.rings.forEach((ring, index) => {
    if (seen.has(ring.id)) {
      issues.push({
        kind: "duplicate-ring",
        ringId: ring.id,
        message: `Ring "${ring.id}" appears more than once; the first occurrence was kept.`,
      })
      return
    }
    seen.add(ring.id)
    if (!Number.isFinite(ring.goal) || ring.goal <= 0) {
      issues.push({
        kind: "invalid-goal",
        ringId: ring.id,
        message: `Ring "${ring.id}" has a non-finite or non-positive goal; it was dropped.`,
      })
      return
    }
    if (!Number.isFinite(ring.value)) {
      issues.push({
        kind: "invalid-value",
        ringId: ring.id,
        message: `Ring "${ring.id}" has a non-finite value; it was dropped.`,
      })
      return
    }
    if (ring.value < 0) {
      issues.push({
        kind: "invalid-value",
        ringId: ring.id,
        message: `Ring "${ring.id}" has a negative value; it was read as zero.`,
      })
    }
    kept.push({
      id: ring.id,
      index,
      value: Math.max(0, ring.value),
      goal: ring.goal,
    })
  })

  if (kept.length === 0 && options.rings.length > 0) {
    issues.push({
      kind: "empty",
      message: "No ring carried a usable goal, so nothing was drawn.",
    })
  }

  const cx = width / 2
  const cy = height / 2
  const span = Math.min(width, height)
  const thickness = Math.max(0, Math.min(options.thickness, span / 2))
  const outerRadius = Math.max(0, span / 2 - thickness / 2)
  const step = thickness + Math.max(0, ringGap)
  const origin = (startAngle * Math.PI) / 180

  const rings: ActivityRingsLayoutRing[] = []

  if (arrangement === "concentric") {
    kept.forEach((ring, placement) => {
      const radius = outerRadius - placement * step
      // A band whose centreline has run past the centre would be drawn
      // inside out, so it is dropped rather than folded through itself.
      if (radius < thickness / 2) {
        issues.push({
          kind: "no-room",
          ringId: ring.id,
          message: `Ring "${ring.id}" has no room left at this size; it was dropped.`,
        })
        return
      }
      const progress = ring.value / ring.goal
      const { laps, fill } = lapsAndFill(progress)
      rings.push({
        id: ring.id,
        index: ring.index,
        value: ring.value,
        goal: ring.goal,
        progress,
        radius,
        trackStart: origin,
        trackEnd: origin + TAU,
        laps,
        fill,
        capAngle: origin + TAU * fill,
      })
    })
  } else {
    const totalGoal = kept.reduce((sum, ring) => sum + ring.goal, 0)
    const gap = (Math.max(0, segmentGap) * Math.PI) / 180
    // Every segment is followed by one gap, so the gaps take a fixed bite out
    // of the circle before the goals divide what is left. Gaps wider than the
    // circle would hand the goals a negative sweep and draw every segment
    // backwards, so they collapse instead.
    const available = Math.max(0, TAU - gap * kept.length)
    let cursor = origin
    kept.forEach((ring) => {
      const share = totalGoal > 0 ? ring.goal / totalGoal : 0
      const sweep = available * share
      const progress = ring.value / ring.goal
      // A segment is bounded by its own span: it has nowhere to lap into
      // without painting over its neighbour.
      const fill = Math.min(1, Math.max(0, progress))
      // A round cap overhangs the end of the line it finishes by half the
      // band's width. Drawing the centreline across the segment's whole share
      // would push those two caps into the gaps on either side and close them
      // up, so the drawn track is inset by the overhang and the gap the host
      // asked for is the gap it gets.
      const capInset =
        outerRadius > 0
          ? Math.min(thickness / 2 / outerRadius, sweep / 2)
          : 0
      const trackStart = cursor + capInset
      const trackEnd = cursor + sweep - capInset
      // Concentric rings nest outside-in and can run out of room; a segmented
      // set shares one track, so every segment fits whenever the box does.
      rings.push({
        id: ring.id,
        index: ring.index,
        value: ring.value,
        goal: ring.goal,
        progress,
        radius: outerRadius,
        trackStart,
        trackEnd,
        laps: 0,
        fill,
        capAngle: trackStart + (trackEnd - trackStart) * fill,
      })
      cursor += sweep + gap
    })
  }

  const innerRadius = rings.length
    ? Math.min(...rings.map((ring) => ring.radius))
    : outerRadius
  return {
    cx,
    cy,
    outerRadius,
    innerRadius,
    thickness,
    centerRadius: Math.max(0, innerRadius - thickness / 2),
    rings,
    issues,
  }
}

/**
 * The track's centreline as a stroked path, from `startAngle` to `endAngle`
 * clockwise. A full turn is drawn as two half arcs, which one arc command
 * cannot express, and closed so its ends meet without a seam.
 *
 * The path carries no fill: stroke it with the band's thickness and a round
 * cap to get the ring.
 */
export function activityRingTrackPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle
  if (!(radius > 0) || !Number.isFinite(sweep) || sweep <= 0) return ""
  if (sweep >= TAU - 1e-9) {
    const top = polar(cx, cy, startAngle, radius)
    const bottom = polar(cx, cy, startAngle + Math.PI, radius)
    return `M${top.x},${top.y}A${radius},${radius} 0 0 1 ${bottom.x},${bottom.y}A${radius},${radius} 0 0 1 ${top.x},${top.y}Z`
  }
  const from = polar(cx, cy, startAngle, radius)
  const to = polar(cx, cy, endAngle, radius)
  const large = sweep > Math.PI ? 1 : 0
  return `M${from.x},${from.y}A${radius},${radius} 0 ${large} 1 ${to.x},${to.y}`
}

/**
 * Where the leading cap of a ring's arc sits, for the shadow that separates
 * an overshooting arc from the lap beneath it.
 */
export function activityRingCapPoint(
  ring: Pick<ActivityRingsLayoutRing, "capAngle" | "radius">,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return polar(cx, cy, ring.capAngle, ring.radius)
}
