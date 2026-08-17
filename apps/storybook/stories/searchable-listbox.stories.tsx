import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Check, FileSearch, Play, Wrench } from "lucide-react"
import { expect, userEvent, within } from "storybook/test"
import {
  SearchableListbox,
  type SearchableListboxRenderState,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

interface CommandItem {
  id: string
  label: string
  description: string
  keywords: string[]
  icon: React.ReactNode
  disabled?: boolean
}

const commandItems: CommandItem[] = [
  {
    id: "explore",
    label: "Explore code",
    description: "Search symbols and understand relationships",
    keywords: ["inspect", "research"],
    icon: <FileSearch aria-hidden="true" className="size-4" />,
  },
  {
    id: "review",
    label: "Review changes",
    description: "Inspect the current diff for correctness",
    keywords: ["audit", "diff"],
    icon: <Wrench aria-hidden="true" className="size-4" />,
  },
  {
    id: "run",
    label: "Run workflow",
    description: "Unavailable until the workflow is configured",
    keywords: ["execute", "start"],
    icon: <Play aria-hidden="true" className="size-4" />,
    disabled: true,
  },
]

/** Returns the stable value used by the listbox for a command item. */
function commandItemId(item: CommandItem) {
  return item.id
}

/** Returns all strings that can match a command-item search. */
function commandItemKeywords(item: CommandItem) {
  return [item.label, item.description, ...item.keywords]
}

/** Returns whether the command item is unavailable. */
function commandItemDisabled(item: CommandItem) {
  return Boolean(item.disabled)
}

/** Renders command-specific content inside the generic option surface. */
function renderCommandItem(
  item: CommandItem,
  state: SearchableListboxRenderState,
) {
  return (
    <span className="grid min-h-12 w-full grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-center gap-2 px-2">
      <span className="flex size-8 items-center justify-center rounded-full bg-background shadow-xs">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.description}
        </span>
      </span>
      {state.selected ? (
        <Check aria-hidden="true" className="size-4" />
      ) : null}
    </span>
  )
}

/** Demonstrates controlled selection without coupling the listbox to a domain. */
function SearchableListboxExample() {
  const [value, setValue] = React.useState("explore")
  return (
    <div className="w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SearchableListbox
        items={commandItems}
        getItemId={commandItemId}
        getItemKeywords={commandItemKeywords}
        renderItem={renderCommandItem}
        value={value}
        onValueChange={setValue}
        isItemDisabled={commandItemDisabled}
        searchPlaceholder="Search commands"
        listLabel="Available commands"
      />
    </div>
  )
}

const meta = {
  title: "Components/SearchableListbox",
  component: SearchableListbox,
  tags: ["autodocs", "test"],
  args: {
    items: commandItems,
    getItemId: commandItemId,
    getItemKeywords: commandItemKeywords,
    renderItem: renderCommandItem,
    listLabel: "Available commands",
  },
  parameters: {
    docs: {
      description: {
        component:
          "A searchable single-select list that owns filtering, roving focus, selection semantics, and async states while consumers render domain-specific row content.",
      },
    },
  },
} satisfies Meta<typeof SearchableListbox<CommandItem>>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Use item identity and keyword callbacks to adapt domain records without reshaping them into presentation-only data.",
  ),
  render: () => <SearchableListboxExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByPlaceholderText("Search commands")
    await userEvent.type(search, "review")
    await expect(getComputedStyle(search).outlineStyle).not.toBe("none")
    await expect(
      canvas.getByRole("option", { name: /review changes/i }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("option", { name: /explore code/i }),
    ).not.toBeInTheDocument()
    await userEvent.keyboard("{ArrowDown}")
    const option = canvas.getByRole("option", { name: /review changes/i })
    await expect(option).toHaveFocus()
    await expect(getComputedStyle(option).outlineStyle).not.toBe("none")
    await userEvent.keyboard("{Enter}")
    await expect(option).toHaveAttribute("aria-selected", "true")
  },
}

interface HintedCommandItem {
  id: string
  label: string
  hint: string
}

const hintedItems: HintedCommandItem[] = [
  { id: "archive", label: "/archive", hint: "Archive the current chat" },
  {
    id: "review",
    label: "/review",
    hint: "Review uncommitted changes in the working tree or compare the current branch against any other branch you name",
  },
  { id: "fork", label: "/fork", hint: "Fork this chat" },
]

/** Renders a command row with a leading label and a trailing muted hint. */
function renderHintedItem(
  item: HintedCommandItem,
  _state: SearchableListboxRenderState,
) {
  return (
    <span className="flex min-h-10 w-full items-center gap-2.5 px-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {item.label}
      </span>
      <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
        {item.hint}
      </span>
    </span>
  )
}

export const TrailingHints: Story = {
  parameters: storyDocumentation(
    "Row content is fully custom, so a trailing hint column is a consumer-side layout choice. Hints longer than the row truncate instead of widening the list past its container — the item wrapper is a flex column rather than a grid, because grid tracks size to their content and would defeat truncate on every row.",
  ),
  render: () => (
    <div className="w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SearchableListbox
        items={hintedItems}
        getItemId={(item) => item.id}
        getItemKeywords={(item) => [item.label, item.hint]}
        renderItem={renderHintedItem}
        searchPlaceholder="Search commands"
        listLabel="Available commands"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("option", { name: /review/i })).toBeVisible()
    // Long hints must truncate instead of widening rows past the scroll
    // container: the item wrapper is a flex column, not a grid, because grid
    // tracks size to their content and would defeat truncate on every row.
    const list = canvasElement.querySelector(
      '[data-slot="searchable-listbox-list"]',
    )!
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
    for (const option of canvasElement.querySelectorAll(
      '[data-slot="searchable-listbox-option"]',
    )) {
      await expect(option.scrollWidth).toBeLessThanOrEqual(option.clientWidth)
    }
  },
}

export const DisabledItems: Story = {
  parameters: storyDocumentation(
    "Disabled records remain discoverable by keyboard but cannot be selected.",
  ),
  render: () => <SearchableListboxExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const disabledOption = canvas.getByRole("option", {
      name: /run workflow/i,
    })
    await expect(disabledOption).toHaveAttribute("aria-disabled", "true")
    const search = canvas.getByPlaceholderText("Search commands")
    const selectedOption = canvas.getByRole("option", { name: /explore code/i })
    const focusedOption = canvas.getByRole("option", { name: /review changes/i })
    await userEvent.hover(focusedOption)
    await expect(selectedOption).toHaveAttribute("tabindex", "0")
    await expect(focusedOption).toHaveAttribute("tabindex", "-1")
    selectedOption.focus()
    await userEvent.keyboard("{End}")
    await expect(disabledOption).toHaveFocus()
    await expect(disabledOption).toHaveAttribute("tabindex", "0")
    await expect(selectedOption).toHaveAttribute("tabindex", "-1")
    await userEvent.click(disabledOption)
    await expect(disabledOption).toHaveAttribute("aria-selected", "false")
    search.focus()
    await userEvent.type(search, "review")
    await userEvent.keyboard("{Home}")
    await expect(search).toHaveFocus()
    await expect(search).toHaveProperty("selectionStart", 0)
  },
}

export const Loading: Story = {
  parameters: storyDocumentation(
    "Loading keeps the search surface stable while replacing options with an announced status.",
  ),
  render: () => (
    <div className="w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SearchableListbox
        items={[] as CommandItem[]}
        getItemId={commandItemId}
        getItemKeywords={commandItemKeywords}
        renderItem={renderCommandItem}
        listLabel="Available commands"
        searchPlaceholder="Search commands"
        loading
        loadingMessage="Loading commands"
      />
    </div>
  ),
}

export const Empty: Story = {
  parameters: storyDocumentation(
    "An empty data source communicates its state without exposing an empty listbox.",
  ),
  render: () => (
    <div className="w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SearchableListbox
        items={[] as CommandItem[]}
        getItemId={commandItemId}
        getItemKeywords={commandItemKeywords}
        renderItem={renderCommandItem}
        listLabel="Available commands"
        searchPlaceholder="Search commands"
        emptyMessage="No commands available"
      />
    </div>
  ),
}
