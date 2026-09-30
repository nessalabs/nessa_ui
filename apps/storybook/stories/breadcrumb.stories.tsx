import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Breadcrumb, type BreadcrumbStep } from "@nessalabs/ui"

import { finishStoryTransitions } from "./finish-story-transitions"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A one-line way-back trail. items runs from the first step to the current place: each earlier step with an onSelect is a button that returns to it, and the last is the place itself, marked aria-current=\"page\". back leads the first step with a chevron, for a trail whose first step is the way out. The trail is a nav landmark named by label, reads as an ordered list, and truncates long labels while keeping each one's full text as its accessible name and hover text.",
      },
    },
  },
  args: {
    label: "Where this run was opened from",
    items: [
      { label: "Experiments", onSelect: () => {} },
      { label: "Checkout latency", onSelect: () => {} },
      { label: "Run 4" },
    ],
  },
} satisfies Meta<typeof Breadcrumb>

export default meta
type Story = StoryObj<typeof meta>

function TrailDemo() {
  const [returnedTo, setReturnedTo] = React.useState("nowhere yet")
  const items: BreadcrumbStep[] = [
    { label: "Experiments", onSelect: () => setReturnedTo("Experiments") },
    {
      label: "Checkout latency",
      onSelect: () => setReturnedTo("Checkout latency"),
    },
    { label: "Run 4" },
  ]
  return (
    <div className="flex flex-col items-start gap-3">
      <Breadcrumb back items={items} label="Where this run was opened from" />
      <p className="nessa-text-2 text-muted-foreground">
        Returned to: <span data-testid="returned-to">{returnedTo}</span>
      </p>
    </div>
  )
}

export const Trail: Story = {
  parameters: storyDocumentation(
    "Two steps back to where a run was opened from, then the run itself, with the first step leading a back chevron. The play test proves the landmark and its list, that the current place is marked aria-current=\"page\" and takes no focus, and walks the trail by keyboard: Tab reaches each earlier step in order, Enter returns to the first and Space to the second.",
  ),
  render: () => <TrailDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", {
      name: "Where this run was opened from",
    })
    const steps = within(nav).getAllByRole("listitem")
    await expect(steps).toHaveLength(3)
    const current = within(nav).getByText("Run 4").closest("[aria-current]")
    await expect(current).toHaveAttribute("aria-current", "page")
    await expect(within(nav).getAllByRole("button")).toHaveLength(2)
    // The chevron leads only the first step.
    const first = within(nav).getByRole("button", { name: "Experiments" })
    await expect(first.querySelector("svg")).not.toBeNull()

    await userEvent.tab()
    await expect(first).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByTestId("returned-to")).toHaveTextContent(
      "Experiments",
    )
    await userEvent.tab()
    const second = within(nav).getByRole("button", { name: "Checkout latency" })
    await expect(second).toHaveFocus()
    await userEvent.keyboard(" ")
    await expect(canvas.getByTestId("returned-to")).toHaveTextContent(
      "Checkout latency",
    )
    // The current place is the end of the trail, not a stop in it.
    await userEvent.tab()
    await expect(nav.contains(canvasElement.ownerDocument.activeElement)).toBe(
      false,
    )
    finishStoryTransitions(canvasElement)
  },
}

const longTrail: BreadcrumbStep[] = [
  { label: "Every experiment across the workspace", onSelect: () => {} },
  {
    label: "Reduce checkout latency on the slowest regional storefronts",
    onSelect: () => {},
  },
  {
    label: "Run 12 — cache the pricing lookup and batch inventory reads",
  },
]

export const LongLabels: Story = {
  parameters: storyDocumentation(
    "The overflow case: labels far longer than the pane they sit in. The trail stays on one line; every step truncates in proportion to its length, earlier steps capped so the current place keeps the most room, and each keeps its full label as its accessible name and hover text. A second copy sits in a pane too narrow for proportional shrinking to leave usable steps, where the earlier steps hold their 32px floor. The play test asserts both trails fit their panes on a single line, that the narrow trail's steps keep that floor, that the labels are visibly cut, and that each step is still found by its full name.",
  ),
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <div className="w-80 rounded-lg border border-border p-2">
        <Breadcrumb back items={longTrail} label="Run trail" />
      </div>
      <div className="w-36 rounded-lg border border-border p-2">
        <Breadcrumb back items={longTrail} label="Narrow run trail" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", { name: "Run trail" })
    const narrow = canvas.getByRole("navigation", { name: "Narrow run trail" })
    for (const trail of [nav, narrow]) {
      // The list itself fits: nothing spills past the box it is laid out in.
      const list = within(trail).getByRole("list")
      await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
      const centres = within(trail)
        .getAllByRole("listitem")
        .map((item) => {
          const box = item.getBoundingClientRect()
          return box.top + box.height / 2
        })
      for (const centre of centres) {
        await expect(Math.abs(centre - centres[0])).toBeLessThan(1)
      }
    }
    // Squeezed hard, earlier steps stop at their floor and stay targets.
    for (const button of within(narrow).getAllByRole("button")) {
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(
        32,
      )
    }
    for (const item of longTrail) {
      const step = item.onSelect
        ? within(nav).getByRole("button", { name: item.label })
        : within(nav).getByText(item.label).closest("[aria-current]")!
      await expect(step).toHaveAttribute("title", item.label)
      const text = within(step as HTMLElement).getByText(item.label)
      // Cut, not wrapped: the text is wider than the box showing it.
      await expect(text.scrollWidth).toBeGreaterThan(text.clientWidth)
    }
  },
}
