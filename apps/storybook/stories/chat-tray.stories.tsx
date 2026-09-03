import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { ChatTray, type ChatTrayItem } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const items: ChatTrayItem[] = [
  {
    id: "quote",
    kind: "quote",
    label: "Report the result back into the thread.",
    detail:
      "Report the result back into the thread. The report should stay short enough to read in the transcript.",
  },
  {
    id: "paste",
    kind: "pasted-text",
    label: "Pasted text (2,481 chars)",
  },
  { id: "diff", kind: "file", label: "transcript-virtualization.diff" },
  { id: "review", kind: "skill", label: "Code Review" },
]

const meta = {
  title: "Conversation/ChatTray",
  component: ChatTray,
  tags: ["autodocs", "test"],
  args: { items },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The single row of everything attached to the message being written. A quoted passage, a large paste, a dropped file, and a chosen skill all end up on the same message, so they queue in the same place rather than in one pending stack per kind — the tray takes the composer's own attachment kinds as its vocabulary, and each chip wears that kind's glyph. However much it holds, the row stays one line: it shows the first chip (or the first few, through collapseAfter) and collapses the tail into a count that opens the whole set. The tray stores nothing and decides nothing about what a chip opens; hosts own the list and wire onOpenItem, onOpenAll, and onClear, which is what lets one row hold kinds that behave differently.",
      },
    },
  },
} satisfies Meta<typeof ChatTray>

export default meta
type Story = StoryObj<typeof meta>

function TrayExample({ collapseAfter }: { collapseAfter?: number }) {
  const [pending, setPending] = React.useState(items)
  const [opened, setOpened] = React.useState<string | null>(null)
  return (
    <div className="flex w-[min(26rem,calc(100vw-2rem))] flex-col items-start gap-2 rounded-3xl border border-border bg-background p-3">
      <ChatTray
        items={pending}
        collapseAfter={collapseAfter}
        onOpenItem={(item) => setOpened(item.label)}
        onOpenAll={() => setOpened(`All ${pending.length}`)}
        onClear={() => setPending([])}
      />
      <div className="w-full rounded-full border border-border px-4 py-2 font-sans nessa-text-4 text-muted-foreground">
        Ask me anything
      </div>
      <p className="m-0 font-sans nessa-text-1 text-muted-foreground">
        {opened ? `Opened: ${opened}` : "Nothing opened yet"}
      </p>
    </div>
  )
}

export const CollapsedTail: Story = {
  parameters: storyDocumentation(
    "Four attachments of four different kinds, as the tray shows them by default: one chip stands for the set and the rest become a count. Pressing the chip opens what it stands for, pressing the count opens the whole set, and the discard control clears everything at once.",
  ),
  render: () => <TrayExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("+ 3 others")).toBeVisible()
    await userEvent.click(
      canvas.getByText("Report the result back into the thread."),
    )
    await waitFor(() =>
      expect(
        canvas.getByText(/^Opened: Report the result back into the thread\.$/),
      ).toBeVisible(),
    )
    await userEvent.click(canvas.getByText("+ 3 others"))
    await waitFor(() => expect(canvas.getByText("Opened: All 4")).toBeVisible())
    await userEvent.click(
      canvas.getByRole("button", { name: "Discard everything attached" }),
    )
    await waitFor(() =>
      expect(canvas.queryByText("+ 3 others")).not.toBeInTheDocument(),
    )
  },
}

export const MoreChipsBeforeCollapsing: Story = {
  parameters: storyDocumentation(
    "A wider composer can afford to name more of what it is carrying: collapseAfter decides how many chips stand on their own before the tail becomes a count. Every chip truncates rather than wrapping, so the row keeps its height whatever the labels are.",
  ),
  render: () => <TrayExample collapseAfter={3} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("+ 1 other")).toBeVisible()
    await expect(canvas.getByText("Pasted text (2,481 chars)")).toBeVisible()
    await expect(
      canvas.getByText("transcript-virtualization.diff"),
    ).toBeVisible()
  },
}
