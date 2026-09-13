"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ContactAvatar } from "./contact-avatar"

export interface MessageDigestEntry {
  /** Identifies the message across selection. */
  id: string
  /** Who it is from — the row's heading. */
  sender: string
  /** The subject or thread title, under the sender. */
  subject?: string
  /** The opening of the message, clamped to `previewLines`. */
  preview?: string
  /** When it arrived, already formatted by the host — "8:42 AM", "Tue". */
  timestamp?: string
  /** Marks the row unread: a dot on the leading edge and a bolder sender. */
  unread?: boolean
  /** Photo for the row's avatar; initials show while it is absent or fails. */
  avatarSrc?: string
  /** Overrides the initials derived from `sender`. */
  initials?: string
  /** A glyph badged on the avatar — the account or app it arrived on. */
  badge?: React.ReactNode
}

/** Static classes, so Tailwind's scanner sees every clamp the API allows. */
const previewClampClasses = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
} as const

export interface MessageDigestProps
  extends Omit<React.ComponentProps<"div">, "onSelect" | "title" | "children"> {
  /** The messages to list, in the order the host wants them read. */
  messages: readonly MessageDigestEntry[]
  /** A line above the list — what the agent was asked, or what it found. */
  title?: React.ReactNode
  /**
   * Opens a message. Supplying it makes every row a button; without it the
   * rows are quiet summary tiles, which is what a cited result usually is.
   */
  onValueChange?: (id: string) => void
  /** The opened message's id, marked `aria-current` while rows are buttons. */
  value?: string | null
  /** How many lines of `preview` survive before the text clamps. Defaults to 2. */
  previewLines?: 1 | 2 | 3
  /**
   * Accessible name for the list. Defaults to the title when it is a plain
   * string, and to "Messages" otherwise.
   */
  label?: string
  /** Shown in place of the list when `messages` is empty. */
  emptyMessage?: string
}

/**
 * What an agent found in someone's inbox, as the rows a mail app would draw:
 * sender, subject, the opening of the message, and when it landed, with unread
 * ones dotted on the leading edge. It is a reading surface by default — pass
 * `onValueChange` when the host can actually open a message and every row
 * becomes a button.
 *
 * The rows size themselves to their container rather than the viewport: the
 * timestamp keeps its place at the end of the sender line at every width, the
 * subject truncates, and the preview clamps to `previewLines`, so a digest
 * reads the same in a narrow rail as in a full-width panel. Ordering,
 * filtering, and formatting the timestamp stay with the host.
 */
function MessageDigest({
  messages,
  title,
  onValueChange,
  value = null,
  previewLines = 2,
  label,
  emptyMessage = "No messages",
  className,
  ...props
}: MessageDigestProps) {
  const titleId = React.useId()
  // The title element names the list when there is one; `label` overrides
  // it, and a digest with no title falls back to the generic word.
  const titled = title != null && label === undefined
  const interactive = onValueChange !== undefined
  return (
    <div
      data-slot="message-digest"
      className={cn(
        "@container/message-digest flex w-full min-w-0 flex-col gap-2 font-sans",
        className,
      )}
      {...props}
    >
      {title == null ? null : (
        <p
          id={titleId}
          data-slot="message-digest-title"
          className="min-w-0 nessa-text-3 font-medium text-foreground @[24rem]/message-digest:nessa-text-4"
        >
          {title}
        </p>
      )}
      {messages.length === 0 ? (
        <p className="m-0 px-1 py-4 nessa-text-3 text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul
          role="list"
          aria-labelledby={titled ? titleId : undefined}
          aria-label={titled ? undefined : (label ?? "Messages")}
          data-slot="message-digest-list"
          className="m-0 flex list-none flex-col gap-2 p-0"
        >
          {messages.map((message) => {
            const selected = interactive && message.id === value
            const rowClassName = cn(
              "flex w-full min-w-0 items-start gap-2.5 rounded-2xl border-0 bg-muted/60 px-3 py-2.5 text-start @[24rem]/message-digest:gap-3 @[24rem]/message-digest:px-3.5 @[24rem]/message-digest:py-3",
              interactive &&
                "outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
              selected && "bg-accent text-accent-foreground",
            )
            const content = (
              <>
                {/* Unread rides the avatar's corner rather than a column of
                    its own: a leading dot costs every row its indent for a
                    mark most rows do not carry. It repeats what the sr-only
                    word already says, so it stays decoration. */}
                <ContactAvatar
                  name={message.sender}
                  src={message.avatarSrc}
                  initials={message.initials}
                  badge={message.badge}
                  unread={message.unread}
                  className="size-8 @[24rem]/message-digest:size-9"
                />
                {/* The three ranks need air between them: line boxes that butt
                    straight into each other read as one paragraph rather than
                    sender, subject, and preview. */}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span
                      data-slot="message-digest-sender"
                      className={cn(
                        "min-w-0 flex-1 truncate nessa-text-3 text-foreground",
                        message.unread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {message.unread ? (
                        <span className="sr-only">Unread. </span>
                      ) : null}
                      {message.sender}
                    </span>
                    {message.timestamp ? (
                      <span
                        data-slot="message-digest-timestamp"
                        className="shrink-0 nessa-text-1 text-muted-foreground"
                      >
                        {message.timestamp}
                      </span>
                    ) : null}
                  </span>
                  {message.subject ? (
                    <span
                      data-slot="message-digest-subject"
                      className="min-w-0 truncate nessa-text-2 font-medium text-foreground"
                    >
                      {message.subject}
                    </span>
                  ) : null}
                  {message.preview ? (
                    <span
                      data-slot="message-digest-preview"
                      className={cn(
                        "min-w-0 nessa-text-2 text-muted-foreground",
                        previewClampClasses[previewLines],
                      )}
                    >
                      {message.preview}
                    </span>
                  ) : null}
                </span>
              </>
            )
            return (
              <li key={message.id} className="min-w-0">
                {interactive ? (
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    data-slot="message-digest-item"
                    data-unread={message.unread || undefined}
                    onClick={() => onValueChange?.(message.id)}
                    className={rowClassName}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    data-slot="message-digest-item"
                    data-unread={message.unread || undefined}
                    className={rowClassName}
                  >
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export { MessageDigest }
