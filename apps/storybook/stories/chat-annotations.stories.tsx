import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChatAnnotationBadge,
  ChatAnnotationList,
  ChatAnnotationThread,
  ChatBubble,
  ChatMessage,
  type ChatAnnotation,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const seeded: ChatAnnotation[] = [
  {
    id: "gather",
    text: "Gather the relevant context from the current chat.",
    comments: ["This should spell out how much history counts as relevant."],
    sourceLabel: "SKILL.md",
  },
  {
    id: "checklist",
    text: "Apply the checklist this skill carries.",
    sourceLabel: "SKILL.md",
  },
  {
    id: "report",
    text: "Report the result back into the thread. The report should stay short enough to read in the transcript, with the full detail behind a link.",
    comments: [
      "Way too long for one step — split the summary rule and the linking rule.",
      "Also decide who owns the link target.",
    ],
    sourceLabel: "SKILL.md",
  },
]

const meta = {
  title: "Conversation/ChatAnnotations",
  component: ChatAnnotationThread,
  tags: ["autodocs", "test"],
  args: { annotation: seeded[0]! },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Passages lifted out of a document, and the reader's notes on them, read as short conversations. An annotation is not metadata bolted onto a chat: ChatAnnotationThread renders the lifted passage as the document's message and each comment as the reader's reply, so the same bubbles, sides, and rhythm carry both. A thread with onSelect makes its passage the target for the next comment; onEditComment swaps a comment into the in-bubble editor when its hover control is pressed; onRemove offers the discard control; and a view that passes none of them — the record of annotations already sent — renders the same thread read-only. Passing children replaces the passage's plain text, which is where a markdown renderer goes. ChatAnnotationList is the column they sit in, and ChatAnnotationBadge compresses a sent message's whole set into one quote chip, because a message that spilled every passage into the transcript would bury the conversation it belongs to. Hosts own the annotations; these components render and edit them.",
      },
    },
  },
} satisfies Meta<typeof ChatAnnotationThread>

export default meta
type Story = StoryObj<typeof meta>

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2 rounded-3xl border border-border bg-background p-3">
      {children}
    </div>
  )
}

function PendingExample() {
  const [annotations, setAnnotations] = React.useState(seeded)
  const [selected, setSelected] = React.useState<string | null>(null)
  return (
    <Frame>
      <ChatAnnotationList>
        {annotations.map((annotation) => (
          <ChatAnnotationThread
            key={annotation.id}
            annotation={annotation}
            selected={selected === annotation.id}
            onSelect={() =>
              setSelected((current) =>
                current === annotation.id ? null : annotation.id,
              )
            }
            onRemove={() =>
              setAnnotations((current) =>
                current.filter((entry) => entry.id !== annotation.id),
              )
            }
            onEditComment={(index, text) =>
              setAnnotations((current) =>
                current.map((entry) =>
                  entry.id === annotation.id
                    ? {
                        ...entry,
                        comments: entry.comments?.map((comment, at) =>
                          at === index ? text : comment,
                        ),
                      }
                    : entry,
                ),
              )
            }
          />
        ))}
      </ChatAnnotationList>
    </Frame>
  )
}

export const PendingAnnotations: Story = {
  parameters: storyDocumentation(
    "The editable view, before the annotations travel with a message: the passage is the document speaking and the comments answer it, selecting a passage marks it as the target for the next comment, hovering a comment reveals its edit control, and each thread can be discarded. Selecting an already-selected passage lets it go again.",
  ),
  render: () => <PendingExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const passage = canvas.getByText(
      "Apply the checklist this skill carries.",
    )
    await userEvent.click(passage)
    await waitFor(() =>
      expect(
        passage.closest('[data-slot="chat-annotation-thread"]'),
      ).toHaveAttribute("data-selected", "true"),
    )
    // Comments edit in place, inside the bubble that held them.
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Edit comment" })[0]!,
    )
    const editor = await canvas.findByRole("textbox", { name: "Edit comment" })
    await userEvent.type(editor, " Say how far back.")
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(canvas.getByText(/Say how far back\./)).toBeVisible(),
    )
    // Discarding removes only its own thread.
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Discard annotation" })[1]!,
    )
    await waitFor(() =>
      expect(
        canvas.queryByText("Apply the checklist this skill carries."),
      ).not.toBeInTheDocument(),
    )
  },
}

function SentExample() {
  const [open, setOpen] = React.useState(false)
  return (
    <Frame>
      {open ? (
        <ChatAnnotationList>
          {seeded.map((annotation) => (
            <ChatAnnotationThread key={annotation.id} annotation={annotation} />
          ))}
        </ChatAnnotationList>
      ) : (
        <ChatMessage tone="sent">
          <ChatAnnotationBadge
            count={seeded.length}
            onOpen={() => setOpen(true)}
          />
          <ChatBubble>Please fold all of these in.</ChatBubble>
        </ChatMessage>
      )}
    </Frame>
  )
}

export const SentRecord: Story = {
  parameters: storyDocumentation(
    "Once sent, the set rides the message as one badge rather than a run of bubbles, and opening it shows the same threads with every affordance withdrawn — nothing to select, edit, or discard in a record of what was already said.",
  ),
  render: () => <SentExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText("3 annotations"))
    await waitFor(() =>
      expect(
        canvas.getByText("Gather the relevant context from the current chat."),
      ).toBeVisible(),
    )
    await expect(
      canvas.queryByRole("button", { name: "Discard annotation" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "Edit comment" }),
    ).not.toBeInTheDocument()
  },
}
