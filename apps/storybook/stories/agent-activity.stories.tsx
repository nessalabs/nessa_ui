import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  AgentActivity,
  AgentActivityCard,
  AgentActivityContent,
  AgentActivityCue,
  AgentActivityTrigger,
  RandomAvatar,
  Sheet,
  SheetAction,
  SheetBody,
  SheetExpand,
  SheetHandle,
  SheetHeader,
  SheetTitle,
  formatAgentActivitySummary,
  formatAgentThoughtSummary,
  ToolCall,
  ToolCallContent,
  ToolCallTabs,
  ToolCallTrigger,
} from "@nessalabs/ui"
import { FileSearch } from "lucide-react"

import { SearchIcon } from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const explored = formatAgentActivitySummary({ files: 3, searches: 2 })
const thought = formatAgentThoughtSummary(1)
const thoughtDetail =
  "The playground already has ToolCall rows. Collapse them behind a cue so the transcript stays a conversation."

function ToolRows() {
  return (
    <AgentActivityContent>
      <ToolCall>
        <ToolCallTrigger icon={<FileSearch />} meta="chat-tabs.tsx">
          Read
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallTabs
            input={`{ "path": "chat-tabs.tsx" }`}
            output="export function ChatTabs…"
          />
        </ToolCallContent>
      </ToolCall>
      <ToolCall>
        <ToolCallTrigger icon={<SearchIcon />} meta="wrapTab">
          Search
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallTabs input={`{ "pattern": "wrapTab" }`} output="2 matches" />
        </ToolCallContent>
      </ToolCall>
    </AgentActivityContent>
  )
}

const meta = {
  title: "Agents/AgentActivity",
  component: AgentActivity,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Collapsed agent work in a transcript: a quiet cue such as “Explored 3 files, 2 searches” that opens the extra-details sheet with that beat’s thinking and tool calls, a named-task card for a delegated run, and a standalone thought or live “Exploring…” line. Exploring cues and named cards carry a RandomAvatar — busy (flooding paint) while that agent is working, still once it is not. The transcript stays a conversation; the tools never expand inline.",
      },
    },
  },
} satisfies Meta<typeof AgentActivity>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "A finished run of tools behind one cue. The trigger opens the extra-details sheet; the transcript line stays collapsed. Thought cues with details disclose the same way.",
  ),
  render: () => {
    function Example() {
      const [open, setOpen] = React.useState<"thought" | "explored" | null>(
        null,
      )
      const sheetId = React.useId()
      const title = open === "thought" ? thought : explored
      return (
        <div className="relative h-96 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background p-4">
          <div className="flex flex-col gap-3">
            <AgentActivityCue
              discloses
              aria-expanded={open === "thought"}
              aria-controls={open === "thought" ? sheetId : undefined}
              onClick={() => setOpen("thought")}
            >
              {thought}
            </AgentActivityCue>
            <AgentActivity>
              <AgentActivityTrigger
                icon={<RandomAvatar seed="agent-activity" className="size-4" />}
                aria-expanded={open === "explored"}
                aria-controls={open === "explored" ? sheetId : undefined}
                onClick={() => setOpen("explored")}
              >
                {explored}
              </AgentActivityTrigger>
            </AgentActivity>
          </div>
          {open ? (
            <Sheet
              id={sheetId}
              label={title}
              modal={false}
              onClose={() => setOpen(null)}
            >
              <SheetHandle />
              <SheetHeader>
                <SheetExpand />
                <SheetTitle>{title}</SheetTitle>
                <SheetAction>Done</SheetAction>
              </SheetHeader>
              <SheetBody>
                {open === "thought" ? (
                  <p className="m-0 font-sans nessa-text-4 text-foreground">
                    {thoughtDetail}
                  </p>
                ) : (
                  <>
                    <AgentActivityCue>{thought}</AgentActivityCue>
                    <p className="m-0 font-sans nessa-text-4 text-foreground">
                      {thoughtDetail}
                    </p>
                    <ToolRows />
                  </>
                )}
              </SheetBody>
            </Sheet>
          ) : null}
        </div>
      )
    }
    return <Example />
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await expect(canvas.getByText(thought)).toBeVisible()
    const trigger = canvas.getByRole("button", { name: explored })
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(trigger.querySelector("[data-slot=random-avatar]")).not.toHaveAttribute(
      "aria-busy",
    )
    await expect(canvas.queryByRole("button", { name: /read/i })).toBeNull()
    await userEvent.click(trigger)
    const dialog = canvas.getByRole("dialog", { name: explored })
    await waitFor(() => expect(dialog).toBeVisible())
    await expect(dialog).not.toHaveAttribute("aria-modal")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /read/i })).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await waitFor(() =>
      expect(
        canvas.queryByRole("dialog", { name: explored }),
      ).not.toBeInTheDocument(),
    )
    await expect(canvas.queryByRole("button", { name: /read/i })).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: thought }))
    await expect(canvas.getByRole("dialog", { name: thought })).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByText(thoughtDetail)).toBeVisible(),
    )
    await expect(canvas.queryByRole("button", { name: /read/i })).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await waitFor(() =>
      expect(
        canvas.queryByRole("dialog", { name: thought }),
      ).not.toBeInTheDocument(),
    )
  },
}

export const LiveAndCard: Story = {
  parameters: storyDocumentation(
    "While the agent is still working the cue shimmers, its RandomAvatar is busy, and the group is aria-busy. Clicking Exploring… opens the live tools in the extra-details sheet. A named beat — a spawned explorer — uses the card with that agent’s avatar instead of a counted summary. The last five rows show the mark slot’s sizing rule: a bare glyph is drawn at 14px, and one that arrives with its own size-* keeps it, in the cue and the card alike — including a glyph larger than the card’s circle, which keeps its size and is clipped rather than being squeezed narrow.",
  ),
  render: () => {
    function Example() {
      const [open, setOpen] = React.useState(false)
      const [status, setStatus] = React.useState<"running" | "complete">(
        "running",
      )
      const sheetId = React.useId()
      return (
        <div className="relative h-80 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background p-4">
          <div className="flex flex-col gap-3">
            <AgentActivity status={status}>
              <AgentActivityTrigger
                icon={
                  <RandomAvatar
                    seed="agent-activity"
                    busy={status === "running"}
                    className="size-4"
                  />
                }
                aria-expanded={open}
                aria-controls={open ? sheetId : undefined}
                onClick={() => setOpen(true)}
              >
                {status === "running" ? "Exploring…" : explored}
              </AgentActivityTrigger>
            </AgentActivity>
            <AgentActivityCard
              icon={<RandomAvatar seed="explorer" busy className="size-7" />}
              title="Explore chat UI components"
              meta="Working · Explorer"
            />
            <AgentActivityCue
              icon={<FileSearch data-testid="sized-glyph" className="size-5" />}
            >
              Read 4 files
            </AgentActivityCue>
            <AgentActivityCue icon={<FileSearch data-testid="bare-glyph" />}>
              Read 2 more
            </AgentActivityCue>
            <AgentActivityCard
              icon={<FileSearch data-testid="sized-glyph" className="size-5" />}
              title="Scan the design system"
              meta="Done · 12 files"
            />
            <AgentActivityCard
              icon={<FileSearch data-testid="bare-glyph" />}
              title="Scan the tokens"
              meta="Done · 3 files"
            />
            <AgentActivityCard
              icon={<FileSearch data-testid="huge-glyph" className="size-10" />}
              title="Scan the icons"
              meta="Done · 40 files"
            />
          </div>
          {open ? (
            <Sheet
              id={sheetId}
              label="Exploring…"
              modal={false}
              onClose={() => {
                setOpen(false)
                setStatus("complete")
              }}
            >
              <SheetHandle />
              <SheetHeader>
                <SheetExpand />
                <SheetTitle>Exploring…</SheetTitle>
                <SheetAction>Done</SheetAction>
              </SheetHeader>
              <SheetBody>
                <AgentActivityContent>
                  <ToolCall status="running">
                    <ToolCallTrigger icon={<SearchIcon />}>
                      Searching composer call sites
                    </ToolCallTrigger>
                  </ToolCall>
                </AgentActivityContent>
              </SheetBody>
            </Sheet>
          ) : null}
        </div>
      )
    }
    return <Example />
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const group = canvasElement.querySelector('[data-slot="agent-activity"]')
    await expect(group).toHaveAttribute("data-status", "running")
    await expect(group).toHaveAttribute("aria-busy", "true")
    const exploring = canvas.getByRole("button", { name: /exploring/i })
    await expect(
      exploring.querySelector("[data-slot=random-avatar]"),
    ).toHaveAttribute("aria-busy", "true")
    const named = canvas.getByRole("button", {
      name: /explore chat ui components/i,
    })
    await expect(named).toBeVisible()
    await expect(named.querySelector("[data-slot=random-avatar]")).toHaveAttribute(
      "aria-busy",
      "true",
    )
    // The cue and the card hold that rule in separate class strings, so each
    // is measured in both slots: a bare glyph drawn at 14px, a sized one left
    // alone. The avatar's own fill is RandomAvatar's invariant, measured
    // there.
    const sized = canvasElement.querySelectorAll("[data-testid=sized-glyph]")
    await expect(sized).toHaveLength(2)
    for (const glyph of sized) {
      const box = glyph.getBoundingClientRect()
      await expect(box.width).toBeCloseTo(20, 1)
      await expect(box.height).toBeCloseTo(20, 1)
    }
    // A glyph larger than the card's 28px slot keeps its own size and is
    // clipped by the circle, as the slot's JSDoc promises. It is a flex item
    // in a fixed-width box, so without an explicit `shrink-0` on the child
    // the 40px glyph would be squeezed to 28px wide and stay 40px tall.
    const huge = canvasElement.querySelector("[data-testid=huge-glyph]")
    await expect(huge).not.toBeNull()
    const hugeBox = huge!.getBoundingClientRect()
    await expect(hugeBox.width).toBeCloseTo(40, 1)
    await expect(hugeBox.height).toBeCloseTo(40, 1)
    const bare = canvasElement.querySelectorAll("[data-testid=bare-glyph]")
    await expect(bare).toHaveLength(2)
    for (const glyph of bare) {
      const box = glyph.getBoundingClientRect()
      await expect(box.width).toBeCloseTo(14, 1)
      await expect(box.height).toBeCloseTo(14, 1)
    }
    await expect(
      canvas.queryByRole("button", { name: /searching composer/i }),
    ).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: /exploring/i }))
    await expect(
      canvas.getByRole("dialog", { name: "Exploring…" }),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: /searching composer/i }),
      ).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await waitFor(() =>
      expect(
        canvas.queryByRole("dialog", { name: "Exploring…" }),
      ).not.toBeInTheDocument(),
    )
    await expect(group).toHaveAttribute("data-status", "complete")
    await expect(group).not.toHaveAttribute("aria-busy")
    await expect(
      canvas
        .getByRole("button", { name: explored })
        .querySelector("[data-slot=random-avatar]"),
    ).not.toHaveAttribute("aria-busy")
    await expect(named.querySelector("[data-slot=random-avatar]")).toHaveAttribute(
      "aria-busy",
      "true",
    )
  },
}
