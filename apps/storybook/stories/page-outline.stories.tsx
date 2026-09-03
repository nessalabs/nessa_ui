import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
import { PageOutline, type PageOutlineItemData } from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Data/PageOutline",
  component: PageOutline,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A scroll-spy section outline drawn along a rail that jogs sideways to trace the heading hierarchy, so depth reads from the line itself rather than from type size. A comet pulse travels the rail — through its corners, since every pulse layer is a dash window on the rail's own path — to whichever section crosses the reading line, easing symmetrically so it arrives rather than crawling. Sections come from an items array, or the outline derives them from the headings of any rendered element via contentRef, which is what makes a markdown surface work with no markdown awareness in the component; scraped content is watched for mutations so streaming output keeps the outline current. collapse=\"auto\" folds entries deeper than the second level except in the branch the reader has settled in — nothing folds mid-scroll, only where scrolling comes to rest, and rows hiding folded branches carry a count. A marker node replaces the comet with host-supplied SVG content that the outline translates and rotates along the path each frame. The root fills the box its host provides and scrolls its own rows when the box is shorter than the list.",
      },
    },
  },
} satisfies Meta<typeof PageOutline>

export default meta
type Story = StoryObj<typeof meta>

const GUIDE_SECTIONS: PageOutlineItemData[] = [
  { id: "installation", label: "Installation", depth: 0 },
  { id: "package-manager", label: "Package manager", depth: 1 },
  { id: "pnpm", label: "pnpm", depth: 2 },
  { id: "peer-dependencies", label: "Peer dependencies", depth: 3 },
  { id: "npm", label: "npm", depth: 2 },
  { id: "manual-setup", label: "Manual setup", depth: 1 },
  { id: "tailwind-config", label: "Tailwind config", depth: 2 },
  { id: "css-variables", label: "CSS variables", depth: 3 },
  { id: "usage", label: "Usage", depth: 0 },
  { id: "svg-renderer", label: "SVG Renderer", depth: 1 },
  { id: "interactive-selection", label: "Interactive Selection", depth: 1 },
  { id: "keyboard-model", label: "Keyboard model", depth: 2 },
  { id: "loading-state", label: "Loading State", depth: 1 },
  { id: "examples", label: "Examples", depth: 0 },
  { id: "lines-variant", label: "Lines Variant", depth: 1 },
  { id: "circle-grid", label: "Circle Grid", depth: 1 },
  { id: "api-reference", label: "API Reference", depth: 0 },
  { id: "props", label: "Props", depth: 1 },
]

const SECTION_COPY =
  "The rail traces the heading hierarchy rather than sitting straight, so depth stays legible without indenting the type. Scroll and the pulse traces the rail to the section being read."

function GuideDocument({ sections }: { sections: PageOutlineItemData[] }) {
  return (
    <>
      {sections.map((section) => {
        const Tag = `h${Math.min(6, section.depth + 2)}` as "h2"
        return (
          <React.Fragment key={section.id}>
            <Tag
              id={section.id}
              className={
                section.depth === 0
                  ? "mt-10 mb-2 nessa-text-6 font-semibold tracking-tight first:mt-0"
                  : section.depth === 1
                    ? "mt-7 mb-2 nessa-text-4 font-semibold"
                    : "mt-5 mb-1.5 nessa-text-3 font-medium"
              }
            >
              {section.label}
            </Tag>
            {Array.from({ length: section.depth === 0 ? 3 : 2 }, (_, i) => (
              <p
                key={i}
                className="mb-2.5 max-w-[62ch] nessa-text-2 leading-relaxed text-muted-foreground"
              >
                {SECTION_COPY}
              </p>
            ))}
          </React.Fragment>
        )
      })}
    </>
  )
}

function GuideLayout({
  children,
  outline,
  contentRef,
  scrollRef,
}: {
  children: React.ReactNode
  outline: (refs: {
    scrollRef: React.RefObject<HTMLDivElement | null>
    contentRef: React.RefObject<HTMLElement | null>
  }) => React.ReactNode
  contentRef?: React.RefObject<HTMLElement | null>
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const ownContentRef = React.useRef<HTMLElement | null>(null)
  const content = contentRef ?? ownContentRef
  return (
    <div
      ref={scrollRef}
      className="h-[26rem] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-background"
    >
      <div className="flex items-start">
        <article ref={content} className="min-w-0 flex-1 px-6 py-6">
          {children}
        </article>
        <div className="sticky top-0 w-56 flex-none border-l border-border py-6 pl-4 pr-3">
          {outline({ scrollRef, contentRef: content })}
        </div>
      </div>
    </div>
  )
}

export const Default: Story = {
  parameters: storyDocumentation(
    "The outline beside a guide, fed an items array. The rail jogs one column per depth level and the comet pulse rests centered on the active row; clicking a row scrolls the container to that section and moves the pulse along the rail to it. The play test clicks a deep entry and asserts the active row follows.",
  ),
  render: function DefaultStory() {
    const scrollRef = React.useRef<HTMLDivElement | null>(null)
    return (
      <GuideLayout
        scrollRef={scrollRef}
        outline={({ scrollRef: scroll }) => (
          <PageOutline
            aria-label="On this page"
            items={GUIDE_SECTIONS}
            scrollContainerRef={scroll}
            scrollOffset={64}
            debug
          />
        )}
      >
        <GuideDocument sections={GUIDE_SECTIONS} />
      </GuideLayout>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", { name: "On this page" })
    const rows = within(nav).getAllByRole("button")
    await expect(rows).toHaveLength(GUIDE_SECTIONS.length)
    await expect(
      within(nav).getByRole("button", { name: "Installation" }),
    ).toHaveAttribute("aria-current", "location")
    within(nav).getByRole("button", { name: "Keyboard model" }).click()
    await waitFor(() =>
      expect(
        within(nav).getByRole("button", { name: "Keyboard model" }),
      ).toHaveAttribute("aria-current", "location"),
    )
  },
}

export const FromContent: Story = {
  parameters: storyDocumentation(
    "No items array: the outline derives its sections from the headings rendered inside contentRef — the shape any markdown renderer produces — assigning slugs to headings that lack ids and mapping heading levels to rail depths. The play test asserts the scraped rows match the document's headings.",
  ),
  render: function FromContentStory() {
    const scrollRef = React.useRef<HTMLDivElement | null>(null)
    const contentRef = React.useRef<HTMLElement | null>(null)
    return (
      <GuideLayout
        scrollRef={scrollRef}
        contentRef={contentRef}
        outline={({ scrollRef: scroll, contentRef: content }) => (
          <PageOutline
            aria-label="On this page"
            contentRef={content}
            scrollContainerRef={scroll}
            scrollOffset={64}
            debug
          />
        )}
      >
        <h2>Getting started</h2>
        <p className="mb-2.5 max-w-[62ch] nessa-text-2 text-muted-foreground">
          {SECTION_COPY}
        </p>
        <h3>Install the package</h3>
        <p className="mb-2.5 max-w-[62ch] nessa-text-2 text-muted-foreground">
          {SECTION_COPY}
        </p>
        <h3>Wire the theme</h3>
        <p className="mb-2.5 max-w-[62ch] nessa-text-2 text-muted-foreground">
          {SECTION_COPY}
        </p>
        <h2>Recipes</h2>
        <p className="mb-2.5 max-w-[62ch] nessa-text-2 text-muted-foreground">
          {SECTION_COPY}
        </p>
      </GuideLayout>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", { name: "On this page" })
    await waitFor(() =>
      expect(within(nav).getAllByRole("button")).toHaveLength(4),
    )
    const rows = within(nav).getAllByRole("button")
    await expect(rows[0]).toHaveTextContent("Getting started")
    await expect(rows[1]).toHaveTextContent("Install the package")
    await expect(rows[1]).toHaveAttribute("data-depth", "1")
    await expect(rows[3]).toHaveTextContent("Recipes")
    await expect(rows[3]).toHaveAttribute("data-depth", "0")
  },
}

export const AutoCollapse: Story = {
  parameters: storyDocumentation(
    "collapse=\"auto\": entries deeper than the second level fold away except inside the branch the reader has settled in, and rows hiding folded descendants carry a count badge. Folding is settle-driven — passing sections mid-scroll changes nothing; only where scrolling comes to rest reshapes the outline. The play test asserts deep rows outside the settled branch are folded and their ancestors carry counts.",
  ),
  render: function AutoCollapseStory() {
    const scrollRef = React.useRef<HTMLDivElement | null>(null)
    return (
      <GuideLayout
        scrollRef={scrollRef}
        outline={({ scrollRef: scroll }) => (
          <PageOutline
            aria-label="On this page"
            items={GUIDE_SECTIONS}
            scrollContainerRef={scroll}
            scrollOffset={64}
            debug
            collapse="auto"
          />
        )}
      >
        <GuideDocument sections={GUIDE_SECTIONS} />
      </GuideLayout>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", { name: "On this page" })
    const row = (label: string) =>
      Array.from(nav.querySelectorAll<HTMLElement>("[data-slot=page-outline-row]")).find(
        (element) => element.textContent?.includes(label),
      )!
    // Settled at the top: Installation's own branch is open one level, and
    // deep rows under sibling branches are folded with counts on their
    // visible ancestors.
    await waitFor(() => expect(row("Keyboard model")).toHaveAttribute("data-folded"))
    await expect(row("pnpm")).toHaveAttribute("data-folded")
    await expect(row("Interactive Selection")).toHaveTextContent("1")
    await expect(row("Package manager")).toHaveTextContent("3")
    await expect(row("Usage")).not.toHaveAttribute("data-folded")
  },
}

export const CustomMarker: Story = {
  parameters: storyDocumentation(
    "A host-supplied marker instead of the comet: the marker prop takes SVG content drawn centered on 0,0 pointing toward positive y, and the outline translates and rotates it along the rail each frame — through the jogs, banking with the path tangent. data-traveling and --page-outline-speed are published on the marker group so the host can style motion states. The play test asserts the custom marker group is present and the comet layers are not.",
  ),
  render: function CustomMarkerStory() {
    const scrollRef = React.useRef<HTMLDivElement | null>(null)
    return (
      <GuideLayout
        scrollRef={scrollRef}
        outline={({ scrollRef: scroll }) => (
          <PageOutline
            aria-label="On this page"
            items={GUIDE_SECTIONS}
            scrollContainerRef={scroll}
            scrollOffset={64}
            debug
            marker={
              <g data-testid="rail-car">
                <path
                  d="M-3.5 -6 Q0 -9 3.5 -6 L3.5 4 Q3.5 7 0 7 Q-3.5 7 -3.5 4 Z"
                  className="fill-foreground"
                />
                <circle cx="-3.5" cy="-1" r="1.4" className="fill-background" />
                <circle cx="3.5" cy="-1" r="1.4" className="fill-background" />
                <circle cx="-3.5" cy="4" r="1.4" className="fill-background" />
                <circle cx="3.5" cy="4" r="1.4" className="fill-background" />
              </g>
            }
          />
        )}
      >
        <GuideDocument sections={GUIDE_SECTIONS} />
      </GuideLayout>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", { name: "On this page" })
    await expect(
      nav.querySelector("[data-slot=page-outline-marker]"),
    ).toBeTruthy()
    await expect(nav.querySelector("[data-testid=rail-car]")).toBeTruthy()
    await expect(
      nav.querySelector("[data-slot=page-outline-pulse]"),
    ).toBeNull()
    await waitFor(() =>
      expect(
        nav
          .querySelector("[data-slot=page-outline-marker]")
          ?.getAttribute("transform"),
      ).toContain("translate"),
    )
  },
}
