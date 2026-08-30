"use client"

import * as React from "react"
import { ArrowLeft, ChevronRight, LayoutGrid } from "lucide-react"

import { Button } from "./button"
import { cn } from "@/lib/utils"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

/** Returns the live, server-safe reduced-motion preference. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

/** Parses a CSS duration token value into milliseconds. */
function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

/** Runs the host's handler first; ours follows unless the host prevented default. */
function composeHandler<E extends { defaultPrevented: boolean }>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
) {
  return (event: E) => {
    theirs?.(event)
    if (!event.defaultPrevented) ours(event)
  }
}

const chatBubblesFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

export type ChatMessageTone = "sent" | "received"

const ChatMessageContext = React.createContext<{
  tone: ChatMessageTone
  threadFocused: boolean
}>({ tone: "received", threadFocused: false })

export interface ChatMessageProps extends React.ComponentProps<"div"> {
  /** Chooses side, alignment, and bubble palette: `sent` right, `received` left. */
  tone: ChatMessageTone
  /**
   * Recedes the message while another holds the viewer's attention:
   * `true` is the frosted blur-and-fade of the reply thread view, and
   * `"soft"` is the lighter opacity-only dim used while a tapback menu is
   * open, matching iMessage.
   */
  dimmed?: boolean | "soft"
  /** Springs the message up from the composer's corner on mount. Defaults to true. */
  animateIn?: boolean
  /**
   * Marks the message as part of the actively focused reply thread. Its
   * quote hides — the replied-to message is already visible in the thread —
   * and hosts typically pair this with `dimmed` on every other message.
   */
  threadFocused?: boolean
}

/**
 * One transcript entry: an aligned column that holds a message's quote,
 * attachments, bubble, and receipt, and provides its tone to them. The
 * mount animation is the iMessage send gesture — a small spring up from the
 * composer's corner — skipped under reduced motion.
 */
function ChatMessage({
  tone,
  dimmed = false,
  animateIn = true,
  threadFocused = false,
  className,
  children,
  ...props
}: ChatMessageProps) {
  const context = React.useMemo(
    () => ({ tone, threadFocused }),
    [threadFocused, tone],
  )
  const reducedMotion = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || !animateIn || typeof node.animate !== "function") return
    // Read the live preference here rather than the captured render value:
    // the hydration render reports the server snapshot.
    if (window.matchMedia(reducedMotionQuery).matches) return
    const duration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue("--nessa-motion-duration-normal"),
      260,
    )
    if (duration === 0) return
    const animation = node.animate(
      [
        { opacity: 0, translate: "0 14px", scale: "0.84" },
        { opacity: 1, translate: "0 0", scale: "1" },
      ],
      { duration, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.15)" },
    )
    return () => animation.cancel()
    // The entrance runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <ChatMessageContext.Provider value={context}>
      <div
        ref={ref}
        data-slot="chat-message"
        data-tone={tone}
        data-dimmed={
          dimmed === true ? "frost" : dimmed === "soft" ? "soft" : undefined
        }
        data-thread-focused={threadFocused || undefined}
        className={cn(
          // The row is the hover group and the positioning context for
          // ChatMessageActions, which hangs under the bubble without taking
          // layout space.
          "group/message relative flex max-w-[85%] flex-col font-sans",
          tone === "sent"
            ? "origin-bottom-right items-end self-end"
            : "origin-bottom-left items-start self-start",
          "transition-[opacity,filter] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
          dimmed === true && "opacity-40 blur-[5px] saturate-[0.7]",
          dimmed === "soft" && "opacity-55",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ChatMessageContext.Provider>
  )
}

/**
 * The small outlined quote above a bubble that replies to another message.
 * Inside a focused thread it renders nothing: the replied-to message is
 * already on screen, so repeating it is noise.
 */
function ChatMessageQuote({ className, ...props }: React.ComponentProps<"span">) {
  const { threadFocused } = React.useContext(ChatMessageContext)
  if (threadFocused) return null
  return (
    <span
      data-slot="chat-message-quote"
      className={cn(
        "mb-1 max-w-full truncate rounded-2xl border border-border px-3 py-1 font-sans nessa-text-2 leading-4 text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export interface ChatBubbleProps
  extends Omit<React.ComponentProps<"button">, "onSelect"> {
  /**
   * Makes the bubble selectable — typically "focus this thread to reply or
   * react". It fires on right-click, on long-press (the browser's contextmenu
   * gesture on touch), and on keyboard activation; a plain mouse click stays
   * inert so ordinary reading interactions never hijack the transcript.
   */
  onSelect?: () => void
  /** A tapback reaction badge pinned to the bubble's top corner, e.g. "❤️". */
  reaction?: React.ReactNode
  /**
   * Caps a long message at this many lines so one paste cannot flood the
   * transcript. Pair it with `onExpand` to offer the whole text elsewhere —
   * a ChatOverlay reading view — which adds a trailing chevron and makes the
   * clamped text activatable.
   */
  clampLines?: 2 | 3 | 4 | 5 | 6
  /**
   * Opens the full text of a clamped bubble. Ignored without `clampLines`,
   * and ignored alongside `onSelect`: a bubble that is itself a control
   * cannot nest one, so a selectable bubble still clamps but hands its
   * expand affordance to the message's ChatMessageActions row instead.
   */
  onExpand?: () => void
}

// Static class names, so Tailwind's scanner sees every clamp the API allows.
const clampLineClasses = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
} as const

/**
 * The message bubble itself: iMessage blue for sent, the theme's accent for
 * received. With `onSelect` the bubble is a real button (the accessible
 * name should come from `aria-label`); it deliberately carries no hover
 * wash — focus-visible keeps keyboard users oriented.
 */
function ChatBubble({
  onSelect,
  reaction,
  clampLines,
  onExpand,
  className,
  children,
  ...props
}: ChatBubbleProps) {
  const { tone } = React.useContext(ChatMessageContext)
  // Touch long-press fires contextmenu natively (and Radix's ContextMenu
  // trigger adds its own touch handling), but a mouse click-and-hold does
  // not — synthesize it so long-press works with every pointer.
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearLongPress = React.useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }, [])
  React.useEffect(() => clearLongPress, [clearLongPress])
  // Tracks whether the upcoming click began as a real pointer press. A
  // click with no preceding pointerdown came from the keyboard or from
  // assistive tech synthesizing activation — those must select, while
  // plain pointer clicks stay inert.
  const pointerPressedRef = React.useRef(false)
  const {
    onPointerDown: hostPointerDown,
    onPointerUp: hostPointerUp,
    onPointerLeave: hostPointerLeave,
    onClick: hostClick,
    onContextMenu: hostContextMenu,
    onKeyDown: hostKeyDown,
    ...rest
  } = props
  const longPressHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      // The pressed flag is bookkeeping, not behavior — it records that a
      // real pointer press happened regardless of whether the host
      // preventDefaults the event.
      pointerPressedRef.current = true
      composeHandler(
        hostPointerDown as
          | ((event: React.PointerEvent<HTMLElement>) => void)
          | undefined,
        (composed: React.PointerEvent<HTMLElement>) => {
          if (composed.pointerType !== "mouse" || composed.button !== 0) return
          const { currentTarget, clientX, clientY } = composed
          clearLongPress()
          longPressTimer.current = setTimeout(() => {
            currentTarget.dispatchEvent(
              new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
              }),
            )
          }, 500)
        },
      )(event)
    },
    onPointerUp: composeHandler(hostPointerUp, clearLongPress),
    onPointerLeave: composeHandler(
      hostPointerLeave,
      (event: React.PointerEvent<HTMLElement>) => {
        void event
        pointerPressedRef.current = false
        clearLongPress()
      },
    ),
    // Touch long-press ends in pointercancel, not pointerup — without this
    // the stale timer could fire and the pressed flag would stick.
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
      void event
      pointerPressedRef.current = false
      clearLongPress()
    },
  }
  const reactionBadge = reaction ? (
    <span
      data-slot="chat-reaction"
      className={cn(
        "absolute -top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 font-sans nessa-text-2 text-accent-foreground shadow-xs",
        tone === "sent" ? "-left-2" : "-right-2",
      )}
    >
      {reaction}
    </span>
  ) : null
  // A clamped bubble reads as a preview of itself: the text truncates at the
  // line cap and a chevron points at the reading view the host opens.
  // Nesting a control inside the bubble-as-button would be invalid content
  // and a second tab stop for one visual control.
  const expand =
    clampLines === undefined || onSelect !== undefined ? undefined : onExpand
  const content =
    clampLines === undefined ? (
      children
    ) : (
      <span
        data-slot="chat-bubble-clamp"
        role={expand ? "button" : undefined}
        tabIndex={expand ? 0 : undefined}
        onClick={
          expand
            ? (event) => {
                event.stopPropagation()
                expand()
              }
            : undefined
        }
        onKeyDown={
          expand
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return
                event.preventDefault()
                event.stopPropagation()
                expand()
              }
            : undefined
        }
        className={cn(
          "flex items-end gap-1",
          expand && cn("cursor-pointer", chatBubblesFocusClassName),
        )}
      >
        <span className={clampLineClasses[clampLines]}>{children}</span>
        {expand ? (
          <ChevronRight
            aria-hidden="true"
            className="mb-0.5 size-3.5 shrink-0 opacity-80"
          />
        ) : null}
      </span>
    )
  const bubbleClassName = cn(
    "relative max-w-full rounded-[1.125rem] px-3 py-1.5 text-left font-sans nessa-text-4 leading-5",
    // The badge protrudes 12px above the bubble; reserve that room so it
    // never overlaps the previous message.
    reaction != null && "mt-3",
    // The sent blue is the fixed chat identity: --nessa-chat-accent holds
    // the same value in both themes, and #0071e3 keeps 4.5:1 with white.
    tone === "sent"
      ? "bg-(--nessa-chat-accent) text-white"
      : "bg-accent text-accent-foreground",
    className,
  )
  if (!onSelect) {
    return (
      <span
        data-slot="chat-bubble"
        data-tone={tone}
        className={bubbleClassName}
        {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
        onClick={hostClick as React.MouseEventHandler<HTMLElement> | undefined}
        onContextMenu={
          hostContextMenu as React.MouseEventHandler<HTMLElement> | undefined
        }
        onKeyDown={
          hostKeyDown as React.KeyboardEventHandler<HTMLElement> | undefined
        }
        {...longPressHandlers}
      >
        {content}
        {reactionBadge}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-slot="chat-bubble"
      data-tone={tone}
      onClick={(event) => {
        // Flag bookkeeping runs unconditionally; only the selection itself
        // honors a host preventDefault.
        const fromPointer = pointerPressedRef.current
        pointerPressedRef.current = false
        composeHandler(hostClick, () => {
          // A click that never saw a pointer press came from the keyboard
          // or assistive tech — activate; plain pointer clicks stay inert.
          if (!fromPointer) onSelect()
        })(event)
      }}
      onKeyDown={composeHandler(hostKeyDown, (event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onSelect()
      })}
      onContextMenu={composeHandler(hostContextMenu, (event) => {
        event.preventDefault()
        onSelect()
      })}
      {...longPressHandlers}
      className={cn(
        bubbleClassName,
        "cursor-pointer border-0",
        chatBubblesFocusClassName,
      )}
      {...rest}
    >
      {content}
      {reactionBadge}
    </button>
  )
}

/** The delivery receipt line under the most recent sent bubble. */
function ChatMessageReceipt({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="chat-message-receipt"
      className={cn(
        "mt-1 px-1 font-sans nessa-text-2 text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

/**
 * The row of per-message affordances — copy, edit, retry, fork — that hangs
 * under a bubble and reveals itself on hover or keyboard focus. It is
 * absolutely positioned, so the transcript's rhythm never shifts as the row
 * appears, and it aligns to its message's side on its own. The delivery
 * receipt belongs in here too: a transcript that shows "Delivered" only while
 * the pointer is on the message carries no standing chrome. On touch, where
 * there is no hover, the row stays visible.
 *
 * The row's top padding is deliberate rather than a margin: it bridges the
 * gap between bubble and actions with the row's own hit area, so the pointer
 * can travel down to a control without leaving the hover group.
 */
function ChatMessageActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { tone } = React.useContext(ChatMessageContext)
  return (
    <div
      data-slot="chat-message-actions"
      className={cn(
        // With a fine pointer the row hangs under the bubble so the
        // transcript's rhythm never shifts as it appears. On touch, where it
        // is always visible, it takes real space instead — overlaying there
        // would put its controls on top of the next message.
        "flex items-center gap-0.5 pt-0.5 transition-opacity",
        "[@media(hover:hover)_and_(pointer:fine)]:absolute [@media(hover:hover)_and_(pointer:fine)]:top-full [@media(hover:hover)_and_(pointer:fine)]:z-10",
        tone === "sent"
          ? "self-end [@media(hover:hover)_and_(pointer:fine)]:right-0"
          : "self-start [@media(hover:hover)_and_(pointer:fine)]:left-0",
        // A receipt dropped in this row sheds the standing spacing it needs
        // when it sits directly under a bubble.
        "[&>[data-slot=chat-message-receipt]]:mt-0 [&>[data-slot=chat-message-receipt]]:pe-1",
        "[@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:focus-within:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:focus-within:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-hover/message:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

/** One icon control inside ChatMessageActions; `aria-label` names it. */
function ChatMessageAction({
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type={type}
      data-slot="chat-message-action"
      className={cn(
        "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-3",
        chatBubblesFocusClassName,
        className,
      )}
      {...props}
    />
  )
}

export interface ChatBubbleEditorProps
  extends Omit<
    React.ComponentProps<"textarea">,
    "value" | "defaultValue" | "onChange" | "rows" | "ref"
  > {
  /** The message text to edit; the caret opens after its last character. */
  defaultValue: string
  /** Commits the trimmed draft. Empty drafts cancel instead. */
  onSave: (text: string) => void
  /**
   * Leaves edit mode unchanged. Escape, an empty save, and losing focus all
   * call it — clicking away discards the draft rather than keeping a half-
   * edited message alive, so a host that needs a confirmation step should
   * own its own editing surface.
   */
  onCancel: () => void
}

/**
 * Editing a message in place, without the bubble changing shape: the bubble
 * keeps its tone, padding, and wrapping while its text becomes an editable
 * field that sizes itself to the content, so a two-line message stays two
 * lines under the caret. There are no save and cancel buttons — Enter
 * commits, Shift+Enter breaks the line, and Escape or clicking away cancels.
 */
function ChatBubbleEditor({
  defaultValue,
  onSave,
  onCancel,
  className,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel = "Edit message",
  ...props
}: ChatBubbleEditorProps) {
  const [draft, setDraft] = React.useState(defaultValue)
  // Callback ref rather than autoFocus: the caret belongs after the text, so
  // typing continues the message instead of prefixing it.
  const focusAtEnd = React.useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [])
  return (
    <ChatBubble className="max-w-full">
      <textarea
        ref={focusAtEnd}
        aria-label={ariaLabel}
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            // The transcript's own Enter and Escape handlers must not also
            // fire: this edit is the only thing the keystroke addresses.
            event.stopPropagation()
            const trimmed = draft.trim()
            if (trimmed) onSave(trimmed)
            else onCancel()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          }
        }}
        onBlur={(event) => {
          onBlur?.(event)
          if (!event.defaultPrevented) onCancel()
        }}
        className={cn(
          // field-sizing lets the textarea take exactly its content's shape,
          // so the editing bubble wraps and measures like the resting one.
          "block max-w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-sans nessa-text-4 leading-5 text-inherit outline-none [field-sizing:content]",
          className,
        )}
        {...props}
      />
    </ChatBubble>
  )
}

export interface ChatReactionOption {
  emoji: string
  /** The accessible name, announced as "React with <label>". */
  label: string
}

/** iMessage's tapback set — the picker's default options, exported so menu
 * hosts can rebuild the row as keyboard-reachable menu items. */
export const chatReactionOptions: readonly ChatReactionOption[] = [
  { emoji: "❤️", label: "love" },
  { emoji: "👍", label: "thumbs up" },
  { emoji: "👎", label: "thumbs down" },
  { emoji: "😂", label: "haha" },
  { emoji: "‼️", label: "emphasize" },
  { emoji: "❓", label: "question" },
  { emoji: "🙁", label: "sad" },
]

export interface ChatReactionPickerProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** The currently applied reaction emoji, highlighted in the row. */
  value?: string | null
  /** Receives the chosen emoji; hosts toggle it off when it matches `value`. */
  onSelect: (emoji: string) => void
  /** Replaces the default tapback set. */
  options?: readonly ChatReactionOption[]
}

/**
 * The iMessage tapback row: an accent pill of emoji reactions shown above a
 * focused bubble. The applied reaction sits on the sent-blue circle; hosts
 * decide where a chosen reaction lands (typically ChatBubble's `reaction`).
 */
function ChatReactionPicker({
  value = null,
  onSelect,
  options = chatReactionOptions,
  className,
  ...props
}: ChatReactionPickerProps) {
  const reducedMotion = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof node.animate !== "function") return
    if (window.matchMedia(reducedMotionQuery).matches) return
    // The iMessage tapback entrance: the pill pops in, then each emoji
    // springs up in a quick left-to-right cascade with a small overshoot.
    const animations = [
      node.animate(
        [
          { opacity: 0, scale: "0.5" },
          { opacity: 1, scale: "1.04" },
          { opacity: 1, scale: "1" },
        ],
        { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.2)" },
      ),
      ...Array.from(node.querySelectorAll("button")).map((emojiButton, index) =>
        emojiButton.animate(
          [
            { opacity: 0, scale: "0.2", translate: "0 6px" },
            { opacity: 1, scale: "1.25", translate: "0 -2px" },
            { opacity: 1, scale: "1", translate: "0 0" },
          ],
          {
            duration: 420,
            delay: 60 + index * 45,
            fill: "backwards",
            easing: "cubic-bezier(0.2, 0.9, 0.3, 1.3)",
          },
        ),
      ),
    ]
    return () => animations.forEach((animation) => animation.cancel())
    // The pop-in runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      ref={ref}
      role="group"
      aria-label="React with an emoji"
      data-slot="chat-reaction-picker"
      className={cn(
        // The row scrolls sideways once the tapback set outgrows it,
        // scrollbar hidden, like iMessage's.
        "flex w-fit max-w-60 origin-bottom items-center gap-1 overflow-x-auto rounded-full bg-accent px-1.5 py-1 shadow-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <button
          key={option.emoji}
          type="button"
          aria-label={`React with ${option.label}`}
          aria-pressed={value === option.emoji}
          onClick={() => onSelect(option.emoji)}
          className={cn(
            "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 font-sans nessa-text-6",
            value === option.emoji && "bg-(--nessa-chat-accent)",
            chatBubblesFocusClassName,
          )}
        >
          {option.emoji}
        </button>
      ))}
    </div>
  )
}

export interface ChatTypingIndicatorProps extends React.ComponentProps<"div"> {
  /** The announcement for assistive tech. Defaults to "Typing". */
  label?: string
}

/**
 * The iMessage typing indicator: a received-style bubble whose three dots
 * pulse in sequence. Under reduced motion the dots hold steady.
 */
function ChatTypingIndicator({
  label = "Typing",
  className,
  ...props
}: ChatTypingIndicatorProps) {
  const reducedMotion = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || reducedMotion) return
    if (typeof node.animate !== "function") return
    const dots = Array.from(node.querySelectorAll("[data-slot=chat-typing-dot]"))
    const animations = dots.map((dot, index) =>
      dot.animate(
        [
          { opacity: 0.35, translate: "0 0" },
          { opacity: 1, translate: "0 -2px" },
          { opacity: 0.35, translate: "0 0" },
        ],
        {
          duration: 1100,
          delay: index * 180,
          iterations: Infinity,
          easing: "ease-in-out",
        },
      ),
    )
    return () => animations.forEach((animation) => animation.cancel())
  }, [reducedMotion])
  return (
    <div
      ref={ref}
      role="status"
      aria-label={label}
      data-slot="chat-typing-indicator"
      className={cn(
        "flex items-center gap-1 self-start rounded-[1.125rem] bg-accent px-3.5 py-3",
        className,
      )}
      {...props}
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          data-slot="chat-typing-dot"
          className="size-2 rounded-full bg-muted-foreground opacity-35"
        />
      ))}
    </div>
  )
}

export interface ChatAttachmentTileProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  /** The attachment's name: the icon tile's caption and the accessible name. */
  label: string
  /** Fills the tile with this image instead of the icon-and-caption layout. */
  imageSrc?: string
  /** The glyph for non-image tiles; the tile owns its size and color. */
  icon?: React.ReactNode
  /** Opens the attachment's full view. Without it the tile is non-interactive. */
  onOpen?: () => void
}

/**
 * One square attachment tile — the same shape for photos, documents, and
 * anything else, so mixed attachments always read as one set. With `onOpen`
 * the tile is a button whose accessible name is "Open <label>".
 */
function ChatAttachmentTile({
  label,
  imageSrc,
  icon,
  onOpen,
  className,
  style,
  ...props
}: ChatAttachmentTileProps) {
  const content = imageSrc ? (
    <img src={imageSrc} alt={onOpen ? "" : label} className="size-full object-cover" />
  ) : (
    <>
      <span
        aria-hidden="true"
        className="flex items-center justify-center text-muted-foreground [&_svg]:size-5"
      >
        {icon}
      </span>
      <span className="w-full truncate px-1.5 text-center font-sans nessa-text-1 text-accent-foreground">
        {label}
      </span>
    </>
  )
  // Tiles are borderless: photos read as-is and icon tiles sit on the
  // accent wash, so mixed attachments never grow hairlines (owner
  // preference, Aug 2026).
  const tileClassName = cn(
    "flex size-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-accent p-0",
    className,
  )
  if (!onOpen) {
    return (
      <span
        data-slot="chat-attachment-tile"
        title={label}
        className={tileClassName}
        style={style}
        {...(props as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-slot="chat-attachment-tile"
      aria-label={`Open ${label}`}
      title={label}
      onClick={onOpen}
      className={cn(tileClassName, "cursor-pointer", chatBubblesFocusClassName)}
      style={style}
      {...props}
    >
      {content}
    </button>
  )
}

export interface ChatAttachmentStackProps
  extends Omit<React.ComponentProps<"div">, "onClick"> {
  /** The total item count, shown in the label above the stack. */
  count: number
  /** Replaces the default "N items" label text. */
  label?: string
  /** Opens the full attachment view; both the label and the stack trigger it. */
  onOpen: () => void
  /** The tiles to fan, front first; at most three render in the stack. */
  children: React.ReactNode
}

/**
 * The collapsed multi-attachment collage: a "N items" label and up to three
 * same-size tiles fanned in one direction behind the front one. Both the
 * label and the stack open the full view.
 */
function ChatAttachmentStack({
  count,
  label,
  onOpen,
  className,
  children,
  ...props
}: ChatAttachmentStackProps) {
  const { tone } = React.useContext(ChatMessageContext)
  const tiles = React.Children.toArray(children).slice(0, 3)
  return (
    <div
      data-slot="chat-attachment-stack"
      className={cn(
        "mb-1 flex flex-col gap-1",
        tone === "sent" ? "items-end" : "items-start",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 px-1 font-sans nessa-text-2 font-medium text-muted-foreground",
          chatBubblesFocusClassName,
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-3.5" />
        {label ?? `${count} items`}
      </button>
      <button
        type="button"
        aria-label={`Show all ${count} attachments`}
        title="Show all"
        onClick={onOpen}
        className={cn(
          "relative mr-3 mt-2 inline-block size-28 cursor-pointer border-0 bg-transparent p-0",
          chatBubblesFocusClassName,
        )}
      >
        {tiles
          .map((tile, index) => (
            /* Paint order handles the stack: the fan renders back-to-front,
               so the front tile paints last and needs no z-index. */
            <span
              key={index}
              className={cn(
                "absolute inset-0 [&>*]:size-full [&>*]:shadow-xs",
                index === 1 && "translate-x-1.5 -translate-y-1.5 rotate-2",
                index === 2 && "translate-x-3 -translate-y-3 rotate-[4deg]",
              )}
            >
              {tile}
            </span>
          ))
          .reverse()}
      </button>
    </div>
  )
}

export interface ChatAttachmentViewerProps extends React.ComponentProps<"div"> {
  /** Closes the viewer; Escape and the back control both call it. */
  onClose: () => void
  /** The per-kind summary line centered under the grid, e.g. "3 Photos, 2 Videos". */
  summary?: React.ReactNode
  /** The accessible name of the back control. */
  backLabel?: string
}

/**
 * The full-surface attachment view: an overlay that fills its nearest
 * positioned ancestor (the chat frame), lays the tiles out as a wrapping
 * grid, and summarizes the contents underneath. Back or Escape closes it.
 */
function ChatAttachmentViewer({
  onClose,
  summary,
  backLabel = "Back to conversation",
  className,
  children,
  ...props
}: ChatAttachmentViewerProps) {
  const reducedMotion = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof node.animate !== "function") return
    if (window.matchMedia(reducedMotionQuery).matches) return
    const duration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue("--nessa-motion-duration-fast"),
      160,
    )
    if (duration === 0) return
    const animation = node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
      easing: "ease-out",
    })
    return () => animation.cancel()
    // The fade runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The close callback is read through a ref so the focus-management
  // effect can run once on mount: hosts pass inline closures, and keying
  // the effect on their identity would re-capture the opener and yank
  // focus back to the first button on every parent render.
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  })
  React.useEffect(() => {
    const node = ref.current
    const ownerDocument = node?.ownerDocument
    if (!node || !ownerDocument) return
    // Modal focus management: remember the opener, move focus inside, keep
    // Tab cycling within the dialog, and hand focus back on close.
    const opener =
      ownerDocument.activeElement instanceof HTMLElement
        ? ownerDocument.activeElement
        : null
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"))
    focusables()[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return
      const order = focusables()
      if (order.length === 0) return
      const first = order[0]!
      const last = order[order.length - 1]!
      const current = ownerDocument.activeElement
      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }
    ownerDocument.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => {
      ownerDocument.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      })
      opener?.focus()
    }
    // Mount-once by design; onClose flows through onCloseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Attachments"
      data-slot="chat-attachment-viewer"
      className={cn(
        "absolute inset-0 z-20 flex flex-col gap-3 rounded-[inherit] bg-background p-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={backLabel}
          title={backLabel}
          onClick={onClose}
          className="size-9 rounded-full"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {summary === undefined || summary === null ? null : (
        <p className="text-center font-sans nessa-text-2 font-medium text-muted-foreground">
          {summary}
        </p>
      )}
    </div>
  )
}

export {
  ChatAttachmentStack,
  ChatReactionPicker,
  ChatAttachmentTile,
  ChatAttachmentViewer,
  ChatBubbleEditor,
  ChatMessageAction,
  ChatMessageActions,
  ChatBubble,
  ChatMessage,
  ChatMessageQuote,
  ChatMessageReceipt,
  ChatTypingIndicator,
}
