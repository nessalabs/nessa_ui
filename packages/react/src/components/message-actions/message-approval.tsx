"use client"

import * as React from "react"
import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../button"
import { builtInChannelMark } from "./channel-marks"
import { ContactAvatar } from "./contact-avatar"

/**
 * Where the request stands.
 *
 * - `pending` — the decision is the person's to make; both actions are live.
 * - `sending` — the host is dispatching; the actions stay visible but inert.
 * - `sent`, `cancelled`, `failed` — resolved; the actions give way to a
 *   status line, because the decision is no longer available to take.
 */
export type MessageApprovalStatus =
  | "pending"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed"

/** The resolved states: the decision is over and the actions come down. */
const resolvedStatuses: ReadonlySet<MessageApprovalStatus> = new Set([
  "sent",
  "cancelled",
  "failed",
])

/** Default status wording, replaceable through `statusLabel`. */
const statusLabels: Record<MessageApprovalStatus, string> = {
  pending: "",
  sending: "Sending…",
  sent: "Sent",
  cancelled: "Not sent",
  failed: "Couldn't send",
}

/** The glyph each resolved state carries beside its wording. */
const statusIcons = {
  sent: Check,
  cancelled: X,
  failed: TriangleAlert,
} as const

/**
 * Reports whether an element's content overflows its height cap. A capped,
 * scrolling region owes keyboard users a tab stop, but only while it can
 * actually scroll — so the answer is re-measured after every commit and
 * whenever the element resizes.
 */
function useOverflowing(ref: React.RefObject<HTMLElement | null>) {
  const [overflowing, setOverflowing] = React.useState(false)
  const measure = React.useCallback(() => {
    const element = ref.current
    if (!element) return
    // The 1px tolerance keeps a fractional content height from minting a
    // phantom tab stop on a field that cannot actually scroll.
    setOverflowing(element.scrollHeight - element.clientHeight > 1)
  }, [ref])
  React.useEffect(measure)
  React.useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure, ref])
  return overflowing
}

export interface MessageApprovalProps
  extends Omit<
    React.ComponentProps<"div">,
    "title" | "children" | "onChange" | "onSelect"
  > {
  /** Who the message goes to — the display name, shown as the card's heading. */
  recipient: string
  /**
   * The draft itself. Editable cards keep their own copy of it, so this is
   * the text the person starts from; passing a new value reseeds the field.
   */
  message: string
  /**
   * The question above the card. Defaults to "Ready to send it?"; pass your
   * own wording (or a localized string) to replace it, or `null` when the
   * surrounding surface already asks.
   */
  title?: React.ReactNode
  /**
   * The app or service carrying the message, shown under the recipient's
   * name — "Messages", "WhatsApp", "SMS". Defaults to "Messages".
   */
  channel?: string
  /**
   * The channel's mark, badged on the avatar's corner. A card whose
   * `channel` names iMessage or Mail badges that service's own mark by
   * default; every other channel shows nothing until its host passes its
   * mark here. `null` suppresses the badge outright.
   */
  channelIcon?: React.ReactNode
  /**
   * Replaces the built-in avatar rendering entirely — a RandomAvatar, a
   * group stack, a brand mark. Takes precedence over `avatarSrc`.
   */
  avatar?: React.ReactNode
  /** Photo for the built-in avatar; `initials` show while it is absent or fails. */
  avatarSrc?: string
  /** Overrides the initials derived from `recipient`. */
  initials?: string
  /**
   * Whether the draft can be corrected in place, which it can by default:
   * a person who spots a wrong date should fix it here rather than start the
   * request again. The field grows with the text up to the card's cap and
   * scrolls past it; Enter breaks the line — a message is multi-line
   * content — while ⌘/Ctrl+Enter sends and Escape cancels. Pass `false` for
   * a draft the host owns outright, which renders as read-only text.
   */
  editable?: boolean
  /**
   * Called on every edit. Supplying it does not make the field controlled:
   * the card still owns the text, and this reports what it now holds. Use
   * it to persist a draft, not to filter keystrokes.
   */
  onMessageChange?: (message: string) => void
  /** Where the request stands. Defaults to `pending`. */
  status?: MessageApprovalStatus
  /** Replaces the resolved state's wording, including for localization. */
  statusLabel?: React.ReactNode
  /**
   * Called with the current text when the person sends. The host owns
   * delivery: move `status` to `sending`, then to `sent` or `failed`.
   */
  onSend?: (message: string) => void
  /** Called when the person cancels; the host owns what replaces the card. */
  onCancel?: () => void
  /** Send action's label. Defaults to "Send". */
  sendLabel?: string
  /** Cancel action's label. Defaults to "Cancel". */
  cancelLabel?: string
  /** Accessible name for the draft field. Defaults to "Message to {recipient}". */
  messageLabel?: string
}

/**
 * A send-confirmation card: an agent has written a message to someone and
 * asks before it goes out. The card names the recipient and the app it will
 * travel over, shows the draft — optionally editable in place — and offers
 * the two decisions, cancel and send.
 *
 * The card sizes itself to the container it is placed in rather than to the
 * viewport: in a narrow rail the actions stack with send on top, and from
 * about 20rem of width they sit side by side; past 24rem the avatar, padding,
 * and draft type step up. One card therefore works in a chat sidebar, a
 * composer dock, and a full-width panel without a size prop.
 *
 * Sending is the host's: `onSend` receives the current text, and `status`
 * drives the card through dispatch to its outcome, at which point the actions
 * give way to a status line that announces itself.
 */
function MessageApproval({
  recipient,
  message,
  title = "Ready to send it?",
  channel = "Messages",
  channelIcon,
  avatar,
  avatarSrc,
  initials,
  editable = true,
  onMessageChange,
  status = "pending",
  statusLabel,
  onSend,
  onCancel,
  sendLabel = "Send",
  cancelLabel = "Cancel",
  messageLabel,
  className,
  ...props
}: MessageApprovalProps) {
  const titleId = React.useId()
  const [draft, setDraft] = React.useState(message)
  // The host's text is the seed, not a controlled value: the field owns what
  // the person types, and a NEW draft from the host replaces it. Deriving it
  // during render (rather than in an effect) means the reseeded text paints
  // in the same commit, never a frame of the previous message.
  const [seed, setSeed] = React.useState(message)
  if (seed !== message) {
    setSeed(message)
    setDraft(message)
  }
  const fieldRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const readOnlyOverflowing = useOverflowing(fieldRef)

  // The field grows with its content up to the cap set in CSS, then scrolls.
  // `field-sizing: content` does the same thing without JavaScript but is not
  // yet everywhere, and a draft that silently hides its own second line is
  // not something to leave to browser support.
  const resize = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    const cap = Number.parseFloat(getComputedStyle(textarea).maxHeight)
    const height = Number.isFinite(cap)
      ? Math.min(textarea.scrollHeight, cap)
      : textarea.scrollHeight
    textarea.style.height = `${height}px`
    textarea.style.overflowY =
      textarea.scrollHeight > height + 1 ? "auto" : "hidden"
  }, [])
  React.useLayoutEffect(resize, [resize, draft, editable])
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || typeof ResizeObserver === "undefined") return
    // Width changes rewrap the text and change how tall it wants to be; the
    // observer covers container resizes React never sees.
    let width = textarea.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const next = textarea.getBoundingClientRect().width
      if (next === width) return
      width = next
      resize()
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [resize, editable])

  const resolved = resolvedStatuses.has(status)
  const sending = status === "sending"
  const send = () => {
    if (resolved || sending) return
    onSend?.(draft)
  }
  const cancel = () => {
    if (resolved || sending) return
    onCancel?.()
  }

  // What the live region carries: the resolved wording, or "Sending…" while
  // the host dispatches. Nothing while the decision is still open — the card
  // is being read, not reported on. A host-supplied `statusLabel` replaces
  // the resolved wording in both places at once.
  const announcement = resolved
    ? (statusLabel ?? statusLabels[status])
    : sending
      ? statusLabels.sending
      : null

  // A built-in mark FILLS its badge, where a host's glyph sits inside one,
  // so the default carries its own tile geometry.
  const ownMark = channelIcon === undefined ? builtInChannelMark(channel) : null
  const badge = channelIcon === null ? null : (channelIcon ?? ownMark)
  // The draft's shared shape. No focus outline lives here: the two forms of
  // the field earn one differently, and only the read-only one gets it.
  const fieldClassName =
    "max-h-40 w-full min-w-0 whitespace-pre-wrap break-words rounded-xl bg-muted/60 px-3 py-2 font-sans nessa-text-3 text-foreground outline-none @[24rem]/message-approval:nessa-text-4"

  return (
    <div
      role="group"
      aria-labelledby={title == null ? undefined : titleId}
      aria-label={title == null ? `Send a message to ${recipient}` : undefined}
      data-slot="message-approval"
      data-status={status}
      className={cn(
        "@container/message-approval flex w-full min-w-0 flex-col gap-2 font-sans",
        className,
      )}
      {...props}
    >
      {title == null ? null : (
        <p
          id={titleId}
          data-slot="message-approval-title"
          className="min-w-0 nessa-text-3 font-medium text-foreground @[24rem]/message-approval:nessa-text-4"
        >
          {title}
        </p>
      )}
      <div
        data-slot="message-approval-card"
        className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xs @[24rem]/message-approval:p-4"
      >
        <div
          data-slot="message-approval-recipient"
          className="flex min-w-0 items-center gap-2.5"
        >
          <ContactAvatar
            data-slot="message-approval-avatar"
            name={recipient}
            src={avatarSrc}
            initials={initials}
            badge={badge}
            className="size-9 @[24rem]/message-approval:size-10"
            badgeClassName={cn(
              ownMark != null
                ? // The logo IS the badge: it keeps its own rounded-square
                  // silhouette rather than being clipped into the circular
                  // tile a bare glyph sits in, and the card-coloured hairline
                  // separates it from the avatar behind it.
                  "-bottom-1 -right-1 size-[1.125rem] rounded-[0.3125rem] border-card bg-card [&_svg]:size-full @[24rem]/message-approval:size-5"
                : "@[24rem]/message-approval:size-[1.125rem] @[24rem]/message-approval:[&_svg]:size-3",
            )}
          >
            {avatar}
          </ContactAvatar>
          <span className="flex min-w-0 flex-col">
            <span
              data-slot="message-approval-name"
              className="truncate nessa-text-3 font-medium text-foreground @[24rem]/message-approval:nessa-text-4"
            >
              {recipient}
            </span>
            <span
              data-slot="message-approval-channel"
              className="truncate nessa-text-2 text-muted-foreground"
            >
              {channel}
            </span>
          </span>
        </div>
        {editable ? (
          <textarea
            ref={textareaRef}
            data-slot="message-approval-message"
            aria-label={messageLabel ?? `Message to ${recipient}`}
            rows={1}
            value={draft}
            readOnly={resolved || sending}
            onChange={(event) => {
              setDraft(event.target.value)
              onMessageChange?.(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.defaultPrevented) return
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                // Same reasoning as Escape: a composer or transcript
                // listening for the send chord must not send twice.
                event.stopPropagation()
                send()
                return
              }
              if (event.key === "Escape") {
                event.preventDefault()
                // Abandoning the draft is the whole meaning of this
                // keystroke; a host sheet or overlay must not take it as a
                // dismissal of itself as well.
                event.stopPropagation()
                cancel()
              }
            }}
            // No focus ring on the editable field: the caret and selection
            // already show where focus is, and browsers match :focus-visible
            // on editable fields for pointer focus too — an outline here
            // would read as a permanent border around the draft rather than
            // as focus. This is the same call ChatComposer's textarea makes.
            className={cn(fieldClassName, "block resize-none overflow-hidden")}
          />
        ) : (
          <div
            ref={fieldRef}
            data-slot="message-approval-message"
            // A capped region that scrolls is keyboard-reachable, but only
            // while it has something to scroll to.
            role="region"
            aria-label={messageLabel ?? `Message to ${recipient}`}
            tabIndex={readOnlyOverflowing ? 0 : undefined}
            // The read-only region has no caret to show focus with, and it
            // takes a tab stop whenever it scrolls, so it keeps the ring.
            className={cn(
              fieldClassName,
              "overflow-y-auto focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            )}
          >
            {message}
          </div>
        )}
        {/* The live region is mounted for the card's whole life, empty while
            the decision is open: a region inserted at the moment its text
            appears is a mutation most screen readers never announce. It is
            out of flow (sr-only is absolutely positioned), so it adds no
            row to the card's layout. */}
        <span
          role="status"
          aria-live="polite"
          data-slot="message-approval-announcement"
          className="sr-only"
        >
          {announcement}
        </span>
        {resolved ? (
          <p
            data-slot="message-approval-status"
            className={cn(
              // Aligned to the reading edge, where the send action was: the
              // outcome lands under the control that produced it rather than
              // in the opposite corner.
              "flex min-w-0 items-center justify-end gap-1.5 nessa-text-2",
              status === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {React.createElement(statusIcons[status as keyof typeof statusIcons], {
              "aria-hidden": "true",
              className: "size-3.5 shrink-0",
            })}
            <span className="min-w-0 truncate">
              {statusLabel ?? statusLabels[status]}
            </span>
          </p>
        ) : (
          // Reversed so the stacked order puts send on top — the choice the
          // person came for — while the row order keeps cancel at the start
          // and send at the reading edge.
          <div
            data-slot="message-approval-actions"
            className="flex flex-col-reverse gap-2 @[20rem]/message-approval:flex-row"
          >
            <Button
              type="button"
              variant="secondary"
              disabled={sending}
              onClick={cancel}
              className="flex-1"
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              disabled={sending}
              onClick={send}
              // The send blue is the chat identity, the same fixed accent
              // ChatBubble paints a sent message with — not the theme's
              // primary, which would drift from the transcript it belongs to.
              className="flex-1 bg-(--nessa-chat-accent) text-white hover:bg-(--nessa-chat-accent)/90"
            >
              {sending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin [animation-duration:var(--nessa-motion-duration-ambient)] motion-reduce:animate-none"
                />
              ) : null}
              {sending ? statusLabels.sending : sendLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export { MessageApproval }
