import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Badge,
  Button,
  ChatBubble,
  ChatMessage,
  ChatMessageReceipt,
  RandomAvatar,
  TaskList,
  TaskListItem,
  WindowDeck,
  WindowDeckPane,
} from "@nessa-ui/react"
import {
  CalendarDays,
  MessageCircle,
  PenTool,
  PanelsTopLeft,
} from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Shell/WindowDeck",
  component: WindowDeck,
  subcomponents: { WindowDeckPane },
  tags: ["autodocs", "test"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A deck of windows the user moves between. The carousel snaps one window to the middle at a time and lets its neighbours recede; Mod+G pulls every window back into an overview of tiles, and choosing a tile returns the deck to the carousel on that window. The return is the part worth knowing about: the scroller jumps to the landing window and the rail is shifted by the same distance in the same frame, so the composite is pixel-identical and the only thing that animates is one spring back to zero. Panes are content-agnostic frames — compose any Nessa components into them — and both the focused pane and the presentation mode may be controlled or left to the deck. The keymap follows the design system's shortcut descriptors, so a host rebinds an action, disables one with false, or turns off keyboard control entirely.",
      },
    },
  },
} satisfies Meta<typeof WindowDeck>

export default meta
type Story = StoryObj<typeof meta>

/** One window's chrome: the app mark, its name, and the thread it is on. */
function PaneHeader({
  icon: Icon,
  name,
  subtitle,
}: {
  icon: React.ElementType
  name: string
  subtitle: string
}) {
  return (
    <>
      <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
        <Icon />
      </span>
      <span className="flex min-w-0 flex-col">
        <strong className="nessa-text-3 truncate font-medium">{name}</strong>
        <small className="nessa-text-2 truncate text-muted-foreground">
          {subtitle}
        </small>
      </span>
    </>
  )
}

/** A short transcript, the shape the chat kit renders it. */
function Transcript({
  lines,
}: {
  lines: readonly { tone: "sent" | "received"; text: string }[]
}) {
  return (
    <div className="flex flex-col gap-1.5 p-4">
      {lines.map((line, index) => (
        <ChatMessage key={line.text} tone={line.tone} animateIn={false}>
          <ChatBubble>{line.text}</ChatBubble>
          {index === lines.length - 1 && line.tone === "sent" ? (
            <ChatMessageReceipt>Delivered</ChatMessageReceipt>
          ) : null}
        </ChatMessage>
      ))}
    </div>
  )
}

/**
 * Six windows of genuinely different content, so the deck is exercised as the
 * content-agnostic frame it is rather than as six copies of one surface.
 */
function DeckExample(props: React.ComponentProps<typeof WindowDeck>) {
  return (
    <div className="h-[720px] w-full bg-background">
      <WindowDeck defaultActivePane="studio" {...props}>
        <WindowDeckPane
          id="messages"
          label="Messages"
          header={
            <PaneHeader
              icon={MessageCircle}
              name="Messages"
              subtitle="Nessa crew"
            />
          }
        >
          <Transcript
            lines={[
              { tone: "received", text: "SplitView keeps its separator on the token ramp now." },
              { tone: "sent", text: "Does the Drawer still trap focus on the resize handle?" },
              { tone: "received", text: "Fixed — the handle is a separator, not a tab stop." },
            ]}
          />
        </WindowDeckPane>

        <WindowDeckPane
          id="rollout"
          label="Rollout"
          header={
            <PaneHeader
              icon={PanelsTopLeft}
              name="Rollout"
              subtitle="@nessa-ui/react"
            />
          }
        >
          <div className="flex flex-col gap-3 p-4">
            <TaskList>
              <TaskListItem status="done" meta="14 components">
                Publish the neutral ramp
              </TaskListItem>
              <TaskListItem status="done">Freeze the typography scale</TaskListItem>
              <TaskListItem status="active" meta="4 open">
                Move every surface onto the motion tokens
              </TaskListItem>
              <TaskListItem status="todo">Retire the transitional dark variant</TaskListItem>
            </TaskList>
          </div>
        </WindowDeckPane>

        <WindowDeckPane
          id="studio"
          label="Studio"
          header={
            <PaneHeader
              icon={PenTool}
              name="Studio"
              subtitle="nessa-ui preview"
            />
          }
        >
          <div className="flex flex-col gap-3 p-4">
            {/* The workshop previewing the system's own colour ramp. */}
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <span className="nessa-text-2 text-muted-foreground">
                Chart ramp
              </span>
              {/* The categorical ramp itself, named as the system names it. */}
              <div className="flex h-16 gap-1.5">
                <span className="flex-1 rounded-md bg-(--nessa-chart-series-1)" />
                <span className="flex-1 rounded-md bg-(--nessa-chart-series-2)" />
                <span className="flex-1 rounded-md bg-(--nessa-chart-series-3)" />
                <span className="flex-1 rounded-md bg-(--nessa-chart-series-4)" />
                <span className="flex-1 rounded-md bg-(--nessa-chart-series-5)" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </div>
            <Transcript
              lines={[
                { tone: "sent", text: "Chart 3 and 4 read the same at this size." },
                { tone: "received", text: "Widened the gap between them in both themes." },
              ]}
            />
          </div>
        </WindowDeckPane>

        <WindowDeckPane
          id="calendar"
          label="Calendar"
          header={
            <PaneHeader
              icon={CalendarDays}
              name="Calendar"
              subtitle="Week 43"
            />
          }
        >
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <strong className="nessa-text-3">Wednesday, Oct 22</strong>
              <Badge variant="secondary">Focus held</Badge>
            </div>
            {[
              ["12:00", "Component review — WindowDeck"],
              ["14:00", "Token audit — motion and elevation"],
              ["16:30", "Registry parity check"],
            ].map(([time, label]) => (
              <div
                key={time}
                className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2 nessa-text-3"
              >
                <time className="text-muted-foreground">{time}</time>
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </WindowDeckPane>

        <WindowDeckPane
          id="crew"
          label="Crew"
          header={
            <PaneHeader icon={MessageCircle} name="Crew" subtitle="Maintainers" />
          }
        >
          <div className="flex flex-col gap-1 p-4">
            {["Ada", "Noor", "Ivo", "Wren"].map((person) => (
              <div
                key={person}
                className="flex items-center gap-3 rounded-md px-2 py-2"
              >
                <RandomAvatar seed={person} className="size-8" />
                <span className="nessa-text-3">{person}</span>
              </div>
            ))}
          </div>
        </WindowDeckPane>

        <WindowDeckPane
          id="notes"
          label="Notes"
          header={
            <PaneHeader
              icon={PanelsTopLeft}
              name="Notes"
              subtitle="Component backlog"
            />
          }
        >
          <div className="grid grid-cols-2 gap-2 p-4">
            {[
              "Drawer",
              "SplitView",
              "Kanban",
              "GanttChart",
              "FilePreview",
              "WindowDeck",
            ].map((card) => (
              <span
                key={card}
                className="rounded-md bg-muted/60 px-3 py-3 nessa-text-2"
              >
                {card}
              </span>
            ))}
          </div>
        </WindowDeckPane>
      </WindowDeck>
    </div>
  )
}

/** The deck as a host meets it: six windows, keyboard and pointer both live. */
export const Default: Story = {
  args: {},
  parameters: storyDocumentation(
    "Six windows of different content in one deck. The centred window is live and its neighbours recede; a vertical wheel gesture over the deck moves it sideways, while content that scrolls on its own keeps its own gesture. Press Mod+G for the overview.",
  ),
  render: (args) => <DeckExample {...args} />,
}

/** Proves the shortcut, the tile return, and where selection lands. */
export const OverviewAndBack: Story = {
  args: {},
  parameters: storyDocumentation(
    "Mod+G opens the overview, where every window becomes a tile the pointer and the keyboard can open. Choosing a tile returns the deck to the carousel focused on that window; Escape leaves the overview on the window the deck came from.",
  ),
  render: (args) => <DeckExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const deck = canvasElement.querySelector<HTMLElement>(
      '[data-slot="window-deck"]',
    )

    await expect(deck).not.toBeNull()
    await expect(deck).toHaveAttribute("data-mode", "carousel")
    // The deck opens on the pane the host named, not on the first one.
    await waitFor(() =>
      expect(document.getElementById("studio")).toHaveAttribute(
        "data-active",
        "",
      ),
    )

    await userEvent.keyboard("{Meta>}g{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))

    // Every window is a tile: an addressable target with its own name.
    const calendarTile = canvas.getByRole("button", { name: "Calendar" })
    await userEvent.click(calendarTile)

    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "carousel"))

    // The scroller jumped rather than travelled. Under smooth scrolling the
    // write would animate and read back stale, the rail's compensating shift
    // would compute to zero, and the seam would be visible — so the offset
    // is asserted immediately, with no waitFor to let an animation land.
    const viewport = deck!.querySelector<HTMLElement>(
      '[data-slot="window-deck-viewport"]',
    )!
    const landing = document.getElementById("calendar")!
    const centred =
      landing.offsetLeft -
      viewport.offsetLeft -
      (viewport.clientWidth - landing.offsetWidth) / 2

await expect(Math.abs(viewport.scrollLeft - centred)).toBeLessThan(2)

    // The settle finishes on the chosen window, and hands interaction back.
    await waitFor(() =>
      expect(document.getElementById("calendar")).toHaveAttribute(
        "data-active",
        "",
      ),
    )
    await waitFor(() =>
      expect(deck!.querySelector('[data-settling]')).toBeNull(),
    )

    // Escape is the dismissal, and lands back where the deck came from.
    await userEvent.keyboard("{Meta>}g{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "carousel"))
    await waitFor(() =>
      expect(document.getElementById("calendar")).toHaveAttribute(
        "data-active",
        "",
      ),
    )
  },
}

/** Proves a host can rebind the keymap and drive the deck itself. */
export const ControlledWithACustomKeymap: Story = {
  args: {},
  parameters: storyDocumentation(
    "The host owns the mode and the focused pane, and has rebound the overview to Mod+Shift+O. Any action can be rebound the same way, set to false to drop it, or the whole keymap turned off with shortcuts={false}.",
  ),
  render: function ControlledDeck(args) {
    const [mode, setMode] = React.useState<"carousel" | "overview">("carousel")
    const [pane, setPane] = React.useState("studio")

    return (
      <div className="flex h-[720px] w-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <Badge variant="secondary">{mode}</Badge>
          <span className="nessa-text-3 text-muted-foreground">{pane}</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() =>
              setMode(mode === "overview" ? "carousel" : "overview")
            }
          >
            Toggle overview
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <DeckExample
            {...args}
            mode={mode}
            onModeChange={setMode}
            activePane={pane}
            onActivePaneChange={setPane}
            shortcuts={{
              toggleOverview: { key: "o", modifier: "mod", shiftKey: true },
            }}
          />
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const deck = canvasElement.querySelector<HTMLElement>(
      '[data-slot="window-deck"]',
    )

    // The default binding is gone: only the host's own shortcut answers.
    await userEvent.keyboard("{Meta>}g{/Meta}")
    await expect(deck).toHaveAttribute("data-mode", "carousel")

    await userEvent.keyboard("{Meta>}{Shift>}o{/Shift}{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))
    await waitFor(() => expect(canvas.getByText("overview")).toBeVisible())

    await userEvent.click(canvas.getByRole("button", { name: "Notes" }))
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "carousel"))
    await waitFor(() => expect(canvas.getByText("notes")).toBeVisible())

    // A host that drives the mode itself gets the same settle the shortcut
    // does: leaving the overview lands centred on the focused window rather
    // than wherever the scroller happened to be.
    await userEvent.click(canvas.getByRole("button", { name: "Toggle overview" }))
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))
    await userEvent.click(canvas.getByRole("button", { name: "Toggle overview" }))
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "carousel"))
    await waitFor(
      () => {
        const viewport = deck!.querySelector<HTMLElement>(
          '[data-slot="window-deck-viewport"]',
        )!
        const pane = document.getElementById("notes")!
        const viewportBox = viewport.getBoundingClientRect()
        const paneBox = pane.getBoundingClientRect()
        const offset = Math.abs(
          paneBox.left + paneBox.width / 2 - (viewportBox.left + viewportBox.width / 2),
        )

expect(offset).toBeLessThan(4)
      },
      { timeout: 3000 },
    )
  },
}


/** Builds a gradient "photo" as a data URI, so the demo needs no assets. */
function demoPhoto(from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='480' height='320' fill='url(#g)'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Gradient studies from the system's own ramps, as a roll of images. */
const shots = [
  { id: "accent", label: "Accent ramp", from: "#f59e0b", to: "#ec4899" },
  { id: "chart", label: "Chart ramp", from: "#22d3ee", to: "#0071e3" },
  { id: "success", label: "Success ramp", from: "#34d399", to: "#065f46" },
  { id: "focus", label: "Focus ramp", from: "#a78bfa", to: "#4c1d95" },
  { id: "destructive", label: "Destructive ramp", from: "#fda4af", to: "#7f1d1d" },
]

/**
 * The same deck carrying photographs rather than windows: one frame at a
 * time, the whole roll in the overview, and a throw upward to discard one.
 */
export const PhotosAndDismissal: Story = {
  args: {},
  parameters: storyDocumentation(
    "Nothing about the deck is conversational. Here each pane is a photograph with no window chrome: the carousel is a viewer, the overview is the roll, and a pane whose host passes onDismiss can be thrown off the deck — upward or downward here, since this deck allows both — or dismissed with Delete on the focused tile. The handler is told which way it went and whether it was thrown or dismissed from the keyboard, so a host can attach a different action to each direction. The host owns the removal, and the remaining tiles close over the gap.",
  ),
  render: function PhotoDeck(args) {
    const [remaining, setRemaining] = React.useState(shots)
    const [last, setLast] = React.useState("nothing yet")

    return (
      <div className="flex h-[720px] w-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <Badge variant="secondary">{remaining.length} studies</Badge>
          <span className="nessa-text-2 text-muted-foreground">{last}</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setRemaining(shots)}
          >
            Restore
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <WindowDeck {...args} paneWidth="min(620px, 76cqw)">
            {remaining.map((shot) => (
              <WindowDeckPane
                key={shot.id}
                id={shot.id}
                label={shot.label}
                chrome={false}
                scrollable={false}
                dismissDirections={["up", "down"]}
                onDismiss={(dismissal) => {
                  setLast(
                    `${shot.label} — ${dismissal.direction}, by ${dismissal.reason}`,
                  )
                  setRemaining((current) =>
                    current.filter((entry) => entry.id !== shot.id),
                  )
                }}
              >
                <img
                  src={demoPhoto(shot.from, shot.to)}
                  alt={shot.label}
                  className="size-full rounded-xl object-cover"
                />
              </WindowDeckPane>
            ))}
          </WindowDeck>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const deck = canvasElement.querySelector<HTMLElement>(
      '[data-slot="window-deck"]',
    )

    await userEvent.keyboard("{Meta>}g{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))

    /** Throws one tile towards an edge and waits for it to leave. */
    const throwTile = async (name: string, dy: number) => {
      const tile = canvas.getByRole("button", { name })
      const box = tile.getBoundingClientRect()
      const from = {
        clientX: Math.round(box.left + box.width / 2),
        clientY: Math.round(box.top + box.height / 2),
      }

      await userEvent.pointer([
        { keys: "[MouseLeft>]", target: tile, coords: from },
        { target: tile, coords: { ...from, clientY: from.clientY + dy / 4 } },
        { target: tile, coords: { ...from, clientY: from.clientY + dy } },
        {
          keys: "[/MouseLeft]",
          target: tile,
          coords: { ...from, clientY: from.clientY + dy },
        },
      ])
      await waitFor(() =>
        expect(canvas.queryByRole("button", { name })).toBeNull(),
      )
    }

    await throwTile("Chart ramp", -140)
    await waitFor(() => expect(canvas.getByText("4 studies")).toBeVisible())
    await waitFor(() =>
      expect(canvas.getByText("Chart ramp — up, by gesture")).toBeVisible(),
    )
    // The throw is not also a tap: the deck stays in the overview.
    await expect(deck).toHaveAttribute("data-mode", "overview")

    // This deck allows both axes, so a downward throw dismisses too, and the
    // host is told which way it went.
    await throwTile("Success ramp", 140)
    await waitFor(() =>
      expect(canvas.getByText("Success ramp — down, by gesture")).toBeVisible(),
    )
    await waitFor(() => expect(canvas.getByText("3 studies")).toBeVisible())

    // Delete removes the tile the user is actually focused on, and focus
    // moves to a neighbour rather than falling to the document.
    const focusTile = canvas.getByRole("button", { name: "Focus ramp" })

    focusTile.focus()
    await userEvent.keyboard("{Delete}")
    await waitFor(() =>
      expect(canvas.getByText("Focus ramp — up, by shortcut")).toBeVisible(),
    )
    await waitFor(() => expect(canvas.getByText("2 studies")).toBeVisible())
    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute(
        "data-slot",
        "window-deck-pane",
      ),
    )
  },
}

/** A host that declines the removal must get its pane back, not lose it. */
export const DeclinedDismissal: Story = {
  args: {},
  parameters: storyDocumentation(
    "onDismiss is a request, not a removal: the host decides. Here the host refuses, as it would while a confirmation is pending or after a failed request, and the pane returns to the grid where it was rather than sitting invisible in a cell nobody can reach.",
  ),
  render: function StubbornDeck(args) {
    const [refusals, setRefusals] = React.useState(0)

    return (
      <div className="flex h-[720px] w-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <Badge variant="secondary">{refusals} refused</Badge>
        </div>
        <div className="min-h-0 flex-1">
          <WindowDeck {...args} defaultMode="overview">
            {shots.slice(0, 3).map((shot) => (
              <WindowDeckPane
                key={shot.id}
                id={shot.id}
                label={shot.label}
                chrome={false}
                scrollable={false}
                onDismiss={() => setRefusals((current) => current + 1)}
              >
                <img
                  src={demoPhoto(shot.from, shot.to)}
                  alt={shot.label}
                  className="size-full rounded-xl object-cover"
                />
              </WindowDeckPane>
            ))}
          </WindowDeck>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tile = canvas.getByRole("button", { name: "Chart ramp" })

    tile.focus()
    await userEvent.keyboard("{Delete}")
    await waitFor(() => expect(canvas.getByText("1 refused")).toBeVisible())
    // The pane comes back, visible and openable, rather than being stranded.
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Chart ramp" })).toBeVisible(),
    )
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Chart ramp" })).not.toHaveAttribute(
        "data-leaving",
      ),
    )
    // And nothing about the deck moved on without it: no removal announced,
    // and focus still on the tile the user was working with.
    const announcement = canvasElement.querySelector(
      '[data-slot="window-deck-announcement"]',
    )

    await expect(announcement?.textContent ?? "").not.toContain("dismissed")
    await expect(document.activeElement).toBe(
      canvas.getByRole("button", { name: "Chart ramp" }),
    )
  },
}


/** Proves the overview survives being toggled faster than it can settle. */
export const RapidToggling: Story = {
  args: {},
  parameters: storyDocumentation(
    "The overview and the carousel are toggled faster than the transition between them completes. Each open must measure the deck as it is laid out rather than as it is currently painted — the rail is mid-slide, and reading its painted position would push the whole grid off to one side — and each open must cancel the settle still running underneath it, whose timer would otherwise reset the scroller under the new grid.",
  ),
  render: (args) => <DeckExample {...args} />,
  play: async ({ canvasElement }) => {
    const deck = canvasElement.querySelector<HTMLElement>(
      '[data-slot="window-deck"]',
    )!
    const viewport = deck.querySelector<HTMLElement>(
      '[data-slot="window-deck-viewport"]',
    )!

    /** Waits a set number of milliseconds, mid-transition on purpose. */
    const pause = (ms: number) =>
      new Promise((resolve) => window.setTimeout(resolve, ms))

    // Intervals either side of the ~300ms settle, so some toggles land while
    // the previous one is still moving and some after it has finished.
    // An odd number of toggles, so the deck ends in the overview.
    for (const interval of [90, 160, 300, 120, 420, 100, 200]) {
      await userEvent.keyboard("{Meta>}g{/Meta}")
      await pause(interval)
    }
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))

    // Every tile is inside the deck, not pushed off by a rail that was still
    // travelling when the grid was measured.
    await waitFor(() => {
      const box = viewport.getBoundingClientRect()

      for (const id of ["messages", "rollout", "studio", "calendar", "crew", "notes"]) {
        const tile = document.getElementById(id)!.getBoundingClientRect()

        expect(tile.left).toBeGreaterThanOrEqual(box.left - 1)
        expect(tile.right).toBeLessThanOrEqual(box.right + 1)
      }
    })

    // And the way back still lands centred, with nothing left transformed.
    await userEvent.keyboard("{Meta>}g{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "carousel"))
    await waitFor(
      () => {
        const rail = deck.querySelector<HTMLElement>(
          '[data-slot="window-deck-rail"]',
        )!
        const active = deck.querySelector<HTMLElement>("[data-active]")!
        const box = viewport.getBoundingClientRect()
        const paneBox = active.getBoundingClientRect()

        expect(rail.style.translate).toBe("")
        expect(
          Math.abs(paneBox.left + paneBox.width / 2 - (box.left + box.width / 2)),
        ).toBeLessThan(4)
      },
      { timeout: 3000 },
    )
  },
}


/** Proves the deck still works when motion is turned off entirely. */
export const WithoutMotion: Story = {
  args: {},
  parameters: storyDocumentation(
    "The theme zeroes the motion tokens under prefers-reduced-motion, which this story reproduces by setting the duration token directly. Nothing here may wait on a transition that will not run: the dismissal completes on its own rather than on a transitionend that never fires, and the return from the overview still lands centred.",
  ),
  render: function StillDeck(args) {
    const [remaining, setRemaining] = React.useState(shots.slice(0, 4))

    return (
      <div
        className="flex h-[720px] w-full flex-col bg-background"
        style={
          {
            "--nessa-motion-duration-slow": "0ms",
            "--nessa-motion-duration-normal": "0ms",
          } as React.CSSProperties
        }
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <Badge variant="secondary">{remaining.length} studies</Badge>
        </div>
        <div className="min-h-0 flex-1">
          <WindowDeck {...args} defaultActivePane="success">
            {remaining.map((shot) => (
              <WindowDeckPane
                key={shot.id}
                id={shot.id}
                label={shot.label}
                chrome={false}
                scrollable={false}
                onDismiss={() =>
                  setRemaining((current) =>
                    current.filter((entry) => entry.id !== shot.id),
                  )
                }
              >
                <img
                  src={demoPhoto(shot.from, shot.to)}
                  alt={shot.label}
                  className="size-full rounded-xl object-cover"
                />
              </WindowDeckPane>
            ))}
          </WindowDeck>
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const deck = canvasElement.querySelector<HTMLElement>(
      '[data-slot="window-deck"]',
    )!

    await userEvent.keyboard("{Meta>}g{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))

    // With no transition there is no transitionend, so a dismissal that
    // waited for one would never complete and would leave an invisible,
    // unreachable tile holding a cell in the grid.
    const tile = canvas.getByRole("button", { name: "Chart ramp" })

    tile.focus()
    await userEvent.keyboard("{Delete}")
    await waitFor(() => expect(canvas.getByText("3 studies")).toBeVisible())
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Chart ramp" })).toBeNull(),
    )

    // The deck opened on "success", so dismissing it has to hand selection to
    // its neighbour. Falling back to the first window would look the same
    // from Escape, which repoints separately, so it is asserted directly.
    const successTile = canvas.getByRole("button", { name: "Success ramp" })

    successTile.focus()
    await userEvent.keyboard("{Delete}")
    await waitFor(() => expect(canvas.getByText("2 studies")).toBeVisible())
    await waitFor(() =>
      expect(document.getElementById("focus")).toHaveAttribute("data-active", ""),
    )

    // And the settle still lands centred with the scroller handed back.
    await userEvent.click(canvas.getByRole("button", { name: "Accent ramp" }))
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "carousel"))
    await waitFor(() => {
      const viewport = deck.querySelector<HTMLElement>(
        '[data-slot="window-deck-viewport"]',
      )!
      const pane = document.getElementById("accent")!
      const viewportBox = viewport.getBoundingClientRect()
      const paneBox = pane.getBoundingClientRect()

      expect(viewport.style.scrollSnapType).toBe("")
      expect(
        Math.abs(
          paneBox.left + paneBox.width / 2 - (viewportBox.left + viewportBox.width / 2),
        ),
      ).toBeLessThan(4)
    })
  },
}


/** A host whose state lands a commit late must not leave the deck inert. */
export const DeferredHostUpdates: Story = {
  args: {},
  parameters: storyDocumentation(
    "Not every host answers a selection synchronously — a URL-backed one, a store that batches, a transition. The deck's return from the overview must survive its own inputs changing while it is still settling, rather than leaving the panes non-interactive and the scroller frozen.",
  ),
  render: function DeferredDeck(args) {
    const [pane, setPane] = React.useState("studio")

    return (
      <div className="h-[720px] w-full bg-background">
        <DeckExample
          {...args}
          activePane={pane}
          // Deliberately a commit late, as a router or an async store is.
          onActivePaneChange={(next) => window.setTimeout(() => setPane(next), 0)}
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const deck = canvasElement.querySelector<HTMLElement>(
      '[data-slot="window-deck"]',
    )!
    const viewport = deck.querySelector<HTMLElement>(
      '[data-slot="window-deck-viewport"]',
    )!

    await userEvent.keyboard("{Meta>}g{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))
    await userEvent.click(canvas.getByRole("button", { name: "Notes" }))
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "carousel"))

    // The settle has to release the deck even though the host's own update
    // arrived in a later commit than the close did.
    await waitFor(
      () => expect(viewport).not.toHaveAttribute("data-settling"),
      { timeout: 3000 },
    )
    await waitFor(() =>
      expect(document.getElementById("notes")).toHaveAttribute(
        "data-active",
        "",
      ),
    )

    // And the deck is genuinely live again, not merely un-flagged.
    await userEvent.keyboard("{Meta>}g{/Meta}")
    await waitFor(() => expect(deck).toHaveAttribute("data-mode", "overview"))
    await userEvent.click(canvas.getByRole("button", { name: "Calendar" }))
    await waitFor(() =>
      expect(document.getElementById("calendar")).toHaveAttribute(
        "data-active",
        "",
      ),
    )
  },
}
