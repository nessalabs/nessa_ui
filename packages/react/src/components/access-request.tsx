"use client"

import * as React from "react"
import { ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

/**
 * Where an access request stands: `asking` offers Approve and Not now,
 * `approving` holds both while the host raises the access, and `approved`
 * drops the actions and lists what the person just allowed.
 */
export type AccessRequestState = "asking" | "approving" | "approved"

export interface AccessRequestProps
  extends Omit<React.ComponentProps<"section">, "title"> {
  /** What is asked, in the host's words: "Allow full access in this chat?" */
  title: string
  /** Why the agent asks, in its own words. */
  reason?: React.ReactNode
  /**
   * What approving allows, one plain line each: "Agents can run any
   * command". Listed once the request is approved, so the person sees what
   * they just said yes to.
   */
  grants: readonly string[]
  /** Defaults to `asking`. */
  state?: AccessRequestState
  /**
   * Why Approve can't be pressed right now, said under the actions: "You can
   * approve once the agent stops." Approve is disabled while it is set.
   */
  held?: string
  /** Why the last Approve did not take, said under the actions. */
  failure?: string
  /** Defaults to "Approve". */
  approveLabel?: string
  /** Defaults to "Not now". */
  declineLabel?: string
  /** Raises the access. The host moves `state` to `approving`, then `approved`. */
  onApprove: () => void
  /** Turns the request down. */
  onDecline: () => void
}

/**
 * A request to raise what agents may do — full access, or changing settings
 * without asking — drawn in red so it never reads as an ordinary question.
 * The card says what is asked and why, offers a destructive Approve beside
 * Not now, and once approved lists, in plain lines, what the person allowed.
 * The host owns the access itself: it raises it on Approve, reports a
 * refusal through `failure`, and holds Approve with `held` while it can't.
 */
function AccessRequest({
  title,
  reason,
  grants,
  state = "asking",
  held,
  failure,
  approveLabel = "Approve",
  declineLabel = "Not now",
  onApprove,
  onDecline,
  className,
  ...props
}: AccessRequestProps) {
  const titleId = React.useId()
  const approving = state === "approving"
  const note = failure ?? held
  return (
    <section
      data-slot="access-request"
      data-state={state}
      aria-labelledby={titleId}
      aria-busy={approving || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-xl bg-destructive/8 p-3 font-sans text-foreground ring-1 ring-destructive/35 ring-inset",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <ShieldAlert
          aria-hidden="true"
          data-slot="access-request-icon"
          className="mt-px size-4 shrink-0 text-destructive"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={titleId} className="m-0 nessa-text-3 font-semibold">
            {title}
          </h3>
          {reason ? (
            <p
              data-slot="access-request-reason"
              className="m-0 nessa-text-2 text-muted-foreground"
            >
              {reason}
            </p>
          ) : null}
        </div>
      </div>
      {state === "approved" ? (
        <ul
          data-slot="access-request-grants"
          className="m-0 flex list-disc flex-col gap-1 ps-10.5 nessa-text-2 marker:text-destructive"
        >
          {grants.map((grant) => (
            <li key={grant}>{grant}</li>
          ))}
        </ul>
      ) : (
        <>
          <div data-slot="access-request-actions" className="flex flex-wrap gap-2 ps-6.5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={approving || held !== undefined}
              onClick={onApprove}
            >
              {approveLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={approving}
              onClick={onDecline}
            >
              {declineLabel}
            </Button>
          </div>
          {note ? (
            <p
              role="status"
              data-slot="access-request-note"
              data-tone={failure ? "failure" : "held"}
              className={cn(
                "m-0 ps-6.5 nessa-text-2",
                failure ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {note}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

export { AccessRequest }
