"use client"

import * as React from "react"

/**
 * The one collection engine behind Nessa's listboxes: which rows Arrow keys
 * visit, which row holds the single tab stop, and which row is highlighted.
 *
 * It exists because that engine was written twice. Two listboxes maintained
 * separately drifted on five points — whether a disabled row could be focused,
 * whether a modified Arrow key was ignored, whether Home and End were claimed,
 * how loading was announced, and whether text aligned logically — and none of
 * those differences was a decision anybody recorded. They were just what each
 * file happened to do. A keyboard contract that varies by which listbox a
 * consumer reached for is not a contract.
 *
 * What stays with the components is what actually makes them different: a
 * search field and filtering, or sticky section headers. Presentation is the
 * variable; navigation is not.
 */

/**
 * What Arrow keys do when they reach a disabled row.
 *
 * Both answers are legitimate, which is exactly why it is a prop rather than
 * something each file settles for itself. `focusable` keeps disabled rows in
 * the sequence so a screen reader reads why an option is unavailable — the
 * right default when unavailability is information, as in a picker listing a
 * model the account cannot use. `skipped` removes them, the right default
 * when a disabled row is noise to be stepped over.
 *
 * The choice also decides how the row is disabled in the DOM, because the two
 * have to agree: a `focusable` row is `aria-disabled` and still reachable, a
 * `skipped` row carries the native `disabled` attribute and is not.
 */
export type ListboxDisabledBehavior = "focusable" | "skipped"

/** One row, in the order it is rendered. */
export interface ListboxEntry {
  /** Unique within this listbox. */
  id: string
  disabled: boolean
}

export interface UseListboxCollectionOptions {
  /** Every row currently rendered, in document order across any grouping. */
  entries: readonly ListboxEntry[]
  /** The selected row, used as the tab stop when nothing is being navigated. */
  value?: string
  /** Disables the whole listbox. */
  disabled?: boolean
  /** @defaultValue "focusable" */
  disabledBehavior?: ListboxDisabledBehavior
}

export interface ListboxNavigationOptions {
  /** The row the keystroke came from. Omitted for a search field above the list. */
  from?: string
  /**
   * Whether Home and End move through the collection.
   *
   * False for a text field, where those keys belong to the caret and taking
   * them would strand someone mid-query with no way to reach either end of
   * what they typed.
   * @defaultValue true
   */
  allowHomeEnd?: boolean
}

export interface ListboxCollection {
  /** The row under the pointer or the Arrow keys, for the hover treatment. */
  highlightedId: string | undefined
  /**
   * The row holding the collection's single tab stop.
   *
   * Roving first, then the selection, then the first navigable row — so Tab
   * always lands somewhere meaningful, and returns to where navigation left
   * off rather than to the top.
   */
  rovingItemId: string | undefined
  /** Whether Arrow keys visit this row. */
  isNavigable: (entry: ListboxEntry) => boolean
  setHighlighted: (id: string | undefined) => void
  /** The `ref` callback for a row, keeping the map focus moves through. */
  registerOption: (id: string) => (node: HTMLElement | null) => void
  /** Records a row taking focus by any means, including a pointer. */
  handleOptionFocus: (id: string) => void
  /** Arrow/Home/End handling, shared by the rows and by a search field. */
  handleNavigation: (
    event: React.KeyboardEvent,
    options?: ListboxNavigationOptions,
  ) => void
  /** Drops highlight and roving, for a query change that replaces the rows. */
  reset: () => void
}

/**
 * Runs one listbox's keyboard and highlight state.
 *
 * @param options - The rows and the policies that apply to them.
 * @returns The state and handlers a listbox renders against.
 */
export function useListboxCollection({
  entries,
  value,
  disabled = false,
  disabledBehavior = "focusable",
}: UseListboxCollectionOptions): ListboxCollection {
  const [highlightedId, setHighlightedId] = React.useState<string>()
  const [rovingId, setRovingId] = React.useState<string>()
  const optionRefs = React.useRef(new Map<string, HTMLElement>())

  const isNavigable = React.useCallback(
    (entry: ListboxEntry) => disabledBehavior === "focusable" || !entry.disabled,
    [disabledBehavior],
  )
  const navigable = entries.filter(isNavigable)
  // Keyed on which rows exist, not on the array holding them: `entries` is
  // rebuilt every render, so an effect depending on it would re-run on every
  // render for no reason.
  const navigableKey = JSON.stringify(navigable.map((entry) => entry.id))

  // A row that is filtered out, replaced by an async load, or disabled while
  // it held the highlight or the tab stop leaves both pointing at nothing.
  // Dropping them puts the tab stop back on the selection, or the first row.
  React.useEffect(() => {
    const ids = new Set<string>(JSON.parse(navigableKey) as string[])
    setHighlightedId((current) =>
      current !== undefined && !ids.has(current) ? undefined : current,
    )
    setRovingId((current) =>
      current !== undefined && !ids.has(current) ? undefined : current,
    )
  }, [navigableKey])

  const rovingIsNavigable =
    rovingId !== undefined && navigable.some((entry) => entry.id === rovingId)
  const selectionIsNavigable =
    value !== undefined && navigable.some((entry) => entry.id === value)
  const rovingItemId = rovingIsNavigable
    ? rovingId
    : selectionIsNavigable
      ? value
      : navigable[0]?.id

  const registerOption = React.useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (node) optionRefs.current.set(id, node)
      else optionRefs.current.delete(id)
    },
    [],
  )

  const handleOptionFocus = React.useCallback((id: string) => {
    setHighlightedId(id)
    setRovingId(id)
  }, [])

  const reset = React.useCallback(() => {
    setHighlightedId(undefined)
    setRovingId(undefined)
  }, [])

  const focusIndex = React.useCallback(
    (index: number) => {
      const entry = navigable[index]
      if (!entry) return
      setHighlightedId(entry.id)
      setRovingId(entry.id)
      optionRefs.current.get(entry.id)?.focus()
    },
    [navigable],
  )

  const handleNavigation = React.useCallback(
    (event: React.KeyboardEvent, options: ListboxNavigationOptions = {}) => {
      const { from, allowHomeEnd = true } = options
      // A modified Arrow key is somebody else's shortcut — a browser tab
      // switch, a caret jump by word, an extend-selection — and swallowing it
      // to move a highlight is a keystroke stolen rather than handled.
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp"
      const isEdge = allowHomeEnd && (event.key === "Home" || event.key === "End")
      if (!isArrow && !isEdge) return
      if (disabled || navigable.length === 0) return
      event.preventDefault()
      const currentIndex = from
        ? navigable.findIndex((entry) => entry.id === from)
        : -1
      const last = navigable.length - 1
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : event.key === "ArrowDown"
              ? currentIndex < 0 || currentIndex === last
                ? 0
                : currentIndex + 1
              : currentIndex <= 0
                ? last
                : currentIndex - 1
      focusIndex(nextIndex)
    },
    [disabled, focusIndex, navigable],
  )

  return {
    highlightedId,
    rovingItemId,
    isNavigable,
    setHighlighted: setHighlightedId,
    registerOption,
    handleOptionFocus,
    handleNavigation,
    reset,
  }
}
