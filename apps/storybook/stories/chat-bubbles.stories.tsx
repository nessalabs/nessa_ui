import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChatAttachmentStack,
  ChatAttachmentTile,
  ChatAttachmentViewer,
  ChatBubble,
  ChatMessage,
  ChatMessageQuote,
  ChatMessageReceipt,
  chatReactionOptions,
  ChatTypingIndicator,
  MessageMarkdown,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@nessalabs/ui"
import { Folder, Paperclip } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

/** Builds a small gradient "photo" as a data URI, so the demo needs no assets. */
function demoPhoto(from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='160' height='160' fill='url(#g)'/><circle cx='118' cy='44' r='18' fill='white' fill-opacity='0.85'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const sunset = demoPhoto("#f59e0b", "#ec4899")
const ocean = demoPhoto("#22d3ee", "#0071e3")

interface TranscriptEntry {
  id: number
  tone: "sent" | "received"
  text: string
  quote?: string
  /** The id of the message this one replies to, linking it into a thread. */
  replyToId?: number
}

const transcript: TranscriptEntry[] = [
  { id: 1, tone: "sent", text: "Ship the release notes" },
  { id: 2, tone: "received", text: "On it — I'll take a look and report back." },
  {
    id: 3,
    tone: "sent",
    text: "thanks",
    quote: "On it — I'll take a look and report back.",
    replyToId: 2,
  },
]

/**
 * Returns the ids that stay in focus while replying to `targetId`: the
 * message itself, everything it transitively replies to, and every reply
 * chained onto it — iMessage's "just this thread" view.
 */
function threadIdsFor(targetId: number) {
  const ids = new Set<number>()
  let ancestor = transcript.find((entry) => entry.id === targetId)
  while (ancestor && !ids.has(ancestor.id)) {
    ids.add(ancestor.id)
    const parentId: number | undefined = ancestor.replyToId
    ancestor = transcript.find((entry) => entry.id === parentId)
  }
  let grew = true
  while (grew) {
    grew = false
    for (const entry of transcript) {
      if (
        entry.replyToId !== undefined &&
        ids.has(entry.replyToId) &&
        !ids.has(entry.id)
      ) {
        ids.add(entry.id)
        grew = true
      }
    }
  }
  return ids
}

/**
 * A minimal transcript host: tapping a bubble focuses its whole thread for
 * a reply — the target, the message it replies to, and replies onto it stay
 * sharp while the rest recedes; tapping again (or Escape) releases it.
 */
function ConversationExample() {
  const [frameElement, setFrameElement] = React.useState<HTMLDivElement | null>(
    null,
  )
  const [replyTargetId, setReplyTargetId] = React.useState<number | null>(null)
  const [reactions, setReactions] = React.useState<Record<number, string>>({})
  const [menuTargetId, setMenuTargetId] = React.useState<number | null>(null)
  const threadIds = replyTargetId === null ? null : threadIdsFor(replyTargetId)
  React.useEffect(() => {
    if (replyTargetId === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setReplyTargetId(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [replyTargetId])
  return (
    <div
      ref={setFrameElement}
      role="log"
      aria-label="Conversation"
      className="flex min-w-0 w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 rounded-[2rem] bg-background p-4"
    >
      {transcript.map((entry) => (
        <ChatMessage
          key={entry.id}
          tone={entry.tone}
          animateIn={false}
          dimmed={
            threadIds !== null
              ? !threadIds.has(entry.id)
              : menuTargetId !== null && menuTargetId !== entry.id
                ? "soft"
                : false
          }
          threadFocused={threadIds !== null && threadIds.has(entry.id)}
        >
          {entry.quote ? <ChatMessageQuote>{entry.quote}</ChatMessageQuote> : null}
          <ContextMenu
            onOpenChange={(open) => setMenuTargetId(open ? entry.id : null)}
          >
            <ContextMenuTrigger asChild>
              <ChatBubble
                role="button"
                aria-label={`Reply to: ${entry.text}`}
                aria-haspopup="menu"
                title="Right-click to reply or react"
                tabIndex={0}
                reaction={reactions[entry.id]}
              >
                {entry.text}
              </ChatBubble>
            </ContextMenuTrigger>
            <ContextMenuContent
              aria-label="Message actions"
              className="min-w-0 w-fit"
              collisionBoundary={frameElement ?? undefined}
              collisionPadding={8}
            >
              {/* Each tapback is its own menu item, so arrow keys reach
                  every emoji and Enter applies it. */}
              <div className="flex max-w-60 items-center gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {chatReactionOptions.map((option) => (
                  <ContextMenuItem
                    key={option.emoji}
                    asChild
                    onSelect={() => {
                      setReactions((current) =>
                        current[entry.id] === option.emoji
                          ? Object.fromEntries(
                              Object.entries(current).filter(
                                ([id]) => Number(id) !== entry.id,
                              ),
                            )
                          : { ...current, [entry.id]: option.emoji },
                      )
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`React with ${option.label}`}
                      className={
                        reactions[entry.id] === option.emoji
                          ? "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-(--nessa-chat-accent) p-0 font-sans nessa-text-6 data-[highlighted]:bg-accent"
                          : "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 font-sans nessa-text-6 data-[highlighted]:bg-accent"
                      }
                    >
                      {option.emoji}
                    </button>
                  </ContextMenuItem>
                ))}
              </div>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => setReplyTargetId(entry.id)}>
                Reply
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          {entry.id === 3 ? <ChatMessageReceipt>Delivered</ChatMessageReceipt> : null}
        </ChatMessage>
      ))}
    </div>
  )
}

/** A stack of mixed attachments that opens the full-surface grid viewer. */
function AttachmentsExample() {
  const [viewerOpen, setViewerOpen] = React.useState(false)
  const tiles = [
    <ChatAttachmentTile key="sunset" label="Sunset" imageSrc={sunset} />,
    <ChatAttachmentTile
      key="notes"
      label="release-notes.md"
      icon={<Paperclip aria-hidden="true" />}
    />,
    <ChatAttachmentTile
      key="assets"
      label="design-assets"
      icon={<Folder aria-hidden="true" />}
    />,
    <ChatAttachmentTile key="ocean" label="Ocean" imageSrc={ocean} />,
  ]
  return (
    <div className="relative flex h-[26rem] min-w-0 w-[min(24rem,calc(100vw-2rem))] flex-col justify-end gap-2 rounded-[2rem] bg-background p-4">
      <ChatMessage tone="sent" animateIn={false}>
        <ChatAttachmentStack count={4} onOpen={() => setViewerOpen(true)}>
          {tiles.map((tile) =>
            React.cloneElement(tile, { className: "size-28" }),
          )}
        </ChatAttachmentStack>
        <ChatBubble>here you go</ChatBubble>
      </ChatMessage>
      {viewerOpen ? (
        <ChatAttachmentViewer
          onClose={() => setViewerOpen(false)}
          summary="2 Photos, 1 File, 1 Folder"
        >
          {tiles.map((tile) =>
            React.cloneElement(tile, {
              className: "size-28",
              onOpen: () => undefined,
            }),
          )}
        </ChatAttachmentViewer>
      ) : null}
    </div>
  )
}

const richReply = `## Reconciling the Q3 numbers

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
SELECT SUM(amount) FROM invoices
WHERE status != 'pending';
\`\`\`

More detail in the [reconciliation notes](https://example.com/notes).`

/**
 * Streams the rich reply the way a live agent would: a thinking beat with
 * the typing dots, then the markdown source arriving in chunks through
 * MessageMarkdown's streaming mode, with a scaffolding control to replay.
 */
function MarkdownStreamingExample() {
  const [phase, setPhase] = React.useState<"thinking" | "streaming" | "done">(
    "thinking",
  )
  const [source, setSource] = React.useState("")
  const timers = React.useRef<{
    timeout: ReturnType<typeof setTimeout> | null
    interval: ReturnType<typeof setInterval> | null
  }>({ timeout: null, interval: null })
  const clearTimers = React.useCallback(() => {
    if (timers.current.timeout) clearTimeout(timers.current.timeout)
    if (timers.current.interval) clearInterval(timers.current.interval)
    timers.current = { timeout: null, interval: null }
  }, [])
  const run = React.useCallback(() => {
    clearTimers()
    setPhase("thinking")
    setSource("")
    timers.current.timeout = setTimeout(() => {
      setPhase("streaming")
      let revealed = 0
      timers.current.interval = setInterval(() => {
        revealed = Math.min(revealed + 40, richReply.length)
        setSource(richReply.slice(0, revealed))
        if (revealed >= richReply.length) {
          clearTimers()
          setPhase("done")
        }
      }, 80)
    }, 700)
  }, [clearTimers])
  React.useEffect(() => {
    run()
    return clearTimers
  }, [clearTimers, run])
  return (
    <div className="flex min-w-0 w-[min(34rem,calc(100vw-2rem))] flex-col gap-4 rounded-[2rem] bg-background p-4">
      <div role="log" aria-label="Conversation" className="flex flex-col gap-2">
        <ChatMessage tone="sent" animateIn={false}>
          <ChatBubble>Why do the Q3 numbers differ between surfaces?</ChatBubble>
        </ChatMessage>
        {phase === "thinking" ? (
          <ChatTypingIndicator label="Assistant is typing" />
        ) : (
          <ChatMessage tone="received" animateIn={false} className="max-w-[95%]">
            <ChatBubble className="px-4 py-3">
              <MessageMarkdown
                streaming={phase === "streaming"}
                className="leading-5"
              >
                {source}
              </MessageMarkdown>
            </ChatBubble>
          </ChatMessage>
        )}
      </div>
      <button
        type="button"
        onClick={run}
        className="self-start rounded-full border border-border bg-card px-3 py-1.5 font-sans nessa-text-4 text-card-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Replay stream
      </button>
    </div>
  )
}

const meta = {
  title: "Conversation/ChatBubbles",
  component: ChatMessage,
  args: { tone: "received" },
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "iMessage-style transcript primitives that compose with PillComposer: ChatMessage aligns a sent or received column and springs in on mount; ChatBubble is the colored bubble (a real button when it carries an onSelect action such as reply); ChatMessageQuote and ChatMessageReceipt add reply context and delivery state; ChatTypingIndicator pulses while the agent responds; ChatReactionPicker (with the exported chatReactionOptions) is the iMessage tapback row, cascading in per emoji and composing into ContextMenu hosts as keyboard-reachable menu items; and ChatAttachmentTile, ChatAttachmentStack, and ChatAttachmentViewer give every attachment kind one square-tile language — fanned into a one-direction stack when collapsed and filling the chat frame as a grid when opened.",
      },
    },
  },
} satisfies Meta<typeof ChatMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Conversation: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Sent and received messages with a reply quote and a delivery receipt. Right-clicking or long-pressing a bubble shows the iMessage tapback row and a Reply action — reacting applies only iMessage's light dim to the rest of the transcript, while choosing Reply focuses the whole thread behind the full frost — picking an emoji pins it to the bubble's corner, picking it again clears it — the tapped message, the message it replies to, and every reply chained onto it stay sharp while the rest of the transcript recedes behind a frosted blur, and in-thread quotes hide since the replied-to message is already on screen.  Repeating the gesture or pressing Escape releases the focus.",
  ),
  render: () => <ConversationExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const first = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-message"]',
    )!
    await expect(getComputedStyle(first).filter).toBe("none")
    await expect(canvas.getByText("Delivered")).toBeInTheDocument()
    const quote = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-message-quote"]',
    )!
    await expect(quote).toHaveTextContent(
      "On it — I'll take a look and report back.",
    )
    const messages = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="chat-message"]',
    )
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByLabelText(
        "Reply to: On it — I'll take a look and report back.",
      ),
    })
    // The tapback menu applies only the light dim — opacity, never blur.
    await expect(getComputedStyle(first).filter).toBe("none")
    await waitFor(() => {
      expect(Number(getComputedStyle(first).opacity)).toBeLessThan(1)
    })
    await userEvent.click(await body.findByRole("menuitem", { name: "Reply" }))
    await waitFor(() => {
      expect(getComputedStyle(first).filter).toContain("blur")
    })
    // The reply target's thread stays sharp: the target itself and the
    // "thanks" reply chained onto it.
    await expect(getComputedStyle(messages[1]!).filter).toBe("none")
    await expect(getComputedStyle(messages[2]!).filter).toBe("none")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      expect(getComputedStyle(first).filter).toBe("none")
    })
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByLabelText("Reply to: thanks"),
    })
    await userEvent.click(await body.findByRole("menuitem", { name: "Reply" }))
    await waitFor(() => {
      expect(getComputedStyle(first).filter).toContain("blur")
    })
    // In the focused thread the redundant quote hides.
    await expect(getComputedStyle(messages[1]!).filter).toBe("none")
    await expect(getComputedStyle(messages[2]!).filter).toBe("none")
    await expect(
      canvasElement.querySelector('[data-slot="chat-message-quote"]'),
    ).not.toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      expect(getComputedStyle(first).filter).toBe("none")
    })
    // Reacting from the tapback row lands the badge without any frost.
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByLabelText("Reply to: thanks"),
    })
    await expect(getComputedStyle(first).filter).toBe("none")
    await userEvent.click(
      await body.findByRole("menuitem", { name: "React with love" }),
    )
    const badge = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-reaction"]',
    )!
    await expect(badge).toHaveTextContent("❤️")
    // Right-click again and re-pick the same emoji — by keyboard this time
    // (each tapback is a real menu item, so arrows + Enter reach it) — to
    // clear it.
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByLabelText("Reply to: thanks"),
    })
    await body.findByRole("menuitem", { name: "React with love" })
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Enter}")
    await expect(
      canvasElement.querySelector('[data-slot="chat-reaction"]'),
    ).not.toBeInTheDocument()
  },
}

export const Markdown: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "A full markdown agent reply inside a received bubble: MessageMarkdown handles headings, emphasis, ordered lists, tables, blockquotes, links, inline code, and fenced code (Shiki-highlighted CodeBlock with its copy control) — and its streaming mode fades new words in while a reply is still arriving. The bubble simply grows around it; wide content scrolls inside the bubble.",
  ),
  render: () => (
    <div
      role="log"
      aria-label="Conversation"
      className="flex min-w-0 w-[min(34rem,calc(100vw-2rem))] flex-col gap-2 rounded-[2rem] bg-background p-4"
    >
      <ChatMessage tone="sent" animateIn={false}>
        <ChatBubble>Why do the Q3 numbers differ between surfaces?</ChatBubble>
      </ChatMessage>
      <ChatMessage tone="received" animateIn={false} className="max-w-[95%]">
        <ChatBubble reaction="❤️" className="px-4 py-3">
          <MessageMarkdown className="leading-5">{richReply}</MessageMarkdown>
        </ChatBubble>
      </ChatMessage>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { name: "Reconciling the Q3 numbers" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("link", { name: "reconciliation notes" }),
    ).toBeInTheDocument()
    await expect(canvas.getByText("September")).toBeInTheDocument()
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-slot="code-block"]'),
      ).toBeInTheDocument()
    })
    const badge = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-reaction"]',
    )!
    await expect(badge).toHaveTextContent("❤️")
  },
}

export const MarkdownStreaming: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The same rich reply arriving live: a thinking beat with the typing dots, then the markdown source streams in chunks through MessageMarkdown's streaming mode — new words fade in, tables and lists build row by row, and the code block renders once its fence completes. Replay restarts the stream.",
  ),
  render: () => <MarkdownStreamingExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("status", { name: "Assistant is typing" }),
    ).toBeInTheDocument()
    await waitFor(
      () => {
        expect(
          canvas.getByRole("heading", { name: "Reconciling the Q3 numbers" }),
        ).toBeInTheDocument()
      },
      { timeout: 4000 },
    )
    await waitFor(
      () => {
        expect(
          canvas.getByRole("link", { name: "reconciliation notes" }),
        ).toBeInTheDocument()
        expect(
          canvasElement.querySelector('[data-slot="code-block"]'),
        ).toBeInTheDocument()
      },
      { timeout: 6000 },
    )
    await userEvent.click(canvas.getByRole("button", { name: "Replay stream" }))
    await expect(
      canvas.getByRole("status", { name: "Assistant is typing" }),
    ).toBeInTheDocument()
    await waitFor(
      () => {
        expect(
          canvas.getByRole("link", { name: "reconciliation notes" }),
        ).toBeInTheDocument()
      },
      { timeout: 8000 },
    )
    // Wait out the replayed code block's async Shiki highlight — its
    // pre-highlight placeholder is an overflow region axe would flag.
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-slot="code-block"]'),
        ).toBeInTheDocument()
        expect(canvasElement.querySelector('code[data-code=""]')).toBeNull()
      },
      { timeout: 6000 },
    )
    await waitFor(
      () => {
        const running = canvasElement
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running")
        expect(running).toHaveLength(0)
      },
      { timeout: 6000 },
    )
  },
}

export const Typing: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The typing indicator announces itself as a status region; its dots pulse in sequence, and hold steady under reduced motion.",
  ),
  render: () => (
    <div className="flex w-64 flex-col rounded-[2rem] bg-background p-4">
      <ChatTypingIndicator label="Assistant is typing" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const indicator = canvas.getByRole("status", { name: "Assistant is typing" })
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    if (reducedMotion) {
      await expect(indicator.getAnimations({ subtree: true })).toHaveLength(0)
    } else {
      await waitFor(() => {
        expect(indicator.getAnimations({ subtree: true })).toHaveLength(3)
      })
    }
  },
}

export const Attachments: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Every attachment kind shares the square tile. Multiple attachments collapse into a one-direction fanned stack labeled with a count; both the label and the stack open the full-surface viewer, which fills the chat frame with a tile grid and a per-kind summary. Back or Escape closes it.",
  ),
  render: () => <AttachmentsExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Show all 4 attachments" }),
    )
    const viewer = canvas.getByRole("dialog", { name: "Attachments" })
    await expect(
      within(viewer).getByRole("button", { name: "Open Sunset" }),
    ).toBeInTheDocument()
    await expect(
      within(viewer).getByText("2 Photos, 1 File, 1 Folder"),
    ).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    await expect(
      canvas.queryByRole("dialog", { name: "Attachments" }),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "4 items" }))
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to conversation" }),
    )
    await expect(
      canvas.queryByRole("dialog", { name: "Attachments" }),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      const running = canvasElement
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running")
      expect(running).toHaveLength(0)
    })
  },
}
