"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

import { RandomAvatar, type RandomAvatarGround } from "./random-avatar"

/** One face in an `AvatarStack`. */
export interface AvatarStackItem {
  /** The identity the face is painted from; the same seed paints the same face. */
  seed: string
  /** The person or agent the face stands for: its accessible name and hover text. */
  name: string
  /**
   * Marks the face as working: its paint keeps moving (still under
   * `prefers-reduced-motion`) and a hairline ring settles around it, so the
   * state does not depend on motion alone. The face also carries `aria-busy`;
   * a name like "Ada, working" is how the state reaches a screen reader.
   */
  busy?: boolean
}

/**
 * Creates the class names for one face in the pile. Each face after the first
 * tucks under its predecessor by about a quarter of its width, and a ring in
 * the surface colour separates it from the one it overlaps. A working face
 * adds a hairline just outside that ring.
 */
const avatarStackFaceVariants = cva(
  "ring-2 ring-background data-[busy]:outline-1 data-[busy]:outline-offset-2 data-[busy]:outline-muted-foreground/60",
  {
    variants: {
      size: {
        sm: "size-5 not-first:-ms-1.5",
        md: "size-6 not-first:-ms-1.5",
        lg: "size-8 not-first:-ms-2",
      },
    },
    defaultVariants: { size: "md" },
  },
)

/** Creates the class names for the "+N" count beside the pile. */
const avatarStackMoreVariants = cva(
  "shrink-0 font-medium tabular-nums text-muted-foreground",
  {
    variants: {
      size: {
        sm: "nessa-text-1",
        md: "nessa-text-2",
        lg: "nessa-text-4",
      },
    },
    defaultVariants: { size: "md" },
  },
)

export interface AvatarStackProps
  extends Omit<React.ComponentProps<"div">, "children">,
    VariantProps<typeof avatarStackFaceVariants> {
  /** Everyone in the group, in the order the caller wants them shown. */
  items: readonly AvatarStackItem[]
  /** How many faces to show before the rest collapse into a count. Defaults to 3. */
  max?: number
  /**
   * Names the whole group for assistive technology, such as "6 agents". The
   * count and any wording are the caller's: the stack does not compose one.
   */
  label: string
  /**
   * Writes the count of faces not shown. Defaults to `+N`; pass a formatter
   * when the number needs the reader's locale or different wording.
   */
  formatMore?: (hidden: number) => string
  /**
   * The ground each face is painted on. Pass `"ink"` on a dark surface so the
   * faces glow rather than sit in bright discs. Defaults to `"paper"`.
   */
  ground?: RandomAvatarGround
}

/** Writes the hidden count as `+N`. */
const defaultFormatMore = (hidden: number) => `+${hidden}`

/**
 * A face pile: the first `max` members of a group as overlapping
 * `RandomAvatar`s, then a count of the rest. The group is named by `label`,
 * each face by its item's `name` (as its accessible name and as hover text),
 * and the order is exactly the order of `items` — sort before passing when
 * the busiest or most recent should lead.
 *
 * The stack is not interactive. Wrap it in a `Button` when it opens
 * something; the button then takes its name from the group.
 */
function AvatarStack({
  items,
  max = 3,
  label,
  size,
  formatMore = defaultFormatMore,
  ground,
  className,
  ...props
}: AvatarStackProps) {
  const limit = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 3
  const shown = items.slice(0, limit)
  const hidden = items.length - shown.length

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="avatar-stack"
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      {...props}
    >
      {shown.length > 0 ? (
        <span data-slot="avatar-stack-faces" className="flex items-center">
          {shown.map((item, index) => (
            <RandomAvatar
              // Seeds may repeat, and order is the caller's, so position is
              // part of the identity.
              key={`${index}:${item.seed}`}
              seed={item.seed}
              name={item.name}
              title={item.name}
              busy={item.busy}
              ground={ground}
              className={avatarStackFaceVariants({ size })}
            />
          ))}
        </span>
      ) : null}
      {hidden > 0 ? (
        <span
          data-slot="avatar-stack-more"
          className={avatarStackMoreVariants({ size })}
        >
          {formatMore(hidden)}
        </span>
      ) : null}
    </div>
  )
}

export { AvatarStack }
