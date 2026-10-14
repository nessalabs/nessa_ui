import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Kbd } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Kbd",
  component: Kbd,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A key, or a chord written as one cap — `⌘K`, `Esc`, `⇧⌘P` — as a menu, a field or a tooltip shows it. It renders the `<kbd>` element and binds nothing; the host owns the key.",
      },
    },
  },
  args: { children: "⌘K" },
} satisfies Meta<typeof Kbd>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation("One key cap. Edit the children to try another key."),
}

export const InText: Story = {
  parameters: storyDocumentation(
    "Key caps sit on the line of the text around them. The play test proves each is a `<kbd>` and no taller than the line.",
  ),
  render: () => (
    <p className="m-0 font-sans nessa-text-3 text-muted-foreground">
      Press <Kbd>⌘K</Kbd> to search, <Kbd>Esc</Kbd> to close, or <Kbd>⇧⌘P</Kbd> for commands.
    </p>
  ),
  play: async ({ canvasElement }) => {
    const caps = canvasElement.querySelectorAll("kbd")
    await expect(caps).toHaveLength(3)
    const line = within(canvasElement).getByText(/to search/).getBoundingClientRect().height
    for (const cap of caps) await expect(cap.getBoundingClientRect().height).toBeLessThanOrEqual(line)
  },
}
