/** @responsibility The WindowDeck's keyboard contract: the shortcut descriptor shape, the default keymap, and the matcher that honours it. */

/** The primary modifier a shortcut may require. */
export type WindowDeckShortcutModifier = "control" | "meta" | "mod"

/** Describes one exact keyboard shortcut, in the design system's shape. */
export interface WindowDeckKeyboardShortcut {
  /** KeyboardEvent key, matched without case sensitivity. */
  key: string
  /**
   * Primary modifier. `mod` accepts exactly one of Meta or Control; omit
   * for neither.
   * @defaultValue undefined
   */
  modifier?: WindowDeckShortcutModifier
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
 * The deck's shortcut map. Every action ships a default; a host replaces any
 * entry with its own shortcut or `false` to disable it, and `shortcuts={false}`
 * on the deck turns the whole map off.
 */
export interface WindowDeckShortcuts {
  /** Switches between the carousel and the overview. @defaultValue `Mod+G` */
  toggleOverview?: WindowDeckKeyboardShortcut | false
  /** Moves to the next pane. @defaultValue `Mod+ArrowRight` */
  nextPane?: WindowDeckKeyboardShortcut | false
  /** Moves to the previous pane. @defaultValue `Mod+ArrowLeft` */
  previousPane?: WindowDeckKeyboardShortcut | false
  /**
   * Dismisses the focused pane from the overview, for hosts that made it
   * dismissible. The keyboard equivalent of throwing a tile off the top.
   * @defaultValue `Mod+Backspace`
   */
  dismissPane?: WindowDeckKeyboardShortcut | false
}

/** One action the deck's keymap can name. */
export type WindowDeckShortcutAction = keyof WindowDeckShortcuts

/** The keymap applied when a host names no shortcuts of its own. */
export const DEFAULT_WINDOW_DECK_SHORTCUTS: Required<WindowDeckShortcuts> =
  Object.freeze({
    toggleOverview: Object.freeze({ key: "g", modifier: "mod" }),
    nextPane: Object.freeze({ key: "ArrowRight", modifier: "mod" }),
    previousPane: Object.freeze({ key: "ArrowLeft", modifier: "mod" }),
    dismissPane: Object.freeze({ key: "Backspace", modifier: "mod" }),
  }) as Required<WindowDeckShortcuts>

/**
 * Merges a host's keymap over the defaults.
 *
 * @param shortcuts - The host's overrides, or false for no keyboard control.
 * @returns The resolved keymap, with a disabled action left as `false`.
 */
export function resolveWindowDeckShortcuts(
  shortcuts: WindowDeckShortcuts | false | undefined,
): Required<WindowDeckShortcuts> | false {
  if (shortcuts === false) return false
  if (!shortcuts) return DEFAULT_WINDOW_DECK_SHORTCUTS

  return {
    ...DEFAULT_WINDOW_DECK_SHORTCUTS,
    ...shortcuts,
  }
}

/**
 * Checks whether an event carries exactly the requested primary modifier
 * (Control / Meta), and no unrequested one.
 *
 * @param event - The keyboard event being checked.
 * @param modifier - The required primary modifier, or undefined for none.
 * @returns Whether the event satisfies the requested modifier.
 */
function matchesModifier(
  event: KeyboardEvent,
  modifier: WindowDeckShortcutModifier | undefined,
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
 * Checks whether an event comes from a place where the user is typing, so a
 * plain single-character shortcut never steals a keystroke.
 *
 * @param event - The keyboard event being checked.
 * @returns Whether the event target consumes plain keystrokes for editing.
 */
export function isEditableShortcutTarget(event: KeyboardEvent): boolean {
  const target = event.target

  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * Checks one keyboard event against one shortcut descriptor.
 *
 * @param event - The keyboard event being checked.
 * @param shortcut - The descriptor to match, or false when disabled.
 * @returns Whether the event is exactly this shortcut. A disabled shortcut,
 * and a bare single-character shortcut pressed while typing, never match.
 */
export function matchesWindowDeckShortcut(
  event: KeyboardEvent,
  shortcut: WindowDeckKeyboardShortcut | false | undefined,
): boolean {
  if (!shortcut) return false
  if (
    shortcut.modifier === undefined &&
    shortcut.key.length === 1 &&
    isEditableShortcutTarget(event)
  ) {
    return false
  }

  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    matchesModifier(event, shortcut.modifier) &&
    event.altKey === Boolean(shortcut.altKey) &&
    event.shiftKey === Boolean(shortcut.shiftKey)
  )
}
