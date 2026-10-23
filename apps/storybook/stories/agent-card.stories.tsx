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

/**
 * Docs only, like every card: each is a software-rendered 3D scene in CI, and
 * running one beside the other stories pushed unrelated settle waits (QrOrb,
 * TypeIn) past their budgets. `AgentFigure / Playing` tests the figure, the
 * server-render test covers the card's markup, and nessa-agent's setup stress
 * step drives the card in the real picker.
 */
export const Claude: Story = {
  tags: ["!test"],
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
