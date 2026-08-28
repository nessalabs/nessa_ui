"use client"

import * as React from "react"
import { ArrowLeft, LayoutGrid } from "lucide-react"

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
    if (!node || !animateIn || reducedMotion) return
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
          "flex max-w-[85%] flex-col font-sans",
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
}

/**
 * The message bubble itself: iMessage blue for sent, the theme's accent for
 * received. With `onSelect` the bubble is a real button (the accessible
 * name should come from `aria-label`); it deliberately carries no hover
 * wash — focus-visible keeps keyboard users oriented.
 */
function ChatBubble({
  onSelect,
  reaction,
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
    onPointerDown: composeHandler(
      hostPointerDown,
      (event: React.PointerEvent<HTMLElement>) => {
        pointerPressedRef.current = true
        if (event.pointerType !== "mouse" || event.button !== 0) return
        const { currentTarget, clientX, clientY } = event
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
    ),
    onPointerUp: composeHandler(hostPointerUp, clearLongPress),
    onPointerLeave: composeHandler(
      hostPointerLeave,
      (event: React.PointerEvent<HTMLElement>) => {
        void event
        pointerPressedRef.current = false
        clearLongPress()
      },
    ),
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
        {children}
        {reactionBadge}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-slot="chat-bubble"
      data-tone={tone}
      onClick={composeHandler(hostClick, () => {
        // A click that never saw a pointer press came from the keyboard or
        // assistive tech — activate; plain pointer clicks stay inert.
        const fromPointer = pointerPressedRef.current
        pointerPressedRef.current = false
        if (!fromPointer) onSelect()
      })}
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
      {children}
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
    if (!node || reducedMotion) return
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
    if (!node || reducedMotion) return
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
        onClose()
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
  }, [onClose])
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
  ChatBubble,
  ChatMessage,
  ChatMessageQuote,
  ChatMessageReceipt,
  ChatTypingIndicator,
}
