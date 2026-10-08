import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { ChevronRight, Plus } from "lucide-react"
import { Button, GroupHeader, SidebarMenu, SidebarMenuItem } from "@nessalabs/ui"

import { stateStyle } from "./state-style"
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
    const heading = canvas.getByRole("heading", { level: 2, name: "Sessions 12" })
    // The space is in the text itself, not left to how an engine joins
    // the label and the count when it computes the name.
    await expect(heading.textContent).toBe("Sessions 12")
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

const initialRows = ["Plan the release", "Fix flaky story", "Review tokens"]

// A disclosure always comes with its handler: `open` alone is a type error,
// so a header can never draw a disclosure button that does nothing.
// @ts-expect-error `open` requires `onOpenChange`.
const _openWithoutHandler = <GroupHeader label="Projects" open />
void _openWithoutHandler

function CollapsibleExample() {
  const [open, setOpen] = React.useState(true)
  const [rows, setRows] = React.useState(initialRows)
  const contentId = React.useId()
  return (
    <div className="max-w-xs">
      <GroupHeader
        label="Projects"
        count={rows.length}
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
            onClick={() => setRows((all) => [...all, `Untitled ${all.length + 1}`])}
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
    await expect(canvas.getByRole("button", { name: "Projects 4" })).toBe(toggle)
    // The count is the rows drawn under it.
    await expect(within(region).getAllByRole("listitem")).toHaveLength(4)
    await expect(within(region).getByRole("button", { name: "Untitled 4" })).toBeInTheDocument()
  },
}

function DenseExample() {
  const [open, setOpen] = React.useState(true)
  const [locked, setLocked] = React.useState(true)
  const toggleRef = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    toggleRef.current?.setAttribute("data-ref-attached", "true")
  }, [])
  return (
    <div className="flex max-w-xs flex-col gap-3">
      <GroupHeader label="Default" count={3} />
      <GroupHeader label="Loud" tone="strong" />
      <GroupHeader label="Plain chevron" open onOpenChange={() => {}} />
      <div data-testid="reference" className="flex flex-col">
        <span data-ref="quiet" className="nessa-text-2 font-medium text-muted-foreground">Aa</span>
        <span data-ref="strong" className="text-foreground">Aa</span>
        <span data-ref="caption" className="nessa-text-1 font-semibold">Aa</span>
      </div>
      <GroupHeader
        size="dense"
        label="Channels"
        count={8}
        open={open}
        onOpenChange={setOpen}
        chevron={<ChevronRight data-testid="own-chevron" />}
        toggleProps={{
          "data-row": "section",
          "data-section": "channels",
          className: "host-toggle",
          ref: toggleRef,
          onClick: (event) => {
            if (locked) {
              event.preventDefault()
              setLocked(false)
            }
          },
        }}
      />
      <div
        style={
          {
            "--nessa-group-header-height": "16.5px",
            "--nessa-group-header-ink": "rgb(90, 90, 100)",
            "--nessa-group-header-count-ink": "rgb(80, 80, 90)",
            "--nessa-group-header-chevron-ink": "rgb(70, 70, 80)",
            "--nessa-group-header-strong-ink": "rgb(15, 15, 25)",
            "--nessa-group-header-hover-ink": "rgb(5, 5, 15)",
          } as React.CSSProperties
        }
      >
        <GroupHeader size="dense" label="Hooked" count={2} open onOpenChange={() => {}} />
        <GroupHeader label="Hooked loud" tone="strong" />
      </div>
    </div>
  )
}

export const DenseAndHooks: Story = {
  parameters: storyDocumentation(
    "`size=\"dense\"` is a caption header (level 1, semibold, 24px, its disclosure filling it) for a sidebar's section labels. `chevron` takes the host's glyph, `toggleProps` puts `data-*` attributes and handlers on the one disclosure button (an `onClick` there that calls `preventDefault()` keeps the group as it is), and custom properties retune the height and inks. The play test proves the default header is still the kit's 28px level-2 medium muted label, the dense one is a 24px caption whose disclosure fills it, the toggle carries the host's attributes and stays one button, and each property reaches the header.",
  ),
  render: () => <DenseExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ref = (name: string) => getComputedStyle(canvasElement.querySelector(`[data-ref=${name}]`)!)
    const header = (name: RegExp) =>
      canvas.getByRole("heading", { name }).closest<HTMLElement>("[data-slot=group-header]")!

    const plain = getComputedStyle(canvas.getByRole("heading", { name: /^Default/ }))
    await expect(header(/^Default/).getBoundingClientRect().height).toBe(28)
    await expect(plain.fontSize).toBe(ref("quiet").fontSize)
    await expect(plain.fontWeight).toBe(ref("quiet").fontWeight)
    await expect(plain.color).toBe(ref("quiet").color)

    await expect(getComputedStyle(canvas.getByRole("heading", { name: "Loud" })).color).toBe(ref("strong").color)
    const plainToggle = canvas.getByRole("button", { name: "Plain chevron" })
    await expect(plainToggle.querySelector("svg")!.getBoundingClientRect().width).toBe(12)
    await expect(plainToggle.getBoundingClientRect().height).toBe(24)
    if (matchMedia("(hover: hover)").matches) {
      await expect(stateStyle(plainToggle, ":hover", "color")).toBe(ref("strong").color)
    }

    const dense = canvas.getByRole("heading", { name: /^Channels/ })
    await expect(header(/^Channels/).getBoundingClientRect().height).toBe(24)
    await expect(getComputedStyle(dense).fontSize).toBe(ref("caption").fontSize)
    await expect(getComputedStyle(dense).fontWeight).toBe(ref("caption").fontWeight)

    const toggle = within(dense).getByRole("button")
    await expect(within(dense).getAllByRole("button")).toHaveLength(1)
    await expect(toggle).toHaveAttribute("data-row", "section")
    await expect(toggle).toHaveAttribute("data-section", "channels")
    await expect(toggle).toHaveClass("host-toggle")
    await expect(toggle).toHaveAttribute("data-ref-attached", "true")
    // The dense disclosure fills the 24px header: a full target that never
    // reaches past the header into the rows beside it.
    const headerBox = header(/^Channels/).getBoundingClientRect()
    const toggleBox = toggle.getBoundingClientRect()
    await expect(toggleBox.height).toBe(24)
    await expect(toggleBox.top).toBeGreaterThanOrEqual(headerBox.top)
    await expect(toggleBox.bottom).toBeLessThanOrEqual(headerBox.bottom)
    await expect(within(toggle).getByTestId("own-chevron")).toBeInTheDocument()
    // The host's onClick prevented the first toggle; the second goes through.
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-expanded", "false")

    const hooked = header(/^Hooked 2/)
    await expect(hooked.getBoundingClientRect().height).toBe(16.5)
    await expect(getComputedStyle(canvas.getByRole("heading", { name: /^Hooked 2/ })).color).toBe("rgb(90, 90, 100)")
    await expect(getComputedStyle(hooked.querySelector("[data-slot=group-header-count]")!).color).toBe("rgb(80, 80, 90)")
    await expect(getComputedStyle(hooked.querySelector("[data-slot=group-header-chevron]")!).color).toBe("rgb(70, 70, 80)")
    await expect(getComputedStyle(canvas.getByRole("heading", { name: "Hooked loud" })).color).toBe("rgb(15, 15, 25)")
    if (matchMedia("(hover: hover)").matches) {
      await expect(stateStyle(within(hooked).getByRole("button"), ":hover", "color")).toBe("rgb(5, 5, 15)")
    }
  },
}
