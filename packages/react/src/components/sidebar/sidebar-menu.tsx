"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/** @responsibility Provides semantic navigation lists, complete rows, and loading states. */

/** Properties accepted by a semantic Sidebar navigation list. */
interface SidebarMenuProps extends React.ComponentProps<"ul"> {
  /**
   * Marks the list as nested navigation and applies nested-row behavior.
   * @defaultValue false
   */
  nested?: boolean
}

/**
 * Renders a semantic list of Sidebar navigation rows.
 *
 * @param props - Native list properties and whether the list represents nested navigation.
 * @returns A vertical, unstyled Sidebar navigation list.
 */
function SidebarMenu({ nested = false, className, ...props }: SidebarMenuProps) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-nested={nested || undefined}
      className={cn(
        "group/menu flex w-full min-w-0 list-none flex-col gap-0.5 p-0",
        nested && "group-data-[state=collapsed]/sidebar:hidden",
        className,
      )}
      {...props}
    />
  )
}

// Composite row

/**
 * Creates the class names for a supported Sidebar menu-item presentation.
 *
 * @param options - Variant, size, inset, and optional class-name selections.
 * @returns The composed class-name string for a Sidebar menu-item control.
 */
const sidebarMenuItemVariants = cva(
  "group/menu-button relative flex w-full min-w-0 appearance-none items-center gap-2.5 overflow-hidden rounded-lg border-0 bg-transparent text-left font-sans text-sm font-normal text-sidebar-foreground no-underline outline-none transition-[color,background-color,box-shadow,padding] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[has-trailing=true]/menu-item:pe-16 group-data-[nested=true]/menu:min-h-8 group-data-[nested=true]/menu:ps-10 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0",
  {
    variants: {
      variant: {
        default: "",
        outline: "border border-sidebar-border bg-sidebar shadow-xs",
      },
      size: {
        sm: "min-h-8 px-2 text-xs",
        default: "min-h-9 px-2.5",
        lg: "min-h-12 px-2.5",
      },
      inset: {
        true: "ps-9",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      inset: false,
    },
  },
)

/** Properties accepted by a complete Sidebar navigation row. */
interface SidebarMenuItemProps
  extends Omit<React.ComponentProps<"button">, "children">,
    VariantProps<typeof sidebarMenuItemVariants> {
  /**
   * Merges control behavior and styling into the single child element.
   * @defaultValue false
   */
  asChild?: boolean
  /** Compact status or count displayed in the trailing region. */
  badge?: React.ReactNode
  /** Primary row label, or the child element used when `asChild` is enabled. */
  children: React.ReactNode
  /** Alternate leading content displayed while the Sidebar is icon-collapsed. */
  collapsedIcon?: React.ReactNode
  /** Optional class name applied to the row's list-item container. */
  containerClassName?: string
  /** Supporting text displayed below the primary row label. */
  description?: React.ReactNode
  /** Decorative leading content displayed before the label. */
  icon?: React.ReactNode
  /**
   * Applies active visual styling without adding an ARIA state. Consumers must
   * supply the appropriate native or ARIA state for the row's interaction.
   * @defaultValue false
   */
  isActive?: boolean
  /**
   * Hides trailing content until hover or focus when a fine pointer is available.
   * @defaultValue false
   */
  showTrailingOnHover?: boolean
  /** Optional nested list rendered after the row control. */
  submenu?: React.ReactNode
  /**
   * Default accessible label and native title for the control. Explicit
   * `aria-label` or `title` properties take precedence.
   */
  tooltip?: string
  /** Optional controls or supplementary content displayed at the row's trailing edge. */
  trailing?: React.ReactNode
  /**
   * Visual treatment applied to the row control.
   * @defaultValue "default"
   */
  variant?: VariantProps<typeof sidebarMenuItemVariants>["variant"]
  /**
   * Minimum height and typography scale applied to the row control.
   * @defaultValue "default"
   */
  size?: VariantProps<typeof sidebarMenuItemVariants>["size"]
  /**
   * Whether the row reserves additional logical-start space before its content.
   * @defaultValue false
   */
  inset?: VariantProps<typeof sidebarMenuItemVariants>["inset"]
}

/**
 * Renders a complete Sidebar navigation row and any associated trailing or nested content.
 *
 * Rows are memoized: in long lists, pass referentially stable slot elements
 * and event handlers (hoisted or wrapped in useCallback) so unchanged rows
 * skip re-rendering.
 *
 * @param props - Row content, state, presentation variants, optional slots, and native button properties.
 * @returns A semantic list item containing its interactive control and optional supplementary content.
 */
const SidebarMenuItem = React.memo(function SidebarMenuItem({
  asChild = false,
  badge,
  children,
  collapsedIcon,
  containerClassName,
  description,
  icon,
  isActive = false,
  showTrailingOnHover = false,
  submenu,
  tooltip,
  trailing,
  variant,
  size,
  inset,
  className,
  ...props
}: SidebarMenuItemProps) {
  const Comp = asChild ? Slot.Root : "button"
  const label =
    asChild && React.isValidElement<{ children?: React.ReactNode }>(children)
      ? children.props.children
      : children
  const hasTrailing = Boolean(badge || trailing)
  const content = (
    <>
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex shrink-0 items-center [&>svg]:size-4",
            collapsedIcon && "group-data-[state=collapsed]/sidebar:hidden",
          )}
        >
          {icon}
        </span>
      ) : null}
      {collapsedIcon ? (
        <span
          aria-hidden="true"
          className="hidden shrink-0 group-data-[state=collapsed]/sidebar:inline-flex [&>svg]:size-4"
        >
          {collapsedIcon}
        </span>
      ) : null}
      <span
        data-slot="sidebar-menu-item-content"
        className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 overflow-hidden group-data-[state=collapsed]/sidebar:absolute group-data-[state=collapsed]/sidebar:size-px group-data-[state=collapsed]/sidebar:overflow-hidden group-data-[state=collapsed]/sidebar:whitespace-nowrap group-data-[state=collapsed]/sidebar:[clip-path:inset(50%)]"
      >
        <span data-slot="sidebar-menu-item-label" className="w-full truncate">
          {label}
        </span>
        {description ? (
          <span
            data-slot="sidebar-menu-item-description"
            className="w-full truncate text-xs font-normal leading-4 text-sidebar-foreground/60"
          >
            {description}
          </span>
        ) : null}
      </span>
    </>
  )

  const control = (
    <Comp
      type={asChild ? undefined : "button"}
      data-slot="sidebar-menu-item-control"
      data-active={isActive}
      data-size={size ?? "default"}
      aria-label={tooltip}
      title={tooltip}
      className={cn(sidebarMenuItemVariants({ variant, size, inset }), className)}
      {...props}
    >
      {asChild && React.isValidElement(children)
        ? React.cloneElement(children, undefined, content)
        : content}
    </Comp>
  )

  return (
    <li
      data-slot="sidebar-menu-item"
      data-has-trailing={hasTrailing || undefined}
      className={cn("group/menu-item relative min-w-0", containerClassName)}
    >
      {control}
      {hasTrailing ? (
        <div
          data-slot="sidebar-menu-item-trailing"
          data-show-on-hover={showTrailingOnHover || undefined}
          className={cn(
            "absolute end-1 top-1.5 z-10 flex items-center gap-0.5 group-has-data-[size=sm]/menu-item:top-1 group-has-data-[size=lg]/menu-item:top-3 group-data-[state=collapsed]/sidebar:hidden",
            showTrailingOnHover &&
              "[@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/menu-item:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/menu-item:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/menu-item:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:group-hover/menu-item:opacity-100",
          )}
        >
          {badge ? (
            <span
              data-slot="sidebar-menu-item-badge"
              className="pointer-events-none inline-flex min-w-6 items-center justify-center text-xs font-medium tabular-nums text-sidebar-foreground/60 group-has-data-[active=true]/menu-item:text-sidebar-accent-foreground"
            >
              {badge}
            </span>
          ) : null}
          {trailing}
        </div>
      ) : null}
      {submenu}
    </li>
  )
})

// Loading row

/**
 * Derives a stable pseudo-random skeleton width from a component identity.
 *
 * @param seed - A stable identifier shared between server and client renders.
 * @returns A percentage width between 50% and 90% inclusive.
 */
function skeletonWidthFromSeed(seed: string) {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 41
  }

  return `${50 + hash}%`
}

/** Properties accepted by a Sidebar menu loading row. */
interface SidebarMenuSkeletonProps extends React.ComponentProps<"li"> {
  /**
   * Whether to reserve and display a leading icon placeholder.
   * @defaultValue false
   */
  showIcon?: boolean
}

/**
 * Renders a non-interactive loading placeholder for a Sidebar menu row.
 *
 * @param props - Native list-item properties and optional icon-placeholder visibility.
 * @returns A semantic list item containing animated loading placeholders.
 */
function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: SidebarMenuSkeletonProps) {
  const skeletonId = React.useId()
  const skeletonWidth = skeletonWidthFromSeed(skeletonId)

  return (
    <li
      data-slot="sidebar-menu-skeleton"
      className={cn(
        "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0 group-data-[state=collapsed]/sidebar:not-has-[[data-sidebar=menu-skeleton-icon]]:hidden",
        className,
      )}
      {...props}
    >
      {showIcon ? (
        <span
          data-sidebar="menu-skeleton-icon"
          className="size-4 shrink-0 animate-pulse rounded-sm bg-sidebar-accent"
        />
      ) : null}
      <span
        data-sidebar="menu-skeleton-text"
        className="h-4 max-w-(--skeleton-width) flex-1 animate-pulse rounded-sm bg-sidebar-accent group-data-[state=collapsed]/sidebar:hidden"
        style={{ "--skeleton-width": skeletonWidth } as React.CSSProperties}
      />
    </li>
  )
}

export {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  sidebarMenuItemVariants,
  type SidebarMenuItemProps,
  type SidebarMenuProps,
  type SidebarMenuSkeletonProps,
}
