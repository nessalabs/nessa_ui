import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "@nessa-ui/react"

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs", "test"],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
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

