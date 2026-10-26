"use client"

import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "radix-ui"
import { CheckIcon, ChevronRightIcon } from "lucide-react"

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
 * A right-click menu in Nessa's overlay chrome: the shadcn context-menu
 * layout (items, shortcuts, groups, submenus, checkbox and radio items)
 * rebuilt on Radix primitives over the shared popover surface recipe.
 */
function ContextMenu(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Root>,
) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>,
) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

function ContextMenuGroup(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Group>,
) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  )
}

function ContextMenuPortal(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Portal>,
) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  )
}

function ContextMenuSub(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Sub>,
) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
}

function ContextMenuRadioGroup(
  props: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>,
) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  )
}

/**
 * Every row's keyboard focus ring, drawn inset because the card clips its
 * overflow; the rest of the row comes from the shared menu recipe.
 */
const contextMenuItemFocusClassName =
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  // No prop of its own: a layer with no opinion belongs to whatever panel
  // it was opened from, and to the body when there is none.
  const portalContainer = usePortalContainer()
  const layerScope = useNessaLayerScope()
  return (
    <ContextMenuPrimitive.Portal container={portalContainer}>
      <ContextMenuPrimitive.Content
        {...layerScope}
        data-slot="context-menu-content"
        collisionPadding={12}
        className={cn(
          popoverSurfaceVariants({ elevation: "xl", radius: "xl" }),
          menuSurfacePaddingClassName,
          "z-50 max-h-[var(--radix-context-menu-content-available-height)] min-w-48 origin-[var(--radix-context-menu-content-transform-origin)] overflow-y-auto overflow-x-hidden outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  // No prop of its own: a layer with no opinion belongs to whatever panel
  // it was opened from, and to the body when there is none.
  const portalContainer = usePortalContainer()
  const layerScope = useNessaLayerScope()
  return (
    <ContextMenuPrimitive.Portal container={portalContainer}>
      <ContextMenuPrimitive.SubContent
        {...layerScope}
        data-slot="context-menu-sub-content"
        collisionPadding={12}
        sideOffset={4}
        className={cn(
          popoverSurfaceVariants({ elevation: "xl", radius: "xl" }),
          menuSurfacePaddingClassName,
          "z-50 min-w-40 origin-[var(--radix-context-menu-content-transform-origin)] overflow-hidden outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

export interface ContextMenuItemProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Item> {
  /** Indents an icon-less item to line up with siblings that lead with an icon. */
  inset?: boolean
  /** Destructive actions render in the destructive semantic color. */
  variant?: "default" | "destructive"
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset || undefined}
      data-variant={variant}
      className={cn(
        menuItemClassName,
        contextMenuItemFocusClassName,
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:text-destructive data-[variant=destructive]:[&_svg]:text-destructive",
        className,
      )}
      {...props}
    />
  )
}

export interface ContextMenuSubTriggerProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> {
  /** Indents an icon-less item to line up with siblings that lead with an icon. */
  inset?: boolean
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuSubTriggerProps) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset || undefined}
      className={cn(
        menuItemClassName,
        contextMenuItemFocusClassName,
        "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon
        aria-hidden="true"
        className={menuSubTriggerChevronClassName}
      />
    </ContextMenuPrimitive.SubTrigger>
  )
}

export interface ContextMenuCheckboxItemProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem> {
  /**
   * Checkbox items model multi-selection, so toggling one keeps the menu
   * open by default; pass true to dismiss on select like a plain item.
   */
  closeOnSelect?: boolean
}

function ContextMenuCheckboxItem({
  className,
  children,
  closeOnSelect = false,
  onSelect,
  ...props
}: ContextMenuCheckboxItemProps) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        menuItemClassName,
        contextMenuItemFocusClassName,
        menuCheckableItemClassName,
        className,
      )}
      onSelect={(event) => {
        if (!closeOnSelect) event.preventDefault()
        onSelect?.(event)
      }}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        data-slot="context-menu-item-indicator"
        className={menuItemIndicatorClassName}
      >
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className={menuItemCheckClassName} />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        menuItemClassName,
        contextMenuItemFocusClassName,
        menuCheckableItemClassName,
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        data-slot="context-menu-item-indicator"
        className={menuItemIndicatorClassName}
      >
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className={menuItemCheckClassName} />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
    </ContextMenuPrimitive.RadioItem>
  )
}

export interface ContextMenuLabelProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Label> {
  /** Indents the label to line up with items that lead with an icon. */
  inset?: boolean
}

function ContextMenuLabel({ className, inset, ...props }: ContextMenuLabelProps) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      data-inset={inset || undefined}
      className={cn(menuLabelClassName, className)}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn(menuSeparatorClassName, className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(menuShortcutClassName, className)}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
}
