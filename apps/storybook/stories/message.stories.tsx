import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  ChatComposer,
  ChatComposerActions,
  ChatComposerFooter,
  ChatComposerInput,
  Input,
  Message,
  MessageAction,
  MessageActions,
  MessageAttachment,
  MessageAttachments,
  MessageAvatar,
  MessageBubble,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
  MessageStreamText,
  MessageThread,
  MessageThreadReplies,
  MessageThreadSummary,
} from "@nessalabs/ui"
import {
  Check,
  Copy,
  FileSpreadsheet,
  Pencil,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import { storyDocumentation } from "./story-documentation"


const avatarImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#6366f1"/><circle cx="16" cy="12" r="6" fill="#fff"/><path d="M4 31a12 12 0 0 1 24 0z" fill="#fff"/></svg>',
)}`

function ThreadFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-6">
      {children}
    </div>
  )
}

const meta = {
  title: "Conversation/Message",
  component: Message,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A composable chat message kit. Message lays out one conversation row and aligns it from the sender — from=\"user\" end-aligns, from=\"assistant\" start-aligns, and align overrides either — while exposing data-from and data-align for host styling. Inside it, MessageAvatar is an optional slot that renders an image with an initials fallback by default and accepts arbitrary children for fully custom avatars; MessageContent columns the optional MessageHeader, a MessageBubble, and the optional MessageFooter. The bubble ships three variants: muted for received messages, primary for sent messages, and plain for unbubbled prose such as assistant responses. MessageGroup tightens spacing between consecutive messages from the same sender. Slack-style threading composes from MessageThread wrapping a parent row, MessageThreadSummary — a facepile-plus-count button whose meta text swaps to an action label on hover, with expansion state host-owned via onClick and aria-expanded — and MessageThreadReplies, which indents replies to the parent's content column behind a connector rule. MessageActions is a hover-revealed action row under a bubble — MessageAction icon buttons alongside meta text such as the sent time — that also reveals while an action holds keyboard focus and hides again once the pointer moves on; what each action does, including swapping the bubble for an edit composer, stays host-owned. Every piece is an ordinary styled element, so hosts compose their own user and response message components from these primitives — or replace any slot entirely — instead of configuring a monolith.",
      },
    },
  },
} satisfies Meta<typeof Message>

export default meta
type Story = StoryObj<typeof meta>

export const Conversation: Story = {
  parameters: storyDocumentation(
    "The default two-sided design: assistant rows start-align with an avatar, sender header, and muted bubble; user rows end-align with a primary bubble and status footer, no avatar.",
  ),
  render: () => (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent>
          <MessageHeader>Nessa</MessageHeader>
          <MessageBubble>
            Hey! I just pushed the sidebar refactor. Want me to walk you
            through the composition changes?
          </MessageBubble>
        </MessageContent>
      </Message>
      <Message from="user">
        <MessageContent>
          <MessageBubble variant="primary">
            Yes please — start with how the provider owns collapse state.
          </MessageBubble>
          <MessageFooter>Sent · Just now</MessageFooter>
        </MessageContent>
      </Message>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent>
          <MessageHeader>Nessa</MessageHeader>
          <MessageBubble>
            SidebarProvider keeps the open state and exposes it through
            useSidebar, so every trigger stays in sync.
          </MessageBubble>
        </MessageContent>
      </Message>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const userBubble = canvas.getByText(
      "Yes please — start with how the provider owns collapse state.",
    )
    const userRow = userBubble.closest('[data-slot="message"]')!
    await expect(userRow).toHaveAttribute("data-align", "end")
    await expect(userRow).toHaveAttribute("data-from", "user")
    const assistantRow = canvas
      .getByText(/walk you through the composition changes/)
      .closest('[data-slot="message"]')!
    await expect(assistantRow).toHaveAttribute("data-align", "start")
    await expect(canvas.getAllByText("Nessa")).toHaveLength(2)
    await expect(canvas.getByText("Sent · Just now")).toBeVisible()
  },
}

export const PlainResponse: Story = {
  parameters: storyDocumentation(
    "Assistant responses can drop the bubble entirely with variant=\"plain\", spanning the full row like a prose reply while the user side keeps its bubble.",
  ),
  render: () => (
    <ThreadFrame>
      <Message from="user">
        <MessageContent>
          <MessageBubble variant="primary">
            Explain the cascade layers nessa ships.
          </MessageBubble>
        </MessageContent>
      </Message>
      <Message from="assistant">
        <MessageContent className="max-w-full">
          <MessageBubble variant="plain">
            Nessa declares theme, base, nessa.tokens, nessa.components,
            components, and utilities once in theme.css. Tokens live in
            nessa.tokens, compiled component rules in nessa.components, and
            unlayered consumer CSS always wins over Nessa defaults, so hosts
            can override any piece without fighting specificity.
          </MessageBubble>
          <MessageFooter>Generated in 1.2s</MessageFooter>
        </MessageContent>
      </Message>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const plain = canvas.getByText(/unlayered consumer CSS always wins/)
    await expect(plain).toHaveAttribute("data-variant", "plain")
    const backgroundColor = getComputedStyle(plain).backgroundColor
    await expect(["rgba(0, 0, 0, 0)", "transparent"]).toContain(backgroundColor)
    await expect(
      canvas.getByText("Explain the cascade layers nessa ships."),
    ).toHaveAttribute("data-variant", "primary")
  },
}

function ActionsAndEditingExample() {
  const [text, setText] = React.useState(
    "Do we have all our changes pushed to GitHub?",
  )
  const [draft, setDraft] = React.useState("")
  const [editing, setEditing] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [reaction, setReaction] = React.useState<"up" | "down" | null>(null)
  const editorRef = React.useRef<HTMLTextAreaElement | null>(null)

  // Focus lands in the editor with the caret at the end. Programmatic focus
  // (unlike autoFocus) keeps :focus-visible tied to how the edit began, so
  // pointer clicks skip the inner outline while keyboard users keep it.
  React.useEffect(() => {
    const editor = editorRef.current
    if (!editing || editor === null) return
    editor.focus()
    editor.setSelectionRange(editor.value.length, editor.value.length)
  }, [editing])

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard access can be denied in embedded frames; the copied state
      // below still demonstrates the interaction.
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const cancelEdit = () => setEditing(false)

  return (
    <ThreadFrame>
      <Message from="user">
        <MessageContent className={editing ? "w-full max-w-full" : undefined}>
          {editing ? (
            <ChatComposer
              size="compact"
              borderMode="always"
              className="w-full"
              onSubmit={(event) => {
                event.preventDefault()
                setText(draft)
                setEditing(false)
              }}
            >
              <ChatComposerInput
                ref={editorRef}
                aria-label="Edit message"
                // The composer surface already shows the focus ring through
                // borderMode="always", so the input's own outline would double
                // up inside it.
                className="focus-visible:[outline-style:none]"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelEdit()
                }}
              />
              <ChatComposerFooter className="justify-end">
                <ChatComposerActions className="gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Send
                  </Button>
                </ChatComposerActions>
              </ChatComposerFooter>
            </ChatComposer>
          ) : (
            <>
              <MessageBubble variant="primary">{text}</MessageBubble>
              <MessageActions>
                <span className="pr-1 tabular-nums">9:57 PM</span>
                <MessageAction
                  aria-label={copied ? "Copied" : "Copy message"}
                  onClick={copyMessage}
                >
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </MessageAction>
                <MessageAction
                  aria-label="Edit message"
                  onClick={() => {
                    setDraft(text)
                    setEditing(true)
                  }}
                >
                  <Pencil aria-hidden="true" />
                </MessageAction>
              </MessageActions>
            </>
          )}
        </MessageContent>
      </Message>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent>
          <MessageBubble>
            Everything on this branch is committed and pushed — the remote is
            up to date.
          </MessageBubble>
          <MessageActions>
            <MessageAction
              aria-label="Good response"
              aria-pressed={reaction === "up"}
              className={reaction === "up" ? "bg-accent text-foreground" : undefined}
              onClick={() =>
                setReaction((current) => (current === "up" ? null : "up"))
              }
            >
              <ThumbsUp aria-hidden="true" />
            </MessageAction>
            <MessageAction
              aria-label="Bad response"
              aria-pressed={reaction === "down"}
              className={reaction === "down" ? "bg-accent text-foreground" : undefined}
              onClick={() =>
                setReaction((current) => (current === "down" ? null : "down"))
              }
            >
              <ThumbsDown aria-hidden="true" />
            </MessageAction>
          </MessageActions>
        </MessageContent>
      </Message>
    </ThreadFrame>
  )
}

export const ActionsAndEditing: Story = {
  parameters: storyDocumentation(
    "MessageActions puts an icon-action row under the bubble — here the sent time with copy and edit on the user side, reactions on the assistant side — that stays transparent until the message row is hovered or an action receives keyboard focus. Every behavior is host-owned through onClick: copy writes the clipboard and swaps its icon to a check, the reactions toggle aria-pressed, and edit swaps the bubble for a compact ChatComposer prefilled with the message — Send commits the new text, Cancel or Escape restores the bubble unchanged. Compose the same row with retry, share, or anything else your transcript needs.",
  ),
  render: () => <ActionsAndEditingExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const copyAction = canvas.getByRole("button", { name: "Copy message" })
    const actionsRow = copyAction.closest(
      '[data-slot="message-actions"]',
    ) as HTMLElement
    // Actions stay transparent until the row is hovered or an action holds
    // keyboard focus.
    await expect(Number(getComputedStyle(actionsRow).opacity)).toBe(0)
    const activeElement = () => canvasElement.ownerDocument.activeElement
    for (let hops = 0; hops < 12 && activeElement() !== copyAction; hops += 1) {
      await userEvent.tab()
    }
    await expect(copyAction).toHaveFocus()
    await waitFor(() =>
      expect(Number(getComputedStyle(actionsRow).opacity)).toBe(1),
    )
    // Copy confirms by swapping to a check. The copied state lands only
    // after the async clipboard write settles, so the query must retry.
    await userEvent.click(copyAction)
    await expect(
      await canvas.findByRole("button", { name: "Copied" }),
    ).toBeVisible()
    // Edit swaps the bubble for a prefilled composer.
    await userEvent.click(canvas.getByRole("button", { name: "Edit message" }))
    const editor = canvas.getByRole("textbox", { name: "Edit message" })
    await expect(editor).toHaveValue(
      "Do we have all our changes pushed to GitHub?",
    )
    // Cancel restores the original bubble unchanged.
    await userEvent.type(editor, " Really?")
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }))
    await expect(
      canvas.getByText("Do we have all our changes pushed to GitHub?"),
    ).toBeVisible()
    // Send commits the edited text.
    await userEvent.click(canvas.getByRole("button", { name: "Edit message" }))
    const reopened = canvas.getByRole("textbox", { name: "Edit message" })
    await userEvent.clear(reopened)
    await userEvent.type(reopened, "Is everything on this branch on GitHub?")
    await userEvent.click(canvas.getByRole("button", { name: "Send" }))
    await expect(
      canvas.getByText("Is everything on this branch on GitHub?"),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("textbox", { name: "Edit message" }),
    ).not.toBeInTheDocument()
    // Reactions are ordinary toggle buttons with host-owned pressed state.
    const thumbsUp = canvas.getByRole("button", { name: "Good response" })
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(thumbsUp)
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "true")
  },
}

const streamedText = `Streaming responses render one chunk at a time: the host appends text as it arrives from the model and flips the streaming flag off once the reply is complete, which clears the busy state on the bubble. The reveal below paces itself to however fast those chunks land, so the motion stays continuous through chunk boundaries instead of stopping and surging.

A longer reply gives the pacing something real to chew on. As this paragraph streams in you should see the reveal ride a steady cushion behind the newest received text: when a burst lands the velocity eases up smoothly, and when the simulated network goes quiet the reveal drains what it has, decelerates, and only then pauses. Nothing here is rate-capped — crank the chunk controls and the reveal keeps up, trailing by the same cushion.

Line breaks survive the trip too, because the simulated chunks preserve whitespace exactly as a real token stream would. Play with the trail to change how far the display rides behind the stream edge, the adapt to change how hard chunk boundaries are smoothed, the fade to stretch or sharpen each letter's entrance, and the floor speed to control how the tail finishes once the stream runs dry. The numbers you land on transfer directly to MessageStreamText props in your host.`

/**
 * Simulates a bursty network stream: tokens (words with their trailing
 * whitespace, so newlines survive) are delivered in fixed-size chunks on an
 * interval. The stream runs once and stops at the end so the finished result
 * stays on screen; `replay` restarts it from the beginning.
 */
function useSimulatedStream(
  source: string,
  chunkWords: number,
  chunkInterval: number,
  initialWords = 2,
) {
  const tokens = React.useMemo(() => source.match(/\S+\s*/g) ?? [], [source])
  const [received, setReceived] = React.useState(initialWords)
  const [run, setRun] = React.useState(0)
  React.useEffect(() => {
    setReceived(initialWords)
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
  }, [chunkInterval, chunkWords, initialWords, run, tokens.length])
  return {
    text: tokens.slice(0, Math.min(received, tokens.length)).join(""),
    done: received >= tokens.length,
    replay: () => setRun((current) => current + 1),
  }
}

function ReplayControl({ done, onReplay }: { done: boolean; onReplay: () => void }) {
  if (!done) return null
  return (
    <div className="flex justify-center">
      <Button size="sm" variant="outline" onClick={onReplay}>
        Replay stream
      </Button>
    </div>
  )
}

interface StreamingStoryArgs {
  speed: number
  trail: number
  adapt: number
  fade: number
  chunkWords: number
  chunkInterval: number
}

function StreamingResponseExample({
  speed,
  trail,
  adapt,
  fade,
  chunkWords,
  chunkInterval,
}: StreamingStoryArgs) {
  // Chunks arrive in bursts like a real network stream; MessageStreamText
  // paces the reveal to however fast they land.
  const stream = useSimulatedStream(streamedText, chunkWords, chunkInterval)
  return (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent className="max-w-full">
          <MessageHeader>Nessa · streaming</MessageHeader>
          <MessageBubble variant="plain" streaming={!stream.done}>
            <MessageStreamText
              text={stream.text}
              speed={speed}
              trail={trail}
              adapt={adapt}
              fade={fade}
            />
          </MessageBubble>
        </MessageContent>
      </Message>
      <ReplayControl done={stream.done} onReplay={stream.replay} />
    </ThreadFrame>
  )
}

export const StreamingResponse: StoryObj<StreamingStoryArgs> = {
  args: {
    speed: 200,
    trail: 0.3,
    adapt: 0.4,
    fade: 1000,
    chunkWords: 20,
    chunkInterval: 600,
  },
  argTypes: {
    speed: {
      control: { type: "range", min: 0, max: 200, step: 5 },
      description:
        "Floor rate in characters per second, used only to finish the tail once the stream runs dry.",
    },
    trail: {
      control: { type: "range", min: 0.05, max: 2, step: 0.05 },
      description:
        "Target cushion in seconds between the revealed text and the newest received text.",
    },
    adapt: {
      control: { type: "range", min: 0, max: 1, step: 0.05 },
      description:
        "Seconds for the reveal velocity to ease toward its target; 0 tracks it instantly.",
    },
    fade: {
      control: { type: "range", min: 0, max: 1000, step: 50 },
      description: "Fade duration in milliseconds for each revealed character.",
    },
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
    "The host feeds MessageStreamText the complete text received so far — here in simulated network chunks you can reshape with the chunkWords and chunkInterval controls — and the reveal paces itself to the incoming stream: fast arrivals reveal fast, slow arrivals reveal slowly, trailing the newest text by the trail cushion while each newly revealed letter fades in over the fade duration, so chunk boundaries disappear into one continuous letter-by-letter reveal that pauses only when the buffer truly runs dry. The speed, trail, adapt, and fade controls map directly to MessageStreamText props, so tune the feel here and copy the numbers into your host. This is the one streaming display; pass a children render function (or use useMessageStreamText directly) to swap the display treatment while keeping the smoothing. The streaming bubble carries aria-busy and data-streaming with no caret. The stream runs once so the finished text stays inspectable; a replay button appears when it completes.",
  ),
  render: (args) => <StreamingResponseExample {...args} />,
  play: async ({ canvasElement }) => {
    const streamingBubble = canvasElement.querySelector(
      '[data-slot="message-bubble"]',
    )!
    await expect(streamingBubble).toHaveAttribute("data-streaming", "true")
    await expect(streamingBubble).toHaveAttribute("aria-busy", "true")
    // The streaming state renders no caret; the reveal itself is the signal.
    const caret = getComputedStyle(streamingBubble, "::after")
    await expect(caret.content).toBe("none")
    const streamText = streamingBubble.querySelector(
      '[data-slot="message-stream-text"]',
    )!
    const initialLength = streamText.textContent!.length
    await waitFor(() =>
      expect(streamText.textContent!.length).not.toBe(initialLength),
    )
    // Characters revealed after mount render as single-grapheme fade-in
    // spans; the initial text stays span-free so saved transcripts never
    // replay animation.
    await waitFor(() => {
      const spans = streamText.querySelectorAll("span")
      expect(spans.length).toBeGreaterThan(0)
      for (const span of spans) {
        expect(span.textContent!.length).toBeLessThanOrEqual(2)
      }
    })
  },
}

const attachmentImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#1e293b"/><rect x="14" y="52" width="14" height="30" fill="#818cf8"/><rect x="34" y="38" width="14" height="44" fill="#a5b4fc"/><rect x="54" y="24" width="14" height="58" fill="#c7d2fe"/><rect x="74" y="44" width="8" height="38" fill="#818cf8"/></svg>',
)}`

function WithAttachmentsExample() {
  const [opened, setOpened] = React.useState<string | null>(null)
  return (
    <ThreadFrame>
      <Message from="user">
        <MessageContent>
          <MessageAttachments>
            <MessageAttachment
              src={attachmentImage}
              name="q3-dashboard.png"
              onClick={() => setOpened("q3-dashboard.png")}
            />
            <MessageAttachment
              name="q3-report.pdf"
              meta="PDF · 2.4 MB"
              onClick={() => setOpened("q3-report.pdf")}
            />
            <MessageAttachment
              name="reconciliation.csv"
              meta="CSV · 18 KB"
              icon={<FileSpreadsheet />}
              onClick={() => setOpened("reconciliation.csv")}
            />
          </MessageAttachments>
          <MessageBubble variant="primary">
            Here are the dashboard shot and the raw numbers — can you reconcile
            them?
          </MessageBubble>
          <MessageFooter>
            {opened === null ? "Click an attachment" : `Opened ${opened}`}
          </MessageFooter>
        </MessageContent>
      </Message>
    </ThreadFrame>
  )
}

export const WithAttachments: Story = {
  parameters: storyDocumentation(
    "Attachments present one at a time in a uniform square tile — images fill the tile as a thumbnail, every other kind shows an icon with the name and meta stacked beneath, so a PDF, spreadsheet, or anything else reads the same. With more than one attachment a pager steps through them with previous/next controls around a live position counter. Clicking a tile is entirely host-owned: pass onClick and the tile renders as a button running whatever open, preview, or download behavior you want — here it just reports the opened file in the footer. On end-aligned rows the tile and pager right-align.",
  ),
  render: () => <WithAttachmentsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // One tile at a time, starting with the image.
    await expect(
      canvasElement.querySelectorAll('[data-slot="message-attachment"]'),
    ).toHaveLength(1)
    // The interactive image tile is named by the button, not the img alt.
    await expect(
      canvas.getByRole("button", { name: "q3-dashboard.png" }),
    ).toBeVisible()
    await expect(canvas.getByText("1 / 3")).toBeVisible()
    const previous = canvas.getByRole("button", {
      name: "Previous attachment",
    })
    await expect(previous).toBeDisabled()
    // Next steps to the PDF in the same square tile.
    await userEvent.click(
      canvas.getByRole("button", { name: "Next attachment" }),
    )
    const pdfTile = canvas
      .getByText("q3-report.pdf")
      .closest('[data-slot="message-attachment"]')!
    await expect(pdfTile).toHaveAttribute("data-kind", "file")
    await expect(canvas.getByText("2 / 3")).toBeVisible()
    await expect(previous).toBeEnabled()
    // Clicking the tile runs the host's own handler.
    await userEvent.click(pdfTile)
    await expect(canvas.getByText("Opened q3-report.pdf")).toBeVisible()
    // The last attachment disables next.
    await userEvent.click(
      canvas.getByRole("button", { name: "Next attachment" }),
    )
    await expect(canvas.getByText("reconciliation.csv")).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "Next attachment" }),
    ).toBeDisabled()
  },
}

export const Avatars: Story = {
  parameters: storyDocumentation(
    "MessageAvatar renders an image when src resolves, falls back to initials when the image is missing or fails to load, and accepts children for a completely custom avatar treatment.",
  ),
  render: () => (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar src={avatarImage} alt="Ada Lovelace" />
        <MessageContent>
          <MessageHeader>Ada · image avatar</MessageHeader>
          <MessageBubble>This avatar comes from an image source.</MessageBubble>
        </MessageContent>
      </Message>
      <Message from="assistant">
        <MessageAvatar src="data:image/png;base64,broken" fallback="AL" alt="" />
        <MessageContent>
          <MessageHeader>Ada · broken image</MessageHeader>
          <MessageBubble>
            A failed image load falls back to the initials.
          </MessageBubble>
        </MessageContent>
      </Message>
      <Message from="assistant">
        <MessageAvatar>
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center bg-primary text-primary-foreground"
          >
            ✦
          </span>
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>Custom avatar children</MessageHeader>
          <MessageBubble>
            Children replace the built-in image and fallback rendering.
          </MessageBubble>
        </MessageContent>
      </Message>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByAltText("Ada Lovelace")).toBeVisible()
    await waitFor(() => expect(canvas.getByText("AL")).toBeVisible())
    await expect(canvas.getByText("✦")).toBeVisible()
  },
}

export const GroupedMessages: Story = {
  parameters: storyDocumentation(
    "MessageGroup stacks consecutive messages from the same sender with tightened spacing, so multi-bubble turns read as one unit while separate turns keep the thread gap.",
  ),
  render: () => (
    <ThreadFrame>
      <MessageGroup>
        <Message from="user">
          <MessageContent>
            <MessageBubble variant="primary">
              Can the composer cap its height?
            </MessageBubble>
          </MessageContent>
        </Message>
        <Message from="user">
          <MessageContent>
            <MessageBubble variant="primary">
              And keep the footer visible while the input scrolls?
            </MessageBubble>
            <MessageFooter>Sent · 9:41</MessageFooter>
          </MessageContent>
        </Message>
      </MessageGroup>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent>
          <MessageBubble>
            Yes — maxHeight caps the whole surface and the input owns the
            overflow, so the footer never scrolls out of view.
          </MessageBubble>
        </MessageContent>
      </Message>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvasElement.querySelector('[data-slot="message-group"]')!
    const grouped = group.querySelectorAll('[data-slot="message"]')
    await expect(grouped).toHaveLength(2)
    const groupGap = parseFloat(getComputedStyle(group).rowGap)
    const threadGap = parseFloat(getComputedStyle(group.parentElement!).rowGap)
    await expect(groupGap).toBeLessThan(threadGap)
    await expect(canvas.getByText("Sent · 9:41")).toBeVisible()
  },
}

export const AlignedThread: Story = {
  parameters: storyDocumentation(
    "align overrides the side derived from from: this Slack-style thread start-aligns every row — including the user's — while data-from keeps identifying the sender for styling, here tinting the user bubble.",
  ),
  render: () => (
    <ThreadFrame>
      <Message from="user" align="start">
        <MessageAvatar fallback="SP" alt="Saurav" />
        <MessageContent>
          <MessageHeader>Saurav · 9:40</MessageHeader>
          <MessageBubble variant="plain">
            Does the registry item need its own base dependency?
          </MessageBubble>
        </MessageContent>
      </Message>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent>
          <MessageHeader>Nessa · 9:41</MessageHeader>
          <MessageBubble variant="plain">
            Yes — every registry:ui item depends on nessa-base and utils so the
            token chain installs with the component.
          </MessageBubble>
        </MessageContent>
      </Message>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const userRow = canvas
      .getByText("Does the registry item need its own base dependency?")
      .closest('[data-slot="message"]')!
    await expect(userRow).toHaveAttribute("data-from", "user")
    await expect(userRow).toHaveAttribute("data-align", "start")
    const assistantRow = canvas
      .getByText(/token chain installs with the component/)
      .closest('[data-slot="message"]')!
    const userRect = userRow
      .querySelector('[data-slot="message-avatar"]')!
      .getBoundingClientRect()
    const assistantRect = assistantRow
      .querySelector('[data-slot="message-avatar"]')!
      .getBoundingClientRect()
    await expect(userRect.left).toBeCloseTo(assistantRect.left, 0)
  },
}

function ThreadedRepliesExample() {
  const [open, setOpen] = React.useState(false)
  return (
    <ThreadFrame>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent>
          <MessageHeader>Nessa · 9:12</MessageHeader>
          <MessageBubble variant="plain">
            Storybook coverage is green across all three browser projects.
          </MessageBubble>
        </MessageContent>
      </Message>
      <MessageThread>
        <Message from="user" align="start">
          <MessageAvatar fallback="SP" alt="Saurav" />
          <MessageContent>
            <MessageHeader>Saurav · 9:40</MessageHeader>
            <MessageBubble variant="plain">
              Shipping the Message kit today — any blockers left?
            </MessageBubble>
          </MessageContent>
        </Message>
        <MessageThreadSummary
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          label={open ? "Hide 2 replies" : "2 replies"}
          meta={open ? undefined : "Last reply today at 9:41"}
          action={open ? null : "View thread"}
        >
          <MessageAvatar fallback="N" alt="Nessa" />
          <MessageAvatar fallback="AL" alt="Ada" />
        </MessageThreadSummary>
        {open && (
          <MessageThreadReplies>
            <Message from="assistant">
              <MessageAvatar fallback="N" alt="Nessa" />
              <MessageContent>
                <MessageHeader>Nessa · 9:41</MessageHeader>
                <MessageBubble variant="plain">
                  None — the registry item and stories both landed.
                </MessageBubble>
              </MessageContent>
            </Message>
            <Message from="assistant">
              <MessageAvatar fallback="AL" alt="Ada" />
              <MessageContent>
                <MessageHeader>Ada · 9:41</MessageHeader>
                <MessageBubble variant="plain">
                  Docs page is proofread, go ahead.
                </MessageBubble>
              </MessageContent>
            </Message>
          </MessageThreadReplies>
        )}
      </MessageThread>
    </ThreadFrame>
  )
}

export const ThreadedReplies: Story = {
  parameters: storyDocumentation(
    "Slack-style threading in a channel: MessageThread wraps the parent row, MessageThreadSummary shows a reply facepile and count whose meta swaps to \"View thread\" on hover, and clicking it mounts MessageThreadReplies — replies indented to the parent's content column behind a connector rule. Expansion state lives in the host via onClick and aria-expanded.",
  ),
  render: () => <ThreadedRepliesExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const summary = canvas.getByRole("button", { name: /2 replies/ })
    await expect(summary).toHaveAttribute("aria-expanded", "false")
    await expect(
      canvas.queryByText("None — the registry item and stories both landed."),
    ).not.toBeInTheDocument()
    const restRect = summary.getBoundingClientRect()
    await userEvent.hover(summary)
    const hoverRect = summary.getBoundingClientRect()
    await expect(hoverRect.width).toBeCloseTo(restRect.width, 1)
    await expect(hoverRect.left).toBeCloseTo(restRect.left, 1)
    await userEvent.click(summary)
    await expect(summary).toHaveAttribute("aria-expanded", "true")
    const reply = canvas.getByText(
      "None — the registry item and stories both landed.",
    )
    await expect(reply).toBeVisible()
    const replies = reply.closest('[data-slot="message-thread-replies"]')!
    const parentRow = canvas
      .getByText("Shipping the Message kit today — any blockers left?")
      .closest('[data-slot="message"]')!
    const parentContent = parentRow.querySelector(
      '[data-slot="message-content"]',
    )!
    const replyRow = replies.querySelector('[data-slot="message"]')!
    await expect(replyRow.getBoundingClientRect().left).toBeCloseTo(
      parentContent.getBoundingClientRect().left,
      0,
    )
    await userEvent.click(summary)
    await expect(summary).toHaveAttribute("aria-expanded", "false")
    await expect(
      canvas.queryByText("None — the registry item and stories both landed."),
    ).not.toBeInTheDocument()
  },
}

export const ReplyingInThread: Story = {
  parameters: storyDocumentation(
    "The thread panel while replying: the parent message on top, a reply-count divider, the replies full-width beneath it, and a reply input at the bottom — the same primitives recomposed without indentation, like Slack's thread pane.",
  ),
  render: () => (
    <div className="flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-5 font-sans">
      <p className="m-0 text-sm font-semibold text-foreground">Thread</p>
      <Message from="user" align="start">
        <MessageAvatar fallback="SP" alt="Saurav" />
        <MessageContent className="max-w-full">
          <MessageHeader>Saurav · 9:40</MessageHeader>
          <MessageBubble variant="plain">
            Shipping the Message kit today — any blockers left?
          </MessageBubble>
        </MessageContent>
      </Message>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>2 replies</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <Message from="assistant">
        <MessageAvatar fallback="N" alt="Nessa" />
        <MessageContent className="max-w-full">
          <MessageHeader>Nessa · 9:41</MessageHeader>
          <MessageBubble variant="plain">
            None — the registry item and stories both landed.
          </MessageBubble>
        </MessageContent>
      </Message>
      <Message from="assistant">
        <MessageAvatar fallback="AL" alt="Ada" />
        <MessageContent className="max-w-full">
          <MessageHeader>Ada · 9:41</MessageHeader>
          <MessageBubble variant="plain">Docs page is proofread, go ahead.</MessageBubble>
        </MessageContent>
      </Message>
      <Input aria-label="Reply in thread" placeholder="Reply in thread…" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Thread")).toBeVisible()
    await expect(canvas.getByText("2 replies")).toBeVisible()
    const reply = canvas.getByRole("textbox", { name: "Reply in thread" })
    await userEvent.type(reply, "Merging now.")
    await expect(reply).toHaveValue("Merging now.")
  },
}

function SupportUserMessage({ children }: { children: React.ReactNode }) {
  return (
    <Message from="user">
      <MessageContent>
        <MessageBubble
          variant="primary"
          className="rounded-2xl rounded-br-sm bg-accent text-accent-foreground"
        >
          {children}
        </MessageBubble>
      </MessageContent>
      <MessageAvatar fallback="SP" alt="Saurav" className="bg-accent text-accent-foreground" />
    </Message>
  )
}

function SupportResponseMessage({ children }: { children: React.ReactNode }) {
  return (
    <Message from="assistant">
      <MessageAvatar>
        <span
          aria-hidden="true"
          className="flex size-full items-center justify-center bg-foreground text-xs font-semibold text-background"
        >
          ✦
        </span>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Support · replies in minutes</MessageHeader>
        <MessageBubble className="rounded-2xl rounded-bl-sm border border-border bg-background">
          {children}
        </MessageBubble>
      </MessageContent>
    </Message>
  )
}

export const CustomMessageComponents: Story = {
  parameters: storyDocumentation(
    "Hosts own the final user and response components: this example wraps the primitives into SupportUserMessage and SupportResponseMessage with a right-side avatar, asymmetric bubble corners, and an outlined response surface, then composes the thread from those instead of the defaults.",
  ),
  render: () => (
    <ThreadFrame>
      <SupportResponseMessage>
        Hi! You are chatting with Nessa support. What can we help with?
      </SupportResponseMessage>
      <SupportUserMessage>
        My registry install fails on the nessa-base item.
      </SupportUserMessage>
      <SupportResponseMessage>
        Could you share the CLI output? Usually that means components.json
        points at a stylesheet the CLI cannot write to.
      </SupportResponseMessage>
    </ThreadFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const userBubble = canvas.getByText(
      "My registry install fails on the nessa-base item.",
    )
    const userRow = userBubble.closest('[data-slot="message"]')!
    await expect(userRow).toHaveAttribute("data-align", "end")
    const avatars = userRow.querySelectorAll('[data-slot="message-avatar"]')
    await expect(avatars).toHaveLength(1)
    await expect(canvas.getByText("SP")).toBeVisible()
    const headers = canvas.getAllByText("Support · replies in minutes")
    await expect(headers).toHaveLength(2)
    await expect(headers[0]!).toBeVisible()
  },
}
