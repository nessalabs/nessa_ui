import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Laptop, Smartphone } from "lucide-react"
import {
  Button,
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
