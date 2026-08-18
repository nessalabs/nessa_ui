import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  DiffStat,
  FileDiffCard,
  FileDiffCardActions,
  FileDiffCardHeader,
  FileDiffCardHeading,
  FileDiffCardIcon,
  FileDiffCardTitle,
  FileDiffList,
  FileDiffListItem,
  FileDiffListItemAction,
  FileDiffListItemActions,
  FileDiffListToggle,
  FileDiffPath,
} from "@nessa-ui/react"
import { Copy, SquareArrowOutUpRight, Undo2 } from "lucide-react"

import { FileCopyIcon } from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const editedFiles = [
  { path: "packages/react/src/components/model-capability-controls.tsx", additions: 84, deletions: 13 },
  { path: "apps/storybook/.storybook/preview.ts", additions: 2, deletions: 1 },
  { path: "apps/storybook/stories/chat-composer.stories.tsx", additions: 60, deletions: 4 },
  { path: "packages/react/src/theme.css", additions: 2, deletions: 1 },
  { path: "validation/nessa/checks/theme-parity.ts", additions: 121, deletions: 16 },
  { path: "validation/tests/theme-parity.test.ts", additions: 18, deletions: 3 },
  { path: "registry.json", additions: 38, deletions: 0 },
  { path: "docs/architecture/design-system-contract.md", additions: 15, deletions: 0 },
  { path: "packages/react/README.md", additions: 7, deletions: 2 },
  { path: "apps/storybook/stories/model-capability-controls.stories.tsx", additions: 247, deletions: 6 },
  { path: "packages/react/src/index.ts", additions: 1, deletions: 0 },
  { path: "validation/tests/model-capability-icons.test.ts", additions: 7, deletions: 1 },
  { path: "apps/storybook/stories/sidebar-menu.stories.tsx", additions: 0, deletions: 1 },
  { path: "validation/amendments.ts", additions: 20, deletions: 6 },
]

function EditedFilesCard({
  files = editedFiles,
  defaultExpanded = false,
  listClassName,
  withRowActions = false,
  onRowAction,
}: {
  files?: typeof editedFiles
  defaultExpanded?: boolean
  listClassName?: string
  withRowActions?: boolean
  onRowAction?: (action: string, path: string) => void
}) {
  const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0)
  const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0)

  return (
    <FileDiffCard
      defaultExpanded={defaultExpanded}
      itemCount={files.length}
      className="w-full max-w-2xl"
    >
      <FileDiffCardHeader>
        <FileDiffCardIcon>
          <FileCopyIcon />
        </FileDiffCardIcon>
        <FileDiffCardHeading>
          <FileDiffCardTitle>Edited {files.length} files</FileDiffCardTitle>
          <DiffStat additions={totalAdditions} deletions={totalDeletions} />
        </FileDiffCardHeading>
        <FileDiffCardActions>
          <Button variant="ghost" size="sm">
            Undo
            <Undo2 aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="sm">
            Review
          </Button>
        </FileDiffCardActions>
      </FileDiffCardHeader>
      <FileDiffList aria-label="Changed files" className={listClassName}>
        {files.map((file) => (
          <FileDiffListItem key={file.path}>
            <FileDiffPath path={file.path} />
            {withRowActions ? (
              <FileDiffListItemActions>
                <FileDiffListItemAction
                  aria-label={`Open ${file.path}`}
                  title={`Open ${file.path}`}
                  onClick={() => onRowAction?.("Opened", file.path)}
                >
                  <SquareArrowOutUpRight aria-hidden="true" />
                </FileDiffListItemAction>
                <FileDiffListItemAction
                  aria-label={`Copy path ${file.path}`}
                  title={`Copy path ${file.path}`}
                  onClick={() => onRowAction?.("Copied", file.path)}
                >
                  <Copy aria-hidden="true" />
                </FileDiffListItemAction>
                <FileDiffListItemAction
                  aria-label={`Revert ${file.path}`}
                  title={`Revert ${file.path}`}
                  onClick={() => onRowAction?.("Reverted", file.path)}
                >
                  <Undo2 aria-hidden="true" />
                </FileDiffListItemAction>
              </FileDiffListItemActions>
            ) : null}
            <DiffStat additions={file.additions} deletions={file.deletions} />
          </FileDiffListItem>
        ))}
      </FileDiffList>
      <FileDiffListToggle />
    </FileDiffCard>
  )
}

function RowActionsExample() {
  const [status, setStatus] = React.useState("No row action triggered")

  return (
    <div className="grid w-full max-w-2xl gap-2">
      <p className="sr-only" role="status">{status}</p>
      <EditedFilesCard
        withRowActions
        onRowAction={(action, path) => setStatus(`${action}: ${path}`)}
      />
    </div>
  )
}

const meta = {
  title: "Components/FileDiffList",
  component: FileDiffCard,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Changed-file summary card for agent edit turns: header primitives with aggregate diff stats, a scrollable file list with per-file additions and deletions, hover- and focus-revealed row actions, and a collapse toggle that keeps long change sets compact.",
      },
    },
  },
} satisfies Meta<typeof FileDiffCard>

export default meta
type Story = StoryObj<typeof meta>

export const CollapsedSummary: Story = {
  parameters: storyDocumentation(
    "Collapsed by default the card shows the first rows and a toggle naming the hidden remainder; expanding swaps the toggle to a collapse affordance.",
  ),
  render: () => <EditedFilesCard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3)
    await expect(
      canvas.getByRole("list", { name: "Changed files" }),
    ).not.toHaveAttribute("tabindex")
    const toggle = canvas.getByRole("button", { name: "Show 11 more files" })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(toggle)
    await expect(canvas.getAllByRole("listitem")).toHaveLength(14)
    const collapse = canvas.getByRole("button", { name: "Collapse files" })
    await expect(collapse).toHaveAttribute("aria-expanded", "true")
    await expect(collapse).toHaveAttribute(
      "aria-controls",
      canvas.getByRole("list", { name: "Changed files" }).id,
    )
    await userEvent.click(collapse)
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3)
    await expect(
      canvas.getByRole("button", { name: "Show 11 more files" }),
    ).toBeVisible()
  },
}

export const HoverRowActions: Story = {
  parameters: storyDocumentation(
    "Row actions stay transparent until the row is hovered or an action receives keyboard focus; a pointer click never pins a row's actions open once the pointer moves on.",
  ),
  render: () => <RowActionsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const openAction = canvas.getByRole("button", {
      name: "Open packages/react/src/components/model-capability-controls.tsx",
    })
    const actionsGroup = openAction.parentElement as HTMLElement
    await expect(Number(getComputedStyle(actionsGroup).opacity)).toBe(0)
    const activeElement = () => canvasElement.ownerDocument.activeElement
    for (let hops = 0; hops < 12 && activeElement() !== openAction; hops += 1) {
      await userEvent.tab()
    }
    await expect(openAction).toHaveFocus()
    await waitFor(() =>
      expect(Number(getComputedStyle(actionsGroup).opacity)).toBe(1),
    )
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Copy path packages/react/src/components/model-capability-controls.tsx",
      }),
    )
    await expect(
      canvas.getByText(
        "Copied: packages/react/src/components/model-capability-controls.tsx",
      ),
    ).toBeVisible()
    await userEvent.click(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(Number(getComputedStyle(actionsGroup).opacity)).toBe(0),
    )
  },
}

const hundredFiles = Array.from({ length: 100 }, (_, index) => ({
  path: `packages/react/src/components/generated/refactor-slice-${String(index + 1).padStart(3, "0")}.tsx`,
  additions: (index * 37) % 240,
  deletions: (index * 13) % 60,
}))

export const ScrollableList: Story = {
  parameters: storyDocumentation(
    "The list ships with a default height cap, so even a hundred-file change set scrolls inside a stable card — header and toggle stay pinned — instead of growing without bound.",
  ),
  render: () => <EditedFilesCard files={hundredFiles} defaultExpanded />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("list", { name: "Changed files" })
    await expect(getComputedStyle(list).overflowY).toBe("auto")
    await waitFor(() => expect(list.scrollHeight).toBeGreaterThan(list.clientHeight))
    await waitFor(() => expect(list).toHaveAttribute("tabindex", "0"))
    list.scrollTop = list.scrollHeight
    await waitFor(() => expect(list.scrollTop).toBeGreaterThan(0))
  },
}

export const AgentTurnComposition: Story = {
  parameters: storyDocumentation(
    "App-fidelity composition of an agent edit turn in dark mode: aggregate stats beside the card icon and undo/review actions in the header. Rows stay chrome-free here; per-row actions remain an opt-in shown in Hover Row Actions.",
  ),
  render: () => (
    <div className="grid w-[min(48rem,calc(100vw-2rem))] gap-2 rounded-[2rem] bg-neutral-950 p-8">
      <EditedFilesCard />
    </div>
  ),
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText("622 additions, 54 deletions"),
    ).toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: /undo/i })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Review" })).toBeVisible()
  },
}
