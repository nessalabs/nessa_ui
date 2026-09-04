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

import { storyDocumentation } from "./story-documentation"

function ThreadFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-6">
      {children}
    </div>
  )
}

const richMarkdown = `## Reconciling the Q3 numbers

The dashboard and the report agree through August, then diverge for **one
reason**: pending invoices. The dashboard counts them at *issue time*, the
report defers them to Q4.

### What I checked

1. Exported both series with \`revenue --granularity month\`
2. Diffed the monthly totals
3. Traced every mismatch to an invoice

| Month | Dashboard | Report |
| --- | --- | --- |
| July | 118k | 118k |
| August | 126k | 126k |
| September | 141k | 128k |

> Only September differs, and the 13k gap is exactly the sum of the three
> pending invoices.

The fix is a one-line filter:

\`\`\`sql
SELECT SUM(amount) FROM invoices WHERE status != 'pending';
\`\`\`

More detail in the [reconciliation notes](https://example.com/notes).

---

Ping me if October should use the same rule.`

const mathMarkdown = `The savings follow from compound growth. Monthly
contributions $c$ at rate $r$ grow to

$$
FV = c \\cdot \\frac{(1 + r)^{n} - 1}{r}
$$

so with $r = 0.05/12$ and $n = 120$ months the multiplier is about
$155.3$, and the classic identity $e^{i\\pi} + 1 = 0$ still holds.`

const meta = {
  title: "Conversation/MessageMarkdown",
  component: MessageMarkdown,
  args: { children: richMarkdown },
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Rich assistant replies inside a message: MessageMarkdown renders GitHub-flavored markdown — headings, lists, tables, task lists, blockquotes, links — and routes special content to Nessa's dedicated surfaces: fenced code to CodeBlock (Shiki syntax highlighting, themed app-wide through CodeBlockProvider), TeX math to MathBlock (KaTeX, jitter-free while streaming), and ```mermaid fences to MermaidDiagram (flowcharts, sequence diagrams, and every other Mermaid grammar, with a fullscreen pan-and-zoom viewer). Code, tables, and display math each carry a hover copy control that copies their original markdown source. Compose it inside a plain MessageBubble; while a reply streams, keep passing the partial source with the streaming prop set — the latest complete blocks render and newly arrived prose fades in with the same animation MessageStreamText uses, so streamed markdown and streamed plain text feel identical. Individual element renderers can still be replaced through the components prop.",
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

// Content headings start at h2: the docs page owns the h1, and the docs
// gate asserts the page's last h1 sits inside the initial viewport.
const streamedMarkdown = `## Streaming markdown, smoothly

The pacing that drives the letter-by-letter reveal feeds this document too: the smoothed text streams through MessageMarkdown with \`streaming\` set, so newly arrived prose fades in with the very same animation while headings, lists, code, tables, diagrams, and math render as their blocks complete.

## Why the cushion matters

1. Bursty chunks stop looking like bursts — the reveal velocity eases instead of surging.
2. A stalled network drains the buffer gracefully before pausing.
3. Fast streams are never rate-capped; the display just trails by the same cushion.

## Some code on the way through

\`\`\`tsx
function StreamedReply({ received }: { received: string }) {
  // The same smoothing hook feeds every display.
  const { text, done } = useMessageStreamText(received)
  return <MessageMarkdown streaming={!done}>{text}</MessageMarkdown>
}
\`\`\`

Inline code like \`useMessageStreamText(received)\` streams through unharmed, as does emphasis, ~~strikethrough~~, and [links](https://example.com).

## Diagrams stream too

A flowchart drawn from a \`\`\`mermaid fence:

\`\`\`mermaid
graph LR
  A[Chunks arrive] --> B[Smooth the pacing]
  B --> C{Buffer empty?}
  C -- no --> D[Keep revealing]
  C -- yes --> E[Pause at the edge]
  D --> C
\`\`\`

And a sequence diagram from the same component:

\`\`\`mermaid
sequenceDiagram
  participant H as Host
  participant M as MessageMarkdown
  H->>M: partial markdown
  M->>M: render latest complete blocks
  M-->>H: smooth streaming UI
\`\`\`

## And some math

Inline math such as $e^{i\\pi} + 1 = 0$ renders once its delimiters close, and display math arrives as a block:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

The reveal rate follows the token arrival rate $r(t)$ with a target backlog of $r(t) \\cdot \\tau$ characters — the trail cushion.

## Tables and the rest

| Knob | Unit | What it shapes |
| --- | --- | --- |
| speed | chars/sec | Floor rate that finishes the tail |
| trail | seconds | Cushion behind the stream edge |
| adapt | seconds | How hard chunk boundaries are smoothed |

> Blockquotes, horizontal rules, and everything else GitHub-flavored markdown ships stream the same way: the latest complete blocks render, and partial syntax at the tail resolves as its closing characters arrive.

---

That's the whole trick: one smoothing hook, one animation, every display.`

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
