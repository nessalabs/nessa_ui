import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { ScrollArea, ScrollBar, StatusDot } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A scroll container with Nessa-styled overlay scrollbars: a token-colored thumb that appears while scrolling or hovering instead of the host platform's gutter, so dense panes keep their geometry across platforms. Size the area like any block and the single child scrolls inside; the vertical bar is built in, and a ScrollBar orientation=\"horizontal\" child handles sideways overflow. Root props pass through — type=\"always\" keeps the bars visible for panes that should advertise their overflow.",
      },
    },
  },
} satisfies Meta<typeof ScrollArea>

export default meta
type Story = StoryObj<typeof meta>

const logLines = Array.from({ length: 48 }, (_, index) => {
  const second = String(index % 60).padStart(2, "0")
  const paths = ["/healthz", "/v1/limits", "/v1/limits/burst", "/metrics"]
  return `[12:06:${second}] GET ${paths[index % paths.length]} 200 ${(
    0.6 +
    (index % 7) * 0.3
  ).toFixed(1)}ms`
})

export const LogPane: Story = {
  parameters: storyDocumentation(
    "The log-pane case: a fixed-height pane of monospace output scrolling vertically behind an overlay bar, with type=\"always\" keeping the bar visible so the overflow is discoverable at a glance. The pane itself stays exactly as wide as its card — no platform gutter shifts the text.",
  ),
  render: () => (
    <ScrollArea
      type="always"
      className="h-56 w-[32rem] max-w-full rounded-lg border border-border bg-card"
    >
      <pre
        data-testid="log-lines"
        className="p-3 font-mono text-xs leading-5 text-card-foreground"
      >
        {logLines.join("\n")}
      </pre>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const viewport = canvas
      .getByTestId("log-lines")
      .closest("[data-slot='scroll-area-viewport']") as HTMLElement
    await expect(viewport).not.toBeNull()
    // The pane overflows vertically and the viewport owns the scrolling.
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)

    viewport.scrollTop = viewport.scrollHeight
    await expect(viewport.scrollTop).toBeGreaterThan(0)
  },
}

const workspaces = [
  { name: "canopy/api-gateway", branch: "feat/rate-limits", status: "running" },
  { name: "canopy/web", branch: "main", status: "success" },
  { name: "canopy/worker", branch: "fix/retry-backoff", status: "running" },
  { name: "canopy/docs", branch: "main", status: "idle" },
  { name: "canopy/billing", branch: "feat/usage-events", status: "error" },
] as const

export const BothOrientations: Story = {
  parameters: storyDocumentation(
    "Both bars at once: a workspace table wider and taller than its pane. The horizontal ScrollBar is added alongside the content, the built-in vertical bar handles the rows, and the corner where they meet is filled automatically.",
  ),
  render: () => (
    <ScrollArea
      type="always"
      className="h-40 w-96 max-w-full rounded-lg border border-border bg-card"
    >
      <div data-testid="workspace-rows" className="w-[40rem] p-3">
        {workspaces.map((workspace) => (
          <div
            key={workspace.name}
            className="flex items-center gap-3 border-b border-border py-2 font-sans text-sm text-card-foreground last:border-b-0"
          >
            <StatusDot status={workspace.status} />
            <span className="font-medium">{workspace.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {workspace.branch}
            </span>
            <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
              updated 4 minutes ago
            </span>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const viewport = canvas
      .getByTestId("workspace-rows")
      .closest("[data-slot='scroll-area-viewport']") as HTMLElement
    await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth)
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)
  },
}
