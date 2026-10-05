import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, waitFor } from "storybook/test"
import jsQR from "jsqr"
import { QrOrb } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const link = "nessa://pair?host=192.168.1.20:7420&code=K7PX4QM2"

const meta = {
  title: "Primitives/QrOrb",
  component: QrOrb,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A QR code drawn as an orb of sand. Its centre is a real code — dark grains on a light disc, crisp finder corners, a clean quiet zone — and the rest of the sphere is decoration fading toward the rim, so any phone camera reads the code and a person sees an orb. On mount the grains spiral in and settle, then hold still; with reduced motion it is drawn settled. The disc stays light with dark ink in both themes, because scanners need dark on light. `value` is not exposed as text, since it may be a secret.",
      },
    },
  },
  args: { value: link, onSettled: fn(), "aria-label": "Scan with your phone" },
} satisfies Meta<typeof QrOrb>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Paints the orb's SVG onto a canvas, with every class-driven colour
 * resolved inline, and decodes it as a phone camera would.
 */
async function decode(canvasElement: HTMLElement): Promise<string | null> {
  const svg = canvasElement.querySelector<SVGSVGElement>("[data-slot=qr-orb] svg")!
  const copy = svg.cloneNode(true) as SVGSVGElement
  const live = [svg, ...svg.querySelectorAll("*")]
  const cloned = [copy, ...copy.querySelectorAll("*")]
  live.forEach((node, at) => {
    const style = getComputedStyle(node)
    const target = cloned[at] as SVGElement
    target.setAttribute("fill", style.fill)
    target.setAttribute("stroke", style.stroke)
    target.setAttribute("color", style.color)
    target.removeAttribute("class")
  })
  const size = 480
  copy.setAttribute("width", String(size))
  copy.setAttribute("height", String(size))
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`
  await image.decode()
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")!
  context.fillStyle = "#808080"
  context.fillRect(0, 0, size, size)
  context.drawImage(image, 0, 0, size, size)
  const pixels = context.getImageData(0, 0, size, size)
  return jsQR(pixels.data, size, size)?.data ?? null
}

function settled(canvasElement: HTMLElement) {
  return waitFor(
    () =>
      expect(canvasElement.querySelector("[data-slot=qr-orb]")).toHaveAttribute(
        "data-state",
        "settled",
      ),
    { timeout: 5000 },
  )
}

export const Scans: Story = {
  parameters: storyDocumentation(
    "The grains spiral in and settle. The play test waits for it to settle, then decodes the drawn orb with a QR reader and proves it reads back the exact link — and that nothing is left animating.",
  ),
  play: async ({ canvasElement, args }) => {
    await settled(canvasElement)
    await expect(args.onSettled).toHaveBeenCalledTimes(1)
    const svg = canvasElement.querySelector("[data-slot=qr-orb] svg")!
    await expect(svg.getAnimations({ subtree: true })).toHaveLength(0)
    await expect(await decode(canvasElement)).toBe(link)
  },
}

export const Dark: Story = {
  globals: { theme: "dark" },
  parameters: storyDocumentation(
    "In the dark theme the disc stays light and the ink dark, so it still scans. The play test decodes it.",
  ),
  play: async ({ canvasElement }) => {
    await settled(canvasElement)
    await expect(await decode(canvasElement)).toBe(link)
  },
}

export const ScopedDark: Story = {
  parameters: storyDocumentation(
    "Dark chosen with `data-nessa-mode`, and no `.dark` ancestor. The disc stays light and the ink dark, so it still scans. The play test decodes it.",
  ),
  render: (args) => (
    <div data-nessa-mode="dark" className="rounded-lg bg-background p-8">
      <QrOrb {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await settled(canvasElement)
    await expect(await decode(canvasElement)).toBe(link)
  },
}

export const TooLong: Story = {
  args: { value: "x".repeat(4000) },
  parameters: storyDocumentation(
    "A value too long for any QR code draws an empty orb and says so through `data-state`, instead of throwing during render.",
  ),
  play: async ({ canvasElement, args }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-slot=qr-orb]")).toHaveAttribute("data-state", "invalid"),
    )
    await expect(args.onSettled).not.toHaveBeenCalled()
    await expect(canvasElement.querySelector("[data-slot=qr-orb-finder]")).toBeNull()
  },
}
