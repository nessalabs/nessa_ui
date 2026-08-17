import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Archive,
  BarChart3,
  BookOpen,
  Bot,
  Braces,
  Check,
  Chrome,
  Cloud,
  Code2,
  Compass,
  Database,
  Download,
  FileDown,
  FileStack,
  Github,
  GitBranch,
  GitFork,
  HardDrive,
  Image,
  Keyboard,
  LifeBuoy,
  MessageSquare,
  MessagesSquare,
  Minimize2,
  NotebookText,
  Package,
  Pencil,
  Presentation,
  ScrollText,
  Sparkles,
  Table,
  Target,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react"
import { expect, userEvent, within } from "storybook/test"
import {
  SectionedListbox,
  type SectionedListboxRenderState,
  type SectionedListboxSection,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

interface PluginItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  disabled?: boolean
}

const pluginSections: SectionedListboxSection<PluginItem>[] = [
  {
    id: "plugins",
    label: "Plugins",
    items: [
      {
        id: "template-creator",
        label: "Template Creator",
        description: "Create or update reusable templates from reference content",
        icon: <Wand2 aria-hidden="true" className="size-4" />,
      },
      {
        id: "sites",
        label: "Sites",
        description: "Build and deploy websites with Sites",
        icon: <Package aria-hidden="true" className="size-4" />,
      },
      {
        id: "browser",
        label: "Browser",
        description: "Control the in-app browser",
        icon: <Chrome aria-hidden="true" className="size-4" />,
      },
      {
        id: "computer",
        label: "Computer",
        description: "Control Mac apps",
        icon: <Bot aria-hidden="true" className="size-4" />,
      },
      {
        id: "code-interpreter",
        label: "Code Interpreter",
        description: "Run and debug code in a sandboxed environment",
        icon: <Code2 aria-hidden="true" className="size-4" />,
      },
      {
        id: "pdf-export",
        label: "PDF Export",
        description: "Export documents and reports as PDF",
        icon: <FileDown aria-hidden="true" className="size-4" />,
      },
      {
        id: "slides-generator",
        label: "Slides Generator",
        description: "Turn outlines into presentation decks",
        icon: <Presentation aria-hidden="true" className="size-4" />,
      },
      {
        id: "spreadsheet-tools",
        label: "Spreadsheet Tools",
        description: "Build formulas and analyze tabular data",
        icon: <Table aria-hidden="true" className="size-4" />,
      },
      {
        id: "image-studio",
        label: "Image Studio",
        description: "Generate and edit images from prompts",
        icon: <Image aria-hidden="true" className="size-4" />,
      },
      {
        id: "visualize",
        label: "Visualize",
        description: "Turn ideas and data into interactive visuals",
        icon: <BarChart3 aria-hidden="true" className="size-4" />,
      },
    ],
  },
  {
    id: "connectors",
    label: "Connectors",
    items: [
      {
        id: "data-analytics",
        label: "Data Analytics",
        description: "Answer product and business questions with data",
        icon: <Database aria-hidden="true" className="size-4" />,
      },
      {
        id: "google-drive",
        label: "Google Drive",
        description: "Search and attach files from Drive",
        icon: <HardDrive aria-hidden="true" className="size-4" />,
      },
      {
        id: "notion",
        label: "Notion",
        description: "Pull pages and databases into context",
        icon: <NotebookText aria-hidden="true" className="size-4" />,
      },
      {
        id: "linear",
        label: "Linear",
        description: "Connect a workspace to enable Linear",
        icon: <GitBranch aria-hidden="true" className="size-4" />,
        disabled: true,
      },
      {
        id: "team-chat",
        label: "Team Chat",
        description: "Search and post to shared channels",
        icon: <MessagesSquare aria-hidden="true" className="size-4" />,
      },
      {
        id: "github",
        label: "GitHub",
        description: "Triage PRs, issues, CI, and publish flows",
        icon: <Github aria-hidden="true" className="size-4" />,
      },
    ],
  },
]

/** Returns the stable value used by the listbox for a plugin item. */
function pluginItemId(item: PluginItem) {
  return item.id
}

/** Returns whether the plugin item is unavailable. */
function pluginItemDisabled(item: PluginItem) {
  return Boolean(item.disabled)
}

/** Renders a plugin row with a stacked title and description, matching a plugin browser. */
function renderPluginItem(
  item: PluginItem,
  state: SectionedListboxRenderState,
) {
  return (
    <span className="grid min-h-11 w-full grid-cols-[1.75rem_minmax(0,1fr)_1.25rem] items-center gap-2.5 px-2">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center text-muted-foreground [&_svg]:size-4"
      >
        {item.icon}
      </span>
      <span className="min-w-0 truncate text-sm">
        <span className="font-medium text-foreground">{item.label}</span>
        <span className="text-muted-foreground"> {item.description}</span>
      </span>
      {state.selected ? (
        <Check aria-hidden="true" className="size-4" />
      ) : null}
    </span>
  )
}

/** Demonstrates controlled selection without coupling the listbox to a domain. */
function PluginListExample() {
  const [value, setValue] = React.useState("template-creator")
  return (
    <div className="h-80 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SectionedListbox
        sections={pluginSections}
        getItemId={pluginItemId}
        renderItem={renderPluginItem}
        value={value}
        onValueChange={setValue}
        isItemDisabled={pluginItemDisabled}
        listLabel="Available plugins"
      />
    </div>
  )
}

interface CommandItem {
  id: string
  label: string
  hint: string
  icon: React.ReactNode
}

const commandSections: SectionedListboxSection<CommandItem>[] = [
  {
    id: "chat",
    label: "Chat actions",
    items: [
      {
        id: "archive",
        label: "Archive",
        hint: "Archive the current chat",
        icon: <Archive aria-hidden="true" className="size-4" />,
      },
      {
        id: "cloud",
        label: "Cloud for nessa",
        hint: "Run this chat in the cloud",
        icon: <Cloud aria-hidden="true" className="size-4" />,
      },
      {
        id: "code-review",
        label: "Code review",
        hint: "Review uncommitted changes or compare against a branch",
        icon: <Braces aria-hidden="true" className="size-4" />,
      },
      {
        id: "compact",
        label: "Compact",
        hint: "Compact this chat's context (36% full)",
        icon: <Minimize2 aria-hidden="true" className="size-4" />,
      },
      {
        id: "fast",
        label: "Fast",
        hint: "1.5x speed, increased usage",
        icon: <Zap aria-hidden="true" className="size-4" />,
      },
      {
        id: "feedback",
        label: "Feedback",
        hint: "Send feedback about this chat",
        icon: <MessageSquare aria-hidden="true" className="size-4" />,
      },
      {
        id: "fork-chat",
        label: "Fork chat",
        hint: "Fork this chat",
        icon: <GitFork aria-hidden="true" className="size-4" />,
      },
    ],
  },
  {
    id: "session",
    label: "Session",
    items: [
      {
        id: "goal",
        label: "Goal",
        hint: "Set a goal to keep pursuing",
        icon: <Target aria-hidden="true" className="size-4" />,
      },
      {
        id: "memories",
        label: "Memories",
        hint: "Generate on",
        icon: <Sparkles aria-hidden="true" className="size-4" />,
      },
      {
        id: "mcp",
        label: "MCP",
        hint: "Show MCP server status",
        icon: <Compass aria-hidden="true" className="size-4" />,
      },
      {
        id: "model",
        label: "Model",
        hint: "GPT-5.6 Sol",
        icon: <FileStack aria-hidden="true" className="size-4" />,
      },
      {
        id: "rename-chat",
        label: "Rename chat",
        hint: "Change the chat title",
        icon: <Pencil aria-hidden="true" className="size-4" />,
      },
      {
        id: "export-transcript",
        label: "Export transcript",
        hint: "Download this conversation as markdown",
        icon: <Download aria-hidden="true" className="size-4" />,
      },
      {
        id: "delete-chat",
        label: "Delete chat",
        hint: "Permanently delete this chat",
        icon: <Trash2 aria-hidden="true" className="size-4" />,
      },
    ],
  },
  {
    id: "help",
    label: "Help",
    items: [
      {
        id: "documentation",
        label: "Documentation",
        hint: "Open the docs site",
        icon: <BookOpen aria-hidden="true" className="size-4" />,
      },
      {
        id: "keyboard-shortcuts",
        label: "Keyboard shortcuts",
        hint: "View all shortcuts",
        icon: <Keyboard aria-hidden="true" className="size-4" />,
      },
      {
        id: "release-notes",
        label: "Release notes",
        hint: "See what's new",
        icon: <ScrollText aria-hidden="true" className="size-4" />,
      },
      {
        id: "contact-support",
        label: "Contact support",
        hint: "Get help from the team",
        icon: <LifeBuoy aria-hidden="true" className="size-4" />,
      },
    ],
  },
]

/** Returns the stable value used by the listbox for a command item. */
function commandItemId(item: CommandItem) {
  return item.id
}

/** Renders a command row with a leading label and a trailing muted hint, matching a slash-command menu. */
function renderCommandItem(
  item: CommandItem,
  _state: SectionedListboxRenderState,
) {
  return (
    <span className="flex min-h-10 w-full items-center gap-2.5 px-2">
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4"
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {item.label}
      </span>
      <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
        {item.hint}
      </span>
    </span>
  )
}

const meta = {
  title: "Components/SectionedListbox",
  component: SectionedListbox,
  tags: ["autodocs", "test"],
  args: {
    sections: pluginSections,
    getItemId: pluginItemId,
    renderItem: renderPluginItem,
    listLabel: "Available plugins",
  },
  parameters: {
    docs: {
      description: {
        component:
          "A single-select list of items grouped under sticky section headers, with roving keyboard focus that moves continuously across section boundaries. Unlike SearchableListbox, it has no built-in search field — pair it with an external filter input when one is needed.",
      },
    },
  },
} satisfies Meta<typeof SectionedListbox<PluginItem>>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Section headers stay pinned to the top of the scroll container as items scroll beneath them.",
  ),
  render: () => <PluginListExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("option", { name: /template creator/i }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("group", { name: "Plugins" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("group", { name: "Connectors" }),
    ).toBeVisible()
  },
}

export const DisabledItems: Story = {
  parameters: storyDocumentation(
    "Disabled items remain discoverable but are skipped by keyboard navigation, excluded from the roving tabstop, and cannot be selected.",
  ),
  render: () => <PluginListExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const disabledOption = canvas.getByRole("option", { name: /linear/i })
    await expect(disabledOption).toBeDisabled()

    const selectedOption = canvas.getByRole("option", {
      name: /template creator/i,
    })
    const focusedOption = canvas.getByRole("option", { name: /^sites/i })
    await userEvent.hover(focusedOption)
    await expect(selectedOption).toHaveAttribute("tabindex", "0")
    await expect(focusedOption).toHaveAttribute("tabindex", "-1")

    focusedOption.focus()
    await userEvent.keyboard("{End}")
    const lastEnabledOption = canvas.getByRole("option", { name: /github/i })
    await expect(lastEnabledOption).toHaveFocus()
    await expect(lastEnabledOption).toHaveAttribute("tabindex", "0")
    await expect(selectedOption).toHaveAttribute("tabindex", "-1")
    await expect(disabledOption).toHaveAttribute("tabindex", "-1")

    await userEvent.keyboard("{Home}")
    await expect(selectedOption).toHaveFocus()
    await expect(selectedOption).toHaveAttribute("tabindex", "0")
    await expect(lastEnabledOption).toHaveAttribute("tabindex", "-1")

    // Arrow navigation must skip the disabled item entirely rather than
    // merely marking it unselectable: from the enabled item immediately
    // before Linear, ArrowDown should land past it, not on it.
    const beforeDisabled = canvas.getByRole("option", { name: /^notion/i })
    const afterDisabled = canvas.getByRole("option", { name: /team chat/i })
    beforeDisabled.focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect(afterDisabled).toHaveFocus()
    await expect(disabledOption).not.toHaveFocus()

    // Enter must activate the focused, non-disabled option, the same as a
    // native button's default keyboard behavior.
    const browserOption = canvas.getByRole("option", { name: /^browser/i })
    browserOption.focus()
    await userEvent.keyboard("{Enter}")
    await expect(browserOption).toHaveAttribute("aria-selected", "true")
    await expect(selectedOption).toHaveAttribute("aria-selected", "false")
  },
}

export const SelectedButDisabled: Story = {
  parameters: storyDocumentation(
    "When the controlled value points at an item that is also disabled, it stays visibly selected but is excluded from the roving tabstop — focus falls back to the first enabled item instead of landing on an item the user cannot activate.",
  ),
  render: () => (
    <div className="h-80 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SectionedListbox
        sections={pluginSections}
        getItemId={pluginItemId}
        renderItem={renderPluginItem}
        value="linear"
        isItemDisabled={pluginItemDisabled}
        listLabel="Available plugins"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const disabledSelected = canvas.getByRole("option", { name: /linear/i })
    await expect(disabledSelected).toBeDisabled()
    await expect(disabledSelected).toHaveAttribute("aria-selected", "true")
    await expect(disabledSelected).toHaveAttribute("tabindex", "-1")

    const firstEnabled = canvas.getByRole("option", {
      name: /template creator/i,
    })
    await expect(firstEnabled).toHaveAttribute("tabindex", "0")
  },
}

export const TrailingHints: Story = {
  parameters: storyDocumentation(
    "Row content is fully custom, so a trailing hint column (e.g. a shortcut or current value) is a consumer-side layout choice rather than a prop.",
  ),
  render: () => {
    function CommandMenu() {
      const [value, setValue] = React.useState("archive")
      return (
        <div className="h-80 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
          <SectionedListbox
            sections={commandSections}
            getItemId={commandItemId}
            renderItem={renderCommandItem}
            value={value}
            onValueChange={setValue}
            listLabel="Available commands"
          />
        </div>
      )
    }
    return <CommandMenu />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const archive = canvas.getByRole("option", { name: /archive/i })
    await expect(archive).toHaveAttribute("aria-selected", "true")
    await userEvent.hover(canvas.getByRole("option", { name: /goal/i }))
    await expect(canvas.getByRole("option", { name: /goal/i })).toHaveAttribute(
      "data-highlighted",
      "true",
    )
    // Long hints must truncate instead of widening rows past the scroll
    // container: the item wrapper is a flex column, not a grid, because grid
    // tracks size to their content and would defeat truncate on every row.
    const list = canvasElement.querySelector('[data-slot="sectioned-listbox"]')!
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
    for (const option of canvasElement.querySelectorAll(
      '[data-slot="sectioned-listbox-option"]',
    )) {
      await expect(option.scrollWidth).toBeLessThanOrEqual(option.clientWidth)
    }
  },
}

export const KeyboardCrossesSections: Story = {
  parameters: storyDocumentation(
    "Arrow-key navigation treats the list as one continuous sequence, moving from the last item of one section straight into the first item of the next.",
  ),
  render: () => (
    <div className="h-80 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SectionedListbox
        sections={pluginSections}
        getItemId={pluginItemId}
        renderItem={renderPluginItem}
        listLabel="Available plugins"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const lastInFirstSection = canvas.getByRole("option", {
      name: /visualize/i,
    })
    lastInFirstSection.focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect(
      canvas.getByRole("option", { name: /data analytics/i }),
    ).toHaveFocus()
  },
}

export const Loading: Story = {
  parameters: storyDocumentation(
    "Loading replaces the sections with an announced status while keeping the surrounding surface stable.",
  ),
  render: () => (
    <div className="h-80 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SectionedListbox
        sections={[] as SectionedListboxSection<PluginItem>[]}
        getItemId={pluginItemId}
        renderItem={renderPluginItem}
        listLabel="Available plugins"
        loading
        loadingMessage="Loading plugins"
      />
    </div>
  ),
}

export const Empty: Story = {
  parameters: storyDocumentation(
    "An empty data source communicates its state without exposing an empty listbox.",
  ),
  render: () => (
    <div className="h-80 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
      <SectionedListbox
        sections={[] as SectionedListboxSection<PluginItem>[]}
        getItemId={pluginItemId}
        renderItem={renderPluginItem}
        listLabel="Available plugins"
        emptyMessage="No plugins available"
      />
    </div>
  ),
}
