import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  ChatTabs,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  type ChatTabItem,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

/** A floating-window host: the tab strip over a stub panel per tab. */
function TabsExample() {
  const [tabs, setTabs] = React.useState<ChatTabItem[]>([
    { id: "release", title: "Release notes", loading: true },
    { id: "triage", title: "Bug triage", closeable: true, badgeCount: 2 },
    { id: "scratch", title: "Scratchpad", closeable: true },
  ])
  const [activeId, setActiveId] = React.useState("release")
  const nextTab = React.useRef(1)
  const active = tabs.find((tab) => tab.id === activeId)
  return (
    <div className="flex h-64 min-w-0 w-[min(30rem,calc(100vw-2rem))] flex-col gap-3 rounded-[2rem] bg-background p-3">
      <ChatTabs
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
  title: "Components/ChatTabs",
  component: ChatTabs,
  args: { tabs: [], value: null, onValueChange: () => undefined },
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The floating chat window's tab strip: pill tabs on a horizontally scrolling tablist — the active tab washed and outlined in the chat accent — with a glowing dot for tabs whose agent is working, an attention badge for tabs that need the user, close controls on closeable tabs, and a trailing new-tab button. Arrow keys, Home, and End rove the tablist, and every focus outline draws inset so the scrolling track never clips it. Pair each tab with a `chat-tab-panel-<id>` panel; PillComposer's Playground shows it as the chat window's conversation switcher.",
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
    await userEvent.click(canvas.getByRole("tab", { name: "Bug triage" }))
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
    await expect(canvas.getByRole("tab", { name: "New chat" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("New chat")
  },
}
