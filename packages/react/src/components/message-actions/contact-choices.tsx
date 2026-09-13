"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { ContactAvatar } from "./contact-avatar"

export interface ContactChoice {
  /** Identifies the contact across selection. */
  id: string
  /** The display name, the row's only required content. */
  name: string
  /**
   * What tells two same-named contacts apart — a number, an address, a
   * company. Shown muted under the name, and read as part of the row.
   */
  detail?: string
  /** Photo for the row's avatar; initials show while it is absent or fails. */
  avatarSrc?: string
  /** Overrides the initials derived from `name`. */
  initials?: string
  /** A glyph badged on the avatar — the app this contact is reachable on. */
  badge?: React.ReactNode
}

export interface ContactChoicesProps
  extends Omit<React.ComponentProps<"div">, "onSelect" | "title" | "children"> {
  /** The contacts to offer, in the order they should appear. */
  contacts: readonly ContactChoice[]
  /**
   * The question above the list — "Which Bruce should I address the message
   * to?". Pass `null` when the surrounding surface already asks.
   */
  title?: React.ReactNode
  /** The chosen contact's id, or `null` while the question is open. */
  value?: string | null
  /** Fires with the chosen contact's id. */
  onValueChange?: (id: string) => void
  /**
   * Accessible name for the list itself. Defaults to the title when it is a
   * plain string, and to "Contacts" otherwise.
   */
  label?: string
  /** Shown in place of the list when `contacts` is empty. */
  emptyMessage?: string
}

/**
 * The disambiguation step before a message goes out: an agent found more than
 * one person matching what was asked and offers them as rows to choose from.
 * Each row is a button carrying the contact's avatar, name, and whatever tells
 * it apart from its namesakes; the chosen one keeps a check and is marked
 * `aria-current`, so the answer stays legible after the list stops being a
 * question.
 *
 * The list sizes itself to its container rather than the viewport — rows stay
 * single-line and truncate in a narrow rail, and step up in avatar size and
 * type from about 24rem of width. Choosing is the host's: the picker holds no
 * selection of its own and filters nothing.
 */
function ContactChoices({
  contacts,
  title = "Who should I send it to?",
  value = null,
  onValueChange,
  label,
  emptyMessage = "No matching contacts",
  className,
  ...props
}: ContactChoicesProps) {
  const titleId = React.useId()
  // The question names the list. `label` overrides it; otherwise the title
  // element itself is the name, whatever it is made of — a title that is
  // markup rather than a plain string must not fall back to a generic word
  // that tells a screen-reader user nothing about what the rows answer.
  const titled = title != null && label === undefined
  return (
    <div
      data-slot="contact-choices"
      className={cn(
        "@container/contact-choices flex w-full min-w-0 flex-col gap-2 font-sans",
        className,
      )}
      {...props}
    >
      {title == null ? null : (
        <p
          id={titleId}
          data-slot="contact-choices-title"
          className="min-w-0 nessa-text-3 font-medium text-foreground @[24rem]/contact-choices:nessa-text-4"
        >
          {title}
        </p>
      )}
      {contacts.length === 0 ? (
        <p className="m-0 px-1 py-4 nessa-text-3 text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul
          role="list"
          aria-labelledby={titled ? titleId : undefined}
          aria-label={titled ? undefined : (label ?? "Contacts")}
          data-slot="contact-choices-list"
          className="m-0 flex list-none flex-col gap-2 p-0"
        >
          {contacts.map((contact) => {
            const selected = contact.id === value
            return (
              <li key={contact.id} className="min-w-0">
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  data-slot="contact-choices-item"
                  data-selected={selected || undefined}
                  onClick={() => onValueChange?.(contact.id)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-3 rounded-2xl border-0 bg-muted/60 px-3 py-2.5 text-start outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none @[24rem]/contact-choices:px-3.5 @[24rem]/contact-choices:py-3",
                    selected && "bg-accent text-accent-foreground",
                  )}
                >
                  <ContactAvatar
                    name={contact.name}
                    src={contact.avatarSrc}
                    initials={contact.initials}
                    badge={contact.badge}
                    className="size-9 @[24rem]/contact-choices:size-10"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      data-slot="contact-choices-name"
                      className="truncate nessa-text-3 font-medium text-foreground @[24rem]/contact-choices:nessa-text-4"
                    >
                      {contact.name}
                    </span>
                    {contact.detail ? (
                      <span
                        data-slot="contact-choices-detail"
                        className="truncate nessa-text-2 text-muted-foreground"
                      >
                        {contact.detail}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <Check
                      aria-hidden="true"
                      className="size-4 shrink-0 text-foreground"
                    />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export { ContactChoices }
