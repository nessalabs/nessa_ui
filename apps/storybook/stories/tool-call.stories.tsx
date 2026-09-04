import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { FileSearch, Globe } from "lucide-react"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import {
  ToolCall,
  ToolCallContent,
  ToolCallDiff,
  ToolCallFile,
  ToolCallTabs,
  ToolCallTrigger,
} from "@nessalabs/ui"

import {
  BashIcon,
  EditIcon,
  SearchIcon,
  TodoIcon,
} from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const readInput = `{
  "file_path": "packages/react/src/lib/utils.ts",
  "limit": 40
}`

const readOutput = `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`

const bashInput = `pnpm validate --changed-since main`

const bashOutput = `✔ CSS-001 layer order (41ms)
✔ CSS-002 preflight ownership (18ms)
✔ CSS-003 app css boundary (12ms)
✔ GOV-001 contract index (102ms)
✔ GOV-003 governed history (85ms)
✔ REG-001 registry parity (167ms)
✔ SRC-001 runtime boundaries (204ms)
✔ SRC-002 source boundaries (312ms)
✔ SRC-003 private aliases (44ms)
✔ TOKEN-003 theme parity (76ms)
✔ A11Y-001 token contrast (140ms)
✔ A11Y-002 focus treatments (188ms)
✔ A11Y-003 focus geometry (61ms)
✔ STORY-001 storybook coverage (94ms)

All 14 contracts passed in 1.02s`

const editBefore = `export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return minutes + "m " + (seconds % 60) + "s"
}`

const editAfter = `export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  if (minutes === 0) return remainder + "s"
  return minutes + "m " + remainder + "s"
}`

// Module-scoped spy observed by the FileActions play function.
const openFileSpy = fn()

const meta = {
  title: "Agents/Tools/ToolCall",
  component: ToolCall,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "One tool invocation in an agent transcript: a compact disclosure row that names the tool — shimmering while it runs — and expands into the call's details. Compose the body from ToolCallTabs (input and output payloads), ToolCallDiff (an edit as a unified diff), and ToolCallFile (clickable chips for touched files). Hosts map their own tool names to icons and pass the match to the trigger.",
      },
    },
  },
} satisfies Meta<typeof ToolCall>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "The default body is ToolCallTabs: the call's input and output as a small tab pair. The trigger toggles the disclosure and carries the expanded state on `aria-expanded`.",
  ),
  render: () => (
    <div className="w-[min(40rem,calc(100vw-2rem))]">
      <ToolCall>
        <ToolCallTrigger
          icon={<FileSearch />}
          meta="packages/react/src/lib/utils.ts"
        >
          Read
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallTabs input={readInput} output={readOutput} />
        </ToolCallContent>
      </ToolCall>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: /read/i })
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")

    const inputTab = canvas.getByRole("tab", { name: "Input" })
    const outputTab = canvas.getByRole("tab", { name: "Output" })
    await expect(inputTab).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByText(/"file_path"/)).toBeVisible()

    await userEvent.click(outputTab)
    await expect(outputTab).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByText(/tailwind-merge/)).toBeVisible()

    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
  },
}

export const Running: Story = {
  parameters: storyDocumentation(
    "While `status` is `running` the row is `aria-busy` and the label sweeps a foreground highlight across otherwise muted text. The shimmer is painted with theme tokens and clipped to the glyphs, so the label stays real, selectable text, and reduced motion renders it static.",
  ),
  render: () => (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-1">
      <ToolCall status="running">
        <ToolCallTrigger icon={<SearchIcon />} meta="useMessageStreamText">
          Searching the codebase
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallTabs input={`{ "pattern": "useMessageStreamText" }`} />
        </ToolCallContent>
      </ToolCall>
      <ToolCall status="running">
        <ToolCallTrigger icon={<Globe />}>
          Fetching react.dev/reference
        </ToolCallTrigger>
      </ToolCall>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('[data-slot="tool-call"]')
    await expect(rows).toHaveLength(2)
    for (const row of rows) {
      await expect(row).toHaveAttribute("data-status", "running")
      await expect(row).toHaveAttribute("aria-busy", "true")
    }
  },
}

export const EditDiff: Story = {
  parameters: storyDocumentation(
    "An Edit call expands into ToolCallDiff: a unified diff computed from the before and after contents, syntax-highlighted and themed through the same CodeBlockProvider configuration as every other code surface.",
  ),
  render: () => (
    <div className="w-[min(40rem,calc(100vw-2rem))]">
      <ToolCall defaultOpen>
        <ToolCallTrigger icon={<EditIcon />} meta="src/lib/format.ts">
          Edit
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallDiff
            from={editBefore}
            to={editAfter}
            filename="src/lib/format.ts"
          />
        </ToolCallContent>
      </ToolCall>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: /edit/i })
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    const diff = canvasElement.querySelector('[data-slot="tool-call-diff"]')
    await expect(diff).not.toBeNull()
    // Pierre renders the diff inside the <diffs-container> shadow root, so
    // the rendered lines are only reachable through shadowRoot.
    await waitFor(
      () =>
        expect(diff!.firstElementChild?.shadowRoot?.textContent).toContain(
          "remainder",
        ),
      // Pierre highlights asynchronously, and 5s is marginal once the whole
      // suite runs in parallel; the file's own timeout is 30s.
      { timeout: 15000 },
    )
  },
}

export const FileActions: Story = {
  parameters: storyDocumentation(
    "ToolCallFile chips list the files a call touched. With `onClick` a chip renders as a button and the host wires the action — opening the file, revealing it in a tree — while without one it is a plain reference.",
  ),
  render: () => (
    <div className="w-[min(40rem,calc(100vw-2rem))]">
      <ToolCall defaultOpen>
        <ToolCallTrigger icon={<FileSearch />} meta="3 files">
          Read
        </ToolCallTrigger>
        <ToolCallContent>
          <div className="flex max-w-full flex-wrap items-center gap-1.5">
            <ToolCallFile
              name="packages/react/src/components/message.tsx"
              meta="743 lines"
              onClick={openFileSpy}
            />
            <ToolCallFile
              name="packages/react/src/components/code-block.tsx"
              meta="217 lines"
              onClick={openFileSpy}
            />
            <ToolCallFile name="packages/react/src/theme.css" meta="118 lines" />
          </div>
        </ToolCallContent>
      </ToolCall>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chip = canvas.getByRole("button", { name: /message\.tsx/i })
    await userEvent.click(chip)
    await expect(openFileSpy).toHaveBeenCalled()

    // The chip without onClick must not be focusable or expose a button role.
    const plain = canvasElement.querySelectorAll('[data-slot="tool-call-file"]')
    await expect(plain).toHaveLength(3)
    await expect(plain[2]!.tagName).toBe("SPAN")
  },
}

export const ErrorStatus: Story = {
  parameters: storyDocumentation(
    "A failed call tints the trigger destructive and keeps the payload inspectable — the output pane carries the error the tool returned.",
  ),
  render: () => (
    <div className="w-[min(40rem,calc(100vw-2rem))]">
      <ToolCall status="error" defaultOpen>
        <ToolCallTrigger icon={<BashIcon />} meta="exit code 1">
          Bash
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallTabs
            input="pnpm test:unit"
            output={`FAIL src/lib/format.test.ts
  ● formatDuration › rounds trailing seconds

    expect(received).toBe(expected)
    Expected: "1m 24s"
    Received: "1m 23.6s"`}
            defaultTab="output"
          />
        </ToolCallContent>
      </ToolCall>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvasElement.querySelector('[data-slot="tool-call"]')
    await expect(row).toHaveAttribute("data-status", "error")
    const outputTab = canvas.getByRole("tab", { name: "Output" })
    await expect(outputTab).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByText(/formatDuration/)).toBeVisible()
  },
}

export const AgentTranscript: Story = {
  parameters: storyDocumentation(
    "The intended composition: a run of tool calls in an assistant turn, each row a collapsed summary until the reader digs in. Icons are host-supplied per tool — collect your own set and map tool names to glyphs at the call site.",
  ),
  render: () => {
    function TranscriptExample() {
      const [openFile, setOpenFile] = React.useState<string | null>(null)
      return (
        <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-border bg-background p-4">
          <ToolCall>
            <ToolCallTrigger icon={<TodoIcon />} meta="4 tasks">
              Update todos
            </ToolCallTrigger>
            <ToolCallContent>
              <ToolCallTabs input={`{ "completed": ["Explore conventions"] }`} />
            </ToolCallContent>
          </ToolCall>
          <ToolCall>
            <ToolCallTrigger
              icon={<FileSearch />}
              meta="packages/react/src/lib/utils.ts"
            >
              Read
            </ToolCallTrigger>
            <ToolCallContent>
              <ToolCallTabs input={readInput} output={readOutput} />
              <ToolCallFile
                name="packages/react/src/lib/utils.ts"
                meta="6 lines"
                onClick={() => setOpenFile("packages/react/src/lib/utils.ts")}
              />
            </ToolCallContent>
          </ToolCall>
          <ToolCall>
            <ToolCallTrigger icon={<EditIcon />} meta="src/lib/format.ts">
              Edit
            </ToolCallTrigger>
            <ToolCallContent>
              <ToolCallDiff
                from={editBefore}
                to={editAfter}
                filename="src/lib/format.ts"
              />
            </ToolCallContent>
          </ToolCall>
          <ToolCall>
            <ToolCallTrigger icon={<BashIcon />} meta="1.02s">
              Bash
            </ToolCallTrigger>
            <ToolCallContent>
              <ToolCallTabs input={bashInput} output={bashOutput} />
            </ToolCallContent>
          </ToolCall>
          <ToolCall status="running">
            <ToolCallTrigger icon={<SearchIcon />} meta="focus-visible">
              Checking focus treatments
            </ToolCallTrigger>
          </ToolCall>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {openFile === null ? "No file opened" : `Opened ${openFile}`}
          </p>
        </div>
      )
    }
    return <TranscriptExample />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const readTrigger = canvas.getByRole("button", { name: /^read/i })
    await userEvent.click(readTrigger)
    const chip = canvas.getByRole("button", { name: /6 lines/i })
    await userEvent.click(chip)
    await expect(
      canvas.getByText("Opened packages/react/src/lib/utils.ts"),
    ).toBeVisible()
  },
}
