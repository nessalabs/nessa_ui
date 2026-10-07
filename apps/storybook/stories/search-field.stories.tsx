import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { SearchField } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/SearchField",
  component: SearchField,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A search box: a magnifier, the query, and at the end either the key that focuses it (while empty and unfocused) or a button that clears it (once there is text). Escape clears a non-empty query and keeps focus; on an empty field Escape is left to the host. Three heights: `sm` 28px, `md` 32px, `lg` 36px. Name it with `aria-label` when no visible label does.",
      },
    },
  },
  args: { "aria-label": "Search sessions", placeholder: "Search", shortcut: "⌘K" },
} satisfies Meta<typeof SearchField>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation("One field with a shortcut hint. Type to see the clear button replace it."),
  render: (args) => (
    <div className="max-w-xs">
      <SearchField {...args} />
    </div>
  ),
}

export const Sizes: Story = {
  parameters: storyDocumentation("The three heights. The play test measures each."),
  render: () => (
    <div className="flex max-w-xs flex-col gap-3">
      <SearchField size="sm" aria-label="Small" placeholder="Search" shortcut="/" />
      <SearchField size="md" aria-label="Medium" placeholder="Search" shortcut="⌘K" />
      <SearchField size="lg" aria-label="Large" placeholder="Search settings" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const height = (name: string) =>
      canvas.getByRole("searchbox", { name }).closest<HTMLElement>("[data-slot=search-field]")!.getBoundingClientRect().height
    await expect(height("Small")).toBe(28)
    await expect(height("Medium")).toBe(32)
    await expect(height("Large")).toBe(36)
  },
}

const onClear = fn()
const onHostEscape = fn()

function ControlledExample() {
  const [query, setQuery] = React.useState("")
  return (
    <div
      className="flex max-w-xs flex-col gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") onHostEscape()
      }}
    >
      <SearchField
        aria-label="Search sessions"
        placeholder="Search"
        shortcut="⌘K"
        value={query}
        onValueChange={setQuery}
        onClear={onClear}
      />
      <p className="m-0 font-mono nessa-text-2 text-muted-foreground" data-testid="query">
        query: {query}
      </p>
    </div>
  )
}

export const ClearAndEscape: Story = {
  parameters: storyDocumentation(
    "Controlled. The play test proves the shortcut shows only while the field is empty and unfocused, the clear button empties the query and returns focus, Escape clears a query without leaving the field, and an Escape on an empty field reaches the host.",
  ),
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    onClear.mockClear()
    const field = canvas.getByRole("searchbox", { name: "Search sessions" })
    const hint = canvasElement.querySelector<HTMLElement>("[data-slot=search-field-shortcut]")!
    await expect(getComputedStyle(hint).display).not.toBe("none")
    await userEvent.click(field)
    await expect(getComputedStyle(hint).display).toBe("none")

    await userEvent.type(field, "deploy")
    await expect(canvas.getByTestId("query")).toHaveTextContent("query: deploy")
    await expect(canvasElement.querySelector("[data-slot=search-field-shortcut]")).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }))
    await expect(field).toHaveValue("")
    await expect(field).toHaveFocus()
    await expect(onClear).toHaveBeenCalledTimes(1)

    await userEvent.type(field, "plan")
    onHostEscape.mockClear()
    await userEvent.keyboard("{Escape}")
    await expect(field).toHaveValue("")
    await expect(field).toHaveFocus()
    await expect(onHostEscape).not.toHaveBeenCalled()
    await userEvent.keyboard("{Escape}")
    await expect(onHostEscape).toHaveBeenCalledTimes(1)
    // Tab never stops on the clear button: Escape does its job from the field.
    await userEvent.type(field, "x")
    const clearButton = canvas.getByRole("button", { name: "Clear search" })
    await expect(clearButton).toHaveAttribute("tabindex", "-1")
    await userEvent.tab()
    await expect(clearButton).not.toHaveFocus()
    await expect(field).not.toHaveFocus()
  },
}

export const ReadOnlyAndUncontrolledValue: Story = {
  parameters: storyDocumentation(
    "A field that cannot change has nothing to clear: a read-only field, and a controlled one with no `onValueChange`, show no clear button and leave Escape to the host. The play test presses Escape in each and proves the text stays and the host hears the key.",
  ),
  render: () => <FixedFieldsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ["Read-only search", "Fixed search"]) {
      onHostEscape.mockClear()
      const field = canvas.getByRole("searchbox", { name })
      await userEvent.click(field)
      await userEvent.keyboard("{Escape}")
      await expect(field).toHaveValue("pinned")
      await expect(onHostEscape).toHaveBeenCalledTimes(1)
    }
    await expect(canvas.queryByRole("button", { name: "Clear search" })).toBeNull()
  },
}

function FixedFieldsExample() {
  return (
    <div
      className="flex max-w-xs flex-col gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") onHostEscape()
      }}
    >
      <SearchField aria-label="Read-only search" readOnly defaultValue="pinned" />
      <SearchField aria-label="Fixed search" value="pinned" />
    </div>
  )
}

export const Disabled: Story = {
  parameters: storyDocumentation("A disabled field is dimmed and cannot be typed in."),
  render: () => (
    <div className="max-w-xs">
      <SearchField aria-label="Search" placeholder="Search" disabled defaultValue="locked" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("searchbox", { name: "Search" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Clear search", hidden: true })).toBeDisabled()
  },
}
