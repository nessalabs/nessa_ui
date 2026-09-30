import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Delta, Meter, Stat } from "@nessalabs/ui"

import { paintedColor, paintedToken } from "./story-colors"
import { storyDocumentation } from "./story-documentation"

/** Points to one decimal. */
const points = (size: number) => size.toFixed(1)

const meta = {
  title: "Primitives/Stat",
  component: Stat,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A figure with its caption. `value` is the figure, already formatted; `of` is the whole it is part of, drawn after it in a quieter ink and passed with its own separator (\"/14\"); `delta` is a slot beside the figure, usually a `Delta`; `caption` names the figure and sits above it or, with `captionSide=\"bottom\"`, below it, as CSS `caption-side` does. `children` go underneath — a `Meter`, a footnote. `size` is `sm` for dense rows, `md` for a dashboard tile, and `lg` for the hero figure a view leads with. Figures use tabular numerals. Stat writes no text of its own, and it stretches to its container: a long caption truncates, while the figure never does, because a clipped number reads as a different one.",
      },
    },
  },
  args: {
    value: "5",
    of: "/14",
    caption: "Done",
    size: "md",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    captionSide: { control: "inline-radio", options: ["top", "bottom"] },
    delta: { control: false },
  },
} satisfies Meta<typeof Stat>

export default meta
type Story = StoryObj<typeof meta>

/** The parts of the stat whose test id is `id`. */
function statParts(canvasElement: HTMLElement, id: string) {
  const stat = within(canvasElement).getByTestId(id)
  const part = (slot: string) =>
    stat.querySelector<HTMLElement>(`[data-slot=${slot}]`)
  return {
    stat,
    value: part("stat-value")!,
    of: part("stat-of"),
    delta: part("stat-delta"),
    caption: part("stat-caption")!,
  }
}

export const Playground: Story = {
  parameters: storyDocumentation(
    "A tile-sized figure with the whole it is part of. The play test proves the caption is read before the figure, the whole is drawn after it and quieter, and the figure is set in tabular numerals.",
  ),
  render: (args) => <Stat data-testid="stat" {...args} />,
  play: async ({ canvasElement }) => {
    const { stat, value, of, caption } = statParts(canvasElement, "stat")
    await expect(stat.textContent).toBe("Done5/14")
    await expect(caption.compareDocumentPosition(value)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    await expect(of).not.toBeNull()
    await expect(Number.parseFloat(getComputedStyle(of!).fontSize)).toBeLessThan(
      Number.parseFloat(getComputedStyle(value).fontSize),
    )
    await expect(getComputedStyle(value).fontVariantNumeric).toBe("tabular-nums")
  },
}

export const Sizes: Story = {
  parameters: storyDocumentation(
    "The three sizes side by side: `sm` for a dense row, `md` for a tile, `lg` for the hero figure. The play test proves each step is larger than the last and that the hero stays tied to the type ramp: it is 2.5 times the largest coordinated level, so a Nessa scale preset moves it with everything else — the second row sits in a `125` scale scope.",
  ),
  render: () => (
    <div className="flex flex-col gap-8">
      {(["100", "125"] as const).map((scale) => (
        <div key={scale} data-nessa-scale={scale} className="flex items-end gap-10">
          <Stat data-testid={`sm-${scale}`} size="sm" value="5" of="/14" caption="Done" />
          <Stat data-testid={`md-${scale}`} size="md" value="5" of="/14" caption="Done" />
          <Stat data-testid={`lg-${scale}`} size="lg" value="71.6" caption="Accuracy" />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const fontSize = (element: HTMLElement) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    const valueSize = (id: string) => fontSize(statParts(canvasElement, id).value)
    for (const scale of ["100", "125"]) {
      await expect(valueSize(`sm-${scale}`)).toBeLessThan(valueSize(`md-${scale}`))
      await expect(valueSize(`md-${scale}`)).toBeLessThan(valueSize(`lg-${scale}`))
      const hero = statParts(canvasElement, `lg-${scale}`).value
      const figureLine = hero.parentElement!
      await expect(fontSize(hero)).toBeCloseTo(fontSize(figureLine) * 2.5, 1)
      for (const size of ["sm", "md", "lg"]) {
        await expect(
          getComputedStyle(statParts(canvasElement, `${size}-${scale}`).value)
            .fontVariantNumeric,
        ).toBe("tabular-nums")
      }
    }
    await expect(valueSize("lg-125")).toBeCloseTo(valueSize("lg-100") * 1.25, 1)
  },
}

export const Hero: Story = {
  parameters: storyDocumentation(
    "The hero figure a view leads with: a label above, the figure with its change beside it, and a footnote below as `children`. The change sits on the figure's baseline at a reading size, not the figure's display size.",
  ),
  render: () => (
    <Stat
      data-testid="hero"
      size="lg"
      className="w-80"
      caption="Accuracy"
      value="71.6%"
      delta={<Delta value={9.5} tone="good" format={(v) => `${points(v)} pts`} />}
    >
      <p className="m-0 nessa-text-3 text-muted-foreground">
        up from 62.1 last month · 58% of the way to target
      </p>
      <Meter value={0.58} label="Progress to target" />
    </Stat>
  ),
  play: async ({ canvasElement }) => {
    const { value, delta } = statParts(canvasElement, "hero")
    await expect(delta).not.toBeNull()
    await expect(delta!).toHaveTextContent("+9.5 pts")
    await expect(
      Number.parseFloat(getComputedStyle(delta!).fontSize),
    ).toBeLessThan(Number.parseFloat(getComputedStyle(value).fontSize) / 2)
    // Beside the figure, on its line.
    const valueBox = value.getBoundingClientRect()
    const deltaBox = delta!.getBoundingClientRect()
    await expect(deltaBox.left).toBeGreaterThan(valueBox.right)
    await expect(deltaBox.top).toBeGreaterThan(valueBox.top)
    await expect(deltaBox.top).toBeLessThan(valueBox.bottom)
    await expect(
      within(canvasElement).getByRole("meter", { name: "Progress to target" }),
    ).toBeInTheDocument()
  },
}

export const CaptionBelow: Story = {
  parameters: storyDocumentation(
    "`captionSide=\"bottom\"` qualifies a figure after it is read — a pair of small figures in a card row. Reading order follows what is drawn: the figure, then the caption.",
  ),
  render: () => (
    <div className="flex gap-6">
      <Stat
        data-testid="gain"
        size="sm"
        captionSide="bottom"
        value={<Delta value={9.5} tone="good" format={points} />}
        caption="pts this week"
      />
      <Stat
        data-testid="done"
        size="sm"
        captionSide="bottom"
        value="5"
        of="/14"
        caption="done"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { stat, value, caption } = statParts(canvasElement, "done")
    await expect(stat.textContent).toBe("5/14done")
    await expect(value.compareDocumentPosition(caption)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    await expect(caption.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      value.getBoundingClientRect().bottom - 1,
    )
    await expect(statParts(canvasElement, "gain").value).toHaveTextContent("+9.5")
  },
}

export const LongCaption: Story = {
  parameters: storyDocumentation(
    "In a narrow tile a caption longer than the tile truncates with an ellipsis instead of wrapping or pushing the tile wider. The figure is never truncated.",
  ),
  render: () => (
    <div className="w-40 rounded-md border border-border p-3">
      <Stat
        data-testid="narrow"
        value="1,284"
        of=" / 2,000"
        caption="Requests served from the regional cache since the last deploy"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { stat, value, caption } = statParts(canvasElement, "narrow")
    const frame = stat.getBoundingClientRect()
    await expect(getComputedStyle(caption).textOverflow).toBe("ellipsis")
    await expect(caption.scrollWidth).toBeGreaterThan(caption.clientWidth)
    await expect(caption.getBoundingClientRect().right).toBeLessThanOrEqual(
      frame.right,
    )
    await expect(caption.getBoundingClientRect().height).toBeLessThan(
      Number.parseFloat(getComputedStyle(caption).lineHeight) * 1.5,
    )
    // The figure is whole and inside the tile: never wrapped, never clipped.
    const figure = value.parentElement!
    await expect(getComputedStyle(figure).whiteSpace).toBe("nowrap")
    await expect(getComputedStyle(value).textOverflow).not.toBe("ellipsis")
    await expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(
      stat.getBoundingClientRect().right,
    )
    await expect(value).toHaveTextContent("1,284 / 2,000")
  },
}

function TilesExample() {
  const captionId = React.useId()
  return (
    <div className="grid w-md grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
      <Stat
        data-testid="seats"
        className="bg-background p-4"
        caption={<span id={captionId}>Seats</span>}
        value="42"
        of=" / 60"
      >
        <Meter value={42 / 60} aria-labelledby={captionId} className="mt-1" />
      </Stat>
      <Stat
        data-testid="cost"
        className="bg-background p-4"
        caption="Cost per order"
        value="$0.049"
        delta={<Delta value={-0.012} tone="good" format={(v) => `$${v.toFixed(3)}`} />}
      />
    </div>
  )
}

/** Asserts the figure, whole, and caption paint their tokens. */
async function expectInks(canvasElement: HTMLElement) {
  const { value, of, caption } = statParts(canvasElement, "seats")
  await expect(paintedColor(getComputedStyle(value).color)).toEqual(
    paintedToken("--foreground"),
  )
  await expect(paintedColor(getComputedStyle(of!).color)).toEqual(
    paintedToken("--muted-foreground"),
  )
  await expect(paintedColor(getComputedStyle(caption).color)).toEqual(
    paintedToken("--muted-foreground"),
  )
  const { delta } = statParts(canvasElement, "cost")
  const change = delta!.querySelector<HTMLElement>("[data-slot=delta]")!
  await expect(paintedColor(getComputedStyle(change).color)).toEqual(
    paintedToken("--nessa-market-gain"),
  )
}

export const Light: Story = {
  globals: { theme: "light" },
  parameters: storyDocumentation(
    "Two dashboard tiles in Light: one with a meter underneath, one with a change beside its figure. The play test proves the figure is in the foreground ink and the whole and caption in the muted one.",
  ),
  render: () => <TilesExample />,
  play: async ({ canvasElement }) => expectInks(canvasElement),
}

export const Dark: Story = {
  globals: { theme: "dark" },
  parameters: storyDocumentation(
    "The same tiles in Dark; every ink is a semantic token, so the component carries no dark-mode variant.",
  ),
  render: () => <TilesExample />,
  play: async ({ canvasElement }) => expectInks(canvasElement),
}
