"use client"

import * as React from "react"
import { Pin, Search } from "lucide-react"

import { useComposedRefs } from "@/lib/compose"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { RandomAvatar } from "./random-avatar"
import {
  SwipeRow,
  SwipeRowGroup,
  type SwipeRowAction,
  type SwipeRowActionDetails,
  type SwipeRowActionState,
} from "./swipe-row"
import { useSwipeRowTrace } from "./swipe-row-context"

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
  /**
   * Optional project or path, shown under the preview. Also seeds the row
   * avatar: conversations that share a project share a painting, the way
   * threads with the same contact share a photo. When omitted, the
   * conversation id is the seed so the row still has an identity.
   */
  project?: string
}

/** One action a row reveals when it is swiped or opened from the keyboard. */
export interface ConversationHistoryAction
  extends Omit<SwipeRowAction, "label" | "render"> {
  /**
   * The visible label. The action's accessible name is this label followed
   * by the conversation title — "Archive Release notes" — so a list of
   * identical buttons still says which row each one acts on.
   */
  label: string
  /**
   * Draws the action's content in place of the default icon and label.
   * The button, its colors, sizing, confirmation, and accessible name stay
   * the component's, so a custom face cannot lose the behavior. The content
   * sits inside a button, so it must not be interactive, and its visible
   * text should start with `label` (or `confirmLabel` while confirming) so
   * the words on screen are the words that name the button. Rows redraw
   * when their entry or action objects change, so draw from `state` and the
   * action itself rather than from other host state.
   */
  render?: (state: ConversationHistoryActionState) => React.ReactNode
}

/** What a custom action face is drawn for. */
export interface ConversationHistoryActionState extends SwipeRowActionState {
  /** The row the action belongs to. */
  conversation: ConversationHistoryEntry
}

/** Project path when present, otherwise the conversation id. */
/**
 * The seed a row's avatar is painted from: the project when there is one,
 * else the id. Exported so a host that draws the same conversation
 * elsewhere — a card after it is archived — paints the same picture.
 */
function conversationAvatarSeed(
  conversation: Pick<ConversationHistoryEntry, "id" | "project">,
) {
  const project = conversation.project?.trim()
  return project && project.length > 0 ? project : conversation.id
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
  /**
   * Development tooling: records row presses, axis decisions, drag samples,
   * trackpad inertia (`coast`, `resume`), releases, settles, confirmations,
   * actions, and focus rescues into a ring
   * buffer published at `window.__nessaConversationHistory[<instance id>]`,
   * with a `snapshot()` of every row's swipe state — so a gesture glitch
   * (trackpad inertia, settle and focus ordering) can be reproduced once
   * and read back as data. No-op unless set.
   */
  debug?: boolean
  /**
   * The actions a row reveals, primary first. Called for every row on every
   * render. Define each action object once (outside render); returning a
   * fresh array of those same objects is fine. A row given no
   * actions does not swipe. Omit the prop entirely when no row has actions,
   * rather than returning `[]`, so the list adds no gesture handling at all.
   */
  rowActions?: (
    conversation: ConversationHistoryEntry,
  ) => readonly ConversationHistoryAction[]
  /**
   * Fires with the conversation's id and the chosen action's id, from a
   * pressed (and, where asked, confirmed) action button or from a full swipe
   * committing the primary action. The list stores nothing: removing or
   * archiving the conversation is the host's job.
   */
  onRowAction?: (conversationId: string, actionId: string) => void
}

const noActions: readonly ConversationHistoryAction[] = Object.freeze([])

// A prop added here must also be compared in `sameRowProps`.
interface ConversationHistoryRowProps {
  conversation: ConversationHistoryEntry
  selected: boolean
  actions: readonly ConversationHistoryAction[]
  /** Reserve the preview and project lines even when this row has none. */
  reservePreview: boolean
  reserveProject: boolean
  onSelect: (conversationId: string) => void
  onAction: (
    conversationId: string,
    actionId: string,
    hadFocus: boolean,
  ) => void
}

// `outline-none` resets Tailwind's outline style to none, which the width
// utility would otherwise inherit and draw nothing; restore it on focus.
const rowFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

/** Every field of an entry; the type check fails if one is left out. */
const entryFields = [
  "id",
  "title",
  "preview",
  "updated",
  "pinned",
  "project",
] as const satisfies readonly (keyof ConversationHistoryEntry)[]
type MissingEntryField = Exclude<
  keyof ConversationHistoryEntry,
  (typeof entryFields)[number]
>
const everyEntryFieldCompared: [MissingEntryField] extends [never] ? true : never = true
void everyEntryFieldCompared

/**
 * Whether a row can skip re-rendering. Hosts commonly rebuild their entries
 * and action arrays every render, so both are compared by content — an
 * entry by its fields, actions by the action objects they hold — rather
 * than by identity, which would re-render every row whenever the list did.
 */
function sameRowProps(
  previous: ConversationHistoryRowProps,
  next: ConversationHistoryRowProps,
) {
  const a = previous.conversation
  const b = next.conversation
  const sameConversation =
    a === b || entryFields.every((field) => a[field] === b[field])
  const sameActions =
    previous.actions === next.actions ||
    (previous.actions.length === next.actions.length &&
      previous.actions.every((action, index) => action === next.actions[index]))
  return (
    sameConversation &&
    sameActions &&
    previous.selected === next.selected &&
    previous.reservePreview === next.reservePreview &&
    previous.reserveProject === next.reserveProject &&
    previous.onSelect === next.onSelect &&
    previous.onAction === next.onAction
  )
}

/**
 * One conversation row: the selectable button, inside the SwipeRow that
 * reveals the host's actions for it. Private to ConversationHistory.
 */
const ConversationHistoryRow = React.memo(function ConversationHistoryRow({
  conversation,
  selected,
  actions,
  reservePreview,
  reserveProject,
  onSelect,
  onAction,
}: ConversationHistoryRowProps) {
  const id = conversation.id
  // A custom face is drawn for this conversation.
  const swipeActions = React.useMemo(
    () =>
      actions.map(({ render, ...action }): SwipeRowAction =>
        render ? { ...action, render: (state) => render({ ...state, conversation }) } : action,
      ),
    [actions, conversation],
  )
  const reportAction = React.useCallback(
    (actionId: string, details: SwipeRowActionDetails) =>
      onAction(id, actionId, details.hadFocus),
    [id, onAction],
  )
  return (
    <SwipeRow
      as="li"
      value={id}
      name={conversation.title}
      actions={swipeActions}
      onAction={reportAction}
      data-slot="conversation-history-row"
      data-conversation-id={id}
      className="min-w-0"
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        data-slot="conversation-history-item"
        data-pinned={conversation.pinned || undefined}
        onClick={() => onSelect(id)}
        className={cn(
          "flex w-full min-w-0 items-start gap-3 rounded-xl border-0 bg-transparent px-2.5 py-2.5 text-start hover:bg-accent transition-colors",
          rowFocusClassName,
        )}
      >
        <RandomAvatar
          seed={conversationAvatarSeed(conversation)}
          className="mt-0.5 size-10"
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            {conversation.pinned ? (
              <>
                <Pin
                  aria-hidden="true"
                  className="size-3 shrink-0 text-muted-foreground"
                />
                <span className="sr-only">Pinned </span>
              </>
            ) : null}
            <span className="min-w-0 truncate font-sans nessa-text-4 font-semibold text-foreground">
              {conversation.title}
            </span>
          </span>
          {conversation.preview || reservePreview ? (
            <span
              aria-hidden={conversation.preview ? undefined : "true"}
              className="mt-0.5 block min-w-0 truncate font-sans nessa-text-2 text-muted-foreground"
            >
              {/* An empty line still holds its height, so every row in a
                  list is the same height whatever it has to say. */}
              {conversation.preview || "\u00a0"}
            </span>
          ) : null}
          {conversation.project || reserveProject ? (
            <span
              aria-hidden={conversation.project ? undefined : "true"}
              className="mt-0.5 block min-w-0 truncate font-sans nessa-text-1 text-muted-foreground"
            >
              {conversation.project || "\u00a0"}
            </span>
          ) : null}
        </span>
        {conversation.updated ? (
          <span className="shrink-0 pt-0.5 font-sans nessa-text-1 text-muted-foreground">
            {conversation.updated}
          </span>
        ) : null}
      </button>
    </SwipeRow>
  )
}, sameRowProps)

interface ConversationHistoryBodyProps extends React.HTMLAttributes<HTMLElement> {
  ref?: React.Ref<HTMLElement>
  conversations: readonly ConversationHistoryEntry[]
  value: string | null
  label: string
  emptyMessage: string
  rowActions: ConversationHistoryProps["rowActions"]
  onRowAction: ConversationHistoryProps["onRowAction"]
  onValueChange: ConversationHistoryProps["onValueChange"]
  /** The search field, which takes focus when the last row goes. */
  searchRef: React.RefObject<HTMLInputElement | null>
}

/**
 * The list of rows, or the empty state when there are none — the element
 * the SwipeRowGroup merges into, so the group's region is the list itself.
 * Private to ConversationHistory.
 */
function ConversationHistoryBody({
  conversations,
  value,
  label,
  emptyMessage,
  rowActions,
  onRowAction,
  onValueChange,
  searchRef,
  ref,
  className,
  ...groupProps
}: ConversationHistoryBodyProps) {
  const trace = useSwipeRowTrace()
  const listRef = React.useRef<HTMLUListElement>(null)
  const emptyRef = React.useRef<HTMLParagraphElement>(null)
  const composedListRef = useComposedRefs<HTMLElement>(ref, listRef)
  const composedEmptyRef = useComposedRefs<HTMLElement>(ref, emptyRef)
  // Where focus was when a pressed action may remove its own row.
  const focusRescueRef = React.useRef<number | null>(null)

  // Rows share one height: a line any row uses is held by every row.
  const reservePreview = conversations.some((conversation) => Boolean(conversation.preview))
  const reserveProject = conversations.some((conversation) => Boolean(conversation.project))

  // Rows are memoized, so everything handed to them keeps its identity
  // across renders and reads the host's newest props through a ref. Opening
  // one row then re-renders that row and the one it closes, not the list.
  const hostRef = React.useRef({ conversations, onRowAction, onValueChange })
  React.useLayoutEffect(() => {
    hostRef.current = { conversations, onRowAction, onValueChange }
  })

  const selectRow = React.useCallback((conversationId: string) => {
    hostRef.current.onValueChange?.(conversationId)
  }, [])

  /**
   * Reports an action to the host. When focus was in the acting row, it
   * remembers where, so focus can move to the row that takes its place if
   * the host removes it.
   */
  const runRowAction = React.useCallback(
    (conversationId: string, actionId: string, hadFocus: boolean) => {
      const host = hostRef.current
      if (hadFocus) {
        focusRescueRef.current = host.conversations.findIndex(
          (conversation) => conversation.id === conversationId,
        )
      }
      host.onRowAction?.(conversationId, actionId)
    },
    [],
  )

  // A pressed action that removed its row took focus with it; hand focus to
  // the row now in its place so the keyboard stays in the list.
  React.useLayoutEffect(() => {
    const index = focusRescueRef.current
    if (index === null) return
    focusRescueRef.current = null
    if (index < 0) return
    trace?.({ ev: "rescue", index })
    // Focus still somewhere real means the host put it there, or the row
    // was not removed; only focus that fell out of the page is rescued.
    const ownerDocument = (listRef.current ?? emptyRef.current ?? searchRef.current)
      ?.ownerDocument
    const active = ownerDocument?.activeElement
    if (!ownerDocument || (active && active !== ownerDocument.body)) return
    const list = listRef.current
    if (!list) {
      // The last row went; the search field, or else the empty state, keeps
      // focus inside the component.
      ;(searchRef.current ?? emptyRef.current)?.focus()
      return
    }
    const items = list.querySelectorAll<HTMLElement>(
      "[data-slot=conversation-history-item]",
    )
    items[Math.min(index, items.length - 1)]?.focus()
  })

  if (conversations.length === 0) {
    return (
      <p
        {...groupProps}
        ref={composedEmptyRef}
        tabIndex={-1}
        className={cn(
          "m-0 rounded-xl px-1 py-6 text-center font-sans nessa-text-3 text-muted-foreground",
          // It takes focus only when the last row goes, so the keyboard
          // has somewhere visible to land.
          rowFocusClassName,
          className,
        )}
      >
        {emptyMessage}
      </p>
    )
  }
  return (
    <ul
      {...groupProps}
      ref={composedListRef}
      data-slot="conversation-history-list"
      role="list"
      aria-label={label}
      className={cn(
        "m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {conversations.map((conversation) => (
        <ConversationHistoryRow
          key={conversation.id}
          conversation={conversation}
          selected={conversation.id === value}
          actions={rowActions?.(conversation) ?? noActions}
          reservePreview={reservePreview}
          reserveProject={reserveProject}
          onSelect={selectRow}
          onAction={runRowAction}
        />
      ))}
    </ul>
  )
}

/**
 * A roster of conversations: an optional search field and a list of rows
 * the host already knows about. Each row leads with a RandomAvatar seeded
 * by project (or id when there is no project) so the roster reads like a
 * conversation list. The list stores nothing and sorts nothing — pass the
 * rows in the order they should appear, and apply the query before they
 * arrive. Each row is a button; the selected one is `aria-current`.
 * Opening a conversation is the host's job. Every row in a list is the same
 * height: a preview or project line any row uses is held by every row.
 *
 * **Row actions.** Give `rowActions` and rows reveal those actions the way
 * Mail does. Swiping a row toward its leading edge — a touch or pen drag, a
 * mouse drag, or a two-finger horizontal trackpad swipe — slides it and
 * uncovers the actions on the trailing edge; they ride in with the row at
 * full size and their labels fade in as they arrive. Let go past half the
 * tray and the row rests open; short of that it springs back. Swipe on past
 * at least 60% of the row (further when the tray is wide) and the primary
 * (first) action fills the tray; letting go there commits it as the row
 * slides out. That full swipe belongs to drags: a two-finger trackpad swipe
 * never commits, since browsers cannot tell its fingers from the inertia
 * that follows them. It opens the actions at most, and the primary action
 * is then one press away. A host that keeps the row sees it slide back
 * closed. A touch
 * or pen long-press opens the actions without a swipe. One row is open at
 * a time; a press anywhere else, a scroll, or a tap on the open row closes
 * it without selecting anything, and a swipe never selects the row it
 * moves. A gesture that sets off vertically stays a scroll.
 *
 * **Confirmation.** A destructive action — or any action with `confirm` —
 * does not run on its first press: it grows to fill the tray and reads
 * "Confirm" (`confirmLabel`), and a second press runs it. Escape, closing
 * the row, or pressing elsewhere backs out. A destructive action never
 * commits from a swipe, even when it is first; it rests open instead.
 * `render` replaces an action's icon and label with the host's own content
 * while the component keeps the button, its states, and its name.
 *
 * **Keyboard.** Every action is a real button. On a focused row the
 * ContextMenu key or Shift+F10 opens its actions and focuses the first; Tab
 * moves between them and Enter or Space runs one (or asks to confirm it).
 * Escape backs out of a confirmation, then closes the actions and returns
 * focus to the row; tabbing out of the row closes them too. A right-click
 * opens them the same way. Each action is named by its label and the
 * conversation title, such as "Archive Release notes", and "Confirm: Delete
 * Release notes" while confirming. When an action removes its row and focus
 * was in that row, focus moves to the row that took its place — or to the
 * search field or empty state when none did — provided the host removes it
 * synchronously. The list's own status region speaks only its confirmation
 * prompts; a host that removes a row should say so in a live region it
 * keeps mounted.
 *
 * **Motion.** Settling runs on the motion tokens. Under reduced motion the
 * row does not slide: it jumps between closed and open as the gesture
 * crosses the same thresholds, and every action still works. A closed row
 * carries no transform.
 *
 * Each row is a `SwipeRow` inside one `SwipeRowGroup`, which own all of the
 * behavior above; a host list of its own can use them directly.
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
  rowActions,
  onRowAction,
  debug = false,
  className,
  ...props
}: ConversationHistoryProps) {
  const searchId = React.useId()
  const searchRef = React.useRef<HTMLInputElement>(null)

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
            ref={searchRef}
            id={searchId}
            type="search"
            value={query ?? ""}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 rounded-full border-border bg-muted/50 pl-9"
          />
        </div>
      ) : null}
      {/* The group merges into the list, so a press on the search field is
          "elsewhere" and only the list's own scroll closes a row. Its status
          region follows the list, named conversation-history-status. */}
      <SwipeRowGroup
        asChild
        data-slot="conversation-history"
        debug={debug}
        debugGlobal="__nessaConversationHistory"
        // The status region stays with the list while `rowActions` is set,
        // even when a search empties it.
        hasActions={rowActions !== undefined}
      >
        <ConversationHistoryBody
          conversations={conversations}
          value={value}
          label={label}
          emptyMessage={emptyMessage}
          rowActions={rowActions}
          onRowAction={onRowAction}
          onValueChange={onValueChange}
          searchRef={searchRef}
        />
      </SwipeRowGroup>
    </div>
  )
}

export { ConversationHistory, conversationAvatarSeed }
