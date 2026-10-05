import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { Switch } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Switch",
  component: Switch,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "An on/off setting that takes effect at once: a `role=\"switch\"` button, so Space and Enter turn it and assistive technology reads it as on or off. Controlled with `checked` and `onCheckedChange`, or uncontrolled with `defaultChecked`. Inside a `SettingsRow` it takes the row's label as its name; elsewhere give it an `aria-label`. Use `Checkbox` for a choice submitted with a form.",
      },
    },
  },
  args: { onCheckedChange: fn(), disabled: false },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "An uncontrolled switch. The play test turns it by pointer and by keyboard and proves the state and the callback follow.",
  ),
  render: (args) => <Switch aria-label="Allow linking" {...args} />,
  play: async ({ canvasElement, args }) => {
    const control = within(canvasElement).getByRole("switch", { name: "Allow linking" })
    await expect(control).toHaveAttribute("aria-checked", "false")
    await userEvent.click(control)
    await expect(control).toHaveAttribute("aria-checked", "true")
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true)
    control.focus()
    await userEvent.keyboard(" ")
    await expect(control).toHaveAttribute("aria-checked", "false")
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(false)
  },
}

function ControlledExample() {
  const [on, setOn] = React.useState(true)
  return (
    <div className="flex items-center gap-3">
      <Switch aria-label="Controlled" checked={on} onCheckedChange={setOn} />
      <span data-testid="value">{on ? "On" : "Off"}</span>
    </div>
  )
}

export const Controlled: Story = {
  parameters: storyDocumentation(
    "A controlled switch: the host's state is the source of truth. The play test proves a click goes through the host.",
  ),
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const control = canvas.getByRole("switch", { name: "Controlled" })
    await expect(control).toHaveAttribute("aria-checked", "true")
    await userEvent.click(control)
    await expect(control).toHaveAttribute("aria-checked", "false")
    await expect(canvas.getByTestId("value")).toHaveTextContent("Off")
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
  parameters: storyDocumentation(
    "A disabled switch keeps its state and does not turn. The play test proves a click changes nothing.",
  ),
  render: (args) => <Switch aria-label="Locked" {...args} />,
  play: async ({ canvasElement, args }) => {
    const control = within(canvasElement).getByRole("switch", { name: "Locked" })
    await expect(control).toBeDisabled()
    await userEvent.click(control, { pointerEventsCheck: 0 })
    await expect(control).toHaveAttribute("aria-checked", "true")
    await expect(args.onCheckedChange).not.toHaveBeenCalled()
  },
}
