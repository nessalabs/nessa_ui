import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Checkbox } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A real `input type=\"checkbox\"` styled in place, so keyboard and form semantics stay native and FormData sees the value. Supports the mixed state through `indeterminate`: the DOM flag is a property rather than an attribute, and the browser clears it on every click, so the component restores it synchronously on click as well as after each render — which makes it the control for a select-all whose rows are only partly selected.",
      },
    },
  },
  argTypes: {
    indeterminate: {
      control: "boolean",
      description: "Renders the mixed state: a dash instead of a check.",
    },
    disabled: { control: "boolean" },
  },
  args: { indeterminate: false, disabled: false },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Use the controls to compare the unchecked, checked, mixed, and disabled boxes.",
  ),
  render: (args) => <Checkbox aria-label="Select row" {...args} />,
}

export const States: Story = {
  parameters: storyDocumentation(
    "Every state side by side. The mixed box draws a dash and is reported as mixed natively, through the DOM indeterminate property; checked and mixed share the same primary wash and border, and a disabled control fades as a whole.",
  ),
  render: () => (
    <div className="flex flex-col gap-3 font-sans text-sm text-foreground">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox defaultChecked={false} />
        Unchecked
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox defaultChecked />
        Checked
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox indeterminate />
        Mixed
      </label>
      <label className="flex items-center gap-2">
        <Checkbox disabled defaultChecked />
        Disabled
      </label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mixed = canvas.getByRole("checkbox", { name: "Mixed" })
    await expect((mixed as HTMLInputElement).indeterminate).toBe(true)

    await expect(canvas.getByRole("checkbox", { name: "Checked" })).toBeChecked()
    await expect(canvas.getByRole("checkbox", { name: "Disabled" })).toBeDisabled()

    const unchecked = canvas.getByRole("checkbox", { name: "Unchecked" })
    await expect(unchecked).not.toBeChecked()
    await userEvent.click(unchecked)
    await expect(unchecked).toBeChecked()

    // A click clears the DOM indeterminate flag before flipping checkedness,
    // and this box is uncontrolled, so nothing re-renders to restore it. The
    // prop is still the source of truth, so the mixed state must survive.
    await userEvent.click(mixed)
    await expect((mixed as HTMLInputElement).indeterminate).toBe(true)
  },
}

function SelectAllDemo() {
  const rows = ["Refactor billing webhooks", "Debug flaky deploy pipeline", "Nightly registry validation"]
  const [selected, setSelected] = React.useState<string[]>([rows[0]])
  const allSelected = selected.length === rows.length
  const someSelected = selected.length > 0 && !allSelected

  return (
    <div className="flex w-80 flex-col gap-2 font-sans text-sm text-foreground">
      <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 font-medium">
        <Checkbox
          aria-label="Select all traces"
          checked={allSelected}
          indeterminate={someSelected}
          onChange={(event) => setSelected(event.target.checked ? [...rows] : [])}
        />
        Select all
      </label>
      {rows.map((row) => (
        <label key={row} className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={selected.includes(row)}
            onChange={(event) =>
              setSelected((current) =>
                event.target.checked
                  ? [...current, row]
                  : current.filter((item) => item !== row),
              )
            }
          />
          {row}
        </label>
      ))}
    </div>
  )
}

export const SelectAll: Story = {
  parameters: storyDocumentation(
    "The select-all pattern: the header box is checked when every row is selected and mixed when only some are, so one glance distinguishes \"all\" from \"some\". Toggling it selects or clears every row.",
  ),
  render: () => <SelectAllDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const selectAll = canvas.getByRole("checkbox", {
      name: "Select all traces",
    }) as HTMLInputElement
    await expect(selectAll.indeterminate).toBe(true)

    await userEvent.click(selectAll)
    await waitFor(() => expect(selectAll).toBeChecked())
    await expect(selectAll.indeterminate).toBe(false)
    for (const row of canvas.getAllByRole("checkbox")) {
      await expect(row).toBeChecked()
    }

    await userEvent.click(selectAll)
    await waitFor(() => expect(selectAll).not.toBeChecked())
  },
}
