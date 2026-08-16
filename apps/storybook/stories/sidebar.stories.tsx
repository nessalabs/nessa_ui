import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  Button,
  cn,
  Sidebar,
  SidebarCollapsible,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@nessa-ui/react"
import {
  Archive,
  Folder,
  Pin,
  Plus,
  Settings,
} from "lucide-react"

import {
  ChatComposeIcon,
  FolderClosedIcon,
  FolderOpenIcon,
} from "./icons/nucleo"
import { SidebarToggleIcon } from "./icons/sidebar-toggle-icon"
import { sidebarStoryDecorator } from "./sidebar-story-surface"
import { storyDocumentation } from "./story-documentation"

const pinnedChats = [
  "Plan the customer research sprint",
  "Review the launch narrative",
  "Refine the voice experience",
  "Map the release workflow",
  "Prepare the product brief",
]

const projects = [
  {
    name: "nessa",
    chats: ["Build the Nessa design system", "Define component principles"],
  },
  {
    name: "api-platform",
    chats: ["Prepare the release checklist"],
  },
  {
    name: "website",
    chats: [],
  },
  {
    name: "desktop-app",
    chats: ["Review the desktop layout", "Test responsive navigation"],
  },
  {
    name: "developer-tools",
    chats: ["Document the extension workflow"],
  },
]

const recentChats = [
  "Navigation architecture",
  "Workspace onboarding",
  "Empty state explorations",
]

const exampleDescriptions = {
  ChatNavigation:
    "A complete desktop chat navigation example with project disclosure, row actions, keyboard toggling, and responsive Sidebar state.",
  Light:
    "The complete chat navigation composition rendered with Nessa's light semantic theme.",
  IconCollapsed:
    "A desktop icon-collapsed Sidebar whose branded header trigger stays anchored while changing from a compact mark to the full identity.",
  MobileIconCollapsed:
    "The branded icon-collapsed composition keeps its trigger position while adapting to a mobile dialog and restoring focus.",
  NonCollapsible:
    "A persistent Sidebar ignores closed provider state when its collapsible option is None.",
  MobileOverlay:
    "An off-canvas mobile Sidebar swaps a compact brand trigger for the expanded header identity at the same viewport position.",
  Stress500Rows:
    "A 500-row Sidebar stress example exposes React Profiler telemetry for mount, selection, and toggle commits.",
} as const

async function expectSidebarPalette(canvasElement: HTMLElement, dark: boolean) {
  const rootStyles = getComputedStyle(document.documentElement)
  const sidebar = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar"]')
  const activeItem = canvasElement.querySelector<HTMLElement>('[data-active="true"]')

  await expect(document.documentElement.classList.contains("dark")).toBe(dark)
  await expect(sidebar).not.toBeNull()
  await expect(activeItem).not.toBeNull()
  await expect(getComputedStyle(sidebar!).backgroundColor).toBe(
    rootStyles.getPropertyValue("--sidebar").trim(),
  )
  await expect(getComputedStyle(sidebar!).color).toBe(
    rootStyles.getPropertyValue("--sidebar-foreground").trim(),
  )
  await expect(getComputedStyle(activeItem!).backgroundColor).toBe(
    rootStyles.getPropertyValue("--sidebar-accent").trim(),
  )
  await expect(getComputedStyle(activeItem!).color).toBe(
    rootStyles.getPropertyValue("--sidebar-accent-foreground").trim(),
  )
}

async function expectSidebarWorkspacePalette(canvasElement: HTMLElement) {
  const sidebar = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar"]')
  const inset = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar-inset"]')

  await expect(sidebar).not.toBeNull()
  await expect(inset).not.toBeNull()
  await expect(getComputedStyle(inset!).backgroundColor).toBe(
    getComputedStyle(sidebar!).backgroundColor,
  )
}

async function expectNucleoIcon(
  button: HTMLElement,
  id: string,
  shapeCount: number,
) {
  const visibleIcons = [
    ...button.querySelectorAll<SVGSVGElement>(`[data-nucleo-icon="${id}"]`),
  ].filter((candidate) => {
    const bounds = candidate.getBoundingClientRect()
    const styles = getComputedStyle(candidate)

    return (
      bounds.width > 0 &&
      bounds.height > 0 &&
      styles.display !== "none" &&
      styles.visibility !== "hidden"
    )
  })
  const icon = visibleIcons[0]!

  await expect(visibleIcons).toHaveLength(1)
  await expect(icon).toHaveAttribute("aria-hidden", "true")
  await expect(icon).toHaveAttribute("focusable", "false")
  await expect(icon.querySelectorAll("path, rect, line")).toHaveLength(shapeCount)
  await expect(getComputedStyle(icon).stroke).toBe(
    getComputedStyle(button).color,
  )
}

async function expectChatComposeIcon(button: HTMLElement) {
  await expectNucleoIcon(button, "chat-compose", 3)
}

const stressChats = Array.from({ length: 500 }, (_, index) => ({
  id: `stress-chat-${index + 1}`,
  title: `Stress chat ${String(index + 1).padStart(3, "0")}`,
}))

function SidebarStressTelemetry() {
  const [activeChatId, setActiveChatId] = React.useState(stressChats[0]!.id)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const telemetryRef = React.useRef<HTMLOutputElement>(null)
  const mountStartedAtRef = React.useRef(performance.now())
  const interactionRef = React.useRef<{
    kind: "selection" | "sidebar"
    startedAt: number
  } | null>(null)

  React.useLayoutEffect(() => {
    const telemetry = telemetryRef.current
    if (!telemetry) return

    if (!telemetry.dataset.mountCommitDuration) {
      telemetry.dataset.mountCommitDuration = (
        performance.now() - mountStartedAtRef.current
      ).toFixed(3)
    }

    const interaction = interactionRef.current
    if (!interaction) return

    telemetry.dataset[`${interaction.kind}CommitDuration`] = (
      performance.now() - interaction.startedAt
    ).toFixed(3)
    interactionRef.current = null
  }, [activeChatId, sidebarOpen])

  const recordRender = React.useCallback<React.ProfilerOnRenderCallback>(
    (_id, phase, actualDuration, baseDuration) => {
      const telemetry = telemetryRef.current
      if (!telemetry) return

      telemetry.dataset.phase = phase
      telemetry.dataset.actualDuration = actualDuration.toFixed(3)
      telemetry.dataset.baseDuration = baseDuration.toFixed(3)
      if (phase === "mount") {
        telemetry.dataset.mountDuration = actualDuration.toFixed(3)
        telemetry.dataset.mountBaseDuration = baseDuration.toFixed(3)
      } else {
        telemetry.dataset.lastUpdateDuration = actualDuration.toFixed(3)
        telemetry.dataset.maxUpdateDuration = Math.max(
          Number.parseFloat(telemetry.dataset.maxUpdateDuration ?? "0"),
          actualDuration,
        ).toFixed(3)
      }
      telemetry.dataset.commits = String(
        Number.parseInt(telemetry.dataset.commits ?? "0", 10) + 1,
      )
    },
    [],
  )

  return (
    <React.Profiler id="sidebar-500-rows" onRender={recordRender}>
      <SidebarProvider
        keyboardShortcut={{ key: "b", modifier: "mod" }}
        open={sidebarOpen}
        onOpenChange={(open) => {
          interactionRef.current = { kind: "sidebar", startedAt: performance.now() }
          setSidebarOpen(open)
        }}
      >
        <Sidebar aria-label="500 row stress navigation">
          <SidebarHeader>
            <div className="flex min-h-10 items-center justify-between gap-2 px-1">
              <span className="text-sm font-semibold">500 row stress test</span>
              <SidebarTrigger>
                <SidebarToggleIcon />
              </SidebarTrigger>
            </div>
          </SidebarHeader>
          <SidebarContent data-testid="stress-scroll-region">
            <SidebarGroup>
              <SidebarGroupLabel>Chats</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu data-testid="stress-row-list">
                  {stressChats.map((chat) => (
                    <SidebarMenuItem
                      key={chat.id}
                      isActive={activeChatId === chat.id}
                      tooltip={chat.title}
                      onClick={() => {
                        interactionRef.current = {
                          kind: "selection",
                          startedAt: performance.now(),
                        }
                        setActiveChatId(chat.id)
                      }}
                    >
                      {chat.title}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <span className="px-2 text-xs text-sidebar-foreground/60">
              {stressChats.length} rendered rows
            </span>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="gap-2 p-4">
          <p aria-live="polite" className="text-sm font-medium">
            {stressChats.find((chat) => chat.id === activeChatId)?.title}
          </p>
          <output
            ref={telemetryRef}
            aria-label="React profiler telemetry"
            data-commits="0"
            className="text-xs text-muted-foreground"
          >
            React Profiler telemetry is exposed through data attributes.
          </output>
        </SidebarInset>
      </SidebarProvider>
    </React.Profiler>
  )
}

function ChatSidebarDemo() {
  const [activeItem, setActiveItem] = React.useState("Build the Nessa design system")
  const [draftChats, setDraftChats] = React.useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [lastAction, setLastAction] = React.useState("No conversation action yet")
  const [expandedProjects, setExpandedProjects] = React.useState(
    () => new Set(projects.filter((project) => project.chats.length > 0).map((project) => project.name)),
  )

  const selectItem = (item: string) => {
    setActiveItem(item)
  }

  const createChat = () => {
    const nextChat = `Untitled chat ${draftChats.length + 1}`
    setDraftChats((currentChats) => [nextChat, ...currentChats])
    setActiveItem(nextChat)
  }

  const toggleProject = (project: (typeof projects)[number]) => {
    selectItem(project.name)
    if (project.chats.length === 0) return

    setExpandedProjects((currentProjects) => {
      const nextProjects = new Set(currentProjects)
      if (nextProjects.has(project.name)) nextProjects.delete(project.name)
      else nextProjects.add(project.name)
      return nextProjects
    })
  }

  return (
    <SidebarProvider
      keyboardShortcut={{ key: "b", modifier: "mod" }}
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      sidebarWidth="21.5rem"
    >
      <Sidebar aria-label="Workspace navigation">
        <SidebarHeader className="gap-3 px-4 pb-2 pt-4">
          <div className="flex min-h-10 items-center justify-between gap-2">
            <span className="truncate px-1 text-lg font-semibold">Nessa</span>
            <SidebarTrigger>
              <SidebarToggleIcon />
            </SidebarTrigger>
          </div>

          <SidebarMenu>
            <SidebarMenuItem
              icon={<ChatComposeIcon />}
              className="font-medium"
              onClick={createChat}
            >
              New chat
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pinnedChats.map((chat) => (
                  <SidebarMenuItem
                    key={chat}
                    isActive={activeItem === chat}
                    tooltip={chat}
                    onClick={() => selectItem(chat)}
                    showTrailingOnHover
                    trailing={
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label={`Pin ${chat}`}
                          onClick={() => setLastAction(`Pinned ${chat}`)}
                        >
                          <Pin />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label={`Archive ${chat}`}
                          onClick={() => setLastAction(`Archived ${chat}`)}
                        >
                          <Archive />
                        </Button>
                      </>
                    }
                  >
                    {chat}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.map((project) => {
                  const hasChats = project.chats.length > 0
                  const isExpanded = hasChats && expandedProjects.has(project.name)
                  const projectId = `project-${project.name}-chats`

                  return (
                    <SidebarMenuItem
                      key={project.name}
                      icon={isExpanded ? <FolderOpenIcon /> : <FolderClosedIcon />}
                      isActive={activeItem === project.name}
                      tooltip={project.name}
                      aria-expanded={hasChats ? isExpanded : undefined}
                      aria-controls={hasChats ? projectId : undefined}
                      onClick={() => toggleProject(project)}
                      submenu={
                        isExpanded ? (
                          <SidebarMenu nested id={projectId}>
                            {project.chats.map((chat) => (
                              <SidebarMenuItem
                                key={chat}
                                asChild
                                isActive={activeItem === chat}
                                onClick={(event) => {
                                  event.preventDefault()
                                  selectItem(chat)
                                }}
                              >
                                <a
                                  href={`#${chat.toLowerCase().replaceAll(" ", "-")}`}
                                >
                                  {chat}
                                </a>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        ) : undefined
                      }
                    >
                      {project.name}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupAction
              aria-label="Add chat"
              onClick={() => setLastAction("Added chat")}
            >
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {[...draftChats, ...recentChats].map((chat) => (
                  <SidebarMenuItem
                    key={chat}
                    isActive={activeItem === chat}
                    tooltip={chat}
                    onClick={() => selectItem(chat)}
                  >
                    {chat}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem
              icon={
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  NU
                </span>
              }
              trailing={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open settings"
                  title="Settings"
                  className="size-6 text-sidebar-foreground/60"
                >
                  <Settings />
                </Button>
              }
            >
              Nessa User
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh items-center justify-center overflow-hidden p-6">
        {!sidebarOpen && (
          <SidebarTrigger className="absolute left-4 top-4">
            <SidebarToggleIcon />
          </SidebarTrigger>
        )}
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium">{activeItem}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a conversation or start a new chat from the sidebar.
          </p>
          <output aria-label="Conversation action" className="mt-2 block text-xs text-muted-foreground">
            {lastAction}
          </output>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * Demonstrates consumer-owned branding inside the generic Sidebar trigger slot.
 *
 * @param props - State-specific accessible labels and native trigger properties.
 * @returns A trigger that presents a compact mark or expanded brand identity.
 */
function BrandedSidebarTrigger({
  openLabel,
  closeLabel,
  className,
  ...props
}: Omit<React.ComponentProps<typeof SidebarTrigger>, "aria-label"> & {
  openLabel: string
  closeLabel: string
}) {
  const { state } = useSidebar()
  const expanded = state === "expanded"

  return (
    <SidebarTrigger
      data-sidebar-brand-trigger
      className={cn(
        "h-10 gap-2",
        expanded ? "w-full justify-start px-2" : "size-10 justify-center p-0",
        className,
      )}
      aria-label={expanded ? closeLabel : openLabel}
      {...props}
    >
      {expanded ? (
        <>
          <span className="min-w-0 flex-1 truncate text-start text-sm font-semibold text-sidebar-foreground">
            Nessa
          </span>
          <span aria-hidden="true" className="shrink-0">
            <SidebarToggleIcon />
          </span>
        </>
      ) : (
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground"
        >
          N
        </span>
      )}
    </SidebarTrigger>
  )
}

function IconCollapsedDemo() {
  return (
    <SidebarProvider
      defaultOpen={false}
      keyboardShortcut={{ key: "b", modifier: "mod" }}
    >
      <Sidebar collapsible="icon" aria-label="Compact navigation">
        <SidebarHeader className="p-2">
          <BrandedSidebarTrigger
            openLabel="Open compact navigation"
            closeLabel="Close compact navigation"
          />
          <SidebarMenu className="group-data-[state=collapsed]/sidebar:items-center">
            <SidebarMenuItem
              icon={<ChatComposeIcon />}
              className="group-data-[state=collapsed]/sidebar:size-10"
              tooltip="New chat"
            >
              New chat
            </SidebarMenuItem>
            <SidebarMenuItem
              asChild
              icon={<Folder />}
              className="group-data-[state=collapsed]/sidebar:size-10"
              tooltip="Projects"
            >
              <a href="#projects">Projects</a>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarFooter className="p-2">
          <SidebarMenu className="group-data-[state=collapsed]/sidebar:items-center">
            <SidebarMenuItem
              className="group-data-[state=collapsed]/sidebar:size-10"
              tooltip="Nessa User"
              icon={
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  NU
                </span>
              }
            >
              Nessa User
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="items-center justify-center">
        <button type="button">Workspace action</button>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * Demonstrates one stable trigger location across closed and modal mobile states.
 *
 * @returns A mobile Sidebar example with aligned external and internal triggers.
 */
function MobileOverlayDemo() {
  const { open } = useSidebar()

  return (
    <>
      <Sidebar aria-label="Mobile navigation">
        <SidebarHeader className="p-2">
          <BrandedSidebarTrigger
            openLabel="Open navigation"
            closeLabel="Close navigation"
          />
          <SidebarMenu>
            <SidebarMenuItem icon={<ChatComposeIcon />}>
              New chat
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      </Sidebar>
      <SidebarInset className="relative">
        <BrandedSidebarTrigger
          openLabel="Open navigation"
          closeLabel="Close navigation"
          hidden={open}
          className="absolute left-2 top-2"
        />
        <button type="button">Background action</button>
      </SidebarInset>
    </>
  )
}

const meta = {
  title: "Components/Sidebar/Examples",
  component: Sidebar,
  tags: ["autodocs", "test"],
  decorators: [sidebarStoryDecorator],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Complete Sidebar examples across application navigation, themes, collapsed states, mobile overlays, non-collapsible layouts, and performance. Use Primitives for component-level contracts and Compositions for reusable patterns.",
      },
    },
  },
  globals: {
    theme: "dark",
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const ChatNavigation: Story = {
  parameters: storyDocumentation(exampleDescriptions.ChatNavigation),
  render: () => <ChatSidebarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectSidebarPalette(canvasElement, true)
    const expandedSidebarTrigger = canvas.getAllByRole("button", {
      name: "Toggle sidebar",
    })[0]!
    await expectNucleoIcon(expandedSidebarTrigger, "sidebar-left", 2)
    await expectChatComposeIcon(
      canvas.getByRole("button", { name: "New chat" }),
    )
    const newChatButton = canvas.getByRole("button", { name: "New chat" })
    const ordinaryChatButton = canvas.getByRole("button", {
      name: pinnedChats[0],
    })
    const profileButton = canvas.getByRole("button", {
      name: /Nessa User$/,
    })
    const footer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="sidebar-footer"]',
    )!
    await expect(newChatButton).toHaveAttribute("data-size", "default")
    await expect(profileButton).toHaveAttribute("data-size", "default")
    await expect(newChatButton.getBoundingClientRect().height).toBe(
      ordinaryChatButton.getBoundingClientRect().height,
    )
    await expect(profileButton.getBoundingClientRect().height).toBe(
      ordinaryChatButton.getBoundingClientRect().height,
    )
    await expect(footer.getBoundingClientRect().height).toBeGreaterThan(
      ordinaryChatButton.getBoundingClientRect().height,
    )

    await userEvent.click(newChatButton)
    await expect(
      canvas.getByRole("button", { name: "Untitled chat 1" }),
    ).toHaveAttribute("data-active", "true")

    const projectButton = canvas.getByRole("button", { name: "nessa" })
    await expect(projectButton).toHaveAttribute("aria-expanded", "true")
    await expect(projectButton).toHaveAttribute(
      "aria-controls",
      "project-nessa-chats",
    )
    await expect(canvasElement.querySelector("#project-nessa-chats")).not.toBeNull()
    await expectNucleoIcon(projectButton, "folder-open", 2)
    await userEvent.click(projectButton)
    await expect(projectButton).toHaveAttribute("aria-expanded", "false")
    await expectNucleoIcon(projectButton, "folder-closed", 2)
    await expect(canvasElement.querySelector("#project-nessa-chats")).toBeNull()
    await userEvent.click(projectButton)
    await expect(projectButton).toHaveAttribute("aria-expanded", "true")
    await expectNucleoIcon(projectButton, "folder-open", 2)
    await expect(canvasElement.querySelector("#project-nessa-chats")).not.toBeNull()

    const emptyProjectButton = canvas.getByRole("button", { name: "website" })
    await expect(emptyProjectButton).not.toHaveAttribute("aria-expanded")
    await expect(emptyProjectButton).not.toHaveAttribute("aria-controls")
    await expectNucleoIcon(emptyProjectButton, "folder-closed", 2)
    await userEvent.click(emptyProjectButton)
    await expect(emptyProjectButton).not.toHaveAttribute("aria-expanded")
    await expect(emptyProjectButton).not.toHaveAttribute("aria-controls")
    await expectNucleoIcon(emptyProjectButton, "folder-closed", 2)
    await expect(canvasElement.querySelector("#project-website-chats")).toBeNull()

    await userEvent.click(expandedSidebarTrigger)
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]')
    const sidebarInner = canvasElement.querySelector<HTMLElement>(
      '[data-slot="sidebar-inner"]',
    )
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await expect(sidebarInner).toHaveAttribute("inert")
    await expect(sidebarInner).toHaveAttribute("aria-hidden", "true")
    await userEvent.tab()
    await expect(sidebarInner).not.toContainElement(
      document.activeElement as HTMLElement | null,
    )

    const collapsedSidebarTrigger = canvasElement
      .querySelector("main")!
      .querySelector<HTMLButtonElement>("button")!
    await expectNucleoIcon(collapsedSidebarTrigger, "sidebar-right", 2)
    await userEvent.click(collapsedSidebarTrigger)
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    await expectNucleoIcon(expandedSidebarTrigger, "sidebar-left", 2)

    await userEvent.keyboard("{Control>}b{/Control}")
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await userEvent.keyboard("{Control>}b{/Control}")
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
  },
}

export const Light: Story = {
  parameters: storyDocumentation(exampleDescriptions.Light),
  globals: {
    theme: "light",
  },
  render: () => <ChatSidebarDemo />,
  play: async ({ canvasElement }) => {
    await expectSidebarPalette(canvasElement, false)
    await expectSidebarWorkspacePalette(canvasElement)
  },
}

export const IconCollapsed: Story = {
  parameters: storyDocumentation(exampleDescriptions.IconCollapsed),
  render: () => <IconCollapsedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const compactSidebar = canvas.getByLabelText("Compact navigation")
    await expect(compactSidebar).toHaveAttribute(
      "data-state",
      "collapsed",
    )
    const header = compactSidebar.querySelector<HTMLElement>(
      '[data-slot="sidebar-header"]',
    )!
    const footer = compactSidebar.querySelector<HTMLElement>(
      '[data-slot="sidebar-footer"]',
    )!
    await expect(
      within(header).getAllByRole("button")[0],
    ).toHaveAccessibleName("Open compact navigation")
    const collapsedTrigger = canvas.getByRole("button", {
      name: "Open compact navigation",
    })
    await expect(within(collapsedTrigger).getByText("N")).toBeVisible()
    const collapsedTriggerRect = collapsedTrigger.getBoundingClientRect()
    await expect(collapsedTrigger.getBoundingClientRect().left).toBeCloseTo(
      header.getBoundingClientRect().left + 8,
      0,
    )
    await expect(footer.getBoundingClientRect().bottom).toBeCloseTo(
      compactSidebar.getBoundingClientRect().bottom,
      0,
    )
    const collapsedNewChat = canvas.getByRole("button", { name: "New chat" })
    await expect(collapsedNewChat).toBeVisible()
    await expectChatComposeIcon(collapsedNewChat)
    await expect(
      canvas.getByRole("button", { name: "Nessa User" }),
    ).toBeVisible()
    const projectsLink = canvas.getByRole("link", { name: "Projects" })
    await expect(projectsLink).toBeVisible()
    await expect(projectsLink.querySelector('[aria-hidden="true"]')).toBeVisible()
    const sidebar = canvas.getByLabelText("Compact navigation")
    const sidebarInner = sidebar.querySelector<HTMLElement>(
      '[data-slot="sidebar-inner"]',
    )!
    await expect(sidebar.getBoundingClientRect().width).toBe(56)
    await expect(sidebarInner.getBoundingClientRect().width).toBe(56)

    for (const item of [
      canvas.getByRole("button", { name: "New chat" }),
      projectsLink,
      collapsedTrigger,
      canvas.getByRole("button", { name: "Nessa User" }),
    ]) {
      await expect(item.getBoundingClientRect().width).toBe(40)
      await expect(item.getBoundingClientRect().height).toBe(40)
    }

    await userEvent.click(collapsedTrigger)
    const expandedNewChat = canvas.getByRole("button", { name: "New chat" })
    const expandedTrigger = canvas.getByRole("button", {
      name: "Close compact navigation",
    })
    await expect(compactSidebar).toHaveAttribute(
      "data-state",
      "expanded",
    )
    await expectNucleoIcon(expandedTrigger, "sidebar-left", 2)
    await expect(within(expandedTrigger).getByText("Nessa")).toBeVisible()
    await expect(expandedNewChat.getBoundingClientRect().width).toBeGreaterThan(40)
    await expect(
      expandedNewChat.querySelector('[data-slot="sidebar-menu-item-label"]'),
    ).toBeVisible()
    await expect(expandedTrigger.getBoundingClientRect().left).toBeCloseTo(
      collapsedTriggerRect.left,
      0,
    )
    await expect(expandedTrigger.getBoundingClientRect().top).toBeCloseTo(
      collapsedTriggerRect.top,
      0,
    )
    await expect(footer.getBoundingClientRect().bottom).toBeCloseTo(
      compactSidebar.getBoundingClientRect().bottom,
      0,
    )
    await userEvent.click(expandedTrigger)
    await expect(compactSidebar).toHaveAttribute(
      "data-state",
      "collapsed",
    )
    await expect(within(collapsedTrigger).getByText("N")).toBeVisible()
  },
}

export const MobileIconCollapsed: Story = {
  parameters: {
    ...storyDocumentation(exampleDescriptions.MobileIconCollapsed),
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  render: () => <IconCollapsedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const compactTrigger = canvas.getByRole("button", {
      name: "Open compact navigation",
    })
    await expect(within(compactTrigger).getByText("N")).toBeVisible()
    const compactTriggerRect = compactTrigger.getBoundingClientRect()
    await userEvent.click(compactTrigger)
    await expect(
      within(document.body).getByRole("dialog", { name: "Compact navigation" }),
    ).toBeVisible()
    const dialog = within(document.body).getByRole("dialog", {
      name: "Compact navigation",
    })
    const closeTrigger = within(dialog).getByRole("button", {
      name: "Close compact navigation",
    })
    await expectNucleoIcon(closeTrigger, "sidebar-left", 2)
    await expect(within(closeTrigger).getByText("Nessa")).toBeVisible()
    await expect(closeTrigger.getBoundingClientRect().left).toBeCloseTo(
      compactTriggerRect.left,
      0,
    )
    await expect(closeTrigger.getBoundingClientRect().top).toBeCloseTo(
      compactTriggerRect.top,
      0,
    )
    const mobileNewChat = within(document.body).getByRole("button", {
      name: "New chat",
    })
    await expect(mobileNewChat.getBoundingClientRect().width).toBeGreaterThan(40)
    await expectChatComposeIcon(mobileNewChat)
    await expect(
      mobileNewChat.querySelector('[data-slot="sidebar-menu-item-label"]'),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
    const remountedTrigger = await canvas.findByRole("button", {
      name: "Open compact navigation",
    })
    await expect(remountedTrigger).not.toBe(compactTrigger)
    await expect(remountedTrigger).toHaveFocus()
    await expect(within(remountedTrigger).getByText("N")).toBeVisible()

    const workspaceAction = canvas.getByRole("button", { name: "Workspace action" })
    workspaceAction.focus()
    await userEvent.keyboard("{Control>}b{/Control}")
    await expect(
      within(document.body).getByRole("dialog", { name: "Compact navigation" }),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await expect(workspaceAction).toHaveFocus()
  },
}

export const NonCollapsible: Story = {
  parameters: storyDocumentation(exampleDescriptions.NonCollapsible),
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="none" aria-label="Persistent navigation">
        <SidebarHeader>Nessa</SidebarHeader>
      </Sidebar>
      <SidebarInset />
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText("Persistent navigation"),
    ).toHaveAttribute("data-state", "expanded")
  },
}

export const MobileOverlay: Story = {
  parameters: {
    ...storyDocumentation(exampleDescriptions.MobileOverlay),
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <MobileOverlayDemo />
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Open navigation" })
    await expect(within(trigger).getByText("N")).toBeVisible()
    const triggerRect = trigger.getBoundingClientRect()
    await expect(
      canvasElement.querySelector("main")!.getBoundingClientRect().width,
    ).toBe(window.innerWidth)
    await userEvent.click(trigger)

    const dialog = within(document.body).getByRole("dialog", {
      name: "Mobile navigation",
    })
    await expect(dialog).toBeVisible()
    await expect(dialog.getBoundingClientRect().width).toBe(272)
    const closeTrigger = within(dialog).getByRole("button", {
      name: "Close navigation",
    })
    await expect(within(closeTrigger).getByText("Nessa")).toBeVisible()
    await expectNucleoIcon(closeTrigger, "sidebar-left", 2)
    await expect(closeTrigger.getBoundingClientRect().left).toBeCloseTo(
      triggerRect.left,
      0,
    )
    await expect(closeTrigger.getBoundingClientRect().top).toBeCloseTo(
      triggerRect.top,
      0,
    )
    await expect(
      within(document.body).queryByRole("button", { name: "Background action" }),
    ).not.toBeInTheDocument()
    await userEvent.tab()
    await expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await userEvent.keyboard("{Escape}")
    await expect(dialog).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()

    canvasElement.setAttribute("dir", "rtl")
    const rtlTriggerRect = trigger.getBoundingClientRect()
    await userEvent.click(trigger)

    const rtlDialog = within(document.body).getByRole("dialog", {
      name: "Mobile navigation",
    })
    const rtlCloseTrigger = within(rtlDialog).getByRole("button", {
      name: "Close navigation",
    })
    await expect(
      Math.abs(
        rtlCloseTrigger.getBoundingClientRect().left - rtlTriggerRect.left,
      ),
    ).toBeLessThanOrEqual(1)
    await expect(rtlCloseTrigger.getBoundingClientRect().top).toBeCloseTo(
      rtlTriggerRect.top,
      0,
    )

    await userEvent.keyboard("{Escape}")
    await expect(rtlDialog).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()
    canvasElement.removeAttribute("dir")
  },
}

export const Stress500Rows: Story = {
  parameters: storyDocumentation(exampleDescriptions.Stress500Rows),
  render: () => <SidebarStressTelemetry />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rows = canvas.getAllByRole("button", { name: /^Stress chat/ })
    const telemetry = canvas.getByRole("status", {
      name: "React profiler telemetry",
    })

    const expectFiniteTiming = async (attribute: string) => {
      const value = Number.parseFloat(telemetry.getAttribute(attribute) ?? "")
      await expect(Number.isFinite(value)).toBe(true)
      await expect(value).toBeGreaterThanOrEqual(0)
    }

    await expectSidebarWorkspacePalette(canvasElement)
    await expect(rows).toHaveLength(500)
    await expect(rows[0]).toBeVisible()
    await expect(rows[0]!.querySelector("svg")).toBeNull()
    await expectFiniteTiming("data-mount-commit-duration")

    const lastRow = rows.at(-1)!
    lastRow.scrollIntoView({ block: "center" })
    await expect(lastRow).toBeVisible()
    await userEvent.click(lastRow)
    await expect(lastRow).toHaveAttribute("data-active", "true")
    await expect(canvas.getByText("Stress chat 500", { selector: "p" })).toBeVisible()
    await expectFiniteTiming("data-selection-commit-duration")

    await userEvent.click(canvas.getByRole("button", { name: "Toggle sidebar" }))
    await expectFiniteTiming("data-sidebar-commit-duration")
    await userEvent.keyboard("{Control>}b{/Control}")
    await expect(canvasElement.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "expanded",
    )
  },
}
