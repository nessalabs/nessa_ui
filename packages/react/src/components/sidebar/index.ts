"use client"

/** @responsibility Defines the public component and type surface of the Sidebar system. */

export { Sidebar, type SidebarProps } from "./sidebar"
export {
  SidebarCollapsible,
  SidebarSide,
  SidebarVariant,
} from "./sidebar-options"
export {
  SidebarProvider,
  useSidebar,
  type SidebarKeyboardShortcut,
  type SidebarProviderProps,
  type SidebarShortcutModifier,
} from "./sidebar-provider"
export { SidebarContent } from "./sidebar-content"
export { SidebarFooter } from "./sidebar-footer"
export { SidebarHeader } from "./sidebar-header"
export { SidebarInset } from "./sidebar-inset"
export {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  type SidebarGroupActionProps,
} from "./sidebar-group"
export {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  sidebarMenuItemVariants,
  type SidebarMenuItemProps,
  type SidebarMenuProps,
  type SidebarMenuSkeletonProps,
} from "./sidebar-menu"
export { SidebarTrigger } from "./sidebar-trigger"
export { SidebarRail } from "./sidebar-rail"
