/** @responsibility Decides what a ConversationHistory row swipe means — which axis a gesture belongs to, how far the row may travel, and whether a release closes it, rests it open, or commits its primary action. */

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
