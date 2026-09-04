/** @responsibility Proves the OpenAI Agents SDK adapter against observed and documented event shapes. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { AgentEventType } from "./events"
import { OpenAIAgentsMapper, mapOpenAIAgentsStream } from "./openai/agents/mapper"
import { OPENAI_AGENTS_EVENT_MAPPING, openAIAgentsWireKind } from "./openai/agents/mapping"
import { parseOpenAIAgentsLines } from "./openai/agents/wire"
import { buildTranscript } from "./transcript/fold"
import { transportOf } from "./transports"

const FIXTURES = fileURLToPath(new URL("../../../apps/storybook/stories/fixtures/agent-stream/openai-agents/", import.meta.url))
const capture = (name: string) => readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")

test("the SDK tool loop preserves calls, results, deltas, committed text, and aggregate usage", () => {
  const events = mapOpenAIAgentsStream(capture("tools"), { sessionId: "run-1", model: "gpt-test" })
  const transcript = buildTranscript(events)
  assert.equal(transcript.session?.sessionId, "run-1")
  assert.equal(transcript.turns[0]?.finalText, "Sunny")
  assert.equal(transcript.usage?.totalTokens, 0)
  const call = events.find((event) => event.payload.type === AgentEventType.ToolCallStarted)
  assert.equal(call?.payload.type === "tool_call_started" ? call.payload.callId : null, "call_1")
  assert.equal(transcript.resultByCallId.get("call_1")?.isError, false)
})

test("usage accumulates across every model request in one agent run", () => {
  const mapper = new OpenAIAgentsMapper({ sessionId: "usage-run" })
  mapper.push('{"data":{"type":"response_started"},"type":"raw_model_stream_event"}')
  mapper.push('{"data":{"type":"response_done","response":{"usage":{"inputTokens":2,"outputTokens":3,"totalTokens":5}}},"type":"raw_model_stream_event"}')
  mapper.push('{"data":{"type":"response_done","response":{"usage":{"inputTokens":7,"outputTokens":11,"totalTokens":18}}},"type":"raw_model_stream_event"}')
  const terminal = mapper.finish()[0]
  assert.equal(terminal?.payload.type === "turn_completed" ? terminal.payload.usage?.totalTokens : null, 23)
})

test("usage detail arrays preserve cached, written, and reasoning tokens", () => {
  const mapper = new OpenAIAgentsMapper({ sessionId: "detail-run" })
  mapper.push('{"data":{"type":"response_started"},"type":"raw_model_stream_event"}')
  mapper.push('{"data":{"type":"response_done","response":{"usage":{"inputTokens":10,"outputTokens":8,"totalTokens":18,"inputTokensDetails":[{"cachedTokens":3},{"cache_write_tokens":2}],"outputTokensDetails":[{"reasoningTokens":4}]}}},"type":"raw_model_stream_event"}')
  const terminal = mapper.finish()[0]
  const usage = terminal?.payload.type === "turn_completed" ? terminal.payload.usage : null
  assert.equal(usage?.cacheReadTokens, 3)
  assert.equal(usage?.cacheCreationTokens, 2)
  assert.equal(usage?.reasoningTokens, 4)
})

test("shell, computer, and patch calls preserve type-specific input", () => {
  const cases = [
    ["shell_call", { commands: ["pwd"] }],
    ["computer_call", { type: "click", x: 1, y: 2 }],
    ["apply_patch_call", { type: "update_file", path: "a.txt" }],
  ] as const
  for (const [type, input] of cases) {
    const mapper = new OpenAIAgentsMapper({ sessionId: type })
    mapper.push('{"data":{"type":"response_started"},"type":"raw_model_stream_event"}')
    const field = type === "apply_patch_call" ? "operation" : "action"
    const events = mapper.push(JSON.stringify({ type: "run_item_stream_event", name: "tool_called", item: { type: "tool_call_item", rawItem: { type, callId: `${type}-1`, name: type, [field]: input }, agent: { name: "Agent" } } }))
    const started = events.find((event) => event.payload.type === AgentEventType.ToolCallStarted)
    assert.deepEqual(started?.payload.type === "tool_call_started" ? started.payload.input : null, input)
  }
})

test("a failure before the first model event still opens and closes the host-owned run", () => {
  const mapper = new OpenAIAgentsMapper({ sessionId: "guardrail-run" })
  const events = mapper.finish({ status: "error", error: "input guardrail tripped" })
  assert.deepEqual(events.map((event) => event.payload.type), [AgentEventType.SessionStarted, AgentEventType.TurnCompleted])
  assert.equal(events[1]?.payload.type === "turn_completed" ? events[1].payload.terminalReason : null, "input guardrail tripped")
})

test("handoffs, active-agent changes, approvals, and compaction survive normalization", () => {
  const events = mapOpenAIAgentsStream(capture("control"), { sessionId: "run-2" }, { status: "interrupted" })
  assert.equal(events.some((event) => event.payload.type === AgentEventType.TaskStarted), false)
  assert.equal(events.some((event) => event.payload.type === AgentEventType.TaskCompleted), false)
  assert.ok(events.some((event) => event.payload.type === AgentEventType.ToolCallStarted))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.ToolCallCompleted))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.PermissionRequested))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.ContextCompacted))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.StatusChanged))
  const terminal = events.find((event) => event.payload.type === AgentEventType.TurnCompleted)
  assert.equal(terminal?.payload.type === "turn_completed" ? terminal.payload.status : null, "interrupted")
  assert.equal(events.filter((event) => event.payload.type === AgentEventType.PermissionRequested).length, 1)
})

test("every captured high-level item kind is declared", () => {
  for (const name of ["tools", "agent-tool", "control"]) {
    for (const parsed of parseOpenAIAgentsLines(capture(name))) {
      assert.equal(parsed.ok, true)
      if (!parsed.ok) continue
      const kind = openAIAgentsWireKind(parsed.line)
      assert.ok(OPENAI_AGENTS_EVENT_MAPPING[kind] !== undefined, `${kind} is not declared`)
    }
  }
})

test("captured emissions never exceed what the mapping table declares", () => {
  for (const name of ["tools", "agent-tool", "control"]) {
    const mapper = new OpenAIAgentsMapper({ sessionId: name, agentToolNames: name === "agent-tool" ? ["research_agent"] : [] })
    for (const parsed of parseOpenAIAgentsLines(capture(name))) {
      if (!parsed.ok) continue
      const declared = new Set(OPENAI_AGENTS_EVENT_MAPPING[openAIAgentsWireKind(parsed.line)]!.emits)
      for (const event of mapper.map(parsed.line)) {
        assert.ok(declared.has(event.payload.type as never), `${name} emitted undeclared ${event.payload.type}`)
      }
    }
  }
})

test("finish is explicit because the SDK iterator has no run-completed event", () => {
  const mapper = new OpenAIAgentsMapper({ sessionId: "run-3" })
  mapper.push('{"data":{"type":"response_started"},"type":"raw_model_stream_event"}')
  const finished = mapper.finish({ status: "interrupted" })
  assert.equal(finished[0]?.payload.type, AgentEventType.TurnCompleted)
  assert.equal(finished[0]?.payload.type === "turn_completed" ? finished[0].payload.status : null, "interrupted")
  assert.deepEqual(mapper.finish(), [])
})

test("agent-as-tool calls become delegated runs when the host names them", () => {
  const events = mapOpenAIAgentsStream(capture("agent-tool"), { sessionId: "run-4", agentToolNames: ["research_agent"] })
  assert.ok(events.some((event) => event.payload.type === AgentEventType.TaskStarted))
  assert.ok(events.some((event) => event.payload.type === AgentEventType.TaskCompleted))
  const started = events.find((event) => event.payload.type === AgentEventType.TaskStarted)
  assert.equal(started?.payload.type === "task_started" ? started.payload.label : null, "research_agent")
  assert.equal(buildTranscript(events).runs[0]?.label, "research_agent")
})

test("a tool whose name merely contains agent is not guessed to be a subagent", () => {
  const events = mapOpenAIAgentsStream(capture("tools").replaceAll("lookup", "agent_directory"), { sessionId: "run-5" })
  assert.equal(events.some((event) => event.payload.type === AgentEventType.TaskStarted), false)
})

test("unknown SDK additions remain visible", () => {
  const mapper = new OpenAIAgentsMapper()
  const events = mapper.push('{"type":"a_future_sdk_event"}')
  assert.equal(events.at(-1)?.payload.type, AgentEventType.Unknown)
})

test("the transport inventory describes the Agents SDK rather than the raw Responses API", () => {
  const transport = transportOf("openai", "agents-sdk")
  assert.equal(transport?.supports.streaming, true)
  assert.equal(transport?.supports.approvals, true)
  assert.equal(transport?.supports.namesModel, false)
})
