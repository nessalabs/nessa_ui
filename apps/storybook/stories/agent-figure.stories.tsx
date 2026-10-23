import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { AgentFigure, BloomField, agentFigureKinds } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

/** Waits for a figure to draw and come to rest, so nothing is left running. */
async function rested(figure: HTMLElement) {
  await waitFor(
    () => {
      expect(figure).toHaveAttribute("data-ready", "true")
      expect(figure).toHaveAttribute("data-resting")
    },
    { timeout: 15000 },
  )
}

const meta = {
  title: "Primitives/AgentFigure",
  component: AgentFigure,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "An agent's mark as a small 3D object under studio light: Claude's burst, Codex's woven knot, and a local model's glass stack. While `lively` it plays its own routine — the burst turns and breathes, the knot twists, the glass fans apart — and it settles back to rest when it stops. Three.js loads the first time one mounts, and every figure shares one WebGL context. Decorative: put the agent's name beside it.",
      },
    },
  },
  args: { agent: "claude" },
} satisfies Meta<typeof AgentFigure>

export default meta
type Story = StoryObj<typeof meta>

export const Lively: Story = {
  args: { lively: false },
  parameters: storyDocumentation("Toggle `lively` to play the routine."),
  render: (args) => <AgentFigure {...args} className="size-48" />,
  play: async ({ canvasElement }) => {
    await rested(canvasElement.querySelector<HTMLElement>('[data-slot="agent-figure"]')!)
  },
}

const names = { claude: "Claude", codex: "Codex", local: "Local AI" } as const

/**
 * The setup picker's right side: every agent on the light, the one pointed
 * at plays its routine, the chosen one comes forward.
 */
function Picker() {
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [chosen, setChosen] = React.useState<string>("claude")
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="relative grid h-[320px] w-full max-w-[560px] grid-cols-3 place-items-center overflow-hidden rounded-2xl">
        <BloomField className="absolute inset-0" ambient={!navigator.webdriver} />
        {agentFigureKinds.map((agent) => (
          <AgentFigure
            key={agent}
            agent={agent}
            lively={hovered === agent}
            className={
              chosen === agent
                ? "size-40 transition-transform duration-200"
                : "size-28 opacity-70 transition-transform duration-200"
            }
          />
        ))}
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Agent">
        {agentFigureKinds.map((agent) => (
          <button
            key={agent}
            type="button"
            role="radio"
            aria-checked={chosen === agent}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm aria-checked:bg-neutral-900 aria-checked:text-white"
            onPointerEnter={() => setHovered(agent)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => setChosen(agent)}
          >
            {names[agent]}
          </button>
        ))}
      </div>
    </div>
  )
}

export const OnTheLight: Story = {
  parameters: storyDocumentation(
    "Point at a name to play that agent's routine; choose one to bring it forward.",
  ),
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const figures = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="agent-figure"]')]
    await expect(figures).toHaveLength(3)
    for (const figure of figures) await rested(figure)
    const codex = figures.find((figure) => figure.dataset.agent === "codex")!
    await userEvent.hover(canvas.getByRole("radio", { name: "Codex" }))
    // Under reduced motion it never leaves rest.
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await waitFor(() => expect(codex).not.toHaveAttribute("data-resting"), { timeout: 5000 })
    }
    await userEvent.click(canvas.getByRole("radio", { name: "Codex" }))
    await userEvent.unhover(canvas.getByRole("radio", { name: "Codex" }))
    await rested(codex)
  },
}
