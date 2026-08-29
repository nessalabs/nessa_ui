/** @responsibility Proves the Codex provider against real captures, and that the shared layer needed nothing to accept it. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { TranscriptBuilder } from "./builder"
import { AgentEventType, isEvent } from "./events"
import { CODEX_EVENT_MAPPING, codexWireKind } from "./codex/mapping"
import { CODEX_CAPABILITY_METHODS, codexCapabilities } from "./codex/capabilities"
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
      const kind = codexWireKind(result.line)
      assert.ok(CODEX_EVENT_MAPPING[kind] !== undefined, `${name}: ${kind} is not in CODEX_EVENT_MAPPING`)
    }
  }
})

test("what the mapper emits is what the table promises", () => {
  for (const name of NAMES) {
    const mapper = new CodexStreamMapper()
    for (const result of parseCodexLines(capture(name))) {
      if (!result.ok) continue
      const kind = codexWireKind(result.line)
      const declared = new Set(CODEX_EVENT_MAPPING[kind]!.emits)
      for (const event of mapper.map(result.line)) {
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

test("the app-server answers what the exec stream cannot", () => {
  // Codex's capabilities live on a different channel: the stream opens with a
  // thread id and nothing else, so a composer's pickers have to ask the
  // app-server. This reads a captured reply rather than holding a connection.
  const replies = JSON.parse(readFileSync(`${FIXTURES}appserver_capabilities.json`, "utf8")) as Record<string, never>
  const capabilities = codexCapabilities(replies)

  assert.ok((capabilities.models ?? []).length > 0)
  assert.ok(capabilities.models!.every((model) => model.id.length > 0 && model.label.length > 0))
  assert.ok((capabilities.skills ?? []).length > 0)

  // Hooks are named `eventName`/`sourcePath` in the reply. Reading `event`
  // and `source` instead returned a list of blank rows that still passed a
  // length check, so the assertion now looks at the values.
  assert.ok((capabilities.hooks ?? []).length > 0)
  assert.ok(capabilities.hooks!.every((hook) => hook.event !== null), "every hook names its event")
  assert.ok(capabilities.hooks!.some((hook) => hook.source !== null), "a hook says where it came from")

  // Sections this reply cannot answer read as unreported, not as empty.
  assert.equal(capabilities.commands, null)
  assert.equal(capabilities.mcpServers, null)

  // A curated marketplace holds thousands, so the count is the catalogue's real
  // size and the sample is what a picker was handed — reporting the sample's
  // length as the size would understate it by three orders of magnitude.
  const largest = [...capabilities.pluginSources!].sort((a, b) => b.count - a.count)[0]!
  assert.ok(largest.count > largest.sample.length)
  assert.equal(CODEX_CAPABILITY_METHODS.includes("model/list"), true)
})

test("a host that asks for only some capabilities gets the rest empty, not an error", () => {
  const partial = codexCapabilities({ "model/list": { data: [{ id: "gpt-5", displayName: "GPT-5" }] } } as never)
  assert.equal(partial.models!.length, 1)
  assert.deepEqual(partial.skills, [])
  assert.deepEqual(partial.pluginSources, [])
})

test("one spawned agent is one run, and its result is the run's result", () => {
  // `spawn_agent` opens the run and a later `wait` reports its outcome — two
  // items, one agent. Treating every collab call as a spawn made two runs, the
  // second labelled "wait" with no prompt and no output.
  const { runs } = buildTranscript(mapCodexStream(capture("delegate")))
  const agents = runs.filter((run) => run.kind === "agent")
  assert.equal(agents.length, 1, "two runs here would be the same agent counted twice")

  // The agent's own text arrives in `agents_states`, which is the only place
  // this stream carries it. Reporting the receiver thread ids as the summary
  // put machine addresses where the reader expects an answer.
  const run = agents[0]!
  assert.equal(run.done, true)
  assert.ok(run.usage === null || run.usage.totalTokens === null)
  assert.match(run.status ?? run.description ?? "", /.+/)
  const summary = run.events.length === 0 ? runSummary(mapCodexStream(capture("delegate"))) : null
  assert.ok(summary !== null && summary.includes("bonjour"), `expected the agent's own answer, got ${summary}`)
})

/** The last summary a task_completed carried, which is where a run's outcome lands. */
function runSummary(events: readonly ReturnType<typeof mapCodexStream>[number][]): string | null {
  let summary: string | null = null
  for (const event of events) {
    if (event.payload.type === "task_completed" && event.payload.summary !== null) summary = event.payload.summary
  }
  return summary
}

test("reasoning tokens are counted, not dropped", () => {
  // Codex reports them separately and excludes them from `output_tokens`, so a
  // total without them understates the turn.
  const events = mapCodexStream(capture("plan"))
  const usage = events.flatMap((event) => (event.payload.type === "turn_completed" ? [event.payload.usage] : []))[0]
  assert.notEqual(usage, null)
  assert.notEqual(usage!.reasoningTokens, null)
  assert.equal(usage!.totalTokens, (usage!.inputTokens ?? 0) + (usage!.outputTokens ?? 0) + (usage!.reasoningTokens ?? 0))
})

test("a call's input is its arguments, not the whole line", () => {
  const events = mapCodexStream(capture("tools"))
  const call = events.find((event) => event.payload.type === "tool_call_started")
  const input = call?.payload.type === "tool_call_started" ? (call.payload.input as Record<string, unknown>) : {}
  // The item also carries id, status and output; those describe the call's
  // lifecycle, and a drawer printing them as "input" shows plumbing.
  assert.equal("id" in input, false)
  assert.equal("status" in input, false)
  assert.ok("command" in input || "changes" in input)
})

test("a search reports what was searched, and only once it settles", () => {
  const events = mapCodexStream(capture("websearch"))
  const call = events.find((event) => event.payload.type === "tool_call_started")
  assert.notEqual(call, undefined)
  assert.equal(call!.payload.type === "tool_call_started" ? call!.payload.kind : null, "web")
  // The started item's `query` is empty — Codex fills it on completion — so the
  // row's label cannot name the search, and pretending otherwise would mean
  // inventing it.
  assert.equal(call!.payload.type === "tool_call_started" ? call!.payload.title : null, "web search")

  const settled = events.find((event) => event.payload.type === "tool_call_completed")
  const result = settled?.payload.type === "tool_call_completed" ? settled.payload.result : null
  assert.notEqual(result, null)
  // No results are reported, so `text` — which means output — stays empty, and
  // the query lives where a detail view can read it.
  assert.equal(result!.text, "")
  assert.match(JSON.stringify(result!.structured), /TypeScript/)
})
