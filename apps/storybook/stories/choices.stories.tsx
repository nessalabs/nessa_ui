import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Choices, type ChoiceOption } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

function Swatch({ className }: { className: string }) {
  return <span className={`block h-10 w-full border border-border ${className}`} />
}

const themes: ChoiceOption[] = [
  { value: "light", label: "Light", visual: <Swatch className="bg-background" /> },
  { value: "dark", label: "Dark", visual: <Swatch className="bg-foreground" /> },
  {
    value: "system",
    label: "System",
    description: "Follows the computer",
    visual: <Swatch className="bg-muted" />,
  },
]

const meta = {
  title: "Primitives/Choices",
  component: Choices,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One choice among a few, each a card that can carry a picture and a line of description. It is a radio group on native radios: Tab reaches the chosen card, Arrow keys move the choice. Inside a `SettingsRow` (as the row's children) it is named by the row's label; elsewhere give it `aria-label`.",
      },
    },
  },
  args: { options: themes, defaultValue: "system", "aria-label": "Appearance" },
} satisfies Meta<typeof Choices>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Three cards with pictures. The play test proves the group and each card are named, the description is read as a description, and that a click and the Arrow keys move the choice.",
  ),
  render: (args) => (
    <div className="max-w-md">
      <Choices {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("radiogroup", { name: "Appearance" })).toBeInTheDocument()
    const system = canvas.getByRole("radio", { name: "System" })
    await expect(system).toBeChecked()
    await expect(system).toHaveAccessibleDescription("Follows the computer")
    await userEvent.click(canvas.getByRole("radio", { name: "Light" }))
    const light = canvas.getByRole("radio", { name: "Light" })
    await expect(light).toBeChecked()
    await expect(light).toHaveFocus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(canvas.getByRole("radio", { name: "Dark" })).toBeChecked()
    const card = canvas.getByRole("radio", { name: "Dark" }).closest("label")!
    await expect(card).toHaveAttribute("data-state", "checked")
  },
}

function ControlledExample() {
  const [density, setDensity] = React.useState("regular")
  return (
    <div className="flex max-w-md flex-col gap-2">
      <Choices
        aria-label="Density"
        value={density}
        onValueChange={setDensity}
        options={[
          { value: "compact", label: "Compact", description: "More rows on screen" },
          { value: "regular", label: "Regular" },
          { value: "roomy", label: "Roomy", disabled: true, description: "Coming later" },
        ]}
      />
      <p className="m-0 font-mono nessa-text-2 text-muted-foreground" data-testid="density">
        density: {density}
      </p>
    </div>
  )
}

export const Controlled: Story = {
  parameters: storyDocumentation(
    "Controlled, with one card unavailable. The play test proves the host hears each choice and a disabled card cannot be chosen.",
  ),
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("radio", { name: "Compact" }))
    await expect(canvas.getByTestId("density")).toHaveTextContent("density: compact")
    const roomy = canvas.getByRole("radio", { name: "Roomy" })
    await expect(roomy).toBeDisabled()
    await userEvent.click(roomy, { pointerEventsCheck: 0 })
    await expect(canvas.getByTestId("density")).toHaveTextContent("density: compact")
  },
}

export const FormReset: Story = {
  parameters: storyDocumentation(
    "An uncontrolled group in a form returns to its `defaultValue` when the form resets — the radio and the card's chosen look both. The play test chooses another card, resets the form, and proves the default is chosen again.",
  ),
  render: (args) => (
    <form className="flex max-w-md flex-col gap-2">
      <Choices {...args} />
      <button type="reset">Reset</button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("radio", { name: "Dark" }))
    await expect(canvas.getByRole("radio", { name: "Dark" })).toBeChecked()
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }))
    const system = canvas.getByRole("radio", { name: "System" })
    await expect(system).toBeChecked()
    await expect(system.closest("label")).toHaveAttribute("data-state", "checked")
    await expect(canvas.getByRole("radio", { name: "Dark" }).closest("label")).toHaveAttribute(
      "data-state",
      "unchecked",
    )
  },
}
