import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"
import { Button, CodeBlock, GeneratingSurface } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

function SurfaceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-6">
      {children}
    </div>
  )
}

const generatedPage = `<main class="hero">
  <h1>Ship the changelog</h1>
  <p>Every release, summarized for humans.</p>
  <a class="cta" href="/signup">Start free</a>
</main>`

const meta = {
  title: "Components/GeneratingSurface",
  component: GeneratingSurface,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A container for content that takes a while to generate — diagrams, images, page previews, anything an assistant streams or renders. While `generating` it reserves space with an ambient placeholder: soft smoke plumes drift behind a shimmering status label instead of half-finished output. When `generating` flips off, the placeholder morphs into the content in two beats, like a container transform: the surface first resizes to the content's height with the placeholder still opaque, then fades through — smoke out fully, content sharpening in from a soft blur — so the finished artifact lands without a layout jump or a ghosted cross-dissolve. MermaidDiagram composes it automatically while streaming diagram source, and under reduced motion the reveal applies its end state instantly.",
      },
    },
  },
} satisfies Meta<typeof GeneratingSurface>

export default meta
type Story = StoryObj<typeof meta>

export const Generating: Story = {
  args: { generating: true, label: "Generating preview" },
  argTypes: {
    generating: {
      control: "boolean",
      description: "Placeholder while true; morphs into children when it flips off.",
    },
    label: { control: "text", description: "Status text shimmering in the placeholder." },
    placeholderClassName: {
      control: "text",
      description: "Extra classes for the placeholder panel, e.g. a min-h-* override.",
    },
  },
  parameters: storyDocumentation(
    "The waiting state: an ambient placeholder with drifting smoke plumes and a shimmering status label. The label is real text in a polite status region, the panel is `aria-busy`, and the smoke is decorative and motionless under reduced motion. Toggle the `generating` control off to watch the surface morph into its content.",
  ),
  render: (args) => (
    <SurfaceFrame>
      <GeneratingSurface {...args} placeholderClassName="min-h-40">
        <CodeBlock code={generatedPage} language="html" />
      </GeneratingSurface>
    </SurfaceFrame>
  ),
  play: async ({ canvasElement }) => {
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="generating-surface"]',
    )!
    await expect(surface).toHaveAttribute("data-phase", "generating")
    await expect(surface).toHaveAttribute("aria-busy", "true")
    const placeholder = surface.querySelector<HTMLElement>(
      '[data-slot="generating-surface-placeholder"]',
    )!
    // Computed styles, not class names: the panel actually paints its frame
    // and the plumes actually carry their blur.
    await expect(getComputedStyle(placeholder).borderStyle).toBe("solid")
    // The smoke layer is the placeholder's first child; its children are
    // the three drifting plumes.
    const plumes = placeholder.firstElementChild!.children
    await expect(plumes.length).toBe(3)
    await expect(getComputedStyle(plumes[0]!).filter).toContain("blur")
    const label = surface.querySelector('[data-slot="generating-surface-label"]')!
    await expect(label.textContent).toBe("Generating preview")
    // The visible label is decorative; the announcement comes from the
    // persistent status region, whose text is injected post-mount so live
    // regions actually speak it.
    await expect(label.closest('[aria-hidden="true"]')).toBeTruthy()
    await waitFor(() =>
      expect(surface.querySelector('[role="status"]')!.textContent).toBe(
        "Generating preview",
      ),
    )
    // The content stays out of the DOM until generation completes.
    await expect(
      surface.querySelector('[data-slot="generating-surface-content"]'),
    ).toBeNull()
  },
}

/**
 * Story scaffolding: fakes a generation pass with a timer so the flagship
 * view always lands on revealed content, and Regenerate replays the morph.
 */
function RevealDemo() {
  const [generating, setGenerating] = React.useState(true)
  const timer = React.useRef(0)
  const start = React.useCallback(() => {
    setGenerating(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setGenerating(false), 1400)
  }, [])
  React.useEffect(() => {
    start()
    return () => window.clearTimeout(timer.current)
  }, [start])
  return (
    <SurfaceFrame>
      <GeneratingSurface generating={generating} label="Generating webpage">
        <CodeBlock code={generatedPage} language="html" />
      </GeneratingSurface>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={start} disabled={generating}>
          Regenerate
        </Button>
      </div>
    </SurfaceFrame>
  )
}

export const RevealMorph: Story = {
  args: { generating: true },
  parameters: storyDocumentation(
    "The full cycle: a fake generation pass holds the placeholder for a moment, then the surface morphs into the generated artifact in two beats — the panel first resizes to the content's height with the smoke still opaque, then fades through into the content as it sharpens in from a soft blur. Regenerate replays the cycle.",
  ),
  render: () => <RevealDemo />,
  play: async ({ canvasElement }) => {
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="generating-surface"]',
    )!
    await expect(surface).toHaveAttribute("data-phase", "generating")
    // Capture the mid-morph state as it happens: through the reveal the
    // content is mounted but still hidden under an opaque placeholder, so
    // it must stay inert (its links are neither clickable nor tabbable)
    // and the surface must still report itself busy.
    const revealing: { inert: boolean; busy: string | null }[] = []
    const observer = new MutationObserver(() => {
      if (surface.dataset.phase !== "revealing") return
      const node = surface.querySelector<HTMLElement>(
        '[data-slot="generating-surface-content"]',
      )
      if (node !== null) {
        revealing.push({
          inert: node.hasAttribute("inert"),
          busy: surface.getAttribute("aria-busy"),
        })
      }
    })
    observer.observe(surface, {
      attributes: true,
      attributeFilter: ["data-phase"],
    })
    // The reveal runs after the fake generation pass; settled means the
    // morph finished and its animations were torn down.
    await waitFor(
      () => expect(surface).toHaveAttribute("data-phase", "settled"),
      { timeout: 8000 },
    )
    observer.disconnect()
    await expect(revealing.length).toBeGreaterThan(0)
    await expect(revealing.every((frame) => frame.inert)).toBe(true)
    await expect(revealing.every((frame) => frame.busy === "true")).toBe(true)
    const content = surface.querySelector<HTMLElement>(
      '[data-slot="generating-surface-content"]',
    )!
    await waitFor(() => expect(getComputedStyle(content).opacity).toBe("1"))
    await expect(
      surface.querySelector('[data-slot="generating-surface-placeholder"]'),
    ).toBeNull()
    await expect(surface).not.toHaveAttribute("aria-busy")
    // Settled content is interactive again.
    await expect(content.hasAttribute("inert")).toBe(false)
    // No lingering players on the surface once settled, so the story rests
    // on plain DOM (and the a11y sweep measures the final frame).
    await waitFor(() =>
      expect(surface.getAnimations({ subtree: true }).length).toBe(0),
    )
  },
}
