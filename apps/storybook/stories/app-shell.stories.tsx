import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  AppShell,
  AppShellBody,
  AppShellDock,
  AppShellDockSide,
  AppShellHeader,
  AppShellMain,
  AppShellPaneDragHandle,
  AppShellStatusBar,
  AppShellWorkspace,
  Button,
  Input,
  PaneSplitDirection,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  collectPanes,
  createAppShellLayout,
  splitPane,
  useAppShell,
  type AppShellLayout,
  type PaneNode,
} from "@nessa-ui/react"
import {
  Bot,
  Bug,
  Columns2,
  GripVertical,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Rows2,
  SendHorizontal,
  Sparkles,
  Telescope,
  X,
} from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Composites/AppShell",
  component: AppShell,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "AppShell composes an agent-workspace frame: a header, pixel-sized resizable docks, a status bar, and a center workspace whose panes split recursively in any direction and can be rearranged by dragging one pane onto another to swap them. The whole arrangement is one serializable layout document; the shell renders it and reports changes, while the consuming application owns state and persistence. This catalog demonstrates it as a multi-agent chat app: conversations live in the sidebar dock, every chat opens in a pane, and panes split, maximize (Shift+Escape), swap by dragging, and close like an IDE.",
      },
    },
  },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

interface AgentChat {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  tagline: string
  messages: Array<{ from: "user" | "agent"; text: string }>
}

const agentChats: AgentChat[] = [
  {
    id: "chat:planner",
    name: "Planner",
    icon: Bot,
    tagline: "Sketching the Q3 roadmap",
    messages: [
      { from: "user", text: "Break the app-shell work into shippable slices." },
      {
        from: "agent",
        text: "Three verticals: resize-only layout, then dragging panes, then tabs. Each lands behind the same layout document, so nothing gets rebuilt.",
      },
      { from: "user", text: "What's the risk on the drag slice?" },
      {
        from: "agent",
        text: "Drop-target hit testing. I'd copy Zed's nearest-edge rule — it behaves predictably in the corners.",
      },
    ],
  },
  {
    id: "chat:reviewer",
    name: "Reviewer",
    icon: Bug,
    tagline: "2 findings on the open diff",
    messages: [
      { from: "user", text: "Anything blocking on the layout-model diff?" },
      {
        from: "agent",
        text: "Two findings: closePane should return the freed space to the split partner, and the weights need a zero-total guard. Both have suggested fixes attached.",
      },
    ],
  },
  {
    id: "chat:researcher",
    name: "Researcher",
    icon: Telescope,
    tagline: "Compared 4 pane-tree designs",
    messages: [
      { from: "user", text: "How do Zed and VS Code store pane layouts?" },
      {
        from: "agent",
        text: "Both use an n-ary tree with the same split rule. Zed keeps orientation on every node; VS Code alternates by depth. Sizes: Zed uses flex weights, VS Code pixels.",
      },
      { from: "user", text: "Which should we copy?" },
      {
        from: "agent",
        text: "Weights with explicit orientation — display-independent saves, readable subtrees.",
      },
    ],
  },
  {
    id: "chat:composer",
    name: "Composer",
    icon: Sparkles,
    tagline: "Drafting release notes",
    messages: [
      { from: "user", text: "Draft the changelog entry for the shell." },
      {
        from: "agent",
        text: "“New: split any pane in any direction, drag panes to rearrange, and maximize with Shift+Escape. Layouts persist per project.” Want a longer variant too?",
      },
    ],
  },
]

/** Finds a chat by view id, so unknown ids render a placeholder. */
function chatForView(viewId: string | undefined): AgentChat | undefined {
  return agentChats.find((chat) => chat.id === viewId)
}

function IconAction({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      size="icon"
      variant={active ? "secondary" : "ghost"}
      className="size-6 text-muted-foreground hover:text-foreground"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ChatMessages({ chat }: { chat: AgentChat }) {
  return (
    // Focusable so keyboard users can scroll the transcript; role="log"
    // tells screen readers this is a message history.
    <div
      role="log"
      aria-label={`${chat.name} conversation`}
      tabIndex={0}
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {chat.messages.map((message, index) => (
        <div
          key={index}
          className={
            message.from === "user"
              ? "ms-auto max-w-[85%] rounded-lg rounded-ee-sm bg-primary px-3 py-2 text-xs leading-5 text-primary-foreground"
              : "me-auto max-w-[85%] rounded-lg rounded-es-sm bg-muted px-3 py-2 text-xs leading-5"
          }
        >
          {message.text}
        </div>
      ))}
    </div>
  )
}

function ChatComposer({ agentName }: { agentName: string }) {
  return (
    <form
      className="flex shrink-0 items-center gap-1.5 border-t border-border p-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <Input
        aria-label={`Message ${agentName}`}
        placeholder={`Message ${agentName}…`}
        className="h-8 text-xs"
      />
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Send message"
        title="Send message"
      >
        <SendHorizontal aria-hidden className="size-4" />
      </Button>
    </form>
  )
}

function ChatPane({ pane }: { pane: PaneNode }) {
  const { closePane, layout, maximizePane, restorePane, splitPane } =
    useAppShell()
  const maximized = layout.workspace.maximizedPaneId === pane.id
  const chat = chatForView(pane.activeViewId)
  const Icon = chat?.icon ?? Bot

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-hidden border-b border-border bg-muted/40 pe-1.5">
        {/* Dragging the grip (or the title beside it) moves this pane onto
            another pane's edge. */}
        <AppShellPaneDragHandle
          paneId={pane.id}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 ps-2"
          title="Drag to move this pane"
        >
          <GripVertical
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/70"
          />
          <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-medium">
            {chat?.name ?? "No conversation"}
          </span>
        </AppShellPaneDragHandle>
        <IconAction
          label="Split pane right"
          onClick={() =>
            // A split opens an empty pane — pick any conversation from
            // the sidebar to fill it, instead of duplicating this chat.
            splitPane({
              paneId: pane.id,
              direction: PaneSplitDirection.Right,
              views: [],
            })
          }
        >
          <Columns2 aria-hidden className="size-3.5" />
        </IconAction>
        <IconAction
          label="Split pane down"
          onClick={() =>
            splitPane({
              paneId: pane.id,
              direction: PaneSplitDirection.Down,
              views: [],
            })
          }
        >
          <Rows2 aria-hidden className="size-3.5" />
        </IconAction>
        <IconAction
          label={maximized ? "Restore pane" : "Maximize pane"}
          onClick={() =>
            maximized ? restorePane() : maximizePane({ paneId: pane.id })
          }
        >
          {maximized ? (
            <Minimize2 aria-hidden className="size-3.5" />
          ) : (
            <Maximize2 aria-hidden className="size-3.5" />
          )}
        </IconAction>
        <IconAction
          label="Close pane"
          onClick={() => closePane({ paneId: pane.id })}
        >
          <X aria-hidden className="size-3.5" />
        </IconAction>
      </div>
      {chat ? (
        <>
          <ChatMessages chat={chat} />
          <ChatComposer agentName={chat.name} />
        </>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-xs text-muted-foreground">
          Pick a conversation from the sidebar.
        </div>
      )}
    </div>
  )
}

const dockToggleIcons = {
  [AppShellDockSide.Left]: PanelLeft,
  [AppShellDockSide.Right]: PanelRight,
  [AppShellDockSide.Bottom]: PanelBottom,
} as const

function HeaderDockToggles() {
  const { layout, toggleDock } = useAppShell()

  return (
    <div className="ms-auto flex items-center gap-0.5">
      {Object.values(AppShellDockSide).map((side) => {
        const Icon = dockToggleIcons[side]

        return (
          <IconAction
            key={side}
            label={`Toggle ${side} dock`}
            active={layout.docks[side].open}
            onClick={() => toggleDock({ side })}
          >
            <Icon aria-hidden className="size-4" />
          </IconAction>
        )
      })}
    </div>
  )
}

function ConversationsDock() {
  const { layout, openView } = useAppShell()
  const activePane = collectPanes(layout.workspace.root).find(
    (pane) => pane.id === layout.workspace.activePaneId,
  )

  return (
    <SidebarContent className="min-h-0 flex-1 overflow-auto">
      <SidebarGroup>
        <SidebarGroupLabel>Agents</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {agentChats.map((chat) => (
              <SidebarMenuItem
                key={chat.id}
                icon={<chat.icon aria-hidden className="size-4" />}
                description={chat.tagline}
                isActive={activePane?.activeViewId === chat.id}
                onClick={() => openView({ viewId: chat.id })}
              >
                {chat.name}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

function StatusBarContent() {
  const { layout } = useAppShell()
  const panes = collectPanes(layout.workspace.root)
  const activePane = panes.find(
    (pane) => pane.id === layout.workspace.activePaneId,
  )
  const activeChat = chatForView(activePane?.activeViewId)

  return (
    <>
      <span>
        {agentChats.length} agents · {panes.length}{" "}
        {panes.length === 1 ? "pane" : "panes"}
      </span>
      <span className="ms-auto">
        {activeChat ? `Talking to ${activeChat.name}` : "No conversation"}
      </span>
    </>
  )
}

function ShellExample({ defaultLayout }: { defaultLayout?: AppShellLayout }) {
  return (
    <div className="h-[560px] w-full overflow-hidden rounded-lg border border-border shadow-xs">
      <AppShell
        defaultLayout={
          defaultLayout ??
          createAppShellLayout({
            views: ["chat:planner"],
            openDocks: [AppShellDockSide.Left],
          })
        }
      >
        <AppShellHeader className="bg-sidebar">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Sparkles aria-hidden className="size-4" />
            Nessa
          </span>
          <HeaderDockToggles />
        </AppShellHeader>
        <AppShellBody>
          <AppShellDock side={AppShellDockSide.Left} minSize={200} maxSize={400}>
            <ConversationsDock />
          </AppShellDock>
          <AppShellMain>
            <AppShellWorkspace renderPane={(pane) => <ChatPane pane={pane} />} />
            <AppShellDock
              side={AppShellDockSide.Bottom}
              minSize={120}
              maxSize={360}
            >
              <div className="p-3 font-mono text-xs text-muted-foreground">
                Bottom dock — agent run logs.
              </div>
            </AppShellDock>
          </AppShellMain>
          <AppShellDock side={AppShellDockSide.Right} minSize={200} maxSize={420}>
            <div className="p-3 text-xs text-muted-foreground">
              Right dock — agent settings and context.
            </div>
          </AppShellDock>
        </AppShellBody>
        <AppShellStatusBar className="bg-sidebar">
          <StatusBarContent />
        </AppShellStatusBar>
      </AppShell>
    </div>
  )
}

export const AgentWorkspace: Story = {
  parameters: storyDocumentation(
    "The full composition as a multi-agent chat app: conversations in the sidebar dock open into workspace panes with messages and a composer. Split a chat with the pane actions, drag it by its grip onto another pane's edge to rearrange, maximize with Shift+Escape, and resize every region from its separators.",
  ),
  render: () => <ShellExample />,
}

export const SplitAndClose: Story = {
  parameters: storyDocumentation(
    "Splitting inserts a focused pane beside the target and closing returns its space to the neighbor it was split from; the tree re-normalizes after every operation.",
  ),
  render: () => (
    <ShellExample
      defaultLayout={createAppShellLayout({
        views: ["chat:planner"],
        openDocks: [],
      })}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const panes = () =>
      canvasElement.querySelectorAll('[data-slot="app-shell-pane"]')

    await waitFor(() => expect(panes()).toHaveLength(1))

    const splitButton = await canvas.findByRole("button", {
      name: "Split pane right",
    })
    splitButton.click()

    await waitFor(() => expect(panes()).toHaveLength(2))

    const newPane = panes()[1] as HTMLElement

    await waitFor(() =>
      expect(newPane.getAttribute("data-active")).toBe("true"),
    )

    const closeButton = await within(newPane).findByRole("button", {
      name: "Close pane",
    })
    closeButton.click()

    await waitFor(() => expect(panes()).toHaveLength(1))
  },
}

export const SwapPanes: Story = {
  parameters: storyDocumentation(
    "Dragging one pane onto another swaps them — the split structure and orientations stay exactly as they were, and new sections come from the explicit split actions instead. While hovering, the target highlights and previews the incoming content, a miniature of the dragged pane rides the cursor, and uninvolved panes fade.",
  ),
  render: () => (
    <ShellExample
      defaultLayout={splitPane(
        createAppShellLayout({ views: ["chat:planner"], openDocks: [] }),
        {
          paneId: "pane-1",
          direction: PaneSplitDirection.Right,
          newPaneId: "pane-2",
          views: ["chat:reviewer"],
        },
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const pane = (id: string) =>
      canvasElement.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)

    await waitFor(() => {
      expect(pane("pane-1")).not.toBeNull()
      expect(pane("pane-2")).not.toBeNull()
    })

    const leftBefore = {
      "pane-1": pane("pane-1")!.getBoundingClientRect().left,
      "pane-2": pane("pane-2")!.getBoundingClientRect().left,
    }

    const handle = pane("pane-2")!.querySelector<HTMLElement>(
      '[data-slot="app-shell-pane-drag-handle"]',
    )!
    const handleRect = handle.getBoundingClientRect()
    const targetRect = pane("pane-1")!.getBoundingClientRect()
    const centerX = targetRect.left + targetRect.width / 2
    const centerY = targetRect.top + targetRect.height / 2

    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: handleRect.left + 10,
        clientY: handleRect.top + 10,
      }),
    )
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: centerX,
        clientY: centerY,
      }),
    )

    // Hovering the target: the pane ghost is up, the source slot shows
    // its lifted-out placeholder, and the whole target highlights with a
    // faint preview of the incoming content. Computed styles are asserted
    // — not just class names — so a missing Tailwind rule can never pass
    // silently again.
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-slot="app-shell-drag-ghost"]'),
      ).not.toBeNull()
      expect(pane("pane-2")!.getAttribute("data-drag-source")).toBe("true")
      const liftedContent = pane("pane-2")!.querySelector<HTMLElement>(
        '[data-slot="app-shell-pane-content"]',
      )
      expect(liftedContent).not.toBeNull()
      expect(getComputedStyle(liftedContent!).visibility).toBe("hidden")
      const lift = pane("pane-2")!.querySelector<HTMLElement>(
        '[data-slot="app-shell-pane-lift"]',
      )
      expect(lift).not.toBeNull()
      expect(getComputedStyle(lift!).borderTopStyle).toBe("dashed")
      const preview = pane("pane-1")!.querySelector<HTMLElement>(
        '[data-slot="app-shell-drop-preview"]',
      )
      expect(preview).not.toBeNull()
      expect(getComputedStyle(preview!).backgroundColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      )
      // The preview scrims this pane's content and shows the incoming
      // pane's content faintly on top.
      expect(preview!.querySelector("div")?.hasChildNodes()).toBe(true)
    })

    handle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: centerX,
        clientY: centerY,
      }),
    )

    // Released in the swap zone: the panes trade places — same row, same
    // orientation, positions exchanged.
    await waitFor(() => {
      expect(pane("pane-1")!.getBoundingClientRect().left).toBeCloseTo(
        leftBefore["pane-2"],
        0,
      )
      expect(pane("pane-2")!.getBoundingClientRect().left).toBeCloseTo(
        leftBefore["pane-1"],
        0,
      )
      expect(pane("pane-1")!.getBoundingClientRect().top).toBeCloseTo(
        pane("pane-2")!.getBoundingClientRect().top,
        0,
      )
    })
  },
}

export const DockToggles: Story = {
  parameters: storyDocumentation(
    "Docks live outside the workspace tree: toggling one never restructures the panes, and a closed dock keeps its pixel size for reopening.",
  ),
  render: () => <ShellExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const leftDock = () =>
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="app-shell-dock"][data-side="left"]',
      )

    await waitFor(() => expect(leftDock()).not.toBeNull())

    const initialWidth = leftDock()!.getBoundingClientRect().width
    const toggle = await canvas.findByRole("button", {
      name: "Toggle left dock",
    })

    toggle.click()
    await waitFor(() => expect(leftDock()).toBeNull())

    toggle.click()
    await waitFor(() => expect(leftDock()).not.toBeNull())
    expect(leftDock()!.getBoundingClientRect().width).toBeCloseTo(
      initialWidth,
      0,
    )
  },
}

export const MaximizeAndRestore: Story = {
  parameters: storyDocumentation(
    "Maximizing presents one pane over the whole workspace while every pane stays mounted — content state survives the round trip — and restoring returns exactly the previous arrangement. Shift+Escape toggles maximize on the active pane (override or disable via the maximizeShortcut property).",
  ),
  render: () => (
    <ShellExample
      defaultLayout={splitPane(
        splitPane(
          createAppShellLayout({ views: ["chat:planner"], openDocks: [] }),
          {
            paneId: "pane-1",
            direction: PaneSplitDirection.Right,
            newPaneId: "pane-2",
            views: ["chat:reviewer"],
          },
        ),
        {
          paneId: "pane-2",
          direction: PaneSplitDirection.Down,
          newPaneId: "pane-3",
          views: ["chat:researcher"],
        },
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const panes = () =>
      canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="app-shell-pane"]',
      )
    const workspace = () =>
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="app-shell-workspace"]',
      )

    // A nested arrangement: planner beside reviewer over researcher.
    await waitFor(() => expect(panes()).toHaveLength(3))

    const firstPane = panes()[0]
    const maximize = await within(firstPane).findByRole("button", {
      name: "Maximize pane",
    })
    maximize.click()

    // Every pane stays mounted; the maximized-away panes collapse to zero
    // width and become inert, so their React state survives but their
    // controls leave the tab order and the accessibility tree.
    await waitFor(() => {
      expect(workspace()?.getAttribute("data-maximized")).toBe("true")
      expect(panes()).toHaveLength(3)
      expect(panes()[0].getBoundingClientRect().width).toBeGreaterThan(200)
      for (const pane of [...panes()].slice(1)) {
        expect(pane.getBoundingClientRect().width).toBe(0)
        expect(pane.closest("[inert]")).not.toBeNull()
      }
    })

    const restore = await canvas.findByRole("button", { name: "Restore pane" })
    restore.click()

    await waitFor(() => {
      expect(workspace()?.getAttribute("data-maximized")).toBeNull()
      for (const pane of panes()) {
        expect(pane.getBoundingClientRect().width).toBeGreaterThan(80)
        expect(pane.closest("[inert]")).toBeNull()
      }
    })

    // Shift+Escape toggles maximize on the active pane from the keyboard.
    await userEvent.keyboard("{Shift>}{Escape}{/Shift}")

    await waitFor(() =>
      expect(workspace()?.getAttribute("data-maximized")).toBe("true"),
    )

    await userEvent.keyboard("{Shift>}{Escape}{/Shift}")

    await waitFor(() =>
      expect(workspace()?.getAttribute("data-maximized")).toBeNull(),
    )
  },
}
