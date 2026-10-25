"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface UndoCardProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  /** What was just done, the small first line: "Archived". */
  action: string
  /** What it was done to, the second line: a conversation's title. */
  title: string
  /**
   * Leads the card: the item's own picture — a conversation's avatar — so
   * the card shows which thing it is about, not only its name.
   */
  leading?: React.ReactNode
  /** The undo control's visible label. Defaults to "Undo". */
  undoLabel?: string
  /** Undoes the action. */
  onUndo: () => void
}

/**
 * A small row card for an action just taken and the way back from it: the
 * item's picture, what was done over what it was done to, and an Undo
 * control — the card that follows an archive, as Mail's does after a swipe.
 * It is a row, not a sentence, so it reads as the item that just left.
 * It rises in once when it mounts. The host owns where it sits, how long
 * it stays, and the announcement: the card is no live region, because the
 * host already says what happened.
 */
function UndoCard({
  action,
  title,
  leading,
  undoLabel = "Undo",
  onUndo,
  className,
  ...props
}: UndoCardProps) {
  return (
    <div
      data-slot="undo-card"
      className={cn(
        "flex min-h-13.5 min-w-0 items-center gap-2.5 rounded-xl bg-popover/90 ps-3 pe-2.5 font-sans text-popover-foreground shadow-lg ring-1 ring-border/50 ring-inset backdrop-blur-md",
        "animate-in fade-in-0 slide-in-from-bottom-2 [animation-duration:var(--nessa-motion-duration-normal)] [animation-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:animate-none",
        className,
      )}
      {...props}
    >
      {leading ? (
        <span
          aria-hidden="true"
          data-slot="undo-card-leading"
          className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full [&>*]:size-8"
        >
          {leading}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="nessa-text-1 text-muted-foreground">{action}</span>
        <span className="truncate nessa-text-3 font-semibold">{title}</span>
      </span>
      <button
        type="button"
        data-slot="undo-card-action"
        aria-label={`${undoLabel} ${action.toLowerCase()} ${title}`}
        onClick={onUndo}
        className="inline-flex min-h-7.5 shrink-0 cursor-pointer items-center rounded-full border-0 bg-accent px-3 font-sans nessa-text-2 font-semibold text-(--nessa-chat-accent-ink) transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:bg-accent/70 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {undoLabel}
      </button>
    </div>
  )
}

export { UndoCard }
