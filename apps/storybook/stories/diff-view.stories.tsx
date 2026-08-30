import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  DiffStat,
  DiffView,
  type DiffLineAnnotation,
  type SelectedLineRange,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

/** The compose-file change an agent proposed: a postgres upgrade hunk. */
const composePatch = `diff --git a/docker-compose.yml b/docker-compose.yml
index 3f1a2b4..9c8d7e6 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -12,6 +12,7 @@
 services:
   postgres:
-    image: postgres:15
+    image: postgres:16
+    shm_size: 1gb
     environment:
       POSTGRES_DB: canopy
       POSTGRES_USER: canopy
`

/**
 * Pierre renders into a <diffs-container> custom element with an open shadow
 * root, so rendered code is read through shadowRoot; annotation, header, and
 * gutter-utility content stays in the host's light DOM as slotted children.
 */
function diffShadow(view: Element): ShadowRoot | null {
  return view.querySelector("diffs-container")?.shadowRoot ?? null
}

const meta = {
  title: "Components/DiffView",
  component: DiffView,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A single-file code-diff renderer on Pierre's engine: syntax-highlighted `unified` and `split` layouts, line-number gutters, and semantic add/delete row washes. Theming resolves like CodeBlock's — props, then the nearest CodeBlockProvider, then Nessa's dark/light pair — so diffs match every other code surface. Feed it a unified `patch` string or a pre-parsed `fileDiff` (`parsePatchFiles` is re-exported for multi-file patches). Commenting stays with the host: `lineAnnotations` anchors host-rendered threads under their lines via `renderAnnotation`, and the gutter utility (`enableGutterUtility` + `onGutterUtilityClick`, optionally `renderGutterUtility`) is the per-line \"add a comment\" affordance. The file header always renders; `renderHeaderMetadata` fills its right-hand slot.",
      },
    },
  },
  args: {
    patch: composePatch,
  },
} satisfies Meta<typeof DiffView>

export default meta
type Story = StoryObj<typeof meta>

export const UnifiedPatch: Story = {
  parameters: storyDocumentation(
    "The default unified layout, straight from a patch string: one interleaved column with line numbers, the deletion and its replacement washed in the semantic diff colors, and the file header naming the changed file. Long lines scroll inside the diff, never the page.",
  ),
  render: () => (
    <div className="w-[40rem]">
      <DiffView patch={composePatch} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.querySelector('[data-slot="diff-view"]')!
    await expect(view).toHaveAttribute("data-mode", "unified")

    // Highlighting is asynchronous; wait for the hunk to land in the
    // shadow root before asserting anything about it.
    await waitFor(
      () => expect(diffShadow(view)?.textContent ?? "").toMatch(/postgres:16/),
      { timeout: 15000 },
    )
    const shadow = diffShadow(view)!

    // Old and new versions interleave in one unified column.
    await expect(shadow.querySelector("[data-unified]")).not.toBeNull()
    await expect(shadow.textContent).toMatch(/postgres:15/)
    await expect(shadow.textContent).toMatch(/shm_size: 1gb/)

    // The file header names the file; DiffView never disables it.
    await expect(shadow.textContent).toMatch(/docker-compose\.yml/)
  },
}

export const SplitMode: Story = {
  parameters: storyDocumentation(
    "`mode=\"split\"` maps to Pierre's side-by-side layout: the old file's column keeps `postgres:15`, the new column carries the upgrade and the added `shm_size` line, and each side numbers its own version of the file.",
  ),
  render: () => (
    <div className="w-[52rem]">
      <DiffView patch={composePatch} mode="split" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.querySelector('[data-slot="diff-view"]')!
    await expect(view).toHaveAttribute("data-mode", "split")

    await waitFor(
      () => expect(diffShadow(view)?.textContent ?? "").toMatch(/postgres:16/),
      { timeout: 15000 },
    )
    const shadow = diffShadow(view)!

    // Split renders separate deletion and addition columns, old on the
    // left with the removed line, new on the right with both additions.
    const deletions = shadow.querySelector("[data-deletions]")
    const additions = shadow.querySelector("[data-additions]")
    await expect(deletions).not.toBeNull()
    await expect(additions).not.toBeNull()
    await expect(deletions!.textContent).toMatch(/postgres:15/)
    await expect(deletions!.textContent).not.toMatch(/postgres:16/)
    await expect(additions!.textContent).toMatch(/postgres:16/)
    await expect(additions!.textContent).toMatch(/shm_size: 1gb/)
  },
}

interface ReviewNote {
  author: string
  text: string
}

/**
 * The host side of the commenting contract, as the Canopy review screen
 * implements it: a store of side+line anchored notes fed to
 * `lineAnnotations`, threads rendered by `renderAnnotation` in the host's
 * own React tree, and the gutter utility wired to open a composer.
 */
function ReviewedDiff() {
  const [notes, setNotes] = React.useState<
    readonly DiffLineAnnotation<ReviewNote>[]
  >([
    {
      side: "additions",
      lineNumber: 15,
      metadata: {
        author: "you",
        text: "Confirm the indexer actually needs the shared-memory bump",
      },
    },
  ])
  const [lastRange, setLastRange] = React.useState<SelectedLineRange | null>(
    null,
  )
  return (
    <div className="flex w-[40rem] flex-col gap-2">
      <DiffView<ReviewNote>
        patch={composePatch}
        lineAnnotations={notes}
        renderAnnotation={(annotation) => (
          <div className="border-y border-border/60 bg-muted/40 px-4 py-1.5 font-sans nessa-text-2">
            <span className="font-medium">{annotation.metadata.author}</span>{" "}
            <span>{annotation.metadata.text}</span>
          </div>
        )}
        enableGutterUtility
        onGutterUtilityClick={(range) => {
          setLastRange(range)
          setNotes((current) => [
            ...current,
            {
              side: range.side ?? "additions",
              lineNumber: range.start,
              metadata: { author: "you", text: `Note on line ${range.start}` },
            },
          ])
        }}
      />
      <p className="font-mono nessa-text-1 text-muted-foreground">
        {lastRange
          ? `last gutter click: ${lastRange.side} line ${lastRange.start}`
          : "hover a line and click the gutter + to comment"}
      </p>
    </div>
  )
}

export const ReviewThread: Story = {
  parameters: storyDocumentation(
    "The commenting hooks in use: the host keeps its own note store keyed by side and line, feeds it to `lineAnnotations`, and renders each thread with `renderAnnotation` — the thread lives in the host's React tree (state and handlers work normally) and docks under its line, here under the added `shm_size` line (additions side, line 15). The gutter `+` that appears on hover reports the clicked side and line through `onGutterUtilityClick`, where this host appends another note.",
  ),
  render: () => <ReviewedDiff />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const view = canvasElement.querySelector('[data-slot="diff-view"]')!
    await waitFor(
      () => expect(diffShadow(view)?.textContent ?? "").toMatch(/shm_size/),
      { timeout: 15000 },
    )

    // The seeded thread renders in the light DOM (so it is part of the
    // host's tree) and is slotted under additions line 15.
    const note = canvas.getByText(
      "Confirm the indexer actually needs the shared-memory bump",
    )
    await expect(note).toBeVisible()
    const slotted = note.closest("[slot]")
    await expect(slotted).toHaveAttribute("slot", "annotation-additions-15")

    // The diff's shadow DOM exposes a matching slot element, so the
    // thread docks under its line instead of floating after the file.
    await expect(
      diffShadow(view)!.querySelector('slot[name="annotation-additions-15"]'),
    ).not.toBeNull()

    // Hovering an added line's number reveals DiffView's accessible
    // gutter button; clicking it reports side and line to the host,
    // which appends a second note.
    const shadow = diffShadow(view)!
    const addedLineNumber = shadow.querySelector<HTMLElement>(
      '[data-column-number][data-line-type="change-addition"]',
    )
    await expect(addedLineNumber).not.toBeNull()
    await userEvent.hover(addedLineNumber!)
    const gutterButton = await waitFor(() =>
      canvas.getByRole("button", { name: "Comment on this line" }),
    )
    await userEvent.click(gutterButton)
    await expect(canvas.getByText(/Note on line \d+/)).toBeVisible()
    await expect(
      canvas.getByText(/last gutter click: additions line/),
    ).toBeVisible()
  },
}

export const HeaderMetadata: Story = {
  parameters: storyDocumentation(
    "`renderHeaderMetadata` fills the header's right-hand slot — here Nessa's DiffStat summarizing the hunk — while the header itself keeps naming the file. Use this slot for change stats, review state, or per-file controls; the header cannot be disabled.",
  ),
  render: () => (
    <div className="w-[40rem]">
      <DiffView
        patch={composePatch}
        renderHeaderMetadata={() => (
          <DiffStat additions={2} deletions={1} />
        )}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const view = canvasElement.querySelector('[data-slot="diff-view"]')!
    await waitFor(
      () => expect(diffShadow(view)?.textContent ?? "").toMatch(/postgres:16/),
      { timeout: 15000 },
    )

    // The stat renders in the light DOM, slotted into the header's
    // metadata slot beside the filename.
    const stat = canvasElement.querySelector('[data-slot="diff-stat"]')!
    await expect(stat.closest("[slot]")).toHaveAttribute(
      "slot",
      "header-metadata",
    )
    await expect(canvas.getByText("+2")).toBeInTheDocument()
    await expect(
      canvas.getByText("2 additions, 1 deletion"),
    ).toBeInTheDocument()
  },
}
