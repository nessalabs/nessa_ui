import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Meter } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Meter",
  component: Meter,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A compact horizontal fraction meter in the console idiom: the filled share paints in a categorical chart-slot color (`slot` 1–6, the same fixed `--nessa-chart-*` mapping StackedBarChart uses) or the neutral foreground when no slot is given, over a recessive border-ink track. `dotted` (default) repeats btop-style dots, `solid` draws a continuous rounded bar. The meter is decorative and hidden from assistive technology — it never carries text, so always pair it with the value it visualizes in an adjacent element.",
      },
    },
  },
  args: {
    fraction: 0.5,
  },
} satisfies Meta<typeof Meter>

export default meta
type Story = StoryObj<typeof meta>

const cpuRows = [
  { name: "gateway", slot: 1, fraction: 0.35, reading: "35%" },
  { name: "indexer", slot: 2, fraction: 0.85, reading: "85%" },
  { name: "postgres", slot: 3, fraction: 0.1, reading: "10%" },
] as const

export const CpuPanel: Story = {
  parameters: storyDocumentation(
    "Canopy's per-service CPU rows: a neutral total meter on top, then one dotted meter per service in that service's fixed chart slot — the same slot its series holds in the history chart, so the two read as one visualization. Every value rides in the adjacent mono text; the meters themselves are aria-hidden decoration.",
  ),
  render: () => (
    <div className="flex w-80 flex-col gap-1.5 font-mono nessa-text-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 font-medium">CPU</span>
        <Meter fraction={0.43} />
        <span className="w-10 shrink-0 text-end tabular-nums">43%</span>
      </div>
      {cpuRows.map((row) => (
        <div
          key={row.name}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <span className="w-16 shrink-0">{row.name}</span>
          <Meter fraction={row.fraction} slot={row.slot} />
          <span className="w-10 shrink-0 text-end tabular-nums">
            {row.reading}
          </span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Decorative: every meter is hidden from assistive technology, and the
    // readings live in the adjacent text.
    const meters = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="meter"]',
    )
    await expect(meters).toHaveLength(4)
    for (const meter of meters) {
      await expect(meter).toHaveAttribute("aria-hidden", "true")
    }
    await expect(canvas.getByText("43%")).toBeVisible()

    // The total row is the neutral default; each service meter injects its
    // fixed chart-slot color, in declaration order.
    await expect(meters[0]).toHaveClass("[--nessa-meter-fill:var(--foreground)]")
    await expect(meters[1]).toHaveClass(
      "[--nessa-meter-fill:var(--nessa-chart-1)]",
    )
    await expect(meters[3]).toHaveClass(
      "[--nessa-meter-fill:var(--nessa-chart-3)]",
    )

    // The fill's width is the fraction; the indexer meter sits at 85%.
    const indexerFill = meters[2]!.querySelector<HTMLElement>(
      '[data-slot="meter-fill"]',
    )
    await expect(parseFloat(indexerFill!.style.width)).toBeCloseTo(85, 5)
  },
}

export const SolidVariant: Story = {
  parameters: storyDocumentation(
    "The solid variant trades the dots for a continuous rounded bar — same footprint, same slot colors — for surfaces where the dotted texture would fight the surrounding chrome, like memory bars inside a stat strip.",
  ),
  render: () => (
    <div className="flex w-80 flex-col gap-1.5 font-mono nessa-text-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0">heap</span>
        <Meter variant="solid" fraction={0.62} slot={4} />
        <span className="w-16 shrink-0 text-end tabular-nums">1.2 GiB</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0">rss</span>
        <Meter variant="solid" fraction={0.25} slot={5} />
        <span className="w-16 shrink-0 text-end tabular-nums">498 MiB</span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const meters = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="meter"]',
    )
    await expect(meters).toHaveLength(2)
    await expect(meters[0]).toHaveAttribute("data-variant", "solid")

    // Solid paints the slot color as a continuous bar instead of the
    // repeating dot gradient.
    const fill = meters[0]!.querySelector<HTMLElement>(
      '[data-slot="meter-fill"]',
    )
    await expect(fill).toHaveClass("bg-(--nessa-meter-fill)")
    await expect(fill).toHaveClass("rounded-full")
    await expect(parseFloat(fill!.style.width)).toBeCloseTo(62, 5)
  },
}

export const ClampedReadings: Story = {
  parameters: storyDocumentation(
    "Out-of-range data cannot break the box: an over-budget reading pins the meter full, a negative or non-finite one pins it empty, and the honest number stays in the adjacent text — here a service reporting 140% of its CPU budget.",
  ),
  render: () => (
    <div className="flex w-80 flex-col gap-1.5 font-mono nessa-text-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0">runaway</span>
        <Meter fraction={1.4} slot={2} />
        <span className="w-10 shrink-0 text-end tabular-nums">140%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0">idle</span>
        <Meter fraction={-0.2} slot={3} />
        <span className="w-10 shrink-0 text-end tabular-nums">0%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0">no data</span>
        <Meter fraction={Number.NaN} slot={4} />
        <span className="w-10 shrink-0 text-end tabular-nums">—</span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const fills = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="meter-fill"]',
    )
    await expect(fills).toHaveLength(3)
    await expect(fills[0]!.style.width).toBe("100%")
    await expect(fills[1]!.style.width).toBe("0%")
    await expect(fills[2]!.style.width).toBe("0%")
  },
}
