import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import { RandomAvatar, UndoCard, conversationAvatarSeed } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Conversation/UndoCard",
  component: UndoCard,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A small row card for an action just taken and the way back from it: the item's picture, what was done over what it was done to, and an Undo control — the card a list shows after an archive. It rises in once when it mounts. The host owns where it sits, how long it stays, and the announcement; the card is no live region.",
      },
    },
  },
  args: {
    action: "Archived",
    title: "Release notes",
    onUndo: fn(),
  },
} satisfies Meta<typeof UndoCard>

export default meta
type Story = StoryObj<typeof meta>

/** A list host: archiving the row shows the card, and Undo brings it back. */
function ArchiveExample() {
  const row = { id: "conv-release", title: "Release notes" }
  const [archived, setArchived] = React.useState(true)
  return (
    <div className="relative flex h-72 w-[min(26rem,calc(100vw-2rem))] flex-col rounded-[1.25rem] bg-background p-3 font-sans">
      {archived ? (
        <p className="m-0 pt-6 text-center nessa-text-3 text-muted-foreground">
          No conversations yet
        </p>
      ) : (
        <p className="m-0 nessa-text-3 text-foreground">{row.title}</p>
      )}
      {archived && (
        <UndoCard
          className="absolute inset-x-2.5 bottom-2.5"
          action="Archived"
          title={row.title}
          leading={<RandomAvatar seed={conversationAvatarSeed(row)} />}
          onUndo={() => setArchived(false)}
        />
      )}
    </div>
  )
}

export const AfterArchive: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The card a conversation list shows after an archive, pinned to the bottom of the list with the conversation's own avatar. Undo puts the row back and the card goes.",
  ),
  render: () => <ArchiveExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const card = canvasElement.querySelector<HTMLElement>("[data-slot=undo-card]")!
    await expect(card).toHaveTextContent("Archived")
    await expect(card).toHaveTextContent("Release notes")
    await expect(
      card.querySelector("[data-slot=undo-card-leading] [data-slot=random-avatar]"),
    ).toBeInTheDocument()
    // The rise-in ends; nothing keeps running past the assertions.
    await waitFor(() =>
      expect(getComputedStyle(card).opacity).toBe("1"),
    )
    await waitFor(() => expect(card.getAnimations()).toHaveLength(0))
    const undo = canvas.getByRole("button", { name: "Undo archived Release notes" })
    await expect(undo).toHaveTextContent("Undo")
    await userEvent.click(undo)
    await expect(
      canvasElement.querySelector("[data-slot=undo-card]"),
    ).not.toBeInTheDocument()
    await expect(canvas.getByText("Release notes")).toBeInTheDocument()
  },
}

export const WithoutPicture: Story = {
  parameters: storyDocumentation(
    "With no `leading` picture the card is the two lines and the control.",
  ),
  play: async ({ canvasElement, args }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await expect(
      canvasElement.querySelector("[data-slot=undo-card-leading]"),
    ).not.toBeInTheDocument()
    const card = canvasElement.querySelector<HTMLElement>("[data-slot=undo-card]")!
    // The card stays mounted here, so its rise-in must end before the test.
    await waitFor(() => expect(getComputedStyle(card).opacity).toBe("1"))
    await userEvent.click(canvas.getByRole("button", { name: /^Undo/ }))
    await expect(args.onUndo).toHaveBeenCalledTimes(1)
    // The click hovers the control, which starts its colour change; let
    // that and the rise-in finish so nothing runs past the assertions.
    // Wait on each one's own end rather than polling a short window, which a
    // slow runner can outlast.
    await Promise.allSettled(
      card.getAnimations({ subtree: true }).map((each) => each.finished),
    )
    await waitFor(
      () => expect(card.getAnimations({ subtree: true })).toHaveLength(0),
      { timeout: 5000 },
    )
  },
}
