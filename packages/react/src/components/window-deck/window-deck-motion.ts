"use client"

/** @responsibility Reads how long an element's transition actually runs, so the deck can wait a movement out on whatever duration the theme or the host applied. */

/**
 * The longest transition an element runs, including its delay.
 *
 * A movement is never waited out on a hard-coded duration: the theme zeroes
 * the motion tokens under `prefers-reduced-motion`, and a host may lengthen
 * or shorten them. A caller that receives 0 must complete its work
 * immediately rather than wait for a `transitionend` that will never arrive.
 *
 * @param element - The element whose transition is being measured.
 * @returns The duration in milliseconds, or 0 when nothing transitions.
 */
export function longestTransitionMs(element: HTMLElement): number {
  const style = window.getComputedStyle(element)
  const durations = style.transitionDuration.split(",")
  const delays = style.transitionDelay.split(",")

  return durations.reduce((longest, duration, index) => {
    const total =
      Number.parseFloat(duration) * 1000 +
      Number.parseFloat(delays[index] ?? delays[0] ?? "0") * 1000

    return Number.isFinite(total) ? Math.max(longest, total) : longest
  }, 0)
}
