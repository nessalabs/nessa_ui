import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Switch } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "An on/off toggle for a setting that takes effect immediately, drawn to Checkbox's 18-pixel control scale so the two read as one family in a settings list. The checked track and thumb take the same primary wash as a checked box, and the thumb slides on the motion tokens. Controlled through `checked`/`onCheckedChange` or uncontrolled through `defaultChecked`; `name` and `value` enroll the switch in the surrounding form like a native input. Name it through a `label htmlFor`/`id` pair, `aria-label`, or `aria-labelledby`.",
      },
    },
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

const settings = [
  {
    id: "auto-start",
    label: "Auto-start workspaces",
    description: "Boot a workspace as soon as it is created.",
    defaultChecked: true,
  },
  {
    id: "auto-fetch",
    label: "Auto-fetch upstream",
    description: "Fetch the tracked remote on a schedule.",
    defaultChecked: false,
  },
  {
    id: "stale-gc",
    label: "Stale workspace cleanup",
    description: "Garbage-collect workspaces idle for 14 days.",
    defaultChecked: false,
  },
] as const

export const SettingsToggles: Story = {
  parameters: storyDocumentation(
    "The settings-panel pattern: each row pairs a switch with its label through htmlFor/id, so clicking the text toggles too, and the supporting copy stays outside the accessible name. Clicking or pressing Space flips the switch's checked state immediately — a switch commits on toggle, with no separate save action.",
  ),
  render: () => (
    <div className="flex w-96 flex-col divide-y divide-border font-sans text-sm">
      {settings.map((setting) => (
        <div key={setting.id} className="flex items-center justify-between gap-4 py-3">
          <div className="flex flex-col gap-0.5">
            <label htmlFor={setting.id} className="cursor-pointer font-medium text-foreground">
              {setting.label}
            </label>
            <span className="text-xs text-muted-foreground">{setting.description}</span>
          </div>
          <Switch id={setting.id} defaultChecked={setting.defaultChecked} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const autoStart = canvas.getByRole("switch", { name: "Auto-start workspaces" })
    const autoFetch = canvas.getByRole("switch", { name: "Auto-fetch upstream" })

    await expect(autoStart).toBeChecked()
    await expect(autoFetch).not.toBeChecked()

    await userEvent.click(autoFetch)
    await expect(autoFetch).toBeChecked()

    // Clicking the label toggles its switch, and Space toggles the
    // focused control.
    await userEvent.click(canvas.getByText("Auto-start workspaces"))
    await expect(autoStart).not.toBeChecked()
    autoStart.focus()
    await userEvent.keyboard(" ")
    await expect(autoStart).toBeChecked()
  },
}

export const States: Story = {
  parameters: storyDocumentation(
    "Every state side by side. Unchecked is identified by its boundary-strength border and muted thumb, checked takes the primary wash, and a disabled control fades as a whole while keeping its checked state legible.",
  ),
  render: () => (
    <div className="flex flex-col gap-3 font-sans text-sm text-foreground">
      <label className="flex cursor-pointer items-center gap-2">
        <Switch defaultChecked={false} />
        Off
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <Switch defaultChecked />
        On
      </label>
      <label className="flex items-center gap-2">
        <Switch disabled defaultChecked={false} />
        Disabled off
      </label>
      <label className="flex items-center gap-2">
        <Switch disabled defaultChecked />
        Disabled on
      </label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("switch", { name: "On" })).toBeChecked()
    await expect(canvas.getByRole("switch", { name: "Off" })).not.toBeChecked()

    const disabledOn = canvas.getByRole("switch", { name: "Disabled on" })
    await expect(disabledOn).toBeDisabled()
    await expect(disabledOn).toBeChecked()
  },
}

export const FormParticipation: Story = {
  parameters: storyDocumentation(
    "With name (and the default value \"on\"), the switch enrolls in the surrounding form like a native checkbox: FormData carries an entry for each checked switch and omits unchecked ones, so a settings form serializes without extra wiring.",
  ),
  render: () => (
    <form data-testid="workspace-settings" className="flex w-80 flex-col gap-3 font-sans text-sm text-foreground">
      <label className="flex cursor-pointer items-center justify-between gap-2">
        Auto-start workspaces
        <Switch name="autoStart" defaultChecked />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-2">
        Auto-fetch upstream
        <Switch name="autoFetch" />
      </label>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const form = canvas.getByTestId("workspace-settings") as HTMLFormElement

    let data = new FormData(form)
    await expect(data.get("autoStart")).toBe("on")
    await expect(data.get("autoFetch")).toBeNull()

    await userEvent.click(canvas.getByRole("switch", { name: "Auto-fetch upstream" }))
    data = new FormData(form)
    await expect(data.get("autoFetch")).toBe("on")
  },
}
