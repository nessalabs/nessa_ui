import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Input } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Input",
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
  // Cross-engine: :focus-visible matching on editable fields, which engines differ on.
  tags: ["cross-engine"],
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole("textbox", { name: "Email address" })
    await expect(field).toHaveAttribute("aria-invalid", "true")
    await expect(field).toHaveAccessibleDescription("Enter a valid email address.")

    // The reason this story is worth running on three engines. Engines differ
    // on when an editable field matches `:focus-visible` — several match it
    // for pointer focus too, which is why Nessa's fields draw no ring of their
    // own and let the row around them own the treatment. Reaching the field by
    // keyboard must match on all of them; the assertion is the selector, not a
    // rendered pixel, so it says the same thing everywhere.
    await userEvent.tab()
    await expect(field).toHaveFocus()
    await expect(field.matches(":focus-visible")).toBe(true)
  },
}
