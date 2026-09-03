import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import {
  Button,
  GradientSurface,
  gradientSurfacePatterns,
  gradientSurfacePresets,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/GradientSurface",
  component: GradientSurface,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A decorative gradient backdrop for heroes, empty states, and banners. The wash is built from a swappable palette — deepest colour first, each later colour a soft radial bloom with the brightest one centred — so changing the whole mood is one `colors` array. Over the wash sits an optional hairline drawing (`contours`, soft wobbled topographic rings; `waves`; or `rings`), and over the whole frame — content included — a film-grain layer that makes the flat CSS gradient read as printed. Everything is deterministic CSS and inline SVG: no images to fetch, identical markup on server and client. The surface sizes itself from the box and crops the drawing rather than stretching it; text contrast on top belongs to the host.",
      },
    },
  },
} satisfies Meta<typeof GradientSurface>

export default meta
type Story = StoryObj<typeof meta>

/** The screenshot-style hero: headline and one white pill action. */
function HeroContent() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-8 py-16 text-center">
      <h2 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Research for the systems that think
      </h2>
      {/* Deliberately fixed white, not a semantic token: the button sits on
          the gradient's own ground, which does not change with the theme. */}
      <Button
        size="lg"
        className="rounded-full bg-white px-6 text-neutral-900 shadow-sm hover:bg-white/90"
      >
        Get a free demo
      </Button>
    </div>
  )
}

export const Playground: Story = {
  args: {
    colors: gradientSurfacePresets.meadow,
    pattern: "contours",
    patternOpacity: 0.2,
    grain: 1,
  },
  argTypes: {
    colors: {
      control: "object",
      description:
        "Palette, deepest first — the ground, then blooms, brightest centred.",
    },
    pattern: {
      control: "select",
      options: [...gradientSurfacePatterns],
      description: "Hairline drawing over the wash.",
    },
    patternColor: { control: "color", description: "Ink the drawing uses." },
    patternOpacity: {
      control: { type: "range", min: 0, max: 1, step: 0.05 },
      description: "How present the drawing is.",
    },
    grain: {
      control: { type: "range", min: 0, max: 2, step: 0.1 },
      description: "Film grain over the whole frame; 0 removes it.",
    },
  },
  parameters: storyDocumentation(
    "The hero treatment: a meadow-green wash under topographic contour rings, film grain over the frame, and content centred on top. Swap `colors` for any `gradientSurfacePresets` entry — or your own array — and the whole mood changes without touching the layout; the `pattern` control swaps the drawing the same way.",
  ),
  render: (args) => (
    <GradientSurface
      {...args}
      className="min-h-[22rem] w-[min(64rem,calc(100vw-2rem))] rounded-3xl"
    >
      <HeroContent />
    </GradientSurface>
  ),
  play: async ({ canvasElement }) => {
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="gradient-surface"]',
    )!
    await expect(surface).toHaveAttribute("data-pattern", "contours")
    // The wash is real paint, not classes: a ground colour plus one bloom
    // per remaining palette entry.
    const surfaceStyle = getComputedStyle(surface)
    await expect(surfaceStyle.backgroundImage).toContain("radial-gradient")
    await expect(
      surfaceStyle.backgroundImage.match(/radial-gradient/g)!.length,
    ).toBe(gradientSurfacePresets.meadow.length - 1)
    // Station assignment, not just layer count: the brightest colour of the
    // palette (`#48b45c`) must bloom at the centre station and paint
    // topmost — the first layer. Counting layers alone would stay green if
    // the blooms regressed to the corners.
    const centreBloom = surfaceStyle.backgroundImage.split("radial-gradient")[1]!
    await expect(centreBloom).toContain("at 50% 42%")
    await expect(centreBloom).toContain("rgb(72, 180, 92)")
    // The drawing is decorative scenery: hidden from assistive tech and
    // inert to the pointer.
    const overlay = surface.querySelector<SVGSVGElement>(
      '[data-slot="gradient-surface-pattern"]',
    )!
    await expect(overlay).toHaveAttribute("aria-hidden", "true")
    await expect(getComputedStyle(overlay).pointerEvents).toBe("none")
    await expect(overlay.querySelectorAll("path").length).toBeGreaterThan(5)
    // The grain covers the whole frame in overlay blend — that is what
    // makes the gradient read as printed rather than rendered — and it must
    // be inert, or it would swallow every click on every surface.
    const grain = surface.querySelector<HTMLElement>(
      '[data-slot="gradient-surface-grain"]',
    )!
    await expect(getComputedStyle(grain).mixBlendMode).toBe("overlay")
    await expect(getComputedStyle(grain).pointerEvents).toBe("none")
    // The content layer stretches to the host's box — the hero's vertical
    // centring depends on it — and the pointer reaches the button through
    // both decorative layers.
    const content = surface.querySelector<HTMLElement>(
      '[data-slot="gradient-surface-content"]',
    )!
    await expect(content.getBoundingClientRect().height).toBeCloseTo(
      surface.getBoundingClientRect().height,
      0,
    )
    const action = surface.querySelector("button")!
    // `elementFromPoint` is viewport-relative and returns null off-screen,
    // which would read as a stacking failure; scroll the button into view
    // and assert the probe landed before asserting what it hit.
    action.scrollIntoView({ block: "center" })
    const target = action.getBoundingClientRect()
    const hit = document.elementFromPoint(
      target.left + target.width / 2,
      target.top + target.height / 2,
    )
    await expect(hit).not.toBeNull()
    await expect(hit).toBe(action)
  },
}

export const Palettes: Story = {
  parameters: storyDocumentation(
    "The preset library, one card per palette, all under the same contour drawing: the palette alone carries the identity. Each preset is just a colour array — `gradientSurfacePresets.ocean` and friends — so a custom brand palette drops in the same way.",
  ),
  render: () => (
    <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(gradientSurfacePresets).map(([name, colors]) => (
        <GradientSurface key={name} colors={colors} className="min-h-40 rounded-2xl">
          <div className="flex h-full items-end">
            <p className="px-5 py-4 text-sm font-medium capitalize text-white/90">
              {name}
            </p>
          </div>
        </GradientSurface>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const surfaces = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="gradient-surface"]',
    )
    await expect(surfaces.length).toBe(
      Object.keys(gradientSurfacePresets).length,
    )
    // Every preset paints its own ground — no two cards share a wash.
    const grounds = new Set(
      [...surfaces].map((s) => getComputedStyle(s).backgroundColor),
    )
    await expect(grounds.size).toBe(surfaces.length)
  },
}

export const Patterns: Story = {
  parameters: storyDocumentation(
    "One palette under each drawing — contours, waves, rings, and none — to show the pattern is a texture layer, independent of the colours beneath it. `none` keeps the wash and the grain and drops only the lines.",
  ),
  render: () => (
    <div className="grid w-[min(64rem,calc(100vw-2rem))] grid-cols-1 gap-4 sm:grid-cols-2">
      {gradientSurfacePatterns.map((pattern) => (
        <GradientSurface
          key={pattern}
          colors={gradientSurfacePresets.dusk}
          pattern={pattern}
          patternOpacity={0.28}
          className="min-h-44 rounded-2xl"
        >
          <div className="flex h-full items-end">
            <p className="px-5 py-4 text-sm font-medium capitalize text-white/90">
              {pattern}
            </p>
          </div>
        </GradientSurface>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const pattern of gradientSurfacePatterns) {
      const surface = canvasElement.querySelector<HTMLElement>(
        `[data-pattern="${pattern}"]`,
      )!
      const overlay = surface.querySelector(
        '[data-slot="gradient-surface-pattern"]',
      )
      // `none` is the absence of the layer, not an empty drawing.
      await expect(overlay === null).toBe(pattern === "none")
    }
  },
}
