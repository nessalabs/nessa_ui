/** @responsibility Proves the Kiro CLI stream-json parser against synthetic captures. */

// TODO(kiro-live): Point these tests at live captures once fixtures are
// retaken; extend NAMES if task/todowrite/extension lines land in fixtures
// and drop the matching KIRO_UNEXERCISED entries.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { AgentEventType } from "./events"
import { buildTranscript, applyDeltas, previewOf } from "./transcript/fold"
import { KIRO_EVENT_MAPPING, kiroMappingFor, kiroWireKind } from "./kiro/chat/mapping"
import { KiroChatMapper, mapKiroChatStream } from "./kiro/chat/mapper"
import { KIRO_CHAT_PROVENANCE, parseKiroLine, parseKiroLines } from "./kiro/chat/wire"
import { transportOf, transportsOf } from "./transports"

const FIXTURES = fileURLToPath(
  new URL("../../../apps/storybook/stories/fixtures/agent-stream/kiro/", import.meta.url),
)

function capture(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

const NAMES = ["printed", "tools", "failing"] as const

// ---------------------------------------------------------------------------
// Wire layer
// ---------------------------------------------------------------------------

test("every captured line decodes without error", () => {
  for (const name of NAMES) {
    for (const result of parseKiroLines(capture(name))) {
      assert.equal(result.ok, true, `${name}: ${result.ok ? "" : result.reason}`)
    }
  }
})

test("a single-line decode returns the same shape as the batch decoder", () => {
  const line = '{"type":"system","subtype":"init","sessionId":"s1","model":"claude-sonnet-4-5","cwd":"/tmp","tools":[],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}'
  const single = parseKiroLine(line)
  const batch = parseKiroLines(line)
  assert.equal(single.ok, true)
  assert.equal(batch.length, 1)
  assert.deepEqual(single, batch[0])
})

test("a malformed line fails gracefully instead of throwing", () => {
  const result = parseKiroLine("{ truncated")
  assert.equal(result.ok, false)
  assert.ok("reason" in result)
})

// ---------------------------------------------------------------------------
// Mapping table
// ---------------------------------------------------------------------------

test("every line kind from kiroWireKind() is present in KIRO_EVENT_MAPPING", () => {
  for (const name of NAMES) {
    for (const result of parseKiroLines(capture(name))) {
      if (!result.ok) continue
      const kind = kiroWireKind(result.line)
      assert.notEqual(
        kiroMappingFor(kind),
        null,
        `${name}: kind "${kind}" is missing from KIRO_EVENT_MAPPING`,
      )
    }
  }
})

test("every row in KIRO_EVENT_MAPPING emits declared AgentEventType values", () => {
  const declared = new Set(Object.values(AgentEventType))
  for (const [kind, entry] of Object.entries(KIRO_EVENT_MAPPING)) {
    for (const type of entry.emits) {
      assert.ok(declared.has(type), `mapping row "${kind}" names undeclared type "${type}"`)
    }
    assert.ok(entry.note.length > 0, `mapping row "${kind}" has an empty note`)
  }
})

test("every captured line kind either emits events or has a documented reason not to", () => {
  const seenKinds = new Set<string>()
  for (const name of NAMES) {
    const mapper = new KiroChatMapper()
    for (const result of parseKiroLines(capture(name))) {
      if (!result.ok) continue
      const kind = kiroWireKind(result.line)
      seenKinds.add(kind)
      const entry = kiroMappingFor(kind)
      assert.notEqual(entry, null, `${name}: kind "${kind}" is not in the table`)
      const produced = mapper.map(result.line)
      const declared = new Set(entry!.emits)
      for (const event of produced) {
        assert.ok(
          declared.has(event.payload.type),
          `${name}: kind "${kind}" emitted undeclared type "${event.payload.type}"`,
        )
      }
    }
  }
  // Every row we exercise should be reachable — a row that cannot be reached
  // from any fixture is either dead weight or needs a dedicated test.
  for (const kind of seenKinds) {
    assert.notEqual(kiroMappingFor(kind), null, `exercised kind "${kind}" not in table`)
  }
})

// ---------------------------------------------------------------------------
// Mapper contract
// ---------------------------------------------------------------------------

test("no capture produces an error event", () => {
  for (const name of NAMES) {
    const bad = mapKiroChatStream(capture(name)).filter((e) => e.payload.type === "error")
    assert.deepEqual(
      bad.map((e) => (e.payload.type === "error" ? e.payload.message : "")),
      [],
      name,
    )
  }
})

test("an unknown subtype survives as unknown rather than being dropped", () => {
  const events = mapKiroChatStream(
    '{"type":"system","subtype":"invented_subtype","sessionId":"s1"}',
  )
  assert.equal(events.length, 1)
  assert.equal(events[0]!.payload.type, "unknown")
  assert.notEqual(events[0]!.raw, null)
})

test("an unknown extension line survives as unknown", () => {
  const events = mapKiroChatStream(
    '{"type":"_kiro.dev/future_feature","sessionId":"s1","data":"x"}',
  )
  assert.equal(events.length, 1)
  assert.equal(events[0]!.payload.type, "unknown")
})

test("a malformed line becomes a single error event, not a crash", () => {
  const mapper = new KiroChatMapper()
  const events = mapper.push("{ not json")
  assert.equal(events.length, 1)
  assert.equal(events[0]!.payload.type, "error")
})

test("a malformed line does not discard the session id seen earlier", () => {
  const events = mapKiroChatStream(
    [
      '{"type":"system","subtype":"init","sessionId":"sess-x","model":"m","cwd":"/tmp","tools":[],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
      "{ broken",
    ].join("\n"),
  )
  const error = events.find((e) => e.payload.type === "error")
  assert.notEqual(error, undefined)
  assert.equal(error!.sessionId, "sess-x")
})

// ---------------------------------------------------------------------------
// Printed fixture: plain text with streaming deltas
// ---------------------------------------------------------------------------

test("printed: a plain turn yields text and a completion", () => {
  const events = mapKiroChatStream(capture("printed"))
  const { turns } = buildTranscript(events)
  // The fold may emit a prologue turn before the user message; find the real one.
  const real = turns.find((t) => t.prompt !== null)
  assert.notEqual(real, undefined, "expected a turn with a user prompt")
  assert.ok(real!.finalText?.includes("hello world"))
  assert.equal(real!.completed?.payload.type, "turn_completed")
})

test("printed: streaming deltas join their committed block", () => {
  const events = mapKiroChatStream(capture("printed"))
  const buffers = applyDeltas(events)
  const committed = events.find((e) => e.payload.type === "assistant_text")
  assert.notEqual(committed, undefined)
  const payload = committed!.payload as { type: "assistant_text"; block: { messageId: string; index: number } | null; text: string }
  assert.notEqual(payload.block, null, "committed text must carry a block ref from the preceding deltas")
  const preview = previewOf(buffers, payload.block)
  assert.equal(preview, payload.text)
})

test("printed: session_started carries the advertised fields", () => {
  const events = mapKiroChatStream(capture("printed"))
  const session = events.find((e) => e.payload.type === "session_started")
  assert.notEqual(session, undefined)
  const s = (session!.payload as { type: "session_started"; session: { sessionId: string; model: string | null; cwd: string | null; tools: readonly string[] } }).session
  assert.equal(s.sessionId, "kiro-sess-01")
  assert.equal(s.model, "claude-sonnet-4-5")
  assert.ok(s.tools.length > 0)
})

test("printed: turn_completed carries usage when the fixture sends it", () => {
  const events = mapKiroChatStream(capture("printed"))
  const turn = events.find((e) => e.payload.type === "turn_completed")
  assert.notEqual(turn, undefined)
  const p = turn!.payload as { type: "turn_completed"; usage: { totalTokens: number | null } | null }
  assert.notEqual(p.usage, null)
  assert.ok((p.usage!.totalTokens ?? 0) > 0)
})

// ---------------------------------------------------------------------------
// Tools fixture: write + bash
// ---------------------------------------------------------------------------

test("tools: tool calls pair with their results", () => {
  const events = mapKiroChatStream(capture("tools"))
  const { resultByCallId, abandonedCallIds } = buildTranscript(events)
  const calls = events.filter((e) => e.payload.type === "tool_call_started")
  assert.ok(calls.length > 0)
  for (const call of calls) {
    const p = call.payload as { callId: string }
    assert.ok(resultByCallId.has(p.callId), `call ${p.callId} has no result`)
  }
  assert.equal(abandonedCallIds.size, 0)
})

test("tools: every tool_call_started has a non-empty title", () => {
  const events = mapKiroChatStream(capture("tools"))
  const calls = events.filter((e) => e.payload.type === "tool_call_started")
  for (const call of calls) {
    const p = call.payload as { title: string; name: string }
    assert.ok(p.title.length > 0, `call "${p.name}" has an empty title`)
  }
})

test("tools: write tool emits file_edits", () => {
  const events = mapKiroChatStream(capture("tools"))
  const edits = events.filter((e) => e.payload.type === "file_edits")
  assert.ok(edits.length > 0, "write tool should produce file_edits")
  for (const edit of edits) {
    const p = edit.payload as { edits: readonly { path: string; change: string }[] }
    assert.ok(p.edits.length > 0)
    assert.ok(p.edits[0]!.path.length > 0)
  }
})

test("tools: bash tool result carries stdout text", () => {
  const events = mapKiroChatStream(capture("tools"))
  const results = events
    .filter((e) => e.payload.type === "tool_call_completed")
    .map((e) => (e.payload as { result: { text: string; isError: boolean } }).result)
  const bash = results.find((r) => r.text.includes("notes.txt"))
  assert.notEqual(bash, undefined, "expected bash stdout in a completed result")
  assert.equal(bash!.isError, false)
})

// ---------------------------------------------------------------------------
// Failing fixture: bash exits non-zero
// ---------------------------------------------------------------------------

test("failing: a failed tool is isError:true and carries stderr", () => {
  const events = mapKiroChatStream(capture("failing"))
  const results = events
    .filter((e) => e.payload.type === "tool_call_completed")
    .map((e) => (e.payload as { result: { text: string; isError: boolean } }).result)
  assert.ok(results.length > 0)
  const failed = results.find((r) => r.isError)
  assert.notEqual(failed, undefined, "expected at least one failed result")
  assert.ok(
    failed!.text.includes("No such file"),
    `expected "No such file" in error text, got: ${failed!.text}`,
  )
})

test("failing: a failed tool does not make the turn status error", () => {
  const events = mapKiroChatStream(capture("failing"))
  const turn = events.find((e) => e.payload.type === "turn_completed")
  assert.notEqual(turn, undefined)
  // The CLI reports the turn completed normally; failing one tool is not a
  // failed run.
  const p = turn!.payload as { status: string }
  assert.equal(p.status, "completed")
})

// ---------------------------------------------------------------------------
// Envelope invariants (all fixtures)
// ---------------------------------------------------------------------------

test("every event satisfies the envelope contract", () => {
  for (const name of NAMES) {
    const events = mapKiroChatStream(capture(name))
    let previous = -1
    for (const event of events) {
      assert.ok(event.id.length > 0, `${name}: empty id`)
      assert.ok(event.sessionId.length > 0, `${name}: empty sessionId`)
      assert.ok(event.seq > previous, `${name}: seq ${event.seq} did not advance past ${previous}`)
      previous = event.seq
      assert.ok(Array.isArray(event.agentPath), `${name}: agentPath must be an array`)
      assert.ok(event.agentPath.every((step) => typeof step === "string" && step.length > 0))
      assert.equal(event.ts, null, `${name}: kiro stream-json carries no timestamps`)
      assert.notEqual(event.raw, null, `${name}: raw must be present for the inspector`)
    }
  }
})

test("sequence numbers are dense starting from zero", () => {
  for (const name of NAMES) {
    const events = mapKiroChatStream(capture(name))
    events.forEach((event, index) => assert.equal(event.seq, index, `${name}: seq gap at index ${index}`))
  }
})

test("startSeq is honoured for session continuation", () => {
  const mapper = new KiroChatMapper({ startSeq: 100 })
  const events = mapper.push(
    '{"type":"system","subtype":"init","sessionId":"s1","model":"m","cwd":"/","tools":[],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
  )
  assert.ok(events.length > 0)
  assert.equal(events[0]!.seq, 100)
})

test("structured payloads carry the fields their consumers switch on", () => {
  for (const name of NAMES) {
    for (const event of mapKiroChatStream(capture(name))) {
      const p = event.payload
      switch (p.type) {
        case "tool_call_started":
          assert.ok(p.callId.length > 0, `${name}: call with no id cannot be paired`)
          assert.ok(p.name.length > 0, `${name}: call with no name`)
          assert.ok(p.title.length > 0, `${name}: call with no title`)
          assert.notEqual(p.input, undefined, `${name}: call with no input`)
          break
        case "tool_call_completed":
          assert.ok(p.callId.length > 0, `${name}: completion with no callId`)
          assert.equal(typeof p.result.isError, "boolean", `${name}: isError must be boolean`)
          assert.equal(typeof p.result.text, "string", `${name}: text must be a string`)
          break
        case "delta":
          assert.ok(p.block.messageId.length > 0, `${name}: delta with no messageId`)
          assert.ok(p.block.index >= 0, `${name}: delta block index must be non-negative`)
          break
        case "session_started":
          assert.ok(p.session.sessionId.length > 0, `${name}: session with no id`)
          assert.ok(p.session.initIndex >= 0, `${name}: initIndex must be non-negative`)
          break
        case "turn_completed":
          assert.ok(
            ["completed", "interrupted", "error"].includes(p.status),
            `${name}: unknown turn status "${p.status}"`,
          )
          break
        case "unknown":
          assert.ok(p.wireType.length > 0, `${name}: unknown event must name its wire type`)
          break
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Model-change detection
// ---------------------------------------------------------------------------

test("a second init with a different model emits model_changed", () => {
  const twoInits = [
    '{"type":"system","subtype":"init","sessionId":"s1","model":"claude-haiku","cwd":"/","tools":[],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
    '{"type":"system","subtype":"init","sessionId":"s1","model":"claude-sonnet-4-5","cwd":"/","tools":[],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
  ].join("\n")
  const events = mapKiroChatStream(twoInits)
  const changed = events.filter((e) => e.payload.type === "model_changed")
  assert.equal(changed.length, 1)
  const p = changed[0]!.payload as { type: "model_changed"; from: string; to: string }
  assert.equal(p.from, "claude-haiku")
  assert.equal(p.to, "claude-sonnet-4-5")
})

test("a second init with the same model does not emit model_changed", () => {
  const twoInits = [
    '{"type":"system","subtype":"init","sessionId":"s1","model":"claude-sonnet-4-5","cwd":"/","tools":[],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
    '{"type":"system","subtype":"init","sessionId":"s1","model":"claude-sonnet-4-5","cwd":"/","tools":[],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
  ].join("\n")
  const events = mapKiroChatStream(twoInits)
  assert.equal(events.filter((e) => e.payload.type === "model_changed").length, 0)
})

// ---------------------------------------------------------------------------
// Usage nullability
// ---------------------------------------------------------------------------

test("absent usage is null, not a zero-filled object", () => {
  // A turn with no usage field must not produce totalTokens: 0 or inputTokens: 0,
  // which would state something the line never said.
  const events = mapKiroChatStream('{"type":"turn_end","sessionId":"s1","stopReason":"end_turn"}')
  const turn = events.find((e) => e.payload.type === "turn_completed")
  assert.notEqual(turn, undefined)
  const p = turn!.payload as { usage: unknown }
  assert.equal(p.usage, null)
})

test("a string where a count belongs does not flow into a numeric field", () => {
  const events = mapKiroChatStream(
    '{"type":"turn_end","sessionId":"s1","stopReason":"end_turn","usage":{"inputTokens":"1000000","outputTokens":"200"}}',
  )
  const turn = events.find((e) => e.payload.type === "turn_completed")
  assert.notEqual(turn, undefined)
  const usage = (turn!.payload as { usage: { inputTokens: unknown; totalTokens: unknown } | null }).usage
  assert.notEqual(usage, null)
  assert.equal(usage!.inputTokens, null, "string token counts must not flow into numeric fields")
  assert.equal(usage!.totalTokens, null)
})

// ---------------------------------------------------------------------------
// Task / subagent
// ---------------------------------------------------------------------------

test("a task tool_call emits task_started and task_completed", () => {
  const lines = [
    '{"type":"system","subtype":"init","sessionId":"s1","model":"m","cwd":"/","tools":["task"],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
    '{"type":"tool_call","sessionId":"s1","subtype":"started","toolCallId":"c1","title":"task","kind":"think","rawInput":{"description":"explore files","prompt":"list files"}}',
    '{"type":"tool_call_update","sessionId":"s1","toolCallId":"c1","status":"completed","kind":"think","content":[{"type":"text","text":"found 3 files"}],"rawOutput":{}}',
  ].join("\n")
  const events = mapKiroChatStream(lines)
  const started = events.filter((e) => e.payload.type === "task_started")
  const completed = events.filter((e) => e.payload.type === "task_completed")
  assert.equal(started.length, 1)
  assert.equal(completed.length, 1)
  const sp = started[0]!.payload as { taskId: string; callId: string; taskKind: string }
  const cp = completed[0]!.payload as { taskId: string; summary: string | null }
  assert.equal(sp.taskId, "c1")
  assert.equal(sp.callId, "c1")
  assert.equal(sp.taskKind, "agent")
  assert.equal(cp.taskId, "c1")
  assert.equal(cp.summary, "found 3 files")
})

// ---------------------------------------------------------------------------
// TodoWrite / plan
// ---------------------------------------------------------------------------

test("a todowrite call emits plan_updated at call-start time", () => {
  const lines = [
    '{"type":"system","subtype":"init","sessionId":"s1","model":"m","cwd":"/","tools":["todowrite"],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
    '{"type":"tool_call","sessionId":"s1","subtype":"started","toolCallId":"t1","title":"todowrite","kind":"other","rawInput":{"todos":[{"id":"1","content":"step one","status":"pending"},{"id":"2","content":"step two","status":"in_progress"}]}}',
  ].join("\n")
  const events = mapKiroChatStream(lines)
  const plans = events.filter((e) => e.payload.type === "plan_updated")
  assert.equal(plans.length, 1)
  const steps = (plans[0]!.payload as { steps: readonly { content: string; status: string }[] }).steps
  assert.equal(steps.length, 2)
  assert.equal(steps[0]!.content, "step one")
  assert.equal(steps[0]!.status, "pending")
  assert.equal(steps[1]!.status, "in_progress")
  // The wire kind must sharpen so the mapping table can promise PlanUpdated.
  const started = parseKiroLine(lines.split("\n")[1]!)
  assert.equal(started.ok, true)
  if (started.ok) assert.equal(kiroWireKind(started.line), "tool_call/started/todowrite")
})

// ---------------------------------------------------------------------------
// Progress / extension suppression (claimed by the mapping table)
// ---------------------------------------------------------------------------

test("in_progress tool_call_update produces no event", () => {
  const events = mapKiroChatStream(
    [
      '{"type":"tool_call","subtype":"started","toolCallId":"c1","title":"bash","kind":"execute","rawInput":{"command":"ls"}}',
      '{"type":"tool_call_update","toolCallId":"c1","status":"in_progress"}',
    ].join("\n"),
  )
  assert.equal(events.filter((e) => e.payload.type === "tool_call_started").length, 1)
  assert.equal(events.length, 1, "in_progress must not add an event")
})

test("pending tool_call_update produces no event", () => {
  const events = mapKiroChatStream(
    [
      '{"type":"tool_call","subtype":"started","toolCallId":"c1","title":"bash","kind":"execute","rawInput":{"command":"ls"}}',
      '{"type":"tool_call_update","toolCallId":"c1","status":"pending"}',
    ].join("\n"),
  )
  assert.equal(events.length, 1, "pending must not add an event")
})

test("known _kiro.dev extension lines produce no event", () => {
  for (const type of [
    "_kiro.dev/compaction/status",
    "_kiro.dev/clear/status",
    "_kiro.dev/commands/available",
    "_kiro.dev/mcp/server_initialized",
  ]) {
    const events = mapKiroChatStream(JSON.stringify({ type, sessionId: "s1" }))
    assert.deepEqual(
      events.map((e) => e.payload.type),
      [],
      `${type} is in the mapping table with empty emits and must stay silent`,
    )
  }
})

test("a write completion without kind on the update still emits file_edits from remembered state", () => {
  const events = mapKiroChatStream(
    [
      '{"type":"tool_call","subtype":"started","toolCallId":"c1","title":"write","kind":"edit","rawInput":{"path":"a.txt","content":"x"}}',
      '{"type":"tool_call_update","toolCallId":"c1","status":"completed","content":[{"type":"diff","path":"a.txt","oldText":"","newText":"x"}]}',
    ].join("\n"),
  )
  assert.ok(events.some((e) => e.payload.type === "file_edits"))
  // And that emission is declared for the wire kind this frame actually has.
  const update = parseKiroLine(
    '{"type":"tool_call_update","toolCallId":"c1","status":"completed","content":[{"type":"diff","path":"a.txt","oldText":"","newText":"x"}]}',
  )
  assert.equal(update.ok, true)
  if (update.ok) {
    assert.equal(kiroWireKind(update.line), "tool_call_update/completed")
    assert.ok(kiroMappingFor(kiroWireKind(update.line))!.emits.includes(AgentEventType.FileEdits))
  }
})

test("mapper emissions never exceed what the mapping table declares for that wire kind", () => {
  // The scenarios that exercise remembered-state extras — the holes fixtures alone miss.
  const scenarios: readonly { readonly label: string; readonly lines: readonly string[] }[] = [
    {
      label: "todowrite",
      lines: [
        '{"type":"tool_call","subtype":"started","toolCallId":"t1","title":"todowrite","kind":"other","rawInput":{"todos":[{"id":"1","content":"a","status":"pending"}]}}',
      ],
    },
    {
      label: "task",
      lines: [
        '{"type":"tool_call","subtype":"started","toolCallId":"c1","title":"task","kind":"think","rawInput":{"description":"d","prompt":"p"}}',
        '{"type":"tool_call_update","toolCallId":"c1","status":"completed","kind":"think","content":[{"type":"text","text":"done"}]}',
      ],
    },
    {
      label: "failed-task",
      lines: [
        '{"type":"tool_call","subtype":"started","toolCallId":"c1","title":"task","kind":"think","rawInput":{"description":"d"}}',
        '{"type":"tool_call_update","toolCallId":"c1","status":"failed","kind":"think","content":[{"type":"text","text":"boom"}]}',
      ],
    },
    {
      label: "write-without-kind-on-update",
      lines: [
        '{"type":"tool_call","subtype":"started","toolCallId":"c1","title":"write","kind":"edit","rawInput":{"path":"a.txt","content":"x"}}',
        '{"type":"tool_call_update","toolCallId":"c1","status":"completed","content":[{"type":"diff","path":"a.txt","oldText":"","newText":"x"}]}',
      ],
    },
  ]

  for (const scenario of scenarios) {
    const mapper = new KiroChatMapper()
    for (const line of scenario.lines) {
      const parsed = parseKiroLine(line)
      assert.equal(parsed.ok, true, scenario.label)
      if (!parsed.ok) continue
      const kind = kiroWireKind(parsed.line)
      const entry = kiroMappingFor(kind)
      assert.notEqual(entry, null, `${scenario.label}: kind "${kind}" missing from table`)
      const declared = new Set(entry!.emits)
      for (const event of mapper.map(parsed.line)) {
        assert.ok(
          declared.has(event.payload.type),
          `${scenario.label}: kind "${kind}" emitted undeclared "${event.payload.type}" (table: ${[...declared]})`,
        )
      }
    }
  }
})

// ---------------------------------------------------------------------------
// File edits
// ---------------------------------------------------------------------------

test("an edit tool with a diff content block emits file_edits with the correct change kind", () => {
  const lines = [
    '{"type":"system","subtype":"init","sessionId":"s1","model":"m","cwd":"/","tools":["edit"],"slashCommands":[],"agents":[],"skills":[],"mcpServers":[],"version":"3.0.0"}',
    '{"type":"tool_call","sessionId":"s1","subtype":"started","toolCallId":"e1","title":"write","kind":"edit","rawInput":{"path":"hello.txt","content":"hello"}}',
    '{"type":"tool_call_update","sessionId":"s1","toolCallId":"e1","status":"completed","kind":"edit","content":[{"type":"diff","path":"hello.txt","oldText":"","newText":"hello"}],"rawOutput":{"path":"hello.txt"}}',
  ].join("\n")
  const events = mapKiroChatStream(lines)
  const edits = events.filter((e) => e.payload.type === "file_edits")
  assert.equal(edits.length, 1)
  const p = edits[0]!.payload as { edits: readonly { path: string; change: string; unifiedDiff: string | null }[] }
  assert.equal(p.edits[0]!.path, "hello.txt")
  assert.equal(p.edits[0]!.change, "add")
  assert.ok(p.edits[0]!.unifiedDiff?.includes("--- /dev/null"))
})

// ---------------------------------------------------------------------------
// Mapping table coverage: every declared row reachable or acknowledged
// ---------------------------------------------------------------------------

/**
 * Rows the synthetic fixtures don't reach, with the reason.
 * Each entry must name a real row in the table AND name why no fixture covers it.
 * A row listed here must also have a dedicated unit test that exercises it —
 * "covered by a unit test above" is not enough without that test existing.
 */
const KIRO_UNEXERCISED: ReadonlyMap<string, string> = new Map([
  ["tool_call/started/task", "no task tool call in synthetic fixtures; covered by the task unit test"],
  ["tool_call/started/todowrite", "no todowrite in synthetic fixtures; covered by the plan unit test"],
  ["tool_call_update/in_progress", "no mid-flight updates in synthetic fixtures; covered by the in_progress unit test"],
  ["tool_call_update/pending", "no pending updates in synthetic fixtures; covered by the pending unit test"],
  ["_kiro.dev/compaction/status", "not in a capture — no live CLI; covered by the known-extension suppression test"],
  ["_kiro.dev/clear/status", "not in a capture — no live CLI; covered by the known-extension suppression test"],
  ["_kiro.dev/commands/available", "not in a capture — no live CLI; covered by the known-extension suppression test"],
  ["_kiro.dev/mcp/server_initialized", "not in a capture — no live CLI; covered by the known-extension suppression test"],
])

test("every Kiro mapping row the fixtures exercise emits what the table declares", () => {
  const seenKinds = new Set<string>()
  for (const name of NAMES) {
    const mapper = new KiroChatMapper()
    for (const result of parseKiroLines(capture(name))) {
      if (!result.ok) continue
      const kind = kiroWireKind(result.line)
      seenKinds.add(kind)
      const entry = kiroMappingFor(kind)
      assert.notEqual(entry, null, `${name}: kind "${kind}" missing from table`)
      const declared = new Set(entry!.emits)
      for (const event of mapper.map(result.line)) {
        assert.ok(
          declared.has(event.payload.type),
          `${name}: "${kind}" emitted undeclared "${event.payload.type}"`,
        )
      }
    }
  }
})

test("every unexercised Kiro mapping row is acknowledged and is a real row", () => {
  const seenKinds = new Set<string>()
  for (const name of NAMES) {
    for (const result of parseKiroLines(capture(name))) {
      if (result.ok) seenKinds.add(kiroWireKind(result.line))
    }
  }
  const declared = Object.keys(KIRO_EVENT_MAPPING)

  const unexercised = declared.filter((kind) => !seenKinds.has(kind))
  for (const kind of unexercised) {
    assert.ok(
      KIRO_UNEXERCISED.has(kind),
      `"${kind}" is in the mapping table but no fixture reaches it and it is not acknowledged in KIRO_UNEXERCISED`,
    )
  }
  for (const kind of KIRO_UNEXERCISED.keys()) {
    assert.ok(seenKinds.has(kind) === false, `"${kind}" is listed as unexercised but a fixture reaches it`)
    assert.ok(declared.includes(kind), `"${kind}" is in KIRO_UNEXERCISED but not in KIRO_EVENT_MAPPING`)
  }
})

// ---------------------------------------------------------------------------
// Transport wiring
// ---------------------------------------------------------------------------

test("kiro is registered as a provider with chat and acp transports", () => {
  assert.equal(transportsOf("kiro")?.label, "Kiro CLI")
  assert.equal(transportsOf("kiro")?.transports.length, 2)
  assert.equal(transportOf("kiro", "chat")?.provenance.version, KIRO_CHAT_PROVENANCE.version)
  assert.equal(transportOf("kiro", "acp")?.command, "kiro-cli acp")
  // ACP capability claims that have no Kiro-specific capture stay null.
  assert.equal(transportOf("kiro", "acp")?.supports.approvals, null)
  assert.equal(transportOf("kiro", "acp")?.supports.fileEdits, null)
})
