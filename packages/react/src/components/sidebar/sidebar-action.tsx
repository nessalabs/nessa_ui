"use client"

import { cva, type VariantProps } from "class-variance-authority"

/** @responsibility Defines the shared presentation of Sidebar icon action controls. */

/**
 * Creates the class names for a Sidebar icon action control.
 *
 * A group's action and a row's action are the same control in two
 * placements, so they share one recipe rather than two hand-rolled class
 * strings that drift on tone and icon scale. Placement stays with the
 * caller: the group's action is pinned to its header, the row's action sits
 * in the row's trailing region.
 *
 * @param options - Size and optional class-name selections.
 * @returns The composed class-name string for a Sidebar action control.
 */
const sidebarActionVariants = cva(
  "inline-flex shrink-0 appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-sidebar-foreground/60 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring disabled:pointer-events-none disabled:opacity-50 [&>svg]:shrink-0",
  {
    variants: {
      size: {
        /** Fits a menu row's trailing band beside a badge. */
        sm: "size-6 [&>svg]:size-3.5",
        /** Fits a group header, which sets its own larger rhythm. */
        md: "size-7 [&>svg]:size-4",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
)

type SidebarActionSize = NonNullable<
  VariantProps<typeof sidebarActionVariants>["size"]
>

export { sidebarActionVariants, type SidebarActionSize }
