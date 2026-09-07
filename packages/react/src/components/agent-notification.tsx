"use client"

import * as React from "react"
import { Check, LoaderCircle, RotateCw, WifiOff, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"
import { MorphingMeshGradient } from "./morphing-mesh-gradient"

export type AgentNotificationState = "connecting" | "disconnected" | "reconnecting" | "connected"

export interface AgentNotificationProps extends Omit<React.ComponentProps<"div">, "title" | "children"> {
  state: AgentNotificationState
  /** Adds a faint, slowly morphing glass wash: red offline, green connected, blue while connecting. Off by default; static under reduced motion. */
  shimmer?: boolean
  /** Replaces the state's default heading, including for localization. */
  title?: string
  /** Optional host-owned explanation; no delivery or queue guarantees are implied. */
  description?: string
  /** Called by Retry in the disconnected state. The host owns requests and retry policy. */
  onRetry?: () => void
  /** Accessible name and hover title for the retry icon. Defaults to Retry. */
  retryLabel?: string
  /** Shows a dismiss action. The host decides whether to hide the notice. */
  onDismiss?: () => void
  dismissLabel?: string
}

const titles: Record<AgentNotificationState, string> = {
  connecting: "Connecting…",
  disconnected: "Not connected",
  reconnecting: "Reconnecting…",
  connected: "Connected",
}

const shimmerTints: Record<AgentNotificationState, string> = {
  disconnected: "var(--destructive)",
  connected: "var(--nessa-notification-success)",
  connecting: "var(--nessa-chat-accent)",
  reconnecting: "var(--nessa-chat-accent)",
}

/**
 * A quiet glass connection surface for agent windows, placed above the pill
 * composer. Announces state changes politely; retry and dismissal are controlled
 * by the host. It never opens a connection, queues messages, or schedules retries.
 */
function AgentNotification({
  state,
  shimmer = false,
  title,
  description,
  onRetry,
  retryLabel = "Retry",
  onDismiss,
  dismissLabel = "Dismiss notification",
  className,
  ...props
}: AgentNotificationProps) {
  const tint = shimmerTints[state]
  const shimmerColors = [
    `color-mix(in oklab, ${tint} 35%, var(--card))`,
    tint,
    `color-mix(in oklab, ${tint} 70%, var(--card))`,
  ]
  const busy = state === "connecting" || state === "reconnecting"
  const Icon = busy ? LoaderCircle : state === "connected" ? Check : WifiOff

  return (
    <div
      {...props}
      data-slot="agent-notification"
      data-state={state}
      className={cn(
        "relative isolate flex min-w-0 max-w-full shrink-0 items-center gap-2 rounded-2xl border border-border bg-card/80 bg-gradient-to-br from-foreground/5 to-transparent px-3 py-2 font-sans text-card-foreground shadow-xs backdrop-blur-xl",
        "w-full",
        className,
      )}
    >
      {shimmer ? (
        <div data-slot="agent-notification-shimmer" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-clip rounded-[inherit] opacity-10">
          <MorphingMeshGradient colors={shimmerColors} type="aurora" speed={0.25} blur={20} grain={0.12} className="absolute inset-0" />
        </div>
      ) : null}
      <Icon
        aria-hidden="true"
        className={cn("relative size-4 shrink-0 text-muted-foreground", busy && "animate-spin [animation-duration:var(--nessa-motion-duration-ambient)] motion-reduce:animate-none")}
      />
      <div role="status" aria-live="polite" aria-atomic="true" className="relative min-w-0 flex-1 break-words">
        <div className="nessa-text-2 font-medium">{title ?? titles[state]}</div>
        {description ? <div className="mt-0.5 nessa-text-1 text-muted-foreground">{description}</div> : null}
      </div>
      {state === "disconnected" && onRetry ? (
        <Button type="button" variant="ghost" size="icon" className="relative rounded-full text-muted-foreground" aria-label={retryLabel} title={retryLabel} onClick={onRetry}>
          <RotateCw aria-hidden="true" />
        </Button>
      ) : null}
      {onDismiss ? (
        <Button type="button" variant="ghost" size="icon" className="relative rounded-full text-muted-foreground" aria-label={dismissLabel} onClick={onDismiss}>
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}

export { AgentNotification }
