"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Where a one-use code stands. `open` is the only state the host sets that
 * still counts down; `expired` is reached on its own when `expiresAt`
 * passes, and the host does not need to set it.
 */
export type PairingCodeState = "open" | "used" | "cancelled" | "expired"

export interface PairingCodeProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The one-use code the other device enters. */
  code: string
  /** When the code stops working, as a `Date` or epoch milliseconds. */
  expiresAt: Date | number
  /**
   * What the host knows about the code: `open` (the default) while it can
   * still be used, `used` once a device has entered it, `cancelled` once the
   * owner withdrew it. Expiry is worked out from `expiresAt`.
   */
  state?: Exclude<PairingCodeState, "expired">
  /**
   * Called once when an open code expires while shown. A code first shown
   * already past its expiry does not call it.
   */
  onExpire?: () => void
  /** Characters per group when the code is drawn. Defaults to 4. */
  groupSize?: number
  /**
   * The line under the code, for each state. Defaults to plain English;
   * pass this to translate or reword it. `remaining` is formatted `m:ss`.
   */
  describe?: (state: PairingCodeState, remaining: string) => React.ReactNode
  /** Actions under the code — copy, cancel, new code. */
  actions?: React.ReactNode
}

function millis(at: Date | number): number {
  return typeof at === "number" ? at : at.getTime()
}

/** `m:ss` for a span of milliseconds, rounded up so it reads 0:00 only at expiry. */
function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

const defaultDescribe = (state: PairingCodeState, remaining: string) =>
  state === "open"
    ? `Expires in ${remaining}`
    : state === "used"
      ? "This code has been used"
      : state === "cancelled"
        ? "This code was cancelled"
        : "This code has expired"

/**
 * A one-use pairing code, shown large for typing into another device, with
 * how long it has left. It counts down once a second while open and stops
 * at expiry, so it never leaves a timer running once there is nothing left
 * to count. A code that is no longer usable is struck through and dimmed,
 * so nobody copies a dead code.
 *
 * Only what happens while the code is shown is announced: it expiring, or
 * the host marking it used or cancelled, read once through a polite live
 * region. The ticking countdown is never announced, and neither is the
 * state a code is first shown in — that is read as ordinary text.
 */
function PairingCode({
  code,
  expiresAt,
  state = "open",
  onExpire,
  groupSize = 4,
  describe = defaultDescribe,
  actions,
  className,
  ...props
}: PairingCodeProps) {
  const deadline = millis(expiresAt)
  // No clock until mount: the server and the hydrating client would read
  // different times, so the first render shows the code without a countdown.
  const [now, setNow] = React.useState<number | null>(null)
  const expired = now !== null && now >= deadline
  const shown: PairingCodeState = state === "open" && expired ? "expired" : state
  // The state this code was in at its first clock reading. Only a change
  // from it is an event: a code first shown expired never "expired".
  const [seen, setSeen] = React.useState<{ code: string; state: PairingCodeState } | null>(null)
  const announced =
    seen !== null && seen.code === code && shown !== seen.state && shown !== "open"

  const onExpireRef = React.useRef(onExpire)
  React.useEffect(() => {
    onExpireRef.current = onExpire
  })

  React.useEffect(() => {
    // Decided from a real reading, not from the clockless first render.
    const at = Date.now()
    setNow(at)
    const first: PairingCodeState = state === "open" && at >= deadline ? "expired" : state
    setSeen((prev) => (prev !== null && prev.code === code ? prev : { code, state: first }))
    if (state !== "open" || at >= deadline) return
    // The interval only redraws the countdown; the timeout lands exactly on
    // the deadline, so expiry is never up to a tick late.
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    const end = window.setTimeout(() => {
      window.clearInterval(tick)
      setNow(Math.max(Date.now(), deadline))
      onExpireRef.current?.()
    }, deadline - at)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(end)
    }
  }, [code, state, deadline])

  const step = Math.max(1, Math.floor(groupSize))
  const groups: string[] = []
  for (let at = 0; at < code.length; at += step) groups.push(code.slice(at, at + step))

  return (
    <div
      data-slot="pairing-code"
      data-state={shown}
      className={cn("flex flex-col items-center gap-3 font-sans", className)}
      {...props}
    >
      <div
        role="group"
        data-slot="pairing-code-value"
        aria-label={`Pairing code ${code.split("").join(" ")}`}
        className={cn(
          "flex flex-wrap justify-center gap-x-3 font-mono nessa-text-7 font-semibold tracking-[0.12em] text-foreground tabular-nums",
          shown !== "open" && "text-muted-foreground line-through decoration-2",
        )}
      >
        {groups.map((group, index) => (
          <span key={index} aria-hidden="true" className="whitespace-nowrap">
            {group}
          </span>
        ))}
      </div>
      <p
        data-slot="pairing-code-status"
        // When the announcement below says it, this copy is hidden so it is
        // not read twice.
        aria-hidden={announced || undefined}
        className="m-0 nessa-text-2 text-muted-foreground tabular-nums"
      >
        {now === null && shown === "open"
          ? "\u00a0"
          : describe(shown, formatRemaining(deadline - (now ?? deadline)))}
      </p>
      {/* Only a change of state is announced, never the ticking countdown. */}
      <span data-slot="pairing-code-announcement" aria-live="polite" className="sr-only">
        {announced ? describe(shown, formatRemaining(0)) : ""}
      </span>
      {actions !== undefined ? (
        <div data-slot="pairing-code-actions" className="flex flex-wrap justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export { PairingCode, formatRemaining }
