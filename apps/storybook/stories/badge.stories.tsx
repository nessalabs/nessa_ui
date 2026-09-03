import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Badge",
  component: Badge,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A compact, non-interactive label for status, category, or metadata. Badge follows the shadcn composition model and uses Nessa semantic color tokens. Keep labels short; use Button when the element performs an action.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "destructive"],
      description: "Controls the label's semantic emphasis.",
    },
    asChild: {
      description:
        "Merges Badge behavior and styles onto its single child element.",
    },
  },
  args: {
    children: "New",
    variant: "default",
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Use the controls to compare Badge variants while keeping the label short and non-interactive.",
  ),
}

export const AllVariants: Story = {
  parameters: storyDocumentation(
    "Choose the least emphatic variant that still communicates the status.",
  ),
  render: () => (
    <div className="flex items-center gap-3">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  ),
}
