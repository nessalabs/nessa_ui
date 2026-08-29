import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A modal dialog on the popover surface behind a blurred background scrim. The trigger projects onto any Nessa button; the content composes a header with title and description, arbitrary body content, and a footer action row that stacks on narrow viewports. Radix traps focus inside, closes on Escape or scrim click, and returns focus to the trigger. Every content needs a DialogTitle for its accessible name; hide the corner close button with showCloseButton={false} when the footer actions should be the only exits.",
      },
    },
  },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

function DestroyWorkspaceDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Destroy workspace
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Destroy this workspace?</DialogTitle>
          <DialogDescription>
            The container, its volumes, and any uncommitted changes in
            canopy/api-gateway are deleted permanently. Pushed branches are
            not affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Destroy workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const DestroyConfirmation: Story = {
  parameters: storyDocumentation(
    "The destructive-confirmation pattern: no corner close button, so the only exits are the explicit footer actions, Escape, and the scrim. Cancel is a plain Button projected through DialogClose, which dismisses without the host wiring any open state; focus returns to the trigger on close.",
  ),
  render: () => <DestroyWorkspaceDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "Destroy workspace" })

    await userEvent.click(trigger)
    const dialog = await body.findByRole("dialog")
    await expect(
      within(dialog).getByRole("heading", { name: "Destroy this workspace?" }),
    ).toBeVisible()
    await expect(
      within(dialog).queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

function RenameWorkspaceDialog() {
  const inputId = React.useId()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Rename workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename workspace</DialogTitle>
          <DialogDescription>
            The new name appears in the workspace list and on port chips.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            Workspace name
          </label>
          <Input id={inputId} defaultValue="canopy/api-gateway" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save name</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const FormContent: Story = {
  parameters: storyDocumentation(
    "Arbitrary body content between header and footer — here a labeled Input. The default corner close button is present alongside the footer actions, Radix traps focus inside the content, and Escape dismisses.",
  ),
  render: () => <RenameWorkspaceDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole("button", { name: "Rename workspace" }),
    )
    const dialog = await body.findByRole("dialog")
    await expect(within(dialog).getByRole("button", { name: "Close" })).toBeVisible()
    await expect(
      within(dialog).getByRole("textbox", { name: "Workspace name" }),
    ).toBeVisible()

    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    )
  },
}
