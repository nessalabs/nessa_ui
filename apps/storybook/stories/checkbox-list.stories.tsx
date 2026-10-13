import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  CheckboxList,
  SettingsGroup,
  SettingsRow,
  type CheckboxListOption,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const hosts: CheckboxListOption[] = [
  { value: "build-box", label: "build-box", description: "SSH · ci@build-box.internal" },
  { value: "peer:studio-mac", label: "studio-mac", description: "Linked device" },
  { value: "staging", label: "staging", description: "SSH · deploy@staging.example.com" },
  {
    value: "peer:old-laptop",
    label: "old-laptop",
    description: "Linked device",
    disabled: true,
    disabledReason: "Offline since last week",
  },
  { value: "gpu-1", label: "gpu-1", description: "SSH · ml@gpu-1.lab" },
]

const meta = {
  title: "Primitives/CheckboxList",
  component: CheckboxList,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Several choices from a list: a labelled group of native checkboxes, each row with an optional line of description, in one card with hairlines between rows as in a SettingsGroup. It is controlled — `value` is the checked values and `onValueChange` receives the whole next selection. A row can be unavailable with a reason that is shown under it and read as its description. `max` caps the selection: at the cap the unchecked rows become unavailable, and the count hint beside the label (\"3 of 5 selected\") describes the group and is announced as it changes. The group holds one tab stop, and Arrow keys, Home and End move between rows through the same collection engine as Nessa's listboxes; Space checks.",
      },
    },
  },
  args: { options: hosts, value: [], onValueChange: fn() },
} satisfies Meta<typeof CheckboxList>

export default meta
type Story = StoryObj<typeof meta>

function HostPicker(props: Partial<React.ComponentProps<typeof CheckboxList>>) {
  const [value, setValue] = React.useState<string[]>(["staging"])
  return (
    <div className="max-w-md">
      <CheckboxList
        label="Command hosts"
        options={hosts}
        value={value}
        onValueChange={setValue}
        {...props}
      />
    </div>
  )
}

export const Hosts: Story = {
  parameters: storyDocumentation(
    "The host picker a share dialog uses. The play test proves the group is named by its label and described by its count, that each checkbox is named by its row label alone and described by its row's line, that clicking a row checks it and reports the selection in the options' order, and that the count follows.",
  ),
  render: () => <HostPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("group", { name: "Command hosts" })
    await expect(group).toHaveAccessibleDescription("1 of 5 selected")

    const build = canvas.getByRole("checkbox", { name: "build-box" })
    await expect(build).toHaveAccessibleDescription("SSH · ci@build-box.internal")
    await expect(canvas.getByRole("checkbox", { name: "staging" })).toBeChecked()

    // The row's text, not only the box, is the target.
    await userEvent.click(canvas.getByText("SSH · ci@build-box.internal"))
    await expect(build).toBeChecked()
    await expect(group).toHaveAccessibleDescription("2 of 5 selected")
    await expect(group.querySelector("[data-slot=checkbox-list-count]")).toHaveAttribute(
      "aria-live",
      "polite",
    )
  },
}

export const ReportsTheSelection: Story = {
  parameters: storyDocumentation(
    "`onValueChange` receives the whole next selection, in the options' order, with any value that is not among the options kept at the end — a host that has gone away is not dropped by the next unrelated change. Such a value is not counted, and cannot use up `max`: nothing on screen could uncheck it. With `name`, a form submits exactly `value`, kept values and unavailable rows included.",
  ),
  args: { onValueChange: fn() },
  render: (args) => (
    <form aria-label="Share" className="max-w-md">
      <CheckboxList
        label="Command hosts"
        name="hosts"
        options={hosts}
        value={["gpu-1", "peer:retired"]}
        onValueChange={args.onValueChange}
        max={2}
      />
    </form>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("group", { name: "Command hosts" })
    await expect(group).toHaveAccessibleDescription("1 of 2 selected")
    await expect(group).not.toHaveAttribute("data-limit-reached")
    const form = canvas.getByRole("form", { name: "Share" }) as HTMLFormElement
    await expect(new FormData(form).getAll("hosts")).toEqual(["gpu-1", "peer:retired"])
    await userEvent.click(canvas.getByRole("checkbox", { name: "build-box" }))
    await expect(args.onValueChange).toHaveBeenLastCalledWith(["build-box", "gpu-1", "peer:retired"])
    await userEvent.click(canvas.getByRole("checkbox", { name: "gpu-1" }))
    await expect(args.onValueChange).toHaveBeenLastCalledWith(["peer:retired"])
  },
}

export const Keyboard: Story = {
  // Focus order and roving tab stops are engine-shaped.
  tags: ["cross-engine"],
  parameters: storyDocumentation(
    "One tab stop for the whole list, resting on the first checked row. Arrow keys wrap through the rows, Home and End jump to the ends, and Space checks the focused row. An unavailable row is still visited, so its reason is read, but Space does not check it. Tab leaves the list.",
  ),
  render: () => (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="self-start">
        Before
      </Button>
      <HostPicker />
      <Button variant="ghost" size="sm" className="self-start">
        After
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole("button", { name: "Before" }).focus()

    await userEvent.tab()
    const staging = canvas.getByRole("checkbox", { name: "staging" })
    await expect(staging).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}")
    const offline = canvas.getByRole("checkbox", { name: "old-laptop" })
    await expect(offline).toHaveFocus()
    await expect(offline).toHaveAttribute("aria-disabled", "true")
    await expect(offline).toHaveAccessibleDescription("Linked device Offline since last week")
    await userEvent.keyboard(" ")
    await expect(offline).not.toBeChecked()

    await userEvent.keyboard("{ArrowDown}")
    await expect(canvas.getByRole("checkbox", { name: "gpu-1" })).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}")
    const build = canvas.getByRole("checkbox", { name: "build-box" })
    await expect(build).toHaveFocus()
    await userEvent.keyboard(" ")
    await expect(build).toBeChecked()

    await userEvent.keyboard("{End}")
    await expect(canvas.getByRole("checkbox", { name: "gpu-1" })).toHaveFocus()
    await userEvent.keyboard("{Home}")
    await expect(build).toHaveFocus()
    await userEvent.keyboard("{ArrowUp}")
    await expect(canvas.getByRole("checkbox", { name: "gpu-1" })).toHaveFocus()

    // One stop: Tab leaves the list from whichever row holds it, and takes
    // the row's highlight with it.
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "After" })).toHaveFocus()
    await expect(canvasElement.querySelector("[data-highlighted]")).toBeNull()
    await userEvent.tab({ shift: true })
    await expect(canvas.getByRole("checkbox", { name: "gpu-1" })).toHaveFocus()
  },
}

export const Limit: Story = {
  parameters: storyDocumentation(
    "`max` caps the selection. At the cap every unchecked row becomes unavailable — still reachable by Arrow keys, and read with `limitReason` as its description — and the count says where the selection stands. Unchecking one makes the rest available again.",
  ),
  render: () => <HostPicker max={2} limitReason="Uses the policy's last free entry" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("group", { name: "Command hosts" })
    await expect(group).toHaveAccessibleDescription("1 of 2 selected")

    await userEvent.click(canvas.getByRole("checkbox", { name: "build-box" }))
    await expect(group).toHaveAccessibleDescription("2 of 2 selected")
    await expect(group).toHaveAttribute("data-limit-reached", "true")

    const gpu = canvas.getByRole("checkbox", { name: "gpu-1" })
    await expect(gpu).toHaveAttribute("aria-disabled", "true")
    await expect(gpu).toHaveAccessibleDescription("SSH · ml@gpu-1.lab Uses the policy's last free entry")
    await userEvent.click(gpu)
    await expect(gpu).not.toBeChecked()
    await expect(group).toHaveAccessibleDescription("2 of 2 selected")

    await userEvent.click(canvas.getByRole("checkbox", { name: "staging" }))
    await expect(gpu).not.toHaveAttribute("aria-disabled")
    await userEvent.click(gpu)
    await expect(gpu).toBeChecked()
  },
}

export const SkippedDisabledRows: Story = {
  parameters: storyDocumentation(
    "With `disabledBehavior=\"skipped\"`, an unavailable row is natively disabled: Arrow keys step over it and it leaves the tab order, for a list where an unavailable row is noise rather than information. Its reason is still shown under it.",
  ),
  render: () => <HostPicker disabledBehavior="skipped" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const staging = canvas.getByRole("checkbox", { name: "staging" })
    staging.focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect(canvas.getByRole("checkbox", { name: "gpu-1" })).toHaveFocus()
    await expect(canvas.getByRole("checkbox", { name: "old-laptop" })).toBeDisabled()
    await expect(canvas.getByText("Offline since last week")).toBeVisible()
  },
}

export const InASettingsRow: Story = {
  parameters: storyDocumentation(
    "Placed as a SettingsRow's content with no label of its own, the list is named by the row's label, as Choices is. A custom `count` writes the hint, and an empty one describes nothing — but its live region stays mounted, so the first words it gains are announced. `count={false}` removes it.",
  ),
  render: function InASettingsRowExample() {
    const [value, setValue] = React.useState<string[]>([])
    return (
      <div className="max-w-xl">
        <SettingsGroup title="Sharing">
          <SettingsRow label="Hosts that take commands" detail="A grant that names none runs commands nowhere.">
            <CheckboxList
              // The conditional form of "no label of its own".
              label={null}
              options={hosts.slice(0, 3)}
              value={value}
              onValueChange={setValue}
              count={({ selected }) => (selected === 0 ? "" : `${selected} chosen`)}
            />
          </SettingsRow>
        </SettingsGroup>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("group", { name: "Hosts that take commands" })
    await expect(group).not.toHaveAttribute("aria-describedby")
    const live = group.querySelector("[data-slot=checkbox-list-count]")
    await expect(live).toHaveAttribute("aria-live", "polite")
    await expect(live).toBeEmptyDOMElement()
    await userEvent.click(canvas.getByRole("checkbox", { name: "staging" }))
    await waitFor(async () => {
      await expect(group).toHaveAccessibleDescription("1 chosen")
    })
  },
}

export const Empty: Story = {
  parameters: storyDocumentation(
    "With no rows the card says so instead of collapsing to a hairline, and the count reads zero of zero.",
  ),
  render: () => (
    <div className="max-w-md">
      <CheckboxList
        label="Command hosts"
        options={[]}
        value={[]}
        onValueChange={() => {}}
        emptyMessage="No hosts take commands yet"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No hosts take commands yet")).toBeVisible()
    await expect(canvas.getByRole("group", { name: "Command hosts" })).toHaveAccessibleDescription(
      "0 of 0 selected",
    )
  },
}
