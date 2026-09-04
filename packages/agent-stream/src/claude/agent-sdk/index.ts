/** @responsibility Reads the Claude Agent SDK's in-process message stream, which is Claude Code's wire delivered as objects. */

import type { AgentEvent, MapperOptions, WireProvenance } from "../../events"
import { ClaudeStreamMapper } from "../stream/mapper"
import type { JsonValue, WireLine } from "../stream/wire"

/**
 * The build these shapes were read from.
 *
 * `version` is the SDK's own, and only that: it is matched against a build
 * identifier, so the Claude Code build it embeds cannot ride along in the same
 * field. The captures were taken through SDK 0.3.260, whose `system/init`
 * reported Claude Code 2.1.260 — close enough to `CLAUDE_STREAM_PROVENANCE`'s
 * 2.1.251 that the shapes agreeing is unsurprising, and recorded here so a
 * future divergence has a baseline to be measured against.
 */
export const CLAUDE_AGENT_SDK_PROVENANCE: WireProvenance = Object.freeze({
  cli: "@anthropic-ai/claude-agent-sdk",
  version: "0.3.260",
  command: "query({ prompt, options: { includePartialMessages: true } })",
  capturedOn: "2026-09-04",
})

/**
 * Maps the Agent SDK's `query()` output.
 *
 * **This is Claude Code's `stream-json` wire, not a new one.** The captures
 * settle it: `system/init`, `stream_event`, `assistant`, `user`, `result`, and
 * the whole `task_started` / `task_progress` / `task_notification` family for
 * delegated runs, all with the same fields. Running the existing
 * [`ClaudeStreamMapper`] over three Agent SDK captures produced zero unknown
 * and zero error events. So this class delegates rather than duplicating: a
 * second copy of a thousand-line mapper would drift from the first, and the
 * drift would be silent.
 *
 * What it adds is the seam that actually differs. The CLI writes bytes and a
 * host parses lines; the SDK yields *objects*, and serializing them to JSON
 * just to parse them back is pure loss. [`pushMessage`] takes the object.
 *
 * Two differences from the CLI transport are worth knowing, and neither is a
 * parsing difference:
 *
 * - **Approvals never reach this stream.** `canUseTool` is answered in-process,
 *   so there is no `control_request` / `control_response` round-trip to read. A
 *   denial surfaces only as an `is_error` tool result and, at the very end, in
 *   `permission_denials` on the `result` line — which the mapper already reads.
 *   A surface that waits for a permission event here waits forever.
 * - **`includePartialMessages` is opt-in.** Without it the SDK yields only
 *   committed messages and no `stream_event` frames at all, so token-level
 *   previews are a property of how `query()` was called, not of the SDK.
 */
export class ClaudeAgentSdkMapper {
  private readonly inner: ClaudeStreamMapper

  constructor(options: MapperOptions = {}) {
    this.inner = new ClaudeStreamMapper(options)
  }

  /**
   * Maps one `SDKMessage` as `query()` yields it.
   *
   * Typed as an open record rather than against the SDK's own types on purpose:
   * this package has no dependencies, and taking one on `@anthropic-ai/claude-agent-sdk`
   * to name a parameter would push that install onto every consumer — including
   * the ones parsing a capture from disk. The mapper reads every field through
   * the shared readers anyway, so a declared type would buy no safety it does
   * not already have.
   */
  pushMessage(message: Readonly<Record<string, unknown>>): readonly AgentEvent[] {
    return this.inner.map(message as WireLine)
  }

  /** Maps one serialized line, for a capture replayed from disk. */
  push(line: string): readonly AgentEvent[] {
    return this.inner.push(line)
  }
}

/**
 * Maps a finished `query()` run in one pass.
 *
 * Takes what the host already collected, so a caller that iterated the SDK into
 * an array does not have to re-drive a mapper by hand.
 */
export function mapAgentSdkMessages(
  messages: Iterable<Readonly<Record<string, unknown>>>,
  options?: MapperOptions,
): readonly AgentEvent[] {
  const mapper = new ClaudeAgentSdkMapper(options)
  const events: AgentEvent[] = []
  for (const message of messages) events.push(...mapper.pushMessage(message))
  return events
}

/** Re-exported so a consumer reading this wire needs one import, not two. */
export type { JsonValue }
