import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** The true minus sign (U+2212), which sets at the width and height of `+`. */
const MINUS_SIGN = "\u2212"

/**
 * The colour of a change, by the tone its caller gave it. `good` and `bad`
 * write in `--nessa-market-gain` and `--nessa-market-loss`, which Nessa checks
 * at 4.5:1 as text on the background, card, and popover surfaces in both
 * modes; `neutral` is the muted foreground. The market pair is borrowed — it
 * is the only favourable/unfavourable text pair the token chain has — and
 * stands in until a status colour role exists, so a theme that retunes the
 * market pair retunes these tones too.
 */
const deltaToneVariants = cva("", {
  variants: {
    tone: {
      good: "text-(--nessa-market-gain)",
      bad: "text-(--nessa-market-loss)",
      neutral: "text-muted-foreground",
    } satisfies Record<DeltaTone, string>,
  },
})

/** Whether a change is good, bad, or neither. */
export type DeltaTone = "good" | "bad" | "neutral"

export interface DeltaProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /**
   * The signed change, at the precision it is displayed. Delta signs what it
   * receives, so pass the value already rounded the way `format` rounds it:
   * `-0.04` shown to one decimal would otherwise read "−0.0", while the
   * rounded `-0` reads as exactly zero. A value that is not a number gets no
   * sign and is handed to `format` as `NaN`.
   */
  value: number
  /**
   * Writes the size of the change. It is always called with the absolute
   * value — never a negative number, never `-0` — so it never produces a
   * sign: Delta alone prefixes `+` or a true minus (U+2212). A change of
   * exactly zero gets no sign, so `format` decides how zero reads — "0",
   * "±0.0", or "no change".
   */
  format: (size: number) => string
  /**
   * Whether the change is good, bad, or neither. The caller decides: whether
   * a rise is an improvement, and how large a change must be before it counts
   * rather than being noise, belong to the model that owns the metric, not to
   * the component drawing it. Defaults to `neutral`.
   */
  tone?: DeltaTone
}

/**
 * A signed change in the tone its caller judged it: `+1.8` in the favourable
 * ink, `−0.4` in the unfavourable one, a change too small to count muted.
 *
 * The sign always carries the direction, so the colour is never the only
 * signal. Every number is set in tabular figures, and the text size is
 * inherited, so a Delta sits inline beside the figure it qualifies. It is
 * laid out left to right and isolated from the text around it, so the sign
 * stays in front of the digits in a right-to-left paragraph; pass `dir` for a
 * locale that writes its sign differently. The tone is exposed as `data-tone`
 * for hosts that style around it.
 */
function Delta({
  className,
  value,
  format,
  tone = "neutral",
  ...props
}: DeltaProps) {
  const sign = value > 0 ? "+" : value < 0 ? MINUS_SIGN : ""

  return (
    <span
      dir="ltr"
      data-slot="delta"
      data-tone={tone}
      className={cn(
        "whitespace-nowrap tabular-nums",
        deltaToneVariants({ tone }),
        className,
      )}
      {...props}
    >
      {sign}
      {format(Math.abs(value))}
    </span>
  )
}

export { Delta }
