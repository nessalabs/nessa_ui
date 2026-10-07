"use client"

import * as React from "react"

import { ContentLabelContext, useControlLabel } from "@/lib/control-label"
import { cn } from "@/lib/utils"

/** One card in a `Choices` group. */
export interface ChoiceOption {
  /** The value reported when this card is chosen. Unique within the group. */
  value: string
  /** The card's name. */
  label: React.ReactNode
  /** A line under the name: what choosing it does. */
  description?: React.ReactNode
  /** A picture above the name — a theme swatch, a layout sketch. Decorative. */
  visual?: React.ReactNode
  /** Leaves this one card unavailable. */
  disabled?: boolean
}

export interface ChoicesProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "role"> {
  /** The cards, in reading order. */
  options: readonly ChoiceOption[]
  /** The chosen value. Pass it to control the group. */
  value?: string
  /** The value chosen at first, when the group is not controlled. */
  defaultValue?: string
  /** Called with the value of each card the person chooses. */
  onValueChange?: (value: string) => void
  /** The radios' shared form name. Generated when omitted. */
  name?: string
  /** Leaves every card unavailable. */
  disabled?: boolean
}

/**
 * One choice among a few, each drawn as a card that can carry a picture and
 * a line of description: a theme, a layout, a density. It is a radio group —
 * Tab reaches the chosen card, Arrow keys move the choice, Space chooses —
 * built on native radios, so a form submits it and a disabled fieldset
 * disables it.
 *
 * Inside a `SettingsRow` (as the row's children) the group takes the row's
 * label as its name; elsewhere give it an `aria-label` or `aria-labelledby`.
 * Cards fill the width in equal columns and wrap when it narrows.
 */
function Choices({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: ChoicesProps) {
  const [own, setOwn] = React.useState(defaultValue)
  const chosen = value ?? own
  const generatedName = React.useId()
  const groupName = name ?? generatedName
  const ownLabel = useControlLabel({ "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby })
  const rowLabel = React.useContext(ContentLabelContext)
  const label =
    ownLabel["aria-label"] === undefined && ownLabel["aria-labelledby"] === undefined && rowLabel !== undefined
      ? { "aria-labelledby": rowLabel }
      : ownLabel
  const idPrefix = React.useId()
  const groupRef = React.useRef<HTMLDivElement | null>(null)

  // An uncontrolled group returns to `defaultValue` when its form resets. A
  // native reset fires no change event on the radios, so the group listens
  // for the form's reset instead.
  const resetRef = React.useRef<() => void>(() => {})
  resetRef.current = () => {
    if (value === undefined && own !== defaultValue) {
      setOwn(defaultValue)
      if (defaultValue !== undefined) onValueChange?.(defaultValue)
    }
  }
  React.useEffect(() => {
    const form = groupRef.current?.closest("form")
    if (!form) return
    const onReset = () => resetRef.current()
    form.addEventListener("reset", onReset)
    return () => form.removeEventListener("reset", onReset)
  }, [])

  return (
    <div
      {...props}
      {...label}
      ref={groupRef}
      role="radiogroup"
      data-slot="choices"
      aria-disabled={disabled || undefined}
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 font-sans",
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = chosen === option.value
        const unavailable = disabled || option.disabled === true
        const labelId = `${idPrefix}-${index}-label`
        const descriptionId = `${idPrefix}-${index}-description`
        return (
          <label
            key={option.value}
            data-slot="choice"
            data-state={checked ? "checked" : "unchecked"}
            data-disabled={unavailable || undefined}
            className={cn(
              "relative flex min-w-0 cursor-default flex-col gap-1 rounded-lg border border-border bg-card p-3 text-card-foreground",
              "transition-[background-color,border-color,box-shadow] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)]",
              "hover:bg-foreground/(--nessa-state-hover)",
              "has-[:checked]:border-foreground has-[:checked]:ring-1 has-[:checked]:ring-inset has-[:checked]:ring-foreground has-[:checked]:hover:bg-card",
              // Forced colours drop the ring, so the chosen card is told
              // apart there by an inset outline, which moves nothing.
              "forced-colors:has-[:checked]:outline-2 forced-colors:has-[:checked]:outline-solid forced-colors:has-[:checked]:-outline-offset-2",
              // Its own disabled state dims a card; inside a disabled
              // fieldset (a disabled settings row) the fieldset already dims
              // it, so that is never doubled.
              "has-[:disabled]:pointer-events-none data-[disabled]:opacity-50 [fieldset:disabled_&]:opacity-100",
            )}
          >
            {/* The radio covers the card, so the card is its target and its
                focus outline is drawn at the card's edge. */}
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={checked}
              aria-labelledby={labelId}
              aria-describedby={option.description !== undefined ? descriptionId : undefined}
              disabled={unavailable}
              onChange={() => {
                if (value === undefined) setOwn(option.value)
                onValueChange?.(option.value)
              }}
              className="absolute inset-0 m-0 size-full cursor-default appearance-none rounded-[inherit] bg-transparent outline-none focus-visible:outline-solid focus-visible:outline-(length:--nessa-focus-outline-width) focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            {option.visual !== undefined ? (
              <span
                aria-hidden="true"
                data-slot="choice-visual"
                className="pointer-events-none mb-1.5 flex overflow-hidden rounded-md"
              >
                {option.visual}
              </span>
            ) : null}
            <span id={labelId} data-slot="choice-label" className="pointer-events-none nessa-text-3 font-medium">
              {option.label}
            </span>
            {option.description !== undefined ? (
              <span
                id={descriptionId}
                data-slot="choice-description"
                className="pointer-events-none nessa-text-2 text-muted-foreground"
              >
                {option.description}
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}

export { Choices }
