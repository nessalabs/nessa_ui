import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"
import { MermaidDiagram } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

function DiagramFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-6">
      {children}
    </div>
  )
}

const flowchart = `graph TD
  A[Chunk arrives] --> B{Backlog?}
  B -- yes --> C[Ease velocity toward backlog / trail]
  B -- no --> D[Hold position]
  C --> E[Reveal characters]
  E --> B
  D --> B`

const sequence = `sequenceDiagram
  participant H as Host app
  participant S as useMessageStreamText
  participant D as Display
  H->>S: text so far (bursty chunks)
  S->>S: pace reveal to arrival rate
  S->>D: smoothed text + static prefix
  D->>D: fade in new characters`

const meta = {
  title: "Components/MermaidDiagram",
  component: MermaidDiagram,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A Mermaid diagram rendered to SVG — one component for every Mermaid grammar: flowcharts, sequence diagrams, state and class diagrams, gantt charts, and the rest. It follows the nearest CodeBlockProvider's mode so diagrams switch light and dark with the app, keeps the last successful render on screen while streaming source is momentarily invalid, and carries a copy control for the Mermaid source. MessageMarkdown composes it automatically for ```mermaid fences.",
      },
    },
  },
} satisfies Meta<typeof MermaidDiagram>

export default meta
type Story = StoryObj<typeof meta>

export const Flowchart: Story = {
  args: { chart: flowchart },
  argTypes: {
    chart: { control: "text", description: "The Mermaid source." },
    mode: {
      control: "select",
      options: ["system", "light", "dark"],
      description:
        "Theme side; falls back to the nearest CodeBlockProvider's mode.",
    },
  },
  parameters: storyDocumentation(
    "A flowchart from plain Mermaid source. The diagram theme follows the CodeBlockProvider mode — flip the Storybook theme toolbar and the diagram re-renders to match. Hovering reveals two controls: expand opens a fullscreen viewer with drag-to-pan and wheel zoom for diagrams too large to read inline, and copy copies the Mermaid source itself.",
  ),
  render: (args) => (
    <DiagramFrame>
      <MermaidDiagram {...args} />
    </DiagramFrame>
  ),
  // No dialog interaction here: the flagship story rests on the drawn
  // diagram, so watching it in the dev canvas never flashes the viewer.
  // The fullscreen flow lives in the FullscreenViewer story.
  play: async ({ canvasElement }) => {
    const diagram = canvasElement.querySelector('[data-slot="mermaid-diagram"]')!
    // The expand control only renders once Mermaid has produced the SVG and
    // the reveal settled, so waiting for it also proves the diagram
    // rendered (the copy icon is an svg too, so a bare svg query would
    // pass early).
    await waitFor(
      () =>
        expect(
          diagram.querySelector('button[aria-label="Expand diagram"]'),
        ).toBeTruthy(),
      { timeout: 15000 },
    )
    await expect(
      diagram.querySelector('[data-slot="copy-button"]'),
    ).toHaveAttribute("aria-label", "Copy diagram source")
  },
}

export const FullscreenViewer: Story = {
  args: { chart: flowchart },
  parameters: storyDocumentation(
    "The fullscreen pan-and-zoom viewer, opened from the hover expand control: drag to pan, wheel-zoom toward the cursor, and reset to refit. Kept as its own story so the flagship diagram stories rest on the inline drawing instead of flashing a dialog while their interaction test runs.",
  ),
  render: (args) => (
    <DiagramFrame>
      <MermaidDiagram {...args} />
    </DiagramFrame>
  ),
  play: async ({ canvasElement }) => {
    const diagram = canvasElement.querySelector('[data-slot="mermaid-diagram"]')!
    await waitFor(
      () =>
        expect(
          diagram.querySelector('button[aria-label="Expand diagram"]'),
        ).toBeTruthy(),
      { timeout: 15000 },
    )
    // Expand opens the fullscreen pan-and-zoom viewer as a modal dialog.
    const expand = diagram.querySelector<HTMLButtonElement>(
      'button[aria-label="Expand diagram"]',
    )!
    expand.click()
    await waitFor(() => {
      const viewer = document.querySelector('[data-slot="mermaid-viewer"]')
      expect(viewer).toBeTruthy()
      expect((viewer as HTMLDialogElement).open).toBe(true)
      expect(viewer!.querySelector("svg")).toBeTruthy()
    })
    const close = document.querySelector<HTMLButtonElement>(
      '[data-slot="mermaid-viewer"] button[aria-label="Close viewer"]',
    )!
    close.click()
    await waitFor(() =>
      expect(document.querySelector('[data-slot="mermaid-viewer"]')).toBeNull(),
    )
  },
}

export const SequenceDiagram: Story = {
  args: { chart: sequence },
  parameters: storyDocumentation(
    "A sequence diagram — the same component, a different Mermaid grammar: participants, ordered messages, and self-calls all render from the source block, so hosts need no separate sequence-diagram component.",
  ),
  render: (args) => (
    <DiagramFrame>
      <MermaidDiagram {...args} />
    </DiagramFrame>
  ),
  play: async ({ canvasElement }) => {
    const diagram = canvasElement.querySelector('[data-slot="mermaid-diagram"]')!
    // Wait for the expand control — proof the SVG rendered — before reading
    // the participant names out of the drawn diagram.
    await waitFor(
      () =>
        expect(
          diagram.querySelector('button[aria-label="Expand diagram"]'),
        ).toBeTruthy(),
      { timeout: 15000 },
    )
    // The drawn diagram mounts a render tick after the SVG lands (the
    // generating placeholder morphs out first), so poll for its text.
    await waitFor(() =>
      expect(diagram.textContent).toMatch(/useMessageStreamText/),
    )
  },
}

export const InvalidSource: Story = {
  args: { chart: "graph TD\n  A[Chunk arrives] -->" },
  parameters: storyDocumentation(
    "Source that never parses — a truncated or malformed diagram from a model. Instead of shimmering forever, the surface settles into the muted raw source once the render fails, so the reader can still see (and copy) what was emitted.",
  ),
  render: (args) => (
    <DiagramFrame>
      <MermaidDiagram {...args} />
    </DiagramFrame>
  ),
  play: async ({ canvasElement }) => {
    const diagram = canvasElement.querySelector('[data-slot="mermaid-diagram"]')!
    const surface = diagram.querySelector<HTMLElement>(
      '[data-slot="generating-surface"]',
    )!
    // The failed render settles the surface into the raw-source fallback.
    await waitFor(
      () => expect(surface).toHaveAttribute("data-phase", "settled"),
      { timeout: 15000 },
    )
    const fallback = surface.querySelector("pre")!
    await expect(fallback.textContent).toContain("Chunk arrives")
    // The reveal finished: the content wrapper is fully opaque, not
    // mid-fade.
    const content = surface.querySelector<HTMLElement>(
      '[data-slot="generating-surface-content"]',
    )!
    await waitFor(() => expect(getComputedStyle(content).opacity).toBe("1"))
    // No drawn diagram means no expand control.
    await expect(
      diagram.querySelector('button[aria-label="Expand diagram"]'),
    ).toBeNull()
    await waitFor(() =>
      expect(surface.getAnimations({ subtree: true }).length).toBe(0),
    )
  },
}

/**
 * Story scaffolding: replays the sequence source arriving in chunks, the
 * way a model streams a ```mermaid fence, so the generating placeholder
 * and its morph into the drawn diagram are visible on demand.
 */
function StreamingDiagramDemo() {
  const [chart, setChart] = React.useState("")
  const [arriving, setArriving] = React.useState(true)
  const timer = React.useRef(0)
  const start = React.useCallback(() => {
    window.clearInterval(timer.current)
    setChart("")
    setArriving(true)
    let cursor = 0
    timer.current = window.setInterval(() => {
      cursor = Math.min(cursor + 9, sequence.length)
      setChart(sequence.slice(0, cursor))
      if (cursor >= sequence.length) {
        window.clearInterval(timer.current)
        setArriving(false)
      }
    }, 60)
  }, [])
  React.useEffect(() => {
    start()
    return () => window.clearInterval(timer.current)
  }, [start])
  return (
    <DiagramFrame>
      <MermaidDiagram chart={chart} streaming={arriving} />
    </DiagramFrame>
  )
}

export const StreamingSource: Story = {
  args: { chart: sequence },
  parameters: storyDocumentation(
    "Diagram source streaming in the way a model emits a ```mermaid fence. While the source is still arriving, a GeneratingSurface placeholder — drifting smoke behind a shimmering label — holds the space instead of flashing raw source text or a half-streamed diagram; once the fence completes (`streaming` flips off — MessageMarkdown does this automatically when the fence closes), the placeholder morphs into the drawn diagram in two beats: the surface first resizes to the diagram's height, then the smoke fades through into the diagram as it sharpens in from a soft blur.",
  ),
  render: () => <StreamingDiagramDemo />,
  play: async ({ canvasElement }) => {
    const diagram = canvasElement.querySelector('[data-slot="mermaid-diagram"]')!
    const surface = diagram.querySelector<HTMLElement>(
      '[data-slot="generating-surface"]',
    )!
    // While source streams, the placeholder holds the space — no raw
    // Mermaid text is ever visible.
    await expect(surface).toHaveAttribute("data-phase", "generating")
    await expect(diagram.textContent).not.toMatch(/sequenceDiagram/)
    await waitFor(
      () =>
        expect(
          diagram.querySelector('button[aria-label="Expand diagram"]'),
        ).toBeTruthy(),
      { timeout: 15000 },
    )
    // The reveal morph completes and tears its animations down.
    await waitFor(
      () => expect(surface).toHaveAttribute("data-phase", "settled"),
      { timeout: 15000 },
    )
    await waitFor(() =>
      expect(surface.getAnimations({ subtree: true }).length).toBe(0),
    )
    await expect(diagram.querySelector("svg")).toBeTruthy()
  },
}
