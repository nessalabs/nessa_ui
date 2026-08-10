import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "@nessa-ui/react"
import { ArrowRight, Plus } from "lucide-react"

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs", "test"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "link", "destructive"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg", "icon"],
    },
  },
  args: {
    children: "Continue",
    variant: "default",
    size: "default",
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const WithIcon: Story = {
  render: () => (
    <Button>
      Continue
      <ArrowRight />
    </Button>
  ),
}

export const IconOnly: Story = {
  render: () => (
    <Button size="icon" aria-label="Create item">
      <Plus />
    </Button>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

