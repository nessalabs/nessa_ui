import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A styled native input for text entry. Input preserves native HTML attributes and shadcn conventions while applying Nessa tokens for border, focus, disabled, and invalid states. Always pair it with a visible label; placeholders are examples, not labels.",
      },
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Associate a visible label with the input using matching `htmlFor` and `id` values.",
  ),
  render: () => (
    <div className="grid w-80 gap-2">
      <label className="text-sm font-medium" htmlFor="story-email">
        Email address
      </label>
      <Input id="story-email" type="email" placeholder="name@example.com" />
    </div>
  ),
}

export const Invalid: Story = {
  parameters: storyDocumentation(
    "Set `aria-invalid` and connect specific error text with `aria-describedby`.",
  ),
  render: () => (
    <div className="grid w-80 gap-2">
      <label className="text-sm font-medium" htmlFor="invalid-story-email">
        Email address
      </label>
      <Input
        id="invalid-story-email"
        type="email"
        aria-invalid="true"
        aria-describedby="invalid-story-email-error"
        defaultValue="not-an-email"
      />
      <p id="invalid-story-email-error" className="text-sm text-destructive">
        Enter a valid email address.
      </p>
    </div>
  ),
}
