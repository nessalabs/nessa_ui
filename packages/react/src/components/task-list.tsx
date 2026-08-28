"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { Checkbox } from "./checkbox"

/**
 * The lifecycle of one task row. `todo` and `done` are the pair a person
 * toggles between on an interactive list; `active` and `failed` are
 * agent-owned states — a step the agent is running now, or one that ended
 * in an error — and always render as read-only indicators.
 */
export type TaskListItemStatus = "todo" | "active" | "done" | "failed"

/**
 * The status announcements read-only rows carry for assistive technology,
 * so hosts can localize or re-voice them. Merge partial overrides over
 * `taskListDefaultLabels` via the list's `labels` prop.
 */
export interface TaskListLabels {
  /** Announced on a read-only row that is not started. */
  todo: string
  /** Announced on the row an agent is working on now. */
  active: string
  /** Announced on a read-only completed row. */
  done: string
  /** Announced on a row that ended in an error. */
  failed: string
}

/** The out-of-the-box English status announcements. */
export const taskListDefaultLabels: TaskListLabels = Object.freeze({
  todo: "Not started",
  active: "In progress",
  done: "Done",
  failed: "Failed",
})

const TaskListLabelsContext =
  React.createContext<TaskListLabels>(taskListDefaultLabels)

export interface TaskListProps extends React.ComponentProps<"ul"> {
  /**
   * Overrides for the status announcements read-only rows carry, merged
   * over `taskListDefaultLabels` — the localization hook for every string
   * the list itself produces.
   */
  labels?: Partial<TaskListLabels>
}

/**
 * A list of tasks: agent plan steps streaming through their lifecycle, or a
 * person's checklist inside a card or brief. The root is a plain `ul` that
 * stacks `TaskListItem` rows; each row carries a `status`, and a row whose
 * host passes `onStatusChange` becomes a real checkbox the person toggles.
 * The list owns no task state — hosts render rows from their own data and
 * apply toggles themselves.
 */
function TaskList({ labels: labelsProp, className, ...props }: TaskListProps) {
  const labels = React.useMemo<TaskListLabels>(
    () => ({ ...taskListDefaultLabels, ...labelsProp }),
    [labelsProp],
  )
  return (
    <TaskListLabelsContext.Provider value={labels}>
      <ul
        data-slot="task-list"
        className={cn(
          "m-0 flex w-full min-w-0 list-none flex-col gap-2.5 p-0 font-sans text-foreground",
          className,
        )}
        {...props}
      />
    </TaskListLabelsContext.Provider>
  )
}

/**
 * The circular status glyphs, drawn to match the Checkbox's stroke style:
 * an outlined circle for `todo`, a spinning dashed circle for `active`, a
 * check in a primary-washed circle for `done`, and a destructive cross for
 * `failed`. Purely presentational — the row carries the accessible text.
 */
function TaskListItemIndicator({ status }: { status: TaskListItemStatus }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      data-slot="task-list-item-indicator"
      className={cn(
        "size-full",
        status === "failed" ? "text-destructive" : "text-primary",
        status === "active" &&
          "animate-spin [animation-duration:var(--nessa-motion-duration-ambient)] motion-reduce:animate-none",
      )}
    >
      <circle
        cx={9}
        cy={9}
        r={8.25}
        fill={status === "done" ? "currentColor" : "none"}
        fillOpacity={status === "done" ? 0.2 : undefined}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={status === "active" ? "3 3.4" : undefined}
        strokeLinecap="round"
        className={cn(status === "todo" && "text-muted-foreground")}
      />
      {status === "done" && (
        <path
          d="M5.75 9.25L8 11.75L12.25 6.25"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {status === "failed" && (
        <path
          d="M6.5 6.5L11.5 11.5M11.5 6.5L6.5 11.5"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  )
}

export interface TaskListItemProps
  extends Omit<React.ComponentProps<"li">, "onToggle"> {
  /**
   * The row's lifecycle state, exposed as `data-status` for host styling.
   * `active` rows are `aria-busy` and spin their indicator; `done` rows
   * strike and mute their content.
   *
   * @default "todo"
   */
  status?: TaskListItemStatus
  /**
   * Makes a `todo` or `done` row interactive: the indicator becomes a real
   * circular checkbox and the whole row its label, and each toggle reports
   * the next status here. The row renders only what `status` says, so the
   * host must apply the change. `active` and `failed` rows stay read-only —
   * they are agent-owned states a click cannot resolve.
   */
  onStatusChange?: (status: "todo" | "done") => void
  /** Disables an interactive row's checkbox without removing the row. */
  disabled?: boolean
  /**
   * Replaces the status indicator with the host's own glyph — a calendar
   * or video icon on an agenda row, say. The row still announces its
   * status; the glyph itself is decorative. Ignored on interactive rows,
   * which need their checkbox.
   */
  icon?: React.ReactNode
  /**
   * Muted detail after the label — a time such as "at 9:30 AM", an owner,
   * a duration.
   */
  meta?: React.ReactNode
}

/**
 * One task row: a status indicator, the task's label (`children`), and
 * optional trailing `meta` detail. Read-only by default — the shape agent
 * transcripts stream — it announces its status through visually hidden
 * text; passing `onStatusChange` turns a `todo`/`done` row into a labeled
 * circular checkbox that native keyboard and form semantics come with.
 */
function TaskListItem({
  status = "todo",
  onStatusChange,
  disabled,
  icon,
  meta,
  className,
  children,
  ...props
}: TaskListItemProps) {
  const labels = React.useContext(TaskListLabelsContext)
  const interactive =
    onStatusChange != null && (status === "todo" || status === "done")
  const done = status === "done"

  const label = (
    <span
      data-slot="task-list-item-label"
      className={cn(
        "min-w-0 text-sm leading-5 text-foreground transition-[color,text-decoration-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
        done && "text-muted-foreground line-through",
      )}
    >
      {children}
    </span>
  )
  const metaNode = meta != null && (
    <span
      data-slot="task-list-item-meta"
      className="min-w-0 shrink-0 text-sm leading-5 text-muted-foreground"
    >
      {meta}
    </span>
  )

  return (
    <li
      data-slot="task-list-item"
      data-status={status}
      aria-busy={status === "active" || undefined}
      className={cn("flex min-w-0", className)}
      {...props}
    >
      {interactive ? (
        <label
          className={cn(
            "flex min-w-0 cursor-pointer items-start gap-3 select-none",
            disabled && "cursor-not-allowed",
          )}
        >
          <Checkbox
            className="mt-px"
            inputClassName="rounded-full"
            checked={done}
            disabled={disabled}
            onChange={(event) =>
              onStatusChange(event.target.checked ? "done" : "todo")
            }
          />
          {label}
          {metaNode}
        </label>
      ) : (
        <span className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-px inline-flex size-[18px] shrink-0 items-center justify-center [&_svg]:size-full"
          >
            {icon ?? <TaskListItemIndicator status={status} />}
          </span>
          <span className="sr-only">{labels[status]}: </span>
          {label}
          {metaNode}
        </span>
      )}
    </li>
  )
}

export { TaskList, TaskListItem }
