import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "@nessa-ui/react"
import { ArrowRight, Plus } from "lucide-react"

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "The primary action primitive for Nessa interfaces. Button is built on the shadcn/Radix composition model, supports semantic variants and sizes, and can render another element through `asChild`. Use one primary action per decision area and reserve `destructive` for irreversible outcomes.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "link", "destructive"],
      description: "Controls the action's semantic emphasis.",
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg", "icon"],
      description: "Controls the button's height and horizontal padding.",
    },
    asChild: {
      description:
        "Merges Button behavior and styles onto its single child element.",
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
  parameters: {
    docs: {
      description: {
        story: "Place a quiet 16px icon after the label when it reinforces the action.",
      },
    },
  },
  render: () => (
    <Button>
      Continue
      <ArrowRight />
    </Button>
  ),
}

export const IconOnly: Story = {
  parameters: {
    docs: {
      description: {
        story: "Icon-only buttons require an accessible name through `aria-label`.",
      },
    },
  },
  render: () => (
    <Button size="icon" aria-label="Create item">
      <Plus />
    </Button>
  ),
}

export const AllVariants: Story = {
  parameters: {
    docs: {
      description: {
        story: "Semantic variants establish hierarchy without changing the component API.",
      },
    },
  },
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
