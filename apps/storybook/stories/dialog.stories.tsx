import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  CheckboxList,
  Dialog,
  DialogClose,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  type CheckboxListOption,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A modal dialog: a titled panel centered over a dimmed page, with an optional description, a body that scrolls on its own when tall, and footer actions. Radix Dialog supplies the focus trap, Escape and outside-press dismissal, and the aria wiring — the panel is a modal dialog named by its title and described by its description. Nessa supplies the surface and returns focus to whatever opened the dialog, not only to a trigger, with `onReturnFocus` for an opener that is gone by close. Menus and tooltips opened inside portal into the dialog, so they stay inside the boundary it makes. Wrap footer actions that close the dialog in `DialogClose`.",
      },
    },
  },
  args: { title: "Dialog" },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

const hosts: CheckboxListOption[] = [
  { value: "build-box", label: "build-box", description: "SSH · ci@build-box.internal" },
  { value: "peer:studio-mac", label: "studio-mac", description: "Linked device" },
  { value: "staging", label: "staging", description: "SSH · deploy@staging.example.com" },
  {
    value: "peer:old-laptop",
    label: "old-laptop",
    description: "Linked device",
    disabled: true,
    disabledReason: "Offline since last week",
  },
]

function ShareDialogExample() {
  const [picked, setPicked] = React.useState<string[]>(["build-box"])
  return (
    <Dialog
      trigger={<Button variant="outline">Share conversation</Button>}
      title="Share conversation"
      description="People with the link can read it. Pick where its turns may run commands."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Share</Button>
          </DialogClose>
        </>
      }
    >
      <CheckboxList
        label="Command hosts"
        options={hosts}
        value={picked}
        onValueChange={setPicked}
      />
    </Dialog>
  )
}

export const ShareDialog: Story = {
  // Focus order, focus-visible matching and Escape handling are engine-shaped.
  tags: ["cross-engine", "reduced-motion"],
  parameters: storyDocumentation(
    "The common case: a trigger, a title and description, a body, and footer actions. The play test opens it and proves it is a modal dialog named by its title and described by its description, that the panel itself takes focus, and that Tab and Shift+Tab stay inside it. Escape closes it and focus returns to the trigger; so do the close button and an outside press. Every close is followed by its end state — the dialog gone, focus home — rather than by a wait on motion.",
  ),
  render: () => <ShareDialogExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "Share conversation" })

    await userEvent.click(trigger)
    const dialog = await page.findByRole("dialog", { name: "Share conversation" })
    await expect(dialog).toHaveAttribute("aria-modal", "true")
    await expect(dialog).toHaveAccessibleDescription(
      "People with the link can read it. Pick where its turns may run commands.",
    )
    await waitFor(async () => {
      await expect(dialog).toHaveFocus()
    })

    // Tab never leaves the panel, forwards or backwards, however far it goes.
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab()
      await expect(dialog.contains(document.activeElement)).toBe(true)
    }
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab({ shift: true })
      await expect(dialog.contains(document.activeElement)).toBe(true)
    }

    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(dialog.isConnected).toBe(false)
    })
    // Radix restores focus a tick after the panel unmounts; wait for it.
    await waitFor(async () => {
      await expect(trigger).toHaveFocus()
    })

    await userEvent.click(trigger)
    const second = await page.findByRole("dialog", { name: "Share conversation" })
    await userEvent.click(within(second).getByRole("button", { name: "Close" }))
    await waitFor(async () => {
      await expect(second.isConnected).toBe(false)
    })
    // Radix restores focus a tick after the panel unmounts; wait for it.
    await waitFor(async () => {
      await expect(trigger).toHaveFocus()
    })

    await userEvent.click(trigger)
    const third = await page.findByRole("dialog", { name: "Share conversation" })
    const overlay = third.parentElement!
    await expect(overlay).toHaveAttribute("data-slot", "dialog-overlay")
    // A press on the dimmed layer, outside the panel.
    fireEvent.pointerDown(overlay, { button: 0, pointerType: "mouse" })
    fireEvent.pointerUp(overlay, { button: 0, pointerType: "mouse" })
    fireEvent.click(overlay)
    await waitFor(async () => {
      await expect(third.isConnected).toBe(false)
    })
    // Radix restores focus a tick after the panel unmounts; wait for it.
    await waitFor(async () => {
      await expect(trigger).toHaveFocus()
    })
  },
}

export const OpenedFromState: Story = {
  parameters: storyDocumentation(
    "A dialog with no trigger, opened by a host from its own state — here a menu item, the usual case for a share or rename action. Radix alone would return focus to a trigger the dialog does not have; the dialog returns it to the control that held focus when it opened. When that control is gone by close — the dialog's own action deleted the row that opened it — `onReturnFocus` says where focus goes instead of the document body.",
  ),
  render: function OpenedFromStateExample() {
    const [rows, setRows] = React.useState(["Design review", "Release notes"])
    const [openRow, setOpenRow] = React.useState<string | null>(null)
    const fallbackRef = React.useRef<HTMLButtonElement>(null)
    return (
      <div className="flex w-72 flex-col gap-2">
        <Button ref={fallbackRef} variant="ghost" size="sm" className="self-start">
          New conversation
        </Button>
        {/* A disclosure names the list it controls, but did not open it as a
            popup, so it is no place to return focus to. */}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded="true"
          aria-controls="opened-from-state-rows"
        >
          Recent
        </Button>
        <div id="opened-from-state-rows" className="flex flex-col gap-2">
        {rows.map((row) => (
          <Button
            key={row}
            variant="outline"
            className="justify-start"
            onClick={() => setOpenRow(row)}
          >
            {row}
          </Button>
        ))}
        </div>
        <Dialog
          open={openRow !== null}
          onOpenChange={(next) => {
            if (!next) setOpenRow(null)
          }}
          onReturnFocus={() => fallbackRef.current?.focus()}
          size="sm"
          title={openRow ?? "Conversation"}
          description="Deleting it removes the row that opened this dialog."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Keep</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  setRows((current) => current.filter((row) => row !== openRow))
                  setOpenRow(null)
                }}
              >
                Delete
              </Button>
            </>
          }
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const row = canvas.getByRole("button", { name: "Release notes" })

    // Opened from a control that is not a Dialog trigger.
    await userEvent.click(row)
    const dialog = await page.findByRole("dialog", { name: "Release notes" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep" }))
    await waitFor(async () => {
      await expect(dialog.isConnected).toBe(false)
    })
    // Radix restores focus a tick after the panel unmounts; wait for it.
    await waitFor(async () => {
      await expect(row).toHaveFocus()
    })

    // The opener is deleted by the dialog's own action.
    await userEvent.click(row)
    const again = await page.findByRole("dialog", { name: "Release notes" })
    await userEvent.click(within(again).getByRole("button", { name: "Delete" }))
    await waitFor(async () => {
      await expect(again.isConnected).toBe(false)
    })
    await expect(canvas.queryByRole("button", { name: "Release notes" })).toBeNull()
    const fallback = canvas.getByRole("button", { name: "New conversation" })
    await waitFor(async () => {
      await expect(fallback).toHaveFocus()
    })

    // Opened with nothing focused — a click that does not focus its button,
    // as in Safari and Firefox, or an open from a timer. There is no opener
    // and no trigger to go back to, so the host's fallback decides.
    const design = canvas.getByRole("button", { name: "Design review" })
    fallback.blur()
    await expect(document.activeElement).toBe(canvasElement.ownerDocument.body)
    fireEvent.click(design)
    const third = await page.findByRole("dialog", { name: "Design review" })
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(third.isConnected).toBe(false)
    })
    await waitFor(async () => {
      await expect(fallback).toHaveFocus()
    })
  },
}

export const TallBody: Story = {
  parameters: storyDocumentation(
    "A body taller than the viewport scrolls inside the panel while the title and the footer stay in view. A body that scrolls joins the tab order, so a keyboard can scroll text that holds no control. The play test waits for the entrance to finish, then proves the panel fits the viewport, the body is what overflows and is reached by Tab, and scrolling it moves its content but not the footer.",
  ),
  render: () => (
    <Dialog
      trigger={<Button variant="outline">Read policy</Button>}
      title="What a policy cannot stop"
      description="Read before sharing with Drive."
      footer={
        <DialogClose asChild>
          <Button>Done</Button>
        </DialogClose>
      }
    >
      <div className="flex flex-col gap-3 nessa-text-4">
        {Array.from({ length: 30 }, (_, index) => (
          <p key={index} className="m-0">
            Note {index + 1}: calls the agent does not ask about are not checked by the grant's
            tool policy.
          </p>
        ))}
      </div>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("button", { name: "Read policy" }))
    const dialog = await page.findByRole("dialog", { name: "What a policy cannot stop" })
    const surface = dialog.querySelector<HTMLElement>("[data-slot=dialog-surface]")!
    const body = dialog.querySelector<HTMLElement>("[data-slot=dialog-body]")!
    const footer = dialog.querySelector<HTMLElement>("[data-slot=dialog-footer]")!
    const viewportHeight = canvasElement.ownerDocument.documentElement.clientHeight

    // Geometry is read at rest: the entrance scales the surface, and the
    // value that matters is the scale it comes to rest at.
    await waitFor(async () => {
      await expect(["1", "none"]).toContain(getComputedStyle(surface).scale)
    })
    await expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewportHeight)
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
    await waitFor(async () => {
      await expect(body).toHaveAttribute("tabindex", "0")
    })
    const footerTop = footer.getBoundingClientRect().top

    // The panel holds focus first and Tab reaches the scrolling body, which
    // is what lets the browser's own scrolling keys move it. (Synthetic key
    // events do not scroll, so the scroll itself is driven directly.)
    await userEvent.tab()
    await expect(body).toHaveFocus()
    body.scrollTop = body.scrollHeight
    await waitFor(async () => {
      await expect(body.scrollTop).toBeGreaterThan(0)
    })
    await expect(footer.getBoundingClientRect().top).toBe(footerTop)
    await expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewportHeight)

    await userEvent.click(page.getByRole("button", { name: "Done" }))
    await waitFor(async () => {
      await expect(dialog.isConnected).toBe(false)
    })
  },
}

export const MenuInside: Story = {
  parameters: storyDocumentation(
    "A menu opened from inside the dialog portals into the dialog rather than the body, so it is inside the boundary the dialog traps focus in and hides the page from, and it paints above the panel. The play test opens the menu, proves its content is a descendant of the dialog and takes focus, then dismisses only the menu with Escape — the dialog stays open — before a second Escape closes the dialog.",
  ),
  render: () => (
    <Dialog
      trigger={<Button variant="outline">Open settings</Button>}
      title="Conversation settings"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Visibility</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Only me</DropdownMenuItem>
          <DropdownMenuItem>Team</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "Open settings" })
    await userEvent.click(trigger)
    const dialog = await page.findByRole("dialog", { name: "Conversation settings" })

    await userEvent.click(within(dialog).getByRole("button", { name: "Visibility" }))
    const menu = await page.findByRole("menu")
    await expect(dialog.contains(menu)).toBe(true)
    // Beside the scaled surface, never inside it, so its fixed placement is
    // measured against the viewport even while the entrance runs.
    await expect(menu.closest("[data-slot=dialog-layers]")).not.toBeNull()
    await expect(menu.closest("[data-slot=dialog-surface]")).toBeNull()
    await waitFor(async () => {
      await expect(menu.contains(document.activeElement)).toBe(true)
    })

    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(menu.isConnected).toBe(false)
    })
    await expect(dialog.isConnected).toBe(true)
    await waitFor(async () => {
      await expect(within(dialog).getByRole("button", { name: "Visibility" })).toHaveFocus()
    })

    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(dialog.isConnected).toBe(false)
    })
    // Radix restores focus a tick after the panel unmounts; wait for it.
    await waitFor(async () => {
      await expect(trigger).toHaveFocus()
    })
  },
}

export const InitialFocus: Story = {
  parameters: storyDocumentation(
    "`initialFocus` moves focus to a control on open instead of the panel, for a dialog whose first job is a single field or choice; a target that will not take focus leaves it on the panel instead. Without a description — `null` and `false` count as none — the dialog carries no `aria-describedby` at all rather than one pointing at nothing.",
  ),
  render: function InitialFocusExample() {
    const nameRef = React.useRef<HTMLInputElement>(null)
    return (
      <Dialog
        trigger={<Button variant="outline">Rename</Button>}
        title="Rename conversation"
        // The conditional form of "no description".
        description={null}
        initialFocus={nameRef}
        footer={
          <DialogClose asChild>
            <Button>Save</Button>
          </DialogClose>
        }
      >
        <Input ref={nameRef} aria-label="Name" defaultValue="Design review" />
      </Dialog>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("button", { name: "Rename" }))
    const dialog = await page.findByRole("dialog", { name: "Rename conversation" })
    await waitFor(async () => {
      await expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveFocus()
    })
    await expect(dialog).not.toHaveAttribute("aria-describedby")
    await userEvent.click(page.getByRole("button", { name: "Save" }))
    await waitFor(async () => {
      await expect(dialog.isConnected).toBe(false)
    })
  },
}

export const FromAMenuItem: Story = {
  parameters: storyDocumentation(
    "The usual way a share or rename dialog opens: from an item in a menu. The item is gone by the time the dialog takes focus, so the control to return to is the menu's own trigger, which the menu hands focus back to as it closes.",
  ),
  render: function FromAMenuItemExample() {
    const [open, setOpen] = React.useState(false)
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Conversation actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setOpen(true)}>Share…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Share conversation"
          footer={
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          }
        />
      </>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "Conversation actions" })
    await userEvent.click(trigger)
    await userEvent.click(await page.findByRole("menuitem", { name: "Share…" }))
    const dialog = await page.findByRole("dialog", { name: "Share conversation" })
    await waitFor(async () => {
      await expect(dialog.contains(document.activeElement)).toBe(true)
    })
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(dialog.isConnected).toBe(false)
    })
    await waitFor(async () => {
      await expect(trigger).toHaveFocus()
    })
  },
}

export const FromAClosingMenu: Story = {
  parameters: storyDocumentation(
    "A menu that stays mounted after it closes — running a long exit animation, or force-mounted — still holds the item the dialog opened from. That item could take focus, but inside a menu nobody can see, so the dialog returns focus to the menu's trigger instead.",
  ),
  render: function FromAClosingMenuExample() {
    const [menuOpen, setMenuOpen] = React.useState(false)
    const [open, setOpen] = React.useState(false)
    return (
      <>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Conversation actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            // An exit long enough to outlast the dialog, so the closed menu
            // and its item are still in the document when the dialog closes.
            style={menuOpen ? undefined : { animation: "nessa-enter 60s linear reverse both" }}
          >
            <DropdownMenuItem onSelect={() => setOpen(true)}>Share…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Share conversation"
          footer={
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          }
        />
      </>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "Conversation actions" })
    await userEvent.click(trigger)
    const item = await page.findByRole("menuitem", { name: "Share…" })
    const menu = item.closest<HTMLElement>('[role="menu"]')!
    await userEvent.click(item)
    const dialog = await page.findByRole("dialog", { name: "Share conversation" })
    await waitFor(async () => {
      await expect(dialog.contains(document.activeElement)).toBe(true)
    })
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(dialog.isConnected).toBe(false)
    })
    // The premise: the item outlived the dialog, in a menu that has closed.
    await expect(item.isConnected).toBe(true)
    await expect(menu).toHaveAttribute("data-state", "closed")
    await waitFor(async () => {
      await expect(trigger).toHaveFocus()
    })
    // Leave nothing running: end the exit, and wait for the menu to go.
    for (const animation of menu.getAnimations()) animation.finish()
    await waitFor(async () => {
      await expect(item.isConnected).toBe(false)
    })
    await expect(trigger).toHaveFocus()
  },
}
