"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { AgentFigure, type AgentFigureKind } from "./agent-figure/agent-figure"

/**
 * Each agent's own card colours: a lit gradient, the arc of a planet rising
 * from the bottom left, and the ink its name is written in. Brand colours
 * rather than theme tokens, because the card is the agent's, not the page's.
 */
const agentCardTones = Object.freeze({
  claude: Object.freeze({
    top: "#b4501f",
    bottom: "#2a0e04",
    glow: "#e0692a",
    planet: "#7a3312",
    lit: "#ff9a5a",
    rim: "rgb(255 210 180 / 0.16)",
    ink: "#fff1e8",
    halo: "rgb(255 140 80 / 0.22)",
    shade: "rgb(40 10 0 / 0.55)",
  }),
  codex: Object.freeze({
    top: "#f7f3ec",
    bottom: "#d8cfc1",
    glow: "#ffffff",
    planet: "#e9e2d7",
    lit: "#ffffff",
    rim: "rgb(60 45 25 / 0.1)",
    ink: "#1d1b18",
    halo: "rgb(255 255 255 / 0.55)",
    shade: "rgb(90 70 45 / 0.35)",
  }),
  local: Object.freeze({
    top: "#1e1e21",
    bottom: "#060607",
    glow: "#38383d",
    planet: "#26262a",
    lit: "#a2a2aa",
    rim: "rgb(255 255 255 / 0.1)",
    ink: "#f0f0f2",
    halo: "rgb(200 200 210 / 0.12)",
    shade: "rgb(0 0 0 / 0.6)",
  }),
})

type AgentCardTone = keyof typeof agentCardTones

/** Which card each figure stands on: Claude Code's mascot is Claude's. */
const toneOf: Readonly<Record<AgentFigureKind, AgentCardTone>> = Object.freeze({
  claude: "claude",
  clawd: "claude",
  codex: "codex",
  local: "local",
})

export interface AgentCardProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Whose figure stands on the card, which also picks its colours. */
  agent: AgentFigureKind
  /** Written in the card's top left corner. Omit for a card with no words. */
  name?: string
  /** Whether the figure plays its routine. See `AgentFigure`. */
  lively?: boolean
}

/**
 * An agent on its own card: the agent's colours, a planet's arc rising from
 * the lower left with an orbit line behind it, a soft halo, and the agent's
 * 3D figure standing in front. For a moment that shows one agent at a time,
 * such as the one chosen during setup.
 *
 * The figure is `AgentFigure`, so it reports `data-ready` and `data-resting`
 * the same way, and the card adds nothing that moves.
 */
function AgentCard({ agent, name, lively = false, className, style, ...props }: AgentCardProps) {
  const tone = agentCardTones[toneOf[agent]]
  return (
    <div
      data-slot="agent-card"
      data-agent={agent}
      className={cn(
        "relative isolate aspect-[4/5] overflow-hidden rounded-3xl text-[var(--nessa-agent-card-ink)]",
        "bg-[radial-gradient(120%_70%_at_18%_0%,color-mix(in_oklab,var(--nessa-agent-card-glow)_55%,transparent),transparent_60%),linear-gradient(170deg,var(--nessa-agent-card-top)_0%,var(--nessa-agent-card-bottom)_78%)]",
        "shadow-[inset_0_0_0_1px_var(--nessa-agent-card-rim),inset_0_1px_0_0_color-mix(in_oklab,var(--nessa-agent-card-lit)_45%,transparent),0_12px_28px_-18px_color-mix(in_oklab,var(--nessa-agent-card-glow)_40%,transparent)]",
        className,
      )}
      style={
        {
          "--nessa-agent-card-top": tone.top,
          "--nessa-agent-card-bottom": tone.bottom,
          "--nessa-agent-card-glow": tone.glow,
          "--nessa-agent-card-planet": tone.planet,
          "--nessa-agent-card-lit": tone.lit,
          "--nessa-agent-card-rim": tone.rim,
          "--nessa-agent-card-ink": tone.ink,
          "--nessa-agent-card-halo": tone.halo,
          "--nessa-agent-card-shade": tone.shade,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[72%] left-[-92%] aspect-square w-[170%] rounded-full bg-[radial-gradient(90%_60%_at_64%_0%,color-mix(in_oklab,var(--nessa-agent-card-lit)_55%,var(--nessa-agent-card-planet))_0%,var(--nessa-agent-card-planet)_16%,var(--nessa-agent-card-bottom)_46%)] shadow-[inset_0_1.5px_0_0_color-mix(in_oklab,var(--nessa-agent-card-lit)_85%,transparent),0_-8px_36px_-10px_color-mix(in_oklab,var(--nessa-agent-card-lit)_30%,transparent)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[52%] left-[26%] aspect-square w-[200%] rounded-full border border-[color-mix(in_oklab,var(--nessa-agent-card-lit)_22%,transparent)] bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--nessa-agent-card-glow)_18%,transparent),transparent_50%)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[18%_8%_10%] bg-[radial-gradient(closest-side,var(--nessa-agent-card-halo),transparent)] opacity-80"
      />
      {name ? (
        <span className="absolute top-5 right-6 left-6 z-10 nessa-text-5 font-medium tracking-tight">
          {name}
        </span>
      ) : null}
      <AgentFigure
        agent={agent}
        lively={lively}
        className="absolute top-[56%] left-1/2 z-10 size-auto w-[72%] aspect-square -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_14px_18px_var(--nessa-agent-card-shade)]"
      />
    </div>
  )
}

export { AgentCard, agentCardTones }
