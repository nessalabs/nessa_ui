import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { GitCommitDetails, GitHistory, type GitCommitDetailsData } from "@nessalabs/ui"
import snapshot from "./fixtures/git-history.json"
import { storyDocumentation } from "./story-documentation"

const details = snapshot.details as Record<string, Omit<GitCommitDetailsData, "hash" | "parents" | "subject" | "author" | "date">>
const commits: GitCommitDetailsData[] = snapshot.commits.map((commit) => ({ ...commit, ...details[commit.hash] }))
const exampleResources = [
  { id: "session-example", kind: "Agent session · example association", title: "Implement conversation echo", description: "Host-provided session link; not inferred from Git." },
  { id: "plan-example", kind: "Plan · example association", title: "Conversation echo + server ping", description: "The host can attach plans, issues, sessions or reviews to any commit." },
]
const meta = {
  title: "Git Operations/Commit Details", component: GitCommitDetails, tags: ["autodocs", "test"],
  parameters: { layout: "fullscreen", docs: { description: { component: "Standalone commit sidebar with full metadata, changed-file statistics and host-linked work. Load details when GitHistory selects a commit; supply callbacks to open files, sessions, plans or the full commit. File changes in these examples come from local Git, compared with the first parent (or empty tree for root commits). Renames are deliberately captured as delete/add. Associations are explicit sample data. Changed files use VirtualList by default." } } },
  args: { commit: { ...commits[2]!, resources: exampleResources } },
  decorators: [(Story) => <div className="p-6"><Story /></div>],
} satisfies Meta<typeof GitCommitDetails>
export default meta
type Story = StoryObj<typeof meta>

/** Connects host-owned history selection to the independent details sidebar. */
function GitOperationsExample() {
  const [selected, setSelected] = React.useState<GitCommitDetailsData | null>(commits[2]!)
  const [action, setAction] = React.useState("Select a commit, changed file, or linked work item.")
  return <div className="@container space-y-3">
    <div className="grid grid-cols-1 items-start gap-4 @min-[960px]:grid-cols-[minmax(0,1fr)_340px]" style={selected ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
      <GitHistory className="min-w-0" commits={commits} height={600} selectedHash={selected?.hash} onSelect={(commit) => { setSelected(commits.find((item) => item.hash === commit.hash)!); setAction("Commit selected") }} />
      <GitCommitDetails className="max-h-[760px] min-w-0" commit={selected ? { ...selected, resources: exampleResources } : null} onClose={() => setSelected(null)} onFileSelect={(file) => setAction(`Open file diff: ${file.path}`)} onResourceSelect={(resource) => setAction(`Open ${resource.kind}: ${resource.title}`)} onOpenCommit={(commit) => setAction(`Open commit: ${commit.hash}`)} />
    </div>
    <p role="status" className="break-all font-sans nessa-text-3 text-muted-foreground">{action}</p>
  </div>
}

export const WithHistory: Story = {
  render: () => <GitOperationsExample />,
  parameters: storyDocumentation("Real local history and first-parent file changes. Select a commit to populate the independent sidebar; file/session/plan callbacks update the action readout. The host supplies actual navigation."),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: commits[0]!.subject }))
    const sidebar = canvas.getByRole("complementary", { name: "Commit details" })
    await expect(within(sidebar).getByText(commits[0]!.hash)).toBeVisible()
    const file = commits[0]!.files![0]!
    await userEvent.click(within(sidebar).getByRole("button", { name: `View changes: ${file.path}` }))
    await expect(canvas.getByRole("status")).toHaveTextContent(`Open file diff: ${file.path}`)
    await userEvent.click(within(sidebar).getByRole("button", { name: exampleResources[1]!.title }))
    await expect(canvas.getByRole("status")).toHaveTextContent(exampleResources[1]!.title)
    await userEvent.click(within(sidebar).getByRole("button", { name: "Close" }))
    await expect(canvas.queryByRole("complementary")).toBeNull()
    await expect(canvas.queryByText("Select a commit to inspect its changes.")).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: commits[2]!.subject }))
    await expect(canvas.getByRole("complementary")).toBeVisible()
  },
}
export const Playground: Story = { decorators: [(Story) => <div style={{ maxWidth: 440 }}><Story /></div>], parameters: storyDocumentation("Independent sidebar with actual merge commit metadata and file statistics plus clearly labeled example session/plan associations.") }
export const NoSelection: Story = { args: { commit: null }, parameters: storyDocumentation("No selection renders no sidebar and reserves no space.") }
export const NotLoaded: Story = { args: { commit: { ...commits[0]!, files: undefined } }, parameters: storyDocumentation("Distinguishes details that have not loaded from a commit with no changed files.") }
export const NoChanges: Story = { args: { commit: { ...commits[0]!, files: [] } }, parameters: storyDocumentation("A loaded comparison with no changed files.") }
export const FileStress: Story = {
  args: { commit: { ...commits[0]!, files: Array.from({ length: 10000 }, (_, index) => ({ path: `packages/${"very-long-directory/".repeat(8)}file-${index}.tsx`, previousPath: index % 3 === 0 ? `old/file-${index}.tsx` : undefined, status: index % 3 === 0 ? "R100" : "M", additions: index % 2 ? 1500 : null, deletions: index % 2 ? 400 : null })) } },
  decorators: [(Story) => <div style={{ width: 360, maxWidth: "100%" }}><Story /></div>],
  parameters: storyDocumentation("Synthetic 10,000 changed files at 360px width, long paths, renames and unavailable/binary counts. Mounted file rows remain bounded."),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", { name: "Changed files" })
    await expect(within(list).getAllByRole("listitem").length).toBeLessThan(30)
    list.scrollTop = list.scrollHeight
    list.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(list.querySelector('[aria-posinset="10000"]')).not.toBeNull())
    list.scrollTop = 0
    list.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(list.querySelector('[aria-posinset="1"]')).not.toBeNull())
  },
}

export const AllFilesMounted: Story = {
  args: { virtualize: false, filesHeight: 160 },
  parameters: storyDocumentation("Windowing disabled retains the requested file viewport cap while mounting every file for full DOM traversal."),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", { name: "Changed files" })
    await expect(within(list).getAllByRole("listitem")).toHaveLength(commits[2]!.files!.length)
    await expect(list.clientHeight).toBe(160)
  },
}
