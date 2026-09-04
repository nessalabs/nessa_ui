/** @responsibility Proves the two Claude SDK adapters against real captures rather than remembered field names. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { ClaudeAgentSdkMapper, mapAgentSdkMessages } from "./claude/agent-sdk/index"
import { ClaudeMessagesMapper, mapClaudeMessagesStream } from "./claude/messages/mapper"
import { CLAUDE_MESSAGES_EVENT_MAPPING, messagesMappingFor, messagesWireKind } from "./claude/messages/mapping"
import { MessagesBlockType, MessagesFrameType, parseWireLines } from "./claude/messages/wire"
import { AgentEventType } from "./events"
import type { AgentEvent } from "./events"
import { buildTranscript } from "./transcript/fold"
import { transportOf } from "./transports"
import type { WireEvent } from "./claude/messages/wire"

const FIXTURES = fileURLToPath(new URL("../../../apps/storybook/stories/fixtures/agent-stream/", import.meta.url))
const messagesCapture = (name: string) => readFileSync(`${FIXTURES}claude-messages/${name}.jsonl`, "utf8")
const agentSdkCapture = (name: string) => readFileSync(`${FIXTURES}claude-agent-sdk/${name}.jsonl`, "utf8")

const MESSAGES_CAPTURES = [
  "text",
  "thinking",
  "tools",
  "parallel",
  "search",
  "eager",
  "structured",
  "image",
  "truncated",
  "failing",
]

const AGENT_SDK_CAPTURES = [
  "printed",
  "tools",
  "todos",
  "subagent",
  "workflow",
  "phases",
  "failing",
  "websearch",
  "approval-allow",
  "approval-deny",
  "resume",
]

/** Parsed lines of a capture, as objects, the way a live host already has them. */
function messagesOf(text: string): readonly Record<string, unknown>[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

function payloads(events: readonly AgentEvent[], type: string): readonly AgentEvent[] {
  return events.filter((event) => event.payload.type === type)
}

/**
 * The `turn_completed` payload of a folded turn.
 *
 * A `Turn` holds the terminating *event*, not flattened fields, so the stop
 * reason and the refusal list are read back off its payload.
 */
function completionOf(turn: { readonly completed: AgentEvent | null } | undefined) {
  const payload = turn?.completed?.payload
  return payload?.type === "turn_completed" ? payload : null
}

// ---------------------------------------------------------------- Agent SDK

/**
 * The load-bearing claim of the Agent SDK adapter.
 *
 * It delegates to `ClaudeStreamMapper` instead of reimplementing it, and that
 * is only defensible if the wire really is the same one. An unknown or error
 * event anywhere in these captures would mean it is not.
 */
test("the Agent SDK stream is Claude Code's wire, mapped with no unknown or error events", () => {
  for (const name of AGENT_SDK_CAPTURES) {
    const events = mapAgentSdkMessages(messagesOf(agentSdkCapture(name)))
    assert.ok(events.length > 0, `${name} produced no events`)
    assert.deepEqual(
      payloads(events, AgentEventType.Unknown).map((event) => event.raw),
      [],
      `${name} produced unknown events`,
    )
    assert.deepEqual(
      payloads(events, AgentEventType.Error).map((event) => event.payload),
      [],
      `${name} produced error events`,
    )
    assert.ok(
      events.some((event) => event.payload.type === AgentEventType.SessionStarted),
      `${name} never announced a session`,
    )
  }
})

test("delegated work survives the SDK exactly as it does the CLI", () => {
  const events = mapAgentSdkMessages(messagesOf(agentSdkCapture("subagent")))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.TaskStarted))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.TaskProgress))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.TaskCompleted))
})

/**
 * The scenario matrix is the claim that the SDK is the CLI's wire, tested.
 *
 * A transport whose captures only ever exercise text and one tool proves very
 * little; these are the shapes that would break first if the two ever diverge.
 */
test("plans, workflows and model swaps all survive the SDK", () => {
  const plan = mapAgentSdkMessages(messagesOf(agentSdkCapture("todos")))
  assert.ok(
    plan.some((event) => event.payload.type === AgentEventType.PlanUpdated),
    "the plan tools produced no checklist",
  )

  for (const name of ["workflow", "phases"]) {
    const events = mapAgentSdkMessages(messagesOf(agentSdkCapture(name)))
    assert.ok(
      events.some((event) => event.payload.type === AgentEventType.WorkflowProgress),
      `${name} produced no workflow board`,
    )
    assert.ok(events.some((event) => event.payload.type === AgentEventType.TaskCompleted), name)
  }

  // Two `query()` calls sharing a session id, the second on Haiku. A model
  // change is derived from the second init and exists nowhere else.
  const resumed = mapAgentSdkMessages(messagesOf(agentSdkCapture("resume")))
  const swap = resumed.find((event) => event.payload.type === AgentEventType.ModelChanged)
  assert.ok(swap?.payload.type === "model_changed")
  assert.notEqual(swap.payload.from, swap.payload.to)
})

test("an allowed call runs where a refused one does not", () => {
  const allowed = mapAgentSdkMessages(messagesOf(agentSdkCapture("approval-allow")))
  const transcript = buildTranscript(allowed)
  assert.deepEqual(completionOf(transcript.turns.at(-1))?.permissionDenials, [])
  assert.ok(
    [...transcript.resultByCallId.values()].some((result) => !result.isError),
    "the allowed call never produced a successful result",
  )
})

/**
 * The one place the SDK genuinely differs, and it is not a parsing difference.
 *
 * `canUseTool` is answered in-process, so no permission line is ever written to
 * the stream. The refusal is still recoverable — as a failed tool result, and
 * on the turn's own `permission_denials` — and a surface that waited for a
 * `permission_requested` event here would wait forever.
 */
test("an in-process approval never reaches the stream, but its refusal is still recoverable", () => {
  const events = mapAgentSdkMessages(messagesOf(agentSdkCapture("approval-deny")))

  assert.deepEqual(payloads(events, AgentEventType.PermissionRequested), [])
  assert.deepEqual(payloads(events, AgentEventType.PermissionDenied), [])

  const transcript = buildTranscript(events)
  const denials = completionOf(transcript.turns.at(-1))?.permissionDenials ?? []
  assert.equal(denials.length, 2, "the result line's permission_denials were lost")
  assert.equal(denials[0]?.toolName, "Bash")

  const failed = [...transcript.resultByCallId.values()].filter((result) => result.isError)
  assert.ok(failed.length > 0, "a refused call should still show as a failed tool result")
})

test("the object seam and the line seam agree", () => {
  const text = agentSdkCapture("tools")
  const viaObjects = mapAgentSdkMessages(messagesOf(text))

  const mapper = new ClaudeAgentSdkMapper()
  const viaLines: AgentEvent[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    viaLines.push(...mapper.push(line))
  }

  assert.deepEqual(
    viaLines.map((event) => event.payload),
    viaObjects.map((event) => event.payload),
  )
})

test("the Agent SDK transport records that approvals do not reach its stream", () => {
  const transport = transportOf("claude", "agent-sdk")
  assert.equal(transport?.supports.approvals, false)
  assert.equal(transport?.supports.streaming, true)
})

// -------------------------------------------------------------- Messages API

test("every frame in every capture has a mapping row", () => {
  for (const name of MESSAGES_CAPTURES) {
    let openBlockType: string | null = null
    for (const result of parseWireLines(messagesCapture(name))) {
      assert.ok(result.ok, `${name} had an undecodable line`)
      const frame = result.line as WireEvent
      if (frame.type === MessagesFrameType.ContentBlockStart) {
        openBlockType = (frame as { content_block?: { type?: string } }).content_block?.type ?? null
      }
      const kind = messagesWireKind(frame, openBlockType)
      assert.ok(messagesMappingFor(kind) !== null, `${name}: no mapping row for ${kind}`)
    }
  }
})

test("the mapping table promises exactly what the mapper emits", () => {
  for (const name of MESSAGES_CAPTURES) {
    const text = messagesCapture(name)
    const mapper = new ClaudeMessagesMapper()
    let openBlockType: string | null = null

    for (const result of parseWireLines(text)) {
      assert.ok(result.ok)
      const frame = result.line as WireEvent
      if (frame.type === MessagesFrameType.ContentBlockStart) {
        openBlockType = (frame as { content_block?: { type?: string } }).content_block?.type ?? null
      }
      const kind = messagesWireKind(frame, openBlockType)
      const promised = CLAUDE_MESSAGES_EVENT_MAPPING[kind]
      assert.ok(promised, `${name}: no mapping row for ${kind}`)

      const emitted = mapper.map(frame).map((event) => event.payload.type)
      for (const type of emitted) {
        assert.ok(
          promised.emits.includes(type as never),
          `${name}: ${kind} emitted ${type}, which its mapping row does not promise`,
        )
      }
    }
  }
})

test("no capture produces an unknown or error event", () => {
  for (const name of MESSAGES_CAPTURES) {
    const events = mapClaudeMessagesStream(messagesCapture(name))
    assert.deepEqual(payloads(events, AgentEventType.Unknown).map((event) => event.raw), [], name)
    assert.deepEqual(payloads(events, AgentEventType.Error).map((event) => event.payload), [], name)
  }
})

test("a plain turn yields committed text, a stop reason, and merged usage", () => {
  const events = mapClaudeMessagesStream(messagesCapture("text"), { sessionId: "run-1" })
  const transcript = buildTranscript(events)

  assert.equal(transcript.session?.sessionId, "run-1")
  assert.equal(transcript.session?.model, "claude-opus-5")

  const turn = transcript.turns.at(-1)
  assert.equal(completionOf(turn)?.stopReason, "end_turn")
  assert.ok((turn?.finalText ?? "").includes("JSON"))

  // Merged across message_start and message_delta: the first frame knows the
  // input side, the last knows the real output count.
  assert.ok((turn?.usage?.inputTokens ?? 0) > 0, "input tokens were lost")
  assert.ok((turn?.usage?.outputTokens ?? 0) > 1, "output tokens came from message_start's placeholder")
})

/**
 * Reasoning tokens are the one figure this wire reports that Claude Code's does
 * not, so a null here would be a regression to the weaker source.
 */
test("thinking is committed as reasoning, and its tokens are reported rather than nulled", () => {
  const events = mapClaudeMessagesStream(messagesCapture("thinking"))
  const reasoning = payloads(events, AgentEventType.Reasoning)
  assert.equal(reasoning.length, 1)
  assert.ok(
    reasoning[0]?.payload.type === "reasoning" && reasoning[0].payload.text.length > 0,
    "the thinking block committed no text",
  )

  const turn = buildTranscript(events).turns.at(-1)
  assert.ok((turn?.usage?.reasoningTokens ?? 0) > 0, "thinking tokens were not reported")
})

/** A signature is base64 for replay, not prose. Appending it to the block would put it on screen. */
test("a signature delta contributes nothing to the reasoning text", () => {
  const events = mapClaudeMessagesStream(messagesCapture("thinking"))
  const reasoning = payloads(events, AgentEventType.Reasoning)[0]
  const text = reasoning?.payload.type === "reasoning" ? reasoning.payload.text : ""
  assert.ok(!text.includes("CAIS"), "the thinking signature leaked into the rendered text")
})

/**
 * A tool call is only whole at `content_block_stop`: its arguments arrive as
 * fragments that are individually unparseable.
 */
test("a tool call is emitted once, with its arguments joined", () => {
  const events = mapClaudeMessagesStream(messagesCapture("tools"))
  const calls = payloads(events, AgentEventType.ToolCallStarted)
  assert.equal(calls.length, 1)

  const call = calls[0]
  assert.ok(call?.payload.type === "tool_call_started")
  assert.equal(call.payload.name, "get_weather")
  assert.deepEqual((call.payload.input as { city?: string }).city, "Oslo")
  assert.ok(call.payload.callId.startsWith("toolu_"))
})

test("two calls in one message keep their own ids and arguments", () => {
  const events = mapClaudeMessagesStream(messagesCapture("parallel"))
  const calls = payloads(events, AgentEventType.ToolCallStarted)
  assert.equal(calls.length, 2)

  const ids = new Set(calls.map((event) => (event.payload.type === "tool_call_started" ? event.payload.callId : "")))
  assert.equal(ids.size, 2, "two calls collapsed onto one id")

  const names = calls.map((event) => (event.payload.type === "tool_call_started" ? event.payload.name : ""))
  assert.deepEqual([...names].sort(), ["get_time", "get_weather"])
})

/**
 * The decision that keeps one turn from being reported as several.
 *
 * A `tool_use` stop is the model handing control to the host mid-turn, not the
 * end of anything.
 */
test("a tool_use stop does not end the turn", () => {
  const events = mapClaudeMessagesStream(messagesCapture("eager"))
  assert.deepEqual(payloads(events, AgentEventType.TurnCompleted), [])
  assert.equal(payloads(events, AgentEventType.ToolCallStarted).length, 1)
})

/**
 * `pause_turn` is the same situation as `tool_use`, and was the easier one to
 * get wrong: it is a long-running server-tool flow the host resumes by
 * resending, not an ending. Reporting it as a completed turn would split one
 * turn into as many turns as it paused.
 */
test("a pause_turn stop does not end the turn either", () => {
  const mapper = new ClaudeMessagesMapper()
  mapper.push('{"type":"message_start","message":{"id":"m1","model":"claude-opus-5","role":"assistant"}}')
  const events = mapper.push('{"type":"message_delta","delta":{"stop_reason":"pause_turn"},"usage":{"output_tokens":5}}')
  assert.deepEqual(payloads(events, AgentEventType.TurnCompleted), [])

  // And the ordinary reasons still do end it, so the guard is narrow.
  const ended = mapper.push('{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}')
  assert.equal(payloads(ended, AgentEventType.TurnCompleted).length, 1)
})

/**
 * Without this seam the wire cannot produce a complete transcript: tool results
 * live in the host's next *request*, and never appear on the response stream.
 */
test("a host-supplied tool result completes the call the stream opened", () => {
  const mapper = new ClaudeMessagesMapper({ sessionId: "run-2" })
  const events: AgentEvent[] = []
  for (const line of messagesCapture("tools").split("\n")) {
    if (line.trim().length === 0) continue
    events.push(...mapper.push(line))
  }

  const call = payloads(events, AgentEventType.ToolCallStarted)[0]
  const callId = call?.payload.type === "tool_call_started" ? call.payload.callId : ""

  // Before the host says anything, the call is legitimately unresolved.
  assert.equal(buildTranscript(events).resultByCallId.get(callId), undefined)

  events.push(...mapper.recordToolResult(callId, { content: '{"temperature":4}' }))

  const result = buildTranscript(events).resultByCallId.get(callId)
  assert.equal(result?.isError, false)
  assert.ok(result?.text.includes("temperature"))
})

test("a failed tool result is carried as an error without ending the turn badly", () => {
  const mapper = new ClaudeMessagesMapper()
  const events: AgentEvent[] = []
  let callId = ""

  // Interleaved the way a host actually drives this: the model stops asking
  // for a tool, the host answers, and only then does the next response stream.
  // Appending the result after both messages instead would open a turn the
  // wire never described.
  for (const line of messagesCapture("failing").split("\n")) {
    if (line.trim().length === 0) continue
    const mapped = mapper.push(line)
    events.push(...mapped)

    for (const event of mapped) {
      if (event.payload.type === "tool_call_started") callId = event.payload.callId
    }
    if (JSON.parse(line).type === "message_stop" && callId !== "") {
      events.push(...mapper.recordToolResult(callId, { content: "UnknownCityError", isError: true }))
      callId = ""
    }
  }

  const transcript = buildTranscript(events)
  const failed = [...transcript.resultByCallId.values()].filter((result) => result.isError)
  assert.equal(failed.length, 1, "the failed tool result was lost")

  // The tool failed; the turn did not.
  assert.equal(completionOf(transcript.turns.at(-1))?.status, "completed")
})

/**
 * A server tool is not a call the host executes — no result will ever be sent
 * back for one, so the stream must complete it itself or it hangs forever.
 */
test("server tools complete from the stream itself", () => {
  const events = mapClaudeMessagesStream(messagesCapture("search"))
  const started = payloads(events, AgentEventType.ToolCallStarted)
  const completed = payloads(events, AgentEventType.ToolCallCompleted)

  assert.ok(started.length > 0)
  assert.equal(completed.length, started.length, "a server tool call was left pending")

  const transcript = buildTranscript(events)
  for (const event of started) {
    const callId = event.payload.type === "tool_call_started" ? event.payload.callId : ""
    assert.ok(transcript.resultByCallId.has(callId), `${callId} never resolved`)
  }
})

test("a truncated turn reports why it stopped", () => {
  const events = mapClaudeMessagesStream(messagesCapture("truncated"))
  assert.equal(completionOf(buildTranscript(events).turns.at(-1))?.stopReason, "max_tokens")
})

test("deltas preview the text that the committed event then supersedes", () => {
  const events = mapClaudeMessagesStream(messagesCapture("text"))
  const joined = events
    .filter((event) => event.payload.type === "delta" && event.payload.delta === "text")
    .map((event) => (event.payload.type === "delta" && event.payload.delta === "text" ? event.payload.text : ""))
    .join("")
  const committed = payloads(events, AgentEventType.AssistantText)[0]
  assert.equal(committed?.payload.type === "assistant_text" ? committed.payload.text : null, joined)
})

test("the sequence resumes where a persisted log left off", () => {
  const events = mapClaudeMessagesStream(messagesCapture("text"), { startSeq: 500 })
  assert.equal(events[0]?.seq, 500)
})

/**
 * The wire has no clock. Stamping one would record when the parser ran, which
 * is not information about the conversation.
 */
test("no event claims a timestamp the wire never sent", () => {
  for (const event of mapClaudeMessagesStream(messagesCapture("tools"))) {
    assert.equal(event.ts, null)
  }
})

test("an unreadable line becomes an error event rather than an exception", () => {
  const mapper = new ClaudeMessagesMapper()
  const events = mapper.push("{not json")
  assert.equal(events.length, 1)
  assert.equal(events[0]?.payload.type, AgentEventType.Error)
})

test("an unmodelled frame is reported as unknown, keeping its raw line", () => {
  const mapper = new ClaudeMessagesMapper()
  const events = mapper.push('{"type":"message_thermostat","degrees":11}')
  assert.equal(events[0]?.payload.type, AgentEventType.Unknown)
  assert.equal(
    events[0]?.payload.type === "unknown" ? events[0].payload.wireType : null,
    "message_thermostat",
  )
})

/**
 * Everything about a session is null or empty here, and that is the honest
 * answer: the tools were in the request, which is not this parser's to read.
 */
test("the Messages API transport advertises nothing, and says so", () => {
  const transport = transportOf("claude", "messages")
  assert.equal(transport?.supports.capabilities, false)
  assert.equal(transport?.supports.approvals, false)
  assert.equal(transport?.supports.namesModel, true)

  const session = mapClaudeMessagesStream(messagesCapture("text"))[0]
  assert.ok(session?.payload.type === "session_started")
  assert.deepEqual(session.payload.session.tools, [])
  assert.equal(session.payload.session.cwd, null)
  assert.equal(session.payload.session.permissionMode, null)
})

test("a block type the mapper models is not silently reclassified", () => {
  // Guards the vocabulary itself: these strings are matched against the wire,
  // so a rename here would silently stop matching real frames.
  assert.equal(MessagesBlockType.ServerToolUse, "server_tool_use")
  assert.equal(MessagesBlockType.ToolUse, "tool_use")
  assert.equal(MessagesFrameType.ContentBlockDelta, "content_block_delta")
})
