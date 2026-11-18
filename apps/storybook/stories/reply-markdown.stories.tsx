import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
import {
  Message,
  MessageAvatar,
  MessageBubble,
  MessageContent,
  MessageHeader,
  preloadReplyMarkdown,
  ReplyMarkdown,
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
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 bg-background p-6">
      {children}
    </div>
  )
}

function Reply({ children }: { children: React.ReactNode }) {
  return (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent className="max-w-full">
          <MessageHeader>Nessa</MessageHeader>
          <MessageBubble variant="plain">{children}</MessageBubble>
        </MessageContent>
      </Message>
    </ThreadFrame>
  )
}

const meta = {
  title: "Conversation/ReplyMarkdown",
  component: ReplyMarkdown,
  args: { children: richMarkdown },
  tags: ["autodocs", "test"],
  // Words loads on first draw; the stories wait for it, as a host that
  // calls preloadReplyMarkdown at start does.
  loaders: [async () => (await preloadReplyMarkdown(), {})],
  parameters: {
    docs: {
      description: {
        component:
          "An agent's reply as Markdown, parsed by Words (@pierre/words), a WebAssembly parser that keeps the blocks it has finished. While a reply streams, each update parses only its unfinished tail, so a long reply costs the same per chunk as a short one; MessageMarkdown's parser starts over on every chunk. It draws the same elements as MessageMarkdown with the same styles — CodeBlock for fenced code, MermaidDiagram for ```mermaid fences, the kit's Table with a copy control, links led by their site's Favicon, and maths through MathBlock, and new words fading in while it streams. It takes no remark plugins: a host draws an element itself through components, and sets parts of prose apart through renderText. Raw HTML in the source is never drawn. Words compiles its WebAssembly as it loads, so it loads on the first draw (the reply shows as plain text until then) or when a host calls preloadReplyMarkdown.",
      },
    },
  },
} satisfies Meta<typeof ReplyMarkdown>

export default meta
type Story = StoryObj<typeof meta>

export const RichReply: Story = {
  parameters: storyDocumentation(
    "A full reply: headings, emphasis, an ordered list, a table, a blockquote, fenced SQL, a link, and a rule, each styled exactly as MessageMarkdown styles it.",
  ),
  render: () => (
    <Reply>
      <ReplyMarkdown>{richMarkdown}</ReplyMarkdown>
    </Reply>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { name: "Reconciling the Q3 numbers" }),
    ).toBeVisible()
    await expect(canvas.getByText("141k")).toBeVisible()
    const link = canvas.getByRole("link", { name: "reconciliation notes" })
    await expect(link).toHaveAttribute("href", "https://example.com/notes")
    const markdown = canvasElement.querySelector('[data-slot="reply-markdown"]')!
    await expect(markdown.querySelector('[data-slot="markdown-table"]')).toBeTruthy()
    await expect(markdown.querySelector("blockquote")).toBeTruthy()
    await expect(markdown.querySelector("ol > li")).toBeTruthy()
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

export const MathReply: Story = {
  parameters: storyDocumentation(
    "Words reads the TeX ($…$ inline, $$…$$ as a display block) and MathBlock draws it with KaTeX, exactly as in MessageMarkdown. A display equation that stood as its own paragraph takes the paragraph's place, since a block cannot sit inside a <p>.",
  ),
  render: () => (
    <Reply>
      <ReplyMarkdown>{mathMarkdown}</ReplyMarkdown>
    </Reply>
  ),
  play: async ({ canvasElement }) => {
    const markdown = canvasElement.querySelector('[data-slot="reply-markdown"]')!
    await waitFor(() =>
      expect(markdown.querySelectorAll(".katex").length).toBeGreaterThan(2),
    )
    await expect(markdown.querySelector(".katex-display")).toBeTruthy()
    await expect(markdown.querySelector("p .katex-display, p div")).toBeNull()
  },
}

interface StreamingReplyArgs {
  chunkWords: number
  chunkInterval: number
}

function StreamingReplyExample({ chunkWords, chunkInterval }: StreamingReplyArgs) {
  const tokens = React.useMemo(() => streamedMarkdown.match(/\S+\s*/g) ?? [], [])
  const [received, setReceived] = React.useState(4)
  React.useEffect(() => {
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
  }, [chunkInterval, chunkWords, tokens.length])
  const { text, done } = useMessageStreamText(
    tokens.slice(0, Math.min(received, tokens.length)).join(""),
  )
  const finished = received >= tokens.length && done
  return (
    <Reply>
      <ReplyMarkdown streaming={!finished} data-finished={finished || undefined}>
        {text}
      </ReplyMarkdown>
    </Reply>
  )
}

export const StreamingReply: StoryObj<StreamingReplyArgs> = {
  args: { chunkWords: 20, chunkInterval: 300 },
  argTypes: {
    chunkWords: {
      control: { type: "range", min: 1, max: 40, step: 1 },
      description: "Demo only: words delivered per simulated network chunk.",
    },
    chunkInterval: {
      control: { type: "range", min: 50, max: 2000, step: 50 },
      description: "Demo only: milliseconds between simulated chunks.",
    },
  },
  parameters: storyDocumentation(
    "The streamed form: the host passes the smoothed text with streaming set. Finished blocks are parsed once and left alone; only the tail is parsed again, with unfinished syntax completed (**bol reads as bold, an open fence as code). New words fade in with MessageMarkdown's animation, an open ```mermaid fence keeps its diagram's placeholder until it closes, and once streaming ends the fade wrappers go.",
  ),
  render: (args) => <StreamingReplyExample {...args} />,
  play: async ({ canvasElement }) => {
    const markdown = canvasElement.querySelector('[data-slot="reply-markdown"]')!
    const initialLength = markdown.textContent!.length
    await waitFor(
      () => expect(markdown.textContent!.length).toBeGreaterThan(initialLength),
      { timeout: 5000 },
    )
    await waitFor(() =>
      expect(markdown.querySelectorAll('span[class*="starting:"]').length).toBeGreaterThan(0),
    )
    // The stream ends, and so does everything it started: no fade spans are
    // left, and the whole reply is there.
    await waitFor(() => expect(markdown).toHaveAttribute("data-finished"), {
      timeout: 30000,
    })
    await waitFor(() =>
      expect(markdown.querySelectorAll('span[class*="starting:"]')).toHaveLength(0),
    )
    await expect(markdown.textContent).toContain("every display.")
    await expect(markdown.querySelectorAll('[data-slot="mermaid-diagram"]')).toHaveLength(2)
  },
}

export const Tables: Story = {
  parameters: storyDocumentation(
    "Tables are the kit's Table on MessageMarkdown's quiet panel. Words keeps no source offsets, so the copy control copies Markdown rebuilt from the cells, alignment included.",
  ),
  render: () => (
    <div className="w-[min(40rem,calc(100vw-2rem))] bg-background p-6 [overflow-wrap:anywhere]">
      <ReplyMarkdown>{tableMarkdown}</ReplyMarkdown>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [prices, screenings] = [
      ...canvasElement.querySelectorAll('[data-slot="markdown-table"]'),
    ]
    await expect(prices).toBeTruthy()
    const scrollPort = (table: Element) =>
      table.querySelector<HTMLElement>('[data-slot="table-container"]')!
    await waitFor(() =>
      expect(scrollPort(screenings!)).toHaveAttribute("role", "region"),
    )
    await expect(scrollPort(screenings!)).toHaveAccessibleName(
      "Table: Film, Venue, Date, Time, Runtime, Format, Language, Seats left",
    )
    await waitFor(() =>
      expect(scrollPort(screenings!)).toHaveAttribute("data-hidden-right"),
    )
    const seats = canvas.getByRole("columnheader", { name: "Seats left" })
    await expect(getComputedStyle(seats).textAlign).toBe("right")
    await expect(canvas.getAllByRole("button", { name: "Copy table" })).toHaveLength(2)
  },
}

const hostText = `Started \`a1b2c3\` and handed the review to 0b5c8f2e-6c1d-4c55-9a8e-2f7f1d3a9e10, see [the notes](https://example.com/0b5c8f2e-6c1d-4c55-9a8e-2f7f1d3a9e10).`

const idPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

function markIds(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let at = 0
  for (const match of text.matchAll(idPattern)) {
    if (match.index > at) parts.push(text.slice(at, match.index))
    parts.push(
      <mark key={match.index} data-id={match[0]} className="rounded bg-muted px-1 text-foreground">
        {match[0].slice(0, 8)}
      </mark>,
    )
    at = match.index + match[0].length
  }
  if (parts.length === 0) return text
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

function TaggedCode({ children, ...props }: { children?: React.ReactNode }) {
  // Inline code arrives as one string, so a host can read what it says.
  return (
    <code data-tagged={typeof children === "string" ? children : "not text"} {...props}>
      {children}
    </code>
  )
}

const hostComponents = { code: TaggedCode }

export const HostDrawnText: Story = {
  parameters: storyDocumentation(
    "A host sets parts of prose apart with renderText (here, an id as a short mark) and draws an element itself through components (here, inline code). renderText never sees text inside code or a link.",
  ),
  render: () => (
    <Reply>
      <ReplyMarkdown renderText={markIds} components={hostComponents}>
        {hostText}
      </ReplyMarkdown>
    </Reply>
  ),
  play: async ({ canvasElement }) => {
    const markdown = canvasElement.querySelector('[data-slot="reply-markdown"]')!
    await expect(markdown.querySelectorAll("mark[data-id]")).toHaveLength(1)
    await expect(markdown.querySelector('code[data-tagged="a1b2c3"]')).toHaveTextContent("a1b2c3")
    await expect(markdown.querySelector("a mark")).toBeNull()
  },
}
