import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

import {
  NUCLEO_ICON_COUNT,
  nucleoIconInventory,
} from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Foundation/Icons/Nucleo",
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The licensed Nucleo icon inventory used by Nessa examples. The count is derived from this catalog and guarded by repository validation.",
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Inventory: Story = {
  parameters: storyDocumentation(
    "The complete licensed Nucleo icon inventory used by Nessa examples, with the tracked count derived from the same source.",
  ),
  render: () => (
    <section aria-labelledby="nucleo-icon-heading" className="space-y-5">
      <div>
        <h2 id="nucleo-icon-heading" className="text-lg font-semibold">
          Nucleo icons
        </h2>
        <p className="text-sm text-muted-foreground">
          {NUCLEO_ICON_COUNT} licensed icons currently tracked
        </p>
      </div>
      <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
        {nucleoIconInventory.map(({ id, name, component: Icon }) => (
          <li
            key={id}
            className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
          >
            <Icon className="size-5" />
            <span className="text-center text-xs">{name}</span>
          </li>
        ))}
      </ul>
    </section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByText(`${NUCLEO_ICON_COUNT} licensed icons currently tracked`),
    ).toBeVisible()
    await expect(canvas.getAllByRole("listitem")).toHaveLength(NUCLEO_ICON_COUNT)
  },
}
