import * as React from "react"

import { cn } from "@/lib/utils"

export interface StepDotsProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** How many steps there are. */
  count: number
  /** Which one this is, counted from 0. */
  current: number
}

/**
 * Where a short, fixed sequence is up to, as a row of dots with the current
 * one drawn long: the steps of a first run, say. It is a picture of progress,
 * not a control, so it reads as "Step 2 of 3" and none of the dots can be
 * pressed. The dots are drawn in the current text colour. Under reduced motion
 * the current dot changes at once instead of stretching across.
 */
function StepDots({ count, current, className, ...props }: StepDotsProps) {
  const steps = Math.max(0, Math.floor(count))
  const at = Math.min(Math.max(0, Math.floor(current)), Math.max(0, steps - 1))
  return (
    <div
      role="img"
      aria-label={`Step ${at + 1} of ${steps}`}
      {...props}
      data-slot="step-dots"
      className={cn("flex items-center gap-1.5", className)}
    >
      {Array.from({ length: steps }, (_, index) => (
        <span
          key={index}
          data-current={index === at ? "true" : undefined}
          className="block h-1.5 w-1.5 rounded-full bg-current opacity-25 transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none data-[current]:w-4.5 data-[current]:opacity-85"
        />
      ))}
    </div>
  )
}

export { StepDots }
