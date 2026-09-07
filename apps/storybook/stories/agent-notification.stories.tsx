import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, expect, userEvent, within } from "storybook/test"
import { AgentNotification } from "@nessalabs/ui"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Conversation/AgentNotification",
  component: AgentNotification,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: { description: { component: "A full-width glass notification for agent windows. Place above PillComposer. State, retry policy, queue guarantees, and dismissal are host-owned; the component politely announces status and exposes optional Retry and dismiss actions. Enable shimmer for a faint, slowly morphing mesh wash (red offline, green connected, blue connecting); it defaults off and stays static under reduced motion." } },
  },
  args: { state: "disconnected", onRetry: fn(), onDismiss: fn() },
} satisfies Meta<typeof AgentNotification>

export default meta
type Story = StoryObj<typeof meta>

export const Banner: Story = {
  parameters: storyDocumentation("The inline glass banner: a connection heading, optional explanation, and independent retry/dismiss actions. Both callbacks remain controlled by the host."),
  args: { description: "The agent is offline. Try connecting again.", className: "w-[min(24rem,calc(100vw-2rem))]" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("status")).toHaveTextContent("Not connected")
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }))
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss notification" }))
    await expect(args.onDismiss).toHaveBeenCalledTimes(1)
  },
}
