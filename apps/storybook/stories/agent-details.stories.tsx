import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  AgentDetails,
  AgentDetailsAction,
  AgentDetailsActions,
  AgentDetailsField,
  AgentDetailsProject,
  AgentDetailsSection,
  Sheet,
  SheetBody,
  SheetClose,
  SheetExpand,
  SheetHandle,
  SheetHeader,
} from "@nessa-ui/react"
import { Pencil, Pin, Share } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

function DetailsExample({ openByDefault = false }: { openByDefault?: boolean }) {
  const [open, setOpen] = React.useState(openByDefault)
  const [status, setStatus] = React.useState("No action yet")
  return (
    <div className="relative h-[32rem] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background">
      <p className="sr-only" role="status">
        {status}
      </p>
      <button
        type="button"
        className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1.5 font-sans nessa-text-3 text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setOpen(true)}
      >
        View details
      </button>
      {open ? (
        <Sheet label="Agent details" onClose={() => setOpen(false)}>
          <SheetHandle />
          <SheetHeader>
            <SheetExpand />
            <SheetClose className="col-start-3 justify-self-end" />
          </SheetHeader>
          <SheetBody>
            <AgentDetails title="Agent message package implementation">
              <AgentDetailsActions>
                <AgentDetailsAction
                  label="Edit"
                  onClick={() => setStatus("Edit")}
                >
                  <Pencil aria-hidden="true" />
                </AgentDetailsAction>
                <AgentDetailsAction
                  label="Pin"
                  onClick={() => setStatus("Pin")}
                >
                  <Pin aria-hidden="true" />
                </AgentDetailsAction>
                <AgentDetailsAction
                  label="Share"
                  onClick={() => setStatus("Share")}
                >
                  <Share aria-hidden="true" />
                </AgentDetailsAction>
              </AgentDetailsActions>
              <AgentDetailsSection title="Info">
                <AgentDetailsProject path="nessalabs/nessa_ui" branch="main" />
                <AgentDetailsField label="Source" value="Mobile" />
                <AgentDetailsField label="Runtime" value="Cursor Cloud" />
                <AgentDetailsField label="Model" value="Fable 5" />
                <AgentDetailsField label="Created" value="1m" />
                <AgentDetailsField label="Last Updated" value="1m" />
              </AgentDetailsSection>
            </AgentDetails>
          </SheetBody>
        </Sheet>
      ) : null}
    </div>
  )
}

const meta = {
  title: "Components/AgentDetails",
  component: AgentDetails,
  tags: ["autodocs", "test"],
  args: {
    title: "Agent message package implementation",
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The identity of an agent conversation: a title, a row of compact actions (edit, pin, share), and an Info section for the project path, branch, model, runtime, and timestamps. The panel does not own how it is shown — the catalog mounts it in a Sheet; Expand and dragging the grab bar fill the chat window.",
      },
    },
  },
} satisfies Meta<typeof AgentDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Open the details sheet from the host button. The Info section names the project and the facts the host already knows; Edit, Pin, and Share report through a status live region.",
  ),
  render: () => <DetailsExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "View details" }))
    await expect(
      canvas.getByRole("dialog", { name: "Agent details" }),
    ).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByText("nessalabs/nessa_ui")).toBeVisible(),
    )
    await expect(canvas.getByText("Cursor Cloud")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Pin" }))
    await expect(
      canvasElement.querySelector('[role="status"]'),
    ).toHaveTextContent("Pin")
    await userEvent.click(canvas.getByRole("button", { name: "Close" }))
    await expect(
      canvas.queryByRole("dialog", { name: "Agent details" }),
    ).not.toBeInTheDocument()
  },
}
