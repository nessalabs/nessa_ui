import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@nessa-ui/react"
import { Archive, Copy, PencilLine, Share2, Trash2 } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A composable action menu on the popover surface. The trigger projects onto any Nessa button; the content composes groups with labels, plain items, checkbox and radio items with leading indicators, separators, shortcut hints, and nested submenus. The accent wash always means \"this row is under the pointer or keyboard\" — checked state is shown only by the item indicators.",
      },
    },
  },
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

function TraceActionsMenu() {
  const [pinned, setPinned] = React.useState(true)
  const [notify, setNotify] = React.useState(false)
  const [visibility, setVisibility] = React.useState("team")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Trace actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Trace</DropdownMenuLabel>
          <DropdownMenuItem>
            <PencilLine aria-hidden="true" />
            Rename
            <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy aria-hidden="true" />
            Duplicate
            <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Preferences</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
            Pinned to sidebar
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={notify} onCheckedChange={setNotify}>
            Notify on completion
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Share2 aria-hidden="true" />
            Share with
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={visibility} onValueChange={setVisibility}>
              <DropdownMenuRadioItem value="private">Only me</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="team">My team</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="org">Whole organization</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Archive aria-hidden="true" />
          Archive
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive">
          <Trash2 aria-hidden="true" />
          Delete trace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const Composition: Story = {
  parameters: storyDocumentation(
    "The full composition: labeled groups of plain items with shortcut hints, checkbox items, a submenu holding a radio group, separators between sections, and a destructive item. State for the checkbox and radio items lives with the host.",
  ),
  render: () => <TraceActionsMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "Trace actions" })

    await userEvent.click(trigger)
    const menu = await body.findByRole("menu")
    await expect(within(menu).getByText("Rename")).toBeVisible()

    const pinnedItem = within(menu).getByRole("menuitemcheckbox", {
      name: "Pinned to sidebar",
    })
    await expect(pinnedItem).toHaveAttribute("aria-checked", "true")
    await userEvent.click(pinnedItem)
    await waitFor(() =>
      expect(body.queryByRole("menu")).not.toBeInTheDocument(),
    )

    await userEvent.click(trigger)
    await expect(
      await body.findByRole("menuitemcheckbox", { name: "Pinned to sidebar" }),
    ).toHaveAttribute("aria-checked", "false")

    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(body.queryByRole("menu")).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const Submenu: Story = {
  parameters: storyDocumentation(
    "The nested submenu path: hovering or activating the sub-trigger opens the sub-content beside the menu, here holding a single-select radio group whose selection is marked by the leading dot indicator only.",
  ),
  render: () => <TraceActionsMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("button", { name: "Trace actions" }))
    const subTrigger = await body.findByRole("menuitem", { name: "Share with" })
    await userEvent.click(subTrigger)
    const teamOption = await body.findByRole("menuitemradio", { name: "My team" })
    await expect(teamOption).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(body.queryByRole("menu")).not.toBeInTheDocument(),
    )
  },
}
