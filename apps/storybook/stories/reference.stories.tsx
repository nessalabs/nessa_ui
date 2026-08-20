import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Reference,
  ReferenceCard,
  ReferenceContent,
  ReferenceTrigger,
  cn,
  type ReferenceSource,
} from "@nessa-ui/react"

import { FileCopyIcon, GlobeIcon } from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

const investorLetter: ReferenceSource = {
  title: "Stripe Investor Letter",
  href: "https://example.com/stripe-investor-letter#page-14",
  excerpt: (
    <p>
      &ldquo;Embedded finance is rapidly reshaping how software companies
      monetize their platforms. Instead of directing users to external payment
      gateways, businesses are integrating financial capabilities directly
      into their applications, creating new revenue streams&hellip;&rdquo;
    </p>
  ),
  meta: "Page 14",
}

const embeddedFinanceReport: ReferenceSource = {
  title: "Embedded Finance Market Report",
  href: "https://example.com/embedded-finance-2026",
  excerpt: (
    <p>
      &ldquo;Platforms that own the payment flow retain roughly three times
      more gross profit per transaction than those handing checkout to a
      third-party gateway.&rdquo;
    </p>
  ),
  meta: "§2.4",
}

const attentionPaper: ReferenceSource = {
  title: "Attention Is All You Need",
  href: "https://arxiv.org/abs/1706.03762",
  excerpt: (
    <p>
      &ldquo;We propose a new simple network architecture, the Transformer,
      based solely on attention mechanisms, dispensing with recurrence and
      convolutions entirely.&rdquo;
    </p>
  ),
  meta: "arXiv:1706.03762",
  sourceLabel: "Open paper",
}

/** The open hover card lives in a portal, so queries scope to `document.body`. */
function cardCanvas() {
  return within(document.body)
}

function openCard() {
  return document.querySelector<HTMLElement>('[data-slot="reference-content"]')
}

/** Shared story chrome so every example frames its prose identically. */
function StoryFrame({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-h-72 w-[min(42rem,calc(100vw-2rem))] items-end justify-center rounded-3xl border border-border bg-background p-8 pb-10",
        className,
      )}
    >
      <p className="m-0 font-sans text-base leading-7 text-foreground">
        {children}
      </p>
    </div>
  )
}

const meta = {
  title: "Components/Reference",
  component: Reference,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Inline citation for agent answers and research surfaces: a chip embedded in flowing text reveals its supporting evidence in a floating card on hover, keyboard focus, or touch tap, and clicking follows the source. The card takes the batteries-included ReferenceCard — source title, quoted excerpt, locator chip, source link, and a pager when a claim cites several sources — or any custom node the host supplies. The card is a pointer-first affordance; the chip itself is a real link, so keyboard and screen reader users always have a direct path to the source.",
      },
    },
  },
} satisfies Meta<typeof Reference>

export default meta
type Story = StoryObj<typeof meta>

export const CitedAnswer: Story = {
  parameters: storyDocumentation(
    "An agent answer with citation chips inline in the prose. Hovering a chip floats the source card above it — title, quoted excerpt, page locator, and an explicit source link — while clicking the chip itself follows the citation directly. The chips are deliberately smaller than the usual 24px target size: they sit inside a sentence and rely on the WCAG 2.5.8 (Target Size, Minimum) inline exception, which the play test identifies explicitly.",
  ),
  render: () => (
    <StoryFrame className="min-h-0 items-start justify-start pb-8">
      Stripe&rsquo;s rapid growth over the last few years has largely been
      driven by the expansion of embedded financial infrastructure
      <Reference>
        <ReferenceTrigger
          href={investorLetter.href}
          aria-label="2 sources: Stripe Investor Letter and Embedded Finance Market Report"
        >
          <GlobeIcon />2
        </ReferenceTrigger>
        <ReferenceContent>
          <ReferenceCard sources={[investorLetter, embeddedFinanceReport]} />
        </ReferenceContent>
      </Reference>{" "}
      across SaaS platforms, which are increasingly integrating payments,
      billing, and financial services directly into their products
      <Reference>
        <ReferenceTrigger
          href={embeddedFinanceReport.href}
          aria-label="Source: Embedded Finance Market Report"
        >
          <FileCopyIcon />1
        </ReferenceTrigger>
        <ReferenceContent>
          <ReferenceCard sources={[embeddedFinanceReport]} />
        </ReferenceContent>
      </Reference>{" "}
      instead of relying on third-party checkout flows.
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("link", {
      name: "2 sources: Stripe Investor Letter and Embedded Finance Market Report",
    })
    // The chip is an inline target inside a sentence and claims the WCAG
    // 2.5.8 (Target Size, Minimum) inline exception: it must actually be
    // inline in flowing text for that exception to hold.
    await expect(getComputedStyle(trigger).display).toBe("inline-flex")
    await expect(openCard()).toBeNull()
    await userEvent.hover(trigger)
    await waitFor(() => expect(openCard()).not.toBeNull())
    const card = openCard()!
    await waitFor(() =>
      expect(getComputedStyle(card).visibility).toBe("visible"),
    )
    // The card surface must actually paint, not just exist in the DOM.
    await expect(getComputedStyle(card).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    )
    const portal = cardCanvas()
    await expect(portal.getByText("Stripe Investor Letter")).toBeVisible()
    await expect(portal.getByText("Page 14")).toBeVisible()
    await expect(
      portal.getByRole("link", { name: "View source" }),
    ).toHaveAttribute("href", investorLetter.href)
    await userEvent.unhover(trigger)
    await waitFor(() => expect(openCard()).toBeNull())
  },
}

export const MultipleSources: Story = {
  parameters: storyDocumentation(
    "One claim, several sources: the header grows a pager. Arrows step through the cited documents, the locale-neutral count announces politely for screen readers, and the ends disable instead of wrapping so paging never loops silently. While a pager is present the excerpt region holds a fixed height and scrolls its overflow, so stepping between long and short quotes never shifts the card; hosts retune the height through ReferenceCard's excerptClassName and localize the pager through previousLabel/nextLabel.",
  ),
  render: () => (
    <StoryFrame className="min-h-80">
      Owning the payment flow compounds platform revenue
      <Reference>
        <ReferenceTrigger
          href={investorLetter.href}
          aria-label="2 sources for platform revenue claim"
        >
          <GlobeIcon />2
        </ReferenceTrigger>
        <ReferenceContent>
          <ReferenceCard sources={[investorLetter, embeddedFinanceReport]} />
        </ReferenceContent>
      </Reference>
      .
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("link", {
      name: "2 sources for platform revenue claim",
    })
    await userEvent.hover(trigger)
    await waitFor(() => expect(openCard()).not.toBeNull())
    const portal = cardCanvas()
    await expect(portal.getByText("1 / 2")).toBeVisible()
    const card = openCard()!
    const excerpt = card.querySelector<HTMLElement>(
      '[data-slot="reference-card-excerpt"]',
    )!
    // The excerpt region scrolls overflow instead of resizing the card.
    await expect(getComputedStyle(excerpt).overflowY).toBe("auto")
    const heightBefore = card.getBoundingClientRect().height
    const previous = portal.getByRole("button", { name: "Previous source" })
    const next = portal.getByRole("button", { name: "Next source" })
    await expect(previous).toBeDisabled()
    await userEvent.click(next)
    await expect(portal.getByText("2 / 2")).toBeVisible()
    await expect(
      portal.getByText("Embedded Finance Market Report"),
    ).toBeVisible()
    // Paging to a shorter quote must not change the card's silhouette.
    await expect(card.getBoundingClientRect().height).toBe(heightBefore)
    await expect(next).toBeDisabled()
    await expect(previous).toBeEnabled()
    // Interacting with the card must not have dismissed it.
    await expect(getComputedStyle(openCard()!).visibility).toBe("visible")
  },
}

export const KeyboardAccess: Story = {
  parameters: storyDocumentation(
    "The chip is a real link in the tab order: focusing it opens the card without a pointer, and the citation stays followable because the chip itself carries the href — the card is a pointer-first affordance, so the chip link is the guaranteed keyboard and screen reader path to the source. Focus moved into the card holds it open (it no longer vanishes on trigger blur), and Escape dismisses it from either side.",
  ),
  render: () => (
    <StoryFrame>
      The Transformer architecture removed recurrence entirely
      <Reference>
        <ReferenceTrigger
          href={attentionPaper.href}
          aria-label="Source: Attention Is All You Need"
        >
          <FileCopyIcon />1
        </ReferenceTrigger>
        <ReferenceContent>
          <ReferenceCard sources={[attentionPaper]} />
        </ReferenceContent>
      </Reference>
      .
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("link", {
      name: "Source: Attention Is All You Need",
    })
    await expect(trigger).toHaveAttribute("href", attentionPaper.href)
    trigger.focus()
    await waitFor(() => expect(openCard()).not.toBeNull())
    const sourceLink = cardCanvas().getByRole("link", { name: "Open paper" })
    await expect(sourceLink).toHaveAttribute("href", attentionPaper.href)
    // Focus moving into the card must hold it open past the close delay
    // (the trigger blur would otherwise dismiss it 200ms later).
    sourceLink.focus()
    await new Promise((resolve) => setTimeout(resolve, 350))
    await expect(openCard()).not.toBeNull()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(openCard()).toBeNull())
    // Escape returns focus to the chip so keyboard users keep their place…
    await expect(document.activeElement).toBe(trigger)
    // …and the focus return must not re-arm the hover-card's focus-open:
    // the card has to STAY closed past the 150ms open delay.
    await new Promise((resolve) => setTimeout(resolve, 350))
    await expect(openCard()).toBeNull()
  },
}

export const TouchAccess: Story = {
  parameters: storyDocumentation(
    "Touch has no hover, so the tap's synthesized click does the revealing: the first tap opens the card instead of navigating, and a second tap — or the card's title and source links — follows the source. Scroll gestures never synthesize a click, so a drag that happens to end on a chip cannot pop the card open. Tapping outside dismisses through Radix's outside-press dismissal.",
  ),
  render: () => (
    <StoryFrame>
      Self-attention connects every token to every other token
      <Reference>
        <ReferenceTrigger
          href={attentionPaper.href}
          aria-label="Source: Attention Is All You Need"
        >
          <FileCopyIcon />1
        </ReferenceTrigger>
        <ReferenceContent>
          <ReferenceCard sources={[attentionPaper]} />
        </ReferenceContent>
      </Reference>
      .
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("link", {
      name: "Source: Attention Is All You Need",
    })
    await expect(openCard()).toBeNull()
    const touchInit = {
      pointerType: "touch",
      bubbles: true,
      cancelable: true,
    } as const
    // A touch tap is a pointerdown followed by a synthesized click; the
    // trigger opens the card and prevents the navigation default so the
    // first tap previews instead of leaving the page.
    trigger.dispatchEvent(new PointerEvent("pointerdown", touchInit))
    const firstTap = new PointerEvent("click", touchInit)
    trigger.dispatchEvent(firstTap)
    await expect(firstTap.defaultPrevented).toBe(true)
    await waitFor(() => expect(openCard()).not.toBeNull())
    // Second tap on the chip: its pointerdown must NOT count as an
    // outside-press dismissal (that would flush the card closed and make
    // the click reopen it forever); with the card still open, the click
    // falls through to the link so the second tap navigates.
    trigger.dispatchEvent(new PointerEvent("pointerdown", touchInit))
    await new Promise((resolve) => setTimeout(resolve, 50))
    await expect(openCard()).not.toBeNull()
    // Document-level bubble listeners run after the component's handlers,
    // so record whether the component prevented the click there — then
    // block the real navigation to keep the test on this page.
    let preventedByComponent: boolean | null = null
    const guard = (event: Event) => {
      preventedByComponent = event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener("click", guard)
    try {
      trigger.dispatchEvent(new PointerEvent("click", touchInit))
    } finally {
      document.removeEventListener("click", guard)
    }
    await expect(preventedByComponent).toBe(false)
    // Navigation for touch users lives in the card's links.
    await expect(
      cardCanvas().getByRole("link", { name: "Open paper" }),
    ).toHaveAttribute("href", attentionPaper.href)
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(openCard()).toBeNull())
  },
}

export const CustomHoverContent: Story = {
  parameters: storyDocumentation(
    "Hosts are not locked to ReferenceCard: any node dropped into ReferenceContent becomes the hover surface. Here a bespoke paper preview with authors and venue chrome replaces the standard card.",
  ),
  render: () => (
    <StoryFrame className="min-h-80">
      Self-attention lets every token attend to every other token
      <Reference>
        <ReferenceTrigger
          href={attentionPaper.href}
          aria-label="Paper: Attention Is All You Need"
        >
          [1]
        </ReferenceTrigger>
        <ReferenceContent>
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground [&>svg]:size-4">
                <FileCopyIcon />
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate font-medium text-popover-foreground">
                  Attention Is All You Need
                </p>
                <p className="m-0 truncate text-xs text-muted-foreground">
                  Vaswani et al. &middot; NeurIPS 2017
                </p>
              </div>
            </div>
            <p className="m-0 text-sm leading-relaxed text-popover-foreground">
              Introduces the Transformer, replacing recurrence and
              convolutions with multi-head self-attention and setting a new
              state of the art in translation quality.
            </p>
            <p className="m-0 text-xs text-muted-foreground">
              Cited by 140,000+
            </p>
          </div>
        </ReferenceContent>
      </Reference>{" "}
      in a single layer.
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("link", {
      name: "Paper: Attention Is All You Need",
    })
    await userEvent.hover(trigger)
    await waitFor(() => expect(openCard()).not.toBeNull())
    const portal = cardCanvas()
    await expect(
      portal.getByText("Vaswani et al. · NeurIPS 2017"),
    ).toBeVisible()
    // The bespoke body replaces ReferenceCard entirely — no pager, no footer.
    await expect(portal.queryByText("View source")).toBeNull()
  },
}
