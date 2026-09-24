import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Archive, BellOff, Trash2 } from "lucide-react"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  ConversationHistory,
  type ConversationHistoryAction,
  type ConversationHistoryEntry,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const catalog: ConversationHistoryEntry[] = [
  {
    id: "agent-message",
    title: "Agent message package implementation",
    preview: "I'll start by reading the repo workflow…",
    updated: "1m",
    pinned: true,
    project: "nessalabs/nessa_ui",
  },
  {
    id: "audit",
    title: "Repo audit",
    preview: "I'll split that: one agent maps the composer call sites.",
    updated: "12m",
    project: "nessalabs/nessa_ui",
  },
  {
    id: "chat-1",
    title: "Release notes",
    preview: "New conversation",
    updated: "Just now",
  },
]

function HistoryExample() {
  const [query, setQuery] = React.useState("")
  const [value, setValue] = React.useState<string | null>("agent-message")
  const conversations = catalog.filter((entry) => {
    const haystack = `${entry.title} ${entry.preview ?? ""} ${entry.project ?? ""}`
    return haystack.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  })
  return (
    <div className="h-96 w-[min(24rem,calc(100vw-2rem))] rounded-[2rem] bg-background p-4">
      <ConversationHistory
        conversations={conversations}
        value={value}
        onValueChange={setValue}
        query={query}
        onQueryChange={setQuery}
      />
    </div>
  )
}

const meta = {
  title: "Conversation/ConversationHistory",
  component: ConversationHistory,
  tags: ["autodocs", "test"],
  args: {
    conversations: catalog,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A searchable roster of conversations: host-owned rows with a project-seeded RandomAvatar (same project, same painting), title, preview, project, pin, and relative time. Selecting a row reports its id. Optional Mail-style row actions reveal on swipe or from the keyboard.",
      },
    },
  },
} satisfies Meta<typeof ConversationHistory>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Search narrows the roster. Selecting a row marks it aria-current. Conversations that share a project share a RandomAvatar painting; a row with no project falls back to its id. An empty query shows every conversation the host passed.",
  ),
  render: () => <HistoryExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("list", { name: "Conversations" })
    await expect(within(list).getAllByRole("button")).toHaveLength(3)
    const selected = canvas.getByRole("button", {
      name: /agent message package implementation/i,
    })
    await expect(selected).toHaveAccessibleName(/pinned/i)
    await expect(selected).toHaveAttribute("aria-current", "true")
    // Current conversation metadata must not leave a second row looking hovered.
    await expect(getComputedStyle(selected).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    const agentAvatar = selected.querySelector("[data-slot=random-avatar]")
    const auditAvatar = canvas
      .getByRole("button", { name: /repo audit/i })
      .querySelector("[data-slot=random-avatar]")
    const releaseAvatar = canvas
      .getByRole("button", { name: /release notes/i })
      .querySelector("[data-slot=random-avatar]")
    await expect(agentAvatar).toBeTruthy()
    await expect(auditAvatar).toBeTruthy()
    await expect(releaseAvatar).toBeTruthy()
    await expect(agentAvatar).toHaveAttribute(
      "data-figure",
      auditAvatar!.getAttribute("data-figure"),
    )
    await expect(releaseAvatar).not.toHaveAttribute(
      "data-figure",
      agentAvatar!.getAttribute("data-figure"),
    )
    const search = canvas.getByRole("searchbox", {
      name: "Search conversations",
    })
    await userEvent.type(search, "audit")
    await expect(within(list).getAllByRole("button")).toHaveLength(1)
    await expect(
      canvas.getByRole("button", { name: /repo audit/i }),
    ).toBeVisible()
    await userEvent.clear(search)
    await userEvent.click(canvas.getByRole("button", { name: /release notes/i }))
    await expect(
      canvas.getByRole("button", { name: /release notes/i }),
    ).toHaveAttribute("aria-current", "true")
  },
}

const swipeCatalog: ConversationHistoryEntry[] = [
  ...catalog,
  {
    id: "tokens",
    title: "Motion token audit",
    preview: "Every settle now reads the duration token.",
    updated: "2h",
    project: "nessalabs/nessa_ui",
  },
  {
    id: "panel",
    title: "Panel layout",
    preview: "The Messages list sits under the tab strip.",
    updated: "Yesterday",
    project: "nessalabs/nessa-agent",
  },
]

// Archive is the primary action: a full swipe commits it. Delete is
// destructive, so it only ever runs from a deliberate, confirmed press.
const swipeActions: readonly ConversationHistoryAction[] = [
  { id: "archive", label: "Archive", icon: <Archive /> },
  { id: "delete", label: "Delete", icon: <Trash2 />, tone: "destructive" },
]

function SwipeActionsExample() {
  const [conversations, setConversations] = React.useState(swipeCatalog)
  const [value, setValue] = React.useState<string | null>("agent-message")
  const [log, setLog] = React.useState<readonly string[]>([])
  return (
    <div className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      <div className="h-96 rounded-[2rem] bg-background p-4">
        <ConversationHistory
          conversations={conversations}
          value={value}
          onValueChange={setValue}
          rowActions={() => swipeActions}
          onRowAction={(conversationId, actionId) => {
            setLog((entries) => [...entries, `${actionId}:${conversationId}`])
            // Archiving removes the row. Deleting is only logged: a real host
            // asks the viewer to confirm before anything is removed.
            if (actionId === "archive") {
              setConversations((current) =>
                current.filter((conversation) => conversation.id !== conversationId),
              )
            }
          }}
        />
      </div>
      <output
        aria-label="Row actions fired"
        className="min-h-5 px-4 font-sans nessa-text-1 text-muted-foreground"
      >
        {log.join(", ")}
      </output>
    </div>
  )
}

/** Presses a row, moves it once, and (by default) lets go — one gesture. */
function swipeRow(
  row: HTMLElement,
  dx: number,
  { pointerId, dy = 0, release = true }: { pointerId: number; dy?: number; release?: boolean },
) {
  const rect = row.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const pointer = { pointerId, pointerType: "touch", isPrimary: true }
  fireEvent.pointerDown(row, { ...pointer, button: 0, buttons: 1, clientX: x, clientY: y })
  fireEvent.pointerMove(row, { ...pointer, buttons: 1, clientX: x + dx, clientY: y + dy })
  if (release) {
    fireEvent.pointerUp(row, { ...pointer, button: 0, clientX: x + dx, clientY: y + dy })
  }
}

/** Waits until React has rendered and the browser has painted what it did. */
function nextFrames() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )
}

function rowOf(item: HTMLElement) {
  return item.closest<HTMLElement>("[data-slot=conversation-history-row]")!
}

/** The row has settled closed and carries no transform. */
async function expectClosed(item: HTMLElement) {
  await waitFor(() => expect(rowOf(item)).not.toHaveAttribute("data-swipe"))
  await expect(item.style.translate).toBe("")
  // The inline transform is gone at once; the transition it leaves behind
  // lands on no transform at all.
  await waitFor(() => expect(getComputedStyle(item).translate).toBe("none"))
}

export const SwipeActions: Story = {
  parameters: storyDocumentation(
    "Rows given `rowActions` swipe like Mail. Drag a row toward its leading edge (touch, pen, mouse, or a two-finger trackpad swipe) to reveal Archive and Delete; let go past half the tray and it rests open, short of that it springs back. Keep going past 60% of the row and Archive fills the tray — letting go archives it as the row slides out. Delete is destructive, so it never runs from a swipe: pressing it grows it to fill the tray as Confirm, and only a second press deletes. A touch long-press opens the actions without swiping. Every row is the same height. From the keyboard, ContextMenu or Shift+F10 on a focused row opens its actions; Escape closes them and returns focus to the row. One row is open at a time, and neither opening nor closing a row selects it.",
  ),
  render: () => <SwipeActionsExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const log = canvas.getByRole("status", { name: "Row actions fired" })
    const selected = canvas.getByRole("button", {
      name: /agent message package implementation/i,
    })
    const selectionUnchanged = () =>
      expect(selected).toHaveAttribute("aria-current", "true")

    // Every row is the same height, whatever lines it has to show — and so
    // every row's actions are the same size.
    const heights = within(canvas.getByRole("list", { name: "Conversations" }))
      .getAllByRole("button")
      .map((item) => Math.round(rowOf(item).getBoundingClientRect().height))
    await expect(new Set(heights).size).toBe(1)

    // Keyboard: Shift+F10 opens the focused row's actions on the first one.
    const audit = canvas.getByRole("button", { name: /^repo audit/i })
    audit.focus()
    await userEvent.keyboard("{Shift>}{F10}{/Shift}")
    const archiveAudit = canvas.getByRole("button", { name: "Archive Repo audit" })
    await waitFor(() => expect(archiveAudit).toHaveFocus())
    await waitFor(() => expect(rowOf(audit)).toHaveAttribute("data-swipe", "open"))
    await expect(
      canvas.getByRole("group", { name: "Actions for Repo audit" }),
    ).toBeVisible()
    // Escape closes and hands focus back to the row.
    await userEvent.keyboard("{Escape}")
    await expect(audit).toHaveFocus()
    await expectClosed(audit)
    await expect(
      canvas.queryByRole("button", { name: "Archive Repo audit" }),
    ).not.toBeInTheDocument()

    // The ContextMenu key opens them too. Delete asks for confirmation:
    // the first press grows it to fill the tray, Escape backs out of that
    // without closing the row, and a confirmed press deletes.
    fireEvent.keyDown(audit, { key: "ContextMenu" })
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Archive Repo audit" })).toHaveFocus(),
    )
    await userEvent.tab()
    await expect(
      canvas.getByRole("button", { name: "Delete Repo audit" }),
    ).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    const confirmAudit = canvas.getByRole("button", {
      name: "Confirm: Delete Repo audit",
    })
    await expect(confirmAudit).toHaveFocus()
    await expect(confirmAudit).toHaveTextContent("Confirm")
    await expect(log).toHaveTextContent("")
    // Focus did not move, so the change is also said out loud.
    const status = canvasElement.querySelector("[data-slot=conversation-history-status]")!
    await expect(status).toHaveTextContent("Confirm: Delete Repo audit")
    // The other action steps aside and cannot be reached while confirming.
    await expect(
      canvas.getByRole("button", { name: "Archive Repo audit" }),
    ).toHaveAttribute("inert")
    await userEvent.keyboard("{Escape}")
    await expect(
      canvas.getByRole("button", { name: "Archive Repo audit" }),
    ).not.toHaveAttribute("inert")
    await expect(
      canvas.getByRole("button", { name: "Delete Repo audit" }),
    ).toHaveFocus()
    await expect(rowOf(audit)).toHaveAttribute("data-swipe", "open")
    await expect(status).toHaveTextContent("")
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{Enter}")
    await expect(log).toHaveTextContent("delete:audit")
    await expect(audit).toHaveFocus()
    await expectClosed(audit)
    await selectionUnchanged()

    // A swipe short of half the tray springs back and selects nothing.
    const release = canvas.getByRole("button", { name: /^release notes/i })
    swipeRow(release, -30, { pointerId: 11 })
    await expectClosed(release)
    await selectionUnchanged()

    // A swipe past half the tray rests open, without selecting the row.
    swipeRow(release, -110, { pointerId: 12 })
    await waitFor(() => expect(rowOf(release)).toHaveAttribute("data-swipe", "open"))
    await expect(
      canvas.getByRole("button", { name: "Archive Release notes" }),
    ).toBeVisible()
    await selectionUnchanged()
    // The swipe's finger lifted without a click; the next press on an action
    // still reaches it. Delete confirms first, then only logs in this story,
    // so the row stays.
    await userEvent.click(canvas.getByRole("button", { name: "Delete Release notes" }))
    await expect(log).toHaveTextContent(/^delete:audit$/)
    await userEvent.click(
      canvas.getByRole("button", { name: "Confirm: Delete Release notes" }),
    )
    await expect(log).toHaveTextContent("delete:audit, delete:chat-1")
    await expectClosed(release)
    swipeRow(release, -110, { pointerId: 16 })
    await waitFor(() => expect(rowOf(release)).toHaveAttribute("data-swipe", "open"))

    // Opening another row closes this one: one row is open at a time.
    const tokens = canvas.getByRole("button", { name: /^motion token audit/i })
    swipeRow(tokens, -110, { pointerId: 13 })
    await waitFor(() => expect(rowOf(tokens)).toHaveAttribute("data-swipe", "open"))
    await expectClosed(release)

    // A press elsewhere closes it, and the press does not select what it hit.
    await userEvent.click(release)
    await expectClosed(tokens)
    await selectionUnchanged()

    // A gesture that sets off vertically is a scroll, never a swipe — even
    // when it then travels far enough sideways to open the row.
    const rect = tokens.getBoundingClientRect()
    const pointer = { pointerId: 14, pointerType: "touch", isPrimary: true, buttons: 1 }
    const [x, y] = [rect.left + rect.width / 2, rect.top + rect.height / 2]
    fireEvent.pointerDown(tokens, { ...pointer, button: 0, clientX: x, clientY: y })
    fireEvent.pointerMove(tokens, { ...pointer, clientX: x - 4, clientY: y + 20 })
    fireEvent.pointerMove(tokens, { ...pointer, clientX: x - 140, clientY: y + 30 })
    await nextFrames()
    await expect(rowOf(tokens)).not.toHaveAttribute("data-swipe")
    await expect(tokens.style.translate).toBe("")
    fireEvent.pointerUp(tokens, { ...pointer, button: 0, clientX: x - 140, clientY: y + 30 })
    await nextFrames()
    await expect(rowOf(tokens)).not.toHaveAttribute("data-swipe")
    await expect(tokens.style.translate).toBe("")

    // A trackpad scroll that opens with a pixel of sideways wobble stays a
    // scroll: the sideways-leaning first event is claimed (Chrome only lets
    // the first event of a sequence be cancelled), but every vertical event
    // after it scrolls, and the row does not move.
    const wobble = [
      new WheelEvent("wheel", { deltaX: 1, bubbles: true, cancelable: true }),
      new WheelEvent("wheel", { deltaY: 30, bubbles: true, cancelable: true }),
      new WheelEvent("wheel", { deltaY: 30, bubbles: true, cancelable: true }),
    ]
    for (const event of wobble) tokens.dispatchEvent(event)
    await expect(wobble[0]!.defaultPrevented).toBe(true)
    await expect(wobble.slice(1).some((event) => event.defaultPrevented)).toBe(false)
    await nextFrames()
    await expect(rowOf(tokens)).not.toHaveAttribute("data-swipe")
    // Let that wheel gesture go idle so the next one starts fresh.
    await new Promise((resolve) => setTimeout(resolve, 200))

    // A two-finger horizontal trackpad swipe opens the row; a vertical wheel
    // is left to scroll the list.
    const vertical = new WheelEvent("wheel", {
      deltaY: 40,
      bubbles: true,
      cancelable: true,
    })
    tokens.dispatchEvent(vertical)
    await expect(vertical.defaultPrevented).toBe(false)
    // A wheel gesture keeps its axis until it goes idle.
    await new Promise((resolve) => setTimeout(resolve, 200))
    const horizontal = [40, 40, 40].map(
      (deltaX) => new WheelEvent("wheel", { deltaX, bubbles: true, cancelable: true }),
    )
    for (const event of horizontal) tokens.dispatchEvent(event)
    await expect(horizontal.every((event) => event.defaultPrevented)).toBe(true)
    await waitFor(() => expect(rowOf(tokens)).toHaveAttribute("data-swipe", "open"))
    // Scrolling the list closes it.
    canvas.getByRole("list", { name: "Conversations" }).dispatchEvent(new Event("scroll"))
    await expectClosed(tokens)

    // A still touch press opens the actions without a swipe, and lifting the
    // finger does not select the row.
    const panel = canvas.getByRole("button", { name: /^panel layout/i })
    const panelRect = panel.getBoundingClientRect()
    const hold = { pointerId: 17, pointerType: "touch", isPrimary: true }
    const [holdX, holdY] = [panelRect.left + 40, panelRect.top + panelRect.height / 2]
    fireEvent.pointerDown(panel, { ...hold, button: 0, buttons: 1, clientX: holdX, clientY: holdY })
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Archive Panel layout" })).toHaveFocus(),
    )
    fireEvent.pointerUp(panel, { ...hold, button: 0, clientX: holdX, clientY: holdY })
    fireEvent.click(panel)
    await selectionUnchanged()
    await userEvent.keyboard("{Escape}")
    await expectClosed(panel)

    // A full swipe commits Archive — the primary action — and the host
    // removes the row.
    swipeRow(release, -330, { pointerId: 15 })
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: /^release notes/i }),
      ).not.toBeInTheDocument(),
    )
    await expect(log).toHaveTextContent("delete:audit, delete:chat-1, archive:chat-1")
    await selectionUnchanged()
    // Nothing is left displaced or waiting to settle.
    for (const item of within(
      canvas.getByRole("list", { name: "Conversations" }),
    ).getAllByRole("button")) {
      await expectClosed(item)
    }
  },
}

export const SwipeActionsReducedMotion: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Under reduced motion a row does not slide. It jumps between closed and open as the gesture crosses the same thresholds, settles without a transition, and every action still works from a gesture or the keyboard.",
  ),
  render: () => <SwipeActionsExample />,
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView
    if (!view?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const reduced = view.matchMedia("(prefers-reduced-motion: reduce)").matches
    const audit = canvas.getByRole("button", { name: /^repo audit/i })

    // Mid-gesture, short of half the tray: the row stays put.
    swipeRow(audit, -30, { pointerId: 21, release: false })
    await waitFor(() => expect(rowOf(audit)).toHaveAttribute("data-swipe", "tracking"))
    if (reduced) await expect(audit.style.translate).toBe("")
    else await expect(audit.style.translate).toBe("-30px")
    fireEvent.pointerUp(audit, { pointerId: 21, pointerType: "touch", button: 0 })
    await expectClosed(audit)

    // Past half the tray it opens; under reduced motion that is one step to
    // the resting width with no transition to wait out.
    swipeRow(audit, -110, { pointerId: 22 })
    await waitFor(() => expect(rowOf(audit)).toHaveAttribute("data-swipe", "open"))
    const tray = canvas.getByRole("group", { name: "Actions for Repo audit" })
    // Compared as set, not as measured: with motion on, the tray's width
    // transition may still be landing.
    await expect(Number.parseFloat(audit.style.translate)).toBe(
      -Number.parseFloat(tray.style.width),
    )
    if (reduced) {
      await expect(getComputedStyle(audit).transitionDuration).toBe("0s")
    }

    // The keyboard path works the same way.
    audit.focus()
    await userEvent.keyboard("{Shift>}{F10}{/Shift}")
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Archive Repo audit" })).toHaveFocus(),
    )
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: /^repo audit/i }),
      ).not.toBeInTheDocument(),
    )
    await expect(
      canvas.getByRole("status", { name: "Row actions fired" }),
    ).toHaveTextContent("archive:audit")
    // Focus moved to the row that took the archived one's place.
    await expect(
      canvas.getByRole("button", { name: /^release notes/i }),
    ).toHaveFocus()
    await expectClosed(canvas.getByRole("button", { name: /^release notes/i }))
  },
}

// A host-drawn action face: the component keeps the button, its colors and
// states, and its accessible name; the host draws what is inside.
const customActions: readonly ConversationHistoryAction[] = [
  {
    id: "mute",
    label: "Mute",
    render: ({ confirming }) => (
      <>
        <BellOff aria-hidden="true" className="size-4" />
        <span className="font-sans nessa-text-1 font-semibold">
          {confirming ? "Sure?" : "Mute"}
        </span>
        <span className="font-sans nessa-text-1 opacity-80">1 hour</span>
      </>
    ),
    confirm: true,
  },
  { id: "delete", label: "Delete", icon: <Trash2 />, tone: "destructive" },
]

export const CustomActionContent: Story = {
  parameters: storyDocumentation(
    "`render` draws an action's content in place of the default icon and label — here a Mute action with a duration line that also opts into confirmation. The button, its colors, confirmation, and accessible name stay the component's.",
  ),
  render: () => {
    const [log, setLog] = React.useState<readonly string[]>([])
    return (
      <div className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        <div className="h-72 rounded-[2rem] bg-background p-4">
          <ConversationHistory
            conversations={catalog}
            rowActions={() => customActions}
            onRowAction={(conversationId, actionId) =>
              setLog((entries) => [...entries, `${actionId}:${conversationId}`])
            }
          />
        </div>
        <output
          aria-label="Row actions fired"
          className="min-h-5 px-4 font-sans nessa-text-1 text-muted-foreground"
        >
          {log.join(", ")}
        </output>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    const audit = canvas.getByRole("button", { name: /^repo audit/i })
    audit.focus()
    await userEvent.keyboard("{Shift>}{F10}{/Shift}")
    const mute = canvas.getByRole("button", { name: "Mute Repo audit" })
    await waitFor(() => expect(mute).toHaveFocus())
    await expect(mute).toHaveTextContent("Mute1 hour")
    await userEvent.keyboard("{Enter}")
    await expect(
      canvas.getByRole("button", { name: "Confirm: Mute Repo audit" }),
    ).toHaveTextContent("Sure?1 hour")
    await userEvent.keyboard("{Enter}")
    await expect(
      canvas.getByRole("status", { name: "Row actions fired" }),
    ).toHaveTextContent("mute:audit")
    await expect(audit).toHaveFocus()
    await expectClosed(audit)

    // Mute asks for confirmation, so a full swipe only opens the row: an
    // action that confirms never runs from a gesture.
    swipeRow(audit, -330, { pointerId: 31 })
    await waitFor(() => expect(rowOf(audit)).toHaveAttribute("data-swipe", "open"))
    await expect(
      canvas.getByRole("status", { name: "Row actions fired" }),
    ).toHaveTextContent(/^mute:audit$/)
    await userEvent.keyboard("{Escape}")
    canvas.getByRole("list", { name: "Conversations" }).dispatchEvent(new Event("scroll"))
    await expectClosed(audit)
  },
}
