"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { Search, X } from "lucide-react"

import { Kbd } from "./kbd"
import { cn } from "@/lib/utils"

const searchFieldVariants = cva(
  "relative flex w-full min-w-0 items-center rounded-md bg-foreground/(--nessa-state-hover) font-sans text-foreground transition-[background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:bg-foreground/(--nessa-state-hover-strong) focus-within:bg-foreground/(--nessa-state-hover-strong) focus-within:outline-solid focus-within:outline-(length:--nessa-focus-outline-width) focus-within:outline-ring has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-50 forced-colors:outline-1 forced-colors:outline-solid forced-colors:-outline-offset-1",
  {
    variants: {
      size: {
        sm: "h-7 gap-1.5 ps-2.5 pe-0.5",
        md: "h-8 gap-2 ps-2.5 pe-1",
        lg: "h-9 gap-2 ps-3 pe-1.5",
      },
    },
    defaultVariants: { size: "md" },
  },
)

export interface SearchFieldProps
  extends Omit<React.ComponentProps<"input">, "type" | "size" | "value" | "defaultValue" | "onChange"> {
  /** The query. Pass it to control the field. */
  value?: string
  /** The starting query, when the field is not controlled. */
  defaultValue?: string
  /** Called with the new query on every edit, and with `""` when cleared. */
  onValueChange?: (value: string) => void
  /** Called after the query is cleared, by the clear button or by Escape. */
  onClear?: () => void
  /**
   * The key that brings the field into focus, shown as a key cap while the
   * field is empty and not focused — `"⌘K"`, `"/"`. It is a hint only; the
   * host binds the key, and can name it to assistive technology with
   * `aria-keyshortcuts`.
   */
  shortcut?: React.ReactNode
  /**
   * The clear button's accessible name.
   * @defaultValue "Clear search"
   */
  clearLabel?: string
  /**
   * Height: `sm` 28px, `md` 32px, `lg` 36px.
   * @defaultValue "md"
   */
  size?: "sm" | "md" | "lg"
}

/**
 * A search box: a magnifier, the query, and at the end either the key that
 * focuses it (while empty) or a button that clears it (once there is text).
 *
 * Escape, exactly: on a non-empty field that can change, Escape clears the
 * query, keeps focus in the field, and stops the key from reaching React
 * ancestors. On an empty field (or one that cannot change, or during IME
 * composition) the field leaves the key alone. A Radix overlay around the
 * field — Drawer, DropdownMenu, Popover — listens for Escape on the document
 * before the field sees it, so it closes on that same key unless the host
 * guards it: in the overlay's `onEscapeKeyDown`, call `preventDefault()` when
 * the event's target carries `data-clearable` — the input has it exactly
 * while Escape will clear it, so a read-only field holding text still lets
 * the overlay close. The field still clears, because only a
 * `preventDefault()` called by its own `onKeyDown` prop cancels the clear.
 *
 * The clear button is skipped by Tab, since Escape does the same from the
 * field; a pointer or a screen reader's cursor reaches it. Name the field
 * with `aria-label` when no visible label names it. `className` styles the
 * field's frame; every other prop reaches the `<input type="search">`.
 */
const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(
    {
      value,
      defaultValue = "",
      onValueChange,
      onClear,
      shortcut,
      clearLabel = "Clear search",
      size = "md",
      className,
      onKeyDown,
      disabled,
      ...props
    },
    forwardedRef,
  ) {
    const [own, setOwn] = React.useState(defaultValue)
    const query = value ?? own
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const setRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node
        if (typeof forwardedRef === "function") forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef],
    )

    const change = (next: string) => {
      if (value === undefined) setOwn(next)
      onValueChange?.(next)
    }
    // A field that cannot change — read-only, or controlled with nobody
    // listening — has nothing to clear, so it shows no clear button and
    // leaves Escape to the host.
    const clearable =
      query !== "" && !props.readOnly && (value === undefined || onValueChange !== undefined)
    const clear = () => {
      change("")
      onClear?.()
      inputRef.current?.focus()
    }

    return (
      <div
        className={cn(searchFieldVariants({ size }), className)}
        data-slot="search-field"
        data-size={size}
      >
        <Search
          aria-hidden="true"
          className={cn("pointer-events-none shrink-0 text-muted-foreground", size === "lg" ? "size-4" : "size-3.5")}
        />
        <input
          ref={setRef}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          {...props}
          type="search"
          data-slot="search-field-input"
          data-clearable={clearable || undefined}
          value={query}
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => {
            // Only this field's own `onKeyDown` cancels the clear. An overlay
            // that prevented the key to stay open has marked it already, so
            // the field watches the call the handler makes rather than the
            // event's state.
            if (onKeyDown !== undefined) {
              let cancelled = false
              const preventDefault = event.preventDefault
              event.preventDefault = () => {
                cancelled = true
                preventDefault.call(event)
              }
              try {
                onKeyDown(event)
              } finally {
                event.preventDefault = preventDefault
              }
              if (cancelled) return
            }
            // Escape while an IME is composing cancels the composition, not the query.
            if (event.key === "Escape" && clearable && !event.nativeEvent.isComposing) {
              event.preventDefault()
              event.stopPropagation()
              clear()
            }
          }}
          // The input's text floors at 1rem on narrow viewports, as every
          // Nessa field does, so focusing it never zooms the page.
          className={cn(
            "peer h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 font-sans text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
            size === "lg" ? "nessa-text-input" : "nessa-text-input-2",
          )}
        />
        {clearable ? (
          <button
            type="button"
            tabIndex={-1}
            data-slot="search-field-clear"
            aria-label={clearLabel}
            disabled={disabled}
            onClick={clear}
            className="grid size-6 shrink-0 cursor-default appearance-none place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-[color,background-color] [transition-duration:var(--nessa-motion-duration-fast)] hover:bg-foreground/(--nessa-state-hover-strong) hover:text-foreground active:bg-foreground/(--nessa-state-press)"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : shortcut !== undefined && query === "" ? (
          <span
            aria-hidden="true"
            data-slot="search-field-shortcut"
            className="me-1.5 flex peer-focus:hidden"
          >
            <Kbd>{shortcut}</Kbd>
          </span>
        ) : null}
      </div>
    )
  },
)
SearchField.displayName = "SearchField"

export { SearchField }
