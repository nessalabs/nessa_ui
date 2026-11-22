/** @responsibility Turns key, mouse and paste input into the bytes a terminal program expects. The sequences come from the VT and xterm lineage, so only two Apple rules (Option composes, Command is ours) depend on the platform. */

const encoder = new TextEncoder()

/** Keys that end in `~` carry a number; the CSI parameter is that number. */
const TILDE_KEYS: Record<string, number> = {
  Insert: 2,
  Delete: 3,
  PageUp: 5,
  PageDown: 6,
  F5: 15,
  F6: 17,
  F7: 18,
  F8: 19,
  F9: 20,
  F10: 21,
  F11: 23,
  F12: 24,
}

/** Keys that end in a letter: SS3 unmodified when the mode asks, CSI with a parameter when modified. */
const LETTER_KEYS: Record<string, string> = {
  ArrowUp: "A",
  ArrowDown: "B",
  ArrowRight: "C",
  ArrowLeft: "D",
  End: "F",
  Home: "H",
  F1: "P",
  F2: "Q",
  F3: "R",
  F4: "S",
}

/** The parts of a keyboard event the encoding reads. */
interface KeyInput {
  key: string
  code?: string
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

function isApplePlatform(): boolean {
  const navigator = globalThis.navigator as
    | (Navigator & { userAgentData?: { platform?: string } })
    | undefined
  return /Mac|iPhone|iPad/.test(
    navigator?.userAgentData?.platform ?? navigator?.platform ?? "",
  )
}

/**
 * Whether a chord belongs to the clipboard rather than to the program:
 * Command-C/V/X/A on Apple; elsewhere Ctrl+Shift+C, Ctrl+V, and Ctrl+C only
 * while text is selected, so a bare Ctrl+C still interrupts.
 */
function isClipboardShortcut(
  event: KeyInput,
  apple = isApplePlatform(),
  hasSelection = () => {
    const selection = globalThis.getSelection?.()
    return Boolean(selection && !selection.isCollapsed && selection.toString())
  },
): boolean {
  const key = event.key.length === 1 ? event.key.toLowerCase() : ""
  if (!key) return false
  if (apple) {
    if (!(event.metaKey && !event.ctrlKey && !event.altKey)) return false
    return key === "c" || key === "v" || key === "x" || key === "a"
  }
  if (!(event.ctrlKey && !event.metaKey && !event.altKey)) return false
  if (key === "v") return true
  if (key === "c") return event.shiftKey || hasSelection()
  return false
}

/** xterm's modifier parameter: 1 plus a bitmask, so unmodified is 1. */
function modifierParameter(event: KeyInput): number {
  return (
    1 +
    (event.shiftKey ? 1 : 0) +
    (event.altKey ? 2 : 0) +
    (event.ctrlKey ? 4 : 0) +
    (event.metaKey ? 8 : 0)
  )
}

/**
 * The bytes a keydown sends, or null when the key is not the program's
 * (a clipboard chord, a lone modifier, a Command shortcut). In
 * application-cursor mode arrows are `ESC O A` rather than `ESC [ A`.
 */
function keyBytes(
  event: KeyInput,
  applicationCursor: boolean,
  apple = isApplePlatform(),
): Uint8Array | null {
  if (isClipboardShortcut(event, apple)) return null
  const { key, ctrlKey, altKey } = event
  const modifier = modifierParameter(event)

  if (key === "Tab" && event.shiftKey) return encoder.encode("\x1b[Z")

  const tilde = TILDE_KEYS[key]
  if (tilde !== undefined) {
    return encoder.encode(
      modifier === 1 ? `\x1b[${tilde}~` : `\x1b[${tilde};${modifier}~`,
    )
  }

  const letter = LETTER_KEYS[key]
  if (letter !== undefined) {
    if (modifier !== 1) return encoder.encode(`\x1b[1;${modifier}${letter}`)
    const ss3 = "PQRS".includes(letter) || applicationCursor
    return encoder.encode(ss3 ? `\x1bO${letter}` : `\x1b[${letter}`)
  }

  if (key === "Backspace") {
    // Command-Backspace has no encoding; terminals map it to kill-line.
    if (event.metaKey) return apple ? new Uint8Array([0x15]) : null
    if (altKey) return new Uint8Array([0x1b, 0x7f])
    if (ctrlKey) return new Uint8Array([0x08])
    return new Uint8Array([0x7f])
  }

  // Command is the app's on Apple (⌘J, ⌘W, ⌘K…), never the program's.
  if (apple && event.metaKey) return null

  if (key === "Enter") return encoder.encode("\r")
  if (key === "Tab") return encoder.encode("\t")
  if (key === "Escape") return encoder.encode("\x1b")

  // With Option held an Apple keyboard reports the composed character, so
  // the base letter survives only in the physical code. `code` is wrong on
  // non-QWERTY layouts, so it is only the fallback.
  const ascii = key.length === 1 && key.charCodeAt(0) < 128 ? key : null
  const physical = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code ?? "")
  const base =
    ascii ?? (physical ? (physical[1] ?? physical[2] ?? "").toLowerCase() : null)

  if (ctrlKey && base) {
    const code = base.toUpperCase().charCodeAt(0)
    if (code >= 64 && code < 96) return new Uint8Array([code - 64])
    if (key === " ") return new Uint8Array([0])
  }
  if (altKey && base) return new Uint8Array([0x1b, ...encoder.encode(base)])
  if (key.length >= 1 && [...key].length === 1) {
    const bytes = encoder.encode(key)
    return altKey ? new Uint8Array([0x1b, ...bytes]) : bytes
  }
  return null
}

type MouseButton = "left" | "middle" | "right" | "none" | "up" | "down"

interface MouseInput {
  type: "down" | "up" | "move" | "wheel"
  button: MouseButton
  col: number
  row: number
  shift?: boolean
  alt?: boolean
  ctrl?: boolean
  encoding?: string
}

/**
 * A mouse report in the encoding the program asked for: SGR
 * (`ESC [ < b ; x ; y M/m`), or the legacy `ESC [ M` with three biased
 * bytes, which clamps past column 223 rather than corrupting.
 */
function mouseBytes({
  type,
  button,
  col,
  row,
  shift,
  alt,
  ctrl,
  encoding = "sgr",
}: MouseInput): Uint8Array {
  let code: number
  if (type === "wheel") code = button === "up" ? 64 : 65
  else if (type === "up" && encoding !== "sgr") code = 3
  else {
    code = { left: 0, middle: 1, right: 2, none: 3 }[button as string] ?? 0
    if (type === "move") code += 32
  }
  if (shift) code += 4
  if (alt) code += 8
  if (ctrl) code += 16
  if (encoding === "sgr") {
    const final = type === "up" ? "m" : "M"
    return encoder.encode(`\x1b[<${code};${col + 1};${row + 1}${final}`)
  }
  const clamp = (value: number) => Math.min(value + 33, 255)
  return new Uint8Array([0x1b, 0x5b, 0x4d, code + 32, clamp(col), clamp(row)])
}

/** Pasted text, wrapped when the program asked for bracketed paste so it can tell a paste from typing. */
function pasteBytes(text: string, bracketed: boolean): Uint8Array {
  return encoder.encode(bracketed ? `\x1b[200~${text}\x1b[201~` : text)
}

export {
  isClipboardShortcut,
  keyBytes,
  mouseBytes,
  pasteBytes,
  type KeyInput,
  type MouseInput,
}
