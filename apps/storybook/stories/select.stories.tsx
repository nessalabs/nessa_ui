import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A single-value picker on the popover surface. The trigger shares Input's hairline field border so pickers and text fields read as one family; the floating list positions under it like a menu, pages long lists with scroll chevrons, and composes groups with labels, separators, and disabled options. As in Nessa's menus, the accent wash marks only the highlighted row — the chosen option is shown by the leading check indicator alone. `name` enrolls the choice in the surrounding form.",
      },
    },
  },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const BaseBranchPicker: Story = {
  parameters: storyDocumentation(
    "The simple-picker case: choosing the base branch for a new workspace. The trigger shows the placeholder until a value is chosen, opens on click or arrow keys, and typing while open jumps to matching options. The trigger carries an aria-label naming the choice.",
  ),
  render: () => (
    <Select defaultValue="main">
      <SelectTrigger aria-label="Base branch" className="w-56">
        <SelectValue placeholder="Choose a branch" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="main">main</SelectItem>
        <SelectItem value="develop">develop</SelectItem>
        <SelectItem value="release/2026-08">release/2026-08</SelectItem>
        <SelectItem value="feat/rate-limits">feat/rate-limits</SelectItem>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("combobox", { name: "Base branch" })
    await expect(trigger).toHaveTextContent("main")

    await userEvent.click(trigger)
    const listbox = await body.findByRole("listbox")
    const develop = within(listbox).getByRole("option", { name: "develop" })
    await expect(
      within(listbox).getByRole("option", { name: "main" }),
    ).toHaveAttribute("aria-selected", "true")

    await userEvent.click(develop)
    await waitFor(() =>
      expect(body.queryByRole("listbox")).not.toBeInTheDocument(),
    )
    await expect(trigger).toHaveTextContent("develop")
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const GroupedOptions: Story = {
  parameters: storyDocumentation(
    "Groups with labels, a separator between them, and a disabled option: the machine-size picker. Labels are headings, not options — keyboard navigation skips them — and the disabled size is announced but not selectable.",
  ),
  render: () => (
    <Select>
      <SelectTrigger aria-label="Machine size" className="w-64">
        <SelectValue placeholder="Choose a machine size" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Shared</SelectLabel>
          <SelectItem value="small">Small — 2 vCPU, 4 GB</SelectItem>
          <SelectItem value="medium">Medium — 4 vCPU, 8 GB</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Dedicated</SelectLabel>
          <SelectItem value="large">Large — 8 vCPU, 16 GB</SelectItem>
          <SelectItem value="xlarge" disabled>
            XL — 16 vCPU, 32 GB (at capacity)
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("combobox", { name: "Machine size" })

    await userEvent.click(trigger)
    const listbox = await body.findByRole("listbox")
    await expect(within(listbox).getByText("Shared")).toBeVisible()
    await expect(
      within(listbox).getByRole("option", { name: /XL — 16 vCPU/ }),
    ).toHaveAttribute("aria-disabled", "true")

    await userEvent.click(
      within(listbox).getByRole("option", { name: /Large — 8 vCPU/ }),
    )
    await waitFor(() =>
      expect(body.queryByRole("listbox")).not.toBeInTheDocument(),
    )
    await expect(trigger).toHaveTextContent("Large — 8 vCPU, 16 GB")
  },
}
