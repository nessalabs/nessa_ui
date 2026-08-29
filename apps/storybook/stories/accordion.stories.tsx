import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Input,
  Textarea,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Accordion",
  component: Accordion,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Vertically stacked disclosure sections. `type=\"single\"` keeps at most one open (add `collapsible` to allow closing it again); `type=\"multiple\"` lets sections open independently. Items separate with the design system's hairline rule, the trigger row rotates its chevron while open, and content height animates through Radix's measured `--radix-accordion-content-height` on the motion tokens — cutting instantly under reduced motion. Radix wires each trigger to its region with `aria-expanded` and heading semantics.",
      },
    },
  },
} satisfies Meta<typeof Accordion>

export default meta
type Story = StoryObj<typeof meta>

export const AdvancedOptions: Story = {
  parameters: storyDocumentation(
    "The create-form pattern: optional configuration folded into an \"Advanced options\" accordion so the default path stays short. type=\"single\" collapsible keeps at most one section open — expanding another closes the first — and clicking an open trigger closes it again.",
  ),
  args: { type: "single", collapsible: true },
  render: () => (
    <Accordion type="single" collapsible className="w-[26rem] max-w-full">
      <AccordionItem value="env">
        <AccordionTrigger>Environment variables</AccordionTrigger>
        <AccordionContent>
          <Textarea
            aria-label="Environment variables"
            className="font-mono"
            placeholder="KEY=value, one per line"
          />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="resources">
        <AccordionTrigger>Resource limits</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">vCPU cap</span>
            <Input aria-label="vCPU cap" defaultValue="4" className="w-24" />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Memory cap (GB)</span>
            <Input aria-label="Memory cap in gigabytes" defaultValue="8" className="w-24" />
          </label>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="hooks">
        <AccordionTrigger>Lifecycle hooks</AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground">
            Run a command after clone, before boot, or on teardown. Hooks
            execute in the workspace container with the env above.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const env = canvas.getByRole("button", { name: "Environment variables" })
    const resources = canvas.getByRole("button", { name: "Resource limits" })

    await expect(env).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(env)
    await expect(env).toHaveAttribute("aria-expanded", "true")
    await expect(
      await canvas.findByRole("textbox", { name: "Environment variables" }),
    ).toBeVisible()

    // Single mode: opening another section closes the first.
    await userEvent.click(resources)
    await expect(resources).toHaveAttribute("aria-expanded", "true")
    await expect(env).toHaveAttribute("aria-expanded", "false")
    await waitFor(() =>
      expect(
        canvas.queryByRole("textbox", { name: "Environment variables" }),
      ).not.toBeInTheDocument(),
    )

    // Collapsible: an open trigger closes its own section again.
    await userEvent.click(resources)
    await expect(resources).toHaveAttribute("aria-expanded", "false")
  },
}

export const MultipleSections: Story = {
  parameters: storyDocumentation(
    "type=\"multiple\" for review surfaces where sections are read side by side rather than traded: each trigger toggles independently, so several sections stay open at once, and defaultValue preopens any of them.",
  ),
  args: { type: "multiple" },
  render: () => (
    <Accordion type="multiple" defaultValue={["env"]} className="w-[26rem] max-w-full">
      <AccordionItem value="env">
        <AccordionTrigger>Environment variables (2)</AccordionTrigger>
        <AccordionContent>
          <pre className="font-mono text-xs leading-5 text-muted-foreground">
            {"NODE_ENV=development\nPORT=4180"}
          </pre>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="resources">
        <AccordionTrigger>Resource limits</AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground">4 vCPU · 8 GB memory</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const env = canvas.getByRole("button", { name: "Environment variables (2)" })
    const resources = canvas.getByRole("button", { name: "Resource limits" })

    // defaultValue preopens the env section.
    await expect(env).toHaveAttribute("aria-expanded", "true")

    // Multiple mode: opening the second section leaves the first open.
    await userEvent.click(resources)
    await expect(resources).toHaveAttribute("aria-expanded", "true")
    await expect(env).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByText("4 vCPU · 8 GB memory")).toBeVisible()
    await expect(canvas.getByText(/NODE_ENV=development/)).toBeVisible()
  },
}
