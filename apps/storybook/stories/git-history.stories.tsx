import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within, waitFor } from "storybook/test"
import { GitHistory, type GitCommit } from "@nessalabs/ui"
import snapshot from "./fixtures/git-history.json"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Git Operations/History",
  component: GitHistory,
  tags: ["autodocs", "test"],
  parameters: { layout: "fullscreen", docs: { description: { component: "Parent-derived commit graph with optional row virtualization. Supply child-before-parent topological GitCommit records from your backend. The default story is a real local nessa-agent snapshot; refresh it with node apps/storybook/scripts/capture-git-history.mjs /path/to/repo. Browser code never runs Git. Virtualization mounts fixed-height rows; disable it for browser find or full accessibility traversal. Selection is host-controlled." } } },
  decorators: [(Story) => <div className="p-6"><Story /></div>],
  args: { commits: snapshot.commits, debug: true },
} satisfies Meta<typeof GitHistory>
export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(`Actual nessa-agent history, captured ${snapshot.capturedAt}. ${snapshot.command}; HEAD ${snapshot.head}. Container-responsive metadata keeps descriptions visible at narrow widths.`),
  render: (args) => <SelectableHistory {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole("button", { name: snapshot.commits[0]!.subject })
    await userEvent.click(button)
    await expect(button).toHaveAttribute("aria-pressed", "true")
  },
}

/** Demonstrates application-owned commit selection. */
function SelectableHistory(args: React.ComponentProps<typeof GitHistory>) {
  const [selectedHash, setSelectedHash] = React.useState<string>()
  return <GitHistory {...args} selectedHash={selectedHash} onSelect={(commit) => setSelectedHash(commit.hash)} />
}

const stress: GitCommit[] = Array.from({ length: 10000 }, (_, index) => ({
  hash: `stress-${index}`, parents: index === 9999 ? [] : [`stress-${index + 1}`],
  subject: `${index + 1}. ${index % 3 === 0 ? "Very long commit description / 路径 / résumé / " .repeat(12) : "Update repository history"}`,
  author: index % 5 ? "Nessa" : "An unusually long contributor display name", date: "2026-09-04T12:00:00Z",
  refs: index % 100 === 0 ? ["HEAD → feature/" + "nested-branch-".repeat(8), "origin/feature", "tag: v2.0.0"] : [],
}))
export const TenThousandRows: Story = {
  args: { commits: stress, height: 440 },
  render: (args) => <SelectableHistory {...args} />,
  parameters: storyDocumentation("Synthetic 10,000-commit linear history with long subjects, Unicode, long refs and authors. Verifies bounded DOM and the final row after scrolling."),
  play: async ({ canvasElement }) => {
    const viewport = within(canvasElement).getByRole("list")
    await expect(viewport.querySelectorAll('[role="listitem"]').length).toBeLessThan(30)
    viewport.scrollTop = viewport.scrollHeight
    viewport.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(viewport.querySelector('[aria-posinset="10000"]')).not.toBeNull())
    await expect(viewport.querySelectorAll('[role="listitem"]').length).toBeLessThan(30)
    viewport.scrollTop = 0
    viewport.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(viewport.querySelector('[aria-posinset="1"]')).not.toBeNull())
  },
}
export const AllRowsMounted: Story = { args: { commits: snapshot.commits.slice(0, 40), virtualize: false }, parameters: storyDocumentation("Same layout with windowing disabled. All 40 rows remain mounted for browser find and assistive technology."), play: async ({ canvasElement }) => { await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(40) } }
export const Narrow: Story = { args: { commits: stress.slice(0, 50) }, decorators: [(Story) => <div style={{ width: 360, maxWidth: "100%" }}><Story /></div>], parameters: storyDocumentation("A narrow 360px surface with adversarial text. Metadata moves beneath subjects without horizontal scrolling.") }
export const Empty: Story = { args: { commits: [] }, parameters: storyDocumentation("Default empty state for a repository with no loaded commits.") }
export const ManyBranches: Story = {
  args: { commits: [
    { hash: "merge", parents: Array.from({ length: 12 }, (_, i) => `branch-${i}`), subject: "Octopus merge: twelve branches", author: "Nessa", date: "2026-09-04T00:00:00Z" },
    ...Array.from({ length: 12 }, (_, i) => ({ hash: `branch-${i}`, parents: ["root"], subject: `Branch ${i + 1}`, author: "Nessa", date: "2026-09-03T00:00:00Z" })),
    { hash: "root", parents: [], subject: "Shared root", author: "Nessa", date: "2026-09-01T00:00:00Z" },
  ] }, parameters: storyDocumentation("Synthetic twelve-parent octopus merge converging on one root. Exercises wide graphs, shared parents and lane reuse."),
}

export const Compact: Story = {
  args: { commits: stress.slice(0, 100), rowHeight: 32 },
  render: (args) => <SelectableHistory {...args} />,
  parameters: storyDocumentation("Compact 32px selectable rows with long subjects. Buttons remain within each row and metadata stays in its column."),
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getAllByRole("listitem")[0]!
    const button = within(row).getByRole("button")
    const rect = button.getBoundingClientRect()
    await expect(rect.height).toBeGreaterThanOrEqual(24)
    await expect(rect.bottom).toBeLessThanOrEqual(row.getBoundingClientRect().bottom)
    await expect(rect.right).toBeLessThanOrEqual(row.getBoundingClientRect().right)
  },
}

export const CustomPalette: Story = {
  args: { ...ManyBranches.args, palette: ["#2764a5", "#a44775", "#36785d", "#9b641e"] },
  parameters: storyDocumentation("Pass any CSS colors or theme variables in palette. Colors cycle through lanes; an empty palette restores Nessa's eight theme-aware chart colors. Choose contrasting colors for each theme."),
  play: async ({ canvasElement }) => {
    const graph = canvasElement.querySelector('[data-slot="git-history"] svg')!
    await expect(graph.querySelector("circle")).toHaveAttribute("fill", "#2764a5")
    await expect(graph.querySelector('path[stroke="#a44775"]')).not.toBeNull()
  },
}
