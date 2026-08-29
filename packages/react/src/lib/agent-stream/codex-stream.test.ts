/** @responsibility Proves the Codex provider against real captures, and that the shared layer needed nothing to accept it. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { TranscriptBuilder } from "./builder"
import { AgentEventType, isEvent } from "./events"
import { CODEX_EVENT_MAPPING, codexWireKind } from "./codex/exec/mapping"
import { CODEX_CAPABILITY_METHODS, codexCapabilities } from "./codex/app-server/capabilities"
import { CodexStreamMapper, mapCodexStream } from "./codex/exec/mapper"
import { CODEX_APP_SERVER_MAPPING, codexAppServerKind, codexAppServerMappingFor } from "./codex/app-server/mapping"
import { mapCodexAppServerStream } from "./codex/app-server/mapper"
import { CODEX_APP_SERVER_PROVENANCE, parseCodexAppServer } from "./codex/app-server/wire"
import type { JsonValue } from "./json"
import { transportOf } from "./transports"
import { CODEX_EXEC_PROVENANCE, CodexItemType, CodexWireType, parseCodexLines } from "./codex/exec/wire"
import { applyDeltas, buildTranscript, isToolGroup, previewOf } from "./transcript"

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

test("a host that asks for only some capabilities gets the rest as unreported", () => {
  const partial = codexCapabilities({
    "model/list": { data: [{ id: "gpt-5", displayName: "GPT-5" }] },
  } as Record<string, JsonValue>)
  assert.equal(partial.models!.length, 1)
  // Null, not empty. This test used to pin the opposite, which is how a picker
  // came to render "no skills" for a host that had simply not asked.
  assert.equal(partial.skills, null)
  assert.equal(partial.pluginSources, null)
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

/**
 * The other Codex transport.
 *
 * `codex app-server` is JSON-RPC, not a stream of lines, and it reports the
 * same agent's work differently enough that it needs its own reader: it
 * carries the prompt, streams the answer, and settles items rather than
 * publishing them once.
 */
test("the app-server carries what exec never does", () => {
  const events = mapCodexAppServerStream(
    readFileSync(`${FIXTURES}appserver_tools.jsonl`, "utf8"),
  )

  // The prompt, which `exec --json` never echoes — it is in the client's own
  // `turn/start` request.
  const prompts = events.filter((event) => event.payload.type === "user_message")
  assert.equal(prompts.length, 1)
  assert.match((prompts[0]!.payload as { text: string }).text, /notes\.txt/)

  // And the token stream, which exec does not send at all.
  const deltas = events.filter((event) => event.payload.type === "delta")
  assert.ok(deltas.length > 5, "the answer arrived a token at a time")

  // The committed message supersedes those deltas, joined on the same block.
  const committed = events.find((event) => event.payload.type === "assistant_text")!
  const block = (committed.payload as { block: { messageId: string; index: number } }).block
  assert.equal(previewOf(applyDeltas(events), block), (committed.payload as { text: string }).text)

  assert.equal(events.filter((event) => event.payload.type === "session_started").length, 1)
})

test("every app-server frame kind the capture contains is declared in its own table", () => {
  for (const result of parseCodexAppServer(readFileSync(`${FIXTURES}appserver_tools.jsonl`, "utf8"))) {
    if (!result.ok) continue
    const frame = result.line as { method?: string; params?: { item?: { type?: string } } }
    if (frame.method === undefined) continue
    const kind = codexAppServerKind(frame.method, frame.params?.item?.type ?? null)
    assert.notEqual(codexAppServerMappingFor(kind), null, `${kind} is not in CODEX_APP_SERVER_MAPPING`)
  }
})

test("the two Codex transports are described separately, with their own commands", () => {
  // They were one module until the app-server turned out to be a different
  // protocol with a schema of its own.
  assert.equal(CODEX_EXEC_PROVENANCE.command, "codex exec --json")
  assert.equal(CODEX_APP_SERVER_PROVENANCE.command, "codex app-server")
  assert.equal(CODEX_EVENT_MAPPING["thread/started"], undefined)
  assert.equal(CODEX_APP_SERVER_MAPPING[CodexWireType.ThreadStarted], undefined)

  // Streaming is now a recorded fact for the app-server rather than an
  // unrecorded guess.
  assert.equal(transportOf("codex", "exec")?.supports.streaming, false)
  assert.equal(transportOf("codex", "app-server")?.supports.streaming, true)
})

/**
 * A table may only promise what something has seen.
 *
 * The conformance checks are one-directional: they prove a mapper never
 * exceeds its table, not that a declared row is real. A row no capture
 * exercises is a claim about a wire nobody has read — which is how
 * `item.completed/error` came to declare an `error` event the mapper never
 * emitted. Each such row is acknowledged here or it fails.
 */
const EXEC_UNEXERCISED: ReadonlyMap<string, string> = new Map([
  ["turn.failed", "needs a turn the model itself aborts"],
  ["error", "a thread-level failure outside any item"],
  ["item.started/agent_message", "the captures open and settle a message in one line"],
  ["item.started/reasoning", "the same"],
  ["item.completed/reasoning", "these models emitted no disclosed reasoning"],
  ["item.updated/agent_message", "no capture ran long enough to be updated mid-item"],
  ["item.updated/reasoning", "the same"],
  ["item.updated/command_execution", "needs a command slow enough to report partial output"],
  ["item.updated/file_change", "the same"],
  ["item.updated/web_search", "the same"],
  ["item.updated/collab_tool_call", "needs a spawned agent watched while it works"],
  ["item.started/mcp_tool_call", "no MCP server was configured for the captures"],
  ["item.completed/mcp_tool_call", "the same"],
  ["item.started/error", "an error opens and settles in one line"],
  ["item.completed/error", "no capture produced an item-level failure; the row is checked by a synthetic line below"],
])

test("every codex exec row the captures never reach is acknowledged as unexercised", () => {
  const seen = new Set<string>()
  for (const name of NAMES) {
    for (const result of parseCodexLines(capture(name))) {
      if (result.ok) seen.add(codexWireKind(result.line))
    }
  }
  const declared = Object.keys(CODEX_EVENT_MAPPING)
  assert.deepEqual(
    declared.filter((kind) => !seen.has(kind) && !EXEC_UNEXERCISED.has(kind)).sort(),
    [],
    "a table row no fixture exercises must be listed in EXEC_UNEXERCISED",
  )
  for (const kind of EXEC_UNEXERCISED.keys()) {
    assert.ok(!seen.has(kind), `${kind} is listed as unexercised but a fixture reaches it`)
    assert.ok(declared.includes(kind), `${kind} is listed as unexercised but is not a row in the table`)
  }
})

test("a declared row with no capture is still checked, where a line can be written by hand", () => {
  // The cheapest defence against a fictional row: feed the shape the table
  // describes and assert it produces what the table promises. This one was
  // fiction — the item fell through to the tool-call default and settled as a
  // *successful* call with no text, so a failed turn read as a silent one.
  const events = mapCodexStream(
    JSON.stringify({ type: "item.completed", item: { id: "item_9", type: "error", message: "the model refused" } }),
  )
  assert.deepEqual(
    events.map((event) => event.payload.type),
    CODEX_EVENT_MAPPING[`${CodexWireType.ItemCompleted}/${CodexItemType.Error}`]!.emits,
  )
  assert.equal((events[0]!.payload as { message: string }).message, "the model refused")
})

/**
 * The app-server's table is written from the schema the CLI publishes, not
 * from a capture, so most of it is unexercised by design. Listing the ones a
 * capture *does* reach is the honest direction here.
 */
test("the app-server capture reaches the rows it should, and the rest are schema-only", () => {
  const seen = new Set<string>()
  for (const result of parseCodexAppServer(readFileSync(`${FIXTURES}appserver_tools.jsonl`, "utf8"))) {
    if (!result.ok) continue
    const frame = result.line as { method?: string; params?: { item?: { type?: string } } }
    if (frame.method === undefined) continue
    seen.add(codexAppServerKind(frame.method, frame.params?.item?.type ?? null))
  }
  for (const kind of ["thread/started", "turn/start", "item/agentMessage/delta", "item/completed/agentMessage"]) {
    assert.ok(seen.has(kind), `the capture should reach ${kind}`)
  }
  // Everything declared but unseen comes from `codex app-server
  // generate-json-schema`. That is a weaker warrant than a capture, and saying
  // how much weaker is the point of this assertion.
  const declared = Object.keys(CODEX_APP_SERVER_MAPPING)
  const schemaOnly = declared.filter((kind) => !seen.has(kind))
  assert.ok(schemaOnly.length > 0)
  assert.ok(
    schemaOnly.length <= declared.length - 8,
    "at least eight rows should be backed by a capture rather than by the schema alone",
  )
})

test("the app-server session says what its own reply says", () => {
  // The `thread/started` notification names the thread; the `thread/start`
  // reply describes it, with the model beside the thread rather than inside
  // it. Reading only the notification reported null for all three.
  const session = mapCodexAppServerStream(readFileSync(`${FIXTURES}appserver_tools.jsonl`, "utf8")).flatMap(
    (event) => (event.payload.type === "session_started" ? [event.payload.session] : []),
  )
  assert.equal(session.length, 1)
  assert.equal(session[0]!.model, "gpt-5.6-luna")
  assert.equal(session[0]!.version, "0.144.1")
  assert.ok((session[0]!.cwd ?? "").length > 0)
})

test("a capability nobody asked about is unreported, not empty", () => {
  // The shared contract reserves null for "this provider cannot report it".
  // Returning `[]` for a method the host never called told a picker the
  // installation has no models.
  assert.equal(codexCapabilities({}).models, null)
  assert.equal(codexCapabilities({}).skills, null)
  // A reply that really came back empty stays empty.
  assert.deepEqual(codexCapabilities({ "model/list": { data: [] } }).models, [])
})
