import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { DeviceFigure, deviceFigureKinds } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/DeviceFigure",
  component: DeviceFigure,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A machine drawn as a small object under one soft top light: a desktop box, a laptop, a rack server, a monitor, a phone, a cloud, or a white two-sail boat on Boat's indigo water, with no maker's logo. It is decoration beside a device's name, hidden from assistive technology, and fills its box at 4:3. `dimmed` fades it and puts its lights out while the device is away; `afloat` lets the boat bob, still under reduced motion. Its paint is the `--nessa-device-*` tokens: graphite in dark, aluminium in light.",
      },
    },
  },
  args: { kind: "desktop", style: { width: 200 } },
} satisfies Meta<typeof DeviceFigure>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "The play test proves the figure is hidden from assistive technology and keeps a 4:3 box.",
  ),
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>("[data-slot=device-figure]")
    await expect(figure).toHaveAttribute("aria-hidden", "true")
    const box = figure!.getBoundingClientRect()
    await expect(Math.round(box.height)).toBe(Math.round((box.width * 3) / 4))
  },
}

export const EveryKind: Story = {
  parameters: storyDocumentation(
    "Every kind side by side, each painting its own gradients: the play test proves no two figures share a paint id.",
  ),
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 160px)", gap: 16 }}>
      {deviceFigureKinds.map((kind) => (
        <DeviceFigure key={kind} {...args} kind={kind} style={{ width: 160 }} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const ids = [...canvasElement.querySelectorAll("linearGradient")].map((paint) => paint.id)
    // Three shared paints each, and the boat's water and its fade.
    await expect(ids).toHaveLength(deviceFigureKinds.length * 3 + 2)
    await expect(new Set(ids).size).toBe(ids.length)
  },
}

export const Away: Story = {
  args: { kind: "server", dimmed: true },
  parameters: storyDocumentation(
    "A device that is away is faded with its lights out. The play test proves its lights end transparent.",
  ),
  play: async ({ canvasElement }) => {
    const lights = canvasElement.querySelectorAll<SVGElement>("[data-slot=device-figure-light]")
    await expect(lights.length).toBeGreaterThan(0)
    for (const light of lights) await expect(getComputedStyle(light).opacity).toBe("0")
  },
}

export const Afloat: Story = {
  args: { kind: "boat", afloat: true },
  parameters: storyDocumentation(
    "The boat bobs and its swell drifts, unless motion is reduced. The play test proves the hull runs its float, then cancels every animation so nothing keeps ticking.",
  ),
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>("[data-slot=device-figure]")!
    await expect(figure).toHaveAttribute("data-afloat", "true")
    const hull = figure.querySelector<SVGElement>("[data-slot=device-figure-hull]")!
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    await expect(getComputedStyle(hull).animationName).toBe(reduced ? "none" : "nessa-float")
    for (const animation of figure.getAnimations({ subtree: true })) animation.cancel()
  },
}

export const Ashore: Story = {
  args: { kind: "boat", afloat: true, dimmed: true },
  parameters: storyDocumentation(
    "A boat that is away is faded and still: the play test proves the hull runs no animation.",
  ),
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>("[data-slot=device-figure]")!
    await expect(figure).not.toHaveAttribute("data-afloat")
    const hull = figure.querySelector<SVGElement>("[data-slot=device-figure-hull]")!
    await expect(getComputedStyle(hull).animationName).toBe("none")
  },
}
