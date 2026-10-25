import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChatTabs,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  type ChatTabItem,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

/** A floating-window host: the tab strip over a stub panel per tab. */
function TabsExample({
  variant,
  initialTabs = [
    { id: "release", title: "Release notes", loading: true },
    { id: "triage", title: "Bug triage", closeable: true, badgeCount: 2 },
    { id: "scratch", title: "Scratchpad", closeable: true },
  ],
}: {
  variant?: "pills" | "dots"
  initialTabs?: ChatTabItem[]
}) {
  const [tabs, setTabs] = React.useState<ChatTabItem[]>(initialTabs)
  const [activeId, setActiveId] = React.useState("release")
  const nextTab = React.useRef(1)
  const active = tabs.find((tab) => tab.id === activeId)
  return (
    <div className="flex h-64 min-w-0 w-[min(30rem,calc(100vw-2rem))] flex-col gap-3 rounded-[2rem] bg-background p-3">
      <ChatTabs
        variant={variant}
        tabs={tabs}
        value={activeId}
        onValueChange={setActiveId}
        wrapTab={(tab, node) =>
          tab.id === "release" ? (
            <ContextMenu>
              <ContextMenuTrigger asChild>{node}</ContextMenuTrigger>
              <ContextMenuContent aria-label="Conversation actions">
                <ContextMenuItem>View Details</ContextMenuItem>
                <ContextMenuItem>Rename</ContextMenuItem>
                <ContextMenuItem>Pin</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem>Archive</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ) : (
            node
          )
        }
        onClose={(id) => {
          setTabs((current) => {
            const next = current.filter((tab) => tab.id !== id)
            if (id === activeId && next.length > 0) setActiveId(next[0]!.id)
            return next
          })
        }}
        onNew={() => {
          const id = `chat-${nextTab.current++}`
          setTabs((current) => [
            ...current,
            { id, title: "New chat", closeable: true },
          ])
          setActiveId(id)
        }}
        className="px-1"
      />
      <div
        id={`chat-tab-panel-${activeId}`}
        role="tabpanel"
        aria-labelledby={`chat-tab-${activeId}`}
        className="flex min-h-0 flex-1 items-center justify-center rounded-3xl bg-card font-sans nessa-text-4 text-muted-foreground"
      >
        {active?.title ?? "No tab"}
      </div>
    </div>
  )
}

const meta = {
  title: "Conversation/ChatTabs",
  component: ChatTabs,
  args: { tabs: [], value: null, onValueChange: () => undefined },
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The floating chat window's tab strip: pill tabs on a horizontally scrolling tablist — the active tab washed and outlined in the chat ink — or, with `variant=\"dots\"`, the selected tab named at the start and every tab a page dot after it; with a glowing dot for tabs whose agent is working, an attention badge for tabs that need the user, close controls on closeable tabs, and a trailing new-tab button. The selected tab is scrolled into the track. Arrow keys, Home, and End rove the tablist, and every focus outline draws inset so the scrolling track never clips it. Pair each tab with a `chat-tab-panel-<id>` panel; PillComposer's Playground shows it as the chat window's conversation switcher.",
      },
    },
  },
} satisfies Meta<typeof ChatTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Tabs: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Three tabs over a stub panel: the first is busy (glowing dot), the second carries an attention badge, and the closeable ones can be removed with their ✕ or by pressing Delete on the focused tab. Selecting, closing, adding, and arrow-key roving all update the strip and the panel.",
  ),
  render: () => <TabsExample />,
  play: async ({ canvasElement }) => {
    // The dev canvas re-runs plays on every load and its un-awaited act
    // scope swallows manual input mid-run; keep plays to the automated
    // runner (vitest drives a webdriver browser) so the canvas stays live.
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const release = canvas.getByRole("tab", { name: "Release notes" })
    await expect(release).toHaveAttribute("aria-selected", "true")
    await expect(release).toHaveAttribute("aria-busy", "true")
    await expect(
      canvasElement.querySelector('[data-slot="chat-tab-loading"]'),
    ).toBeInTheDocument()
    const badge = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-tab-badge"]',
    )!
    await expect(badge).toHaveTextContent("2")
    await userEvent.click(canvas.getByRole("tab", { name: "Bug triage, 2 new" }))
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Bug triage")
    await userEvent.keyboard("{ArrowRight}")
    await expect(
      canvas.getByRole("tab", { name: "Scratchpad" }),
    ).toHaveAttribute("aria-selected", "true")
    await userEvent.keyboard("{ArrowRight}")
    await expect(release).toHaveAttribute("aria-selected", "true")
    // Delete on the focused tab is the accessible close; the ✕ is
    // pointer-only.
    await userEvent.keyboard("{ArrowLeft}")
    await expect(
      canvas.getByRole("tab", { name: "Scratchpad" }),
    ).toHaveAttribute("aria-selected", "true")
    await userEvent.keyboard("{Delete}")
    await expect(
      canvas.queryByRole("tab", { name: "Scratchpad" }),
    ).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "New tab" }))
    const newChat = canvas.getByRole("tab", { name: "New chat" })
    await expect(newChat).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("New chat")
    const track = canvasElement.querySelector<HTMLElement>(
      "[data-slot=chat-tabs-track]",
    )!
    const pill = newChat.closest<HTMLElement>("[data-slot=chat-tab]")!
    const trackRect = track.getBoundingClientRect()
    const pillRect = pill.getBoundingClientRect()
    await expect(pillRect.left).toBeGreaterThanOrEqual(trackRect.left - 1)
    await expect(pillRect.right).toBeLessThanOrEqual(trackRect.right + 1)
    await expect(
      canvasElement.ownerDocument.scrollingElement?.scrollTop ?? 0,
    ).toBe(0)
  },
}

const avatar = (hue: number) => (
  <span
    className="block size-5 rounded-full"
    style={{
      background: `radial-gradient(circle at 40% 35%, oklch(0.8 0.08 ${hue}), oklch(0.5 0.12 ${hue}) 55%, oklch(0.32 0.08 ${hue}))`,
    }}
  />
)

export const PageDots: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The narrow-window variant: only the selected tab is named — its glyph, title, and close lead the strip — and every tab is a page dot after it. The selected dot is a short bar, the busy one glows, and the one that needs the user is drawn in the destructive colour and says so in its name. A dot is still the tab: it carries the title as its name and tooltip, and takes the same arrow keys and Delete. A tab opened out of another shows a back button in place of its glyph.",
  ),
  render: () => (
    <TabsExample
      variant="dots"
      initialTabs={[
        { id: "release", title: "Release notes", loading: true, icon: avatar(300) },
        { id: "triage", title: "Bug triage", closeable: true, badgeCount: 2, icon: avatar(30) },
        { id: "scratch", title: "Scratchpad", closeable: true, icon: avatar(150) },
        { id: "helper", title: "Release checker", kind: "subagent", parentId: "release", closeable: true, icon: avatar(220) },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const strip = canvasElement.querySelector<HTMLElement>("[data-slot=chat-tabs]")!
    await expect(strip).toHaveAttribute("data-variant", "dots")
    const current = () =>
      canvasElement.querySelector<HTMLElement>("[data-slot=chat-tabs-current]")!
    await expect(current()).toHaveTextContent("Release notes")
    const dots = () =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-slot=chat-tab-dot]"))
    await expect(dots()).toHaveLength(4)
    const release = canvas.getByRole("tab", { name: "Release notes" })
    await expect(release).toHaveAttribute("aria-selected", "true")
    await expect(release).toHaveAttribute("title", "Release notes")
    const [releaseDot, triageDot, scratchDot] = dots()
    await expect(releaseDot).toHaveAttribute("data-busy", "true")
    await expect(triageDot).toHaveAttribute("data-attention", "true")
    // The selected dot is the bar, wider than the dots beside it.
    await expect(releaseDot!.getBoundingClientRect().width).toBeGreaterThan(
      scratchDot!.getBoundingClientRect().width + 6,
    )
    await userEvent.click(canvas.getByRole("tab", { name: "Bug triage, 2 new" }))
    await expect(current()).toHaveTextContent("Bug triage")
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Bug triage")
    await userEvent.keyboard("{ArrowRight}")
    await expect(current()).toHaveTextContent("Scratchpad")
    // Delete on the focused dot closes it, as on a pill.
    await userEvent.keyboard("{Delete}")
    await expect(
      canvas.queryByRole("tab", { name: "Scratchpad" }),
    ).not.toBeInTheDocument()
    // A tab opened out of another leads with its way back.
    await userEvent.click(canvas.getByRole("tab", { name: "Release checker" }))
    await expect(current()).toHaveTextContent("Release checker")
    // Its own dot stays its own: the way back is the lead's, not the dot's.
    await userEvent.click(canvas.getByRole("tab", { name: "Release checker" }))
    await expect(current()).toHaveTextContent("Release checker")
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to Release notes" }),
    )
    await expect(current()).toHaveTextContent("Release notes")
    // The lead's close is the pointer close for the selected tab.
    await userEvent.click(canvas.getByRole("tab", { name: "Bug triage, 2 new" }))
    await userEvent.click(
      current().querySelector<HTMLElement>("[data-slot=chat-tab-close]")!,
    )
    await expect(
      canvas.queryByRole("tab", { name: "Bug triage, 2 new" }),
    ).not.toBeInTheDocument()
    // The new selection's dot widens into the bar; wait for its full width
    // so no transition runs past the test.
    await waitFor(() => {
      const [bar, ...rest] = dots().sort(
        (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
      )
      expect(bar!.closest("[data-active]")).not.toBeNull()
      expect(bar!.getBoundingClientRect().width).toBe(18)
      for (const dot of rest) expect(dot.getBoundingClientRect().width).toBe(6)
    })
    await expect(
      canvasElement.ownerDocument.scrollingElement?.scrollTop ?? 0,
    ).toBe(0)
  },
}
