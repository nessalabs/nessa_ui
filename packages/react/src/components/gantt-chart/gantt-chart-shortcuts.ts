"use client"

/** @responsibility The Gantt chart's keyboard contract: the shortcut descriptor shape, the default keymap, the matchers that honour it, and the announcement hints built from it. */

import * as React from "react"

import type { GanttChartLabels } from "./gantt-chart-context"

export type GanttChartShortcutModifier = "control" | "meta" | "mod"

/** Describes one exact keyboard shortcut, in the design system's shape. */
export interface GanttChartKeyboardShortcut {
  /** KeyboardEvent key, matched without case sensitivity. */
  key: string
  /**
   * Primary modifier. `mod` accepts exactly one of Meta or Control; omit
   * for neither.
   * @defaultValue undefined
   */
  modifier?: GanttChartShortcutModifier
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
 * The chart's shortcut map. Every action ships a sensible default —
 * vim-flavored navigation, Shift+Arrow to move a focused task; hosts
 * replace any entry with their own shortcut or `false` to disable it, and
 * `shortcuts={false}` on the chart turns the whole map off.
 */
export interface GanttChartShortcuts {
  /** Scrolls the timeline one screen earlier. @defaultValue `h` */
  previousPeriod?: GanttChartKeyboardShortcut | false
  /** Scrolls the timeline one screen later. @defaultValue `l` */
  nextPeriod?: GanttChartKeyboardShortcut | false
  /** Scrolls the current date into view. @defaultValue `t` */
  today?: GanttChartKeyboardShortcut | false
  /** Switches to the day scale. @defaultValue `d` */
  dayScale?: GanttChartKeyboardShortcut | false
  /** Switches to the week scale. @defaultValue `w` */
  weekScale?: GanttChartKeyboardShortcut | false
  /** Switches to the month scale. @defaultValue `m` */
  monthScale?: GanttChartKeyboardShortcut | false
  /** Nudges a focused task one day earlier. @defaultValue `Shift+ArrowLeft` */
  moveTaskLeft?: GanttChartKeyboardShortcut | false
  /** Nudges a focused task one day later. @defaultValue `Shift+ArrowRight` */
  moveTaskRight?: GanttChartKeyboardShortcut | false
  /** Grows a focused task one day longer. @defaultValue `Mod+Alt+J` */
  resizeTaskLonger?: GanttChartKeyboardShortcut | false
  /** Shrinks a focused task one day shorter. @defaultValue `Mod+Alt+K` */
  resizeTaskShorter?: GanttChartKeyboardShortcut | false
}

export type GanttChartShortcutAction = keyof GanttChartShortcuts

export type ResolvedShortcuts = Record<
  GanttChartShortcutAction,
  GanttChartKeyboardShortcut | undefined
>

/**
 * The out-of-the-box keymap: vim-flavored navigation (h/l/t/d/w/m, the
 * same letters the calendar binds) and Shift+Arrow to move a focused
 * task along the timeline.
 */
export const DEFAULT_SHORTCUTS: Record<
  GanttChartShortcutAction,
  GanttChartKeyboardShortcut
> = Object.freeze({
  previousPeriod: { key: "h" },
  nextPeriod: { key: "l" },
  today: { key: "t" },
  dayScale: { key: "d" },
  weekScale: { key: "w" },
  monthScale: { key: "m" },
  moveTaskLeft: { key: "ArrowLeft", shiftKey: true },
  moveTaskRight: { key: "ArrowRight", shiftKey: true },
  resizeTaskLonger: { key: "j", modifier: "mod", altKey: true },
  resizeTaskShorter: { key: "k", modifier: "mod", altKey: true },
})

/**
 * Checks whether a keyboard event carries exactly the requested primary
 * modifier (Control / Meta), and no unrequested one.
 */
export function matchesShortcutModifier(
  event: React.KeyboardEvent | KeyboardEvent,
  modifier: GanttChartShortcutModifier | undefined,
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
export function matchesShortcutKey(
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
export function matchesShortcut(
  event: React.KeyboardEvent | KeyboardEvent,
  shortcut: GanttChartKeyboardShortcut,
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
export function isEditableShortcutTarget(event: React.KeyboardEvent | KeyboardEvent) {
  const target = event.target

  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Renders a run of shortcuts as "Shift+ArrowLeft, ArrowRight" style text. */
export function shortcutRunHint(
  shortcuts: Array<GanttChartKeyboardShortcut | undefined>,
) {
  const present = shortcuts.filter(
    (shortcut): shortcut is GanttChartKeyboardShortcut => Boolean(shortcut),
  )
  if (!present.length) return null
  const [first, ...rest] = present
  const restKeys = rest.map((shortcut) =>
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
  )
  return [shortcutHint(first), ...restKeys].join(", ")
}

/** Composes the bar announcement's shortcut hints from the keymap. */
export function barShortcutHints(
  shortcuts: ResolvedShortcuts,
  labels: GanttChartLabels,
  resizable: boolean,
) {
  const parts: string[] = []
  const moveKeys = shortcutRunHint([
    shortcuts.moveTaskLeft,
    shortcuts.moveTaskRight,
  ])
  if (moveKeys) parts.push(labels.taskMoveHint(moveKeys))
  if (resizable) {
    const resizeKeys = shortcutRunHint([
      shortcuts.resizeTaskLonger,
      shortcuts.resizeTaskShorter,
    ])
    if (resizeKeys) parts.push(labels.taskResizeHint(resizeKeys))
  }
  return parts.length ? ` ${parts.join(" ")}` : ""
}

/** Renders a shortcut descriptor as announcement text. */
export function shortcutHint(shortcut: GanttChartKeyboardShortcut) {
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
