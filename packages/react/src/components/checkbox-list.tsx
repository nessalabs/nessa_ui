"use client"

import * as React from "react"

import { ContentLabelContext } from "@/lib/control-label"
import {
  useListboxCollection,
  type ListboxDisabledBehavior,
} from "@/lib/listbox-collection"
import { cn, hasContent } from "@/lib/utils"

import { Checkbox } from "./checkbox"

/** One row in a `CheckboxList`. */
export interface CheckboxListOption {
  /** The value reported while this row is checked. Unique within the list. */
  value: string
  /** The row's name. */
  label: React.ReactNode
  /** A line under the name: what checking it does, or where it points. */
  description?: React.ReactNode
  /** Leaves this one row unavailable. Say why with `disabledReason`. */
  disabled?: boolean
  /**
   * Why the row is unavailable — "Doesn't take commands" — written under
   * the row and read as part of its description while it is disabled.
   */
  disabledReason?: React.ReactNode
}

/** The numbers a count hint is written from. */
export interface CheckboxListCount {
  /**
   * How many rows are checked. A kept value that is not among the options
   * is not counted: it has no row to show it or to uncheck it by.
   */
  selected: number
  /** How many rows the list shows. */
  total: number
  /** The most that may be checked, when the list has a limit. */
  max?: number
}

export interface CheckboxListProps
  extends Omit<
    React.ComponentProps<"div">,
    "defaultValue" | "onChange" | "role" | "children"
  > {
  /**
   * The list's name, drawn small and muted above the rows. It names the group
   * for assistive technology. Omit it inside a `SettingsRow`, where the row's
   * label names the list, or name the list with `aria-label`.
   */
  label?: React.ReactNode
  /** The rows, in reading order. */
  options: readonly CheckboxListOption[]
  /**
   * The checked values. The list is controlled: it reports each change
   * through `onValueChange` and shows whatever `value` says.
   *
   * A value that is not among the options is kept, so a selection that
   * outlived its row is not dropped by the next change, but it is not
   * counted toward `max` or the hint: nothing on screen could uncheck it.
   * A host whose limit is a shared budget subtracts such values from `max`.
   */
  value: readonly string[]
  /**
   * Called with the whole next selection when a row is checked or
   * unchecked: values in the options' order, then any kept values that are
   * not among the options.
   */
  onValueChange: (value: string[]) => void
  /**
   * The most rows that may be checked. Once that many are, the unchecked
   * rows become unavailable with `limitReason`, until one is unchecked.
   */
  max?: number
  /**
   * Why unchecked rows are unavailable while the limit is reached. Read as
   * each such row's description; on screen the count hint says it once
   * instead of under every row.
   * @defaultValue "Limit reached"
   */
  limitReason?: React.ReactNode
  /**
   * The count hint beside the label: `false` hides it, a function writes it.
   * By default it reads "3 of 16 selected", or with a limit "3 of 5
   * selected" against `max`. The hint describes the group and is announced
   * politely as it changes.
   * @defaultValue true
   */
  count?: boolean | ((count: CheckboxListCount) => React.ReactNode)
  /**
   * What Arrow keys do at a disabled row. `focusable` keeps it reachable so
   * its reason is read; `skipped` steps over it and takes it out of the tab
   * order. Shared with Nessa's listboxes.
   * @defaultValue "focusable"
   */
  disabledBehavior?: ListboxDisabledBehavior
  /** Leaves every row unavailable. */
  disabled?: boolean
  /**
   * The form field name. A form then submits exactly `value`, one entry per
   * value, whether or not its row is shown or available — except while the
   * whole list is `disabled`, when it submits nothing, as a disabled field.
   */
  name?: string
  /** Shown in place of the rows when there are none. */
  emptyMessage?: React.ReactNode
}

function writeCount({ selected, total, max }: CheckboxListCount) {
  return `${selected} of ${max ?? total} selected`
}

/**
 * Several choices from a list, each a checkbox row with an optional line of
 * description: hosts a grant may reach, people to notify, files to include.
 *
 * It is a labelled group of native checkboxes, so a form submits it and
 * Space checks the focused row. The group holds one tab stop, and Arrow
 * keys, Home and End move between rows exactly as in Nessa's listboxes —
 * the same collection engine runs both. A row can be unavailable with a
 * reason, and `max` caps how many are checked: at the cap the rest become
 * unavailable with `limitReason`, and the count hint ("3 of 5 selected")
 * says where the selection stands.
 *
 * Rows sit in one card with hairlines between them, as in a `SettingsGroup`.
 */
function CheckboxList({
  label,
  options,
  value,
  onValueChange,
  max,
  limitReason = "Limit reached",
  count = true,
  disabledBehavior = "focusable",
  disabled = false,
  name,
  emptyMessage = "Nothing to choose from",
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
  ...props
}: CheckboxListProps) {
  const idPrefix = React.useId()
  const labelId = `${idPrefix}-label`
  const countId = `${idPrefix}-count`
  const rowLabel = React.useContext(ContentLabelContext)

  const checked = React.useMemo(() => new Set(value), [value])
  const selected = options.filter((option) => checked.has(option.value)).length
  const limited = max !== undefined && selected >= max
  const isUnavailable = (option: CheckboxListOption) =>
    disabled || option.disabled === true || (limited && !checked.has(option.value))

  const entries = options.map((option) => ({
    id: option.value,
    disabled: isUnavailable(option),
  }))
  const collection = useListboxCollection({
    entries,
    // The tab stop rests on the first checked row, as a listbox's rests on
    // its selection, so Tab lands where the choice already is.
    value: options.find((option) => checked.has(option.value))?.value,
    disabled,
    disabledBehavior,
  })

  const toggle = (optionValue: string, next: boolean) => {
    const nextSet = new Set(checked)
    if (next) nextSet.add(optionValue)
    else nextSet.delete(optionValue)
    const known = new Set(options.map((option) => option.value))
    onValueChange([
      ...options.filter((option) => nextSet.has(option.value)).map((option) => option.value),
      ...[...nextSet].filter((kept) => !known.has(kept)),
    ])
  }

  const written =
    count === false
      ? null
      : (typeof count === "function" ? count : writeCount)({
          selected,
          total: options.length,
          max,
        })
  // A writer that has nothing to say leaves no empty description behind.
  const hint = hasContent(written) ? written : null
  const hasLabel = hasContent(label)

  const groupName =
    ariaLabel !== undefined || ariaLabelledby !== undefined
      ? { "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby }
      : hasLabel
        ? { "aria-labelledby": labelId }
        : rowLabel !== undefined
          ? { "aria-labelledby": rowLabel }
          : {}
  const describedBy =
    [ariaDescribedby, hint !== null ? countId : undefined].filter(Boolean).join(" ") ||
    undefined

  return (
    <div
      {...props}
      {...groupName}
      role="group"
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      data-slot="checkbox-list"
      data-limit-reached={limited || undefined}
      className={cn("flex flex-col gap-2 font-sans", className)}
    >
      {hasLabel || count !== false ? (
        <div
          data-slot="checkbox-list-header"
          // With nothing to show the header still holds the live region,
          // read but not drawn, so the hint's first words are announced.
          className={cn(
            "flex items-baseline gap-3 px-3.5",
            !hasLabel && hint === null && "sr-only",
          )}
        >
          {hasLabel ? (
            <span
              id={labelId}
              data-slot="checkbox-list-label"
              className="nessa-text-2 font-medium text-muted-foreground"
            >
              {label}
            </span>
          ) : null}
          {/* Mounted with the list, even while empty, so a change is announced:
              a live region inserted together with its text is not. */}
          {count !== false ? (
            <span
              id={countId}
              aria-live="polite"
              data-slot="checkbox-list-count"
              className="ms-auto nessa-text-2 text-muted-foreground tabular-nums"
            >
              {hint}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        data-slot="checkbox-list-card"
        className="flex flex-col rounded-xl border border-border bg-card text-card-foreground [&>[data-slot=checkbox-list-row]+[data-slot=checkbox-list-row]]:border-t [&>[data-slot=checkbox-list-row]+[data-slot=checkbox-list-row]]:border-border"
      >
        {options.length === 0 ? (
          <p
            data-slot="checkbox-list-empty"
            className="m-0 px-3.5 py-2.5 nessa-text-4 text-muted-foreground"
          >
            {emptyMessage}
          </p>
        ) : null}
        {options.map((option, index) => {
          const isChecked = checked.has(option.value)
          const unavailable = isUnavailable(option)
          const navigable = collection.isNavigable({ id: option.value, disabled: unavailable })
          // Rows Arrow keys still visit stay focusable, so they are
          // `aria-disabled`; the rest take the native attribute and leave
          // the tab order, as in the listboxes.
          const nativeDisabled = disabled || (unavailable && !navigable)
          // A row's own reason is written under it. The limit's is the same
          // for every row and the count already shows it, so it is only
          // read, as each row's description, rather than repeated on screen.
          // A row is unavailable for its own reason, for the limit, or because
          // the whole list is; only the first two have a reason to give.
          const ownReason = option.disabled === true
          const reason = ownReason
            ? option.disabledReason
            : limited && !isChecked && !disabled
              ? limitReason
              : undefined
          const rowLabelId = `${idPrefix}-${index}-label`
          const descriptionId = `${idPrefix}-${index}-description`
          const reasonId = `${idPrefix}-${index}-reason`
          const rowDescribedBy =
            [
              hasContent(option.description) ? descriptionId : undefined,
              hasContent(reason) ? reasonId : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          return (
            <label
              key={option.value}
              data-slot="checkbox-list-row"
              data-state={isChecked ? "checked" : "unchecked"}
              data-disabled={unavailable || undefined}
              data-highlighted={collection.highlightedId === option.value || undefined}
              onPointerMove={() => {
                if (!unavailable) collection.setHighlighted(option.value)
              }}
              onPointerLeave={() => collection.setHighlighted(undefined)}
              className={cn(
                "flex items-start gap-3 px-3.5 py-2.5",
                "first:rounded-t-[calc(var(--radius)*1.5-1px)] last:rounded-b-[calc(var(--radius)*1.5-1px)]",
                "transition-[background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
                unavailable
                  ? "cursor-not-allowed"
                  : "cursor-pointer data-highlighted:bg-foreground/(--nessa-state-hover)",
              )}
            >
              <Checkbox
                ref={collection.registerOption(option.value)}
                value={option.value}
                checked={isChecked}
                disabled={nativeDisabled}
                aria-disabled={unavailable || undefined}
                aria-labelledby={rowLabelId}
                aria-describedby={rowDescribedBy}
                tabIndex={!disabled && collection.rovingItemId === option.value ? 0 : -1}
                onFocus={() => collection.handleOptionFocus(option.value)}
                // The highlight follows focus in; it must follow it out too,
                // or a row left by Tab stays tinted with no pointer over it.
                onBlur={() => collection.setHighlighted(undefined)}
                onKeyDown={(event) => collection.handleNavigation(event, { from: option.value })}
                onClick={(event) => {
                  // A focusable unavailable row still receives the click (and
                  // Space, which clicks); cancelling it leaves the box as it was.
                  if (unavailable) event.preventDefault()
                }}
                onChange={(event) => {
                  if (!unavailable) toggle(option.value, event.currentTarget.checked)
                }}
                // Faded with the row whether it is natively disabled or only
                // `aria-disabled`, which the checkbox's own fade cannot see.
                className={cn("mt-0.5", unavailable && "opacity-50")}
                inputClassName={cn(unavailable && "cursor-not-allowed")}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  id={rowLabelId}
                  data-slot="checkbox-list-row-label"
                  className={cn(
                    "nessa-text-4 text-foreground",
                    unavailable && "text-muted-foreground",
                  )}
                >
                  {option.label}
                </span>
                {hasContent(option.description) ? (
                  <span
                    id={descriptionId}
                    data-slot="checkbox-list-row-description"
                    className="nessa-text-2 text-muted-foreground"
                  >
                    {option.description}
                  </span>
                ) : null}
                {hasContent(reason) ? (
                  <span
                    id={reasonId}
                    data-slot="checkbox-list-row-reason"
                    className={cn("nessa-text-2 text-muted-foreground", !ownReason && "sr-only")}
                  >
                    {reason}
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
      {/*
        The form value is `value` itself rather than the boxes: a natively
        disabled box never submits, and a kept value has no box at all. A
        disabled list submits nothing, as a disabled field does.
      */}
      {name !== undefined && !disabled
        ? [...checked].map((entry) => <input key={entry} type="hidden" name={name} value={entry} />)
        : null}
    </div>
  )
}

export { CheckboxList }
