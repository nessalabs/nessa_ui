import type { Meta, StoryObj } from "@storybook/react-vite"
import { StatusDot } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/StatusDot",
  component: StatusDot,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A small colored dot conveying run state at a glance. StatusDot is decorative by default and must sit next to a visible text label; pass an aria-label only when no visible label accompanies it.",
      },
    },
  },
  argTypes: {
    status: {
      control: "select",
      options: ["running", "success", "error", "idle"],
      description: "Selects the state color; running also pulses.",
    },
  },
  args: {
    status: "idle",
  },
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Use the controls to compare status colors. Always pair the dot with a visible text label.",
  ),
}

export const AllStatuses: Story = {
  parameters: storyDocumentation(
    "Each dot pairs with a visible label naming the state it conveys.",
  ),
  render: () => (
    <div className="flex flex-col gap-2 text-sm text-foreground">
      <span className="flex items-center gap-2">
        <StatusDot status="running" /> Running
      </span>
      <span className="flex items-center gap-2">
        <StatusDot status="success" /> Success
      </span>
      <span className="flex items-center gap-2">
        <StatusDot status="error" /> Error
      </span>
      <span className="flex items-center gap-2">
        <StatusDot status="idle" /> Idle
      </span>
    </div>
  ),
}
