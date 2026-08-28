/** @responsibility Proves the Codex provider against real captures, and that the shared layer needed nothing to accept it. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { TranscriptBuilder } from "./builder"
import { AgentEventType, isEvent } from "./events"
import { CODEX_EVENT_MAPPING, codexWireKind } from "./codex/mapping"
import { CodexStreamMapper, mapCodexStream } from "./codex/mapper"
import { CodexItemType, CodexWireType, parseCodexLines } from "./codex/wire"
import { applyDeltas, buildTranscript, isToolGroup } from "./transcript"

const FIXTURES = fileURLToPath(new URL("../../../../../apps/storybook/stories/fixtures/agent-stream/codex/", import.meta.url))

function capture(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

const NAMES = ["printed", "tools", "plan", "failing", "patch", "websearch", "delegate", "resume_turn1", "resume_turn2"] as const

test("every captured line decodes", () => {
  for (const name of NAMES) {
    for (const result of parseCodexLines(capture(name))) {
      assert.equal(result.ok, true, `${name}: ${result.ok ? "" : result.reason}`)
    }
  }
})

test("no capture maps to an unreadable event", () => {
  for (const name of NAMES) {
    const bad = mapCodexStream(capture(name)).filter((event) => event.payload.type === AgentEventType.Error)
    assert.deepEqual(bad.map((event) => (event.payload.type === "error" ? event.payload.message : "")), [], name)
  }
})

test("every line kind the captures contain is declared in the mapping table", () => {
  // The table is the provider-to-contract translation; a kind missing from it
  // is a line nobody decided about.
  for (const name of NAMES) {
    for (const result of parseCodexLines(capture(name))) {
      if (!result.ok) continue
      const kind = codexWireKind(result.event)
      assert.ok(CODEX_EVENT_MAPPING[kind] !== undefined, `${name}: ${kind} is not in CODEX_EVENT_MAPPING`)
    }
  }
})

test("what the mapper emits is what the table promises", () => {
  for (const name of NAMES) {
    const mapper = new CodexStreamMapper()
    for (const result of parseCodexLines(capture(name))) {
      if (!result.ok) continue
      const kind = codexWireKind(result.event)
      const declared = new Set(CODEX_EVENT_MAPPING[kind]!.emits)
      for (const event of mapper.map(result.event)) {
        assert.ok(declared.has(event.payload.type as never), `${name}: ${kind} emitted an undeclared ${event.payload.type}`)
      }
    }
  }
})

test("a thread opens a session and a turn closes with usage", () => {
  const events = mapCodexStream(capture("printed"))
  const transcript = buildTranscript(events)
  assert.notEqual(transcript.session, null)
  assert.equal(transcript.turns.length, 1)
  assert.equal(transcript.turns[0]!.finalText, "hello world")
  // Codex reports its own counters; the ones it does not report stay unknown
  // rather than becoming a zero it never claimed.
  assert.ok((transcript.usage?.totalTokens ?? 0) > 0)
  assert.equal(transcript.usage?.cacheCreationTokens, null)
})

test("a command reports its own exit code, so failure is a fact not an inference", () => {
  const events = mapCodexStream(capture("failing"))
  const results = events.flatMap((event) => (event.payload.type === "tool_call_completed" ? [event.payload.result] : []))
  assert.ok(results.length > 0)
  assert.ok(results.some((result) => result.isError), "a non-zero command is an error without reading its prose")
})

test("file changes arrive as structure, which Claude Code never reports", () => {
  const events = mapCodexStream(capture("patch"))
  const edits = events.flatMap((event) => (event.payload.type === "file_edits" ? event.payload.edits : []))
  assert.ok(edits.length > 0)
  for (const edit of edits) {
    assert.ok(edit.path.length > 0)
    assert.ok(["add", "update", "delete", "rename"].includes(edit.change))
  }
  assert.ok(edits.some((edit) => edit.change === "add"))
})

test("the plan is republished whole, so the latest list wins", () => {
  const events = mapCodexStream(capture("plan"))
  const updates = events.filter((event) => event.payload.type === "plan_updated")
  assert.ok(updates.length > 1, "Codex republishes the list as steps complete")
  const { plan } = buildTranscript(events)
  assert.ok(plan.length >= 3)
  assert.ok(plan.every((step) => step.content.length > 0))
  // No ids: a step is identified by its position in a list that arrives whole.
  assert.ok(plan.every((step) => step.id === null))
})

test("a spawned agent is a run whose transcript is not on this stream", () => {
  const events = mapCodexStream(capture("delegate"))
  const { runs } = buildTranscript(events)
  const run = runs.find((entry) => entry.kind === "agent")
  assert.notEqual(run, undefined)
  assert.equal(run!.done, true)
  // Same shape as a Claude workflow agent: watchable here, readable only on
  // disk — the summary carries the receiver thread that addresses it.
  assert.equal(run!.events.length, 0)
  assert.ok((run!.taskId ?? "").length > 0)
})

test("resuming reuses the thread id, so a resume is not visible on the wire", () => {
  const first = mapCodexStream(capture("resume_turn1"))
  const second = mapCodexStream(capture("resume_turn2"))
  const firstThread = buildTranscript(first).session?.sessionId
  const secondThread = buildTranscript(second).session?.sessionId
  assert.notEqual(firstThread, undefined)
  assert.equal(firstThread, secondThread)
})

test("the shared fold accepts Codex events with no provider knowledge at all", () => {
  // The claim the layering exists for: everything past AgentEvent is shared, so
  // a second provider reuses the fold, the grouping and the delta machinery
  // without any of them learning what Codex is.
  for (const name of NAMES) {
    const events = mapCodexStream(capture(name))
    const oneShot = buildTranscript(events)

    const builder = new TranscriptBuilder()
    for (let index = 0; index < events.length; index += 3) builder.push(events.slice(index, index + 3))
    const incremental = builder.snapshot()

    assert.equal(incremental.turns.length, oneShot.turns.length, name)
    assert.equal(incremental.events.length, oneShot.events.length, name)
    // Codex streams nothing in this mode, which is exactly why deltas are
    // optional: the preview machinery must be a no-op rather than a gap.
    assert.equal(applyDeltas(events).size, 0, name)
  }
})

test("tool runs group and results pair, using the item id as the call id", () => {
  const events = mapCodexStream(capture("tools"))
  const transcript = buildTranscript(events)
  const calls = events.filter((event) => isEvent(event, AgentEventType.ToolCallStarted))
  assert.ok(calls.length > 0)
  for (const call of calls) {
    assert.ok(transcript.resultByCallId.has(call.payload.callId), call.payload.callId)
  }
  assert.equal(transcript.abandonedCallIds.size, 0)
  const grouped = transcript.turns.flatMap((turn) => turn.work.filter(isToolGroup))
  for (const group of grouped) assert.ok(group.calls.length >= 2)
})

test("an unfamiliar item kind survives as unknown rather than failing the line", () => {
  const events = mapCodexStream(
    JSON.stringify({ type: CodexWireType.ItemCompleted, item: { id: "x", type: "a_kind_from_next_release" } }),
  )
  assert.equal(events.length, 1)
  assert.equal(events[0]!.payload.type, AgentEventType.Unknown)
})

test("a malformed line degrades that line, never the stream", () => {
  const mapper = new CodexStreamMapper()
  assert.doesNotThrow(() => mapper.push("{ truncated"))
  assert.equal(mapper.push('{"type":"item.completed","item":{}}')[0]!.payload.type, AgentEventType.Unknown)
  // A thread line with no id cannot open a session, so it opens nothing.
  assert.deepEqual(mapper.push(`{"type":"${CodexWireType.ThreadStarted}"}`), [])
  assert.equal(CodexItemType.AgentMessage, "agent_message")
})
