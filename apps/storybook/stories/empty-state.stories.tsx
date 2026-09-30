import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@nessalabs/ui"

import { finishStoryTransitions } from "./finish-story-transitions"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/EmptyState",
  component: EmptyState,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "What a surface shows when it has nothing to show: a short title, an optional sentence of description, and an optional action, centred where the content would be. variant=\"compact\" fits it inside a card or a pane. Every word and the action are the caller's; it renders no heading, since its level depends on where it sits, and no live region.",
      },
    },
  },
  args: {
    title: "No runs yet",
    description: "Start a run and its results will collect here.",
  },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

function WithActionDemo() {
  const [started, setStarted] = React.useState(false)
  return (
    <div className="w-md rounded-xl border border-border">
      <EmptyState
        title="No runs yet"
        description="Start a run and its results will collect here."
        action={
          <Button size="sm" onClick={() => setStarted(true)}>
            {started ? "Run started" : "Start a run"}
          </Button>
        }
      />
    </div>
  )
}

export const Default: Story = {
  parameters: storyDocumentation(
    "The full-size state standing in for a panel's whole body, with an action. The play test proves the title, description and action render in order and that the action is the caller's own control.",
  ),
  render: () => <WithActionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const state = canvasElement.querySelector<HTMLElement>(
      '[data-slot="empty-state"]',
    )!
    await expect(state).toHaveAttribute("data-variant", "default")
    const slots = Array.from(state.children, (child) =>
      child.getAttribute("data-slot"),
    )
    await expect(slots).toEqual([
      "empty-state-title",
      "empty-state-description",
      "empty-state-action",
    ])
    await expect(canvas.getByText("No runs yet")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Start a run" }))
    await expect(
      canvas.getByRole("button", { name: "Run started" }),
    ).toBeVisible()
    finishStoryTransitions(canvasElement)
  },
}

export const Compact: Story = {
  parameters: storyDocumentation(
    "The compact variant inside a narrow card, with a description long enough to wrap and no action. The play test asserts the compact title sets smaller than the default one, that the description wraps inside the card rather than overflowing it, and that no action slot renders when none is given.",
  ),
  render: () => (
    <div className="flex items-start gap-4">
      <Card className="w-64 gap-2 py-4" data-testid="card">
        <CardHeader className="px-4">
          <CardTitle className="nessa-text-4">Subagents</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <EmptyState
            variant="compact"
            title="None running"
            description="Subagents this conversation starts will appear here while they work, and stay listed once they finish."
          />
        </CardContent>
      </Card>
      <div className="w-64 rounded-xl border border-border">
        <EmptyState title="Nothing here" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvas.getByTestId("card")
    const compact = card.querySelector<HTMLElement>('[data-slot="empty-state"]')!
    await expect(compact).toHaveAttribute("data-variant", "compact")
    await expect(
      compact.querySelector('[data-slot="empty-state-action"]'),
    ).toBeNull()
    const compactTitle = within(compact).getByText("None running")
    const defaultTitle = canvas.getByText("Nothing here")
    await expect(
      Number.parseFloat(getComputedStyle(compactTitle).fontSize),
    ).toBeLessThan(Number.parseFloat(getComputedStyle(defaultTitle).fontSize))
    const description = compact.querySelector<HTMLElement>(
      '[data-slot="empty-state-description"]',
    )!
    await expect(description.scrollWidth).toBeLessThanOrEqual(
      description.clientWidth,
    )
    await expect(description.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right,
    )
  },
}
