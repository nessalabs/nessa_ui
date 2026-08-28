import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { Video } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TaskList,
  TaskListItem,
  type TaskListItemStatus,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/TaskList",
  component: TaskList,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A list of tasks for agent plan steps and personal checklists. The root is a plain ul stacking TaskListItem rows; each row carries a status — todo, active, done, or failed — drawn as a circular indicator matched to the Checkbox's stroke style, with the label as children and muted trailing detail through meta. Rows are read-only by default, announcing their status through visually hidden text, which is the shape agent transcripts stream; passing onStatusChange turns a todo/done row into a real circular checkbox with native keyboard and form semantics, and an icon prop swaps the indicator for a host glyph on agenda-style rows. The list owns no task state: hosts render rows from their own data and apply toggles themselves.",
      },
    },
  },
} satisfies Meta<typeof TaskList>

export default meta
type Story = StoryObj<typeof meta>

export const AgentPlan: Story = {
  parameters: storyDocumentation(
    "An agent's plan streaming through its lifecycle: finished steps strike and mute, the running step spins a dashed indicator and is aria-busy, a failed step crosses out in the destructive tone, and pending steps wait as outlined circles. Every row is read-only — these states belong to the agent, not the reader — and each announces its status through visually hidden text, which the play test asserts alongside the data-status and aria-busy contract.",
  ),
  render: () => (
    <div className="w-[min(24rem,calc(100vw-2rem))]">
      <TaskList aria-label="Agent plan">
        <TaskListItem status="done">Read the failing test output</TaskListItem>
        <TaskListItem status="done" meta="2 files">
          Locate the selector regression
        </TaskListItem>
        <TaskListItem status="active">Apply the fix and re-run tests</TaskListItem>
        <TaskListItem status="failed" meta="exit 1">
          Update the visual snapshots
        </TaskListItem>
        <TaskListItem>Push the branch</TaskListItem>
      </TaskList>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const items = canvas.getAllByRole("listitem")
    await expect(items).toHaveLength(5)
    await expect(items[2]).toHaveAttribute("data-status", "active")
    await expect(items[2]).toHaveAttribute("aria-busy", "true")
    await expect(items[2]).toHaveTextContent("In progress")
    await expect(items[3]).toHaveAttribute("data-status", "failed")
    await expect(items[3]).toHaveTextContent("Failed")
    await expect(items[4]).toHaveAttribute("data-status", "todo")
    await expect(items[4]).toHaveTextContent("Not started")
    // Read-only rows expose no checkbox — the states are agent-owned.
    await expect(canvas.queryByRole("checkbox")).toBeNull()
  },
}

/** Story-local host state: an interactive checklist the stories toggle. */
function ChecklistHost() {
  const [statuses, setStatuses] = React.useState<
    Record<string, TaskListItemStatus>
  >({
    update: "todo",
    notes: "todo",
    groceries: "done",
    dentist: "todo",
  })
  const tasks = [
    { id: "update", label: "Send the weekly update" },
    { id: "notes", label: "Review project notes" },
    { id: "groceries", label: "Pick up groceries" },
    { id: "dentist", label: "Book a dentist appointment" },
  ]
  return (
    <TaskList aria-label="Today's tasks">
      {tasks.map((task) => (
        <TaskListItem
          key={task.id}
          status={statuses[task.id]}
          onStatusChange={(next) =>
            setStatuses((current) => ({ ...current, [task.id]: next }))
          }
        >
          {task.label}
        </TaskListItem>
      ))}
      <TaskListItem status="todo" disabled onStatusChange={() => {}}>
        Water the plants
      </TaskListItem>
    </TaskList>
  )
}

export const InteractiveChecklist: Story = {
  parameters: storyDocumentation(
    "A person's checklist: onStatusChange turns each todo/done row into a real circular checkbox whose label is the whole row, so clicking the text toggles it too. The rows render only what status says — the host applies each reported change to its own state — and a disabled row fades and stops responding. The play test toggles a row through the checkbox role and asserts the checked state and strike-through follow.",
  ),
  render: () => (
    <div className="w-[min(24rem,calc(100vw-2rem))]">
      <ChecklistHost />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const update = canvas.getByRole("checkbox", {
      name: "Send the weekly update",
    })
    const groceries = canvas.getByRole("checkbox", {
      name: "Pick up groceries",
    })
    await expect(update).not.toBeChecked()
    await expect(groceries).toBeChecked()
    await expect(groceries.closest("li")).toHaveAttribute(
      "data-status",
      "done",
    )

    await userEvent.click(update)
    await expect(update).toBeChecked()
    await expect(update.closest("li")).toHaveAttribute("data-status", "done")

    // Unchecking reports "todo" back and the strike-through clears.
    await userEvent.click(groceries)
    await expect(groceries).not.toBeChecked()
    await expect(groceries.closest("li")).toHaveAttribute(
      "data-status",
      "todo",
    )

    await expect(
      canvas.getByRole("checkbox", { name: "Water the plants" }),
    ).toBeDisabled()
  },
}

export const DailyBriefCard: Story = {
  parameters: storyDocumentation(
    "The card composition the component was drawn for: a daily brief stacking an agenda and a checklist inside one Card. The agenda rows are read-only with host icons — a video glyph for calls, the spinning active indicator for the block in progress — and times as meta detail; the tasks below are interactive circular checkboxes. The headings are plain host copy: the list deliberately ships no summary chrome.",
  ),
  render: () => (
    <Card className="w-[min(24rem,calc(100vw-2rem))] gap-5">
      <CardHeader>
        <CardTitle>
          Saturday{" "}
          <span className="font-normal text-muted-foreground">
            August 15, 2026
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <p className="text-sm text-muted-foreground">
          You have <span className="font-semibold text-foreground">3 events</span>{" "}
          remaining today
        </p>
        <TaskList aria-label="Today's events">
          <TaskListItem
            icon={<Video className="text-muted-foreground" />}
            meta="at 9:30 AM"
          >
            Team stand-up
          </TaskListItem>
          <TaskListItem
            icon={<Video className="text-muted-foreground" />}
            meta="at 1:00 PM"
          >
            Project review
          </TaskListItem>
          <TaskListItem status="active" meta="at 3:30 PM">
            Focus time
          </TaskListItem>
        </TaskList>
      </CardContent>
      <CardContent className="flex flex-col gap-2.5">
        <p className="text-sm text-muted-foreground">
          You have <span className="font-semibold text-foreground">5 tasks</span>{" "}
          today
        </p>
        <TaskList aria-label="Today's tasks">
          <TaskListItem onStatusChange={() => {}}>
            Send the weekly update
          </TaskListItem>
          <TaskListItem onStatusChange={() => {}}>
            Review project notes
          </TaskListItem>
          <TaskListItem onStatusChange={() => {}}>
            Pick up groceries
          </TaskListItem>
          <TaskListItem onStatusChange={() => {}}>
            Book a dentist appointment
          </TaskListItem>
          <TaskListItem onStatusChange={() => {}}>Water the plants</TaskListItem>
        </TaskList>
      </CardContent>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Agenda rows carry host icons instead of checkboxes; task rows are the
    // interactive ones, so exactly the five tasks expose the checkbox role.
    await expect(canvas.getAllByRole("checkbox")).toHaveLength(5)
    const events = canvas.getByRole("list", { name: "Today's events" })
    await expect(within(events).queryByRole("checkbox")).toBeNull()
    await expect(
      within(events).getByText("at 9:30 AM"),
    ).toBeInTheDocument()
  },
}

export const Localized: Story = {
  parameters: storyDocumentation(
    "The labels prop re-voices the visually hidden status announcements — here in German — for read-only rows. Only the strings the list itself produces go through labels; row content is always host copy.",
  ),
  render: () => (
    <div className="w-[min(24rem,calc(100vw-2rem))]">
      <TaskList
        aria-label="Agentenplan"
        labels={{
          todo: "Offen",
          active: "In Arbeit",
          done: "Erledigt",
          failed: "Fehlgeschlagen",
        }}
      >
        <TaskListItem status="done">Testausgabe lesen</TaskListItem>
        <TaskListItem status="active">Korrektur anwenden</TaskListItem>
        <TaskListItem>Branch veröffentlichen</TaskListItem>
      </TaskList>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const items = canvas.getAllByRole("listitem")
    await expect(items[0]).toHaveTextContent("Erledigt")
    await expect(items[1]).toHaveTextContent("In Arbeit")
    await expect(items[2]).toHaveTextContent("Offen")
  },
}
