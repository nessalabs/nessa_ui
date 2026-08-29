import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nessa-ui/react"
import { GitBranch, RefreshCw, Square, Terminal } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "The plain hover/focus tooltip: a compact popover-surface pill that names or explains its trigger after a short delay, and instantly on keyboard focus. Purely supplementary — the trigger still needs its own accessible name, and anything interactive belongs in a popover or menu instead. Wrap a toolbar in one TooltipProvider so only the first tooltip waits for the delay; a bare Tooltip provides its own. For the floating selection-action pill, see SelectionTooltip.",
      },
    },
  },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const IconButton: Story = {
  parameters: storyDocumentation(
    "The icon-button case: the tooltip spells out what the glyph means. The trigger projects onto the Button via asChild and keeps its own aria-label — the tooltip supplements the name, it never provides it. Keyboard focus opens the tooltip immediately and Escape dismisses it.",
  ),
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Restart workspace">
          <RefreshCw aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Restart workspace</TooltipContent>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "Restart workspace" })

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await body.findByRole("tooltip")

    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(body.queryByRole("tooltip")).not.toBeInTheDocument(),
    )
  },
}

export const ToolbarAndChips: Story = {
  parameters: storyDocumentation(
    "One TooltipProvider around a workspace toolbar and its port chips: tooltips inside a shared provider skip the open delay when the pointer moves between neighboring triggers, so scanning the row does not re-wait on every control. Port chips are Badges projected as triggers.",
  ),
  render: () => (
    <TooltipProvider>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open terminal">
                <Terminal aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open terminal</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Stop workspace">
                <Square aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop workspace</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" tabIndex={0}>
                <GitBranch aria-hidden="true" className="size-3" />
                feat/rate-limits
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Checked-out branch</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" tabIndex={0}>
                :4180
              </Badge>
            </TooltipTrigger>
            <TooltipContent>gateway — forwarded to localhost:4180</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.tab()
    await expect(
      canvas.getByRole("button", { name: "Open terminal" }),
    ).toHaveFocus()
    const tooltip = await body.findByRole("tooltip")
    await expect(tooltip).toHaveTextContent("Open terminal")

    await userEvent.tab()
    await waitFor(async () =>
      expect(await body.findByRole("tooltip")).toHaveTextContent(
        "Stop workspace",
      ),
    )
  },
}
