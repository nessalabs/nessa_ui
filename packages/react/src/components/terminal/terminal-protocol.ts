/** @responsibility The shape of one terminal view's messages (pty-runtime client protocol v1) and the screen they build. The runtime renders, so this holds laid-out rows and never parses an escape sequence. */

type Rgb = readonly [number, number, number]

/** A cell: grapheme, width in columns (0 marks a wide glyph's spacer), style id. */
type TerminalCell = readonly [text: string, width: number, style: number]

interface TerminalRowMessage {
  y: number
  cells: readonly TerminalCell[]
}

interface TerminalStyle {
  id: number
  fg?: Rgb | null
  bg?: Rgb | null
  bold?: boolean
  italic?: boolean
  faint?: boolean
  inverse?: boolean
  invisible?: boolean
  strikethrough?: boolean
  overline?: boolean
  underline?: "none" | "single" | "double" | "curly" | "dotted" | "dashed"
}

interface TerminalPalette {
  foreground?: Rgb | null
  background?: Rgb | null
  cursor?: Rgb | null
}

interface TerminalModes {
  application_cursor: boolean
  bracketed_paste: boolean
  alternate_screen: boolean
  mouse: "none" | "press" | "press_release" | "button_motion" | "any_motion"
  mouse_encoding: string
}

interface TerminalCursor {
  col: number
  row: number
  visible: boolean
}

/** One message to a view, as the runtime sends it. */
type TerminalMessage =
  | { v?: number; type: "ready"; cols: number; rows: number; palette?: TerminalPalette | null }
  | { v?: number; type: "styles"; styles: readonly TerminalStyle[] }
  | ({ v?: number; type: "modes" } & TerminalModes)
  | {
      v?: number
      type: "frame"
      seq?: number
      cursor: TerminalCursor
      rows: readonly TerminalRowMessage[]
      total?: number
      scrollback?: number
    }
  | {
      v?: number
      type: "history"
      start: number
      rows: readonly TerminalRowMessage[]
      total: number
      scrollback: number
    }
  | { v?: number; type: "exit"; status: number | null }
  | { v?: number; type: "error"; message: string }

/** A grid in cells. */
interface TerminalSize {
  cols: number
  rows: number
}

const defaultModes: TerminalModes = {
  application_cursor: false,
  bracketed_paste: false,
  alternate_screen: false,
  mouse: "none",
  mouse_encoding: "sgr",
}

/** Keeps the overlapping rows across a geometry change instead of flashing blank. */
function adaptLines(
  previous: readonly (readonly TerminalCell[])[],
  cols: number,
  rows: number,
): (readonly TerminalCell[])[] {
  return Array.from({ length: rows }, (_, y) => {
    const row = previous[y]
    if (!row) return []
    return row.length > cols ? row.slice(0, cols) : row
  })
}

/** A run of cells sharing one style, `cells` columns wide. */
interface TerminalRun {
  style: number
  text: string
  cells: number
}

/**
 * Collapses a row into runs of one style. A wide glyph gets a run of its
 * own, and its spacer (width 0) is skipped, because the glyph already
 * covers both columns.
 */
function rowRuns(cells: readonly TerminalCell[]): TerminalRun[] {
  const out: TerminalRun[] = []
  let current: TerminalRun | null = null
  for (const [text, width, style] of cells) {
    if (width === 0) continue
    const glyph = text === "" ? " " : text
    if (width === 2) {
      if (current) out.push(current)
      current = null
      out.push({ style, text: glyph, cells: 2 })
      continue
    }
    if (current && current.style === style) {
      current.text += glyph
      current.cells += 1
      continue
    }
    if (current) out.push(current)
    current = { style, text: glyph, cells: 1 }
  }
  if (current) out.push(current)
  return out
}

/** The plain text of a row, trailing blanks dropped, as a copy would read it. */
function rowText(cells: readonly TerminalCell[]): string {
  let text = ""
  for (const [glyph, width] of cells) {
    if (width === 0) continue
    text += glyph === "" ? " " : glyph
  }
  return text.replace(/\s+$/, "")
}

export {
  adaptLines,
  defaultModes,
  rowRuns,
  rowText,
  type Rgb,
  type TerminalCell,
  type TerminalCursor,
  type TerminalMessage,
  type TerminalModes,
  type TerminalPalette,
  type TerminalRowMessage,
  type TerminalRun,
  type TerminalSize,
  type TerminalStyle,
}
