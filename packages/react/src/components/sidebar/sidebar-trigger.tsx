"use client"

import * as React from "react"

import { useComposedRefs } from "@/lib/compose"
import { cn } from "@/lib/utils"

import { useSidebar } from "./sidebar-provider"

/** @responsibility Provides an explicit control for changing shared Sidebar visibility. */

/**
 * Renders an explicit control that toggles the nearest Sidebar provider.
 *
 * @param props - Native button properties, visible content, and an optional cancellable click handler.
 * @returns An accessible Sidebar toggle button containing the supplied children.
 */
function SidebarTrigger({
  className,
  onClick,
  children,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<"button">) {
  const { lastTriggerRef, open, pendingTriggerFocusRef, toggleSidebar } =
    useSidebar()
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  // Focus a closing mobile Sidebar was owed, taken as this trigger mounts.
  //
  // A mobile Sidebar that closes back to a *different* trigger than it opened
  // from has nothing to focus at the moment it closes; it leaves the claim
  // instead. Taken in a layout effect, so the trigger has focus in the same
  // commit it appears in and focus is never seen resting on `<body>` — which
  // is where the next Tab would otherwise restart from.
  React.useLayoutEffect(() => {
    const claimedLabel = pendingTriggerFocusRef.current
    const node = triggerRef.current
    if (claimedLabel === null || !node) return
    const label = node.getAttribute("aria-label") ?? ""
    if (claimedLabel !== "" && claimedLabel !== label) return
    pendingTriggerFocusRef.current = null
    node.focus()
  }, [pendingTriggerFocusRef])

  // The host's ref is composed rather than spread: `ref` is an ordinary prop
  // in React 19, so `{...props}` after `ref={triggerRef}` would replace the
  // component's own ref and the claim above would read null.
  const composedRef = useComposedRefs(triggerRef, forwardedRef)

  return (
    <button
      type="button"
      ref={composedRef}
      data-slot="sidebar-trigger"
      aria-label="Toggle sidebar"
      title="Toggle sidebar"
      className={cn(
        "inline-flex size-8 shrink-0 appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-sidebar-foreground/60 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring [&>svg]:size-4",
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          if (!open) lastTriggerRef.current = event.currentTarget
          toggleSidebar()
        }
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export { SidebarTrigger }
