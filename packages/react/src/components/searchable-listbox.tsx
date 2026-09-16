"use client"

import * as React from "react"
import { LoaderCircle, Search } from "lucide-react"

import {
  useListboxCollection,
  type ListboxDisabledBehavior,
} from "@/lib/listbox-collection"
import { cn } from "@/lib/utils"

/** Describes the selection and focus state supplied to an item renderer. */
export interface SearchableListboxRenderState {
  selected: boolean
  highlighted: boolean
}

/** Configures a searchable, single-select list while leaving item content to the consumer. */
export interface SearchableListboxProps<Item> {
  ref?: React.Ref<HTMLDivElement>
  /** Records presented and filtered by the listbox. */
  items: readonly Item[]
  /** Returns a stable ID that is unique within this listbox instance. */
  getItemId: (item: Item) => string
  /** Returns every string that should participate in case-insensitive search. */
  getItemKeywords: (item: Item) => readonly (string | undefined)[]
  /**
   * Renders non-interactive row content inside the component-owned option.
   *
   * The option is already a button; a control inside it would be a control
   * inside a control, which is unreachable by keyboard and announced wrongly.
   * Render text, icons and badges here and let the row own activation.
   */
  renderItem: (
    item: Item,
    state: SearchableListboxRenderState,
  ) => React.ReactNode
  /** The selected item ID. */
  value?: string
  onValueChange?: (value: string, item: Item) => void
  query?: string
  defaultQuery?: string
  onQueryChange?: (query: string) => void
  isItemDisabled?: (item: Item) => boolean
  /**
   * Whether Arrow keys visit disabled rows.
   *
   * Defaults to `focusable`, because a searchable list is usually a catalogue
   * and why an option is unavailable is information worth reaching. Pass
   * `skipped` when a disabled row is only noise.
   * @defaultValue "focusable"
   */
  disabledBehavior?: ListboxDisabledBehavior
  searchPlaceholder?: string
  /** The accessible name announced for the list of matching options. */
  listLabel: string
  emptyMessage?: React.ReactNode
  loading?: boolean
  loadingMessage?: React.ReactNode
  disabled?: boolean
  className?: string
  searchClassName?: string
  listClassName?: string
  optionClassName?: string
}

/** Returns whether an item contains a normalized query in any searchable keyword. */
function itemMatchesQuery<Item>(
  item: Item,
  normalizedQuery: string,
  getItemKeywords: SearchableListboxProps<Item>["getItemKeywords"],
) {
  if (!normalizedQuery) return true
  return getItemKeywords(item).some((keyword) =>
    keyword?.toLocaleLowerCase().includes(normalizedQuery),
  )
}

/**
 * Renders a searchable single-select listbox with controlled or uncontrolled
 * query state, roving keyboard focus, and consumer-defined row content.
 *
 * Keyboard behavior comes from the shared listbox collection, so it matches
 * SectionedListbox exactly: Arrow keys wrap, Home and End jump to the ends,
 * and a modified Arrow key is left to whoever owns that shortcut. Home and
 * End belong to the caret while the search field has focus.
 */
function SearchableListbox<Item>({
  ref,
  items,
  getItemId,
  getItemKeywords,
  renderItem,
  value,
  onValueChange,
  query: queryProp,
  defaultQuery = "",
  onQueryChange,
  isItemDisabled = () => false,
  disabledBehavior = "focusable",
  searchPlaceholder = "Search",
  listLabel,
  emptyMessage = "No results found",
  loading = false,
  loadingMessage = "Loading",
  disabled = false,
  className,
  searchClassName,
  listClassName,
  optionClassName,
}: SearchableListboxProps<Item>) {
  const [uncontrolledQuery, setUncontrolledQuery] = React.useState(defaultQuery)
  const listboxId = React.useId()
  const query = queryProp ?? uncontrolledQuery
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredItems = React.useMemo(
    () =>
      items.filter((item) =>
        itemMatchesQuery(item, normalizedQuery, getItemKeywords),
      ),
    [getItemKeywords, items, normalizedQuery],
  )
  const entries = filteredItems.map((item) => ({
    id: getItemId(item),
    disabled: disabled || isItemDisabled(item),
  }))
  const collection = useListboxCollection({
    entries,
    value,
    disabled,
    disabledBehavior,
  })

  /** Updates the owned query when uncontrolled and always notifies the consumer. */
  const setQuery = React.useCallback(
    (nextQuery: string) => {
      if (queryProp === undefined) setUncontrolledQuery(nextQuery)
      // The rows are about to be a different set, so navigation starts over
      // rather than resuming at a position that meant something else.
      collection.reset()
      onQueryChange?.(nextQuery)
    },
    [collection, onQueryChange, queryProp],
  )

  return (
    <div ref={ref} data-slot="searchable-listbox" className={cn("min-w-0", className)}>
      <label
        data-slot="searchable-listbox-search"
        className={cn(
          // The search row owns the focus treatment for the field it wraps,
          // because the bare input must not paint an outline of its own.
          "flex h-11 items-center gap-2 border-b border-border px-3 text-muted-foreground transition-colors focus-within:bg-accent/50 focus-within:text-foreground",
          searchClassName,
        )}
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">{searchPlaceholder}</span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault()
              event.stopPropagation()
              setQuery("")
              return
            }
            // Home and End stay with the caret here: taking them would leave
            // someone mid-query unable to reach either end of what they typed.
            collection.handleNavigation(event, { allowHomeEnd: false })
          }}
          placeholder={searchPlaceholder}
          autoComplete="off"
          disabled={disabled}
          aria-controls={listboxId}
          // The field carries no outline of its own: browsers match
          // :focus-visible on editable fields for pointer focus too, so an
          // outline here reads as a permanent box around the search row for as
          // long as the surface is open. The caret indicates focus, and the
          // wrapping row owns the surface treatment.
          className="h-full min-w-0 flex-1 appearance-none bg-transparent font-sans nessa-text-4 text-foreground outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
        />
      </label>
      {/* Mounted with the surface and empty until there is something to say.
          A region inserted together with its first text is a mutation
          assistive technology does not announce, so the loading and empty
          blocks below stay plain and this carries their wording instead. */}
      <span
        role="status"
        aria-live="polite"
        data-slot="searchable-listbox-announcement"
        className="sr-only"
      >
        {loading ? loadingMessage : filteredItems.length === 0 ? emptyMessage : ""}
      </span>
      <div
        data-slot="searchable-listbox-list"
        id={listboxId}
        role={!loading && filteredItems.length > 0 ? "listbox" : undefined}
        aria-label={!loading && filteredItems.length > 0 ? listLabel : undefined}
        className={cn("max-h-80 overflow-y-auto p-1.5", listClassName)}
        onPointerLeave={() => collection.setHighlighted(undefined)}
      >
        {loading ? (
          <div
            data-slot="searchable-listbox-loading"
            className="flex min-h-28 items-center justify-center gap-2 px-3 nessa-text-4 text-muted-foreground"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {loadingMessage}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {filteredItems.map((item) => {
              const itemId = getItemId(item)
              const selected = value === itemId
              const highlighted = collection.highlightedId === itemId
              const itemDisabled = disabled || isItemDisabled(item)
              const navigable = collection.isNavigable({
                id: itemId,
                disabled: itemDisabled,
              })
              return (
                <button
                  key={itemId}
                  type="button"
                  ref={collection.registerOption(itemId)}
                  id={`${listboxId}-option-${encodeURIComponent(itemId)}`}
                  role="option"
                  aria-selected={selected}
                  tabIndex={!disabled && collection.rovingItemId === itemId ? 0 : -1}
                  data-slot="searchable-listbox-option"
                  data-selected={selected ? "true" : "false"}
                  data-highlighted={highlighted ? "true" : "false"}
                  // How the row is disabled follows the navigation policy: a
                  // row Arrow keys still visit must stay focusable, so it is
                  // `aria-disabled`; one they skip takes the native attribute
                  // and leaves the tab order with it.
                  aria-disabled={itemDisabled || undefined}
                  disabled={itemDisabled && !navigable}
                  onPointerMove={() => {
                    if (!itemDisabled) collection.setHighlighted(itemId)
                  }}
                  onFocus={() => collection.handleOptionFocus(itemId)}
                  onKeyDown={(event) =>
                    collection.handleNavigation(event, { from: itemId })
                  }
                  onClick={() => {
                    if (!itemDisabled) onValueChange?.(itemId, item)
                  }}
                  className={cn(
                    // Rows carry real padding and a text level by default so a
                    // bare renderItem gets a finished row; content-styled
                    // consumers strip it back via optionClassName.
                    "w-full rounded-2xl px-2.5 py-2 text-start font-sans nessa-text-4 outline-none transition-colors focus-visible:bg-accent focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:opacity-45 disabled:pointer-events-none disabled:opacity-45",
                    highlighted && "bg-accent/70",
                    optionClassName,
                  )}
                >
                  {renderItem(item, { selected, highlighted })}
                </button>
              )
            })}
          </div>
        ) : (
          <div
            data-slot="searchable-listbox-empty"
            className="flex min-h-28 items-center justify-center px-3 nessa-text-4 text-muted-foreground"
          >
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  )
}

export { SearchableListbox }
