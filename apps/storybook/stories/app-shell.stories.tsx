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
  AppShellStatusBar,
  AppShellWorkspace,
  Button,
  PaneSplitDirection,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  createAppShellLayout,
  splitPane,
  useAppShell,
  type AppShellLayout,
  type PaneNode,
} from "@nessa-ui/react"
import {
  Columns2,
  FileCode,
  FileText,
  GitBranch,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Rows2,
  SlidersHorizontal,
  TerminalSquare,
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
          "AppShell composes an IDE-style application frame: a header, pixel-sized resizable docks on the left, right, and bottom, a status bar, and a center workspace whose panes split recursively in any direction. The whole arrangement is one serializable layout document; the shell renders it and reports changes, while the consuming application owns state and persistence. Docks host content such as the Sidebar components; workspace panes are resolved by the application through renderPane.",
      },
    },
  },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

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

function DemoPane({ pane }: { pane: PaneNode }) {
  const { closePane, layout, maximizePane, restorePane, splitPane } =
    useAppShell()
  const maximized = layout.workspace.maximizedPaneId === pane.id
  const view = pane.activeViewId ?? "untitled"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-hidden border-b border-border bg-muted/40 ps-2.5 pe-1.5">
        <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="me-auto ms-1.5 truncate text-xs font-medium">
          {view}
        </span>
        <IconAction
          label="Split pane right"
          onClick={() =>
            splitPane({
              paneId: pane.id,
              direction: PaneSplitDirection.Right,
              views: ["untitled"],
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
              views: ["untitled"],
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
      <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-6 text-muted-foreground">
        <p className="text-foreground/70">{`// ${view}`}</p>
        <p>Rendered by the application through renderPane.</p>
        <p>The layout document stores view ids, never elements.</p>
      </div>
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

function ExplorerDock() {
  return (
    <SidebarContent className="min-h-0 flex-1 overflow-auto">
      <SidebarGroup>
        <SidebarGroupLabel>Explorer</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem
              size="sm"
              isActive
              icon={<FileText aria-hidden className="size-4" />}
            >
              readme.md
            </SidebarMenuItem>
            <SidebarMenuItem
              size="sm"
              icon={<FileCode aria-hidden className="size-4" />}
            >
              layout-model.ts
            </SidebarMenuItem>
            <SidebarMenuItem
              size="sm"
              icon={<FileCode aria-hidden className="size-4" />}
            >
              split-view.tsx
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

function TerminalDock() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-3 text-xs font-medium">
        <TerminalSquare aria-hidden className="size-3.5 text-muted-foreground" />
        Terminal
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-5 text-muted-foreground">
        <p>
          <span className="text-foreground/80">➜ nessa</span> pnpm storybook
        </p>
        <p>Storybook ready at http://localhost:6006</p>
      </div>
    </div>
  )
}

function InspectorDock() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-3 text-xs font-medium">
        <SlidersHorizontal aria-hidden className="size-3.5 text-muted-foreground" />
        Inspector
      </div>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 p-3 text-xs">
        <dt className="text-muted-foreground">Kind</dt>
        <dd>Markdown</dd>
        <dt className="text-muted-foreground">Size</dt>
        <dd>4.2 KB</dd>
        <dt className="text-muted-foreground">Modified</dt>
        <dd>Today</dd>
      </dl>
    </div>
  )
}

function StatusBarContent() {
  const { layout } = useAppShell()

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <GitBranch aria-hidden className="size-3" />
        main
      </span>
      <span className="ms-auto">
        Active pane: {layout.workspace.activePaneId}
      </span>
    </>
  )
}

function ShellExample({
  defaultLayout,
}: {
  defaultLayout?: AppShellLayout
}) {
  return (
    <div className="h-[540px] w-full overflow-hidden rounded-lg border border-border shadow-xs">
      <AppShell
        defaultLayout={
          defaultLayout ??
          createAppShellLayout({
            views: ["readme.md"],
            openDocks: [AppShellDockSide.Left, AppShellDockSide.Bottom],
          })
        }
      >
        <AppShellHeader className="bg-sidebar">
          <span className="text-sm font-semibold tracking-tight">
            Nessa Studio
          </span>
          <HeaderDockToggles />
        </AppShellHeader>
        <AppShellBody>
          <AppShellDock side={AppShellDockSide.Left} minSize={180} maxSize={420}>
            <ExplorerDock />
          </AppShellDock>
          <AppShellMain>
            <AppShellWorkspace renderPane={(pane) => <DemoPane pane={pane} />} />
            <AppShellDock
              side={AppShellDockSide.Bottom}
              minSize={120}
              maxSize={360}
            >
              <TerminalDock />
            </AppShellDock>
          </AppShellMain>
          <AppShellDock side={AppShellDockSide.Right} minSize={180} maxSize={420}>
            <InspectorDock />
          </AppShellDock>
        </AppShellBody>
        <AppShellStatusBar className="bg-sidebar">
          <StatusBarContent />
        </AppShellStatusBar>
      </AppShell>
    </div>
  )
}

export const IdeShell: Story = {
  parameters: storyDocumentation(
    "The full composition: header, left and bottom docks open, a splittable workspace, and a status bar reading from the shared layout document. Sidebar components furnish the left dock, pane and dock actions are icon buttons with accessible names, and every region resizes from its separators.",
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
        views: ["readme.md"],
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
          createAppShellLayout({ views: ["readme.md"], openDocks: [] }),
          {
            paneId: "pane-1",
            direction: PaneSplitDirection.Right,
            newPaneId: "pane-2",
            views: ["notes.md"],
          },
        ),
        {
          paneId: "pane-2",
          direction: PaneSplitDirection.Down,
          newPaneId: "pane-3",
          views: ["todo.md"],
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

    // A nested arrangement: pane-1 beside a column of pane-2 over pane-3.
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
