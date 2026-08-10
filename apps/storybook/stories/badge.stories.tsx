import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "@nessa-ui/react"

const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs", "test"],
  args: {
    children: "New",
    variant: "default",
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  ),
}

