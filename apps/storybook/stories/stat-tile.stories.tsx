import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { StatTile } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/StatTile",
  component: StatTile,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "The console's signature data cell: an uppercase micro-label over a mono value inside a hairline box, with an optional hint line beneath. Values truncate instead of wrapping, so a grid of tiles keeps one height regardless of content. The optional `tone` paints the value with semantic ink — `ok` in the diff-addition green, `warn` in the destructive red — and should stay the exception: a wall of colored values stops reading as signal.",
      },
    },
  },
  args: {
    label: "Databases",
    value: 12,
  },
} satisfies Meta<typeof StatTile>

export default meta
type Story = StoryObj<typeof meta>

export const FleetTotals: Story = {
  parameters: storyDocumentation(
    "Canopy's Command Center header: one tile per fleet total. Neutral tiles carry plain facts, the healthy seed pipeline earns the `ok` green, and the two failing worktrees earn `warn` — the only two colored values in the row, so they are the two you see first.",
  ),
  render: () => (
    <div className="grid w-[36rem] grid-cols-4 gap-2">
      <StatTile label="Databases" value={12} />
      <StatTile label="Worktrees" value={7} hint="3 with agents" />
      <StatTile label="Seeds" value="fresh" hint="42m ago" tone="ok" />
      <StatTile label="Failing" value={2} hint="pg-shard-2, redis" tone="warn" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Labels render as text (uppercasing is presentation, so assistive
    // technology reads the natural casing).
    await expect(canvas.getByText("Databases")).toBeVisible()
    await expect(canvas.getByText("3 with agents")).toBeVisible()

    // Tones ride the semantic inks: ok wears the diff-addition green,
    // warn the destructive red, and neutral tiles wear neither.
    await expect(canvas.getByText("fresh")).toHaveClass(
      "text-(--nessa-diff-addition)",
    )
    await expect(canvas.getByText("2")).toHaveClass("text-destructive")
    const neutralValue = canvas.getByText("12")
    await expect(neutralValue).not.toHaveClass("text-(--nessa-diff-addition)")
    await expect(neutralValue).not.toHaveClass("text-destructive")
  },
}

export const DatabaseFacts: Story = {
  parameters: storyDocumentation(
    "The per-database fact strip from the worktree dashboard: migration state in the `ok` green with its hint marking it current, and the remaining tiles neutral. Long values — a fork source, a migration name — truncate with an ellipsis instead of reflowing the strip.",
  ),
  render: () => (
    <div className="grid w-[30rem] grid-cols-3 gap-2">
      <StatTile
        label="Migrations"
        value="0042_add_worktree_index"
        hint="current"
        tone="ok"
      />
      <StatTile label="Size" value="412 MB" />
      <StatTile label="Seeded" value="2h ago" hint="from prod-replica" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const tiles = canvasElement.querySelectorAll('[data-slot="stat-tile"]')
    await expect(tiles).toHaveLength(3)

    // The hint is the fine-print third line, in muted ink under the value.
    await expect(canvas.getByText("from prod-replica")).toHaveClass(
      "text-muted-foreground",
    )

    // Values keep to a single truncating mono line.
    const value = canvas.getByText("0042_add_worktree_index")
    await expect(value).toHaveClass("truncate")
    await expect(value).toHaveClass("font-mono")

    // A tile without a hint renders no empty hint line.
    const sizeTile = canvas.getByText("Size").closest('[data-slot="stat-tile"]')
    await expect(
      sizeTile?.querySelector('[data-slot="stat-tile-hint"]'),
    ).toBeNull()
  },
}
