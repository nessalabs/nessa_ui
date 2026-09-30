import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Creates the class names for an empty state's frame. `default` is sized to
 * stand in for a page or a panel's whole body; `compact` fits inside a card
 * or a pane beside other content.
 */
const emptyStateVariants = cva(
  "flex min-w-0 flex-col items-center justify-center text-center font-sans",
  {
    variants: {
      variant: {
        default: "gap-1.5 px-6 py-12",
        compact: "gap-1 px-4 py-6",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

/** Creates the class names for the title, one type level larger in the default frame. */
const emptyStateTitleVariants = cva("max-w-full font-medium text-foreground", {
  variants: {
    variant: {
      default: "nessa-text-5",
      compact: "nessa-text-4",
    },
  },
  defaultVariants: { variant: "default" },
})

/** Creates the class names for the description, held to a readable measure. */
const emptyStateDescriptionVariants = cva(
  "max-w-sm text-muted-foreground text-pretty",
  {
    variants: {
      variant: {
        default: "nessa-text-4",
        compact: "nessa-text-2",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export interface EmptyStateProps
  extends Omit<React.ComponentProps<"div">, "title" | "children">,
    VariantProps<typeof emptyStateVariants> {
  /** What is empty, in a few words: "No runs yet". */
  title: React.ReactNode
  /** Why it is empty or what would fill it, in a sentence. */
  description?: React.ReactNode
  /** The way forward, usually one `Button`. */
  action?: React.ReactNode
}

/**
 * What a surface shows when it has nothing to show: a short title, an
 * optional sentence of explanation, and an optional action, centred in the
 * space the content would take. Every word and the action are the caller's.
 *
 * It renders no heading element, because its level depends on where it sits;
 * the title is plain emphasised text. It is not a live region either — a
 * surface that empties while someone watches should announce that itself.
 */
function EmptyState({
  title,
  description,
  action,
  variant,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      data-variant={variant ?? "default"}
      className={cn(emptyStateVariants({ variant }), className)}
      {...props}
    >
      <div
        data-slot="empty-state-title"
        className={emptyStateTitleVariants({ variant })}
      >
        {title}
      </div>
      {description ? (
        <div
          data-slot="empty-state-description"
          className={emptyStateDescriptionVariants({ variant })}
        >
          {description}
        </div>
      ) : null}
      {action ? (
        <div
          data-slot="empty-state-action"
          className={variant === "compact" ? "mt-2" : "mt-4"}
        >
          {action}
        </div>
      ) : null}
    </div>
  )
}

export { EmptyState }
