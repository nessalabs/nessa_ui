"use client"

import * as React from "react"

import { useControlLabel } from "@/lib/control-label"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<
    React.ComponentProps<"button">,
    "type" | "role" | "aria-checked" | "onChange" | "value" | "defaultValue"
  > {
  /** Whether the switch is on. Pass it to control the switch. */
  checked?: boolean
  /** Whether the switch starts on, when it is not controlled. */
  defaultChecked?: boolean
  /** Called with the new state each time the switch is turned. */
  onCheckedChange?: (checked: boolean) => void
}

/**
 * An on/off setting that takes effect at once: a `role="switch"` button, so
 * Space and Enter turn it and assistive technology reads it as on or off.
 *
 * Use `Checkbox` for a choice that is submitted with a form; use Switch when
 * turning it is itself the action. Inside a `SettingsRow` it takes the row's
 * label as its name; elsewhere give it an `aria-label`.
 */
function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  onClick,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: SwitchProps) {
  const [own, setOwn] = React.useState(defaultChecked)
  const on = checked ?? own
  const name = useControlLabel({
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
  })

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-slot="switch"
      data-state={on ? "on" : "off"}
      {...name}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (checked === undefined) setOwn(!on)
        onCheckedChange?.(!on)
      }}
      className={cn(
        "relative inline-flex h-5 w-8.5 shrink-0 cursor-pointer appearance-none items-center rounded-full border-0 p-0.5 outline-none",
        "bg-foreground/15 data-[state=on]:bg-primary",
        "transition-[background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
        "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-xs",
          "translate-x-0 data-[state=on]:translate-x-3.5",
          "transition-transform [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
        )}
        data-state={on ? "on" : "off"}
      />
    </button>
  )
}

export { Switch }
