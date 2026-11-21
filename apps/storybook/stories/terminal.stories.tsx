import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor } from "storybook/test"
import { Terminal, type TerminalMessage, type TerminalSize } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

type Cell = [string, number, number]

/**
 * A pretend runtime: a prompt that echoes what is typed and answers Enter
 * with a line of output. It speaks the same messages the real runtime
 * does, so the story exercises the component exactly as a host would.
 */
function useFakeShell(lines: string[]) {
  const listeners = React.useRef(new Set<(message: TerminalMessage) => void>())
  const state = React.useRef({ size: { cols: 80, rows: 12 } as TerminalSize, screen: lines, typed: "" })
  const emit = (message: TerminalMessage) => listeners.current.forEach((listener) => listener(message))
  const row = (text: string, style = 0): Cell[] =>
    Array.from({ length: state.current.size.cols }, (_, index) => [text[index] ?? "", 1, style])
  const paint = () => {
    const { screen, typed, size } = state.current
    const all = [...screen, `~/nessa $ ${typed}`]
    const shown = all.slice(-size.rows)
    emit({
      type: "frame",
      cursor: { col: `~/nessa $ ${typed}`.length, row: shown.length - 1, visible: true },
      rows: Array.from({ length: size.rows }, (_, y) => ({
        y,
        cells: row(shown[y] ?? "", (shown[y] ?? "").startsWith("~/nessa") ? 0 : 1),
      })),
      total: all.length,
    })
  }
  const subscribe = React.useCallback((listener: (message: TerminalMessage) => void) => {
    listeners.current.add(listener)
    return () => listeners.current.delete(listener)
  }, [])
  const onFit = React.useCallback((size: TerminalSize) => {
    state.current.size = size
    emit({ type: "ready", cols: size.cols, rows: size.rows })
    emit({ type: "styles", styles: [{ id: 1, fg: [24, 82, 196] }] })
    paint()
  }, [])
  const onInput = React.useCallback((bytes: Uint8Array) => {
    const text = new TextDecoder().decode(bytes)
    for (const char of text) {
      if (char === "\r") {
        state.current.screen = [
          ...state.current.screen,
          `~/nessa $ ${state.current.typed}`,
          `ran: ${state.current.typed}`,
        ]
        state.current.typed = ""
      } else if (char === "\x7f") state.current.typed = state.current.typed.slice(0, -1)
      else if (char >= " ") state.current.typed += char
    }
    paint()
  }, [])
  return { subscribe, onFit, onInput }
}

function Demo(props: {
  onInput?: (bytes: Uint8Array) => void
  onFit?: (size: TerminalSize) => void
  onFocusView?: (size: TerminalSize) => void
  autoFocus?: boolean
  lines?: string[]
}) {
  const shell = useFakeShell(props.lines ?? ["Welcome to the Nessa terminal.", "README.md  src  package.json"])
  return (
    <div className="h-72 w-[40rem] max-w-full overflow-hidden rounded-md border border-border">
      <Terminal
        aria-label="Shell"
        autoFocus={props.autoFocus}
        subscribe={shell.subscribe}
        onFit={(size) => {
          props.onFit?.(size)
          shell.onFit(size)
        }}
        onFocusView={(size) => {
          props.onFocusView?.(size)
          shell.onFit(size)
        }}
        onInput={(bytes) => {
          props.onInput?.(bytes)
          shell.onInput(bytes)
        }}
      />
    </div>
  )
}

const meta = {
  title: "Primitives/Terminal",
  component: Terminal,
  render: (args) => <Demo onInput={args.onInput} />,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "One view of a terminal the runtime has already laid out. Rows arrive through `subscribe` as pty-runtime protocol messages and keys, pastes, clicks and scrolls leave through `onInput` as the bytes a program expects, so the component parses no escape sequences and owns no transport. `onFit` reports the grid its box holds, and `onFocusView` says this view took the keyboard so a host can give it the size. Selection is native; a copy plays one sweep across the copied rows (a short fade under reduced motion).",
      },
    },
  },
  // The demo's pretend shell supplies the real subscribe; this one is never called.
  args: { onInput: fn(), subscribe: () => () => {} },
} satisfies Meta<typeof Terminal>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "A pretend shell. The play test types a command and checks the bytes sent and the row painted back.",
  ),
  play: async ({ canvasElement, args }) => {
    const terminal = canvasElement.querySelector<HTMLElement>('[data-slot="terminal"]')!
    await waitFor(() => expect(terminal.textContent).toContain("Welcome to the Nessa terminal."))
    terminal.focus()
    await userEvent.keyboard("ls{Enter}")
    await expect(args.onInput).toHaveBeenCalledWith(new TextEncoder().encode("l"))
    await expect(args.onInput).toHaveBeenCalledWith(new TextEncoder().encode("\r"))
    await waitFor(() => expect(terminal.textContent).toContain("ran: ls"))
    await expect(terminal.querySelector('[data-slot="terminal-cursor"]')).not.toBeNull()
  },
}

export const CopyShimmer: Story = {
  parameters: storyDocumentation(
    "Selecting text and copying plays one sweep over the copied rows, then removes itself, so nothing keeps running.",
  ),
  play: async ({ canvasElement }) => {
    const terminal = canvasElement.querySelector<HTMLElement>('[data-slot="terminal"]')!
    await waitFor(() => expect(terminal.textContent).toContain("Welcome"))
    const row = terminal.querySelector('[data-slot="terminal-row"]')!
    const range = document.createRange()
    range.selectNodeContents(row)
    const selection = getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    terminal.focus()
    const data = new DataTransfer()
    terminal.dispatchEvent(new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true }))
    await expect(data.getData("text/plain")).toContain("Welcome to the Nessa terminal.")
    await waitFor(() => expect(terminal.querySelector('[data-slot="terminal-copy"]')).not.toBeNull())
    await waitFor(() => expect(terminal.querySelector('[data-slot="terminal-copy"]')).toBeNull(), {
      timeout: 2000,
    })
    selection.removeAllRanges()
  },
}

export const FocusedOnOpen: Story = {
  parameters: storyDocumentation(
    "A view that opens with the keyboard (autoFocus) is focused before its box is measured, so its first fit is reported as focus: the host gives it the size, and a later box change resizes the terminal instead of only rescaling this view.",
  ),
  args: { onFit: fn(), onFocusView: fn() },
  render: (args) => <Demo autoFocus onFit={args.onFit} onFocusView={args.onFocusView} />,
  play: async ({ canvasElement, args }) => {
    const terminal = canvasElement.querySelector<HTMLElement>('[data-slot="terminal"]')!
    await waitFor(() => expect(args.onFocusView).toHaveBeenCalled())
    await expect(document.activeElement).toBe(terminal)
    await expect(args.onFit).not.toHaveBeenCalled()
    await waitFor(() => expect(terminal.textContent).toContain("Welcome to the Nessa terminal."))
  },
}

export const SetInAPage: Story = {
  parameters: storyDocumentation(
    "Inline output set in a scrolling page (`scrollsHistory=\"focused\"`): the wheel over it scrolls the page, never its history, until the person clicks into it. A focused view's cursor blinks.",
  ),
  render: () => <InPage />,
  play: async ({ canvasElement }) => {
    const terminal = canvasElement.querySelector<HTMLElement>('[data-slot="terminal"]')!
    await waitFor(() => expect(terminal.textContent).toContain("line 30"))
    terminal.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, bubbles: true, cancelable: true }))
    await new Promise((done) => requestAnimationFrame(() => done(null)))
    await expect(terminal.querySelector('[data-slot="terminal-scrolled"]')).toBeNull()
    terminal.focus()
    await waitFor(() =>
      expect(terminal.querySelector('[data-slot="terminal-cursor"]')?.getAttribute("data-blinking")).toBe(
        matchMedia("(prefers-reduced-motion: reduce)").matches ? null : "true",
      ),
    )
    terminal.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, bubbles: true, cancelable: true }))
    await waitFor(() => expect(terminal.querySelector('[data-slot="terminal-scrolled"]')).not.toBeNull())
    terminal.blur()
  },
}

function InPage() {
  const shell = useFakeShell(Array.from({ length: 30 }, (_, index) => `line ${index + 1}`))
  return (
    <div className="h-40 w-[40rem] max-w-full overflow-hidden rounded-md border border-border">
      <Terminal
        aria-label="Output"
        scrollsHistory="focused"
        subscribe={shell.subscribe}
        onFit={shell.onFit}
        onFocusView={shell.onFit}
        onInput={shell.onInput}
      />
    </div>
  )
}
