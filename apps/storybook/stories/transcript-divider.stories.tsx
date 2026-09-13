import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Message,
  MessageBubble,
  MessageContent,
  TranscriptDivider,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Agents/TranscriptDivider",
  component: TranscriptDivider,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A hairline rule across a transcript with a label sitting on it, marking a point in time rather than a piece of content: a day boundary, an unread mark, a model swap, a context compaction. It is deliberately not a card — what it marks happened *to* the conversation rather than being a step the agent took, so giving it a card's weight would put it in competition with the work either side of it. While `pending`, the label carries the same glyph-clipped shimmer ToolCall and GeneratingSurface use, because it means the same thing there: this is happening now. Given `detail`, the label becomes a disclosure so whatever the event produced — a compaction's summary — stays one line until a reader asks for it.",
      },
    },
  },
} satisfies Meta<typeof TranscriptDivider>

export default meta
type Story = StoryObj<typeof meta>

/** A settled marker with the detail a reader actually wants beside it. */
export const Playground: Story = {
  args: { children: "Context compacted", meta: "72k → 10k tokens · 37s" },
  parameters: storyDocumentation(
    "The settled state. The label names what happened and the muted detail says how much it cost — enough to explain a gap in the agent's memory without interrupting the read.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Context compacted")).toBeVisible()
    await expect(canvas.getByText("72k → 10k tokens · 37s")).toBeVisible()
  },
}

/**
 * The in-progress state. Compaction is a model call of its own — 36 and 41
 * seconds in the captures behind the agent-stream demo — so the marker has to
 * read as working rather than stuck for the whole of it.
 */
export const Pending: Story = {
  args: { children: "Compacting…", pending: true },
  parameters: storyDocumentation(
    "While the summary is being written the label shimmers and is announced politely, so a divider that sits for the better part of a minute reads as work in flight. Liveness is constant rather than switched on with `pending`: turning aria-live on over text that is already rendered announces nothing, so the change a reader waits on — pending giving way to the settled label — is what actually reaches them.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const label = canvas.getByText("Compacting…")
    await expect(label).toBeVisible()
    await expect(label.closest("[aria-live]")).not.toBeNull()
  },
}

/** In place, between the work either side of it. */
export const SettledKeepsItsRegion: Story = {
  args: { children: "Compacted 41 messages" },
  parameters: storyDocumentation(
    "A settled marker keeps the same live region a pending one has. That is not noise: nothing is announced while the text sits unchanged, and keeping the region mounted is what lets the pending-to-settled change be reported at all. Toggling `aria-live` on at the moment the text appears — which is what this component used to do — announces nothing, because assistive technology reports changes inside a region that was already there.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const label = canvas.getByText("Compacted 41 messages")
    const region = label.closest("[aria-live]")
    await expect(region).not.toBeNull()
    await expect(region).toHaveAttribute("aria-live", "polite")
  },
}

export const InTranscript: Story = {
  args: { children: "Context compacted" },
  parameters: storyDocumentation(
    "The reason it is a rule and not a card: it has to separate two stretches of conversation without competing with either.",
  ),
  render: () => (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <Message from="assistant">
        <MessageContent className="max-w-full">
          <MessageBubble variant="plain">Read part-07.txt.</MessageBubble>
        </MessageContent>
      </Message>
      <TranscriptDivider meta="72k → 10k tokens · 37s">Context compacted</TranscriptDivider>
      <Message from="assistant">
        <MessageContent className="max-w-full">
          <MessageBubble variant="plain">Read part-08.txt.</MessageBubble>
        </MessageContent>
      </Message>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Context compacted")).toBeVisible()
    await expect(canvas.getByText("Read part-08.txt.")).toBeVisible()
  },
}

const compactionSummary = `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

Summary:
1. Primary Request and Intent:
   The user asked for each file to be read in full, one at a time, answering with only the filename.
2. Files read so far: corpus/part-01.txt through corpus/part-07.txt.
3. Pending: the remaining files, in order.`

/**
 * A compaction's summary is the only record of what survived the drop, so it
 * is kept — but behind the marker. Drawing it inline would put a wall of the
 * harness's own text in the middle of the conversation, in the user's voice.
 */
export const WithDetail: Story = {
  args: {
    children: "Context compacted",
    meta: "71.1k → 9.3k tokens · 17s",
    detail: (
      <div className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-3 whitespace-pre-wrap">
        {compactionSummary}
      </div>
    ),
  },
  parameters: storyDocumentation(
    "With `detail`, the label becomes a disclosure. Closed, the marker is still one line; open, it shows what the agent will carry forward in place of the history it dropped.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Closed by default: a marker that expands on sight is just a card again.
    await expect(canvas.queryByText(/ran out of context/)).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: /Context compacted/ }))
    await waitFor(async () => {
      await expect(canvas.getByText(/ran out of context/)).toBeVisible()
    })
  },
}
