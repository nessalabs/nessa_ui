import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Laptop, Smartphone } from "lucide-react"
import {
  Button,
  Checkbox,
  Choices,
  EmptyState,
  KeyFingerprint,
  SettingsGroup,
  SettingsRow,
  StatusLabel,
  Switch,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/SettingsGroup",
  component: SettingsGroup,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A titled card of settings rows: a small muted heading, one card holding the rows with hairlines between them, and an optional footnote. `SettingsRow` is one line in it — a label with an optional detail line, an optional leading mark, and a control at the end. A control in the row with no name of its own is named by the row's label. Anything passed as a row's children sits under its label line, inside the row, for a fingerprint to compare or an inline message.",
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof SettingsGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Rows: Story = {
  parameters: storyDocumentation(
    "A group of plain rows. The play test proves the section is named by its title, the switch by its row's label, and rows after the first draw a hairline above.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup title="Linking" footnote="Linked devices sync conversations with this computer.">
        <SettingsRow
          label="Allow linking"
          detail="Listening on 192.168.1.20:7420"
          control={<Switch defaultChecked />}
        />
        <SettingsRow
          label="Require approval"
          detail="Unavailable while linking is off"
          control={<Switch />}
          disabled
        />
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "Linking" })).toBeInTheDocument()
    await expect(canvas.getByRole("switch", { name: "Allow linking" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    const rows = canvasElement.querySelectorAll<HTMLElement>("[data-slot=settings-row]")
    await expect(getComputedStyle(rows[0]!).borderTopWidth).toBe("0px")
    await expect(getComputedStyle(rows[1]!).borderTopWidth).toBe("1px")
    // A disabled row's switch is out of reach: disabled, skipped by Tab, unchanged by a key.
    const locked = canvas.getByRole("switch", { name: "Require approval" })
    await expect(locked).toBeDisabled()
    canvas.getByRole("switch", { name: "Allow linking" }).focus()
    await userEvent.tab()
    await expect(locked).not.toHaveFocus()
    await userEvent.keyboard(" ")
    await expect(locked).toHaveAttribute("aria-checked", "false")
  },
}

type Pending = { id: string; name: string; fingerprint: string; kind: "phone" | "laptop" }

const pending: Pending[] = [
  { id: "p1", name: "Pixel 9", kind: "phone", fingerprint: "9f3ac27e41bd0e88d6a573f1b0c45e92" },
]
const linked: Pending[] = [
  { id: "d1", name: "Work MacBook", kind: "laptop", fingerprint: "1c0de5a7e2b94f60" },
  { id: "d2", name: "iPhone", kind: "phone", fingerprint: "77aa0b3c9de41f28" },
]

function DeviceIcon({ kind }: { kind: Pending["kind"] }) {
  return (
    <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
      {kind === "phone" ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}
    </span>
  )
}

function LinkedDevicesExample() {
  const [devices, setDevices] = React.useState(linked)
  const [waiting, setWaiting] = React.useState(pending)
  return (
    <div className="flex max-w-xl flex-col gap-7">
      <SettingsGroup
        title="Waiting for approval"
        footnote="Check the fingerprint matches the one shown on the device before approving."
      >
        {waiting.length === 0 ? (
          <EmptyState variant="compact" title="No devices waiting" />
        ) : (
          waiting.map((device) => (
            <SettingsRow
              key={device.id}
              label={device.name}
              leading={<DeviceIcon kind={device.kind} />}
              control={
                <>
                  <Button size="sm" variant="ghost" onClick={() => setWaiting([])}>
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setWaiting([])
                      setDevices((all) => [...all, device])
                    }}
                  >
                    Approve
                  </Button>
                </>
              }
            >
              <KeyFingerprint value={device.fingerprint} />
            </SettingsRow>
          ))
        )}
      </SettingsGroup>
      <SettingsGroup title="Linked devices">
        {devices.map((device) => (
          <SettingsRow
            key={device.id}
            label={device.name}
            detail={<StatusLabel tone="good">Active</StatusLabel>}
            leading={<DeviceIcon kind={device.kind} />}
            control={
              <Button
                size="sm"
                variant="outline"
                aria-label={`Revoke ${device.name}`}
                onClick={() => setDevices((all) => all.filter((each) => each.id !== device.id))}
              >
                Revoke
              </Button>
            }
          />
        ))}
      </SettingsGroup>
    </div>
  )
}

export const NamedControls: Story = {
  parameters: storyDocumentation(
    "The row's label names whatever control sits at the end, not only a switch. The play test asks for a checkbox and a native select by the row label.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup title="Notifications">
        <SettingsRow label="Email digests" control={<Checkbox defaultChecked />} />
        <SettingsRow
          label="Frequency"
          control={
            <select
              defaultValue="daily"
              className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          }
        />
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("checkbox", { name: "Email digests" })).toBeChecked()
    await expect(canvas.getByRole("combobox", { name: "Frequency" })).toHaveValue("daily")
  },
}

export const DisabledContent: Story = {
  parameters: storyDocumentation(
    "A disabled row disables controls under the label as well as the one at the end. The play test proves the retry button is unavailable.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup title="Recovery">
        <SettingsRow label="Send again" disabled control={<Button>Send</Button>}>
          <Button>Retry</Button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeDisabled()
  },
}

export const LinkedDevices: Story = {
  parameters: storyDocumentation(
    "The rows composed into a linked-devices screen: a device waiting with its key fingerprint to compare, and linked devices to revoke. The play test approves the waiting device and proves it moves to the linked list.",
  ),
  render: () => <LinkedDevicesExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("img", { name: /^Key fingerprint 9F3A/ })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }))
    await expect(canvas.getByText("No devices waiting")).toBeInTheDocument()
    const list = canvas.getByRole("region", { name: "Linked devices" })
    await expect(within(list).getByText("Pixel 9")).toBeInTheDocument()
    await userEvent.click(within(list).getByRole("button", { name: "Revoke Pixel 9" }))
    await expect(within(list).queryByText("Pixel 9")).toBeNull()
  },
}

export const GroupDisabled: Story = {
  parameters: storyDocumentation(
    "`disabled` on the group disables every row at once, and `disabledReason` says why, once, above the card. The play test proves each row's control is unavailable and the reason describes the section.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup
        title="Approval"
        disabled
        disabledReason="Turn on linking to change these."
      >
        <SettingsRow label="Require approval" control={<Switch defaultChecked />} />
        <SettingsRow label="Notify on new device" control={<Switch />} />
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "Approval" })).toHaveAccessibleDescription(
      "Turn on linking to change these.",
    )
    await expect(canvas.getByRole("switch", { name: "Require approval" })).toBeDisabled()
    await expect(canvas.getByRole("switch", { name: "Notify on new device" })).toBeDisabled()
  },
}

function FoundAndPendingExample() {
  const [on, setOn] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  return (
    <div className="max-w-xl">
      <SettingsGroup title="Linking">
        <SettingsRow label="Device name" detail="Shown to devices you link" control={<Button size="sm" variant="outline">Rename</Button>} />
        <SettingsRow
          label="Allow linking"
          detail={pending ? "Applying…" : on ? "On" : "Off"}
          found
          pending={pending}
          control={
            <Switch
              checked={on}
              disabled={pending}
              onCheckedChange={(next) => {
                setOn(next)
                setPending(true)
              }}
            />
          }
        />
        <SettingsRow label="Finish applying" control={<Button size="sm" variant="ghost" onClick={() => setPending(false)}>Done</Button>} />
      </SettingsGroup>
    </div>
  )
}

export const FoundAndPending: Story = {
  parameters: storyDocumentation(
    "`found` washes a row a search matched; `pending` shows a small spinner beside the control and marks the row busy while a change is applied. The play test proves the found row is tinted and the others are not, and that turning the switch marks the row busy until the host finishes.",
  ),
  render: () => <FoundAndPendingExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rows = canvasElement.querySelectorAll<HTMLElement>("[data-slot=settings-row]")
    const found = rows[1]!
    await expect(found).toHaveAttribute("data-found", "true")
    await expect(getComputedStyle(found).backgroundColor).not.toBe(getComputedStyle(rows[0]!).backgroundColor)
    await userEvent.click(canvas.getByRole("switch", { name: "Allow linking" }))
    await expect(found).toHaveAttribute("aria-busy", "true")
    await expect(found.querySelector("[data-slot=settings-row-pending]")).not.toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await expect(found).not.toHaveAttribute("aria-busy")
    await expect(canvas.getByRole("switch", { name: "Allow linking" })).toHaveAttribute("aria-checked", "true")
  },
}

export const WithChoices: Story = {
  parameters: storyDocumentation(
    "A `Choices` control under a row's label takes the row's label as the group's name. The play test asks for the radio group by the row label.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup title="Appearance">
        <SettingsRow label="Theme" detail="How the window is drawn">
          <Choices
            defaultValue="system"
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System", description: "Follows the computer" },
            ]}
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("radiogroup", { name: "Theme" })
    await expect(within(group).getByRole("radio", { name: "System" })).toBeChecked()
  },
}

export const ChoicesInADisabledRow: Story = {
  parameters: storyDocumentation(
    "A `Choices` in a disabled row is dimmed once, by the row, like every other control there — not again by its cards, including a card that is unavailable on its own. The play test multiplies the opacity from each card up to the row and expects one half.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup title="Layout">
        <SettingsRow label="Density" disabled>
          <Choices
            defaultValue="regular"
            options={[
              { value: "compact", label: "Compact" },
              { value: "regular", label: "Regular" },
              { value: "roomy", label: "Roomy", disabled: true },
            ]}
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvasElement.querySelector<HTMLElement>("[data-slot=settings-row]")!
    const effectiveOpacity = (element: Element) => {
      let opacity = 1
      for (let node: Element | null = element; node && node !== row; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity)
      }
      return opacity
    }
    for (const name of ["Compact", "Roomy"]) {
      const radio = canvas.getByRole("radio", { name })
      await expect(radio).toBeDisabled()
      await expect(effectiveOpacity(radio.closest("label")!)).toBe(0.5)
    }
  },
}

export const ContentKeepsItsName: Story = {
  parameters: storyDocumentation(
    "A control among a row's content keeps its own name; only `Choices` takes the row's label there. The play test asks for the row's switch and a sub-option switch under it by their own names.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup title="Notifications">
        <SettingsRow label="Notify me" control={<Switch defaultChecked />}>
          <label className="flex items-center gap-2 nessa-text-2 text-muted-foreground">
            <Switch />
            Only when I am away
          </label>
        </SettingsRow>
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("switch", { name: "Notify me" })).toBeChecked()
    await expect(canvas.getByRole("switch", { name: "Only when I am away" })).not.toBeChecked()
  },
}

export const OwnStateWins: Story = {
  parameters: storyDocumentation(
    "`found` and `pending` own `data-found`, `data-pending` and `aria-busy`: the row writes them after the props passed through, so a stray attribute cannot contradict the row's state. The play test passes conflicting attributes and proves the row's own values win.",
  ),
  render: () => (
    <div className="max-w-xl">
      <SettingsGroup title="Sync">
        <SettingsRow
          label="Sync history"
          aria-busy={true}
          {...{ "data-found": "true", "data-pending": "true" }}
          control={<Switch />}
        />
      </SettingsGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>("[data-slot=settings-row]")!
    await expect(row).not.toHaveAttribute("aria-busy")
    await expect(row).not.toHaveAttribute("data-found")
    await expect(row).not.toHaveAttribute("data-pending")
  },
}
