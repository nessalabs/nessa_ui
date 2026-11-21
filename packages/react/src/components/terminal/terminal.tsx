"use client"

/** @responsibility Paints one view of a terminal the runtime has already laid out, and sends back what the person types, pastes, clicks and scrolls. It owns no escape-sequence parsing and no transport: rows come in through `subscribe`, bytes go out through `onInput`. */

import * as React from "react"

import { useReducedMotion } from "@/lib/shimmer"
import { cn } from "@/lib/utils"

import { keyBytes, mouseBytes, pasteBytes, type MouseInput } from "./terminal-keys"
import {
  adaptLines,
  defaultModes,
  rowRuns,
  type Rgb,
  type TerminalCell,
  type TerminalCursor,
  type TerminalMessage,
  type TerminalModes,
  type TerminalSize,
  type TerminalStyle,
} from "./terminal-protocol"

export interface TerminalProps
  extends Omit<
    React.ComponentProps<"div">,
    "children" | "onInput" | "onCopy" | "onPaste" | "onFocus"
  > {
  /**
   * Listens for this view's messages and returns the function that stops
   * listening. It is called once per value, so pass a stable function.
   */
  subscribe: (listener: (message: TerminalMessage) => void) => () => void
  /** Bytes for the program: keys, pasted text, mouse reports. */
  onInput: (bytes: Uint8Array) => void
  /**
   * The grid this view's box holds. Called once the box is measured and
   * again whenever the fit changes; the terminal's real size is the one the
   * runtime announces, which may differ while another view owns it.
   */
  onFit?: (fit: TerminalSize) => void
  /**
   * This view took the keyboard, with its current fit. The view the person
   * is typing in decides the size, so a host passes this on.
   */
  onFocusView?: (fit: TerminalSize) => void
  /** Asks for retained rows `start..start+count` while the view scrolls back. */
  onHistory?: (start: number, count: number) => void
  /** The program ended, with its exit status or null when it was signalled. */
  onExit?: (status: number | null) => void
  /** Text was copied from the view, after the copy shimmer started. */
  onCopyText?: (text: string) => void
  /** The type size in pixels. Defaults to 13. */
  fontSize?: number
  /** Takes the keyboard on mount. */
  autoFocus?: boolean
}

interface Grid {
  cols: number
  rows: number
  lines: (readonly TerminalCell[])[]
}

interface Scroll {
  /** Rows above the live screen the view shows; zero follows live output. */
  offset: number
  rows: Map<number, readonly TerminalCell[]> | null
  start: number
  total: number
}

interface CopyFlash {
  key: number
  boxes: { left: number; top: number; width: number; height: number }[]
}

/** Matches the root's `leading-[1.25]`; the probe measures a cell with it. */
const LINE_HEIGHT = 1.25

function cssColor(rgb: Rgb | null | undefined): string | null {
  return rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : null
}

/**
 * Inline CSS for a style. Default colours stay theme tokens rather than the
 * runtime's palette, so a terminal reads like the rest of the window in
 * both schemes; colours a program chose are painted as it chose them.
 */
function styleCss(style: TerminalStyle | undefined): React.CSSProperties | undefined {
  if (!style) return undefined
  let fg = cssColor(style.fg) ?? "var(--foreground)"
  let bg = cssColor(style.bg)
  if (style.inverse) [fg, bg] = [bg ?? "var(--background)", fg]
  const css: React.CSSProperties = { color: fg }
  if (bg) css.background = bg
  if (style.bold) css.fontWeight = 600
  if (style.italic) css.fontStyle = "italic"
  if (style.faint) css.opacity = 0.6
  if (style.invisible) css.visibility = "hidden"
  const lines: string[] = []
  if (style.underline && style.underline !== "none") lines.push("underline")
  if (style.strikethrough) lines.push("line-through")
  if (style.overline) lines.push("overline")
  if (lines.length) {
    css.textDecorationLine = lines.join(" ")
    if (style.underline === "double") css.textDecorationStyle = "double"
    else if (style.underline === "curly") css.textDecorationStyle = "wavy"
    else if (style.underline === "dotted") css.textDecorationStyle = "dotted"
    else if (style.underline === "dashed") css.textDecorationStyle = "dashed"
  }
  return css
}

/**
 * One row. Each run is pinned to the columns it owns: text flow advances
 * by font metrics, and wide glyphs are not exactly two narrow ones, so a
 * row left to flow drifts along its length. Bidi is overridden because a
 * grid has no bidi: cell zero is drawn leftmost whatever script it holds.
 */
const TerminalRow = React.memo(function TerminalRow({
  cells,
  styles,
  cellWidth,
  cellHeight,
}: {
  cells: readonly TerminalCell[]
  styles: ReadonlyMap<number, TerminalStyle>
  cellWidth: number
  cellHeight: number
}) {
  return (
    <div data-slot="terminal-row" style={{ height: cellHeight }}>
      {cells.length === 0
        ? " "
        : rowRuns(cells).map((run, index) => (
            <span
              key={index}
              className="inline-block overflow-hidden align-top whitespace-pre [direction:ltr] [unicode-bidi:bidi-override]"
              style={{
                ...styleCss(run.style ? styles.get(run.style) : undefined),
                width: run.cells * cellWidth,
              }}
            >
              {run.text}
            </span>
          ))}
    </div>
  )
})

/**
 * A terminal view: one real grid, painted from rows the runtime sends, with
 * native selection. Copying plays one shimmer across what was copied (a
 * short fade under reduced motion). Scrolling moves through retained
 * history, or becomes arrow keys while a full-screen program runs. When
 * another view owns the size and this one is smaller, the grid is scaled
 * down to fit rather than cut.
 */
function Terminal({
  subscribe,
  onInput,
  onFit,
  onFocusView,
  onHistory,
  onExit,
  onCopyText,
  fontSize = 13,
  autoFocus,
  className,
  style,
  ...props
}: TerminalProps) {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const modesRef = React.useRef<TerminalModes>(defaultModes)
  const [styles, setStyles] = React.useState<ReadonlyMap<number, TerminalStyle>>(
    () => new Map(),
  )
  const [grid, setGrid] = React.useState<Grid>({ cols: 0, rows: 0, lines: [] })
  const [cursor, setCursor] = React.useState<TerminalCursor>({
    col: 0,
    row: 0,
    visible: true,
  })
  const [scroll, setScroll] = React.useState<Scroll>({
    offset: 0,
    rows: null,
    start: 0,
    total: 0,
  })
  const [ended, setEnded] = React.useState<{ status: number | null } | null>(null)
  const [focused, setFocused] = React.useState(false)
  const [cell, setCell] = React.useState({ width: 8, height: 16 })
  const [box, setBox] = React.useState({ width: 0, height: 0 })
  const [flash, setFlash] = React.useState<CopyFlash | null>(null)
  const reducedMotion = useReducedMotion()

  // Callbacks are read through a ref so a host passing fresh closures each
  // render does not re-subscribe or re-announce.
  const handlers = React.useRef({ onInput, onFit, onFocusView, onHistory, onExit, onCopyText })
  handlers.current = { onInput, onFit, onFocusView, onHistory, onExit, onCopyText }

  React.useEffect(
    () =>
      subscribe((message) => {
        switch (message.type) {
          case "ready":
            // A ready replaces the style table: ids restart after a reset.
            setStyles(new Map())
            setGrid((previous) =>
              previous.cols === message.cols && previous.rows === message.rows
                ? previous
                : {
                    cols: message.cols,
                    rows: message.rows,
                    lines: adaptLines(previous.lines, message.cols, message.rows),
                  },
            )
            break
          case "styles":
            setStyles((previous) => {
              const next = new Map(previous)
              for (const entry of message.styles) next.set(entry.id, entry)
              return next
            })
            break
          case "modes":
            modesRef.current = {
              application_cursor: message.application_cursor,
              bracketed_paste: message.bracketed_paste,
              alternate_screen: message.alternate_screen,
              mouse: message.mouse,
              mouse_encoding: message.mouse_encoding,
            }
            break
          case "frame":
            setCursor(message.cursor)
            if (message.total !== undefined) {
              const total = message.total
              setScroll((previous) =>
                previous.total === total ? previous : { ...previous, total },
              )
            }
            if (message.rows.length) {
              setGrid((previous) => {
                const lines = previous.lines.slice()
                for (const row of message.rows) lines[row.y] = row.cells
                return { ...previous, lines }
              })
            }
            break
          case "history": {
            const rows = new Map<number, readonly TerminalCell[]>()
            for (const row of message.rows) rows.set(row.y, row.cells)
            setScroll((previous) => ({
              ...previous,
              rows,
              start: message.start,
              total: message.total,
            }))
            break
          }
          case "exit":
            setEnded({ status: message.status })
            handlers.current.onExit?.(message.status)
            break
          case "error":
            break
        }
      }),
    [subscribe],
  )

  // The cell box is the only measurement: everything else is cells.
  React.useLayoutEffect(() => {
    const host = boxRef.current
    if (!host) return
    const measure = () => {
      const probe = document.createElement("span")
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:inherit;line-height:${LINE_HEIGHT}`
      probe.textContent = "M".repeat(100)
      host.appendChild(probe)
      const rect = probe.getBoundingClientRect()
      host.removeChild(probe)
      if (!rect.width) return
      // Quantised so subpixel metrics cannot chatter across a cell edge.
      setCell({
        width: Math.round((rect.width / 100) * 1000) / 1000,
        height: Math.round(rect.height * 1000) / 1000,
      })
    }
    measure()
    let live = true
    void document.fonts?.ready.then(() => live && measure())
    return () => {
      live = false
    }
  }, [fontSize])

  React.useEffect(() => {
    const element = boxRef.current
    if (!element || typeof ResizeObserver === "undefined") return
    let frame = 0
    const observer = new ResizeObserver((entries) => {
      const content = entries[0]?.contentRect
      if (!content) return
      // One measurement per frame, so a drag cannot oscillate the grid.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        setBox((previous) =>
          previous.width === content.width && previous.height === content.height
            ? previous
            : { width: content.width, height: content.height },
        ),
      )
    })
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // The fit, with half a cell of hysteresis so a drag does not flicker N↔N±1.
  const fitRef = React.useRef<TerminalSize | null>(null)
  const fit = React.useMemo<TerminalSize | null>(() => {
    if (!box.width || !box.height) return null
    const cols = Math.max(2, Math.floor(Math.max(0, box.width - 1) / cell.width))
    const rows = Math.max(1, Math.floor(Math.max(0, box.height - 1) / cell.height))
    const last = fitRef.current
    if (!last) return { cols: Math.min(cols, 1000), rows: Math.min(rows, 1000) }
    let nextCols = cols
    let nextRows = rows
    if (cols < last.cols && box.width + cell.width * 0.5 >= last.cols * cell.width) nextCols = last.cols
    else if (cols > last.cols && box.width < (last.cols + 0.5) * cell.width) nextCols = last.cols
    if (rows < last.rows && box.height + cell.height * 0.5 >= last.rows * cell.height) nextRows = last.rows
    else if (rows > last.rows && box.height < (last.rows + 0.5) * cell.height) nextRows = last.rows
    return { cols: Math.min(nextCols, 1000), rows: Math.min(nextRows, 1000) }
  }, [box, cell])

  React.useEffect(() => {
    if (!fit) return
    const last = fitRef.current
    if (last && last.cols === fit.cols && last.rows === fit.rows) return
    fitRef.current = fit
    handlers.current.onFit?.(fit)
  }, [fit])

  React.useEffect(() => {
    if (autoFocus) boxRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  // Another view may own the size; a smaller box shows the whole grid scaled.
  const scale =
    grid.cols && grid.rows && box.width && box.height
      ? Math.min(1, box.width / (grid.cols * cell.width), box.height / (grid.rows * cell.height))
      : 1

  const send = React.useCallback((bytes: Uint8Array) => {
    handlers.current.onInput(bytes)
  }, [])

  const followLive = React.useCallback(() => {
    setScroll((previous) => (previous.offset === 0 ? previous : { ...previous, offset: 0 }))
  }, [])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return
    const bytes = keyBytes(event, modesRef.current.application_cursor)
    if (!bytes) return
    event.preventDefault()
    followLive()
    send(bytes)
  }

  const cellAt = (event: { clientX: number; clientY: number }) => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      col: Math.max(0, Math.floor((event.clientX - rect.left) / (cell.width * scale))),
      row: Math.max(0, Math.floor((event.clientY - rect.top) / (cell.height * scale))),
    }
  }

  // The program gets the mouse only when it asked for it; otherwise the
  // browser keeps selection and its menu, as in any terminal not tracking.
  const sendMouse = (
    type: MouseInput["type"],
    event: React.MouseEvent | React.WheelEvent,
    button: MouseInput["button"],
  ) => {
    const tracking = modesRef.current.mouse
    if (tracking === "none") return false
    if (tracking === "press" && type !== "down" && type !== "wheel") return false
    if (type === "move" && tracking !== "button_motion" && tracking !== "any_motion") return false
    const at = cellAt(event)
    if (!at) return false
    event.preventDefault()
    send(
      mouseBytes({
        type,
        button,
        col: at.col,
        row: at.row,
        shift: event.shiftKey,
        alt: event.altKey,
        ctrl: event.ctrlKey,
        encoding: modesRef.current.mouse_encoding,
      }),
    )
    return true
  }

  const buttonName = (event: React.MouseEvent): MouseInput["button"] =>
    event.button === 1 ? "middle" : event.button === 2 ? "right" : "left"
  const dragging = React.useRef<MouseInput["button"] | null>(null)
  const hover = React.useRef<{ col: number; row: number } | null>(null)
  const wheel = React.useRef(0)

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (sendMouse("wheel", event, event.deltaY < 0 ? "up" : "down")) return
    // Accumulate pixels so a trackpad and a notched wheel scroll alike.
    wheel.current += event.deltaY
    const lines = Math.trunc(wheel.current / 40)
    if (lines === 0) return
    wheel.current -= lines * 40
    if (modesRef.current.alternate_screen) {
      // A full-screen program has no scrollback here; the wheel is arrows,
      // which is what scrolls vim and less.
      const prefix = modesRef.current.application_cursor ? "\x1bO" : "\x1b["
      send(
        new TextEncoder().encode(
          `${prefix}${lines < 0 ? "A" : "B"}`.repeat(Math.min(Math.abs(lines), 10)),
        ),
      )
      return
    }
    setScroll((previous) => {
      const screen = grid.rows || 1
      const limit = Math.max(0, previous.total - screen)
      const offset = Math.max(0, Math.min(limit, previous.offset - lines))
      if (offset === previous.offset) return previous
      if (offset > 0) {
        handlers.current.onHistory?.(Math.max(0, previous.total - screen - offset), screen)
      }
      return { ...previous, offset }
    })
  }

  const playCopy = () => {
    const selection = globalThis.getSelection?.()
    const host = boxRef.current
    if (!selection || selection.rangeCount === 0 || !host) return
    const origin = host.getBoundingClientRect()
    const boxes = [...selection.getRangeAt(0).getClientRects()]
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      }))
    if (boxes.length) setFlash({ key: Date.now(), boxes })
  }

  const onCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const text = globalThis.getSelection?.()?.toString()
    if (!text) return
    // Layout uses NBSP nowhere, but a browser may; keep pasted commands ASCII.
    const plain = text.replace(/ /g, " ")
    event.clipboardData.setData("text/plain", plain)
    event.preventDefault()
    playCopy()
    handlers.current.onCopyText?.(plain)
  }

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain")
    if (!text) return
    followLive()
    send(pasteBytes(text, modesRef.current.bracketed_paste))
  }

  const shownLines =
    scroll.offset > 0 && scroll.rows
      ? Array.from(
          { length: grid.rows },
          (_, index) => scroll.rows?.get(scroll.start + index) ?? [],
        )
      : grid.lines

  return (
    <div
      ref={boxRef}
      role="textbox"
      aria-multiline="true"
      aria-readonly={ended ? "true" : undefined}
      tabIndex={0}
      data-slot="terminal"
      data-state={ended ? "exited" : "running"}
      data-focused={focused ? "true" : undefined}
      onKeyDown={onKeyDown}
      onCopy={onCopy}
      onPaste={onPaste}
      onFocus={() => {
        setFocused(true)
        if (fitRef.current) handlers.current.onFocusView?.(fitRef.current)
      }}
      onBlur={() => setFocused(false)}
      onMouseDown={(event) => {
        const button = buttonName(event)
        if (sendMouse("down", event, button)) dragging.current = button
      }}
      onMouseUp={(event) => {
        sendMouse("up", event, dragging.current ?? buttonName(event))
        dragging.current = null
      }}
      onMouseMove={(event) => {
        if (dragging.current) {
          sendMouse("move", event, dragging.current)
          return
        }
        if (modesRef.current.mouse !== "any_motion") return
        const at = cellAt(event)
        if (!at || (hover.current?.col === at.col && hover.current?.row === at.row)) return
        hover.current = at
        sendMouse("move", event, "none")
      }}
      onWheel={onWheel}
      onContextMenu={(event) => {
        if (modesRef.current.mouse !== "none") event.preventDefault()
      }}
      className={cn(
        "relative h-full w-full cursor-text overflow-hidden bg-background font-mono text-[length:var(--nessa-terminal-font-size)] leading-[1.25] text-foreground outline-none select-text",
        className,
      )}
      style={{ "--nessa-terminal-font-size": `${fontSize}px`, ...style } as React.CSSProperties}
      {...props}
    >
      <div
        ref={gridRef}
        data-slot="terminal-grid"
        className="absolute top-0 left-0 whitespace-pre"
        style={{
          width: grid.cols * cell.width,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "0 0",
        }}
      >
        {shownLines.map((cells, y) => (
          <TerminalRow
            key={y}
            cells={cells}
            styles={styles}
            cellWidth={cell.width}
            cellHeight={cell.height}
          />
        ))}
        {scroll.offset === 0 && cursor.visible && !ended && (
          <div
            aria-hidden
            data-slot="terminal-cursor"
            className={cn(
              "pointer-events-none absolute",
              focused ? "bg-foreground/70" : "border border-foreground/60",
            )}
            style={{
              left: cursor.col * cell.width,
              top: cursor.row * cell.height,
              width: cell.width,
              height: cell.height,
            }}
          />
        )}
      </div>
      {scroll.offset > 0 && (
        <div
          data-slot="terminal-scrolled"
          className="nessa-text-5 pointer-events-none absolute top-1 right-2 rounded-sm bg-popover px-2 py-0.5 text-muted-foreground"
        >
          {scroll.offset} {scroll.offset === 1 ? "row" : "rows"} back
        </div>
      )}
      {flash && (
        <CopyShimmer
          key={flash.key}
          boxes={flash.boxes}
          reducedMotion={reducedMotion}
          onDone={() => setFlash(null)}
        />
      )}
    </div>
  )
}

/**
 * One sweep of light across the rows just copied, so a copy is seen to
 * happen. It runs once and removes itself; under reduced motion the
 * highlight only fades.
 */
function CopyShimmer({
  boxes,
  reducedMotion,
  onDone,
}: {
  boxes: CopyFlash["boxes"]
  reducedMotion: boolean
  onDone: () => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const done = React.useRef(onDone)
  done.current = onDone
  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof node.animate !== "function") {
      done.current()
      return
    }
    const parts = [...node.children] as HTMLElement[]
    const animations = parts.map((part) =>
      reducedMotion
        ? part.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 280,
            easing: "ease-out",
            fill: "forwards",
          })
        : part.animate(
            [
              { backgroundPosition: "150% 0", opacity: 1 },
              { backgroundPosition: "-50% 0", opacity: 1, offset: 0.8 },
              { backgroundPosition: "-50% 0", opacity: 0 },
            ],
            { duration: 520, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
          ),
    )
    let live = true
    void Promise.all(animations.map((animation) => animation.finished))
      .catch(() => undefined)
      .then(() => live && done.current())
    return () => {
      live = false
      animations.forEach((animation) => animation.cancel())
    }
  }, [reducedMotion])
  return (
    <div ref={ref} aria-hidden data-slot="terminal-copy" className="pointer-events-none absolute inset-0">
      {boxes.map((rect, index) => (
        <div
          key={index}
          className="absolute rounded-[2px] bg-[length:200%_100%] [background-image:linear-gradient(90deg,transparent_0%,transparent_35%,color-mix(in_oklab,var(--foreground)_22%,transparent)_50%,transparent_65%,transparent_100%)] data-[reduced=true]:[background-image:none] data-[reduced=true]:bg-foreground/15"
          data-reduced={reducedMotion ? "true" : undefined}
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      ))}
    </div>
  )
}

export { Terminal }
export type { TerminalMessage, TerminalSize } from "./terminal-protocol"
