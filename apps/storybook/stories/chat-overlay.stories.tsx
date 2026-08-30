import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChatBubble,
  ChatMessage,
  ChatOverlay,
  ChatOverlayBack,
  ChatOverlayBody,
  ChatOverlaySummary,
  ChatTabs,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/ChatOverlay",
  component: ChatOverlay,
  tags: ["autodocs", "test"],
  // The examples drive the overlay from their own state; args exist so the
  // docs page can describe the component's required contract.
  args: { onClose: () => undefined },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A reading view that takes over a chat's transcript without disturbing the window around it. It fills its nearest positioned ancestor, so a host that positions the transcript region — rather than the whole chat frame — keeps its tab strip and composer visible and usable while the overlay is open: the reader can still switch conversations or keep typing. That is the difference from ChatAttachmentViewer, which owns a tile grid and a back arrow of its own; ChatOverlay is the bare surface for reading views such as a previewed file, one message's full text, or the annotations waiting to be sent. ChatOverlayBody is the scrolling content region and takes its layout from the host, ChatOverlayBack is the quiet centered way out, and ChatOverlaySummary captions the content. It is deliberately not a modal dialog: Tab is not trapped and the chat around it is not hidden, because the strip and composer beside it stay in use — but the siblings it is drawn over go inert while it is open, so nothing behind the view takes focus or a pointer. Focus moves into the view on open and returns to whatever opened it on close (or to wherever onReturnFocus says, for hosts whose opener hides behind the view), Escape closes it from anywhere inside, and it fades in only when motion is allowed.",
      },
    },
  },
} satisfies Meta<typeof ChatOverlay>

export default meta
type Story = StoryObj<typeof meta>

const transcript = [
  { tone: "sent", text: "Where do we compose the chat composer today?" },
  { tone: "received", text: "Nine call sites. Full table in the report." },
] as const

/**
 * A miniature chat window: tabs, a positioned transcript region, and a
 * composer. Only the middle region is the overlay's stage.
 */
function ChatFrame({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = React.useState("audit")
  return (
    <div className="flex h-[26rem] w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 rounded-[1.75rem] border border-border bg-background p-2">
      <ChatTabs
        className="px-1"
        tabs={[
          { id: "audit", title: "Repo audit" },
          { id: "notes", title: "Release notes" },
        ]}
        value={tab}
        onValueChange={setTab}
      />
      {/* The positioned ancestor: the overlay fills exactly this box. It is
          also the tab's panel, which is what its aria-controls points at. */}
      <div
        id={`chat-tab-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`chat-tab-${tab}`}
        className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1"
      >
        <div
          id="takeover-transcript"
          className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto"
        >
          {transcript.map((entry) => (
            // The entrance animation is ChatBubbles' subject, not this
            // story's, and its mid-flight colors race the accessibility pass.
            <ChatMessage key={entry.text} tone={entry.tone} animateIn={false}>
              <ChatBubble>{entry.text}</ChatBubble>
            </ChatMessage>
          ))}
        </div>
        {children}
      </div>
      <div className="shrink-0 rounded-full border border-border px-4 py-2 font-sans nessa-text-4 text-muted-foreground">
        Ask me anything
      </div>
    </div>
  )
}

function TakeoverExample({ summary }: { summary?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <ChatFrame>
      {/* The trigger stays mounted under the overlay: focus returns to the
          control that opened the view, which has to still be there. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full border-0 bg-transparent px-1 font-sans nessa-text-2 font-medium text-(--nessa-chat-accent) outline-none hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Open the skill
      </button>
      {open ? (
        <ChatOverlay label="Skill Creator" onClose={() => setOpen(false)}>
          <ChatOverlayBody className="px-1">
            <p className="m-0 font-sans nessa-text-4 leading-5">
              Draft a reusable skill from this conversation. Invoke it with
              /skill-creator from any chat, and it will gather the context it
              needs before writing anything.
            </p>
          </ChatOverlayBody>
          {summary ? <ChatOverlaySummary>{summary}</ChatOverlaySummary> : null}
          <ChatOverlayBack />
        </ChatOverlay>
      ) : null}
    </ChatFrame>
  )
}

export const TranscriptTakeover: Story = {
  parameters: storyDocumentation(
    "Opening the view replaces the transcript and nothing else: the tab strip above and the composer below stay exactly where they were, so switching conversations or starting a message never needs the reading view dismissed first. Back — or Escape — returns the transcript, and focus goes back to the control that opened it.",
  ),
  render: () => <TakeoverExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open the skill" }))
    const overlay = await canvas.findByRole("dialog", { name: "Skill Creator" })
    // The overlay fades in, so its visibility is only settled once the
    // entrance animation has run.
    await waitFor(() => expect(overlay).toBeVisible())
    // The frame around the transcript is untouched.
    await expect(canvas.getByRole("tab", { name: "Repo audit" })).toBeVisible()
    await expect(canvas.getByText("Ask me anything")).toBeVisible()
    // What the view is drawn over is inert, so nothing behind it takes a
    // pointer or a Tab stop while it is unreadable.
    const transcript = canvasElement.querySelector("#takeover-transcript")
    const opener = canvas.getByRole("button", { name: "Open the skill" })
    await expect(transcript).toHaveAttribute("inert")
    await expect(opener).toHaveAttribute("inert")
    // A host that mounts something behind an open view — a card, a banner —
    // does not open a reachable hole behind it.
    const late = document.createElement("div")
    late.id = "late-sibling"
    overlay.parentElement?.append(late)
    await waitFor(() => expect(late).toHaveAttribute("inert"))
    late.remove()
    await userEvent.click(canvas.getByRole("button", { name: "Back to chat" }))
    await waitFor(() =>
      expect(canvas.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    // Closing gives the chat back before it gives focus back, so focus never
    // lands on an element that is still inert.
    await expect(transcript).not.toHaveAttribute("inert")
    await expect(opener).not.toHaveAttribute("inert")
    await expect(opener).toHaveFocus()
  },
}

export const CaptionedContent: Story = {
  parameters: storyDocumentation(
    "ChatOverlaySummary captions what is on screen — a file name, a count of what the view holds — in the quiet line above the way out. Escape closes the view from anywhere inside it, including after a click that landed on plain text, because the view itself can hold focus; a reader who scrolled deep into the content never has to travel back to a control.",
  ),
  render: () => <TakeoverExample summary="skill-creator/SKILL.md" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open the skill" }))
    await canvas.findByRole("dialog", { name: "Skill Creator" })
    await waitFor(() =>
      expect(canvas.getByText("skill-creator/SKILL.md")).toBeVisible(),
    )
    // A click that lands on the prose keeps focus inside the view rather
    // than dropping it on the body, so Escape still reaches the view.
    await userEvent.click(canvas.getByText(/Draft a reusable skill/))
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(canvas.queryByRole("dialog")).not.toBeInTheDocument(),
    )
  },
}
