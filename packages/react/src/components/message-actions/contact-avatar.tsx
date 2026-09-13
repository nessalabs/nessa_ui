"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Initials for a contact: the first letter of the first and last
 * whitespace-separated parts of the name, so "Bruce Wayne" reads "BW" the way
 * a contact card would abbreviate it. A single-word name keeps one letter, and
 * an empty name gets nothing rather than a stray glyph.
 */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  const first = [...parts[0]!][0] ?? ""
  const last = parts.length > 1 ? ([...parts[parts.length - 1]!][0] ?? "") : ""
  return (first + last).toUpperCase()
}

/**
 * Where a corner marker sits: centred on the circle's own edge at 45°, which
 * for a circle of radius r is r/√2 — 35.36% of the box — from its centre, so
 * the ring runs through the marker's middle. Hanging a marker off the square
 * bounding box instead leaves it floating diagonally clear of the edge,
 * because the box's corner is outside the circle by 0.29r.
 */
const markerPosition = "absolute left-[85.36%] -translate-x-1/2 -translate-y-1/2"

export interface ContactAvatarProps extends React.ComponentProps<"span"> {
  /** The contact's name; seeds the initials when no photo renders. */
  name: string
  /** Photo to draw; the initials take over while it is absent or fails. */
  src?: string
  /** Overrides the initials derived from `name`. */
  initials?: string
  /** Replaces the circle's contents entirely — a RandomAvatar, a brand mark. */
  children?: React.ReactNode
  /** A small glyph badged on the circle's trailing bottom corner. */
  badge?: React.ReactNode
  /**
   * Marks the contact as having something unread, with a dot in the circle's
   * trailing bottom corner — the same slot a channel mark sits in, which is
   * where the eye already looks. A circle carrying both keeps the mark there
   * and moves the dot to the top corner, so neither is lost. Decoration
   * only: the surface that sets it owes readers the same fact in text.
   */
  unread?: boolean
  /** Extra classes for the badge, for callers that scale it with the circle. */
  badgeClassName?: string
}

/**
 * The identity circle shared by every surface in this family: a photo, the
 * contact's initials, or whatever the caller puts in its place, with an
 * optional channel badge on one corner and an unread dot on the other.
 * Sizing belongs to the caller, through
 * `className` — the circle only owns its shape, its fallback, and the fact
 * that neither the initials nor the badge reach assistive technology, because
 * the name they abbreviate is always written out beside them.
 */
export function ContactAvatar({
  name,
  src,
  initials,
  children,
  badge,
  badgeClassName,
  unread = false,
  className,
  ...props
}: ContactAvatarProps) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const showsImage = children == null && src != null && src !== failedSrc
  return (
    <span
      data-slot="contact-avatar"
      className={cn("relative shrink-0", className)}
      {...props}
    >
      {/* The hairline and the full-strength initials are both load-bearing:
          these rows sit on a muted tile, where a muted circle on muted fill
          disappears and muted-on-muted initials sit at the 4.5:1 floor —
          legible by the letter of the gate, faint in the hand. */}
      <span className="flex size-full select-none items-center justify-center overflow-hidden rounded-full border border-border bg-muted nessa-text-2 font-medium text-foreground">
        {children ??
          (showsImage ? (
            <img
              src={src}
              alt=""
              className="size-full object-cover"
              onError={() => setFailedSrc(src ?? null)}
            />
          ) : (
            <span aria-hidden="true">{initials ?? initialsFrom(name)}</span>
          ))}
      </span>
      {unread ? (
        // Centred on the ring itself, not hung off the bounding box: the
        // hairline in the surrounding surface's own colour then reads as a
        // gap punched in the circle's edge, and keeps the dot legible
        // against a photo as well as against the muted fallback.
        <span
          aria-hidden="true"
          data-slot="contact-avatar-unread"
          data-corner={badge == null ? "bottom" : "top"}
          className={cn(
            markerPosition,
            "size-2.5 rounded-full border border-card bg-(--nessa-chat-accent)",
            // The mark, when there is one, owns the bottom corner it was
            // designed for; the dot steps up rather than stacking on it.
            badge == null ? "top-[85.36%]" : "top-[14.64%]",
          )}
        />
      ) : null}
      {badge == null ? null : (
        <span
          aria-hidden="true"
          data-slot="contact-avatar-badge"
          className={cn(
            markerPosition,
            "top-[85.36%] flex size-4 items-center justify-center overflow-hidden rounded-full border border-card bg-muted text-muted-foreground [&_svg]:size-2.5",
            badgeClassName,
          )}
        >
          {badge}
        </span>
      )}
    </span>
  )
}
