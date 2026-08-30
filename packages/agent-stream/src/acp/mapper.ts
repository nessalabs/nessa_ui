/** @responsibility Turns Agent Client Protocol frames into normalized agent events. */

import type { AgentEvent, AgentStreamMapper, FileEdit, MapperOptions, PlanStep, SessionInfo } from "../events"
import { PlanStepStatus } from "../events"
import { asArray, asNumber, asObject, asRecord, asString } from "../json"
import type { JsonValue } from "../json"
import { EventSink } from "../emitter"
import { TaskKind } from "../events"
import type { AcpRawFrame } from "./frame"
import { acpToolKind, acpToolKindByName } from "./mapping"
import { parseAcpLine } from "./frame"
import { ACP_TOOL_NAME, AcpMethod, AcpToolStatus, AcpUpdate } from "./wire"

/**
 * A call's kind, preferring opencode's own tool name over ACP's coarser one.
 *
 * The protocol's vocabulary is deliberately small — `task` arrives as `think`,
 * `todowrite` and `websearch` both as `other` — which is right for a client
 * that knows nothing about the agent behind it. Here we do know, so the tool
 * name wins where it is recognised and the protocol's kind carries the rest.
 */
function acpKind(title: string | null, kind: string | null) {
  const byName = acpToolKindByName(title)
  return byName === null ? acpToolKind(kind) : byName
}

/**
 * A `todowrite`-style call's list, read off the call's own input.
 *
 * ACP defines a `plan` update, and at least one agent does not use it: opencode
 * sends its todo list as a tool call instead. Reading both is what makes a plan
 * render whichever way an agent chose to report it.
 */
function acpPlanOf(input: Record<string, JsonValue>): readonly PlanStep[] {
  const steps: PlanStep[] = []
  for (const entry of asArray(input.todos)) {
    const todo = asRecord(entry)
    const content = asString(todo.content)
    if (content === null) continue
    steps.push({ id: asString(todo.id), content, status: planStatus(asString(todo.status)) })
  }
  return steps
}

/** ACP's plan statuses, mapped to ours. */
function planStatus(status: string | null): PlanStepStatus {
  if (status === "in_progress") return PlanStepStatus.InProgress
  if (status === "completed") return PlanStepStatus.Completed
  return PlanStepStatus.Pending
}

/**
 * Reads the ACP conversation.
 *
 * Unlike the other two this is not a stream: frames travel both ways, and a
 * request from the agent is the thing a surface most has to handle — a
 * permission ask blocks the tool until the client answers it.
 *
 * A client's own frames are mapped too. They are the only record of what was
 * asked, since ACP carries the prompt in the request rather than echoing it.
 */
export class AcpMapper implements AgentStreamMapper {
  private readonly emit: EventSink
  /** Which pending request id belongs to a prompt, so its reply can end the turn. */
  private readonly prompts = new Set<string>()
  /**
   * Pending permission asks, and what each option means.
   *
   * The answer comes back as a plain JSON-RPC response naming an `optionId`,
   * so the ask's own option list is the only place that says whether that id
   * allows or refuses. Without this the ask never retires and a surface shows
   * a blocking prompt for the rest of the session.
   */
  private readonly asks = new Map<string, ReadonlyMap<string, string>>()
  /** Tool kinds by call id, so an update that omits the kind keeps the one the call opened with. */
  private readonly kinds = new Map<string, string>()
  /**
   * Tool names by call id.
   *
   * ACP renames a call as it goes — `task` becomes the subagent's description,
   * `websearch` becomes the query — so what the call *is* has to be remembered
   * from the frame that opened it.
   */
  private readonly titles = new Map<string, string>()

  constructor(options: MapperOptions = {}) {
    this.emit = new EventSink(options.startSeq ?? 0)
  }

  /** Decodes and maps one frame. A blank line maps to nothing. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseAcpLine(line)
    if (parsed === null) return []
    if (!parsed.ok) {
      return [this.emit.build({ type: "error", message: `unreadable frame: ${parsed.reason}` }, { line: parsed.line }, null)]
    }
    return this.map(parsed.line)
  }

  /** Maps an already-decoded frame. */
  map(event: AcpRawFrame): readonly AgentEvent[] {
    const raw = event as JsonValue
    const frame = asRecord(raw)
    const method = asString(frame.method)
    const params = asRecord(frame.params)
    const id = asString(frame.id) ?? (asNumber(frame.id) === null ? null : String(asNumber(frame.id)))

    // A response, which is where a session id and a turn's ending arrive.
    if (method === null) return this.response(id, asRecord(frame.result), raw)

    const sessionId = asString(params.sessionId)
    if (sessionId !== null) {
      this.emit.current = sessionId
      this.emit.primary ??= sessionId
    }

    switch (method) {
      case AcpMethod.SessionPrompt: {
        // The request carries the prompt: this is the only one of opencode's
        // three wires where what was asked is on the wire at all.
        if (id !== null) this.prompts.add(id)
        const text = asArray(params.prompt)
          .map((block) => asString(asRecord(block).text))
          .filter((part): part is string => part !== null)
          .join("")
        if (text === "") return []
        return [this.emit.build({ type: "user_message", text, synthetic: false }, raw, null)]
      }

      case AcpMethod.SessionRequestPermission: {
        const call = asRecord(params.toolCall)
        const options = new Map<string, string>()
        for (const entry of asArray(params.options)) {
          const option = asRecord(entry)
          const optionId = asString(option.optionId)
          const kind = asString(option.kind)
          if (optionId !== null && kind !== null) options.set(optionId, kind)
        }
        if (id !== null) this.asks.set(id, options)
        return [
          this.emit.build(
            {
              type: "permission_requested",
              requestId: id ?? "",
              callId: asString(call.toolCallId) ?? "",
              toolName: asString(call.title) ?? asString(call.kind) ?? "",
              // What the tool would do, as the protocol reports it: the raw
              // input and every path it named.
              input: params.toolCall ?? null,
              reason: asString(call.kind),
              displayName: asString(call.title),
              // The answers the client may give. A surface that offered its own
              // wording would send an option the agent never listed.
              description: asArray(params.options)
                .map((option) => asString(asRecord(option).name))
                .filter((name): name is string => name !== null)
                .join(" · "),
            },
            raw,
            null,
          ),
        ]
      }

      case AcpMethod.SessionUpdate:
        return this.update(asRecord(params.update), raw)

      default:
        return []
    }
  }

  /** One `session/update`. */
  private update(update: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const kind = asString(update.sessionUpdate)
    switch (kind) {
      case AcpUpdate.AgentMessageChunk:
      case AcpUpdate.AgentThoughtChunk: {
        const text = asString(asRecord(update.content).text)
        if (text === null || text === "") return []
        // ACP publishes no committed message: the chunks *are* the answer. They
        // are still emitted as deltas so a consumer folds them the same way it
        // folds every other provider's, and the fold is what assembles the text.
        const messageId = asString(update.messageId) ?? "acp"
        const block = {
          messageId,
          index: this.emit.indexOf(messageId, kind === AcpUpdate.AgentThoughtChunk ? "thought" : "message"),
        }
        return [this.emit.build({ type: "delta", delta: "text", block, text }, raw, null)]
      }

      case AcpUpdate.UserMessageChunk: {
        const text = asString(asRecord(update.content).text)
        if (text === null || text === "") return []
        return [this.emit.build({ type: "user_message", text, synthetic: false }, raw, null)]
      }

      case AcpUpdate.ToolCall: {
        const callId = asString(update.toolCallId) ?? "unknown"
        const kindName = asString(update.kind)
        const title = asString(update.title)
        if (kindName !== null) this.kinds.set(callId, kindName)
        if (title !== null) this.titles.set(callId, title)
        const events: AgentEvent[] = [
          this.emit.build(
            {
              type: "tool_call_started",
              callId,
              name: title ?? kindName ?? "tool",
              kind: acpKind(title, kindName),
              input: update.rawInput ?? null,
              title: title ?? kindName ?? "tool",
            },
            raw,
            null,
          ),
        ]
        // A delegation opens here with nothing in it — ACP sends the agent's
        // prompt nowhere — so the run is opened on the name alone and filled in
        // when it settles.
        if (title === ACP_TOOL_NAME.Task) {
          events.push(
            this.emit.build(
              {
                type: "task_started",
                taskId: callId,
                callId,
                taskKind: TaskKind.Agent,
                label: title,
                description: "",
                prompt: null,
                // Named only inside the result text on this wire, so it cannot
                // be known yet.
                transcriptId: null,
              },
              raw,
              null,
            ),
          )
        }
        return events
      }

      case AcpUpdate.ToolCallUpdate: {
        const callId = asString(update.toolCallId) ?? "unknown"
        const status = asString(update.status)
        const title = asString(update.title) ?? this.titles.get(callId) ?? null

        // opencode's plan rides on `todowrite`'s *input*, and arrives while the
        // call is still running rather than on its result. Waiting for a
        // terminal status would drop every plan update this wire sends.
        if (this.titles.get(callId) === ACP_TOOL_NAME.TodoWrite) {
          const steps = acpPlanOf(asRecord(update.rawInput))
          if (steps.length > 0) return [this.emit.build({ type: "plan_updated", steps }, raw, null)]
        }
        // Only a terminal status settles the call. `in_progress` is the one
        // state the other two transports never publish, and treating it as a
        // result would close a row that is still running.
        if (status !== AcpToolStatus.Completed && status !== AcpToolStatus.Failed) return []
        const events: AgentEvent[] = [
          this.emit.build(
            {
              type: "tool_call_completed",
              callId,
              result: {
                text: acpContent(update),
                isError: status === AcpToolStatus.Failed,
                structured: update.rawOutput ?? null,
                images: [],
              },
            },
            raw,
            null,
          ),
        ]
        const edits = acpEdits(update, this.kinds.get(callId) ?? asString(update.kind))
        if (edits.length > 0) events.push(this.emit.build({ type: "file_edits", callId, edits }, raw, null))

        if (this.titles.get(callId) === ACP_TOOL_NAME.Task) {
          const text = acpContent(update)
          events.push(
            this.emit.build(
              {
                type: "task_completed",
                taskId: callId,
                callId,
                status: status ?? "completed",
                summary: text === "" ? null : text,
                usage: null,
              },
              raw,
              null,
            ),
          )
        }
        return events
      }

      case AcpUpdate.Plan: {
        const steps: PlanStep[] = []
        for (const entry of asArray(update.entries)) {
          const step = asRecord(entry)
          const content = asString(step.content)
          if (content === null) continue
          steps.push({ id: null, content, status: planStatus(asString(step.status)) })
        }
        if (steps.length === 0) return []
        return [this.emit.build({ type: "plan_updated", steps }, raw, null)]
      }

      case AcpUpdate.CurrentModeUpdate:
        return [
          this.emit.build(
            { type: "status_changed", status: asString(update.currentModeId), permissionMode: null },
            raw,
            null,
          ),
        ]

      default:
        return []
    }
  }

  /** A response frame: a new session, or the end of a turn. */
  private response(id: string | null, result: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    // The client's answer to a permission ask, which is what retires it.
    //
    // Matched on the id *and* the shape: the two directions of a JSON-RPC pipe
    // number their requests independently, so an agent's ask and a client's
    // prompt can share an id. Keying on the id alone read a prompt's own reply
    // as a permission answer and swallowed the turn's ending.
    if (id !== null && this.asks.has(id) && asRecord(result.outcome) !== null && "outcome" in asRecord(result.outcome)) {
      const options = this.asks.get(id)!
      this.asks.delete(id)
      const outcome = asRecord(result.outcome)
      const optionId = asString(outcome.optionId)
      const kind = optionId === null ? null : (options.get(optionId) ?? null)
      return [
        this.emit.build(
          {
            type: "permission_decided",
            requestId: id,
            // The option's *kind* decides, not its id: an agent names its
            // options whatever it likes, and only the kind says which way one
            // goes. A cancelled outcome answered nothing, so it stays unknown.
            decision:
              asString(outcome.outcome) === "cancelled" || kind === null
                ? null
                : kind.startsWith("reject")
                  ? "deny"
                  : "allow",
            message: null,
          },
          raw,
          null,
        ),
      ]
    }

    const sessionId = asString(result.sessionId)
    if (sessionId !== null && !this.emit.openedSessions.has(sessionId)) {
      this.emit.openedSessions.add(sessionId)
      this.emit.primary ??= sessionId
      this.emit.current = sessionId
      return [this.emit.build({ type: "session_started", session: acpSession(sessionId, result) }, raw, null)]
    }

    if (id === null || !this.prompts.has(id)) return []
    this.prompts.delete(id)
    const reported = asObject(result.usage)
    const usage = asRecord(result.usage)
    const stop = asString(result.stopReason)
    return [
      this.emit.build(
        {
          type: "turn_completed",
          // ACP's own words for how a turn ended. `cancelled` is a real
          // outcome here, which no other opencode transport reports.
          status: stop === "cancelled" ? "interrupted" : stop === "refusal" ? "error" : "completed",
          stopReason: stop,
          terminalReason: null,
          finalText: null,
          // Absent means absent. Building an all-null Usage made "nothing was
          // reported" indistinguishable from "reported, and every counter is
          // unknown" — and only on this wire, so a consumer checking
          // `usage !== null` drew an empty panel for ACP sessions alone.
          usage:
            reported === null
              ? null
              : {
                  totalTokens: asNumber(usage.totalTokens),
                  inputTokens: asNumber(usage.inputTokens),
                  outputTokens: asNumber(usage.outputTokens),
                  // Codex's adapter calls it `thoughtTokens`; without reading
                  // it, reasoning cost showed on `exec` and vanished here.
                  reasoningTokens: asNumber(usage.thoughtTokens) ?? asNumber(usage.reasoningTokens),
                  cacheReadTokens: asNumber(usage.cachedReadTokens),
                  cacheCreationTokens: null,
                },
          durationMs: null,
          numTurns: null,
          permissionDenials: [],
        },
        raw,
        null,
      ),
    ]
  }
}

/** The session as `session/new` describes it: the model in force, and the config it could change. */
function acpSession(sessionId: string, result: Record<string, JsonValue>): SessionInfo {
  let model: string | null = null
  for (const entry of asArray(result.configOptions)) {
    const option = asRecord(entry)
    if (asString(option.id) === "model") model = asString(option.currentValue)
  }
  return {
    sessionId,
    model,
    cwd: null,
    tools: [],
    slashCommands: [],
    terminalSlashCommands: [],
    agents: [],
    skills: [],
    plugins: [],
    mcpServers: [],
    permissionMode: null,
    version: null,
    outputStyle: null,
    initIndex: 0,
  }
}

/** A settled call's output, flattened from whatever content blocks it carried. */
function acpContent(update: Record<string, JsonValue>): string {
  const parts: string[] = []
  for (const entry of asArray(update.content)) {
    const block = asRecord(entry)
    const text = asString(block.text) ?? asString(asRecord(block.content).text)
    if (text !== null) parts.push(text)
  }
  return parts.join("")
}

/** The files a call touched, which ACP names as locations rather than leaving to a tool's input. */
function acpEdits(update: Record<string, JsonValue>, kind: string | null): readonly FileEdit[] {
  if (kind !== "edit" && kind !== "delete" && kind !== "move") return []
  const edits: FileEdit[] = []
  for (const entry of asArray(update.locations)) {
    const path = asString(asRecord(entry).path)
    if (path === null) continue
    edits.push({ path, change: kind === "delete" ? "delete" : "update", unifiedDiff: null })
  }
  return edits
}

/** Maps a whole ACP capture in one pass. */
export function mapAcpStream(text: string, options?: MapperOptions): readonly AgentEvent[] {
  const mapper = new AcpMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) events.push(...mapper.push(line))
  return events
}
