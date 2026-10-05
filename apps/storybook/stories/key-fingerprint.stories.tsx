import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { KeyFingerprint } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/KeyFingerprint",
  component: KeyFingerprint,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A key fingerprint drawn for comparing by eye: monospaced, upper-cased, in evenly spaced groups that wrap between groups and never inside one. Separators in `value` — spaces, colons, dashes — are dropped before grouping, so every device that groups the same way draws the same thing. Assistive technology reads the groups one by one rather than as one long word.",
      },
    },
  },
  args: { value: "9f3a:c27e:41bd:0e88:d6a5:73f1:b0c4:5e92" },
} satisfies Meta<typeof KeyFingerprint>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "The play test proves separators are dropped, groups are four characters, upper-cased, and the accessible name reads them group by group.",
  ),
  play: async ({ canvasElement }) => {
    const print = within(canvasElement).getByRole("img")
    const groups = print.querySelectorAll("[data-slot=key-fingerprint-group]")
    await expect(groups).toHaveLength(8)
    await expect(groups[0]).toHaveTextContent("9F3A")
    await expect(print).toHaveAccessibleName(
      "Key fingerprint 9F3A, C27E, 41BD, 0E88, D6A5, 73F1, B0C4, 5E92",
    )
  },
}

export const Narrow: Story = {
  parameters: storyDocumentation(
    "In a narrow box the fingerprint wraps between groups. The play test proves no group is split across lines.",
  ),
  render: (args) => (
    <div style={{ width: 120 }}>
      <KeyFingerprint {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const groups = canvasElement.querySelectorAll<HTMLElement>("[data-slot=key-fingerprint-group]")
    for (const group of groups) {
      await expect(group.getClientRects()).toHaveLength(1)
    }
    const tops = new Set([...groups].map((group) => group.offsetTop))
    await expect(tops.size).toBeGreaterThan(1)
  },
}
