"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { Search, X } from "lucide-react"

import { Kbd } from "./kbd"
import { cn } from "@/lib/utils"

/**
 * The field's surface reads from custom properties a host can set on any
 * ancestor, each defaulting to the kit's own value: `--nessa-search-radius`,
 * `--nessa-search-padding-x` (start padding), `--nessa-search-padding-y`,
 * `--nessa-search-rest-fill`, `--nessa-search-hover-fill` (hover and focus),
 * `--nessa-search-ink` (the query), `--nessa-search-muted-ink` (icon,
 * placeholder, clear button), `--nessa-search-clear-hover` and
 * `--nessa-search-clear-press` (the clear button's fills), and
 * `--nessa-search-font-size`. The font size keeps the 1rem floor every
 * Nessa field has below 48rem, so focusing never zooms the page. Without
 * it the type level follows `size`; a `nessa-text-input` or
 * `nessa-text-input-2` class on the field replaces that level.
 */
const searchFieldVariants = cva(
  "relative flex w-full min-w-0 items-center rounded-[var(--nessa-search-radius,var(--radius-md))] py-[var(--nessa-search-padding-y,0px)] bg-[color:var(--nessa-search-rest-fill,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover),transparent))] font-sans text-[color:var(--nessa-search-ink,var(--foreground))] transition-[background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:bg-[color:var(--nessa-search-hover-fill,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] focus-within:bg-[color:var(--nessa-search-hover-fill,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] focus-within:outline-solid focus-within:outline-(length:--nessa-focus-outline-width) focus-within:outline-ring has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-50 forced-colors:outline-1 forced-colors:outline-solid forced-colors:-outline-offset-1",
  {
    variants: {
      size: {
        sm: "min-h-7 gap-1.5 ps-[var(--nessa-search-padding-x,calc(var(--spacing)*2.5))] pe-0.5 nessa-text-input-2",
        md: "min-h-8 gap-2 ps-[var(--nessa-search-padding-x,calc(var(--spacing)*2.5))] pe-1 nessa-text-input-2",
        lg: "min-h-9 gap-2 ps-[var(--nessa-search-padding-x,calc(var(--spacing)*3))] pe-1.5 nessa-text-input",
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
   * Height: `sm` 28px, `md` 32px, `lg` 36px — a minimum, so a larger
   * `--nessa-search-padding-y` or type level grows the field.
   * @defaultValue "md"
   */
  size?: "sm" | "md" | "lg"
  /**
   * The mark at the start, decorative. Pass the host's own icon to match
   * its family; it is sized like the default unless it sets its own size.
   * @defaultValue a magnifier
   */
  icon?: React.ReactNode
  /**
   * The clear button's glyph, decorative.
   * @defaultValue a cross
   */
  clearIcon?: React.ReactNode
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
 * the event's target carries `data-clearable` — the input has it while it
 * holds text it can clear (not read-only, disabled, or controlled with no
 * `onValueChange`), so a read-only field holding text still lets the overlay
 * close. Two cases it does not cover: during IME composition Escape cancels
 * the composition, and a host whose own `onKeyDown` cancels Escape should
 * not also guard the overlay, or the key does nothing. The field still clears, because only a
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
      icon,
      clearIcon,
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

    // An uncontrolled field returns to `defaultValue` when its form resets.
    // The input is always rendered with a value, so the browser's own reset
    // cannot reach it; the field listens for the form's reset instead.
    const resetRef = React.useRef<() => void>(() => {})
    resetRef.current = () => {
      if (value === undefined && own !== defaultValue) change(defaultValue)
    }
    React.useEffect(() => {
      const form = inputRef.current?.form
      if (!form) return
      const onReset = () => resetRef.current()
      form.addEventListener("reset", onReset)
      return () => form.removeEventListener("reset", onReset)
    }, [])
    // A field that cannot change — read-only, or controlled with nobody
    // listening — has nothing to clear, so it shows no clear button and
    // leaves Escape to the host.
    const clearable =
      query !== "" &&
      !disabled &&
      !props.readOnly &&
      (value === undefined || onValueChange !== undefined)
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
        <span
          aria-hidden="true"
          data-slot="search-field-icon"
          className={cn(
            "pointer-events-none flex shrink-0 text-[color:var(--nessa-search-muted-ink,var(--muted-foreground))]",
            size === "lg"
              ? "[&_svg:not([class*='size-'])]:size-4"
              : "[&_svg:not([class*='size-'])]:size-3.5",
          )}
        >
          {icon ?? <Search />}
        </span>
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
          // The type level is the field's (it floors at 1rem on narrow
          // viewports, as every Nessa field does, so focusing never zooms
          // the page). With `--nessa-search-font-size` unset these two
          // declarations are invalid, so font-size falls back to inheriting
          // the field's level; set, the floor still holds below 48rem.
          className="peer min-w-0 flex-1 appearance-none self-stretch border-0 bg-transparent p-0 font-sans [font-size:max(1rem,var(--nessa-search-font-size))] md:[font-size:var(--nessa-search-font-size)] [line-height:inherit] [letter-spacing:inherit] [color:inherit] outline-none placeholder:text-[color:var(--nessa-search-muted-ink,var(--muted-foreground))] [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        />
        {clearable ? (
          <button
            type="button"
            tabIndex={-1}
            data-slot="search-field-clear"
            aria-label={clearLabel}
            disabled={disabled}
            onClick={clear}
            className="grid size-6 shrink-0 cursor-default appearance-none place-items-center rounded-full border-0 bg-transparent p-0 text-[color:var(--nessa-search-muted-ink,var(--muted-foreground))] transition-[color,background-color] [transition-duration:var(--nessa-motion-duration-fast)] hover:bg-[color:var(--nessa-search-clear-hover,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] hover:text-[color:var(--nessa-search-ink,var(--foreground))] active:bg-[color:var(--nessa-search-clear-press,color-mix(in_oklab,var(--foreground)_var(--nessa-state-press),transparent))] [&_svg:not([class*='size-'])]:size-3.5"
          >
            <span aria-hidden="true" className="flex">
              {clearIcon ?? <X />}
            </span>
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
