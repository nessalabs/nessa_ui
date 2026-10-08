import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Bell, Search, Settings } from "lucide-react"
import { Button, Tooltip, TooltipProvider, formatShortcut } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  tags: ["autodocs", "test", "reduced-motion"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A short label for a control, shown after the pointer rests on it or as soon as keyboard focus reaches it, and hidden on Escape, blur, or when the pointer leaves. A touch screen never shows it. With no `content` it reads the trigger's own `label` and `shortcut`, so `<Tooltip><Button label=\"Search\" shortcut=\"Meta+K\" …>` names the button, announces its shortcut (`aria-keyshortcuts`) and shows both, written once. Wrap a toolbar in `TooltipProvider` so moving along it opens each next tooltip at once.",
      },
    },
  },
  args: { children: <span /> },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

async function closed(canvasElement: HTMLElement) {
  await waitFor(() => expect(body(canvasElement).queryByRole("tooltip")).toBeNull())
}

export const FromTheButton: Story = {
  parameters: storyDocumentation(
    "The button's `label` and `shortcut` are the tooltip's text and key cap, and its accessible name and `aria-keyshortcuts`. The play test tabs to the button, proves the tooltip opens on keyboard focus with the label and the key, describes the button, and closes on Escape.",
  ),
  render: () => (
    <Tooltip>
      <Button size="icon-sm" variant="plain" shape="pill" label="Search" shortcut="Meta+K">
        <Search />
      </Button>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole("button", { name: "Search" })
    await expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+K")
    await userEvent.tab()
    await expect(button).toHaveFocus()
    const tooltip = await body(canvasElement).findByRole("tooltip")
    await expect(tooltip).toHaveTextContent("Search")
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>("[data-slot=tooltip]")!
    const cap = content.querySelector("kbd")!
    const platform = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "apple" : "other"
    await expect(cap).toHaveTextContent(formatShortcut("Meta+K", platform))
    await expect(button).toHaveAccessibleDescription(/Search/)
    await userEvent.keyboard("{Escape}")
    await closed(canvasElement)
    await expect(button).toHaveFocus()
  },
}

export const PointerAndTouch: Story = {
  parameters: storyDocumentation(
    "A resting mouse pointer opens the tooltip after the delay; a touch never does, because a tap is a press. The play test hovers with a mouse and waits for the tooltip, then taps a second button and proves no tooltip appears after the same delay.",
  ),
  render: () => (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-2">
        <Tooltip>
          <Button size="icon-sm" variant="plain" shape="pill" label="Notifications">
            <Bell />
          </Button>
        </Tooltip>
        <Tooltip>
          <Button size="icon-sm" variant="plain" shape="pill" label="Settings">
            <Settings />
          </Button>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bell = canvas.getByRole("button", { name: "Notifications" })
    await userEvent.hover(bell)
    await expect(await body(canvasElement).findByRole("tooltip")).toHaveTextContent("Notifications")
    await userEvent.unhover(bell)
    await closed(canvasElement)

    const settings = canvas.getByRole("button", { name: "Settings" })
    await userEvent.pointer([{ keys: "[TouchA]", target: settings }])
    await new Promise((resolve) => setTimeout(resolve, 700))
    await expect(body(canvasElement).queryByRole("tooltip")).toBeNull()
    settings.blur()
  },
}

export const GroupedDelay: Story = {
  parameters: storyDocumentation(
    "Inside a `TooltipProvider`, the first tooltip waits its delay and the next one opened soon after opens at once. The play test uses a long delay, waits it out once, then moves to the neighbour and proves its tooltip opens well before that delay.",
  ),
  render: () => (
    <TooltipProvider delayDuration={1200} skipDelayDuration={1500}>
      <div className="flex gap-2">
        <Tooltip content="Back">
          <Button size="icon-sm" variant="plain" shape="pill" aria-label="Back">
            ‹
          </Button>
        </Tooltip>
        <Tooltip content="Forward">
          <Button size="icon-sm" variant="plain" shape="pill" aria-label="Forward">
            ›
          </Button>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const back = canvas.getByRole("button", { name: "Back" })
    const forward = canvas.getByRole("button", { name: "Forward" })
    await userEvent.hover(back)
    await body(canvasElement).findByRole("tooltip", {}, { timeout: 3000 })
    await userEvent.unhover(back)
    const started = performance.now()
    await userEvent.hover(forward)
    await waitFor(() => expect(body(canvasElement).getByRole("tooltip")).toHaveTextContent("Forward"), {
      timeout: 1000,
    })
    await expect(performance.now() - started).toBeLessThan(1000)
    await userEvent.unhover(forward)
    await closed(canvasElement)
  },
}

export const Motion: Story = {
  parameters: storyDocumentation(
    "The tooltip fades and scales in on the motion tokens, which are zero under reduced motion. The play test opens it and proves its entrance takes no time when the person asks for reduced motion, and some time otherwise.",
  ),
  render: () => (
    <Tooltip content="Archive" defaultOpen>
      <Button size="sm" variant="tinted" shape="pill">
        Archive
      </Button>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    await body(canvasElement).findByRole("tooltip")
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>("[data-slot=tooltip]")!
    const duration = parseFloat(getComputedStyle(content).animationDuration)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await expect(duration).toBe(0)
    } else {
      await expect(duration).toBeGreaterThan(0)
    }
    await Promise.all(content.getAnimations().map((animation) => animation.finished))
  },
}

export const NothingToSay: Story = {
  parameters: storyDocumentation(
    "With no `content` and a trigger that has no `label` or `aria-label`, Tooltip renders the trigger alone; and a Button given no `label` or `shortcut` renders exactly as before. The play test proves no tooltip wiring and no added attributes.",
  ),
  render: () => (
    <Tooltip>
      <Button size="sm">Save</Button>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Save" })
    await expect(button).not.toHaveAttribute("aria-label")
    await expect(button).not.toHaveAttribute("aria-keyshortcuts")
    await expect(button).not.toHaveAttribute("data-state")
    await userEvent.tab()
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(body(canvasElement).queryByRole("tooltip")).toBeNull()
  },
}

export const ShortcutText: Story = {
  parameters: storyDocumentation(
    "`formatShortcut` writes an `aria-keyshortcuts` value as a key cap shows it: Apple glyphs run together, or words joined by `+` elsewhere. The play test checks both forms.",
  ),
  render: () => (
    <dl className="grid grid-cols-2 gap-x-4 font-sans nessa-text-3">
      <dt>Meta+Shift+P</dt>
      <dd data-testid="apple">{formatShortcut("Meta+Shift+P", "apple")}</dd>
      <dt>Control+Shift+P</dt>
      <dd data-testid="other">{formatShortcut("Control+Shift+P", "other")}</dd>
    </dl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId("apple")).toHaveTextContent("⌘⇧P")
    await expect(canvas.getByTestId("other")).toHaveTextContent("Ctrl+Shift+P")
    await expect(formatShortcut("Escape")).toBe("Esc")
    await expect(formatShortcut("Meta+k Control+k")).toBe("⌘K")
  },
}
