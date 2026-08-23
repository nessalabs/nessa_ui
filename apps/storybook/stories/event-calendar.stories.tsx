import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  EventCalendar,
  EventCalendarGrid,
  EventCalendarToolbar,
  Input,
  PopoverSurface,
  cn,
  type EventCalendarEvent,
  type EventCalendarEventRenderContext,
  type EventCalendarQuickCreateContext,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

/** Hour-row height the stories rely on for position assertions. */
const HOUR_HEIGHT = 56

/** Fixed clock all stories share: Tuesday, August 18, 2026 at 9:40. */
const storyNow = new Date(2026, 7, 18, 9, 40)

/** Builds an instant in the stories' fixed August 2026 week. */
function at(day: number, hour: number, minute = 0) {
  return new Date(2026, 7, day, hour, minute)
}

/** A believable product-team week around the fixed story clock. */
const demoEvents: EventCalendarEvent[] = [
  {
    id: "summit",
    title: "Nessa design summit",
    // Midnight to midnight: the calendar infers all-day from the times.
    start: at(20, 0),
    end: at(21, 0),
    tone: "secondary",
  },
  ...[17, 18, 19, 20, 21].map((day) => ({
    id: `standup-${day}`,
    title: "Standup",
    start: at(day, 9, 15),
    end: at(day, 9, 30),
  })),
  {
    id: "roadmap",
    title: "Roadmap review",
    start: at(17, 11),
    end: at(17, 12, 30),
    location: "Harbor room",
  },
  {
    id: "design-crit",
    title: "Design crit",
    start: at(18, 13),
    end: at(18, 14, 30),
    location: { name: "Studio", room: "3B" },
  },
  {
    id: "pairing",
    title: "Pairing: composer chips",
    start: at(18, 13, 30),
    end: at(18, 14, 30),
    tone: "secondary",
  },
  {
    id: "release-cut",
    title: "Release cut",
    start: at(18, 16),
    end: at(18, 16, 30),
    tone: "destructive",
  },
  {
    id: "dentist",
    title: "Dentist (tentative)",
    start: at(19, 15),
    end: at(19, 16),
    tone: "muted",
  },
  {
    id: "focus-block",
    title: "Focus: event calendar",
    start: at(20, 9, 30),
    end: at(20, 12),
    tone: "secondary",
  },
  {
    id: "retro",
    title: "Sprint retro",
    start: at(21, 15),
    end: at(21, 16),
  },
  {
    id: "onboarding",
    title: "Onboarding sync",
    start: at(18, 10, 30),
    end: at(18, 11),
  },
]

/** Formats a selection range the way the demo card announces it. */
function formatSelectionRange({ start, end }: { start: Date; end: Date }) {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(start)
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${day}, ${time.format(start)} – ${time.format(end)}`
}

/**
 * The stories' quick-create card — a host-side composition, not part of
 * the calendar. It receives the selection context from `renderQuickCreate`
 * and resolves it through `createEvent`/`cancel`; apps swap in whatever
 * compose surface they want here.
 */
function DemoQuickCreate({
  selection,
}: {
  selection: EventCalendarQuickCreateContext
}) {
  const [title, setTitle] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <PopoverSurface
      role="dialog"
      aria-label="New event"
      radius="lg"
      className="flex w-64 flex-col gap-2 p-3"
    >
      <Input
        ref={inputRef}
        value={title}
        placeholder="Add a title"
        aria-label="Event title"
        className="h-8 md:text-xs"
        onChange={(changeEvent) => setTitle(changeEvent.target.value)}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Enter") {
            keyEvent.preventDefault()
            selection.createEvent({ title })
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {formatSelectionRange(selection.range)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7"
          onClick={() => selection.createEvent({ title })}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={selection.cancel}
        >
          Cancel
        </Button>
      </div>
    </PopoverSurface>
  )
}

/** Shared render prop wiring the demo card into a story's calendar. */
function renderDemoQuickCreate(selection: EventCalendarQuickCreateContext) {
  return <DemoQuickCreate selection={selection} />
}

/** Shared story chrome sizing the calendar like an app content pane. */
function StoryFrame({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className ?? "h-[560px] w-[min(64rem,calc(100vw-2rem))]"}>
      {children}
    </div>
  )
}

const meta = {
  title: "Components/EventCalendar",
  component: EventCalendar,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "An Outlook-style scheduling surface with day, week, and month views. Hosts stack an EventCalendarToolbar — Today, previous/next paging, a live range label, and a Day/Week/Month switcher — above an EventCalendarGrid. The day and week views render a scrollable 24-hour grid with an all-day shelf, overlap-packed event chips, and a now indicator; the month view is a six-week matrix where each day's event pills scroll in place when they outgrow the cell. Dragging across empty slots, or arrowing on a day column and pressing Enter, selects a range and opens the host's own quick-create UI, supplied through the renderQuickCreate render prop and resolved via its createEvent/cancel context; onSelectRange, onCreateEvent, and onEventMove mirror every step for hosts that own scheduling.",
      },
    },
  },
} satisfies Meta<typeof EventCalendar>

export default meta
type Story = StoryObj<typeof meta>

export const WeekView: Story = {
  parameters: storyDocumentation(
    "The flagship week: Monday-first columns under a sticky header with an all-day shelf, tone-colored event chips (primary meetings, secondary personal blocks, muted tentative, destructive deadline), and the now indicator on today's column. Tuesday's design crit and pairing session conflict, so the play test proves the Outlook-style cascade by computed geometry — the later event indents from the left and stacks above the earlier one at a slightly narrower width. Clicking a chip also selects it: a subtle ring-and-offset highlight (host-observable through selectedEventId/onSelectedEventChange) that clears when empty grid is pressed, which the play test verifies by computed box shadow.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={demoEvents}
        defaultDate={storyNow}
        now={storyNow}
        locale="en-US"
        renderQuickCreate={renderDemoQuickCreate}
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const crit = await canvas.findByRole("button", { name: /^Design crit,/ })
    const pairing = await canvas.findByRole("button", {
      name: /^Pairing: composer chips,/,
    })
    const column = crit.closest<HTMLElement>(
      '[data-slot="event-calendar-day-column"]',
    )
    await expect(column).not.toBeNull()
    const columnWidth = column!.getBoundingClientRect().width
    const critStyle = getComputedStyle(crit)
    const pairingStyle = getComputedStyle(pairing)
    await expect(parseFloat(critStyle.width)).toBeGreaterThan(
      columnWidth * 0.9,
    )
    await expect(parseFloat(pairingStyle.left)).toBeGreaterThan(
      parseFloat(critStyle.left) + columnWidth * 0.1,
    )
    await expect(parseFloat(pairingStyle.width)).toBeLessThan(
      parseFloat(critStyle.width),
    )
    await expect(parseFloat(pairingStyle.zIndex)).toBeGreaterThan(
      parseFloat(critStyle.zIndex),
    )
    const critTop = parseFloat(getComputedStyle(crit).top)
    await expect(critTop).toBeCloseTo(13 * HOUR_HEIGHT, 0)
    const nowLine = canvasElement.querySelector<HTMLElement>(
      '[data-slot="event-calendar-now-line"]',
    )
    await expect(nowLine).not.toBeNull()
    await expect(parseFloat(getComputedStyle(nowLine!).top)).toBeCloseTo(
      ((9 * 60 + 40) / 60) * HOUR_HEIGHT,
      0,
    )

    // Clicking an event marks it selected with a ring-and-offset shadow;
    // pressing empty grid clears it again.
    const unselectedShadow = getComputedStyle(crit).boxShadow
    await userEvent.click(crit)
    await expect(crit).toHaveAttribute("aria-pressed", "true")
    const selectedShadow = getComputedStyle(crit).boxShadow
    await expect(selectedShadow).not.toBe(unselectedShadow)
    await expect(selectedShadow.split(",").length).toBeGreaterThan(1)
    const surface = canvas.getByRole("button", {
      name: /Schedule for Wednesday, August 19/,
    })
    await fireEvent.pointerDown(surface, { button: 0, pointerId: 1 })
    await fireEvent.pointerUp(surface, { pointerId: 1 })
    await expect(crit).toHaveAttribute("aria-pressed", "false")
    await waitFor(() =>
      expect(getComputedStyle(crit).boxShadow).toBe(unselectedShadow),
    )
  },
}

export const DayView: Story = {
  parameters: storyDocumentation(
    "A single day at the same fixed clock: the full-width column keeps the hour gutter, overlap packing, and the now line, and the header date stays highlighted as today. Ideal when a host boots the calendar into an agenda-style focus view.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={demoEvents}
        defaultDate={storyNow}
        defaultView="day"
        now={storyNow}
        locale="en-US"
        renderQuickCreate={renderDemoQuickCreate}
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
}

export const MonthView: Story = {
  parameters: storyDocumentation(
    "The six-week month matrix with per-day event pills. Tuesday the 18th holds five events — more than its cell can show — so the pill list scrolls in place without scrollbar chrome, keeping every event reachable from the month. The play test proves all five pills exist, that the list really overflows and scrolls by computed metrics, and that double-clicking the cell still opens the day view.",
  ),
  render: () => (
    <StoryFrame className="h-[720px] w-[min(64rem,calc(100vw-2rem))]">
      <EventCalendar
        defaultEvents={demoEvents}
        defaultDate={storyNow}
        defaultView="month"
        now={storyNow}
        locale="en-US"
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const releaseCut = await canvas.findByRole("button", {
      name: /^Release cut,/,
    })
    const list = releaseCut.closest<HTMLElement>(
      '[data-slot="event-calendar-month-events"]',
    )
    await expect(list).not.toBeNull()
    await expect(within(list!).getAllByRole("button")).toHaveLength(5)
    await expect(getComputedStyle(list!).overflowY).toBe("auto")
    await expect(list!.scrollHeight).toBeGreaterThan(list!.clientHeight)
    list!.scrollTop = list!.scrollHeight
    await waitFor(() => expect(list!.scrollTop).toBeGreaterThan(0))
    const surface = canvas.getByRole("button", {
      name: /Tuesday, August 18, 5 events/,
    })
    await fireEvent.dblClick(surface)
    await canvas.findByText("Tuesday, August 18, 2026")
  },
}

export const DragToCreate: Story = {
  parameters: storyDocumentation(
    "The Outlook quick-compose gesture: dragging across empty slots highlights a snapped range and releasing opens the host-supplied quick-create card — a story-side composition passed through renderQuickCreate — with the title field focused — a plain click only parks the highlight without opening anything. The play test proves the click stays quiet, then drags 9:00 to 10:30, types a title, saves, and proves the new chip exists at the computed 9:00 offset with the primary tone's computed background.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={[
          {
            id: "design-crit",
            title: "Design crit",
            start: at(18, 13),
            end: at(18, 14, 30),
          },
        ]}
        defaultDate={storyNow}
        defaultView="day"
        now={storyNow}
        locale="en-US"
        renderQuickCreate={renderDemoQuickCreate}
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const surface = await canvas.findByRole("button", {
      name: /Schedule for Tuesday, August 18/,
    })
    const rect = surface.getBoundingClientRect()
    await fireEvent.pointerDown(surface, {
      button: 0,
      pointerId: 1,
      buttons: 1,
      clientX: rect.left + 40,
      clientY: rect.top + 9 * HOUR_HEIGHT + 2,
    })
    await fireEvent.pointerUp(surface, { pointerId: 1 })
    await expect(
      canvas.queryByRole("dialog", { name: "New event" }),
    ).toBeNull()
    await fireEvent.pointerDown(surface, {
      button: 0,
      pointerId: 1,
      buttons: 1,
      clientX: rect.left + 40,
      clientY: rect.top + 9 * HOUR_HEIGHT + 2,
    })
    await fireEvent.pointerMove(surface, {
      pointerId: 1,
      buttons: 1,
      clientX: rect.left + 40,
      clientY: rect.top + 10 * HOUR_HEIGHT + 2,
    })
    const selection = canvasElement.querySelector<HTMLElement>(
      '[data-slot="event-calendar-selection"]',
    )
    await expect(selection).not.toBeNull()
    await expect(getComputedStyle(selection!).borderStyle).toBe("solid")
    await fireEvent.pointerUp(surface, { pointerId: 1 })
    const dialog = await canvas.findByRole("dialog", { name: "New event" })
    const titleField = within(dialog).getByRole("textbox", {
      name: "Event title",
    })
    await waitFor(() => expect(titleField).toHaveFocus())
    await within(dialog).getByText(
      "Tuesday, August 18, 9:00 AM – 10:30 AM",
    )
    await userEvent.type(titleField, "Design sync")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    const chip = await canvas.findByRole("button", { name: /^Design sync,/ })
    await expect(parseFloat(getComputedStyle(chip).top)).toBeCloseTo(
      9 * HOUR_HEIGHT,
      0,
    )
    const reference = await canvas.findByRole("button", {
      name: /^Design crit,/,
    })
    await expect(getComputedStyle(chip).backgroundColor).toBe(
      getComputedStyle(reference).backgroundColor,
    )
  },
}

export const DragToMove: Story = {
  parameters: storyDocumentation(
    "Rescheduling by direct manipulation with the confirmation gate opted out (confirmMoves={false}): grabbing a chip and dragging shows a ghost preview snapped to the slot grid, and releasing commits the move immediately — across times and across days — through onEventMove. From the keyboard, the default Shift+Arrow keys nudge a pending ghost (the same gesture that extends a draft selection, aimed at a focused event instead), Mod+Alt+J/K grow or shrink its duration, and Enter places it (every shortcut is host-replaceable via the shortcuts prop). The play test drags the design crit from 1:00 PM to 3:00 PM by computed chip offset, nudges it to Wednesday and half an hour later with Shift+Arrow, then stretches its bottom edge from 5:00 to 6:00 and proves the new duration by computed chip height.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={[
          {
            id: "design-crit",
            title: "Design crit",
            start: at(18, 13),
            end: at(18, 14, 30),
          },
        ]}
        defaultDate={storyNow}
        now={storyNow}
        locale="en-US"
        confirmMoves={false}
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chip = await canvas.findByRole("button", { name: /^Design crit,/ })
    const chipRect = chip.getBoundingClientRect()
    const columnRect = chip
      .closest<HTMLElement>('[data-slot="event-calendar-day-column"]')!
      .getBoundingClientRect()
    await fireEvent.pointerDown(chip, {
      button: 0,
      pointerId: 1,
      buttons: 1,
      clientX: chipRect.left + 12,
      clientY: chipRect.top + 8,
    })
    await fireEvent.pointerMove(window, {
      pointerId: 1,
      buttons: 1,
      clientX: chipRect.left + 12,
      clientY: columnRect.top + 15 * HOUR_HEIGHT + 8,
    })
    const ghost = canvasElement.querySelector<HTMLElement>(
      '[data-slot="event-calendar-move-preview"]',
    )
    await expect(ghost).not.toBeNull()
    await expect(parseFloat(getComputedStyle(ghost!).top)).toBeCloseTo(
      15 * HOUR_HEIGHT,
      0,
    )
    await fireEvent.pointerUp(window, { pointerId: 1 })
    const movedChip = await canvas.findByRole("button", {
      name: /Design crit, Tuesday, August 18, 3:00 PM to 4:30 PM/,
    })
    await expect(parseFloat(getComputedStyle(movedChip).top)).toBeCloseTo(
      15 * HOUR_HEIGHT,
      0,
    )
    movedChip.focus()
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}")
    const adjustingGhost = canvasElement.querySelector<HTMLElement>(
      '[data-slot="event-calendar-move-preview"]',
    )
    await expect(adjustingGhost).not.toBeNull()
    await userEvent.keyboard("{Enter}")
    const wednesdayChip = await canvas.findByRole("button", {
      name: /Design crit, Wednesday, August 19, 3:00 PM/,
    })
    await waitFor(() => expect(wednesdayChip).toHaveFocus())
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
    await userEvent.keyboard("{Enter}")
    const nudgedChip = await canvas.findByRole("button", {
      name: /Design crit, Wednesday, August 19, 3:30 PM to 5:00 PM/,
    })
    await expect(parseFloat(getComputedStyle(nudgedChip).top)).toBeCloseTo(
      15.5 * HOUR_HEIGHT,
      0,
    )

    // Dragging the bottom edge stretches the duration on the slot grid.
    const nudgedColumnRect = nudgedChip
      .closest<HTMLElement>('[data-slot="event-calendar-day-column"]')!
      .getBoundingClientRect()
    const endHandle = nudgedChip.querySelector<HTMLElement>(
      '[data-slot="event-calendar-event-resize-end"]',
    )
    await expect(endHandle).not.toBeNull()
    const handleRect = endHandle!.getBoundingClientRect()
    await fireEvent.pointerDown(endHandle!, {
      button: 0,
      pointerId: 1,
      buttons: 1,
      clientX: handleRect.left + 10,
      clientY: handleRect.top + 1,
    })
    await fireEvent.pointerMove(window, {
      pointerId: 1,
      buttons: 1,
      clientX: handleRect.left + 10,
      clientY: nudgedColumnRect.top + 18 * HOUR_HEIGHT,
    })
    await fireEvent.pointerUp(window, { pointerId: 1 })
    const stretched = await canvas.findByRole("button", {
      name: /Design crit, Wednesday, August 19, 3:30 PM to 6:00 PM/,
    })
    await expect(parseFloat(getComputedStyle(stretched).height)).toBeCloseTo(
      2.5 * HOUR_HEIGHT - 2,
      0,
    )

    // The Mod+Alt chords resize from the keyboard through the same
    // pending branch: shrink by one slot, Enter commits.
    stretched.focus()
    await userEvent.keyboard("{Meta>}{Alt>}k{/Alt}{/Meta}")
    await userEvent.keyboard("{Enter}")
    const shortened = await canvas.findByRole("button", {
      name: /Design crit, Wednesday, August 19, 3:30 PM to 5:30 PM/,
    })
    await expect(parseFloat(getComputedStyle(shortened).height)).toBeCloseTo(
      2 * HOUR_HEIGHT - 2,
      0,
    )
  },
}

export const MoveConfirmation: Story = {
  parameters: storyDocumentation(
    "Every reschedule is gated by default: dropping, edge-drag resizing, or Shift+Arrow nudging an event parks it as pending and the built-in confirmation dialog renders at the proposed slot, committing through Move or abandoning through Keep and Escape. The dialog autofocuses Move, so from the keyboard a nudge, Enter, Enter places and commits without touching the pointer. Hosts swap in their own dialog with renderMoveConfirm or turn the gate off with confirmMoves={false}. The play test drags the design crit from 1:00 PM toward 3:00 PM, confirms, proves the chip landed, then drags again and keeps the original time via cancel.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={[
          {
            id: "design-crit",
            title: "Design crit",
            start: at(18, 13),
            end: at(18, 14, 30),
          },
        ]}
        defaultDate={storyNow}
        defaultView="day"
        now={storyNow}
        locale="en-US"
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const dragChipTo = async (hour: number) => {
      const chip = await canvas.findByRole("button", {
        name: /^Design crit,/,
      })
      const chipRect = chip.getBoundingClientRect()
      const columnRect = chip
        .closest<HTMLElement>('[data-slot="event-calendar-day-column"]')!
        .getBoundingClientRect()
      await fireEvent.pointerDown(chip, {
        button: 0,
          pointerId: 1,
        buttons: 1,
        clientX: chipRect.left + 12,
        clientY: chipRect.top + 8,
      })
      await fireEvent.pointerMove(window, {
          pointerId: 1,
        buttons: 1,
        clientX: chipRect.left + 12,
        clientY: columnRect.top + hour * HOUR_HEIGHT + 8,
      })
      await fireEvent.pointerUp(window, { pointerId: 1 })
    }

    await dragChipTo(15)
    let dialog = await canvas.findByRole("dialog", { name: "Confirm move" })
    await within(dialog).getByText(
      "Tuesday, August 18, 3:00 PM – 4:30 PM",
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Move" }))
    const movedChip = await canvas.findByRole("button", {
      name: /Design crit, Tuesday, August 18, 3:00 PM/,
    })
    await expect(parseFloat(getComputedStyle(movedChip).top)).toBeCloseTo(
      15 * HOUR_HEIGHT,
      0,
    )

    await dragChipTo(17)
    dialog = await canvas.findByRole("dialog", { name: "Confirm move" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep" }))
    await expect(
      canvas.queryByRole("dialog", { name: "Confirm move" }),
    ).toBeNull()
    const keptChip = await canvas.findByRole("button", {
      name: /Design crit, Tuesday, August 18, 3:00 PM/,
    })
    await expect(parseFloat(getComputedStyle(keptChip).top)).toBeCloseTo(
      15 * HOUR_HEIGHT,
      0,
    )

    // Keyboard nudges adjust a silent ghost — the dialog appears once, on
    // Enter, so chained nudges are never interrupted.
    keptChip.focus()
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
    await expect(
      canvas.queryByRole("dialog", { name: "Confirm move" }),
    ).toBeNull()
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
    await expect(
      canvas.queryByRole("dialog", { name: "Confirm move" }),
    ).toBeNull()
    const ghost = canvasElement.querySelector<HTMLElement>(
      '[data-slot="event-calendar-move-preview"]',
    )
    await expect(ghost).not.toBeNull()
    await expect(parseFloat(getComputedStyle(ghost!).top)).toBeCloseTo(
      16 * HOUR_HEIGHT,
      0,
    )
    await userEvent.keyboard("{Enter}")
    dialog = await canvas.findByRole("dialog", { name: "Confirm move" })
    await within(dialog).getByText("Tuesday, August 18, 4:00 PM – 5:30 PM")
    // The dialog focuses Move, so a second Enter commits the placement.
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Move" })).toHaveFocus(),
    )
    await userEvent.keyboard("{Enter}")
    const rescheduled = await canvas.findByRole("button", {
      name: /Design crit, Tuesday, August 18, 4:00 PM/,
    })
    await expect(parseFloat(getComputedStyle(rescheduled).top)).toBeCloseTo(
      16 * HOUR_HEIGHT,
      0,
    )

    // Edge-drag resizing runs through the same gate, and the default
    // dialog names the change a resize when the duration differs.
    const resizeColumnRect = rescheduled
      .closest<HTMLElement>('[data-slot="event-calendar-day-column"]')!
      .getBoundingClientRect()
    const endHandle = rescheduled.querySelector<HTMLElement>(
      '[data-slot="event-calendar-event-resize-end"]',
    )
    const handleRect = endHandle!.getBoundingClientRect()
    await fireEvent.pointerDown(endHandle!, {
      button: 0,
      pointerId: 1,
      buttons: 1,
      clientX: handleRect.left + 10,
      clientY: handleRect.top + 1,
    })
    await fireEvent.pointerMove(window, {
      pointerId: 1,
      buttons: 1,
      clientX: handleRect.left + 10,
      clientY: resizeColumnRect.top + 18.5 * HOUR_HEIGHT,
    })
    await fireEvent.pointerUp(window, { pointerId: 1 })
    const resizeDialog = await canvas.findByRole("dialog", {
      name: "Confirm resize",
    })
    await within(resizeDialog).getByText("Resize “Design crit”?")
    await within(resizeDialog).getByRole("button", { name: "Resize" })
    await within(resizeDialog).getByText(
      "Tuesday, August 18, 4:00 PM – 6:30 PM",
    )
    await userEvent.click(
      within(resizeDialog).getByRole("button", { name: "Keep" }),
    )
    await canvas.findByRole("button", {
      name: /Design crit, Tuesday, August 18, 4:00 PM to 5:30 PM/,
    })
  },
}

export const KeyboardCreate: Story = {
  parameters: storyDocumentation(
    "The keyboard path to the same quick create: the day surface takes focus, arrow keys move a snapped selection from the 9:00 anchor, Shift+ArrowDown extends it, and Enter opens the host-supplied card. The play test builds a 9:30–10:30 selection entirely from the keyboard, saves 'Deep work', and proves the chip renders with a visible computed background.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultDate={storyNow}
        defaultView="day"
        now={storyNow}
        locale="en-US"
        renderQuickCreate={renderDemoQuickCreate}
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const surface = await canvas.findByRole("button", {
      name: /Schedule for Tuesday, August 18/,
    })
    surface.focus()
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
    await canvas.findByRole("button", {
      name: /selected 9:30 AM to 10:30 AM/,
    })
    await userEvent.keyboard("{Enter}")
    const dialog = await canvas.findByRole("dialog", { name: "New event" })
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Event title" }),
      "Deep work{Enter}",
    )
    const chip = await canvas.findByRole("button", { name: /^Deep work,/ })
    await expect(getComputedStyle(chip).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    )
    await expect(parseFloat(getComputedStyle(chip).top)).toBeCloseTo(
      9.5 * HOUR_HEIGHT,
      0,
    )
  },
}

/**
 * A host-side chip interior: a status dot and title, with the start time
 * kept for grid chips — proving the calendar imposes no built-in look.
 */
function renderStatusEvent(context: EventCalendarEventRenderContext) {
  const { event } = context
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
  return (
    <span className="flex w-full min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        data-testid="event-status-dot"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      <span className="truncate">{event.title}</span>
      {context.surface === "time-grid" ? (
        <span className="ms-auto shrink-0 font-normal">
          {time.format(event.start)}
        </span>
      ) : null}
    </span>
  )
}

export const CustomEventAppearance: Story = {
  parameters: storyDocumentation(
    "The tones are defaults, not a ceiling. The eventClassName prop computes host token classes per chip, merged over the tone so they win (here the focus block goes outlined: transparent wash, dashed border, foreground text) while events stay plain serializable data, and the calendar-level renderEvent prop replaces every chip's interior — this story renders a status dot, title, and right-aligned start time on all surfaces while the calendar keeps geometry, drag, resize, focus, and selection. The play test proves the custom class by computed border style and the custom interior by the rendered dots.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={[
          {
            id: "design-crit",
            title: "Design crit",
            start: at(18, 13),
            end: at(18, 14, 30),
          },
          {
            id: "focus-block",
            title: "Focus: event calendar",
            start: at(18, 9, 30),
            end: at(18, 12),
          },
          {
            id: "release-cut",
            title: "Release cut",
            start: at(18, 16),
            end: at(18, 16, 30),
            tone: "destructive",
          },
        ]}
        defaultDate={storyNow}
        defaultView="day"
        now={storyNow}
        locale="en-US"
        renderEvent={renderStatusEvent}
        eventClassName={({ event }) =>
          event.id === "focus-block"
            ? "border border-dashed border-foreground/40 bg-transparent text-foreground"
            : undefined
        }
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const focusBlock = await canvas.findByRole("button", {
      name: /^Focus: event calendar,/,
    })
    const focusStyle = getComputedStyle(focusBlock)
    await expect(focusStyle.borderStyle).toBe("dashed")
    await expect(focusStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    const crit = await canvas.findByRole("button", { name: /^Design crit,/ })
    await expect(within(crit).getByText("1:00 PM")).toBeVisible()
    const dots = canvasElement.querySelectorAll(
      '[data-testid="event-status-dot"]',
    )
    await expect(dots.length).toBe(3)
  },
}

export const WorkingHours: Story = {
  parameters: storyDocumentation(
    "A host-configured visible window: minHour/maxHour trim the day and week grids to the hours a user chose in external settings — here 7:00 to 19:00 — while the default stays the full 24-hour range. Selection, drag-move, the now line, and the gutter all clamp to the window. The play test proves the grid height is exactly twelve hour rows and that a chip positions relative to the window's start, not midnight.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={demoEvents}
        defaultDate={storyNow}
        now={storyNow}
        locale="en-US"
        minHour={7}
        maxHour={19}
        defaultView="day"
        renderQuickCreate={renderDemoQuickCreate}
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chip = await canvas.findByRole("button", { name: /^Design crit,/ })
    const column = chip.closest<HTMLElement>(
      '[data-slot="event-calendar-day-column"]',
    )
    await expect(parseFloat(getComputedStyle(column!).height)).toBeCloseTo(
      12 * HOUR_HEIGHT,
      0,
    )
    await expect(parseFloat(getComputedStyle(chip).top)).toBeCloseTo(
      (13 - 7) * HOUR_HEIGHT,
      0,
    )
    await expect(canvas.queryByText("5 AM")).toBeNull()
    await canvas.findByText("8 AM")
  },
}

export const LocalizedLabels: Story = {
  parameters: storyDocumentation(
    "Every rendered and announced string routes through the labels prop, merged over eventCalendarDefaultLabels — here a French pass covering the toolbar, view switcher, and the confirmation dialog, paired with locale='fr-FR' so Intl formats the dates to match. Interpolated strings are functions, keeping word order in the translator's control. The play test asserts the localized toolbar and switches views through the translated buttons.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={demoEvents}
        defaultDate={storyNow}
        now={storyNow}
        locale="fr-FR"
        labels={{
          today: "Aujourd’hui",
          day: "Jour",
          week: "Semaine",
          month: "Mois",
          previousDay: "Jour précédent",
          previousWeek: "Semaine précédente",
          previousMonth: "Mois précédent",
          nextDay: "Jour suivant",
          nextWeek: "Semaine suivante",
          nextMonth: "Mois suivant",
          allDay: "Journée",
          untitledEvent: "(Sans titre)",
          moveAction: "Déplacer",
          resizeAction: "Redimensionner",
          keepAction: "Garder",
          confirmMoveLabel: "Confirmer le déplacement",
          confirmResizeLabel: "Confirmer le redimensionnement",
          confirmMoveTitle: (title) => `Déplacer « ${title} » ?`,
          confirmResizeTitle: (title) => `Redimensionner « ${title} » ?`,
        }}
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("button", { name: "Aujourd’hui" })
    await canvas.findByRole("button", { name: "Semaine précédente" })
    await userEvent.click(canvas.getByRole("button", { name: "Mois" }))
    await canvas.findByText("août 2026")
    await userEvent.click(canvas.getByRole("button", { name: "Jour" }))
    const pressed = canvas.getByRole("button", { name: "Jour" })
    await expect(pressed).toHaveAttribute("aria-pressed", "true")
  },
}

export const ViewsAndNavigation: Story = {
  parameters: storyDocumentation(
    "The toolbar's full command set plus the default vim-flavored keymap: the Day/Week/Month switcher swaps layouts in place while the live range label re-announces the span, paging steps by the active view's unit, and Today returns to the fixed clock — all also reachable from the keyboard with h/l to page, t for today, and d/w/m to switch views (each shortcut host-replaceable or disableable through the shortcuts prop). The play test walks the toolbar first, then repeats the journey purely with keystrokes, asserting the label at every stop.",
  ),
  render: () => (
    <StoryFrame>
      <EventCalendar
        defaultEvents={demoEvents}
        defaultDate={storyNow}
        now={storyNow}
        locale="en-US"
      >
        <EventCalendarToolbar />
        <EventCalendarGrid />
      </EventCalendar>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText("Aug 17 – 23, 2026")
    await userEvent.click(canvas.getByRole("button", { name: "Month" }))
    await canvas.findByText("August 2026")
    await userEvent.click(canvas.getByRole("button", { name: "Day" }))
    await canvas.findByText("Tuesday, August 18, 2026")
    await userEvent.click(canvas.getByRole("button", { name: "Next day" }))
    await canvas.findByText("Wednesday, August 19, 2026")
    await userEvent.click(canvas.getByRole("button", { name: "Today" }))
    await canvas.findByText("Tuesday, August 18, 2026")
    await userEvent.click(canvas.getByRole("button", { name: "Week" }))
    await canvas.findByText("Aug 17 – 23, 2026")
    const pressed = canvas.getByRole("button", { name: "Week" })
    await expect(pressed).toHaveAttribute("aria-pressed", "true")

    // The same journey again, driven by the default vim keymap.
    await userEvent.keyboard("m")
    await canvas.findByText("August 2026")
    await userEvent.keyboard("d")
    await canvas.findByText("Tuesday, August 18, 2026")
    await userEvent.keyboard("l")
    await canvas.findByText("Wednesday, August 19, 2026")
    await userEvent.keyboard("t")
    await canvas.findByText("Tuesday, August 18, 2026")
    await userEvent.keyboard("h")
    await canvas.findByText("Monday, August 17, 2026")
    await userEvent.keyboard("w")
    await canvas.findByText("Aug 17 – 23, 2026")
  },
}
