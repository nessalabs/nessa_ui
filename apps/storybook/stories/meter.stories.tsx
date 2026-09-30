import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Button, Meter, type MeterProps } from "@nessalabs/ui"

import { finishStoryTransitions } from "./finish-story-transitions"
import { paintedColor, paintedToken, relativeLuminance } from "./story-colors"
import { storyDocumentation } from "./story-documentation"

/**
 * The labelled form of the props, which the controls drive. A meter named by
 * `aria-labelledby` needs a caption beside it, so those stories render their
 * own.
 */
type MeterArgs = Extract<MeterProps, { label: string }>

const meta = {
  title: "Primitives/Meter",
  component: Meter,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A thin track filled to a fraction: how much of something is used, done, or spent. `value` is a fraction from 0 to 1 — clamped, with `NaN` read as empty — and `label` is the accessible name, since the meter draws no text of its own — or pass `aria-labelledby` to name it by a visible caption instead. It is exposed as `role=\"meter\"` with its value as a percentage, or as `valueText` when the host says it better (\"5 of 14\"). `tone` fills it in the foreground ink (`neutral`) or in `--nessa-market-gain` / `--nessa-market-loss` (`good`, `bad`), the pair Delta and StatusLabel use, borrowed until a status colour role exists. The fill glides to a new value on the slow motion token and jumps there under reduced motion; it never animates on mount, and it fills from the inline start of its nearest direction, so right-to-left scopes fill from the right. The track stretches to its container.",
      },
    },
  },
  args: {
    value: 0.36,
    label: "Storage used",
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
    tone: { control: "select", options: ["neutral", "good", "bad"] },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<MeterArgs>

export default meta
type Story = StoryObj<typeof meta>

/** The track and fill of the meter named `name`. */
function meterParts(canvasElement: HTMLElement, name: string) {
  const meter = within(canvasElement).getByRole("meter", { name })
  const fill = meter.querySelector<HTMLElement>("[data-slot=meter-fill]")
  if (!fill) throw new Error(`Meter ${name} has no fill.`)
  return { meter, fill }
}

/** How far the fill reaches across its track, 0–1. */
function filledShare(meter: HTMLElement, fill: HTMLElement) {
  return fill.getBoundingClientRect().width / meter.getBoundingClientRect().width
}

export const Playground: Story = {
  parameters: storyDocumentation(
    "Drag the value control to move the fill. The play test proves the meter is named by its label and exposes the value as a percentage, and that the fill reaches the matching share of the track.",
  ),
  play: async ({ canvasElement }) => {
    const { meter, fill } = meterParts(canvasElement, "Storage used")
    await expect(meter).toHaveAttribute("aria-valuemin", "0")
    await expect(meter).toHaveAttribute("aria-valuemax", "100")
    await expect(meter).toHaveAttribute("aria-valuenow", "36")
    await expect(meter).not.toHaveAttribute("aria-valuetext")
    await expect(filledShare(meter, fill)).toBeCloseTo(0.36, 2)
    // Mounting draws the value where it is; nothing was left animating.
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0)
  },
}

export const EdgeValues: Story = {
  parameters: storyDocumentation(
    "Empty, full, and the values a host should never send but sometimes will: below 0, above 1, and `NaN`. Out-of-range values clamp to the nearest end and `NaN` reads as empty, so a bad reading draws a plausible bar rather than an overflowing or missing one.",
  ),
  render: () => (
    <div className="flex flex-col gap-3">
      <Meter value={0} label="Empty" />
      <Meter value={1} label="Full" />
      <Meter value={-0.25} label="Below zero" />
      <Meter value={1.4} label="Above one" />
      <Meter value={Number.NaN} label="Not a number" />
      <Meter value={0.07} label="Seven percent" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cases = [
      ["Empty", "0", 0],
      ["Full", "100", 1],
      ["Below zero", "0", 0],
      ["Above one", "100", 1],
      ["Not a number", "0", 0],
      // 0.07 × 100 is 7.000000000000001 in floating point; the meter rounds
      // it before a screen reader can say so.
      ["Seven percent", "7", 0.07],
    ] as const
    for (const [name, now, share] of cases) {
      const { meter, fill } = meterParts(canvasElement, name)
      await expect(meter).toHaveAttribute("aria-valuenow", now)
      await expect(filledShare(meter, fill)).toBeCloseTo(share, 2)
    }
  },
}

export const ValueText: Story = {
  parameters: storyDocumentation(
    "When a percentage is not how the host would say it, `valueText` is what assistive technology announces instead — here the count the bar stands for.",
  ),
  args: { value: 5 / 14, label: "Tasks done", valueText: "5 of 14" },
  play: async ({ canvasElement }) => {
    const { meter } = meterParts(canvasElement, "Tasks done")
    await expect(meter).toHaveAttribute("aria-valuetext", "5 of 14")
    await expect(meter).toHaveAttribute("aria-valuenow", "35.71")
  },
}

export const LabelledByCaption: Story = {
  parameters: storyDocumentation(
    "When a visible caption already says what is measured, name the meter by it with `aria-labelledby` instead of writing the same words again in `label`.",
  ),
  render: () => (
    <div className="flex flex-col gap-1.5">
      <span id="meter-caption" className="nessa-text-2 text-muted-foreground">
        Seats filled
      </span>
      <Meter value={0.7} aria-labelledby="meter-caption" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole("meter", { name: "Seats filled" })
    await expect(meter).not.toHaveAttribute("aria-label")
    await expect(meter).toHaveAttribute("aria-valuenow", "70")
  },
}

const tones = ["neutral", "good", "bad"] as const
const toneTokens = {
  neutral: "--foreground",
  good: "--nessa-market-gain",
  bad: "--nessa-market-loss",
} as const

/** Asserts every tone fills in its token over a quieter track. */
async function expectTonesPaint(canvasElement: HTMLElement) {
  for (const tone of tones) {
    const { meter, fill } = meterParts(canvasElement, `${tone} tone`)
    await expect(meter).toHaveAttribute("data-tone", tone)
    await expect(paintedColor(getComputedStyle(fill).backgroundColor)).toEqual(
      paintedToken(toneTokens[tone]),
    )
  }
}

function TonesExample() {
  return (
    <div className="flex flex-col gap-3">
      {tones.map((tone) => (
        <Meter key={tone} value={0.62} tone={tone} label={`${tone} tone`} />
      ))}
    </div>
  )
}

export const Light: Story = {
  globals: { theme: "light" },
  parameters: storyDocumentation(
    "The three tones in Light. The play test proves each fill paints its own token, and that the neutral fill is the dark foreground ink over a pale track.",
  ),
  render: () => <TonesExample />,
  play: async ({ canvasElement }) => {
    await expectTonesPaint(canvasElement)
    const { meter, fill } = meterParts(canvasElement, "neutral tone")
    await expect(
      relativeLuminance(getComputedStyle(fill).backgroundColor),
    ).toBeLessThan(0.05)
    await expect(
      getComputedStyle(meter).backgroundColor,
    ).not.toBe(getComputedStyle(fill).backgroundColor)
  },
}

export const Dark: Story = {
  globals: { theme: "dark" },
  parameters: storyDocumentation(
    "The same tones in Dark: every colour comes from a semantic token, so the neutral fill turns to the light foreground ink with no dark-mode variant in the component.",
  ),
  render: () => <TonesExample />,
  play: async ({ canvasElement }) => {
    await expectTonesPaint(canvasElement)
    const { fill } = meterParts(canvasElement, "neutral tone")
    await expect(
      relativeLuminance(getComputedStyle(fill).backgroundColor),
    ).toBeGreaterThan(0.8)
  },
}

export const RightToLeft: Story = {
  parameters: storyDocumentation(
    "Inside a right-to-left scope the meter fills from the right, its inline start, with the same rounded leading edge — and a left-to-right island inside that scope fills from the left again. The fill is placed with logical insets, so it follows the nearest direction rather than any right-to-left ancestor.",
  ),
  render: () => (
    <div dir="rtl" className="flex flex-col gap-3">
      <Meter value={0.3} label="Right to left" />
      <div dir="ltr">
        <Meter value={0.3} label="Left to right island" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rtl = meterParts(canvasElement, "Right to left")
    const rtlTrack = rtl.meter.getBoundingClientRect()
    const rtlBar = rtl.fill.getBoundingClientRect()
    await expect(rtlBar.right).toBeCloseTo(rtlTrack.right, 0)
    await expect(rtlBar.left).toBeCloseTo(rtlTrack.left + rtlTrack.width * 0.7, 0)

    const ltr = meterParts(canvasElement, "Left to right island")
    const ltrTrack = ltr.meter.getBoundingClientRect()
    const ltrBar = ltr.fill.getBoundingClientRect()
    await expect(ltrBar.left).toBeCloseTo(ltrTrack.left, 0)
    await expect(ltrBar.right).toBeCloseTo(ltrTrack.left + ltrTrack.width * 0.3, 0)
  },
}

function AdvancingMeter() {
  const [value, setValue] = React.useState(0.2)
  return (
    // A scope that stretches the slow token to 4s, so the ordinary project
    // can catch the glide in flight however loaded the machine is. Under
    // reduced motion this override outranks the token's 0ms, which is what
    // the meter's own motion-reduce rule is for.
    <div className="flex flex-col items-start gap-3 [--nessa-motion-duration-slow:4s]">
      <Meter value={value} label="Upload" />
      <Button size="sm" variant="outline" onClick={() => setValue(0.8)}>
        Advance
      </Button>
    </div>
  )
}

export const Motion: Story = {
  // Transition timing is engine-shaped: the glide is proven in Firefox and
  // WebKit too, not only in Chromium.
  tags: ["cross-engine", "reduced-motion"],
  parameters: storyDocumentation(
    "A new value glides into place on the slow motion token; this story stretches the token to 4s so the glide can be caught in flight. Under reduced motion the fill jumps: the reduced-motion project proves Nessa zeroes the token at the root, that the meter drops its transition even inside a scope that overrode the token, and that the new value is drawn at once. The ordinary project proves the glide is running mid-way, settles it, and leaves nothing running.",
  ),
  render: () => <AdvancingMeter />,
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!
    const reduced = view.matchMedia("(prefers-reduced-motion: reduce)").matches
    const { meter, fill } = meterParts(canvasElement, "Upload")
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0)
    await expect(filledShare(meter, fill)).toBeCloseTo(0.2, 2)

    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Advance" }),
    )
    await waitFor(() => expect(meter).toHaveAttribute("aria-valuenow", "80"))

    if (reduced) {
      await expect(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--nessa-motion-duration-slow")
          .trim(),
      ).toBe("0ms")
      await expect(fill.getAnimations()).toHaveLength(0)
      await expect(filledShare(meter, fill)).toBeCloseTo(0.8, 2)
      // The button's own hover and focus transitions are not the meter's;
      // settle them so the story leaves nothing running.
      finishStoryTransitions(canvasElement)
    } else {
      const glide = fill
        .getAnimations()
        .find((animation) => animation instanceof CSSTransition)
      await expect(glide).toBeDefined()
      await expect(glide!.playState).toBe("running")
      await expect(filledShare(meter, fill)).toBeLessThan(0.79)
      await waitFor(() => {
        finishStoryTransitions(canvasElement)
        return expect(filledShare(meter, fill)).toBeCloseTo(0.8, 2)
      })
    }
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0)
  },
}
