import type { Meta, StoryObj } from "@storybook/react-vite"
import { Globe } from "lucide-react"
import { expect, waitFor } from "storybook/test"
import { Favicon } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Favicon",
  component: Favicon,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A site's own icon beside a link to it. It is asked for lazily from the site's `/favicon.ico`, without a referrer, and shows only once it has loaded; until then, and wherever it cannot load, the `fallback` stands in its place. Links that are not web pages on a named host (`mailto:`, `localhost`, an address on the local network) never ask. It is decorative and `1em` square by default, so it follows the text beside it.",
      },
    },
  },
  args: {
    href: "https://github.com/nessalabs",
    fallback: <Globe className="size-full" strokeWidth={1.8} />,
    className: "size-4 text-muted-foreground",
  },
} satisfies Meta<typeof Favicon>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "A site with an icon: the globe stands in until the site's icon has loaded, then the icon fades in.",
  ),
  render: (args) => (
    <span className="inline-flex items-center gap-2 nessa-text-4">
      <Favicon {...args} />
      github.com
    </span>
  ),
}

export const Unreachable: Story = {
  args: { href: "https://favicon-story.invalid/page" },
  parameters: storyDocumentation(
    "A site that cannot be reached keeps the fallback. The play test proves the icon is asked for and, once it fails, the fallback is all that remains.",
  ),
  play: async ({ canvasElement }) => {
    const svg = () => canvasElement.querySelector("svg")
    await expect(svg()).not.toBeNull()
    await waitFor(() => expect(canvasElement.querySelector("img")).toBeNull(), {
      timeout: 10_000,
    })
    await expect(svg()).not.toBeNull()
    await expect(canvasElement.querySelector('[data-slot="favicon"]')).toBeNull()
  },
}

export const NotAWebPage: Story = {
  args: { href: "mailto:ada@example.com" },
  parameters: storyDocumentation(
    "A link that is not a web page on a named host draws its fallback at once and asks nothing.",
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("img")).toBeNull()
    await expect(canvasElement.querySelector("svg")).not.toBeNull()
  },
}
