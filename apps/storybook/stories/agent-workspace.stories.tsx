import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerFooter,
  ChatComposerInput,
  ChatComposerSubmit,
  Message,
  MessageAvatar,
  MessageBubble,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerViewport,
  MessageThread,
  MessageThreadReplies,
  MessageThreadSummary,
  SectionedListbox,
  Sidebar,
  SidebarCollapsible,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SplitView,
  SplitViewPanel,
  SplitViewSeparator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nessa-ui/react"
import { GitBranch, Hash, Lock, Pin, Plus } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Composites/AgentWorkspace",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A Slack-shaped agent workspace assembled entirely from shipped Nessa primitives, at the scale a real one reaches. The left rail stays bounded — sections and channels, plus at most a few pinned sessions per channel — because a rail that lists every session runs out of vertical space the moment you spin up more agents. Every session in a channel instead lives in a channel-scoped second column: Tabs as drawers across the top, a SectionedListbox grouping what the drawer leaves under sticky status headers, and the selected session's thread beside it behind a draggable SplitView separator. Nothing here is a new component.",
      },
    },
  },
} satisfies Meta

export default meta

type SessionStatus = "running" | "archived"

interface AgentSession {
  id: string
  channelId: string
  label: string
  worktree: string
  agent: string
  updated: string
  status: SessionStatus
  pinned?: boolean
}

const channels = [
  { id: "eng-sidebar", name: "eng-sidebar" },
  { id: "eng-tabs", name: "eng-tabs" },
  { id: "release", name: "release", private: true },
] as const

const sessions: AgentSession[] = [
  {
    id: "s1",
    channelId: "eng-sidebar",
    label: "Nested guides + collapsible menu",
    worktree: "sidebar-nested-components",
    agent: "Opus 5",
    updated: "2m",
    status: "running",
    pinned: true,
  },
  {
    id: "s2",
    channelId: "eng-sidebar",
    label: "Trailing alignment audit",
    worktree: "trailing-band-fix",
    agent: "Sonnet 5",
    updated: "9m",
    status: "running",
    pinned: true,
  },
  {
    id: "s3",
    channelId: "eng-sidebar",
    label: "RTL sweep for the guide rail",
    worktree: "guides-rtl",
    agent: "Haiku 4.5",
    updated: "24m",
    status: "running",
  },
  {
    id: "s4",
    channelId: "eng-sidebar",
    label: "Focus ledger reconciliation",
    worktree: "focus-ledger",
    agent: "Opus 5",
    updated: "1h",
    status: "archived",
  },
  {
    id: "s5",
    channelId: "eng-sidebar",
    label: "Drop stale sync commit",
    worktree: "rebase-mainline",
    agent: "Sonnet 5",
    updated: "3h",
    status: "archived",
  },
  {
    id: "s6",
    channelId: "eng-tabs",
    label: "Port tablist to Radix",
    worktree: "tabs-primitive",
    agent: "Opus 5",
    updated: "6m",
    status: "running",
    pinned: true,
  },
  {
    id: "s7",
    channelId: "eng-tabs",
    label: "Segmented vs tabs audit",
    worktree: "tabs-audit",
    agent: "Haiku 4.5",
    updated: "2h",
    status: "archived",
  },
  {
    id: "s8",
    channelId: "release",
    label: "Cut 0.4.0",
    worktree: "release-0-4-0",
    agent: "Opus 5",
    updated: "18m",
    status: "running",
    pinned: true,
  },
]

const statusOrder: SessionStatus[] = ["running", "archived"]
const statusLabels: Record<SessionStatus, string> = {
  running: "Running",
  archived: "Archived",
}

function ChannelRail({
  activeChannelId,
  onSelectChannel,
  openChannelId,
  onOpenChannel,
  onSelectSession,
}: {
  activeChannelId: string
  onSelectChannel: (id: string) => void
  openChannelId: string | null
  onOpenChannel: (id: string | null) => void
  onSelectSession: (id: string) => void
}) {
  return (
    <Sidebar
      collapsible={SidebarCollapsible.None}
      // The sidebar is `h-svh` by default; inside a fixed-height demo frame
      // it takes the frame's height instead.
      className="h-full border-e border-sidebar-border"
      aria-label="Workspace navigation"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem description={`${sessions.length} sessions running`}>
            Nessa Labs
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Channels</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {channels.map((channel) => {
                // Only pinned sessions are allowed into the rail. The rail's
                // height is the scarce resource, so what it shows has to stay
                // bounded no matter how many sessions a channel accumulates.
                const pinned = sessions.filter(
                  (session) => session.channelId === channel.id && session.pinned,
                )
                const total = sessions.filter(
                  (session) => session.channelId === channel.id,
                ).length

                return (
                  <SidebarMenuItem
                    key={channel.id}
                    collapsible="chevron"
                    collapsibleLabel={`Toggle pinned sessions in ${channel.name}`}
                    open={openChannelId === channel.id}
                    onOpenChange={(next) =>
                      onOpenChannel(next ? channel.id : null)
                    }
                    icon={"private" in channel && channel.private ? <Lock /> : <Hash />}
                    isActive={channel.id === activeChannelId}
                    aria-current={
                      channel.id === activeChannelId ? "page" : undefined
                    }
                    onClick={() => onSelectChannel(channel.id)}
                    badge={String(total)}
                    submenu={
                      <SidebarMenu nested guides>
                        {pinned.map((session) => (
                          // Child rows use the same `icon` slot as any other
                          // row — here the worktree the session runs in.
                          <SidebarMenuItem
                            key={session.id}
                            size="sm"
                            icon={<GitBranch />}
                            tooltip={`${session.label} · ${session.worktree}`}
                            onClick={() => {
                              onSelectChannel(session.channelId)
                              onSelectSession(session.id)
                            }}
                          >
                            {session.label}
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    }
                  >
                    {channel.name}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function SessionRow({
  session,
  selected,
}: {
  session: AgentSession
  selected: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cnLabel(selected)}
          data-testid={`session-label-${session.id}`}
        >
          {session.label}
        </span>
        <span className="ms-auto shrink-0 nessa-text-2 text-muted-foreground">
          {session.updated}
        </span>
      </div>
      <span className="flex min-w-0 items-center gap-1.5 nessa-text-2 text-muted-foreground">
        <GitBranch aria-hidden="true" className="size-3 shrink-0" />
        <span className="truncate">{session.worktree}</span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">{session.agent}</span>
      </span>
    </div>
  )
}

function cnLabel(selected: boolean) {
  return selected
    ? "min-w-0 truncate nessa-text-4 font-medium"
    : "min-w-0 truncate nessa-text-4"
}

function SessionThread({ session }: { session: AgentSession }) {
  const [repliesOpen, setRepliesOpen] = React.useState(false)

  // Reset the disclosure whenever a different session opens, so the pane
  // never shows the previous session's expansion state.
  React.useEffect(() => {
    setRepliesOpen(false)
  }, [session.id])

  return (
    <MessageScroller className="h-full">
      <MessageScrollerViewport>
        <MessageScrollerContent className="gap-4 p-4">
          <Message from="assistant">
            <MessageAvatar fallback="OP" alt={session.agent} />
            <MessageContent>
              <MessageHeader>{session.agent} · 9:12</MessageHeader>
              <MessageBubble variant="plain">
                Working in <code>{session.worktree}</code> on {session.label}.
              </MessageBubble>
            </MessageContent>
          </Message>
          <MessageThread>
            <Message from="user" align="start">
              <MessageAvatar fallback="SP" alt="Saurav" />
              <MessageContent>
                <MessageHeader>Saurav · 9:20</MessageHeader>
                <MessageBubble variant="plain">
                  How is this one going?
                </MessageBubble>
              </MessageContent>
            </Message>
            <MessageThreadSummary
              aria-expanded={repliesOpen}
              onClick={() => setRepliesOpen((current) => !current)}
              label={repliesOpen ? "Hide 1 reply" : "1 reply"}
              meta={repliesOpen ? undefined : `Last reply ${session.updated} ago`}
              action={repliesOpen ? null : "View thread"}
            >
              <MessageAvatar fallback="OP" alt={session.agent} />
            </MessageThreadSummary>
            {repliesOpen && (
              <MessageThreadReplies>
                <Message from="assistant">
                  <MessageAvatar fallback="OP" alt={session.agent} />
                  <MessageContent>
                    <MessageHeader>{session.agent} · 9:21</MessageHeader>
                    <MessageBubble variant="plain">
                      {statusLabels[session.status]} — last update{" "}
                      {session.updated} ago.
                    </MessageBubble>
                  </MessageContent>
                </Message>
              </MessageThreadReplies>
            )}
          </MessageThread>
        </MessageScrollerContent>
      </MessageScrollerViewport>
    </MessageScroller>
  )
}

function AgentWorkspaceDemo() {
  const [activeChannelId, setActiveChannelId] = React.useState("eng-sidebar")
  const [openChannelId, setOpenChannelId] = React.useState<string | null>(
    "eng-sidebar",
  )
  const [drawer, setDrawer] = React.useState<"all" | SessionStatus>("all")
  const [selectedSessionId, setSelectedSessionId] = React.useState("s1")
  const [draft, setDraft] = React.useState("")

  // Changing channel returns to the full drawer: the drawer that was open
  // may hold nothing in the new channel, and landing on an empty list reads
  // as a broken channel rather than an empty filter.
  const selectChannel = React.useCallback((id: string) => {
    setActiveChannelId(id)
    setDrawer("all")
  }, [])

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) ?? channels[0]
  const channelSessions = sessions.filter(
    (session) => session.channelId === activeChannelId,
  )
  const drawerSessions =
    drawer === "all"
      ? channelSessions
      : channelSessions.filter((session) => session.status === drawer)

  // Sticky status headers carry the grouping the rail needs once a channel
  // holds more sessions than fit on screen; empty groups are dropped so the
  // headers never outnumber the rows.
  const listSections = statusOrder
    .map((status) => ({
      id: status,
      label: statusLabels[status],
      items: drawerSessions.filter((session) => session.status === status),
    }))
    .filter((section) => section.items.length > 0)

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0]
  const countFor = (status: SessionStatus) =>
    channelSessions.filter((session) => session.status === status).length

  return (
    <SidebarProvider className="h-[34rem] min-h-[34rem]">
      <ChannelRail
        activeChannelId={activeChannelId}
        onSelectChannel={selectChannel}
        openChannelId={openChannelId}
        onOpenChannel={setOpenChannelId}
        onSelectSession={setSelectedSessionId}
      />

      <SidebarInset className="min-w-0">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Hash aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 className="nessa-text-5 font-medium">{activeChannel.name}</h2>
          <span className="nessa-text-2 text-muted-foreground">
            {channelSessions.length} agent sessions
          </span>
        </header>

        <SplitView className="min-h-0 flex-1">
          <SplitViewPanel id="workspace-sessions" defaultSize={38} minSize={24}>
            <div className="flex h-full min-h-0 flex-col border-e border-border">
              {/* The drawers scope the rail, so the left sidebar never has to
                  grow a row per session. */}
              <Tabs
                value={drawer}
                onValueChange={(next) =>
                  setDrawer(next as "all" | SessionStatus)
                }
                className="min-h-0 flex-1 gap-0"
              >
                <TabsList
                  aria-label="Session drawers"
                  className="shrink-0 px-3"
                >
                  <TabsTrigger
                    value="all"
                    badge={String(channelSessions.length)}
                  >
                    All
                  </TabsTrigger>
                  {statusOrder.map((status) => (
                    <TabsTrigger
                      key={status}
                      value={status}
                      badge={String(countFor(status))}
                    >
                      {statusLabels[status]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {/* Each drawer is a real panel, so a tab controls something
                    that exists. One shared region behind a tablist would
                    leave every tab's `aria-controls` dangling — that shape is
                    a filter, and a filter is SegmentedControl's job. */}
                {(["all", ...statusOrder] as const).map((key) => (
                  <TabsContent
                    key={key}
                    value={key}
                    className="min-h-0 flex-1 overflow-hidden p-2"
                  >
                    <SectionedListbox
                      listLabel={`Agent sessions in ${activeChannel.name}`}
                      sections={listSections}
                      getItemId={(session) => session.id}
                      value={selectedSessionId}
                      onValueChange={(value) => setSelectedSessionId(value)}
                      emptyMessage="No sessions in this drawer."
                      className="h-full"
                      // The listbox dresses for a popover by default. Inline
                      // in a rail it should read like the sidebar rows across
                      // the divider: same inset, radius and accent wash.
                      sectionLabelClassName="bg-background px-2.5 py-1.5 nessa-text-2 font-medium text-muted-foreground"
                      optionClassName="min-h-9 rounded-lg px-2.5 py-1.5 hover:bg-accent data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      renderItem={(session, state) => (
                        <SessionRow
                          session={session}
                          selected={state.selected}
                        />
                      )}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </SplitViewPanel>

          <SplitViewSeparator />

          <SplitViewPanel id="workspace-thread" defaultSize={62} minSize={35}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
                {selectedSession.pinned ? (
                  <Pin
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                ) : null}
                <h3 className="min-w-0 truncate nessa-text-4 font-medium">
                  {selectedSession.label}
                </h3>
                <span className="ms-auto shrink-0 nessa-text-2 text-muted-foreground">
                  {selectedSession.worktree}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <SessionThread session={selectedSession} />
              </div>

              <div className="shrink-0 p-3">
                <ChatComposer
                  onSubmit={(event) => {
                    event.preventDefault()
                    setDraft("")
                  }}
                >
                  <ChatComposerInput
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={`Reply to ${selectedSession.agent}`}
                  />
                  <ChatComposerFooter>
                    <ChatComposerActions>
                      <ChatComposerAction aria-label="Add attachment">
                        <Plus aria-hidden="true" />
                      </ChatComposerAction>
                    </ChatComposerActions>
                    <ChatComposerActions className="justify-end">
                      <ChatComposerSubmit
                        disabled={draft.trim().length === 0}
                      />
                    </ChatComposerActions>
                  </ChatComposerFooter>
                </ChatComposer>
              </div>
            </div>
          </SplitViewPanel>
        </SplitView>
      </SidebarInset>
    </SidebarProvider>
  )
}

export const SlackStyleWorkspace: StoryObj = {
  parameters: storyDocumentation(
    "Three columns, each holding what it can hold at scale. The left rail keeps only sections, channels and each channel's pinned sessions, so its height stays bounded however many agents are running — the channel's full session list lives in its own column, scoped by Tabs drawers and grouped under the SectionedListbox's sticky status headers with roving focus across group boundaries. A SplitView separator lets the rail and the thread trade width. Selecting a session, from either the pinned rail or the list, swaps the thread beside it.",
  ),
  render: () => <AgentWorkspaceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The left rail lists only pinned sessions, not every session in the
    // channel — that is what keeps its height bounded.
    const nav = canvas.getByRole("complementary", {
      name: "Workspace navigation",
    })
    const navScope = within(nav)
    await expect(
      navScope.getByRole("button", { name: /^Nested guides \+ collapsible menu/ }),
    ).toBeVisible()
    // Every session, pinned or not, is in the channel's own column. Each
    // drawer is its own panel, so the list is re-queried after every switch
    // rather than held across one.
    const listIn = (channel: string) =>
      canvas.getByRole("listbox", { name: `Agent sessions in ${channel}` })
    await expect(
      within(listIn("eng-sidebar")).getAllByRole("option"),
    ).toHaveLength(5)
    // Sticky status headers group them.
    await expect(listIn("eng-sidebar")).toHaveTextContent("Running")
    await expect(listIn("eng-sidebar")).toHaveTextContent("Archived")

    // The drawers scope the list without touching the left rail.
    await userEvent.click(canvas.getByRole("tab", { name: /Archived/ }))
    await expect(
      within(listIn("eng-sidebar")).getAllByRole("option"),
    ).toHaveLength(2)
    await expect(listIn("eng-sidebar")).not.toHaveTextContent(
      "RTL sweep for the guide rail",
    )
    await expect(
      navScope.queryByRole("button", { name: /^RTL sweep for the guide rail/ }),
    ).toBeNull()

    // Selecting a session swaps the thread beside it.
    await userEvent.click(
      within(listIn("eng-sidebar")).getByRole("option", {
        name: /Focus ledger reconciliation/,
      }),
    )
    await expect(
      canvas.getByRole("heading", { name: "Focus ledger reconciliation" }),
    ).toBeVisible()

    // A pinned row in the left rail selects the same way.
    await userEvent.click(
      navScope.getByRole("button", { name: /^Nested guides \+ collapsible menu/ }),
    )
    await expect(
      canvas.getByRole("heading", { name: "Nested guides + collapsible menu" }),
    ).toBeVisible()

    // Switching channel rescopes the column, and the drawer counts with it.
    await userEvent.click(navScope.getByRole("button", { name: "release" }))
    await expect(
      canvas.getByRole("listbox", { name: "Agent sessions in release" }),
    ).toBeInTheDocument()
  },
}
