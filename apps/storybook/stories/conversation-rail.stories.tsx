import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  ConversationRail,
  ConversationRailItem,
  ConversationRailMarker,
  ConversationRailPreview,
  ConversationRailTrigger,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

interface Turn {
  id: string
  role: "user" | "assistant"
  title: string
  preview: string
}

const turns: Turn[] = [
  {
    id: "turn-1",
    role: "user",
    title: "Build the composer",
    preview: "this is a composite component which will be a chat entry surface",
  },
  {
    id: "turn-2",
    role: "assistant",
    title: "Composer scaffolding",
    preview: "Scaffolded the compound composer with input, footer, and actions.",
  },
  {
    id: "turn-3",
    role: "user",
    title: "Steering and queue",
    preview: "we should also put these steering and queue list behaviors in",
  },
  {
    id: "turn-4",
    role: "assistant",
    title: "Queue delivered",
    preview: "The focused browser tests now pass in both pointer configurations.",
  },
  {
    id: "turn-5",
    role: "user",
    title: "Provider rail",
    preview: "adopt the provider rail as a first-class layout for the picker",
  },
]

function RailExample({
  previewClassName,
  renderRow,
}: {
  previewClassName?: string
  renderRow?: (turn: Turn, active: boolean) => React.ReactNode
}) {
  const [activeId, setActiveId] = React.useState(turns[0]!.id)
  const activeTurn = turns.find((turn) => turn.id === activeId)!

  return (
    <div className="flex min-h-72 w-[min(40rem,calc(100vw-2rem))] items-center gap-6 rounded-3xl border border-border bg-background p-8">
      <ConversationRail>
        {turns.map((turn) => (
          <ConversationRailItem key={turn.id} active={turn.id === activeId}>
            <ConversationRailTrigger
              aria-label={turn.title}
              onClick={() => setActiveId(turn.id)}
            >
              {renderRow ? (
                renderRow(turn, turn.id === activeId)
              ) : (
                <ConversationRailMarker />
              )}
            </ConversationRailTrigger>
            <ConversationRailPreview className={previewClassName}>
              <p className="m-0 font-medium text-foreground">{turn.title}</p>
              <p className="m-0 mt-1 text-muted-foreground">{turn.preview}</p>
            </ConversationRailPreview>
          </ConversationRailItem>
        ))}
      </ConversationRail>
      <p role="status" className="m-0 text-sm text-muted-foreground">
        Viewing: {activeTurn.title}
      </p>
    </div>
  )
}

function ScrollSyncExample() {
  const [visibility, setVisibility] = React.useState<
    ReadonlyMap<string, number>
  >(new Map([[turns[0]!.id, 1]]))
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const messageRefs = React.useRef(new Map<string, HTMLElement>())

  // The most-visible observed turn (ratios refresh at observer thresholds)
  // is the single current one (and owns aria-current);
  // other turns at least half on screen only get a softer tint.
  const visibleIds = [...visibility.entries()]
    .filter(([, ratio]) => ratio >= 0.5)
    .map(([id]) => id)
  const primaryId = [...visibility.entries()].reduce(
    (best, candidate) => (candidate[1] > best[1] ? candidate : best),
    ["", 0] as readonly [string, number],
  )[0]

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibility((current) => {
          const next = new Map(current)
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.turnId
            if (!id) continue
            if (entry.isIntersecting) next.set(id, entry.intersectionRatio)
            else next.delete(id)
          }
          return next
        })
      },
      {
        root: scrollRef.current,
        threshold: Array.from({ length: 21 }, (_, step) => step / 20),
      },
    )
    for (const element of messageRefs.current.values()) {
      observer.observe(element)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex min-h-72 w-[min(40rem,calc(100vw-2rem))] items-center gap-6 rounded-3xl border border-border bg-background p-8">
      <ConversationRail>
        {turns.map((turn) => (
          <ConversationRailItem key={turn.id} active={turn.id === primaryId}>
            <ConversationRailTrigger
              aria-label={turn.title}
              onClick={() =>
                messageRefs.current
                  .get(turn.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
              }
            >
              <ConversationRailMarker
                className={
                  turn.id !== primaryId && visibleIds.includes(turn.id)
                    ? "bg-foreground/70"
                    : undefined
                }
              />
            </ConversationRailTrigger>
            <ConversationRailPreview>
              <p className="m-0 font-medium text-foreground">{turn.title}</p>
              <p className="m-0 mt-1 text-muted-foreground">{turn.preview}</p>
            </ConversationRailPreview>
          </ConversationRailItem>
        ))}
      </ConversationRail>
      <div
        ref={scrollRef}
        role="region"
        aria-label="Chat messages"
        tabIndex={0}
        className="h-64 grow overflow-y-auto rounded-xl border border-border p-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ol className="m-0 grid list-none gap-3 p-0">
          {turns.map((turn) => (
            <li
              key={turn.id}
              data-turn-id={turn.id}
              ref={(element) => {
                if (element) messageRefs.current.set(turn.id, element)
                else messageRefs.current.delete(turn.id)
              }}
              className="grid min-h-40 content-start gap-1 rounded-xl bg-muted/40 p-3"
            >
              <p className="m-0 text-sm font-medium text-foreground">
                {turn.title}
              </p>
              <p className="m-0 text-sm text-muted-foreground">
                {turn.preview}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

const meta = {
  title: "Conversation/ConversationRail",
  component: ConversationRail,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "An edge-mounted conversation navigator. The rail lies flat until the pointer moves along it and raises a hill: every marker widens by a raised-cosine falloff of its distance to the pointer (tune with proximityRadius, replace with proximityFalloff, or disable with proximity={false}), while hover and keyboard focus pin their row fully open; the active turn is only tinted. Each row reveals a floating preview beside the rail that dismisses once the turn is clicked and re-arms on a fresh pointer approach or when focus moves on; only keyboard focus (focus-visible) reveals it, so a mouse click never leaves a row stuck open. The trigger is a plain button, so hosts decide what selecting a turn does via onClick, own the active turn, and render any row content inside the trigger — custom rows can read the inherited --nessa-rail-boost variable to join the hill, and the default animations are replaced by overriding marker or preview classes. The whole marker animation scales from --nessa-rail-marker-max (default 1.75rem): rows rest at --nessa-rail-marker-base-ratio (default 0.25) of it and the hill interpolates between the two, so retuning either variable retunes every state at once. Because active is controlled, the rail syncs to a scrolled message list by feeding it visibility — the ScrollSync story wires an IntersectionObserver so on-screen turns tint as you scroll and clicking a tick scrolls to its message.",
      },
    },
  },
} satisfies Meta<typeof ConversationRail>

export default meta
type Story = StoryObj<typeof meta>

export const TurnNavigator: Story = {
  parameters: storyDocumentation(
    "Clicking a marker calls the host's onClick, which moves the active turn; the active row stays flat but is tinted and exposes aria-current.",
  ),
  render: () => <RailExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Viewing: Build the composer")).toBeVisible()
    const target = canvas.getByRole("button", { name: "Steering and queue" })
    await userEvent.click(target)
    await expect(target).toHaveAttribute("aria-current", "true")
    await expect(
      canvas.getByRole("button", { name: "Build the composer" }),
    ).not.toHaveAttribute("aria-current")
    await expect(canvas.getByText("Viewing: Steering and queue")).toBeVisible()
  },
}

export const HoverAndFocusPreview: Story = {
  parameters: storyDocumentation(
    "Hovering or focusing a marker fades and slides its preview card in beside the rail; the preview is linked to the trigger through aria-describedby, and both clicking and Escape dismiss it.",
  ),
  render: () => <RailExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Provider rail" })
    const previewId = trigger.getAttribute("aria-describedby")
    await expect(previewId).toBeTruthy()
    const preview = canvasElement.ownerDocument.getElementById(previewId!)!
    await expect(preview).toHaveTextContent(
      "adopt the provider rail as a first-class layout for the picker",
    )
    await expect(getComputedStyle(preview).opacity).toBe("0")
    trigger.focus()
    await waitFor(() =>
      expect(getComputedStyle(preview).opacity).toBe("1"),
    )
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(getComputedStyle(preview).opacity).toBe("0"),
    )
    trigger.blur()
    trigger.focus()
    await waitFor(() =>
      expect(getComputedStyle(preview).opacity).toBe("1"),
    )
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(getComputedStyle(preview).opacity).toBe("0"),
    )
    trigger.blur()
    await waitFor(() =>
      expect(getComputedStyle(preview).opacity).toBe("0"),
    )
  },
}

export const ProximityHill: Story = {
  parameters: storyDocumentation(
    "Pointer movement over the rail widens every marker along a raised-cosine hill centered on the pointer, so neighbors swell and taper with distance instead of only the hovered row changing.",
  ),
  render: () => <RailExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const triggers = turns.map((turn) =>
      canvas.getByRole("button", { name: turn.title }),
    )
    const list = triggers[0]!.closest("ol")!
    const markers = triggers.map(
      (trigger) =>
        trigger.querySelector('[data-slot="conversation-rail-marker"]')!,
    )
    const widthOf = (index: number) =>
      parseFloat(getComputedStyle(markers[index]!).width)
    const centerRect = triggers[2]!.getBoundingClientRect()
    fireEvent.pointerMove(list, {
      clientY: centerRect.top + centerRect.height / 2,
    })
    await waitFor(() => {
      // Peak of the hill opens to the 28px max; neighbors swell past their
      // 7px resting width without reaching the peak, tapering with distance.
      expect(widthOf(2)).toBeCloseTo(28, 0)
      expect(widthOf(1)).toBeGreaterThan(10)
      expect(widthOf(1)).toBeLessThan(27)
      expect(widthOf(3)).toBeCloseTo(widthOf(1), 0)
    })
    // Moving well beyond the falloff radius lets the hill decay back to base.
    fireEvent.pointerMove(list, { clientY: centerRect.top + 500 })
    await waitFor(() => expect(widthOf(1)).toBeCloseTo(7, 0))
    // Touch pointers never raise the hill and clear any leftover boosts.
    fireEvent.pointerMove(list, {
      clientY: centerRect.top + centerRect.height / 2,
    })
    await waitFor(() => expect(widthOf(2)).toBeCloseTo(28, 0))
    fireEvent.pointerMove(list, {
      clientY: centerRect.top + centerRect.height / 2,
      pointerType: "touch",
    })
    await waitFor(() => expect(widthOf(2)).toBeCloseTo(7, 0))
  },
}

export const ScrollSync: Story = {
  parameters: storyDocumentation(
    "The host observes message visibility with an IntersectionObserver: the most-visible observed turn becomes the single active one (owning aria-current) while other on-screen turns get a softer tint, and clicking a tick scrolls its message into view.",
  ),
  render: () => <ScrollSyncExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = canvas.getByRole("button", { name: "Build the composer" })
    const last = canvas.getByRole("button", { name: "Provider rail" })
    await waitFor(() =>
      expect(first).toHaveAttribute("aria-current", "true"),
    )
    await expect(last).not.toHaveAttribute("aria-current")
    const region = canvas.getByRole("region", { name: "Chat messages" })
    region.scrollTo({ top: region.scrollHeight })
    await waitFor(() => expect(last).toHaveAttribute("aria-current", "true"))
    await waitFor(() => expect(first).not.toHaveAttribute("aria-current"))
    await userEvent.click(first)
    await waitFor(() =>
      expect(first).toHaveAttribute("aria-current", "true"),
    )
  },
}

export const CustomRowsAndAnimation: Story = {
  parameters: storyDocumentation(
    "Rows are host-rendered: this example swaps markers for dots that read the inherited --nessa-rail-boost variable to scale along the same hill, and replaces the default preview slide with a slower fade-and-scale by overriding classes.",
  ),
  render: () => (
    <RailExample
      previewClassName="translate-x-0 scale-95 duration-300 group-hover/rail-item:scale-100 group-[[data-preview-suppressed=false]:has(:focus-visible)]/rail-item:scale-100"
      renderRow={(turn) => (
        <span
          aria-hidden="true"
          className="ml-1 block size-1.5 rounded-full bg-muted-foreground/50 transition-[scale,background-color] duration-150 ease-out [scale:calc(1+1.5*max(var(--nessa-rail-boost,0),var(--nessa-rail-boost-state,0)))] group-hover/rail-item:[--nessa-rail-boost-state:1] group-hover/rail-item:bg-foreground group-[[data-preview-suppressed=false]:has(:focus-visible)]/rail-item:[--nessa-rail-boost-state:1] group-[[data-preview-suppressed=false]:has(:focus-visible)]/rail-item:bg-foreground group-data-[active=true]/rail-item:bg-foreground motion-reduce:transition-none"
        />
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Queue delivered" })
    const preview = canvasElement.ownerDocument.getElementById(
      trigger.getAttribute("aria-describedby")!,
    )!
    trigger.focus()
    await waitFor(() =>
      expect(getComputedStyle(preview).opacity).toBe("1"),
    )
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-current", "true")
    await expect(canvas.getByText("Viewing: Queue delivered")).toBeVisible()
  },
}
