import * as React from "react"

import { cn } from "@/lib/utils"

export interface KeyFingerprintProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /**
   * The fingerprint, as the host shows it on every device. Spaces, colons
   * and dashes are dropped before grouping, so `"ab:cd:ef"` and `"abcdef"`
   * draw the same.
   */
  value: string
  /** Characters per group. Defaults to 4. */
  groupSize?: number
}

/** Splits `value` into groups of `size` characters, ignoring separators. */
function fingerprintGroups(value: string, size: number): string[] {
  const bare = value.replace(/[\s:-]/g, "").toUpperCase()
  const step = Math.max(1, Math.floor(size))
  const groups: string[] = []
  for (let at = 0; at < bare.length; at += step) groups.push(bare.slice(at, at + step))
  return groups
}

/**
 * A key fingerprint drawn for comparing by eye: monospaced, upper-cased, in
 * evenly spaced groups that wrap between groups and never inside one. The
 * person reads it here and on the other device and checks they match, so
 * every device must group it the same way.
 *
 * Assistive technology reads the groups one by one, separated by pauses,
 * rather than as one long word.
 */
function KeyFingerprint({
  value,
  groupSize = 4,
  className,
  "aria-label": ariaLabel,
  ...props
}: KeyFingerprintProps) {
  const groups = fingerprintGroups(value, groupSize)
  return (
    <span
      role="img"
      data-slot="key-fingerprint"
      aria-label={ariaLabel ?? `Key fingerprint ${groups.join(", ")}`}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-x-2 gap-y-0.5 font-mono nessa-text-2 tracking-wider text-foreground",
        className,
      )}
      {...props}
    >
      {groups.map((group, index) => (
        <span key={index} aria-hidden="true" data-slot="key-fingerprint-group" className="whitespace-nowrap">
          {group}
        </span>
      ))}
    </span>
  )
}

export { KeyFingerprint, fingerprintGroups }
