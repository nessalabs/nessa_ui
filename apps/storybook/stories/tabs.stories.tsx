import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nessa-ui/react"
import { Inbox, MessageSquare, Sparkles } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A real tablist: Radix supplies the tab, tablist and tabpanel roles, roving focus, arrow-key movement along the list's orientation, and Home and End, while Nessa supplies the presentation. Use it wherever one region swaps between named views — unlike SegmentedControl, which is a role=group of pressed buttons for toggling a setting rather than swapping a panel. Selection is uncontrolled through defaultValue or host-controlled through value and onValueChange, orientation is horizontal or vertical, and activationMode chooses whether arrowing selects as it goes or waits for Enter.",
      },
    },
  },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

const panelClassName =
  "rounded-lg border border-border bg-card p-4 nessa-text-4 text-card-foreground"

export const Underline: Story = {
  parameters: storyDocumentation(
    "The default presentation: a rule under the whole strip that the selected tab overdraws, so the indicator reads as part of one continuous line. Each tab takes an optional leading icon and a trailing badge for a count. The play test proves the roles and roving focus are real — one tab stop for the whole list, arrow keys move and select, and the selected tab is the only one with tabindex 0.",
  ),
  render: () => (
    <Tabs defaultValue="inbox" className="w-96">
      <TabsList aria-label="Session drawers">
        <TabsTrigger value="inbox" icon={<Inbox />} badge="12">
          Inbox
        </TabsTrigger>
        <TabsTrigger value="running" icon={<Sparkles />} badge="3">
          Running
        </TabsTrigger>
        <TabsTrigger value="archived" icon={<MessageSquare />}>
          Archived
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inbox" className={panelClassName}>
        Twelve sessions waiting on you.
      </TabsContent>
      <TabsContent value="running" className={panelClassName}>
        Three agents are still working.
      </TabsContent>
      <TabsContent value="archived" className={panelClassName}>
        Nothing archived yet.
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("tablist", { name: "Session drawers" })
    await expect(list).toHaveAttribute("data-orientation", "horizontal")

    const inbox = canvas.getByRole("tab", { name: /Inbox/ })
    const running = canvas.getByRole("tab", { name: /Running/ })
    await expect(inbox).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getAllByRole("tab")).toHaveLength(3)

    // Exactly one panel is exposed, and it is named by its tab.
    const panel = canvas.getByRole("tabpanel")
    await expect(panel).toHaveAttribute(
      "aria-labelledby",
      inbox.getAttribute("id"),
    )

    // Roving focus: once focus is in the list it is a single tab stop, so
    // Tab leaves the strip rather than walking every tab in it.
    // Radix moves the tab stop from a focus handler, so it lands a render
    // after `focus()` rather than synchronously with it.
    inbox.focus()
    await waitFor(async () => {
      await expect(inbox).toHaveAttribute("tabindex", "0")
    })
    await expect(running).toHaveAttribute("tabindex", "-1")

    await userEvent.keyboard("{ArrowRight}")
    await expect(running).toHaveFocus()
    await expect(running).toHaveAttribute("aria-selected", "true")
    // The tab stop moved with focus.
    await waitFor(async () => {
      await expect(running).toHaveAttribute("tabindex", "0")
    })
    await expect(inbox).toHaveAttribute("tabindex", "-1")
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "Three agents are still working.",
    )

    await userEvent.keyboard("{End}")
    await expect(canvas.getByRole("tab", { name: /Archived/ })).toHaveFocus()
    await userEvent.keyboard("{Home}")
    await expect(inbox).toHaveFocus()
  },
}

export const Pill: Story = {
  parameters: storyDocumentation(
    "The pill presentation: a bordered strip whose selected tab is a filled chip, for a compact switcher inside a toolbar or panel header. The tabs share the width equally.",
  ),
  render: () => (
    <Tabs defaultValue="threads" className="w-80">
      <TabsList aria-label="Channel view" variant="pill">
        <TabsTrigger value="threads">Threads</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="pins">Pins</TabsTrigger>
      </TabsList>
      <TabsContent value="threads" className={panelClassName}>
        Every thread in this channel.
      </TabsContent>
      <TabsContent value="files" className={panelClassName}>
        Files shared here.
      </TabsContent>
      <TabsContent value="pins" className={panelClassName}>
        Pinned messages.
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const files = canvas.getByRole("tab", { name: "Files" })
    await userEvent.click(files)
    await expect(files).toHaveAttribute("aria-selected", "true")
    // The selected chip paints a surface; the rest stay transparent.
    const pins = canvas.getByRole("tab", { name: "Pins" })
    await expect(getComputedStyle(files).backgroundColor).not.toBe(
      getComputedStyle(pins).backgroundColor,
    )
  },
}

export const VerticalManualActivation: Story = {
  parameters: storyDocumentation(
    "Vertical orientation with manual activation: arrow keys move focus down the list without selecting, and Enter or Space commits. Use manual activation when showing a panel is expensive — a fetch, a heavy render — so arrowing past a tab does not trigger it. The indicator moves to the list's inline-end edge and follows the writing direction.",
  ),
  render: () => (
    <Tabs
      defaultValue="general"
      orientation="vertical"
      activationMode="manual"
      className="h-40 w-96"
    >
      <TabsList aria-label="Sections" className="w-32">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="incidents">Incidents</TabsTrigger>
        <TabsTrigger value="releases">Releases</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className={panelClassName}>
        General chatter.
      </TabsContent>
      <TabsContent value="incidents" className={panelClassName}>
        Live incidents.
      </TabsContent>
      <TabsContent value="releases" className={panelClassName}>
        Release notes.
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("tablist", { name: "Sections" })
    await expect(list).toHaveAttribute("data-orientation", "vertical")

    const general = canvas.getByRole("tab", { name: "General" })
    const incidents = canvas.getByRole("tab", { name: "Incidents" })
    general.focus()

    // Manual activation: focus moves, selection does not follow it.
    await userEvent.keyboard("{ArrowDown}")
    await expect(incidents).toHaveFocus()
    await expect(incidents).toHaveAttribute("aria-selected", "false")
    await expect(general).toHaveAttribute("aria-selected", "true")

    await userEvent.keyboard("{Enter}")
    await expect(incidents).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "Live incidents.",
    )
  },
}

function ControlledTabs() {
  const [value, setValue] = React.useState("running")

  return (
    <div className="flex w-96 flex-col gap-3">
      <Tabs value={value} onValueChange={setValue}>
        <TabsList aria-label="Session drawers">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className={panelClassName}>
          Waiting on you.
        </TabsContent>
        <TabsContent value="running" className={panelClassName}>
          Still working.
        </TabsContent>
      </Tabs>
      <p className="nessa-text-2 text-muted-foreground">
        Host state: <span data-testid="tabs-value">{value}</span>
      </p>
    </div>
  )
}

export const Controlled: StoryObj = {
  parameters: storyDocumentation(
    "Host-controlled selection through value and onValueChange, for tabs driven by a router or a store. The readout below the panel is the host's own state, updated by the change handler.",
  ),
  render: () => <ControlledTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId("tabs-value")).toHaveTextContent("running")
    await userEvent.click(canvas.getByRole("tab", { name: "Inbox" }))
    await expect(canvas.getByTestId("tabs-value")).toHaveTextContent("inbox")
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "Waiting on you.",
    )
  },
}
