import * as React from "react"
import { cva } from "class-variance-authority"
import { Check, CircleAlert, CircleDot, Minus, X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The tones a status label can take. A host maps its own states onto these;
 * the label knows nothing about what a state means.
 */
export type StatusLabelTone = "neutral" | "good" | "bad" | "warning" | "active"

/**
 * Creates the class names for a status label's word, by tone. Only `neutral`
 * steps back to the muted ink; every other tone writes its word at full
 * strength and leaves the colour to the mark beside it.
 */
const statusLabelVariants = cva(
  "inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle font-sans nessa-text-2 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "text-muted-foreground",
        good: "text-foreground",
        bad: "text-foreground",
        warning: "text-foreground",
        active: "text-foreground",
      } satisfies Record<StatusLabelTone, string>,
    },
  },
)

/**
 * Creates the class names for a status label's mark, by tone.
 *
 * The mark carries the hue, the word carries the meaning. `good` and `bad`
 * use `--nessa-market-gain` and `--nessa-market-loss`, the same pair `Delta`
 * and `Meter` use. That pair is borrowed — it is the only
 * favourable/unfavourable pair the token chain contrast-checks as text — and
 * stands in until a status colour role exists, so a theme that retunes the
 * market pair retunes these tones too. `warning` has no hue of its own: Nessa has no warning colour
 * role yet, so a warning reads through its mark and its full-strength word,
 * and will pick up a warning token without an API change when one lands.
 */
const statusLabelMarkVariants = cva(
  "flex shrink-0 items-center [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "text-muted-foreground",
        good: "text-(--nessa-market-gain)",
        bad: "text-(--nessa-market-loss)",
        warning: "text-foreground",
        active: "text-foreground",
      } satisfies Record<StatusLabelTone, string>,
    },
  },
)

/** The mark each tone draws when the host does not supply its own. */
const defaultMarks: Record<StatusLabelTone, React.ReactNode> = {
  neutral: <Minus />,
  good: <Check />,
  bad: <X />,
  warning: <CircleAlert />,
  active: <CircleDot />,
}

export interface StatusLabelProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /**
   * The state's tone: `neutral` (the default), `good`, `bad`, `warning`, or
   * `active`. The host maps its own states onto these; the label does not
   * know what a state means.
   */
  tone?: StatusLabelTone
  /**
   * The mark drawn before the word, replacing the tone's default. It is
   * decorative — hidden from assistive technology — and drawn in the tone's
   * colour through `currentColor`. An SVG passed directly is sized to the
   * mark size, 12px at the default UI scale. Pass `null` for a word with no
   * mark.
   */
  icon?: React.ReactNode
  /**
   * The word that names the state. Required: it is the only part assistive
   * technology reads, so without it the state would be colour and glyph alone.
   */
  children: React.ReactNode
}

/**
 * A state as a small mark and a word, in a tone: `neutral`, `good`, `bad`,
 * `warning`, or `active`. There is no pill and no fill behind it; the mark
 * carries the colour and the word carries the meaning, so the state never
 * depends on colour alone. The word is the children and is read as ordinary
 * text; it truncates rather than wrapping when space runs out.
 *
 * Use `Badge` for a label that should stand apart from the text around it;
 * use StatusLabel for a state read in passing, in a row or a header.
 */
function StatusLabel({
  className,
  tone = "neutral",
  icon,
  children,
  ...props
}: StatusLabelProps) {
  const mark =
    icon !== undefined
      ? icon
      : Object.hasOwn(defaultMarks, tone)
        ? defaultMarks[tone]
        : null

  return (
    <span
      data-slot="status-label"
      data-tone={tone}
      className={cn(statusLabelVariants({ tone }), className)}
      {...props}
    >
      {mark !== null && mark !== false ? (
        <span
          aria-hidden="true"
          data-slot="status-label-mark"
          className={statusLabelMarkVariants({ tone })}
        >
          {mark}
        </span>
      ) : null}
      <span data-slot="status-label-word" className="min-w-0 truncate">
        {children}
      </span>
    </span>
  )
}

export { StatusLabel }
