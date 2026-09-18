import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, expect, userEvent, within, waitFor } from "storybook/test"
import { Download, Sparkles } from "lucide-react"
import { AgentNotification, Button } from "@nessalabs/ui"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Conversation/AgentNotification",
  component: AgentNotification,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: { description: { component: "A full-width glass notification for agent windows. Place above PillComposer. State, retry policy, queue guarantees, and dismissal are host-owned; the component politely announces status and exposes optional Retry and dismiss actions. Connection state is the default vocabulary, not the only one: icon and retryIcon replace the glyphs the state would choose, so the same surface can carry a notice such as an available update. The primary action follows onRetry rather than state — a host does not have to claim the connection is down to get a button — and is disabled, not removed, while connecting or reconnecting or while retryPending reports the host's own work in flight. A host that withdraws the action outright while it holds focus does not strand the keyboard user: the status region takes the focus and hands it back when the action returns. Enable shimmer for a faint, slowly morphing mesh wash (red offline, green connected, blue connecting); it defaults off and stays static under reduced motion." } },
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
    // Without overrides the glyphs stay state-chosen: offline, and a retry arrow.
    await expect(canvasElement.querySelector('[data-slot="agent-notification"] > svg')).toHaveClass("lucide-wifi-off")
    await expect(canvas.getByRole("button", { name: "Retry" }).querySelector("svg")).toHaveClass("lucide-rotate-cw")
    // The disconnected default is unchanged: an enabled action, and both
    // icon-only controls carry their label as a hover title.
    await expect(canvas.getByRole("button", { name: "Retry" })).not.toHaveAttribute("aria-disabled")
    await expect(canvas.getByRole("button", { name: "Retry" })).toHaveAttribute("title", "Retry")
    await expect(canvas.getByRole("button", { name: "Dismiss notification" })).toHaveAttribute("title", "Dismiss notification")
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

export const UpdateAvailable: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation("The same surface carrying a notice that is not about the connection. The host replaces both glyphs, names its own action, and leaves the connection reported as connected — the action follows onRetry, so the host does not have to claim the agent is offline to get a button. The wifi-off and retry-arrow defaults are untouched for callers that pass neither icon."),
  args: {
    state: "connected",
    title: "Update available",
    description: "Version 1.4.2",
    icon: Sparkles,
    retryIcon: Download,
    retryLabel: "Install update",
    className: "w-[min(24rem,calc(100vw-2rem))]",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("status")).toHaveTextContent("Update available")
    await expect(canvasElement.querySelector('[data-slot="agent-notification"]')).toHaveAttribute("data-state", "connected")
    const leading = canvasElement.querySelector('[data-slot="agent-notification"] > svg')!
    await expect(leading).toHaveClass("lucide-sparkles")
    await expect(leading).not.toHaveClass("lucide-wifi-off")
    // The override is decorative and sized like the glyph it replaces.
    await expect(leading).toHaveAttribute("aria-hidden", "true")
    await expect(leading).toHaveClass("size-4")
    const action = canvas.getByRole("button", { name: "Install update" })
    await expect(action.querySelector("svg")).toHaveClass("lucide-download")
    await expect(action.querySelector(".lucide-rotate-cw")).toBeNull()
    await expect(action).not.toHaveAttribute("aria-disabled")
    await userEvent.click(action)
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
  },
}

/** Lets the play test move the notice out of a busy state without a timer. */
function BusyActionExample(props: React.ComponentProps<typeof AgentNotification>) {
  const [state, setState] = React.useState<React.ComponentProps<typeof AgentNotification>["state"]>("connecting")
  return (
    <div className="flex max-w-full flex-col items-start gap-3">
      <Button onClick={() => setState("connected")}>Finish connecting</Button>
      <AgentNotification {...props} state={state} />
    </div>
  )
}

export const ActionWhileBusy: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation("While connecting or reconnecting the action stays in place and is disabled rather than removed: the work it would start is already in flight, the row does not reflow on every connection flap, and a keyboard user who is focused on it does not lose focus. It becomes live again as soon as the state settles."),
  args: { description: "Establishing a connection to your agent.", className: "w-[min(24rem,calc(100vw-2rem))]" },
  render: (args) => <BusyActionExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const notice = within(canvasElement.querySelector<HTMLElement>('[data-slot="agent-notification"]')!)
    // The old gate rendered nothing here; the action is now present, disabled.
    const action = notice.getByRole("button", { name: "Retry" })
    await expect(action).toHaveAttribute("aria-disabled", "true")
    // Button's aria-disabled styling is the whole disabled affordance: the
    // pointer cannot reach it, and it reads at the same half opacity as any
    // other disabled control in the system.
    const view = canvasElement.ownerDocument.defaultView!
    await expect(view.getComputedStyle(action).pointerEvents).toBe("none")
    await expect(view.getComputedStyle(action).opacity).toBe("0.5")
    // Disabled, not unfocusable: the control stays reachable and keeps focus,
    // and activating it from the keyboard still does nothing.
    action.focus()
    await userEvent.keyboard("{Enter}")
    action.click()
    await expect(args.onRetry).not.toHaveBeenCalled()
    await expect(action).toHaveFocus()
    await userEvent.click(canvas.getByRole("button", { name: "Finish connecting" }))
    await waitFor(() => expect(notice.getByRole("status")).toHaveTextContent("Connected"))
    await expect(notice.getByRole("button", { name: "Retry" })).not.toHaveAttribute("aria-disabled")
    await userEvent.click(notice.getByRole("button", { name: "Retry" }))
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
  },
}

/** Lets the play test settle the host's own pending work without a timer. */
function PendingActionExample(props: React.ComponentProps<typeof AgentNotification>) {
  const [pending, setPending] = React.useState(true)
  return (
    <div className="flex max-w-full flex-col items-start gap-3">
      <Button onClick={() => setPending(false)}>Finish the work</Button>
      <AgentNotification {...props} retryPending={pending} />
    </div>
  )
}

export const ActionPending: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation("`retryPending` gives a host whose notice is not about the connection the same disabled affordance connecting and reconnecting already have. A host whose retry is already running says so and keeps the control in place, instead of withdrawing `onRetry` and pulling a control out from under whoever is standing on it. Only the action reads as busy: the state still chooses the glyph."),
  args: { title: "Message not sent", description: "The gateway has no agent configured.", retryLabel: "Retry message", className: "w-[min(24rem,calc(100vw-2rem))]" },
  render: (args) => <PendingActionExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const notice = within(canvasElement.querySelector<HTMLElement>('[data-slot="agent-notification"]')!)
    const action = notice.getByRole("button", { name: "Retry message" })
    await expect(action).toHaveAttribute("aria-disabled", "true")
    // The connection is still the one the state names, so the glyph is the
    // offline one rather than a spinner: pending belongs to the action alone.
    await expect(canvasElement.querySelector('[data-slot="agent-notification"] > svg')).toHaveClass("lucide-wifi-off")
    // Programmatic clicks throughout: a pointer click would move focus to the
    // control it lands on, which is the thing these assertions are about.
    action.focus()
    action.click()
    await expect(args.onRetry).not.toHaveBeenCalled()
    await expect(action).toHaveFocus()
    canvas.getByRole("button", { name: "Finish the work" }).click()
    await waitFor(() => expect(notice.getByRole("button", { name: "Retry message" })).not.toHaveAttribute("aria-disabled"))
    // The same element, still focused: nothing was removed and put back.
    await expect(notice.getByRole("button", { name: "Retry message" })).toBe(action)
    await expect(action).toHaveFocus()
    action.click()
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
  },
}

/** Lets the play test withdraw the host's action outright and offer it again. */
function WithdrawnActionExample({ onRetry, ...props }: React.ComponentProps<typeof AgentNotification>) {
  const [offered, setOffered] = React.useState(true)
  return (
    <div className="flex max-w-full flex-col items-start gap-3">
      <Button onClick={() => setOffered((current) => !current)}>Toggle action</Button>
      <AgentNotification {...props} onRetry={offered ? onRetry : undefined} />
    </div>
  )
}

export const ActionWithdrawn: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation("Withdrawing `onRetry` removes the control outright, which a host still does when the notice stops having anything to do. Focus does not fall to the document body: the status region takes it, so the explanation is announced and the ring shows where focus went. The region is a waiting room, not a destination — when the host offers the action again it takes the focus back, rather than leaving somebody parked on static text with a ring around the notice for as long as the notice lives."),
  args: { title: "Message not sent", description: "The gateway has no agent configured.", retryLabel: "Retry message", className: "w-[min(24rem,calc(100vw-2rem))]" },
  render: (args) => <WithdrawnActionExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const element = canvasElement.querySelector<HTMLElement>('[data-slot="agent-notification"]')!
    const notice = within(element)
    const toggle = canvas.getByRole("button", { name: "Toggle action" })
    const status = notice.getByRole("status")
    notice.getByRole("button", { name: "Retry message" }).focus()
    // Programmatic clicks: a pointer click would take the focus this asserts on.
    toggle.click()
    await waitFor(() => expect(notice.queryByRole("button", { name: "Retry message" })).toBeNull())
    await expect(status).toHaveFocus()
    await expect(element.ownerDocument.activeElement).not.toBe(element.ownerDocument.body)
    toggle.click()
    await waitFor(() => expect(notice.getByRole("button", { name: "Retry message" })).toHaveFocus())
    // Focus that has moved on since the rescue is nobody's to take back.
    toggle.click()
    await waitFor(() => expect(status).toHaveFocus())
    toggle.focus()
    toggle.click()
    await waitFor(() => expect(notice.getByRole("button", { name: "Retry message" })).toBeInTheDocument())
    await expect(toggle).toHaveFocus()
  },
}
