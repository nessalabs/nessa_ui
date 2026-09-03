import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { ChevronLeft } from "lucide-react"
import {
  MorphingMeshGradient,
  meshGradientFromRange,
  morphingMeshGradientPresets,
  morphingMeshGradientTypes,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

/**
 * Cancels every bloom's ambient WAAPI so a play test does not leave
 * Infinity cycles running into the rest of the suite, then asserts the
 * settled end state rather than treating cancel as fire-and-forget.
 * No-ops outside the vitest/webdriver runner so the Storybook canvas
 * stays live for humans watching the morph.
 */
async function stopMeshMotion(root: ParentNode, canvasElement: HTMLElement) {
  if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
  root
    .querySelectorAll<HTMLElement>('[data-slot="morphing-mesh-gradient-bloom"]')
    .forEach((bloom) => {
      bloom.getAnimations().forEach((animation) => animation.cancel())
    })
  const host = root instanceof Element ? root : root.querySelector("*")
  if (host) {
    await expect(host.getAnimations({ subtree: true })).toHaveLength(0)
  }
}

const meta = {
  title: "Primitives/MorphingMeshGradient",
  component: MorphingMeshGradient,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A living mesh-gradient backdrop in the Apple glass-mesh register: solid colour fields softly blurred, circulating on closed-loop paths so the wash dissolves forward continuously (no ping-pong reverse). Defaults to the `glass` preset. Pass any CSS colour array, or build one with `meshGradientFromRange(start, end, count)`. Set `inverted` for the pale reading — or reach for `glassInverted`. Motion follows the ambient duration token and cancels under reduced motion.",
      },
    },
  },
} satisfies Meta<typeof MorphingMeshGradient>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Apple-setup card layout: back control top-left, “Try” under the top
 * safe area, quote centred in the middle band, corner pills on the
 * bottom edge. Host must size the gradient frame — this card only fills.
 */
function NessaSetupCard({
  inverted = false,
}: {
  inverted?: boolean
}) {
  const tone = inverted
    ? {
        label: "text-neutral-600/80",
        quote: "text-neutral-900",
        back: "bg-black/10 text-neutral-800 hover:bg-black/15",
        later: "bg-white/70 text-neutral-800 hover:bg-white/85",
        continue: "bg-white/85 text-neutral-900 hover:bg-white",
      }
    : {
        label: "text-white/75",
        quote: "text-white",
        back: "bg-black/20 text-white hover:bg-black/30",
        later: "bg-white/55 text-neutral-900 hover:bg-white/70",
        continue: "bg-white/70 text-neutral-900 hover:bg-white/85",
      }

  return (
    <div className="relative flex h-full w-full flex-col px-6 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
      <button
        type="button"
        aria-label="Back"
        className={`absolute top-5 left-5 z-[1] flex size-9 items-center justify-center rounded-full transition-colors sm:top-6 sm:left-6 ${tone.back}`}
      >
        <ChevronLeft className="size-4" strokeWidth={2.25} />
      </button>

      {/*
        Top-safe “Try”, flex-centred quote, bottom-pinned actions —
        matching the Apple setup modal rhythm instead of packing the
        label into the same centred cluster as the quote.
      */}
      <p
        className={`mt-10 text-center text-[0.95rem] font-normal sm:mt-11 ${tone.label}`}
      >
        Try
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center">
        <p
          className={`max-w-[22rem] text-balance text-[1.65rem] leading-snug font-semibold tracking-tight sm:max-w-[26rem] sm:text-[1.85rem] ${tone.quote}`}
        >
          “Nessa, open the agent tray.”
        </p>
      </div>

      <div className="grid shrink-0 grid-cols-2 items-center gap-3">
        <button
          type="button"
          className={`justify-self-start rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${tone.later}`}
        >
          Skip for now
        </button>
        <button
          type="button"
          className={`justify-self-end rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${tone.continue}`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

/** Stable modal frame — height-first so Storybook’s short canvas cannot clip the chrome. */
const setupCardShell =
  "h-[min(32rem,70vh)] w-[min(40rem,calc(100vw-2rem))] rounded-[1.75rem] shadow-2xl"

export const Playground: Story = {
  args: {
    colors: morphingMeshGradientPresets.glass,
    type: "mesh",
    inverted: false,
    animated: true,
    speed: 1,
    blur: 72,
    grain: 0.35,
  },
  argTypes: {
    colors: {
      control: "object",
      description: "Pigment fields — any CSS colours, or a preset array.",
    },
    type: {
      control: "select",
      options: [...morphingMeshGradientTypes],
      description: "How the colour fields are arranged.",
    },
    inverted: {
      control: "boolean",
      description: "Lift pigments toward white for the pale glass reading.",
    },
    animated: {
      control: "boolean",
      description: "Migrate colour fields; reduced motion always freezes.",
    },
    speed: {
      control: { type: "range", min: 0.35, max: 2.5, step: 0.05 },
      description: "Morph pace — higher is faster.",
    },
    blur: {
      control: { type: "range", min: 40, max: 140, step: 4 },
      description: "Parent-stage blur radius in CSS pixels.",
    },
    grain: {
      control: { type: "range", min: 0, max: 2, step: 0.1 },
      description: "Soft glass dither over the frame; 0 removes it.",
    },
  },
  parameters: storyDocumentation(
    "Default glass mesh in a Nessa setup card — back top-left, centred prompt, corner pills — so the living wash reads the way the Apple setup modal does. Watch a few seconds: magenta, amber, and blue fields migrate across the card.",
  ),
  render: (args) => (
    <MorphingMeshGradient {...args} className={setupCardShell}>
      <NessaSetupCard inverted={Boolean(args.inverted)} />
    </MorphingMeshGradient>
  ),
  play: async ({ canvasElement }) => {
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="morphing-mesh-gradient"]',
    )!
    await expect(surface).toHaveAttribute("data-type", "mesh")
    await expect(surface).toHaveAttribute("data-animated", "true")
    const stage = surface.querySelector<HTMLElement>(
      '[data-slot="morphing-mesh-gradient-stage"]',
    )!
    await expect(stage).toHaveAttribute("aria-hidden", "true")
    await expect(getComputedStyle(stage).pointerEvents).toBe("none")
    const blooms = surface.querySelectorAll(
      '[data-slot="morphing-mesh-gradient-bloom"]',
    )
    await expect(blooms.length).toBeGreaterThan(3)
    // Morph is live: at least one field should already be mid-animation.
    const running = [...blooms].some((bloom) => bloom.getAnimations().length > 0)
    await expect(running).toBe(true)
    const content = surface.querySelector<HTMLElement>(
      '[data-slot="morphing-mesh-gradient-content"]',
    )!
    await expect(content.getBoundingClientRect().height).toBeCloseTo(
      surface.getBoundingClientRect().height,
      0,
    )
    const back = surface.querySelector<HTMLButtonElement>(
      'button[aria-label="Back"]',
    )!
    const tryLabel = [...surface.querySelectorAll("p")].find((node) =>
      node.textContent?.trim() === "Try",
    )!
    const surfaceBox = surface.getBoundingClientRect()
    const backBox = back.getBoundingClientRect()
    const tryBox = tryLabel.getBoundingClientRect()
    // Chrome stays inside the rounded frame — not clipped at the top edge.
    await expect(backBox.top).toBeGreaterThan(surfaceBox.top + 12)
    await expect(tryBox.top).toBeGreaterThan(surfaceBox.top + 36)
    await expect(tryBox.bottom).toBeLessThan(surfaceBox.bottom - 80)
    const action = [...surface.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Continue"),
    )!
    await expect(action).toBeTruthy()
    action.scrollIntoView({ block: "center" })
    const target = action.getBoundingClientRect()
    const hit = document.elementFromPoint(
      target.left + target.width / 2,
      target.top + target.height / 2,
    )
    await expect(hit).not.toBeNull()
    // `elementFromPoint` may land on nested text; the decorative layers
    // must still let the click reach the control.
    await expect(action.contains(hit) || hit === action).toBe(true)
    await stopMeshMotion(surface, canvasElement)
  },
}

export const Presets: Story = {
  parameters: storyDocumentation(
    "Every named palette as a living card, including `glassInverted` — the pale reading shipped beside the default glass mesh.",
  ),
  render: () => (
    <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(morphingMeshGradientPresets).map(([name, colors]) => {
        const pale = name === "glassInverted"
        return (
          <MorphingMeshGradient
            key={name}
            colors={colors}
            className="min-h-44 rounded-3xl"
          >
            <div className="flex h-full min-h-44 items-end">
              <p
                className={
                  pale
                    ? "px-5 py-4 text-sm font-medium capitalize text-neutral-900/90"
                    : "px-5 py-4 text-sm font-medium capitalize text-white/90"
                }
              >
                {name.replace(/([A-Z])/g, " $1").trim()}
              </p>
            </div>
          </MorphingMeshGradient>
        )
      })}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const surfaces = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="morphing-mesh-gradient"]',
    )
    await expect(surfaces.length).toBe(
      Object.keys(morphingMeshGradientPresets).length,
    )
    await stopMeshMotion(canvasElement, canvasElement)
  },
}

export const Inverted: Story = {
  parameters: storyDocumentation(
    "The same glass pigments, lifted: `inverted` runs each colour through `color-mix(…, white)` so the default wash becomes the pale treatment.",
  ),
  render: () => (
    <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-2">
      <MorphingMeshGradient
        colors={morphingMeshGradientPresets.glass}
        className="h-[min(28rem,60vh)] rounded-3xl"
      >
        <NessaSetupCard />
      </MorphingMeshGradient>
      <MorphingMeshGradient
        colors={morphingMeshGradientPresets.glass}
        inverted
        className="h-[min(28rem,60vh)] rounded-3xl"
      >
        <NessaSetupCard inverted />
      </MorphingMeshGradient>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const surfaces = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="morphing-mesh-gradient"]',
    )
    await expect(surfaces.length).toBe(2)
    await expect(surfaces[0]).not.toHaveAttribute("data-inverted")
    await expect(surfaces[1]).toHaveAttribute("data-inverted", "true")
    await stopMeshMotion(canvasElement, canvasElement)
  },
}

export const Types: Story = {
  parameters: storyDocumentation(
    "One ember palette under each layout — mesh, aurora, and orb — to show the type is a station map, independent of the colours.",
  ),
  render: () => (
    <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-3">
      {morphingMeshGradientTypes.map((type) => (
        <MorphingMeshGradient
          key={type}
          type={type}
          colors={morphingMeshGradientPresets.ember}
          className="min-h-48 rounded-3xl"
        >
          <div className="flex h-full min-h-48 items-end">
            <p className="px-5 py-4 text-sm font-medium capitalize text-white/90">
              {type}
            </p>
          </div>
        </MorphingMeshGradient>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const type of morphingMeshGradientTypes) {
      const surface = canvasElement.querySelector<HTMLElement>(
        `[data-type="${type}"]`,
      )!
      await expect(surface).toBeTruthy()
      const blooms = surface.querySelectorAll(
        '[data-slot="morphing-mesh-gradient-bloom"]',
      )
      await expect(blooms.length).toBeGreaterThan(2)
    }
    await stopMeshMotion(canvasElement, canvasElement)
  },
}

export const FromRange: Story = {
  parameters: storyDocumentation(
    "`meshGradientFromRange(start, end, count)` steps a brand pair into a mesh-ready palette via `color-mix`.",
  ),
  render: () => {
    const meadow = meshGradientFromRange("#0c5c2e", "#c8f5d4", 5)
    const dusk = meshGradientFromRange("#1a1040", "#f3c4ff", 6)
    return (
      <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-2">
        <MorphingMeshGradient
          colors={meadow}
          type="aurora"
          className="min-h-52 rounded-3xl"
        >
          <div className="flex h-full min-h-52 flex-col justify-end gap-1 px-5 py-4">
            <p className="text-sm font-medium text-white/90">Meadow range</p>
            <p className="text-xs text-white/70">#0c5c2e → #c8f5d4</p>
          </div>
        </MorphingMeshGradient>
        <MorphingMeshGradient
          colors={dusk}
          type="orb"
          className="min-h-52 rounded-3xl"
        >
          <div className="flex h-full min-h-52 flex-col justify-end gap-1 px-5 py-4">
            <p className="text-sm font-medium text-white/90">Dusk range</p>
            <p className="text-xs text-white/70">#1a1040 → #f3c4ff</p>
          </div>
        </MorphingMeshGradient>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const surfaces = canvasElement.querySelectorAll(
      '[data-slot="morphing-mesh-gradient"]',
    )
    await expect(surfaces.length).toBe(2)
    await stopMeshMotion(canvasElement, canvasElement)
  },
}

export const Still: Story = {
  parameters: storyDocumentation(
    "The same wash with motion off — useful when the host wants the mesh look without ambient drift, or as a visual stand-in for the reduced-motion path.",
  ),
  render: () => (
    <MorphingMeshGradient
      colors={morphingMeshGradientPresets.bloom}
      animated={false}
      className={setupCardShell}
    >
      <NessaSetupCard />
    </MorphingMeshGradient>
  ),
  play: async ({ canvasElement }) => {
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="morphing-mesh-gradient"]',
    )!
    await expect(surface).toHaveAttribute("data-animated", "false")
  },
}
