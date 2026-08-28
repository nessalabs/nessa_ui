"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import { PopoverSurface } from "./popover-surface"

/** One scheduled entry shown on the calendar. */
export interface EventCalendarEvent {
  /** Stable identity used for React keys and selection callbacks. */
  id: string
  /** Title drawn inside the event chip. */
  title: string
  /** Inclusive start instant. */
  start: Date
  /** Exclusive end instant. */
  end: Date
  /**
   * Built-in semantic color treatment for the chip. Defaults to
   * `"primary"`. The tones are conveniences, not a ceiling: restyle any
   * chip with the calendar's `eventClassName` prop, or take over the
   * chip's interior entirely with `renderEvent`.
   */
  tone?: EventCalendarTone
  /**
   * Where the event happens, shown when the chip has room for it. A plain
   * string covers the simple case; pass an `EventCalendarLocation` to
   * carry structured detail such as a room. Rendered through
   * `formatEventLocation`.
   */
  location?: string | EventCalendarLocation
}

/**
 * Structured place information for an event. All-optional companions to
 * `name` let the shape grow (rooms today; addresses, links, or capacity
 * later) without breaking existing events — extend by adding fields here
 * and teaching `formatEventLocation` to render them.
 */
export interface EventCalendarLocation {
  /** Venue or place name, shown first. */
  name: string
  /** Room, floor, desk, or similar sub-location. */
  room?: string
  /** Street address or campus detail. */
  address?: string
}

/**
 * Whether an event occupies whole days: it starts and ends exactly at
 * midnight and spans at least one full day. Such events render in the
 * all-day shelf (and lead their month cell) instead of the time grid —
 * derived from the times themselves, so hosts never set a flag that could
 * disagree with them.
 */
export function isAllDayEvent(event: EventCalendarEvent) {
  return (
    minutesOfDay(event.start) === 0 &&
    minutesOfDay(event.end) === 0 &&
    event.end.getTime() > event.start.getTime()
  )
}

/**
 * Renders an event's location — plain string or structured — as one
 * display line, joining whichever structured fields are present.
 */
export function formatEventLocation(
  location: string | EventCalendarLocation | undefined,
) {
  if (!location) return null
  if (typeof location === "string") return location
  return [location.name, location.room, location.address]
    .filter(Boolean)
    .join(" · ")
}

/**
 * Built-in semantic chip treatments, each a full-strength token pairing.
 * A starting palette rather than a constraint — see
 * `EventCalendarEvent.className` and the `renderEvent` prop for anything
 * beyond them.
 */
export type EventCalendarTone =
  | "primary"
  | "secondary"
  | "muted"
  | "destructive"

/** The three Outlook-style layouts the calendar can present. */
export type EventCalendarView = "day" | "week" | "month"

/** A concrete start/end pair produced by drag or keyboard selection. */
export interface EventCalendarRange {
  start: Date
  end: Date
}

/**
 * What a host's quick-create UI receives while a selection is open: the
 * selected range plus the two ways to resolve it. `createEvent` adds an
 * event over the range (merging any partial details on top of defaults)
 * and `cancel` abandons the selection; both clear the highlight and hand
 * focus back to the day's grid.
 */
export interface EventCalendarQuickCreateContext {
  range: EventCalendarRange
  createEvent: (
    details?: Partial<Omit<EventCalendarEvent, "start" | "end">>,
  ) => void
  cancel: () => void
}

/**
 * What the `renderEvent` prop receives for each event it draws: the event,
 * which calendar surface is drawing it, and its selection state. The
 * returned nodes replace the chip's interior only — the calendar still
 * owns the chip's geometry, tone/className surface, drag, resize, focus,
 * and selection behavior.
 */
export interface EventCalendarEventRenderContext {
  event: EventCalendarEvent
  /** Which surface is drawing the event. */
  surface: "time-grid" | "all-day" | "month"
  /** Whether this event is the currently selected one. */
  selected: boolean
}

/**
 * What a host's move-confirmation UI receives while a reschedule is
 * pending: the event, its proposed new range, and the two resolutions.
 * `confirm` commits the move (firing `onEventMove`) and `cancel` keeps the
 * event where it was; both dismiss the pending state.
 */
export interface EventCalendarMoveConfirmContext {
  event: EventCalendarEvent
  range: EventCalendarRange
  confirm: () => void
  cancel: () => void
}

/** A reschedule in flight: adjusting under the keyboard, or confirming. */
interface PendingMove {
  event: EventCalendarEvent
  start: Date
  end: Date
  /**
   * `adjusting` while keyboard nudges are still repositioning the ghost;
   * `confirming` once the move awaits the confirmation UI.
   */
  stage: "adjusting" | "confirming"
}

/**
 * Every user-facing string the calendar renders or announces, so hosts
 * can localize or re-voice the whole surface. Interpolated strings are
 * functions rather than templates, keeping grammar and word order fully
 * in the host's control. Merge partial overrides over
 * `eventCalendarDefaultLabels` via the `labels` prop.
 */
export interface EventCalendarLabels {
  /** Toolbar button returning to the current date. */
  today: string
  /** Day option in the view switcher. */
  day: string
  /** Week option in the view switcher. */
  week: string
  /** Month option in the view switcher. */
  month: string
  previousDay: string
  previousWeek: string
  previousMonth: string
  nextDay: string
  nextWeek: string
  nextMonth: string
  /** Gutter label of the all-day shelf. */
  allDay: string
  /** Title given to a quick-created event with an empty title field. */
  untitledEvent: string
  /** Confirm button of the built-in dialog for a same-duration move. */
  moveAction: string
  /** Confirm button of the built-in dialog for a duration change. */
  resizeAction: string
  /** Dismiss button of the built-in confirmation dialog. */
  keepAction: string
  /** Accessible name of the built-in dialog for a move. */
  confirmMoveLabel: string
  /** Accessible name of the built-in dialog for a resize. */
  confirmResizeLabel: string
  confirmMoveTitle: (eventTitle: string) => string
  confirmResizeTitle: (eventTitle: string) => string
  /** Announcement of a day-header date button. */
  openDayView: (day: string) => string
  /** Announcement of an empty day column's selection surface. */
  daySchedule: (day: string) => string
  /** Announcement of a day column holding an active selection. */
  daySelection: (day: string, start: string, end: string) => string
  /** Announcement of a timed event chip. */
  timedEvent: (
    title: string,
    day: string,
    start: string,
    end: string,
  ) => string
  /** Announcement of an all-day event chip. */
  allDayEvent: (title: string, day: string) => string
  /** Move-shortcut hint appended to a chip's announcement. */
  eventMoveHint: (shortcuts: string) => string
  /** Resize-shortcut hint appended to a chip's announcement. */
  eventResizeHint: (shortcuts: string) => string
  /** Announcement of a month-grid day cell. */
  monthCell: (day: string, eventCount: number) => string
}

/** The out-of-the-box English strings. */
export const eventCalendarDefaultLabels: EventCalendarLabels = Object.freeze({
  today: "Today",
  day: "Day",
  week: "Week",
  month: "Month",
  previousDay: "Previous day",
  previousWeek: "Previous week",
  previousMonth: "Previous month",
  nextDay: "Next day",
  nextWeek: "Next week",
  nextMonth: "Next month",
  allDay: "All day",
  untitledEvent: "(No title)",
  moveAction: "Move",
  resizeAction: "Resize",
  keepAction: "Keep",
  confirmMoveLabel: "Confirm move",
  confirmResizeLabel: "Confirm resize",
  confirmMoveTitle: (eventTitle: string) => `Move “${eventTitle}”?`,
  confirmResizeTitle: (eventTitle: string) =>
    `Resize “${eventTitle}”?`,
  openDayView: (day: string) => `Open day view for ${day}`,
  daySchedule: (day: string) =>
    `Schedule for ${day}. Use arrow keys to choose a time, then press Enter to add an event.`,
  daySelection: (day: string, start: string, end: string) =>
    `${day}, selected ${start} to ${end}. Press Enter to add an event.`,
  timedEvent: (title: string, day: string, start: string, end: string) =>
    `${title}, ${day}, ${start} to ${end}`,
  allDayEvent: (title: string, day: string) => `${title}, all day ${day}`,
  eventMoveHint: (shortcuts: string) =>
    `Move with ${shortcuts}, then press Enter to place it.`,
  eventResizeHint: (shortcuts: string) => `Resize with ${shortcuts}.`,
  monthCell: (day: string, eventCount: number) =>
    `${day}, ${eventCount === 1 ? "1 event" : `${eventCount} events`}. Press Enter to open the day view.`,
})

/** Primary modifier choices supported by calendar keyboard shortcuts. */
export type EventCalendarShortcutModifier = "control" | "meta" | "mod"

/** Describes one exact keyboard shortcut, in the design system's shape. */
export interface EventCalendarKeyboardShortcut {
  /** KeyboardEvent key, matched without case sensitivity. */
  key: string
  /**
   * Primary modifier. `mod` accepts exactly one of Meta or Control; omit
   * for neither.
   * @defaultValue undefined
   */
  modifier?: EventCalendarShortcutModifier
  /**
   * Whether Alt must be pressed.
   * @defaultValue false
   */
  altKey?: boolean
  /**
   * Whether Shift must be pressed.
   * @defaultValue false
   */
  shiftKey?: boolean
  /**
   * Prevents the matched browser event by default. Set false to keep it.
   * @defaultValue true
   */
  preventDefault?: boolean
}

/**
 * The calendar's shortcut map. Every action ships a sensible default —
 * vim-flavored navigation, Shift+Arrow to move a focused event; hosts
 * replace any entry with their own shortcut or `false` to disable
 * it, and `shortcuts={false}` on the calendar turns the whole map off.
 */
export interface EventCalendarShortcuts {
  /** Pages to the previous day, week, or month. @defaultValue `h` */
  previousPeriod?: EventCalendarKeyboardShortcut | false
  /** Pages to the next day, week, or month. @defaultValue `l` */
  nextPeriod?: EventCalendarKeyboardShortcut | false
  /** Returns the focused date to today. @defaultValue `t` */
  today?: EventCalendarKeyboardShortcut | false
  /** Switches to the day view. @defaultValue `d` */
  dayView?: EventCalendarKeyboardShortcut | false
  /** Switches to the week view. @defaultValue `w` */
  weekView?: EventCalendarKeyboardShortcut | false
  /** Switches to the month view. @defaultValue `m` */
  monthView?: EventCalendarKeyboardShortcut | false
  /** Nudges a focused event one day earlier. @defaultValue `Shift+ArrowLeft` */
  moveEventLeft?: EventCalendarKeyboardShortcut | false
  /** Nudges a focused event one slot later. @defaultValue `Shift+ArrowDown` */
  moveEventDown?: EventCalendarKeyboardShortcut | false
  /** Nudges a focused event one slot earlier. @defaultValue `Shift+ArrowUp` */
  moveEventUp?: EventCalendarKeyboardShortcut | false
  /** Nudges a focused event one day later. @defaultValue `Shift+ArrowRight` */
  moveEventRight?: EventCalendarKeyboardShortcut | false
  /** Grows a focused event one slot longer. @defaultValue `Mod+Alt+J` */
  resizeEventLonger?: EventCalendarKeyboardShortcut | false
  /** Shrinks a focused event one slot shorter. @defaultValue `Mod+Alt+K` */
  resizeEventShorter?: EventCalendarKeyboardShortcut | false
}

type EventCalendarShortcutAction = keyof EventCalendarShortcuts

type ResolvedShortcuts = Record<
  EventCalendarShortcutAction,
  EventCalendarKeyboardShortcut | undefined
>

/**
 * The out-of-the-box keymap: vim-flavored navigation (h/l/t/d/w/m) and
 * Shift+Arrow to move a focused event — the same gesture that already
 * extends a draft selection on the empty grid, just aimed at an event
 * chip instead.
 */
const DEFAULT_SHORTCUTS: Record<
  EventCalendarShortcutAction,
  EventCalendarKeyboardShortcut
> = Object.freeze({
  previousPeriod: { key: "h" },
  nextPeriod: { key: "l" },
  today: { key: "t" },
  dayView: { key: "d" },
  weekView: { key: "w" },
  monthView: { key: "m" },
  moveEventLeft: { key: "ArrowLeft", shiftKey: true },
  moveEventDown: { key: "ArrowDown", shiftKey: true },
  moveEventUp: { key: "ArrowUp", shiftKey: true },
  moveEventRight: { key: "ArrowRight", shiftKey: true },
  resizeEventLonger: { key: "j", modifier: "mod", altKey: true },
  resizeEventShorter: { key: "k", modifier: "mod", altKey: true },
})

/**
 * Checks whether a keyboard event carries exactly the requested primary
 * modifier (Control / Meta), and no unrequested one.
 */
function matchesShortcutModifier(
  event: React.KeyboardEvent | KeyboardEvent,
  modifier: EventCalendarShortcutModifier | undefined,
) {
  switch (modifier) {
    case "mod":
      return event.metaKey !== event.ctrlKey
    case "meta":
      return event.metaKey && !event.ctrlKey
    case "control":
      return event.ctrlKey && !event.metaKey
    case undefined:
      return !event.metaKey && !event.ctrlKey
    default: {
      const exhaustiveModifier: never = modifier
      return exhaustiveModifier
    }
  }
}

/**
 * Checks whether a keyboard event's key satisfies a shortcut key. When Alt
 * is required, macOS transforms `event.key` into a special character, so
 * single alphanumeric keys also match by physical `event.code`.
 */
function matchesShortcutKey(
  event: React.KeyboardEvent | KeyboardEvent,
  key: string,
  altKeyRequired: boolean,
) {
  const normalizedKey = key.toLowerCase()
  if (event.key.toLowerCase() === normalizedKey) return true
  if (!altKeyRequired || !/^[a-z0-9]$/.test(normalizedKey)) return false
  const physicalCode = /^[0-9]$/.test(normalizedKey)
    ? `digit${normalizedKey}`
    : `key${normalizedKey}`
  return event.code.toLowerCase() === physicalCode
}

/** Checks whether a keyboard event exactly matches a shortcut descriptor. */
function matchesShortcut(
  event: React.KeyboardEvent | KeyboardEvent,
  shortcut: EventCalendarKeyboardShortcut,
) {
  return (
    matchesShortcutKey(event, shortcut.key, Boolean(shortcut.altKey)) &&
    matchesShortcutModifier(event, shortcut.modifier) &&
    event.altKey === Boolean(shortcut.altKey) &&
    event.shiftKey === Boolean(shortcut.shiftKey)
  )
}

/**
 * Checks whether a keyboard event comes from a place where the user is
 * typing text, so plain single-character shortcuts never steal keystrokes.
 */
function isEditableShortcutTarget(event: React.KeyboardEvent | KeyboardEvent) {
  const target = event.target

  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Renders a run of shortcuts as "Mod+Shift+H, J, K, L" style text. */
function shortcutRunHint(
  shortcuts: Array<EventCalendarKeyboardShortcut | undefined>,
) {
  const present = shortcuts.filter(
    (shortcut): shortcut is EventCalendarKeyboardShortcut => Boolean(shortcut),
  )
  if (!present.length) return null
  const [first, ...rest] = present
  const restKeys = rest.map((shortcut) =>
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
  )
  return [shortcutHint(first), ...restKeys].join(", ")
}

/** Composes the chip announcement's shortcut hints from the keymap. */
function chipShortcutHints(
  shortcuts: ResolvedShortcuts,
  labels: EventCalendarLabels,
) {
  const parts: string[] = []
  const moveKeys = shortcutRunHint([
    shortcuts.moveEventLeft,
    shortcuts.moveEventDown,
    shortcuts.moveEventUp,
    shortcuts.moveEventRight,
  ])
  if (moveKeys) parts.push(labels.eventMoveHint(moveKeys))
  const resizeKeys = shortcutRunHint([
    shortcuts.resizeEventLonger,
    shortcuts.resizeEventShorter,
  ])
  if (resizeKeys) parts.push(labels.eventResizeHint(resizeKeys))
  return parts.length ? ` ${parts.join(" ")}` : ""
}

/** Renders a shortcut descriptor as announcement text. */
function shortcutHint(shortcut: EventCalendarKeyboardShortcut) {
  const parts: string[] = []
  if (shortcut.modifier === "meta") parts.push("Command")
  else if (shortcut.modifier === "control") parts.push("Control")
  else if (shortcut.modifier === "mod") parts.push("Command or Control")
  if (shortcut.altKey) parts.push("Alt")
  if (shortcut.shiftKey) parts.push("Shift")
  parts.push(
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
  )
  return parts.join("+")
}

const MINUTES_PER_DAY = 24 * 60
const WEEK_LENGTH = 7
const MONTH_GRID_WEEKS = 6
/** Grid rows the quick-create card needs to stay fully visible. */
const QUICK_CREATE_CLEARANCE_PX = 176

/** Returns midnight at the start of the given date's day. */
function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

/** Returns the date shifted by whole days, preserving local time. */
function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

/** Returns the date shifted by months, clamping to the target month's end. */
function addMonths(date: Date, amount: number) {
  const year = date.getFullYear()
  const month = date.getMonth() + amount
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(date.getDate(), lastDay))
}

/** Returns midnight on the first configured weekday at or before the date. */
function startOfWeek(date: Date, weekStartsOn: number) {
  const day = startOfDay(date)
  const offset = (day.getDay() - weekStartsOn + WEEK_LENGTH) % WEEK_LENGTH
  return addDays(day, -offset)
}

/** Returns whether both dates fall on the same local calendar day. */
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Returns minutes elapsed since the date's local midnight. */
function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

/** Returns an instant on the given day at a minutes-since-midnight offset. */
function dateAtMinutes(day: Date, minutes: number) {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    minutes,
  )
}

/** Clamps a number into an inclusive range. */
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Formats a minutes-since-midnight offset as a locale time. */
function formatMinutes(locale: string | undefined, minutes: number) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(dateAtMinutes(new Date(2000, 0, 1), minutes))
}

/** Formats the short hour label drawn in the time gutter. */
function formatHour(locale: string | undefined, hour: number) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(
    new Date(2000, 0, 1, hour),
  )
}

/** Formats a day as its full weekday-and-date announcement text. */
function formatDayLong(locale: string | undefined, day: Date) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(day)
}

/**
 * Event-chip tone classes; every pairing is contrast-governed. Exported —
 * like `buttonVariants` — so hosts can reuse the tones on their own
 * surfaces (legends, filters, agenda rows).
 */
const eventCalendarToneVariants = cva("", {
  variants: {
    tone: {
      primary: "bg-primary text-primary-foreground",
      secondary: "border border-border bg-secondary text-secondary-foreground",
      muted: "border border-border bg-muted text-muted-foreground",
      destructive: "bg-destructive text-destructive-foreground",
    },
  },
  defaultVariants: {
    tone: "primary",
  },
})

/**
 * Inset focus outline shared by the calendar's custom interactive layers.
 * The grid scrolls and month cells clip, so every outline draws inward.
 */
const insetFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

/** Token-driven hover/selection transition shared by calendar surfaces. */
const surfaceTransitionClassName =
  "transition-[background-color,color,border-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"

/** A pending drag or keyboard selection on the time grid. */
interface DraftSelection {
  /** Millisecond timestamp of the selected day's midnight. */
  dayKey: number
  startMin: number
  endMin: number
  /** Whether the quick-create card is open for this selection. */
  open: boolean
}

interface EventCalendarContextValue {
  view: EventCalendarView
  setView: (view: EventCalendarView) => void
  date: Date
  setDate: (date: Date) => void
  events: EventCalendarEvent[]
  now: Date
  locale?: string
  weekStartsOn: number
  hourHeight: number
  /** First visible minute of the day grid (minHour × 60). */
  minMinute: number
  /** Last visible minute of the day grid (maxHour × 60). */
  maxMinute: number
  slotMinutes: number
  scrollToHour: number
  renderQuickCreate?: (
    context: EventCalendarQuickCreateContext,
  ) => React.ReactNode
  draft: DraftSelection | null
  setDraft: React.Dispatch<React.SetStateAction<DraftSelection | null>>
  openDraft: (draft: DraftSelection) => void
  createFromSelection: (
    details?: Partial<Omit<EventCalendarEvent, "start" | "end">>,
  ) => void
  cancelDraft: () => void
  labels: EventCalendarLabels
  shortcuts: ResolvedShortcuts
  goToPeriod: (direction: 1 | -1) => void
  /** Whether the given instant's day is rendered by the active view. */
  isDayVisible: (candidate: Date) => boolean
  requestMove: (event: EventCalendarEvent, start: Date, end: Date) => void
  adjustMove: (event: EventCalendarEvent, start: Date, end: Date) => void
  promotePendingMove: () => void
  pendingMove: PendingMove | null
  renderMoveConfirm?: (
    context: EventCalendarMoveConfirmContext,
  ) => React.ReactNode
  confirmPendingMove: () => void
  cancelPendingMove: () => void
  confirmMoves: boolean
  selectedEventId: string | null
  selectEvent: (eventId: string | null) => void
  renderEvent?: (
    context: EventCalendarEventRenderContext,
  ) => React.ReactNode
  eventClassName?: (
    context: EventCalendarEventRenderContext,
  ) => string | undefined
  onEventSelect?: (
    event: EventCalendarEvent,
    domEvent: React.MouseEvent<HTMLButtonElement>,
  ) => void
}

const EventCalendarContext =
  React.createContext<EventCalendarContextValue | null>(null)

/**
 * Reads the surrounding calendar context.
 *
 * @param consumer - Component name used in the error when rendered outside
 * an `EventCalendar`.
 */
function useEventCalendar(consumer: string) {
  const context = React.useContext(EventCalendarContext)
  if (!context) {
    throw new Error(`${consumer} must be used within an EventCalendar.`)
  }
  return context
}

export interface EventCalendarProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** Controlled event list. Omit to let the calendar own created events. */
  events?: EventCalendarEvent[]
  /** Initial events when the event list is uncontrolled. */
  defaultEvents?: EventCalendarEvent[]
  /** Fires with the next uncontrolled event list after a quick create. */
  onEventsChange?: (events: EventCalendarEvent[]) => void
  /** Controlled active view. */
  view?: EventCalendarView
  /** Initial view when uncontrolled. Defaults to `"week"`. */
  defaultView?: EventCalendarView
  onViewChange?: (view: EventCalendarView) => void
  /** Controlled focused date. */
  date?: Date
  /** Initial focused date when uncontrolled. Defaults to today. */
  defaultDate?: Date
  onDateChange?: (date: Date) => void
  /**
   * Fixed "current time" for the now indicator and Today button. Omit to
   * track the real clock with a once-a-minute refresh.
   */
  now?: Date
  /** BCP 47 locale for every formatted label. Defaults to the browser's. */
  locale?: string
  /** First weekday of week and month rows, `0` Sunday–`6`. Defaults to 1. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Rendered height of one hour row in pixels. Defaults to 56. */
  hourHeight?: number
  /**
   * First hour the day and week grids render, 0–23. Defaults to 0. Pair
   * with `maxHour` to show a host-configured window (e.g. working hours)
   * instead of the full day.
   */
  minHour?: number
  /** Hour the day and week grids render up to, 1–24. Defaults to 24. */
  maxHour?: number
  /** Selection granularity on the time grid. Defaults to 30. */
  slotMinutes?: 15 | 30 | 60
  /** Hour the time grid scrolls to when it mounts. Defaults to 8. */
  scrollToHour?: number
  /**
   * Renders the host's own quick-create UI, positioned at the completed
   * selection on the time grid. The calendar owns the gesture, placement,
   * Escape handling, and focus return; the host owns every pixel of the
   * card and resolves it through the context's `createEvent`/`cancel`.
   * Omit to render nothing — the selection then just stays highlighted
   * and `onSelectRange` is the only signal.
   */
  renderQuickCreate?: (
    context: EventCalendarQuickCreateContext,
  ) => React.ReactNode
  /** Fires when a drag or keyboard selection on the time grid completes. */
  onSelectRange?: (range: EventCalendarRange) => void
  /** Fires with the rescheduled event once a drag or keyboard move commits. */
  onEventMove?: (event: EventCalendarEvent) => void
  /**
   * Overrides for the calendar's user-facing strings, merged over
   * `eventCalendarDefaultLabels` — the localization and voice hook for
   * every rendered and announced string.
   */
  labels?: Partial<EventCalendarLabels>
  /**
   * The calendar's keyboard shortcuts. Merged over the defaults (`h`/`l`
   * page, `t` today, `d`/`w`/`m` switch views, `Shift+ArrowLeft/Down/Up/Right`
   * move a focused event) — override any action with
   * a different shortcut, disable one with `false`, or pass `false` for
   * the whole prop to turn every shortcut off.
   */
  shortcuts?: EventCalendarShortcuts | false
  /**
   * Whether finishing a drag or keyboard move asks for confirmation
   * before committing. Defaults to true, showing the built-in dialog at
   * the proposed drop; disable to commit every move immediately.
   */
  confirmMoves?: boolean
  /**
   * Replaces the built-in move-confirmation dialog with the host's own
   * UI, positioned at the proposed drop. While it is open the move is
   * only pending, and the context's `confirm`/`cancel` commit or abandon
   * it. Only consulted while `confirmMoves` is enabled.
   */
  renderMoveConfirm?: (
    context: EventCalendarMoveConfirmContext,
  ) => React.ReactNode
  /** Fires with each event added through a quick-create `createEvent`. */
  onCreateEvent?: (event: EventCalendarEvent) => void
  /**
   * Replaces every event chip's interior with the host's own rendering —
   * status dots, avatars, badges, whatever the product needs — while the
   * calendar keeps the chip geometry and interactions. Keep the returned
   * content non-interactive: the chip itself is already a button. Omit to
   * use the built-in title-and-time interior.
   */
  renderEvent?: (
    context: EventCalendarEventRenderContext,
  ) => React.ReactNode
  /**
   * Computes extra classes for an event's chip from the event and its
   * render context, merged after the tone classes so they win conflicts.
   * Styling policy stays with the calendar usage — events remain plain
   * serializable data — and applies on every surface, the drag ghost
   * included.
   */
  eventClassName?: (
    context: EventCalendarEventRenderContext,
  ) => string | undefined
  /** Controlled id of the visually selected event, or null for none. */
  selectedEventId?: string | null
  /** Initial selected event when uncontrolled. */
  defaultSelectedEventId?: string | null
  /** Fires with the newly selected event id, or null when cleared. */
  onSelectedEventChange?: (eventId: string | null) => void
  /** Fires when an event chip is activated in any view. */
  onEventSelect?: (
    event: EventCalendarEvent,
    domEvent: React.MouseEvent<HTMLButtonElement>,
  ) => void
}

/** Produces a collision-safe identity for a quick-created event. */
function createEventId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `event-${uuid ?? Math.random().toString(36).slice(2)}`
}

/**
 * An Outlook-style scheduling surface with day, week, and month views.
 * Hosts stack an `EventCalendarToolbar` (Today, paging, range label, view
 * switcher) above an `EventCalendarGrid`. On the day and week time grids,
 * dragging across empty slots — or arrowing from the keyboard and pressing
 * Enter — selects a range and opens the host's own quick-create UI at the
 * selection via `renderQuickCreate`, and existing events reschedule by
 * pointer drag, edge-drag resizing, or the configured keyboard chords —
 * gated by default behind a built-in confirmation dialog that hosts can
 * replace with `renderMoveConfirm` or disable with `confirmMoves`; every
 * step is mirrored
 * through `onSelectRange`, `onCreateEvent`, and `onEventMove` so hosts own
 * their scheduling flows end to end.
 */
function EventCalendar({
  className,
  children,
  events: eventsProp,
  defaultEvents,
  onEventsChange,
  view: viewProp,
  defaultView = "week",
  onViewChange,
  date: dateProp,
  defaultDate,
  onDateChange,
  now: nowProp,
  locale,
  weekStartsOn = 1,
  hourHeight = 56,
  minHour = 0,
  maxHour = 24,
  slotMinutes = 30,
  scrollToHour = 8,
  renderQuickCreate,
  labels: labelsProp,
  shortcuts: shortcutsProp,
  confirmMoves = true,
  renderMoveConfirm,
  renderEvent,
  eventClassName,
  onKeyDown,
  onSelectRange,
  onEventMove,
  onCreateEvent,
  selectedEventId: selectedEventIdProp,
  defaultSelectedEventId = null,
  onSelectedEventChange,
  onEventSelect,
  ...props
}: EventCalendarProps) {
  const [uncontrolledEvents, setUncontrolledEvents] = React.useState(
    () => defaultEvents ?? [],
  )
  const [uncontrolledView, setUncontrolledView] = React.useState(defaultView)
  const [uncontrolledDate, setUncontrolledDate] = React.useState(
    () => defaultDate ?? new Date(),
  )
  const [clock, setClock] = React.useState(() => nowProp ?? new Date())
  const [draft, setDraft] = React.useState<DraftSelection | null>(null)
  const [pendingMove, setPendingMove] = React.useState<PendingMove | null>(
    null,
  )
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = React.useState(
    defaultSelectedEventId,
  )

  const events = eventsProp ?? uncontrolledEvents

  const labels = React.useMemo<EventCalendarLabels>(
    () => ({ ...eventCalendarDefaultLabels, ...labelsProp }),
    [labelsProp],
  )
  const view = viewProp ?? uncontrolledView
  const date = dateProp ?? uncontrolledDate
  const now = nowProp ?? clock

  React.useEffect(() => {
    if (nowProp) return
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [nowProp])

  const setView = React.useCallback(
    (next: EventCalendarView) => {
      setDraft(null)
      setPendingMove(null)
      setUncontrolledView(next)
      onViewChange?.(next)
    },
    [onViewChange],
  )

  const setDate = React.useCallback(
    (next: Date) => {
      setDraft(null)
      setPendingMove(null)
      setUncontrolledDate(next)
      onDateChange?.(next)
    },
    [onDateChange],
  )

  const openDraft = React.useCallback(
    (next: DraftSelection) => {
      setDraft({ ...next, open: true })
      onSelectRange?.({
        start: dateAtMinutes(new Date(next.dayKey), next.startMin),
        end: dateAtMinutes(new Date(next.dayKey), next.endMin),
      })
    },
    [onSelectRange],
  )

  const createFromSelection = React.useCallback(
    (details?: Partial<Omit<EventCalendarEvent, "start" | "end">>) => {
      if (!draft) return
      const event: EventCalendarEvent = {
        tone: "primary",
        ...details,
        id: details?.id ?? createEventId(),
        title: details?.title?.trim() || labels.untitledEvent,
        start: dateAtMinutes(new Date(draft.dayKey), draft.startMin),
        end: dateAtMinutes(new Date(draft.dayKey), draft.endMin),
      }
      onCreateEvent?.(event)
      if (!eventsProp) {
        const next = [...uncontrolledEvents, event]
        setUncontrolledEvents(next)
        onEventsChange?.(next)
      }
      setDraft(null)
    },
    [
      draft,
      eventsProp,
      uncontrolledEvents,
      labels,
      onCreateEvent,
      onEventsChange,
    ],
  )

  const cancelDraft = React.useCallback(() => setDraft(null), [])

  // A hosted "visible hours" window, sanitized so the grid always spans
  // at least one hour and stays inside the day.
  const minMinute = clamp(Math.floor(minHour), 0, 23) * 60
  const maxMinute = clamp(Math.ceil(maxHour), minMinute / 60 + 1, 24) * 60

  const resolvedShortcuts = React.useMemo<ResolvedShortcuts>(() => {
    const actions = Object.keys(
      DEFAULT_SHORTCUTS,
    ) as EventCalendarShortcutAction[]
    return Object.fromEntries(
      actions.map((action) => {
        const override =
          shortcutsProp === false ? false : shortcutsProp?.[action]
        return [
          action,
          override === false
            ? undefined
            : (override ?? DEFAULT_SHORTCUTS[action]),
        ]
      }),
    ) as ResolvedShortcuts
  }, [shortcutsProp])

  const goToPeriod = React.useCallback(
    (direction: 1 | -1) => {
      if (view === "day") setDate(addDays(date, direction))
      else if (view === "week") setDate(addDays(date, WEEK_LENGTH * direction))
      else setDate(addMonths(date, direction))
    },
    [view, date, setDate],
  )

  const isDayVisible = React.useCallback(
    (candidate: Date) => {
      if (view === "day") return isSameDay(candidate, date)
      if (view === "week") {
        const first = startOfWeek(date, weekStartsOn)
        const day = startOfDay(candidate)
        return day >= first && day < addDays(first, WEEK_LENGTH)
      }
      return false
    },
    [view, date, weekStartsOn],
  )

  const commitMove = React.useCallback(
    (event: EventCalendarEvent, start: Date, end: Date) => {
      const moved = { ...event, start, end }
      onEventMove?.(moved)
      if (!eventsProp) {
        const next = uncontrolledEvents.map((existing) =>
          existing.id === event.id ? moved : existing,
        )
        setUncontrolledEvents(next)
        onEventsChange?.(next)
      }
    },
    [eventsProp, uncontrolledEvents, onEventMove, onEventsChange],
  )

  const requestMove = React.useCallback(
    (event: EventCalendarEvent, start: Date, end: Date) => {
      if (
        start.getTime() === event.start.getTime() &&
        end.getTime() === event.end.getTime()
      ) {
        return
      }
      if (confirmMoves) {
        setPendingMove({ event, start, end, stage: "confirming" })
      } else {
        commitMove(event, start, end)
      }
    },
    [confirmMoves, commitMove],
  )

  const adjustMove = React.useCallback(
    (event: EventCalendarEvent, start: Date, end: Date) => {
      setPendingMove({ event, start, end, stage: "adjusting" })
    },
    [],
  )

  const promotePendingMove = React.useCallback(() => {
    if (!pendingMove) return
    // A nudge sequence that netted to zero has nothing to place: resolve
    // silently rather than raising a dialog or committing a no-op.
    if (
      pendingMove.start.getTime() === pendingMove.event.start.getTime() &&
      pendingMove.end.getTime() === pendingMove.event.end.getTime()
    ) {
      setPendingMove(null)
      return
    }
    if (confirmMoves) {
      setPendingMove({ ...pendingMove, stage: "confirming" })
    } else {
      commitMove(pendingMove.event, pendingMove.start, pendingMove.end)
      setPendingMove(null)
    }
  }, [pendingMove, confirmMoves, commitMove])

  const confirmPendingMove = React.useCallback(() => {
    if (pendingMove) {
      commitMove(pendingMove.event, pendingMove.start, pendingMove.end)
    }
    setPendingMove(null)
  }, [pendingMove, commitMove])

  const cancelPendingMove = React.useCallback(() => setPendingMove(null), [])

  // A pending move must track the live event record: if the host removes
  // the event mid-confirmation the move is abandoned, and if the host
  // edits it the dialog and commit carry the current fields.
  React.useEffect(() => {
    if (!pendingMove) return
    const current = events.find(
      (candidate) => candidate.id === pendingMove.event.id,
    )
    if (!current) {
      setPendingMove(null)
    } else if (current !== pendingMove.event) {
      setPendingMove({ ...pendingMove, event: current })
    }
  }, [events, pendingMove])

  const selectedEventId = selectedEventIdProp ?? uncontrolledSelectedId

  const selectEvent = React.useCallback(
    (eventId: string | null) => {
      if (eventId === selectedEventId) return
      setUncontrolledSelectedId(eventId)
      onSelectedEventChange?.(eventId)
    },
    [selectedEventId, onSelectedEventChange],
  )

  const contextValue = React.useMemo<EventCalendarContextValue>(
    () => ({
      view,
      setView,
      date,
      setDate,
      events,
      now,
      locale,
      weekStartsOn,
      hourHeight,
      minMinute,
      maxMinute,
      slotMinutes,
      scrollToHour,
      labels,
      renderQuickCreate,
      draft,
      setDraft,
      openDraft,
      createFromSelection,
      cancelDraft,
      shortcuts: resolvedShortcuts,
      goToPeriod,
      isDayVisible,
      requestMove,
      adjustMove,
      promotePendingMove,
      pendingMove,
      renderMoveConfirm,
      confirmPendingMove,
      cancelPendingMove,
      confirmMoves,
      selectedEventId,
      selectEvent,
      renderEvent,
      eventClassName,
      onEventSelect,
    }),
    [
      view,
      setView,
      date,
      setDate,
      events,
      now,
      locale,
      weekStartsOn,
      hourHeight,
      minMinute,
      maxMinute,
      slotMinutes,
      scrollToHour,
      labels,
      renderQuickCreate,
      draft,
      openDraft,
      createFromSelection,
      cancelDraft,
      resolvedShortcuts,
      goToPeriod,
      isDayVisible,
      requestMove,
      adjustMove,
      promotePendingMove,
      pendingMove,
      renderMoveConfirm,
      confirmPendingMove,
      cancelPendingMove,
      confirmMoves,
      selectedEventId,
      selectEvent,
      renderEvent,
      eventClassName,
      onEventSelect,
    ],
  )

  /**
   * Runs the calendar-level navigation shortcuts for keystrokes anywhere
   * inside the calendar, skipping text fields and already-claimed events.
   */
  const handleShortcutKeyDown = (
    keyEvent: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    onKeyDown?.(keyEvent)
    if (
      keyEvent.defaultPrevented ||
      keyEvent.repeat ||
      keyEvent.nativeEvent.isComposing
    ) {
      return
    }
    const actions: Array<
      [EventCalendarKeyboardShortcut | undefined, () => void]
    > = [
      [resolvedShortcuts.previousPeriod, () => goToPeriod(-1)],
      [resolvedShortcuts.nextPeriod, () => goToPeriod(1)],
      [resolvedShortcuts.today, () => setDate(now)],
      [resolvedShortcuts.dayView, () => setView("day")],
      [resolvedShortcuts.weekView, () => setView("week")],
      [resolvedShortcuts.monthView, () => setView("month")],
    ]
    for (const [shortcut, run] of actions) {
      if (!shortcut) continue
      if (
        shortcut.modifier === undefined &&
        shortcut.key.length === 1 &&
        isEditableShortcutTarget(keyEvent)
      ) {
        continue
      }
      if (matchesShortcut(keyEvent, shortcut)) {
        if (shortcut.preventDefault !== false) keyEvent.preventDefault()
        run()
        return
      }
    }
  }

  return (
    <EventCalendarContext.Provider value={contextValue}>
      <div
        data-slot="event-calendar"
        data-view={view}
        onKeyDown={handleShortcutKeyDown}
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background font-sans text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </EventCalendarContext.Provider>
  )
}

export interface EventCalendarToolbarProps
  extends React.ComponentProps<"div"> {}

/** Formats the toolbar's heading for the active view and focused date. */
function formatRangeLabel(
  locale: string | undefined,
  view: EventCalendarView,
  date: Date,
  weekStartsOn: number,
) {
  if (view === "day") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }
  if (view === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(date)
  }
  const first = startOfWeek(date, weekStartsOn)
  const last = addDays(first, WEEK_LENGTH - 1)
  const sameMonth =
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear()
  const startFormat = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  })
  const endFormat = sameMonth
    ? new Intl.DateTimeFormat(locale, { day: "numeric" })
    : startFormat
  const yearFormat = new Intl.DateTimeFormat(locale, { year: "numeric" })
  return `${startFormat.format(first)} – ${endFormat.format(last)}, ${yearFormat.format(last)}`
}

/**
 * The calendar's command row: a Today button, previous/next paging that
 * steps by the active view's span, a live range heading, and a Day/Week/
 * Month switcher. Extra children render after the switcher for host
 * actions such as filters or a share menu.
 */
function EventCalendarToolbar({
  className,
  children,
  ...props
}: EventCalendarToolbarProps) {
  const {
    view,
    setView,
    date,
    setDate,
    now,
    locale,
    weekStartsOn,
    goToPeriod,
    labels,
  } = useEventCalendar("EventCalendarToolbar")

  const pagingLabels =
    view === "month"
      ? { previous: labels.previousMonth, next: labels.nextMonth }
      : view === "week"
        ? { previous: labels.previousWeek, next: labels.nextWeek }
        : { previous: labels.previousDay, next: labels.nextDay }

  return (
    <div
      data-slot="event-calendar-toolbar"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2",
        className,
      )}
      {...props}
    >
      <Button variant="outline" size="sm" onClick={() => setDate(now)}>
        {labels.today}
      </Button>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={pagingLabels.previous}
          title={pagingLabels.previous}
          onClick={() => goToPeriod(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={pagingLabels.next}
          title={pagingLabels.next}
          onClick={() => goToPeriod(1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <p
        data-slot="event-calendar-range-label"
        aria-live="polite"
        className="ms-1 truncate nessa-text-4 font-semibold"
      >
        {formatRangeLabel(locale, view, date, weekStartsOn)}
      </p>
      <div
        data-slot="event-calendar-view-switcher"
        className="ms-auto flex items-center gap-0.5 rounded-lg border border-border p-0.5"
      >
        {(["day", "week", "month"] as const).map((candidate) => (
          <Button
            key={candidate}
            variant={view === candidate ? "secondary" : "ghost"}
            size="sm"
            className="h-7"
            aria-pressed={view === candidate}
            onClick={() => setView(candidate)}
          >
            {labels[candidate]}
          </Button>
        ))}
      </div>
      {children}
    </div>
  )
}

/** One timed event mapped into a single day column. */
interface TimedSegment {
  event: EventCalendarEvent
  startMin: number
  endMin: number
}

/** A timed segment placed into an overlap column. */
interface PositionedSegment extends TimedSegment {
  column: number
}

/**
 * Packs a day's timed segments into side-by-side columns, Outlook style:
 * transitively overlapping segments form a cluster, each takes the first
 * free column, and every member of the cluster shares the cluster's width.
 */
function layoutTimedSegments(segments: TimedSegment[]): PositionedSegment[] {
  const sorted = [...segments].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin,
  )
  const placed: PositionedSegment[] = []
  let cluster: TimedSegment[] = []
  let clusterEnd = 0

  const flush = () => {
    if (!cluster.length) return
    const columnEnds: number[] = []
    for (const segment of cluster) {
      let column = columnEnds.findIndex((end) => end <= segment.startMin)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(0)
      }
      columnEnds[column] = segment.endMin
      placed.push({ ...segment, column })
    }
    cluster = []
  }

  for (const segment of sorted) {
    if (cluster.length && segment.startMin >= clusterEnd) flush()
    cluster.push(segment)
    clusterEnd = cluster.length === 1 ? segment.endMin : Math.max(clusterEnd, segment.endMin)
  }
  flush()
  return placed
}

/**
 * Maps the timed events overlapping one day into clamped segments. Bounds
 * and offsets are wall-clock so chips stay aligned with the hour gutter
 * even on daylight-saving transition days.
 */
function timedSegmentsFor(events: EventCalendarEvent[], day: Date) {
  const dayStart = startOfDay(day)
  const dayEnd = startOfDay(addDays(day, 1))
  const segments: TimedSegment[] = []
  for (const event of events) {
    if (isAllDayEvent(event)) continue
    if (event.start >= dayEnd || event.end <= dayStart) continue
    const startMin = event.start < dayStart ? 0 : minutesOfDay(event.start)
    const endMin =
      event.end >= dayEnd ? MINUTES_PER_DAY : minutesOfDay(event.end)
    segments.push({
      event,
      startMin,
      endMin: Math.max(endMin, startMin + 15),
    })
  }
  return segments
}

/** Returns the all-day events overlapping one day, ordered by start. */
function allDayEventsFor(events: EventCalendarEvent[], day: Date) {
  const dayStart = startOfDay(day)
  const dayEnd = startOfDay(addDays(day, 1))
  return events
    .filter(
      (event) =>
        isAllDayEvent(event) && event.start < dayEnd && event.end > dayStart,
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Formats an event's accessible announcement for chips in the grid. */
function eventLabel(
  locale: string | undefined,
  labels: EventCalendarLabels,
  event: EventCalendarEvent,
) {
  if (isAllDayEvent(event)) {
    return labels.allDayEvent(event.title, formatDayLong(locale, event.start))
  }
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  })
  return labels.timedEvent(
    event.title,
    formatDayLong(locale, event.start),
    timeFormat.format(event.start),
    timeFormat.format(event.end),
  )
}

/** Horizontal cascade step, in percent, for each conflicting event. */
const CASCADE_STEP_PERCENT = 14
/** Largest cascade indent so deep stacks keep a readable chip width. */
const CASCADE_MAX_PERCENT = 56

/**
 * A pressable event chip absolutely positioned on the time grid.
 * Conflicting events stack Outlook-style: each later event indents by a
 * cascade step and layers above the earlier ones, separated by a hairline
 * ring. Chips reschedule by pointer drag or the configured move chords,
 * and unclipped top and bottom edges drag to resize the event's duration;
 * both resolve through the same confirmation branch as moves.
 */
function TimedEventChip({
  segment,
  day,
  moving,
  onBeginDrag,
  suppressClickRef,
}: {
  segment: PositionedSegment
  day: Date
  moving: boolean
  onBeginDrag: (
    kind: "move" | "resize-start" | "resize-end",
    pointerEvent: React.PointerEvent<Element>,
    segment: PositionedSegment,
  ) => void
  suppressClickRef: React.RefObject<boolean>
}) {
  const {
    hourHeight,
    slotMinutes,
    minMinute,
    maxMinute,
    locale,
    labels,
    onEventSelect,
    shortcuts,
    isDayVisible,
    pendingMove,
    adjustMove,
    promotePendingMove,
    cancelPendingMove,
    confirmMoves,
    selectedEventId,
    selectEvent,
    renderEvent,
    eventClassName,
  } = useEventCalendar("EventCalendarGrid")
  const { event } = segment
  const top = ((segment.startMin - minMinute) / 60) * hourHeight
  const height = ((segment.endMin - segment.startMin) / 60) * hourHeight
  const tone = event.tone ?? "primary"
  const showsTime = height >= 44
  const cascade = Math.min(
    segment.column * CASCADE_STEP_PERCENT,
    CASCADE_MAX_PERCENT,
  )

  const chipPending =
    pendingMove?.event.id === event.id ? pendingMove : null
  const selected = selectedEventId === event.id
  // Boundary handles only where the chip shows the event's real edge —
  // an edge clipped by another day or the visible-hours window can't be
  // dragged from here.
  const startResizable =
    isSameDay(event.start, day) && event.start >= dateAtMinutes(day, minMinute)
  const endResizable = event.end <= dateAtMinutes(day, maxMinute)

  const beginResize = (
    kind: "resize-start" | "resize-end",
    pointerEvent: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (pointerEvent.button !== 0) return
    if (pointerEvent.pointerType === "touch") return
    pointerEvent.stopPropagation()
    try {
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
    } catch {
      // Synthetic pointer events in tests carry untracked pointer ids.
    }
    onBeginDrag(kind, pointerEvent, segment)
  }

  /** Refocuses this event's chip after a commit remounts it elsewhere. */
  const refocusChip = (currentTarget: HTMLElement) => {
    const grid = currentTarget.closest(
      '[data-slot="event-calendar-time-scroll"]',
    )
    window.setTimeout(() => {
      grid
        ?.querySelector<HTMLElement>(
          `[data-event-id="${CSS.escape(event.id)}"]`,
        )
        ?.focus()
    }, 0)
  }

  const handleKeyDown = (
    keyEvent: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const base = chipPending ?? { start: event.start, end: event.end }
    const durationMs = base.end.getTime() - base.start.getTime()

    const nudges: Array<
      [EventCalendarKeyboardShortcut | undefined, number, number]
    > = [
      [shortcuts.moveEventDown, slotMinutes, 0],
      [shortcuts.moveEventUp, -slotMinutes, 0],
      [shortcuts.moveEventRight, 0, 1],
      [shortcuts.moveEventLeft, 0, -1],
    ]
    for (const [shortcut, minuteDelta, dayDelta] of nudges) {
      if (!shortcut || !matchesShortcut(keyEvent, shortcut)) continue
      if (shortcut.preventDefault !== false) keyEvent.preventDefault()
      keyEvent.stopPropagation()
      let start: Date
      if (minuteDelta !== 0) {
        const startMinutes = minutesOfDay(base.start) + minuteDelta
        if (startMinutes < minMinute || startMinutes >= maxMinute) return
        // A nudge can never newly push the tail past maxHour or midnight,
        // but an event whose tail is already clipped (overnight, or longer
        // than the visible window) keeps nudging by its visible part —
        // matching what the pointer path allows.
        const visibleDurationMin = Math.min(
          durationMs / 60_000,
          maxMinute - minMinute,
        )
        const tailLimit = maxMinute - visibleDurationMin
        const alreadyClipped = minutesOfDay(base.start) > tailLimit
        if (!alreadyClipped && startMinutes > tailLimit) return
        start = new Date(base.start)
        start.setMinutes(start.getMinutes() + minuteDelta)
      } else {
        start = addDays(base.start, dayDelta)
        // A day nudge only lands where a column exists to show the ghost
        // and host the confirmation dialog.
        if (!isDayVisible(start)) return
      }
      // Nudges only reposition the pending ghost; the move is placed —
      // and, when confirmation is on, questioned — once, on Enter.
      adjustMove(event, start, new Date(start.getTime() + durationMs))
      return
    }

    const resizes: Array<[EventCalendarKeyboardShortcut | undefined, number]> =
      [
        [shortcuts.resizeEventLonger, slotMinutes],
        [shortcuts.resizeEventShorter, -slotMinutes],
      ]
    for (const [shortcut, endDelta] of resizes) {
      if (!shortcut || !matchesShortcut(keyEvent, shortcut)) continue
      if (shortcut.preventDefault !== false) keyEvent.preventDefault()
      keyEvent.stopPropagation()
      // Keyboard resizing moves the end boundary within the start's own
      // day; multi-day events keep their pointer-only resize handles.
      const nextMidnight = startOfDay(addDays(base.start, 1))
      if (base.end > nextMidnight) return
      const endMin =
        base.end.getTime() === nextMidnight.getTime()
          ? MINUTES_PER_DAY
          : minutesOfDay(base.end)
      const nextEndMin = endMin + endDelta
      if (
        nextEndMin < minutesOfDay(base.start) + slotMinutes ||
        nextEndMin > maxMinute
      ) {
        return
      }
      adjustMove(event, base.start, dateAtMinutes(base.start, nextEndMin))
      return
    }

    if (!chipPending) return
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault()
      keyEvent.stopPropagation()
      promotePendingMove()
      // With confirmation on, the dialog takes focus (Enter again commits
      // via its focused Move button); without it the commit remounts the
      // chip, which needs its focus restored.
      if (!confirmMoves) refocusChip(keyEvent.currentTarget)
    } else if (keyEvent.key === "Escape") {
      keyEvent.stopPropagation()
      cancelPendingMove()
    }
  }

  return (
    <button
      type="button"
      data-slot="event-calendar-event"
      data-event-id={event.id}
      data-tone={tone}
      data-moving={moving || undefined}
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={`${eventLabel(locale, labels, event)}.${chipShortcutHints(shortcuts, labels)}`}
      className={cn(
        "absolute flex cursor-grab flex-col items-start gap-0 overflow-hidden rounded-md px-2 py-0.5 text-start nessa-text-2 font-medium shadow-xs ring-1 ring-background",
        eventCalendarToneVariants({ tone }),
        surfaceTransitionClassName,
        insetFocusClassName,
        eventClassName?.({ event, surface: "time-grid", selected }),
        moving && "opacity-40",
        selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
      )}
      style={{
        top,
        height: Math.max(height - 2, 20),
        left: `calc(${cascade}% + 2px)`,
        width: `calc(${100 - cascade}% - 4px)`,
        zIndex: 30 + Math.min(segment.column, 15),
      }}
      onPointerDown={(pointerEvent) => {
        if (pointerEvent.button !== 0) return
        if (pointerEvent.pointerType === "touch") return
        try {
          pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
        } catch {
          // Synthetic pointer events in tests carry untracked pointer ids.
        }
        onBeginDrag("move", pointerEvent, segment)
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (chipPending?.stage === "adjusting") cancelPendingMove()
      }}
      onClick={(domEvent) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        selectEvent(event.id)
        onEventSelect?.(event, domEvent)
      }}
    >
      {renderEvent?.({ event, surface: "time-grid", selected }) ?? (
        <>
          <span className="w-full truncate">{event.title}</span>
          {showsTime ? (
            <span className="w-full truncate font-normal">
              {formatMinutes(locale, segment.startMin)} –{" "}
              {formatMinutes(locale, segment.endMin)}
              {event.location
                ? ` · ${formatEventLocation(event.location)}`
                : null}
            </span>
          ) : null}
        </>
      )}
      {startResizable ? (
        <div
          aria-hidden="true"
          data-slot="event-calendar-event-resize-start"
          className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
          onPointerDown={(pointerEvent) =>
            beginResize("resize-start", pointerEvent)
          }
        />
      ) : null}
      {endResizable ? (
        <div
          aria-hidden="true"
          data-slot="event-calendar-event-resize-end"
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
          onPointerDown={(pointerEvent) =>
            beginResize("resize-end", pointerEvent)
          }
        />
      ) : null}
    </button>
  )
}

/**
 * The built-in move-confirmation dialog: a compact popover-surface card
 * naming the event and its proposed range, with a focused Move button and
 * a Keep escape hatch. Hosts replace it wholesale via `renderMoveConfirm`.
 */
function DefaultMoveConfirm({
  context,
}: {
  context: EventCalendarMoveConfirmContext
}) {
  const { locale, labels } = useEventCalendar("EventCalendarGrid")
  const confirmRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  })
  const durationChanged =
    context.range.end.getTime() - context.range.start.getTime() !==
    context.event.end.getTime() - context.event.start.getTime()

  return (
    <PopoverSurface
      role="dialog"
      aria-label={
        durationChanged ? labels.confirmResizeLabel : labels.confirmMoveLabel
      }
      data-slot="event-calendar-move-confirm-card"
      radius="lg"
      className="flex w-64 flex-col gap-2 p-3"
    >
      <p className="nessa-text-2 font-medium">
        {durationChanged
          ? labels.confirmResizeTitle(context.event.title)
          : labels.confirmMoveTitle(context.event.title)}
      </p>
      <p className="nessa-text-2 text-muted-foreground">
        {formatDayLong(locale, context.range.start)},{" "}
        {timeFormat.format(context.range.start)} –{" "}
        {timeFormat.format(context.range.end)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          ref={confirmRef}
          size="sm"
          className="h-7"
          onClick={context.confirm}
        >
          {durationChanged ? labels.resizeAction : labels.moveAction}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={context.cancel}
        >
          {labels.keepAction}
        </Button>
      </div>
    </PopoverSurface>
  )
}

/**
 * Positions the host's quick-create UI at the open selection. The wrapper
 * owns only geometry and dismissal — top offset clamped into the visible
 * window, side choice away from the grid edge, Escape to cancel — while
 * the rendered content comes entirely from `renderQuickCreate`.
 */
function QuickCreateSlot({
  day,
  columnIndex,
  columnCount,
  returnFocus,
}: {
  day: Date
  columnIndex: number
  columnCount: number
  returnFocus: () => void
}) {
  const {
    draft,
    renderQuickCreate,
    createFromSelection,
    cancelDraft,
    hourHeight,
    minMinute,
    maxMinute,
  } = useEventCalendar("EventCalendarGrid")

  if (!draft || !renderQuickCreate) return null

  const gridHeight = ((maxMinute - minMinute) / 60) * hourHeight
  const top = clamp(
    ((draft.startMin - minMinute) / 60) * hourHeight,
    0,
    Math.max(gridHeight - QUICK_CREATE_CLEARANCE_PX, 0),
  )
  const context: EventCalendarQuickCreateContext = {
    range: {
      start: dateAtMinutes(day, draft.startMin),
      end: dateAtMinutes(day, draft.endMin),
    },
    createEvent: (details) => {
      createFromSelection(details)
      returnFocus()
    },
    cancel: () => {
      cancelDraft()
      returnFocus()
    },
  }

  return (
    <div
      data-slot="event-calendar-quick-create"
      className={cn(
        "absolute z-50 w-max max-w-72",
        columnIndex >= columnCount / 2 ? "right-1" : "left-1",
      )}
      style={{ top }}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Escape") {
          keyEvent.stopPropagation()
          context.cancel()
        }
      }}
    >
      {renderQuickCreate(context)}
    </div>
  )
}

/**
 * One day column of the time grid: hour lines behind a full-height
 * selection surface, with event chips, the selection highlight, the now
 * line, and the quick-create card layered above it as siblings so no
 * interactive element nests inside another.
 */
function TimeDayColumn({
  day,
  columnIndex,
  columnCount,
  focused,
  onFocusColumn,
  onArrowDay,
  onBeginEventDrag,
  movingEventId,
  movePreview,
  suppressClickRef,
}: {
  day: Date
  columnIndex: number
  columnCount: number
  focused: boolean
  onFocusColumn: (index: number) => void
  onArrowDay: (from: number, direction: 1 | -1) => void
  onBeginEventDrag: (
    kind: "move" | "resize-start" | "resize-end",
    pointerEvent: React.PointerEvent<Element>,
    segment: PositionedSegment,
    dayIndex: number,
  ) => void
  movingEventId: string | null
  movePreview: TimedSegment | null
  suppressClickRef: React.RefObject<boolean>
}) {
  const {
    events,
    now,
    locale,
    labels,
    hourHeight,
    minMinute,
    maxMinute,
    slotMinutes,
    draft,
    setDraft,
    openDraft,
    cancelDraft,
    pendingMove,
    renderMoveConfirm,
    confirmPendingMove,
    cancelPendingMove,
    selectedEventId,
    selectEvent,
    eventClassName,
  } = useEventCalendar("EventCalendarGrid")
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const dragAnchorRef = React.useRef<number | null>(null)
  const dragMovedRef = React.useRef(false)

  const dayKey = startOfDay(day).getTime()
  const dayDraft = draft?.dayKey === dayKey ? draft : null
  // Mirrors the latest draft for pointer handlers. The pointer handlers
  // also write it synchronously so a fast release can never observe a
  // draft one render behind the highlight.
  const dayDraftRef = React.useRef(dayDraft)
  React.useEffect(() => {
    dayDraftRef.current = dayDraft
  })
  const positioned = React.useMemo(
    () =>
      layoutTimedSegments(
        timedSegmentsFor(events, day)
          .filter(
            (segment) =>
              segment.endMin > minMinute && segment.startMin < maxMinute,
          )
          .map((segment) => ({
            ...segment,
            startMin: clamp(segment.startMin, minMinute, maxMinute),
            endMin: clamp(segment.endMin, minMinute, maxMinute),
          })),
      ),
    [events, day, minMinute, maxMinute],
  )
  const isToday = isSameDay(day, now)
  const gridHeight = ((maxMinute - minMinute) / 60) * hourHeight

  // A pending reschedule targeting this day keeps its ghost parked here
  // while the host's confirmation UI decides the move.
  const dayPending =
    pendingMove && startOfDay(pendingMove.start).getTime() === dayKey
      ? pendingMove
      : null
  const pendingSegment: TimedSegment | null = dayPending
    ? {
        event: dayPending.event,
        startMin: clamp(
          minutesOfDay(dayPending.start),
          minMinute,
          maxMinute,
        ),
        endMin: clamp(
          isSameDay(dayPending.start, dayPending.end)
            ? minutesOfDay(dayPending.end)
            : maxMinute,
          minMinute,
          maxMinute,
        ),
      }
    : null
  // Keyboard nudges show their ghost while the move is still adjusting;
  // once the confirmation dialog opens, the dialog alone marks the target
  // so no chip edge bleeds out around the card.
  const shownPreview =
    movePreview ??
    (dayPending?.stage === "adjusting" ? pendingSegment : null)

  /** Returns focus to the moved event's chip once the pending UI closes. */
  const focusEventChip = (eventId: string) => {
    const grid = surfaceRef.current?.closest(
      '[data-slot="event-calendar-time-scroll"]',
    )
    window.setTimeout(() => {
      grid
        ?.querySelector<HTMLElement>(
          `[data-event-id="${CSS.escape(eventId)}"]`,
        )
        ?.focus()
    }, 0)
  }

  /** Snaps a pointer's y offset to the column's slot grid. */
  const slotAtPointer = (clientY: number) => {
    const surface = surfaceRef.current
    if (!surface) return 0
    const rect = surface.getBoundingClientRect()
    const minutes =
      minMinute +
      ((clientY - rect.top) / rect.height) * (maxMinute - minMinute)
    return clamp(
      Math.floor(minutes / slotMinutes) * slotMinutes,
      minMinute,
      maxMinute - slotMinutes,
    )
  }

  const handlePointerDown = (
    pointerEvent: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (pointerEvent.button !== 0) return
    // Touch pans the grid; drag-to-create stays a mouse, pen, and keyboard
    // gesture so scrolling the schedule never fights selection.
    if (pointerEvent.pointerType === "touch") return
    const anchor = slotAtPointer(pointerEvent.clientY)
    dragAnchorRef.current = anchor
    dragMovedRef.current = false
    selectEvent(null)
    onFocusColumn(columnIndex)
    const nextDraft = {
      dayKey,
      startMin: anchor,
      endMin: anchor + slotMinutes,
      open: false,
    }
    dayDraftRef.current = nextDraft
    setDraft(nextDraft)
    try {
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
    } catch {
      // Synthetic pointer events in tests carry untracked pointer ids.
    }
  }

  const handlePointerMove = (
    pointerEvent: React.PointerEvent<HTMLDivElement>,
  ) => {
    const anchor = dragAnchorRef.current
    if (anchor === null) return
    const current = slotAtPointer(pointerEvent.clientY)
    if (current !== anchor) dragMovedRef.current = true
    const nextDraft = {
      dayKey,
      startMin: Math.min(anchor, current),
      endMin: Math.max(anchor, current) + slotMinutes,
      open: false,
    }
    dayDraftRef.current = nextDraft
    setDraft(nextDraft)
  }

  // A plain click only parks the highlight on the slot; the quick-create
  // card opens when the pointer actually dragged a range (or via Enter or
  // a double click), matching Outlook's compose gesture.
  const handlePointerUp = () => {
    const anchor = dragAnchorRef.current
    if (anchor === null) return
    dragAnchorRef.current = null
    const current = dayDraftRef.current
    if (current && dragMovedRef.current) openDraft(current)
  }

  const handlePointerCancel = () => {
    dragAnchorRef.current = null
    cancelDraft()
  }

  const handleDoubleClick = (
    pointerEvent: React.MouseEvent<HTMLDivElement>,
  ) => {
    const slot = slotAtPointer(pointerEvent.clientY)
    openDraft(
      dayDraftRef.current ?? {
        dayKey,
        startMin: slot,
        endMin: slot + slotMinutes,
        open: false,
      },
    )
  }

  const handleKeyDown = (keyEvent: React.KeyboardEvent<HTMLDivElement>) => {
    const defaultStart = clamp(9 * 60, minMinute, maxMinute - slotMinutes)
    const active = dayDraft ?? {
      dayKey,
      startMin: defaultStart,
      endMin: defaultStart + slotMinutes,
      open: false,
    }
    if (keyEvent.key === "ArrowDown") {
      keyEvent.preventDefault()
      if (keyEvent.shiftKey) {
        setDraft({
          ...active,
          endMin: Math.min(active.endMin + slotMinutes, maxMinute),
          open: false,
        })
      } else {
        const startMin = Math.min(
          active.startMin + slotMinutes,
          maxMinute - slotMinutes,
        )
        setDraft({
          dayKey,
          startMin,
          endMin: startMin + slotMinutes,
          open: false,
        })
      }
    } else if (keyEvent.key === "ArrowUp") {
      keyEvent.preventDefault()
      if (keyEvent.shiftKey) {
        setDraft({
          ...active,
          startMin: Math.max(active.startMin - slotMinutes, minMinute),
          open: false,
        })
      } else {
        const startMin = Math.max(active.startMin - slotMinutes, minMinute)
        setDraft({
          dayKey,
          startMin,
          endMin: startMin + slotMinutes,
          open: false,
        })
      }
    } else if (keyEvent.key === "ArrowRight" || keyEvent.key === "ArrowLeft") {
      keyEvent.preventDefault()
      onArrowDay(columnIndex, keyEvent.key === "ArrowRight" ? 1 : -1)
    } else if (keyEvent.key === "Enter" || keyEvent.key === " ") {
      keyEvent.preventDefault()
      openDraft(active)
    } else if (keyEvent.key === "Escape") {
      if (dayDraft) {
        keyEvent.stopPropagation()
        cancelDraft()
      }
    }
  }

  const dayLabel = formatDayLong(locale, day)
  const surfaceLabel = dayDraft
    ? labels.daySelection(
        dayLabel,
        formatMinutes(locale, dayDraft.startMin),
        formatMinutes(locale, dayDraft.endMin),
      )
    : labels.daySchedule(dayLabel)

  const returnFocus = () => surfaceRef.current?.focus()

  return (
    <div
      data-slot="event-calendar-day-column"
      className="relative min-w-0 flex-1 border-s border-border"
      style={{ height: gridHeight }}
    >
      {Array.from(
        { length: (maxMinute - minMinute) / 60 },
        (_, index) => minMinute / 60 + index,
      ).map((hour) => (
        <div
          key={hour}
          aria-hidden="true"
          className="pointer-events-none relative border-b border-border"
          style={{ height: hourHeight }}
        >
          <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-border/60" />
        </div>
      ))}
      <div
        ref={surfaceRef}
        role="button"
        tabIndex={focused ? 0 : -1}
        aria-label={surfaceLabel}
        data-slot="event-calendar-day-surface"
        className={cn(
          "absolute inset-0 z-10 cursor-default touch-pan-y",
          insetFocusClassName,
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onFocus={() => onFocusColumn(columnIndex)}
        onBlur={() => {
          if (draft && draft.dayKey === dayKey && !draft.open) cancelDraft()
        }}
      />
      {dayDraft ? (
        <div
          aria-hidden="true"
          data-slot="event-calendar-selection"
          className="pointer-events-none absolute inset-x-0.5 z-20 rounded-md border-2 border-primary bg-primary/15"
          style={{
            top: ((dayDraft.startMin - minMinute) / 60) * hourHeight,
            height:
              ((dayDraft.endMin - dayDraft.startMin) / 60) * hourHeight,
          }}
        />
      ) : null}
      {positioned.map((segment) => (
        <TimedEventChip
          key={`${segment.event.id}-${segment.startMin}`}
          segment={segment}
          day={day}
          moving={
            segment.event.id === movingEventId ||
            segment.event.id === pendingMove?.event.id
          }
          onBeginDrag={(kind, pointerEvent, chipSegment) =>
            onBeginEventDrag(kind, pointerEvent, chipSegment, columnIndex)
          }
          suppressClickRef={suppressClickRef}
        />
      ))}
      {shownPreview ? (
        <div
          aria-hidden="true"
          data-slot="event-calendar-move-preview"
          className={cn(
            "pointer-events-none absolute inset-x-0.5 z-40 truncate rounded-md px-2 py-0.5 text-start nessa-text-2 font-medium opacity-90 shadow-md ring-1 ring-background",
            eventCalendarToneVariants({ tone: shownPreview.event.tone }),
            eventClassName?.({
              event: shownPreview.event,
              surface: "time-grid",
              selected: shownPreview.event.id === selectedEventId,
            }),
          )}
          style={{
            top: ((shownPreview.startMin - minMinute) / 60) * hourHeight,
            height: Math.max(
              ((shownPreview.endMin - shownPreview.startMin) / 60) *
                hourHeight -
                2,
              20,
            ),
          }}
        >
          {shownPreview.event.title}
        </div>
      ) : null}
      {dayPending?.stage === "confirming" && pendingSegment ? (
        <div
          data-slot="event-calendar-move-confirm"
          className={cn(
            "absolute z-50 w-max max-w-72",
            columnIndex >= columnCount / 2 ? "right-1" : "left-1",
          )}
          style={{
            top: clamp(
              ((pendingSegment.startMin - minMinute) / 60) * hourHeight,
              0,
              Math.max(gridHeight - QUICK_CREATE_CLEARANCE_PX, 0),
            ),
          }}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Escape") {
              keyEvent.stopPropagation()
              cancelPendingMove()
              focusEventChip(dayPending.event.id)
            }
          }}
        >
          {(() => {
            const context: EventCalendarMoveConfirmContext = {
              event: dayPending.event,
              range: { start: dayPending.start, end: dayPending.end },
              confirm: () => {
                confirmPendingMove()
                focusEventChip(dayPending.event.id)
              },
              cancel: () => {
                cancelPendingMove()
                focusEventChip(dayPending.event.id)
              },
            }
            return (
              renderMoveConfirm?.(context) ?? (
                <DefaultMoveConfirm context={context} />
              )
            )
          })()}
        </div>
      ) : null}
      {isToday &&
      minutesOfDay(now) >= minMinute &&
      minutesOfDay(now) <= maxMinute ? (
        <div
          aria-hidden="true"
          data-slot="event-calendar-now-line"
          className="pointer-events-none absolute inset-x-0 z-40 flex items-center"
          style={{
            top: ((minutesOfDay(now) - minMinute) / 60) * hourHeight,
          }}
        >
          <span className="-ms-1 size-2 rounded-full bg-primary" />
          <span className="h-0.5 flex-1 bg-primary" />
        </div>
      ) : null}
      {dayDraft?.open ? (
        <QuickCreateSlot
          day={day}
          columnIndex={columnIndex}
          columnCount={columnCount}
          returnFocus={returnFocus}
        />
      ) : null}
    </div>
  )
}

/** An all-day event chip in the shelf above the time grid. */
function AllDayChip({ event }: { event: EventCalendarEvent }) {
  const {
    locale,
    labels,
    onEventSelect,
    selectedEventId,
    selectEvent,
    renderEvent,
    eventClassName,
  } = useEventCalendar("EventCalendarGrid")
  const tone = event.tone ?? "primary"
  const selected = selectedEventId === event.id
  return (
    <button
      type="button"
      data-slot="event-calendar-all-day-event"
      data-tone={tone}
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={eventLabel(locale, labels, event)}
      className={cn(
        "w-full truncate rounded-md px-2 py-0.5 text-start nessa-text-2 font-medium",
        eventCalendarToneVariants({ tone }),
        surfaceTransitionClassName,
        insetFocusClassName,
        eventClassName?.({ event, surface: "all-day", selected }),
        selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
      )}
      onClick={(domEvent) => {
        selectEvent(event.id)
        onEventSelect?.(event, domEvent)
      }}
    >
      {renderEvent?.({ event, surface: "all-day", selected }) ?? event.title}
    </button>
  )
}

/**
 * The day and week time grid: a sticky header of weekday headings and the
 * all-day shelf over a scrollable 24-hour canvas that opens at the
 * configured morning hour.
 */
/** A live drag-to-reschedule session across the time grid's columns. */
interface MoveSession {
  /**
   * `move` relocates the whole event; the resize kinds drag one boundary
   * of it while the opposite boundary stays fixed in its own column.
   */
  kind: "move" | "resize-start" | "resize-end"
  event: EventCalendarEvent
  /** Full event duration, preserved through a move. */
  durationMs: number
  /** Minutes between the grab point and the event's start (moves only). */
  grabOffsetMin: number
  originX: number
  originY: number
  /** Becomes true once the pointer travels past the drag threshold. */
  started: boolean
  targetDayIndex: number
  /** The actual day under the target, snapshotted so a date change mid-drag cannot redirect the commit. */
  targetDay: Date
  targetStartMin: number
  targetEndMin: number
}

/** Pointer travel, in pixels, that turns a chip press into a move. */
const MOVE_THRESHOLD_PX = 4

function TimeGrid({ days }: { days: Date[] }) {
  const {
    events,
    now,
    locale,
    labels,
    hourHeight,
    minMinute,
    maxMinute,
    slotMinutes,
    scrollToHour,
    setDate,
    setView,
    requestMove,
  } = useEventCalendar("EventCalendarGrid")
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [focusedColumn, setFocusedColumn] = React.useState(() => {
    const todayIndex = days.findIndex((day) => isSameDay(day, now))
    return todayIndex === -1 ? 0 : todayIndex
  })
  const activeColumn = clamp(focusedColumn, 0, days.length - 1)
  const surfaceContainerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const scroller = scrollRef.current
    if (scroller) {
      scroller.scrollTop =
        (Math.max(scrollToHour * 60 - minMinute, 0) / 60) * hourHeight
    }
  }, [scrollToHour, hourHeight, minMinute])

  const hasAllDay = days.some(
    (day) => allDayEventsFor(events, day).length > 0,
  )
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short" })

  const focusColumn = (index: number) => {
    const surfaces = surfaceContainerRef.current?.querySelectorAll<HTMLElement>(
      '[data-slot="event-calendar-day-surface"]',
    )
    surfaces?.[index]?.focus()
  }

  const handleArrowDay = (from: number, direction: 1 | -1) => {
    const next = clamp(from + direction, 0, days.length - 1)
    if (next !== from) {
      setFocusedColumn(next)
      focusColumn(next)
    }
  }

  const [moveSession, setMoveSession] = React.useState<MoveSession | null>(
    null,
  )
  const moveSessionRef = React.useRef(moveSession)
  React.useEffect(() => {
    moveSessionRef.current = moveSession
  })
  const suppressClickRef = React.useRef(false)

  const beginEventDrag = (
    kind: MoveSession["kind"],
    pointerEvent: React.PointerEvent<Element>,
    segment: PositionedSegment,
    dayIndex: number,
  ) => {
    const chipRect = (
      pointerEvent.currentTarget.closest('[data-slot="event-calendar-event"]') ??
      pointerEvent.currentTarget
    ).getBoundingClientRect()
    setMoveSession({
      kind,
      event: segment.event,
      durationMs:
        segment.event.end.getTime() - segment.event.start.getTime(),
      grabOffsetMin: ((pointerEvent.clientY - chipRect.top) / hourHeight) * 60,
      originX: pointerEvent.clientX,
      originY: pointerEvent.clientY,
      started: false,
      targetDayIndex: dayIndex,
      targetDay: days[dayIndex],
      targetStartMin: segment.startMin,
      targetEndMin: segment.endMin,
    })
  }

  React.useEffect(() => {
    if (!moveSession) return

    const columnRects = () => {
      const columns = surfaceContainerRef.current?.querySelectorAll(
        '[data-slot="event-calendar-day-column"]',
      )
      return columns
        ? Array.from(columns, (column) => column.getBoundingClientRect())
        : []
    }

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const session = moveSessionRef.current
      if (!session) return
      // A session that outlived its press (missed pointerup) must not turn
      // bare hover movement into a drag.
      if (pointerEvent.buttons === 0) {
        finishMove(false)
        return
      }
      const rects = columnRects()
      if (!rects.length) return
      const started =
        session.started ||
        Math.hypot(
          pointerEvent.clientX - session.originX,
          pointerEvent.clientY - session.originY,
        ) > MOVE_THRESHOLD_PX
      // Resizes stay in the event's own column; moves track the pointer.
      let dayIndex = session.targetDayIndex
      if (session.kind === "move") {
        dayIndex = rects.findIndex(
          (rect) =>
            pointerEvent.clientX >= rect.left &&
            pointerEvent.clientX < rect.right,
        )
        if (dayIndex === -1) {
          dayIndex =
            pointerEvent.clientX < rects[0].left ? 0 : rects.length - 1
        }
      }
      const rect = rects[dayIndex]
      const pointerMinutes =
        minMinute +
        ((pointerEvent.clientY - rect.top) / rect.height) *
          (maxMinute - minMinute)
      let targetStartMin = session.targetStartMin
      let targetEndMin = session.targetEndMin
      if (session.kind === "move") {
        const visibleDuration = Math.min(
          session.durationMs / 60_000,
          maxMinute - minMinute,
        )
        targetStartMin = clamp(
          Math.round((pointerMinutes - session.grabOffsetMin) / slotMinutes) *
            slotMinutes,
          minMinute,
          maxMinute - visibleDuration,
        )
        targetEndMin = Math.min(targetStartMin + visibleDuration, maxMinute)
      } else {
        const boundary =
          Math.round(pointerMinutes / slotMinutes) * slotMinutes
        if (session.kind === "resize-start") {
          targetStartMin = clamp(
            boundary,
            minMinute,
            session.targetEndMin - slotMinutes,
          )
        } else {
          targetEndMin = clamp(
            boundary,
            session.targetStartMin + slotMinutes,
            maxMinute,
          )
        }
      }
      setMoveSession({
        ...session,
        started,
        targetDayIndex: dayIndex,
        targetDay: days[dayIndex] ?? session.targetDay,
        targetStartMin,
        targetEndMin,
      })
    }

    const finishMove = (commit: boolean) => {
      const session = moveSessionRef.current
      setMoveSession(null)
      if (!session?.started) return
      // The click synthesized from this pointerup must not read as an
      // event selection; the flag re-arms on the next task in case the
      // pointer was released outside the chip and no click fires.
      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
      if (!commit) return
      const day = session.targetDay
      if (session.kind === "move") {
        const start = dateAtMinutes(day, session.targetStartMin)
        requestMove(
          session.event,
          start,
          new Date(start.getTime() + session.durationMs),
        )
      } else if (session.kind === "resize-start") {
        requestMove(
          session.event,
          dateAtMinutes(day, session.targetStartMin),
          session.event.end,
        )
      } else {
        requestMove(
          session.event,
          session.event.start,
          dateAtMinutes(day, session.targetEndMin),
        )
      }
    }

    const handlePointerUp = () => finishMove(true)
    const handlePointerCancel = () => finishMove(false)
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return
      // Escape aborts only the drag; once it has visibly started, the key
      // is consumed so a surrounding dialog or host modal stays open.
      if (moveSessionRef.current?.started) {
        keyEvent.preventDefault()
        keyEvent.stopPropagation()
      }
      finishMove(false)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerCancel)
    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerCancel)
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [moveSession !== null, days, slotMinutes, minMinute, maxMinute, requestMove])

  const movePreview =
    moveSession?.started
      ? {
          event: moveSession.event,
          startMin: moveSession.targetStartMin,
          endMin: moveSession.targetEndMin,
        }
      : null

  return (
    <div
      ref={scrollRef}
      data-slot="event-calendar-time-scroll"
      className="min-h-0 flex-1 select-none overflow-y-auto overscroll-contain"
    >
      <div className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="flex">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const isToday = isSameDay(day, now)
            return (
              <div
                key={day.getTime()}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5 border-s border-border py-1.5"
              >
                <span className="nessa-text-2 text-muted-foreground">
                  {weekdayFormat.format(day)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-7 rounded-full nessa-text-4",
                    isToday &&
                      "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                  )}
                  aria-label={labels.openDayView(formatDayLong(locale, day))}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => {
                    setDate(day)
                    setView("day")
                  }}
                >
                  {day.getDate()}
                </Button>
              </div>
            )
          })}
        </div>
        {hasAllDay ? (
          <div data-slot="event-calendar-all-day-row" className="flex border-t border-border">
            <div className="flex w-14 shrink-0 items-start justify-end pe-2 pt-1">
              <span className="nessa-text-1 text-muted-foreground">
                {labels.allDay}
              </span>
            </div>
            {days.map((day) => (
              <div
                key={day.getTime()}
                className="flex min-w-0 flex-1 flex-col gap-0.5 border-s border-border p-0.5"
              >
                {allDayEventsFor(events, day).map((event) => (
                  <AllDayChip key={event.id} event={event} />
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div ref={surfaceContainerRef} className="flex">
        <div
          data-slot="event-calendar-time-gutter"
          aria-hidden="true"
          className="relative w-14 shrink-0"
          style={{ height: ((maxMinute - minMinute) / 60) * hourHeight }}
        >
          {Array.from(
            { length: Math.max((maxMinute - minMinute) / 60 - 1, 0) },
            (_, index) => minMinute / 60 + index + 1,
          ).map((hour) => (
            <span
              key={hour}
              className="absolute end-0 block -translate-y-1/2 pe-2 nessa-text-1 text-muted-foreground"
              style={{ top: (hour - minMinute / 60) * hourHeight }}
            >
              {formatHour(locale, hour)}
            </span>
          ))}
        </div>
        {days.map((day, index) => (
          <TimeDayColumn
            key={day.getTime()}
            day={day}
            columnIndex={index}
            columnCount={days.length}
            focused={index === activeColumn}
            onFocusColumn={setFocusedColumn}
            onArrowDay={handleArrowDay}
            onBeginEventDrag={beginEventDrag}
            movingEventId={
              moveSession?.started ? moveSession.event.id : null
            }
            movePreview={
              movePreview && moveSession?.targetDayIndex === index
                ? movePreview
                : null
            }
            suppressClickRef={suppressClickRef}
          />
        ))}
      </div>
    </div>
  )
}

/** One selectable day cell of the month grid. */
function MonthDayCell({
  day,
  cellIndex,
  focused,
  onFocusCell,
  onArrowCell,
}: {
  day: Date
  cellIndex: number
  focused: boolean
  onFocusCell: (index: number) => void
  onArrowCell: (from: number, offset: number) => void
}) {
  const {
    events,
    date,
    now,
    locale,
    labels,
    setDate,
    setView,
    onEventSelect,
    selectedEventId,
    selectEvent,
    renderEvent,
    eventClassName,
  } = useEventCalendar("EventCalendarGrid")
  const dayEvents = React.useMemo(() => {
    const allDay = allDayEventsFor(events, day)
    const timed = timedSegmentsFor(events, day)
      .sort((a, b) => a.startMin - b.startMin)
      .map((segment) => segment.event)
    return [...allDay, ...timed]
  }, [events, day])

  const isToday = isSameDay(day, now)
  const outsideMonth = day.getMonth() !== date.getMonth()

  const openDay = () => {
    setDate(day)
    setView("day")
  }

  const cellLabel = labels.monthCell(
    formatDayLong(locale, day),
    dayEvents.length,
  )

  return (
    <div
      data-slot="event-calendar-month-cell"
      data-outside-month={outsideMonth || undefined}
      className="relative flex min-h-0 min-w-0 flex-col gap-0.5 overflow-hidden border-b border-s border-border p-1"
    >
      <div
        role="button"
        tabIndex={focused ? 0 : -1}
        aria-label={cellLabel}
        data-slot="event-calendar-month-surface"
        className={cn(
          "absolute inset-0 cursor-default",
          surfaceTransitionClassName,
          insetFocusClassName,
        )}
        onClick={() => {
          selectEvent(null)
          setDate(day)
        }}
        onDoubleClick={openDay}
        onFocus={() => onFocusCell(cellIndex)}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Enter" || keyEvent.key === " ") {
            keyEvent.preventDefault()
            openDay()
          } else if (keyEvent.key === "ArrowRight") {
            keyEvent.preventDefault()
            onArrowCell(cellIndex, 1)
          } else if (keyEvent.key === "ArrowLeft") {
            keyEvent.preventDefault()
            onArrowCell(cellIndex, -1)
          } else if (keyEvent.key === "ArrowDown") {
            keyEvent.preventDefault()
            onArrowCell(cellIndex, WEEK_LENGTH)
          } else if (keyEvent.key === "ArrowUp") {
            keyEvent.preventDefault()
            onArrowCell(cellIndex, -WEEK_LENGTH)
          }
        }}
      />
      <span
        data-slot="event-calendar-month-day-number"
        className={cn(
          "pointer-events-none relative z-10 grid size-5 shrink-0 place-items-center self-start rounded-full nessa-text-2",
          outsideMonth && "text-muted-foreground",
          isToday && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {day.getDate()}
      </span>
      {dayEvents.length > 0 ? (
        <div
          data-slot="event-calendar-month-events"
          className="relative z-10 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onClick={(clickEvent) => {
            // Clicks in the gap between pills fall through to the day, so
            // the scroll layer never steals the cell's select gesture.
            if (clickEvent.target === clickEvent.currentTarget) {
              selectEvent(null)
              setDate(day)
            }
          }}
          onDoubleClick={(clickEvent) => {
            if (clickEvent.target === clickEvent.currentTarget) openDay()
          }}
        >
          {dayEvents.map((event) => {
            const tone = event.tone ?? "primary"
            const selected = selectedEventId === event.id
            return (
              <button
                key={event.id}
                type="button"
                data-slot="event-calendar-month-event"
                data-tone={tone}
                data-selected={selected || undefined}
                aria-pressed={selected}
                aria-label={eventLabel(locale, labels, event)}
                className={cn(
                  "w-full shrink-0 truncate rounded px-1.5 py-px text-start nessa-text-2 font-medium",
                  eventCalendarToneVariants({ tone }),
                  surfaceTransitionClassName,
                  insetFocusClassName,
                  eventClassName?.({ event, surface: "month", selected }),
                  selected &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-background",
                )}
                onClick={(domEvent) => {
                  selectEvent(event.id)
                  onEventSelect?.(event, domEvent)
                }}
              >
                {renderEvent?.({ event, surface: "month", selected }) ??
                  event.title}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The month grid: a six-week matrix of day cells with roving-tabindex
 * arrow navigation. Clicking a cell focuses its date, Enter or a double
 * click opens the day view, and a busy day's pills scroll in place —
 * without scrollbar chrome — so every event stays reachable from the
 * month.
 */
function MonthGrid() {
  const { date, locale, weekStartsOn } = useEventCalendar("EventCalendarGrid")
  const containerRef = React.useRef<HTMLDivElement>(null)

  const days = React.useMemo(() => {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const gridStart = startOfWeek(firstOfMonth, weekStartsOn)
    return Array.from({ length: MONTH_GRID_WEEKS * WEEK_LENGTH }, (_, index) =>
      addDays(gridStart, index),
    )
  }, [date, weekStartsOn])

  const [focusedCell, setFocusedCell] = React.useState(() => {
    const index = days.findIndex((day) => isSameDay(day, date))
    return index === -1 ? 0 : index
  })

  // Selecting an outside-month day re-derives the whole grid, unmounting
  // the pressed cell; follow the date so the roving tabindex stays on it,
  // and recover focus when the unmount dropped it to the body.
  const previousDateRef = React.useRef(date)
  React.useEffect(() => {
    if (isSameDay(previousDateRef.current, date)) return
    previousDateRef.current = date
    const index = days.findIndex((day) => isSameDay(day, date))
    if (index === -1) return
    setFocusedCell(index)
    if (document.activeElement?.tagName === "BODY") {
      containerRef.current
        ?.querySelectorAll<HTMLElement>(
          '[data-slot="event-calendar-month-surface"]',
        )
        [index]?.focus()
    }
  }, [date, days])

  const handleArrowCell = (from: number, offset: number) => {
    const next = clamp(from + offset, 0, days.length - 1)
    if (next === from) return
    setFocusedCell(next)
    const surfaces = containerRef.current?.querySelectorAll<HTMLElement>(
      '[data-slot="event-calendar-month-surface"]',
    )
    surfaces?.[next]?.focus()
  }

  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short" })

  return (
    <div
      ref={containerRef}
      data-slot="event-calendar-month-grid"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="grid shrink-0 grid-cols-7 border-b border-border">
        {days.slice(0, WEEK_LENGTH).map((day) => (
          <span
            key={day.getTime()}
            className="border-s border-border py-1 text-center nessa-text-2 text-muted-foreground first:border-s-0"
          >
            {weekdayFormat.format(day)}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7">
        {days.map((day, index) => (
          <MonthDayCell
            key={day.getTime()}
            day={day}
            cellIndex={index}
            focused={index === focusedCell}
            onFocusCell={setFocusedCell}
            onArrowCell={handleArrowCell}
          />
        ))}
      </div>
    </div>
  )
}

export interface EventCalendarGridProps extends React.ComponentProps<"div"> {}

/**
 * The calendar's scheduling canvas for the active view: a scrollable
 * 24-hour time grid for the day and week views, or the six-week month
 * matrix. Dragging across empty time-grid slots — or arrowing and pressing
 * Enter — selects a range and opens the quick-create card.
 */
function EventCalendarGrid({ className, ...props }: EventCalendarGridProps) {
  const { view, date, weekStartsOn } = useEventCalendar("EventCalendarGrid")

  const days = React.useMemo(() => {
    if (view === "day") return [startOfDay(date)]
    const first = startOfWeek(date, weekStartsOn)
    return Array.from({ length: WEEK_LENGTH }, (_, index) =>
      addDays(first, index),
    )
  }, [view, date, weekStartsOn])

  return (
    <div
      data-slot="event-calendar-grid"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    >
      {view === "month" ? (
        <MonthGrid />
      ) : (
        <TimeGrid key={view} days={days} />
      )}
    </div>
  )
}

export {
  EventCalendar,
  EventCalendarGrid,
  EventCalendarToolbar,
  eventCalendarToneVariants,
}
