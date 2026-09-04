import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Badge,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanColumnList,
  applyKanbanMove,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Data/Kanban",
  component: KanbanBoard,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Kanban is a composable board of columns and draggable cards. The board owns no card data: every settled move — a pointer drop or a keyboard drop — is reported once through onCardMove with the card, source column, target column, and insertion index, and the consumer renders the new order (applyKanbanMove performs the standard column-map transform). While a card moves, a drop indicator marks the insertion point in the hovered column and only the dragged card and that indicator re-render. Cards are fully keyboard-operable: Space or Enter lifts the focused card, the arrow keys walk it through positions and columns, Space drops it, Escape cancels, and every step is announced to screen readers through a live region (the wording is replaceable via getAnnouncement). Cards render any content; controls inside them, and anything marked data-kanban-no-drag, never start a drag.",
      },
    },
  },
} satisfies Meta<typeof KanbanBoard>

export default meta
type Story = StoryObj<typeof meta>

function StoryFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[30rem] w-full overflow-x-auto bg-background p-6">
      {children}
    </div>
  )
}

interface SprintCard {
  title: string
  tag: string
  assignee: string
}

const sprintCards: Record<string, SprintCard> = {
  "task-brief": {
    title: "Write launch brief",
    tag: "docs",
    assignee: "MA",
  },
  "task-tokens": {
    title: "Audit color tokens",
    tag: "design",
    assignee: "RD",
  },
  "task-api": {
    title: "Version the export API",
    tag: "backend",
    assignee: "JT",
  },
  "task-composer": {
    title: "Composer attachment chips",
    tag: "frontend",
    assignee: "SK",
  },
  "task-a11y": {
    title: "Screen-reader pass",
    tag: "a11y",
    assignee: "MA",
  },
  "task-billing": {
    title: "Billing webhook retries",
    tag: "backend",
    assignee: "JT",
  },
  "task-onboarding": {
    title: "Onboarding checklist",
    tag: "frontend",
    assignee: "SK",
  },
}

const sprintColumns = [
  { id: "backlog", title: "Backlog" },
  { id: "progress", title: "In progress" },
  { id: "review", title: "In review" },
  { id: "done", title: "Done" },
] as const

const initialSprint: Record<string, readonly string[]> = {
  backlog: ["task-brief", "task-tokens", "task-onboarding"],
  progress: ["task-api", "task-composer"],
  review: ["task-a11y"],
  done: ["task-billing"],
}

function SprintCardContent({ card }: { card: SprintCard }) {
  return (
    <span className="flex flex-col gap-2">
      <span className="text-sm font-medium">{card.title}</span>
      <span className="flex items-center justify-between gap-2">
        <Badge variant="secondary">{card.tag}</Badge>
        <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
          {card.assignee}
        </span>
      </span>
    </span>
  )
}

function SprintBoard({
  columns: initialColumns = initialSprint,
}: {
  columns?: Record<string, readonly string[]>
}) {
  const [columns, setColumns] = React.useState(initialColumns)
  const [order, setOrder] = React.useState<string[]>(() =>
    sprintColumns.map((column) => column.id),
  )

  return (
    <KanbanBoard
      onCardMove={(move) => setColumns((current) => applyKanbanMove(current, move))}
      onColumnMove={(move) =>
        setOrder((current) => {
          const next = current.filter((id) => id !== move.columnId)

          next.splice(move.index, 0, move.columnId)
          return next
        })
      }
    >
      {order.map((columnId) => {
        const column = sprintColumns.find((entry) => entry.id === columnId)!

        return (
        <KanbanColumn
          key={column.id}
          columnId={column.id}
          aria-label={column.title}
          className="w-64 shrink-0 rounded-2xl border border-border bg-background p-3"
        >
          <span className="mb-3 flex items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5">
              <KanbanColumnHandle
                aria-label={`Move ${column.title} column`}
                className="size-5"
              />
              <span className="text-sm font-medium">{column.title}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {columns[column.id]?.length ?? 0}
            </span>
          </span>
          <KanbanColumnList aria-label={`${column.title} cards`}>
            {(columns[column.id] ?? []).map((cardId) => (
              <KanbanCard
                key={cardId}
                cardId={cardId}
                aria-label={sprintCards[cardId].title}
                className="rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm"
              >
                <SprintCardContent card={sprintCards[cardId]} />
              </KanbanCard>
            ))}
          </KanbanColumnList>
        </KanbanColumn>
        )
      })}
    </KanbanBoard>
  )
}

export const SprintBoardStory: Story = {
  name: "Sprint Board",
  parameters: storyDocumentation(
    "A sprint board at app fidelity: four columns of task cards with tags and assignees. The consumer owns the column state and applies each reported move with applyKanbanMove; the board only coordinates movement.",
  ),
  render: () => (
    <StoryFrame>
      <SprintBoard />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole("group", { name: "Backlog" })).toBeVisible()
    await expect(
      canvas.getByRole("list", { name: "In progress cards" }),
    ).toBeVisible()
    await expect(canvas.getAllByRole("listitem")).toHaveLength(7)
  },
}

export const DragBetweenColumns: Story = {
  parameters: storyDocumentation(
    "Dragging a card captures the pointer on the card itself; the card floats from its spot while the drop indicator marks the insertion point in the hovered column, and releasing reports the move once through onCardMove.",
  ),
  render: () => (
    <StoryFrame>
      <SprintBoard />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvas.getByRole("listitem", { name: "Write launch brief" })
    const targetList = canvas.getByRole("list", { name: "In review cards" })

    const from = card.getBoundingClientRect()
    const to = targetList.getBoundingClientRect()
    const startX = from.x + from.width / 2
    const startY = from.y + from.height / 2
    const endX = to.x + to.width / 2
    const endY = to.y + to.height - 4

    card.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: startX,
        clientY: startY,
      }),
    )
    // The first threshold-crossing move begins the gesture and renders the
    // net-zero pickup pose; the next one travels, which is what moves the
    // drop indicator into the hovered column below.
    for (let step = 0; step < 2; step += 1) {
      card.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: endX,
          clientY: endY,
        }),
      )
    }

    // The drop indicator appears in the hovered column while dragging.
    await waitFor(() => {
      expect(
        targetList.querySelector('[data-slot="kanban-drop-indicator"]'),
      ).not.toBeNull()
    })

    card.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: endX,
        clientY: endY,
      }),
    )

    await waitFor(() => {
      const moved = within(targetList).getByRole("listitem", {
        name: "Write launch brief",
      })
      expect(moved).toBeVisible()
    })
    await expect(
      canvasElement.querySelector('[data-slot="kanban-drop-indicator"]'),
    ).toBeNull()
  },
}

export const MoveWithKeyboard: Story = {
  parameters: storyDocumentation(
    "The mouse-free path: Space lifts the focused card, the arrow keys walk it through positions and columns while the drop indicator tracks the target, Space drops it through onCardMove, and focus follows the card into its new column. Every step lands in the board's live region.",
  ),
  render: () => (
    <StoryFrame>
      <SprintBoard />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvas.getByRole("listitem", { name: "Version the export API" })

    card.focus()
    await userEvent.keyboard(" ")

    await waitFor(() => {
      expect(card).toHaveAttribute("data-lifted", "true")
    })

    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard(" ")

    const targetList = canvas.getByRole("list", { name: "In review cards" })

    await waitFor(() => {
      expect(
        within(targetList).getByRole("listitem", {
          name: "Version the export API",
        }),
      ).toBeVisible()
    })

    // Focus followed the card into its new column, and the live region
    // announced the drop.
    const moved = within(targetList).getByRole("listitem", {
      name: "Version the export API",
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(moved)
    })
    await expect(
      canvasElement.querySelector('[aria-live="polite"]')?.textContent,
    ).toMatch(/Dropped Version the export API in In review/)

    // A same-column reorder keeps the very same element — moving a node
    // with insertBefore can silently drop its focus, so the board restores
    // it after every settled move, not only across columns.
    const backlogCard = canvas.getByRole("listitem", {
      name: "Write launch brief",
    })

    backlogCard.focus()
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard(" ")

    await waitFor(() => {
      const order = [
        ...canvas
          .getByRole("list", { name: "Backlog cards" })
          .querySelectorAll('[data-slot="kanban-card"]'),
      ].map((card) => card.getAttribute("data-card-id"))
      expect(order).toEqual(["task-tokens", "task-brief", "task-onboarding"])
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(
        canvas.getByRole("listitem", { name: "Write launch brief" }),
      )
    })

    // An arrow press at the end of a column has nowhere to go, so it
    // announces nothing: the live region keeps whatever it last said
    // rather than repeating a move that never happened.
    const liveRegion = canvasElement.querySelector('[aria-live="polite"]')
    const topCard = canvas.getByRole("listitem", {
      name: "Audit color tokens",
    })

    topCard.focus()
    await userEvent.keyboard(" ")

    await waitFor(() => {
      expect(liveRegion?.textContent).toMatch(/Picked up Audit color tokens/)
    })

    const atBoundary = liveRegion?.textContent

    await userEvent.keyboard("{ArrowUp}")
    await userEvent.keyboard("{ArrowUp}")

    await expect(liveRegion?.textContent).toBe(atBoundary)

    // A step that can move still announces.
    await userEvent.keyboard("{ArrowDown}")

    await waitFor(() => {
      expect(liveRegion?.textContent).toMatch(
        /Move Audit color tokens to Backlog/,
      )
    })

    await userEvent.keyboard("{Escape}")
  },
}

export const MoveColumns: Story = {
  parameters: storyDocumentation(
    "Whole columns move too. Dragging a column's KanbanColumnHandle lifts the column clear of the board while its siblings slide to open the space, and releasing reports the new position through onColumnMove. The handle is keyboard-operable the same way cards are: Space lifts, the left and right arrows walk the column between positions, Space drops, Escape cancels.",
  ),
  render: () => (
    <StoryFrame>
      <SprintBoard />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const columnIds = () =>
      [...canvasElement.querySelectorAll('[data-slot="kanban-column"]')].map(
        (column) => column.getAttribute("data-column-id"),
      )

    await expect(columnIds()).toEqual([
      "backlog",
      "progress",
      "review",
      "done",
    ])

    // Keyboard: lift the first column and walk it one position right.
    const handle = canvas.getByRole("button", { name: "Move Backlog column" })

    handle.focus()
    await userEvent.keyboard(" ")

    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-pressed", "true")
    })

    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard(" ")

    await waitFor(() => {
      expect(columnIds()).toEqual(["progress", "backlog", "review", "done"])
    })
    await expect(
      canvasElement.querySelector('[aria-live="polite"]')?.textContent,
    ).toMatch(/Dropped Backlog at position 2 of 4/)

    // Focus followed the move: React relocated the column node, which
    // silently blurs the handle, and the board restored it.
    await waitFor(() => {
      expect(document.activeElement).toBe(handle)
    })

    // Escape abandons a lift without moving anything.
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard("{Escape}")

    await waitFor(() => {
      expect(columnIds()).toEqual(["progress", "backlog", "review", "done"])
    })

    // Pointer: one move carries the whole journey — a coalesced flick.
    // The drop settles against the release position, not against the
    // net-zero pose the threshold crossing rendered.
    const doneHandle = canvas.getByRole("button", { name: "Move Done column" })
    const doneRect = doneHandle.getBoundingClientRect()
    // Aimed at the row's leading edge rather than a neighbour's boundary,
    // so the drop clears every insertion threshold decisively.
    const leadColumn = canvasElement.querySelector<HTMLElement>(
      '[data-slot="kanban-column"][data-column-id="progress"]',
    )
    const leadRect = leadColumn!.getBoundingClientRect()

    doneHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 3,
        clientX: doneRect.x + doneRect.width / 2,
        clientY: doneRect.y + doneRect.height / 2,
      }),
    )
    doneHandle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 3,
        clientX: leadRect.x + 4,
        clientY: doneRect.y + doneRect.height / 2,
      }),
    )
    doneHandle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 3,
        clientX: leadRect.x + 4,
        clientY: doneRect.y + doneRect.height / 2,
      }),
    )

    await waitFor(() => {
      expect(columnIds()).toEqual(["done", "progress", "backlog", "review"])
    })
  },
}

export const SecondPointerCannotHijack: Story = {
  parameters: storyDocumentation(
    "One gesture owns the board at a time. A second pointer pressed on another card while a drag is in flight is refused outright, so a stray finger or palm can never redirect — or settle — someone else's drag.",
  ),
  render: () => (
    <StoryFrame>
      <SprintBoard />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = canvas.getByRole("listitem", { name: "Write launch brief" })
    const second = canvas.getByRole("listitem", { name: "Audit color tokens" })
    const reviewList = canvas.getByRole("list", { name: "In review cards" })

    const firstRect = first.getBoundingClientRect()
    const secondRect = second.getBoundingClientRect()
    const reviewRect = reviewList.getBoundingClientRect()

    // Finger one starts dragging the first card toward "In review".
    first.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: firstRect.x + firstRect.width / 2,
        clientY: firstRect.y + firstRect.height / 2,
      }),
    )
    for (let step = 0; step < 2; step += 1) {
      first.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: reviewRect.x + reviewRect.width / 2,
          clientY: reviewRect.y + 10,
        }),
      )
    }

    await waitFor(() => {
      expect(first).toHaveAttribute("data-dragging", "true")
    })

    // Finger two presses and moves on a different card: refused entirely.
    second.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 2,
        clientX: secondRect.x + secondRect.width / 2,
        clientY: secondRect.y + secondRect.height / 2,
      }),
    )
    second.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 2,
        clientX: secondRect.x + secondRect.width / 2 + 120,
        clientY: secondRect.y + secondRect.height / 2 + 60,
      }),
    )

    await expect(second).not.toHaveAttribute("data-dragging")
    await expect(first).toHaveAttribute("data-dragging", "true")

    // The first gesture still settles on its own target, uncorrupted.
    first.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        clientX: reviewRect.x + reviewRect.width / 2,
        clientY: reviewRect.y + 10,
      }),
    )

    await waitFor(() => {
      expect(
        within(reviewList).getByRole("listitem", { name: "Write launch brief" }),
      ).toBeVisible()
    })
    // The card the second finger touched never moved.
    await expect(
      within(canvas.getByRole("list", { name: "Backlog cards" })).getByRole(
        "listitem",
        { name: "Audit color tokens" },
      ),
    ).toBeVisible()
  },
}

export const EscapeCancels: Story = {
  parameters: storyDocumentation(
    "Escape abandons a keyboard lift: the indicator disappears, nothing is reported through onCardMove, and the cancellation is announced.",
  ),
  render: () => (
    <StoryFrame>
      <SprintBoard />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvas.getByRole("listitem", { name: "Audit color tokens" })
    const backlogList = canvas.getByRole("list", { name: "Backlog cards" })

    card.focus()
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Escape}")

    await waitFor(() => {
      expect(card).not.toHaveAttribute("data-lifted")
      expect(
        canvasElement.querySelector('[data-slot="kanban-drop-indicator"]'),
      ).toBeNull()
    })

    // The card never moved.
    const order = [...backlogList.querySelectorAll('[data-slot="kanban-card"]')]
    await expect(order.map((c) => c.getAttribute("data-card-id"))).toEqual([
      "task-brief",
      "task-tokens",
      "task-onboarding",
    ])
    await expect(
      canvasElement.querySelector('[aria-live="polite"]')?.textContent,
    ).toMatch(/cancelled/i)
  },
}

const STRESS_COLUMN_IDS = ["alpha", "beta", "gamma", "delta"] as const
const STRESS_CARDS_PER_COLUMN = 80

function StressKanban() {
  const [columns, setColumns] = React.useState<Record<string, readonly string[]>>(
    () =>
      Object.fromEntries(
        STRESS_COLUMN_IDS.map((columnId) => [
          columnId,
          Array.from(
            { length: STRESS_CARDS_PER_COLUMN },
            (_, index) => `${columnId}-${index}`,
          ),
        ]),
      ),
  )

  return (
    <KanbanBoard
      onCardMove={(move) => setColumns((current) => applyKanbanMove(current, move))}
    >
      {STRESS_COLUMN_IDS.map((columnId) => (
        <KanbanColumn
          key={columnId}
          columnId={columnId}
          aria-label={`Column ${columnId}`}
          className="w-56 shrink-0 rounded-2xl border border-border bg-background p-2"
        >
          <span className="mb-2 block px-1 text-xs font-medium text-muted-foreground">
            {columnId} · {columns[columnId].length}
          </span>
          <KanbanColumnList
            aria-label={`Column ${columnId} cards`}
            className="max-h-96 gap-1.5 overflow-y-auto"
            tabIndex={-1}
          >
            {columns[columnId].map((cardId) => (
              <KanbanCard
                key={cardId}
                cardId={cardId}
                aria-label={`Card ${cardId}`}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm"
              >
                {cardId}
              </KanbanCard>
            ))}
          </KanbanColumnList>
        </KanbanColumn>
      ))}
    </KanbanBoard>
  )
}

export const StressBoard: Story = {
  parameters: storyDocumentation(
    "Three hundred and twenty cards across four scrollable columns. The drag store notifies only the dragged card and the hovered column's indicator, so the rest of the board stays inert while a card moves — and a drop across columns lands at the exact insertion point.",
  ),
  render: () => (
    <StoryFrame>
      <StressKanban />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole("listitem")).toHaveLength(
      STRESS_COLUMN_IDS.length * STRESS_CARDS_PER_COLUMN,
    )

    const card = canvas.getByRole("listitem", { name: "Card alpha-0" })
    const targetList = canvas.getByRole("list", { name: "Column beta cards" })
    const from = card.getBoundingClientRect()
    const to = targetList.getBoundingClientRect()

    card.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: from.x + from.width / 2,
        clientY: from.y + from.height / 2,
      }),
    )
    // One move carries the whole journey — a coalesced flick. The drop
    // settles against the release position, not against the net-zero pose
    // the threshold crossing rendered.
    card.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: to.x + to.width / 2,
        clientY: to.y + 10,
      }),
    )
    card.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: to.x + to.width / 2,
        clientY: to.y + 10,
      }),
    )

    await waitFor(() => {
      const first = targetList.querySelector('[data-slot="kanban-card"]')
      expect(first?.getAttribute("data-card-id")).toBe("alpha-0")
    })
  },
}
