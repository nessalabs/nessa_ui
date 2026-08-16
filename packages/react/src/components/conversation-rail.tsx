"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface ConversationRailItemContextValue {
  previewId: string
  hasPreview: boolean
  setHasPreview: (hasPreview: boolean) => void
  active: boolean
  suppressPreview: () => void
  releasePreview: () => void
}

const ConversationRailItemContext =
  React.createContext<ConversationRailItemContextValue | null>(null)

function useConversationRailItem(consumer: string) {
  const context = React.useContext(ConversationRailItemContext)
  if (!context) {
    throw new Error(`${consumer} must be used within a ConversationRailItem.`)
  }
  return context
}

export interface ConversationRailProps extends React.ComponentProps<"nav"> {
  proximity?: boolean
  proximityRadius?: number
  proximityFalloff?: (distance: number, radius: number) => number
}

function defaultProximityFalloff(distance: number, radius: number) {
  if (distance >= radius) return 0
  // Squaring the raised cosine keeps the peak tall while making the
  // neighbors fall away from it at a steeper rate.
  return ((1 + Math.cos((distance / radius) * Math.PI)) / 2) ** 2
}

function ConversationRail({
  proximity = true,
  proximityRadius = 32,
  proximityFalloff = defaultProximityFalloff,
  className,
  children,
  ...props
}: ConversationRailProps) {
  const listRef = React.useRef<HTMLOListElement>(null)

  const railItems = React.useCallback(
    () =>
      listRef.current?.querySelectorAll<HTMLElement>(
        '[data-slot="conversation-rail-item"]',
      ) ?? [],
    [],
  )

  const clearProximity = React.useCallback(() => {
    for (const item of railItems()) {
      item.style.removeProperty("--nessa-rail-boost")
    }
  }, [railItems])

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLOListElement>) => {
      if (!proximity || event.pointerType === "touch") return
      for (const item of railItems()) {
        const rect = item.getBoundingClientRect()
        const distance = Math.abs(event.clientY - (rect.top + rect.height / 2))
        const boost = Math.min(
          1,
          Math.max(0, proximityFalloff(distance, proximityRadius)),
        )
        if (boost > 0) {
          item.style.setProperty("--nessa-rail-boost", boost.toFixed(3))
        } else {
          item.style.removeProperty("--nessa-rail-boost")
        }
      }
    },
    [proximity, proximityFalloff, proximityRadius, railItems],
  )

  return (
    <nav
      data-slot="conversation-rail"
      aria-label="Conversation timeline"
      className={cn("font-sans", className)}
      {...props}
    >
      <ol
        ref={listRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={clearProximity}
        className="m-0 flex list-none flex-col items-start p-0"
      >
        {children}
      </ol>
    </nav>
  )
}

export interface ConversationRailItemProps extends React.ComponentProps<"li"> {
  active?: boolean
}

function ConversationRailItem({
  active = false,
  className,
  onPointerEnter,
  ...props
}: ConversationRailItemProps) {
  const previewId = React.useId()
  const [hasPreview, setHasPreview] = React.useState(false)
  const [previewSuppressed, setPreviewSuppressed] = React.useState(false)
  const context = React.useMemo(
    () => ({
      previewId,
      hasPreview,
      setHasPreview,
      active,
      suppressPreview: () => setPreviewSuppressed(true),
      releasePreview: () => setPreviewSuppressed(false),
    }),
    [previewId, hasPreview, active],
  )

  return (
    <ConversationRailItemContext.Provider value={context}>
      <li
        data-slot="conversation-rail-item"
        data-active={active ? "true" : "false"}
        data-preview-suppressed={previewSuppressed ? "true" : "false"}
        onPointerEnter={(event) => {
          // A fresh pointer approach re-arms the preview. Releasing on leave
          // instead would let the click-focused row pop back open with no
          // hover, since the trigger keeps focus after a click.
          setPreviewSuppressed(false)
          onPointerEnter?.(event)
        }}
        className={cn("group/rail-item relative flex items-center", className)}
        {...props}
      />
    </ConversationRailItemContext.Provider>
  )
}

export interface ConversationRailTriggerProps
  extends React.ComponentProps<"button"> {}

function ConversationRailTrigger({
  className,
  onClick,
  onBlur,
  ...props
}: ConversationRailTriggerProps) {
  const { previewId, hasPreview, active, suppressPreview, releasePreview } =
    useConversationRailItem("ConversationRailTrigger")

  return (
    <button
      type="button"
      data-slot="conversation-rail-trigger"
      data-active={active ? "true" : "false"}
      aria-current={active ? "true" : undefined}
      aria-describedby={hasPreview ? previewId : undefined}
      onClick={(event) => {
        suppressPreview()
        onClick?.(event)
      }}
      onBlur={(event) => {
        releasePreview()
        onBlur?.(event)
      }}
      className={cn(
        "flex h-3 w-9 items-center justify-start rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  )
}

export interface ConversationRailMarkerProps
  extends React.ComponentProps<"span"> {}

function ConversationRailMarker({
  className,
  ...props
}: ConversationRailMarkerProps) {
  return (
    <span
      aria-hidden="true"
      data-slot="conversation-rail-marker"
      className={cn(
        "block h-0.5 rounded-full bg-muted-foreground/50 transition-[width,background-color] duration-150 ease-out motion-reduce:transition-none",
        "[width:calc(var(--nessa-rail-marker-max,1.75rem)*(var(--nessa-rail-marker-base-ratio,0.25)_+_max(var(--nessa-rail-boost,0),var(--nessa-rail-boost-state,0))*(1_-_var(--nessa-rail-marker-base-ratio,0.25))))]",
        "group-hover/rail-item:[--nessa-rail-boost-state:1] group-hover/rail-item:bg-foreground group-[[data-preview-suppressed=false]:has(:focus-visible)]/rail-item:[--nessa-rail-boost-state:1] group-[[data-preview-suppressed=false]:has(:focus-visible)]/rail-item:bg-foreground group-data-[active=true]/rail-item:bg-foreground",
        className,
      )}
      {...props}
    />
  )
}

export interface ConversationRailPreviewProps
  extends React.ComponentProps<"div"> {}

function ConversationRailPreview({
  className,
  ...props
}: ConversationRailPreviewProps) {
  const { previewId, setHasPreview } =
    useConversationRailItem("ConversationRailPreview")

  React.useEffect(() => {
    setHasPreview(true)
    return () => setHasPreview(false)
  }, [setHasPreview])

  return (
    <div
      id={previewId}
      role="tooltip"
      data-slot="conversation-rail-preview"
      className={cn(
        "pointer-events-none absolute left-full top-1/2 z-50 ml-2 w-64 -translate-x-1 -translate-y-1/2 rounded-xl border border-border bg-popover p-3 text-left text-sm text-popover-foreground opacity-0 shadow-lg transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none",
        "group-[[data-preview-suppressed=false]:hover]/rail-item:translate-x-0 group-[[data-preview-suppressed=false]:hover]/rail-item:opacity-100 group-[[data-preview-suppressed=false]:has(:focus-visible)]/rail-item:translate-x-0 group-[[data-preview-suppressed=false]:has(:focus-visible)]/rail-item:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

export {
  ConversationRail,
  ConversationRailItem,
  ConversationRailMarker,
  ConversationRailPreview,
  ConversationRailTrigger,
}
