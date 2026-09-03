"use client"

/** @responsibility Reads how long an element's transition actually runs, so the deck can wait a movement out on whatever duration the theme or the host applied. */

/**
 * A CSS time in milliseconds, or null when the value is not a time. A bare
 * number is rejected: CSS requires a unit, and treating it as seconds is how
 * a computed `450ms` becomes a 450-second wait.
 *
 * @param value - A `transition-duration` or `transition-delay` entry.
 * @returns The time in milliseconds, or null.
 */
export function parseCssTime(value: string): number | null {
  const parsed = Number.parseFloat(value)

  if (!Number.isFinite(parsed)) return null

  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

/**
 * The longest transition an element runs, including its delay.
 *
 * A movement is never waited out on a hard-coded duration: the theme zeroes
 * the motion tokens under `prefers-reduced-motion`, and a host may lengthen
 * or shorten them. A caller that receives 0 must complete its work
 * immediately rather than wait for a `transitionend` that will never arrive.
 *
 * @param element - The element whose transition is being measured.
 * @param property - When given, only that property (or `all`) counts, so a
 * host class that replaces the transition with `transition-none` or
 * `transition-colors` is read as nothing to wait for.
 * @returns The duration in milliseconds, or 0 when nothing transitions.
 */
export function longestTransitionMs(
  element: HTMLElement,
  property?: string,
): number {
  const style = window.getComputedStyle(element)
  const properties = style.transitionProperty.split(",").map((entry) => entry.trim())

  if (properties.length === 1 && (properties[0] === "none" || properties[0] === "")) {
    return 0
  }

  const durations = style.transitionDuration.split(",")
  const delays = style.transitionDelay.split(",")

  return properties.reduce((longest, candidate, index) => {
    if (
      property !== undefined &&
      candidate !== property &&
      candidate !== "all"
    ) {
      return longest
    }

    const duration = parseCssTime(durations[index % durations.length] ?? "") ?? 0
    const delay = parseCssTime(delays[index % delays.length] ?? "") ?? 0
    const total = duration + delay

    return Number.isFinite(total) ? Math.max(longest, total) : longest
  }, 0)
}
