import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Plus } from "lucide-react"
import { Button, GroupHeader, SidebarMenu, SidebarMenuItem } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/GroupHeader",
  component: GroupHeader,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The label above a group of rows: a heading with an optional count, `quiet` (muted, the default) or `strong` (full ink), an optional disclosure that collapses the group, and an optional action at the end. Pass `open` to make the label a disclosure button; the host shows or hides the rows. `actionOnHover` keeps the action out of sight until the header is hovered or holds keyboard focus, on a fine pointer.",
      },
    },
  },
  args: { label: "Sessions", count: 12 },
} satisfies Meta<typeof GroupHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation("A quiet header with a count. The play test proves the count is read as part of the heading."),
  render: (args) => (
    <div className="max-w-xs">
      <GroupHeader {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent("Sessions12")
  },
}

export const Tones: Story = {
  parameters: storyDocumentation("`quiet` and `strong`. The play test proves the strong label is written in a different ink."),
  render: () => (
    <div className="flex max-w-xs flex-col">
      <GroupHeader label="Waiting on you" count={2} tone="strong" />
      <GroupHeader label="Running" count={5} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const strong = getComputedStyle(canvas.getByRole("heading", { name: /Waiting/ })).color
    const quiet = getComputedStyle(canvas.getByRole("heading", { name: /Running/ })).color
    await expect(strong).not.toBe(quiet)
  },
}

const rows = ["Plan the release", "Fix flaky story", "Review tokens"]

function CollapsibleExample() {
  const [open, setOpen] = React.useState(true)
  const [added, setAdded] = React.useState(0)
  const contentId = React.useId()
  return (
    <div className="max-w-xs">
      <GroupHeader
        label="Projects"
        count={rows.length + added}
        open={open}
        onOpenChange={setOpen}
        controls={contentId}
        actionOnHover
        action={
          <Button
            size="icon-sm"
            variant="plain"
            shape="pill"
            aria-label="New project"
            onClick={() => setAdded((count) => count + 1)}
          >
            <Plus />
          </Button>
        }
      />
      <div id={contentId} hidden={!open}>
        <SidebarMenu>
          {rows.map((row) => (
            <SidebarMenuItem key={row} size="xs">
              {row}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
    </div>
  )
}

export const Collapsible: Story = {
  parameters: storyDocumentation(
    "A disclosure with an action that waits for hover. The play test toggles the group by pointer and by keyboard, proves the button announces its state and names the region, and that the action is a separate target that keyboard focus reveals.",
  ),
  render: () => <CollapsibleExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole("button", { name: /Projects/ })
    const region = document.getElementById(toggle.getAttribute("aria-controls")!)!
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(region).toBeVisible()
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(region).not.toBeVisible()
    await userEvent.keyboard("{Enter}")
    await expect(toggle).toHaveAttribute("aria-expanded", "true")

    const add = canvas.getByRole("button", { name: "New project" })
    await userEvent.tab()
    await expect(add).toHaveFocus()
    await waitFor(() => expect(getComputedStyle(add.parentElement!).opacity).toBe("1"))
    await userEvent.keyboard("{Enter}")
    await expect(toggle).toHaveTextContent("Projects4")
  },
}
