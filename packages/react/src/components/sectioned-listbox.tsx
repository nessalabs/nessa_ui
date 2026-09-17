"use client"

import * as React from "react"
import { LoaderCircle } from "lucide-react"

import {
  useListboxCollection,
  type ListboxDisabledBehavior,
} from "@/lib/listbox-collection"
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
  ref?: React.Ref<HTMLDivElement>
  /** Section IDs and item IDs (via `getItemId`) must each be unique within this listbox instance. */
  sections: readonly SectionedListboxSection<Item>[]
  /** Returns a stable ID that is unique within this listbox instance. */
  getItemId: (item: Item) => string
  /**
   * Renders non-interactive row content inside the component-owned option.
   *
   * The option is already a button; a control inside it would be a control
   * inside a control, which is unreachable by keyboard and announced wrongly.
   * Render text, icons and badges here and let the row own activation.
   */
  renderItem: (
    item: Item,
    state: SectionedListboxRenderState,
  ) => React.ReactNode
  value?: string
  onValueChange?: (value: string, item: Item) => void
  isItemDisabled?: (item: Item) => boolean
  /**
   * Whether Arrow keys visit disabled rows.
   *
   * Defaults to `skipped`, because a sectioned list is usually a set of
   * available choices and an unavailable one is a step to be taken out of the
   * way. Pass `focusable` when why a row is unavailable is worth reaching.
   * @defaultValue "skipped"
   */
  disabledBehavior?: ListboxDisabledBehavior
  listLabel: string
  emptyMessage?: React.ReactNode
  loading?: boolean
  loadingMessage?: React.ReactNode
  disabled?: boolean
  className?: string
  sectionLabelClassName?: string
  optionClassName?: string
}

/**
 * Renders a single-select list of items grouped under sticky section headers,
 * with roving keyboard focus that moves continuously across section
 * boundaries. Row content, selection, and async states are left to the
 * consumer, matching the shape of `SearchableListbox`.
 *
 * Keyboard behavior comes from the shared listbox collection, so it matches
 * SearchableListbox exactly: Arrow keys wrap across section boundaries, Home
 * and End jump to the ends of the whole collection rather than of a section,
 * and a modified Arrow key is left to whoever owns that shortcut.
 */
function SectionedListbox<Item>({
  ref,
  sections,
  getItemId,
  renderItem,
  value,
  onValueChange,
  isItemDisabled = () => false,
  disabledBehavior = "skipped",
  listLabel,
  emptyMessage = "No results found",
  loading = false,
  loadingMessage = "Loading",
  disabled = false,
  className,
  sectionLabelClassName,
  optionClassName,
}: SectionedListboxProps<Item>) {
  const listboxId = React.useId()
  const visibleSections = sections.filter((section) => section.items.length > 0)
  // Flattened across sections, because navigation is continuous: the section
  // headers group the rows visually and for assistive technology, and do not
  // break the sequence Arrow keys move through.
  const entries = visibleSections.flatMap((section) =>
    section.items.map((item) => ({
      id: getItemId(item),
      disabled: disabled || isItemDisabled(item),
    })),
  )
  const collection = useListboxCollection({
    entries,
    value,
    disabled,
    disabledBehavior,
  })

  return (
    <div
      ref={ref}
      data-slot="sectioned-listbox"
      // The scroll container, and the live region's parent — but not the
      // listbox itself. A `role="listbox"` may only contain options and
      // groups, so an announcement region inside one is an ARIA violation;
      // the role goes on an inner element, matching SearchableListbox, and
      // the sticky section headers still stick because this is the element
      // that scrolls.
      className={cn("max-h-80 overflow-y-auto", className)}
      onPointerLeave={() => collection.setHighlighted(undefined)}
    >
      {/* Mounted with the surface and empty until there is something to say,
          matching SearchableListbox. A region inserted together with its first
          text is a mutation assistive technology does not announce, so the
          loading and empty blocks below stay plain and this carries their
          wording instead. */}
      <span
        role="status"
        aria-live="polite"
        data-slot="sectioned-listbox-announcement"
        className="sr-only"
      >
        {loading ? loadingMessage : entries.length === 0 ? emptyMessage : ""}
      </span>
      {loading ? (
        <div
          data-slot="sectioned-listbox-loading"
          className="flex min-h-28 items-center justify-center gap-2 px-3 nessa-text-4 text-muted-foreground"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {loadingMessage}
        </div>
      ) : entries.length > 0 ? (
        <div
          id={listboxId}
          data-slot="sectioned-listbox-options"
          role="listbox"
          aria-label={listLabel}
        >
          {visibleSections.map((section) => {
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
                    "sticky top-0 z-10 bg-popover px-3 py-2 font-sans nessa-text-4 font-medium text-foreground",
                    sectionLabelClassName,
                  )}
                >
                  {section.label}
                </div>
                <div className="flex flex-col gap-0.5 p-1.5 pt-0">
                  {section.items.map((item) => {
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
                        // The tab stop follows the roving position, not the
                        // row's own availability. Under `focusable` the roving
                        // row may itself be disabled — that is the point of
                        // the policy — and withholding the tab stop there
                        // leaves the collection with no way in at all. A
                        // `skipped` row can never hold the position, so there
                        // is nothing to guard.
                        tabIndex={
                          !disabled && collection.rovingItemId === itemId ? 0 : -1
                        }
                        data-slot="sectioned-listbox-option"
                        data-selected={selected ? "true" : "false"}
                        data-highlighted={highlighted ? "true" : "false"}
                        // How the row is disabled follows the navigation policy:
                        // a row Arrow keys still visit must stay focusable, so it
                        // is `aria-disabled`; one they skip takes the native
                        // attribute and leaves the tab order with it.
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
                          // `text-start`, not `text-left`: the row follows the
                          // writing direction, so an RTL list is not left-aligned
                          // against its own text.
                          "w-full rounded-xl text-start font-sans outline-none transition-colors focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:opacity-45 disabled:pointer-events-none disabled:opacity-45",
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
          })}
        </div>
      ) : (
        <div
          data-slot="sectioned-listbox-empty"
          className="flex min-h-28 items-center justify-center px-3 nessa-text-4 text-muted-foreground"
        >
          {emptyMessage}
        </div>
      )}
    </div>
  )
}

export { SectionedListbox }
