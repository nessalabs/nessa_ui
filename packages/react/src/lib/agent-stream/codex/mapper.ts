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
} from "../events"
import { asArray, asBoolean, asNumber, asObject, asRecord, asString, asStrings } from "../json"
import type { JsonValue } from "../json"
import {
  CODEX_TASK_KIND,
  codexFileChange,
  codexMappingFor,
  codexPlanStatus,
  codexToolKind,
} from "./mapping"
import { CodexItemStatus, CodexItemType, CodexWireType, parseCodexLine } from "./wire"
import type { CodexWireEvent } from "./wire"

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

/** Trims a path to its last two segments, which is what identifies a file in a narrow row. */
function shortenPath(path: string): string {
  const parts = path.split("/").filter(Boolean)
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`
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

  if (itemType === CodexItemType.CommandExecution) {
    return { text: asString(item.aggregated_output) ?? "", isError: failed, structured: item as JsonValue, images: [] }
  }
  if (itemType === CodexItemType.FileChange) {
    const edits = readEdits(item)
    return {
      text: edits.map((edit) => `${edit.change} ${edit.path}`).join("\n"),
      isError: failed,
      structured: item as JsonValue,
      images: [],
    }
  }
  return { text: "", isError: failed, structured: item as JsonValue, images: [] }
}

function normalizeUsage(usage: JsonValue | undefined): Usage | null {
  const fields = asObject(usage)
  if (fields === null) return null
  const input = asNumber(fields.input_tokens)
  const output = asNumber(fields.output_tokens)
  const cached = asNumber(fields.cached_input_tokens)
  const counters = [input, output].filter((count): count is number => count !== null)
  return {
    totalTokens: counters.length === 0 ? null : counters.reduce((sum, count) => sum + count, 0),
    inputTokens: input,
    outputTokens: output,
    // Codex reports one cached figure where Anthropic splits read from
    // creation; it is a read, and the creation side stays unknown rather than
    // becoming a zero nobody reported.
    cacheReadTokens: cached,
    cacheCreationTokens: null,
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
  /** Item ids seen open, so a completion can name the kind its start declared. */
  private readonly openItems = new Map<string, string>()

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
    return this.map(parsed.event)
  }

  /** Maps an already-decoded line. */
  map(event: CodexWireEvent): readonly AgentEvent[] {
    const raw = event as unknown as JsonValue
    const line = asRecord(raw)
    const type = asString(line.type) ?? "unknown"

    switch (type) {
      case CodexWireType.ThreadStarted: {
        const threadId = asString(line.thread_id)
        if (threadId === null) return []
        this.threadId = threadId
        const session: SessionInfo = {
          sessionId: threadId,
          model: asString(line.model) ?? "unknown",
          cwd: asString(line.cwd) ?? "",
          tools: asStrings(line.tools),
          slashCommands: [],
          terminalSlashCommands: [],
          agents: [],
          skills: [],
          plugins: [],
          mcpServers: [],
          permissionMode: asString(line.sandbox) ?? "unknown",
          version: asString(line.version) ?? "",
          outputStyle: "",
          initIndex: 0,
        }
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

    const completed = lineType === CodexWireType.ItemCompleted
    const events: AgentEvent[] = []

    switch (itemType) {
      // ---------- conversation: reported whole, on completion ----------
      case CodexItemType.AgentMessage:
        if (!completed) return []
        return [this.build({ type: "assistant_text", text: asString(item.text) ?? "", block: null }, [], raw)]

      case CodexItemType.Reasoning:
        if (!completed) return []
        return [this.build({ type: "reasoning", text: asString(item.text) ?? "", block: null }, [], raw)]

      // ---------- the plan, republished whole every time ----------
      case CodexItemType.TodoList:
        return [this.build({ type: "plan_updated", steps: readPlan(item) }, [], raw)]

      // ---------- everything else is a call that opens and settles ----------
      default: {
        // Only kinds the mapping table declares are treated as calls. An item
        // kind from a later release has an id and a lifecycle, so it *looks*
        // like a call — but inventing one from a shape nobody has seen puts a
        // guess in the transcript. It reaches the log as unknown, with its
        // line attached, and the table stays the authority on what exists.
        if (codexMappingFor(`${lineType}/${itemType}`) === null) {
          return [this.build({ type: "unknown", wireType: lineType, subtype: itemType }, [], raw)]
        }

        if (!completed) {
          this.openItems.set(id, itemType)
          events.push(
            this.build(
              {
                type: "tool_call_started",
                callId: id,
                name: itemType,
                kind: codexToolKind(itemType),
                input: item as JsonValue,
                title: itemTitle(itemType, item),
              },
              [],
              raw,
            ),
          )
          // A spawned agent is a run as well as a call, and its own work never
          // reaches this stream — the receiver thread is where it lives.
          if (itemType === CodexItemType.CollabToolCall) {
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
                },
                [],
                raw,
              ),
            )
          }
          return events
        }

        this.openItems.delete(id)
        events.push(
          this.build({ type: "tool_call_completed", callId: id, result: readResult(itemType, item) }, [], raw),
        )

        if (itemType === CodexItemType.FileChange) {
          events.push(this.build({ type: "file_edits", callId: id, edits: readEdits(item) }, [], raw))
        }
        if (itemType === CodexItemType.CollabToolCall) {
          events.push(
            this.build(
              {
                type: "task_completed",
                taskId: id,
                callId: id,
                status: asString(item.status) ?? "completed",
                // The receiver threads are the run's transcript address; a host
                // reads them from disk, since nothing about them streams here.
                summary: asStrings(item.receiver_thread_ids).join(", ") || null,
                usage: null,
              },
              [],
              raw,
            ),
          )
        }
        return events
      }
    }
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
