/** @responsibility Describes each provider's transports and what one can report, so a surface reads capability rather than hardcoding it. */

import type { WireProvenance } from "./events"
// Each wire already records the build it was read from. Naming those constants
// here rather than restating their values is what keeps a recapture from
// updating one copy and leaving this table asserting the old one.
import { CLAUDE_AGENT_SDK_PROVENANCE } from "./claude/agent-sdk/index"
import { CLAUDE_MESSAGES_PROVENANCE } from "./claude/messages/wire"
import { CLAUDE_STREAM_PROVENANCE } from "./claude/stream/wire"
import { CODEX_APP_SERVER_PROVENANCE } from "./codex/app-server/wire"
import { CODEX_EXEC_PROVENANCE } from "./codex/exec/wire"
import { CURSOR_STREAM_PROVENANCE } from "./cursor/stream/wire"
import { KIRO_CHAT_PROVENANCE } from "./kiro/chat/wire"
import { OPENCODE_RUN_PROVENANCE } from "./opencode/run/wire"
import { OPENCODE_SERVER_PROVENANCE } from "./opencode/server/wire"
import { OPENAI_AGENTS_PROVENANCE } from "./openai/agents/wire"

/**
 * What a transport can report.
 *
 * Three states, not two. `false` is a fact — the wire was read and it does not
 * carry this. `null` means nobody has captured that transport for this yet,
 * which is a different thing and must not be drawn as a no: a surface that
 * greys out "streams tokens" on an unrecorded transport is stating something
 * nobody established.
 */
export type Supported = boolean | null

export interface TransportSupport {
  /** Token-level previews a consumer can render before the committed event lands. */
  readonly streaming: Supported
  /** A session advertisement worth building composer pickers from. */
  readonly capabilities: Supported
  /** Asks for permission before running what its rules cover, and takes an answer. */
  readonly approvals: Supported
  /**
   * Accepts a message mid-turn, to steer or queue.
   *
   * Every interactive transport has a method for it and no capture exercises
   * one, so this is `null` across the board rather than a row of `true`s taken
   * from documentation.
   */
  readonly steering: Supported
  /** Names the model in force for the session. */
  readonly namesModel: Supported
  /** Reports structured file edits rather than opaque file tool calls. */
  readonly fileEdits: Supported
  /**
   * The connection is a bus: it carries every session on the server, not only
   * the one being watched, so a reader has to filter by session id.
   *
   * Not "can this agent have several sessions" — every one of them can. It is
   * about whether *this* stream mixes them, which changes how a consumer reads
   * it. A one-process-per-session transport is `false` and none the worse for
   * it.
   */
  readonly sharedBus: Supported
  /** Lets a client open, list, resume or fork a session rather than only starting one. */
  readonly sessionControl: Supported
  /** Reports the context window's size, not just how much of it was used. */
  readonly contextWindow: Supported
}

/**
 * One way of reaching an agent.
 *
 * A provider is not one wire. opencode's one-way stream and its server bus are
 * separate protocols with separate versions and different capabilities, and
 * Claude's stdin-open mode can do things its one-way mode cannot. Modelling the
 * transport rather than the provider is what lets a surface say *this session
 * cannot be steered* instead of *this agent cannot be steered*.
 */
export interface TransportDescriptor {
  readonly id: string
  readonly label: string
  /** How a host opens it. */
  readonly command: string
  /** Whether it holds a session open, which is what makes an answer possible. */
  readonly interactive: boolean
  readonly supports: TransportSupport
  /** The build this transport's shapes were read from. */
  readonly provenance: WireProvenance
  /** One line on what makes it different from its provider's other transports. */
  readonly note: string
}

export interface ProviderDescriptor {
  readonly id: string
  readonly label: string
  readonly transports: readonly TransportDescriptor[]
}

/**
 * Claude Code and Codex reach ACP through Zed's adapters rather than a
 * subcommand of their own, so the build that matters is the adapter's.
 */
const CLAUDE_ACP: WireProvenance = Object.freeze({
  cli: "@zed-industries/claude-code-acp",
  version: "0.16.2",
  command: "npx @zed-industries/claude-code-acp",
  capturedOn: "2026-08-29",
})

const CODEX_ACP: WireProvenance = Object.freeze({
  cli: "@agentclientprotocol/codex-acp",
  version: "1.7.0",
  command: "npx @agentclientprotocol/codex-acp",
  capturedOn: "2026-08-29",
})

/** Cursor speaks ACP natively; the build is the same CLI as its stream-json transport. */
const CURSOR_ACP: WireProvenance = Object.freeze({
  cli: CURSOR_STREAM_PROVENANCE.cli,
  version: CURSOR_STREAM_PROVENANCE.version,
  command: "agent acp",
  capturedOn: "2026-09-02",
})

/** Kiro speaks ACP natively; the build is the same CLI as its stream-json transport. */
// TODO(kiro-live): Capture a real `kiro-cli acp` session and replace the null
// capability claims below (approvals, fileEdits, contextWindow) with observed
// values; bump version/capturedOn from that run.
const KIRO_ACP: WireProvenance = Object.freeze({
  cli: KIRO_CHAT_PROVENANCE.cli,
  version: KIRO_CHAT_PROVENANCE.version,
  command: "kiro-cli acp",
  capturedOn: "2026-09-04",
})

/**
 * Every transport this library has read, and what each was observed to carry.
 *
 * Data rather than code so a surface can render the differences instead of
 * knowing them: adding a fourth provider adds a row here, and every picker,
 * badge and empty state that reads this follows without being edited.
 */
export const AGENT_TRANSPORTS: readonly ProviderDescriptor[] = Object.freeze([
  Object.freeze({
    id: "openai",
    label: "OpenAI Agents SDK",
    transports: Object.freeze([
      Object.freeze({
        id: "agents-sdk",
        label: "Agents SDK stream",
        command: OPENAI_AGENTS_PROVENANCE.command,
        interactive: true,
        provenance: OPENAI_AGENTS_PROVENANCE,
        supports: Object.freeze({
          streaming: true,
          capabilities: false,
          approvals: true,
          steering: false,
          namesModel: false,
          fileEdits: false,
          sharedBus: false,
          sessionControl: true,
          contextWindow: false,
        }),
        note: "High-level run events include deltas, executed tools, handoffs, approval interruptions, reasoning, and compaction. The host supplies its run id and calls finish() after stream.completed.",
      }),
    ]),
  }),
  Object.freeze({
    id: "claude",
    label: "Claude Code",
    transports: Object.freeze([
      Object.freeze({
        id: "stream",
        label: "stream-json",
        command: "claude -p --output-format stream-json",
        interactive: false,
        provenance: CLAUDE_STREAM_PROVENANCE,
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          approvals: false,
          steering: false,
          namesModel: true,
          fileEdits: false,
          sharedBus: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "One-way. The opening line advertises the whole session, so pickers can be built from the stream alone.",
      }),
      Object.freeze({
        id: "pipe",
        label: "stream-json, both ways",
        command: "claude -p --input-format stream-json --output-format stream-json",
        interactive: true,
        provenance: CLAUDE_STREAM_PROVENANCE,
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          // Captured both ways: `approval_allow` and `approval_deny` are this
          // transport answering a control request on stdin.
          approvals: true,
          steering: null,
          namesModel: true,
          fileEdits: false,
          sharedBus: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "The same stream with stdin open: prompts and steering go in, and control requests answer approvals.",
      }),
      Object.freeze({
        id: "agent-sdk",
        label: "Agent SDK",
        command: "query({ prompt, options: { includePartialMessages: true } })",
        interactive: true,
        provenance: CLAUDE_AGENT_SDK_PROVENANCE,
        supports: Object.freeze({
          // Opt-in, not automatic: without `includePartialMessages` the SDK
          // yields committed messages only. `true` records what the captured
          // configuration carries, which is what every other row here records.
          streaming: true,
          capabilities: true,
          /**
           * False as a *fact*, not as "unrecorded".
           *
           * The approval capture proves it: `canUseTool` fired twice and denied
           * once, and no permission line reached the stream — the question is
           * answered in-process. The denial is still recoverable, from the
           * `is_error` tool result and from `permission_denials` on the final
           * `result` line, but nothing on the stream asks, so nothing can be
           * answered there.
           */
          approvals: false,
          steering: null,
          namesModel: true,
          fileEdits: false,
          sharedBus: false,
          sessionControl: true,
          contextWindow: false,
        }),
        note: "Claude Code's own wire, in-process as objects. Approvals are a callback, so they never reach the stream.",
      }),
      Object.freeze({
        id: "messages",
        label: "Messages API",
        command: "client.messages.stream({ ... })",
        interactive: false,
        provenance: CLAUDE_MESSAGES_PROVENANCE,
        supports: Object.freeze({
          streaming: true,
          /**
           * Nothing is advertised, and nothing can be.
           *
           * This wire is one model response. There is no init line, no session,
           * no tool list — the tools were in the *request*, which is not the
           * parser's to read. A composer picker cannot be built from this
           * stream, and that is a property of the transport rather than a gap
           * in the capture.
           */
          capabilities: false,
          approvals: false,
          steering: false,
          namesModel: true,
          fileEdits: false,
          sharedBus: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "Raw SSE frames, and only the model's half: tool results come from the host, never from the stream.",
      }),
      Object.freeze({
        id: "acp",
        label: "acp",
        command: "npx @zed-industries/claude-code-acp",
        interactive: true,
        provenance: CLAUDE_ACP,
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          approvals: true,
          steering: null,
          namesModel: true,
          fileEdits: true,
          sharedBus: false,
          sessionControl: true,
          // This adapter sent no usage frame at all, so the window's size is
          // unrecorded here even though the other two ACP agents report it.
          contextWindow: null,
        }),
        note: "Claude Code through Zed's ACP adapter. It asks for permission over the protocol without the stdio flag its own stream needs, and `session/new` advertises the models it can switch to. Refuses to start inside another Claude Code session unless CLAUDECODE is unset.",
      }),
    ]),
  }),
  Object.freeze({
    id: "codex",
    label: "Codex",
    transports: Object.freeze([
      Object.freeze({
        id: "exec",
        label: "exec --json",
        command: "codex exec --json",
        interactive: false,
        provenance: CODEX_EXEC_PROVENANCE,
        supports: Object.freeze({
          streaming: false,
          capabilities: false,
          approvals: false,
          steering: false,
          namesModel: false,
          fileEdits: true,
          sharedBus: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "One-way. The opening line carries a thread id and nothing else, so nothing here can populate a picker.",
      }),
      Object.freeze({
        id: "app-server",
        label: "app-server",
        command: "codex app-server",
        interactive: true,
        provenance: CODEX_APP_SERVER_PROVENANCE,
        supports: Object.freeze({
          // Recorded now: a driven session sent fifteen agentMessage deltas for
          // one short answer, which `exec --json` never sends at all.
          streaming: true,
          capabilities: true,
          // The capture set an approval *policy* and never reached an approval
          // exchange, ran no command and changed no file — a short session, so
          // these answers are unrecorded rather than known.
          approvals: null,
          steering: null,
          namesModel: true,
          fileEdits: null,
          // A thread is opened explicitly and its notifications name it, but a
          // single connection was only ever driven for one.
          sharedBus: null,
          sessionControl: true,
          contextWindow: null,
        }),
        note: "Interactive JSON-RPC. Answers model, skill, plugin and hook lists on request, streams the answer as agentMessage deltas, and asks before running untrusted commands.",
      }),
      Object.freeze({
        id: "acp",
        label: "acp",
        command: "npx @agentclientprotocol/codex-acp",
        interactive: true,
        provenance: CODEX_ACP,
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          // The protocol carries approvals and this agent never asked for one
          // in the capture, so nothing here demonstrates it either way.
          approvals: null,
          // Advertised in the handshake (`_meta.steering.supported`) and not
          // exercised, which is an advert rather than an observation.
          steering: null,
          namesModel: true,
          fileEdits: true,
          sharedBus: false,
          sessionControl: true,
          // `usage_update` carries `size: 258400` beside what was used.
          contextWindow: true,
        }),
        note: "Codex through the ACP adapter. Streams where `exec --json` does not, and `session/new` reports the sandbox modes — read-only, auto, full-access — that are its nearest thing to a permission mode.",
      }),
    ]),
  }),
  Object.freeze({
    id: "cursor",
    label: "Cursor Agent",
    transports: Object.freeze([
      Object.freeze({
        id: "stream",
        label: "stream-json",
        command: "agent -p --output-format stream-json --stream-partial-output",
        interactive: false,
        provenance: CURSOR_STREAM_PROVENANCE,
        supports: Object.freeze({
          streaming: true,
          // Init names the model and cwd, but not tools, skills or commands.
          capabilities: false,
          approvals: false,
          steering: false,
          namesModel: true,
          // Edit completions publish a unified diff on the wire.
          fileEdits: true,
          sharedBus: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "One-way Cursor Agent print mode. Timestamped assistant lines are text deltas; the final assistant line has no timestamp. Task spawns a child agent whose transcript never reaches this stream. There is no HTTP event bus — Cursor's interactive wire is ACP, not a serve.",
      }),
      Object.freeze({
        id: "acp",
        label: "acp",
        command: "agent acp",
        interactive: true,
        provenance: CURSOR_ACP,
        supports: Object.freeze({
          streaming: true,
          // session/new advertises models, modes and config options; available_commands_update lands on the stream.
          capabilities: true,
          // Captured: session/request_permission with allow-once / allow-always / reject-once.
          approvals: true,
          steering: null,
          namesModel: true,
          // Edit tool_call_update names locations and carries a diff content block.
          fileEdits: true,
          sharedBus: false,
          // initialize advertises loadSession and session list; session/new and session/load open conversations.
          sessionControl: true,
          // No usage_update with a window size in the captures.
          contextWindow: false,
        }),
        note: "Cursor Agent natively over ACP. Approvals block on session/request_permission; authenticate uses cursor_login. Extension methods (cursor/ask_question, cursor/create_plan, cursor/update_todos, cursor/task) exist in the docs but were not exercised in these captures.",
      }),
    ]),
  }),
  Object.freeze({
    id: "opencode",
    label: "opencode",
    transports: Object.freeze([
      Object.freeze({
        id: "run",
        label: "run --format json",
        command: "opencode run --format json",
        interactive: false,
        provenance: OPENCODE_RUN_PROVENANCE,
        supports: Object.freeze({
          streaming: false,
          capabilities: false,
          approvals: false,
          steering: false,
          namesModel: false,
          fileEdits: true,
          sharedBus: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "One-way, and it opens with nothing at all — no init line, no model, no working directory. Unattended, anything its permission rules ask about is auto-rejected and the run simply ends.",
      }),
      Object.freeze({
        id: "serve",
        label: "serve",
        command: "opencode serve  →  GET /event",
        interactive: true,
        provenance: OPENCODE_SERVER_PROVENANCE,
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          approvals: true,
          steering: null,
          namesModel: true,
          fileEdits: true,
          sharedBus: true,
          // The captures are receive-only: nothing drove the server's own
          // session endpoints over this connection.
          sessionControl: null,
          contextWindow: false,
        }),
        note: "The headless server's own bus, and the first place opencode streams. `/event` is server-wide, so a reader has to filter by session.",
      }),
      Object.freeze({
        id: "acp",
        label: "acp",
        command: "opencode acp",
        interactive: true,
        provenance: Object.freeze({ ...OPENCODE_RUN_PROVENANCE, command: "opencode acp" }),
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          approvals: true,
          steering: null,
          namesModel: true,
          // ACP names the files a call touched as `locations`, which is a
          // stronger claim than a path read off a tool's input.
          fileEdits: true,
          // One connection, one conversation: sessions are opened explicitly
          // rather than multiplexed onto a shared bus.
          sharedBus: false,
          sessionControl: true,
          contextWindow: true,
        }),
        note: "A different protocol from the server's bus, not another door onto it: JSON-RPC over stdio, where the agent asks the client for permission and blocks until answered. It states its own version, negotiates capabilities, and reports the context window's size.",
      }),
    ]),
  }),
  Object.freeze({
    id: "kiro",
    label: "Kiro CLI",
    transports: Object.freeze([
      Object.freeze({
        id: "chat",
        label: "chat --no-interactive --output-format stream-json",
        command: "kiro-cli chat --no-interactive --trust-all-tools --output-format stream-json",
        interactive: false,
        provenance: KIRO_CHAT_PROVENANCE,
        supports: Object.freeze({
          streaming: true,
          // system/init advertises model, cwd, tools, skills, agents, MCP
          // servers, and slash commands.
          capabilities: true,
          // Headless mode auto-approves with --trust-all-tools; no approval
          // exchange reaches this stream.
          approvals: false,
          steering: false,
          namesModel: true,
          // Edit tool completions carry diff content blocks.
          fileEdits: true,
          sharedBus: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "One-way headless mode. Requires V2 or V3 engine (--engine v2 or --engine v3). The opening system/init line advertises the whole session. AgentMessageChunk lines are streaming deltas; turn_end terminates the turn.",
      }),
      Object.freeze({
        id: "acp",
        label: "acp",
        command: "kiro-cli acp",
        interactive: true,
        provenance: KIRO_ACP,
        supports: Object.freeze({
          streaming: true,
          // session/new advertises models and config options; _kiro.dev/commands/available lands on the stream.
          capabilities: true,
          // The protocol carries approvals; no capture exists yet for Kiro specifically.
          // TODO(kiro-live): Fill from a real acp capture — leave null until observed.
          approvals: null,
          steering: null,
          namesModel: true,
          // Edit tool_call_update carries diff content blocks with path info.
          // TODO(kiro-live): Confirm fileEdits on a live acp edit tool_call_update.
          fileEdits: null,
          sharedBus: false,
          // initialize advertises loadSession; session/new and session/load open conversations.
          sessionControl: true,
          // TODO(kiro-live): Confirm contextWindow from a live acp usage_update / init.
          contextWindow: null,
        }),
        note: "Kiro CLI natively over ACP (JSON-RPC 2.0 over stdio). Implements the standard ACP surface plus _kiro.dev/* extensions for slash commands, MCP events, compaction status, and session management. The shared acp/ mapper reads it.",
      }),
    ]),
  }),
])

/** One provider's descriptor, or null for an id this build has never read. */
export function transportsOf(providerId: string): ProviderDescriptor | null {
  return AGENT_TRANSPORTS.find((provider) => provider.id === providerId) ?? null
}

/** One transport's descriptor. */
export function transportOf(providerId: string, transportId: string): TransportDescriptor | null {
  return transportsOf(providerId)?.transports.find((transport) => transport.id === transportId) ?? null
}
