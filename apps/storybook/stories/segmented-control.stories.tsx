import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { SegmentedControl, SegmentedControlOption } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A compact single-choice switcher: a bordered pill of pressed/unpressed buttons, the pattern Nessa's toolbars use for view and scale toggles (the GanttChart toolbar composes it for Day/Week/Month). One option is always selected, choosing another moves the pressed state and fires onValueChange, and the group takes an aria-label naming the choice it controls.",
      },
    },
  },
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

export const ViewSwitcher: Story = {
  parameters: storyDocumentation(
    "An uncontrolled switcher in its natural habitat: three view options with a default. The play test selects another option and proves the pressed state moved by aria-pressed and by computed background — the selected option paints the secondary surface while the rest stay transparent.",
  ),
  render: () => (
    <SegmentedControl aria-label="Calendar view" defaultValue="week">
      <SegmentedControlOption value="day">Day</SegmentedControlOption>
      <SegmentedControlOption value="week">Week</SegmentedControlOption>
      <SegmentedControlOption value="month">Month</SegmentedControlOption>
    </SegmentedControl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const week = canvas.getByRole("button", { name: "Week" })
    const month = canvas.getByRole("button", { name: "Month" })
    await expect(week).toHaveAttribute("aria-pressed", "true")
    await expect(month).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(month)
    await expect(month).toHaveAttribute("aria-pressed", "true")
    await expect(week).toHaveAttribute("aria-pressed", "false")
    await waitFor(async () => {
      const pressed = getComputedStyle(month).backgroundColor
      const idle = getComputedStyle(week).backgroundColor
      await expect(pressed).not.toBe("rgba(0, 0, 0, 0)")
      await expect(idle).not.toBe(pressed)
    })
  },
}

function ControlledDemo() {
  const [value, setValue] = React.useState("compact")
  return (
    <div className="flex flex-col items-center gap-3">
      <SegmentedControl
        aria-label="Density"
        value={value}
        onValueChange={setValue}
      >
        <SegmentedControlOption value="compact">Compact</SegmentedControlOption>
        <SegmentedControlOption value="comfortable">
          Comfortable
        </SegmentedControlOption>
      </SegmentedControl>
      <p className="text-xs text-muted-foreground">
        Density: <span data-testid="density-value">{value}</span>
      </p>
    </div>
  )
}

export const Controlled: Story = {
  parameters: storyDocumentation(
    "A controlled switcher whose host owns the value and mirrors it below. The play test clicks through both options and asserts the mirrored value tracks the selection.",
  ),
  render: () => <ControlledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Comfortable" }),
    )
    await expect(canvas.getByTestId("density-value")).toHaveTextContent(
      "comfortable",
    )
    await userEvent.click(canvas.getByRole("button", { name: "Compact" }))
    await expect(canvas.getByTestId("density-value")).toHaveTextContent(
      "compact",
    )
  },
}

export const Bare: Story = {
  parameters: storyDocumentation(
    "The `bare` shell: the same options with no strip around them, for a row already framed by its container — the range tabs inside a chart's control bar are the case it was added for. Selection reads from the pressed option alone, so the control still tells a person what is chosen without a border to sit in.",
  ),
  render: () => (
    <SegmentedControl
      variant="bare"
      aria-label="Chart range"
      defaultValue="1M"
    >
      {["1D", "1W", "1M", "1Y"].map((range) => (
        <SegmentedControlOption key={range} value={range} className="px-2.5">
          {range}
        </SegmentedControlOption>
      ))}
    </SegmentedControl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("group", { name: "Chart range" })
    // No strip: the shell contributes no border of its own.
    await expect(getComputedStyle(group).borderTopWidth).toBe("0px")
    await expect(
      canvas.getByRole("button", { name: "1M" }),
    ).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(canvas.getByRole("button", { name: "1Y" }))
    await expect(
      canvas.getByRole("button", { name: "1Y" }),
    ).toHaveAttribute("aria-pressed", "true")
  },
}
