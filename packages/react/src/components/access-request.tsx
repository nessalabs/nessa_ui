"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";

import { useComposedRefs } from "@/lib/compose";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Where an access request stands: `asking` offers Approve and Not now,
 * `approving` holds both while the host raises the access, and `approved`
 * drops the actions and lists what the person just allowed.
 */
export type AccessRequestState = "asking" | "approving" | "approved";

export interface AccessRequestProps extends Omit<
  React.ComponentProps<"section">,
  "title"
> {
  /** What is asked, in the host's words: "Allow full access in this chat?" */
  title: string;
  /** Why the agent asks, in its own words. */
  reason?: React.ReactNode;
  /**
   * What approving allows, one plain line each: "Agents can run any
   * command". Listed once the request is approved, so the person sees what
   * they just said yes to.
   */
  grants: readonly string[];
  /** Defaults to `asking`. */
  state?: AccessRequestState;
  /**
   * Why Approve can't be pressed right now, said under the actions: "You can
   * approve once the agent stops." Approve is disabled while it is set.
   */
  held?: string;
  /** Why the last Approve did not take, said under the actions. */
  failure?: string;
  /** Defaults to "Approve". */
  approveLabel?: string;
  /** Defaults to "Not now". */
  declineLabel?: string;
  /**
   * Said once approved, to assistive technology only, so an approval that
   * lands while focus is elsewhere is still heard. Defaults to "Approved."
   */
  approvedLabel?: string;
  /** The title's heading level, to fit the page around the card. Defaults to 3. */
  headingLevel?: 2 | 3 | 4;
  /** Raises the access. The host moves `state` to `approving`, then `approved`. */
  onApprove: () => void;
  /** Turns the request down. */
  onDecline: () => void;
}

/**
 * A request to raise what agents may do — full access, or changing settings
 * without asking — drawn in red so it never reads as an ordinary question.
 * The card says what is asked and why, offers a destructive Approve beside
 * Not now, and once approved lists, in plain lines, what the person allowed.
 * The host owns the access itself: it raises it on Approve, reports a
 * refusal through `failure`, and holds Approve with `held` while it can't.
 *
 * Focus stays with the person: Approve keeps it while the access is raised,
 * and once approved the card itself takes it, read with what was allowed,
 * but only when focus was in the card, so a card never pulls focus from
 * somewhere else. The note under the actions is one live region, always
 * there, so each change to it is said.
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
  approvedLabel = "Approved.",
  headingLevel = 3,
  onApprove,
  onDecline,
  className,
  ref: forwardedRef,
  ...props
}: AccessRequestProps) {
  const titleId = React.useId();
  const noteId = React.useId();
  const grantsId = React.useId();
  const Heading = `h${headingLevel}` as const;
  const approving = state === "approving";
  const approved = state === "approved";
  // Why the last Approve did not take, then why it can't be pressed now;
  // once approved, only that it was.
  const note = approved
    ? [{ tone: "approved" as const, text: approvedLabel }]
    : [
        ...(failure ? [{ tone: "failure" as const, text: failure }] : []),
        ...(held ? [{ tone: "held" as const, text: held }] : []),
      ];
  const card = React.useRef<HTMLElement>(null);
  const ref = useComposedRefs(card, forwardedRef);
  // Whether focus was in the card while it was asked: only then does the
  // approved card take it, after the actions it was on have gone. Focus
  // that left for somewhere else clears it; focus lost to nothing (the
  // pressed action unmounting, the window left) does not.
  const focusedInside = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!approved || !focusedInside.current) return;
    focusedInside.current = false;
    card.current?.focus();
  }, [approved]);
  return (
    <section
      {...props}
      ref={ref}
      data-slot="access-request"
      data-state={state}
      aria-labelledby={titleId}
      aria-describedby={approved ? grantsId : undefined}
      aria-busy={approving || undefined}
      tabIndex={approved ? -1 : undefined}
      onFocus={(event) => {
        focusedInside.current = true;
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next))
          focusedInside.current = false;
        props.onBlur?.(event);
      }}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-xl bg-destructive/8 p-3 font-sans text-foreground ring-1 ring-destructive/35 ring-inset outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <ShieldAlert
          aria-hidden="true"
          data-slot="access-request-icon"
          className="mt-px size-4 shrink-0 text-destructive"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading id={titleId} className="m-0 nessa-text-3 font-semibold">
            {title}
          </Heading>
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
      {approved ? (
        <ul
          id={grantsId}
          data-slot="access-request-grants"
          className="m-0 flex list-disc flex-col gap-1 ps-10.5 nessa-text-2 marker:text-destructive"
        >
          {grants.map((grant, index) => (
            <li key={index}>{grant}</li>
          ))}
        </ul>
      ) : null}
      {/* One element across every state, so the live region is never remounted. */}
      <div className={cn("flex flex-col", approved && "sr-only")}>
        {approved ? null : (
          <div
            data-slot="access-request-actions"
            className="flex flex-wrap gap-2 ps-6.5"
          >
            {/* aria-disabled, not disabled, so a pressed Approve keeps focus. */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              aria-disabled={approving || held !== undefined || undefined}
              aria-describedby={note.length ? noteId : undefined}
              onClick={approving || held !== undefined ? undefined : onApprove}
            >
              {approveLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-disabled={approving || undefined}
              onClick={approving ? undefined : onDecline}
            >
              {declineLabel}
            </Button>
          </div>
        )}
        <div
          role="status"
          id={noteId}
          data-slot="access-request-note"
          className="flex flex-col gap-0.5 ps-6.5 nessa-text-2 not-empty:mt-2.5"
        >
          {note.map((each) => (
            <p
              key={each.tone}
              data-tone={each.tone}
              className={cn(
                "m-0",
                each.tone === "failure"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {each.text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export { AccessRequest };
