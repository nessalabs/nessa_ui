import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, expect, userEvent, within, waitFor } from "storybook/test"
import { AgentNotification, Button } from "@nessalabs/ui"
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
    // The glass surface must retain its base fill alongside the gradient.
    await expect(view.getComputedStyle(notice).backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    const reduced = view.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Keep the exit paused at its endpoint so this asserts the visible result,
    // independent of runner speed, before letting the host callback finish it.
    const dismissButton = canvas.getByRole("button", { name: "Dismiss notification" })
    const expandedHeight = notice.getBoundingClientRect().height
    dismissButton.click()
    const exit = notice.getAnimations()[0]
    if (!reduced) {
      await expect(exit).toBeDefined()
      exit.pause()
      exit.currentTime = Number(exit.effect!.getTiming().duration) * 0.8
      await expect(notice.getBoundingClientRect().height).toBeGreaterThan(0)
      await expect(notice.getBoundingClientRect().height).toBeLessThan(expandedHeight)
      exit.currentTime = Number(exit.effect!.getTiming().duration)
      await expect(view.getComputedStyle(notice).opacity).toBe("0")
      await expect(notice.getBoundingClientRect().height).toBe(0)
      await expect(Number.parseFloat(view.getComputedStyle(notice).translate)).toBeGreaterThan(0)
      await waitFor(() => expect(dismissButton).toHaveAttribute("aria-disabled", "true"))
      canvas.getByRole("button", { name: "Retry" }).click()
      await expect(args.onRetry).toHaveBeenCalledTimes(1)
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

/** Demonstrates a host replacing notification content during an exit. */
function StateUpdatesExample(props: React.ComponentProps<typeof AgentNotification>) {
  const [updates, setUpdates] = React.useState<Partial<React.ComponentProps<typeof AgentNotification>>>({})
  return (
    <div className="flex max-w-full flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setUpdates((current) => ({ ...current, state: "disconnected" }))}>Replace state</Button>
        <Button onClick={() => setUpdates((current) => ({ ...current, title: "Connection changed" }))}>Replace title</Button>
        <Button onClick={() => setUpdates((current) => ({ ...current, description: "New connection details." }))}>Replace description</Button>
      </div>
      <div data-testid="notice-scroll-container" className="w-[min(24rem,calc(100vw-2rem))] max-w-full overflow-x-auto">
        <AgentNotification {...props} {...updates} />
      </div>
    </div>
  )
}

export const StateUpdates: Story = {
  parameters: storyDocumentation("New state, heading, or explanation cancels an in-flight dismissal so an old exit cannot remove new information. Retry is unavailable during the exit. Motion stays within the viewport and any horizontal scroll container."),
  args: { state: "connected" },
  render: (args) => <StateUpdatesExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const view = canvasElement.ownerDocument.defaultView!
    if (view.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const notice = canvasElement.querySelector<HTMLElement>('[data-slot="agent-notification"]')!
    const scroller = canvas.getByTestId("notice-scroll-container")
    for (const [button, expected] of [["Replace state", "Not connected"], ["Replace title", "Connection changed"], ["Replace description", "New connection details."]] as const) {
      canvas.getByRole("button", { name: "Dismiss notification" }).click()
      const exit = notice.getAnimations()[0]
      exit.pause()
      try {
        exit.currentTime = Number(exit.effect!.getTiming().duration) * 0.4
        await expect(scroller.scrollWidth).toBe(scroller.clientWidth)
        await userEvent.click(canvas.getByRole("button", { name: button }))
        await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent(expected))
        await expect(exit.playState).toBe("idle")
        await expect(view.getComputedStyle(notice).opacity).toBe("1")
        await expect(args.onDismiss).not.toHaveBeenCalled()
        await expect(canvas.getByRole("button", { name: "Dismiss notification" })).not.toHaveAttribute("aria-disabled", "true")
      } finally {
        exit.cancel()
      }
    }
    canvas.getByRole("button", { name: "Dismiss notification" }).click()
    notice.getAnimations()[0].finish()
    await waitFor(() => expect(args.onDismiss).toHaveBeenCalledTimes(1))
    await expect(notice.getAnimations()).toHaveLength(0)
  },
}
