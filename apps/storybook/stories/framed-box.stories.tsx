import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { FramedBox, Meter, StatTile } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/FramedBox",
  component: FramedBox,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A btop-style console panel: a hairline border with the lowercase mono title sitting in the border line, plus an optional right-side annotation cut into the same line — the place for a live aside like `up 14h`. The box owns a card surface by default and the in-border chips inherit it, so overriding the surface (`className=\"bg-background\"`) keeps the border gaps clean as long as the background stays opaque. The box is a labelled group, announced by its title.",
      },
    },
  },
  args: {
    title: "cpu",
    children: null,
  },
} satisfies Meta<typeof FramedBox>

export default meta
type Story = StoryObj<typeof meta>

export const CpuPanel: Story = {
  parameters: storyDocumentation(
    "The worktree dashboard's cpu panel: the title sits in the border line with the uptime annotation at the other end, and the body holds per-service meter rows. The values ride in the row text — the box only provides the frame.",
  ),
  render: () => (
    <div className="w-96">
      <FramedBox title="cpu" annotation="up 14h">
        <div className="flex flex-col gap-1.5 px-3 pt-1 pb-3 font-mono nessa-text-2">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-medium">CPU</span>
            <Meter fraction={0.43} />
            <span className="w-10 shrink-0 text-end tabular-nums">43%</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-16 shrink-0">gateway</span>
            <Meter fraction={0.35} slot={1} />
            <span className="w-10 shrink-0 text-end tabular-nums">35%</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-16 shrink-0">indexer</span>
            <Meter fraction={0.85} slot={2} />
            <span className="w-10 shrink-0 text-end tabular-nums">85%</span>
          </div>
        </div>
      </FramedBox>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The in-border title is the box's accessible name.
    const box = canvas.getByRole("group", { name: "cpu" })
    await expect(box).toBeVisible()

    // Title and annotation both sit in the border line and inherit the
    // box's surface, so the border gap under them stays clean.
    const title = box.querySelector('[data-slot="framed-box-title"]')
    await expect(title).toHaveClass("lowercase")
    await expect(title).toHaveClass("bg-inherit")
    await expect(canvas.getByText("up 14h")).toHaveClass("bg-inherit")

    // The box carries its own card surface by default.
    await expect(box).toHaveClass("bg-card")
  },
}

export const ConsoleGrid: Story = {
  parameters: storyDocumentation(
    "Panels compose into the full console: each box is its own labelled group, an annotation appears only where there is a live aside to show, and other primitives — stat tiles here — drop into the body unchanged.",
  ),
  render: () => (
    <div className="grid w-[40rem] grid-cols-2 gap-4">
      <FramedBox title="proc" annotation="4 services">
        <div className="flex flex-col gap-1 px-3 pt-1 pb-3 font-mono nessa-text-2 text-muted-foreground">
          <span>gateway 1a2b3c4 running</span>
          <span>indexer 5d6e7f8 running</span>
          <span>postgres 9a0b1c2 running</span>
          <span>redis 3d4e5f6 running</span>
        </div>
      </FramedBox>
      <FramedBox title="db">
        <div className="grid grid-cols-2 gap-2 px-3 pt-1 pb-3">
          <StatTile label="Size" value="412 MB" />
          <StatTile label="Seeded" value="2h ago" tone="ok" />
        </div>
      </FramedBox>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Each panel is announced by its own in-border title.
    await expect(canvas.getByRole("group", { name: "proc" })).toBeVisible()
    const db = canvas.getByRole("group", { name: "db" })
    await expect(db).toBeVisible()

    // No annotation prop, no annotation chip.
    await expect(
      db.querySelector('[data-slot="framed-box-annotation"]'),
    ).toBeNull()

    // Composed primitives render inside the frame untouched.
    await expect(within(db).getByText("412 MB")).toBeVisible()
  },
}
