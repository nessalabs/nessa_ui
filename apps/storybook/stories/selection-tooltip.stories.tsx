import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Check,
  Copy,
  Highlighter,
  Languages,
  Link,
  Sparkles,
  TextQuote,
  X,
} from "lucide-react"
import {
  Button,
  Input,
  SelectionTooltip,
  SelectionTooltipAction,
  SelectionTooltipLabel,
  SelectionTooltipMore,
  SelectionTooltipSeparator,
  SelectionTooltipShelf,
  useSelectionTooltip,
} from "@nessalabs/ui"

import { ChatAddIcon, CommentIcon } from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Conversation/SelectionTooltip",
  component: SelectionTooltip,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A floating selection-callout pill in the spirit of the iOS text-selection menu: labeled actions separated by hairline rules, a chevron toggle, and a chevron-revealed shelf that scrolls horizontally with its scrollbar hidden. The host positions the pill over the selection and owns what every action does; only the shelf reveal is managed by the component.",
      },
    },
  },
} satisfies Meta<typeof SelectionTooltip>

export default meta
type Story = StoryObj<typeof meta>

function SelectionParagraph({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[26rem] rounded-3xl border border-border bg-card p-6 pt-16">
      {children}
      <p className="font-sans text-sm leading-6 text-card-foreground">
        Pierre lowers the barrier to entry{" "}
        <mark className="rounded-sm bg-primary/15 px-0.5 text-card-foreground">
          by providing a drop-in editor component
        </mark>{" "}
        with an ambitious goal: anyone should understand how to use it.
      </p>
    </div>
  )
}

export const Playground: Story = {
  parameters: storyDocumentation(
    "Comment and Add to chat sit in the pill; the chevron reveals a shelf of further icon actions that scrolls horizontally without showing a scrollbar.",
  ),
  render: () => (
    <SelectionParagraph>
      <SelectionTooltip className="absolute left-8 top-4">
        <SelectionTooltipAction
          aria-label="Comment"
          tooltip="Comment"
        >
          <CommentIcon aria-hidden="true" />
          <SelectionTooltipLabel>Comment</SelectionTooltipLabel>
        </SelectionTooltipAction>
        <SelectionTooltipSeparator />
        <SelectionTooltipAction
          aria-label="Add to chat"
          tooltip="Add to chat"
        >
          <ChatAddIcon aria-hidden="true" />
          <SelectionTooltipLabel>Add to chat</SelectionTooltipLabel>
        </SelectionTooltipAction>
        <SelectionTooltipSeparator />
        <SelectionTooltipShelf>
          <SelectionTooltipAction
            aria-label="Copy"
            tooltip="Copy"
          >
            <Copy aria-hidden="true" />
          </SelectionTooltipAction>
          <SelectionTooltipAction
            aria-label="Quote"
            tooltip="Quote"
          >
            <TextQuote aria-hidden="true" />
          </SelectionTooltipAction>
          <SelectionTooltipAction
            aria-label="Improve"
            tooltip="Improve"
          >
            <Sparkles aria-hidden="true" />
          </SelectionTooltipAction>
          <SelectionTooltipAction
            aria-label="Translate"
            tooltip="Translate"
          >
            <Languages aria-hidden="true" />
          </SelectionTooltipAction>
          <SelectionTooltipAction
            aria-label="Highlight"
            tooltip="Highlight"
          >
            <Highlighter aria-hidden="true" />
          </SelectionTooltipAction>
          <SelectionTooltipAction
            aria-label="Copy link"
            tooltip="Copy link"
          >
            <Link aria-hidden="true" />
          </SelectionTooltipAction>
        </SelectionTooltipShelf>
        <SelectionTooltipMore />
      </SelectionTooltip>
    </SelectionParagraph>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("group", { name: "Selection actions" }),
    ).toBeVisible()
    const shelf = canvasElement.querySelector<HTMLElement>(
      '[data-slot="selection-tooltip-shelf"]',
    )
    await expect(shelf).not.toBeNull()
    if (shelf === null) return
    await expect(getComputedStyle(shelf).display).toBe("none")

    // Collapsed, the sticky actions show their text labels.
    const labels = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="selection-tooltip-label"]',
      ),
    )
    await expect(labels).toHaveLength(2)
    for (const label of labels) {
      await expect(getComputedStyle(label).display).not.toBe("none")
    }

    const more = canvas.getByRole("button", { name: "More actions" })
    await expect(more).toHaveAttribute("aria-controls", shelf.id)
    const chevron = more.querySelector("svg")
    await expect(chevron).not.toBeNull()
    if (chevron === null) return
    await expect(getComputedStyle(chevron).rotate).toBe("none")
    await expect(more).toHaveAttribute("aria-expanded", "false")
    const pill = canvas.getByRole("group", { name: "Selection actions" })
    // Let the web fonts settle first: a font swap after this measurement
    // would shift the pill's collapsed width and fake a geometry change.
    await canvasElement.ownerDocument.fonts.ready
    const collapsedPillRect = pill.getBoundingClientRect()
    const collapsedMoreRect = more.getBoundingClientRect()
    await userEvent.click(more)
    await expect(more).toHaveAttribute("aria-expanded", "true")
    // Expanding must not widen the pill or move the toggle: the user closes
    // the shelf without moving the cursor.
    await expect(pill.getBoundingClientRect().width).toBeCloseTo(
      collapsedPillRect.width,
      1,
    )
    await expect(more.getBoundingClientRect().left).toBeCloseTo(
      collapsedMoreRect.left,
      1,
    )
    // The chevron turns to point back at the pill while the shelf is open
    // (waitFor lets the transition finish before reading the settled value).
    await waitFor(() =>
      expect(getComputedStyle(chevron).rotate).toBe("180deg"),
    )
    // The scroll region itself takes keyboard focus.
    await expect(shelf).toHaveAttribute("tabindex", "0")

    // Expanded, the sticky actions collapse to icon-only while keeping their
    // accessible names.
    for (const label of labels) {
      await expect(getComputedStyle(label).display).toBe("none")
    }
    await expect(canvas.getByRole("button", { name: "Comment" })).toBeVisible()

    // Hovering an icon action reveals its arrowed tooltip naming it.
    const improve = canvas.getByRole("button", { name: "Improve" })
    await userEvent.hover(improve)
    const documentBody = within(canvasElement.ownerDocument.body)
    const tipText = await documentBody.findByText("Improve")
    await expect(tipText).toBeVisible()
    const tip = tipText.closest<HTMLElement>(
      '[data-slot="selection-tooltip-action-tip"]',
    )
    await expect(tip).not.toBeNull()
    // The arrow polygon points back at the hovered action.
    await expect(tip?.querySelector("svg")).not.toBeNull()
    await userEvent.unhover(improve)

    // The toggle keeps the pill's right edge: the shelf expands between the
    // sticky actions and the chevron.
    await expect(
      more.getBoundingClientRect().left,
    ).toBeGreaterThanOrEqual(shelf.getBoundingClientRect().right)

    const shelfStyle = getComputedStyle(shelf)
    await expect(shelfStyle.display).toBe("flex")
    await expect(shelfStyle.overflowX).toBe("auto")
    // The shelf must scroll without ever showing a scrollbar.
    await expect(shelfStyle.scrollbarWidth).toBe("none")
    await expect(shelf.scrollWidth).toBeGreaterThan(shelf.clientWidth)

    // The overflow region scrolls: the last shelf action starts clipped and
    // scrolling the shelf brings it fully into view.
    const copyLink = canvas.getByRole("button", { name: "Copy link" })
    await expect(copyLink.getBoundingClientRect().right).toBeGreaterThan(
      shelf.getBoundingClientRect().right,
    )
    shelf.scrollLeft = shelf.scrollWidth
    await waitFor(() => expect(shelf.scrollLeft).toBeGreaterThan(0))

    await userEvent.click(more)
    await expect(more).toHaveAttribute("aria-expanded", "false")
    await expect(getComputedStyle(shelf).display).toBe("none")
    // Drop the synthetic focus the test's clicks left behind, so the story
    // never rests with a keyboard focus ring on the toggle.
    more.blur()
  },
}

function CommentDemo() {
  const [mode, setMode] = React.useState<"actions" | "comment">("actions")
  const [draft, setDraft] = React.useState("")
  const [comment, setComment] = React.useState<string | null>(null)
  return (
    <SelectionParagraph>
      <SelectionTooltip className="absolute left-8 top-4">
        {mode === "actions" ? (
          <>
            <SelectionTooltipAction onClick={() => setMode("comment")}>
              <CommentIcon aria-hidden="true" />
              Comment
            </SelectionTooltipAction>
            <SelectionTooltipSeparator />
            <SelectionTooltipAction>
              <ChatAddIcon aria-hidden="true" />
              Add to chat
            </SelectionTooltipAction>
          </>
        ) : (
          <>
            <Input
              autoFocus
              aria-label="Comment"
              placeholder="Add a comment"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-8 w-52 border-0 bg-transparent shadow-none dark:bg-transparent"
            />
            <SelectionTooltipAction
              aria-label="Save comment"
              onClick={() => {
                setComment(draft)
                setDraft("")
                setMode("actions")
              }}
            >
              <Check aria-hidden="true" />
            </SelectionTooltipAction>
            <SelectionTooltipAction
              aria-label="Cancel comment"
              onClick={() => {
                setDraft("")
                setMode("actions")
              }}
            >
              <X aria-hidden="true" />
            </SelectionTooltipAction>
          </>
        )}
      </SelectionTooltip>
      {comment !== null && (
        <p className="mt-3 rounded-xl bg-muted px-3 py-2 font-sans text-sm leading-6 text-foreground">
          {comment}
        </p>
      )}
    </SelectionParagraph>
  )
}

export const CommentMode: Story = {
  parameters: storyDocumentation(
    "Action clicks stay host-owned: this host swaps the pill's children into a comment composer when Comment is clicked, and back once the comment is saved. The component itself only manages the shelf reveal.",
  ),
  render: () => <CommentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Comment" }))

    const input = canvas.getByRole("textbox", { name: "Comment" })
    await userEvent.type(input, "Needs a citation")
    await userEvent.click(canvas.getByRole("button", { name: "Save comment" }))

    await expect(canvas.getByText("Needs a citation")).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "Comment" }),
    ).toBeVisible()
    await expect(canvas.queryByRole("textbox")).toBeNull()
  },
}

function ShelfHighlightAction() {
  const { setExpanded } = useSelectionTooltip()
  return (
    <SelectionTooltipAction aria-label="Highlight" onClick={() => setExpanded(false)}>
      <Highlighter aria-hidden="true" />
    </SelectionTooltipAction>
  )
}

function ControlledDemo() {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="flex flex-col items-start gap-4 rounded-3xl border border-border bg-card p-6">
      {/* Flips the prop directly, without going through the pill's own
          toggle — the path a controlled host takes from its own UI. */}
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        Toggle tools
      </Button>
      <SelectionTooltip expanded={open} onExpandedChange={setOpen}>
        <SelectionTooltipAction aria-label="Comment">
          <CommentIcon aria-hidden="true" />
          <SelectionTooltipLabel>Comment</SelectionTooltipLabel>
        </SelectionTooltipAction>
        <SelectionTooltipSeparator />
        <SelectionTooltipShelf>
          <ShelfHighlightAction />
        </SelectionTooltipShelf>
        <SelectionTooltipMore />
      </SelectionTooltip>
    </div>
  )
}

export const ControlledShelf: Story = {
  parameters: storyDocumentation(
    "The shelf reveal can be controlled through expanded and onExpandedChange, and any shelf item can collapse it via useSelectionTooltip — focus returns to the chevron toggle so keyboard users never land on a hidden element.",
  ),
  render: () => <ControlledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const shelf = canvasElement.querySelector<HTMLElement>(
      '[data-slot="selection-tooltip-shelf"]',
    )
    await expect(shelf).not.toBeNull()
    if (shelf === null) return

    const more = canvas.getByRole("button", { name: "More actions" })
    await expect(getComputedStyle(shelf).display).toBe("none")

    // Expanding by flipping the prop directly (not via the chevron) must
    // also hold the collapsed geometry: this is the path covered by the
    // ResizeObserver measurement rather than setExpanded's.
    const pill = canvas.getByRole("group", { name: "Selection actions" })
    await canvasElement.ownerDocument.fonts.ready
    const collapsedPillRect = pill.getBoundingClientRect()
    const collapsedMoreRect = more.getBoundingClientRect()
    const externalToggle = canvas.getByRole("button", { name: "Toggle tools" })
    await userEvent.click(externalToggle)
    await expect(getComputedStyle(shelf).display).toBe("flex")
    await expect(pill.getBoundingClientRect().width).toBeCloseTo(
      collapsedPillRect.width,
      1,
    )
    await expect(more.getBoundingClientRect().left).toBeCloseTo(
      collapsedMoreRect.left,
      1,
    )
    await userEvent.click(externalToggle)
    await expect(getComputedStyle(shelf).display).toBe("none")

    await userEvent.click(more)
    await expect(getComputedStyle(shelf).display).toBe("flex")

    const highlight = canvas.getByRole("button", { name: "Highlight" })
    highlight.focus()
    await userEvent.click(highlight)
    await expect(getComputedStyle(shelf).display).toBe("none")
    // Collapsing from inside the shelf hands focus back to the toggle.
    await expect(more).toHaveFocus()
    await expect(more).toHaveAttribute("aria-expanded", "false")
  },
}

export const BelowSelection: Story = {
  parameters: storyDocumentation(
    "side=\"bottom\" floats the pill under the selection with the arrow pointing up; the arrow can be dropped entirely with arrow={false}.",
  ),
  render: () => (
    <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6">
      <SelectionTooltip side="bottom">
        <SelectionTooltipAction>
          <CommentIcon aria-hidden="true" />
          Comment
        </SelectionTooltipAction>
        <SelectionTooltipSeparator />
        <SelectionTooltipAction>
          <ChatAddIcon aria-hidden="true" />
          Add to chat
        </SelectionTooltipAction>
      </SelectionTooltip>
      <SelectionTooltip arrow={false} aria-label="Selection actions, no arrow">
        <SelectionTooltipAction>
          <CommentIcon aria-hidden="true" />
          Comment
        </SelectionTooltipAction>
        <SelectionTooltipMore />
      </SelectionTooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [below, plain] = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="selection-tooltip"]',
      ),
    )
    await expect(below).toHaveAttribute("data-side", "bottom")

    const arrow = below?.querySelector<HTMLElement>(
      '[data-slot="selection-tooltip-arrow"]',
    )
    await expect(arrow).not.toBeNull()
    if (arrow === null || arrow === undefined) return
    const arrowStyle = getComputedStyle(arrow)
    // A bottom-side pill points its arrow up: the rotated square shows its
    // top-left edges and sits above the pill.
    await expect(arrowStyle.rotate).toBe("45deg")
    await expect(arrowStyle.borderTopWidth).toBe("1px")
    await expect(arrowStyle.borderBottomWidth).toBe("0px")

    await expect(
      plain?.querySelector('[data-slot="selection-tooltip-arrow"]'),
    ).toBeNull()
    // A toggle without a shelf must not reference a nonexistent id.
    const shelflessMore = plain?.querySelector(
      '[data-slot="selection-tooltip-more"]',
    )
    await expect(shelflessMore).not.toBeNull()
    await expect(shelflessMore).not.toHaveAttribute("aria-controls")
  },
}
