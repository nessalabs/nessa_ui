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
  variant?: "pills" | "dots" | "plain"
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
          "The floating chat window's tab strip: pill tabs on a horizontally scrolling tablist — the active tab washed and outlined in the chat ink — or, with `variant=\"dots\"`, the selected tab named at the start and every tab a page dot after it; or, with `variant=\"plain\"`, glyph and title on the strip's own ground with the selected tab an opaque rounded tab; with a glowing dot for tabs whose agent is working, an attention badge for tabs that need the user, close controls on closeable tabs, and a trailing new-tab button. The selected tab is scrolled into the track. Arrow keys, Home, and End rove the tablist, and every focus outline draws inset so the scrolling track never clips it. Pair each tab with a `chat-tab-panel-<id>` panel; PillComposer's Playground shows it as the chat window's conversation switcher.",
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

export const Plain: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The window top-row variant: every tab is its glyph and title on the strip's own ground, all one width, shrinking together as room runs out. The selected tab is an opaque rounded tab, so art behind the strip never shows through it; the others are text with a hover wash. A tab's close shows while it is selected, hovered, or focused.",
  ),
  render: () => (
    <TabsExample
      variant="plain"
      initialTabs={[
        { id: "release", title: "Release notes", kind: "file", closeable: true, icon: avatar(300) },
        { id: "triage", title: "Bug triage", kind: "file", closeable: true, icon: avatar(30) },
        { id: "scratch", title: "Scratchpad", kind: "file", closeable: true, icon: avatar(150) },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const strip = canvasElement.querySelector<HTMLElement>("[data-slot=chat-tabs]")!
    await expect(strip).toHaveAttribute("data-variant", "plain")
    const tabOf = (name: string) =>
      canvas.getByRole("tab", { name }).closest<HTMLElement>("[data-slot=chat-tab]")!
    const closeOf = (name: string) =>
      tabOf(name).querySelector<HTMLElement>("[data-slot=chat-tab-close]")!
    // Every tab one width.
    const widths = ["Release notes", "Bug triage", "Scratchpad"].map(
      (name) => tabOf(name).getBoundingClientRect().width,
    )
    await expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1)
    // Squeezed, a tab keeps room for its glyph and close: neither overlaps.
    strip.style.width = "120px"
    try {
      const tab = tabOf("Scratchpad")
      const glyph = tab.querySelector<HTMLElement>("[role=tab] > span")!.getBoundingClientRect()
      const close = closeOf("Scratchpad").getBoundingClientRect()
      await expect(glyph.right).toBeLessThanOrEqual(close.left)
      await expect(close.right).toBeLessThanOrEqual(tab.getBoundingClientRect().right)
    } finally {
      strip.style.width = ""
    }
    // The selected tab is filled and shows its close; the others are bare
    // and keep their close hidden until hovered.
    const fill = (name: string) => getComputedStyle(tabOf(name)).backgroundColor
    await expect(fill("Release notes")).not.toBe("rgba(0, 0, 0, 0)")
    await expect(fill("Scratchpad")).toBe("rgba(0, 0, 0, 0)")
    await expect(getComputedStyle(closeOf("Release notes")).opacity).toBe("1")
    // Without hover (touch) every close shows; otherwise it waits for the
    // tab to be hovered or focused. A synthetic hover sets no :hover, so
    // focus stands in for both.
    const touch = canvasElement.ownerDocument.defaultView!.matchMedia(
      "(hover: none)",
    ).matches
    await expect(getComputedStyle(closeOf("Scratchpad")).opacity).toBe(
      touch ? "1" : "0",
    )
    canvas.getByRole("tab", { name: "Scratchpad" }).focus()
    await waitFor(() =>
      expect(getComputedStyle(closeOf("Scratchpad")).opacity).toBe("1"),
    )
    await userEvent.click(canvas.getByRole("tab", { name: "Bug triage" }))
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Bug triage")
    await userEvent.click(closeOf("Scratchpad"))
    await expect(
      canvas.queryByRole("tab", { name: "Scratchpad" }),
    ).not.toBeInTheDocument()
    await expect(
      canvasElement.ownerDocument.scrollingElement?.scrollTop ?? 0,
    ).toBe(0)
  },
}

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
    // The Back button went with the lead; focus lands on the parent's dot.
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: "Release notes" })).toHaveFocus(),
    )
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

export const ManyPageDots: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Dots with more tabs than fit: four show at a time, a window that slides with the selection. An edge dot with more tabs beyond it is drawn smaller, and in the destructive colour when a hidden tab needs the user. The hidden dots are still tabs, so the arrow keys, Home, and End reach every one.",
  ),
  render: () => (
    <TabsExample
      variant="dots"
      initialTabs={[
        { id: "release", title: "Release notes", icon: avatar(300) },
        { id: "triage", title: "Bug triage", closeable: true, icon: avatar(30) },
        { id: "scratch", title: "Scratchpad", closeable: true, icon: avatar(150) },
        { id: "lisbon", title: "Lisbon trip", closeable: true, icon: avatar(90) },
        { id: "budget", title: "Budget", closeable: true, icon: avatar(200) },
        { id: "deploy", title: "Deploy check", closeable: true, icon: avatar(250) },
        { id: "review", title: "Code review", closeable: true, badgeCount: 1, icon: avatar(330) },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const current = () =>
      canvasElement.querySelector<HTMLElement>("[data-slot=chat-tabs-current]")!
    const slots = () =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-slot=chat-tab]"))
    const shown = () =>
      slots()
        .filter((slot) => slot.dataset.dot !== "hidden")
        .map((slot) => slot.querySelector("[role=tab]")!.getAttribute("title"))
    const firstFour = ["Release notes", "Bug triage", "Scratchpad", "Lisbon trip"]
    // Every tab is in the tablist; four are on show.
    await expect(canvas.getAllByRole("tab")).toHaveLength(7)
    await expect(shown()).toEqual(firstFour)
    for (const slot of slots().filter((each) => each.dataset.dot === "hidden"))
      await expect(slot.getBoundingClientRect().width).toBe(0)
    // The last dot on show has tabs beyond it, one of which needs the user.
    const edge = slots().find((slot) => slot.dataset.dot === "edge")!
    await expect(edge.querySelector("[role=tab]")).toHaveAttribute("title", "Lisbon trip")
    await expect(edge.querySelector("[data-slot=chat-tab-dot]")).toHaveAttribute(
      "data-attention",
      "true",
    )
    // Stepping right slides the window with the selection.
    await userEvent.click(canvas.getByRole("tab", { name: "Scratchpad" }))
    await userEvent.keyboard("{ArrowRight}")
    await expect(current()).toHaveTextContent("Lisbon trip")
    await expect(shown()).toEqual(["Scratchpad", "Lisbon trip", "Budget", "Deploy check"])
    // End reaches a tab that was hidden, and it shows with focus on it.
    await userEvent.keyboard("{End}")
    await expect(current()).toHaveTextContent("Code review")
    await expect(canvas.getByRole("tab", { name: "Code review, 1 new" })).toHaveFocus()
    await expect(shown()).toEqual(["Lisbon trip", "Budget", "Deploy check", "Code review"])
    // Home goes back to the first window.
    await userEvent.keyboard("{Home}")
    await expect(current()).toHaveTextContent("Release notes")
    await expect(shown()).toEqual(firstFour)
    // Wait for the widths to settle so no transition runs past the test.
    await waitFor(() => {
      const widths = Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          "[data-dot=shown] [data-slot=chat-tab-dot], [data-dot=edge] [data-slot=chat-tab-dot]",
        ),
      ).map((dot) => dot.getBoundingClientRect().width)
      expect(widths).toEqual([18, 6, 6, 4])
    })
    // Dots sit a dot's width apart, as page dots do, not a whole tap
    // target apart.
    const [, second, third] = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        "[data-dot=shown] [data-slot=chat-tab-dot], [data-dot=edge] [data-slot=chat-tab-dot]",
      ),
    ).map((dot) => dot.getBoundingClientRect())
    await expect(third!.left - second!.right).toBe(6)
    // After the window has slid both ways, no dot on show is cut by the
    // track's edges.
    const track = canvasElement
      .querySelector<HTMLElement>("[data-slot=chat-tabs-track]")!
      .getBoundingClientRect()
    for (const slot of slots().filter((each) => each.dataset.dot !== "hidden")) {
      const rect = slot.getBoundingClientRect()
      await expect(rect.left).toBeGreaterThanOrEqual(track.left)
      await expect(rect.right).toBeLessThanOrEqual(track.right)
    }
  },
}
