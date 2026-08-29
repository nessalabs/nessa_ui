/** @responsibility Reads what an opencode session can do from its CLI's own listings, which are the only place that answers. */

import type { AgentCapabilities, CapabilityModel } from "../capabilities"

/**
 * opencode reports capabilities on a different channel from its stream, and in
 * a different format from either other provider.
 *
 * `run --format json` opens with no init line at all — no model, no working
 * directory, no tool list — so a composer built on that stream has nothing to
 * populate its pickers with. The answers come from `opencode models` and
 * `opencode agent list`, which print plain text rather than JSON.
 *
 * This module reads that text. It does **not** run the CLI: spawning processes
 * is a host's job, and this stays a pure function over whatever the host
 * captured — which is also what makes it testable against a recorded listing.
 */

/** The CLI listings this reads, so a host knows what to run. */
export const OPENCODE_CAPABILITY_COMMANDS = Object.freeze([
  "opencode models",
  "opencode agent list",
] as const)

export type OpencodeCapabilityCommand = (typeof OPENCODE_CAPABILITY_COMMANDS)[number]

/** What a host captured, keyed by the command that produced it. */
export interface OpencodeCapabilityListings {
  /** stdout of `opencode models`: one `provider/model` per line. */
  readonly models?: string
  /** stdout of `opencode agent list`: `name (primary|subagent)`, each followed by its permission rules. */
  readonly agents?: string
}

/**
 * `name (primary)` / `name (subagent)`, ignoring the JSON permission blocks
 * between them.
 *
 * The name accepts dots and colons because a plugin's agents are namespaced —
 * a stricter pattern silently dropped exactly the agents a picker most needs
 * to offer, with nothing to say they had been discarded.
 */
const AGENT_LINE = /^([A-Za-z0-9_.:-]+)\s+\((primary|subagent)\)\s*$/

/**
 * Reads the CLI's listings.
 *
 * A listing the host did not capture stays null rather than becoming an empty
 * list: "not asked for" and "none exist" are different answers, and only the
 * second one should make a picker say the session has nothing.
 */
export function opencodeCapabilities(listings: OpencodeCapabilityListings): AgentCapabilities {
  const models = listings.models === undefined ? null : readModels(listings.models)
  const agents = listings.agents === undefined ? null : readAgents(listings.agents)
  return {
    sessionId: null,
    // Never reported. `opencode models` lists what could be used, not what this
    // session is using — the stream names the model only inside a delegation's
    // metadata, and never for the main session.
    model: null,
    cwd: null,
    permissionMode: null,
    models,
    // opencode has no slash commands on this surface, no skills, and reports
    // neither tools nor MCP servers through any listing this reads. Null says
    // "this provider cannot tell us", which is what stops a picker drawing an
    // empty section as though the session had none.
    commands: null,
    skills: null,
    agents,
    tools: null,
    mcpServers: null,
    plugins: null,
    pluginSources: null,
    hooks: null,
  }
}

/** One `provider/model` per line; the provider prefix is kept, since a model id is only unique with it. */
function readModels(text: string): readonly CapabilityModel[] {
  const models: CapabilityModel[] = []
  for (const raw of text.split("\n")) {
    const id = raw.trim()
    if (id.length === 0 || !id.includes("/")) continue
    models.push({
      id,
      // The label drops the provider, which is what a picker shows; the id
      // keeps it, which is what a run needs.
      label: id.slice(id.indexOf("/") + 1),
      description: null,
      // The listing marks no default, and picking one here would invent it.
      isDefault: false,
    })
  }
  return models
}

/**
 * Agent names, primaries included.
 *
 * The listing mixes both kinds and only subagents can be delegated to, but the
 * distinction is not this contract's — `agents` is a list of names a session
 * knows, and dropping the primaries would hide `build` and `plan`, which are
 * exactly what a picker offers when switching the agent for a run.
 */
function readAgents(text: string): readonly string[] {
  const agents: string[] = []
  for (const raw of text.split("\n")) {
    const match = AGENT_LINE.exec(raw.trim())
    if (match === null) continue
    const name = match[1]
    if (name !== undefined && !agents.includes(name)) agents.push(name)
  }
  return agents
}
