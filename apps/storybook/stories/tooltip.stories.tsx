import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Bell, Search, Settings } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

/**
 * Waits for the tooltip to be gone and for the provider's skip-delay timer,
 * which starts when a tooltip closes, to run out — so a play leaves nothing
 * ticking for the next story.
 */
async function closed(canvasElement: HTMLElement, skipDelay = 300) {
  await waitFor(() => expect(body(canvasElement).queryByRole("tooltip")).toBeNull())
  await new Promise((resolve) => setTimeout(resolve, skipDelay + 50))
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
    // What a phone does on a tap: the finger enters the button (a touch
    // pointer, which keeps :hover stuck on it), presses and lifts, and only
    // then does the button take focus. Still no tooltip.
    const afterTap = await tooltipMounts(async () => {
      const touch = { bubbles: true, pointerType: "touch", isPrimary: true } as const
      settings.dispatchEvent(new PointerEvent("pointerover", touch))
      settings.dispatchEvent(new PointerEvent("pointerdown", touch))
      settings.dispatchEvent(new PointerEvent("pointerup", touch))
      settings.focus()
    })
    await expect(afterTap).toBe(0)
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
    "A tooltip with its own `content` and `shortcut` describes the button with that text, alongside any description the button already has, and announces the key on it. The play test proves the button keeps its name and its own description, gains the tooltip's, and gains `aria-keyshortcuts`.",
  ),
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Tooltip content="Moves it out of the inbox" shortcut="Meta+E">
        <Button size="sm" variant="tinted" shape="pill" aria-describedby="archive-hint">
          Archive
        </Button>
      </Tooltip>
      <p id="archive-hint" className="m-0 font-sans nessa-text-2 text-muted-foreground">
        Archived mail stays searchable.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Archive" })
    await expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+E")
    await userEvent.tab()
    await body(canvasElement).findByRole("tooltip")
    await expect(button).toHaveAccessibleDescription(/Moves it out of the inbox/)
    await expect(button).toHaveAccessibleDescription(/Archived mail stays searchable/)
    await userEvent.keyboard("{Escape}")
    await closed(canvasElement)
  },
}

function ThemedExample() {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)
  return (
    <div className="flex flex-col gap-3">
      {/* The container sits outside the Dark scope, so the tooltip can only
          be Dark by carrying the scope itself. */}
      <div ref={setContainer} data-testid="container" />
      <NessaProvider defaultMode={NessaColorMode.Dark} className="flex items-center gap-3 bg-background p-3 text-foreground">
        <PortalContainerProvider container={container}>
          <Tooltip content="Inside the panel">
            <Button size="sm" variant="tinted" shape="pill">
              Panel action
            </Button>
          </Tooltip>
        </PortalContainerProvider>
      </NessaProvider>
    </div>
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
    // And it differs from what the container itself inherits (Light).
    await expect(getComputedStyle(canvas.getByTestId("container")).getPropertyValue("--foreground").trim()).not.toBe(
      getComputedStyle(scope).getPropertyValue("--foreground").trim(),
    )
    await userEvent.keyboard("{Escape}")
    await closed(canvasElement)
  },
}

export const InsideAMenuTrigger: Story = {
  parameters: storyDocumentation(
    "Inside another `asChild` trigger, the Tooltip goes inside it: the menu's props reach the button after the tooltip's own, so the button keeps the menu's `data-state` and `aria-expanded`. The play test opens the menu and proves the button reads open, then closes it.",
  ),
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Tooltip>
          <Button size="icon-sm" variant="plain" shape="pill" label="More">
            …
          </Button>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Rename</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "More" })
    await userEvent.click(button)
    await body(canvasElement).findByRole("menu")
    await expect(button).toHaveAttribute("data-state", "open")
    await expect(button).toHaveAttribute("aria-expanded", "true")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(body(canvasElement).queryByRole("menu")).toBeNull())
    await expect(button).toHaveAttribute("data-state", "closed")
    await userEvent.unhover(button)
    await closed(canvasElement)
  },
}

function PanelExample() {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Open panel
      </Button>
      {open ? (
        <div className="flex gap-2 rounded-md border border-border p-2">
          <Tooltip>
            <Button autoFocus size="icon-sm" variant="plain" shape="pill" label="Close panel" onClick={() => setOpen(false)}>
              ×
            </Button>
          </Tooltip>
        </div>
      ) : null}
    </div>
  )
}

export const PanelOpenedByAClick: Story = {
  parameters: storyDocumentation(
    "A panel opened by a click that focuses a control inside it shows no tooltip on that control: the focus followed a pointer press. The play test clicks to open the panel, proves the close button has focus and no tooltip mounts.",
  ),
  render: () => <PanelExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mounts = await tooltipMounts(async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Open panel" }))
    }, 400)
    await expect(canvas.getByRole("button", { name: "Close panel" })).toHaveFocus()
    await expect(mounts).toBe(0)
  },
}

export const ShortcutWins: Story = {
  parameters: storyDocumentation(
    "The key the cap shows is the key announced: an explicit `aria-keyshortcuts` on the button wins over its `shortcut`, in the tooltip as on the button. The play test proves both read Control+K.",
  ),
  render: () => (
    <Tooltip>
      <Button size="icon-sm" variant="plain" shape="pill" label="Find" shortcut="Meta+K" aria-keyshortcuts="Control+K">
        <Search />
      </Button>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Find" })
    await expect(button).toHaveAttribute("aria-keyshortcuts", "Control+K")
    await userEvent.tab()
    await body(canvasElement).findByRole("tooltip")
    const platform = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "apple" : "other"
    await expect(canvasElement.ownerDocument.querySelector("[data-slot=tooltip] kbd")).toHaveTextContent(
      formatShortcut("Control+K", platform),
    )
    await userEvent.keyboard("{Escape}")
    await closed(canvasElement)
  },
}

export const NameWins: Story = {
  parameters: storyDocumentation(
    "When a button has both a `label` and an explicit `aria-label`, the `aria-label` is its name, and the tooltip shows that same name, so what is seen is what is heard. The play test proves it.",
  ),
  render: () => (
    <Tooltip>
      <Button size="icon-sm" variant="plain" shape="pill" label="Search files" aria-label="Search">
        <Search />
      </Button>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await body(canvasElement).findByRole("tooltip")
    await expect(canvasElement.ownerDocument.querySelector("[data-slot=tooltip-text]")).toHaveTextContent(/^Search$/)
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
    await closed(canvasElement, 1500)
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
