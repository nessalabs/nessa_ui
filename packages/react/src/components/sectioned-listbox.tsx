"use client"

import * as React from "react"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

/** Describes the selection and focus state supplied to an item renderer. */
export interface SectionedListboxRenderState {
  selected: boolean
  highlighted: boolean
}

/** Groups a labeled run of items under a section header. */
export interface SectionedListboxSection<Item> {
  id: string
  label: React.ReactNode
  items: readonly Item[]
}

/** Configures a single-select list of sticky-headed sections while leaving item content to the consumer. */
export interface SectionedListboxProps<Item> {
  /** Section IDs and item IDs (via `getItemId`) must each be unique within this listbox instance. */
  sections: readonly SectionedListboxSection<Item>[]
  /** Returns a stable ID that is unique within this listbox instance. */
  getItemId: (item: Item) => string
  /** Renders non-interactive row content inside the component-owned option. */
  renderItem: (
    item: Item,
    state: SectionedListboxRenderState,
  ) => React.ReactNode
  value?: string
  onValueChange?: (value: string, item: Item) => void
  isItemDisabled?: (item: Item) => boolean
  listLabel: string
  emptyMessage?: React.ReactNode
  loading?: boolean
  loadingMessage?: React.ReactNode
  disabled?: boolean
  className?: string
  sectionLabelClassName?: string
  optionClassName?: string
}

interface FlatItem<Item> {
  item: Item
  itemId: string
  disabled: boolean
}

/**
 * Renders a single-select list of items grouped under sticky section headers,
 * with roving keyboard focus that moves continuously across section
 * boundaries. Row content, selection, and async states are left to the
 * consumer, matching the shape of `SearchableListbox`.
 */
function SectionedListbox<Item>({
  sections,
  getItemId,
  renderItem,
  value,
  onValueChange,
  isItemDisabled = () => false,
  listLabel,
  emptyMessage = "No results found",
  loading = false,
  loadingMessage = "Loading",
  disabled = false,
  className,
  sectionLabelClassName,
  optionClassName,
}: SectionedListboxProps<Item>) {
  const [highlightedId, setHighlightedId] = React.useState<string>()
  const [rovingId, setRovingId] = React.useState<string>()
  const optionRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const listboxId = React.useId()
  const visibleSections = sections.filter((section) => section.items.length > 0)
  const flatItems: FlatItem<Item>[] = visibleSections.flatMap((section) =>
    section.items.map((item) => ({
      item,
      itemId: getItemId(item),
      disabled: disabled || isItemDisabled(item),
    })),
  )
  const enabledItems = flatItems.filter((entry) => !entry.disabled)
  const firstEnabledId = enabledItems[0]?.itemId
  const rovingItemIsVisible = enabledItems.some(
    (entry) => entry.itemId === rovingId,
  )
  const selectedItemIsVisible = enabledItems.some(
    (entry) => entry.itemId === value,
  )
  const rovingItemId = rovingItemIsVisible
    ? rovingId
    : selectedItemIsVisible
      ? value
      : firstEnabledId

  React.useEffect(() => {
    if (
      highlightedId &&
      !enabledItems.some((entry) => entry.itemId === highlightedId)
    ) {
      setHighlightedId(undefined)
    }
  }, [enabledItems, highlightedId])

  React.useEffect(() => {
    if (rovingId && !enabledItems.some((entry) => entry.itemId === rovingId)) {
      setRovingId(undefined)
    }
  }, [enabledItems, rovingId])

  /** Moves focus to an enabled item at the supplied cyclic-list index. */
  const focusItem = React.useCallback(
    (index: number) => {
      const entry = enabledItems[index]
      if (!entry) return
      setHighlightedId(entry.itemId)
      setRovingId(entry.itemId)
      optionRefs.current.get(entry.itemId)?.focus()
    },
    [enabledItems],
  )

  /** Handles vertical roving focus across sections from the current option. */
  const handleNavigation = React.useCallback(
    (event: React.KeyboardEvent, currentId: string) => {
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return
      }
      if (enabledItems.length === 0) return
      event.preventDefault()
      const currentIndex = enabledItems.findIndex(
        (entry) => entry.itemId === currentId,
      )
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? enabledItems.length - 1
            : event.key === "ArrowDown"
              ? currentIndex < 0 || currentIndex === enabledItems.length - 1
                ? 0
                : currentIndex + 1
              : currentIndex <= 0
                ? enabledItems.length - 1
                : currentIndex - 1
      focusItem(nextIndex)
    },
    [enabledItems, focusItem],
  )

  return (
    <div
      data-slot="sectioned-listbox"
      id={listboxId}
      role={!loading && flatItems.length > 0 ? "listbox" : undefined}
      aria-label={!loading && flatItems.length > 0 ? listLabel : undefined}
      className={cn("max-h-80 overflow-y-auto", className)}
    >
      {loading ? (
        <div
          data-slot="sectioned-listbox-loading"
          className="flex min-h-28 items-center justify-center gap-2 px-3 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {loadingMessage}
        </div>
      ) : flatItems.length > 0 ? (
        visibleSections.map((section) => {
          const sectionHeaderId = `${listboxId}-section-${encodeURIComponent(section.id)}`
          return (
            <div
              key={section.id}
              data-slot="sectioned-listbox-section"
              role="group"
              aria-labelledby={sectionHeaderId}
            >
              <div
                id={sectionHeaderId}
                data-slot="sectioned-listbox-section-label"
                className={cn(
                  "sticky top-0 z-10 bg-popover px-3 py-2 font-sans text-sm font-medium text-foreground",
                  sectionLabelClassName,
                )}
              >
                {section.label}
              </div>
              <div className="flex flex-col gap-0.5 p-1.5 pt-0">
                {section.items.map((item) => {
                  const itemId = getItemId(item)
                  const selected = value === itemId
                  const highlighted = highlightedId === itemId
                  const itemDisabled = disabled || isItemDisabled(item)
                  return (
                    <button
                      key={itemId}
                      type="button"
                      ref={(node) => {
                        if (node) optionRefs.current.set(itemId, node)
                        else optionRefs.current.delete(itemId)
                      }}
                      id={`${listboxId}-option-${encodeURIComponent(itemId)}`}
                      role="option"
                      aria-selected={selected}
                      tabIndex={!itemDisabled && rovingItemId === itemId ? 0 : -1}
                      data-slot="sectioned-listbox-option"
                      data-selected={selected ? "true" : "false"}
                      data-highlighted={highlighted ? "true" : "false"}
                      disabled={itemDisabled}
                      onPointerMove={() => {
                        if (!itemDisabled) setHighlightedId(itemId)
                      }}
                      onFocus={() => {
                        setHighlightedId(itemId)
                        setRovingId(itemId)
                      }}
                      onKeyDown={(event) => handleNavigation(event, itemId)}
                      onClick={() => {
                        if (!itemDisabled) onValueChange?.(itemId, item)
                      }}
                      className={cn(
                        "w-full rounded-xl text-left font-sans outline-none transition-colors focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45",
                        highlighted && "bg-accent/70",
                        optionClassName,
                      )}
                    >
                      {renderItem(item, { selected, highlighted })}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      ) : (
        <div
          data-slot="sectioned-listbox-empty"
          className="flex min-h-28 items-center justify-center px-3 text-sm text-muted-foreground"
          role="status"
        >
          {emptyMessage}
        </div>
      )}
    </div>
  )
}

export { SectionedListbox }
