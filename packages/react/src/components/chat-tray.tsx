"use client"

import * as React from "react"
import { X } from "lucide-react"

import {
  ChatComposerAttachmentIcon,
  type ChatComposerAttachmentKind,
} from "./chat-composer"
import { cn } from "@/lib/utils"

const chatTrayFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

export interface ChatTrayItem {
  /** Identifies the item across removals. */
  id: string
  /**
   * Chooses the leading glyph, and tells the host what it is holding. The
   * kinds are the composer's own, so a quoted passage, a large paste, a
   * dropped file, and a chosen skill are one vocabulary rather than three
   * parallel ones.
   */
  kind?: ChatComposerAttachmentKind
  /** The chip's visible text; long labels truncate. */
  label: string
  /** The full text behind a truncated label, shown as the chip's tooltip. */
  detail?: string
  /** Replaces the kind's built-in glyph. */
  icon?: React.ReactNode
}

export interface ChatTrayChipProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  item: ChatTrayItem
}

/**
 * One pending item, as a compact chip: kind glyph, truncated label, and the
 * full text on hover. With an `onClick` it is a button, so a chip can open
 * what it stands for; without one it is inert text rather than a focus stop
 * that does nothing.
 */
function ChatTrayChip({ item, className, ...props }: ChatTrayChipProps) {
  const content = (
    <>
      <ChatComposerAttachmentIcon
        kind={item.kind}
        icon={item.icon}
        className="size-3"
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </>
  )
  const chipClassName = cn(
    "inline-flex min-w-0 max-w-52 shrink-0 items-center gap-1 rounded-2xl border border-border bg-transparent px-3 py-1 font-sans nessa-text-2 leading-4 text-muted-foreground transition-colors",
    className,
  )
  if (!props.onClick) {
    return (
      <span
        data-slot="chat-tray-chip"
        data-kind={item.kind}
        title={item.detail ?? item.label}
        className={chipClassName}
        {...(props as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-slot="chat-tray-chip"
      data-kind={item.kind}
      title={item.detail ?? item.label}
      className={cn(
        chipClassName,
        "cursor-pointer hover:text-foreground",
        chatTrayFocusClassName,
      )}
      {...props}
    >
      {content}
    </button>
  )
}

export interface ChatTrayProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** Everything waiting to travel with the next message, in the order it was added. */
  items: readonly ChatTrayItem[]
  /**
   * How many chips stand in for the set before the rest collapse into a
   * count. Defaults to 1: a tray above a small composer is a reminder of
   * what is attached, not the place to read it.
   */
  collapseAfter?: number
  /** Opens one item — typically a reading view for what the chip stands for. */
  onOpenItem?: (item: ChatTrayItem) => void
  /** Opens the whole set. The collapsed count is the affordance for it. */
  onOpenAll?: () => void
  /** Discards everything in the tray. */
  onClear?: () => void
  /** The accessible name of the row. */
  label?: string
}

/**
 * The single row of everything attached to the message being written —
 * quoted passages, large pastes, files, skills. One tray rather than a
 * stack per kind: they all end up on the same message, so they queue in the
 * same place, and the row stays one line high however much it holds by
 * collapsing the tail into a count.
 *
 * The tray stores nothing. Hosts own the list and decide what pressing a
 * chip opens, which is what lets one row hold kinds that behave differently.
 */
function ChatTray({
  items,
  collapseAfter = 1,
  onOpenItem,
  onOpenAll,
  onClear,
  label = "Attached to this message",
  className,
  ...props
}: ChatTrayProps) {
  if (items.length === 0) return null
  const shown = items.slice(0, Math.max(collapseAfter, 1))
  const hidden = items.length - shown.length
  return (
    <div
      data-slot="chat-tray"
      role="group"
      aria-label={label}
      className={cn("flex max-w-full items-center gap-1.5", className)}
      {...props}
    >
      {shown.map((item) => (
        <ChatTrayChip
          key={item.id}
          item={item}
          onClick={onOpenItem ? () => onOpenItem(item) : undefined}
        />
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          data-slot="chat-tray-overflow"
          onClick={onOpenAll}
          className={cn(
            "shrink-0 cursor-pointer whitespace-nowrap rounded-full border-0 bg-transparent p-0 font-sans nessa-text-1 text-muted-foreground transition-colors hover:text-foreground",
            chatTrayFocusClassName,
          )}
        >
          + {hidden} other{hidden > 1 ? "s" : ""}
        </button>
      ) : null}
      {onClear ? (
        <button
          type="button"
          data-slot="chat-tray-clear"
          aria-label="Discard everything attached"
          title="Discard everything attached"
          onClick={onClear}
          className={cn(
            "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-3",
            chatTrayFocusClassName,
          )}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export { ChatTray, ChatTrayChip }
