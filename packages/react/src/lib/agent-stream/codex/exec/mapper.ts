/** @responsibility Turns Codex `exec --json` lines into normalized agent events, holding the little state that requires. */

import type {
  AgentEvent,
  AgentEventPayload,
  AgentPath,
  AgentStreamMapper,
  FileEdit,
  MapperOptions,
  PlanStep,
  SessionInfo,
  ToolResult,
  Usage,
} from "../../events"
import { asArray, asBoolean, asNumber, asObject, asRecord, asString, asStrings, shortenPath } from "../../json"
import type { JsonValue } from "../../json"
import {
  CODEX_TASK_KIND,
  codexFileChange,
  codexMappingFor,
  codexPlanStatus,
  codexToolKind,
} from "./mapping"
import { CODEX_SPAWN_TOOL, CodexItemStatus, CodexItemType, CodexWireType, parseCodexLine } from "./wire"
import type { CodexRawLine } from "./wire"

/** One line naming what an item does, from its own fields. */
function itemTitle(itemType: string, item: Record<string, JsonValue>): string {
  switch (itemType) {
    case CodexItemType.CommandExecution:
      return asString(item.command) ?? "command"
    case CodexItemType.FileChange: {
      const paths = readEdits(item).map((edit) => edit.path)
      if (paths.length === 0) return "file change"
      return paths.length === 1 ? shortenPath(paths[0]!) : `${paths.length} files`
    }
    case CodexItemType.WebSearch: {
      const query = asString(item.query)
      return query === null || query === "" ? "web search" : query
    }
    case CodexItemType.CollabToolCall:
      return asString(item.tool) ?? "spawn agent"
    case CodexItemType.McpToolCall:
      return asString(item.tool) ?? "mcp tool"
    default:
      return itemType
  }
}

/** Reads `file_change.changes[]` into the shared edit shape. */
function readEdits(item: Record<string, JsonValue>): readonly FileEdit[] {
  const edits: FileEdit[] = []
  for (const entry of asArray(item.changes)) {
    const change = asRecord(entry)
    const path = asString(change.path)
    if (path === null) continue
    edits.push({
      path,
      change: codexFileChange(asString(change.kind)),
      // Codex publishes which files changed and how, not the text of the
      // change; a consumer wanting a diff reads the file itself.
      unifiedDiff: asString(change.diff),
    })
  }
  return edits
}

/**
 * A call's arguments, as arguments.
 *
 * The item also carries its id, status and output; those describe the call's
 * lifecycle rather than what it was asked to do, and a drawer that prints them
 * as "input" is showing plumbing.
 */
function callInput(itemType: string, item: Record<string, JsonValue>): JsonValue {
  switch (itemType) {
    case CodexItemType.CommandExecution:
      return { command: item.command ?? null, cwd: item.cwd ?? null }
    case CodexItemType.FileChange:
      return { changes: item.changes ?? [] }
    case CodexItemType.WebSearch:
      return { query: item.query ?? null }
    case CodexItemType.CollabToolCall:
      return { tool: item.tool ?? null, prompt: item.prompt ?? null }
    case CodexItemType.McpToolCall:
      return { tool: item.tool ?? null, server: item.server ?? null }
    default:
      return {}
  }
}

/** Reads `todo_list.items[]` into plan steps. */
function readPlan(item: Record<string, JsonValue>): readonly PlanStep[] {
  const steps: PlanStep[] = []
  for (const entry of asArray(item.items)) {
    const todo = asRecord(entry)
    const content = asString(todo.text)
    if (content === null) continue
    steps.push({
      // Codex identifies a step by position in a republished list, so there is
      // no id to carry — and none is needed: the whole list arrives each time.
      id: null,
      content,
      status: codexPlanStatus(asBoolean(todo.completed) === true),
    })
  }
  return steps
}

/**
 * What an item handed back.
 *
 * Richer than Claude's tool results, which are flat text: a command reports its
 * own exit code, so failure is a fact rather than something inferred from
 * prose.
 */
function readResult(itemType: string, item: Record<string, JsonValue>): ToolResult {
  const status = asString(item.status)
  const exitCode = asNumber(item.exit_code)
  const failed = status === CodexItemStatus.Failed || (exitCode !== null && exitCode !== 0)

  // `structured` is the result's own extra detail, not the whole line — the
  // envelope's `raw` already keeps that, and duplicating it here makes tool
  // drawers print lifecycle plumbing as if it were output.
  if (itemType === CodexItemType.CommandExecution) {
    return {
      text: asString(item.aggregated_output) ?? "",
      isError: failed,
      structured: exitCode === null ? null : { exit_code: exitCode },
      images: [],
    }
  }
  if (itemType === CodexItemType.FileChange) {
    const edits = readEdits(item)
    return {
      text: edits.map((edit) => `${edit.change} ${edit.path}`).join("\n"),
      isError: failed,
      structured: { changes: item.changes ?? [] },
      images: [],
    }
  }
  if (itemType === CodexItemType.WebSearch) {
    // The wire reports no results for a search — only what was searched, and
    // only on completion (the started item's `query` is empty). That is not
    // output, so it stays out of `text` and goes where a drawer can show it.
    return { text: "", isError: failed, structured: { query: item.query ?? null }, images: [] }
  }
  return { text: "", isError: failed, structured: null, images: [] }
}

function normalizeUsage(usage: JsonValue | undefined): Usage | null {
  const fields = asObject(usage)
  if (fields === null) return null
  const input = asNumber(fields.input_tokens)
  const output = asNumber(fields.output_tokens)
  const cached = asNumber(fields.cached_input_tokens)
  // Reported separately here, and folded into output by Claude. Counted in the
  // total because Codex's `output_tokens` excludes it — a total without it
  // understates what the turn cost.
  const reasoning = asNumber(fields.reasoning_output_tokens)
  const counters = [input, output, reasoning].filter((count): count is number => count !== null)
  return {
    totalTokens: counters.length === 0 ? null : counters.reduce((sum, count) => sum + count, 0),
    inputTokens: input,
    outputTokens: output,
    // Codex reports one cached figure where Anthropic splits read from
    // creation; it is a read, and the creation side stays unknown rather than
    // becoming a zero nobody reported.
    cacheReadTokens: cached,
    cacheCreationTokens: null,
    reasoningTokens: reasoning,
  }
}

/**
 * Maps one Codex thread's stdout into normalized events.
 *
 * Far less stateful than the Claude mapper, because the wire is: items carry
 * their own ids and arrive whole, so there is no block index to derive and no
 * preview to join. What remains is the sequence, the thread's identity, and
 * which items are open.
 */
export class CodexStreamMapper implements AgentStreamMapper {
  private seq: number
  private threadId: string | null = null
  private session: SessionInfo | null = null
  /** How many `thread.started` lines this mapper has seen, for `SessionInfo.initIndex`. */
  private threadStarts = 0
  /**
   * Which spawn call owns each receiver thread.
   *
   * A delegated run is addressed by the thread it runs in, not by the call that
   * mentions it: `spawn_agent` starts it and a later `wait` reports its result,
   * and both are separate items. Without this the two become two runs for one
   * agent — the second labelled "wait", with no prompt and no output.
   */
  private readonly spawnOfThread = new Map<string, string>()

  constructor(options: MapperOptions = {}) {
    this.seq = options.startSeq ?? 0
  }

  /** Decodes and maps one line. An unreadable line becomes a single `error` event rather than nothing. */
  push(line: string): readonly AgentEvent[] {
    const parsed = parseCodexLine(line)
    if (!parsed.ok) {
      return [
        this.build({ type: "error", message: `unreadable line: ${parsed.reason}` }, [], { line: parsed.line }),
      ]
    }
    return this.map(parsed.line)
  }

  /** Maps an already-decoded line. */
  map(event: CodexRawLine): readonly AgentEvent[] {
    const raw = event as JsonValue
    const line = asRecord(raw)
    const type = asString(line.type) ?? "unknown"

    switch (type) {
      case CodexWireType.ThreadStarted: {
        const threadId = asString(line.thread_id)
        if (threadId === null) return []
        this.threadId = threadId
        // `thread.started` carries an id and nothing else — no model, no cwd,
        // no tool list. Those stay null rather than becoming "unknown": a
        // placeholder on screen states something the wire never did, and the
        // capability answers live on the app-server instead.
        const session: SessionInfo = {
          sessionId: threadId,
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
          initIndex: this.threadStarts,
        }
        this.threadStarts += 1
        this.session = session
        return [this.build({ type: "session_started", session }, [], raw)]
      }

      // A bare marker: the turn's own events already say everything it does.
      case CodexWireType.TurnStarted:
        return []

      case CodexWireType.TurnCompleted:
      case CodexWireType.TurnFailed:
        return [
          this.build(
            {
              type: "turn_completed",
              status: type === CodexWireType.TurnFailed ? "error" : "completed",
              stopReason: null,
              terminalReason: asString(asRecord(line.error).message),
              // Codex sends no final-answer field; the last agent_message is
              // the answer, and the fold already falls back to it.
              finalText: null,
              usage: normalizeUsage(line.usage),
              durationMs: asNumber(line.duration_ms),
              numTurns: null,
              permissionDenials: [],
            },
            [],
            raw,
          ),
        ]

      case CodexWireType.ItemStarted:
      case CodexWireType.ItemUpdated:
      case CodexWireType.ItemCompleted:
        return this.mapItem(type, asRecord(line.item), raw)

      case CodexWireType.Error:
        return [this.build({ type: "error", message: asString(line.message) ?? "unknown error" }, [], raw)]

      default:
        return [this.build({ type: "unknown", wireType: type, subtype: null }, [], raw)]
    }
  }

  private mapItem(lineType: string, item: Record<string, JsonValue>, raw: JsonValue): readonly AgentEvent[] {
    const itemType = asString(item.type)
    const id = asString(item.id)
    if (itemType === null || id === null) {
      return [this.build({ type: "unknown", wireType: lineType, subtype: itemType }, [], raw)]
    }

    // The table is the authority on what a line kind produces, so it is
    // consulted for every kind rather than only for the ones the switch below
    // does not name — otherwise a kind the table has never heard of is handled
    // anyway and the table's word means nothing.
    if (codexMappingFor(`${lineType}/${itemType}`) === null) {
      return [this.build({ type: "unknown", wireType: lineType, subtype: itemType }, [], raw)]
    }

    const completed = lineType === CodexWireType.ItemCompleted
    const updated = lineType === CodexWireType.ItemUpdated
    const events: AgentEvent[] = []

    switch (itemType) {
      // ---------- conversation: reported whole, on completion ----------
      case CodexItemType.AgentMessage:
        if (!completed) return []
        return [this.build({ type: "assistant_text", text: asString(item.text) ?? "", block: null }, [], raw)]

      // An item that *is* the failure. Without this it fell through to the
      // tool-call default and settled as a successful call with no text, so a
      // failed turn read as a silent one.
      case CodexItemType.Error:
        if (!completed) return []
        return [this.build({ type: "error", message: asString(item.message) ?? "error" }, [], raw)]

      case CodexItemType.Reasoning:
        if (!completed) return []
        return [this.build({ type: "reasoning", text: asString(item.text) ?? "", block: null }, [], raw)]

      // ---------- the plan, republished whole every time ----------
      case CodexItemType.TodoList:
        return [this.build({ type: "plan_updated", steps: readPlan(item) }, [], raw)]

      // ---------- everything else is a call that opens and settles ----------
      default: {
        // A live update on a spawned agent closes the run when its state turns
        // terminal; every other update reports nothing the completion will not.
        if (updated) {
          return itemType === CodexItemType.CollabToolCall ? this.mapCollabCompletion(id, item, raw) : []
        }

        if (!completed) {
          events.push(
            this.build(
              {
                type: "tool_call_started",
                callId: id,
                name: itemType,
                kind: codexToolKind(itemType),
                input: callInput(itemType, item),
                title: itemTitle(itemType, item),
              },
              [],
              raw,
            ),
          )
          // A spawn is a run as well as a call, and the run's own work never
          // reaches this stream — the receiver thread is where it lives. Other
          // collab tools (`wait`) act on a run that already exists, so they
          // are a call and nothing more.
          if (itemType === CodexItemType.CollabToolCall && asString(item.tool) === CODEX_SPAWN_TOOL) {
            events.push(
              this.build(
                {
                  type: "task_started",
                  taskId: id,
                  callId: id,
                  taskKind: CODEX_TASK_KIND,
                  label: asString(item.tool),
                  description: asString(item.prompt) ?? "",
                  prompt: asString(item.prompt),
                  // Codex names the receiver thread but exposes no way to read
                  // it, so there is no transcript to point a consumer at.
                  transcriptId: null,
                },
                [],
                raw,
              ),
            )
          }
          return events
        }

        events.push(
          this.build({ type: "tool_call_completed", callId: id, result: readResult(itemType, item) }, [], raw),
        )

        if (itemType === CodexItemType.FileChange) {
          events.push(this.build({ type: "file_edits", callId: id, edits: readEdits(item) }, [], raw))
        }
        if (itemType === CodexItemType.CollabToolCall) {
          events.push(...this.mapCollabCompletion(id, item, raw))
        }
        return events
      }
    }
  }

  /**
   * What a settled collab call says about the runs it touches.
   *
   * `agents_states` is the only place a spawned agent's outcome appears on this
   * stream — a `wait` completing carries the agent's own final text there. It
   * is reported against the run the spawn opened, so one agent stays one run.
   */
  private mapCollabCompletion(
    id: string,
    item: Record<string, JsonValue>,
    raw: JsonValue,
  ): readonly AgentEvent[] {
    const isSpawn = asString(item.tool) === CODEX_SPAWN_TOOL
    if (isSpawn) {
      for (const thread of asStrings(item.receiver_thread_ids)) this.spawnOfThread.set(thread, id)
    }

    const states = asRecord(item.agents_states)
    const events: AgentEvent[] = []
    for (const [thread, value] of Object.entries(states)) {
      const state = asRecord(value)
      const status = asString(state.status) ?? "unknown"
      // A run reported as still starting is not a completion; only a terminal
      // state closes it, and the message is what it produced.
      if (status === "pending_init" || status === "in_progress") continue
      events.push(
        this.build(
          {
            type: "task_completed",
            taskId: this.spawnOfThread.get(thread) ?? thread,
            callId: this.spawnOfThread.get(thread) ?? null,
            status,
            summary: asString(state.message),
            usage: null,
          },
          [],
          raw,
        ),
      )
    }

    // A spawn that named threads but reported no state yet has still opened the
    // run; nothing to close, so nothing is emitted.
    return events
  }

  private build(payload: AgentEventPayload, path: AgentPath, raw: JsonValue): AgentEvent {
    const seq = this.seq
    this.seq += 1
    const sessionId = this.threadId ?? this.session?.sessionId ?? "unknown"
    return { id: `${sessionId}:${seq}`, sessionId, seq, ts: null, agentPath: path, payload, raw }
  }
}

/** Maps a whole capture in one pass, for a persisted log or a fixture. */
export function mapCodexStream(text: string, options?: MapperOptions): readonly AgentEvent[] {
  const mapper = new CodexStreamMapper(options)
  const events: AgentEvent[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    events.push(...mapper.push(line))
  }
  return events
}
