/** @responsibility Decides what a ConversationHistory row swipe means — which axis a gesture belongs to, how far the row may travel, which of a trackpad's wheel deltas are the fingers' and which are inertia, and whether a release closes it, rests it open, or commits its primary action. */

/**
 * One action a row can reveal. Only the fields the gesture decides on are
 * named here, so the rules stay independent of how an action is drawn.
 */
export interface SwipeCommitCandidate {
  id: string
  tone?: "default" | "destructive"
  /** Asks for a confirming second press; defaults on for destructive actions. */
  confirm?: boolean
}

/**
 * Whether an action asks for a confirming second press before it runs:
 * destructive actions do unless they opt out, others only when they opt in.
 *
 * @param action - The action.
 * @returns `true` when a first press only asks.
 */
export function actionNeedsConfirm(action: SwipeCommitCandidate): boolean {
  return action.confirm ?? action.tone === "destructive"
}

/** The measurements every swipe decision is made against, in CSS pixels. */
export interface SwipeGeometry {
  /** The row's width: how far a committing row travels before it is gone. */
  rowWidth: number
  /** How far the row rests when it is open with its actions showing. */
  openWidth: number
  /** How far a release has to carry the row to commit its primary action. */
  commitWidth: number
}

/** The row's writing direction, which decides which way is "leading". */
export type SwipeDirection = "ltr" | "rtl"

/** Which way a gesture is going once it has moved far enough to say. */
export type SwipeAxis = "pending" | "x" | "y"

/** What a released row does next. */
export type SwipeRelease =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "commit"; actionId: string }

/**
 * How far a pointer travels before its axis is decided. Below this a press is
 * still a tap, and a scroll that starts with a little sideways wobble is not
 * yet a swipe.
 */
export const swipeAxisSlop = 8

/**
 * Release speed, in pixels per millisecond, that settles the row in the
 * direction it was flicked regardless of how far it travelled. A flick opens
 * or closes; it never commits, because committing is a decision about
 * distance, not about speed.
 */
export const swipeFlickVelocity = 0.4

/** The share of the row a full swipe has to cross before it commits. */
export const swipeCommitRatio = 0.6

/** How much of the pointer's travel past `openWidth` a row that cannot commit follows. */
export const swipeOverdragResistance = 0.25

/** How long a horizontal wheel gesture may pause before it counts as released. */
export const wheelSwipeIdleMs = 140

/** How far back a release looks when estimating speed. */
export const swipeVelocityWindowMs = 100

/** The largest share of the row the revealed actions may take. */
export const swipeTrayMaxShare = 0.75

/** How much of the resting width must be uncovered before labels start to show. */
export const swipeContentFadeStart = 0.35

/** Over how much more of the resting width labels fade in. */
export const swipeContentFadeSpan = 0.5

/** The pixel height of one line for line-based wheel deltas. */
export const wheelLineHeightPx = 16

/**
 * How many times wheel deltas must shrink, without growing in between,
 * before they can be inertia rather than fingers.
 */
export const wheelMomentumRun = 4

/**
 * How far below the delta a shrinking run started from the latest delta must
 * have fallen for the run to be inertia. Fingers wobble; inertia only decays.
 */
export const wheelMomentumDecay = 0.75

/**
 * How much faster than the one before a wheel delta must be to count as the
 * fingers speeding up. Inertia never speeds up, but its deltas are rounded
 * and its timing jitters, so a rise inside this margin proves nothing.
 */
export const wheelGrowthMargin = 1.1

/**
 * The shortest gap between wheel events, in milliseconds, that is worth
 * timing. Across a shorter gap, events that arrive together are compared by
 * size alone.
 */
export const wheelTimedGapMs = 1

/**
 * How long, in milliseconds, each half of a trend spans. Single deltas
 * wobble under fingers and tick under rounding; the pace of one stretch
 * against the stretch before tells a decay from a wobble, and measuring by
 * time rather than by event keeps the reading the same at any refresh rate.
 */
export const wheelTrendWindowMs = 40

/**
 * The per-millisecond retention of pace a run must beat for it to have
 * stopped decaying. Trackpad inertia keeps about 0.998 of its speed per
 * millisecond; fingers holding a speed, however unsteadily, keep all of it.
 */
export const wheelTrendRetention = 0.999

/**
 * For events too close together to time, how many deltas each half of a
 * trend holds, and the share of the earlier half's size the later must keep.
 */
export const wheelTrendSpan = 3
export const wheelTrendFloor = 0.97

/** How many recent deltas a wheel swipe keeps for reading its trend. */
const wheelTrendLimit = 48

/** How many recent positions a wheel swipe keeps for its release speed. */
const wheelSampleLimit = 8

/**
 * Decides which axis a gesture belongs to from its travel so far.
 *
 * The axis is decided once and then held: a gesture that set off vertically
 * is a scroll for the rest of its life, however far sideways it later
 * wanders, and the reverse holds for a swipe. Ties go to the vertical axis
 * so a diagonal flick keeps scrolling the list.
 *
 * @param dx - Horizontal travel since the press, in pixels.
 * @param dy - Vertical travel since the press, in pixels.
 * @param slop - The travel below which the axis is still undecided.
 * @returns `pending` until the gesture has travelled `slop`, then `x` or `y`.
 */
export function resolveSwipeAxis(
  dx: number,
  dy: number,
  slop: number = swipeAxisSlop,
): SwipeAxis {
  const horizontal = Math.abs(dx)
  const vertical = Math.abs(dy)
  if (horizontal === 0 && vertical === 0) return "pending"
  if (Math.max(horizontal, vertical) < slop) return "pending"
  return horizontal > vertical ? "x" : "y"
}

/**
 * The geometry a row swipes within.
 *
 * Each action takes a square slot as tall as the row, the way Mail's actions
 * do, so the revealed width follows the row's own scale rather than a
 * constant. The tray never takes more than three quarters of the row, and a
 * commit always needs travel beyond the resting width plus half a slot, so
 * resting open and committing can never be the same release.
 *
 * @param rowWidth - The row's rendered width.
 * @param rowHeight - The row's rendered height, which is one action slot.
 * @param actionCount - How many actions the row reveals.
 * @returns The resting and committing distances for the row.
 */
export function swipeGeometry(
  rowWidth: number,
  rowHeight: number,
  actionCount: number,
): SwipeGeometry {
  const width = Math.max(rowWidth, 0)
  const slot = Math.max(rowHeight, 0)
  const openWidth = Math.min(Math.max(actionCount, 0) * slot, width * swipeTrayMaxShare)
  const commitWidth = Math.min(
    Math.max(width * swipeCommitRatio, openWidth + slot / 2),
    width,
  )
  return { rowWidth: width, openWidth, commitWidth }
}

/**
 * The action a full swipe commits: the first one, and only when it neither
 * is destructive nor asks for confirmation. Such an action is always a
 * deliberate press away — a swipe that overshoots can archive, never delete.
 *
 * @param actions - The row's actions, primary first.
 * @returns The committable action's id, or `null` when a full swipe only opens.
 */
export function committableSwipeAction(
  actions: readonly SwipeCommitCandidate[],
): string | null {
  const primary = actions[0]
  if (!primary || primary.tone === "destructive" || actionNeedsConfirm(primary)) {
    return null
  }
  return primary.id
}

/**
 * Converts pointer travel into how far the row is displaced toward its
 * leading edge. The row slides toward the leading edge — left in
 * left-to-right text, right in right-to-left — so the same finger movement
 * reads in opposite signs.
 *
 * @param dx - Horizontal pointer travel since the press.
 * @param direction - The row's writing direction.
 * @returns Displacement toward the leading edge; positive reveals actions.
 */
export function swipeDisplacement(
  dx: number,
  direction: SwipeDirection,
): number {
  return direction === "rtl" ? dx : -dx
}

/**
 * Converts a horizontal wheel delta into displacement toward the leading
 * edge. A two-finger swipe toward the leading edge scrolls content toward
 * the trailing edge, which browsers report as a positive `deltaX` in
 * left-to-right layouts.
 *
 * @param deltaX - The wheel event's horizontal delta, in pixels.
 * @param direction - The row's writing direction.
 * @returns Displacement toward the leading edge; positive reveals actions.
 */
export function wheelSwipeDisplacement(
  deltaX: number,
  direction: SwipeDirection,
): number {
  return direction === "rtl" ? -deltaX : deltaX
}

/**
 * Normalizes a wheel delta to pixels. Line- and page-based deltas come from
 * mice and keyboards rather than trackpads, but a gesture still has to move
 * a sensible distance for them.
 *
 * @param delta - The raw wheel delta.
 * @param deltaMode - `WheelEvent.deltaMode`: 0 pixels, 1 lines, 2 pages.
 * @param pageSize - The pixel size of one page for `deltaMode` 2.
 * @returns The delta in pixels.
 */
export function wheelDeltaInPixels(
  delta: number,
  deltaMode: number,
  pageSize: number,
): number {
  if (deltaMode === 1) return delta * wheelLineHeightPx
  if (deltaMode === 2) return delta * pageSize
  return delta
}

/**
 * Bounds a displacement to where the row may actually travel.
 *
 * The row never slides toward the trailing edge. A row whose primary action
 * can commit follows the pointer all the way across; one that cannot follows
 * it to the resting width and then only a quarter as fast, so overdragging
 * still answers the finger without suggesting that letting go will do
 * anything.
 *
 * @param displacement - The unbounded displacement toward the leading edge.
 * @param geometry - The row's swipe geometry.
 * @param canCommit - Whether a full swipe commits an action on this row.
 * @returns The displacement the row is drawn at.
 */
export function clampSwipeDisplacement(
  displacement: number,
  geometry: SwipeGeometry,
  canCommit: boolean,
): number {
  if (!(displacement > 0)) return 0
  if (canCommit) return Math.min(displacement, geometry.rowWidth)
  if (displacement <= geometry.openWidth) return displacement
  const overdrag = (displacement - geometry.openWidth) * swipeOverdragResistance
  return Math.min(geometry.openWidth + overdrag, geometry.rowWidth)
}

/**
 * Whether letting go at this displacement would commit the primary action.
 * The row draws its primary action filling the tray while this holds, so
 * the commit is visible before it happens and reversible by dragging back.
 *
 * @param displacement - The row's current displacement.
 * @param geometry - The row's swipe geometry.
 * @param canCommit - Whether a full swipe commits an action on this row.
 * @returns `true` when a release here commits.
 */
export function swipeArmed(
  displacement: number,
  geometry: SwipeGeometry,
  canCommit: boolean,
): boolean {
  return canCommit && displacement >= geometry.commitWidth && geometry.commitWidth > 0
}

/**
 * Decides what a released row does.
 *
 * Distance first: past `commitWidth` the committable action fires. Then
 * speed: a flick settles in the direction it was thrown. Otherwise the row
 * rests open once it has crossed half its resting width and springs back
 * below that.
 *
 * @param release - Where and how fast the row was let go.
 * @param release.displacement - The displacement at release.
 * @param release.velocity - Release speed toward the leading edge, in px/ms.
 * @param release.geometry - The row's swipe geometry.
 * @param release.committable - The action a full swipe commits, from
 * `committableSwipeAction`, or `null` when this release must not commit.
 * @returns What the row settles into.
 */
export function settleSwipe({
  displacement,
  velocity,
  geometry,
  committable,
}: {
  displacement: number
  velocity: number
  geometry: SwipeGeometry
  committable: string | null
}): SwipeRelease {
  if (committable !== null && swipeArmed(displacement, geometry, true)) {
    return { kind: "commit", actionId: committable }
  }
  if (geometry.openWidth <= 0 || displacement <= 0) return { kind: "closed" }
  if (velocity <= -swipeFlickVelocity) return { kind: "closed" }
  if (velocity >= swipeFlickVelocity) return { kind: "open" }
  return displacement >= geometry.openWidth / 2
    ? { kind: "open" }
    : { kind: "closed" }
}

/** One observation of a moving row, for estimating its release speed. */
export interface SwipeSample {
  /** Timestamp in milliseconds. */
  time: number
  /** Displacement toward the leading edge at that time. */
  displacement: number
}

/**
 * The row's speed at release, from the samples inside the last
 * `swipeVelocityWindowMs`. A pointer that stopped before letting go has no
 * recent samples and so no speed — a slow, deliberate release is judged on
 * distance alone.
 *
 * @param samples - Observations in time order.
 * @param now - The release timestamp.
 * @returns Speed toward the leading edge in px/ms; 0 when it cannot be told.
 */
export function swipeVelocity(
  samples: readonly SwipeSample[],
  now: number,
): number {
  const recent = samples.filter(
    (sample) => now - sample.time <= swipeVelocityWindowMs,
  )
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || last.time <= first.time) return 0
  return (last.displacement - first.displacement) / (last.time - first.time)
}

/**
 * The displacement a row is drawn at.
 *
 * With motion allowed the row follows the pointer exactly. Under reduced
 * motion it does not slide: it is drawn only at its resting positions —
 * closed, or open with its actions showing — and moves between them in one
 * step when the gesture crosses the same thresholds a release is judged by.
 *
 * @param displacement - The gesture's displacement.
 * @param geometry - The row's swipe geometry.
 * @param reducedMotion - Whether the viewer asked for reduced motion.
 * @returns The displacement to draw.
 */
export function presentedSwipeDisplacement(
  displacement: number,
  geometry: SwipeGeometry,
  reducedMotion: boolean,
): number {
  if (!reducedMotion) return displacement
  return displacement >= geometry.openWidth / 2 && geometry.openWidth > 0
    ? geometry.openWidth
    : 0
}

/**
 * How visible an action's icon and label are at this displacement. They
 * stay clear until the row has uncovered a good share of the tray, then
 * fade in to full by the resting width, so an action is never seen as a
 * cut-off fragment of text while it is still arriving.
 *
 * @param displacement - The displacement being drawn.
 * @param geometry - The row's swipe geometry.
 * @returns Opacity from 0 to 1.
 */
export function swipeContentOpacity(
  displacement: number,
  geometry: SwipeGeometry,
): number {
  if (geometry.openWidth <= 0) return 0
  const progress = displacement / geometry.openWidth
  return Math.min(
    Math.max((progress - swipeContentFadeStart) / swipeContentFadeSpan, 0),
    1,
  )
}

/**
 * One horizontal wheel gesture, split into what the fingers did and what
 * the trackpad's inertia added after they lifted.
 *
 * Browsers do not say when fingers leave a trackpad: macOS keeps sending
 * wheel events for a second or more after a flick, decaying smoothly, and
 * they arrive exactly as the fingers' own did. Summed together, a short
 * flick travels several hundred pixels and a row commits that was only
 * nudged. So the travel is read the way the fingers made it. Fingers wobble
 * — their deltas rise and fall around a speed — while inertia only ever
 * decays, so a run of shrinking deltas that keeps losing pace over time and
 * has fallen well below where it started is inertia, and the row is
 * released at the delta the run started from. A run whose pace stops
 * falling was the fingers after all, and the reach catches up with it.
 *
 * A mouse's accelerated horizontal wheel can slow the same way, and is read
 * the same way: a spin that eases off is released where it peaked, and the
 * next notches wait for it to go idle or to speed up again.
 */
export interface WheelSwipeTrack {
  /** `fingers` while the deltas may be the fingers'; `coasting` once they are inertia. */
  phase: "fingers" | "coasting"
  /** How far the gesture has moved the row since it began, inertia included. */
  travel: number
  /**
   * How far the fingers moved it: `travel` less any shrinking run that may
   * be inertia. Only this decides whether a release commits.
   */
  reach: number
  /** Release speed toward the leading edge once coasting, in px/ms. */
  velocity: number
  /**
   * Whether the deltas ever grew. Fingers always speed up from rest; a
   * gesture that has only ever slowed down is the tail of an earlier one.
   */
  grew: boolean
  /** How many deltas in the current run have been smaller than the one before. */
  shrinking: number
  /** How many deltas the current run holds, its peak included. */
  runLength: number
  /** The previous non-zero delta, and the time it took to arrive. */
  previous: number
  previousGap: number
  /** The latest deltas' sizes and gaps, for telling a decay from a wobble. */
  recent: readonly { size: number; gap: number }[]
  /**
   * The delta the current shrinking run started from, the time it took to
   * arrive, and the release speed there.
   */
  peak: number
  peakGap: number
  peakVelocity: number
  /** When the previous event arrived. */
  time: number
  samples: readonly SwipeSample[]
}

/** What one wheel delta did to a gesture. */
export interface WheelSwipeStep {
  track: WheelSwipeTrack
  /**
   * `move`: the row follows. `coast`: the deltas turned out to be inertia;
   * release the row now, from `track.reach`. `ignore`: more inertia, which
   * moves nothing. `resume`: fingers are back on the trackpad; `track` is a
   * fresh gesture starting from wherever the row is.
   */
  event: "move" | "coast" | "ignore" | "resume"
}

/**
 * Starts tracking a wheel gesture once its axis is known.
 *
 * @param travel - Displacement toward the leading edge the undecided
 * deltas already made.
 * @param time - When the deciding event arrived, in milliseconds.
 * @param seed - What was learned while the axis was undecided.
 * @param seed.previous - The last undecided delta, toward the leading edge.
 * @param seed.grew - Whether the undecided deltas ever grew.
 * @returns A gesture the fingers are moving.
 */
export function startWheelSwipe(
  travel: number,
  time: number,
  { previous = 0, grew = false }: { previous?: number; grew?: boolean } = {},
): WheelSwipeTrack {
  return {
    phase: "fingers",
    travel,
    reach: travel,
    velocity: 0,
    grew,
    shrinking: 0,
    runLength: 0,
    previous,
    previousGap: 0,
    recent: [],
    peak: 0,
    peakGap: 0,
    peakVelocity: 0,
    time,
    samples: [{ time, displacement: travel }],
  }
}

/**
 * How a wheel delta compares with the one before, as the ratio of their
 * sizes and of their speeds. A delta has only grown when both did and only
 * shrunk when both did: one that is larger only because it spans more time
 * — two frames the browser coalesced into one, or an event that came late —
 * is not faster, and one that is faster only because its timestamp came
 * early is no larger.
 */
function wheelDeltaRatios(
  delta: number,
  gap: number,
  earlier: number,
  earlierGap: number,
) {
  const size = Math.abs(delta) / Math.abs(earlier)
  // Only two timed gaps give a speed; an untimed one — events that arrived
  // together, or a gesture's seeded first delta — leaves size to decide.
  const pace =
    gap >= wheelTimedGapMs && earlierGap >= wheelTimedGapMs
      ? size * (earlierGap / gap)
      : size
  return { size, pace }
}

/**
 * Whether a run's latest deltas have stopped decaying. The latest
 * `wheelTrendWindowMs` of them are compared with the stretch before, by
 * summed size over summed time — so a late or coalesced inertia event,
 * larger only because it covers more time, changes nothing — and hold when
 * they keep more pace than inertia could over the time between the two.
 * Events too close together to time are compared by count and size instead.
 * Both stretches must lie inside the run.
 *
 * @param recent - The latest deltas' sizes and gaps, oldest first.
 * @param runLength - How many of the latest deltas belong to the run.
 * @returns `true` when the deltas are no longer decaying.
 */
function wheelTrendHolds(
  recent: readonly { size: number; gap: number }[],
  runLength: number,
) {
  const inRun = recent.slice(-runLength)
  if (inRun.some((entry) => entry.gap < wheelTimedGapMs)) {
    if (inRun.length < wheelTrendSpan * 2) return false
    const sizes = inRun.slice(-wheelTrendSpan * 2).map((entry) => entry.size)
    const before = sizes.slice(0, wheelTrendSpan).reduce((a, b) => a + b, 0)
    const after = sizes.slice(wheelTrendSpan).reduce((a, b) => a + b, 0)
    return before > 0 && after / before >= wheelTrendFloor
  }
  // Walk back from the latest delta, filling the later stretch and then
  // the earlier one with at least `wheelTrendWindowMs` each.
  const stretches = [
    { size: 0, time: 0 },
    { size: 0, time: 0 },
  ]
  let filling = 0
  for (let index = inRun.length - 1; index >= 0 && filling < 2; index -= 1) {
    const entry = inRun[index]!
    stretches[filling]!.size += entry.size
    stretches[filling]!.time += entry.gap
    if (stretches[filling]!.time >= wheelTrendWindowMs) filling += 1
  }
  if (filling < 2) return false
  const [after, before] = stretches as [
    { size: number; time: number },
    { size: number; time: number },
  ]
  if (!(before.size > 0)) return false
  const ratio = after.size / after.time / (before.size / before.time)
  const between = (after.time + before.time) / 2
  return ratio >= wheelTrendRetention ** between
}

/**
 * Advances a wheel gesture by one delta.
 *
 * @param track - The gesture so far.
 * @param delta - The event's displacement toward the leading edge, in pixels.
 * @param time - When the event arrived, in milliseconds.
 * @returns The advanced gesture and what the row should do.
 */
export function stepWheelSwipe(
  track: WheelSwipeTrack,
  delta: number,
  time: number,
): WheelSwipeStep {
  if (delta === 0 || !Number.isFinite(delta)) {
    return { track, event: track.phase === "coasting" ? "ignore" : "move" }
  }
  const gap = time - track.time
  const reversed = track.previous !== 0 && Math.sign(delta) !== Math.sign(track.previous)
  // Inertia strictly decays. A delta exactly the size of the last — a
  // mouse's horizontal wheel notches, however far apart — or about as fast
  // as it — fingers holding a steady speed, or inertia's rounding — neither
  // starts a run nor ends one.
  const ratios =
    track.previous !== 0 && !reversed && Math.abs(delta) !== Math.abs(track.previous)
      ? wheelDeltaRatios(delta, gap, track.previous, track.previousGap)
      : null
  const grew =
    ratios !== null && ratios.size > wheelGrowthMargin && ratios.pace > wheelGrowthMargin
  const smaller = ratios !== null && ratios.size < 1 && ratios.pace < 1

  if (track.phase === "coasting") {
    // Inertia never turns around and never speeds up, so either means the
    // fingers are down again — even fingers creeping slowly on.
    if (reversed || grew) {
      return {
        track: startWheelSwipe(delta, time, { previous: delta, grew: true }),
        event: "resume",
      }
    }
    return {
      track: { ...track, previous: delta, previousGap: gap, time },
      event: "ignore",
    }
  }

  const travel = track.travel + delta
  const samples = [...track.samples, { time, displacement: travel }].slice(
    -wheelSampleLimit,
  )
  let { reach, shrinking, runLength, peak, peakGap, peakVelocity } = track
  const recent = [
    ...(reversed ? [] : track.recent),
    { size: Math.abs(delta), gap },
  ].slice(-wheelTrendLimit)
  if (track.previous === 0 || reversed || grew) {
    shrinking = 0
    runLength = 0
    reach = travel
  } else if (shrinking === 0) {
    if (smaller) {
      // The previous delta may be the last the fingers made: measure the
      // release there, before any inertia.
      peak = track.previous
      peakGap = track.previousGap
      peakVelocity = swipeVelocity(track.samples, track.time)
      reach = track.travel
      shrinking = 1
      // A run holds its peak and every delta since.
      runLength = 2
    } else {
      reach = travel
    }
  } else {
    runLength += 1
    if (smaller) shrinking += 1
    // Inertia keeps decaying; fingers holding a speed, however unsteadily,
    // stop decaying within a few deltas, and that ends the run. The trend
    // is read inside the run only, so the fingers' own speeding up before
    // it cannot pass for a recovery.
    // `recent` holds deltas stepped through, not the seeded one, so the
    // run's peak may be missing from it; the run is the latest of them.
    if (wheelTrendHolds(recent, runLength)) {
      shrinking = 0
      runLength = 0
      reach = travel
    }
  }
  const next: WheelSwipeTrack = {
    ...track,
    travel,
    reach,
    grew: track.grew || grew,
    shrinking,
    runLength,
    previous: delta,
    previousGap: gap,
    recent,
    peak,
    peakGap,
    peakVelocity,
    time,
    samples,
  }
  if (
    shrinking >= wheelMomentumRun &&
    wheelDeltaRatios(delta, gap, peak, peakGap).pace <= wheelMomentumDecay
  ) {
    return {
      track: {
        ...next,
        phase: "coasting",
        // Left over from an earlier gesture, it was never thrown at all.
        velocity: next.grew ? peakVelocity : 0,
      },
      event: "coast",
    }
  }
  return { track: next, event: "move" }
}

/**
 * Decides what a released wheel gesture does. The release is judged at the
 * fingers' reach, so inertia can carry a row open but never into a commit;
 * and it is thrown only when inertia followed it, since fingers that stopped
 * before lifting leave none.
 *
 * @param release - The gesture and the row it moved.
 * @param release.track - The gesture.
 * @param release.start - The row's displacement when the gesture began.
 * @param release.geometry - The row's swipe geometry.
 * @param release.committable - The action a full swipe commits, or `null`.
 * @returns What the row settles into.
 */
export function settleWheelSwipe({
  track,
  start,
  geometry,
  committable,
}: {
  track: WheelSwipeTrack
  start: number
  geometry: SwipeGeometry
  committable: string | null
}): SwipeRelease {
  return settleSwipe({
    displacement: clampSwipeDisplacement(
      start + track.reach,
      geometry,
      committable !== null,
    ),
    velocity: track.phase === "coasting" ? track.velocity : 0,
    geometry,
    committable,
  })
}
