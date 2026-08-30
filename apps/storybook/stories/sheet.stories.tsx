import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Sheet,
  SheetAction,
  SheetBody,
  SheetClose,
  SheetHandle,
  SheetHeader,
  SheetTitle,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

function SheetExample({
  action = false,
}: {
  action?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative h-80 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background">
      <button
        type="button"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-3 py-1.5 font-sans nessa-text-3 text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setOpen(true)}
      >
        Open sheet
      </button>
      {open ? (
        <Sheet label="Queued" onClose={() => setOpen(false)}>
          <SheetHandle />
          <SheetHeader>
            {action ? null : <SheetClose />}
            <SheetTitle>Queued</SheetTitle>
            {action ? <SheetAction>Done</SheetAction> : null}
          </SheetHeader>
          <SheetBody>
            <p className="m-0 font-sans nessa-text-4 text-foreground">
              Two follow-ups are waiting behind the current run.
            </p>
          </SheetBody>
        </Sheet>
      ) : null}
    </div>
  )
}

const meta = {
  title: "Components/Sheet",
  component: Sheet,
  tags: ["autodocs", "test"],
  args: {
    onClose: () => undefined,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A bottom sheet that rises over its nearest positioned ancestor: a modal dialog with a backdrop, a grab bar, a header of close or Done plus a centered title, and a scrolling body. Escape, the backdrop, SheetClose, and SheetAction all dismiss it. Focus moves into the panel on open and returns to the opener on close; siblings it covers go inert.",
      },
    },
  },
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Open the sheet from the host button. The circular close control and Escape both dismiss it, and focus returns to the opener.",
  ),
  render: () => <SheetExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    const dialog = canvas.getByRole("dialog", { name: "Queued" })
    await expect(dialog).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Queued" })).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Close" }))
    await expect(
      canvas.queryByRole("dialog", { name: "Queued" }),
    ).not.toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Open sheet" })).toHaveFocus()
  },
}

export const DoneAction: Story = {
  parameters: storyDocumentation(
    "A trailing Done control is the other header dismiss pattern — the queue sheet uses it instead of a close glyph.",
  ),
  render: () => <SheetExample action />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    await expect(canvas.getByRole("dialog", { name: "Queued" })).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await expect(
      canvas.queryByRole("dialog", { name: "Queued" }),
    ).not.toBeInTheDocument()
  },
}
