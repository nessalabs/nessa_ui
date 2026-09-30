import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Delta } from "@nessalabs/ui"

import { paintedColor, paintedToken } from "./story-colors"
import { storyDocumentation } from "./story-documentation"

/** The true minus sign, spelled out so a hyphen cannot pass for it. */
const MINUS = "\u2212"

/** Points to one decimal, with zero said as "±0.0". */
const points = (size: number) =>
  size === 0 ? "±0.0" : size.toFixed(1)

/** Every size the `FormatNeverSigns` story's formatter was called with. */
const formatCalls: number[] = []

/** Dollars to three decimals. */
const dollars = (size: number) => `$${size.toFixed(3)}`

const meta = {
  title: "Primitives/Delta",
  component: Delta,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A signed change in the tone its caller judged it. Delta owns how a change is written — `+` for a rise, a true minus sign (U+2212) for a fall, no sign for exactly zero — and the colour of each tone; it does not decide whether a change is good. That judgement — whether a rise is an improvement, and how large a change must be before it counts rather than being noise — belongs to the model that owns the metric, which passes the answer as `tone`: `good` in the favourable ink, `bad` in the unfavourable one, `neutral` (the default) muted. `format(size)` writes the size of the change: it is always called with the absolute value, so a caller's formatter never produces a sign, and it decides how zero reads. Pass `value` at the precision it is displayed — Delta signs what it receives. The good and bad inks are `--nessa-market-gain` and `--nessa-market-loss`, borrowed until a status colour role exists. The sign always carries the direction, so colour is never the only signal. Figures are tabular and the text size is inherited, so a Delta sits inline beside the figure it qualifies.",
      },
    },
  },
  args: {
    value: 1.8,
    tone: "good",
    format: points,
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["good", "bad", "neutral"] },
    format: { control: false },
  },
} satisfies Meta<typeof Delta>

export default meta
type Story = StoryObj<typeof meta>

/** The rendered delta whose test id is `id`. */
function deltaById(canvasElement: HTMLElement, id: string) {
  return within(canvasElement).getByTestId(id)
}

const toneTokens = {
  good: "--nessa-market-gain",
  bad: "--nessa-market-loss",
  neutral: "--muted-foreground",
} as const

/** Asserts a delta carries `tone` and paints that tone's token. */
async function expectTone(
  element: HTMLElement,
  tone: keyof typeof toneTokens,
) {
  await expect(element).toHaveAttribute("data-tone", tone)
  await expect(paintedColor(getComputedStyle(element).color)).toEqual(
    paintedToken(toneTokens[tone]),
  )
}

export const Playground: Story = {
  parameters: storyDocumentation(
    "Change the value and the tone. The play test proves a rise is written with a plus sign in the tone it was given.",
  ),
  play: async ({ canvasElement }) => {
    const delta = canvasElement.querySelector<HTMLElement>("[data-slot=delta]")!
    await expect(delta).toHaveTextContent("+1.8")
    await expectTone(delta, "good")
  },
}

export const Signs: Story = {
  parameters: storyDocumentation(
    "A rise takes a plus sign, a fall a true minus sign (U+2212, the width of the plus, not a hyphen), and a change of exactly zero — negative zero included — takes none, so `format` says how zero reads. With no `tone`, every one of them is neutral: the sign is Delta's, the judgement is not.",
  ),
  render: () => (
    <div className="flex flex-col items-end gap-1 nessa-text-4">
      <Delta data-testid="rise" value={1.8} format={points} />
      <Delta data-testid="fall" value={-0.4} format={points} />
      <Delta data-testid="zero" value={0} format={points} />
      <Delta data-testid="negative-zero" value={-0} format={points} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(deltaById(canvasElement, "rise").textContent).toBe("+1.8")
    await expect(deltaById(canvasElement, "fall").textContent).toBe(`${MINUS}0.4`)
    await expect(deltaById(canvasElement, "fall").textContent).not.toContain("-")
    await expect(deltaById(canvasElement, "zero").textContent).toBe("±0.0")
    await expect(deltaById(canvasElement, "negative-zero").textContent).toBe(
      "±0.0",
    )
    for (const id of ["rise", "fall", "zero", "negative-zero"]) {
      await expectTone(deltaById(canvasElement, id), "neutral")
    }
  },
}

export const FormatNeverSigns: Story = {
  parameters: storyDocumentation(
    "`format` is called with the size of the change, never the signed value, so the sign has exactly one owner. A formatter that would write a hyphen for a negative number — `toFixed` on its own — still produces a true minus here, because it is never handed one. The play test records every value `format` receives and proves none is negative or negative zero.",
  ),
  render: () => (
    <div className="flex flex-col items-end gap-1 nessa-text-4">
      {[-2.5, -0, 0, 3.25].map((value, index) => (
        <Delta
          key={index}
          data-testid={`naive-${index}`}
          value={value}
          format={(size) => {
            formatCalls.push(size)
            return size.toFixed(2)
          }}
        />
      ))}
    </div>
  ),
  beforeEach: () => {
    formatCalls.length = 0
  },
  play: async ({ canvasElement }) => {
    await expect(formatCalls.length).toBeGreaterThanOrEqual(4)
    for (const size of formatCalls) {
      await expect(size).toBeGreaterThanOrEqual(0)
      await expect(Object.is(size, -0)).toBe(false)
    }
    await expect(deltaById(canvasElement, "naive-0").textContent).toBe(
      `${MINUS}2.50`,
    )
    await expect(deltaById(canvasElement, "naive-1").textContent).toBe("0.00")
    await expect(deltaById(canvasElement, "naive-2").textContent).toBe("0.00")
    await expect(deltaById(canvasElement, "naive-3").textContent).toBe("+3.25")
    for (let index = 0; index < 4; index += 1) {
      await expect(
        deltaById(canvasElement, `naive-${index}`).textContent,
      ).not.toContain("-")
    }
  },
}

export const RoundBeforeSigning: Story = {
  parameters: storyDocumentation(
    "Delta signs the value it is given, not the text `format` returns, so pass the value at the precision it is shown. A raw `-0.04` shown to one decimal is a minus in front of \"0.0\"; the same change rounded first is `-0`, exactly zero, and reads the way `format` says zero reads.",
  ),
  render: () => (
    <div className="flex flex-col items-end gap-1 nessa-text-4">
      <Delta data-testid="raw" value={-0.04} format={points} />
      <Delta data-testid="rounded" value={Math.round(-0.04 * 10) / 10} format={points} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(deltaById(canvasElement, "raw").textContent).toBe(`${MINUS}0.0`)
    await expect(deltaById(canvasElement, "rounded").textContent).toBe("±0.0")
  },
}

export const RightToLeft: Story = {
  parameters: storyDocumentation(
    "In a right-to-left paragraph the sign still leads the digits. `+` and the minus sign are weak characters that would otherwise take the paragraph's direction and land after the number; Delta lays itself out left to right and isolates itself from the text around it.",
  ),
  render: () => (
    <p dir="rtl" className="m-0 nessa-text-4 text-foreground">
      النتيجة <Delta data-testid="rtl" value={1.8} tone="good" format={points} /> نقطة
    </p>
  ),
  play: async ({ canvasElement }) => {
    const delta = deltaById(canvasElement, "rtl")
    await expect(delta).toHaveAttribute("dir", "ltr")
    const text = delta.firstChild!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 1)
    const sign = range.getBoundingClientRect()
    range.setStart(delta.lastChild!, 0)
    range.setEnd(delta.lastChild!, 1)
    const firstDigit = range.getBoundingClientRect()
    await expect(sign.right).toBeLessThanOrEqual(firstDigit.left + 0.5)
  },
}

export const ToneIsTheCallers: Story = {
  parameters: storyDocumentation(
    "The sign and the tone are independent. A lower cost is a fall its caller calls good; a higher one a rise its caller calls bad; a small move the caller judged noise stays neutral whichever way it went. Delta draws each as told.",
  ),
  render: () => (
    <div className="flex flex-col items-end gap-1 nessa-text-4">
      <Delta data-testid="cheaper" value={-0.012} tone="good" format={dollars} />
      <Delta data-testid="dearer" value={0.004} tone="bad" format={dollars} />
      <Delta data-testid="noise" value={-0.3} tone="neutral" format={points} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cheaper = deltaById(canvasElement, "cheaper")
    const dearer = deltaById(canvasElement, "dearer")
    const noise = deltaById(canvasElement, "noise")
    await expect(cheaper.textContent).toBe(`${MINUS}$0.012`)
    await expect(dearer.textContent).toBe("+$0.004")
    await expect(noise.textContent).toBe(`${MINUS}0.3`)
    await expectTone(cheaper, "good")
    await expectTone(dearer, "bad")
    await expectTone(noise, "neutral")
  },
}

function TonesExample() {
  return (
    <p className="m-0 flex items-baseline gap-4 nessa-text-4 text-foreground">
      <span>
        71.6 <Delta data-testid="good" value={1.8} tone="good" format={points} />
      </span>
      <span>
        69.4 <Delta data-testid="bad" value={-0.4} tone="bad" format={points} />
      </span>
      <span>
        69.8 <Delta data-testid="neutral" value={0.1} format={points} />
      </span>
    </p>
  )
}

/** Asserts all three tones paint their tokens in tabular figures. */
async function expectTonesPaint(canvasElement: HTMLElement) {
  for (const tone of ["good", "bad", "neutral"] as const) {
    const delta = deltaById(canvasElement, tone)
    await expectTone(delta, tone)
    await expect(getComputedStyle(delta).fontVariantNumeric).toBe("tabular-nums")
  }
}

export const Light: Story = {
  globals: { theme: "light" },
  parameters: storyDocumentation(
    "Good, bad, and neutral inline beside the figures they qualify, in Light. The play test proves each paints its token and sets tabular figures.",
  ),
  render: () => <TonesExample />,
  play: async ({ canvasElement }) => expectTonesPaint(canvasElement),
}

export const Dark: Story = {
  globals: { theme: "dark" },
  parameters: storyDocumentation(
    "The same line in Dark, where the change inks lighten to hold contrast on the dark surface — a token change, not a component one.",
  ),
  render: () => <TonesExample />,
  play: async ({ canvasElement }) => expectTonesPaint(canvasElement),
}
