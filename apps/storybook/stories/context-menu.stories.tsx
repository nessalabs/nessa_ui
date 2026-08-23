import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@nessa-ui/react"

import {
  EditIcon,
  FileCopyIcon,
  GlobeIcon,
  SearchIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
  TodoIcon,
} from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A right-click menu on Nessa's popover surface: the shadcn context-menu layout — items with keyboard shortcuts, groups and labels, nested submenus, checkbox and radio selection — rebuilt on Radix context-menu primitives with Nessa tokens, the shared popover surface recipe, and a destructive item variant. Icons drop into items directly; Nessa's Nucleo set and lucide both fit the 16px item slot.",
      },
    },
  },
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

function TriggerRegion(props: React.ComponentProps<"div">) {
  return (
    <div
      className="flex h-40 w-72 select-none items-center justify-center rounded-xl border border-dashed border-border font-sans text-sm text-muted-foreground"
      {...props}
    />
  )
}

function BrowserDemo() {
  const [showBookmarksBar, setShowBookmarksBar] = React.useState(true)
  const [showFullUrls, setShowFullUrls] = React.useState(false)
  const [person, setPerson] = React.useState("pedro")
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TriggerRegion>Right click here</TriggerRegion>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-56">
        <ContextMenuItem>
          Back
          <ContextMenuShortcut>⌘[</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled>
          Forward
          <ContextMenuShortcut>⌘]</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Reload
          <ContextMenuShortcut>⌘R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-48">
            <ContextMenuItem>
              Save Page As…
              <ContextMenuShortcut>⇧⌘S</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>Create Shortcut…</ContextMenuItem>
            <ContextMenuItem>Name Window…</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>Developer Tools</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem
          checked={showBookmarksBar}
          onCheckedChange={setShowBookmarksBar}
        >
          Show Bookmarks Bar
          <ContextMenuShortcut>⌘⇧B</ContextMenuShortcut>
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={showFullUrls}
          onCheckedChange={setShowFullUrls}
        >
          Show Full URLs
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuRadioGroup value={person} onValueChange={setPerson}>
          <ContextMenuLabel inset>People</ContextMenuLabel>
          <ContextMenuRadioItem value="pedro">
            Pedro Duarte
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="colm">Colm Tuite</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

async function waitForMenuClosed(body: HTMLElement) {
  await waitFor(async () => {
    await expect(
      body.querySelector('[data-slot="context-menu-content"]'),
    ).toBeNull()
  })
}

export const Browser: Story = {
  parameters: storyDocumentation(
    "The full shadcn context-menu layout: navigation items with shortcuts, a disabled item, a More Tools submenu, checkbox items, and a People radio group. Checkbox items keep the menu open on toggle so several can be picked in one session; plain items and radio items dismiss on select. The play test opens the menu by right click, proves the popover surface by computed style, walks into the submenu, toggles both checkboxes without the menu closing, changes the radio selection, and closes the menu with Escape.",
  ),
  render: () => <BrowserDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = canvasElement.ownerDocument.body
    const documentBody = within(body)
    const trigger = canvas.getByText("Right click here")

    fireEvent.contextMenu(trigger)
    const menu = await documentBody.findByRole("menu")
    const menuStyle = getComputedStyle(menu)
    await expect(menuStyle.borderStyle).toBe("solid")
    await expect(menuStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    await expect(parseFloat(menuStyle.borderRadius)).toBeGreaterThan(0)

    await expect(
      documentBody.getByRole("menuitem", { name: /Forward/ }),
    ).toHaveAttribute("data-disabled")

    const subTrigger = documentBody.getByRole("menuitem", {
      name: "More Tools",
    })
    await userEvent.hover(subTrigger)
    const savePage = await documentBody.findByRole("menuitem", {
      name: /Save Page As/,
    })
    await expect(savePage).toBeVisible()

    const bookmarks = documentBody.getByRole("menuitemcheckbox", {
      name: /Show Bookmarks Bar/,
    })
    await expect(bookmarks).toHaveAttribute("aria-checked", "true")
    await userEvent.click(bookmarks)
    // Checkbox items model multi-selection: toggling must keep the menu
    // open so a second option can be picked in the same session.
    await expect(
      documentBody.getByRole("menuitemcheckbox", {
        name: /Show Bookmarks Bar/,
      }),
    ).toHaveAttribute("aria-checked", "false")
    const fullUrls = documentBody.getByRole("menuitemcheckbox", {
      name: "Show Full URLs",
    })
    await userEvent.click(fullUrls)
    await expect(
      documentBody.getByRole("menuitemcheckbox", { name: "Show Full URLs" }),
    ).toHaveAttribute("aria-checked", "true")

    await expect(
      documentBody.getByRole("menuitemradio", { name: "Pedro Duarte" }),
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.click(
      documentBody.getByRole("menuitemradio", { name: "Colm Tuite" }),
    )
    await waitForMenuClosed(body)

    fireEvent.contextMenu(trigger)
    await expect(
      await documentBody.findByRole("menuitemradio", { name: "Colm Tuite" }),
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{Escape}")
    await waitForMenuClosed(body)
  },
}

function NucleoIconsDemo() {
  const [leftSidebar, setLeftSidebar] = React.useState(true)
  const [rightSidebar, setRightSidebar] = React.useState(false)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TriggerRegion>Right click the page</TriggerRegion>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-56">
        <ContextMenuGroup>
          <ContextMenuItem>
            <EditIcon className="size-4" />
            Rename
            <ContextMenuShortcut>⏎</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <FileCopyIcon className="size-4" />
            Duplicate
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <TodoIcon className="size-4" />
            Add to tasks
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <SearchIcon className="size-4" />
          Search selection
          <ContextMenuShortcut>⌘F</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <GlobeIcon className="size-4" />
          Open in browser
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel inset>Layout</ContextMenuLabel>
        <ContextMenuCheckboxItem
          checked={leftSidebar}
          onCheckedChange={setLeftSidebar}
        >
          <SidebarLeftIcon className="size-4" />
          Left sidebar
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={rightSidebar}
          onCheckedChange={setRightSidebar}
        >
          <SidebarRightIcon className="size-4" />
          Right sidebar
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export const NucleoIcons: Story = {
  parameters: storyDocumentation(
    "Items dressed with Nessa's tracked Nucleo icons in the 16px slot: plain items with shortcuts, a Layout section of checkbox items that pair an icon with the check indicator and keep the menu open while several are toggled, and a destructive Delete item in the destructive semantic color. The play test opens the menu, toggles both sidebar checkboxes without the menu closing, verifies the destructive item resolves a different computed color than a default item, and closes with Escape.",
  ),
  render: () => <NucleoIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = canvasElement.ownerDocument.body
    const documentBody = within(body)
    const trigger = canvas.getByText("Right click the page")

    fireEvent.contextMenu(trigger)
    const rename = await documentBody.findByRole("menuitem", {
      name: /Rename/,
    })
    const remove = documentBody.getByRole("menuitem", { name: /Delete/ })
    await expect(remove).toHaveAttribute("data-variant", "destructive")
    await expect(getComputedStyle(remove).color).not.toBe(
      getComputedStyle(rename).color,
    )
    await expect(
      rename.querySelector('[data-nucleo-icon="edit"]'),
    ).not.toBeNull()

    const leftSidebar = documentBody.getByRole("menuitemcheckbox", {
      name: "Left sidebar",
    })
    await expect(leftSidebar).toHaveAttribute("aria-checked", "true")
    await expect(
      leftSidebar.querySelector('[data-nucleo-icon="sidebar-left"]'),
    ).not.toBeNull()
    await userEvent.click(leftSidebar)
    await userEvent.click(
      documentBody.getByRole("menuitemcheckbox", { name: "Right sidebar" }),
    )
    await expect(
      documentBody.getByRole("menuitemcheckbox", { name: "Left sidebar" }),
    ).toHaveAttribute("aria-checked", "false")
    await expect(
      documentBody.getByRole("menuitemcheckbox", { name: "Right sidebar" }),
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{Escape}")
    await waitForMenuClosed(body)
  },
}
