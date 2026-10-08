import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import { Circle, CircleX } from "lucide-react"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  SearchField,
} from "@nessalabs/ui"

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
          "A search box: a magnifier, the query, and at the end either the key that focuses it (while empty and unfocused) or a button that clears it (once there is text). Escape clears a non-empty query and keeps focus; on an empty field Escape is left to the host. A Radix overlay around the field (Drawer, DropdownMenu, Popover) hears Escape first, so guard its `onEscapeKeyDown`: prevent it when the target has `data-clearable`, which the input carries while it holds text it can clear. Three heights: `sm` 28px, `md` 32px, `lg` 36px. Name it with `aria-label` when no visible label does.",
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

    // Escape during IME composition belongs to the composition.
    await userEvent.type(field, "plan")
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true }))
    await expect(field).toHaveValue("plan")
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
    // The shortcut cap is for an empty field; a field holding text shows none.
    await expect(canvasElement.querySelector("[data-slot=search-field-shortcut]")).toBeNull()
  },
}

/**
 * The guard a Radix overlay needs around a search field: its Escape listener
 * runs before the field's, so it stays open only if it lets a search field
 * holding text have the key.
 */
function keepOpenWhileSearchHasText(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement && event.target.dataset.clearable !== undefined) {
    event.preventDefault()
  }
}

function DrawerExample({ readOnly }: { readOnly: boolean }) {
  return (
    <Drawer defaultOpen>
      <DrawerContent onEscapeKeyDown={keepOpenWhileSearchHasText}>
        <DrawerHeader>
          <DrawerTitle>{readOnly ? "Pinned" : "Sessions"}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          {readOnly ? (
            <SearchField aria-label="Pinned search" readOnly defaultValue="pinned" />
          ) : (
            <SearchField aria-label="Search sessions" placeholder="Search" />
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}

export const ReadOnlyInADrawer: Story = {
  parameters: storyDocumentation(
    "The same guard around a read-only field holding text. The field will not clear, so it has no `data-clearable`, the guard lets the key through, and Escape closes the drawer.",
  ),
  render: () => <DrawerExample readOnly />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: "Pinned" })
    const field = within(dialog).getByRole("searchbox", { name: "Pinned search" })
    await expect(field).not.toHaveAttribute("data-clearable")
    await userEvent.click(field)
    await userEvent.keyboard("{Escape}")
    await expect(field).toHaveValue("pinned")
    await waitFor(() => expect(body.queryByRole("dialog", { name: "Pinned" })).toBeNull())
  },
}

const onHostKeyDown = fn((event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Escape") event.preventDefault()
})

export const HostCancelsEscape: Story = {
  parameters: storyDocumentation(
    "The field's own `onKeyDown` can keep the query: calling `preventDefault()` on Escape cancels the clear. The play test proves the text stays.",
  ),
  render: () => (
    <div className="max-w-xs">
      <SearchField aria-label="Kept search" defaultValue="keep me" onKeyDown={onHostKeyDown} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onHostKeyDown.mockClear()
    const field = within(canvasElement).getByRole("searchbox", { name: "Kept search" })
    await userEvent.click(field)
    await userEvent.keyboard("{Escape}")
    await expect(onHostKeyDown).toHaveBeenCalled()
    await expect(field).toHaveValue("keep me")
  },
}

export const InADrawer: Story = {
  parameters: storyDocumentation(
    "A search field inside a Drawer. The drawer hears Escape first, so the host guards it: `onEscapeKeyDown` prevents the close while the event's target carries `data-clearable`. The play test proves the first Escape clears the query and the drawer stays open, and the next one closes the drawer.",
  ),
  render: () => <DrawerExample readOnly={false} />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: "Sessions" })
    const field = within(dialog).getByRole("searchbox", { name: "Search sessions" })
    await userEvent.click(field)
    await userEvent.type(field, "plan")
    await expect(field).toHaveAttribute("data-clearable", "true")
    await userEvent.keyboard("{Escape}")
    await expect(field).toHaveValue("")
    // A closing drawer stays in the DOM while it slides out, so presence
    // proves nothing; its open state is what the guard keeps.
    await expect(dialog).toHaveAttribute("data-state", "open")
    await expect(field).toHaveFocus()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(body.queryByRole("dialog", { name: "Sessions" })).toBeNull())
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
      <SearchField aria-label="Read-only search" readOnly defaultValue="pinned" shortcut="⌘K" />
      <SearchField aria-label="Fixed search" value="pinned" shortcut="/" />
    </div>
  )
}

const onFormQuery = fn()

export const FormReset: Story = {
  parameters: storyDocumentation(
    "An uncontrolled field in a form returns to its `defaultValue` when the form resets, and tells the host. The play test edits the query, resets the form, and proves the field and the host both see the default again.",
  ),
  render: () => (
    <form className="flex max-w-xs flex-col gap-2">
      <SearchField aria-label="Saved search" defaultValue="open" onValueChange={onFormQuery} />
      <button type="reset">Reset</button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    onFormQuery.mockClear()
    const canvas = within(canvasElement)
    const field = canvas.getByRole("searchbox", { name: "Saved search" })
    await userEvent.clear(field)
    await userEvent.type(field, "closed")
    await expect(field).toHaveValue("closed")
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }))
    await expect(field).toHaveValue("open")
    await expect(onFormQuery).toHaveBeenLastCalledWith("open")
    // It stays reset through the next render rather than snapping back.
    await userEvent.type(field, "!")
    await expect(field).toHaveValue("open!")
  },
}

export const SurfaceHooks: Story = {
  parameters: storyDocumentation(
    "How a host matches the field to its own surface without overriding classes: `icon` and `clearIcon` take its own glyphs, and custom properties set on any ancestor retune the corner, padding, fills, inks and type size. The play test proves the defaults are exactly the kit's values (against reference elements drawn with the kit's own classes) and that each property, set on a wrapper, reaches the field.",
  ),
  render: () => (
    <div className="flex max-w-xs flex-col gap-3">
      <SearchField aria-label="Default search" defaultValue="query" />
      <div data-testid="reference" className="flex flex-col gap-1">
        <span data-ref="rest" className="block h-2 rounded-md bg-foreground/(--nessa-state-hover)" />
        <span data-ref="hover" className="block h-2 bg-foreground/(--nessa-state-hover-strong)" />
        <span data-ref="type" className="nessa-text-input-2 text-foreground">Aa</span>
        <span data-ref="muted" className="text-muted-foreground ps-2.5">Aa</span>
      </div>
      <div
        data-testid="hooked"
        style={
          {
            "--nessa-search-radius": "12px",
            "--nessa-search-padding-x": "12px",
            "--nessa-search-padding-y": "8px",
            "--nessa-search-rest-fill": "rgb(240, 240, 250)",
            "--nessa-search-hover-fill": "rgb(230, 230, 242)",
            "--nessa-search-ink": "rgb(20, 30, 40)",
            "--nessa-search-muted-ink": "rgb(60, 60, 70)",
            "--nessa-search-font-size": "13px",
          } as React.CSSProperties
        }
      >
        <SearchField
          aria-label="Hooked search"
          placeholder="Search"
          icon={<Circle data-testid="own-icon" />}
          clearIcon={<CircleX data-testid="own-clear" />}
          defaultValue="query"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ref = (name: string) => getComputedStyle(canvasElement.querySelector(`[data-ref=${name}]`)!)
    const frameOf = (name: string) =>
      canvas.getByRole("searchbox", { name }).closest<HTMLElement>("[data-slot=search-field]")!
    // Defaults are the kit's own values.
    const field = frameOf("Default search")
    const frame = getComputedStyle(field)
    const input = getComputedStyle(canvas.getByRole("searchbox", { name: "Default search" }))
    const icon = getComputedStyle(field.querySelector("[data-slot=search-field-icon]")!)
    await expect(frame.backgroundColor).toBe(ref("rest").backgroundColor)
    await expect(frame.borderTopLeftRadius).toBe(ref("rest").borderTopLeftRadius)
    await expect(frame.paddingInlineStart).toBe(ref("muted").paddingInlineStart)
    await expect(frame.paddingTop).toBe("0px")
    await expect(frame.height).toBe("32px")
    await expect(input.fontSize).toBe(ref("type").fontSize)
    await expect(input.lineHeight).toBe(ref("type").lineHeight)
    await expect(input.color).toBe(ref("type").color)
    await expect(icon.color).toBe(ref("muted").color)
    await expect(field.querySelector("svg.lucide-search")).not.toBeNull()
    // Hover and focus share the hover fill; focus is the one a test can drive.
    canvas.getByRole("searchbox", { name: "Default search" }).focus()
    await waitFor(() => expect(getComputedStyle(field).backgroundColor).toBe(ref("hover").backgroundColor))

    // Each hook reaches the field.
    const hooked = frameOf("Hooked search")
    const hookedFrame = getComputedStyle(hooked)
    const hookedInput = getComputedStyle(canvas.getByRole("searchbox", { name: "Hooked search" }))
    await expect(hookedFrame.borderTopLeftRadius).toBe("12px")
    await expect(hookedFrame.paddingInlineStart).toBe("12px")
    await expect(hookedFrame.paddingTop).toBe("8px")
    await waitFor(() => expect(getComputedStyle(hooked).backgroundColor).toBe("rgb(240, 240, 250)"))
    await expect(hookedInput.color).toBe("rgb(20, 30, 40)")
    await expect(hookedInput.fontSize).toBe("13px")
    await expect(getComputedStyle(hooked.querySelector("[data-slot=search-field-icon]")!).color).toBe("rgb(60, 60, 70)")
    await expect(within(hooked).getByTestId("own-icon")).toBeInTheDocument()
    await expect(hooked.querySelector("svg.lucide-search")).toBeNull()
    await expect(within(hooked).getByTestId("own-clear")).toBeInTheDocument()
    canvas.getByRole("searchbox", { name: "Hooked search" }).focus()
    await waitFor(() => expect(getComputedStyle(hooked).backgroundColor).toBe("rgb(230, 230, 242)"))
  },
}

export const Disabled: Story = {
  parameters: storyDocumentation("A disabled field is dimmed, cannot be typed in, and has nothing to clear."),
  render: () => (
    <div className="max-w-xs">
      <SearchField aria-label="Search" placeholder="Search" disabled defaultValue="locked" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole("searchbox", { name: "Search" })
    await expect(field).toBeDisabled()
    // A disabled field cannot be cleared, so it gives an overlay guard nothing to hold.
    await expect(field).not.toHaveAttribute("data-clearable")
    await expect(canvas.queryByRole("button", { name: "Clear search", hidden: true })).toBeNull()
  },
}
