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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nessa-ui/react"
import { GitBranch, Hash, Lock, Plus } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Composites/AgentWorkspace",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A Slack-shaped workspace assembled entirely from shipped Nessa primitives, to show the pattern is reachable without a bespoke layout: sections and channels in the Sidebar, a channel's agent sessions as a collapsible nested menu with per-session worktree icons, Tabs as the drawers that reorganize those sessions, and the Message thread kit plus ChatComposer as the channel body. Nothing here is a new component — it is Sidebar, Tabs, Message and ChatComposer composed.",
      },
    },
  },
} satisfies Meta

export default meta

interface SessionSummary {
  id: string
  label: string
  worktree: string
  drawer: "running" | "review" | "archived"
}

const channels: {
  id: string
  name: string
  private?: boolean
  sessions: SessionSummary[]
}[] = [
  {
    id: "eng-sidebar",
    name: "eng-sidebar",
    sessions: [
      {
        id: "s1",
        label: "Nested guides + collapsible menu",
        worktree: "sidebar-nested-components",
        drawer: "running",
      },
      {
        id: "s2",
        label: "Trailing alignment audit",
        worktree: "trailing-band-fix",
        drawer: "review",
      },
    ],
  },
  {
    id: "eng-tabs",
    name: "eng-tabs",
    sessions: [
      {
        id: "s3",
        label: "Port tablist to Radix",
        worktree: "tabs-primitive",
        drawer: "running",
      },
      {
        id: "s4",
        label: "Segmented vs tabs audit",
        worktree: "tabs-audit",
        drawer: "archived",
      },
    ],
  },
  {
    id: "release",
    name: "release",
    private: true,
    sessions: [
      {
        id: "s5",
        label: "Cut 0.4.0",
        worktree: "release-0-4-0",
        drawer: "review",
      },
    ],
  },
]

const drawerLabels = {
  running: "Running",
  review: "Needs review",
  archived: "Archived",
} as const

function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) {
    return (
      <p className="p-4 nessa-text-4 text-muted-foreground">
        No sessions in this drawer.
      </p>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-1 p-2">
      {sessions.map((session) => (
        <li key={session.id}>
          <div className="flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2">
            <GitBranch aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate nessa-text-4">
              {session.label}
            </span>
            <span className="shrink-0 nessa-text-2 text-muted-foreground">
              {session.worktree}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AgentWorkspaceDemo() {
  const [activeChannelId, setActiveChannelId] = React.useState("eng-sidebar")
  const [openChannelId, setOpenChannelId] = React.useState<string | null>(
    "eng-sidebar",
  )
  const [drawer, setDrawer] = React.useState("all")
  const [repliesOpen, setRepliesOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) ?? channels[0]
  const allSessions = channels.flatMap((channel) => channel.sessions)
  const countFor = (key: SessionSummary["drawer"]) =>
    allSessions.filter((session) => session.drawer === key).length

  return (
    <SidebarProvider className="h-[32rem] min-h-[32rem]">
      <Sidebar
        collapsible={SidebarCollapsible.None}
        // The sidebar is `h-svh` by default; inside a fixed-height demo frame
        // it has to take the frame's height instead.
        className="h-full border-e border-sidebar-border"
        aria-label="Workspace navigation"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem description="3 channels · 5 sessions">
              Nessa Labs
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Channels</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {channels.map((channel) => (
                  <SidebarMenuItem
                    key={channel.id}
                    collapsible="chevron"
                    collapsibleLabel={`Toggle ${channel.name} sessions`}
                    open={openChannelId === channel.id}
                    onOpenChange={(next) =>
                      setOpenChannelId(next ? channel.id : null)
                    }
                    icon={channel.private ? <Lock /> : <Hash />}
                    isActive={channel.id === activeChannelId}
                    aria-current={
                      channel.id === activeChannelId ? "page" : undefined
                    }
                    onClick={() => setActiveChannelId(channel.id)}
                    badge={String(channel.sessions.length)}
                    submenu={
                      <SidebarMenu nested guides>
                        {channel.sessions.map((session) => (
                          // Child rows take the same `icon` slot as any other
                          // row — here the worktree each session runs in.
                          <SidebarMenuItem
                            key={session.id}
                            size="sm"
                            icon={<GitBranch />}
                            tooltip={session.label}
                          >
                            {session.label}
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    }
                  >
                    {channel.name}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Hash aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 className="nessa-text-5 font-medium">{activeChannel.name}</h2>
          <span className="nessa-text-2 text-muted-foreground">
            {activeChannel.sessions.length} agent sessions
          </span>
        </header>

        <Tabs
          value={drawer}
          onValueChange={setDrawer}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList aria-label="Session drawers" className="px-4">
            <TabsTrigger value="all" badge={String(allSessions.length)}>
              All
            </TabsTrigger>
            {(
              Object.keys(drawerLabels) as (keyof typeof drawerLabels)[]
            ).map((key) => (
              <TabsTrigger key={key} value={key} badge={String(countFor(key))}>
                {drawerLabels[key]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="min-h-0 overflow-hidden">
            <MessageScroller className="h-full">
              <MessageScrollerViewport>
                <MessageScrollerContent className="gap-4 p-4">
                  <Message from="assistant">
                    <MessageAvatar fallback="OP" alt="Opus 5" />
                    <MessageContent>
                      <MessageHeader>Opus 5 · 9:12</MessageHeader>
                      <MessageBubble variant="plain">
                        Spine now runs the full row height, so the branch
                        guides read as one line.
                      </MessageBubble>
                    </MessageContent>
                  </Message>
                  <MessageThread>
                    <Message from="user" align="start">
                      <MessageAvatar fallback="SP" alt="Saurav" />
                      <MessageContent>
                        <MessageHeader>Saurav · 9:20</MessageHeader>
                        <MessageBubble variant="plain">
                          Can the child rows carry worktree icons too?
                        </MessageBubble>
                      </MessageContent>
                    </Message>
                    <MessageThreadSummary
                      aria-expanded={repliesOpen}
                      onClick={() => setRepliesOpen((current) => !current)}
                      label={repliesOpen ? "Hide 1 reply" : "1 reply"}
                      meta={repliesOpen ? undefined : "Last reply at 9:21"}
                      action={repliesOpen ? null : "View thread"}
                    >
                      <MessageAvatar fallback="OP" alt="Opus 5" />
                    </MessageThreadSummary>
                    {repliesOpen && (
                      <MessageThreadReplies>
                        <Message from="assistant">
                          <MessageAvatar fallback="OP" alt="Opus 5" />
                          <MessageContent>
                            <MessageHeader>Opus 5 · 9:21</MessageHeader>
                            <MessageBubble variant="plain">
                              They already can — `icon` is on every row,
                              nested or not.
                            </MessageBubble>
                          </MessageContent>
                        </Message>
                      </MessageThreadReplies>
                    )}
                  </MessageThread>
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
          </TabsContent>

          {(Object.keys(drawerLabels) as (keyof typeof drawerLabels)[]).map(
            (key) => (
              <TabsContent
                key={key}
                value={key}
                className="min-h-0 overflow-auto"
              >
                <SessionList
                  sessions={allSessions.filter(
                    (session) => session.drawer === key,
                  )}
                />
              </TabsContent>
            ),
          )}
        </Tabs>

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
              placeholder={`Message #${activeChannel.name}`}
            />
            <ChatComposerFooter>
              <ChatComposerActions>
                <ChatComposerAction aria-label="Add attachment">
                  <Plus aria-hidden="true" />
                </ChatComposerAction>
              </ChatComposerActions>
              <ChatComposerActions className="justify-end">
                <ChatComposerSubmit disabled={draft.trim().length === 0} />
              </ChatComposerActions>
            </ChatComposerFooter>
          </ChatComposer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export const SlackStyleWorkspace: StoryObj = {
  parameters: storyDocumentation(
    "Sections and channels live in the Sidebar; each channel discloses its agent sessions as a nested menu with branch guides, and every child row carries the worktree it runs in through the same `icon` slot a top-level row uses. The tab strip above the channel body is a real tablist that reorganizes those sessions into drawers, and the body itself is the Message thread kit over a MessageScroller with a ChatComposer beneath.",
  ),
  render: () => <AgentWorkspaceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Channels disclose their sessions, and each child row has its worktree
    // icon — the icon slot works at any depth.
    const sessionRow = canvas.getByRole("button", {
      name: "Nested guides + collapsible menu",
    })
    await expect(sessionRow.querySelector("svg")).not.toBeNull()

    // The channel row still navigates while its own chevron discloses.
    const toggle = canvas.getByRole("button", {
      name: "Toggle eng-tabs sessions",
    })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(
      canvas.getByRole("button", { name: "Port tablist to Radix" }),
    ).toBeVisible()

    // The drawers are a real tablist over the same sessions.
    const drawers = canvas.getByRole("tablist", { name: "Session drawers" })
    await expect(drawers).toBeInTheDocument()
    await userEvent.click(canvas.getByRole("tab", { name: /Needs review/ }))
    const panel = canvas.getByRole("tabpanel")
    await expect(panel).toHaveTextContent("Trailing alignment audit")
    await expect(panel).toHaveTextContent("Cut 0.4.0")
    await expect(panel).not.toHaveTextContent("Port tablist to Radix")

    // The channel body threads like Slack.
    await userEvent.click(canvas.getByRole("tab", { name: /All/ }))
    const summary = canvas.getByRole("button", { name: /1 reply/ })
    await expect(summary).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(summary)
    await expect(
      canvas.getByText(/icon` is on every row/),
    ).toBeVisible()
  },
}
