import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { StatusLabel, type StatusLabelTone } from "@nessalabs/ui"

import { paintedColor, paintedToken } from "./story-colors"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/StatusLabel",
  component: StatusLabel,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A state as a small mark and a word, in a tone: `neutral`, `good`, `bad`, `warning`, or `active`. There is no pill and no fill behind it — the mark carries the colour and the word carries the meaning, so a state never depends on colour alone, and a row of them reads as text rather than as a row of buttons. The word is the children, and it is required: it is the only part assistive technology reads. Each tone draws a default mark; `icon` replaces it with any glyph drawn in `currentColor`, and `icon={null}` leaves the word alone. `good` and `bad` share `--nessa-market-gain` and `--nessa-market-loss` with `Delta` and `Meter` — borrowed until a status colour role exists; `warning` has no hue of its own yet, because Nessa has no warning colour role, and reads through its mark and full-strength word. Use `Badge` for a label that should stand apart from the text around it; StatusLabel is for a state read in passing, in a row or a header. The word truncates rather than wrapping.",
      },
    },
  },
  args: {
    tone: "good",
    children: "Passed",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "good", "bad", "warning", "active"],
    },
    icon: { control: false },
  },
} satisfies Meta<typeof StatusLabel>

export default meta
type Story = StoryObj<typeof meta>

/** The label, mark, and word of the status label whose test id is `id`. */
function labelParts(canvasElement: HTMLElement, id: string) {
  const label = within(canvasElement).getByTestId(id)
  return {
    label,
    mark: label.querySelector<HTMLElement>("[data-slot=status-label-mark]"),
    word: label.querySelector<HTMLElement>("[data-slot=status-label-word]")!,
  }
}

/** Asserts the label draws no pill: no fill, no border, no padding. */
async function expectNoPill(label: HTMLElement) {
  const style = getComputedStyle(label)
  await expect(paintedColor(style.backgroundColor)[3]).toBe(0)
  await expect(style.borderTopWidth).toBe("0px")
  await expect(style.paddingLeft).toBe("0px")
  await expect(style.paddingRight).toBe("0px")
}

export const Playground: Story = {
  parameters: storyDocumentation(
    "Switch the tone to compare them. The play test proves the word is the accessible text, the mark is hidden from assistive technology, and there is no pill behind either.",
  ),
  render: (args) => <StatusLabel data-testid="label" {...args} />,
  play: async ({ canvasElement }) => {
    const { label, mark, word } = labelParts(canvasElement, "label")
    await expect(label).toHaveTextContent("Passed")
    await expect(word).toHaveTextContent("Passed")
    await expect(mark).toHaveAttribute("aria-hidden", "true")
    await expect(mark!.querySelector("svg")).not.toBeNull()
    await expectNoPill(label)
  },
}

const tones: readonly {
  tone: StatusLabelTone
  word: string
  mark: `--${string}`
  ink: `--${string}`
}[] = [
  { tone: "neutral", word: "Queued", mark: "--muted-foreground", ink: "--muted-foreground" },
  { tone: "good", word: "Passed", mark: "--nessa-market-gain", ink: "--foreground" },
  { tone: "bad", word: "Failed", mark: "--nessa-market-loss", ink: "--foreground" },
  { tone: "warning", word: "Needs attention", mark: "--foreground", ink: "--foreground" },
  { tone: "active", word: "Syncing", mark: "--foreground", ink: "--foreground" },
]

function TonesExample() {
  return (
    <div className="flex flex-col items-start gap-2">
      {tones.map(({ tone, word }) => (
        <StatusLabel key={tone} data-testid={tone} tone={tone}>
          {word}
        </StatusLabel>
      ))}
    </div>
  )
}

/** Asserts every tone paints its mark and word in their tokens, pill-free. */
async function expectTonesPaint(canvasElement: HTMLElement) {
  const glyphs = new Set<string>()
  for (const { tone, word, mark, ink } of tones) {
    const parts = labelParts(canvasElement, tone)
    await expect(parts.label).toHaveAttribute("data-tone", tone)
    await expect(parts.word).toHaveTextContent(word)
    await expect(paintedColor(getComputedStyle(parts.mark!).color)).toEqual(
      paintedToken(mark),
    )
    await expect(paintedColor(getComputedStyle(parts.word).color)).toEqual(
      paintedToken(ink),
    )
    await expectNoPill(parts.label)
    glyphs.add(parts.mark!.innerHTML)
  }
  // Every tone draws a different mark, so tones that share an ink still
  // read apart.
  await expect(glyphs.size).toBe(tones.length)
}

export const Light: Story = {
  globals: { theme: "light" },
  parameters: storyDocumentation(
    "All five tones in Light. The play test proves each mark and word paints its token, no tone draws a pill, and every tone draws a different mark — `warning` and `active` share the foreground ink and are told apart by mark and word.",
  ),
  render: () => <TonesExample />,
  play: async ({ canvasElement }) => expectTonesPaint(canvasElement),
}

export const Dark: Story = {
  globals: { theme: "dark" },
  parameters: storyDocumentation(
    "The same five tones in Dark. Every ink is a semantic token, so nothing in the component changes between modes.",
  ),
  render: () => <TonesExample />,
  play: async ({ canvasElement }) => expectTonesPaint(canvasElement),
}

export const CustomMark: Story = {
  parameters: storyDocumentation(
    "`icon` replaces the tone's mark with the host's own glyph, which takes the tone's colour through `currentColor` and, passed as a bare SVG, the mark size — 12px at the default UI scale. `icon={null}` leaves the word on its own.",
  ),
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <StatusLabel data-testid="custom" tone="good" icon={
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9l3-3 2 2 3-3.5M7.8 4.5H10v2.2" />
        </svg>
      }>
        Improving
      </StatusLabel>
      <StatusLabel data-testid="bare" tone="bad" icon={null}>
        No mark
      </StatusLabel>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const custom = labelParts(canvasElement, "custom")
    const svg = custom.mark!.querySelector("svg")!
    await expect(svg.querySelector("path")).toHaveAttribute(
      "d",
      "M2 9l3-3 2 2 3-3.5M7.8 4.5H10v2.2",
    )
    await expect(svg.getBoundingClientRect().width).toBeCloseTo(12, 0)
    await expect(paintedColor(getComputedStyle(svg).color)).toEqual(
      paintedToken("--nessa-market-gain"),
    )
    const bare = labelParts(canvasElement, "bare")
    await expect(bare.mark).toBeNull()
    await expect(bare.label).toHaveTextContent("No mark")
  },
}

export const LongWord: Story = {
  parameters: storyDocumentation(
    "In a narrow row the word truncates with an ellipsis; the mark keeps its size and the label never wraps onto a second line.",
  ),
  render: () => (
    <div className="flex w-36 items-center gap-2 rounded-md border border-border p-2 nessa-text-2">
      <span className="shrink-0 text-muted-foreground">#12</span>
      <StatusLabel data-testid="long" tone="warning">
        Waiting on an upstream dependency to finish
      </StatusLabel>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { label, mark, word } = labelParts(canvasElement, "long")
    const row = label.parentElement!.getBoundingClientRect()
    await expect(getComputedStyle(word).textOverflow).toBe("ellipsis")
    await expect(word.scrollWidth).toBeGreaterThan(word.clientWidth)
    await expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(
      row.right,
    )
    await expect(mark!.getBoundingClientRect().width).toBeCloseTo(12, 0)
    await expect(label.getBoundingClientRect().height).toBeLessThan(
      Number.parseFloat(getComputedStyle(label).lineHeight) * 1.5,
    )
  },
}
