"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import type { AgentFigureKind, Figure } from "./agent-figure-scenes"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

/** Returns the live, server-safe reduced-motion preference. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

/** The agents with a figure, in the order a picker would list them. */
const agentFigureKinds: readonly AgentFigureKind[] = Object.freeze(["claude", "codex", "local"])

/** How quickly a figure comes alive and settles back, per second. */
const EASE_RATE = 7

export interface AgentFigureProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Which agent's figure to draw. */
  agent: AgentFigureKind
  /**
   * Whether the figure plays its routine: the burst turns and breathes, the
   * knot twists, the glass fans apart. It eases in, keeps going while true,
   * and settles back to rest when false. Defaults to false.
   */
  lively?: boolean
}

/**
 * An agent's mark as a small 3D object under studio light, for a moment that
 * shows the agents themselves, such as choosing one during setup. It is
 * decoration: the agent's name belongs beside it, so it is hidden from
 * assistive technology.
 *
 * Three.js loads the first time a figure mounts, and every figure on the page
 * shares one WebGL context. `data-ready` is set once the first frame is drawn
 * and `data-resting` whenever it is still at rest, which is what a test waits
 * on. Under reduced motion it is drawn at rest and never moves. Without WebGL
 * it stays empty.
 */
function AgentFigure({ agent, lively = false, className, ...props }: AgentFigureProps) {
  const reducedMotion = useReducedMotion()
  const root = React.useRef<HTMLSpanElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const [figure, setFigure] = React.useState<Figure | null>(null)

  React.useEffect(() => {
    let live = true
    setFigure(null)
    root.current?.removeAttribute("data-ready")
    import("./agent-figure-scenes").then(
      ({ createFigure }) => {
        if (live) setFigure(createFigure(agent))
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [agent])

  // Progress toward lively, kept across renders so a change mid-way eases
  // from where the figure is rather than jumping.
  const progress = React.useRef({ p: 0, t: 0 })

  React.useEffect(() => {
    const host = root.current
    const target = canvas.current
    if (!figure || !host || !target) return
    const goal = lively && !reducedMotion ? 1 : 0
    const state = progress.current
    if (reducedMotion) state.p = 0
    const settle = () => {
      host.toggleAttribute("data-resting", state.p === 0)
    }
    figure.pose(state.p, state.t, 0)
    figure.draw(target)
    host.setAttribute("data-ready", "true")
    settle()
    if (goal === 0 && state.p === 0) return
    let frame = 0
    let last = performance.now()
    if (goal === 1 && state.p < 0.05) state.t = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      state.p += (goal - state.p) * (1 - Math.exp(-dt * EASE_RATE))
      state.t += dt
      if (goal === 0 && state.p < 0.003) state.p = 0
      figure.pose(state.p, state.t, dt)
      figure.draw(target)
      settle()
      if (goal === 0 && state.p === 0) return
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [figure, lively, reducedMotion])

  return (
    <span
      ref={root}
      aria-hidden="true"
      data-slot="agent-figure"
      data-agent={agent}
      className={cn("relative inline-block size-24", className)}
      {...props}
    >
      <canvas ref={canvas} width={320} height={320} className="block size-full" />
    </span>
  )
}

export { AgentFigure, agentFigureKinds }
export type { AgentFigureKind }
