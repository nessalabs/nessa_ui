import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Pagination",
  component: Pagination,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Composable pagination controls: a nav landmark (Pagination) wrapping a list (PaginationContent) of items (PaginationItem) that hold compact page buttons (PaginationLink, marked current with aria-current and a ring border), previous/next controls, and a collapsed-run ellipsis. Page state and the windowing rule both live with the host — the example below computes its own page window.",
      },
    },
  },
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

/** The host owns the windowing rule; this is one reasonable seven-slot one. */
function pageWindow(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from({ length: Math.max(pageCount, 0) }, (_, index) => index + 1)
  }
  if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis", pageCount]
  if (page >= pageCount - 3) {
    return [1, "ellipsis", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
  }
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pageCount]
}

function WindowedPaginationDemo({ pageCount }: { pageCount: number }) {
  const [page, setPage] = React.useState(1)
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          />
        </PaginationItem>
        {pageWindow(page, pageCount).map((item, index) => (
          <PaginationItem key={item === "ellipsis" ? `ellipsis-${index}` : item}>
            {item === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                aria-label={`Page ${item}`}
                isActive={item === page}
                onClick={() => setPage(item)}
              >
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export const Windowed: Story = {
  parameters: storyDocumentation(
    "A host-controlled composition over many pages: the windowed range keeps the first page, the last page, and the current page's neighbors, collapsing the rest into ellipses. The active page carries aria-current and the accent treatment.",
  ),
  render: () => <WindowedPaginationDemo pageCount={24} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", { name: "Pagination" })
    const scoped = within(nav)
    await expect(
      scoped.getByRole("button", { name: "Go to previous page" }),
    ).toHaveAttribute("aria-disabled", "true")
    await expect(scoped.getByRole("button", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    )

    await userEvent.click(scoped.getByRole("button", { name: "Go to next page" }))
    await expect(scoped.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    )

    await userEvent.click(scoped.getByRole("button", { name: "Page 24" }))
    await expect(
      scoped.getByRole("button", { name: "Go to next page" }),
    ).toHaveAttribute("aria-disabled", "true")
    await expect(scoped.getByRole("button", { name: "Page 23" })).toBeVisible()
    await expect(scoped.queryByRole("button", { name: "Page 12" })).toBeNull()
  },
}

export const FewPages: Story = {
  parameters: storyDocumentation(
    "With seven or fewer pages every page renders directly — no ellipsis — while previous/next stay at the edges.",
  ),
  render: () => <WindowedPaginationDemo pageCount={5} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scoped = within(canvas.getByRole("navigation", { name: "Pagination" }))
    await expect(scoped.getAllByRole("button")).toHaveLength(7)
    await expect(scoped.queryByText("More pages")).toBeNull()
  },
}
