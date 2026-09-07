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
  /** Shows a dismiss action. Called after the slide/fade exit (immediately under reduced motion); the host decides whether to remove the notice. */
  onDismiss?: () => void
  /** Development tooling: publishes bounded lifecycle events at window.__nessaAgentNotification. */
  debug?: boolean
  dismissLabel?: string
}

const titles: Record<AgentNotificationState, string> = {
  connecting: "Connecting…",
  disconnected: "Not connected",
  reconnecting: "Reconnecting…",
  connected: "Connected",
}

const shimmerTints: Record<AgentNotificationState, string> = {
  disconnected: "var(--nessa-notification-error)",
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
  debug = false,
  ...props
}: AgentNotificationProps) {
  const id = React.useId()
  const animationRef = React.useRef<Animation | null>(null)
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const dismissRef = React.useRef(onDismiss)
  React.useLayoutEffect(() => { dismissRef.current = onDismiss }, [onDismiss])
  const traceRef = React.useRef<((ev: string) => void) | null>(null)
  React.useEffect(() => {
    if (!debug) return
    const events: { t: number; ev: string }[] = []
    const scope = window as typeof window & {
      __nessaAgentNotification?: Record<string, { events: typeof events; snapshot: () => { dismissing: boolean } }>
    }
    scope.__nessaAgentNotification ??= {}
    scope.__nessaAgentNotification[id] = { events, snapshot: () => ({ dismissing: animationRef.current !== null }) }
    traceRef.current = (ev) => {
      events.push({ t: performance.now(), ev })
      if (events.length > 4000) events.shift()
    }
    return () => {
      traceRef.current = null
      delete scope.__nessaAgentNotification?.[id]
    }
  }, [debug, id])
  React.useEffect(() => () => {
    cleanupRef.current?.()
    animationRef.current?.cancel()
    animationRef.current = null
  }, [])

  const dismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (animationRef.current) return
    const element = event.currentTarget.closest<HTMLElement>('[data-slot="agent-notification"]')!
    const view = element.ownerDocument.defaultView!
    const preference = view.matchMedia("(prefers-reduced-motion: reduce)")
    const styles = view.getComputedStyle(element)
    const value = styles.getPropertyValue("--nessa-motion-duration-normal").trim()
    const duration = Number.parseFloat(value) * (value.endsWith("ms") ? 1 : 1000)
    if (preference.matches || !Number.isFinite(duration) || duration <= 0 || !element.animate) {
      traceRef.current?.("dismiss-immediate")
      dismissRef.current?.()
      return
    }
    traceRef.current?.("dismiss-start")
    const animation = element.animate(
      [{ translate: "0 0", opacity: 1 }, { translate: "calc(var(--spacing) * 4) 0", opacity: 0 }],
      { duration, easing: styles.getPropertyValue("--nessa-motion-easing-standard").trim() || "ease-out", fill: "forwards" },
    )
    animationRef.current = animation
    let completed = false
    const cleanup = () => preference.removeEventListener("change", reduce)
    const finish = () => {
      if (completed || animationRef.current !== animation) return
      completed = true
      cleanup()
      cleanupRef.current = null
      traceRef.current?.("dismiss-finish")
      try { dismissRef.current?.() } finally {
        // A host may keep the notice mounted; restore it once it has handled dismissal.
        animation.cancel()
        animationRef.current = null
      }
    }
    const reduce = () => { if (preference.matches) finish() }
    preference.addEventListener("change", reduce)
    cleanupRef.current = cleanup
    void animation.finished.then(finish, () => {
      cleanup()
      traceRef.current?.("dismiss-cancel")
    })
  }
  const tint = shimmerTints[state]
  const shimmerColors = [
    `color-mix(in oklab, ${tint} 25%, transparent)`,
    tint,
    `color-mix(in oklab, ${tint} 65%, transparent)`,
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
        <div data-slot="agent-notification-shimmer" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-clip rounded-[inherit] opacity-20 [mask-image:linear-gradient(110deg,black,black_30%,transparent_90%)]">
          <MorphingMeshGradient colors={shimmerColors} type="aurora" speed={0.25} blur={20} grain={0.12} className="absolute inset-0 bg-transparent" />
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
        <Button type="button" variant="ghost" size="icon" className="relative rounded-full text-muted-foreground" aria-label={dismissLabel} onClick={dismiss}>
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}

export { AgentNotification }
