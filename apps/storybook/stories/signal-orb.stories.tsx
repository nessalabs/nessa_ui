import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import { Button, SignalOrb, createOrbScanner, readOrbFrame } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const code = "K7PX-4QM2"

const meta = {
  title: "Primitives/SignalOrb",
  component: SignalOrb,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A pairing code carried by an orb of fine blue dots, like a phone's setup screen. The code is hidden in where the dots gather densely and where they thin out — four invisible rings of sectors, with Reed–Solomon error correction — so it reads as a cloud rather than as a code. Only a reader that knows the layout can recover it: `readOrbFrame`, exported from the same module, is the reader the scanning device runs, so the two cannot drift apart. It reads colourfulness rather than brightness: the dots are saturated blue while screens and glare are near grey, so the orb reads on a light or a dark screen and glare washes it out rather than faking it. A stock camera app cannot read it; use `QrOrb` where that matters. The dots gather on mount, then ripple in place in a slow wave. `still` or reduced motion draws it settled, and drawing pauses off screen.",
      },
    },
  },
  args: { code, onReady: fn(), "aria-label": "Point your phone at the orb to link it" },
} satisfies Meta<typeof SignalOrb>

export default meta
type Story = StoryObj<typeof meta>

function orbOf(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>("[data-slot=signal-orb]")!
}

function orbCanvas(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLCanvasElement>("[data-slot=signal-orb-canvas]")!
}

function frameOf(canvas: HTMLCanvasElement) {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Photographs the orb badly on a screen of colour `screen`: off-centre in a
 * larger frame, turned, shrunk, softened, and with a patch of glare across
 * it — then hands back the pixels.
 */
function photograph(orb: HTMLCanvasElement, screen: string) {
  const photo = document.createElement("canvas")
  photo.width = 640
  photo.height = 520
  const context = photo.getContext("2d")!
  context.fillStyle = screen
  context.fillRect(0, 0, photo.width, photo.height)
  context.save()
  context.translate(360, 240)
  context.rotate((37 * Math.PI) / 180)
  context.filter = "blur(1.5px)"
  const side = orb.width * 0.62
  context.drawImage(orb, -side / 2, -side / 2, side, side)
  context.restore()
  const glare = context.createRadialGradient(300, 180, 0, 300, 180, 70)
  glare.addColorStop(0, "rgb(255 255 255 / 0.35)")
  glare.addColorStop(1, "rgb(255 255 255 / 0)")
  context.fillStyle = glare
  context.fillRect(0, 0, photo.width, photo.height)
  return context.getImageData(0, 0, photo.width, photo.height)
}

async function settledStill(canvasElement: HTMLElement) {
  await waitFor(() => expect(orbOf(canvasElement)).toHaveAttribute("data-state", "still"))
}

export const Still: Story = {
  args: { still: true },
  parameters: storyDocumentation(
    "Drawn settled. The play test reads the code back from the drawn pixels with `readOrbFrame`, and proves `createOrbScanner` holds back the first frame and reports the code once a second frame agrees.",
  ),
  play: async ({ canvasElement, args }) => {
    await settledStill(canvasElement)
    await expect(args.onReady).toHaveBeenCalledTimes(1)
    const frame = frameOf(orbCanvas(canvasElement))
    await expect(readOrbFrame(frame)).toBe(code)
    const scanner = createOrbScanner()
    await expect(scanner.read(frame)).toBeNull()
    await expect(scanner.read(frame)).toBe(code)
  },
}

export const Photographed: Story = {
  args: { still: true },
  parameters: storyDocumentation(
    "The play test photographs the orb badly on a white screen — off-centre, turned 37°, shrunk, blurred, with a patch of glare — and proves the reader still recovers the code. Glare strong enough to wash out many regions makes a frame unreadable rather than misread: the reader refuses it, and a scanner reads the next frame.",
  ),
  play: async ({ canvasElement }) => {
    await settledStill(canvasElement)
    await expect(readOrbFrame(photograph(orbCanvas(canvasElement), "rgb(250 250 252)"))).toBe(code)
  },
}

export const Dark: Story = {
  args: { still: true },
  globals: { theme: "dark" },
  parameters: storyDocumentation(
    "On a dark screen. The play test photographs it badly on a near-black screen, glare included, and reads it: the reader measures colourfulness, so a dark screen reads as well as a white one.",
  ),
  play: async ({ canvasElement }) => {
    await settledStill(canvasElement)
    await expect(readOrbFrame(photograph(orbCanvas(canvasElement), "rgb(18 18 22)"))).toBe(code)
  },
}

function LiveExample(props: React.ComponentProps<typeof SignalOrb>) {
  const [still, setStill] = React.useState(false)
  return (
    <div className="flex flex-col items-center gap-6">
      <SignalOrb {...props} still={still} />
      <Button size="sm" variant="outline" onClick={() => setStill((value) => !value)}>
        {still ? "Play" : "Pause"}
      </Button>
    </div>
  )
}

export const Live: Story = {
  parameters: storyDocumentation(
    "The dots gather, then ripple in place. The play test waits for them to gather, reads a frame mid-ripple, then pauses it so nothing is left drawing.",
  ),
  render: (args) => <LiveExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const orb = orbOf(canvasElement)
    await waitFor(() => expect(orb).toHaveAttribute("data-state", "live"), { timeout: 4000 })
    await expect(args.onReady).toHaveBeenCalledTimes(1)
    await expect(readOrbFrame(frameOf(orbCanvas(canvasElement)))).toBe(code)
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Pause" }))
    await waitFor(() => expect(orb).toHaveAttribute("data-state", "still"))
    await expect(args.onReady).toHaveBeenCalledTimes(1)
  },
}

function SwapExample(props: React.ComponentProps<typeof SignalOrb>) {
  const [current, setCurrent] = React.useState(props.code)
  return (
    <div className="flex flex-col items-center gap-6">
      <SignalOrb {...props} code={current} still />
      <Button size="sm" variant="outline" onClick={() => setCurrent("expired")}>
        Expire code
      </Button>
    </div>
  )
}

export const Invalid: Story = {
  parameters: storyDocumentation(
    "A value that is not a pairing code draws nothing and says so through `data-state`. The play test draws a real code, swaps it for an invalid one — as when a code expires — and proves nothing of the old code is left to scan.",
  ),
  render: (args) => <SwapExample {...args} />,
  play: async ({ canvasElement }) => {
    await settledStill(canvasElement)
    await expect(readOrbFrame(frameOf(orbCanvas(canvasElement)))).toBe(code)
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Expire code" }))
    await waitFor(() => expect(orbOf(canvasElement)).toHaveAttribute("data-state", "invalid"))
    const pixels = frameOf(orbCanvas(canvasElement)).data
    await expect(pixels.some((value, at) => at % 4 === 3 && value !== 0)).toBe(false)
  },
}
