import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Bell, Search, Settings } from "lucide-react"
import {
  Button,
  NessaColorMode,
  NessaProvider,
  PortalContainerProvider,
  Tooltip,
  TooltipProvider,
  formatShortcut,
} from "@nessalabs/ui"

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

/** Counts every tooltip that mounts, however briefly, while `act` runs and for `settle` ms after. */
async function tooltipMounts(act: () => Promise<void>, settle = 700): Promise<number> {
  let mounts = 0
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof Element && (node.matches("[data-slot=tooltip]") || node.querySelector("[data-slot=tooltip]"))) {
          mounts += 1
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  try {
    await act()
    await new Promise((resolve) => setTimeout(resolve, settle))
  } finally {
    observer.disconnect()
  }
  return mounts
}

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
    await body(canvasElement).findByRole("tooltip")
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>("[data-slot=tooltip]")!
    await expect(content.querySelector("[data-slot=tooltip-text]")).toHaveTextContent("Search")
    const cap = content.querySelector("kbd")!
    const platform = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "apple" : "other"
    await expect(cap).toHaveTextContent(formatShortcut("Meta+K", platform))
    // The name already says "Search", and the key is announced through
    // aria-keyshortcuts; the tooltip does not say either a second time.
    await expect(button).not.toHaveAccessibleDescription(/Search/)
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
    await body(canvasElement).findByRole("tooltip")
    await expect(canvasElement.ownerDocument.querySelector("[data-slot=tooltip-text]")).toHaveTextContent("Notifications")
    await userEvent.unhover(bell)
    await closed(canvasElement)

    // A tap never mounts a tooltip, not even for a frame: the observer sees
    // every one that appears.
    const settings = canvas.getByRole("button", { name: "Settings" })
    const mounts = await tooltipMounts(async () => {
      await userEvent.pointer([{ keys: "[TouchA]", target: settings }])
    })
    await expect(mounts).toBe(0)
    await expect(settings).not.toHaveAttribute("aria-describedby")
    settings.blur()
  },
}

function ReturnedFocusExample() {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => triggerRef.current?.focus()}>
        Close menu
      </Button>
      <Tooltip>
        <Button ref={triggerRef} size="icon-sm" variant="plain" shape="pill" label="More">
          …
        </Button>
      </Tooltip>
    </div>
  )
}

export const FocusReturnedByAPointer: Story = {
  parameters: storyDocumentation(
    "Focus a closing menu hands back to its trigger after a click is not keyboard focus, so it shows no tooltip; tabbing to the same button does. The play test clicks a control that moves focus to the trigger, proves no tooltip mounts, then tabs away and back and proves one opens.",
  ),
  render: () => <ReturnedFocusExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const more = canvas.getByRole("button", { name: "More" })
    const mounts = await tooltipMounts(async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Close menu" }))
    }, 400)
    await expect(more).toHaveFocus()
    await expect(mounts).toBe(0)
    await userEvent.tab({ shift: true })
    await userEvent.tab()
    await expect(more).toHaveFocus()
    await expect(await body(canvasElement).findByRole("tooltip")).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    await closed(canvasElement)
  },
}

export const OwnContent: Story = {
  parameters: storyDocumentation(
    "A tooltip with its own `content` and `shortcut` describes the button with that text and announces the key on it. The play test proves the button keeps its name, gains the description and `aria-keyshortcuts`.",
  ),
  render: () => (
    <Tooltip content="Moves it out of the inbox" shortcut="Meta+E">
      <Button size="sm" variant="tinted" shape="pill">
        Archive
      </Button>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Archive" })
    await expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+E")
    await userEvent.tab()
    await body(canvasElement).findByRole("tooltip")
    await expect(button).toHaveAccessibleDescription(/Moves it out of the inbox/)
    await userEvent.keyboard("{Escape}")
    await closed(canvasElement)
  },
}

function ThemedExample() {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)
  return (
    <NessaProvider defaultMode={NessaColorMode.Dark} className="flex items-center gap-3 bg-background p-3 text-foreground">
      <div ref={setContainer} data-testid="container" />
      <PortalContainerProvider container={container}>
        <Tooltip content="Inside the panel">
          <Button size="sm" variant="tinted" shape="pill">
            Panel action
          </Button>
        </Tooltip>
      </PortalContainerProvider>
    </NessaProvider>
  )
}

export const ThemedAndContained: Story = {
  parameters: storyDocumentation(
    "A tooltip carries the theme of the scope it was opened in and mounts in the nearest Nessa portal container, as every Nessa layer does. The play test opens it inside a Dark provider and a container and proves it lands in the container, wears the Dark mode, and reads the scope's colours.",
  ),
  render: () => <ThemedExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "Panel action" })).toHaveFocus()
    await body(canvasElement).findByRole("tooltip")
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>("[data-slot=tooltip]")!
    const scope = canvasElement.querySelector<HTMLElement>("[data-nessa-root]")!
    await expect(canvas.getByTestId("container").contains(content)).toBe(true)
    await expect(content.getAttribute("data-nessa-mode")).toBe(NessaColorMode.Dark)
    await expect(getComputedStyle(content).getPropertyValue("--foreground").trim()).toBe(
      getComputedStyle(scope).getPropertyValue("--foreground").trim(),
    )
    await userEvent.keyboard("{Escape}")
    await closed(canvasElement)
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
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector("[data-slot=tooltip-text]")).toHaveTextContent("Forward"), {
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
    "With no `content` and a trigger that has no `label` or `aria-label`, the tooltip never opens; and a Button given no `label` or `shortcut` gains no name or shortcut. The play test proves no tooltip appears on keyboard focus and no description is wired.",
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
    const mounts = await tooltipMounts(async () => {
      await userEvent.tab()
    }, 300)
    await expect(button).toHaveFocus()
    await expect(mounts).toBe(0)
    await expect(button).not.toHaveAttribute("aria-describedby")
  },
}

export const ShortcutText: Story = {
  parameters: storyDocumentation(
    "`formatShortcut` writes an `aria-keyshortcuts` value as a key cap shows it: Apple glyphs run together in Apple's modifier order, or words joined by `+` elsewhere. The play test checks both forms.",
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
    await expect(canvas.getByTestId("apple")).toHaveTextContent("⇧⌘P")
    await expect(canvas.getByTestId("other")).toHaveTextContent("Ctrl+Shift+P")
    await expect(formatShortcut("Escape")).toBe("Esc")
    await expect(formatShortcut("Meta+k Control+k")).toBe("⌘K")
  },
}
