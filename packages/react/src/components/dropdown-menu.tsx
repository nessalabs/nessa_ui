"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { Check, ChevronRight } from "lucide-react"

import {
  useNessaLayerScope,
  usePortalContainer,
} from "@/lib/portal-container"
import {
  menuCheckableItemClassName,
  menuItemCheckClassName,
  menuItemClassName,
  menuItemIndicatorClassName,
  menuLabelClassName,
  menuSeparatorClassName,
  menuShortcutClassName,
  menuSubTriggerChevronClassName,
  menuSurfacePaddingClassName,
} from "@/lib/menu-recipe"
import { cn } from "@/lib/utils"
import { popoverSurfaceVariants } from "./popover-surface"

/**
 * Every row's keyboard focus ring, drawn inset because the card clips its
 * overflow; the rest of the row comes from the shared menu recipe.
 */
const dropdownMenuItemFocusClassName =
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

/** The floating card both the root menu and its submenus are drawn on. */
const dropdownMenuSurfaceClassName = cn(
  popoverSurfaceVariants({ elevation: "md", radius: "xl" }),
  menuSurfacePaddingClassName,
  "z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
)

/** The dropdown menu root: owns open state and coordinates trigger and content. */
function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

/**
 * The element that opens the menu. Renders its child as the trigger via
 * `asChild`, so any Nessa button can anchor a menu.
 */
function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

export interface DropdownMenuContentProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Content> {
  /**
   * Where the floating content is portalled. Defaults to the container the
   * nearest enclosing panel owns — a Sheet's own layer host, say — and to the
   * body when there is none. Pass `null` to force the body regardless.
   */
  portalContainer?: HTMLElement | null
}

/**
 * The floating menu surface: the shared popover-surface card the items sit
 * on, portalled into `portalContainer` (or the body) with entry/exit fades.
 */
function DropdownMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 12,
  portalContainer,
  ...props
}: DropdownMenuContentProps) {
  const resolvedPortalContainer = usePortalContainer(portalContainer)
  const layerScope = useNessaLayerScope()
  return (
    <DropdownMenuPrimitive.Portal container={resolvedPortalContainer}>
      <DropdownMenuPrimitive.Content
        {...layerScope}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          dropdownMenuSurfaceClassName,
          "max-h-(--radix-dropdown-menu-content-available-height) overflow-x-hidden overflow-y-auto",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

/** Groups related items; pair with a `DropdownMenuLabel` heading. */
function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

/** A non-interactive heading for a group of items. */
function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn(menuLabelClassName, className)}
      {...props}
    />
  )
}

export interface DropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
  /** Indents an icon-less item to line up with siblings that lead with an icon. */
  inset?: boolean
  /** `destructive` renders the item in the destructive text tone. */
  variant?: "default" | "destructive"
}

/**
 * One actionable menu item. The accent wash marks only the pointer or
 * keyboard highlight; selection states belong to the checkbox and radio
 * items.
 */
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset || undefined}
      data-variant={variant}
      className={cn(
        menuItemClassName,
        dropdownMenuItemFocusClassName,
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:[&_svg]:text-destructive data-[variant=destructive]:data-[highlighted]:text-destructive",
        className,
      )}
      {...props}
    />
  )
}

/**
 * A toggleable menu item. Checked state is shown only by the trailing check
 * indicator — never by a persistent background wash — so the highlight wash
 * always means "this row is under the pointer or keyboard".
 */
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        menuItemClassName,
        dropdownMenuItemFocusClassName,
        menuCheckableItemClassName,
        className,
      )}
      checked={checked}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        data-slot="dropdown-menu-item-indicator"
        className={menuItemIndicatorClassName}
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className={menuItemCheckClassName} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

/** Coordinates a set of `DropdownMenuRadioItem`s around one selected value. */
function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

/**
 * One single-select option. Like the checkbox item, selection is shown only
 * by the trailing check, keeping the accent wash reserved for the highlight.
 */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        menuItemClassName,
        dropdownMenuItemFocusClassName,
        menuCheckableItemClassName,
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        data-slot="dropdown-menu-item-indicator"
        className={menuItemIndicatorClassName}
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className={menuItemCheckClassName} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.RadioItem>
  )
}

/** A hairline rule between groups of items. */
function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(menuSeparatorClassName, className)}
      {...props}
    />
  )
}

/** Right-aligned keyboard-shortcut hint inside an item. */
function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(menuShortcutClassName, className)}
      {...props}
    />
  )
}

/** The root of a nested submenu; holds its trigger and sub-content. */
function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

export interface DropdownMenuSubTriggerProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> {
  /** Indents an icon-less trigger to line up with siblings that lead with an icon. */
  inset?: boolean
}

/** The item that opens a submenu, with a trailing chevron. */
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset || undefined}
      className={cn(
        menuItemClassName,
        dropdownMenuItemFocusClassName,
        "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight
        aria-hidden="true"
        className={menuSubTriggerChevronClassName}
      />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

/** The floating surface of a submenu, styled like the root content. */
function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        dropdownMenuSurfaceClassName,
        "max-h-(--radix-dropdown-menu-content-available-height) overflow-x-hidden overflow-y-auto",
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
