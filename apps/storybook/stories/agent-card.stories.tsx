import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"
import { AgentCard } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/AgentCard",
  component: AgentCard,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "One agent on its own card: the agent's colours, a planet's arc rising from the lower left, and its 3D figure standing in front. For a moment that shows one agent at a time, such as the agent chosen during setup. Claude Code's mascot (`clawd`) stands on Claude's card.",
      },
    },
  },
  args: { agent: "clawd", name: "Claude" },
} satisfies Meta<typeof AgentCard>

export default meta
type Story = StoryObj<typeof meta>

/** The tested path: one card, drawn and at rest, so nothing is left running. */
export const Claude: Story = {
  parameters: storyDocumentation("Claude Code's mascot on Claude's card."),
  render: (args) => <AgentCard {...args} className="w-64" />,
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>('[data-slot="agent-figure"]')!
    await waitFor(
      () => {
        expect(figure).toHaveAttribute("data-ready", "true")
        expect(figure).toHaveAttribute("data-resting")
      },
      { timeout: 15000 },
    )
  },
}

export const Codex: Story = {
  // Docs only: Claude covers the drawing path; each card is a 3D scene.
  tags: ["!test"],
  args: { agent: "codex", name: "Codex" },
  parameters: storyDocumentation("Codex's knot on its light card."),
  render: (args) => <AgentCard {...args} className="w-64" />,
}

export const Local: Story = {
  tags: ["!test"],
  args: { agent: "local", name: "Local AI" },
  parameters: storyDocumentation("A local model's glass stack on its dark card."),
  render: (args) => <AgentCard {...args} className="w-64" />,
}
