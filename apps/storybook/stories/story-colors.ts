/**
 * Resolves any CSS colour the browser can paint — `oklch()`, `color-mix()`,
 * a computed style string — to the 8-bit sRGB channels it actually renders
 * as, by painting one pixel. Two colours authored in different syntaxes
 * compare equal exactly when they paint the same.
 *
 * @returns The painted `[red, green, blue, alpha]` channels, each 0–255.
 */
export function paintedColor(color: string): [number, number, number, number] {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("A 2D canvas is required to resolve colours.")
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
  return [red, green, blue, alpha]
}

/**
 * Resolves a theme token to the colour it paints at the document root, where
 * the Storybook theme toggle sets Light or Dark.
 *
 * @returns The token's painted channels, as `paintedColor` returns them.
 */
export function paintedToken(token: `--${string}`) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
  if (!value) throw new Error(`Token ${token} is not defined at the root.`)
  return paintedColor(value)
}

/**
 * WCAG relative luminance of a painted colour: 0 for black, 1 for white.
 *
 * @returns The luminance of the colour's opaque channels.
 */
export function relativeLuminance(color: string) {
  const [red, green, blue] = paintedColor(color).map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
