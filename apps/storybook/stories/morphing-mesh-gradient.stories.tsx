import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import {
  Button,
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
 */
async function stopMeshMotion(root: ParentNode) {
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
          "A living mesh-gradient backdrop in the Apple glass-mesh register: oversized luminous colour blooms melt and drift behind content, built from a swappable palette and layout type (`mesh`, `aurora`, or `orb`). Defaults to the `glass` preset. Pass any CSS colour array, or build one with `meshGradientFromRange(start, end, count)`. Set `inverted` for the pale reading — or reach for the `glassInverted` preset. Motion follows the ambient duration token and cancels under reduced motion; off-screen instances pause so a gallery does not keep every card animating. Purely decorative — text contrast on top belongs to the host.",
      },
    },
  },
} satisfies Meta<typeof MorphingMeshGradient>

export default meta
type Story = StoryObj<typeof meta>

/** Nessa-specific hero copy for the living wash — not a product parody. */
function NessaHeroContent() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 py-16 text-center">
      <p className="text-sm font-medium tracking-[0.18em] text-white/70 uppercase">
        Nessa UI
      </p>
      <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Surfaces that think in colour
      </h2>
      <p className="max-w-md text-pretty text-base text-white/80">
        A morphing mesh for heroes, empty states, and ambient shells —
        palette in, living wash out.
      </p>
      <Button
        size="lg"
        className="rounded-full bg-white px-6 text-neutral-900 shadow-sm hover:bg-white/90"
      >
        Browse components
      </Button>
    </div>
  )
}

export const Playground: Story = {
  args: {
    colors: morphingMeshGradientPresets.glass,
    type: "mesh",
    inverted: false,
    animated: true,
    speed: 1,
    blur: 120,
    grain: 0.55,
  },
  argTypes: {
    colors: {
      control: "object",
      description: "Pigment nodes — any CSS colours, or a preset array.",
    },
    type: {
      control: "select",
      options: [...morphingMeshGradientTypes],
      description: "How the colour nodes are arranged.",
    },
    inverted: {
      control: "boolean",
      description: "Lift pigments toward white for the pale glass reading.",
    },
    animated: {
      control: "boolean",
      description: "Drift the blooms; reduced motion always freezes.",
    },
    speed: {
      control: { type: "range", min: 0.35, max: 2.5, step: 0.05 },
      description: "Ambient drift pace — higher is faster.",
    },
    blur: {
      control: { type: "range", min: 40, max: 180, step: 4 },
      description: "Bloom blur radius in CSS pixels.",
    },
    grain: {
      control: { type: "range", min: 0, max: 2, step: 0.1 },
      description: "Soft glass dither over the frame; 0 removes it.",
    },
  },
  parameters: storyDocumentation(
    "The default glass mesh under Nessa hero copy — luminous mid-tones melting the way the Apple setup wash does. Swap `colors` for any preset — or your own range — flip `inverted` for the pale treatment, and change `type` to re-lay the blooms without touching the content.",
  ),
  render: (args) => (
    <MorphingMeshGradient
      {...args}
      className="min-h-[26rem] w-[min(42rem,calc(100vw-2rem))] rounded-[2rem]"
    >
      {args.inverted ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-8 py-16 text-center">
          <p className="text-sm font-medium tracking-[0.18em] text-neutral-600/80 uppercase">
            Nessa UI
          </p>
          <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Surfaces that think in colour
          </h2>
          <p className="max-w-md text-pretty text-base text-neutral-700">
            A morphing mesh for heroes, empty states, and ambient shells —
            palette in, living wash out.
          </p>
          <Button size="lg" className="rounded-full px-6 shadow-sm">
            Browse components
          </Button>
        </div>
      ) : (
        <NessaHeroContent />
      )}
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
    const blooms = stage.querySelectorAll(
      '[data-slot="morphing-mesh-gradient-bloom"]',
    )
    await expect(blooms.length).toBeGreaterThan(3)
    const content = surface.querySelector<HTMLElement>(
      '[data-slot="morphing-mesh-gradient-content"]',
    )!
    await expect(content.getBoundingClientRect().height).toBeCloseTo(
      surface.getBoundingClientRect().height,
      0,
    )
    const action = surface.querySelector("button")!
    action.scrollIntoView({ block: "center" })
    const target = action.getBoundingClientRect()
    const hit = document.elementFromPoint(
      target.left + target.width / 2,
      target.top + target.height / 2,
    )
    await expect(hit).not.toBeNull()
    await expect(hit).toBe(action)
    await stopMeshMotion(surface)
  },
}

export const Presets: Story = {
  parameters: storyDocumentation(
    "Every named palette as a living card, including `glassInverted` — the pale reading shipped beside the default glass mesh so a picker can offer both treatments without inventing a second authoring path.",
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
            <div className="flex h-full items-end">
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
    const grounds = new Set(
      [...surfaces].map((s) => getComputedStyle(s).backgroundColor),
    )
    await expect(grounds.size).toBeGreaterThan(1)
    await stopMeshMotion(canvasElement)
  },
}

export const Inverted: Story = {
  parameters: storyDocumentation(
    "The same glass pigments, lifted: `inverted` runs each colour through `color-mix(…, white)` so the default wash becomes the pale treatment without a second hand-authored palette. Pair with dark type when the host needs contrast on the light reading.",
  ),
  render: () => (
    <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-2">
      <MorphingMeshGradient
        colors={morphingMeshGradientPresets.glass}
        className="min-h-56 rounded-3xl"
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium tracking-[0.16em] text-white/70 uppercase">
            Default
          </p>
          <p className="text-xl font-semibold text-white">Glass mesh</p>
        </div>
      </MorphingMeshGradient>
      <MorphingMeshGradient
        colors={morphingMeshGradientPresets.glass}
        inverted
        className="min-h-56 rounded-3xl"
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium tracking-[0.16em] text-neutral-600/80 uppercase">
            Inverted
          </p>
          <p className="text-xl font-semibold text-neutral-900">Pale glass</p>
        </div>
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
    await stopMeshMotion(canvasElement)
  },
}

export const Types: Story = {
  parameters: storyDocumentation(
    "One ember palette under each layout — mesh, aurora, and orb — to show the type is a station map, independent of the colours. Mesh spreads corner-and-centre; aurora stretches into bands; orb keeps fewer, larger glows.",
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
          <div className="flex h-full items-end">
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
    await stopMeshMotion(canvasElement)
  },
}

export const FromRange: Story = {
  parameters: storyDocumentation(
    "`meshGradientFromRange(start, end, count)` steps a brand pair into a mesh-ready palette via `color-mix`, so a host can feed two endpoints and get a living wash without authoring every node.",
  ),
  render: () => {
    const meadow = meshGradientFromRange("#0c5c2e", "#c8f5d4", 5)
    const dusk = meshGradientFromRange("#1a1040", "#f3c4ff", 6)
    return (
      <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-2">
        <MorphingMeshGradient colors={meadow} type="aurora" className="min-h-52 rounded-3xl">
          <div className="flex h-full flex-col justify-end gap-1 px-5 py-4">
            <p className="text-sm font-medium text-white/90">Meadow range</p>
            <p className="text-xs text-white/70">#0c5c2e → #c8f5d4</p>
          </div>
        </MorphingMeshGradient>
        <MorphingMeshGradient colors={dusk} type="orb" className="min-h-52 rounded-3xl">
          <div className="flex h-full flex-col justify-end gap-1 px-5 py-4">
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
    await stopMeshMotion(canvasElement)
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
      className="min-h-52 w-[min(42rem,calc(100vw-2rem))] rounded-3xl"
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium tracking-[0.16em] text-white/70 uppercase">
          Nessa UI
        </p>
        <p className="text-xl font-semibold text-white">Still mesh</p>
      </div>
    </MorphingMeshGradient>
  ),
  play: async ({ canvasElement }) => {
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="morphing-mesh-gradient"]',
    )!
    await expect(surface).toHaveAttribute("data-animated", "false")
  },
}
