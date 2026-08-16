/** @responsibility Defines the stable orientation vocabulary of the SplitView primitives. */

/** Axes along which a SplitView lays out its panels. */
const SplitViewOrientation = Object.freeze({
  Horizontal: "horizontal",
  Vertical: "vertical",
} as const)

/** A supported axis for SplitView panels. */
type SplitViewOrientation =
  (typeof SplitViewOrientation)[keyof typeof SplitViewOrientation]

export { SplitViewOrientation }
