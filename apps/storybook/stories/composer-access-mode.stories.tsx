import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  ComposerAccessMode,
  type ComposerAccessModeValue,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const accessModes: ComposerAccessModeValue[] = [
  "ask-approval",
  "auto-approval",
  "full-access",
]

const plainShieldPath =
  "M8.16963 1.22703C8.33372 1.16922 8.67031 1.05063 9.00028 1.05075C9.1795 1.05082 9.36084 1.079 9.53357 1.13368L14.7836 2.81368C15.5071 3.04612 16 3.71943 16 4.48V11C16 12.8725 14.6025 14.2314 13.2749 15.1143C12.1533 15.8602 10.9062 16.4082 9.63302 16.8379C9.57968 16.8559 9.49355 16.8849 9.40738 16.9058C9.09216 16.9819 8.76807 16.9684 8.46011 16.8683C7.80803 16.6572 6.25089 16.1022 4.84192 15.1909C3.47441 14.3064 2 12.9239 2 11V4.48C2 3.71932 2.49139 3.04506 3.21675 2.81358C4.86562 2.28594 6.53686 1.80232 8.16963 1.22703Z"
const fullAccessSlashPath =
  "M16.5303 1.46967C16.8232 1.76256 16.8232 2.23744 16.5303 2.53033L2.53033 16.5303C2.23744 16.8232 1.76256 16.8232 1.46967 16.5303C1.17678 16.2374 1.17678 15.7626 1.46967 15.4697L15.4697 1.46967C15.7626 1.17678 16.2374 1.17678 16.5303 1.46967Z"
const fullAccessShieldPaths = [
  "M15.067 2.93298C14.9773 2.88556 14.8826 2.84549 14.7836 2.81368L9.53357 1.13368C9.36084 1.079 9.1795 1.05082 9.00028 1.05075C8.67031 1.05063 8.33372 1.16922 8.16963 1.22703C7.07517 1.61265 5.96344 1.95708 4.85274 2.30119C4.30643 2.47044 3.76038 2.63962 3.21675 2.81358C2.49139 3.04506 2 3.71932 2 4.48V11C2 12.3767 2.75502 13.4762 3.6856 14.3144L15.067 2.93298Z",
  "M16 5.18196L5.56107 15.6209C6.74951 16.2793 7.91779 16.6928 8.4601 16.8683C8.76806 16.9684 9.09215 16.9819 9.40737 16.9058C9.49355 16.8849 9.57968 16.8559 9.63302 16.8379C10.9062 16.4082 12.1533 15.8602 13.2749 15.1143C14.6025 14.2314 16 12.8725 16 11V5.18196Z",
  fullAccessSlashPath,
] as const
const autoApprovalCheckPath =
  "M11.9549 6.15141C12.2855 6.40097 12.3512 6.87128 12.1016 7.20187L8.70461 11.7019C8.57662 11.8714 8.38274 11.9787 8.17111 11.9972C7.95949 12.0156 7.74997 11.9434 7.59459 11.7986L5.98559 10.2986C5.68261 10.0161 5.66598 9.54155 5.94843 9.23858C6.23088 8.9356 6.70546 8.91896 7.00843 9.20141L8.00877 10.134L10.9044 6.29813C11.154 5.96754 11.6243 5.90185 11.9549 6.15141Z"

const meta = {
  title: "Conversation/ComposerAccessMode",
  component: ComposerAccessMode,
  tags: ["autodocs", "test"],
  args: {
    value: "full-access",
  },
  parameters: {
    docs: {
      description: {
        component:
          "An icon-first composer dropdown for Ask for approval, Auto approval, and Full access using the licensed Nucleo shield icon family supplied for this component. The icons are included in Nessa's tracked Nucleo inventory; Full access is last and uses the destructive semantic color.",
      },
    },
  },
} satisfies Meta<typeof ComposerAccessMode>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Use the controlled value and onValueChange to select the active tool-approval policy beside the composer actions.",
  ),
  render: () => {
    const [value, setValue] = React.useState<ComposerAccessModeValue>(
      "full-access",
    )
    return (
      <div className="flex min-h-40 items-end rounded-3xl border border-border bg-card p-5">
        <ComposerAccessMode
          value={value}
          onValueChange={setValue}
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const documentBody = within(canvasElement.ownerDocument.body)
    const control = canvas.getByRole("button", {
      name: "Access mode: Full access",
    })
    await expect(control).toHaveAttribute("data-access-mode", "full-access")
    control.focus()
    await expect(control).toHaveFocus()
    await userEvent.keyboard("{Enter}")

    const options = documentBody.getAllByRole("menuitemradio")
    await expect(options.map((option) => option.textContent)).toEqual([
      "Ask for approval",
      "Auto approval",
      "Full access",
    ])
    await expect(
      documentBody.getByRole("menuitemradio", { name: "Full access" }),
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{ArrowDown}")
    await expect(
      documentBody.getByRole("menuitemradio", { name: "Auto approval" }),
    ).toHaveFocus()
    await userEvent.keyboard("{Enter}")

    const autoControl = canvas.getByRole("button", {
      name: "Access mode: Auto approval",
    })
    await expect(autoControl).toHaveAttribute(
      "data-access-mode",
      "auto-approval",
    )
    await userEvent.click(autoControl)
    await userEvent.click(
      documentBody.getByRole("menuitemradio", { name: "Ask for approval" }),
    )
    await expect(
      canvas.getByRole("button", { name: "Access mode: Ask for approval" }),
    ).toHaveAttribute("data-access-mode", "ask-approval")
  },
}

export const AllModes: Story = {
  parameters: storyDocumentation(
    "The three supplied shield silhouettes remain visually distinct at the composer's compact 18px icon size.",
  ),
  render: () => (
    <div className="flex flex-wrap gap-2 rounded-3xl border border-border bg-card p-5">
      {accessModes.map((value) => (
        <ComposerAccessMode key={value} value={value} showLabel />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const askIcon = canvasElement.querySelector(
      '[data-access-mode-icon="ask-approval"]',
    )
    const autoIcon = canvasElement.querySelector(
      '[data-access-mode-icon="auto-approval"]',
    )
    const fullIcon = canvasElement.querySelector(
      '[data-access-mode-icon="full-access"]',
    )
    const askPaths = askIcon?.querySelectorAll("path")
    const autoPaths = autoIcon?.querySelectorAll("path")
    const fullPaths = fullIcon?.querySelectorAll("path")

    await expect(askPaths).toHaveLength(1)
    await expect(askPaths?.[0]).toHaveAttribute("d", plainShieldPath)
    await expect(askPaths?.[0]).toHaveAttribute("fill-opacity", "0.4")
    await expect(askPaths?.[0]).toHaveAttribute("fill-rule", "evenodd")
    await expect(askPaths?.[0]).toHaveAttribute("clip-rule", "evenodd")

    await expect(autoPaths).toHaveLength(2)
    await expect(autoPaths?.[0]).toHaveAttribute("d", plainShieldPath)
    await expect(autoPaths?.[0]).toHaveAttribute("fill-opacity", "0.4")
    await expect(autoPaths?.[1]).toHaveAttribute(
      "d",
      autoApprovalCheckPath,
    )
    await expect(autoPaths?.[1]).toHaveAttribute("fill-rule", "evenodd")
    await expect(autoPaths?.[1]).toHaveAttribute("clip-rule", "evenodd")

    await expect(fullPaths).toHaveLength(3)
    for (const [index, path] of fullAccessShieldPaths.entries()) {
      await expect(fullPaths?.[index]).toHaveAttribute("d", path)
    }
    await expect(fullPaths?.[0]).toHaveAttribute("fill-opacity", "0.4")
    await expect(fullPaths?.[1]).toHaveAttribute("fill-opacity", "0.4")
    await expect(fullPaths?.[2]).toHaveAttribute("fill-rule", "evenodd")
    await expect(fullPaths?.[2]).toHaveAttribute("clip-rule", "evenodd")
    await expect(
      canvas.getByRole("button", { name: "Access mode: Full access" }),
    ).toHaveClass("text-destructive")
  },
}

export const IconOnly: Story = {
  parameters: storyDocumentation(
    "Icon-only usage retains the mode label as the button's accessible name.",
  ),
  args: {
    value: "ask-approval",
    showLabel: false,
  },
}
