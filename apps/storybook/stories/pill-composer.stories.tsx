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
  ChatComposerAttachmentIcon,
  Input,
  FilePreviewJson,
  FilePreviewMarkdown,
  SelectionTooltip,
  SelectionTooltipAction,
  SelectionTooltipLabel,
  SelectionTooltipSeparator,
  ChatComposerEditor,
  ChatComposerTrigger,
  type ChatComposerContentPart,
  type ChatComposerEditorHandle,
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
  RandomAvatar,
  type ModelPickerGroup,
  type ModelPickerValue,
} from "@nessa-ui/react"
import { Braces, Check, ChevronLeft, ChevronRight, Copy, FileText, Folder, GitFork, Image as ImageIcon, Paperclip, Pencil, Plus, RefreshCw, SlidersHorizontal, Sparkles, Puzzle, Square, X } from "lucide-react"

import { ChatAddIcon, CommentIcon } from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"
import {
  filterSlashSections,
  slashSections,
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

/** The mocked file behind a chip: skills carry a SKILL.md, plugins a manifest. */
function chipFileMock(item: SlashItem): {
  name: string
  mimeType: string
  content: string
} {
  const slug = item.label.toLowerCase().replace(/\s+/g, "-")
  if (item.kind === "plugin") {
    return {
      name: "manifest.json",
      mimeType: "application/json",
      content: JSON.stringify(
        {
          name: slug,
          kind: "plugin",
          description: item.description,
          permissions: ["read", "search"],
          entry: "index.ts",
        },
        null,
        2,
      ),
    }
  }
  return {
    name: "SKILL.md",
    mimeType: "text/markdown",
    content: [
      `# ${item.label}`,
      "",
      item.description + ".",
      "",
      "## When to use",
      `Invoke with \`/${slug}\` from any conversation.`,
      "",
      "## Steps",
      "1. Gather the relevant context from the current chat.",
      "2. Apply the checklist this skill carries.",
      "3. Report the result back into the thread.",
    ].join("\n"),
  }
}

/**
 * A previewed file on the chat surface: the bare renderer, plus a selection
 * tooltip — select any passage and add it to the chat to talk to the agent
 * about it.
 */
function DocumentSurface({
  item,
  onAttach,
  onComment,
}: {
  item: SlashItem
  /** Attaches the selection to the pending quotes; the document stays open. */
  onAttach: (text: string) => void
  /** Posts a comment message that carries the selection as its quote. */
  onComment: (text: string, comment: string) => void
}) {
  const file = chipFileMock(item)
  const previewFile = {
    src: `data:${file.mimeType};charset=utf-8,${encodeURIComponent(file.content)}`,
    name: file.name,
    mimeType: file.mimeType,
  }
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [selection, setSelection] = React.useState<{
    text: string
    left: number
    top: number
  } | null>(null)
  const [mode, setMode] = React.useState<"actions" | "comment">("actions")
  const [draft, setDraft] = React.useState("")
  const captureSelection = () => {
    if (mode === "comment") return
    const container = containerRef.current
    const live = container?.ownerDocument.getSelection()
    if (!container || !live || live.isCollapsed) {
      setSelection(null)
      return
    }
    const text = live.toString().trim()
    if (!text || !container.contains(live.anchorNode)) {
      setSelection(null)
      return
    }
    const rect = live.getRangeAt(0).getBoundingClientRect()
    const host = container.getBoundingClientRect()
    setSelection({
      text,
      left: rect.left - host.left + rect.width / 2,
      top: rect.top - host.top + container.scrollTop,
    })
  }
  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-y-auto text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onMouseUp={captureSelection}
      onKeyUp={captureSelection}
    >
      {item.kind === "plugin" ? (
        <FilePreviewJson file={previewFile} kind="json" />
      ) : (
        <FilePreviewMarkdown file={previewFile} kind="markdown" />
      )}
      {selection ? (
        <SelectionTooltip
          className="absolute z-10 -translate-x-1/2 -translate-y-full"
          style={{
            // The comment composer is wider than the action pill, so it
            // centers on the surface; the action pill hugs the selection,
            // clamped so neither ever clips at the panel's edges.
            left:
              mode === "comment"
                ? "50%"
                : Math.min(
                    Math.max(selection.left, 120),
                    (containerRef.current?.clientWidth ?? 480) - 120,
                  ),
            top: Math.max(selection.top - 8, 0),
          }}
        >
          {mode === "actions" ? (
            <>
              <SelectionTooltipAction
                aria-label="Add to chat"
                tooltip="Add to chat"
                onClick={() => {
                  onAttach(selection.text)
                  containerRef.current?.ownerDocument.getSelection()?.removeAllRanges()
                  setSelection(null)
                }}
              >
                <ChatAddIcon aria-hidden="true" />
                <SelectionTooltipLabel>Add to chat</SelectionTooltipLabel>
              </SelectionTooltipAction>
              <SelectionTooltipSeparator />
              <SelectionTooltipAction
                aria-label="Comment"
                tooltip="Comment on the selection"
                onClick={() => setMode("comment")}
              >
                <CommentIcon aria-hidden="true" />
                <SelectionTooltipLabel>Comment</SelectionTooltipLabel>
              </SelectionTooltipAction>
            </>
          ) : (
            // The pill swaps its actions for a comment composer in place —
            // saving posts the note with the selected passage attached, and
            // the document never leaves the screen.
            <>
              <Input
                autoFocus
                aria-label="Comment"
                placeholder="Comment on the selection"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !draft.trim()) return
                  event.preventDefault()
                  onComment(selection.text, draft.trim())
                  setDraft("")
                  setMode("actions")
                  containerRef.current?.ownerDocument.getSelection()?.removeAllRanges()
                  setSelection(null)
                }}
                className="h-8 w-52 border-0 bg-transparent shadow-none dark:bg-transparent"
              />
              <SelectionTooltipAction
                aria-label="Save comment"
                tooltip="Save comment"
                onClick={() => {
                  if (!draft.trim()) return
                  onComment(selection.text, draft.trim())
                  setDraft("")
                  setMode("actions")
                  containerRef.current?.ownerDocument.getSelection()?.removeAllRanges()
                  setSelection(null)
                }}
              >
                <Check aria-hidden="true" />
              </SelectionTooltipAction>
              <SelectionTooltipAction
                aria-label="Cancel comment"
                tooltip="Cancel"
                onClick={() => {
                  setDraft("")
                  setMode("actions")
                }}
              >
                <X aria-hidden="true" />
              </SelectionTooltipAction>
            </>
          )}
        </SelectionTooltip>
      ) : null}
    </div>
  )
}

/** Finds the catalog entry behind an inserted chip, for the read view. */
function slashItemForLabel(label: string): SlashItem | undefined {
  return slashSections
    .flatMap((section) => section.items)
    .find((item) => item.label === label)
}

/** Finds the catalog entry a lifted passage came from. */
function slashItemForId(id: string): SlashItem | undefined {
  return slashSections
    .flatMap((section) => section.items)
    .find((item) => item.id === id)
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

interface PendingQuote {
  /** The passage lifted from the document. */
  text: string
  /** The user's comments on it — the first from the selection tooltip, the rest added later from the annotation view. */
  comments?: string[]
  /** The slash item whose document the passage came from. */
  sourceId?: string
}

interface DemoMessage {
  id: number
  role: "user" | "assistant"
  text: string
  /** The quoted text of the message this one replies to, iMessage-style. */
  replyTo?: string
  /** Passages lifted from previewed documents, quoted above the bubble. */
  quotes?: PendingQuote[]
  /** The id of the message this one replies to, linking it into a thread. */
  replyToId?: number
  /** Photos, files, and folders sent with the message. */
  attachments?: DemoAttachment[]
  /** The applied tapback reaction emoji. */
  reaction?: string
  /** True while this assistant reply is still streaming in. */
  streaming?: boolean
  /** Subagent ids this assistant turn spawned, rendered as drill-in chips. */
  spawned?: string[]
  /**
   * The editor's content parts when the message carried inline chips, so the
   * bubble re-renders each chip the way the composer showed it.
   */
  parts?: ChatComposerContentPart[]
}

/**
 * Renders editor content parts inside a bubble: chips keep their icon on the
 * text baseline and press open the same read view as in the composer.
 */
function BubbleParts({
  parts,
  onChipPress,
}: {
  parts: ChatComposerContentPart[]
  /** Receives the pressed chip and whether the press asked for a new tab. */
  onChipPress?: (
    chip: { id: string; label: string; kind?: string },
    newTab: boolean,
  ) => void
}) {
  return (
    <>
      {parts.map((part, index) =>
        part.type === "chip" ? (
          <span
            key={index}
            data-slot="bubble-chip"
            role={onChipPress ? "button" : undefined}
            tabIndex={onChipPress ? 0 : undefined}
            title={slashItemForLabel(part.chip.label)?.description}
            onClick={
              onChipPress
                ? (event) => {
                    event.stopPropagation()
                    onChipPress(
                      part.chip,
                      event.metaKey || event.ctrlKey,
                    )
                  }
                : undefined
            }
            onKeyDown={
              onChipPress
                ? (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    event.stopPropagation()
                    onChipPress(
                      part.chip,
                      event.metaKey || event.ctrlKey,
                    )
                  }
                : undefined
            }
            className={cn(
              "whitespace-nowrap font-medium underline-offset-2",
              onChipPress && "cursor-pointer hover:underline",
            )}
          >
            <ChatComposerAttachmentIcon
              kind={part.chip.kind}
              icon={slashItemForLabel(part.chip.label)?.icon}
              className="mr-1 align-[-0.125em]"
            />
            {part.chip.label}
          </span>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ),
      )}
    </>
  )
}

interface DemoSubagent {
  id: string
  name: string
  task: string
  status: "running" | "done"
}

/** The tab id a subagent's own conversation lives under. */
const subagentTabId = (id: string) => `sub:${id}`

const demoSubagents: Record<string, DemoSubagent> = {
  explorer: {
    id: "explorer",
    name: "Explorer",
    task: "Map the composer call sites",
    status: "done",
  },
  reviewer: {
    id: "reviewer",
    name: "Reviewer",
    task: "Review the transcript diff",
    status: "running",
  },
}

// The seeded "Repo audit" conversation: an agent turn that split its work
// across two subagents, each with its own transcript under a sub: tab. Ids
// sit far above the live counter so canned replies never collide.
const auditTabId = "audit"
const seededMessagesByTab: Record<string, DemoMessage[]> = {
  [auditTabId]: [
    {
      id: 901,
      role: "user",
      text: "Where do we compose the chat composer today, and is the transcript diff safe to land?",
    },
    {
      id: 902,
      role: "assistant",
      text: "I'll split that: one agent maps the composer call sites while another reviews the diff.",
      spawned: ["explorer", "reviewer"],
    },
    {
      id: 903,
      role: "assistant",
      text: "Explorer is back — nine call sites, one of them re-implements the footer. Reviewer has two findings so far and is still going.",
    },
    {
      id: 904,
      role: "user",
      text: "Show me the reviewer's findings as they land.",
    },
  ],
  [subagentTabId("explorer")]: [
    {
      id: 911,
      role: "user",
      text: "Find every place the ChatComposer primitives are composed into a full surface, and note which slots each one uses.",
    },
    {
      id: 912,
      role: "assistant",
      text: "Nine call sites. The app shell panes and the message edit-in-place both use the compact size; only the catalog stories use attachment rows. Full table in the report.",
    },
    {
      id: 913,
      role: "assistant",
      text: "One surprise: composer-queue re-implements the footer row instead of using ChatComposerFooter — worth folding back.",
    },
  ],
  [subagentTabId("reviewer")]: [
    {
      id: 921,
      role: "user",
      text: "Review the transcript virtualization diff for correctness and accessibility regressions.",
    },
    {
      id: 922,
      role: "assistant",
      text: "Two findings so far: the log role moved off the scrolling element, and the pinned-state check reads layout in a loop. Still reading the resize path…",
    },
  ],
}

/**
 * A drill-in chip for a subagent an assistant turn spawned: watercolor
 * avatar, name, status line, and a chevron; clicking opens that subagent's
 * own conversation as a tab.
 */
function SubagentChip({
  sub,
  onOpen,
}: {
  sub: DemoSubagent
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-start font-sans shadow-xs outline-none transition-colors hover:bg-accent focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <RandomAvatar
        seed={sub.id}
        busy={sub.status === "running"}
        className="size-7"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate nessa-text-2 font-medium">
          {sub.name}
        </span>
        <span className="block truncate nessa-text-1 text-muted-foreground">
          {sub.status === "running" ? "Running · " : "Done · "}
          {sub.task}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
    </button>
  )
}

/**
 * Editing happens inside the bubble itself: the bubble keeps its shape and
 * tone, its text becomes an editable field, and small save and cancel
 * controls sit beside it. Enter saves, Escape cancels.
 */
function InlineBubbleEditor({
  text,
  onSave,
  onCancel,
}: {
  text: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = React.useState(text)
  // The caret opens at the end of the text, ready to append.
  const placeCaretAtEnd = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      if (!node) return
      node.focus()
      node.setSelectionRange(node.value.length, node.value.length)
    },
    [],
  )
  return (
    <ChatBubble className="max-w-full">
      {/* field-sizing lets the textarea take exactly its content's shape,
          so the editing bubble wraps and measures like the resting one. */}
      <textarea
        ref={placeCaretAtEnd}
        aria-label="Edit message"
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (draft.trim()) onSave(draft.trim())
            else onCancel()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            onCancel()
          }
        }}
        onBlur={() => onCancel()}
        className="block max-w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-sans nessa-text-4 leading-5 text-inherit outline-none [field-sizing:content]"
      />
    </ChatBubble>
  )
}

/** A hover-revealed, presentation-only icon action for a message row. */
function HoverAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3"
    >
      {children}
    </button>
  )
}

/**
 * Maps one demo message onto the ChatBubbles kit/**
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
  onChipOpen,
  onPastedOpen,
  onLongOpen,
  onQuotePress,
  onQuoteSourceOpen,
  onQuotesOpen,
  editing = false,
  onEditStart,
  onEditSave,
  onEditCancel,
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
  /** Opens a chip's file from a chip inside this bubble; true asks for a new tab. */
  onChipOpen?: (label: string, newTab: boolean) => void
  /** Opens a pasted-text chip's full content in the list view. */
  onPastedOpen?: (chipId: string) => void
  /** Opens a long message's full text in the list view. */
  onLongOpen?: (text: string) => void
  /** Focuses the thread this message replies into (its quote chip's tap). */
  onQuotePress?: () => void
  /** Opens the document a lifted passage came from. */
  onQuoteSourceOpen?: (sourceId: string) => void
  /** Opens the read-only list of this message's annotations. */
  onQuotesOpen?: (quotes: PendingQuote[]) => void
  /** True while this user message's bubble is swapped for the editor. */
  editing?: boolean
  /** Enters edit mode for this user message (context-menu Edit). */
  onEditStart?: () => void
  /** Commits the edited text. */
  onEditSave?: (text: string) => void
  /** Leaves edit mode without changes. */
  onEditCancel?: () => void
  /** Flips the tapback menu above the press point at this element's edges. */
  menuBoundary?: Element | null
}) {
  // Reply commits after the menu closes: Radix's close-autofocus would
  // otherwise return focus to the bubble and undo the composer focus.
  const replyChosenRef = React.useRef(false)
  const editChosenRef = React.useRef(false)
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
      className="group/message relative"
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
      {message.replyTo ? (
        <ChatMessageQuote
          role={onQuotePress ? "button" : undefined}
          tabIndex={onQuotePress ? 0 : undefined}
          title={onQuotePress ? "Show this thread" : undefined}
          onClick={onQuotePress}
          onKeyDown={
            onQuotePress
              ? (event) => {
                  if (event.key !== "Enter" && event.key !== " ") return
                  event.preventDefault()
                  onQuotePress()
                }
              : undefined
          }
          className={onQuotePress ? "cursor-pointer hover:bg-accent" : undefined}
        >
          {message.replyTo}
        </ChatMessageQuote>
      ) : null}
      {message.quotes && message.quotes.length > 0 ? (
        // The annotations travel as one compact pill — the chat stays
        // clean, and tapping it opens the same list view they were
        // reviewed in before sending.
        <ChatMessageQuote
          role="button"
          tabIndex={0}
          title="Show the annotations"
          onClick={(event) => {
            event.stopPropagation()
            onQuotesOpen?.(message.quotes!)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            onQuotesOpen?.(message.quotes!)
          }}
          className="cursor-pointer hover:bg-accent"
        >
          {message.quotes.length === 1
            ? "1 annotation"
            : `${message.quotes.length} annotations`}
        </ChatMessageQuote>
      ) : null}
      {editing ? (
        <InlineBubbleEditor
          text={message.text}
          onSave={(text) => onEditSave?.(text)}
          onCancel={() => onEditCancel?.()}
        />
      ) : message.text || (message.parts && message.parts.length > 0) ? (
        /* Right-click / long-press raises the ContextMenu with the tapback
           row and a Reply action. Opening it never frosts the transcript —
           the frosted thread view belongs to reply mode, entered via Reply. */
        <>
        <span className="relative flex max-w-full items-center">
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
              ) : message.role === "user" &&
                message.text.length > 280 &&
                onLongOpen ? (
                // A huge typed message stays compact in the transcript —
                // four lines and a chevron; the full text lives in the
                // list view, like the pasted-text chips.
                <span
                  role="button"
                  tabIndex={0}
                  title="Show the whole message"
                  onClick={(event) => {
                    event.stopPropagation()
                    onLongOpen(message.text)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    event.stopPropagation()
                    onLongOpen(message.text)
                  }}
                  className="flex cursor-pointer items-end gap-1"
                >
                  <span className="line-clamp-4">{message.text}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="mb-0.5 size-3.5 shrink-0 opacity-80"
                  />
                </span>
              ) : message.parts ? (
                <BubbleParts
                  parts={message.parts}
                  onChipPress={(chip, newTab) => {
                    if (chip.kind === "pasted-text") {
                      onPastedOpen?.(chip.id)
                      return
                    }
                    onChipOpen?.(chip.label, newTab)
                  }}
                />
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
              if (editChosenRef.current) {
                editChosenRef.current = false
                event.preventDefault()
                onEditStart?.()
                return
              }
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
            {message.role === "user" && onEditStart ? (
              <ContextMenuItem
                onSelect={() => {
                  editChosenRef.current = true
                }}
              >
                Edit
              </ContextMenuItem>
            ) : null}
          </ContextMenuContent>
        </ContextMenu>
        </span>
        {/* One pattern for both sides: a hover-revealed footer row under
            the bubble — the receipt lives here too, so the transcript
            carries no standing chrome. Padding, not margin, bridges the
            gap so the pointer can reach the actions without losing hover. */}
        <span
          className={cn(
            "pointer-events-none absolute top-full z-10 flex items-center gap-0.5 pt-0.5 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100",
            message.role === "user" ? "right-0" : "left-0",
          )}
        >
          {message.role === "user" ? (
            <>
              {delivered ? (
                <span className="pe-1 font-sans nessa-text-1 text-muted-foreground">
                  Delivered
                </span>
              ) : null}
              <HoverAction label="Copy">
                <Copy aria-hidden="true" />
              </HoverAction>
              {onEditStart ? (
                <HoverAction label="Edit message" onClick={onEditStart}>
                  <Pencil aria-hidden="true" />
                </HoverAction>
              ) : null}
            </>
          ) : (
            <>
              <HoverAction label="Fork the conversation from here">
                <GitFork aria-hidden="true" />
              </HoverAction>
              <HoverAction label="Retry this reply">
                <RefreshCw aria-hidden="true" />
              </HoverAction>
              <HoverAction label="Copy">
                <Copy aria-hidden="true" />
              </HoverAction>
            </>
          )}
        </span>
        </>
      ) : null}
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

// A pile of pending annotations in every shape — one-liners, paragraphs,
// commented and bare — for exercising the pending row and the list view.
const seededAnnotations: PendingQuote[] = [
  {
    text: "Gather the relevant context from the current chat.",
    comments: ["This should spell out how much history counts as relevant."],
    sourceId: "skill-creator",
  },
  { text: "Apply the checklist this skill carries.", sourceId: "skill-creator" },
  {
    text: "Report the result back into the thread. The report should stay short enough to read in the transcript, with the full detail behind a link, so the conversation keeps moving while the evidence stays reachable for whoever wants to dig in later.",
    comments: [
      "Way too long for one step — split the summary rule and the linking rule into separate steps, and give each a concrete length budget so agents stop guessing.",
      "Also decide who owns the link target.",
    ],
    sourceId: "skill-creator",
  },
  {
    text: "Invoke with /skill-creator from any conversation.",
    comments: ["Mention the trigger menu too."],
    sourceId: "skill-creator",
  },
  { text: "Draft a reusable skill from this conversation.", sourceId: "skill-creator" },
  {
    text: "The checklist this skill carries should include accessibility, performance, and error handling, each with at least one concrete check the reviewer can run without leaving the editor.",
    comments: ["a11y first."],
    sourceId: "code-review",
  },
  { text: "When to use", sourceId: "skill-creator" },
  {
    text: "Steps",
    comments: [
      "The whole Steps section reads as written for humans; add a machine-readable variant so the runner can verify each step actually happened.",
    ],
    sourceId: "skill-creator",
  },
]


/** A sent-style comment bubble whose text edits in place, inside the bubble. */
function EditableCommentBubble({
  text,
  onSave,
}: {
  text: string
  /** Omitted in read-only views; present, it enables the hover edit control. */
  onSave?: (text: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  if (editing && onSave) {
    return (
      <InlineBubbleEditor
        text={text}
        onSave={(next) => {
          onSave(next)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }
  return (
    <span className="group/comment flex max-w-full items-center gap-1 self-end">
      {onSave ? (
        <button
          type="button"
          aria-label="Edit comment"
          title="Edit comment"
          onClick={() => setEditing(true)}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover/comment:opacity-100 [&_svg]:size-3"
        >
          <Pencil aria-hidden="true" />
        </button>
      ) : null}
      <ChatBubble>{text}</ChatBubble>
    </span>
  )
}

/**
 * One annotation in the full-list view, read as a tiny thread: the lifted
 * passage is the document's message, the user's comments are their replies.
 * In the pending view the passage selects for follow-up comments, comments
 * edit in place, and the row removes; the sent view is read-only.
 */
function AnnotationThread({
  quote,
  selected = false,
  onSelect,
  onRemove,
  onOpenSource,
  onEditComment,
}: {
  quote: PendingQuote
  /** Marks this annotation as the one the composer replies to. */
  selected?: boolean
  /** Selects (or deselects) this annotation for follow-up comments. */
  onSelect?: () => void
  /** Omitted in the read-only view of a sent message's annotations. */
  onRemove?: () => void
  /** Opens the document this passage was lifted from. */
  onOpenSource?: () => void
  /** Replaces one comment's text; omitted in the read-only view. */
  onEditComment?: (index: number, text: string) => void
}) {
  const sourceName = quote.sourceId
    ? slashItemForId(quote.sourceId)
    : undefined
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1 rounded-2xl p-1 transition-colors",
          selected && "bg-(--nessa-chat-accent)/10",
        )}
      >
        <ChatMessage tone="received" className="max-w-full">
          <ChatBubble
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            title={onSelect ? "Reply to this annotation" : undefined}
            onClick={onSelect}
            onKeyDown={
              onSelect
                ? (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    onSelect()
                  }
                : undefined
            }
            className={onSelect ? "cursor-pointer px-4 py-2.5" : "px-4 py-2.5"}
          >
            {/* The kit's markdown renderer — pasted markdown, long typed
                text, and lifted passages all read formatted here. */}
            <MessageMarkdown className="leading-5">{quote.text}</MessageMarkdown>
          </ChatBubble>
          {sourceName && onOpenSource ? (
            <button
              type="button"
              onClick={onOpenSource}
              className="self-start rounded-full border-0 bg-transparent p-0 px-1 font-sans nessa-text-1 text-(--nessa-chat-accent) outline-none hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {chipFileMock(sourceName).name}
            </button>
          ) : null}
        </ChatMessage>
        {quote.comments?.map((comment, index) => (
          <ChatMessage key={index} tone="sent" className="max-w-full self-end">
            <EditableCommentBubble
              text={comment}
              onSave={
                onEditComment
                  ? (next) => onEditComment(index, next)
                  : undefined
              }
            />
          </ChatMessage>
        ))}
      </div>
      {onRemove ? (
        <button
          type="button"
          aria-label="Discard quoted selection"
          onClick={onRemove}
          className="mt-1.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3"
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

/**
 * A small-surface host: an iMessage-style transcript over the pill
 * composer. Enter is the only send affordance; tapping a bubble starts a
 * reply, quoted through the composer's attachment primitives; and typing
 * /model raises the closable in-chat model card instead of spending pill
 * space on a standing picker. The rim lights while the "agent" works and a
 * canned reply lands.
 */
function PlaygroundExample({
  replyDelay = 900,
  initialTabId = "chat-1",
  initialQuotes = [],
}: {
  replyDelay?: number
  initialTabId?: string
  initialQuotes?: PendingQuote[]
}) {
  const [message, setMessage] = React.useState("")
  const [tabs, setTabs] = React.useState([
    { id: "chat-1", title: "Release notes" },
    { id: auditTabId, title: "Repo audit" },
  ] as { id: string; title: string; closeable?: boolean }[])
  const [activeTabId, setActiveTabId] = React.useState(initialTabId)
  const [messagesByTab, setMessagesByTab] = React.useState<
    Record<string, DemoMessage[]>
  >(seededMessagesByTab)
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
  // Passages lifted out of previewed documents — with any comments made on
  // them — attached to the next send.
  const [quotes, setQuotes] = React.useState<PendingQuote[]>(initialQuotes)
  // The full-list view of pending quotes, rendered live so removals and
  // expands reflect immediately.
  const [quotesOpen, setQuotesOpen] = React.useState(false)
  // A sent message's annotations opened read-only from its pill.
  const [viewedQuotes, setViewedQuotes] = React.useState<
    PendingQuote[] | null
  >(null)
  // The pending annotation the composer replies to while the list is open.
  const [selectedQuote, setSelectedQuote] = React.useState<number | null>(null)
  // The user message whose bubble is currently swapped for the editor.
  const [editingMessageId, setEditingMessageId] = React.useState<number | null>(
    null,
  )
  // Full text behind each pasted-text chip, keyed by chip id.
  const pastedTexts = React.useRef<Record<string, string>>({})
  /** Shows a full text in the list view — the transcript stays compact. */
  const openFullText = (text: string) => setViewedQuotes([{ text }])
  // Chips open their file directly: plain press previews in the current
  // tab, a modified press (Cmd/Ctrl) parks the file as its own tab.
  const openChipFromLabel = (label: string, newTab: boolean) => {
    const item = slashItemForLabel(label)
    if (!item) return
    setModelCardOpen(false)
    openChipPreview(item, newTab)
  }
  const [replyTarget, setReplyTarget] = React.useState<DemoMessage | null>(null)
  const [attachments, setAttachments] = React.useState<DemoAttachment[]>([])
  const [listening, setListening] = React.useState(false)
  const [microphone, setMicrophone] = React.useState("default")
  const [holdToRecord, setHoldToRecord] = React.useState(true)
  const [micMenuOpen, setMicMenuOpen] = React.useState(false)
  const holdingToRecord = React.useRef(false)
  // One overlay surface over the chat for anything full-screen — the
  // attachment grid, a file preview, whatever comes next. Whoever opens it
  // supplies the summary line and the content.
  const [overlay, setOverlay] = React.useState<{
    summary: string
    body: React.ReactNode
  } | null>(null)
  const openAttachmentsOverlay = (attachments: DemoAttachment[]) =>
    setOverlay({
      summary: attachmentSummary(attachments),
      body: attachments.map((attachment) => (
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
      )),
    })
  // Files previewed from chips live in the tab strip like subagents do:
  // one tab per file, the file-type glyph as the icon, closeable.
  const [fileTabs, setFileTabs] = React.useState<Record<string, SlashItem>>({})
  // A plain click previews in the current tab, replacing the transcript;
  // Cmd/Ctrl-click parks the file as its own tab instead.
  const [inlinePreview, setInlinePreview] = React.useState<SlashItem | null>(
    null,
  )
  const openChipPreview = (item: SlashItem, newTab: boolean) => {
    if (!newTab) {
      setInlinePreview(item)
      return
    }
    const tabId = `file:${item.id}`
    setFileTabs((current) => ({ ...current, [tabId]: item }))
    setTabs((current) =>
      current.some((tab) => tab.id === tabId)
        ? current
        : [
            ...current,
            { id: tabId, title: chipFileMock(item).name, closeable: true },
          ],
    )
    setActiveTabId(tabId)
  }
  const activeFileItem = fileTabs[activeTabId] ?? inlinePreview ?? undefined
  const [menuTargetId, setMenuTargetId] = React.useState<number | null>(null)
  const attachmentCounters = React.useRef<Record<DemoAttachmentKind, number>>({ photo: 0, file: 0, folder: 0, skill: 0, plugin: 0 })
  const inputRef = React.useRef<ChatComposerEditorHandle>(null)
  const logRef = React.useRef<HTMLDivElement>(null)
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

  // An overflowing transcript keeps its newest message in view: switching
  // tabs jumps to the end and new or streaming messages follow it.
  React.useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [activeTabId, messages])

  // The subagent whose conversation is on screen, when a sub: tab is active.
  const activeSubagent = activeTabId.startsWith("sub:")
    ? demoSubagents[activeTabId.slice("sub:".length)]
    : undefined

  /** Opens (or re-fronts) a subagent's conversation as its own tab. */
  const openSubagent = (id: string) => {
    const tabId = subagentTabId(id)
    setTabs((current) =>
      current.some((tab) => tab.id === tabId)
        ? current
        : [
            ...current,
            { id: tabId, title: demoSubagents[id]!.name, closeable: true },
          ],
    )
    setActiveTabId(tabId)
    setReplyTarget(null)
    setMenuTargetId(null)
    setOverlay(null)
    setModelCardOpen(false)
    setInlinePreview(null)
    setQuotes([])
    setQuotesOpen(false)
  }

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
      // The transcription streams into the real editor at the caret; the
      // editor reports the text back through onContentChange.
      inputRef.current?.insertText(word)
    }, 280)
    return () => clearInterval(interval)
  }, [listening])

  // While replying, the target's whole thread stays in focus — the message
  // itself, everything it transitively replies to, and every reply chained
  // onto it — and the rest of the transcript recedes, matching iMessage's
  // "just this thread" view.
  // Tapping a reply's quote chip focuses that thread without composing.
  const [focusedThreadId, setFocusedThreadId] = React.useState<number | null>(
    null,
  )
  const threadIds = React.useMemo(() => {
    const focusTarget =
      replyTarget ??
      (focusedThreadId !== null
        ? messages.find((entry) => entry.id === focusedThreadId)
        : undefined)
    if (!focusTarget) return null
    const ids = new Set<number>()
    let ancestor: DemoMessage | undefined = focusTarget
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
  }, [messages, replyTarget, focusedThreadId])

  // Escape leaves the reply view — or a focused thread — from anywhere.
  React.useEffect(() => {
    if (!replyTarget && focusedThreadId === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setReplyTarget(null)
      setFocusedThreadId(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [replyTarget, focusedThreadId])

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
        tabs={tabs.map((tab) => {
          // A subagent tab carries its watercolor avatar as the glyph; a
          // running subagent's avatar animates (busy), which already says
          // "working" — so the tab's own busy dot stays off for them.
          const sub = tab.id.startsWith("sub:")
            ? demoSubagents[tab.id.slice("sub:".length)]
            : undefined
          const fileItem = fileTabs[tab.id]
          return {
            ...tab,
            icon: fileItem ? (
              // The file-type glyph names the tab's content at a glance.
              fileItem.kind === "plugin" ? (
                <Braces aria-hidden="true" />
              ) : (
                <FileText aria-hidden="true" />
              )
            ) : sub ? (
              // On the tab you are already inside, hovering swaps the
              // avatar for a back glyph: clicking the active subagent tab
              // returns to the conversation that spawned it (handled in
              // onValueChange, since re-selecting it is otherwise a no-op).
              <span className="relative flex size-4 items-center justify-center">
                <RandomAvatar
                  seed={sub.id}
                  busy={sub.status === "running"}
                  className={cn(
                    "size-4",
                    tab.id === activeTabId &&
                      "[[data-slot=chat-tab]:hover_&]:opacity-0",
                  )}
                />
                {tab.id === activeTabId ? (
                  <ChevronLeft
                    aria-hidden="true"
                    className="absolute inset-0 m-auto hidden size-3.5 text-foreground [[data-slot=chat-tab]:hover_&]:block"
                  />
                ) : null}
              </span>
            ) : (
              // Every conversation is an agent: each chat tab carries its
              // own watercolor avatar, seeded by the conversation id.
              <RandomAvatar seed={tab.id} className="size-4" />
            ),
            loading: sub ? false : generatingTabId === tab.id,
          }
        })}
        value={activeTabId}
        onValueChange={(id) => {
          // Any tab click leaves an in-place file preview first.
          if (inlinePreview) {
            setInlinePreview(null)
            if (id === activeTabId) return
          }
          // Re-selecting the subagent tab you are inside goes back to the
          // conversation that spawned it — the hover back glyph's action.
          const target =
            id === activeTabId && id.startsWith("sub:") ? auditTabId : id
          setActiveTabId(target)
          setReplyTarget(null)
          setMenuTargetId(null)
          setOverlay(null)
          setModelCardOpen(false)
          setQuotesOpen(false)
          setViewedQuotes(null)
          setFocusedThreadId(null)
          setEditingMessageId(null)
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
          setFileTabs((current) => {
            const { [id]: _closed, ...rest } = current
            return rest
          })
        }}
        onNew={() => {
          // nextId starts at 1, and "chat-1" already exists — offset new
          // tab ids so the first + click can never mint a duplicate key.
          const id = `chat-${1 + nextId.current++}`
          setTabs((current) => [
            ...current,
            { id, title: "New chat", closeable: true },
          ])
          setActiveTabId(id)
          setReplyTarget(null)
          setMenuTargetId(null)
          setOverlay(null)
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
        // Positioned, so the overlay replaces only the transcript surface —
        // the tab strip and the pill stay visible and usable around it.
        className="relative flex min-h-0 flex-1 flex-col"
      >
      {activeFileItem ? (
        // A file replaces the transcript only — the tab strip stays, and in
        // the current tab the composer stays too, so a selected passage can
        // be added to the chat and discussed in place.
        <DocumentSurface
          item={activeFileItem}
          // Both actions leave the document open for further selections;
          // Comment additionally hands focus to the composer (jumping back
          // to the conversation from a file tab, which has no composer).
          onAttach={(text) =>
            setQuotes((current) => [
              ...current,
              { text, sourceId: activeFileItem.id },
            ])
          }
          // A comment attaches too — nothing sends until the user sends.
          onComment={(text, comment) =>
            setQuotes((current) => [
              ...current,
              { text, comments: [comment], sourceId: activeFileItem.id },
            ])
          }
        />
      ) : (
      <div
        ref={logRef}
        aria-label="Conversation"
        role="log"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Bottom-anchors a short transcript without justify-end, which
            would trap overflowing messages above an unscrollable top. */}
        <div aria-hidden="true" className="mt-auto shrink-0" />
        {activeSubagent ? (
          // A plain provenance caption — the way back lives on the tab:
          // hovering the active subagent tab reveals the back glyph.
          <p className="m-0 self-center px-2.5 py-1 text-center font-sans nessa-text-1 text-muted-foreground">
            Subagent · {activeSubagent.task}
          </p>
        ) : null}
        {messages.map((entry) => (
          <React.Fragment key={entry.id}>
          <DemoBubble
            message={entry}
            delivered={entry.id === lastUserId}
            onOpenAttachments={openAttachmentsOverlay}
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
            onChipOpen={openChipFromLabel}
            onQuotePress={
              entry.replyToId !== undefined
                ? () =>
                    setFocusedThreadId((current) =>
                      current === entry.replyToId ? null : entry.replyToId!,
                    )
                : undefined
            }
            onQuoteSourceOpen={(sourceId) => {
              const item = slashItemForId(sourceId)
              if (item) openChipPreview(item, false)
            }}
            onQuotesOpen={setViewedQuotes}
            onPastedOpen={(chipId) => {
              const full = pastedTexts.current[chipId]
              if (full) openFullText(full)
            }}
            onLongOpen={openFullText}
            editing={editingMessageId === entry.id}
            onEditStart={
              entry.role === "user"
                ? () => setEditingMessageId(entry.id)
                : undefined
            }
            onEditSave={(text) => {
              updateMessages(activeTabId, (current) =>
                current.map((message) =>
                  message.id === entry.id ? { ...message, text } : message,
                ),
              )
              setEditingMessageId(null)
            }}
            onEditCancel={() => setEditingMessageId(null)}
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
          {entry.spawned ? (
            <div className="me-8 mt-1.5 flex max-w-[85%] flex-col gap-1.5 self-start">
              {entry.spawned.map((id) => (
                <SubagentChip
                  key={id}
                  sub={demoSubagents[id]!}
                  onOpen={() => openSubagent(id)}
                />
              ))}
            </div>
          ) : null}
          </React.Fragment>
        ))}
        {generating && !messages.some((message) => message.streaming) ? (
          <ChatTypingIndicator label="Assistant is typing" />
        ) : null}
      </div>
      )}
      {overlay ? (
        <ChatAttachmentViewer
          summary={overlay.summary}
          onClose={() => setOverlay(null)}
        >
          {overlay.body}
        </ChatAttachmentViewer>
      ) : null}
      {quotesOpen || viewedQuotes ? (
        // The annotations read as messages over the transcript — pending
        // ones removable, a sent message's read-only — and the way back is
        // spelled out where the summary line used to be.
        <div className="absolute inset-0 z-10 flex flex-col bg-background">
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-2 text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(viewedQuotes ?? quotes).map((entry, at) => (
              <AnnotationThread
                key={at}
                quote={entry}
                selected={!viewedQuotes && selectedQuote === at}
                onSelect={
                  viewedQuotes
                    ? undefined
                    : () =>
                        setSelectedQuote((current) =>
                          current === at ? null : at,
                        )
                }
                onRemove={
                  viewedQuotes
                    ? undefined
                    : () => {
                        const next = quotes.filter(
                          (_, index2) => index2 !== at,
                        )
                        setQuotes(next)
                        setSelectedQuote(null)
                        if (next.length === 0) setQuotesOpen(false)
                      }
                }
                onOpenSource={
                  entry.sourceId && slashItemForId(entry.sourceId)
                    ? () => {
                        setQuotesOpen(false)
                        setViewedQuotes(null)
                        setSelectedQuote(null)
                        openChipPreview(slashItemForId(entry.sourceId!)!, false)
                      }
                    : undefined
                }
                onEditComment={
                  viewedQuotes
                    ? undefined
                    : (index, text) =>
                        setQuotes((current) =>
                          current.map((quote, index2) =>
                            index2 === at
                              ? {
                                  ...quote,
                                  comments: quote.comments?.map(
                                    (comment, index3) =>
                                      index3 === index ? text : comment,
                                  ),
                                }
                              : quote,
                          ),
                        )
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setQuotesOpen(false)
              setViewedQuotes(null)
              setSelectedQuote(null)
            }}
            className="mx-auto shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-3 py-1.5 font-sans nessa-text-2 font-medium text-(--nessa-chat-accent) outline-none hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Back to chat
          </button>
        </div>
      ) : null}
      </div>
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
      {quotes.length > 0 && !quotesOpen && !viewedQuotes && !overlay ? (
        // One quote pill stands for the whole set — it, or "+ N other",
        // opens the full list over the transcript.
        <div className="flex max-w-full items-center gap-1.5 self-start">
          <button
            type="button"
            title={
              quotes[0]!.comments?.length
                ? `${quotes[0]!.comments[0]} — “${quotes[0]!.text}”`
                : quotes[0]!.text
            }
            aria-label={`Quoted selection: ${quotes[0]!.text}`}
            onClick={() => setQuotesOpen(true)}
            className="inline-flex min-w-0 cursor-pointer items-center rounded-full border-0 bg-transparent p-0 text-start font-sans outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChatMessageQuote className="m-0 inline-block max-w-52 truncate whitespace-nowrap">
              {quotes[0]!.comments?.[0] ?? quotes[0]!.text}
            </ChatMessageQuote>
          </button>
          {quotes.length > 1 ? (
            <button
              type="button"
              onClick={() => setQuotesOpen(true)}
              className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border-0 bg-transparent p-0 font-sans nessa-text-1 text-muted-foreground outline-none hover:text-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              + {quotes.length - 1} other{quotes.length > 2 ? "s" : ""}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Discard quoted selections"
            title="Discard quoted selections"
            onClick={() => setQuotes([])}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {fileTabs[activeTabId] ? null : (
      <PillComposer
        generating={generating}
        onSubmit={(event) => {
          event.preventDefault()
          const content = inputRef.current?.getContent()
          const text = (content?.text ?? message).trim()
          // Chips travel with the message: the bubble re-renders them with
          // their icons instead of flattening to plain text — and a chip
          // alone is a sendable message.
          const hasChips = Boolean(
            content?.parts.some((part) => part.type === "chip"),
          )
          // With the annotation list open and one selected, the send is a
          // follow-up comment attaching to that annotation, not a message.
          if (quotesOpen && selectedQuote !== null) {
            if (!text) return
            setQuotes((current) =>
              current.map((quote, index) =>
                index === selectedQuote
                  ? { ...quote, comments: [...(quote.comments ?? []), text] }
                  : quote,
              ),
            )
            inputRef.current?.clear()
            setMessage("")
            return
          }
          if (
            (!text && attachments.length === 0 && quotes.length === 0 && !hasChips) ||
            generatingTabId !== null ||
            // A dedicated file tab has no conversation to send into.
            fileTabs[activeTabId] !== undefined
          )
            return
          updateMessages(activeTabId, (current) => [
            ...current,
            {
              id: nextId.current++,
              role: "user",
              text,
              parts: hasChips ? content?.parts : undefined,
              quotes: quotes.length > 0 ? quotes : undefined,
              replyTo: replyTarget?.text,
              replyToId: replyTarget?.id,
              attachments: attachments.length > 0 ? attachments : undefined,
            },
          ])
          inputRef.current?.clear()
          setMessage("")
          setAttachments([])
          setReplyTarget(null)
          setQuotes([])
          setQuotesOpen(false)
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
                onOpen={() => openAttachmentsOverlay([attachment])}
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
          {/* The rich editor in place of the plain textarea: skills and
              plugins land as inline chips on the text baseline, exactly as
              in the ChatComposerEditor catalog story; only files, photos,
              and folders use the tile row above. */}
          <ChatComposerEditor
            ref={inputRef}
            onContentChange={(content) => setMessage(content.text)}
            onChipPress={(chip) => {
              if (chip.kind === "pasted-text") {
                const full = pastedTexts.current[chip.id]
                if (full) openFullText(full)
                return
              }
              openChipFromLabel(chip.label, false)
            }}
            pasteAttachmentMinLength={120}
            onPasteAttachment={(pasted) => {
              const id = `pasted-${nextId.current++}`
              pastedTexts.current[id] = pasted
              inputRef.current?.insertChip({
                id,
                kind: "pasted-text",
                label: `Pasted text (${pasted.length} chars)`,
                textValue: "",
                className: "font-medium text-(--nessa-chat-accent)",
              })
            }}
            placeholder={
              quotesOpen && selectedQuote !== null
                ? "Reply to the annotation…"
                : replyTarget
                  ? "Reply"
                  : activeSubagent
                    ? `Message ${activeSubagent.name}…`
                    : "Ask me anything"
            }
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
                // Skills and plugins are inline chips on the text baseline,
                // like the main composer; only files, photos, and folders
                // use the tile row above the input.
                inputRef.current?.insertChip({
                  id: `chip-${nextId.current++}`,
                  kind: item.kind,
                  label: item.label,
                  icon: item.icon,
                  className: "font-medium text-(--nessa-chat-accent)",
                })
              }}
              listLabel="Commands, skills, and plugins"
              emptyMessage="No matching commands"
            />
          )}
        </ChatComposerTrigger>
      </PillComposer>
      )}
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
    await waitFor(() => expect(input.textContent ?? "").toBe(""))
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
    // Settle before asserting the end state: the rim's fade is a Web
    // Animation, and polling its computed opacity inside `waitFor`'s default
    // one-second window samples a frame still converging on a loaded runner.
    await waitForSettledAnimations(canvasElement)
    await waitFor(() => {
      expect(getComputedStyle(rim).opacity).toBe("0")
    })
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
    await expect(input).toHaveAttribute("data-placeholder", "Ask me anything")
    await userEvent.click(await body.findByRole("menuitem", { name: "Reply" }))
    await expect(input).toHaveAttribute("data-placeholder", "Reply")
    const firstMessage = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-message"]',
    )!
    await waitFor(() => {
      expect(getComputedStyle(firstMessage).filter).toContain("blur")
    })
    await userEvent.keyboard("{Escape}")
    await expect(input).toHaveAttribute("data-placeholder", "Ask me anything")
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
    await expect(input).toHaveAttribute("data-placeholder", "Reply")
    await waitFor(() => {
      expect(input).toHaveFocus()
    })
    await userEvent.type(input, "thanks{enter}")
    await expect(
      canvas.getByLabelText("Reply to: thanks"),
    ).toBeInTheDocument()
    await expect(input).toHaveAttribute("data-placeholder", "Ask me anything")
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
    // Same ordering as above: the fade has to finish before its landing
    // value can be asserted, or a slow runner reads a mid-fade frame.
    await waitForSettledAnimations(canvasElement)
    await waitFor(() => {
      expect(getComputedStyle(rim).opacity).toBe("0")
    })
    await userEvent.type(input, "/mod")
    await userEvent.click(await body.findByRole("option", { name: /model/ }))
    await waitFor(() => expect(input.textContent ?? "").toBe(""))
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
      expect(input.textContent ?? "").toContain("Draft")
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
    await expect(input).toHaveAttribute("data-placeholder", "Ask me anything")
    await userEvent.type(input, " tomorrow")
    await expect(input.textContent ?? "").toMatch(/ tomorrow$/)
    await waitForSettledAnimations(canvasElement)
  },
}

export const Subagents: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The playground opened on the seeded Repo audit tab, where an agent turn split its work across two subagents. Each subagent renders as a drill-in chip under the spawning bubble — watercolor avatar, name, and status, the avatar animating while it runs — and clicking one opens that subagent's own conversation as a closeable tab whose glyph is the same animating avatar, so no busy dot is needed. Inside, hovering the active subagent tab swaps its avatar for a back glyph, and clicking it returns to the parent conversation; the caption above the transcript names the subagent's task, the composer retargets to the subagent, and every chat capability — tapbacks, replies, dictation — works unchanged.",
  ),
  render: () => <PlaygroundExample initialTabId={auditTabId} />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    // The seeded audit conversation surfaces both subagent chips.
    const reviewerChip = await canvas.findByRole("button", {
      name: /Reviewer.*Running/,
    })
    await expect(
      canvas.getByRole("button", { name: /Explorer.*Done/ }),
    ).toBeInTheDocument()
    // Drilling in opens the subagent as a closeable tab and swaps the
    // transcript to its conversation; a running subagent's tab shows no
    // busy dot — its animating avatar already carries that meaning.
    await userEvent.click(reviewerChip)
    const reviewerTab = await canvas.findByRole("tab", { name: /Reviewer/ })
    await expect(reviewerTab).toHaveAttribute("aria-selected", "true")
    await expect(
      reviewerTab.querySelector('[data-slot="chat-tab-loading"]'),
    ).toBeNull()
    await expect(
      canvas.getByText(/Two findings so far/),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("textbox", { name: "Message" }),
    ).toHaveAttribute("data-placeholder", "Message Reviewer…")
    // The provenance caption names the task; the way back is the tab
    // itself — re-selecting the subagent tab you are inside (the hover
    // back glyph's action) returns to the spawning conversation.
    await expect(
      canvas.getByText(/Subagent · Review the transcript diff/),
    ).toBeInTheDocument()
    await userEvent.click(reviewerTab)
    await expect(
      canvas.getByText(/Explorer is back — nine call sites/),
    ).toBeInTheDocument()
    // The Reviewer tab stays parked in the strip for hopping back.
    await expect(
      canvas.getByRole("tab", { name: /Reviewer/ }),
    ).toHaveAttribute("aria-selected", "false")
    // The messages pop in on a transition; the a11y pass that follows the
    // play reads computed colors, so the finite animations must settle
    // first. The busy subagent avatars animate forever by design, so only
    // finite animations count here.
    await waitFor(() => {
      const running = canvasElement
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.effect?.getTiming().iterations !== Infinity,
        )
      expect(running).toHaveLength(0)
    }, { timeout: 4000 })
  },
}

export const Annotations: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The pending-annotation surfaces under load: the playground opens on the Repo audit conversation with eight selections already lifted from documents — one-liners, full paragraphs, comments of very different lengths, some bare. The row above the pill stays one truncated pill plus '+ 7 others'; opening it shows each annotation as a tiny thread — the passage as the document's message with its source file linked beneath, the user's comments as their replies. Tapping a passage selects it and the pill composer replies to it, attaching follow-up comments; hovering a comment reveals its edit control and the comment edits in place. Sending delivers the whole set as one compact 'N annotations' pill on the message, and user messages in the transcript edit in place too, from the context menu's Edit. Big text stays compact everywhere: a paste over 120 characters lands as a Pasted text chip in the composer and travels as the same chip on the sent bubble, and a long typed message clamps to four lines with a chevron — either opens its full text in the list view over the transcript.",
  ),
  render: () => (
    <PlaygroundExample
      initialTabId={auditTabId}
      initialQuotes={seededAnnotations}
    />
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    // The row compresses the whole set into one pill plus a count.
    const more = await canvas.findByRole("button", { name: "+ 7 others" })
    await userEvent.click(more)
    // Every annotation reads as a bubble; comments sit beneath their quotes.
    await expect(
      canvas.getByText(/Way too long for one step/),
    ).toBeInTheDocument()
    await expect(
      canvas.getByText(/machine-readable variant/),
    ).toBeInTheDocument()
    await expect(
      canvas.getAllByRole("button", { name: "Discard quoted selection" }),
    ).toHaveLength(8)
    // Removing one keeps the list live.
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Discard quoted selection" })[1]!,
    )
    await expect(
      canvas.getAllByRole("button", { name: "Discard quoted selection" }),
    ).toHaveLength(7)
    await userEvent.click(canvas.getByRole("button", { name: "Back to chat" }))
    await expect(
      canvas.getByRole("button", { name: "+ 6 others" }),
    ).toBeInTheDocument()
    // The a11y pass that follows reads computed colors, so the finite
    // animations must settle first; the busy subagent avatars animate
    // forever by design, so only finite animations count here.
    await waitFor(() => {
      const running = canvasElement
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.effect?.getTiming().iterations !== Infinity,
        )
      expect(running).toHaveLength(0)
    }, { timeout: 4000 })
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
    // The rim's own animations have to drain before its resting opacity is
    // meaningful; asserting first samples the fade mid-flight.
    await waitFor(
      () => {
        expect(rim.getAnimations({ subtree: true })).toHaveLength(0)
      },
      { timeout: 4000 },
    )
    await expect(getComputedStyle(rim).opacity).toBe("0")
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
      expect(input.textContent ?? "").toContain("Draft")
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
    await waitFor(() => expect(input.textContent ?? "").toBe(""))
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
