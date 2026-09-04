import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Message,
  MessageAvatar,
  MessageBubble,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport,
  MessageStreamText,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

interface Turn {
  id: string
  role: "user" | "assistant"
  text: string
}

const seededTurns: Turn[] = [
  { id: "t1", role: "user", text: "Walk me through the theming contract." },
  {
    id: "t2",
    role: "assistant",
    text: "Nessa owns presentation through scoped tokens: every root and theme scope redeclares its semantic values, so nested providers resolve independently in both directions.",
  },
  { id: "t3", role: "user", text: "And how does color mode resolve?" },
  {
    id: "t4",
    role: "assistant",
    text: "The provider stores the requested mode while data-nessa-mode always carries the resolved appearance — System never reaches the DOM.",
  },
  { id: "t5", role: "user", text: "What about scale presets?" },
  {
    id: "t6",
    role: "assistant",
    text: "Scale is a finite preset from 90 to 110. It multiplies type, spacing, and control geometry through private computed aliases while radii, borders, and motion stay fixed.",
  },
  { id: "t7", role: "user", text: "Great — now stream me a long answer." },
]

const streamSource =
  "Here is the longer answer you asked for, streamed a word at a time so the transcript keeps growing while you read. While you stay at the live edge the scroller follows every chunk, keeping the newest words in view exactly like a terminal tail. The moment you scroll up to reread something the follow releases, the transcript stops moving underneath you, and the floating control appears so you can jump back to the newest content whenever you are ready. Returning to the bottom pins the view again and the cycle continues for as long as the reply keeps streaming."

function TranscriptTurn({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <Message from="user">
        <MessageContent>
          <MessageBubble variant="primary">{turn.text}</MessageBubble>
        </MessageContent>
      </Message>
    )
  }
  return (
    <Message from="assistant">
      <MessageAvatar fallback="N" alt="Nessa" />
      <MessageContent className="max-w-full">
        <MessageHeader>Nessa</MessageHeader>
        <MessageBubble variant="plain">{turn.text}</MessageBubble>
      </MessageContent>
    </Message>
  )
}

function ScrollerFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-4">
      {children}
    </div>
  )
}

function LiveTranscriptExample() {
  const words = React.useMemo(() => streamSource.split(" "), [])
  const [visibleWords, setVisibleWords] = React.useState(3)
  React.useEffect(() => {
    // Multi-word chunks per tick keep line wraps frequent even when a
    // background tab throttles timers to one tick per second.
    const interval = setInterval(() => {
      setVisibleWords((current) => (current >= words.length ? 3 : current + 4))
    }, 200)
    return () => clearInterval(interval)
  }, [words.length])

  return (
    <ScrollerFrame>
      <MessageScroller className="h-80">
        <MessageScrollerViewport className="px-1">
          <MessageScrollerContent aria-label="Conversation">
            {seededTurns.map((turn) => (
              <TranscriptTurn key={turn.id} turn={turn} />
            ))}
            <Message from="assistant">
              <MessageAvatar fallback="N" alt="Nessa" />
              <MessageContent className="max-w-full">
                <MessageHeader>Nessa · streaming</MessageHeader>
                <MessageBubble variant="plain" streaming>
                  <MessageStreamText
                    text={words.slice(0, visibleWords).join(" ")}
                  />
                </MessageBubble>
              </MessageContent>
            </Message>
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </ScrollerFrame>
  )
}

const meta = {
  title: "Conversation/MessageScroller",
  component: MessageScroller,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A stick-to-bottom transcript scroller for streamed conversations. MessageScroller owns the live-edge state and exposes it as data-pinned; MessageScrollerViewport opens scrolled to the end and follows content growth with a ResizeObserver while the reader stays within a few pixels of the bottom — any scroll away releases the follow so the transcript never moves underneath someone rereading, and returning to the bottom re-pins it. MessageScrollerContent is a polite log live region (hosts supply the accessible name), and MessageScrollerButton floats over the bottom edge, appearing only while unpinned, to smooth-scroll the reader back to the newest content. Hosts can read the same state through useMessageScroller, and autoScroll={false} turns the viewport into a plain scroll region.",
      },
    },
  },
} satisfies Meta<typeof MessageScroller>

export default meta
type Story = StoryObj<typeof meta>

function viewportOf(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>(
    '[data-slot="message-scroller-viewport"]',
  )!
}

function distanceFromEnd(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
}

export const LiveTranscript: Story = {
  parameters: storyDocumentation(
    "A reply streams into the transcript forever: the viewport opens pinned to the live edge and follows each chunk. Scrolling up releases the follow — the recorded position stays put while the stream continues — and the floating button returns and re-pins the reader at the bottom.",
  ),
  render: () => <LiveTranscriptExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scroller = canvasElement.querySelector(
      '[data-slot="message-scroller"]',
    )!
    const viewport = viewportOf(canvasElement)
    await waitFor(() => expect(distanceFromEnd(viewport)).toBeLessThanOrEqual(4))
    await expect(scroller).toHaveAttribute("data-pinned", "true")
    const streamingBubble = canvasElement.querySelector(
      '[data-streaming="true"]',
    )!
    const initialText = streamingBubble.textContent
    const initialHeight = viewport.scrollHeight
    // The paced reveal eases up from zero and the simulated chunks arrive on
    // an interval, so first growth — and enough of it to wrap a line — can
    // take several seconds when the suite runs under parallel load.
    await waitFor(
      () => expect(streamingBubble.textContent).not.toBe(initialText),
      { timeout: 10000 },
    )
    await waitFor(
      () => expect(viewport.scrollHeight).not.toBe(initialHeight),
      { timeout: 10000 },
    )
    await waitFor(
      () => expect(distanceFromEnd(viewport)).toBeLessThanOrEqual(4),
      { timeout: 5000 },
    )

    viewport.scrollTo({ top: 0 })
    await waitFor(() =>
      expect(scroller).toHaveAttribute("data-pinned", "false"),
    )
    const button = canvas.getByRole("button", {
      name: "Scroll to latest messages",
    })
    await expect(button).toHaveAttribute("data-visible", "true")
    await new Promise((resolve) => setTimeout(resolve, 350))
    await expect(viewport.scrollTop).toBe(0)

    await userEvent.click(button)
    await waitFor(
      () => expect(scroller).toHaveAttribute("data-pinned", "true"),
      { timeout: 5000 },
    )
    await waitFor(
      () => expect(distanceFromEnd(viewport)).toBeLessThanOrEqual(4),
      { timeout: 5000 },
    )
  },
}

export const ManualBrowse: Story = {
  parameters: storyDocumentation(
    "Without a stream the scroller is a saved-thread reader: it opens at the newest message, the control stays hidden and unfocusable while pinned, appears once the reader scrolls back through history, and hides again after returning to the end.",
  ),
  render: () => (
    <ScrollerFrame>
      <MessageScroller className="h-80">
        <MessageScrollerViewport className="px-1">
          <MessageScrollerContent aria-label="Conversation history">
            {seededTurns.map((turn) => (
              <TranscriptTurn key={turn.id} turn={turn} />
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </ScrollerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scroller = canvasElement.querySelector(
      '[data-slot="message-scroller"]',
    )!
    const viewport = viewportOf(canvasElement)
    await waitFor(() => expect(distanceFromEnd(viewport)).toBeLessThanOrEqual(4))
    const hiddenButton = canvasElement.querySelector(
      '[data-slot="message-scroller-button"]',
    )!
    await expect(hiddenButton).toHaveAttribute("data-visible", "false")
    await expect(hiddenButton).toHaveAttribute("tabindex", "-1")

    viewport.scrollTo({ top: 0 })
    await waitFor(() =>
      expect(scroller).toHaveAttribute("data-pinned", "false"),
    )
    const button = canvas.getByRole("button", {
      name: "Scroll to latest messages",
    })
    await expect(button).toHaveAttribute("tabindex", "0")
    await userEvent.click(button)
    await waitFor(
      () => expect(scroller).toHaveAttribute("data-pinned", "true"),
      { timeout: 3000 },
    )
    await expect(hiddenButton).toHaveAttribute("data-visible", "false")
  },
}
