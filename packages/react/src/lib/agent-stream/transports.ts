/** @responsibility Describes each provider's transports and what one can report, so a surface reads capability rather than hardcoding it. */

import type { WireProvenance } from "./events"

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
  /** Accepts a message mid-turn, to steer or queue. */
  readonly steering: Supported
  /** Names the model in force for the session. */
  readonly namesModel: Supported
  /** Reports structured file edits rather than opaque file tool calls. */
  readonly fileEdits: Supported
  /** Carries more than one session, so a reader must filter by session id. */
  readonly multiSession: Supported
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

const CLAUDE_STREAM_PROVENANCE: WireProvenance = Object.freeze({
  cli: "Claude Code",
  version: "2.1.251",
  command: "claude -p --output-format stream-json --include-partial-messages --verbose",
  capturedOn: "2026-08-29",
})

const CODEX_EXEC_PROVENANCE: WireProvenance = Object.freeze({
  cli: "codex-cli",
  version: "0.144.1",
  command: "codex exec --json",
  capturedOn: "2026-08-29",
})

const OPENCODE_RUN: WireProvenance = Object.freeze({
  cli: "opencode",
  version: "1.18.25",
  command: "opencode run --format json",
  capturedOn: "2026-08-29",
})

const OPENCODE_SERVE: WireProvenance = Object.freeze({
  cli: "opencode",
  version: "1.18.25",
  command: "opencode serve  →  GET /event",
  capturedOn: "2026-08-29",
})

const OPENCODE_ACP: WireProvenance = Object.freeze({
  cli: "opencode",
  version: "1.18.25",
  command: "opencode acp",
  capturedOn: "2026-08-29",
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
          multiSession: false,
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
          approvals: true,
          steering: true,
          namesModel: true,
          fileEdits: false,
          multiSession: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "The same stream with stdin open: prompts and steering go in, and control requests answer approvals.",
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
          multiSession: false,
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
        provenance: CODEX_EXEC_PROVENANCE,
        supports: Object.freeze({
          // Driven for its capability replies and its approval exchange, never
          // for a long answer, so whether it streams is unrecorded rather than
          // known to be false.
          streaming: null,
          capabilities: true,
          approvals: true,
          steering: true,
          namesModel: true,
          fileEdits: true,
          multiSession: null,
          sessionControl: true,
          contextWindow: null,
        }),
        note: "Interactive JSON-RPC. Answers model, skill, plugin and hook lists on request, and asks before running untrusted commands.",
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
        provenance: OPENCODE_RUN,
        supports: Object.freeze({
          streaming: false,
          capabilities: false,
          approvals: false,
          steering: false,
          namesModel: false,
          fileEdits: true,
          multiSession: false,
          sessionControl: false,
          contextWindow: false,
        }),
        note: "One-way, and it opens with nothing at all — no init line, no model, no working directory. Unattended, anything its permission rules ask about is auto-rejected and the run simply ends.",
      }),
      Object.freeze({
        id: "serve",
        label: "serve / acp",
        command: "opencode serve  →  GET /event",
        interactive: true,
        provenance: OPENCODE_SERVE,
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          approvals: true,
          steering: true,
          namesModel: true,
          fileEdits: true,
          multiSession: true,
          sessionControl: true,
          contextWindow: false,
        }),
        note: "The headless server's own bus, and the first place opencode streams. `/event` is server-wide, so a reader has to filter by session.",
      }),
      Object.freeze({
        id: "acp",
        label: "acp",
        command: "opencode acp",
        interactive: true,
        provenance: OPENCODE_ACP,
        supports: Object.freeze({
          streaming: true,
          capabilities: true,
          approvals: true,
          steering: true,
          namesModel: true,
          // ACP names the files a call touched as `locations`, which is a
          // stronger claim than a path read off a tool's input.
          fileEdits: true,
          // One connection, one conversation: sessions are opened explicitly
          // rather than multiplexed onto a shared bus.
          multiSession: false,
          sessionControl: true,
          contextWindow: true,
        }),
        note: "A different protocol from the server's bus, not another door onto it: JSON-RPC over stdio, where the agent asks the client for permission and blocks until answered. It states its own version, negotiates capabilities, and reports the context window's size.",
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
