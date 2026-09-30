import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** The colours a meter can fill in. */
export type MeterTone = "neutral" | "good" | "bad"

/**
 * Creates the class names for a meter's fill.
 *
 * The fill is anchored at the inline start and sized to the filled share.
 * Sizing it, rather than scaling or translating a full-width bar, keeps the
 * leading cap round down to a fill as short as the track is tall, and the
 * logical anchor makes it grow from the right in any right-to-left scope —
 * including a left-to-right island inside one — with no direction selector.
 * The transition reads the slow motion token, which Nessa collapses to `0ms`
 * under reduced motion; `motion-reduce:transition-none` says the same thing
 * where a scope has overridden the token.
 *
 * `neutral` fills in the foreground ink. `good` and `bad` use
 * `--nessa-market-gain` and `--nessa-market-loss`, the same pair `Delta` and
 * `StatusLabel` write in. That pair is borrowed: it is the only
 * favourable/unfavourable pair Nessa contrast-checks as text on every surface,
 * and it stands in until a status colour role exists. A theme that retunes the
 * market pair retunes these tones too.
 *
 * @returns The composed class-name string for a meter fill.
 */
const meterFillVariants = cva(
  "absolute inset-y-0 start-0 w-(--nessa-meter-fill) rounded-full transition-[width] duration-(--nessa-motion-duration-slow) ease-(--nessa-motion-easing-arrival) motion-reduce:transition-none",
  {
    variants: {
      tone: {
        neutral: "bg-foreground",
        good: "bg-(--nessa-market-gain)",
        bad: "bg-(--nessa-market-loss)",
      } satisfies Record<MeterTone, string>,
    },
  },
)

/** Clamps a fraction to 0–1, reading anything that is not a number as empty. */
function clampFraction(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

interface MeterBaseProps
  extends Omit<
    React.ComponentProps<"span">,
    | "children"
    | "role"
    | "aria-label"
    | "aria-labelledby"
    // The meter owns its value as assistive technology reads it, derived from
    // `value` and `valueText`; the render applies these last as well.
    | "aria-valuemin"
    | "aria-valuemax"
    | "aria-valuenow"
    | "aria-valuetext"
  > {
  /**
   * How full the track is, as a fraction from 0 to 1. Values outside that
   * range are clamped; `NaN` and infinities read as 0.
   */
  value: number
  /**
   * The value as assistive technology should say it, such as "5 of 14".
   * Without it, the value is announced as a percentage.
   */
  valueText?: string
  /**
   * The fill's colour: `neutral` (the default) in the foreground ink, `good`
   * and `bad` in the favourable and unfavourable inks. The caller decides
   * which applies; the meter does not judge its own value.
   */
  tone?: MeterTone
}

/**
 * A meter's props. It needs an accessible name: either `label`, which is not
 * drawn, or `aria-labelledby`, naming a visible caption that already says what
 * is measured so the name is not written twice.
 */
export type MeterProps = MeterBaseProps &
  (
    | {
        /** The accessible name: what is being measured, such as "Storage used". */
        label: string
        "aria-labelledby"?: never
      }
    | {
        label?: never
        /** The id of a visible element that names what is being measured. */
        "aria-labelledby": string
      }
  )

/**
 * A thin track filled to a fraction: how much of something is used, done, or
 * spent. It draws no text of its own — pair it with a `Stat` or a caption for
 * the figure it stands for.
 *
 * Renders a `role="meter"` element that exposes the clamped value as a
 * percentage (`aria-valuenow` between 0 and 100, rounded to two decimals),
 * named by `label` or `aria-labelledby`. The fill glides to a new value and
 * jumps there under reduced motion; it never animates on mount. The track
 * stretches to its container, so size it with the layout it sits in.
 */
function Meter({
  className,
  value,
  label,
  valueText,
  tone = "neutral",
  ...props
}: MeterProps) {
  const fraction = clampFraction(value)
  // Two decimals are enough for a percentage and keep float noise such as
  // 7.000000000000001 out of what a screen reader says.
  const percent = Math.round(fraction * 10_000) / 100

  return (
    <span
      data-slot="meter"
      data-tone={tone}
      className={cn(
        "relative block h-0.75 w-full min-w-10 overflow-hidden rounded-full bg-foreground/15",
        className,
      )}
      {...props}
      // After the caller's props, so what assistive technology reads is always
      // what is drawn: JSX lets any hyphenated attribute through the types.
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
    >
      <span
        data-slot="meter-fill"
        className={meterFillVariants({ tone })}
        style={
          { "--nessa-meter-fill": `${percent}%` } as React.CSSProperties
        }
      />
    </span>
  )
}

export { Meter }
