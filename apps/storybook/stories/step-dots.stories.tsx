import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Button, StepDots } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/StepDots",
  component: StepDots,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Where a short, fixed sequence is up to, as a row of dots with the current one drawn long. It is a picture of progress rather than a control: it reads as “Step 2 of 3” and no dot can be pressed. Drawn in the current text colour.",
      },
    },
  },
  args: { count: 3, current: 1 },
} satisfies Meta<typeof StepDots>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation("Three steps, on the second. Edit `count` and `current` to try others."),
  play: async ({ canvasElement }) => {
    const dots = within(canvasElement).getByRole("img", { name: "Step 2 of 3" })
    await expect(dots.querySelectorAll("[data-current]")).toHaveLength(1)
  },
}

function Walk() {
  const [current, setCurrent] = React.useState(0)
  return (
    <div className="flex items-center gap-4 text-foreground">
      <StepDots count={3} current={current} />
      <Button size="sm" variant="outline" onClick={() => setCurrent((step) => (step + 1) % 3)}>
        Next
      </Button>
    </div>
  )
}

export const Walking: Story = {
  parameters: storyDocumentation(
    "The long dot moves on with each step. The play test steps through and checks the name and the long dot's width follow.",
  ),
  render: () => <Walk />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Next" }))
    const dots = canvas.getByRole("img", { name: "Step 2 of 3" })
    const second = dots.children[1] as HTMLElement
    await waitFor(() =>
      expect(second.getBoundingClientRect().width).toBeGreaterThan(
        (dots.children[0] as HTMLElement).getBoundingClientRect().width * 2,
      ),
    )
  },
}
