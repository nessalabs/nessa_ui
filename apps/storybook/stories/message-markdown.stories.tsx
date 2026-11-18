import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
import {
  Button,
  Message,
  MessageAvatar,
  MessageBubble,
  MessageContent,
  MessageHeader,
  MessageMarkdown,
  useMessageStreamText,
} from "@nessalabs/ui"

import {
  mathMarkdown,
  richMarkdown,
  streamedMarkdown,
  tableMarkdown,
} from "./markdown-samples"
import { storyDocumentation } from "./story-documentation"

function ThreadFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-6">
      {children}
    </div>
  )
}



const meta = {
  title: "Conversation/MessageMarkdown",
  component: MessageMarkdown,
  args: { children: richMarkdown },
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Math and diagram renderers load on demand; their source remains visible while loading. Use remarkPlugins to add host-owned Markdown AST transforms after GFM and math parsing, alongside components overrides for custom nodes. Rich assistant replies inside a message: MessageMarkdown renders GitHub-flavored markdown — headings, lists, tables, task lists, blockquotes, links — and routes special content to Nessa's dedicated surfaces: fenced code to CodeBlock (Shiki syntax highlighting, themed app-wide through CodeBlockProvider), TeX math to MathBlock (KaTeX, jitter-free while streaming), and ```mermaid fences to MermaidDiagram (flowcharts, sequence diagrams, and every other Mermaid grammar, with a fullscreen pan-and-zoom viewer). Code, tables, and display math each carry a hover copy control that copies their original markdown source. Compose it inside a plain MessageBubble; while a reply streams, keep passing the partial source with the streaming prop set — the latest complete blocks render and newly arrived prose fades in with the same animation MessageStreamText uses, so streamed markdown and streamed plain text feel identical. Individual element renderers can still be replaced through the components prop.",
      },
    },
  },
} satisfies Meta<typeof MessageMarkdown>

export default meta
type Story = StoryObj<typeof meta>

export const RichResponse: Story = {
  parameters: storyDocumentation(
    "A full markdown reply in a plain assistant bubble: headings, emphasis, an ordered list, a table, a blockquote, fenced SQL, a link, and a rule — every element styled with semantic tokens.",
  ),
  render: () => (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent className="max-w-full">
          <MessageHeader>Nessa</MessageHeader>
          <MessageBubble variant="plain">
            <MessageMarkdown>{richMarkdown}</MessageMarkdown>
          </MessageBubble>
        </MessageContent>
      </Message>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { name: "Reconciling the Q3 numbers" }),
    ).toBeVisible()
    await expect(canvas.getByText("141k")).toBeVisible()
    const link = canvas.getByRole("link", { name: "reconciliation notes" })
    await expect(link).toHaveAttribute("href", "https://example.com/notes")
    const markdown = canvasElement.querySelector(
      '[data-slot="message-markdown"]',
    )!
    await expect(markdown.querySelector("table")).toBeTruthy()
    await expect(markdown.querySelector("blockquote")).toBeTruthy()
    // Fenced code renders through the syntax-highlighted CodeBlock, which
    // draws inside Pierre's <diffs-container> shadow root; highlighting is
    // async, so wait for the source text to appear there.
    const codeBlock = markdown.querySelector('[data-slot="code-block"]')!
    await expect(codeBlock).toBeTruthy()
    await waitFor(
      () =>
        expect(
          codeBlock.querySelector("diffs-container")?.shadowRoot?.textContent,
        ).toMatch(/SELECT SUM\(amount\) FROM invoices/),
      { timeout: 15000 },
    )
  },
}

export const MathResponse: Story = {
  parameters: storyDocumentation(
    "TeX math renders through KaTeX: $…$ for inline expressions and $$…$$ for display equations, which scroll horizontally instead of overflowing narrow bubbles.",
  ),
  render: () => (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent className="max-w-full">
          <MessageHeader>Nessa</MessageHeader>
          <MessageBubble variant="plain">
            <MessageMarkdown>{mathMarkdown}</MessageMarkdown>
          </MessageBubble>
        </MessageContent>
      </Message>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const markdown = canvasElement.querySelector(
      '[data-slot="message-markdown"]',
    )!
    await waitFor(() =>
      expect(markdown.querySelectorAll(".katex").length).toBeGreaterThan(2),
    )
    await expect(markdown.querySelector(".katex-display")).toBeTruthy()
  },
}


interface StreamingMarkdownArgs {
  chunkWords: number
  chunkInterval: number
}

function StreamingMarkdownExample({
  chunkWords,
  chunkInterval,
}: StreamingMarkdownArgs) {
  // Tokens keep their trailing whitespace so newlines survive; the stream
  // runs once and stops so the finished document stays inspectable.
  const tokens = React.useMemo(
    () => streamedMarkdown.match(/\S+\s*/g) ?? [],
    [],
  )
  const [received, setReceived] = React.useState(4)
  const [run, setRun] = React.useState(0)
  React.useEffect(() => {
    setReceived(4)
    const interval = setInterval(() => {
      setReceived((current) => {
        if (current >= tokens.length) {
          clearInterval(interval)
          return current
        }
        return current + chunkWords
      })
    }, chunkInterval)
    return () => clearInterval(interval)
  }, [chunkInterval, chunkWords, run, tokens.length])
  const receivedText = tokens
    .slice(0, Math.min(received, tokens.length))
    .join("")
  const { text, done } = useMessageStreamText(receivedText)
  const finished = received >= tokens.length && done
  return (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent className="max-w-full">
          <MessageBubble variant="plain" streaming={!finished}>
            <MessageMarkdown streaming={!finished}>{text}</MessageMarkdown>
          </MessageBubble>
        </MessageContent>
      </Message>
      {finished && (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRun((current) => current + 1)}
          >
            Replay stream
          </Button>
        </div>
      )}
    </ThreadFrame>
  )
}

export const StreamingMarkdown: StoryObj<StreamingMarkdownArgs> = {
  args: {
    chunkWords: 20,
    chunkInterval: 1300,
  },
  argTypes: {
    chunkWords: {
      control: { type: "range", min: 1, max: 20, step: 1 },
      description: "Demo only: words delivered per simulated network chunk.",
    },
    chunkInterval: {
      control: { type: "range", min: 100, max: 2000, step: 100 },
      description: "Demo only: milliseconds between simulated chunks.",
    },
  },
  parameters: storyDocumentation(
    "The streamed form of MessageMarkdown: the host passes the smoothed text from useMessageStreamText with the streaming prop set, so newly arrived prose fades in with the exact same animation as MessageStreamText while complete blocks — syntax-highlighted code, Mermaid flowcharts and sequence diagrams, KaTeX math, tables with copy controls — render as they close. Code, math, and diagram content is never animated, and once streaming ends the fade wrappers disappear entirely, leaving plain DOM. Partial syntax at the tail (an unclosed fence or math delimiter) resolves the moment its closing characters arrive. The stream runs once so the finished document stays inspectable; a replay button appears when it completes.",
  ),
  render: (args) => <StreamingMarkdownExample {...args} />,
  play: async ({ canvasElement }) => {
    const markdown = canvasElement.querySelector(
      '[data-slot="message-markdown"]',
    )!
    const initialLength = markdown.textContent!.length
    // The first chunk lands after the simulated interval and the reveal
    // velocity eases up from zero, so growth can take a moment.
    await waitFor(
      () => expect(markdown.textContent!.length).toBeGreaterThan(initialLength),
      { timeout: 5000 },
    )
    await expect(
      markdown.closest('[data-slot="message-bubble"]'),
    ).toHaveAttribute("data-streaming", "true")
    // Newly arrived prose is wrapped in the shared fade spans while
    // streaming; code and math content never is.
    await waitFor(() => {
      const fadeSpans = markdown.querySelectorAll('span[class*="starting:"]')
      expect(fadeSpans.length).toBeGreaterThan(0)
    })
  },
}


/**
 * A host column that lets any run break anywhere, as a chat transcript does
 * so a long address cannot push the pane wider. Tables must not inherit it.
 */
function BreakAnywhereColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-6 [overflow-wrap:anywhere]">
      {children}
    </div>
  )
}

/** Whether `text` inside `element` was laid out across more than one line. */
function wraps(element: Element, text: string) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const start = node.textContent!.indexOf(text)
    if (start < 0) continue
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, start + text.length)
    const tops = new Set(
      [...range.getClientRects()].map((rect) => Math.round(rect.top)),
    )
    return tops.size > 1
  }
  throw new Error(`"${text}" is not in the element`)
}

export const Tables: Story = {
  parameters: storyDocumentation(
    "Markdown tables render through the kit's Table on a quiet panel lit along its top edge: small uppercase column names on a faint header band, the first column a step stronger, cell text sized a step below the reply's own, and rules between rows with fainter hairlines between columns. Cells wrap between words and never inside one, even under a host that sets overflow-wrap: anywhere, so each column is at least as wide as its longest word. A table wider than the reply scrolls sideways in its own panel instead of squeezing its columns, and becomes a focusable region while it does. Numeric columns aligned right in the Markdown stay right-aligned with tabular figures. An edge with columns scrolled past it fades out, since an overlay scrollbar shows nothing until it is used. The copy control sits just above the table's top-right corner, never on a column name, and copies the table's Markdown source.",
  ),
  render: () => (
    <BreakAnywhereColumn>
      <MessageMarkdown>{tableMarkdown}</MessageMarkdown>
    </BreakAnywhereColumn>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [prices, screenings] = [
      ...canvasElement.querySelectorAll('[data-slot="markdown-table"]'),
    ]
    await expect(prices).toBeTruthy()
    await expect(screenings).toBeTruthy()
    // No word is cut: each of these short runs sits on one line.
    for (const word of ["Price", "$16.99", "CAD", "Cine-Maniac", "$150"])
      await expect(wraps(prices!, word)).toBe(false)
    // A hairline separates the columns: every cell after a row's first, and
    // only those, draws a rule on its starting side.
    for (const row of prices!.querySelectorAll("tr")) {
      const [first, ...rest] = [...row.children]
      await expect(getComputedStyle(first!).borderInlineStartWidth).toBe("0px")
      for (const cell of rest)
        await expect(getComputedStyle(cell).borderInlineStartWidth).toBe("1px")
    }
    // The narrow table fits; the wide one scrolls in its own panel.
    const scrollPort = (table: Element) =>
      table.querySelector<HTMLElement>('[data-slot="table-container"]')!
    await expect(scrollPort(prices!).scrollWidth).toBeLessThanOrEqual(
      scrollPort(prices!).clientWidth + 1,
    )
    await waitFor(() =>
      expect(scrollPort(screenings!)).toHaveAttribute("role", "region"),
    )
    await expect(scrollPort(screenings!)).toHaveAccessibleName(
      "Table: Film, Venue, Date, Time, Runtime, Format, Language, Seats left",
    )
    // The side with columns past it fades; scrolled to the end, the fade
    // moves to the other side.
    await expect(scrollPort(prices!)).not.toHaveAttribute("data-hidden-right")
    await waitFor(() =>
      expect(scrollPort(screenings!)).toHaveAttribute("data-hidden-right"),
    )
    await expect(scrollPort(screenings!)).not.toHaveAttribute("data-hidden-left")
    scrollPort(screenings!).scrollLeft = scrollPort(screenings!).scrollWidth
    await waitFor(() =>
      expect(scrollPort(screenings!)).toHaveAttribute("data-hidden-left"),
    )
    await expect(scrollPort(screenings!)).not.toHaveAttribute("data-hidden-right")
    // The copy control sits above each table's top-right corner, never on
    // the table: a wide table cuts its last column at the panel edge, so a
    // control inside the panel would cover a column name.
    const copies = canvas.getAllByRole("button", { name: "Copy table" })
    for (const [index, table] of [prices!, screenings!].entries()) {
      const copy = copies[index]!.getBoundingClientRect()
      const panel = scrollPort(table).getBoundingClientRect()
      await expect(copy.bottom).toBeLessThanOrEqual(panel.top)
      await expect(Math.abs(copy.right - panel.right)).toBeLessThanOrEqual(1)
    }
    // The column the Markdown aligns right stays right-aligned.
    const seats = canvas.getByRole("columnheader", { name: "Seats left" })
    await expect(getComputedStyle(seats).textAlign).toBe("right")
    await expect(
      canvas.getAllByRole("button", { name: "Copy table" }),
    ).toHaveLength(2)
  },
}
