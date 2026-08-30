import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerFooter,
  ChatComposerInput,
  ChatComposerSubmit,
  ComposerDeliveryMode,
  ComposerQueue,
  ComposerQueueBadge,
  ComposerQueueItem,
  Sheet,
  SheetAction,
  SheetBody,
  SheetHandle,
  SheetHeader,
  SheetTitle,
  type ComposerDeliveryModeValue,
} from "@nessa-ui/react"
import { Mic, Plus } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

function QueueExample({ withComposer = false }: { withComposer?: boolean }) {
  const [items, setItems] = React.useState([
    { id: "one", content: "Compare the interaction states against the reference" },
    { id: "two", content: "Then verify the compact layout at a narrow width" },
  ])
  const [mode, setMode] = React.useState<ComposerDeliveryModeValue>("queue")
  const [status, setStatus] = React.useState("Two messages pending")

  return (
    <div className="grid w-[min(60rem,calc(100vw-2rem))] gap-2 rounded-[2rem] bg-neutral-950 p-8">
      <p className="sr-only" role="status">{status}</p>
      <ComposerQueue
        itemIds={items.map((item) => item.id)}
        onReorder={(nextIds) => {
          const itemsById = new Map(items.map((item) => [item.id, item]))
          setItems(nextIds.flatMap((id) => itemsById.get(id) ?? []))
          setStatus("Pending messages reordered")
        }}
      >
        {items.map((item) => (
          <ComposerQueueItem
            key={item.id}
            id={item.id}
            itemLabel={item.content}
            onSteer={() => setStatus(`Steering: ${item.content}`)}
            onRemove={() => {
              setItems((current) => current.filter((candidate) => candidate.id !== item.id))
              setStatus("Pending message removed")
            }}
            onMore={() => setStatus(`More actions for: ${item.content}`)}
          >
            {item.content}
          </ComposerQueueItem>
        ))}
      </ComposerQueue>
      {withComposer ? (
        <ChatComposer size="compact" onSubmit={(event) => event.preventDefault()}>
          <ChatComposerInput placeholder="Add a follow-up" />
          <ChatComposerFooter>
            <ChatComposerActions>
              <ChatComposerAction aria-label="Add attachment">
                <Plus aria-hidden="true" />
              </ChatComposerAction>
              <ComposerDeliveryMode value={mode} onValueChange={setMode} />
            </ChatComposerActions>
            <ChatComposerActions>
              <ChatComposerAction aria-label="Start voice input">
                <Mic aria-hidden="true" />
              </ChatComposerAction>
              <ChatComposerSubmit />
            </ChatComposerActions>
          </ChatComposerFooter>
        </ChatComposer>
      ) : null}
    </div>
  )
}

const meta = {
  title: "Components/ComposerQueue",
  component: ComposerQueue,
  tags: ["autodocs", "test"],
  args: {
    itemIds: [],
    onReorder: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Pending-message rows for active agent runs, plus a delivery-mode control for choosing whether the next follow-up queues behind the run or steers it immediately. A compact Queued N badge opens a plain sheet of wrapping rows; promote moves one to the front. The host owns ordering and delivery semantics.",
      },
    },
  },
} satisfies Meta<typeof ComposerQueue>

export default meta
type Story = StoryObj<typeof meta>

export const PendingMessages: Story = {
  parameters: storyDocumentation(
    "Each row exposes steer, remove, and overflow actions while preserving the queued message as application-owned content.",
  ),
  render: () => <QueueExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const firstHandle = canvas.getByRole("button", {
      name: /reorder compare the interaction states/i,
    })
    firstHandle.focus()
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector('[aria-live="assertive"]'),
      ).toHaveTextContent(
        /pending message compare the interaction states against the reference moved over compare the interaction states against the reference/i,
      ),
    )
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await expect(canvas.getByText("Pending messages reordered")).toBeVisible()
    await expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent(
      "Then verify the compact layout",
    )
    await userEvent.click(canvas.getAllByRole("button", { name: /^steer /i })[0]!)
    await expect(canvas.getByText(/Steering:/)).toBeVisible()
    await userEvent.click(
      canvas.getAllByRole("button", { name: /^remove /i })[0]!,
    )
    await expect(canvas.getByText("Pending message removed")).toBeVisible()
  },
}

export const PointerAndTouchSorting: Story = {
  parameters: storyDocumentation(
    "Pointer and touch drags use the same controlled reorder contract as keyboard sorting.",
  ),
  render: () => <QueueExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dragFirstOverSecond = async (pointerType: "mouse" | "touch") => {
      const handles = canvas.getAllByRole("button", { name: /^reorder /i })
      const firstRect = handles[0]!.getBoundingClientRect()
      const secondRect = handles[1]!.getBoundingClientRect()
      const pointerId = pointerType === "mouse" ? 1 : 2
      fireEvent.pointerDown(handles[0]!, {
        pointerId,
        pointerType,
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: firstRect.left + 8,
        clientY: firstRect.top + 8,
      })
      fireEvent.pointerMove(canvasElement.ownerDocument, {
        pointerId,
        pointerType,
        isPrimary: true,
        buttons: 1,
        clientX: secondRect.left + 8,
        clientY: secondRect.top + 8,
      })
      fireEvent.pointerMove(canvasElement.ownerDocument, {
        pointerId,
        pointerType,
        isPrimary: true,
        buttons: 1,
        clientX: secondRect.left + 8,
        clientY: secondRect.bottom - 2,
      })
      fireEvent.pointerUp(canvasElement.ownerDocument, {
        pointerId,
        pointerType,
        isPrimary: true,
        button: 0,
        clientX: secondRect.left + 8,
        clientY: secondRect.bottom - 2,
      })
    }

    await dragFirstOverSecond("mouse")
    await waitFor(() =>
      expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent(
        "Then verify the compact layout",
      ),
    )
    await dragFirstOverSecond("touch")
    await waitFor(() =>
      expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent(
        "Compare the interaction states",
      ),
    )
  },
}

export const IndependentQueueIdentities: Story = {
  parameters: storyDocumentation(
    "Independent queue instances may reuse host-local sortable IDs without emitting duplicate global DOM IDs.",
  ),
  render: () => (
    <div className="grid w-[min(60rem,calc(100vw-2rem))] gap-4 rounded-[2rem] bg-neutral-950 p-8">
      {(["Primary queue message", "Secondary queue message"] as const).map(
        (label) => (
          <ComposerQueue key={label} itemIds={["one"]} onReorder={() => undefined}>
            <ComposerQueueItem id="one" itemLabel={label}>
              {label}
            </ComposerQueueItem>
          </ComposerQueue>
        ),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("list", { name: "Pending messages" })).toHaveLength(2)
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2)
    for (const item of canvas.getAllByRole("listitem")) {
      await expect(item).not.toHaveAttribute("id")
    }
  },
}

export const ActiveRunComposition: Story = {
  parameters: storyDocumentation(
    "Compose the queue above a compact ChatComposer during an active run; switching delivery mode changes host intent without disabling text entry.",
  ),
  render: () => <QueueExample withComposer />,
  globals: { theme: "dark" },
}

function QueuedSheetExample() {
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState([
    {
      id: "one",
      content:
        "We also need this all conversations view for that which will be triggered with / history",
    },
    {
      id: "two",
      content:
        "So add components for that and then show in demo video of what you built for each",
    },
  ])
  return (
    <div className="relative h-[28rem] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background p-4">
      <ComposerQueueBadge
        count={items.length}
        onClick={() => setOpen(true)}
        aria-label={`Queued ${items.length}`}
      />
      {open ? (
        <Sheet label="Queued" onClose={() => setOpen(false)}>
          <SheetHandle />
          <SheetHeader>
            <SheetTitle>Queued</SheetTitle>
            <SheetAction>Done</SheetAction>
          </SheetHeader>
          <SheetBody className="px-0">
            <ComposerQueue
              appearance="plain"
              itemIds={items.map((item) => item.id)}
              onReorder={(nextIds) => {
                const itemsById = new Map(items.map((item) => [item.id, item]))
                setItems(nextIds.flatMap((id) => itemsById.get(id) ?? []))
              }}
            >
              {items.map((item) => (
                <ComposerQueueItem
                  key={item.id}
                  id={item.id}
                  itemLabel={item.content}
                  showHandle={false}
                  onPromote={() =>
                    setItems((current) => {
                      const next = current.filter(
                        (candidate) => candidate.id !== item.id,
                      )
                      const moved = current.find(
                        (candidate) => candidate.id === item.id,
                      )
                      return moved ? [moved, ...next] : next
                    })
                  }
                  onRemove={() =>
                    setItems((current) =>
                      current.filter((candidate) => candidate.id !== item.id),
                    )
                  }
                >
                  {item.content}
                </ComposerQueueItem>
              ))}
            </ComposerQueue>
          </SheetBody>
        </Sheet>
      ) : null}
    </div>
  )
}

export const QueuedSheet: Story = {
  parameters: storyDocumentation(
    "The compact Queued N pill opens a sheet of wrapping follow-ups. Each row can promote to the front or be removed; the list is unboxed so the sheet is the surface.",
  ),
  render: () => <QueuedSheetExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Queued 2" }))
    await expect(canvas.getByRole("dialog", { name: "Queued" })).toBeVisible()
    await expect(
      canvas.getByText(
        "We also need this all conversations view for that which will be triggered with / history",
      ),
    ).toBeVisible()
    await expect(
      canvas.getByRole("list", { name: "Pending messages" }),
    ).toHaveAttribute("data-appearance", "plain")
    await userEvent.click(
      canvas.getAllByRole("button", { name: /^promote /i })[1]!,
    )
    await expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent(
      "So add components for that",
    )
    await userEvent.click(canvas.getAllByRole("button", { name: /^remove /i })[0]!)
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    await expect(canvas.getByRole("button", { name: "Queued 1" })).toBeVisible()
  },
}
