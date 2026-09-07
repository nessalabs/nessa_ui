import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, expect, userEvent, within, waitFor } from "storybook/test"
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
  args: { debug: true, state: "disconnected", onRetry: fn(), onDismiss: fn() },
} satisfies Meta<typeof AgentNotification>

export default meta
type Story = StoryObj<typeof meta>

export const Banner: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation("The inline glass banner: a connection heading, optional explanation, and independent retry/dismiss actions. Both callbacks remain controlled by the host."),
  args: { description: "The agent is offline. Try connecting again.", className: "w-[min(24rem,calc(100vw-2rem))]" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("status")).toHaveTextContent("Not connected")
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }))
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
    const notice = canvasElement.querySelector<HTMLElement>('[data-slot="agent-notification"]')!
    const view = canvasElement.ownerDocument.defaultView!
    const reduced = view.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Keep the exit paused at its endpoint so this asserts the visible result,
    // independent of runner speed, before letting the host callback finish it.
    const dismissButton = canvas.getByRole("button", { name: "Dismiss notification" })
    dismissButton.click()
    const exit = notice.getAnimations()[0]
    if (!reduced) {
      await expect(exit).toBeDefined()
      exit.pause()
      exit.currentTime = Number(exit.effect!.getTiming().duration)
      await expect(view.getComputedStyle(notice).opacity).toBe("0")
      await expect(Number.parseFloat(view.getComputedStyle(notice).translate)).toBeGreaterThan(0)
      dismissButton.click()
      await expect(args.onDismiss).not.toHaveBeenCalled()
      exit.finish()
    } else {
      await expect(exit).toBeUndefined()
    }
    await waitFor(() => expect(args.onDismiss).toHaveBeenCalledTimes(1))
    await expect(notice.getAnimations()).toHaveLength(0)
    await expect(view.getComputedStyle(notice).opacity).toBe("1")
  },
}
