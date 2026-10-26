import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { GradientText } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/GradientText",
  component: GradientText,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Text painted with one gradient running across all of it, standing still: TypeIn's wordmark look without the typing, in the same colours by default. It stays real text, read and selected as written. For a word or two, such as the name in a welcome heading.",
      },
    },
  },
  args: { children: "Nessa" },
  render: (args) => (
    <h1 className="nessa-text-1 font-semibold">
      Welcome to <GradientText {...args} />
    </h1>
  ),
} satisfies Meta<typeof GradientText>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "A name in a heading. The play test proves the text is all there at once, clipped to the gradient, with nothing animating.",
  ),
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLElement>('[data-slot="gradient-text"]')!
    await expect(name.textContent).toBe("Nessa")
    await expect(canvasElement.querySelector("h1")!.textContent).toBe("Welcome to Nessa")
    await expect(getComputedStyle(name).backgroundClip).toBe("text")
    await expect(getComputedStyle(name).backgroundImage).toContain("linear-gradient")
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0)
  },
}

export const Colors: Story = {
  args: { colors: ["#4b6cf0", "#e2457a"] },
  parameters: storyDocumentation("`colors` paints it with any colours, left to right."),
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLElement>('[data-slot="gradient-text"]')!
    await expect(getComputedStyle(name).backgroundImage).toBe(
      "linear-gradient(90deg, rgb(75, 108, 240), rgb(226, 69, 122))",
    )
  },
}
