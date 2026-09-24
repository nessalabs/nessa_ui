"use client"

import * as React from "react"
import { Pin, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  actionNeedsConfirm,
  clampSwipeDisplacement,
  committableSwipeAction,
  presentedSwipeDisplacement,
  resolveSwipeAxis,
  settleSwipe,
  swipeArmed,
  swipeDisplacement,
  swipeGeometry,
  swipeContentOpacity,
  swipeVelocity,
  wheelDeltaInPixels,
  wheelSwipeDisplacement,
  wheelSwipeIdleMs,
  type SwipeAxis,
  type SwipeCommitCandidate,
  type SwipeDirection,
  type SwipeGeometry,
  type SwipeRelease,
  type SwipeSample,
} from "./conversation-history-swipe"
import { Input } from "./input"
import { RandomAvatar } from "./random-avatar"

export interface ConversationHistoryEntry {
  /** Identifies the conversation across selection. */
  id: string
  /** The conversation title. */
  title: string
  /** The last message, shown muted under the title. */
  preview?: string
  /** Relative time, shown on the trailing edge. */
  updated?: string
  /** Pins the row above unpinned conversations when the host sorts that way. */
  pinned?: boolean
  /**
   * Optional project or path, shown under the preview. Also seeds the row
   * avatar: conversations that share a project share a painting, the way
   * threads with the same contact share a photo. When omitted, the
   * conversation id is the seed so the row still has an identity.
   */
  project?: string
}

/** One action a row reveals when it is swiped or opened from the keyboard. */
export interface ConversationHistoryAction {
  /** Reported to `onRowAction`. Unique within one row's actions. */
  id: string
  /**
   * The visible label. The action's accessible name is this label followed
   * by the conversation title — "Archive Release notes" — so a list of
   * identical buttons still says which row each one acts on.
   */
  label: string
  /** A decorative icon drawn above the label. */
  icon?: React.ReactNode
  /**
   * `destructive` paints the action in the destructive token. A destructive
   * action is never committed by a full swipe, even when it comes first, and
   * asks for confirmation unless `confirm` says otherwise.
   */
  tone?: SwipeCommitCandidate["tone"]
  /**
   * Whether pressing the action first asks for confirmation: the action
   * grows to fill the tray and reads `confirmLabel`, and only a second press
   * runs it. Escape, closing the row, or pressing elsewhere backs out.
   * Defaults to `true` for destructive actions and `false` otherwise. An
   * action that confirms never commits from a full swipe.
   */
  confirm?: boolean
  /** The visible label while confirming. Defaults to "Confirm". */
  confirmLabel?: string
  /**
   * Draws the action's content in place of the default icon and label.
   * The button, its colors, sizing, confirmation, and accessible name stay
   * the component's, so a custom face cannot lose the behavior. The content
   * sits inside a button, so it must not be interactive, and its visible
   * text should start with `label` (or `confirmLabel` while confirming) so
   * the words on screen are the words that name the button. Rows redraw
   * when their entry or action objects change, so draw from `state` and the
   * action itself rather than from other host state.
   */
  render?: (state: ConversationHistoryActionState) => React.ReactNode
}

/** What a custom action face is drawn for. */
export interface ConversationHistoryActionState {
  /** The row the action belongs to. */
  conversation: ConversationHistoryEntry
  /** The action is waiting for its confirming second press. */
  confirming: boolean
  /** A full swipe past the commit threshold will run this action on release. */
  armed: boolean
}

/** Project path when present, otherwise the conversation id. */
function conversationAvatarSeed(conversation: ConversationHistoryEntry) {
  const project = conversation.project?.trim()
  return project && project.length > 0 ? project : conversation.id
}

export interface ConversationHistoryProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** The conversations to list, in the order the host wants them drawn. */
  conversations: readonly ConversationHistoryEntry[]
  /** The selected conversation's id, or `null` when none is selected. */
  value?: string | null
  /** Fires with the selected conversation's id. */
  onValueChange?: (id: string) => void
  /**
   * The search field's value. Omit both `query` and `onQueryChange` to hide
   * the field; the host that owns filtering also owns whether it is shown.
   */
  query?: string
  /** Updates the search field. Required for the field to render. */
  onQueryChange?: (query: string) => void
  /** The search field's placeholder. */
  searchPlaceholder?: string
  /** The accessible name of the list. */
  label?: string
  /** Shown when `conversations` is empty. */
  emptyMessage?: string
  /**
   * Development tooling: records row presses, axis decisions, drag samples,
   * releases, settles, confirmations, actions, and focus rescues into a ring
   * buffer published at `window.__nessaConversationHistory[<instance id>]`,
   * with a `snapshot()` of every row's swipe state — so a gesture glitch
   * (trackpad inertia, settle and focus ordering) can be reproduced once
   * and read back as data. No-op unless set.
   */
  debug?: boolean
  /**
   * The actions a row reveals, primary first. Called for every row on every
   * render. Define each action object once (outside render); returning a
   * fresh array of those same objects is fine. A row given no
   * actions does not swipe. Omit the prop entirely when no row has actions,
   * rather than returning `[]`, so the list adds no gesture handling at all.
   */
  rowActions?: (
    conversation: ConversationHistoryEntry,
  ) => readonly ConversationHistoryAction[]
  /**
   * Fires with the conversation's id and the chosen action's id, from a
   * pressed (and, where asked, confirmed) action button or from a full swipe
   * committing the primary action. The list stores nothing: removing or
   * archiving the conversation is the host's job.
   */
  onRowAction?: (conversationId: string, actionId: string) => void
}

const noActions: readonly ConversationHistoryAction[] = Object.freeze([])

/** One flat trace entry; see `debug`. */
type TraceEntry = Record<string, string | number | boolean | null>

/** The trace sink handed to rows: `null` unless `debug` is set. */
type Trace = ((entry: TraceEntry) => void) | null

/** How many trace entries the ring buffer keeps. */
const traceLimit = 4000

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

/** Returns the live, server-safe reduced-motion preference. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

/**
 * A CSS time in milliseconds, or `null` when the value is not one. A bare
 * number is rejected: CSS requires a unit.
 */
function parseCssTime(value: string): number | null {
  const trimmed = value.trim()
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (trimmed.endsWith("ms")) return parsed
  if (trimmed.endsWith("s")) return parsed * 1000
  return null
}

/**
 * How long a row takes to settle, read from the motion token the row's own
 * transition uses, so the wait and the movement agree — including the zero
 * the theme substitutes under reduced motion. A missing token makes the
 * transition invalid, which CSS treats as none, so it reads as zero too.
 */
function rowSettleDurationMs(row: Element) {
  const value = getComputedStyle(row).getPropertyValue(
    "--nessa-motion-duration-normal",
  )
  return parseCssTime(value) ?? 0
}

interface RowMeasurement {
  geometry: SwipeGeometry
  direction: SwipeDirection
}

/** The row's swipe geometry and writing direction, measured now. */
function measureRow(row: HTMLElement, actionCount: number): RowMeasurement {
  const { width, height } = row.getBoundingClientRect()
  return {
    geometry: swipeGeometry(width, height, actionCount),
    direction: getComputedStyle(row).direction === "rtl" ? "rtl" : "ltr",
  }
}

/**
 * How long a still touch or pen press takes to open a row's actions. A swipe
 * is a path gesture; this is the single-point way in for anyone who cannot
 * make one, including touch screen readers passing a double-tap-and-hold.
 */
const longPressMs = 500

/** How many recent positions a pointer swipe keeps for its release speed. */
const swipeSampleLimit = 8

/** The row's settle motion, shared by the row, its tray, and the tray's contents. */
const settleTransitionClassName =
  "[transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)]"

type SwipePhase = "tracking" | "settling" | "committing"

interface SwipeState {
  phase: SwipePhase
  /** Displacement toward the leading edge, in pixels. */
  displacement: number
}

interface PointerSwipe {
  pointerId: number
  originX: number
  originY: number
  axis: SwipeAxis
  /** The displacement the row had when the press landed. */
  start: number
  /** Whether the row was open at the press, so a tap on it closes it. */
  wasOpen: boolean
  geometry: SwipeGeometry
  direction: SwipeDirection
  samples: SwipeSample[]
}

interface WheelSwipe {
  /** Decided once the summed deltas cross the same slop a pointer uses. */
  axis: SwipeAxis
  /** Summed pixel deltas while the axis is still undecided. */
  dx: number
  dy: number
  /** The displacement the row had when the axis was decided. */
  start: number
  /** Displacement added by the gesture since then. */
  travel: number
  geometry: SwipeGeometry | null
  direction: SwipeDirection
  /** When the last event of the gesture arrived, from `performance.now()`. */
  last: number
}

// A prop added here must also be compared in `sameRowProps`.
interface ConversationHistoryRowProps {
  conversation: ConversationHistoryEntry
  selected: boolean
  actions: readonly ConversationHistoryAction[]
  /** Reserve the preview and project lines even when this row has none. */
  reservePreview: boolean
  reserveProject: boolean
  open: boolean
  reducedMotion: boolean
  onOpenChange: (conversationId: string, open: boolean) => void
  onSelect: (conversationId: string) => void
  /** Speaks a short status through the list's live region; "" clears it. */
  onAnnounce: (message: string) => void
  /** Records a trace entry when the list is in `debug`. */
  trace: Trace
  onAction: (
    conversationId: string,
    actionId: string,
    hadFocus: boolean,
  ) => void
}

// `outline-none` resets Tailwind's outline style to none, which the width
// utility would otherwise inherit and draw nothing; restore it on focus.
const rowFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

/** Every field of an entry; the type check fails if one is left out. */
const entryFields = [
  "id",
  "title",
  "preview",
  "updated",
  "pinned",
  "project",
] as const satisfies readonly (keyof ConversationHistoryEntry)[]
type MissingEntryField = Exclude<
  keyof ConversationHistoryEntry,
  (typeof entryFields)[number]
>
const everyEntryFieldCompared: [MissingEntryField] extends [never] ? true : never = true
void everyEntryFieldCompared

/**
 * Whether a row can skip re-rendering. Hosts commonly rebuild their entries
 * and action arrays every render, so both are compared by content — an
 * entry by its fields, actions by the action objects they hold — rather
 * than by identity, which would re-render every row whenever the list did.
 */
function sameRowProps(
  previous: ConversationHistoryRowProps,
  next: ConversationHistoryRowProps,
) {
  const a = previous.conversation
  const b = next.conversation
  const sameConversation =
    a === b || entryFields.every((field) => a[field] === b[field])
  const sameActions =
    previous.actions === next.actions ||
    (previous.actions.length === next.actions.length &&
      previous.actions.every((action, index) => action === next.actions[index]))
  return (
    sameConversation &&
    sameActions &&
    previous.selected === next.selected &&
    previous.reservePreview === next.reservePreview &&
    previous.reserveProject === next.reserveProject &&
    previous.open === next.open &&
    previous.reducedMotion === next.reducedMotion &&
    previous.onOpenChange === next.onOpenChange &&
    previous.onSelect === next.onSelect &&
    previous.onAnnounce === next.onAnnounce &&
    previous.trace === next.trace &&
    previous.onAction === next.onAction
  )
}

/**
 * One conversation row: the selectable button and, when the host gives the
 * row actions, the swipe that reveals them. Private to ConversationHistory,
 * which decides which single row may be open.
 */
const ConversationHistoryRow = React.memo(function ConversationHistoryRow({
  conversation,
  selected,
  actions,
  reservePreview,
  reserveProject,
  open,
  reducedMotion,
  onOpenChange,
  onSelect,
  onAnnounce,
  trace,
  onAction,
}: ConversationHistoryRowProps) {
  const id = conversation.id
  const hasActions = actions.length > 0
  const committable = committableSwipeAction(actions)

  const rowRef = React.useRef<HTMLLIElement>(null)
  const itemRef = React.useRef<HTMLButtonElement>(null)
  const trayRef = React.useRef<HTMLDivElement>(null)

  const [swipe, setSwipe] = React.useState<SwipeState | null>(null)
  const [geometry, setGeometry] = React.useState<SwipeGeometry | null>(null)
  const [direction, setDirection] = React.useState<SwipeDirection>("ltr")
  // The action waiting for its confirming second press, if any.
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  React.useLayoutEffect(() => {
    latest.current = {
      actions,
      open,
      onOpenChange,
      onAction,
      onAnnounce,
      trace,
      confirming: confirmingId !== null,
    }
  })

  // Native listeners and timers read the newest values through refs, so they
  // attach once rather than on every drag step.
  const swipeRef = React.useRef<SwipeState | null>(null)
  const latest = React.useRef({
    actions,
    open,
    onOpenChange,
    onAction,
    onAnnounce,
    trace,
    confirming: false,
  })

  const pointerRef = React.useRef<PointerSwipe | null>(null)
  const detachPointerRef = React.useRef<(() => void) | null>(null)
  const wheelRef = React.useRef<WheelSwipe | null>(null)
  const wheelTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // A press that became a swipe, or a tap that closed an open row, must not
  // also select the conversation when its click arrives.
  const swallowClickRef = React.useRef(false)
  const focusTrayRef = React.useRef(false)
  // A committed action still owed to the host while the row slides out.
  const pendingCommitRef = React.useRef<string | null>(null)
  const closedByBlurRef = React.useRef(false)

  /** Sets the swipe state and the ref native handlers read it through. */
  const showSwipe = React.useCallback((next: SwipeState | null) => {
    swipeRef.current = next
    setSwipe(next)
  }, [])

  const clearSettleTimer = React.useCallback(() => {
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current)
    settleTimerRef.current = null
  }, [])

  const clearWheel = React.useCallback(() => {
    if (wheelTimerRef.current !== null) clearTimeout(wheelTimerRef.current)
    wheelTimerRef.current = null
    wheelRef.current = null
  }, [])

  const endPointer = React.useCallback(() => {
    if (longPressTimerRef.current !== null) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
    detachPointerRef.current?.()
    detachPointerRef.current = null
    pointerRef.current = null
  }, [])

  /**
   * Moves the row to `displacement` on the motion token, then runs `done`.
   * The wait is the token's own duration, so under reduced motion `done`
   * runs at once and nothing is left scheduled.
   */
  const settle = React.useCallback(
    (phase: "settling" | "committing", displacement: number, done: () => void) => {
      clearSettleTimer()
      showSwipe({ phase, displacement })
      const row = rowRef.current
      const duration = row ? rowSettleDurationMs(row) : 0
      latest.current.trace?.({ ev: "settle", row: id, phase, to: Math.round(displacement), ms: duration })
      const finish = () => {
        latest.current.trace?.({ ev: "settled", row: id, phase })
        done()
      }
      if (duration <= 0) {
        finish()
        return
      }
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null
        finish()
      }, duration)
    },
    [clearSettleTimer, id, showSwipe],
  )

  /** Whether focus is anywhere inside this row right now. */
  const holdsFocus = React.useCallback(() => {
    const row = rowRef.current
    return Boolean(row?.contains(row.ownerDocument.activeElement))
  }, [])

  /**
   * Carries out a release: claims or frees this row's place as the single
   * open row, settles it, and for a commit reports the action to the host
   * once the row has slid out.
   */
  const applyRelease = React.useCallback(
    (release: SwipeRelease, measured: SwipeGeometry) => {
      const { onOpenChange: setOpen, onAction: act } = latest.current
      latest.current.trace?.({
        ev: "release",
        row: id,
        kind: release.kind,
        action: release.kind === "commit" ? release.actionId : null,
        at: Math.round(swipeRef.current?.displacement ?? 0),
      })
      if (release.kind === "closed") {
        setOpen(id, false)
        settle("settling", 0, () => showSwipe(null))
      } else if (release.kind === "open") {
        setOpen(id, true)
        settle("settling", measured.openWidth, () => showSwipe(null))
      } else {
        setOpen(id, true)
        pendingCommitRef.current = release.actionId
        settle("committing", measured.rowWidth, () => {
          pendingCommitRef.current = null
          showSwipe(null)
          setOpen(id, false)
          latest.current.trace?.({ ev: "action", row: id, action: release.actionId, via: "swipe" })
          act(id, release.actionId, holdsFocus())
        })
      }
    },
    [holdsFocus, id, settle, showSwipe],
  )

  /** Settles a release made at the row's current displacement. */
  const release = React.useCallback(
    (measured: SwipeGeometry, velocity: number, committable: string | null) => {
      applyRelease(
        settleSwipe({
          displacement: swipeRef.current?.displacement ?? 0,
          velocity,
          geometry: measured,
          committable,
        }),
        measured,
      )
    },
    [applyRelease],
  )

  /** Where a new gesture starts from: wherever the row is, or at rest. */
  const restingDisplacement = React.useCallback(
    (measured: SwipeGeometry) =>
      swipeRef.current?.displacement ??
      (latest.current.open ? measured.openWidth : 0),
    [],
  )

  /** Claims the single open slot and records what the gesture measures against. */
  const beginSwipe = React.useCallback(
    (measured: RowMeasurement) => {
      latest.current.trace?.({
        ev: "begin",
        row: id,
        open: Math.round(measured.geometry.openWidth),
        commit: Math.round(measured.geometry.commitWidth),
        dir: measured.direction,
      })
      clearSettleTimer()
      setGeometry(measured.geometry)
      setDirection(measured.direction)
      latest.current.onOpenChange(id, true)
    },
    [clearSettleTimer, id],
  )

  // Another row opening, a tap elsewhere, or a scroll closes this one: slide
  // back from wherever it rests.
  const wasOpenRef = React.useRef(open)
  React.useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = open
    if (!wasOpen || open) return
    // Only one row is open, so any prompt showing is this row's.
    if (latest.current.confirming) latest.current.onAnnounce("")
    setConfirmingId(null)
    const current = swipeRef.current
    if (current?.phase === "committing") return
    if (current?.phase === "settling" && current.displacement === 0) return
    if (pointerRef.current) endPointer()
    clearWheel()
    // A tray about to hide must not take focus with it — unless focus is
    // already leaving the row, which is what closed it.
    const tray = trayRef.current
    const blurred = closedByBlurRef.current
    closedByBlurRef.current = false
    if (!blurred && tray?.contains(tray.ownerDocument.activeElement)) {
      itemRef.current?.focus({ preventScroll: true })
    }
    settle("settling", 0, () => showSwipe(null))
  }, [clearWheel, endPointer, open, settle, showSwipe])

  // An action taken away while it waited for confirmation takes the
  // confirmation with it; otherwise every remaining action would stay
  // stepped aside and inert. Its button unmounted, so focus returns to the
  // row rather than falling out of the page.
  React.useLayoutEffect(() => {
    if (confirmingId === null) return
    if (actions.some((action) => action.id === confirmingId)) return
    trace?.({ ev: "confirm-lost", row: id, action: confirmingId })
    setConfirmingId(null)
    onAnnounce("")
    const ownerDocument = itemRef.current?.ownerDocument
    const active = ownerDocument?.activeElement
    if (!active || active === ownerDocument?.body) {
      itemRef.current?.focus({ preventScroll: true })
    }
  }, [actions, confirmingId, id, onAnnounce, trace])

  // A row whose actions were taken away while it was open has nothing left
  // to show; give up the open slot.
  React.useEffect(() => {
    if (open && !hasActions) onOpenChange(id, false)
  }, [hasActions, id, onOpenChange, open])

  // Opening from the keyboard hands focus to the first action once the tray
  // is visible, which is only true after the render that opened it.
  React.useLayoutEffect(() => {
    if (!open || !focusTrayRef.current) return
    focusTrayRef.current = false
    trayRef.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true })
  }, [open])

  React.useEffect(
    () => () => {
      endPointer()
      clearWheel()
      clearSettleTimer()
      // Committing is a decision the viewer already made; a row unmounted
      // mid-slide (the host refiltered the list) still reports it.
      // A row removed mid-confirmation takes its prompt with it.
      if (latest.current.confirming) latest.current.onAnnounce("")
      const committed = pendingCommitRef.current
      pendingCommitRef.current = null
      if (committed !== null) latest.current.onAction(id, committed, false)
    },
    [clearSettleTimer, clearWheel, endPointer, id],
  )

  // Horizontal trackpad scrolling swipes the row the way a two-finger swipe
  // does in Mail. React's wheel listener is passive and cannot cancel, so
  // this one is attached natively; a vertical wheel is never cancelled and
  // keeps scrolling the list.
  React.useEffect(() => {
    const row = rowRef.current
    if (!row || !hasActions) return
    // One timer per gesture, re-checked when it fires, rather than one
    // cleared and re-armed on every event of a 120 Hz scroll.
    const armIdle = () => {
      if (wheelTimerRef.current !== null) return
      const check = () => {
        const gesture = wheelRef.current
        const quiet = gesture ? performance.now() - gesture.last : wheelSwipeIdleMs
        if (quiet < wheelSwipeIdleMs) {
          wheelTimerRef.current = setTimeout(check, wheelSwipeIdleMs - quiet)
          return
        }
        clearWheel()
        if (!gesture?.geometry || gesture.axis !== "x") return
        release(
          gesture.geometry,
          0,
          committableSwipeAction(latest.current.actions),
        )
      }
      wheelTimerRef.current = setTimeout(check, wheelSwipeIdleMs)
    }
    const onWheel = (event: WheelEvent) => {
      let gesture = wheelRef.current
      if (!gesture) {
        if (event.ctrlKey || pointerRef.current) return
        if (swipeRef.current?.phase === "committing") return
        gesture = {
          axis: "pending",
          dx: 0,
          dy: 0,
          start: 0,
          travel: 0,
          geometry: null,
          direction: "ltr",
          last: 0,
        }
        wheelRef.current = gesture
      }
      gesture.last = performance.now()
      armIdle()
      // A vertical gesture keeps scrolling the list for its whole life, and
      // costs nothing more than noting that it is still going.
      if (gesture.axis === "y") return
      // Only page-based deltas need the row's width; reading it on every
      // event would force layout during ordinary scrolling.
      const pageSize = event.deltaMode === 2 ? row.getBoundingClientRect().width : 0
      const deltaX = wheelDeltaInPixels(event.deltaX, event.deltaMode, pageSize)
      if (gesture.axis === "pending") {
        // The axis is decided on summed travel, not on one event, so a
        // vertical scroll that opens with a pixel of sideways wobble stays
        // a scroll.
        gesture.dx += deltaX
        gesture.dy += wheelDeltaInPixels(event.deltaY, event.deltaMode, pageSize)
        gesture.axis = resolveSwipeAxis(gesture.dx, gesture.dy)
        if (gesture.axis !== "pending") {
          latest.current.trace?.({ ev: "axis", row: id, via: "wheel", axis: gesture.axis })
        }
        // Chrome only lets a page cancel the first event of a trackpad
        // sequence; the rest arrive uncancellable. So a gesture leaning
        // sideways is claimed before its axis is certain — otherwise the
        // swipe would also scroll ancestors or trigger history navigation.
        // A vertical-leaning event is never claimed, so scrolling survives.
        if (
          gesture.axis === "pending" &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        ) {
          event.preventDefault()
        }
        if (gesture.axis !== "x") return
        const measured = measureRow(row, latest.current.actions.length)
        gesture.start = restingDisplacement(measured.geometry)
        gesture.geometry = measured.geometry
        gesture.direction = measured.direction
        // The travel that decided the axis counts toward the swipe.
        gesture.travel = wheelSwipeDisplacement(gesture.dx, gesture.direction)
        beginSwipe(measured)
      } else {
        gesture.travel += wheelSwipeDisplacement(deltaX, gesture.direction)
      }
      if (!gesture.geometry) return
      event.preventDefault()
      showSwipe({
        phase: "tracking",
        displacement: clampSwipeDisplacement(
          gesture.start + gesture.travel,
          gesture.geometry,
          committableSwipeAction(latest.current.actions) !== null,
        ),
      })
    }
    row.addEventListener("wheel", onWheel, { passive: false })
    return () => row.removeEventListener("wheel", onWheel)
  }, [beginSwipe, clearWheel, hasActions, release, restingDisplacement, showSwipe])

  // Not the overlay panels' useDragGesture: that one tracks a single axis and
  // captures the pointer at the press, where a row must wait to learn the
  // gesture's axis and hand vertical ones back to the list untouched.
  const onPointerDown = (event: React.PointerEvent<HTMLLIElement>) => {
    if (!hasActions) return
    // Any press starts a fresh click: a flag left by a swipe whose finger
    // lifted without clicking must not eat this one.
    swallowClickRef.current = false
    if (pointerRef.current || wheelRef.current?.axis === "x") return
    if (event.pointerType === "mouse" && event.button !== 0) return
    if (swipeRef.current?.phase === "committing") return
    if (trayRef.current?.contains(event.target as Node)) return
    latest.current.trace?.({ ev: "press", row: id, pointer: event.pointerType, open })
    const row = event.currentTarget
    const measured = measureRow(row, actions.length)
    const gesture: PointerSwipe = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      axis: "pending",
      start: restingDisplacement(measured.geometry),
      wasOpen: open,
      geometry: measured.geometry,
      direction: measured.direction,
      samples: [],
    }
    pointerRef.current = gesture
    const ownerDocument = row.ownerDocument

    const move = (moved: PointerEvent) => {
      if (pointerRef.current !== gesture || moved.pointerId !== gesture.pointerId) {
        return
      }
      const dx = moved.clientX - gesture.originX
      const dy = moved.clientY - gesture.originY
      if (gesture.axis === "pending") {
        gesture.axis = resolveSwipeAxis(dx, dy)
        if (gesture.axis !== "pending") {
          latest.current.trace?.({ ev: "axis", row: id, via: moved.pointerType, axis: gesture.axis })
        }
        if (gesture.axis === "y") {
          endPointer()
          return
        }
        if (gesture.axis === "pending") return
        if (longPressTimerRef.current !== null) clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
        swallowClickRef.current = true
        try {
          row.setPointerCapture(gesture.pointerId)
        } catch {
          // Capture is optional; the document listeners are not. A
          // synthetic pointer (a play test) has no active pointer id.
        }
        beginSwipe(measured)
      }
      const displacement = clampSwipeDisplacement(
        gesture.start + swipeDisplacement(dx, gesture.direction),
        gesture.geometry,
        committableSwipeAction(latest.current.actions) !== null,
      )
      gesture.samples.push({ time: moved.timeStamp, displacement })
      if (gesture.samples.length > swipeSampleLimit) gesture.samples.shift()
      latest.current.trace?.({ ev: "f", row: id, d: Math.round(displacement) })
      showSwipe({ phase: "tracking", displacement })
    }

    const up = (released: PointerEvent) => {
      if (pointerRef.current !== gesture || released.pointerId !== gesture.pointerId) {
        return
      }
      endPointer()
      if (gesture.axis === "x") {
        release(
          gesture.geometry,
          swipeVelocity(gesture.samples, released.timeStamp),
          committableSwipeAction(latest.current.actions),
        )
      } else if (gesture.wasOpen) {
        // A tap on an open row closes it, as in Mail, rather than opening
        // the conversation underneath.
        swallowClickRef.current = true
        latest.current.onOpenChange(id, false)
      }
    }

    const cancel = (cancelled: PointerEvent) => {
      if (pointerRef.current !== gesture || cancelled.pointerId !== gesture.pointerId) {
        return
      }
      endPointer()
      if (gesture.axis !== "x") return
      // The platform took the pointer back: rest at the nearer position,
      // and never commit from a gesture that did not end by letting go.
      release(gesture.geometry, 0, null)
    }

    if (event.pointerType !== "mouse" && !open) {
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        if (pointerRef.current !== gesture || gesture.axis !== "pending") return
        // The finger is still down; the click it lifts into must not select.
        swallowClickRef.current = true
        endPointer()
        latest.current.trace?.({ ev: "longpress", row: id })
        openActionsRef.current()
      }, longPressMs)
    }

    ownerDocument.addEventListener("pointermove", move)
    ownerDocument.addEventListener("pointerup", up)
    ownerDocument.addEventListener("pointercancel", cancel)
    detachPointerRef.current = () => {
      ownerDocument.removeEventListener("pointermove", move)
      ownerDocument.removeEventListener("pointerup", up)
      ownerDocument.removeEventListener("pointercancel", cancel)
    }
  }

  /**
   * Opens the row's actions without a swipe — from the ContextMenu key,
   * Shift+F10, a right-click, or a touch long-press — and focuses the first.
   */
  const openActions = () => {
    const row = rowRef.current
    if (!row || !hasActions || pointerRef.current || wheelRef.current?.axis === "x") {
      return
    }
    if (swipeRef.current?.phase === "committing") return
    if (open) {
      // Already open, or settling open: finish there and move focus now,
      // since `open` will not change to do it.
      clearSettleTimer()
      showSwipe(null)
      trayRef.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true })
      return
    }
    focusTrayRef.current = true
    beginSwipe(measureRow(row, actions.length))
    showSwipe(null)
  }

  const openActionsRef = React.useRef(openActions)
  React.useLayoutEffect(() => {
    openActionsRef.current = openActions
  })

  /** Closes the row's actions and returns focus to the row. */
  const closeActions = () => {
    if (confirmingId !== null) onAnnounce("")
    setConfirmingId(null)
    onOpenChange(id, false)
    itemRef.current?.focus({ preventScroll: true })
  }

  const rawDisplacement = swipe
    ? swipe.displacement
    : open && hasActions && geometry
      ? geometry.openWidth
      : 0
  const displacement =
    geometry && swipe?.phase === "tracking"
      ? presentedSwipeDisplacement(rawDisplacement, geometry, reducedMotion)
      : rawDisplacement
  const tracking = swipe?.phase === "tracking"
  const committing = swipe?.phase === "committing"
  const armed =
    committing ||
    (tracking &&
      geometry !== null &&
      swipeArmed(swipe.displacement, geometry, committable !== null))
  const trayVisible = hasActions && (open || swipe !== null)
  // While confirming, the confirming action takes the tray the way the
  // primary action does when armed; the others step aside.
  const expandedId = armed ? committable : trayVisible ? confirmingId : null
  const displaced = displacement > 0
  const contentOpacity = geometry
    ? swipeContentOpacity(displacement, geometry)
    : 0
  const swipeState = swipe?.phase ?? (open ? "open" : undefined)

  return (
    <li
      ref={rowRef}
      data-slot="conversation-history-row"
      data-conversation-id={conversation.id}
      data-swipe={hasActions ? swipeState : undefined}
      data-armed={armed || undefined}
      className={cn(
        "min-w-0",
        hasActions && "relative touch-pan-y touch-pinch-zoom select-none",
        // Clip only while displaced: at rest the row's focus outline draws
        // outside its box and must not be cut.
        hasActions && displaced && "overflow-hidden",
      )}
      onPointerDown={hasActions ? onPointerDown : undefined}
      onContextMenu={
        hasActions
          ? (event) => {
              // Held on the row, not the button: the Menu key's own
              // contextmenu arrives after keyup, by which time focus is on
              // an action, and must not open the native menu over the tray.
              event.preventDefault()
              if (itemRef.current?.contains(event.target as Node)) openActions()
            }
          : undefined
      }
      onClickCapture={
        hasActions
          ? (event) => {
              if (!swallowClickRef.current) return
              swallowClickRef.current = false
              // Only the row's own click is spent on a swipe; an action
              // button pressed afterwards always runs.
              if (trayRef.current?.contains(event.target as Node)) return
              event.preventDefault()
              event.stopPropagation()
            }
          : undefined
      }
      onBlur={
        hasActions
          ? (event) => {
              // Tabbing out of an open row closes it. A blur with no
              // destination is a press on something unfocusable, which the
              // list's outside-press handling already covers.
              const next = event.relatedTarget
              if (open && next && !event.currentTarget.contains(next)) {
                closedByBlurRef.current = true
                onOpenChange(id, false)
              }
            }
          : undefined
      }
    >
      <button
        ref={itemRef}
        type="button"
        aria-current={selected ? "true" : undefined}
        aria-keyshortcuts={hasActions ? "ContextMenu Shift+F10" : undefined}
        data-slot="conversation-history-item"
        data-pinned={conversation.pinned || undefined}
        onClick={() => onSelect(conversation.id)}
        onKeyDown={
          hasActions
            ? (event) => {
                swallowClickRef.current = false
                if (
                  event.key === "ContextMenu" ||
                  (event.key === "F10" && event.shiftKey)
                ) {
                  event.preventDefault()
                  openActions()
                } else if (event.key === "Escape" && open) {
                  event.preventDefault()
                  event.stopPropagation()
                  onOpenChange(id, false)
                }
              }
            : undefined
        }
        style={
          displaced
            ? {
                translate: `${direction === "rtl" ? displacement : -displacement}px`,
              }
            : undefined
        }
        className={cn(
          "flex w-full min-w-0 items-start gap-3 rounded-xl border-0 bg-transparent px-2.5 py-2.5 text-start hover:bg-accent",
          hasActions
            ? cn("transition-[color,background-color,translate]", settleTransitionClassName)
            : "transition-colors",
          tracking && "transition-none",
          // Promote only the moving row: its avatar's filters are costly to
          // repaint every frame, and idle rows need no layer of their own.
          swipe !== null && "[will-change:translate]",
          rowFocusClassName,
          // Slid open, the row is clipped at its own edges, so its outline
          // draws inside them.
          displaced && "focus-visible:-outline-offset-2",
        )}
      >
        <RandomAvatar
          seed={conversationAvatarSeed(conversation)}
          className="mt-0.5 size-10"
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            {conversation.pinned ? (
              <>
                <Pin
                  aria-hidden="true"
                  className="size-3 shrink-0 text-muted-foreground"
                />
                <span className="sr-only">Pinned </span>
              </>
            ) : null}
            <span className="min-w-0 truncate font-sans nessa-text-4 font-semibold text-foreground">
              {conversation.title}
            </span>
          </span>
          {conversation.preview || reservePreview ? (
            <span
              aria-hidden={conversation.preview ? undefined : "true"}
              className="mt-0.5 block min-w-0 truncate font-sans nessa-text-2 text-muted-foreground"
            >
              {/* An empty line still holds its height, so every row in a
                  list is the same height whatever it has to say. */}
              {conversation.preview || "\u00a0"}
            </span>
          ) : null}
          {conversation.project || reserveProject ? (
            <span
              aria-hidden={conversation.project ? undefined : "true"}
              className="mt-0.5 block min-w-0 truncate font-sans nessa-text-1 text-muted-foreground"
            >
              {conversation.project || "\u00a0"}
            </span>
          ) : null}
        </span>
        {conversation.updated ? (
          <span className="shrink-0 pt-0.5 font-sans nessa-text-1 text-muted-foreground">
            {conversation.updated}
          </span>
        ) : null}
      </button>
      {hasActions ? (
        <div
          ref={trayRef}
          role="group"
          aria-label={`Actions for ${conversation.title}`}
          data-slot="conversation-history-row-actions"
          inert={committing || undefined}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return
            event.preventDefault()
            event.stopPropagation()
            // The first Escape backs out of a confirmation; the next closes.
            if (confirmingId !== null) {
              setConfirmingId(null)
              onAnnounce("")
            } else closeActions()
          }}
          style={{ width: displacement }}
          className={cn(
            // The clip: exactly as wide as the row has moved, with no padding
            // of its own, so a closed or barely moved row shows nothing.
            "absolute inset-y-0 end-0 overflow-hidden transition-[width]",
            settleTransitionClassName,
            tracking && "transition-none",
            !trayVisible && "invisible",
            // The committed action is already on its way; nothing in the tray
            // may run a second time while the row slides out.
            committing && "pointer-events-none",
          )}
        >
          {trayVisible ? (
            <div
              style={{ width: Math.max(displacement, geometry?.openWidth ?? 0) }}
              className={cn(
                // Laid out at full size from the row's trailing edge, so the
                // actions slide in with the row and are uncovered rather than
                // squeezed. Past the resting width they stretch with it.
                // Reversed so the primary action sits at the trailing edge,
                // where a full swipe grows it, while staying first in the tab
                // order.
                "absolute inset-y-0 start-0 flex flex-row-reverse gap-1 p-1.5 transition-[width]",
                settleTransitionClassName,
                tracking && "transition-none",
              )}
            >
              {actions.map((action) => {
                const needsConfirm = actionNeedsConfirm(action)
                const confirming = confirmingId === action.id
                const expanded = expandedId === action.id
                const collapsed = expandedId !== null && !expanded
                const confirmLabel = action.confirmLabel ?? "Confirm"
                return (
                  <button
                    key={action.id}
                    type="button"
                    data-slot="conversation-history-row-action"
                    data-tone={action.tone ?? "default"}
                    data-confirming={confirming || undefined}
                    // A collapsed action is out of sight, so it is out of
                    // reach too.
                    inert={collapsed || undefined}
                    aria-label={
                      confirming
                        ? `${confirmLabel}: ${action.label} ${conversation.title}`
                        : `${action.label} ${conversation.title}`
                    }
                    onClick={() => {
                      if (swipeRef.current?.phase === "committing") return
                      if (needsConfirm && !confirming) {
                        setConfirmingId(action.id)
                        trace?.({ ev: "confirm", row: id, action: action.id })
                        // Focus stays put and only the name changes, which
                        // screen readers do not reliably speak; say it.
                        // The button's new name, so the words stay the
                        // host's (and translatable).
                        onAnnounce(
                          `${confirmLabel}: ${action.label} ${conversation.title}`,
                        )
                        return
                      }
                      closeActions()
                      trace?.({ ev: "action", row: id, action: action.id, via: "press" })
                      onAction(id, action.id, true)
                    }}
                    className={cn(
                      // A transparent border is invisible until forced colors paint it,
                      // which is then the action's only visible edge.
                      "flex min-w-0 grow basis-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-transparent px-1 font-sans nessa-text-1 font-medium",
                      "transition-[flex-grow,opacity,background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)]",
                      action.tone === "destructive"
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "bg-primary text-primary-foreground hover:bg-primary/90",
                      // The expanded action — armed by a full swipe, or
                      // waiting to be confirmed — takes the whole tray, so
                      // what happens next is plain before it happens.
                      collapsed && "grow-0 px-0 opacity-0",
                      rowFocusClassName,
                    )}
                  >
                    <span
                      style={{ opacity: contentOpacity }}
                      className="flex min-w-0 max-w-full flex-col items-center gap-1"
                    >
                      {action.render ? (
                        action.render({
                          conversation,
                          confirming,
                          armed: armed && expanded,
                        })
                      ) : (
                        <>
                          {action.icon ? (
                            <span aria-hidden="true" className="flex shrink-0 [&_svg]:size-4">
                              {action.icon}
                            </span>
                          ) : null}
                          <span className="max-w-full truncate">
                            {confirming ? confirmLabel : action.label}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}, sameRowProps)

/**
 * A roster of conversations: an optional search field and a list of rows
 * the host already knows about. Each row leads with a RandomAvatar seeded
 * by project (or id when there is no project) so the roster reads like a
 * conversation list. The list stores nothing and sorts nothing — pass the
 * rows in the order they should appear, and apply the query before they
 * arrive. Each row is a button; the selected one is `aria-current`.
 * Opening a conversation is the host's job. Every row in a list is the same
 * height: a preview or project line any row uses is held by every row.
 *
 * **Row actions.** Give `rowActions` and rows reveal those actions the way
 * Mail does. Swiping a row toward its leading edge — a touch or pen drag, a
 * mouse drag, or a two-finger horizontal trackpad swipe — slides it and
 * uncovers the actions on the trailing edge; they ride in with the row at
 * full size and their labels fade in as they arrive. Let go past half the
 * tray and the row rests open; short of that it springs back. Swipe on past
 * at least 60% of the row (further when the tray is wide) and the primary
 * (first) action fills the tray; letting go there commits it as the row
 * slides out. A host that keeps the row sees it slide back closed. A touch
 * or pen long-press opens the actions without a swipe. One row is open at
 * a time; a press anywhere else, a scroll, or a tap on the open row closes
 * it without selecting anything, and a swipe never selects the row it
 * moves. A gesture that sets off vertically stays a scroll.
 *
 * **Confirmation.** A destructive action — or any action with `confirm` —
 * does not run on its first press: it grows to fill the tray and reads
 * "Confirm" (`confirmLabel`), and a second press runs it. Escape, closing
 * the row, or pressing elsewhere backs out. A destructive action never
 * commits from a swipe, even when it is first; it rests open instead.
 * `render` replaces an action's icon and label with the host's own content
 * while the component keeps the button, its states, and its name.
 *
 * **Keyboard.** Every action is a real button. On a focused row the
 * ContextMenu key or Shift+F10 opens its actions and focuses the first; Tab
 * moves between them and Enter or Space runs one (or asks to confirm it).
 * Escape backs out of a confirmation, then closes the actions and returns
 * focus to the row; tabbing out of the row closes them too. A right-click
 * opens them the same way. Each action is named by its label and the
 * conversation title, such as "Archive Release notes", and "Confirm: Delete
 * Release notes" while confirming. When an action removes its row and focus
 * was in that row, focus moves to the row that took its place — or to the
 * search field or empty state when none did — provided the host removes it
 * synchronously. The list's own status region speaks only its confirmation
 * prompts; a host that removes a row should say so in a live region it
 * keeps mounted.
 *
 * **Motion.** Settling runs on the motion tokens. Under reduced motion the
 * row does not slide: it jumps between closed and open as the gesture
 * crosses the same thresholds, and every action still works. A closed row
 * carries no transform.
 */
function ConversationHistory({
  conversations,
  value = null,
  onValueChange,
  query,
  onQueryChange,
  searchPlaceholder = "Search conversations",
  label = "Conversations",
  emptyMessage = "No conversations",
  rowActions,
  onRowAction,
  debug = false,
  className,
  ...props
}: ConversationHistoryProps) {
  const searchId = React.useId()
  const instanceId = React.useId()
  const reducedMotion = useReducedMotion()
  const hasRowActions = rowActions !== undefined

  // Dev-only event ring buffer. `trace` is null unless `debug`, so every
  // call site is one optional call and the production cost is nil.
  const traceBufferRef = React.useRef<TraceEntry[]>([])
  const trace = React.useMemo<Trace>(
    () =>
      debug
        ? (entry) => {
            const buffer = traceBufferRef.current
            buffer.push({ t: Math.round(performance.now()), ...entry })
            if (buffer.length > traceLimit) buffer.splice(0, buffer.length - traceLimit)
          }
        : null,
    [debug],
  )
  // Rows share one height: a line any row uses is held by every row.
  const reservePreview = conversations.some((conversation) => Boolean(conversation.preview))
  const reserveProject = conversations.some((conversation) => Boolean(conversation.project))

  const listRef = React.useRef<HTMLUListElement>(null)
  const emptyRef = React.useRef<HTMLParagraphElement>(null)
  // What the live region says; rows set it when an action asks to be
  // confirmed and clear it when that is resolved.
  const [announcement, setAnnouncement] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [openRowId, setOpenRowId] = React.useState<string | null>(null)
  const openRowIdRef = React.useRef(openRowId)
  const traceRef = React.useRef(trace)
  React.useLayoutEffect(() => {
    openRowIdRef.current = openRowId
    traceRef.current = trace
  })
  // A press that closed an open row is spent on closing it: the click it
  // produces must not select whichever row it landed on.
  const swallowClickRef = React.useRef(false)
  // Where focus was when a pressed action may remove its own row.
  const focusRescueRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!debug) return
    const host = window as unknown as {
      __nessaConversationHistory?: Record<string, unknown>
    }
    host.__nessaConversationHistory = host.__nessaConversationHistory ?? {}
    host.__nessaConversationHistory[instanceId] = {
      events: traceBufferRef.current,
      snapshot: () => ({
        openRowId: openRowIdRef.current,
        rows: Array.from(
          listRef.current?.querySelectorAll<HTMLElement>(
            "[data-slot=conversation-history-row]",
          ) ?? [],
          (row) => ({
            id: row.getAttribute("data-conversation-id"),
            swipe: row.getAttribute("data-swipe"),
            armed: row.hasAttribute("data-armed"),
            translate:
              row.querySelector<HTMLElement>("[data-slot=conversation-history-item]")
                ?.style.translate ?? "",
          }),
        ),
        focused:
          listRef.current?.ownerDocument.activeElement?.getAttribute("aria-label") ??
          null,
      }),
    }
    return () => {
      delete host.__nessaConversationHistory?.[instanceId]
    }
  }, [debug, instanceId])

  /** Makes one row the open row, or frees the slot if that row held it. */
  const setRowOpen = React.useCallback((conversationId: string, open: boolean) => {
    traceRef.current?.({ ev: "open", row: conversationId, open })
    setOpenRowId((current) =>
      open ? conversationId : current === conversationId ? null : current,
    )
  }, [])

  // Rows are memoized, so everything handed to them keeps its identity
  // across renders and reads the host's newest props through a ref. Opening
  // one row then re-renders that row and the one it closes, not the list.
  const hostRef = React.useRef({ conversations, onRowAction, onValueChange })
  React.useLayoutEffect(() => {
    hostRef.current = { conversations, onRowAction, onValueChange }
  })

  const selectRow = React.useCallback((conversationId: string) => {
    hostRef.current.onValueChange?.(conversationId)
  }, [])

  /**
   * Reports an action to the host. When focus was in the acting row, it
   * remembers where, so focus can move to the row that takes its place if
   * the host removes it.
   */
  const runRowAction = React.useCallback(
    (conversationId: string, actionId: string, hadFocus: boolean) => {
      const host = hostRef.current
      if (hadFocus) {
        focusRescueRef.current = host.conversations.findIndex(
          (conversation) => conversation.id === conversationId,
        )
      }
      host.onRowAction?.(conversationId, actionId)
    },
    [],
  )

  React.useEffect(() => {
    if (!hasRowActions) return
    const onPointerDown = (event: PointerEvent) => {
      const openId = openRowIdRef.current
      const target = event.target instanceof Node ? event.target : null
      const row =
        target instanceof Element
          ? target.closest("[data-slot=conversation-history-row]")
          : target?.parentElement?.closest("[data-slot=conversation-history-row]")
      const ownRow = row && listRef.current?.contains(row) ? row : null
      if (openId === null || ownRow?.getAttribute("data-conversation-id") === openId) {
        // The open row handles presses on itself: a tap closes it, a drag
        // moves it, and its action buttons run.
        swallowClickRef.current = false
        return
      }
      swallowClickRef.current = Boolean(target && listRef.current?.contains(target))
      traceRef.current?.({ ev: "outside", closed: openId })
      setOpenRowId(null)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [hasRowActions])

  React.useEffect(() => {
    if (
      openRowId !== null &&
      !conversations.some((conversation) => conversation.id === openRowId)
    ) {
      setOpenRowId(null)
    }
  }, [conversations, openRowId])

  // A pressed action that removed its row took focus with it; hand focus to
  // the row now in its place so the keyboard stays in the list.
  React.useLayoutEffect(() => {
    const index = focusRescueRef.current
    if (index === null) return
    focusRescueRef.current = null
    if (index < 0) return
    trace?.({ ev: "rescue", index })
    // Focus still somewhere real means the host put it there, or the row
    // was not removed; only focus that fell out of the page is rescued.
    const ownerDocument = (listRef.current ?? emptyRef.current ?? searchRef.current)
      ?.ownerDocument
    const active = ownerDocument?.activeElement
    if (!ownerDocument || (active && active !== ownerDocument.body)) return
    const list = listRef.current
    if (!list) {
      // The last row went; the search field, or else the empty state, keeps
      // focus inside the component.
      ;(searchRef.current ?? emptyRef.current)?.focus()
      return
    }
    const items = list.querySelectorAll<HTMLElement>(
      "[data-slot=conversation-history-item]",
    )
    items[Math.min(index, items.length - 1)]?.focus()
  })

  return (
    <div
      data-slot="conversation-history"
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 font-sans",
        className,
      )}
      {...props}
    >
      {onQueryChange !== undefined ? (
        <div className="relative shrink-0">
          <label htmlFor={searchId} className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query ?? ""}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 rounded-full border-border bg-muted/50 pl-9"
          />
        </div>
      ) : null}
      {conversations.length === 0 ? (
        <p
          ref={emptyRef}
          tabIndex={-1}
          className={cn(
            "m-0 rounded-xl px-1 py-6 text-center font-sans nessa-text-3 text-muted-foreground",
            // It takes focus only when the last row goes, so the keyboard
            // has somewhere visible to land.
            rowFocusClassName,
          )}
        >
          {emptyMessage}
        </p>
      ) : (
        <ul
          ref={listRef}
          data-slot="conversation-history-list"
          role="list"
          aria-label={label}
          className={cn(
            "m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // A sideways swipe that outruns a row must not become history
            // navigation.
            hasRowActions && "overscroll-x-contain",
          )}
          onScroll={
            hasRowActions
              ? () => {
                  if (openRowIdRef.current !== null) setOpenRowId(null)
                }
              : undefined
          }
          onKeyDownCapture={
            hasRowActions
              ? () => {
                  swallowClickRef.current = false
                }
              : undefined
          }
          onClickCapture={
            hasRowActions
              ? (event) => {
                  if (!swallowClickRef.current) return
                  swallowClickRef.current = false
                  event.preventDefault()
                  event.stopPropagation()
                }
              : undefined
          }
        >
          {conversations.map((conversation) => (
            <ConversationHistoryRow
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === value}
              actions={rowActions?.(conversation) ?? noActions}
              reservePreview={reservePreview}
              reserveProject={reserveProject}
              open={openRowId === conversation.id}
              reducedMotion={reducedMotion}
              onOpenChange={setRowOpen}
              onSelect={selectRow}
              onAnnounce={setAnnouncement}
              trace={trace}
              onAction={runRowAction}
            />
          ))}
        </ul>
      )}
      {hasRowActions ? (
        // Mounted with the list and empty until a row has something to say,
        // so assistive technology is already listening when it speaks.
        <span
          role="status"
          data-slot="conversation-history-status"
          className="sr-only"
        >
          {announcement}
        </span>
      ) : null}
    </div>
  )
}

export { ConversationHistory }
