"use client"

import * as React from "react"
import { Dialog } from "radix-ui"

import { cn } from "@/lib/utils"

import { useIsMobile, useSidebar } from "./sidebar-provider"
import { SidebarInner } from "./sidebar-inner"
import {
  SidebarCollapsible,
  SidebarSide,
  SidebarVariant,
  type SidebarCollapsible as SidebarCollapsibleType,
  type SidebarSide as SidebarSideType,
  type SidebarVariant as SidebarVariantType,
} from "./sidebar-options"

/** @responsibility Presents the responsive navigation shell from shared Sidebar state. */

/** Properties accepted by the responsive Sidebar shell. */
interface SidebarProps extends React.ComponentProps<"div"> {
  /**
   * Physical edge on which the Sidebar is positioned.
   * @defaultValue SidebarSide.Left
   */
  side?: SidebarSideType
  /**
   * Visual relationship between the Sidebar and adjacent application content.
   * @defaultValue SidebarVariant.Sidebar
   */
  variant?: SidebarVariantType
  /**
   * Behavior used when the shared Sidebar state is collapsed.
   * @defaultValue SidebarCollapsible.Offcanvas
   */
  collapsible?: SidebarCollapsibleType
}

/**
 * Renders a responsive Sidebar shell connected to the nearest Sidebar provider.
 *
 * @param props - Shell placement, presentation, collapse behavior, content, and native div properties.
 * @returns A complementary landmark, or a modal panel while a collapsible mobile Sidebar is open.
 */
function Sidebar({
  side = SidebarSide.Left,
  variant = SidebarVariant.Sidebar,
  collapsible = SidebarCollapsible.Offcanvas,
  className,
  children,
  ...props
}: SidebarProps) {
  const {
    lastTriggerRef,
    open,
    pendingTriggerFocusRef,
    portalContainerRef,
    setOpen,
    state,
  } = useSidebar()
  const isMobile = useIsMobile()
  const mobileTriggerRef = React.useRef<HTMLElement | null>(null)
  const isCollapsed = collapsible !== SidebarCollapsible.None && !open
  const isLeft = side === SidebarSide.Left
  const isFloating = variant === SidebarVariant.Floating
  const isInset = variant === SidebarVariant.Inset
  const isIconCollapsible = collapsible === SidebarCollapsible.Icon
  const isOffcanvasCollapsible =
    collapsible === SidebarCollapsible.Offcanvas
  const previousOpenRef = React.useRef(open)

  /**
   * Restores focus to the trigger associated with a closing mobile Sidebar.
   *
   * The trigger a mobile Sidebar was opened from is often not the one it
   * closes back to: the compact composition swaps its brand trigger for a new
   * node, so the element focus came from is gone by the time the dialog
   * closes. Three answers, in the order they can be known — the original
   * element if it survived, a matching one already mounted, and otherwise a
   * claim left for the next matching trigger to take as it mounts.
   *
   * Deliberately no `requestAnimationFrame`. A frame is a guess about how
   * long a remount takes, and it is throttled to a crawl in a hidden or busy
   * document; every frame spent waiting is a frame with focus on `<body>`,
   * where the next Tab restarts from the top of the page.
   *
   * @returns Nothing; focus is moved, or owed to the trigger that mounts next.
   */
  const restoreMobileTrigger = React.useCallback(() => {
    const previousTrigger = lastTriggerRef.current ?? mobileTriggerRef.current
    lastTriggerRef.current = null
    pendingTriggerFocusRef.current = null

    if (previousTrigger?.isConnected) {
      previousTrigger.focus()
      return
    }

    const triggerLabel = previousTrigger?.getAttribute("aria-label") ?? ""
    const mountedTriggers =
      portalContainerRef.current?.querySelectorAll<HTMLElement>(
        '[data-slot="sidebar-trigger"]',
      )
    const matchingTrigger = Array.from(mountedTriggers ?? []).find(
      (trigger) =>
        !triggerLabel || trigger.getAttribute("aria-label") === triggerLabel,
    )

    if (matchingTrigger) {
      matchingTrigger.focus()
      return
    }

    pendingTriggerFocusRef.current = triggerLabel
  }, [lastTriggerRef, pendingTriggerFocusRef, portalContainerRef])

  React.useEffect(() => {
    const wasOpen = previousOpenRef.current
    previousOpenRef.current = open

    if (isMobile && isIconCollapsible && wasOpen && !open) {
      restoreMobileTrigger()
    }
  }, [isIconCollapsible, isMobile, open, restoreMobileTrigger])

  const panel = (
    <SidebarInner collapsible={collapsible} collapsed={isCollapsed} side={side}>
      {children}
    </SidebarInner>
  )

  if (
    isMobile &&
    collapsible !== SidebarCollapsible.None &&
    (isOffcanvasCollapsible || open)
  ) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen} modal>
        <Dialog.Portal container={portalContainerRef.current}>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs" />
          <Dialog.Content
            data-slot="sidebar"
            data-state={state}
            data-collapsible={isCollapsed ? collapsible : ""}
            data-variant={variant}
            data-side={side}
            aria-describedby={undefined}
            onOpenAutoFocus={() => {
              // Nothing is owed focus outside while the dialog holds it.
              pendingTriggerFocusRef.current = null
              mobileTriggerRef.current =
                lastTriggerRef.current ??
                (document.activeElement as HTMLElement | null)
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              restoreMobileTrigger()
            }}
            className={cn(
              "group/sidebar fixed inset-y-0 z-50 flex w-[min(var(--nessa-sidebar-width),calc(100vw-3rem))] flex-col overflow-hidden border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg outline-none",
              isLeft ? "left-0 border-r" : "right-0 border-l",
              (isFloating || isInset) &&
                "m-2 h-[calc(100svh-1rem)] rounded-xl border",
              className,
            )}
            {...props}
          >
            <Dialog.Title className="sr-only">
              {props["aria-label"] ?? "Application navigation"}
            </Dialog.Title>
            {panel}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <div
      role="complementary"
      data-slot="sidebar"
      data-state={collapsible === SidebarCollapsible.None ? "expanded" : state}
      data-collapsible={isCollapsed ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      className={cn(
        "group/sidebar peer relative flex h-svh shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width,transform,border-color,padding] duration-200 ease-linear max-md:fixed max-md:inset-y-0 max-md:z-40",
        isLeft
          ? "border-r border-sidebar-border"
          : "border-l border-sidebar-border",
        isLeft ? "max-md:left-0" : "max-md:right-0",
        isFloating &&
          "m-2 h-[calc(100svh-1rem)] rounded-xl border shadow-sm",
        isInset &&
          "md:border-transparent md:bg-transparent",
        !isCollapsed && "w-(--nessa-sidebar-width)",
        isCollapsed &&
          isIconCollapsible &&
          "w-(--nessa-sidebar-width-icon)",
        isCollapsed &&
          isOffcanvasCollapsible &&
          "w-0 border-transparent",
        className,
      )}
      {...props}
    >
      {panel}
    </div>
  )
}

export { Sidebar, type SidebarProps }
