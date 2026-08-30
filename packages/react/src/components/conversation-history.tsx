"use client"

import * as React from "react"
import { Pin, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "./input"

export interface ConversationHistoryEntry {
  /** Identifies the conversation across selection. */
  id: string
  /** The conversation title. */
  title: string
  /** The last message, shown muted under the title. */
  preview?: string
  /** Relative time, shown on the trailing edge. */
  updated?: string
  /** Pins the row above unpinned conversations when the host sorts that way. */
  pinned?: boolean
  /** Optional project or path, shown under the preview. */
  project?: string
}

export interface ConversationHistoryProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** The conversations to list, in the order the host wants them drawn. */
  conversations: readonly ConversationHistoryEntry[]
  /** The selected conversation's id, or `null` when none is selected. */
  value?: string | null
  /** Fires with the selected conversation's id. */
  onValueChange?: (id: string) => void
  /**
   * The search field's value. Omit both `query` and `onQueryChange` to hide
   * the field; the host that owns filtering also owns whether it is shown.
   */
  query?: string
  /** Updates the search field. Required for the field to render. */
  onQueryChange?: (query: string) => void
  /** The search field's placeholder. */
  searchPlaceholder?: string
  /** The accessible name of the list. */
  label?: string
  /** Shown when `conversations` is empty. */
  emptyMessage?: string
}

/**
 * A roster of conversations: an optional search field and a list of rows
 * the host already knows about. The list stores nothing and sorts nothing —
 * pass the rows in the order they should appear, and apply the query
 * before they arrive. Selecting a row reports its id; opening a
 * conversation is the host's job.
 */
function ConversationHistory({
  conversations,
  value = null,
  onValueChange,
  query,
  onQueryChange,
  searchPlaceholder = "Search conversations",
  label = "Conversations",
  emptyMessage = "No conversations",
  className,
  ...props
}: ConversationHistoryProps) {
  const searchId = React.useId()
  return (
    <div
      data-slot="conversation-history"
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 font-sans",
        className,
      )}
      {...props}
    >
      {onQueryChange !== undefined ? (
        <div className="relative shrink-0">
          <label htmlFor={searchId} className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            value={query ?? ""}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 rounded-full border-border bg-muted/50 pl-9"
          />
        </div>
      ) : null}
      {conversations.length === 0 ? (
        <p className="m-0 px-1 py-6 text-center font-sans nessa-text-3 text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul
          data-slot="conversation-history-list"
          role="listbox"
          aria-label={label}
          className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {conversations.map((conversation) => {
            const selected = conversation.id === value
            return (
              <li key={conversation.id} className="min-w-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-slot="conversation-history-item"
                  data-pinned={conversation.pinned || undefined}
                  onClick={() => onValueChange?.(conversation.id)}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2.5 rounded-xl border-0 bg-transparent px-2.5 py-2.5 text-start outline-none transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected && "bg-accent",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {conversation.pinned ? (
                        <Pin
                          aria-hidden="true"
                          className="size-3 shrink-0 text-muted-foreground"
                        />
                      ) : null}
                      <span className="min-w-0 truncate font-sans nessa-text-4 font-semibold text-foreground">
                        {conversation.title}
                      </span>
                    </span>
                    {conversation.preview ? (
                      <span className="mt-0.5 block min-w-0 truncate font-sans nessa-text-2 text-muted-foreground">
                        {conversation.preview}
                      </span>
                    ) : null}
                    {conversation.project ? (
                      <span className="mt-0.5 block min-w-0 truncate font-sans nessa-text-1 text-muted-foreground">
                        {conversation.project}
                      </span>
                    ) : null}
                  </span>
                  {conversation.updated ? (
                    <span className="shrink-0 pt-0.5 font-sans nessa-text-1 text-muted-foreground">
                      {conversation.updated}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export { ConversationHistory }
