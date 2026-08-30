/** @responsibility Describes the message parts both opencode transports carry, and turns one into normalized events. */

import { PlanStepStatus, TaskKind } from "../events"
import { EventSink } from "../emitter"
import type {
  AgentEvent,
  AgentEventPayload,
  FileEdit,
  PlanStep,
  SessionInfo,
  ToolKind,
  ToolResult,
  Usage,
} from "../events"
import { asArray, asNumber, asObject, asRecord, asString, shortenPath } from "../json"
import type { JsonValue } from "../json"

/**
 * The one thing opencode's two wires agree on.
 *
 * `run --format json` publishes a part per line; the server's bus wraps the
 * same object in `message.part.updated`. The envelopes are different protocols
 * with different versions — which is why they are described separately — but
 * the payload inside them is one shape, and reading it twice would be two sets
 * of rules to disagree about one conversation.
 */
export const OpencodePartType = Object.freeze({
  StepStart: "step-start",
  StepFinish: "step-finish",
  Text: "text",
  Reasoning: "reasoning",
  Tool: "tool",
} as const)

export type OpencodePartType = (typeof OpencodePartType)[keyof typeof OpencodePartType]

/**
 * A tool call's lifecycle.
 *
 * Verified against opencode's own source, because the obvious reading is
 * wrong. `error` means the call did not complete — `failToolCall` sets it when
 * the tool threw, was refused by a permission rule, or was aborted. A shell
 * command that *ran* and exited non-zero is `completed`: the shell tool returns
 * normally and puts the code in `metadata.exit`, so reading failure from the
 * status alone would draw every failed build as a success.
 */
export const OpencodeToolStatus = Object.freeze({
  Pending: "pending",
  Running: "running",
  Completed: "completed",
  Error: "error",
} as const)

export type OpencodeToolStatus = (typeof OpencodeToolStatus)[keyof typeof OpencodeToolStatus]

/**
 * The tool names observed on the wire.
 *
 * A checklist of what is handled, never a claim about what exists: opencode
 * ships plugins and MCP servers that add their own, and anything unlisted must
 * still reach the log as a call of unknown kind rather than failing the line.
 */
export const OpencodeToolName = Object.freeze({
  /**
   * The shell.
   *
   * Implemented upstream as `shell.ts`, but exposed as `bash` on purpose — its
   * own source keeps the id for compatibility with existing plugins and saved
   * permissions, and notes the rename is planned for opencode 2.0. Both are
   * named here so a capture from either build maps to the same kind.
   */
  Bash: "bash",
  /** The announced 2.0 name for the same tool. Unseen on 1.18.25. */
  Shell: "shell",
  Read: "read",
  Write: "write",
  Edit: "edit",
  Patch: "patch",
  Glob: "glob",
  Grep: "grep",
  List: "list",
  WebFetch: "webfetch",
  /** Search, which opencode serves through an external MCP endpoint. */
  WebSearch: "websearch",
  TodoWrite: "todowrite",
  TodoRead: "todoread",
  /** Delegation. Its metadata names the child session, which is readable on its own. */
  Task: "task",
} as const)

export type OpencodeToolName = (typeof OpencodeToolName)[keyof typeof OpencodeToolName]

/** A step's stop reason, as reported on a step-finish part. */
export const OpencodeFinishReason = Object.freeze({
  Stop: "stop",
  ToolCalls: "tool-calls",
  Length: "length",
  ContentFilter: "content-filter",
  Error: "error",
} as const)

export type OpencodeFinishReason = (typeof OpencodeFinishReason)[keyof typeof OpencodeFinishReason]

/** Token counts, as a step reports them. */
export interface OpencodeTokens {
  readonly total?: number
  readonly input?: number
  readonly output?: number
  readonly reasoning?: number
  readonly cache?: { readonly read?: number; readonly write?: number }
}

export interface OpencodeStepStartPart {
  readonly type: "step-start"
  readonly id: string
  readonly messageID?: string
  readonly sessionID?: string
}

export interface OpencodeStepFinishPart {
  readonly type: "step-finish"
  readonly id: string
  readonly messageID?: string
  readonly sessionID?: string
  readonly reason?: string
  readonly tokens?: OpencodeTokens
  readonly cost?: number
}

export interface OpencodeTextPart {
  readonly type: "text" | "reasoning"
  readonly id: string
  readonly messageID?: string
  readonly sessionID?: string
  readonly text?: string
  readonly time?: { readonly start?: number; readonly end?: number }
}

/**
 * A tool call.
 *
 * `state` carries the whole call — the input it ran with and the output or
 * error it produced — so one part is the entire row rather than the opening
 * half of one.
 */
export interface OpencodeToolPart {
  readonly type: "tool"
  readonly id: string
  readonly callID?: string
  readonly tool?: string
  readonly messageID?: string
  readonly sessionID?: string
  readonly state?: {
    readonly status?: string
    readonly input?: JsonValue
    readonly output?: string
    readonly error?: string
    readonly title?: string
    readonly metadata?: JsonValue
    readonly time?: { readonly start?: number; readonly end?: number }
  }
}

export type OpencodePart = OpencodeStepStartPart | OpencodeStepFinishPart | OpencodeTextPart | OpencodeToolPart

/** One line naming what a call does, from its own input. */
export function toolTitle(tool: string, input: Record<string, JsonValue>, fallback: string | null): string {
  if (fallback !== null && fallback !== "") return fallback
  switch (tool) {
    case OpencodeToolName.Bash:
    case OpencodeToolName.Shell:
      return asString(input.command) ?? "command"
    case OpencodeToolName.Read:
    case OpencodeToolName.Write:
    case OpencodeToolName.Edit: {
      const path = asString(input.filePath) ?? asString(input.path)
      return path === null ? tool : shortenPath(path)
    }
    case OpencodeToolName.Task:
      return asString(input.description) ?? asString(input.subagent_type) ?? "subagent"
    case OpencodeToolName.Grep:
    case OpencodeToolName.Glob:
      return asString(input.pattern) ?? tool
    default:
      return tool
  }
}

/** The paths a call wrote, read off its own input rather than any result text. */
export function editsOf(tool: string, input: Record<string, JsonValue>): readonly FileEdit[] {
  const path = asString(input.filePath) ?? asString(input.path)
  if (path === null) return []
  return [
    {
      path,
      // opencode does not say whether a write created or replaced the file, and
      // guessing from the tool name would be wrong exactly when a `write`
      // overwrites something. `update` is the honest weaker claim.
      change: tool === OpencodeToolName.Write ? "add" : "update",
      // It publishes which file a call touched, never the text of the change,
      // so there is no diff to hand a viewer.
      unifiedDiff: null,
    },
  ]
}

/** Reads a `todowrite` call's list into the shared plan shape. */
export function planOf(input: Record<string, JsonValue>): readonly PlanStep[] {
  const steps: PlanStep[] = []
  for (const entry of asArray(input.todos)) {
    const todo = asRecord(entry)
    const content = asString(todo.content)
    if (content === null) continue
    steps.push({ id: asString(todo.id), content, status: opencodePlanStatus(asString(todo.status)) })
  }
  return steps
}

/** Reads a step's token counts, leaving absent ones null rather than zero. */
export function usageOf(part: Record<string, JsonValue>): Usage | null {
  const tokens = asObject(part.tokens)
  if (tokens === null) return null
  const cache = asRecord(tokens.cache)
  return {
    totalTokens: asNumber(tokens.total),
    inputTokens: asNumber(tokens.input),
    outputTokens: asNumber(tokens.output),
    reasoningTokens: asNumber(tokens.reasoning),
    cacheReadTokens: asNumber(cache.read),
    cacheCreationTokens: asNumber(cache.write),
    totalCostUsd: asNumber(part.cost) ?? undefined,
  }
}

/**
 * Whether a settled call failed, and with what.
 *
 * See [`OpencodeToolStatus`] — the status alone is not the answer, and the
 * exit code is where a run command's failure actually lives.
 */
export function resultOf(state: Record<string, JsonValue>): ToolResult {
  const status = asString(state.status)
  const metadata = asRecord(state.metadata)
  const exit = asNumber(metadata.exit)
  const failed = status === OpencodeToolStatus.Error || (exit !== null && exit !== 0)
  const error = asString(state.error)
  return {
    text: error ?? asString(state.output) ?? "",
    isError: failed,
    // The whole metadata block, so a detail view can show the exit code, the
    // child session id a delegation names, or whatever a plugin's tool put
    // there — none of which flattens into the text without losing its shape.
    structured: Object.keys(metadata).length === 0 ? null : (state.metadata ?? null),
    // opencode returns no images on either wire.
    images: [],
  }
}

/** The block a settled part occupies, so a streamed preview can be superseded by it. */
export function blockOf(emit: EventSink, part: Record<string, JsonValue>): { messageId: string; index: number } | null {
  const messageId = asString(part.messageID)
  const partId = asString(part.id)
  if (messageId === null || partId === null) return null
  return { messageId, index: emit.indexOf(messageId, partId) }
}

/** The session shape a transport that never describes one has to fall back to. */
export function bareSession(sessionId: string, initIndex: number): SessionInfo {
  return {
    sessionId,
    model: null,
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
    initIndex,
  }
}

/**
 * Emits normalized events, holding the state that requires.
 *
 * Shared by both transports so a part means the same thing whichever envelope
 * carried it. What differs between the two — how a session is announced, when a
 * turn ends, whether anything streams — stays in each transport's own mapper.
 */

/**
 * One settled call, as the pair of events a consumer's tool row expects.
 *
 * opencode publishes the call once, with input and result together. Emitting
 * only a completion would leave a row that never opened; emitting both keeps
 * every provider's tool rows built the same way, and the two simply share a
 * line here.
 */
export function toolEvents(
  emit: EventSink,
  part: Record<string, JsonValue>,
  raw: JsonValue,
  ts: string | null,
): readonly AgentEvent[] {
  const tool = asString(part.tool) ?? "unknown"
  const callId = asString(part.callID) ?? asString(part.id) ?? "unknown"
  const state = asRecord(part.state)
  const input = asRecord(state.input)
  const status = asString(state.status)
  const events: AgentEvent[] = []
  // Keyed by session as well as call: the bus multiplexes sessions onto one
  // connection, and two of them may name a call the same thing. Without the
  // session the second one is mistaken for a republish and vanishes.
  const key = `${emit.current ?? "unknown"}:${callId}`
  const settled = status !== OpencodeToolStatus.Pending && status !== OpencodeToolStatus.Running

  // The row opens once, and not until the call says what it is running. On the
  // bus the first sighting is a `pending` part whose input is `{}` and which
  // has no title — opening on that produced rows that never said what the tool
  // actually ran, because nothing later revises an open row.
  const describes = settled || Object.keys(input).length > 0
  if (describes && !emit.openedCalls.has(key)) {
    emit.openedCalls.add(key)
    events.push(
      emit.build(
        {
          type: "tool_call_started",
          callId,
          name: tool,
          kind: opencodeToolKind(tool),
          input: state.input ?? null,
          title: toolTitle(tool, input, asString(state.title)),
        },
        raw,
        ts,
      ),
    )
  }

  // A call still running has opened but not settled. The one-way stream
  // publishes calls already settled; the server's bus does not, and this is
  // what keeps it from reporting a result nobody produced.
  if (!settled) return events
  // And settles once, however many times the settled part is republished.
  if (emit.settledCalls.has(key)) return events
  emit.settledCalls.add(key)

  const metadata = asRecord(state.metadata)

  if (tool === OpencodeToolName.Task) {
    events.push(
      emit.build(
        {
          type: "task_started",
          taskId: callId,
          callId,
          taskKind: OPENCODE_TASK_KIND,
          // The agent's own name, which opencode puts on the call's input —
          // so a delegation can be labelled without waiting for its result.
          label: asString(input.subagent_type) ?? tool,
          description: asString(input.description) ?? asString(state.title) ?? "",
          prompt: asString(input.prompt),
          // Unlike the other two providers this names the child's own
          // session, and `opencode export <id>` reads it. Delegated work here
          // is readable, not merely watchable.
          transcriptId: asString(metadata.sessionId),
        },
        raw,
        ts,
      ),
    )
  }

  const result = resultOf(state)
  events.push(emit.build({ type: "tool_call_completed", callId, result }, raw, ts))

  if (tool === OpencodeToolName.TodoWrite) {
    const steps = planOf(input)
    if (steps.length > 0) events.push(emit.build({ type: "plan_updated", steps }, raw, ts))
  }

  if (tool === OpencodeToolName.Write || tool === OpencodeToolName.Edit || tool === OpencodeToolName.Patch) {
    // Only a call that actually ran changed anything: a refused write must
    // not be reported as an edit that happened.
    const edits = status === OpencodeToolStatus.Error ? [] : editsOf(tool, input)
    if (edits.length > 0) events.push(emit.build({ type: "file_edits", callId, edits }, raw, ts))
  }

  if (tool === OpencodeToolName.Task) {
    events.push(
      emit.build(
        {
          type: "task_completed",
          taskId: callId,
          callId,
          status: status ?? "completed",
          summary: result.text === "" ? null : result.text,
          usage: null,
        },
        raw,
        ts,
      ),
    )
  }

  return events
}

/**
 * opencode's tool names mapped to our rendering hints.
 *
 * A lookup rather than a chain of comparisons, for the reason the other tables
 * give: the mapping is data, and written as data the compiler checks it against
 * the provider's own union.
 */
export const OPENCODE_TOOL_KIND: Readonly<Partial<Record<OpencodeToolName, ToolKind>>> = Object.freeze({
  [OpencodeToolName.Bash]: "shell",
  // The same tool under its announced 2.0 id, so a capture from either build
  // renders identically rather than falling back to "other".
  [OpencodeToolName.Shell]: "shell",
  [OpencodeToolName.Read]: "file_read",
  [OpencodeToolName.Write]: "file_edit",
  [OpencodeToolName.Edit]: "file_edit",
  [OpencodeToolName.Patch]: "file_edit",
  [OpencodeToolName.Glob]: "search",
  [OpencodeToolName.Grep]: "search",
  [OpencodeToolName.List]: "search",
  [OpencodeToolName.WebFetch]: "web",
  [OpencodeToolName.WebSearch]: "web",
  [OpencodeToolName.TodoWrite]: "plan",
  [OpencodeToolName.TodoRead]: "plan",
  [OpencodeToolName.Task]: "subagent",
})

/** Reads a tool name as one of our tool kinds. */
export function opencodeToolKind(tool: string | null): ToolKind {
  if (tool === null) return "other"
  // Keyed by the provider's own union, so a renamed tool fails to compile
  // rather than silently rendering every call as "other". An MCP tool arrives
  // under its server's own name and is correctly "other" until named here.
  return OPENCODE_TOOL_KIND[tool as OpencodeToolName] ?? "other"
}

/** opencode's todo statuses, mapped to ours. */
export const OPENCODE_PLAN_STATUS: Readonly<Record<string, PlanStepStatus>> = Object.freeze({
  pending: PlanStepStatus.Pending,
  in_progress: PlanStepStatus.InProgress,
  completed: PlanStepStatus.Completed,
  cancelled: PlanStepStatus.Completed,
})

/** Reads a todo status as one of ours, defaulting to pending. */
export function opencodePlanStatus(status: string | null): PlanStepStatus {
  if (status === null) return PlanStepStatus.Pending
  return OPENCODE_PLAN_STATUS[status] ?? PlanStepStatus.Pending
}

/** Every opencode delegation is an agent run; it has no workflow or background-shell kind. */
export const OPENCODE_TASK_KIND: TaskKind = TaskKind.Agent
