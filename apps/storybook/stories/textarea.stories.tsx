import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Textarea } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A multi-line text field styled to match Input exactly — the same hairline field border, invalid (`aria-invalid`) and disabled states, and focus treatment — so single-line and multi-line entry read as one family in a form. The field grows with its content from a four-line minimum through `field-sizing-content`; cap it with a `max-h-*` class when the host needs a ceiling.",
      },
    },
  },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const EnvironmentVariables: Story = {
  parameters: storyDocumentation(
    "The env-editing pattern from a workspace create form: a labelled textarea holding one KEY=value pair per line, with monospace type layered on through className. Typing appends lines and the field grows with its content instead of scrolling.",
  ),
  render: () => (
    <div className="flex w-96 flex-col gap-1.5 font-sans">
      <label htmlFor="workspace-env" className="text-sm font-medium text-foreground">
        Environment variables
      </label>
      <Textarea
        id="workspace-env"
        name="env"
        className="font-mono"
        placeholder="KEY=value, one per line"
        defaultValue={"NODE_ENV=development\nPORT=4180"}
      />
      <p className="text-xs text-muted-foreground">
        Applied when the workspace boots; secrets belong in the vault instead.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole("textbox", { name: "Environment variables" })
    await expect(field).toHaveValue("NODE_ENV=development\nPORT=4180")

    await userEvent.click(field)
    await userEvent.keyboard("{End}")
    await userEvent.type(field, "\nREDIS_URL=redis://redis:6379")
    await expect(field).toHaveValue(
      "NODE_ENV=development\nPORT=4180\nREDIS_URL=redis://redis:6379",
    )
  },
}

export const InvalidAndDisabled: Story = {
  parameters: storyDocumentation(
    "Input's states carried over verbatim: aria-invalid swaps the hairline for the destructive border and ties the field to its error line through aria-describedby, and a disabled field fades and stops accepting input while keeping its text legible.",
  ),
  render: () => (
    <div className="flex w-96 flex-col gap-6 font-sans">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="workspace-notes" className="text-sm font-medium text-foreground">
          Notes
        </label>
        <Textarea
          id="workspace-notes"
          aria-invalid
          aria-describedby="workspace-notes-error"
          defaultValue="Repro steps for the flaky deploy pipeline…"
        />
        <p id="workspace-notes-error" className="text-xs text-destructive">
          Notes cannot exceed 2,000 characters.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="archived-notes" className="text-sm font-medium text-foreground">
          Notes (archived workspace)
        </label>
        <Textarea
          id="archived-notes"
          disabled
          defaultValue="This workspace was garbage-collected on 2026-08-14."
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const invalid = canvas.getByRole("textbox", { name: "Notes" })
    await expect(invalid).toHaveAttribute("aria-invalid", "true")
    await expect(invalid).toHaveAccessibleDescription(
      "Notes cannot exceed 2,000 characters.",
    )

    await expect(
      canvas.getByRole("textbox", { name: "Notes (archived workspace)" }),
    ).toBeDisabled()
  },
}
