/** @responsibility Derives what a session can do — commands, skills, agents, tools and MCP servers — for a composer's pickers. */

import type { AgentEvent, SessionInfo, ToolKind } from "../events"
import { toolKind } from "./tools"

/** Where a slash command comes from, which is what a picker groups by. */
export type CommandSource = "skill" | "plugin" | "session" | "terminal"

export interface CommandEntry {
  /** As typed, without the leading slash. */
  readonly name: string
  readonly source: CommandSource
  /** The plugin that supplies it, for a `plugin:command` name. */
  readonly plugin: string | null
}

export interface ToolEntry {
  readonly name: string
  readonly kind: ToolKind
  /** The MCP server that supplies it, parsed from the `mcp__server__tool` name. */
  readonly server: string | null
  /**
   * True when the tool was absent from the session's first `init` and appeared
   * in a later one — which is what a deferred tool loading through ToolSearch
   * looks like from outside.
   */
  readonly deferred: boolean
}

export interface McpServerEntry {
  readonly name: string
  readonly status: string
  /** `connected` is the only status that means the tools are usable now. */
  readonly connected: boolean
  /** The tools this server contributed, matched back from their prefixed names. */
  readonly tools: readonly string[]
}

/** Everything a session advertised about itself, merged across every `init` it emitted. */
export interface SessionCapabilities {
  readonly sessionId: string
  readonly model: string
  readonly cwd: string
  readonly permissionMode: string
  readonly version: string
  readonly outputStyle: string
  readonly commands: readonly CommandEntry[]
  readonly skills: readonly string[]
  readonly agents: readonly string[]
  readonly tools: readonly ToolEntry[]
  readonly mcpServers: readonly McpServerEntry[]
  readonly plugins: readonly { readonly name: string; readonly version: string | null; readonly source: string }[]
}

/**
 * The prefix an MCP tool carries, normalized for comparison against a server's
 * display name.
 *
 * The two disagree on purpose: a server named "example Mail" contributes
 * `mcp__example_Mail__get_message`, so matching them means flattening both
 * sides to the same alphabet rather than comparing strings.
 */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

/** Splits `mcp__server__tool` into its server, or null for a first-party tool. */
export function mcpServerOf(toolName: string): string | null {
  if (!toolName.startsWith("mcp__")) return null
  const rest = toolName.slice("mcp__".length)
  const separator = rest.indexOf("__")
  return separator === -1 ? rest : rest.slice(0, separator)
}

function classifyCommand(name: string, skills: ReadonlySet<string>): CommandEntry {
  const [head, tail] = name.split(":")
  if (tail !== undefined) return { name, source: "plugin", plugin: head! }
  if (skills.has(name)) return { name, source: "skill", plugin: null }
  return { name, source: "session", plugin: null }
}

/**
 * Folds every `init` in a log into one description of the session.
 *
 * Merged rather than replaced, because the tool list **grows between inits**:
 * deferred tools load on demand, so the last `init` is not a superset of the
 * first in any guaranteed way and treating either one as the answer loses
 * entries. What the first init did *not* carry is reported as `deferred`, which
 * is the only signal the stream gives that a tool arrived late.
 */
export function sessionCapabilities(events: readonly AgentEvent[]): SessionCapabilities | null {
  const inits: SessionInfo[] = []
  for (const event of events) {
    if (event.payload.type === "session_started") inits.push(event.payload.session)
  }
  if (inits.length === 0) return null

  const first = inits[0]!
  const latest = inits[inits.length - 1]!
  const firstTools = new Set(first.tools)

  const toolNames = new Set<string>()
  for (const init of inits) for (const name of init.tools) toolNames.add(name)

  const tools: ToolEntry[] = [...toolNames].map((name) => ({
    name,
    kind: toolKind(name),
    server: mcpServerOf(name),
    deferred: !firstTools.has(name),
  }))

  const servers = new Map<string, McpServerEntry>()
  for (const init of inits) {
    for (const server of init.mcpServers) {
      const matched = tools.filter((tool) => tool.server !== null && slug(tool.server) === slug(server.name))
      servers.set(server.name, {
        name: server.name,
        status: server.status,
        connected: server.status === "connected",
        tools: matched.map((tool) => tool.name),
      })
    }
  }

  const skills = new Set<string>()
  for (const init of inits) for (const skill of init.skills) skills.add(skill)

  const commands = new Map<string, CommandEntry>()
  for (const init of inits) {
    for (const name of init.slashCommands) commands.set(name, classifyCommand(name, skills))
    for (const name of init.terminalSlashCommands) commands.set(name, { name, source: "terminal", plugin: null })
  }

  const agents = new Set<string>()
  for (const init of inits) for (const agent of init.agents) agents.add(agent)

  return {
    sessionId: latest.sessionId,
    model: latest.model,
    cwd: latest.cwd,
    permissionMode: latest.permissionMode,
    version: latest.version,
    outputStyle: latest.outputStyle,
    commands: [...commands.values()],
    skills: [...skills],
    agents: [...agents],
    tools,
    mcpServers: [...servers.values()],
    plugins: latest.plugins,
  }
}

/** Groups tools for a picker: first-party tools by kind, MCP tools by their server. */
export function groupTools(capabilities: SessionCapabilities): ReadonlyMap<string, readonly ToolEntry[]> {
  const groups = new Map<string, ToolEntry[]>()
  for (const tool of capabilities.tools) {
    const key = tool.server === null ? tool.kind : `mcp:${tool.server}`
    const bucket = groups.get(key)
    if (bucket === undefined) groups.set(key, [tool])
    else bucket.push(tool)
  }
  return groups
}
