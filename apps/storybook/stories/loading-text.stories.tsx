import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"
import { LoadingText } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/LoadingText",
  component: LoadingText,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Text with a highlight sweeping across it, the default loader for any frame that has nothing to show yet. Pass what is loading as the children (`Loading Files`); it defaults to `Loading`. The sweep is clipped to the glyphs, so the label stays real text, and under reduced motion it is plain muted text. It announces itself politely once; set `announce` off when the host already carries the status, as GeneratingSurface does.",
      },
    },
  },
  args: { children: "Loading Files" },
} satisfies Meta<typeof LoadingText>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "The loader on its own: no box or panel, just the sweeping label. The play test proves the sweep runs on the glyphs (and stops under reduced motion) and the label is announced once it mounts.",
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-slot="loading-text"]')!
    const visible = root.firstElementChild as HTMLElement
    await expect(visible.textContent).toBe("Loading Files")
    await expect(visible).toHaveAttribute("aria-hidden", "true")
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Plain muted text: no sweep painted and nothing animating.
      await expect(visible).not.toHaveAttribute("data-shimmer")
      await expect(visible.getAnimations()).toHaveLength(0)
    } else {
      await expect(getComputedStyle(visible).backgroundClip).toBe("text")
      await expect(visible.getAnimations()).toHaveLength(1)
    }
    await waitFor(() =>
      expect(root.querySelector('[role="status"]')!.textContent).toBe("Loading Files"),
    )
  },
}

export const Default: Story = {
  args: { children: undefined },
  parameters: storyDocumentation("With no children it reads `Loading`."),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-slot="loading-text"]')!
    await expect(root.firstElementChild!.textContent).toBe("Loading")
  },
}

export const Unannounced: Story = {
  args: { announce: false },
  parameters: storyDocumentation(
    "With `announce` off there is no status region and the label is ordinary text in the accessibility tree, for a host that announces the wait itself.",
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-slot="loading-text"]')!
    await expect(root.querySelector('[role="status"]')).toBeNull()
    await expect(root.querySelector("[aria-hidden]")).toBeNull()
  },
}
