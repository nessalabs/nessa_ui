import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Sheet,
  SheetAction,
  SheetBody,
  SheetClose,
  SheetExpand,
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
          "A bottom sheet that rises over its nearest positioned ancestor: a modal dialog with a backdrop, a grab bar, a header of close or expand plus a centered title and optional Done, and a scrolling body. SheetExpand toggles the drawer into a filled extra-details surface over the same ancestor. Escape, the backdrop, SheetClose, and SheetAction all dismiss it. Focus moves into the panel on open and returns to the opener on close; siblings it covers go inert. Pass modal={false} for a contained extra-details surface that leaves surrounding chrome reachable.",
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

export const ExpandToggle: Story = {
  parameters: storyDocumentation(
    "SheetExpand toggles the drawer into a filled extra-details surface over the same ancestor, then Minimize restores the drawer. Escape and Done still dismiss.",
  ),
  render: () => {
    function ExpandExample() {
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
                <SheetExpand />
                <SheetTitle>Queued</SheetTitle>
                <SheetAction>Done</SheetAction>
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
    return <ExpandExample />
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    const dialog = canvas.getByRole("dialog", { name: "Queued" })
    await waitFor(() => expect(dialog).toBeVisible())
    await expect(dialog).toHaveAttribute("aria-modal", "true")
    await expect(dialog).toHaveAttribute("data-expanded", "false")
    await userEvent.click(canvas.getByRole("button", { name: "Expand" }))
    await expect(dialog).toHaveAttribute("data-expanded", "true")
    await userEvent.click(canvas.getByRole("button", { name: "Minimize" }))
    await expect(dialog).toHaveAttribute("data-expanded", "false")
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await expect(
      canvas.queryByRole("dialog", { name: "Queued" }),
    ).not.toBeInTheDocument()
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
