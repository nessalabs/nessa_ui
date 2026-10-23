/** @responsibility Decides what a SwipeRow swipe (and so a ConversationHistory row's) means — which axis a gesture belongs to, how far the row may travel, which of a trackpad's wheel deltas are the fingers' and which are inertia, and whether a release closes it, rests it open, or commits its primary action. */

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

/**
 * How long, in milliseconds, a wheel delta keeps proving that fingers are on
 * the trackpad. Only travel inside such a window counts toward a full
 * swipe. Fingers prove themselves by speeding up or turning around —
 * inertia does neither — or by holding one pace for `wheelHoldWindowMs`,
 * which backfills that whole stretch. Repeated deltas prove nothing by
 * themselves: inertia rounded to whole pixels repeats too. Inertia that
 * plateaus is credited for at most this long after the fingers' last proof.
 */
export const wheelFingerProofMs = 50

/**
 * How many deltas, at most, one proof of the fingers credits — so events
 * that arrive together, too close to time, cannot carry inertia in.
 */
export const wheelFingerProofEvents = 4

/**
 * How strongly the row resists travel past its resting width, as the share
 * of the remaining row the first pixels of overdrag cover. Smaller resists
 * more. The open tray reads as a detent: the row slows sharply past it.
 */
export const swipeRubberBand = 0.55

/**
 * The share of the row a row whose full swipe is armed is drawn at, at
 * least: crossing the commit point makes the row jump on, so the commit is
 * visible before the release that makes it.
 */
export const swipeArmedShare = 0.85

/**
 * How long, in milliseconds, deltas must hold one pace to prove fingers
 * without speeding up. Inertia loses about a third of its pace over this
 * long; fingers holding a speed lose none.
 */
export const wheelHoldWindowMs = 300

/** The least share of the fastest quarter's pace every quarter of a held stretch keeps. */
export const wheelHoldSpread = 0.9

/**
 * The share of its earlier half's pace a held stretch's later half must
 * keep; below it, the stretch is a slow decay.
 */
export const wheelHoldDrift = 0.97

/**
 * A wheel delta smaller than this share of the one before, from one at
 * least `wheelLandingFloor` pixels, is a new contact: fingers landing stop a
 * trackpad's inertia dead, while inertia and fingers easing off only taper.
 */
export const wheelLandingDrop = 0.25
export const wheelLandingFloor = 8

/** How many recent deltas a wheel swipe keeps for reading its trend. */
const wheelTrendLimit = 160

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
 * Where a commit-capable row is drawn for a displacement, while it is being
 * dragged. Up to the resting width it follows exactly; past it the row is
 * rubber-banded — it keeps answering the fingers but slows sharply, so the
 * open tray is felt as a detent and a commit is never reached by drifting.
 * Once a release would commit, the row jumps on to `swipeArmedShare` of the
 * row and follows from there, so the armed state is plain before it is let go.
 *
 * Rows that cannot commit are already resisted by `clampSwipeDisplacement`
 * and are drawn as they are.
 *
 * @param displacement - The gesture's displacement toward the leading edge.
 * @param geometry - The row's swipe geometry.
 * @param state - Whether the row can commit and whether a release would.
 * @param state.canCommit - Whether a full swipe commits an action on this row.
 * @param state.armed - Whether a release here commits.
 * @returns The displacement to draw.
 */
export function rubberBandSwipeDisplacement(
  displacement: number,
  geometry: SwipeGeometry,
  { canCommit, armed }: { canCommit: boolean; armed: boolean },
): number {
  if (!canCommit || displacement <= geometry.openWidth) return Math.max(displacement, 0)
  const limit = geometry.rowWidth - geometry.openWidth
  if (!(limit > 0)) return geometry.openWidth
  const excess = displacement - geometry.openWidth
  const banded =
    geometry.openWidth + limit * (1 - 1 / ((excess * swipeRubberBand) / limit + 1))
  if (!armed) return banded
  return Math.min(
    Math.max(banded, displacement, geometry.rowWidth * swipeArmedShare),
    geometry.rowWidth,
  )
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
  /**
   * How far the fingers provably moved the row in this gesture alone: only
   * travel inside a window opened by the fingers speeding up or turning
   * around (see `wheelFingerProofMs`), plus any stretch whose pace held as
   * inertia's cannot (`wheelHoldWindowMs`), with every move back toward the
   * trailing edge counted at once. Only this arms or commits a full swipe, whatever the
   * row's position when the gesture began.
   */
  credited: number
  /**
   * Whether the gesture ended because its deltas collapsed, as fingers
   * landing on inertia make them — or fingers stopping dead. Such an end
   * never commits: it may not have been a lift at all.
   */
  landed?: boolean
  /** Until when, in milliseconds, deltas count toward `credited`. */
  creditUntil: number
  /** How many more deltas count toward `credited` before the fingers prove themselves again. */
  creditLeft: number
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
  recent: readonly WheelTrendEntry[]
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
   * `move`: the row follows. `coast`: the deltas turned out to be inertia,
   * or new fingers landed on it; release the row now, from `track.reach`. `ignore`: more inertia, which
   * moves nothing. `resume`: fingers are back on the trackpad; `track` is a
   * fresh gesture starting from wherever the row is.
   */
  event: "move" | "coast" | "ignore" | "resume"
}

/** One recent wheel delta, as a gesture's trend reads it. */
export interface WheelTrendEntry {
  size: number
  gap: number
  /** Whether the fingers sped up (or turned around) at this delta. */
  grew: boolean
  /** Whether this delta counts toward the gesture's `credited` travel. */
  credited: boolean
}

/**
 * Whether the latest deltas have held their pace: the last
 * `wheelHoldWindowMs` of them, cut into four equal stretches of time, never
 * differ in pace by more than `wheelHoldSpread`, and the later half keeps
 * `wheelHoldDrift` of the earlier half's pace — and, by the deltas' own
 * sizes in the order they came, of their size: inertia's sizes keep falling
 * however unevenly it is delivered, and a pace read through uneven gaps can
 * look steady when it is not (a slow runner delivered a plateau 8 to 42 ms
 * apart, nessa_ui#141). Fingers holding a speed, however unsteadily from
 * one event to the next, keep both. Inertia cannot, however flat its first
 * frames look — it loses about a quarter of its pace over that long — and
 * neither can fingers accelerating into inertia.
 *
 * @param recent - The latest deltas, oldest first.
 * @returns The index the held stretch starts at, else `null`.
 */
function wheelPaceHeld(recent: readonly WheelTrendEntry[]): number | null {
  let time = 0
  let index = recent.length - 1
  for (; index >= 0 && time < wheelHoldWindowMs; index -= 1) {
    time += recent[index]!.gap
  }
  if (time < wheelHoldWindowMs) return null
  const start = index + 1
  const quarters = [0, 0, 0, 0].map(() => ({ size: 0, time: 0 }))
  let elapsed = 0
  for (const entry of recent.slice(start)) {
    // Each delta belongs to the quarter its arrival falls in.
    elapsed += entry.gap
    const quarter = quarters[Math.min(3, Math.floor((elapsed / time) * 4 - 1e-9))]!
    quarter.size += entry.size
    quarter.time += entry.gap
  }
  if (quarters.some((quarter) => !(quarter.time > 0))) return null
  const paces = quarters.map((quarter) => quarter.size / quarter.time)
  if (Math.min(...paces) < Math.max(...paces) * wheelHoldSpread) return null
  // A pace that keeps falling is inertia, however gently: fingers holding
  // a speed rise and fall around it, so their later half keeps up with
  // their earlier one.
  const earlier = quarters[0]!.size + quarters[1]!.size
  const later = quarters[2]!.size + quarters[3]!.size
  const earlierTime = quarters[0]!.time + quarters[1]!.time
  const laterTime = quarters[2]!.time + quarters[3]!.time
  if (later / laterTime < (earlier / earlierTime) * wheelHoldDrift) return null
  // The same by the deltas' sizes, half the events against half: no gap,
  // however late or early, makes a shrinking run look held.
  const held = recent.slice(start)
  const half = Math.floor(held.length / 2)
  const mean = (entries: readonly WheelTrendEntry[]) =>
    entries.reduce((sum, entry) => sum + entry.size, 0) / Math.max(entries.length, 1)
  return mean(held.slice(held.length - half)) < mean(held.slice(0, half)) * wheelHoldDrift
    ? null
    : start
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
    credited: travel,
    creditUntil: time + wheelFingerProofMs,
    creditLeft: wheelFingerProofEvents,
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
  recent: readonly WheelTrendEntry[],
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

  // Fingers landing on a trackpad that is still coasting stop the inertia
  // dead: the deltas collapse in one event, as inertia never does. Whatever
  // came before was its own gesture, released where its fingers left it;
  // the new contact resumes from there as its deltas grow.
  // Only once the deltas may already be inertia — past the fingers' last
  // proof — so fingers that stop sharply mid-drag are not taken for a
  // landing.
  if (
    track.previous !== 0 &&
    !reversed &&
    (time > track.creditUntil || track.creditLeft <= 0) &&
    Math.abs(track.previous) >= wheelLandingFloor &&
    Math.abs(delta) < Math.abs(track.previous) * wheelLandingDrop
  ) {
    return {
      track: {
        ...track,
        phase: "coasting",
        velocity: 0,
        landed: true,
        previous: delta,
        previousGap: gap,
        time,
      },
      event: "coast",
    }
  }

  const travel = track.travel + delta
  const samples = [...track.samples, { time, displacement: travel }].slice(
    -wheelSampleLimit,
  )
  let { reach, shrinking, runLength, peak, peakGap, peakVelocity } = track
  // Fingers prove they are down by speeding up or turning around. Inertia
  // only decays, so it is credited at most `wheelFingerProofMs` past the
  // fingers' last proof — unless the pace since then has held for long
  // enough that it cannot be inertia, and then that whole stretch is the
  // fingers'. Repeated deltas prove nothing by themselves: inertia rounded
  // to whole pixels repeats too.
  const proven = grew || reversed
  let creditUntil = proven ? time + wheelFingerProofMs : track.creditUntil
  let creditLeft = proven ? wheelFingerProofEvents : track.creditLeft
  let credited = track.credited
  const inWindow = time <= creditUntil && creditLeft > 0
  if (inWindow) creditLeft -= 1
  const current: WheelTrendEntry = {
    size: Math.abs(delta),
    gap,
    grew: grew || reversed,
    credited: delta < 0 || inWindow,
  }
  if (current.credited) credited += delta
  let recent: WheelTrendEntry[] = [...(reversed ? [] : track.recent), current].slice(
    -wheelTrendLimit,
  )
  const held = wheelPaceHeld(recent)
  if (held !== null) {
    creditUntil = time + wheelFingerProofMs
    creditLeft = wheelFingerProofEvents
    recent = recent.map((entry, index) => {
      if (index < held || entry.credited) return entry
      credited += Math.sign(delta) * entry.size
      return { ...entry, credited: true }
    })
  }
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
    credited,
    creditUntil,
    creditLeft,
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
 * Decides what a released wheel gesture does. A full swipe commits only from
 * the travel the fingers provably made in this one gesture (`credited`), so
 * inertia — however it decays — and a second flick landing on an open row
 * never commit. Resting open or closed is judged at the fingers' reach, so
 * inertia can carry a row open; and the release is thrown only when inertia
 * followed it, since fingers that stopped before lifting leave none. A
 * gesture that was only ever inertia, left over from an earlier one, leaves
 * the row where it found it.
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
  if (committable !== null && !track.landed && wheelSwipeArmed(track, geometry)) {
    return { kind: "commit", actionId: committable }
  }
  const stale = track.phase === "coasting" && !track.grew
  return settleSwipe({
    displacement: clampSwipeDisplacement(
      stale ? start : start + track.reach,
      geometry,
      committable !== null,
    ),
    velocity: track.phase === "coasting" && !stale ? track.velocity : 0,
    geometry,
    committable: null,
  })
}

/**
 * Whether letting go of a wheel gesture now would commit: the fingers' own
 * provable travel in this gesture has crossed the commit point.
 *
 * @param track - The gesture.
 * @param geometry - The row's swipe geometry.
 * @returns `true` when a release now commits a committable action.
 */
export function wheelSwipeArmed(
  track: WheelSwipeTrack,
  geometry: SwipeGeometry,
): boolean {
  return swipeArmed(Math.min(track.credited, geometry.rowWidth), geometry, true)
}
