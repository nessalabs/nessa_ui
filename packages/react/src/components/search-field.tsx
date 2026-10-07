"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { Search, X } from "lucide-react"

import { Kbd } from "./kbd"
import { cn } from "@/lib/utils"

const searchFieldVariants = cva(
  "relative flex w-full min-w-0 items-center rounded-md bg-foreground/(--nessa-state-hover) font-sans text-foreground transition-[background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:bg-foreground/(--nessa-state-hover-strong) focus-within:bg-foreground/(--nessa-state-hover-strong) focus-within:outline-solid focus-within:outline-(length:--nessa-focus-outline-width) focus-within:outline-ring has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-50",
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
 * Escape clears a non-empty query and keeps focus in the field; on an empty
 * field Escape is left to the host, to close whatever the field sits in.
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
    const clear = () => {
      change("")
      onClear?.()
      inputRef.current?.focus()
    }

    return (
      <div
        data-slot="search-field"
        data-size={size}
        className={cn(searchFieldVariants({ size }), className)}
      >
        <Search
          aria-hidden="true"
          className={cn("pointer-events-none shrink-0 text-muted-foreground", size === "lg" ? "size-4" : "size-3.5")}
        />
        <input
          ref={setRef}
          type="search"
          data-slot="search-field-input"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          {...props}
          value={query}
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (event.defaultPrevented) return
            if (event.key === "Escape" && query !== "") {
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
        {query !== "" ? (
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
        ) : shortcut !== undefined ? (
          <Kbd
            aria-hidden="true"
            data-slot="search-field-shortcut"
            className="me-1.5 peer-focus:hidden"
          >
            {shortcut}
          </Kbd>
        ) : null}
      </div>
    )
  },
)
SearchField.displayName = "SearchField"

export { SearchField }
