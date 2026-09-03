/** @responsibility Proves the Cursor Agent provider against real captures. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { TranscriptBuilder } from "./transcript/builder"
import { AgentEventType } from "./events"
import { CURSOR_EVENT_MAPPING, cursorWireKind } from "./cursor/stream/mapping"
import { CursorStreamMapper, mapCursorStream } from "./cursor/stream/mapper"
import { CURSOR_STREAM_PROVENANCE, parseCursorLines } from "./cursor/stream/wire"
import { transportOf, transportsOf } from "./transports"
import { applyDeltas, buildTranscript, previewOf } from "./transcript/fold"

const FIXTURES = fileURLToPath(new URL("../../../apps/storybook/stories/fixtures/agent-stream/cursor/", import.meta.url))

function capture(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

const NAMES = ["printed", "tools", "shell", "subagent"] as const

test("every captured line decodes", () => {
  for (const name of NAMES) {
    for (const result of parseCursorLines(capture(name))) {
      assert.equal(result.ok, true, `${name}: ${result.ok ? "" : result.reason}`)
    }
  }
})

test("no capture maps to an unreadable event", () => {
  for (const name of NAMES) {
    const bad = mapCursorStream(capture(name)).filter((event) => event.payload.type === AgentEventType.Error)
    assert.deepEqual(
      bad.map((event) => (event.payload.type === "error" ? event.payload.message : "")),
      [],
      name,
    )
  }
})

test("every line kind the captures contain is declared in the mapping table", () => {
  for (const name of NAMES) {
    for (const result of parseCursorLines(capture(name))) {
      if (!result.ok) continue
      const kind = cursorWireKind(result.line)
      assert.ok(CURSOR_EVENT_MAPPING[kind] !== undefined, `${name}: ${kind} is not in CURSOR_EVENT_MAPPING`)
    }
  }
})

test("what the mapper emits is what the table promises", () => {
  for (const name of NAMES) {
    const mapper = new CursorStreamMapper()
    for (const result of parseCursorLines(capture(name))) {
      if (!result.ok) continue
      const kind = cursorWireKind(result.line)
      const declared = new Set(CURSOR_EVENT_MAPPING[kind]!.emits)
      for (const event of mapper.map(result.line)) {
        assert.ok(
          declared.has(event.payload.type as never),
          `${name}: ${kind} emitted an undeclared ${event.payload.type}`,
        )
      }
    }
  }
})

test("a print session opens, streams, and closes with camelCase usage", () => {
  const events = mapCursorStream(capture("printed"))
  const transcript = buildTranscript(events)
  assert.notEqual(transcript.session, null)
  assert.equal(transcript.session?.model, "Auto")
  // Cursor emits `system/init` before the user line, so the fold closes a
  // tiny first turn that holds only the session advertisement — then the
  // real turn. Claude's captures put the user line first, which is why that
  // provider lands on one turn for the same scenario.
  const turn = transcript.turns.find((entry) => entry.finalText !== null)
  assert.notEqual(turn, undefined)
  assert.equal(turn!.finalText, "hello")
  const completed = events.find((event) => event.payload.type === "turn_completed")
  assert.equal(completed?.payload.type, "turn_completed")
  if (completed?.payload.type === "turn_completed") {
    // The wire's concatenated `result` must not be drawn as the closing text.
    assert.equal(completed.payload.finalText, null)
  }
  assert.ok((transcript.usage?.inputTokens ?? 0) > 0)
  assert.ok((transcript.usage?.cacheReadTokens ?? 0) > 0)
  // Cursor reports cache write separately; zero is a reported zero here.
  assert.equal(transcript.usage?.cacheCreationTokens, 0)
})

test("timestamped fragments are deltas; model_call_id and bare lines are commits", () => {
  const events = mapCursorStream(capture("tools"))
  const deltas = events.filter((event) => event.payload.type === "delta")
  const texts = events.filter((event) => event.payload.type === "assistant_text")
  assert.ok(deltas.length > 0, "stream-partial-output produces text deltas")
  // Two assistant messages in the turn: the pre-tool narration and the wrap-up.
  assert.equal(texts.length, 2)
  assert.equal(texts[0]!.payload.type, "assistant_text")
  assert.equal(texts[1]!.payload.type, "assistant_text")
  if (texts[0]!.payload.type === "assistant_text" && texts[1]!.payload.type === "assistant_text") {
    assert.ok(texts[0]!.payload.text.includes("Creating"))
    assert.ok(texts[1]!.payload.text.includes("Created"))
    assert.notEqual(texts[0]!.payload.block?.messageId, texts[1]!.payload.block?.messageId)
    const buffers = applyDeltas(events)
    assert.equal(previewOf(buffers, texts[0]!.payload.block!), texts[0]!.payload.text)
    const transcript = buildTranscript(events)
    const turn = transcript.turns.find((entry) => entry.finalText !== null)
    assert.equal(turn?.finalText, texts[1]!.payload.text)
    // Not the mashed `result` string Cursor concatenates on turn_completed.
    assert.ok(!(turn?.finalText ?? "").includes("confirm.Created"))
  }
})

test("shell input is the ask, not the envelope plumbing", () => {
  const events = mapCursorStream(capture("shell"))
  const started = events.find((event) => event.payload.type === "tool_call_started" && event.payload.name === "Shell")
  assert.notEqual(started, undefined)
  if (started?.payload.type === "tool_call_started") {
    const input = started.payload.input
    assert.ok(input !== null && typeof input === "object" && !Array.isArray(input))
    assert.equal((input as { command?: unknown }).command, "echo hello-from-shell")
    assert.equal((input as { toolCallId?: unknown }).toolCallId, undefined)
    assert.equal((input as { parsingResult?: unknown }).parsingResult, undefined)
  }
})

test("edit completions publish a structured diff", () => {
  const events = mapCursorStream(capture("tools"))
  const edits = events.flatMap((event) => (event.payload.type === "file_edits" ? event.payload.edits : []))
  assert.ok(edits.length > 0)
  assert.ok(edits.some((edit) => edit.change === "add" && edit.path.endsWith("hello.txt")))
  assert.ok(edits.some((edit) => (edit.unifiedDiff ?? "").includes("+hi")))
})

test("shell reports its own exit code on the result", () => {
  const events = mapCursorStream(capture("shell"))
  const completed = events.filter((event) => event.payload.type === "tool_call_completed")
  assert.ok(completed.length >= 2)
  const shell = completed.find((event) => {
    if (event.payload.type !== "tool_call_completed") return false
    const structured = event.payload.result.structured
    return structured !== null && typeof structured === "object" && "exitCode" in structured
  })
  assert.notEqual(shell, undefined)
  if (shell?.payload.type === "tool_call_completed") {
    assert.equal(shell.payload.result.isError, false)
    assert.ok(shell.payload.result.text.includes("hello-from-shell"))
  }
})

test("a Task spawn is a run whose transcript is not on this stream", () => {
  const events = mapCursorStream(capture("subagent"))
  const { runs } = buildTranscript(events)
  const run = runs.find((entry) => entry.kind === "agent")
  assert.notEqual(run, undefined)
  assert.equal(run!.done, true)
  // Same shape as Codex/Claude workflow agents: watchable here, readable only
  // elsewhere — the child's own events never arrive on the parent stdout.
  assert.equal(run!.events.length, 0)
  assert.ok((run!.taskId ?? "").length > 0)
  const started = events.find((event) => event.payload.type === "task_started")
  const completed = events.find((event) => event.payload.type === "task_completed")
  assert.equal(started?.payload.type, "task_started")
  assert.equal(completed?.payload.type, "task_completed")
  if (started?.payload.type === "task_started" && completed?.payload.type === "task_completed") {
    assert.equal(started.payload.taskId, completed.payload.taskId)
    assert.ok((completed.payload.summary ?? "").includes("hello.txt"))
  }
})

test("the shared fold accepts Cursor events with no provider knowledge at all", () => {
  for (const name of NAMES) {
    const events = mapCursorStream(capture(name))
    const oneShot = buildTranscript(events)

    const builder = new TranscriptBuilder()
    for (let index = 0; index < events.length; index += 3) builder.push(events.slice(index, index + 3))
    const incremental = builder.snapshot()

    assert.equal(incremental.turns.length, oneShot.turns.length, name)
    assert.equal(incremental.events.length, oneShot.events.length, name)
  }
})

test("partial output joins to the committed assistant text", () => {
  const events = mapCursorStream(capture("printed"))
  applyDeltas(events)
  const transcript = buildTranscript(events)
  const turn = transcript.turns.find((entry) => entry.finalText !== null)
  assert.equal(turn?.finalText, "hello")
})

test("the transport table records Cursor Agent print mode and ACP", () => {
  assert.equal(transportsOf("cursor")?.label, "Cursor Agent")
  assert.equal(transportsOf("cursor")?.transports.length, 2)
  assert.equal(transportOf("cursor", "stream")?.supports.streaming, true)
  assert.equal(transportOf("cursor", "stream")?.supports.fileEdits, true)
  assert.equal(transportOf("cursor", "stream")?.supports.approvals, false)
  assert.equal(transportOf("cursor", "stream")?.provenance.version, CURSOR_STREAM_PROVENANCE.version)
  assert.equal(transportOf("cursor", "acp")?.command, "agent acp")
  assert.equal(transportOf("cursor", "acp")?.supports.approvals, true)
  assert.equal(transportOf("cursor", "acp")?.supports.capabilities, true)
  assert.equal(transportOf("cursor", "acp")?.supports.sessionControl, true)
  assert.equal(transportOf("cursor", "serve"), null)
})
