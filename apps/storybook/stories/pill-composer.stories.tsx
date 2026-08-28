import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  Card,
  ChatAttachmentStack,
  ChatAttachmentTile,
  ChatAttachmentViewer,
  ChatBubble,
  ChatComposerAction,
  ChatComposerAttachments,
  ChatComposerInput,
  ChatComposerTrigger,
  ChatMessage,
  ChatMessageQuote,
  ChatMessageReceipt,
  chatReactionOptions,
  ChatTabs,
  ChatTypingIndicator,
  cn,
  MessageMarkdown,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PillComposer,
  PillComposerRow,
  SearchableListbox,
  SegmentedControl,
  SegmentedControlOption,
  type PillComposerRimVariant,
  SectionedListbox,
  type ModelPickerGroup,
  type ModelPickerValue,
} from "@nessa-ui/react"
import { Folder, Image as ImageIcon, Paperclip, Plus, SlidersHorizontal, Sparkles, Puzzle, Square, X } from "lucide-react"

import { storyDocumentation } from "./story-documentation"
import {
  filterSlashSections,
  matchesQuery,
  renderSlashItem,
  type SlashItem,
} from "./composer-demo-data"
import { KimiModelIcon } from "./icons/model/kimi-model-icon"

function ModelAsset({ name, invert = false }: { name: string; invert?: boolean }) {
  // TODO(SRC-002): move this inversion variant to the provider-scoped theme selector when it lands.
  return (
    <img
      src={`/model-icons/${name}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={invert ? "size-4 dark:invert" : "size-4"}
    />
  )
}

const groups: ModelPickerGroup[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    shortLabel: "Claude",
    icon: <ModelAsset name="claude-color" />,
    models: [
      { id: "fable-5", label: "Fable 5", icon: <ModelAsset name="claude-color" /> },
      { id: "sonnet-5", label: "Sonnet 5", icon: <ModelAsset name="claude-color" /> },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    shortLabel: "OpenAI",
    icon: <ModelAsset name="openai" invert />,
    models: [
      { id: "sol", label: "GPT-5.6 Sol", icon: <ModelAsset name="openai" invert /> },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    shortLabel: "Kimi",
    icon: <KimiModelIcon />,
    models: [{ id: "kimi-k3", label: "Kimi K3", icon: <KimiModelIcon /> }],
  },
]

const defaultModel: ModelPickerValue = {
  providerId: "anthropic",
  modelId: "fable-5",
}

const modelItems = groups.flatMap((group) =>
  group.models.map((model) => ({ group, model })),
)

type DemoAttachmentKind = "photo" | "file" | "folder" | "skill" | "plugin"

interface DemoAttachment {
  id: number
  kind: DemoAttachmentKind
  label: string
  src?: string
}

/** Builds a small gradient "photo" as a data URI, so the demo needs no assets. */
function demoPhoto(from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='160' height='160' fill='url(#g)'/><circle cx='118' cy='44' r='18' fill='white' fill-opacity='0.85'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Maps a non-photo attachment kind to its tile glyph. */
function AttachmentKindIcon({
  kind,
  className,
}: {
  kind: Exclude<DemoAttachmentKind, "photo">
  className?: string
}) {
  const Icon =
    kind === "file"
      ? Paperclip
      : kind === "folder"
        ? Folder
        : kind === "skill"
          ? Sparkles
          : Puzzle
  return <Icon aria-hidden="true" className={className} />
}

const attachmentSamples: Record<
  DemoAttachmentKind,
  { label: string; src?: string }[]
> = {
  photo: [
    { label: "Sunset", src: demoPhoto("#f59e0b", "#ec4899") },
    { label: "Ocean", src: demoPhoto("#22d3ee", "#0071e3") },
    { label: "Meadow", src: demoPhoto("#4ade80", "#0d9488") },
  ],
  file: [{ label: "release-notes.md" }, { label: "launch-checklist.pdf" }],
  folder: [{ label: "design-assets" }],
  skill: [],
  plugin: [],
}

const modelCommand: SlashItem = {
  id: "command-model",
  kind: "skill",
  label: "/model",
  description: "Choose a model",
  icon: <SlidersHorizontal aria-hidden="true" />,
}

/** The pill's slash sections: a Commands section ahead of the shared skills and plugins. */
function pillSlashSections(query: string) {
  return [
    {
      id: "commands",
      label: "Commands",
      items: [modelCommand].filter((item) =>
        matchesQuery(query, [item.label, item.description]),
      ),
    },
    ...filterSlashSections(query),
  ]
}

/**
 * The iMessage-style voice-input waveform glyph, drawn in currentColor.
 * While `active`, the bars pulse like a live level meter, so a held
 * recording reads as recording without swapping the icon away.
 */
function WaveformIcon({
  className,
  active = false,
}: {
  className?: string
  active?: boolean
}) {
  const ref = React.useRef<SVGSVGElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || !active) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const bars = Array.from(node.querySelectorAll("rect"))
    const animations = bars.map((bar, index) =>
      bar.animate(
        [
          { transform: "scaleY(0.7)" },
          { transform: "scaleY(1.15)" },
          { transform: "scaleY(0.7)" },
        ],
        {
          duration: 1400,
          delay: index * 150,
          iterations: Infinity,
          easing: "ease-in-out",
        },
      ),
    )
    return () => animations.forEach((animation) => animation.cancel())
  }, [active])
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
      ref={ref}
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
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
    </svg>
  )
}

/**
 * The trailing pill action while the agent works: a stop control that pops
 * in with a subtle scale-up so the mic reads as handing over, not vanishing.
 */
function StopAction({
  onStop,
  label = "Stop generating",
}: {
  onStop: () => void
  label?: string
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const animation = node.animate(
      [
        { opacity: 0, scale: "0.6" },
        { opacity: 1, scale: "1" },
      ],
      { duration: 180, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.2)" },
    )
    return () => animation.cancel()
  }, [])
  return (
    <ChatComposerAction
      ref={ref}
      aria-label={label}
      title={label}
      onClick={onStop}
      className="bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
    >
      <Square
        aria-hidden="true"
        fill="currentColor"
        style={{ width: "0.75rem", height: "0.75rem" }}
      />
    </ChatComposerAction>
  )
}

interface DemoMessage {
  id: number
  role: "user" | "assistant"
  text: string
  /** The quoted text of the message this one replies to, iMessage-style. */
  replyTo?: string
  /** The id of the message this one replies to, linking it into a thread. */
  replyToId?: number
  /** Photos, files, and folders sent with the message. */
  attachments?: DemoAttachment[]
  /** The applied tapback reaction emoji. */
  reaction?: string
  /** True while this assistant reply is still streaming in. */
  streaming?: boolean
}

/**
 * Maps one demo message onto the ChatBubbles kit: attachments (single tile
 * or fanned stack), reply quote, the bubble itself as the reply control,
 * and the delivery receipt.
 */
function DemoBubble({
  message,
  delivered = false,
  onOpenAttachments,
  dimmed = false,
  threadFocused = false,
  onReact,
  onReplyCommit,
  onMenuOpenChange,
  menuBoundary,
}: {
  message: DemoMessage
  /** Shows the Delivered receipt under this message. */
  delivered?: boolean
  /** Opens the full-surface attachment viewer for this message's items. */
  onOpenAttachments: (attachments: DemoAttachment[]) => void
  /** Recedes the bubble: frost during reply, "soft" while a tapback menu is open. */
  dimmed?: boolean | "soft"
  /** Marks the message as part of the focused thread (its quote hides). */
  threadFocused?: boolean
  /** Applies or toggles a tapback reaction on this message. */
  onReact?: (emoji: string) => void
  /** Enters reply mode for this message and focuses the composer. */
  onReplyCommit?: () => void
  /** Reports the tapback menu opening and closing. */
  onMenuOpenChange?: (open: boolean) => void
  /** Flips the tapback menu above the press point at this element's edges. */
  menuBoundary?: Element | null
}) {
  // Reply commits after the menu closes: Radix's close-autofocus would
  // otherwise return focus to the bubble and undo the composer focus.
  const replyChosenRef = React.useRef(false)
  const attachments = message.attachments ?? []
  // Tiles inside the stack must be non-interactive: the stack's own button
  // is the control, and a button cannot nest buttons.
  const tile = (
    attachment: DemoAttachment,
    className: string,
    interactive = true,
  ) => (
    <ChatAttachmentTile
      key={attachment.id}
      label={attachment.label}
      imageSrc={attachment.src}
      icon={
        attachment.kind === "photo" ? undefined : (
          <AttachmentKindIcon kind={attachment.kind} />
        )
      }
      className={className}
      onOpen={interactive ? () => onOpenAttachments(attachments) : undefined}
    />
  )
  return (
    <ChatMessage
      tone={message.role === "user" ? "sent" : "received"}
      dimmed={dimmed}
      threadFocused={threadFocused}
    >
      {attachments.length === 1
        ? tile(attachments[0]!, "mb-1 size-28")
        : attachments.length > 1 ? (
            <ChatAttachmentStack
              count={attachments.length}
              onOpen={() => onOpenAttachments(attachments)}
            >
              {attachments.map((attachment) => tile(attachment, "size-28", false))}
            </ChatAttachmentStack>
          ) : null}
      {message.replyTo ? <ChatMessageQuote>{message.replyTo}</ChatMessageQuote> : null}
      {message.text ? (
        /* Right-click / long-press raises the ContextMenu with the tapback
           row and a Reply action. Opening it never frosts the transcript —
           the frosted thread view belongs to reply mode, entered via Reply. */
        <ContextMenu onOpenChange={onMenuOpenChange}>
          <ContextMenuTrigger asChild>
            <ChatBubble
              aria-label={`Reply to: ${message.text}`}
              title="Right-click to reply or react"
              tabIndex={0}
              reaction={message.reaction}
              className={
                message.role === "assistant" ? "px-4 py-2.5" : undefined
              }
            >
              {message.role === "assistant" ? (
                <MessageMarkdown
                  streaming={message.streaming}
                  className="leading-5"
                >
                  {message.text}
                </MessageMarkdown>
              ) : (
                message.text
              )}
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
              onReplyCommit?.()
            }}
          >
            {/* Each tapback is its own menu item, so arrow keys reach every
                emoji and Enter applies it — a single wrapped picker would be
                mouse-only inside a Radix menu. */}
            <div className="flex max-w-60 items-center gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chatReactionOptions.map((option) => (
                <ContextMenuItem
                  key={option.emoji}
                  asChild
                  onSelect={() => onReact?.(option.emoji)}
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
      ) : null}
      {delivered ? <ChatMessageReceipt>Delivered</ChatMessageReceipt> : null}
    </ChatMessage>
  )
}

/**
 * The in-chat model card raised by the /model command: a closable panel of
 * models that pops in like a bubble, so the pill spends no standing space
 * on a model control.
 */
function ModelCard({
  value,
  onSelect,
  onClose,
}: {
  value: ModelPickerValue
  onSelect: (value: ModelPickerValue) => void
  onClose: () => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const animation = node.animate(
      [
        { opacity: 0, translate: "0 10px", scale: "0.95" },
        { opacity: 1, translate: "0 0", scale: "1" },
      ],
      { duration: 200, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)" },
    )
    return () => animation.cancel()
  }, [])
  return (
    <Card
      ref={ref}
      data-slot="pill-composer-demo-model-card"
      className="relative origin-bottom gap-0 rounded-3xl py-1.5 shadow-none"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Close model card"
        title="Close"
        onClick={onClose}
        className="absolute right-2.5 top-2.5 z-10 size-7 rounded-full text-muted-foreground"
      >
        <X aria-hidden="true" />
      </Button>
      <SearchableListbox
        items={modelItems}
        getItemId={(item) => `${item.group.id}:${item.model.id}`}
        getItemKeywords={(item) => [
          item.model.label,
          item.group.label,
          item.group.shortLabel,
        ]}
        value={`${value.providerId}:${value.modelId}`}
        onValueChange={(_, item) =>
          onSelect({ providerId: item.group.id, modelId: item.model.id })
        }
        searchPlaceholder="Search models"
        listLabel="Models"
        searchClassName="border-b-0 pr-12"
        listClassName="max-h-64 px-1.5 pb-1.5 pt-0"
        optionClassName="aria-selected:bg-accent aria-selected:font-medium"
        renderItem={(item) => (
          <span className="flex w-full items-center gap-2.5 font-sans nessa-text-4">
            <span
              aria-hidden="true"
              className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
            >
              {item.model.icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.model.label}</span>
            <span className="shrink-0 font-normal nessa-text-2 text-muted-foreground">
              {item.group.label}
            </span>
          </span>
        )}
      />
    </Card>
  )
}

/** Pluralized per-kind summary for the attachment viewer's footer, e.g. "1 Photo, 2 Files". */
function attachmentSummary(attachments: DemoAttachment[]) {
  const nouns: Record<DemoAttachmentKind, string> = {
    photo: "Photo",
    file: "File",
    folder: "Folder",
    skill: "Skill",
    plugin: "Plugin",
  }
  const counts = new Map<DemoAttachmentKind, number>()
  for (const attachment of attachments) {
    counts.set(attachment.kind, (counts.get(attachment.kind) ?? 0) + 1)
  }
  return [...counts]
    .map(([kind, count]) => `${count} ${nouns[kind]}${count > 1 ? "s" : ""}`)
    .join(", ")
}

/**
 * A small-surface host: an iMessage-style transcript over the pill
 * composer. Enter is the only send affordance; tapping a bubble starts a
 * reply, quoted through the composer's attachment primitives; and typing
 * /model raises the closable in-chat model card instead of spending pill
 * space on a standing picker. The rim lights while the "agent" works and a
 * canned reply lands.
 */
function PlaygroundExample({ replyDelay = 900 }: { replyDelay?: number }) {
  const [message, setMessage] = React.useState("")
  const [tabs, setTabs] = React.useState([
    { id: "chat-1", title: "Release notes" },
  ] as { id: string; title: string; closeable?: boolean }[])
  const [activeTabId, setActiveTabId] = React.useState("chat-1")
  const [messagesByTab, setMessagesByTab] = React.useState<
    Record<string, DemoMessage[]>
  >({})
  const messages = messagesByTab[activeTabId] ?? []
  const updateMessages = React.useCallback(
    (tabId: string, updater: (current: DemoMessage[]) => DemoMessage[]) =>
      setMessagesByTab((current) => ({
        ...current,
        [tabId]: updater(current[tabId] ?? []),
      })),
    [],
  )
  const [generatingTabId, setGeneratingTabId] = React.useState<string | null>(
    null,
  )
  const generating = generatingTabId !== null && generatingTabId === activeTabId
  const [model, setModel] = React.useState<ModelPickerValue>(defaultModel)
  const [modelCardOpen, setModelCardOpen] = React.useState(false)
  const [replyTarget, setReplyTarget] = React.useState<DemoMessage | null>(null)
  const [attachments, setAttachments] = React.useState<DemoAttachment[]>([])
  const [listening, setListening] = React.useState(false)
  const [microphone, setMicrophone] = React.useState("default")
  const [holdToRecord, setHoldToRecord] = React.useState(true)
  const [micMenuOpen, setMicMenuOpen] = React.useState(false)
  const holdingToRecord = React.useRef(false)
  const [viewerAttachments, setViewerAttachments] =
    React.useState<DemoAttachment[] | null>(null)
  const [menuTargetId, setMenuTargetId] = React.useState<number | null>(null)
  const attachmentCounters = React.useRef<Record<DemoAttachmentKind, number>>({ photo: 0, file: 0, folder: 0, skill: 0, plugin: 0 })
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const [frameElement, setFrameElement] = React.useState<HTMLDivElement | null>(
    null,
  )
  const nextId = React.useRef(1)
  const replyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamCleanup = React.useRef<(() => void) | null>(null)
  React.useEffect(
    () => () => {
      if (replyTimer.current) clearTimeout(replyTimer.current)
      streamCleanup.current?.()
    },
    [],
  )

  /**
   * After a short "thinking" beat (typing dots), the reply streams in word
   * by word through MessageMarkdown's streaming mode; the rim stays lit
   * until the stream completes.
   */
  const startReply = (tabId: string, thinkDelay: number) => {
    replyTimer.current = setTimeout(() => {
      const id = nextId.current++
      const words = "On it — I'll take a look and report back.".split(" ")
      updateMessages(tabId, (current) => [
        ...current,
        { id, role: "assistant", text: words[0]!, streaming: true },
      ])
      let revealed = 1
      const interval = setInterval(() => {
        revealed += 1
        const done = revealed >= words.length
        updateMessages(tabId, (current) =>
          current.map((message) =>
            message.id === id
              ? {
                  ...message,
                  text: words.slice(0, revealed).join(" "),
                  streaming: !done,
                }
              : message,
          ),
        )
        if (done) {
          clearInterval(interval)
          streamCleanup.current = null
          setGeneratingTabId(null)
        }
      }, 70)
      streamCleanup.current = () => {
        clearInterval(interval)
        streamCleanup.current = null
        updateMessages(tabId, (current) =>
          current.map((message) =>
            message.id === id ? { ...message, streaming: false } : message,
          ),
        )
      }
    }, thinkDelay)
  }

  const lastUserId = [...messages].reverse().find((entry) => entry.role === "user")?.id

  const addAttachment = (kind: DemoAttachmentKind) => {
    const samples = attachmentSamples[kind]
    const sample =
      samples[attachmentCounters.current[kind]++ % samples.length]!
    setAttachments((current) => [
      ...current,
      { id: nextId.current++, kind, ...sample },
    ])
    inputRef.current?.focus()
  }
  const removeAttachment = (id: number) =>
    setAttachments((current) => current.filter((entry) => entry.id !== id))

  // Pressing voice swaps the waveform for a stop control and streams a
  // canned transcription into the input word by word. The words land in the
  // real input value — ghost-styled while listening, ordinary editable text
  // the moment it stops.
  React.useEffect(() => {
    if (!listening) return
    const words =
      "Draft a quick summary of the launch and send it to the team".split(" ")
    let index = 0
    const interval = setInterval(() => {
      const word = words[index]
      index += 1
      if (word === undefined) {
        clearInterval(interval)
        setListening(false)
        inputRef.current?.focus()
        return
      }
      setMessage((current) => (current ? `${current} ${word}` : word))
    }, 280)
    return () => clearInterval(interval)
  }, [listening])

  // While replying, the target's whole thread stays in focus — the message
  // itself, everything it transitively replies to, and every reply chained
  // onto it — and the rest of the transcript recedes, matching iMessage's
  // "just this thread" view.
  const threadIds = React.useMemo(() => {
    if (!replyTarget) return null
    const ids = new Set<number>()
    let ancestor: DemoMessage | undefined = replyTarget
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
      data-slot="pill-composer-demo-frame"
      // A fixed frame height pins the composer's bottom edge: a growing
      // input or attachment row eats the transcript's space upward instead
      // of pushing the pill down.
      className="relative flex h-[min(38rem,calc(100vh-4rem))] min-w-0 w-[min(28rem,calc(100vw-2rem))] flex-col justify-end gap-3 rounded-[2rem] bg-background p-4"
    >
      {/* The floating window's tab strip: each tab is its own conversation;
          the busy dot follows wherever a reply streams. */}
      <ChatTabs
        className="px-1"
        tabs={tabs.map((tab) => ({
          ...tab,
          loading: generatingTabId === tab.id,
        }))}
        activeId={activeTabId}
        onSelect={(id) => {
          setActiveTabId(id)
          setReplyTarget(null)
          setMenuTargetId(null)
          setViewerAttachments(null)
          setModelCardOpen(false)
        }}
        onClose={(id) => {
          if (id === generatingTabId) {
            if (replyTimer.current) clearTimeout(replyTimer.current)
            streamCleanup.current?.()
            setGeneratingTabId(null)
          }
          setTabs((current) => {
            const next = current.filter((tab) => tab.id !== id)
            if (id === activeTabId && next.length > 0) {
              setActiveTabId(next[0]!.id)
            }
            return next
          })
          setMessagesByTab((current) => {
            const { [id]: _closed, ...rest } = current
            return rest
          })
        }}
        onNew={() => {
          const id = `chat-${nextId.current++}`
          setTabs((current) => [
            ...current,
            { id, title: "New chat", closeable: true },
          ])
          setActiveTabId(id)
          setReplyTarget(null)
          setMenuTargetId(null)
          setViewerAttachments(null)
          setModelCardOpen(false)
          inputRef.current?.focus()
        }}
      />
      {/* The tabpanel wrapper honors ChatTabs' aria-controls contract; the
          log region lives inside it. */}
      <div
        id={`chat-tab-panel-${activeTabId}`}
        aria-labelledby={`chat-tab-${activeTabId}`}
        role="tabpanel"
        className="flex min-h-0 flex-1 flex-col"
      >
      <div
        aria-label="Conversation"
        role="log"
        className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {messages.map((entry) => (
          <DemoBubble
            key={entry.id}
            message={entry}
            delivered={entry.id === lastUserId}
            onOpenAttachments={setViewerAttachments}
            dimmed={
              threadIds !== null
                ? !threadIds.has(entry.id)
                : menuTargetId !== null && menuTargetId !== entry.id
                  ? "soft"
                  : false
            }
            threadFocused={threadIds !== null && threadIds.has(entry.id)}
            onReplyCommit={() => {
              setReplyTarget(entry)
              inputRef.current?.focus()
            }}
            onMenuOpenChange={(open) =>
              setMenuTargetId(open ? entry.id : null)
            }
            menuBoundary={frameElement}
            onReact={(emoji) => {
              updateMessages(activeTabId, (current) =>
                current.map((message) =>
                  message.id === entry.id
                    ? {
                        ...message,
                        reaction: message.reaction === emoji ? undefined : emoji,
                      }
                    : message,
                ),
              )
              setReplyTarget(null)
            }}

          />
        ))}
        {generating && !messages.some((message) => message.streaming) ? (
          <ChatTypingIndicator label="Assistant is typing" />
        ) : null}
      </div>
      </div>
      {viewerAttachments ? (
        <ChatAttachmentViewer
          summary={attachmentSummary(viewerAttachments)}
          onClose={() => setViewerAttachments(null)}
        >
          {viewerAttachments.map((attachment) => (
            <ChatAttachmentTile
              key={attachment.id}
              label={attachment.label}
              imageSrc={attachment.src}
              icon={
                attachment.kind === "photo" ? undefined : (
                  <AttachmentKindIcon kind={attachment.kind} />
                )
              }
              className="size-28"
            />
          ))}
        </ChatAttachmentViewer>
      ) : null}
      {modelCardOpen ? (
        <ModelCard
          value={model}
          onSelect={(next) => {
            setModel(next)
            setModelCardOpen(false)
            inputRef.current?.focus()
          }}
          onClose={() => setModelCardOpen(false)}
        />
      ) : null}
      <PillComposer
        generating={generating}
        onSubmit={(event) => {
          event.preventDefault()
          const text = message.trim()
          if ((!text && attachments.length === 0) || generatingTabId !== null)
            return
          updateMessages(activeTabId, (current) => [
            ...current,
            {
              id: nextId.current++,
              role: "user",
              text,
              replyTo: replyTarget?.text,
              replyToId: replyTarget?.id,
              attachments: attachments.length > 0 ? attachments : undefined,
            },
          ])
          setMessage("")
          setAttachments([])
          setReplyTarget(null)
          setGeneratingTabId(activeTabId)
          startReply(activeTabId, replyDelay)
        }}
      >
        <ChatComposerAttachments>
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              data-slot="pill-composer-demo-attachment"
              className="relative m-1 inline-flex"
            >
              <ChatAttachmentTile
                label={attachment.label}
                imageSrc={attachment.src}
                icon={
                  attachment.kind === "photo" ? undefined : (
                    <AttachmentKindIcon kind={attachment.kind} />
                  )
                }
                onOpen={() => setViewerAttachments([attachment])}
              />
              <button
                type="button"
                data-slot="chat-composer-attachment-remove"
                aria-label={`Remove ${attachment.label}`}
                title={`Remove ${attachment.label}`}
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-background text-foreground shadow-sm outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3"
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ))}
        </ChatComposerAttachments>
        <PillComposerRow>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ChatComposerAction aria-label="Add attachment" title="Add attachment">
                <Plus aria-hidden="true" />
              </ChatComposerAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onSelect={() => addAttachment("photo")}>
                <ImageIcon aria-hidden="true" />
                Photo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => addAttachment("file")}>
                <Paperclip aria-hidden="true" />
                File
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => addAttachment("folder")}>
                <Folder aria-hidden="true" />
                Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChatComposerInput
            ref={inputRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={replyTarget ? "Reply" : "Ask me anything"}
            className={cn("self-center", listening && "text-muted-foreground")}
          />
          {generating ? (
            <StopAction
              onStop={() => {
                if (replyTimer.current) clearTimeout(replyTimer.current)
                streamCleanup.current?.()
                setGeneratingTabId(null)
              }}
            />
          ) : listening && !holdToRecord ? (
            <StopAction label="Stop listening" onStop={() => setListening(false)} />
          ) : (
            <DropdownMenu
              open={micMenuOpen}
              onOpenChange={(open) => {
                // Plain clicks must start listening, not open the menu, so
                // radix's open requests are ignored; only the right-click
                // handler opens it.
                if (!open) setMicMenuOpen(false)
              }}
            >
              <DropdownMenuTrigger asChild>
                <ChatComposerAction
                  aria-label="Start voice input"
                  title={
                    holdToRecord
                      ? "Hold to record (right-click for options)"
                      : "Start voice input (right-click for options)"
                  }
                  aria-pressed={holdToRecord ? listening : undefined}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setMicMenuOpen(true)
                  }}
                  onPointerDown={() => {
                    if (!holdToRecord || listening) return
                    holdingToRecord.current = true
                    setListening(true)
                    // The pill reflows as words stream in, so the release can
                    // land anywhere — listen on the window, not the button.
                    const stop = () => {
                      window.removeEventListener("pointerup", stop)
                      window.removeEventListener("pointercancel", stop)
                      if (!holdingToRecord.current) return
                      holdingToRecord.current = false
                      setListening(false)
                    }
                    window.addEventListener("pointerup", stop)
                    window.addEventListener("pointercancel", stop)
                  }}
                  onClick={() => {
                    if (holdToRecord) return
                    setListening(true)
                  }}
                  className={cn(
                    holdToRecord &&
                      listening &&
                      "bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive",
                  )}
                >
                  <WaveformIcon active={holdToRecord && listening} />
                </ChatComposerAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                aria-label="Voice input options"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuLabel>Microphone</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={microphone}
                  onValueChange={setMicrophone}
                >
                  <DropdownMenuRadioItem value="default">
                    Default — MacBook Pro Microphone
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="shadow">
                    Shadow Microphone
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="built-in">
                    MacBook Pro Microphone (Built-in)
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={holdToRecord}
                  onCheckedChange={setHoldToRecord}
                >
                  Hold to record
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </PillComposerRow>
        <ChatComposerTrigger trigger="/" label="Commands, skills, and plugins">
          {({ query, clearTrigger }) => (
            <SectionedListbox
              sections={pillSlashSections(query)}
              getItemId={(item) => item.id}
              renderItem={renderSlashItem}
              onValueChange={(_, item) => {
                clearTrigger()
                if (item.id === modelCommand.id) {
                  setModelCardOpen(true)
                  return
                }
                setAttachments((current) => [
                  ...current,
                  { id: nextId.current++, kind: item.kind, label: item.label },
                ])
              }}
              listLabel="Commands, skills, and plugins"
              emptyMessage="No matching commands"
            />
          )}
        </ChatComposerTrigger>
      </PillComposer>
    </div>
  )
}

/** A minimal pill with scaffolding controls for exercising the rim by hand. */
function GeneratingExample() {
  const [generating, setGenerating] = React.useState(false)
  const [variant, setVariant] = React.useState<PillComposerRimVariant>("orbit")
  const [message, setMessage] = React.useState("")
  return (
    <div className="flex min-w-0 w-[min(28rem,calc(100vw-2rem))] flex-col gap-4 rounded-[2rem] bg-background p-4">
      <PillComposer
        generating={generating}
        rimVariant={variant}
        onSubmit={(event) => event.preventDefault()}
      >
        <PillComposerRow>
          <ChatComposerAction aria-label="Add attachment" title="Add attachment">
            <Plus aria-hidden="true" />
          </ChatComposerAction>
          <ChatComposerInput
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask me anything"
            className="self-center"
          />
          <ChatComposerAction aria-label="Start voice input" title="Start voice input">
            <WaveformIcon />
          </ChatComposerAction>
        </PillComposerRow>
      </PillComposer>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setGenerating((current) => !current)}
          className="rounded-full border border-border bg-card px-3 py-1.5 font-sans nessa-text-4 text-card-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {generating ? "Stop generating" : "Start generating"}
        </button>
        <SegmentedControl
          aria-label="Rim animation"
          value={variant}
          onValueChange={(next) => setVariant(next as PillComposerRimVariant)}
        >
          <SegmentedControlOption value="orbit">Orbit</SegmentedControlOption>
          <SegmentedControlOption value="comet">Comet</SegmentedControlOption>
          <SegmentedControlOption value="pulse">Pulse</SegmentedControlOption>
          <SegmentedControlOption value="aurora">Aurora</SegmentedControlOption>
        </SegmentedControl>
      </div>
    </div>
  )
}

/**
 * The voice control in isolation: hold-to-record streams a transcription
 * only while held (pulsing waveform, red tint), right-click opens the
 * microphone options above the pill, and unchecking Hold to record
 * restores the click-to-toggle flow with the red stop.
 */
function VoiceExample() {
  const [message, setMessage] = React.useState("")
  const [listening, setListening] = React.useState(false)
  const [microphone, setMicrophone] = React.useState("default")
  const [holdToRecord, setHoldToRecord] = React.useState(true)
  const [micMenuOpen, setMicMenuOpen] = React.useState(false)
  const holdingToRecord = React.useRef(false)
  React.useEffect(() => {
    if (!listening) return
    const words =
      "Draft a quick summary of the launch and send it to the team".split(" ")
    let index = 0
    const interval = setInterval(() => {
      const word = words[index]
      index += 1
      if (word === undefined) {
        clearInterval(interval)
        setListening(false)
        return
      }
      setMessage((current) => (current ? `${current} ${word}` : word))
    }, 280)
    return () => clearInterval(interval)
  }, [listening])
  return (
    <div className="flex min-w-0 w-[min(28rem,calc(100vw-2rem))] flex-col gap-3 rounded-[2rem] bg-background p-4">
      <PillComposer onSubmit={(event) => event.preventDefault()}>
        <PillComposerRow>
          <ChatComposerAction aria-label="Add attachment" title="Add attachment">
            <Plus aria-hidden="true" />
          </ChatComposerAction>
          <ChatComposerInput
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask me anything"
            className={cn("self-center", listening && "text-muted-foreground")}
          />
          {listening && !holdToRecord ? (
            <StopAction label="Stop listening" onStop={() => setListening(false)} />
          ) : (
            <DropdownMenu
              open={micMenuOpen}
              onOpenChange={(open) => {
                if (!open) setMicMenuOpen(false)
              }}
            >
              <DropdownMenuTrigger asChild>
                <ChatComposerAction
                  aria-label="Start voice input"
                  title={
                    holdToRecord
                      ? "Hold to record (right-click for options)"
                      : "Start voice input (right-click for options)"
                  }
                  aria-pressed={holdToRecord ? listening : undefined}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setMicMenuOpen(true)
                  }}
                  onPointerDown={() => {
                    if (!holdToRecord || listening) return
                    holdingToRecord.current = true
                    setListening(true)
                    const stop = () => {
                      window.removeEventListener("pointerup", stop)
                      window.removeEventListener("pointercancel", stop)
                      if (!holdingToRecord.current) return
                      holdingToRecord.current = false
                      setListening(false)
                    }
                    window.addEventListener("pointerup", stop)
                    window.addEventListener("pointercancel", stop)
                  }}
                  onClick={() => {
                    if (holdToRecord) return
                    setListening(true)
                  }}
                  className={cn(
                    holdToRecord &&
                      listening &&
                      "bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive",
                  )}
                >
                  <WaveformIcon active={holdToRecord && listening} />
                </ChatComposerAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                aria-label="Voice input options"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuLabel>Microphone</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={microphone}
                  onValueChange={setMicrophone}
                >
                  <DropdownMenuRadioItem value="default">
                    Default — MacBook Pro Microphone
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="shadow">
                    Shadow Microphone
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="built-in">
                    MacBook Pro Microphone (Built-in)
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={holdToRecord}
                  onCheckedChange={setHoldToRecord}
                >
                  Hold to record
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </PillComposerRow>
      </PillComposer>
    </div>
  )
}

/**
 * The /model command in isolation: typing / raises the shared slash menu,
 * choosing /model opens the searchable in-chat model card, and picking a
 * model closes it.
 */
function ModelCommandExample() {
  const [message, setMessage] = React.useState("")
  const [model, setModel] = React.useState<ModelPickerValue>(defaultModel)
  const [modelCardOpen, setModelCardOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  return (
    <div className="relative flex h-[24rem] min-w-0 w-[min(28rem,calc(100vw-2rem))] flex-col justify-end gap-3 rounded-[2rem] bg-background p-4">
      {modelCardOpen ? (
        <ModelCard
          value={model}
          onSelect={(next) => {
            setModel(next)
            setModelCardOpen(false)
            inputRef.current?.focus()
          }}
          onClose={() => setModelCardOpen(false)}
        />
      ) : null}
      <PillComposer onSubmit={(event) => event.preventDefault()}>
        <PillComposerRow>
          <ChatComposerAction aria-label="Add attachment" title="Add attachment">
            <Plus aria-hidden="true" />
          </ChatComposerAction>
          <ChatComposerInput
            ref={inputRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Type /model"
            className="self-center"
          />
          <ChatComposerAction aria-label="Start voice input" title="Start voice input">
            <WaveformIcon />
          </ChatComposerAction>
        </PillComposerRow>
        <ChatComposerTrigger trigger="/" label="Commands, skills, and plugins">
          {({ query, clearTrigger }) => (
            <SectionedListbox
              sections={pillSlashSections(query)}
              getItemId={(item) => item.id}
              renderItem={renderSlashItem}
              onValueChange={(_, item) => {
                clearTrigger()
                if (item.id === modelCommand.id) setModelCardOpen(true)
              }}
              listLabel="Commands, skills, and plugins"
              emptyMessage="No matching commands"
            />
          )}
        </ChatComposerTrigger>
      </PillComposer>
    </div>
  )
}

/**
 * Preloads one of each attachment kind as the uniform square tiles the
 * Playground uses: a photo thumbnail plus icon tiles for the file, folder,
 * and skill, each with a corner delete and an Open action.
 */
function AttachmentsExample() {
  const [attachments, setAttachments] = React.useState<DemoAttachment[]>([
    { id: 1, kind: "photo", label: "Sunset", src: attachmentSamples.photo[0]!.src },
    { id: 2, kind: "file", label: "release-notes.md" },
    { id: 3, kind: "folder", label: "design-assets" },
    { id: 4, kind: "skill", label: "deploy" },
  ])
  const [message, setMessage] = React.useState("")
  const removeAttachment = (id: number) =>
    setAttachments((current) => current.filter((entry) => entry.id !== id))
  return (
    <div className="flex min-w-0 w-[min(28rem,calc(100vw-2rem))] flex-col gap-3 rounded-[2rem] bg-background p-4">
      <PillComposer onSubmit={(event) => event.preventDefault()}>
        <ChatComposerAttachments>
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              data-slot="pill-composer-demo-attachment"
              className="relative m-1 inline-flex"
            >
              <ChatAttachmentTile
                label={attachment.label}
                imageSrc={attachment.src}
                icon={
                  attachment.kind === "photo" ? undefined : (
                    <AttachmentKindIcon kind={attachment.kind} />
                  )
                }
                onOpen={() => undefined}
              />
              <button
                type="button"
                data-slot="chat-composer-attachment-remove"
                aria-label={`Remove ${attachment.label}`}
                title={`Remove ${attachment.label}`}
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-background text-foreground shadow-sm outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3"
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ))}
        </ChatComposerAttachments>
        <PillComposerRow>
          <ChatComposerAction aria-label="Add attachment" title="Add attachment">
            <Plus aria-hidden="true" />
          </ChatComposerAction>
          <ChatComposerInput
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask me anything"
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

/** Reads the rim overlay element for play assertions. */
function rimElement(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>(
    '[data-slot="pill-composer-rim"]',
  )!
}

function prefersReducedMotion(canvasElement: HTMLElement) {
  return Boolean(
    canvasElement.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches,
  )
}

/** Waits for every entrance/rim animation under the frame to finish. */
async function waitForSettledAnimations(canvasElement: HTMLElement) {
  await waitFor(() => {
    const running = canvasElement
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running")
    expect(running).toHaveLength(0)
  }, { timeout: 4000 })
}

const meta = {
  title: "Components/PillComposer",
  component: PillComposer,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A compact, iMessage-style pill composer for small chat surfaces. It provides the ChatComposer slot context, so ChatComposerInput, ChatComposerAttachments, ChatComposerAction, and ChatComposerTrigger compose inside it unchanged, and it adds a working state: an iridescent light traveling the pill's rim at constant speed, led by a crisp head with a soft glow bleeding inward behind it. Toggling `generating` fades the light in and out so the composer reads as lighting up rather than switching.",
      },
    },
  },
} satisfies Meta<typeof PillComposer>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The intended small-surface composition — the floating chat window: pill tabs across the top (each tab an independent conversation, with the busy dot on whichever tab is streaming), + and voice actions inside the pill, Enter as the only send affordance, and no standing model control — typing /model raises a closable model card in the chat, the voice action streams a ghost transcription into the editable input — with Hold to record on (the default) it records only while held, the waveform bars pulsing as a live meter, and with it off a click toggles listening with a red stop control; right-click it for a microphone options menu above the pill. Agent replies think first (typing dots), then stream in word by word through MessageMarkdown's streaming mode — rich markdown renders as it arrives and the rim stays lit until the stream completes, and + opens a menu that attaches photos, files, and folders as uniform square tiles — thumbnail previews for photos, icon tiles for the rest — each with a corner delete button and an Open action the host wires to its full view. Bubbles are iMessage-style with tails and a Delivered receipt; right-clicking (or long-pressing) one shows the tapback reaction row and a Reply action — reacting never frosts the transcript; choosing Reply enters the frosted thread view — the rest of the transcript recedes behind a blur while the composer switches to Reply, iMessage-style (Escape from anywhere, or tapping the bubble again, leaves the reply view; a threaded message keeps its whole thread in focus), and while the agent works the rim lights and the mic hands over to a stop control.",
  ),
  render: () => <PlaygroundExample />,
  play: async ({ canvasElement }) => {
    // The dev canvas re-runs plays on every load and its un-awaited act
    // scope swallows manual input mid-run; keep plays to the automated
    // runner (vitest drives a webdriver browser) so the canvas stays live.
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const input = canvas.getByRole("textbox", { name: "Message" })
    const rim = rimElement(canvasElement)
    // The rim fades on a token-duration transition, so its resting opacity
    // is only exact once the surface has come to rest — reading it on the
    // frame the story mounts catches the fade mid-flight.
    await waitForSettledAnimations(canvasElement)
    await expect(getComputedStyle(rim).opacity).toBe("0")
    await userEvent.type(input, "Ship the release notes{enter}")
    await expect(
      canvas.getByText("Ship the release notes"),
    ).toBeInTheDocument()
    await expect(input).toHaveValue("")
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="pill-composer"]',
    )!
    await expect(composer).toHaveAttribute("data-generating", "true")
    await expect(rim).toHaveAttribute("data-active", "true")
    await expect(
      canvas.getByRole("button", { name: "Stop generating" }),
    ).toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "Start voice input" }),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(getComputedStyle(rim).opacity).toBe("1")
    })
    if (!prefersReducedMotion(canvasElement)) {
      await waitFor(() => {
        expect(
          rim.getAnimations({ subtree: true }).length,
        ).toBeGreaterThanOrEqual(2)
      })
    }
    await waitFor(
      () => {
        expect(
          canvas.getByText("On it — I'll take a look and report back."),
        ).toBeInTheDocument()
      },
      { timeout: 4000 },
    )
    await expect(composer).not.toHaveAttribute("data-generating")
    await expect(
      canvas.getByRole("button", { name: "Start voice input" }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(getComputedStyle(rim).opacity).toBe("0")
    })
    await waitForSettledAnimations(canvasElement)
    await expect(
      canvas.getByText("Delivered"),
    ).toBeInTheDocument()
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByLabelText(
        "Reply to: On it — I'll take a look and report back.",
      ),
    })
    // Opening the tapback menu alone must not frost the transcript.
    await expect(input).toHaveAttribute("placeholder", "Ask me anything")
    await userEvent.click(await body.findByRole("menuitem", { name: "Reply" }))
    await expect(input).toHaveAttribute("placeholder", "Reply")
    const firstMessage = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-message"]',
    )!
    await waitFor(() => {
      expect(getComputedStyle(firstMessage).filter).toContain("blur")
    })
    await userEvent.keyboard("{Escape}")
    await expect(input).toHaveAttribute("placeholder", "Ask me anything")
    await waitFor(() => {
      expect(getComputedStyle(firstMessage).filter).toBe("none")
    })
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByLabelText(
        "Reply to: On it — I'll take a look and report back.",
      ),
    })
    await userEvent.click(await body.findByRole("menuitem", { name: "Reply" }))
    await expect(input).toHaveAttribute("placeholder", "Reply")
    await waitFor(() => {
      expect(input).toHaveFocus()
    })
    await userEvent.type(input, "thanks{enter}")
    await expect(
      canvas.getByLabelText("Reply to: thanks"),
    ).toBeInTheDocument()
    await expect(input).toHaveAttribute("placeholder", "Ask me anything")
    await waitFor(() => {
      expect(getComputedStyle(firstMessage).filter).toBe("none")
    })
    const quote = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-message-quote"]',
    )!
    await expect(quote).toHaveTextContent(
      "On it — I'll take a look and report back.",
    )
    await waitFor(
      () => {
        expect(
          canvasElement.querySelectorAll('[data-slot="chat-message"][data-tone="received"]'),
        ).toHaveLength(2)
      },
      { timeout: 4000 },
    )
    await waitFor(() => {
      expect(getComputedStyle(rim).opacity).toBe("0")
    })
    await waitForSettledAnimations(canvasElement)
    await userEvent.type(input, "/mod")
    await userEvent.click(await body.findByRole("option", { name: /model/ }))
    await expect(input).toHaveValue("")
    const modelList = canvas.getByRole("listbox", { name: "Models" })
    await userEvent.click(
      within(modelList).getByRole("option", { name: /Sonnet 5/ }),
    )
    await expect(
      canvas.queryByRole("listbox", { name: "Models" }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("button", { name: "Add attachment" }),
    )
    await userEvent.click(body.getByRole("menuitem", { name: "Photo" }))
    await userEvent.click(
      canvas.getByRole("button", { name: "Add attachment" }),
    )
    await userEvent.click(body.getByRole("menuitem", { name: "File" }))
    await expect(
      canvas.getByRole("button", { name: "Open Sunset" }),
    ).toBeInTheDocument()
    await expect(canvas.getByText("release-notes.md")).toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "Remove Sunset" }))
    await expect(
      canvas.queryByRole("button", { name: "Open Sunset" }),
    ).not.toBeInTheDocument()
    await userEvent.click(input)
    await userEvent.keyboard("{Backspace}")
    await expect(
      canvas.queryByText("release-notes.md"),
    ).not.toBeInTheDocument()
    const voice = canvas.getByRole("button", { name: "Start voice input" })
    // Hold-to-record (the default): transcription streams only while the
    // pointer is held down, and the waveform button itself stays put.
    voice.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }),
    )
    await waitFor(() => {
      expect(voice).toHaveAttribute("aria-pressed", "true")
    })
    await expect(
      canvas.queryByRole("button", { name: "Stop listening" }),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toContain("Draft")
    })
    canvasElement.ownerDocument.defaultView!.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, button: 0, pointerId: 1 }),
    )
    await waitFor(() => {
      expect(voice).toHaveAttribute("aria-pressed", "false")
    })
    // Turning Hold to record off restores the click-to-toggle flow with the
    // red stop control.
    await userEvent.pointer({ keys: "[MouseRight]", target: voice })
    await userEvent.click(
      await body.findByRole("menuitemcheckbox", { name: "Hold to record" }),
    )
    await userEvent.click(
      canvas.getByRole("button", { name: "Start voice input" }),
    )
    await userEvent.click(
      canvas.getByRole("button", { name: "Stop listening" }),
    )
    await expect(
      canvas.getByRole("button", { name: "Start voice input" }),
    ).toBeInTheDocument()
    // Tapback: right-click a bubble, react, and the badge lands on it while
    // the reply focus clears.
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: canvas.getByLabelText("Reply to: thanks"),
    })
    await userEvent.click(
      await body.findByRole("menuitem", { name: "React with love" }),
    )
    const reactionBadge = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-reaction"]',
    )!
    await expect(reactionBadge).toHaveTextContent("❤️")
    await expect(input).toHaveAttribute("placeholder", "Ask me anything")
    await userEvent.type(input, " tomorrow")
    await expect((input as HTMLTextAreaElement).value).toMatch(/ tomorrow$/)
    await waitForSettledAnimations(canvasElement)
  },
}

export const Generating: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The rim in isolation with scaffolding controls. The crisp band hugs the rim while a blurred copy bleeds inward; toggling fades the whole treatment over the normal motion duration, and the motion only stops once the fade-out completes. The switcher walks the built-in rimVariant presets: Orbit revolves the trail at constant speed, Comet laps faster with an eased surge, Pulse holds still and breathes, and Aurora revolves while the spectrum cycles hue.",
  ),
  render: () => <GeneratingExample />,
  play: async ({ canvasElement }) => {
    // The dev canvas re-runs plays on every load and its un-awaited act
    // scope swallows manual input mid-run; keep plays to the automated
    // runner (vitest drives a webdriver browser) so the canvas stays live.
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const rim = rimElement(canvasElement)
    await waitForSettledAnimations(canvasElement)
    await expect(getComputedStyle(rim).opacity).toBe("0")
    await expect(rim.getAnimations({ subtree: true })).toHaveLength(0)
    await userEvent.click(
      canvas.getByRole("button", { name: "Start generating" }),
    )
    await expect(rim).toHaveAttribute("data-active", "true")
    await waitFor(() => {
      expect(getComputedStyle(rim).opacity).toBe("1")
    })
    if (!prefersReducedMotion(canvasElement)) {
      await waitFor(() => {
        expect(
          rim.getAnimations({ subtree: true }).length,
        ).toBeGreaterThanOrEqual(2)
      })
    } else {
      await expect(rim.getAnimations({ subtree: true })).toHaveLength(0)
    }
    // Every preset keeps the rim animating (reduced motion keeps it still).
    for (const preset of ["Comet", "Pulse", "Aurora"]) {
      await userEvent.click(canvas.getByRole("button", { name: preset }))
      await expect(rim).toHaveAttribute(
        "data-variant",
        preset.toLowerCase(),
      )
      if (!prefersReducedMotion(canvasElement)) {
        await waitFor(() => {
          expect(
            rim.getAnimations({ subtree: true }).length,
          ).toBeGreaterThanOrEqual(2)
        })
      } else {
        await expect(rim.getAnimations({ subtree: true })).toHaveLength(0)
      }
    }
    await userEvent.click(canvas.getByRole("button", { name: "Orbit" }))
    await userEvent.click(
      canvas.getByRole("button", { name: "Stop generating" }),
    )
    await waitFor(() => {
      expect(getComputedStyle(rim).opacity).toBe("0")
    })
    await waitFor(
      () => {
        expect(rim.getAnimations({ subtree: true })).toHaveLength(0)
      },
      { timeout: 4000 },
    )
  },
}

export const Voice: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The voice control by itself. With Hold to record on (the default), transcription streams as ghost text only while the button is held — the waveform bars pulse as a live meter and the button tints red. Right-click the button for the microphone options menu above the pill; unchecking Hold to record switches to click-to-toggle with the red stop control.",
  ),
  render: () => <VoiceExample />,
  play: async ({ canvasElement }) => {
    // The dev canvas re-runs plays on every load and its un-awaited act
    // scope swallows manual input mid-run; keep plays to the automated
    // runner (vitest drives a webdriver browser) so the canvas stays live.
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const input = canvas.getByRole("textbox", { name: "Message" })
    const voice = canvas.getByRole("button", { name: "Start voice input" })
    voice.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }),
    )
    await waitFor(() => {
      expect(voice).toHaveAttribute("aria-pressed", "true")
    })
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toContain("Draft")
    })
    canvasElement.ownerDocument.defaultView!.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, button: 0, pointerId: 1 }),
    )
    await waitFor(() => {
      expect(voice).toHaveAttribute("aria-pressed", "false")
    })
    await userEvent.pointer({ keys: "[MouseRight]", target: voice })
    await userEvent.click(
      await body.findByRole("menuitemradio", { name: "Shadow Microphone" }),
    )
    await userEvent.pointer({ keys: "[MouseRight]", target: voice })
    await expect(
      await body.findByRole("menuitemradio", { name: "Shadow Microphone" }),
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.click(
      body.getByRole("menuitemcheckbox", { name: "Hold to record" }),
    )
    await userEvent.click(
      canvas.getByRole("button", { name: "Start voice input" }),
    )
    await userEvent.click(
      canvas.getByRole("button", { name: "Stop listening" }),
    )
    await expect(
      canvas.getByRole("button", { name: "Start voice input" }),
    ).toBeInTheDocument()
  },
}

export const ModelCommand: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The /model command by itself: typing / raises the shared slash menu (Commands ahead of Skills and Plugins), choosing /model opens the searchable in-chat model card, search narrows the catalog, and picking a model applies the selection wash and closes the card.",
  ),
  render: () => <ModelCommandExample />,
  play: async ({ canvasElement }) => {
    // The dev canvas re-runs plays on every load and its un-awaited act
    // scope swallows manual input mid-run; keep plays to the automated
    // runner (vitest drives a webdriver browser) so the canvas stays live.
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const input = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.type(input, "/mod")
    await userEvent.click(await body.findByRole("option", { name: /model/ }))
    await expect(input).toHaveValue("")
    const search = canvas.getByRole("textbox", { name: "Search models" })
    await userEvent.type(search, "kimi")
    await userEvent.click(canvas.getByRole("option", { name: /Kimi K3/ }))
    await expect(
      canvas.queryByRole("listbox", { name: "Models" }),
    ).not.toBeInTheDocument()
  },
}

export const Attachments: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Every attachment kind shares the same square tile above the control row — a thumbnail for photos, icon tiles for files, folders, and skills. Each tile is an Open action for the host's full view, the corner delete removes it, and Backspace at the start of an empty input removes the trailing one.",
  ),
  render: () => <AttachmentsExample />,
  play: async ({ canvasElement }) => {
    // The dev canvas re-runs plays on every load and its un-awaited act
    // scope swallows manual input mid-run; keep plays to the automated
    // runner (vitest drives a webdriver browser) so the canvas stays live.
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "Open Sunset" }),
    ).toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove release-notes.md" }),
    )
    await expect(
      canvas.queryByText("release-notes.md"),
    ).not.toBeInTheDocument()
    const input = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.click(input)
    await userEvent.keyboard("{Backspace}")
    await expect(canvas.queryByText("deploy")).not.toBeInTheDocument()
    await expect(canvas.getByText("design-assets")).toBeInTheDocument()
  },
}
