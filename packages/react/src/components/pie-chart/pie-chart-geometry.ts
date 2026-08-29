/** @responsibility Pure pie and donut geometry: sorts and sanitises slices, rolls small ones into a single bucket, converts values to padded arc angles over any angular range, and draws the arc paths. No React, no DOM. */

/** One wedge of the pie. */
export interface PieChartSliceInput {
  /** Unique id. */
  id: string
  /** Magnitude of the slice. Non-positive slices are dropped. */
  value: number
}

/** Order slices are laid out in, starting from `startAngle`. */
export type PieChartSort = "input" | "descending" | "ascending"

/** Inputs the layout is computed from. */
export interface PieChartLayoutOptions {
  slices: readonly PieChartSliceInput[]
  /** Pixel width of the area the chart fills. */
  width: number
  /** Pixel height of the area the chart fills. */
  height: number
  /**
   * Space reserved left and right of the plot for labels, in pixels. Outside
   * labels run outward from the slice, so this is the label's full width.
   */
  paddingX: number
  /**
   * Space reserved above and below the plot, in pixels. A label at the top or
   * bottom of the ring only needs its own height, so this is normally much
   * smaller than `paddingX` — reserving the label width on every side would
   * leave most of a wide box empty.
   */
  paddingY: number
  /** Hole size as a fraction of the outer radius. 0 draws a solid pie. */
  innerRadius: number
  /** Gap between adjacent slices, in degrees. */
  padAngle: number
  /**
   * Radius of the rounded wedge corners, in pixels. Clamped per wedge so a
   * thin slice rounds as much as it can rather than folding inside out.
   */
  cornerRadius: number
  /** Where the first slice starts, in degrees clockwise from straight up. */
  startAngle: number
  /** Where the last slice ends, in degrees clockwise from straight up. */
  endAngle: number
  /** Slice order. Defaults to "input". */
  sort?: PieChartSort
  /**
   * Slices whose share of the total falls below this fraction are rolled
   * into one trailing bucket. 0 (default) keeps every slice. A lone
   * below-threshold slice is left alone — a bucket of one is just a rename.
   */
  groupThreshold?: number
  /** Id the rolled-up bucket takes. Defaults to "other". */
  groupId?: string
}

/** A positioned wedge. */
export interface PieChartLayoutSlice {
  id: string
  /** Index into the original `slices` input, or -1 for the rolled-up bucket. */
  index: number
  value: number
  /** `value / total`, 0..1. */
  share: number
  /** Start of the drawn arc, in radians clockwise from straight up. */
  startAngle: number
  /** End of the drawn arc, in radians clockwise from straight up. */
  endAngle: number
  /** Midpoint of the arc before padding — where a label or leader anchors. */
  centroidAngle: number
  /** Ids rolled into this bucket, for the grouped slice only. */
  members?: string[]
}

/**
 * A data problem the layout tolerated instead of failing on. Transient while
 * data streams in; whatever remains once the stream settles is a real data
 * error the host should surface.
 */
export interface PieChartLayoutIssue {
  kind: "duplicate-slice" | "invalid-value" | "empty" | "group-id-collision"
  /** Human-readable summary of what was dropped or repaired. */
  message: string
  /** Offending slice id, for slice-scoped issues. */
  sliceId?: string
}

/** The computed chart geometry. */
export interface PieChartLayout {
  /** Centre the arcs are struck from. */
  cx: number
  cy: number
  /**
   * Where centred content belongs. On a full circle this is the centre the
   * arcs are struck from, but on a narrowed sweep it is not: a half-turn
   * gauge is struck from a centre sitting on its own flat bottom edge, and a
   * readout placed there hangs off the arc entirely. It is drawn part of the
   * way from the strike centre toward the middle of the region actually
   * drawn — low in the bowl, where a speedometer puts its number — rather
   * than at that middle, which floats the readout too high.
   */
  centerX: number
  centerY: number
  outerRadius: number
  innerRadius: number
  slices: PieChartLayoutSlice[]
  /** Sum of every rendered slice's value. */
  total: number
  /**
   * Everything the layout dropped or repaired to render this frame — empty
   * when the data was fully consistent.
   */
  issues: PieChartLayoutIssue[]
}

const TAU = Math.PI * 2

/**
 * How far the centred readout is pulled from the strike centre toward the
 * middle of the drawn region. Zero would pin it to the strike centre (off the
 * arc entirely on a gauge) and one would put it at the region's middle (high
 * in the bowl); this lands it low, the way a speedometer reads. A full circle
 * has both points in the same place, so the bias changes nothing there.
 */
const READOUT_BIAS = 0.36

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
 * The unit-circle box the drawn ring actually occupies. A full turn fills the
 * whole square, but a narrowed sweep — a gauge — occupies a fraction of it,
 * and sizing that against the full square would strand the arc in a corner of
 * the host's box with the rest left empty. The extremes are the two ends of
 * the sweep, whichever quarter-turn points fall inside it, and the apex a
 * solid wedge closes on.
 */
function sweptBounds(
  start: number,
  end: number,
  innerFraction: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  if (to - from >= TAU - 1e-9) return { minX: -1, maxX: 1, minY: -1, maxY: 1 }

  const inner = Math.max(0, Math.min(1, innerFraction))
  const points: { x: number; y: number }[] = [
    polar(0, 0, from, 1),
    polar(0, 0, to, 1),
    polar(0, 0, from, inner),
    polar(0, 0, to, inner),
  ]
  // A solid wedge closes on the centre; an annulus never reaches it.
  if (inner <= 0) points.push({ x: 0, y: 0 })
  const quarter = Math.PI / 2
  for (let step = Math.ceil(from / quarter); step * quarter <= to; step += 1) {
    points.push(polar(0, 0, step * quarter, 1))
  }
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

/**
 * Sorts and sanitises the slices, rolls the small ones into a bucket, and
 * divides the angular range between them. The sweep may be any range —
 * a half circle makes a gauge — and negative or non-finite values are
 * dropped rather than folded into the total.
 */
export function computePieChartLayout(
  options: PieChartLayoutOptions,
): PieChartLayout {
  const {
    width,
    height,
    paddingX,
    paddingY,
    padAngle,
    sort = "input",
    groupThreshold = 0,
    groupId = "other",
  } = options
  const issues: PieChartLayoutIssue[] = []

  // Duplicate ids keep their first occurrence so the geometry and every
  // label, tint, and hover detail describe the same input row.
  const seen = new Set<string>()
  const kept: { id: string; index: number; value: number }[] = []
  options.slices.forEach((slice, index) => {
    if (seen.has(slice.id)) {
      issues.push({
        kind: "duplicate-slice",
        sliceId: slice.id,
        message: `Slice "${slice.id}" appears more than once; the first occurrence was kept.`,
      })
      return
    }
    seen.add(slice.id)
    if (!Number.isFinite(slice.value) || slice.value <= 0) {
      issues.push({
        kind: "invalid-value",
        sliceId: slice.id,
        message: `Slice "${slice.id}" has a non-finite or non-positive value; it was dropped.`,
      })
      return
    }
    kept.push({ id: slice.id, index, value: slice.value })
  })

  const total = kept.reduce((sum, slice) => sum + slice.value, 0)
  if (kept.length === 0 && options.slices.length > 0) {
    issues.push({
      kind: "empty",
      message: "No slice carried a positive value, so nothing was drawn.",
    })
  }

  const ordered = [...kept]
  if (sort === "descending") ordered.sort((a, b) => b.value - a.value)
  if (sort === "ascending") ordered.sort((a, b) => a.value - b.value)

  // Rolling up needs at least two below-threshold slices: bucketing one
  // slice only renames it, and would hide a legitimate small reading.
  let laid: {
    id: string
    index: number
    value: number
    members?: string[]
  }[] = ordered
  if (groupThreshold > 0 && total > 0) {
    const small = ordered.filter(
      (slice) => slice.value / total < groupThreshold,
    )
    if (small.length > 1) {
      laid = ordered.filter((slice) => slice.value / total >= groupThreshold)
      // The bucket needs an id of its own. If the host's data already uses
      // the one it was given, two laid-out slices would share an id — which
      // collides React keys and makes every id lookup resolve the bucket to
      // the wrong row — so take the next free variant and say so.
      let bucketId = groupId
      if (seen.has(bucketId)) {
        let suffix = 2
        while (seen.has(`${groupId}-${suffix}`)) suffix += 1
        bucketId = `${groupId}-${suffix}`
        issues.push({
          kind: "group-id-collision",
          sliceId: groupId,
          message: `Slice id "${groupId}" is already in the data, so the rolled-up bucket was given "${bucketId}" instead.`,
        })
      }
      laid.push({
        id: bucketId,
        index: -1,
        value: small.reduce((sum, slice) => sum + slice.value, 0),
        members: small.map((slice) => slice.id),
      })
    }
  }

  const origin = (options.startAngle * Math.PI) / 180
  // A sweep beyond a full turn would let one slice's share wrap past the
  // others and paint over them, so the range is capped at one turn in either
  // direction.
  const requestedSweep = ((options.endAngle - options.startAngle) * Math.PI) / 180
  const sweep = Number.isFinite(requestedSweep)
    ? Math.max(-TAU, Math.min(TAU, requestedSweep))
    : 0
  const pad = (padAngle * Math.PI) / 180

  // Fit and centre the swept region rather than the whole circle, so a gauge
  // fills the host's box instead of floating in half of it.
  const bounds = sweptBounds(origin, origin + sweep, options.innerRadius)
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  // A degenerate sweep collapses one or both spans to zero; without the
  // finite guard the radius becomes Infinity and every derived coordinate
  // — the centre included — comes out NaN.
  const fitted = Math.min(
    spanX > 0 ? (width - paddingX * 2) / spanX : Number.POSITIVE_INFINITY,
    spanY > 0 ? (height - paddingY * 2) / spanY : Number.POSITIVE_INFINITY,
  )
  const outerRadius = Number.isFinite(fitted) ? Math.max(0, fitted) : 0
  const innerRadius =
    outerRadius * Math.min(1, Math.max(0, options.innerRadius))
  const cx = (width - spanX * outerRadius) / 2 - bounds.minX * outerRadius
  const cy = (height - spanY * outerRadius) / 2 - bounds.minY * outerRadius

  const slices: PieChartLayoutSlice[] = []
  let cursor = origin
  for (const slice of laid) {
    const share = total > 0 ? slice.value / total : 0
    const span = sweep * share
    const centroidAngle = cursor + span / 2
    // A gap wider than the wedge would invert the arc, so a hairline slice
    // collapses to its own midpoint instead of drawing backwards. A lone
    // slice has no neighbour to be separated from, and padding it would only
    // notch a gap between the slice and itself.
    const half =
      laid.length === 1 ? 0 : Math.min(pad / 2, Math.abs(span) / 2)
    // The gap has to be taken out of the wedge, which means following the
    // sweep's direction: applied with a fixed sign, a sweep that counts down
    // would have both its edges pushed outward instead, growing every wedge
    // by the pad until they overlapped.
    const inset = span < 0 ? -half : half
    slices.push({
      id: slice.id,
      index: slice.index,
      value: slice.value,
      share,
      startAngle: cursor + inset,
      endAngle: cursor + span - inset,
      centroidAngle,
      ...(slice.members ? { members: slice.members } : {}),
    })
    cursor += span
  }

  const centerX = cx + ((bounds.minX + bounds.maxX) / 2) * outerRadius * READOUT_BIAS
  const centerY = cy + ((bounds.minY + bounds.maxY) / 2) * outerRadius * READOUT_BIAS

  return {
    cx,
    cy,
    centerX,
    centerY,
    outerRadius,
    innerRadius,
    slices,
    total,
    issues,
  }
}

/**
 * How much corner rounding a wedge can actually take. A fixed radius that
 * looks right on a wide slice will swallow a thin one — the two corners on
 * the same edge would overlap and the arc would fold inside out — so the
 * request is clamped to half the wedge's shortest side.
 */
function cornerFor(
  requested: number,
  span: number,
  outerRadius: number,
  inner: number,
): number {
  if (requested <= 0) return 0
  const radialDepth = outerRadius - inner
  // The arc length of the shorter of the two curved edges: the inner edge on
  // a donut, the wedge tip on a solid pie (where it is zero, so the tip stays
  // sharp and only the outer corners round).
  const shortestArc = Math.abs(span) * (inner > 0 ? inner : outerRadius)
  // The fillet is inset from each edge by asin(corner / radius), so a corner
  // wider than the hole would take that ratio outside asin's domain and turn
  // the whole path into NaN. A wide, shallow wedge on a small hole reaches
  // that case through the arc-length clamp alone.
  const fitsTheHole = inner > 0 ? inner : Number.POSITIVE_INFINITY
  return Math.max(
    0,
    Math.min(requested, radialDepth / 2, shortestArc / 2, fitsTheHole),
  )
}

/**
 * The wedge outline: an annular sector when `innerRadius` is above zero, a
 * plain wedge otherwise, with optionally rounded corners. A slice covering
 * the whole circle is drawn as two half arcs, which a single arc command
 * cannot express, and rounding is meaningless there — a full ring has no
 * corners.
 */
export function pieChartSlicePath(
  slice: Pick<PieChartLayoutSlice, "startAngle" | "endAngle">,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  cornerRadius = 0,
): string {
  // A reversed range covers the same wedge as its forward twin, so normalise
  // rather than refusing to draw: a host that counts a sweep down from
  // `startAngle` still gets its arcs.
  const from = Math.min(slice.startAngle, slice.endAngle)
  const to = Math.max(slice.startAngle, slice.endAngle)
  const span = to - from
  if (outerRadius <= 0 || span <= 0 || !Number.isFinite(span)) return ""
  slice = { startAngle: from, endAngle: to }
  const full = span >= TAU - 1e-6
  const inner = Math.max(0, Math.min(innerRadius, outerRadius))

  if (full) {
    const ring = (radius: number, sweepFlag: 0 | 1) => {
      const top = polar(cx, cy, slice.startAngle, radius)
      const bottom = polar(cx, cy, slice.startAngle + Math.PI, radius)
      return `M${top.x},${top.y}A${radius},${radius} 0 0 ${sweepFlag} ${bottom.x},${bottom.y}A${radius},${radius} 0 0 ${sweepFlag} ${top.x},${top.y}Z`
    }
    // The hole is wound the other way so the even-odd-free default fill rule
    // still punches it out.
    return inner > 0
      ? `${ring(outerRadius, 1)}${ring(inner, 0)}`
      : ring(outerRadius, 1)
  }

  const corner = cornerFor(cornerRadius, span, outerRadius, inner)
  const large = span > Math.PI ? 1 : 0

  if (corner <= 0) {
    const outerStart = polar(cx, cy, slice.startAngle, outerRadius)
    const outerEnd = polar(cx, cy, slice.endAngle, outerRadius)
    if (inner <= 0) {
      return `M${cx},${cy}L${outerStart.x},${outerStart.y}A${outerRadius},${outerRadius} 0 ${large} 1 ${outerEnd.x},${outerEnd.y}Z`
    }
    const innerEnd = polar(cx, cy, slice.endAngle, inner)
    const innerStart = polar(cx, cy, slice.startAngle, inner)
    return `M${outerStart.x},${outerStart.y}A${outerRadius},${outerRadius} 0 ${large} 1 ${outerEnd.x},${outerEnd.y}L${innerEnd.x},${innerEnd.y}A${inner},${inner} 0 ${large} 0 ${innerStart.x},${innerStart.y}Z`
  }

  // Each rounded corner is a fillet of radius `corner` tucked inside the
  // wedge: the curved edge is shortened by the angle the fillet subtends at
  // its own radius, and the straight edge by the fillet's radial offset.
  const outerInset = Math.min(Math.asin(corner / outerRadius), span / 2)
  const outerArcRadius = outerRadius - corner
  const oStart = slice.startAngle + outerInset
  const oEnd = slice.endAngle - outerInset

  const p = (angle: number, radius: number) => polar(cx, cy, angle, radius)
  const arc = (r: number, to: { x: number; y: number }, sweep: 0 | 1, big = 0) =>
    `A${r},${r} 0 ${big} ${sweep} ${to.x},${to.y}`

  const outerFrom = p(slice.startAngle, outerArcRadius)
  const outerTo = p(slice.endAngle, outerArcRadius)
  const outerBig = oEnd - oStart > Math.PI ? 1 : 0

  if (inner <= 0) {
    // A solid wedge keeps its point: only the two outer corners round.
    return [
      `M${cx},${cy}`,
      `L${outerFrom.x},${outerFrom.y}`,
      arc(corner, p(oStart, outerRadius), 1),
      arc(outerRadius, p(oEnd, outerRadius), 1, outerBig),
      arc(corner, { x: outerTo.x, y: outerTo.y }, 1),
      "Z",
    ].join("")
  }

  const innerInset = Math.min(Math.asin(corner / inner), span / 2)
  const innerArcRadius = inner + corner
  const iStart = slice.startAngle + innerInset
  const iEnd = slice.endAngle - innerInset
  const innerBig = iEnd - iStart > Math.PI ? 1 : 0

  return [
    `M${outerFrom.x},${outerFrom.y}`,
    arc(corner, p(oStart, outerRadius), 1),
    arc(outerRadius, p(oEnd, outerRadius), 1, outerBig),
    arc(corner, { x: outerTo.x, y: outerTo.y }, 1),
    `L${p(slice.endAngle, innerArcRadius).x},${p(slice.endAngle, innerArcRadius).y}`,
    arc(corner, p(iEnd, inner), 1),
    arc(inner, p(iStart, inner), 0, innerBig),
    arc(corner, p(slice.startAngle, innerArcRadius), 1),
    "Z",
  ].join("")
}

/** Point on the slice's midline, `distance` from the centre. */
export function pieChartCentroid(
  slice: Pick<PieChartLayoutSlice, "centroidAngle">,
  cx: number,
  cy: number,
  distance: number,
): { x: number; y: number } {
  return polar(cx, cy, slice.centroidAngle, distance)
}

/**
 * A two-segment leader from the slice's edge out to the label gutter: it
 * leaves along the midline, then breaks horizontally toward whichever side
 * the slice faces.
 */
export function pieChartLeaderPath(
  slice: Pick<PieChartLayoutSlice, "centroidAngle">,
  cx: number,
  cy: number,
  outerRadius: number,
  elbow: number,
  reach: number,
): string {
  const start = polar(cx, cy, slice.centroidAngle, outerRadius)
  const bend = polar(cx, cy, slice.centroidAngle, outerRadius + elbow)
  const right = Math.sin(slice.centroidAngle) >= 0
  const endX = bend.x + (right ? reach : -reach)
  return `M${start.x},${start.y}L${bend.x},${bend.y}L${endX},${bend.y}`
}
