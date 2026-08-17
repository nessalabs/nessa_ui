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
  play: async ({ canvasElement }) => {
    const diagram = canvasElement.querySelector('[data-slot="mermaid-diagram"]')!
    // The expand control only renders once Mermaid has produced the SVG, so
    // waiting for it also proves the diagram rendered (the copy icon is an
    // svg too, so a bare svg query would pass early).
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
    // The muted source fallback also contains the participant names, so wait
    // for the expand control — proof the SVG rendered — before reading text.
    await waitFor(
      () =>
        expect(
          diagram.querySelector('button[aria-label="Expand diagram"]'),
        ).toBeTruthy(),
      { timeout: 15000 },
    )
    await expect(diagram.textContent).toMatch(/useMessageStreamText/)
  },
}
