import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PopoverSurface } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const LAYERS = [
  { name: "canvas", token: "--background", utility: "bg-background", use: "The page ground everything else sits on." },
  { name: "panel", token: "--nessa-surface-panel", utility: "bg-surface-panel", use: "Docked chrome: toolbars, pane headers, status bars." },
  { name: "sunken", token: "--nessa-surface-sunken", utility: "bg-surface-sunken", use: "An inset well: code, table heads, summaries." },
  { name: "raised", token: "--card", utility: "bg-card shadow-raised", use: "Content that sits on the canvas: cards, tiles." },
  { name: "overlay", token: "--popover", utility: "bg-popover shadow-overlay", use: "Floating layers: menus, popovers, pickers." },
] as const

function Window() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background" data-testid="layer-canvas">
      <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-panel px-3" data-testid="layer-panel">
        <span className="nessa-text-2 font-medium text-foreground">worktree / main</span>
        <span className="nessa-text-2 ms-auto text-muted-foreground">panel</span>
      </div>
      <div className="relative grid gap-4 p-6 sm:grid-cols-[1fr_16rem]">
        <Card className="gap-3 py-4" data-testid="layer-raised">
          <CardHeader className="px-4">
            <CardTitle>Raised card</CardTitle>
            <CardDescription>Card tokens with the raised shadow.</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <pre
              className="nessa-text-3 rounded-md border border-border bg-surface-sunken p-3 font-mono text-muted-foreground"
              data-testid="layer-sunken"
            >
              {"$ git worktree add ../feature\nPreparing worktree (new branch)"}
            </pre>
          </CardContent>
        </Card>
        <PopoverSurface className="nessa-text-4 self-start p-1" data-testid="layer-overlay">
          {["Open in editor", "Copy path", "Remove worktree"].map((item) => (
            <div className="rounded-md px-2 py-1.5 text-popover-foreground hover:bg-accent" key={item}>
              {item}
            </div>
          ))}
        </PopoverSurface>
      </div>
    </div>
  )
}

function Ladder() {
  return (
    <dl className="divide-y divide-border border-y border-border">
      {LAYERS.map(({ name, token, utility, use }) => (
        <div className="grid grid-cols-[13rem_1fr] items-center gap-4 py-3" key={name}>
          <dt className="nessa-text-2 flex items-center gap-4 font-mono text-foreground">
            <span aria-hidden className={`size-10 shrink-0 rounded-md border border-border ${utility}`} />
            <span>
              {name}
              <span className="block text-muted-foreground">{token}</span>
            </span>
          </dt>
          <dd className="nessa-text-4 text-muted-foreground">
            {use} <code className="nessa-text-3 font-mono">{utility}</code>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Surfaces() {
  return (
    <div className="max-w-4xl space-y-8 p-8">
      <div className="space-y-2">
        <h2 className="nessa-text-7 font-semibold text-foreground">Surfaces</h2>
        <p className="nessa-text-4 text-muted-foreground">
          Five layers, ordered by elevation. Canvas, raised, and overlay are the existing background, card, and popover
          roles; panel and sunken fill the tones between them. In Dark, elevation is lightness, so each step up is
          lighter and a well sits below the canvas.
        </p>
      </div>
      <Window />
      <Ladder />
    </div>
  )
}

const meta = {
  title: "Nessa UI/Surfaces",
  component: Surfaces,
  tags: ["test"],
  parameters: {
    layout: "fullscreen",
    options: { showPanel: false },
  },
} satisfies Meta<typeof Surfaces>

export default meta
type Story = StoryObj<typeof meta>

export const Layers: Story = {
  parameters: storyDocumentation(
    "The surface family in one window: a panel toolbar on the canvas, a raised card holding a sunken well, and an overlay menu. The play test proves the canvas, panel and sunken tones are distinct and that raised and overlay carry a shadow, by computed style rather than class names.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const background = (id: string) => getComputedStyle(canvas.getByTestId(id)).backgroundColor
    // Light keeps canvas, raised and overlay all white and separates them by
    // shadow alone, so only the tone steps are distinct in both themes.
    const layers = ["canvas", "panel", "sunken"].map((name) => background(`layer-${name}`))
    await expect(new Set(layers).size).toBe(layers.length)
    for (const id of ["layer-raised", "layer-overlay"]) {
      await expect(getComputedStyle(canvas.getByTestId(id)).boxShadow).not.toBe("none")
    }
  },
}
