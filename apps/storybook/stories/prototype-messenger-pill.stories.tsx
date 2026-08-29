// PROTOTYPE — throwaway design exploration, not a catalog component.
// Question: inside the floating iMessage-style chat pill, how should the
// transcript surface subagents, and what does "drilling into" one feel like?
// Built on the real iMessage kit (ChatTabs, ChatBubbles, PillComposer) pulled
// forward from main, with the playground's reply capabilities: right-click a
// bubble for the tapback row and Reply, replies quote their target, and reply
// mode frosts everything outside the focused thread (Escape leaves it).
// Three structurally different answers, one story each:
//   TabDrillIn  — a subagent opens as an avatar tab in the ChatTabs strip;
//                 the Nessa tab (or its close ×) returns to the parent chat.
//   StackedCard — the subagent transcript slides over the parent as a stacked
//                 card with an iOS-style "‹ Nessa" back row; no extra tabs,
//                 the header avatar becomes a group painting.
//   InlineThread — no navigation at all: subagent turns expand inline under
//                 the agent message, Slack-thread style.
import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  ChatBubble,
  ChatComposerAction,
  ChatComposerInput,
  ChatMessage,
  ChatMessageQuote,
  ChatMessageReceipt,
  chatReactionOptions,
  ChatTabs,
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport,
  PillComposer,
  PillComposerRow,
  RandomAvatar,
} from "@nessa-ui/react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Prototypes/MessengerPill",
  parameters: {
    docs: {
      description: {
        component:
          "PROTOTYPE — three takes on subagent drill-in inside the floating messenger pill, composed from the real iMessage kit (ChatTabs, ChatBubbles, PillComposer) with the playground's tapback and reply interactions. Throwaway; the winning structure gets rebuilt properly.",
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// --- demo data ---------------------------------------------------------

interface Msg {
  id: number
  role: "user" | "agent"
  text: string
  /** Ids of subagents this agent turn spawned, rendered as chips. */
  spawned?: string[]
  reaction?: string
  replyTo?: string
  replyToId?: number
}

interface SubagentRecord {
  id: string
  name: string
  task: string
  status: "running" | "done"
  turns: Msg[]
}

const subagents: Record<string, SubagentRecord> = {
  explorer: {
    id: "explorer",
    name: "Explorer",
    task: "Map the composer call sites",
    status: "done",
    turns: [
      {
        id: 101,
        role: "user",
        text: "Find every place the ChatComposer primitives are composed into a full surface, and note which slots each one uses.",
      },
      {
        id: 102,
        role: "agent",
        text: "Nine call sites. The app shell panes and the message edit-in-place both use the compact size; only the catalog stories use attachment rows. Full table in the report.",
      },
      {
        id: 103,
        role: "agent",
        text: "One surprise: composer-queue re-implements the footer row instead of using ChatComposerFooter — worth folding back.",
      },
    ],
  },
  reviewer: {
    id: "reviewer",
    name: "Reviewer",
    task: "Review the transcript diff",
    status: "running",
    turns: [
      {
        id: 201,
        role: "user",
        text: "Review the transcript virtualization diff for correctness and accessibility regressions.",
      },
      {
        id: 202,
        role: "agent",
        text: "Two findings so far: the log role moved off the scrolling element, and the pinned-state check reads layout in a loop. Still reading the resize path…",
      },
    ],
  },
}

const mainTurns: Msg[] = [
  {
    id: 1,
    role: "user",
    text: "Where do we compose the chat composer today, and is the transcript diff safe to land?",
  },
  {
    id: 2,
    role: "agent",
    text: "I'll split that: one agent maps the composer call sites while another reviews the diff.",
    spawned: ["explorer", "reviewer"],
  },
  {
    id: 3,
    role: "agent",
    text: "Explorer is back — nine call sites, one of them re-implements the footer. Reviewer has two findings so far and is still going.",
  },
  { id: 4, role: "user", text: "Show me the reviewer's findings as they land." },
]

// --- shared pieces -----------------------------------------------------

function PillFrame({
  frameRef,
  children,
}: {
  frameRef?: (element: HTMLDivElement | null) => void
  children: React.ReactNode
}) {
  return (
    <div
      ref={frameRef}
      className="flex h-[560px] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-background p-2 shadow-xl"
    >
      {children}
    </div>
  )
}

function SubagentChip({
  sub,
  onClick,
}: {
  sub: SubagentRecord
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-start shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RandomAvatar
        seed={sub.id}
        busy={sub.status === "running"}
        className="size-7"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{sub.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {sub.status === "running" ? "Running · " : "Done · "}
          {sub.task}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  )
}

/**
 * One transcript bubble with the playground's interactions: right-click /
 * long-press raises the tapback row and Reply, and replies show their quote.
 */
function DemoBubble({
  message,
  delivered,
  dimmed,
  threadFocused,
  onReact,
  onReplyCommit,
  menuBoundary,
}: {
  message: Msg
  delivered: boolean
  dimmed: boolean | "soft"
  threadFocused: boolean
  onReact: (emoji: string) => void
  onReplyCommit: () => void
  menuBoundary: Element | null
}) {
  // Reply commits after the menu closes: Radix's close-autofocus would
  // otherwise return focus to the bubble and undo the composer focus.
  const replyChosenRef = React.useRef(false)
  return (
    <ChatMessage
      tone={message.role === "user" ? "sent" : "received"}
      dimmed={dimmed}
      threadFocused={threadFocused}
    >
      {message.replyTo ? (
        <ChatMessageQuote>{message.replyTo}</ChatMessageQuote>
      ) : null}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <ChatBubble
            aria-label={`Reply to: ${message.text}`}
            title="Right-click to reply or react"
            tabIndex={0}
            reaction={message.reaction}
          >
            {message.text}
          </ChatBubble>
        </ContextMenuTrigger>
        <ContextMenuContent
          aria-label="Message actions"
          className="min-w-0 w-fit"
          collisionBoundary={menuBoundary ?? undefined}
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            if (!replyChosenRef.current) return
            replyChosenRef.current = false
            event.preventDefault()
            onReplyCommit()
          }}
        >
          {/* Each tapback is its own menu item, so arrow keys reach every
              emoji and Enter applies it. */}
          <div className="flex max-w-60 items-center gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chatReactionOptions.map((option) => (
              <ContextMenuItem
                key={option.emoji}
                asChild
                onSelect={() => onReact(option.emoji)}
              >
                <button
                  type="button"
                  aria-label={`React with ${option.label}`}
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 font-sans nessa-text-6 data-[highlighted]:bg-accent",
                    message.reaction === option.emoji &&
                      "bg-(--nessa-chat-accent)",
                  )}
                >
                  {option.emoji}
                </button>
              </ContextMenuItem>
            ))}
          </div>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              replyChosenRef.current = true
            }}
          >
            Reply
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {delivered ? <ChatMessageReceipt>Delivered</ChatMessageReceipt> : null}
    </ChatMessage>
  )
}

/** The catalog's static waveform glyph, borrowed from the PillComposer story. */
function WaveformIcon({ className }: { className?: string }) {
  const bars: [number, number, number, boolean][] = [
    [1.25, 7.5, 3, true],
    [4.25, 3, 12, false],
    [7.25, 5, 8, true],
    [10.25, 2, 14, false],
    [13.25, 5, 8, true],
    [16.25, 7.5, 3, false],
  ]
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      aria-hidden="true"
      className={className}
    >
      {bars.map(([x, y, height, soft]) => (
        <rect
          key={x}
          x={x - 0.75}
          y={y}
          width="1.5"
          height={height}
          rx="0.75"
          fill="currentColor"
          fillOpacity={soft ? 0.4 : 1}
        />
      ))}
    </svg>
  )
}

/**
 * A conversation surface with the playground's reply capabilities: the
 * transcript, reply-mode thread frosting, and the pill composer that quotes
 * the reply target on send. Owns its message state per conversation id.
 */
function useConversation(initial: Record<string, Msg[]>) {
  const [messagesById, setMessagesById] = React.useState(initial)
  const nextId = React.useRef(1000)
  const update = (id: string, recipe: (current: Msg[]) => Msg[]) =>
    setMessagesById((current) => ({
      ...current,
      [id]: recipe(current[id] ?? []),
    }))
  return { messagesById, update, nextId }
}

function ConversationSurface({
  conversationId,
  messages,
  name,
  generating = false,
  renderSpawned,
  lead,
  onUpdate,
  nextId,
}: {
  conversationId: string
  messages: Msg[]
  name: string
  generating?: boolean
  renderSpawned?: (ids: string[]) => React.ReactNode
  lead?: React.ReactNode
  onUpdate: (id: string, recipe: (current: Msg[]) => Msg[]) => void
  nextId: React.MutableRefObject<number>
}) {
  const [draft, setDraft] = React.useState("")
  const [replyTarget, setReplyTarget] = React.useState<Msg | null>(null)
  const [frameElement, setFrameElement] =
    React.useState<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const lastUserId = messages.findLast((entry) => entry.role === "user")?.id

  // While replying, the target's whole thread stays in focus and the rest
  // of the transcript frosts, matching the playground's reply view.
  const threadIds = React.useMemo(() => {
    if (!replyTarget) return null
    const ids = new Set<number>()
    let ancestor: Msg | undefined = replyTarget
    while (ancestor && !ids.has(ancestor.id)) {
      ids.add(ancestor.id)
      const parentId: number | undefined = ancestor.replyToId
      ancestor = messages.find((entry) => entry.id === parentId)
    }
    let grew = true
    while (grew) {
      grew = false
      for (const entry of messages) {
        if (
          entry.replyToId !== undefined &&
          ids.has(entry.replyToId) &&
          !ids.has(entry.id)
        ) {
          ids.add(entry.id)
          grew = true
        }
      }
    }
    return ids
  }, [messages, replyTarget])

  // Escape leaves the reply view from anywhere, not just the input.
  React.useEffect(() => {
    if (!replyTarget) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setReplyTarget(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [replyTarget])

  return (
    <div
      ref={setFrameElement}
      className="flex min-h-0 flex-1 flex-col"
    >
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport className="px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MessageScrollerContent
            aria-label={`${name} conversation`}
            className="gap-2 py-2"
          >
            {lead}
            {messages.map((entry) => (
              <React.Fragment key={entry.id}>
                <DemoBubble
                  message={entry}
                  delivered={entry.id === lastUserId}
                  dimmed={threadIds !== null && !threadIds.has(entry.id)}
                  threadFocused={threadIds !== null && threadIds.has(entry.id)}
                  menuBoundary={frameElement}
                  onReact={(emoji) =>
                    onUpdate(conversationId, (current) =>
                      current.map((message) =>
                        message.id === entry.id
                          ? {
                              ...message,
                              reaction:
                                message.reaction === emoji ? undefined : emoji,
                            }
                          : message,
                      ),
                    )
                  }
                  onReplyCommit={() => {
                    setReplyTarget(entry)
                    inputRef.current?.focus()
                  }}
                />
                {entry.spawned && renderSpawned ? (
                  <div className="me-8 flex flex-col gap-1.5 self-start">
                    {renderSpawned(entry.spawned)}
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
      <PillComposer
        generating={generating}
        onSubmit={(event) => {
          event.preventDefault()
          const text = draft.trim()
          if (!text) return
          onUpdate(conversationId, (current) => [
            ...current,
            {
              id: nextId.current++,
              role: "user",
              text,
              replyTo: replyTarget?.text,
              replyToId: replyTarget?.id,
            },
          ])
          setDraft("")
          setReplyTarget(null)
        }}
        className="shrink-0"
      >
        <PillComposerRow>
          <ChatComposerAction aria-label="Add attachment" title="Add attachment">
            <Plus aria-hidden="true" />
          </ChatComposerAction>
          <ChatComposerInput
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={replyTarget ? "Reply" : `Message ${name}…`}
            aria-label={`Message ${name}`}
            className="self-center"
          />
          <ChatComposerAction aria-label="Start voice input" title="Start voice input">
            <WaveformIcon />
          </ChatComposerAction>
        </PillComposerRow>
      </PillComposer>
    </div>
  )
}

/** A watercolor tab glyph for the ChatTabs strip. */
function TabGlyph({ seed, busy = false }: { seed: string; busy?: boolean }) {
  return <RandomAvatar seed={seed} busy={busy} className="size-4" />
}

const initialConversations: Record<string, Msg[]> = {
  main: mainTurns,
  explorer: subagents.explorer.turns,
  reviewer: subagents.reviewer.turns,
}

// --- Variant A: tab drill-in -------------------------------------------

function TabDrillInExample() {
  // Tabs the user has opened by drilling in, in open order.
  const [openTabs, setOpenTabs] = React.useState<string[]>([])
  const [active, setActive] = React.useState<string>("main")
  const { messagesById, update, nextId } = useConversation(initialConversations)
  const activeSub = active === "main" ? undefined : subagents[active]

  const open = (id: string) => {
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]))
    setActive(id)
  }

  return (
    <PillFrame>
      <ChatTabs
        className="px-1 pb-2"
        label="Conversations"
        tabs={[
          { id: "main", title: "Nessa", icon: <TabGlyph seed="nessa" /> },
          ...openTabs.map((id) => ({
            id,
            title: subagents[id].name,
            icon: (
              <TabGlyph seed={id} busy={subagents[id].status === "running"} />
            ),
            closeable: true,
            loading: subagents[id].status === "running",
          })),
        ]}
        value={active}
        onValueChange={setActive}
        onClose={(id) => {
          setOpenTabs((tabs) => tabs.filter((tab) => tab !== id))
          setActive((current) => (current === id ? "main" : current))
        }}
      />
      <div
        id={`chat-tab-panel-${active}`}
        aria-labelledby={`chat-tab-${active}`}
        role="tabpanel"
        className="flex min-h-0 flex-1 flex-col"
      >
        <ConversationSurface
          key={active}
          conversationId={active}
          messages={messagesById[active] ?? []}
          name={activeSub ? activeSub.name : "Nessa"}
          generating={activeSub?.status === "running"}
          onUpdate={update}
          nextId={nextId}
          renderSpawned={(ids) =>
            ids.map((id) => (
              <SubagentChip
                key={id}
                sub={subagents[id]}
                onClick={() => open(id)}
              />
            ))
          }
          lead={
            activeSub ? (
              // The provenance line is itself the way back: one tap returns
              // to the chat this subagent was spawned from.
              <button
                type="button"
                onClick={() => setActive("main")}
                className="mx-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft aria-hidden className="size-3" />
                Subagent of Nessa · {activeSub.task}
              </button>
            ) : null
          }
        />
      </div>
    </PillFrame>
  )
}

// --- Variant B: stacked card -------------------------------------------

function StackedCardExample() {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const { messagesById, update, nextId } = useConversation(initialConversations)
  const sub = openId ? subagents[openId] : undefined

  return (
    <PillFrame>
      <div className="flex shrink-0 items-center gap-2 px-2 py-2">
        <RandomAvatar
          // The group counterpart of a facepile: drilling in repaints the
          // active avatar as Nessa-plus-subagent instead of adding tabs.
          seed={sub ? ["nessa", sub.id] : "nessa"}
          busy={sub?.status === "running"}
          className="size-7"
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {sub ? `Nessa › ${sub.name}` : "Nessa"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {sub
            ? sub.status === "running"
              ? "running"
              : "done"
            : `${Object.keys(subagents).length} subagents`}
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ConversationSurface
          conversationId="main"
          messages={messagesById.main ?? []}
          name="Nessa"
          onUpdate={update}
          nextId={nextId}
          renderSpawned={(ids) =>
            ids.map((id) => (
              <SubagentChip
                key={id}
                sub={subagents[id]}
                onClick={() => setOpenId(id)}
              />
            ))
          }
        />
        {sub ? (
          <div className="absolute inset-0 flex flex-col bg-background">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ChevronLeft aria-hidden className="size-4" />
              Nessa
              <span className="ms-auto font-normal text-muted-foreground">
                {sub.task}
              </span>
            </button>
            <ConversationSurface
              conversationId={sub.id}
              messages={messagesById[sub.id] ?? []}
              name={sub.name}
              generating={sub.status === "running"}
              onUpdate={update}
              nextId={nextId}
            />
          </div>
        ) : null}
      </div>
    </PillFrame>
  )
}

// --- Variant C: inline thread ------------------------------------------

function InlineThreadExample() {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const { messagesById, update, nextId } = useConversation(initialConversations)
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <PillFrame>
      <div className="flex shrink-0 items-center gap-2 px-2 py-2">
        <RandomAvatar seed="nessa" className="size-7" />
        <span className="text-xs font-medium">Nessa</span>
      </div>
      <ConversationSurface
        conversationId="main"
        messages={messagesById.main ?? []}
        name="Nessa"
        onUpdate={update}
        nextId={nextId}
        renderSpawned={(ids) =>
          ids.map((id) => {
            const sub = subagents[id]
            const open = expanded.has(id)
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <SubagentChip sub={sub} onClick={() => toggle(id)} />
                {open ? (
                  <div className="ms-3 flex flex-col gap-1.5 border-s-2 border-border ps-2">
                    {sub.turns.map((turn) => (
                      <ChatMessage
                        key={turn.id}
                        tone={turn.role === "user" ? "sent" : "received"}
                      >
                        <ChatBubble className="text-xs">{turn.text}</ChatBubble>
                      </ChatMessage>
                    ))}
                    <p className="m-0 text-[11px] text-muted-foreground">
                      {sub.status === "running"
                        ? "Still running…"
                        : "Subagent finished"}
                    </p>
                  </div>
                ) : null}
              </div>
            )
          })
        }
      />
    </PillFrame>
  )
}

// --- stories -----------------------------------------------------------

export const TabDrillIn: Story = {
  parameters: storyDocumentation(
    "Variant A on the real kit, with the playground's chat interactions: clicking a subagent chip opens it as a ChatTabs pill tab — watercolor avatar glyph, glowing activity dot while it runs, close × — and swaps the transcript to that subagent's conversation. Right-click any bubble for the tapback row and Reply; replying frosts everything outside the focused thread, the pill's placeholder flips to Reply, the sent message carries its quote, and Escape leaves reply mode. The Nessa tab (or closing the subagent tab) returns to the parent chat, and the pill's rim animates while the viewed subagent runs.",
  ),
  render: () => <TabDrillInExample />,
}

export const StackedCard: Story = {
  parameters: storyDocumentation(
    "Variant B — no extra tabs: the subagent transcript slides over the parent as a stacked card with an iOS-style '‹ Nessa' back row, and the single header avatar repaints as a Nessa-plus-subagent group painting while you're inside. Same tapback and reply interactions on every bubble.",
  ),
  render: () => <StackedCardExample />,
}

export const InlineThread: Story = {
  parameters: storyDocumentation(
    "Variant C — no navigation at all: the chip toggles the subagent's turns inline under the spawning message behind a connector rule, Slack-thread style. The main transcript keeps the tapback and reply interactions.",
  ),
  render: () => <InlineThreadExample />,
}
