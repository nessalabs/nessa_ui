import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { JsonTree } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const sampleValue = {
  tool: "http_request",
  method: "POST",
  url: "https://api.nessa.dev/v1/registry/publish",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
  },
  retries: [250, 1000, 4000],
  dryRun: true,
  note: null,
}

const meta = {
  title: "Data/JsonTree",
  component: JsonTree,
  tags: ["autodocs", "test"],
  args: { value: sampleValue },
  parameters: {
    docs: {
      description: {
        component:
          "A structured JSON renderer for any surface that shows a payload: keys tint muted so the values carry the emphasis, containers indent with real JSON punctuation, and the text stays selectable. By default it renders statically with no focusable parts — what consent surfaces that must show everything want — and `collapsible` adds a disclosure toggle to every object and array, with `defaultExpandedDepth` choosing how much starts open. The surface is deliberately unopinionated (monospace, semantic tokens only), and every part carries a data-slot hook (`json-tree-key`, `-value`, `-count`, `-toggle`, `-row`, `-children`, `-overflow`) so hosts restyle it per surface. Rendering is bounded on every axis so an arbitrary host payload can never freeze or crash the surface: circular references render as a marker, containers past the depth cap render as their folded summary, and containers wider than the entry cap render their head plus an explicit overflow row.",
      },
    },
  },
} satisfies Meta<typeof JsonTree>

export default meta
type Story = StoryObj<typeof meta>

/** Shared story chrome framing the tree the way a host panel would. */
function StoryFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-4">
      {children}
    </div>
  )
}

export const Static: Story = {
  parameters: storyDocumentation(
    "The default render: fully expanded, no toggles, no focusable parts — pure readable output. Keys tint muted while values keep the foreground color, and arrays print one item per line inside their brackets. The play test asserts the key/value color split from computed styles and that no buttons exist.",
  ),
  render: () => (
    <StoryFrame>
      <JsonTree value={sampleValue} />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryAllByRole("button")).toHaveLength(0)
    const tree = canvasElement.querySelector<HTMLElement>(
      '[data-slot="json-tree"]',
    )!
    const keys = tree.querySelectorAll<HTMLElement>(
      '[data-slot="json-tree-key"]',
    )
    await expect(keys.length).toBe(9)
    // Keys tint muted while values keep the tree's foreground color.
    await expect(getComputedStyle(keys[0]!).color).not.toBe(
      getComputedStyle(tree).color,
    )
    const values = tree.querySelectorAll<HTMLElement>(
      '[data-slot="json-tree-value"]',
    )
    await expect(getComputedStyle(values[0]!).color).toBe(
      getComputedStyle(tree).color,
    )
    // JSON stays faithful: quoted strings, bare numbers, null spelled out.
    await expect(tree.textContent).toContain('"url": "https://api.nessa.dev')
    await expect(tree.textContent).toContain("250")
    await expect(tree.textContent).toContain('"note": null')
  },
}

export const Collapsible: Story = {
  parameters: storyDocumentation(
    "With `collapsible`, every object and array leads with a disclosure chevron. Folding a branch replaces it with its brackets and an entry count, and the toggle reports state via aria-expanded. The play test folds the headers object and asserts its children leave the tree, the count appears, and the chevron's computed rotation settles back to none.",
  ),
  render: () => (
    <StoryFrame>
      <JsonTree value={sampleValue} collapsible />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole("button", { name: "Toggle headers" })
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    const chevron = toggle.querySelector("svg")!
    await waitFor(() =>
      expect(getComputedStyle(chevron).rotate).toBe("90deg"),
    )
    await expect(canvasElement.textContent).toContain('"accept"')
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(canvasElement.textContent).not.toContain('"accept"')
    await expect(canvasElement.textContent).toContain("2 keys")
    await waitFor(() =>
      expect(["none", "0deg"]).toContain(getComputedStyle(chevron).rotate),
    )
    // Arrays fold to an item count the same way.
    await userEvent.click(canvas.getByRole("button", { name: "Toggle retries" }))
    await expect(canvasElement.textContent).toContain("3 items")
    // Leave the tree open so the story lands on the full payload, ready to
    // be folded by hand.
    await userEvent.click(canvas.getByRole("button", { name: "Toggle retries" }))
    await userEvent.click(toggle)
    await expect(canvasElement.textContent).toContain('"accept"')
  },
}

/** A payload that trips every bound: wide, deep, circular, and exotic leaves. */
function unboundedValue() {
  const root: Record<string, unknown> = {
    files: Array.from({ length: 600 }, (_, index) => `src/file-${index}.ts`),
    sparse: ["first", , "third"],
    exotic: { when: new Date(0), amount: 10n, run: () => undefined },
  }
  let deep: Record<string, unknown> = root
  for (let level = 0; level < 70; level += 1) {
    const next: Record<string, unknown> = { level }
    deep.nested = next
    deep = next
  }
  root.self = root
  return root
}

export const BoundedPayload: Story = {
  parameters: storyDocumentation(
    "The safety rails, all at once: a 600-item array truncates to its head with an explicit '…100 more items not shown' row (never a silent cut), nesting past the depth cap renders as a folded summary rather than a giant serialized dump, a self-referencing branch renders '[Circular]' instead of recursing forever, and exotic leaves (Date, bigint, function) degrade to readable text instead of throwing. Sparse array holes print as null, matching what the payload actually serializes to. The play test asserts every one of these bounds.",
  ),
  render: () => (
    <StoryFrame>
      <JsonTree value={unboundedValue()} collapsible />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const tree = canvasElement.querySelector<HTMLElement>(
      '[data-slot="json-tree"]',
    )!
    // Breadth: the head renders, the remainder is named, not silently cut.
    const overflow = tree.querySelector<HTMLElement>(
      '[data-slot="json-tree-overflow"]',
    )!
    await expect(overflow).toHaveTextContent("…100 more items not shown")
    // The overflow row aligns with the item rows it follows: same leading
    // chevron column, so its text starts where theirs does.
    const siblingRow = Array.from(
      overflow.parentElement!.children,
    ).find((child) =>
      child.matches('[data-slot="json-tree-row"]'),
    ) as HTMLElement
    await expect(
      overflow.lastElementChild!.getBoundingClientRect().left,
    ).toBeCloseTo(
      siblingRow.lastElementChild!.getBoundingClientRect().left,
      0,
    )
    // Depth: the chain is cut at the cap and folds into a summary rather
    // than dumping the rest of the subtree. The last rendered link is
    // level 62; level 63's contents must not appear anywhere.
    await expect(tree.textContent).toContain('"level": 62')
    await expect(tree.textContent).toContain("{…} 2 keys")
    await expect(tree.textContent).not.toContain('"level": 63')
    // Cycles are bounded, and exotic leaves stay readable.
    await expect(tree.textContent).toContain("[Circular]")
    await expect(tree.textContent).toContain("[function]")
    await expect(tree.textContent).toContain('"1970-01-01T00:00:00.000Z"')
    await expect(tree.textContent).toContain('"amount": 10')
    // Array holes serialize as null, so that is what they show.
    await expect(tree.textContent).toContain("null")
  },
}

export const CollapsedByDefault: Story = {
  parameters: storyDocumentation(
    "`defaultExpandedDepth={1}` opens only the top level, so nested branches start folded to their entry counts — the shape a dense inspector wants, one click away from detail. The play test asserts the nested object starts collapsed and expands on demand.",
  ),
  render: () => (
    <StoryFrame>
      <JsonTree value={sampleValue} collapsible defaultExpandedDepth={1} />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole("button", { name: "Toggle headers" })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(canvasElement.textContent).not.toContain('"accept"')
    // Top-level entries stay visible.
    await expect(canvasElement.textContent).toContain('"tool": "http_request"')
    await userEvent.click(toggle)
    await expect(canvasElement.textContent).toContain('"accept"')
  },
}
