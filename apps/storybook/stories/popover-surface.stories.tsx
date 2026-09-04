import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Button, PopoverSurface } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/PopoverSurface",
  component: PopoverSurface,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The floating overlay surface underneath Nessa's popover-style chrome: popover tokens over a hairline border, with elevation (md/xl shadow) and radius (lg/xl/2xl) variants. Purely presentational — positioning, portals, and dismissal stay with the consumer — and asChild projects the surface classes onto another element, such as a positioning library's content node. The EventCalendar's built-in confirmation dialog and quick-create demos sit on this surface.",
      },
    },
  },
} satisfies Meta<typeof PopoverSurface>

export default meta
type Story = StoryObj<typeof meta>

export const InlineCard: Story = {
  parameters: storyDocumentation(
    "The default surface (xl radius, md elevation) dressed as a small inline confirmation, composed from Nessa Buttons. The play test proves the surface by computed style — an opaque popover background and a solid hairline border — rather than class names.",
  ),
  render: () => (
    <PopoverSurface
      radius="lg"
      className="flex w-64 flex-col gap-2 p-3"
      aria-label="Example confirmation"
      role="dialog"
    >
      <p className="text-xs font-medium">Discard draft?</p>
      <p className="text-xs text-muted-foreground">
        Unsaved changes will be lost.
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7">
          Discard
        </Button>
        <Button variant="ghost" size="sm" className="h-7">
          Keep editing
        </Button>
      </div>
    </PopoverSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const surface = await canvas.findByRole("dialog", {
      name: "Example confirmation",
    })
    const style = getComputedStyle(surface)
    await expect(style.borderStyle).toBe("solid")
    await expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    await expect(parseFloat(style.borderRadius)).toBeGreaterThan(0)
  },
}

export const Elevations: Story = {
  parameters: storyDocumentation(
    "The elevation and radius variants side by side: md shadow with lg radius for tight inline popups, xl shadow with 2xl radius for larger floating panels such as picker popovers. The play test asserts the two surfaces resolve different computed shadows.",
  ),
  render: () => (
    <div className="flex items-start gap-6">
      <PopoverSurface
        radius="lg"
        elevation="md"
        data-testid="surface-md"
        className="w-48 p-3 text-xs"
      >
        Inline popup surface
      </PopoverSurface>
      <PopoverSurface
        radius="2xl"
        elevation="xl"
        data-testid="surface-xl"
        className="w-48 p-4 text-xs"
      >
        Floating panel surface
      </PopoverSurface>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const md = canvasElement.querySelector<HTMLElement>(
      '[data-testid="surface-md"]',
    )
    const xl = canvasElement.querySelector<HTMLElement>(
      '[data-testid="surface-xl"]',
    )
    await expect(md).not.toBeNull()
    await expect(xl).not.toBeNull()
    await expect(getComputedStyle(md!).boxShadow).not.toBe(
      getComputedStyle(xl!).boxShadow,
    )
    await expect(
      parseFloat(getComputedStyle(xl!).borderRadius),
    ).toBeGreaterThan(parseFloat(getComputedStyle(md!).borderRadius))
  },
}
