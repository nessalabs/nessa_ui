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
          "A site's own icon beside a link to it. It is asked for lazily from the site's `/favicon.ico`, without a referrer, and shows only once it has loaded; until then, and wherever it cannot load, the `fallback` stands in its place. Only an absolute URL on a public, named host asks, always over HTTPS: a relative link, `mailto:`, `localhost`, an IP address or a local-network name (`.local`, `.home.arpa`) never does. It is decorative and `1em` square by default, so it follows the text beside it.",
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
  // It asks a real site, so it is for looking at, not for the test run.
  tags: ["!test"],
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
    // The wrapper stays, so the fallback keeps the size the host gave it.
    await expect(canvasElement.querySelector('[data-slot="favicon"]')).toHaveAttribute(
      "data-state",
      "failed",
    )
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

export const LocalNetwork: Story = {
  args: { href: "http://printer.local/status" },
  parameters: storyDocumentation(
    "A name on the person's own network never asks: the fallback is drawn and no request leaves.",
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("img")).toBeNull()
    await expect(canvasElement.querySelector("svg")).not.toBeNull()
  },
}

export const WithoutFallback: Story = {
  args: { href: "https://favicon-story.invalid/page", fallback: undefined },
  parameters: storyDocumentation(
    "With no fallback, nothing takes room until the icon loads, and nothing is left when it cannot: text beside it moves only for an icon.",
  ),
  render: (args) => (
    <span data-testid="line" className="nessa-text-4">
      <Favicon {...args} />
      unreachable.invalid
    </span>
  ),
  play: async ({ canvasElement }) => {
    const slot = () => canvasElement.querySelector<HTMLElement>('[data-slot="favicon"]')
    if (slot()) await expect(slot()!.getBoundingClientRect().width).toBe(0)
    await waitFor(() => expect(slot()).toBeNull(), { timeout: 10_000 })
  },
}
