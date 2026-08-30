import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  AgentActivity,
  AgentActivityCard,
  AgentActivityContent,
  AgentActivityCue,
  AgentActivityTrigger,
  formatAgentActivitySummary,
  formatAgentThoughtSummary,
  ToolCall,
  ToolCallContent,
  ToolCallTabs,
  ToolCallTrigger,
} from "@nessa-ui/react"
import { FileSearch, Sparkles } from "lucide-react"

import { SearchIcon } from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const explored = formatAgentActivitySummary({ files: 3, searches: 2 })

const meta = {
  title: "Components/AgentActivity",
  component: AgentActivity,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Collapsed agent work in a transcript: a quiet cue such as “Explored 3 files, 2 searches” that expands into the individual tool calls, a named-task card for a delegated run, and a standalone thought or live “Exploring…” line. The transcript stays a conversation; the tools stay behind the cue until a reader asks for them.",
      },
    },
  },
} satisfies Meta<typeof AgentActivity>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "A finished run of tools behind one cue. The trigger toggles the disclosure and carries the expanded state on aria-expanded; the revealed rows are ordinary ToolCall disclosures.",
  ),
  render: () => (
    <div className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
      <AgentActivityCue>{formatAgentThoughtSummary(1)}</AgentActivityCue>
      <AgentActivity>
        <AgentActivityTrigger>{explored}</AgentActivityTrigger>
        <AgentActivityContent>
          <ToolCall>
            <ToolCallTrigger icon={<FileSearch />} meta="chat-tabs.tsx">
              Read
            </ToolCallTrigger>
            <ToolCallContent>
              <ToolCallTabs input={`{ "path": "chat-tabs.tsx" }`} output="export function ChatTabs…" />
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
      </AgentActivity>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Thought 1s")).toBeVisible()
    const trigger = canvas.getByRole("button", { name: explored })
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(canvas.queryByRole("button", { name: /read/i })).toBeNull()
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByRole("button", { name: /read/i })).toBeVisible()
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
  },
}

export const LiveAndCard: Story = {
  parameters: storyDocumentation(
    "While the agent is still working the cue shimmers and the group is aria-busy. A named beat — a spawned explorer — uses the card instead of a counted summary.",
  ),
  render: () => (
    <div className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
      <AgentActivity status="running">
        <AgentActivityTrigger icon={<Sparkles />}>
          Exploring…
        </AgentActivityTrigger>
        <AgentActivityContent>
          <ToolCall status="running">
            <ToolCallTrigger icon={<SearchIcon />}>Searching composer call sites</ToolCallTrigger>
          </ToolCall>
        </AgentActivityContent>
      </AgentActivity>
      <AgentActivityCard
        icon={<Sparkles />}
        title="Explore chat UI components"
        meta="Working · Explorer"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvasElement.querySelector('[data-slot="agent-activity"]')
    await expect(group).toHaveAttribute("data-status", "running")
    await expect(group).toHaveAttribute("aria-busy", "true")
    await expect(
      canvas.getByRole("button", { name: /explore chat ui components/i }),
    ).toBeVisible()
  },
}
