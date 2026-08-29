/** @responsibility Proves the parser against real Claude Code captures rather than hand-written shapes. */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { AgentEventType, isEvent, type AgentEvent } from "./events"
import { sessionCapabilities } from "./claude/capabilities"
import {
  collectTranscriptRefs,
  parseSubagentMeta,
  parseWorkflowJournal,
  projectSlug,
  sessionLocationOf,
  subagentTranscriptPath,
  workflowAgentTranscriptPath,
} from "./claude/store"
import { TranscriptBuilder } from "./builder"
import { ClaudeStreamMapper, mapClaudeStream } from "./claude/mapper"
import { applyDeltas, buildTranscript, isToolGroup, previewOf } from "./transcript"
import { ClaudeSystemSubtype, ClaudeWireType, parseWireLines } from "./claude/wire"
import { asRecord } from "./json"

const FIXTURES = fileURLToPath(new URL("../../../../../apps/storybook/stories/fixtures/agent-stream/", import.meta.url))

function capture(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

const NAMES = [
  "printed",
  "tools",
  "todos",
  "subagent",
  "failing",
  "websearch",
  "workflow",
  "resume_turn1",
  "resume_turn2",
  "workflow_phases",
  "disk_subagent_a37fefefbc61e13e3",
  "disk_workflow_agent_a35ea63276cd501aa",
] as const

test("every captured line decodes", () => {
  for (const name of NAMES) {
    for (const result of parseWireLines(capture(name))) {
      assert.equal(result.ok, true, `${name}: ${result.ok ? "" : result.reason}`)
    }
  }
})

test("no capture maps to an unreadable event", () => {
  for (const name of NAMES) {
    const bad = mapClaudeStream(capture(name)).filter((event) => event.payload.type === "error")
    assert.deepEqual(
      bad.map((event) => (event.payload.type === "error" ? event.payload.message : "")),
      [],
      name,
    )
  }
})

test("unknown subtypes survive as `unknown` rather than being dropped", () => {
  // The guard is the point: a subtype this build does not model must still
  // reach the log with its raw line attached.
  const events = mapClaudeStream('{"type":"system","subtype":"invented_subtype","session_id":"s"}')
  assert.equal(events.length, 1)
  assert.equal(events[0]!.payload.type, "unknown")
  assert.notEqual(events[0]!.raw, null)
})

test("a plain turn yields text and a completion", () => {
  const events = mapClaudeStream(capture("printed"))
  const { turns } = buildTranscript(events)
  assert.equal(turns.length, 1)
  assert.equal(turns[0]!.finalText?.includes("hello world"), true)
  assert.equal(turns[0]!.completed?.payload.type, "turn_completed")
})

test("streamed deltas join their committed block", () => {
  const events = mapClaudeStream(capture("printed"))
  const buffers = applyDeltas(events)
  const committed = events.find(
    (event): event is AgentEvent & { payload: { type: "assistant_text" } } => event.payload.type === "assistant_text",
  )
  assert.notEqual(committed, undefined)
  const payload = committed!.payload as { type: "assistant_text"; text: string; block: { messageId: string; index: number } | null }
  const preview = previewOf(buffers, payload.block)
  assert.equal(preview, payload.text)
})

test("tool calls pair with their results and carry a derived title", () => {
  const events = mapClaudeStream(capture("tools"))
  const { resultByCallId, abandonedCallIds } = buildTranscript(events)
  const calls = events.filter((event) => event.payload.type === "tool_call_started")
  assert.ok(calls.length > 0)
  for (const call of calls) {
    const payload = call.payload as { type: "tool_call_started"; callId: string; title: string }
    assert.ok(payload.title.length > 0)
    assert.ok(resultByCallId.has(payload.callId), payload.callId)
  }
  assert.equal(abandonedCallIds.size, 0)
})

test("a failed tool result reports the error without its wire framing", () => {
  const events = mapClaudeStream(capture("failing"))
  const results = events.flatMap((event) => (event.payload.type === "tool_call_completed" ? [event.payload.result] : []))
  const failed = results.filter((result) => result.isError || result.text.includes("No such file"))
  assert.ok(failed.length > 0)
  for (const result of failed) assert.equal(result.text.includes("<tool_use_error>"), false)
})

test("TodoWrite is lifted into a plan instead of staying tool input", () => {
  const events = mapClaudeStream(capture("todos"))
  const { plan } = buildTranscript(events)
  assert.ok(plan.length >= 3)
  assert.ok(plan.every((step) => step.content.length > 0))
  // The last publish wins, and by then the work is done.
  assert.ok(plan.some((step) => step.status === "completed"))
})

test("a subagent's own work is filed under the call that spawned it", () => {
  const events = mapClaudeStream(capture("subagent"))
  const { runs, events: main } = buildTranscript(events)
  const agent = runs.find((run) => run.kind === "agent")
  assert.notEqual(agent, undefined)
  assert.equal(agent!.label, "Explore")
  assert.ok(agent!.events.length > 0, "the run should carry its own events")
  assert.equal(agent!.depth, 1)
  // Nothing from inside the run leaks into the main thread.
  assert.equal(main.some((event) => event.agentPath.length > 0), false)
  // The spawning call is still on the main thread, so a row can link to it.
  assert.ok(main.some((event) => event.payload.type === "tool_call_started" && event.payload.callId === agent!.callId))
})

test("a workflow reports progress but no inner events, and the parser says so", () => {
  const events = mapClaudeStream(capture("workflow"))
  const { runs } = buildTranscript(events)
  const workflow = runs.find((run) => run.kind === "workflow")
  assert.notEqual(workflow, undefined)
  assert.equal(workflow!.done, true)
  assert.ok(workflow!.status !== null, "progress lines drive the live status")
  // The limit this proves: a workflow's agents never appear on the stream, so
  // the card is all the visibility there is.
  assert.equal(workflow!.events.length, 0)
})

test("a model swap across a resume is derived from two inits", () => {
  const events = mapClaudeStream(`${capture("resume_turn1")}\n${capture("resume_turn2")}`)
  const { sessions } = buildTranscript(events)
  assert.equal(sessions.length, 2)
  // A resumed process reuses the session id, so the id says nothing about it.
  assert.equal(sessions[0]!.sessionId, sessions[1]!.sessionId)
  assert.equal(sessions[0]!.initIndex, 0)
  assert.equal(sessions[1]!.initIndex, 1)
  const changed = events.filter((event) => event.payload.type === "model_changed")
  assert.equal(changed.length, 1)
})

test("a second init inside one process is not read as a new session", () => {
  // A workflow run emits two inits from the same process, which is why
  // "more than one init" cannot mean "resumed".
  const { sessions } = buildTranscript(mapClaudeStream(capture("workflow")))
  assert.equal(sessions.length, 2)
  assert.equal(sessions[0]!.sessionId, sessions[1]!.sessionId)
  assert.equal(sessions[0]!.model, sessions[1]!.model)
  const changed = mapClaudeStream(capture("workflow")).filter((event) => event.payload.type === "model_changed")
  assert.equal(changed.length, 0, "same model across inits is not a change")
})

test("consecutive same-tool calls collapse into one group", () => {
  const events = mapClaudeStream(capture("todos"))
  const { turns } = buildTranscript(events)
  const groups = turns.flatMap((turn) => turn.work.filter(isToolGroup))
  assert.ok(groups.length > 0)
  for (const group of groups) {
    assert.ok(group.calls.length >= 2)
    assert.ok(group.targets <= group.calls.length)
  }
})

test("sequence numbers are dense and are the only ordering key", () => {
  const events = mapClaudeStream(capture("todos"))
  events.forEach((event, index) => assert.equal(event.seq, index))
  const undated = events.filter((event) => event.ts === null)
  assert.ok(undated.length > 0, "most lines carry no timestamp, which is why seq exists")
})

/**
 * Which wire line a mapped event came from, for the accounting test below and
 * for the raw inspector, which shows the same thing on screen.
 */
function ledger(text: string): { readonly lines: number; readonly events: number; readonly silent: Map<string, number> } {
  const mapper = new ClaudeStreamMapper()
  const silent = new Map<string, number>()
  let events = 0
  let lines = 0
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue
    lines += 1
    const produced = mapper.push(line)
    events += produced.length
    if (produced.length > 0) continue
    const wire = JSON.parse(line) as { type: string; subtype?: string; event?: { type: string; delta?: { type: string } } }
    const key =
      wire.type === "stream_event"
        ? `stream_event/${wire.event!.type}${wire.event!.type === "content_block_delta" ? `/${wire.event!.delta!.type}` : ""}`
        : `${wire.type}${wire.subtype === undefined ? "" : `/${wire.subtype}`}`
    silent.set(key, (silent.get(key) ?? 0) + 1)
  }
  return { lines, events, silent }
}

test("every line that maps to nothing does so for a named reason", () => {
  // The wire is not one event per line and must not be: some lines are state
  // for the mapper, some repeat a fact another line already carries, and one is
  // a steady-state report with nothing to act on. This is the whole list — a
  // new entry appearing here is a line the parser started dropping silently,
  // which is exactly the failure this test exists to catch.
  const ALLOWED = new Set([
    // Opens a message. Its only payload is the id, which becomes the join key
    // for every block frame that follows.
    "stream_event/message_start",
    // Terminal metadata for the message; `result` carries the same facts.
    "stream_event/message_delta",
    "stream_event/message_stop",
    // A signature over a thinking block. Not display content.
    "stream_event/content_block_delta/signature_delta",
    // The steady state of the usage limit, reported constantly with nothing to
    // act on. A reached limit or an overage *does* map.
    "rate_limit_event",
    // A one-line gloss with no `detail` to show.
    "system/task_summary",
  ])

  for (const name of NAMES) {
    const { silent, lines, events } = ledger(capture(name))
    for (const key of silent.keys()) assert.ok(ALLOWED.has(key), `${name}: ${key} mapped to nothing`)
    assert.ok(events > 0)
    assert.ok(events <= lines * 2, `${name}: an event count far above the line count suggests double-mapping`)
  }
})

test("a session's own advertisement is readable for a composer's pickers", () => {
  const capabilities = sessionCapabilities(mapClaudeStream(capture("tools")))
  assert.notEqual(capabilities, null)
  const { commands, skills, agents, tools, mcpServers, plugins } = capabilities!
  // Claude reports every one of these on its stream, so a null here would mean
  // the reader stopped filling a section it can fill.
  assert.ok(
    [commands, skills, agents, tools, mcpServers, plugins].every((section) => section !== null),
    "Claude advertises all of these; none should read as unreported",
  )

  assert.ok(commands!.length > 0)
  assert.ok(skills!.length > 0)
  assert.ok(agents!.includes("Explore"))
  // A skill and a slash command are the same entry seen twice; the command
  // carries the source so a picker can group them rather than list them twice.
  assert.ok(commands!.some((command) => command.source === "skill"))
  // A plugin command is `plugin:command`, which is where the plugin name is.
  assert.ok(commands!.some((command) => command.source === "plugin" && command.plugin !== null))
  // Terminal commands are the session's to advertise but not to run.
  assert.ok(commands!.some((command) => command.source === "terminal"))
  assert.ok(plugins!.length > 0)

  // MCP tools are matched back to their server across the naming mismatch:
  // "example Mail" supplies `mcp__example_Mail__*`.
  const connected = mcpServers!.filter((server) => server.connected)
  assert.ok(connected.length > 0)
  assert.ok(connected.some((server) => server.tools.length > 0), "a connected server should own tools")
  assert.ok(mcpServers!.some((server) => !server.connected), "an unauthenticated server still appears, with its status")
  assert.ok(tools!.some((tool) => tool.kind === "shell"))
  assert.ok(tools!.some((tool) => tool.kind === "mcp" && tool.server !== null))
})

test("tools that arrive in a later init are marked deferred", () => {
  // ToolSearch loads tools on demand, so the list grows between inits — which
  // is why capabilities merge rather than replace.
  const capabilities = sessionCapabilities(mapClaudeStream(capture("todos")))
  assert.notEqual(capabilities, null)
  const first = mapClaudeStream(capture("todos")).find((event) => event.payload.type === "session_started")
  assert.notEqual(first, undefined)
  assert.ok((capabilities!.tools ?? []).length >= (first!.payload as { session: { tools: readonly string[] } }).session.tools.length)
})

test("a workflow's agents are visible through its progress board", () => {
  const { runs } = buildTranscript(mapClaudeStream(capture("workflow")))
  const workflow = runs.find((run) => run.kind === "workflow")
  assert.notEqual(workflow, undefined)

  // No agent writes its own events — that part was true.
  assert.equal(workflow!.events.length, 0)
  // But the board is a real view of them, which is the part that matters.
  assert.equal(workflow!.phases.length, 1)
  const phase = workflow!.phases[0]!
  assert.equal(phase.title, "Greet")
  assert.deepEqual(phase.agents.map((agent) => agent.label), ["hello", "hola", "bonjour"])
  for (const agent of phase.agents) {
    assert.equal(agent.state, "done")
    assert.ok((agent.tokens ?? 0) > 0)
    assert.ok((agent.durationMs ?? 0) > 0)
    assert.ok(agent.promptPreview !== null)
    assert.ok(agent.resultPreview !== null)
  }
  // The last snapshot wins, so a finished run shows results rather than the
  // "start" states the first snapshot carried.
  assert.equal(phase.agents[0]!.resultPreview, "hello")
})

test("a multi-phase workflow keeps its phases in order, including ones not reached", () => {
  const events = mapClaudeStream(capture("workflow_phases"))
  const workflow = buildTranscript(events).runs.find((run) => run.kind === "workflow")
  assert.notEqual(workflow, undefined)
  assert.deepEqual(workflow!.phases.map((phase) => phase.title), ["Greet", "Translate", "Summarize"])
  assert.deepEqual(workflow!.phases.map((phase) => phase.agents.length), [2, 1, 1])
  assert.equal(workflow!.phases[2]!.agents[0]!.resultPreview, "hello, hola, bonjour")

  // Every phase is declared in the first snapshot, before its agents exist —
  // which is what lets a board show what is still to come rather than growing
  // a phase at a time.
  const first = events.find((event) => event.payload.type === "workflow_progress")
  assert.notEqual(first, undefined)
  const phases = (first!.payload as { phases: readonly { title: string; agents: readonly unknown[] }[] }).phases
  assert.equal(phases.length, 3)
  assert.equal(phases[1]!.agents.length, 0, "a phase not reached yet is present and empty")

  // `progress` is a third state alongside `start` and `done`, so a consumer
  // must not treat the set as a two-value flag.
  const states = new Set(
    events.flatMap((event) =>
      event.payload.type === "workflow_progress"
        ? event.payload.phases.flatMap((phase) => phase.agents.map((agent) => agent.state))
        : [],
    ),
  )
  assert.ok(states.has("start") && states.has("progress") && states.has("done"), [...states].join(","))
})

test("a subagent's content is committed but never streamed", () => {
  const events = mapClaudeStream(capture("subagent"))
  const delegated = events.filter((event) => event.agentPath.length > 0)
  assert.ok(delegated.length > 0)

  // The distinction that decides whether a subagent's text can type itself out:
  // it cannot. Every stream frame in the capture is main-thread, so a subagent's
  // prose lands in whole blocks and its liveness has to come from
  // `task_progress` instead of from deltas.
  assert.equal(delegated.some((event) => event.payload.type === "delta"), false)
  assert.ok(delegated.some((event) => event.payload.type === "tool_call_started"))
  assert.ok(delegated.some((event) => event.payload.type === "tool_call_completed"))
})

test("a delegated run's own transcript is on disk, and the same parser reads it", () => {
  // The stream refuses to carry a subagent's conversation, but the CLI writes
  // it down — in the same line shapes, so nothing new is needed to read it.
  const events = mapClaudeStream(capture("disk_subagent_a37fefefbc61e13e3"))
  const kinds = events.map((event) => event.payload.type)
  assert.ok(kinds.includes("user_message"), "the prompt the subagent was given")
  assert.ok(kinds.includes("tool_call_started"), "the calls it made")
  assert.ok(kinds.includes("tool_call_completed"), "and their results")
  assert.ok(kinds.includes("assistant_text"), "and its final message")

  // A workflow agent's transcript sits under its run and reads the same way.
  const agent = mapClaudeStream(capture("disk_workflow_agent_a35ea63276cd501aa"))
  assert.ok(
    agent.some((event) => event.payload.type === "assistant_text" && event.payload.text.includes("bonjour")),
  )
})

test("the wire carries the keys that locate those files", () => {
  const location = {
    projectsDir: "/home/me/.claude/projects",
    cwd: "/tmp/my_app",
    sessionId: "05305b9e-fc43-415a-a09e-870da8ae5f0e",
  }
  // Every character a folder name cannot hold becomes a dash.
  assert.equal(projectSlug("/tmp/my_app"), "-tmp-my-app")

  // `task_id` comes straight off `system/task_started`, so a subagent's
  // transcript is addressable the moment the run starts.
  assert.equal(
    subagentTranscriptPath(location, "a37fefefbc61e13e3"),
    "/home/me/.claude/projects/-tmp-my-app/05305b9e-fc43-415a-a09e-870da8ae5f0e/subagents/agent-a37fefefbc61e13e3.jsonl",
  )
  // A workflow agent's `agentId` comes off the progress board; the `runId` does
  // not appear on the stream at all, which is why records carry their own
  // `taskId` for matching.
  assert.equal(
    workflowAgentTranscriptPath(location, "wf_61e7b0c3-6ad", "a35ea63276cd501aa"),
    "/home/me/.claude/projects/-tmp-my-app/05305b9e-fc43-415a-a09e-870da8ae5f0e/subagents/workflows/wf_61e7b0c3-6ad/agent-a35ea63276cd501aa.jsonl",
  )

  const meta = parseSubagentMeta(readFileSync(`${FIXTURES}disk_subagent_meta.json`, "utf8"))
  assert.notEqual(meta, null)
  assert.equal(meta!.agentType, "Explore")
  // The sidecar names the spawning call, so a file can be matched back to the
  // row that spawned it without trusting the filename.
  assert.equal(meta!.toolUseId, "toolu_01PGAvp4bzwFKMVNZz2Zfwd2")
  assert.equal(meta!.spawnDepth, 1)

  // The journal carries each agent's whole result, where the board previews it.
  const journal = parseWorkflowJournal(readFileSync(`${FIXTURES}disk_workflow_journal.jsonl`, "utf8"))
  const results = journal.filter((entry) => entry.type === "result")
  assert.equal(results.length, 4)
  assert.ok(results.some((entry) => entry.result === "hello"))
})

test("every conversation in a session comes back as a pointer a host can act on", () => {
  const events = mapClaudeStream(capture("subagent"))
  const transcript = buildTranscript(events)
  const session = transcript.session
  assert.notEqual(session, null)

  const location = sessionLocationOf("/home/me/.claude/projects", session!)!
  const refs = collectTranscriptRefs(location, transcript.runs)

  // The main conversation is in the list, so a switcher over "what is open" is
  // one list rather than a special case plus a list.
  assert.equal(refs[0]!.kind, "session")
  assert.ok(refs[0]!.path!.endsWith(`${session!.sessionId}.jsonl`))

  const subagent = refs.find((ref) => ref.kind === "subagent")
  assert.notEqual(subagent, undefined)
  assert.equal(subagent!.resolved, true)
  assert.equal(subagent!.label, "Explore")
  assert.ok(subagent!.path!.endsWith("subagents/agent-a37fefefbc61e13e3.jsonl"))
  // The ref links back to the row that spawned it.
  assert.ok(transcript.runByCallId.has(subagent!.callId!))
})

test("a pointer that cannot be built says what is missing instead of guessing", () => {
  const transcript = buildTranscript(mapClaudeStream(capture("workflow_phases")))
  const location = sessionLocationOf("/home/me/.claude/projects", transcript.session!)!

  // A workflow agent needs a run id, and the stream never carries one.
  const blocked = collectTranscriptRefs(location, transcript.runs).filter((ref) => ref.kind === "workflow_agent")
  assert.equal(blocked.length, 4)
  for (const ref of blocked) {
    assert.equal(ref.resolved, false)
    assert.equal(ref.path, null)
    assert.ok(ref.blockedBy!.includes("workflows"), ref.blockedBy ?? "")
  }

  // Supplying what the host read off disk resolves every one of them.
  const workflow = transcript.runs.find((run) => run.kind === "workflow")!
  const resolved = collectTranscriptRefs(
    location,
    transcript.runs,
    new Map([[workflow.taskId!, "wf_61e7b0c3-6ad"]]),
  ).filter((ref) => ref.kind === "workflow_agent")
  assert.ok(resolved.every((ref) => ref.resolved))
  assert.ok(
    resolved.some((ref) => ref.path!.endsWith("subagents/workflows/wf_61e7b0c3-6ad/agent-a35ea63276cd501aa.jsonl")),
  )
})

/** Compares the two folds on everything a view actually reads. */
function foldShape(transcript: ReturnType<typeof buildTranscript>) {
  return {
    events: transcript.events.map((event) => event.id),
    turns: transcript.turns.map((turn) => ({
      key: turn.key,
      prompt: turn.prompt?.id ?? null,
      completed: turn.completed?.id ?? null,
      finalText: turn.finalText,
      toolCalls: turn.toolCalls,
      usage: turn.usage,
      work: turn.work.map((item) =>
        isToolGroup(item)
          ? { group: item.name, calls: item.calls.map((call) => call.id), targets: item.targets, target: item.target }
          : item.id,
      ),
    })),
    runs: [...transcript.runByCallId.entries()]
      .map(([callId, run]) => ({
        callId,
        taskId: run.taskId,
        kind: run.kind,
        label: run.label,
        status: run.status,
        done: run.done,
        depth: run.depth,
        // Ids, not a count: any misfiling that preserves cardinality — an event
        // landing in the wrong run, or in the right run in the wrong order — is
        // invisible to a length comparison.
        events: run.events.map((event) => event.id),
        description: run.description,
        lastTool: run.lastTool,
        usage: run.usage,
        path: run.path,
        plan: run.plan,
        phases: run.phases.map((phase) => ({ title: phase.title, agents: phase.agents.map((agent) => agent.label) })),
      }))
      .sort((a, b) => a.callId.localeCompare(b.callId)),
    results: [...transcript.resultByCallId.entries()].sort(([a], [b]) => a.localeCompare(b)),
    abandoned: [...transcript.abandonedCallIds].sort(),
    plan: transcript.plan,
    sessions: transcript.sessions.map((session) => [session.model, session.sessionId, session.initIndex]),
    session: transcript.session?.sessionId ?? null,
    asks: transcript.pendingAsks.map((event) => event.id),
    usage: transcript.usage,
  }
}

test("the one-shot fold is the incremental fold, plus tolerance for a shuffled log", () => {
  // `buildTranscript` delegates to `TranscriptBuilder`, so this no longer
  // guards against two implementations drifting — there is one. What it does
  // guard is the delegation itself: that feeding in chunks, out of order, or
  // all at once reaches the same place.
  const events = mapClaudeStream(capture("todos"))
  const shuffled = [...events].reverse()
  assert.deepEqual(foldShape(buildTranscript(shuffled)), foldShape(buildTranscript(events)))

  // And that duplicates in a persisted log are absorbed once rather than
  // counted twice or refused.
  assert.deepEqual(foldShape(buildTranscript([...events, ...events])), foldShape(buildTranscript(events)))
})

test("chunked delivery reaches the same transcript as one push", () => {
  for (const name of NAMES) {
    const events = mapClaudeStream(capture(name))
    for (const live of [false, true]) {
      const builder = new TranscriptBuilder()
      // Fed in chunks rather than all at once, because a live session arrives
      // in chunks and a fold that only works on one big push works by accident.
      for (let index = 0; index < events.length; index += 7) {
        builder.push(events.slice(index, index + 7))
      }
      assert.deepEqual(
        foldShape(builder.snapshot({ live })),
        foldShape(buildTranscript(events, { live })),
        `${name} (live=${live})`,
      )
    }
  }
})

test("a snapshot mid-stream matches folding the same prefix", () => {
  const events = mapClaudeStream(capture("todos"))
  for (let cut = 1; cut <= events.length; cut += 11) {
    const fresh = new TranscriptBuilder()
    fresh.push(events.slice(0, cut))
    assert.deepEqual(
      foldShape(fresh.snapshot({ live: true })),
      foldShape(buildTranscript(events.slice(0, cut), { live: true })),
      `prefix of ${cut}`,
    )
  }
})

test("a replayed tail is absorbed once; a genuinely earlier event is refused", () => {
  const events = mapClaudeStream(capture("printed"))

  // At-least-once delivery re-sends what it already sent. That is the ordinary
  // shape of a reconnect, and it must be idempotent rather than fatal — the
  // alternative is discarding the builder and re-folding, which is the
  // quadratic path, triggered precisely when the connection is flaky.
  const builder = new TranscriptBuilder()
  builder.push(events.slice(0, 5))
  const afterFirst = builder.snapshot({ live: true })
  builder.push(events.slice(2, 5))
  const afterReplay = builder.snapshot({ live: true })
  assert.equal(afterReplay.events.length, afterFirst.events.length)
  assert.equal(afterReplay.revision, afterFirst.revision, "a pure replay advances nothing")

  // An event from before anything this builder has seen cannot be placed: it
  // would land in whichever turn happens to be open, silently. Refusing is the
  // loud failure, and `buildTranscript` is the tolerant path.
  const late = new TranscriptBuilder()
  late.push(events.slice(3, 6))
  assert.throws(() => late.push([events[1]!]), /feed events in order/)
})

/**
 * Every payload variant the model declares, and whether a capture exercises it.
 *
 * Kept by hand against `AgentEventPayload` on purpose: the point is to force a
 * decision when a variant is added. A variant nothing emits is either a gap in
 * the fixtures or dead weight in the union, and both are worth being told
 * about — `turn_started` sat in the union unemitted until this test existed.
 */
const UNCAPTURED: ReadonlyMap<string, string> = new Map([
  ["context_compacted", "needs a session long enough to auto-compact, or a /compact"],
  ["error", "needs an interrupted turn, which headless cannot produce"],
  ["permission_requested", "needs --permission-prompt-tool stdio"],
  ["permission_decided", "needs --permission-prompt-tool stdio"],
  ["permission_denied", "needs a sandbox path refusal or a mode that cannot ask"],
  ["rate_limited", "only emitted when a limit is actually reached"],
  ["model_changed", "derived across two captures; covered by the resume test"],
  // A capability Claude Code does not have: it surfaces edits as ordinary file
  // tool calls. Codex reports them as structure, and covers this in its own
  // suite.
  ["file_edits", "Claude Code reports no structured edits; the Codex captures cover it"],
])

/**
 * Derived, not repeated.
 *
 * A second hand-kept list of the payload kinds is a list that drifts from the
 * union it mirrors; `AgentEventType` is already the inventory, so the coverage
 * check reads it.
 */
const DECLARED: ReadonlySet<string> = new Set(Object.values(AgentEventType))

test("every declared payload variant is either exercised or knowingly uncaptured", () => {
  const emitted = new Set<string>()
  for (const name of NAMES) {
    for (const event of mapClaudeStream(capture(name))) emitted.add(event.payload.type)
  }

  for (const type of emitted) {
    assert.ok(DECLARED.has(type), `${type} is emitted but not in the declared inventory`)
    assert.ok(!UNCAPTURED.has(type), `${type} is listed as uncaptured but a fixture emits it`)
  }
  for (const type of DECLARED) {
    if (emitted.has(type)) continue
    assert.ok(UNCAPTURED.has(type), `${type} is declared, never emitted, and not listed as uncaptured`)
  }
})

test("every emitted event satisfies the envelope contract", () => {
  for (const name of NAMES) {
    const events = mapClaudeStream(capture(name))
    let previous = -1
    for (const event of events) {
      assert.ok(event.id.length > 0, `${name}: empty id`)
      assert.ok(event.sessionId.length > 0, `${name}: empty session id`)
      assert.ok(event.seq > previous, `${name}: seq ${event.seq} did not advance past ${previous}`)
      previous = event.seq
      assert.ok(Array.isArray(event.agentPath), `${name}: agentPath must be a path`)
      assert.ok(event.agentPath.every((step) => typeof step === "string" && step.length > 0))
      assert.notEqual(event.raw, null, `${name}: an event without its line cannot be inspected`)
      assert.ok(event.ts === null || !Number.isNaN(Date.parse(event.ts)), `${name}: unreadable ts`)
    }
  }
})

test("structured payloads carry the fields their consumers switch on", () => {
  for (const name of NAMES) {
    for (const event of mapClaudeStream(capture(name))) {
      const payload = event.payload
      switch (payload.type) {
        case "tool_call_started":
          assert.ok(payload.callId.length > 0, `${name}: a call with no id cannot be paired with its result`)
          assert.ok(payload.name.length > 0)
          assert.ok(payload.title.length > 0, "every call needs something to draw")
          assert.notEqual(payload.input, undefined)
          break
        case "tool_call_completed":
          assert.ok(payload.callId.length > 0)
          assert.equal(typeof payload.result.isError, "boolean")
          assert.equal(typeof payload.result.text, "string")
          break
        case "delta":
          assert.ok(payload.block.messageId.length > 0, `${name}: a delta with no block cannot be joined`)
          assert.ok(payload.block.index >= 0)
          break
        case "session_started":
          assert.ok(payload.session.model === null || payload.session.model.length > 0)
          assert.ok(payload.session.sessionId.length > 0)
          assert.ok(payload.session.initIndex >= 0)
          break
        case "task_started":
          assert.ok(payload.taskId.length > 0)
          assert.ok(["agent", "workflow", "bash", "other"].includes(payload.taskKind))
          break
        case "workflow_progress":
          for (const phase of payload.phases) {
            assert.ok(phase.title.length > 0)
            for (const agent of phase.agents) {
              assert.ok(agent.label.length > 0)
              assert.equal(agent.phaseIndex, phase.index)
            }
          }
          break
        case "plan_updated":
          for (const step of payload.steps) {
            assert.ok(step.content.length > 0)
            assert.ok(["pending", "in_progress", "completed"].includes(step.status))
          }
          break
        case "turn_completed":
          assert.ok(["completed", "interrupted", "error"].includes(payload.status))
          break
        case "unknown":
          assert.ok(payload.wireType.length > 0, "an unknown event must at least name its wire type")
          break
        default:
          break
      }
    }
  }
})

test("the payload vocabulary is one shared set, exposed as values", () => {
  const named = new Set<string>(Object.values(AgentEventType))
  // The inventory the coverage test checks and the values consumers reference
  // are the same set — two lists that can drift is one list too many.
  assert.deepEqual([...named].sort(), [...DECLARED].sort())

  for (const name of NAMES) {
    for (const event of mapClaudeStream(capture(name))) {
      assert.ok(named.has(event.payload.type), `${event.payload.type} is emitted but unnamed`)
    }
  }
})

test("the guard narrows without a cast", () => {
  const events = mapClaudeStream(capture("tools"))
  const calls = events.filter((event) => isEvent(event, AgentEventType.ToolCallStarted))
  assert.ok(calls.length > 0)
  // The point of the guard: `payload.callId` is reachable on the filtered
  // array, which a bare `.filter` on a union does not give.
  for (const call of calls) assert.ok(call.payload.callId.length > 0)
})

test("provider vocabularies stay in the wire layer and do not close their sets", () => {
  // Claude's own line kinds are named where they belong — beside its wire
  // shapes, not in the shared contract.
  assert.equal(ClaudeWireType.System, "system")
  assert.equal(ClaudeSystemSubtype.TaskStarted, "task_started")

  // Naming them must not turn an unfamiliar subtype into a dropped line: the
  // set is a checklist of what is handled, not a claim about what exists.
  const events = mapClaudeStream('{"type":"system","subtype":"a_subtype_from_next_release","session_id":"s"}')
  assert.equal(events.length, 1)
  assert.equal(events[0]!.payload.type, AgentEventType.Unknown)
})

test("a malformed line degrades that line, never the stream", () => {
  // Each of these crashed or produced a corrupt event before the wire types
  // stopped being trusted as facts about the bytes.
  const mapper = new ClaudeStreamMapper()

  // A frame whose message object is missing entirely.
  assert.doesNotThrow(() => mapper.push('{"type":"stream_event","event":{"type":"message_start"},"session_id":"s","uuid":"u1"}'))

  // A delta with no index: `BlockRef` is the join key, so no index means no
  // preview at all rather than a ref with an undefined index that merges every
  // block into one.
  const opened = new ClaudeStreamMapper()
  opened.push('{"type":"stream_event","event":{"type":"message_start","message":{"id":"m1"}},"session_id":"s","uuid":"u1"}')
  const unindexed = opened.push('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}},"session_id":"s","uuid":"u2"}')
  assert.deepEqual(unindexed, [])

  // A tool block missing its identity degrades to an unlabelled block rather
  // than a tool_use variant with no name.
  const toolless = new ClaudeStreamMapper()
  toolless.push('{"type":"stream_event","event":{"type":"message_start","message":{"id":"m2"}},"session_id":"s","uuid":"u3"}')
  const started = toolless.push(
    '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"tool_use"}},"session_id":"s","uuid":"u4"}',
  )
  const payload = started[0]?.payload
  assert.equal(payload?.type, "delta")
  assert.equal(payload?.type === "delta" && payload.delta === "block_start" ? payload.blockType : null, "text")
})

test("absent usage is absent, and a non-numeric count is not a number", () => {
  // Zeros here would state something the line never said, and a token gauge
  // reading "0 tokens · $0" for a turn whose accounting was simply missing is
  // worse than reading nothing.
  const missing = mapClaudeStream('{"type":"result","subtype":"success","session_id":"s"}')
  const first = missing[0]!.payload
  assert.equal(first.type, "turn_completed")
  assert.equal(first.type === "turn_completed" ? first.usage : undefined, null)

  // A string where a count belongs must not flow into a field declared number,
  // or a consumer's `input + output` silently concatenates.
  const wrong = mapClaudeStream('{"type":"result","subtype":"success","session_id":"s","usage":{"input_tokens":"1000000"}}')
  const usage = wrong[0]!.payload.type === "turn_completed" ? wrong[0]!.payload.usage : null
  assert.notEqual(usage, null)
  assert.equal(usage!.inputTokens, null)
  assert.equal(usage!.totalTokens, null)
})

test("a delegated run's usage reports a total without inventing a breakdown", () => {
  const events = mapClaudeStream(capture("subagent"))
  const progress = events.find((event) => event.payload.type === "task_progress")
  const usage = progress?.payload.type === "task_progress" ? progress.payload.usage : null
  assert.notEqual(usage, null)
  assert.ok((usage!.totalTokens ?? 0) > 0)
  // The wire reports one figure for a task; the parts stay unknown rather than
  // becoming a confident zero.
  assert.equal(usage!.inputTokens, null)
  assert.equal(usage!.outputTokens, null)
})

/** Builds a small synthetic stream, since the captures cannot produce these shapes. */
function stream(...lines: readonly Record<string, unknown>[]): string {
  return lines.map((line, index) => JSON.stringify({ uuid: `u${index}`, session_id: "s", ...line })).join("\n")
}

function assistantLine(id: string, block: Record<string, unknown>, parent: string | null = null) {
  return {
    type: "assistant",
    parent_tool_use_id: parent,
    message: { id, model: "m", role: "assistant", content: [block] },
  }
}

test("a result un-abandons its call, even when a prompt arrived while it was in flight", () => {
  // A prompt typed into a running turn marks open calls abandoned. If the
  // result then lands, the row is both "will never finish" and holding an
  // answer, and whichever the view checks first decides what the reader sees.
  const events = mapClaudeStream(
    stream(
      { type: "user", message: { role: "user", content: "go" } },
      assistantLine("m1", { type: "tool_use", id: "c1", name: "Bash", input: { command: "sleep 5" } }),
      { type: "user", message: { role: "user", content: "also do this" } },
      { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "done" }] } },
    ),
  )
  const transcript = buildTranscript(events)
  assert.ok(transcript.resultByCallId.has("c1"))
  assert.equal(transcript.abandonedCallIds.has("c1"), false, "a call holding a result is not abandoned")
})

test("a main-thread prompt does not abandon a subagent's open calls", () => {
  const events = mapClaudeStream(
    stream(
      { type: "user", message: { role: "user", content: "go" } },
      assistantLine("m1", { type: "tool_use", id: "task1", name: "Task", input: { description: "explore" } }),
      { type: "system", subtype: "task_started", task_id: "t1", tool_use_id: "task1", task_type: "local_agent", description: "explore" },
      assistantLine("m2", { type: "tool_use", id: "inner1", name: "Bash", input: { command: "ls" } }, "task1"),
      { type: "user", message: { role: "user", content: "another prompt" } },
    ),
  )
  // Live, because that is the only state where the distinction exists: once
  // the process is gone every open call is abandoned regardless of thread.
  const transcript = buildTranscript(events, { live: true })
  // The main thread's prompt says nothing about what a subagent is mid-way
  // through; only its own thread's calls are closed out.
  assert.equal(transcript.abandonedCallIds.has("inner1"), false)
  assert.equal(transcript.abandonedCallIds.has("task1"), true)
})

test("a subagent's plan does not replace the session's", () => {
  const plan = (steps: readonly string[]) => ({
    type: "tool_use",
    id: `todo-${steps[0]}`,
    name: "TodoWrite",
    input: { todos: steps.map((content) => ({ content, status: "pending", activeForm: content })) },
  })
  const events = mapClaudeStream(
    stream(
      { type: "user", message: { role: "user", content: "go" } },
      assistantLine("m1", plan(["MAIN step"])),
      assistantLine("m2", { type: "tool_use", id: "task1", name: "Task", input: { description: "explore" } }),
      { type: "system", subtype: "task_started", task_id: "t1", tool_use_id: "task1", task_type: "local_agent", description: "explore" },
      assistantLine("m3", plan(["SUBAGENT step"]), "task1"),
    ),
  )
  const transcript = buildTranscript(events)
  assert.deepEqual(transcript.plan.map((step) => step.content), ["MAIN step"])
  // The delegated plan is not lost — it belongs to the run that made it.
  assert.deepEqual(
    transcript.runByCallId.get("task1")?.plan.map((step) => step.content),
    ["SUBAGENT step"],
  )
})

test("TodoWrite's republishing shape is supported alongside the incremental one", () => {
  // No capture uses TodoWrite — the CLI moved to TaskCreate/TaskUpdate — so the
  // republishing branch is only covered here. Both shapes are supported because
  // a consumer may be reading an older CLI's log.
  const events = mapClaudeStream(
    stream(
      assistantLine("m1", {
        type: "tool_use",
        id: "t1",
        name: "TodoWrite",
        input: {
          todos: [
            { content: "first", status: "completed", activeForm: "Doing first" },
            { content: "second", status: "in_progress", activeForm: "Doing second" },
          ],
        },
      }),
    ),
  )
  const { plan } = buildTranscript(events)
  assert.deepEqual(plan.map((step) => [step.content, step.status]), [
    ["first", "completed"],
    ["second", "in_progress"],
  ])
})

test("a text block the CLI fed back does not open a turn of its own", () => {
  // Only the bare-string shape is a human prompt. An array text block is the
  // CLI feeding the model — a delegated brief, an injected reminder — and
  // treating it as a prompt puts text the reader never wrote in a turn header.
  const events = mapClaudeStream(
    stream(
      { type: "user", message: { role: "user", content: "the only real prompt" } },
      assistantLine("m1", { type: "tool_use", id: "c1", name: "Bash", input: { command: "ls" } }),
      { type: "user", message: { role: "user", content: [{ type: "text", text: "an injected reminder" }] } },
      { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "ok" }] } },
    ),
  )
  const { turns } = buildTranscript(events)
  assert.equal(turns.length, 1)
  assert.equal(turns[0]!.prompt?.payload.type === "user_message" ? turns[0]!.prompt.payload.text : null, "the only real prompt")
})

test("a subagent's stream frames do not hijack the main thread's block join", () => {
  const events = mapClaudeStream(
    stream(
      { type: "stream_event", event: { type: "message_start", message: { id: "mMain" } } },
      { type: "stream_event", parent_tool_use_id: "task1", event: { type: "message_start", message: { id: "mSub" } } },
      { type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "main text" } } },
      assistantLine("mMain", { type: "text", text: "main text" }),
    ),
  )
  const committed = events.find((event) => event.payload.type === "assistant_text")!
  const block = committed.payload.type === "assistant_text" ? committed.payload.block : null
  assert.equal(block?.messageId, "mMain")
  // The preview must reconcile with the committed block; before the mapper kept
  // one open message per thread, it was filed under the subagent's message.
  assert.equal(previewOf(applyDeltas(events), block), "main text")
})

test("a replayed committed line is absorbed once", () => {
  const line = JSON.stringify({
    uuid: "same-uuid",
    session_id: "s",
    ...assistantLine("mX", { type: "text", text: "hi" }),
  })
  const events = mapClaudeStream(`${line}\n${line}`)
  // Counting the block twice would shift every later index in that message and
  // break the delta join with no error anywhere.
  assert.equal(events.filter((event) => event.payload.type === "assistant_text").length, 1)
})

test("only the trailing duplicate of the final message is dropped", () => {
  const events = mapClaudeStream(
    stream(
      { type: "user", message: { role: "user", content: "go" } },
      assistantLine("m1", { type: "text", text: "Done." }),
      assistantLine("m2", { type: "tool_use", id: "c1", name: "Bash", input: { command: "ls" } }),
      { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "ok" }] } },
      assistantLine("m3", { type: "text", text: "Done." }),
      { type: "result", subtype: "success", session_id: "s", result: "Done.", duration_ms: 1, num_turns: 1 },
    ),
  )
  const turn = buildTranscript(events).turns[0]!
  // The agent said "Done." twice; `finalText` repeats only the last one, so the
  // mid-turn message stays — it is a thing that was said, not a duplicate.
  const texts = turn.work.filter((item) => !isToolGroup(item) && item.payload.type === "assistant_text")
  assert.equal(texts.length, 1)
  assert.equal(turn.finalText, "Done.")
})

test("an unreadable line still names the session it arrived on", () => {
  const events = mapClaudeStream(
    `${JSON.stringify({ type: "system", subtype: "init", session_id: "s1", model: "m", cwd: "/tmp", uuid: "u0" })}\n{ truncated`,
  )
  const error = events.find((event) => event.payload.type === "error")
  assert.notEqual(error, undefined)
  assert.equal(error!.sessionId, "s1")
})

/**
 * The skill file is documentation, and documentation rots. These assertions are
 * the cheap half of the cure: they do not check the prose, they check that
 * every *file* and *concept* the skill sends a reader to still exists, so a
 * rename cannot silently turn the guide into a set of dead ends.
 *
 * Deliberately not a check of signatures or field names — the skill states no
 * signatures precisely so it cannot drift with them. If a future skill needs
 * that level of detail, generate it rather than writing it down.
 */
test("the skill points at files that exist", () => {
  const skill = readFileSync(fileURLToPath(new URL("../../../../../skills/agent-stream/SKILL.md", import.meta.url)), "utf8")

  const referenced = [...skill.matchAll(/`([\w./*-]+\.(?:ts|jsonl|md))`/g)].map((match) => match[1]!)
  assert.ok(referenced.length > 0, "the skill should send the reader somewhere")

  const roots = [
    fileURLToPath(new URL(".", import.meta.url)),
    fileURLToPath(new URL("../../../../../", import.meta.url)),
  ]
  for (const path of new Set(referenced)) {
    // A glob points at a directory of captures; anything else is a real file.
    const target = path.includes("*") ? path.slice(0, path.lastIndexOf("/")) : path
    assert.ok(
      roots.some((root) => existsSync(`${root}${target}`)),
      `the skill references ${path}, which no longer exists`,
    )
  }
})

test("the skill's frontmatter is the shape a skill loader reads", () => {
  const skill = readFileSync(fileURLToPath(new URL("../../../../../skills/agent-stream/SKILL.md", import.meta.url)), "utf8")
  const frontmatter = /^---\n([\s\S]+?)\n---/.exec(skill)?.[1]
  assert.notEqual(frontmatter, undefined, "a skill without frontmatter is never loaded")
  assert.match(frontmatter!, /^name: [a-z][a-z0-9-]*$/m)
  // The description is what decides whether the skill is reached for at all, so
  // a one-word one is a skill nobody finds.
  const description = /^description: (.+)$/m.exec(frontmatter!)?.[1]
  assert.ok((description?.length ?? 0) > 80, "the description must say when to use the skill, not just what it is")
})

test("a tool result made only of non-text blocks keeps its content in the sidecar", () => {
  // `ToolSearch` answers with `tool_reference` blocks and no prose, so
  // flattening to text gives an empty string — correct, and the reason a
  // consumer must read `structured` rather than assume `text` carries
  // everything a call returned.
  const transcript = buildTranscript(mapClaudeStream(capture("websearch")))
  const results = [...transcript.resultByCallId.values()]
  const blocksOnly = results.filter((result) => result.text === "")
  assert.ok(blocksOnly.length > 0, "this capture contains a result with no text blocks")
  for (const result of blocksOnly) {
    assert.notEqual(result.structured, null, "the sidecar is where such a result survives")
    assert.equal(result.isError, false)
  }

  // And the search itself does return prose, so the two shapes coexist in one
  // capture — which is why the flattening cannot assume either.
  assert.ok(results.some((result) => result.text.includes("Web search results")))
})

test("reasoning reaches the transcript as its own kind, even when its text is withheld", () => {
  const events = mapClaudeStream(capture("tools"))
  const reasoning = events.filter((event) => event.payload.type === "reasoning")
  assert.ok(reasoning.length > 0)
  for (const event of reasoning) {
    const payload = event.payload as { type: "reasoning"; text: string; block: unknown }
    // Empty on purpose, and the common case: the model signs a thinking block
    // without disclosing it, so the event says reasoning *happened* while
    // carrying nothing to read. A consumer must render that as a step rather
    // than assume text.
    assert.equal(typeof payload.text, "string")
    // The block ref is still there, so a streamed preview is superseded the
    // same way prose is.
    assert.notEqual(payload.block, null)
  }

  // Where a model does disclose it, the text arrives on the same payload.
  const disclosed = mapClaudeStream(capture("resume_turn2")).filter((event) => event.payload.type === "reasoning")
  assert.ok(disclosed.some((event) => (event.payload as { text: string }).text.length > 0))
  // And it is not also emitted as assistant text, which would print the
  // agent's private reasoning as its answer.
  const answers = events.filter((event) => event.payload.type === "assistant_text")
  const reasoningText = new Set(reasoning.map((event) => (event.payload as { text: string }).text))
  assert.ok(answers.every((event) => !reasoningText.has((event.payload as { text: string }).text)))
})

test("the session's own reports carry what a status surface needs", () => {
  // These are the lines that say what the agent is doing between turns. None
  // of them draws a transcript row, which is why they are easy to leave
  // half-mapped — a sweep that only checks they parse would not notice.
  const events = mapClaudeStream(capture("todos"))

  const hooks = events.flatMap((event) => (event.payload.type === "hook" ? [event.payload] : []))
  assert.ok(hooks.length > 0)
  assert.ok(hooks.some((hook) => hook.phase === "started"))
  assert.ok(hooks.some((hook) => hook.phase === "finished" && hook.name.length > 0))

  const status = events.flatMap((event) => (event.payload.type === "status_changed" ? [event.payload] : []))
  assert.ok(status.some((entry) => entry.status !== null))

  const thinking = events.flatMap((event) => (event.payload.type === "thinking_progress" ? [event.payload] : []))
  assert.ok(thinking.length > 0)
  assert.ok(thinking.every((entry) => entry.tokens >= 0))
  // The estimate grows while a block is produced; a counter that never moved
  // would be a figure nobody could use.
  assert.ok(Math.max(...thinking.map((entry) => entry.tokens)) > Math.min(...thinking.map((entry) => entry.tokens)))

  const summary = events.flatMap((event) => (event.payload.type === "post_turn_summary" ? [event.payload] : []))
  assert.ok(summary.every((entry) => entry.detail.length > 0))
})

test("background tasks are republished whole, which is half of whether a session is idle", () => {
  const events = mapClaudeStream(capture("workflow"))
  const sets = events.flatMap((event) =>
    event.payload.type === "background_tasks_changed" ? [event.payload.tasks] : [],
  )
  assert.ok(sets.length > 1, "the set is republished on every change")
  // A turn's result can land while tasks are still open, so an empty set is a
  // meaningful state rather than an absence — it is what says the work drained.
  assert.ok(sets.some((tasks) => tasks.length > 0))
  assert.ok(sets.some((tasks) => tasks.length === 0))
  for (const tasks of sets) {
    for (const task of tasks) assert.ok(task.taskId.length > 0 && task.description.length > 0)
  }
})

test("an activity line names what the agent is doing right now", () => {
  const events = mapClaudeStream(capture("subagent"))
  const activity = events.flatMap((event) => (event.payload.type === "activity" ? [event.payload.detail] : []))
  assert.ok(activity.length > 0)
  assert.ok(activity.every((detail) => detail.length > 0), "an activity with no detail is dropped, not emitted blank")
})

/**
 * Approvals are the one part of the wire that is a conversation rather than a
 * broadcast: the harness blocks, asks, and will not proceed until answered.
 * These two captures are real runs against a sandbox whose settings escalate
 * Bash, recorded once answering allow and once answering deny.
 */
test("an approval ask carries everything needed to answer it", () => {
  const events = mapClaudeStream(capture("approval_allow"))
  const asks = events.flatMap((event) => (event.payload.type === "permission_requested" ? [event.payload] : []))
  assert.equal(asks.length, 1)
  const [ask] = asks
  // The id is what an answer is addressed to, and the call id is what ties the
  // ask to the tool row already on screen.
  assert.ok(ask.requestId.length > 0)
  assert.ok(ask.callId.startsWith("toolu_"))
  assert.equal(ask.toolName, "Bash")
  // Without the input there is nothing to approve: this is the text a person
  // reads before deciding.
  assert.equal(asRecord(ask.input).command, "echo approved-and-ran")
  // The harness says why it escalated. It sends `decision_reason_type`, not
  // `decision_reason` — reading the documented name alone returned null here,
  // which is exactly the kind of thing only a capture catches.
  assert.equal(ask.reason, "rule")
  assert.equal(ask.displayName, "Bash")
  assert.ok((ask.description ?? "").length > 0)
})

test("a decision records which way it went, not merely that it happened", () => {
  for (const [name, expected] of [["approval_allow", "allow"], ["approval_deny", "deny"]] as const) {
    const events = mapClaudeStream(capture(name))
    const asks = events.flatMap((event) => (event.payload.type === "permission_requested" ? [event.payload] : []))
    const decisions = events.flatMap((event) => (event.payload.type === "permission_decided" ? [event.payload] : []))
    assert.equal(decisions.length, 1, name)
    assert.equal(decisions[0].decision, expected, name)
    // Every ask is retired by a decision addressed to it. A pending ask with no
    // matching id is a stuck session, so the join has to hold.
    assert.equal(decisions[0].requestId, asks[0].requestId, name)
    // Control frames carry no timestamp of their own — both directions of the
    // ask arrive with a null `ts`. Ordering here rests on `seq` alone, which is
    // why `seq` and not time is the ordering key.
    const control = events.filter((event) => event.payload.type === "permission_requested" || event.payload.type === "permission_decided")
    assert.ok(control.every((event) => event.ts === null), name)
    assert.ok(control[0].seq < control[1].seq, name)
  }
})

test("a refusal reaches the model as a failed tool result, and the turn still succeeds", () => {
  const events = mapClaudeStream(capture("approval_deny"))
  const ask = events.flatMap((event) => (event.payload.type === "permission_requested" ? [event.payload] : []))[0]
  const decision = events.flatMap((event) => (event.payload.type === "permission_decided" ? [event.payload] : []))[0]
  // The reason given for the refusal is not decoration: it is handed to the
  // model verbatim as the tool's error text, which is how the agent knows to
  // stop rather than retry.
  assert.equal(decision.message, "The operator declined this command.")
  const failed = events.flatMap((event) =>
    event.payload.type === "tool_call_completed" && event.payload.result.isError ? [event.payload.result] : [],
  )
  assert.equal(failed.length, 1)
  assert.equal(failed[0].text, decision.message)

  // A refused tool is not a failed run. The result line reports success, and
  // the refusal is recorded separately — drawing the turn as an error here
  // would be wrong.
  const result = events.flatMap((event) => (event.payload.type === "turn_completed" ? [event.payload] : []))[0]
  assert.equal(result.status, "completed")
  // The refusal is reported on the result too, which is what lets a transcript
  // rebuilt from the result alone still show that something was declined.
  assert.equal(result.permissionDenials.length, 1)
  const [denial] = result.permissionDenials
  assert.equal(denial.toolName, "Bash")
  // Reported under the same call id the ask used, so the two join up.
  assert.equal(denial.callId, ask.callId)
  assert.equal(asRecord(denial.input).command, "echo approved-and-ran")

  // And the transcript ends with the agent explaining the refusal rather than
  // with a dangling call.
  const transcript = buildTranscript(events)
  const last = transcript.turns[transcript.turns.length - 1]
  assert.equal(last.toolCalls, 1)
  assert.ok((last.finalText ?? "").includes("declined"))
})

test("the allowed run reaches the same place by the other road", () => {
  const events = mapClaudeStream(capture("approval_allow"))
  const results = events.flatMap((event) => (event.payload.type === "tool_call_completed" ? [event.payload.result] : []))
  assert.equal(results.length, 1)
  assert.equal(results[0].isError, false)
  assert.equal(results[0].text, "approved-and-ran")
  const finished = events.flatMap((event) => (event.payload.type === "turn_completed" ? [event.payload] : []))[0]
  assert.equal(finished.permissionDenials.length, 0)
})

/**
 * Compaction is the shape a long session cannot avoid, and the only one that
 * silently removes what a consumer has already drawn. The capture is a Haiku
 * run forced over the window by reading a generated corpus; the corpus bodies
 * are elided in the fixture because they are machine filler with nothing to
 * assert, and every line, field and count around them is untouched.
 */
test("a compaction boundary reports what the agent can no longer see", () => {
  const events = mapClaudeStream(capture("compaction"))
  const boundaries = events.flatMap((event) => (event.payload.type === "context_compacted" ? [event.payload] : []))
  assert.equal(boundaries.length, 2, "a long enough session compacts more than once")

  for (const boundary of boundaries) {
    assert.equal(boundary.trigger, "auto")
    // The window shrinks. A boundary that did not shrink it would be a summary
    // that failed, and drawing it as a success would be wrong.
    assert.ok((boundary.preTokens ?? 0) > (boundary.postTokens ?? 0))
    // Compaction is itself a model call, and a slow one — tens of seconds here.
    // A view that blocks on it without saying why looks hung.
    assert.ok((boundary.durationMs ?? 0) > 1000)
  }

  // Dropped tokens accumulate across the session rather than resetting per
  // boundary, which is what makes the figure meaningful in a long run.
  const dropped = boundaries.map((boundary) => boundary.droppedTokens ?? 0)
  assert.ok(dropped[0] > 0)
  assert.ok(dropped[1] > dropped[0])
})

test("the transcript survives its own history being dropped", () => {
  const events = mapClaudeStream(capture("compaction"))
  // Compaction removes history from the *model*, not from the transcript. The
  // work already drawn stays drawn — a consumer that trimmed its own view to
  // match would delete what the user is reading.
  const transcript = buildTranscript(events)
  const calls = events.filter((event) => event.payload.type === "tool_call_completed")
  assert.equal(calls.length, 15)
  assert.equal(transcript.turns[transcript.turns.length - 1].toolCalls, calls.length)

  // And the run still ends normally: a compacted session is not a failed one.
  const finished = events.flatMap((event) => (event.payload.type === "turn_completed" ? [event.payload] : []))
  assert.equal(finished.length, 1)
  assert.equal(finished[0].status, "completed")
})
