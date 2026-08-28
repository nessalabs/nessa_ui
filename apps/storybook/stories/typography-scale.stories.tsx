import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  cn,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const SCALES = ["90", "95", "100", "105", "110", "125"] as const
type Scale = (typeof SCALES)[number]

const LEVELS = [
  { level: 1, size: "0.6875rem", use: "Dense metadata: calendar gutter labels, timestamps." },
  { level: 2, size: "0.75rem", use: "Secondary UI text: captions, badges, footnotes." },
  { level: 3, size: "0.8125rem", use: "Monospace surfaces: code blocks, tool-call transcripts." },
  { level: 4, size: "0.875rem", use: "Default body and control text." },
  { level: 5, size: "1rem", use: "Emphasised body and section leads." },
  { level: 6, size: "1.125rem", use: "Card and dialog titles." },
  { level: 7, size: "1.25rem", use: "Page and prose headings." },
] as const

function Levels() {
  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className="space-y-2">
        <h2 className="nessa-text-7 font-semibold text-foreground">Coordinated levels</h2>
        <p className="nessa-text-4 text-muted-foreground">
          A level is a size, a unitless line-height ratio, and a tracking value
          applied together — never a lone font size. Components name a level with
          the <code className="nessa-text-3 font-mono">nessa-text-N</code> helper
          instead of a Tailwind size utility.
        </p>
      </div>
      <dl className="divide-y divide-border border-y border-border">
        {LEVELS.map(({ level, size, use }) => (
          <div className="grid grid-cols-[6rem_1fr] items-baseline gap-4 py-4" key={level}>
            <dt className="nessa-text-2 font-mono text-muted-foreground">
              nessa-text-{level}
              <span className="block">{size}</span>
            </dt>
            <dd className="space-y-1">
              <p className={cn(`nessa-text-${level}`, "text-foreground")}>
                The quick brown fox jumps over the lazy dog
              </p>
              <p className="nessa-text-2 text-muted-foreground">{use}</p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ScalePlayground() {
  const [scale, setScale] = useState<Scale>("100")
  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="nessa-text-2 font-medium text-muted-foreground">UI scale</span>
        {SCALES.map((preset) => (
          <Button
            aria-pressed={preset === scale}
            key={preset}
            onClick={() => setScale(preset)}
            size="sm"
            variant={preset === scale ? "default" : "outline"}
          >
            {preset}%
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border p-6" data-nessa-scale={scale}>
        <div className="flex max-w-md flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment ready</CardTitle>
              <CardDescription>
                Everything inside this scope follows the active preset: text
                sizes through the coordinated levels, and spacing and control
                geometry through the scaled spacing base.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge>Staging</Badge>
                <Badge variant="secondary">3 checks</Badge>
              </div>
              <Input aria-label="Release tag" defaultValue="v2.4.1" />
              <div className="flex gap-2">
                <Button size="sm">Promote</Button>
                <Button size="sm" variant="outline">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="nessa-text-2 text-muted-foreground">
        Colors, radii, border widths, focus-ring thickness, and motion never
        follow scale. Nesting another <code className="font-mono">data-nessa-scale</code>{" "}
        sets an absolute preset rather than multiplying this one.
      </p>
    </div>
  )
}

function TypographyScale() {
  return (
    <main className="text-foreground">
      <Levels />
      <ScalePlayground />
    </main>
  )
}

const meta = {
  title: "Nessa UI/Typography & Scale",
  component: TypographyScale,
  tags: ["test"],
  parameters: {
    layout: "fullscreen",
    options: { showPanel: false },
  },
} satisfies Meta<typeof TypographyScale>

export default meta
type Story = StoryObj<typeof meta>

export const Ramp: Story = {
  render: () => <Levels />,
  parameters: storyDocumentation(
    "The seven coordinated typography levels. Each row applies one nessa-text helper, which sets font size, unitless line height, and tracking together.",
  ),
}

export const Scale: Story = {
  render: () => <ScalePlayground />,
  parameters: storyDocumentation(
    "The six constrained UI scale presets. Setting data-nessa-scale on any wrapper rescales the coordinated typography and the spacing-derived control geometry inside it without touching color, radius, border width, or motion.",
  ),
}
