import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  ConversationHistory,
  type ConversationHistoryEntry,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const catalog: ConversationHistoryEntry[] = [
  {
    id: "agent-message",
    title: "Agent message package implementation",
    preview: "I'll start by reading the repo workflow…",
    updated: "1m",
    pinned: true,
    project: "nessalabs/nessa_ui",
  },
  {
    id: "audit",
    title: "Repo audit",
    preview: "I'll split that: one agent maps the composer call sites.",
    updated: "12m",
    project: "nessalabs/nessa_ui",
  },
  {
    id: "chat-1",
    title: "Release notes",
    preview: "New conversation",
    updated: "Just now",
  },
]

function HistoryExample() {
  const [query, setQuery] = React.useState("")
  const [value, setValue] = React.useState<string | null>("agent-message")
  const conversations = catalog.filter((entry) => {
    const haystack = `${entry.title} ${entry.preview ?? ""} ${entry.project ?? ""}`
    return haystack.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  })
  return (
    <div className="h-96 w-[min(24rem,calc(100vw-2rem))] rounded-[2rem] bg-background p-4">
      <ConversationHistory
        conversations={conversations}
        value={value}
        onValueChange={setValue}
        query={query}
        onQueryChange={setQuery}
      />
    </div>
  )
}

const meta = {
  title: "Components/ConversationHistory",
  component: ConversationHistory,
  tags: ["autodocs", "test"],
  args: {
    conversations: catalog,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A searchable roster of conversations: host-owned rows with a project-seeded RandomAvatar (same project, same painting), title, preview, project, pin, and relative time. Selecting a row reports its id.",
      },
    },
  },
} satisfies Meta<typeof ConversationHistory>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Search narrows the roster. Selecting a row marks it aria-current. Conversations that share a project share a RandomAvatar painting; a row with no project falls back to its id. An empty query shows every conversation the host passed.",
  ),
  render: () => <HistoryExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("list", { name: "Conversations" })
    await expect(within(list).getAllByRole("button")).toHaveLength(3)
    const selected = canvas.getByRole("button", {
      name: /agent message package implementation/i,
    })
    await expect(selected).toHaveAccessibleName(/pinned/i)
    await expect(selected).toHaveAttribute("aria-current", "true")
    const agentAvatar = selected.querySelector("[data-slot=random-avatar]")
    const auditAvatar = canvas
      .getByRole("button", { name: /repo audit/i })
      .querySelector("[data-slot=random-avatar]")
    const releaseAvatar = canvas
      .getByRole("button", { name: /release notes/i })
      .querySelector("[data-slot=random-avatar]")
    await expect(agentAvatar).toBeTruthy()
    await expect(auditAvatar).toBeTruthy()
    await expect(releaseAvatar).toBeTruthy()
    await expect(agentAvatar).toHaveAttribute(
      "data-figure",
      auditAvatar!.getAttribute("data-figure"),
    )
    await expect(releaseAvatar).not.toHaveAttribute(
      "data-figure",
      agentAvatar!.getAttribute("data-figure"),
    )
    const search = canvas.getByRole("searchbox", {
      name: "Search conversations",
    })
    await userEvent.type(search, "audit")
    await expect(within(list).getAllByRole("button")).toHaveLength(1)
    await expect(
      canvas.getByRole("button", { name: /repo audit/i }),
    ).toBeVisible()
    await userEvent.clear(search)
    await userEvent.click(canvas.getByRole("button", { name: /release notes/i }))
    await expect(
      canvas.getByRole("button", { name: /release notes/i }),
    ).toHaveAttribute("aria-current", "true")
  },
}
