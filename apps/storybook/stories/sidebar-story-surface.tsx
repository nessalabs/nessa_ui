import type * as React from "react"
import type { CSSProperties } from "react"
import type { Decorator } from "@storybook/react-vite"
import {
  Sidebar,
  SidebarCollapsible,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@nessa-ui/react"

export const sidebarStorySurfaceStyle = {
  "--background": "var(--sidebar)",
  "--card":
    "color-mix(in oklab, var(--sidebar), var(--sidebar-foreground) 4%)",
} as CSSProperties

export const sidebarStoryRailClassName =
  "bg-transparent opacity-100 after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-sidebar-border after:content-['']"

export const sidebarCatalogSidebarClassName = "h-full border-transparent"

export function getSidebarStoryRootClassName(viewMode: string) {
  return viewMode === "story" ? "min-h-svh bg-background" : "bg-background"
}

export const sidebarStoryDecorator: Decorator = (Story, context) => (
  <div
    data-sidebar-story-root
    className={getSidebarStoryRootClassName(context.viewMode)}
    style={sidebarStorySurfaceStyle}
  >
    <Story />
  </div>
)

export interface SidebarCatalogFrameProps {
  ariaLabel: string
  children: React.ReactNode
  collapsible?: SidebarCollapsible
  collapsedSidebarWidth?: string
  description: string
  groupLabel?: string
  keyboardShortcut?: React.ComponentProps<
    typeof SidebarProvider
  >["keyboardShortcut"]
  noteTitle: string
  sidebarWidth?: string
  wrapChildrenInMenu?: boolean
}

export function SidebarCatalogFrame({
  ariaLabel,
  children,
  collapsible = SidebarCollapsible.None,
  collapsedSidebarWidth,
  description,
  groupLabel,
  keyboardShortcut,
  noteTitle,
  sidebarWidth,
  wrapChildrenInMenu = false,
}: SidebarCatalogFrameProps) {
  const sidebarChildren = groupLabel ? (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
        <SidebarGroupContent>
          {wrapChildrenInMenu ? <SidebarMenu>{children}</SidebarMenu> : children}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  ) : (
    children
  )

  return (
    <SidebarProvider
      collapsedSidebarWidth={collapsedSidebarWidth}
      keyboardShortcut={keyboardShortcut}
      sidebarWidth={sidebarWidth}
      className="h-80 min-h-80"
    >
      <Sidebar
        data-sidebar-catalog
        collapsible={collapsible}
        className={sidebarCatalogSidebarClassName}
        aria-label={ariaLabel}
      >
        {sidebarChildren}
      </Sidebar>
      <SidebarInset className="p-6">
        <div
          data-sidebar-story-note
          className="max-w-xl rounded-xl border border-border bg-card p-4 text-card-foreground"
        >
          <p className="text-sm font-medium">{noteTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
