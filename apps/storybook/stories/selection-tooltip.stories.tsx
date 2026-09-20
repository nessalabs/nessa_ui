import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Copy,
  Highlighter,
  Languages,
  Link,
  Sparkles,
  TextQuote,
  Trash2,
} from "lucide-react"
import {
  Button,
  RandomAvatar,
  SelectionTooltip,
  SelectionTooltipAction,
  SelectionTooltipCompose,
  SelectionTooltipComposeTrigger,
  SelectionTooltipLabel,
  SelectionTooltipMore,
  SelectionTooltipPanel,
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

type PostedComment = { id: number; author: string; body: string }

function CommentDemo() {
  const [composing, setComposing] = React.useState(false)
  const [comments, setComments] = React.useState<PostedComment[]>([])
  const nextId = React.useRef(1)
  return (
    <SelectionParagraph>
      <SelectionTooltip
        className="absolute left-8 top-4"
        composing={composing}
        onComposingChange={setComposing}
      >
        <SelectionTooltipComposeTrigger aria-label="Comment">
          {/* The avatar doubles as the composer's affordance: it holds its
              place while the actions leave, and floods with paint while
              there is something being written. */}
          <RandomAvatar seed="nessa" busy={composing} className="size-5" />
          <SelectionTooltipLabel>Comment</SelectionTooltipLabel>
        </SelectionTooltipComposeTrigger>
        <SelectionTooltipSeparator />
        <SelectionTooltipAction aria-label="Add to chat" tooltip="Add to chat">
          <ChatAddIcon aria-hidden="true" />
          <SelectionTooltipLabel>Add to chat</SelectionTooltipLabel>
        </SelectionTooltipAction>
        <SelectionTooltipSeparator />
        <SelectionTooltipShelf>
          <SelectionTooltipAction aria-label="Copy" tooltip="Copy">
            <Copy aria-hidden="true" />
          </SelectionTooltipAction>
          <SelectionTooltipAction aria-label="Highlight" tooltip="Highlight">
            <Highlighter aria-hidden="true" />
          </SelectionTooltipAction>
        </SelectionTooltipShelf>
        <SelectionTooltipMore />
        <SelectionTooltipCompose
          placeholder="Add a comment…"
          onSubmit={(body) => {
            setComments((posted) => [
              ...posted,
              { id: nextId.current++, author: "You", body },
            ])
            setComposing(false)
          }}
        />
        {/* The pill keeps no comments of its own: the panel renders the
            host's list, and the host's own controls remove from it. */}
        <SelectionTooltipPanel
          open={comments.length > 0}
          className="w-72 max-w-[min(20rem,80vw)]"
        >
          <ul className="space-y-1.5">
            {comments.map((comment) => (
              <li key={comment.id} className="flex items-start gap-2">
                {/* size-4 inside the panel's px-3: the comment's mark
                    lands on the same centre line as the trigger's larger
                    one, so the two read as one column. */}
                <RandomAvatar
                  seed="nessa"
                  className="mt-px size-4 shrink-0"
                />
                <p className="min-w-0 grow whitespace-normal break-words leading-5">
                  <span className="font-medium">{comment.author}</span>{" "}
                  <span className="text-muted-foreground">{comment.body}</span>
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete comment: ${comment.body}`}
                  className="-mr-1 size-6 shrink-0 text-muted-foreground"
                  onClick={() =>
                    setComments((posted) =>
                      posted.filter((entry) => entry.id !== comment.id),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          {comments.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 px-2 text-muted-foreground"
              onClick={() => setComments([])}
            >
              Clear all
            </Button>
          )}
        </SelectionTooltipPanel>
      </SelectionTooltip>
    </SelectionParagraph>
  )
}

export const CommentMode: Story = {
  // Cross-engine: Selection and Range APIs, which engines report differently.
  tags: ["cross-engine"],
  parameters: storyDocumentation(
    "Commenting happens inside the pill: the avatar holds its place while the actions slide out, the composer slides into the same row at the same width, and what was written grows a panel beneath. The pill stores nothing — the panel renders the host's list, so the host's own delete and Clear all controls live in it, and emptying the list closes the panel again. Escape or sending hands the row back to the actions, with focus back on the avatar.",
  ),
  render: () => <CommentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvasElement.querySelector<HTMLElement>(
      '[data-slot="selection-tooltip-row"]',
    )
    const compose = canvasElement.querySelector<HTMLElement>(
      '[data-slot="selection-tooltip-compose"]',
    )
    const panel = canvasElement.querySelector<HTMLElement>(
      '[data-slot="selection-tooltip-panel"]',
    )
    await expect(row).not.toBeNull()
    await expect(compose).not.toBeNull()
    await expect(panel).not.toBeNull()
    if (row === null || compose === null || panel === null) return

    // Closed, the composer is inert: nothing in it can be reached by tab.
    await expect(compose).toHaveAttribute("inert")
    const trigger = canvas.getByRole("button", { name: "Comment" })
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(trigger).toHaveAttribute("aria-controls", compose.id)
    // With nothing posted, the band is shut and holds no height.
    await expect(panel.getBoundingClientRect().height).toBe(0)
    // Nor any width: the band is wider than the action row, and while it is
    // shut the pill is exactly as wide as the row's own items.
    const pill = canvas.getByRole("group", { name: "Selection actions" })
    await expect(pill.getBoundingClientRect().width).toBeCloseTo(
      row.getBoundingClientRect().width,
      1,
    )

    await canvasElement.ownerDocument.fonts.ready
    // At rest, beside its label, the avatar's paint fills its disc and the
    // disc sits on the trigger's centre line. The trigger sizes the icons
    // it is handed, and that rule must stop at a mark that sizes its own
    // svg: shrunk inside the disc, the paint would sit up and to the left
    // of where the box is, and the mark would read as off-centre however
    // well the box itself is placed.
    const restingMark = trigger.querySelector<HTMLElement>(
      '[data-slot="random-avatar"]',
    )
    const restingPaint = restingMark?.querySelector("svg")
    await expect(restingMark).not.toBeNull()
    await expect(restingPaint).not.toBeNull()
    if (restingMark === null || restingPaint == null) return
    {
      const disc = restingMark.getBoundingClientRect()
      const paint = restingPaint.getBoundingClientRect()
      const box = trigger.getBoundingClientRect()
      await expect(paint.width).toBeCloseTo(disc.width, 1)
      await expect(paint.height).toBeCloseTo(disc.height, 1)
      await expect(paint.left).toBeCloseTo(disc.left, 1)
      await expect(paint.top).toBeCloseTo(disc.top, 1)
      await expect(paint.top + paint.height / 2).toBeCloseTo(
        box.top + box.height / 2,
        1,
      )
    }
    const idleWidth = row.getBoundingClientRect().width
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    // The composer lands on the footprint the actions left: same row, same
    // width, so nothing under the pill shifts while it morphs.
    await expect(row.getBoundingClientRect().width).toBeCloseTo(idleWidth, 1)
    await expect(compose).not.toHaveAttribute("inert")

    // Opening is a request to write, so the caret is already in the input.
    const input = canvas.getByRole("textbox", { name: "Write a comment" })
    await waitFor(() => expect(input).toHaveFocus())
    // With its label gone, the avatar sits centred in what the trigger has
    // left rather than hugging one edge of it.
    await waitFor(() => {
      const mark = restingMark.getBoundingClientRect()
      const paint = restingPaint.getBoundingClientRect()
      const box = trigger.getBoundingClientRect()
      expect(mark.left + mark.width / 2).toBeCloseTo(box.left + box.width / 2, 1)
      // The paint still fills the disc: centring the box is only half of it.
      expect(paint.left + paint.width / 2).toBeCloseTo(
        box.left + box.width / 2,
        1,
      )
      expect(paint.width).toBeCloseTo(mark.width, 1)
    })
    // The composer starts to the right of the avatar, which never moved.
    await waitFor(() =>
      expect(compose.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        trigger.getBoundingClientRect().right,
      ),
    )
    // The field draws no ring of its own — the caret marks it, and the
    // composer opens focused, so a ring would fire on every morph.
    await expect(getComputedStyle(input).outlineStyle).toBe("none")
    // The displaced actions leave the tab sequence with the row: invisible
    // controls must not take focus behind the composer.
    const displaced = canvas.getByRole("button", { name: "Add to chat" })
    await expect(displaced.closest("[inert]")).not.toBeNull()
    displaced.focus()
    await expect(displaced).not.toHaveFocus()
    await expect(input).toHaveFocus()
    // An empty draft has nothing to send.
    await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled()

    await userEvent.type(input, "Needs a citation")
    // Wait for the state the click depends on — an enabled Send — rather
    // than for the field's value, which commits a tick earlier.
    const send = canvas.getByRole("button", { name: "Send" })
    await waitFor(() => expect(send).toBeEnabled())
    await userEvent.click(send)

    // The comment lands in the band beneath the row, which grows open.
    await expect(await canvas.findByText("Needs a citation")).toBeVisible()
    await waitFor(() =>
      expect(panel.getBoundingClientRect().height).toBeGreaterThan(0),
    )
    // The comment's mark lines up with the trigger's: one column, whatever
    // the two sizes are.
    const postedMark = panel.querySelector<HTMLElement>(
      '[data-slot="random-avatar"]',
    )
    await expect(postedMark).not.toBeNull()
    if (postedMark !== null) {
      const markBox = postedMark.getBoundingClientRect()
      const triggerMark = trigger.firstElementChild?.getBoundingClientRect()
      if (triggerMark !== undefined) {
        await expect(markBox.left + markBox.width / 2).toBeCloseTo(
          triggerMark.left + triggerMark.width / 2,
          1,
        )
      }
    }
    // Sending hands the row back to the actions, with focus on the avatar.
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(trigger).toHaveFocus()
    await expect(compose).toHaveAttribute("inert")
    // Focus the pill restored is marked as such, so the ring stays off it.
    await expect(trigger).toHaveAttribute("data-focus-ring", "off")

    // A second comment joins the first, and Clear all appears for the pair.
    await userEvent.click(trigger)
    const second = canvas.getByRole("textbox", { name: "Write a comment" })
    await waitFor(() => expect(second).toHaveFocus())
    await userEvent.type(second, "Whose barrier?{Enter}")
    await expect(await canvas.findByText("Whose barrier?")).toBeVisible()

    // The host's own control removes one comment from its list.
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete comment: Whose barrier?" }),
    )
    await waitFor(() => expect(canvas.queryByText("Whose barrier?")).toBeNull())
    await expect(canvas.getByText("Needs a citation")).toBeVisible()

    // Emptying the list shuts the band again — the pill kept no copy of it.
    await userEvent.click(trigger)
    const third = canvas.getByRole("textbox", { name: "Write a comment" })
    await waitFor(() => expect(third).toHaveFocus())
    await userEvent.type(third, "One more{Enter}")
    const clearAll = canvas.getByRole("button", { name: "Clear all" })
    clearAll.focus()
    await userEvent.click(clearAll)
    await waitFor(() =>
      expect(panel.getBoundingClientRect().height).toBe(0),
    )
    await expect(canvas.queryByText("Needs a citation")).toBeNull()
    // The control that shut the band took focus down with it, so the band
    // hands focus back to the row rather than dropping it on the document.
    await expect(trigger).toHaveFocus()

    // Focus goes back where it came from, not merely to the trigger: the
    // row is inert while the composer is open, so the hand-back has to wait
    // for the commit that revives it.
    const more = canvas.getByRole("button", { name: "More actions" })
    more.focus()
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "Write a comment" })).toHaveFocus(),
    )
    await userEvent.keyboard("{Escape}")
    await expect(more).toHaveFocus()

    // Escape abandons a draft without posting it. Opened from the trigger
    // this time, so the trigger is where the hand-back belongs.
    trigger.focus()
    await userEvent.click(trigger)
    const abandoned = canvas.getByRole("textbox", { name: "Write a comment" })
    await waitFor(() => expect(abandoned).toHaveFocus())
    await userEvent.type(abandoned, "Second thoughts")
    await userEvent.keyboard("{Escape}")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(trigger).toHaveFocus()
    // Closed from the keyboard too, the returned focus is marked: the pill
    // put focus back, the user's keyboard did not land there.
    await expect(trigger).toHaveAttribute("data-focus-ring", "off")
    // The mark is dropped the moment focus leaves, so an arrival under the
    // user's own power is ringed again: suppressed for the return, never
    // removed from the button.
    trigger.blur()
    await expect(trigger).not.toHaveAttribute("data-focus-ring")
    await expect(panel.getBoundingClientRect().height).toBe(0)
    // An abandoned draft does not come back the next time the composer opens.
    await expect(abandoned).toHaveValue("")
    // Leave no keyboard focus ring behind for the visual snapshot.
    trigger.blur()
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
    // A bottom-side pill points its arrow up: the rotated square sits above
    // the pill, and carries no border — the pill is borderless by default.
    await expect(arrowStyle.rotate).toBe("45deg")
    await expect(arrowStyle.borderTopWidth).toBe("0px")
    await expect(arrowStyle.borderBottomWidth).toBe("0px")
    await expect(arrow.getBoundingClientRect().top).toBeLessThan(
      below?.getBoundingClientRect().top ?? 0,
    )

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
