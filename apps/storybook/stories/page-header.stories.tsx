import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Plus } from "lucide-react"
import { Button, PageHeader } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/PageHeader",
  component: PageHeader,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The top of a page: its title in the one page-title size, and its actions at the end of the same line. No subtitle, so every page starts the same way; where the header sits is the page's own. A long title is cut with an ellipsis rather than pushing the actions off the line.",
      },
    },
  },
  args: {
    title: "Devices",
    // The docs page has its own h1, so the stories announce the title one level down.
    level: 2,
    actions: (
      <Button variant="inverse" size="30" shape="pill">
        <Plus />
        Add device
      </Button>
    ),
  },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "A title and one action. The play test proves the title is a heading, the action sits on the title's line, and nothing is drawn under the title.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const title = canvas.getByRole("heading", { name: "Devices" })
    const action = canvas.getByRole("button", { name: "Add device" })
    const header = canvasElement.querySelector<HTMLElement>('[data-slot="page-header"]')!
    await expect(header.children).toHaveLength(2)
    const titleBox = title.getBoundingClientRect()
    const actionBox = action.getBoundingClientRect()
    await expect(
      Math.abs(titleBox.top + titleBox.height / 2 - (actionBox.top + actionBox.height / 2)),
    ).toBeLessThan(1)
  },
}

export const LongTitle: Story = {
  args: {
    title: "A page whose name runs on far longer than the line it has to stand on",
  },
  parameters: storyDocumentation(
    "A title longer than its line ends in an ellipsis; the actions keep their place at the end.",
  ),
  render: (args) => (
    <div style={{ width: 320 }}>
      <PageHeader {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const title = canvasElement.querySelector<HTMLElement>('[data-slot="page-header-title"]')!
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth)
    const header = canvasElement.querySelector<HTMLElement>('[data-slot="page-header"]')!
    const actions = canvasElement.querySelector<HTMLElement>('[data-slot="page-header-actions"]')!
    await expect(actions.getBoundingClientRect().right).toBeLessThanOrEqual(
      header.getBoundingClientRect().right + 0.5,
    )
  },
}

export const TitleOnly: Story = {
  args: { title: "Settings", actions: undefined },
  parameters: storyDocumentation("Without actions, the header is the title alone."),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="page-header-actions"]')).toBeNull()
  },
}
