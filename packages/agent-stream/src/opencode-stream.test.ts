/** @responsibility Proves the opencode provider against real captures, and that the shared layer needed nothing to accept it. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { TranscriptBuilder } from "./transcript/builder"
import { AgentEventType, isEvent } from "./events"
import { OPENCODE_CAPABILITY_COMMANDS, opencodeCapabilities } from "./opencode/capabilities"
import { mapAcpStream } from "./acp/mapper"
import { OpencodeToolName, opencodeToolKind } from "./opencode/parts"
import { OPENCODE_RUN_MAPPING, opencodeMappingFor, opencodeWireKind } from "./opencode/run/mapping"
import { OpencodeRunMapper, mapOpencodeStream } from "./opencode/run/mapper"
import { OPENCODE_RUN_PROVENANCE, OpencodeRunType, parseOpencodeLines } from "./opencode/run/wire"
import { OPENCODE_SERVER_MAPPING } from "./opencode/server/mapping"
import { OpencodeServerMapper, mapOpencodeServerStream } from "./opencode/server/mapper"
import { OPENCODE_SERVER_PROVENANCE, parseOpencodeSse, parseOpencodeSseLine } from "./opencode/server/wire"
import { AGENT_TRANSPORTS, transportOf, transportsOf } from "./transports"
import { opencodeExportCommand, parseOpencodeExport } from "./opencode/store"
import { applyDeltas, buildTranscript, isToolGroup, previewOf } from "./transcript/fold"

const FIXTURES = fileURLToPath(
  new URL("../../../apps/storybook/stories/fixtures/agent-stream/opencode/", import.meta.url),
)

function capture(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

const NAMES = [
  "printed",
  "tools",
  "todos",
  "failing",
  "subagent",
  "rejected",
  "websearch",
  "overflow",
  "resume_turn1",
  "resume_turn2",
] as const

/** Every capture of the server's bus, and of ACP, so the sweeps cover all three wires. */
const SSE_NAMES = ["sse_printed", "sse_tools", "sse_plan", "sse_subagent", "sse_websearch"] as const
const ACP_NAMES = ["acp_printed", "acp_tools", "acp_permission", "acp_plan", "acp_subagent", "acp_websearch"] as const

test("every captured line decodes", () => {
  for (const name of NAMES) {
    for (const result of parseOpencodeLines(capture(name))) {
      assert.equal(result.ok, true, `${name}: ${result.ok ? "" : result.reason}`)
    }
  }
})

test("no capture maps to an unreadable event", () => {
  for (const name of NAMES) {
    // `overflow` is a capture *of* a failure — the agent really did get a 504 —
    // so an error event there is the recording, not a parser giving up.
    if (name === "overflow") continue
    const bad = mapOpencodeStream(capture(name)).filter((event) => event.payload.type === AgentEventType.Error)
    assert.deepEqual(
      bad.map((event) => (event.payload.type === "error" ? event.payload.message : "")),
      [],
      name,
    )
  }
})

test("every line kind the captures contain is declared in the mapping table", () => {
  // The table is the provider-to-contract translation; a kind missing from it
  // is a line nobody decided about.
  for (const name of NAMES) {
    for (const result of parseOpencodeLines(capture(name))) {
      if (!result.ok) continue
      const kind = opencodeWireKind(result.line)
      assert.notEqual(opencodeMappingFor(kind), null, `${name}: ${kind} is not in OPENCODE_EVENT_MAPPING`)
    }
  }
})

test("what the mapper emits is what the table promises", () => {
  for (const name of NAMES) {
    const mapper = new OpencodeRunMapper()
    for (const result of parseOpencodeLines(capture(name))) {
      if (!result.ok) continue
      const kind = opencodeWireKind(result.line)
      const entry = opencodeMappingFor(kind)!
      const declared = new Set<string>([...entry.emits, AgentEventType.SessionStarted])
      for (const event of mapper.map(result.line)) {
        assert.ok(declared.has(event.payload.type), `${name}: ${kind} emitted an undeclared ${event.payload.type}`)
      }
    }
  }
})

test("an unlisted tool still renders as a call", () => {
  // Every opencode install loads its own plugins and MCP servers, so a tool
  // name this build has never seen is the normal case, not an oversight. It
  // must fall back to the bare tool row rather than falling off the table.
  const entry = opencodeMappingFor(`${OpencodeRunType.ToolUse}/some_plugin_tool`)
  assert.notEqual(entry, null)
  assert.deepEqual([...entry!.emits], [AgentEventType.ToolCallStarted, AgentEventType.ToolCallCompleted])
})

test("every event carries the envelope the contract requires", () => {
  for (const name of NAMES) {
    let previous = -1
    for (const event of mapOpencodeStream(capture(name))) {
      assert.equal(typeof event.id, "string", name)
      assert.ok(event.sessionId.length > 0, name)
      assert.ok(Array.isArray(event.agentPath), name)
      assert.notEqual(event.raw, undefined, name)
      // `seq` is the ordering key, so it has to actually order.
      assert.ok(event.seq > previous, `${name}: seq went backwards at ${event.payload.type}`)
      previous = event.seq
    }
  }
})

test("a payload narrows to the arm its type names", () => {
  const events = mapOpencodeStream(capture("printed"))
  const text = events.find((event) => isEvent(event, AgentEventType.AssistantText))
  assert.notEqual(text, undefined)
  // The guard is what lets a consumer read `payload.text` without a cast.
  assert.equal(text!.payload.text, "hello world.")
})

test("the session is announced although opencode never announces one", () => {
  const events = mapOpencodeStream(capture("printed"))
  const started = events.filter((event) => event.payload.type === "session_started")
  // opencode publishes no init line at all: the id rides on every event. The
  // mapper says so once, so a consumer gets the same opening event the other
  // providers send.
  assert.equal(started.length, 1)
  const payload = started[0]!.payload as {
    type: "session_started"
    session: { sessionId: string; model: string | null; cwd: string | null }
  }
  assert.ok(payload.session.sessionId.startsWith("ses_"))
  // And everything the wire does not say stays null rather than becoming a
  // placeholder that states something nobody reported.
  assert.equal(payload.session.model, null)
  assert.equal(payload.session.cwd, null)
})

test("a turn ends once, although a tool loop finishes a step per call", () => {
  const events = mapOpencodeStream(capture("tools"))
  const finished = events.filter((event) => event.payload.type === "turn_completed")
  // Three tool calls means several `step_finish` lines, and only the last one
  // stops for its own sake. Treating each step as a turn would break one answer
  // into four.
  const steps = parseOpencodeLines(capture("tools")).filter(
    (result) => result.ok && result.line.type === OpencodeRunType.StepFinish,
  )
  assert.ok(steps.length > 1, "the capture really does finish several steps")
  assert.equal(finished.length, 1)

  const transcript = buildTranscript(events)
  assert.equal(transcript.turns.length, 1)
  assert.equal(transcript.turns[0]!.toolCalls, 3)
})

test("a tool call opens and closes on one line", () => {
  const events = mapOpencodeStream(capture("tools"))
  const started = events.filter((event) => event.payload.type === "tool_call_started")
  const completed = events.filter((event) => event.payload.type === "tool_call_completed")
  // opencode publishes a call once it has settled, carrying input and result
  // together. Emitting only the completion would leave a row that never opened,
  // so both are emitted and simply share a line.
  assert.equal(started.length, completed.length)
  assert.ok(started.length > 0)
  for (const [index, open] of started.entries()) {
    const openPayload = open.payload as { type: "tool_call_started"; callId: string }
    const closePayload = completed[index]!.payload as { type: "tool_call_completed"; callId: string }
    assert.equal(openPayload.callId, closePayload.callId)
    assert.ok(open.seq < completed[index]!.seq)
  }
})

test("a command that ran and failed is an error, even though its call succeeded", () => {
  const events = mapOpencodeStream(capture("failing"))
  const results = events.flatMap((event) =>
    event.payload.type === "tool_call_completed" ? [event.payload.result] : [],
  )
  assert.equal(results.length, 1)
  // This is the trap in opencode's shape: the call settles as `completed`
  // because the tool itself worked, and the failure is only in
  // `metadata.exit`. Reading the status alone would draw every failed build as
  // a success.
  assert.equal(results[0]!.isError, true)
  const metadata = results[0]!.structured as { exit?: number } | null
  assert.equal(metadata?.exit, 1)
})

test("a refused call is an error, and the run simply ends", () => {
  const events = mapOpencodeStream(capture("rejected"))
  const results = events.flatMap((event) =>
    event.payload.type === "tool_call_completed" ? [event.payload.result] : [],
  )
  assert.equal(results.length, 1)
  assert.equal(results[0]!.isError, true)
  assert.match(results[0]!.text, /rejected permission/i)

  // Unattended, opencode auto-rejects anything its permission rules ask about,
  // and the run then stops without a closing message: no `stop` step, no final
  // text. A consumer sees a turn that never ends, so a surface must not wait
  // for a terminator that is not coming.
  assert.equal(events.filter((event) => event.payload.type === "turn_completed").length, 0)
  assert.equal(events.filter((event) => event.payload.type === "assistant_text").length, 0)

  // Nothing was written, so nothing may be reported as an edit.
  assert.equal(events.filter((event) => event.payload.type === "file_edits").length, 0)
})

test("the plan is republished whole, the shape TodoWrite uses", () => {
  const events = mapOpencodeStream(capture("todos"))
  const updates = events.flatMap((event) => (event.payload.type === "plan_updated" ? [event.payload.steps] : []))
  assert.ok(updates.length > 1, "the list is republished as steps complete")
  const last = updates[updates.length - 1]!
  assert.ok(last.length > 0)
  assert.ok(last.every((step) => ["pending", "in_progress", "completed"].includes(step.status)))
  // Latest wins: the transcript holds one plan, not the concatenation of every
  // republish.
  const transcript = buildTranscript(events)
  assert.deepEqual(
    transcript.plan.map((step) => step.content),
    last.map((step) => step.content),
  )
  assert.ok(transcript.plan.every((step) => step.status === "completed"))
})

test("a delegation names the child's own transcript, which the other two never do", () => {
  const events = mapOpencodeStream(capture("subagent"))
  const started = events.flatMap((event) => (event.payload.type === "task_started" ? [event.payload] : []))
  assert.equal(started.length, 1)
  const task = started[0]!
  assert.equal(task.taskKind, "agent")
  // The agent is named on the call's own input, so a delegation can be
  // labelled before it returns.
  assert.equal(task.label, "explore")
  assert.ok((task.prompt ?? "").length > 0)
  // The one capability opencode has over both others: the child session id is
  // on the wire, and `opencode export <id>` reads it. Delegated work here is
  // readable, not merely watchable.
  assert.ok(task.transcriptId?.startsWith("ses_"))
  assert.notEqual(task.transcriptId, events[0]!.sessionId, "the child is its own session, not this one")

  const completed = events.flatMap((event) => (event.payload.type === "task_completed" ? [event.payload] : []))
  assert.equal(completed.length, 1)
  assert.equal(completed[0]!.taskId, task.taskId)
  assert.ok((completed[0]!.summary ?? "").length > 0)
})

test("a write publishes the path it touched, and nothing about the text", () => {
  const events = mapOpencodeStream(capture("tools"))
  const edits = events.flatMap((event) => (event.payload.type === "file_edits" ? event.payload.edits : []))
  assert.ok(edits.length > 0)
  for (const edit of edits) {
    assert.ok(edit.path.length > 0)
    assert.ok(["add", "update", "delete", "rename"].includes(edit.change))
    // opencode reports which file a call touched, never the change itself, so
    // there is no diff to hand a viewer and none is invented.
    assert.equal(edit.unifiedDiff, null)
  }
})

test("resuming reuses the session id, and the model swap is invisible", () => {
  const first = mapOpencodeStream(capture("resume_turn1"))
  const second = mapOpencodeStream(capture("resume_turn2"))
  // Same session across two processes, exactly as Claude and Codex behave.
  assert.equal(first[0]!.sessionId, second[0]!.sessionId)

  // The second turn ran on a different model, and nothing on the wire says so:
  // opencode names a model only inside a delegation's metadata, never for the
  // session itself. A surface that wants to show it has to be told by its host.
  const swaps = [...first, ...second].filter((event) => event.payload.type === "model_changed")
  assert.equal(swaps.length, 0)
  const sessions = [...first, ...second].flatMap((event) =>
    event.payload.type === "session_started" ? [event.payload.session.model] : [],
  )
  assert.deepEqual(sessions, [null, null])
})

test("every line carries a timestamp, which only opencode does", () => {
  for (const name of NAMES) {
    for (const event of mapOpencodeStream(capture(name))) {
      assert.notEqual(event.ts, null, `${name}: ${event.payload.type}`)
      assert.match(event.ts!, /^\d{4}-\d{2}-\d{2}T/)
    }
  }
})

test("the incremental fold and the one-shot fold agree", () => {
  for (const name of NAMES) {
    const events = mapOpencodeStream(capture(name))
    const builder = new TranscriptBuilder()
    // Fed in chunks, the way a live stream arrives rather than all at once.
    for (let index = 0; index < events.length; index += 3) builder.push(events.slice(index, index + 3))
    const incremental = builder.snapshot()
    const oneShot = buildTranscript(events)
    assert.equal(incremental.turns.length, oneShot.turns.length, name)
    assert.deepEqual(
      incremental.turns.map((turn) => turn.toolCalls),
      oneShot.turns.map((turn) => turn.toolCalls),
      name,
    )
    assert.deepEqual(incremental.plan, oneShot.plan, name)
  }
})

test("the shared fold applies its own grouping rule to this provider unchanged", () => {
  const events = mapOpencodeStream(capture("todos"))
  const transcript = buildTranscript(events)

  // The rule is "consecutive calls to the *same* tool collapse". This capture
  // alternates — todowrite, write, todowrite, write, todowrite, bash — so
  // nothing groups, and that is the rule working rather than failing. Asserting
  // groups here would have forced a special case into the shared fold for a
  // provider whose data simply does not contain a run.
  const names = events.flatMap((event) =>
    event.payload.type === "tool_call_started" ? [event.payload.name] : [],
  )
  assert.ok(names.length > 2)
  assert.ok(
    names.every((name, index) => index === 0 || name !== names[index - 1]),
    "the captured run alternates tools, so there is no run to collapse",
  )
  assert.equal(transcript.turns.flatMap((turn) => turn.work.filter(isToolGroup)).length, 0)

  // And the completions between them, which a reader never sees as a row, do
  // not break a run either: every call still reaches the turn.
  assert.equal(transcript.turns[0]!.toolCalls, names.length)
})

test("capabilities come from the CLI's own listings, and unasked-for ones stay unknown", () => {
  const models = readFileSync(`${FIXTURES}cli_models.txt`, "utf8")
  const agents = readFileSync(`${FIXTURES}cli_agents.txt`, "utf8")
  const capabilities = opencodeCapabilities({ models, agents })

  assert.ok((capabilities.models ?? []).length > 0)
  assert.ok(capabilities.models!.every((model) => model.id.includes("/")), "a model id is only unique with its provider")
  assert.ok(capabilities.agents!.includes("explore"))
  assert.ok(capabilities.agents!.includes("build"))

  // Null, not empty: opencode reports no commands, skills, tools or MCP servers
  // through any listing this reads, and an empty section would tell a picker
  // the session has none of them.
  assert.equal(capabilities.commands, null)
  assert.equal(capabilities.tools, null)
  assert.equal(capabilities.mcpServers, null)
  // Listing what could be used is not the same as naming what is in use.
  assert.equal(capabilities.model, null)

  // A listing the host did not capture is unknown too.
  assert.equal(opencodeCapabilities({}).models, null)
  assert.equal(OPENCODE_CAPABILITY_COMMANDS.length, 2)
})

test("the wire description says which build it was read from", () => {
  // These shapes are not a published contract and opencode stamps no version on
  // its stream, so this constant is the only record of what the fixtures
  // describe. A capture retaken against a newer build updates it.
  assert.equal(OPENCODE_RUN_PROVENANCE.cli, "opencode")
  assert.match(OPENCODE_RUN_PROVENANCE.version, /^\d+\.\d+\.\d+$/)
  assert.match(OPENCODE_RUN_PROVENANCE.capturedOn, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(OPENCODE_RUN_PROVENANCE.command.includes("--format json"))
})

test("the tool vocabulary covers what the captures actually used", () => {
  const used = new Set<string>()
  for (const name of NAMES) {
    for (const result of parseOpencodeLines(capture(name))) {
      if (!result.ok || result.line.type !== OpencodeRunType.ToolUse) continue
      const part = result.line.part as { tool?: string } | undefined
      if (part?.tool !== undefined) used.add(part.tool)
    }
  }
  const known = new Set<string>(Object.values(OpencodeToolName))
  for (const tool of used) {
    assert.ok(known.has(tool), `${tool} was captured but is not named in OpencodeToolName`)
  }
  assert.ok(used.has("bash") && used.has("write") && used.has("task"))
})

/**
 * The second transport.
 *
 * `opencode serve` publishes a different, richer wire over SSE — and it is the
 * only place opencode streams anything. These captures are real sessions driven
 * against a running server.
 */
function acp(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

function sse(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

function mapSse(name: string) {
  // The bus has its own mapper: same contract out, entirely different envelope in.
  return mapOpencodeServerStream(sse(name))
}

test("the server's stream decodes, and every kind of it is in the table", () => {
  for (const name of SSE_NAMES) {
    const results = parseOpencodeSse(sse(name))
    assert.ok(results.length > 0, name)
    for (const result of results) {
      assert.equal(result.ok, true, `${name}: ${result.ok ? "" : result.reason}`)
      if (!result.ok) continue
      // The bus has its own table: separate protocol, separate version.
      assert.notEqual(OPENCODE_SERVER_MAPPING[result.line.type], undefined, `${name}: ${result.line.type}`)
    }
  }
})

test("an SSE frame decodes whether or not it still carries its data: prefix", () => {
  const framed = 'data: {"type":"session.idle","properties":{"sessionID":"ses_x"}}'
  const bare = '{"type":"session.idle","properties":{"sessionID":"ses_x"}}'
  assert.deepEqual(parseOpencodeSseLine(framed), parseOpencodeSseLine(bare))
  // A comment or a keep-alive is not a failure; it is simply not a payload.
  assert.equal(parseOpencodeSseLine(": ping"), null)
  assert.equal(parseOpencodeSseLine(""), null)
})

test("the server streams tokens, which the one-way stream never does", () => {
  const events = mapSse("sse_printed")
  const deltas = events.filter((event) => event.payload.type === "delta")
  assert.ok(deltas.length > 50, "the answer really did arrive a token at a time")

  // Every preview is joinable to the part that will supersede it, which is what
  // lets a surface draw the streamed text and then replace it rather than
  // printing the answer twice.
  const text = events.flatMap((event) =>
    event.payload.type === "assistant_text" && event.payload.block !== null ? [event.payload.block] : [],
  )
  assert.ok(text.length > 0)
  const previewed = applyDeltas(events)
  for (const block of text) {
    assert.notEqual(previewOf(previewed, block), null, "a committed part has a preview to supersede")
  }

  // And the streamed preview says the same thing the committed part does.
  const committed = events.find(
    (event) => event.payload.type === "assistant_text" && (event.payload.text ?? "").length > 40,
  )!
  const payload = committed.payload as { type: "assistant_text"; text: string; block: { messageId: string; index: number } }
  assert.equal(previewOf(previewed, payload.block), payload.text)
})

test("the same session is reported by both transports, and only one of them says the model", () => {
  const fromServer = mapSse("sse_tools").flatMap((event) =>
    event.payload.type === "session_started" ? [event.payload.session] : [],
  )
  assert.equal(fromServer.length, 1)
  // The init the one-way stream never sends: model, working directory, build.
  assert.equal(fromServer[0]!.model, "nemotron-3.5-lightning-free")
  assert.ok((fromServer[0]!.cwd ?? "").length > 0)
  assert.equal(fromServer[0]!.version, "1.18.25")

  // Against the same fields read from `run --format json`, which has none.
  const fromRun = mapOpencodeStream(capture("tools")).flatMap((event) =>
    event.payload.type === "session_started" ? [event.payload.session] : [],
  )
  assert.equal(fromRun[0]!.model, null)
  assert.equal(fromRun[0]!.version, null)
})

test("the bus carries every session on the server, not just the one being watched", () => {
  const events = mapSse("sse_printed")
  const sessions = new Set(events.map((event) => event.sessionId))
  // `GET /event` is server-wide: this capture caught a second session running
  // alongside the first. Every event is therefore stamped with the session that
  // produced it, or a background run's work is filed under the conversation
  // someone is reading.
  assert.ok(sessions.size > 1, "the capture really does carry more than one session")
  const started = events.filter((event) => event.payload.type === "session_started")
  assert.equal(started.length, sessions.size, "each session is announced exactly once")
  for (const event of started) {
    const payload = event.payload as { type: "session_started"; session: { sessionId: string } }
    assert.equal(payload.session.sessionId, event.sessionId)
  }
})

test("the server asks before running what its rules cover, and records the answer", () => {
  const events = mapSse("sse_tools")
  const asks = events.flatMap((event) => (event.payload.type === "permission_requested" ? [event.payload] : []))
  const decisions = events.flatMap((event) => (event.payload.type === "permission_decided" ? [event.payload] : []))
  assert.equal(asks.length, 1)
  assert.equal(decisions.length, 1)

  // The ask names the tool and the call it belongs to, so a surface can attach
  // it to the row already on screen. The wire itself names only the *rule*, so
  // the tool is remembered from the part that opened the call — without that,
  // every ask looked like a call to a tool named `external_directory`.
  assert.equal(asks[0]!.toolName, "write")
  assert.equal(asks[0]!.reason, "external_directory")
  assert.ok(asks[0]!.callId.startsWith("call-"))
  assert.equal(decisions[0]!.requestId, asks[0]!.requestId)
  // opencode says "reject"; one vocabulary reaches the consumer.
  assert.equal(decisions[0]!.decision, "deny")
})

test("going idle is what ends a turn here, not a step finishing", () => {
  const events = mapSse("sse_printed")
  const finished = events.filter((event) => event.payload.type === "turn_completed")
  assert.ok(finished.length > 0)
  for (const event of finished) {
    const payload = event.payload as { type: "turn_completed"; stopReason: string | null }
    assert.equal(payload.stopReason, "idle")
  }

  const statuses = events.flatMap((event) =>
    event.payload.type === "status_changed" ? [event.payload.status] : [],
  )
  // Busy while it works, idle when it stops — the pair a surface needs to know
  // whether anything is happening.
  assert.ok(statuses.includes("busy"))
})

test("the exported subagent session is a readable conversation", () => {
  const exported = parseOpencodeExport(readFileSync(`${FIXTURES}export_subagent.json`, "utf8"))
  assert.notEqual(exported, null)
  const { info, events } = exported!

  // What the parent's stream could not tell us: which agent ran, on what model,
  // under which parent, and what it cost.
  assert.equal(info.agent, "explore")
  assert.ok(info.parentId?.startsWith("ses_"))
  assert.equal(info.model, "nemotron-3.5-lightning-free")
  assert.ok((info.totalTokens ?? 0) > 0)
  assert.notEqual(info.totalCostUsd, null)

  // And it reads as a conversation, prompt included — the one place the
  // question is recoverable, since no opencode stream ever echoes it.
  const prompts = events.filter((event) => event.payload.type === "user_message")
  assert.equal(prompts.length, 1)
  assert.match((prompts[0]!.payload as { text: string }).text, /list all files/i)

  const transcript = buildTranscript(events)
  assert.ok(transcript.turns.length > 0)
  assert.ok(transcript.turns.some((turn) => turn.toolCalls > 0))
  assert.ok((transcript.turns[transcript.turns.length - 1]!.finalText ?? "").length > 0)
})

test("an export is read by the same mapper the live stream uses", () => {
  // Two readers for one conversation would be two sets of rules to disagree
  // with: an opened transcript must look like the session it came from.
  const exported = parseOpencodeExport(readFileSync(`${FIXTURES}export_subagent.json`, "utf8"))!
  let previous = -1
  for (const event of exported.events) {
    assert.equal(event.sessionId, exported.info.sessionId)
    // Ordering rests on `seq`. An exported step-finish carries no time of its
    // own, so a reader that sorted by timestamp would scramble the end of every
    // turn.
    assert.ok(event.seq > previous)
    previous = event.seq
  }
  assert.ok(exported.events.some((event) => event.ts !== null), "the parts that are timed keep their time")
  assert.equal(parseOpencodeExport("not json at all"), null)
  assert.equal(opencodeExportCommand("ses_x"), "opencode export ses_x")
})

/**
 * What a transport can do is data, not something a surface knows.
 *
 * The point of this table is that a fourth provider adds a row and every
 * badge, picker and empty state that reads it follows without being edited.
 */
test("every transport declares what it supports, and what nobody has established", () => {
  const flat = AGENT_TRANSPORTS.flatMap((provider) =>
    provider.transports.map((transport) => ({ provider: provider.id, transport })),
  )
  assert.ok(flat.length >= 6, "three providers, at least two transports each")

  for (const { provider, transport } of flat) {
    // Every transport names the build it was read from, so a consumer can tell
    // whether its parser matches the process it is talking to.
    assert.match(transport.provenance.version, /^\d+\.\d+\.\d+$/, `${provider}/${transport.id}`)
    assert.ok(transport.provenance.command.length > 0)
    assert.ok(transport.note.length > 0)
    for (const [feature, value] of Object.entries(transport.supports)) {
      // Tri-state on purpose: false is a fact, null is an admission.
      assert.ok(
        value === true || value === false || value === null,
        `${provider}/${transport.id}.${feature} is ${String(value)}`,
      )
    }
  }
})

test("the transport table says what the captures show, provider by provider", () => {
  // opencode is the case that forced this to be per transport rather than per
  // provider: the same agent streams on one wire and not on the other.
  assert.equal(transportOf("opencode", "run")?.supports.streaming, false)
  assert.equal(transportOf("opencode", "serve")?.supports.streaming, true)
  assert.equal(transportOf("opencode", "run")?.supports.namesModel, false)
  assert.equal(transportOf("opencode", "serve")?.supports.namesModel, true)
  // And only that bus carries more than one session at a time.
  assert.equal(transportOf("opencode", "serve")?.supports.sharedBus, true)
  assert.equal(transportOf("claude", "stream")?.supports.sharedBus, false)

  // Claude's stdin-open mode is the same wire with different powers.
  assert.equal(transportOf("claude", "stream")?.supports.approvals, false)
  assert.equal(transportOf("claude", "pipe")?.supports.approvals, true)

  // Codex's app-server was driven later and does stream, so what was once
  // unrecorded is now a fact. What stays null is only what nobody has looked
  // at: whether one connection carries more than one thread.
  assert.equal(transportOf("codex", "app-server")?.supports.streaming, true)
  assert.equal(transportOf("codex", "app-server")?.supports.sharedBus, null)
  assert.equal(transportOf("codex", "exec")?.supports.streaming, false)

  assert.equal(transportOf("opencode", "nope"), null)
  assert.equal(transportOf("nope", "run"), null)

  assert.equal(transportsOf("opencode")?.transports.length, 3)
  assert.equal(transportsOf("claude")?.label, "Claude Code")
  assert.equal(transportsOf("nope"), null)
})

test("the two opencode transports are described separately, with their own versions", () => {
  // The whole reason they are separate modules: two protocols, and the server
  // publishes an API version of its own that moves independently of the CLI.
  assert.equal(OPENCODE_RUN_PROVENANCE.command, "opencode run --format json")
  assert.equal(OPENCODE_SERVER_PROVENANCE.apiVersion, "1.0.0")
  assert.equal(OPENCODE_RUN_PROVENANCE.version, OPENCODE_SERVER_PROVENANCE.version)
  assert.notEqual(OPENCODE_RUN_PROVENANCE.command, OPENCODE_SERVER_PROVENANCE.command)

  // Neither table knows the other's vocabulary.
  assert.equal(OPENCODE_RUN_MAPPING["session.idle"], undefined)
  assert.equal(OPENCODE_SERVER_MAPPING[OpencodeRunType.StepStart], undefined)
})

test("the shell tool is named for what the wire calls it, and for what it will be called", () => {
  // opencode's own source implements this as `shell.ts` but exposes the id
  // `bash`, deliberately, for compatibility with saved permissions — with the
  // rename announced for 2.0. Both names map to the same kind so a capture
  // from either build renders identically.
  assert.equal(OpencodeToolName.Bash, "bash")
  assert.equal(OpencodeToolName.Shell, "shell")
  assert.equal(opencodeToolKind("bash"), "shell")
  assert.equal(opencodeToolKind("shell"), "shell")
})
test("no capture of any transport maps to an unreadable event", () => {
  // The sweep that matters most once there are three wires: a frame nobody
  // decided about must not reach a surface as an error.
  for (const name of SSE_NAMES) {
    const bad = mapOpencodeServerStream(sse(name)).filter((event) => event.payload.type === "error")
    assert.deepEqual(bad.map((event) => (event.payload.type === "error" ? event.payload.message : "")), [], name)
  }
  for (const name of ACP_NAMES) {
    const bad = mapAcpStream(acp(name)).filter((event) => event.payload.type === "error")
    assert.deepEqual(bad.map((event) => (event.payload.type === "error" ? event.payload.message : "")), [], name)
  }
})

test("the same scenario is readable on every transport that has it", () => {
  // The point of capturing all three: a consumer writes one renderer, and the
  // same work shows up whichever wire carried it.
  for (const [label, events] of [
    ["run", mapOpencodeStream(capture("todos"))],
    ["serve", mapOpencodeServerStream(sse("sse_plan"))],
    ["acp", mapAcpStream(acp("acp_plan"))],
  ] as const) {
    const plans = events.flatMap((event) => (event.payload.type === "plan_updated" ? [event.payload.steps] : []))
    assert.ok(plans.length > 0, `${label} produced no plan`)
    const last = plans[plans.length - 1]!
    assert.ok(last.length >= 3, label)
    assert.ok(last.every((step) => step.content.length > 0), label)
  }

  for (const [label, events] of [
    ["run", mapOpencodeStream(capture("subagent"))],
    ["serve", mapOpencodeServerStream(sse("sse_subagent"))],
    ["acp", mapAcpStream(acp("acp_subagent"))],
  ] as const) {
    const tasks = events.filter((event) => event.payload.type === "task_started")
    assert.ok(tasks.length > 0, `${label} produced no delegation`)
  }
})

test("web search reaches the transcript on all three wires", () => {
  // opencode's web search is an MCP tool that calls a third-party service, so
  // the result is a search payload rather than prose — on every transport.
  for (const [label, events] of [
    ["run", mapOpencodeStream(capture("websearch"))],
    ["serve", mapOpencodeServerStream(sse("sse_websearch"))],
    ["acp", mapAcpStream(acp("acp_websearch"))],
  ] as const) {
    const calls = events.flatMap((event) => (event.payload.type === "tool_call_started" ? [event.payload] : []))
    assert.ok(calls.length > 0, `${label} ran no search`)
    const results = events.flatMap((event) =>
      event.payload.type === "tool_call_completed" ? [event.payload.result] : [],
    )
    assert.ok(results.some((result) => result.text.length > 0), `${label} returned nothing`)
  }
})

test("opencode does not compact: it runs out of window and fails", () => {
  const events = mapOpencodeStream(capture("overflow"))
  const usage = events.flatMap((event) =>
    event.payload.type === "turn_completed" ? [event.payload.usage?.totalTokens ?? 0] : [],
  )
  const steps = events.filter((event) => event.payload.type === "tool_call_started")
  assert.ok(steps.length > 20, "the capture really is a long run")

  // The context grew past the model's own 200k window — ACP reports that size —
  // and nothing on the wire marked a boundary. Claude compacts here; Codex
  // compacts silently; opencode kept growing until the provider gave up.
  const errors = events.flatMap((event) => (event.payload.type === "error" ? [event.payload.message] : []))
  assert.equal(errors.length, 1)
  assert.match(errors[0]!, /Upstream idle timeout|504/)
  // Read as a string, `error` is an object and every failure reported the word
  // "error"; the message is nested two levels down.
  assert.notEqual(errors[0], "error")
  // The run never completed a turn — all 28 steps end on `tool-calls` — so
  // there is no usage to check here, and saying so is the assertion.
  assert.deepEqual(usage, [])
})

/**
 * A table may only promise what something has seen.
 *
 * One-directional conformance proves a mapper never exceeds its table, not
 * that a declared row is real. Each row no capture reaches is acknowledged
 * here, or the test fails.
 */
const RUN_UNEXERCISED: ReadonlyMap<string, string> = new Map([
  ["reasoning", "these models disclosed none on this wire; the export reader carries the shape"],
  ["user_message", "not on the live stream at all — only an exported session carries the prompt"],
  ["tool_use", "the bare row is the fallback for an unlisted tool, reached by name rather than as an exact key"],
  ["tool_use/edit", "the captures wrote whole files rather than editing in place"],
  ["tool_use/patch", "no capture applied a patch"],
])

test("every opencode run row the captures never reach is acknowledged as unexercised", () => {
  const seen = new Set<string>()
  for (const name of NAMES) {
    for (const result of parseOpencodeLines(capture(name))) {
      if (result.ok) seen.add(opencodeWireKind(result.line))
    }
  }
  const declared = Object.keys(OPENCODE_RUN_MAPPING)
  assert.deepEqual(
    declared.filter((kind) => !seen.has(kind) && !RUN_UNEXERCISED.has(kind)).sort(),
    [],
    "a table row no fixture exercises must be listed in RUN_UNEXERCISED",
  )
  for (const kind of RUN_UNEXERCISED.keys()) {
    assert.ok(declared.includes(kind), `${kind} is listed as unexercised but is not a row in the table`)
    // The `tool_use` row is reached by fallback rather than as an exact key,
    // so it is the one entry a capture legitimately never names.
    if (kind !== "tool_use") {
      assert.ok(!seen.has(kind), `${kind} is listed as unexercised but a fixture reaches it`)
    }
  }
})

const SERVER_UNEXERCISED: ReadonlyMap<string, string> = new Map([
  ["server.heartbeat", "a keep-alive, stripped from the captures as this machine's noise"],
  ["plugin.added", "the installed plugin set is this machine's, so it is stripped from the captures"],
])

test("every opencode server row the captures never reach is acknowledged as unexercised", () => {
  const seen = new Set<string>()
  for (const name of SSE_NAMES) {
    for (const result of parseOpencodeSse(sse(name))) {
      if (result.ok) seen.add(String((result.line as { type?: unknown }).type))
    }
  }
  const declared = Object.keys(OPENCODE_SERVER_MAPPING)
  assert.deepEqual(
    declared.filter((kind) => !seen.has(kind) && !SERVER_UNEXERCISED.has(kind)).sort(),
    [],
    "a table row no fixture exercises must be listed in SERVER_UNEXERCISED",
  )
  for (const kind of SERVER_UNEXERCISED.keys()) {
    assert.ok(declared.includes(kind), `${kind} is listed as unexercised but is not a row in the table`)
    assert.ok(!seen.has(kind), `${kind} is listed as unexercised but a fixture reaches it`)
  }
})

test("a tool call on the bus opens once, however often its part is republished", () => {
  // The bus republishes the same tool part at every status it passes through.
  // Opening the row on each one reported a turn as having run its tools three
  // or four times: `sse_tools` showed eight calls for two, `sse_plan` 23 for 7.
  for (const name of SSE_NAMES) {
    const events = mapOpencodeServerStream(sse(name))
    const started = events.flatMap((event) => (event.payload.type === "tool_call_started" ? [event.payload.callId] : []))
    const completed = events.flatMap((event) =>
      event.payload.type === "tool_call_completed" ? [event.payload.callId] : [],
    )
    assert.equal(new Set(started).size, started.length, `${name}: a call opened more than once`)
    assert.equal(new Set(completed).size, completed.length, `${name}: a call settled more than once`)
    assert.deepEqual(new Set(completed), new Set(completed.filter((id) => started.includes(id))), name)
  }

  // And the turn agrees with the wire: two calls in the tools capture.
  const transcript = buildTranscript(mapOpencodeServerStream(sse("sse_tools")))
  assert.equal(
    transcript.turns.reduce((total, turn) => total + turn.toolCalls, 0),
    2,
  )
})

test("a bus row says what the tool actually ran, not what the first frame knew", () => {
  // The bus opens a call with a `pending` part whose input is `{}` and which
  // has no title. Opening the row there — which deduplicating naively does —
  // produced rows that never said what ran, because nothing revises an open
  // row afterwards.
  const started = mapOpencodeServerStream(sse("sse_tools")).flatMap((event) =>
    event.payload.type === "tool_call_started" ? [event.payload] : [],
  )
  assert.equal(started.length, 2)
  for (const call of started) {
    assert.ok(Object.keys(call.input as Record<string, unknown>).length > 0, "an opened row with no input says nothing")
    assert.notEqual(call.title, call.name, "the title should be what ran, not the tool's own name")
  }
  assert.match(started[1]!.title, /wc -l/)
})

test("two sessions on the bus may name a call the same thing", () => {
  // `openedCalls` is keyed by session as well as call id. Keyed by call id
  // alone, the second session's call was mistaken for a republish of the
  // first's and vanished entirely — no row, no result.
  const mapper = new OpencodeServerMapper()
  const part = (session: string) =>
    JSON.stringify({
      type: "message.part.updated",
      properties: {
        sessionID: session,
        part: {
          type: "tool",
          id: "prt_1",
          callID: "call_dup",
          tool: "bash",
          messageID: "msg_1",
          state: { status: "completed", input: { command: `echo ${session}` }, output: "ok", metadata: { exit: 0 } },
        },
      },
    })
  for (const session of ["ses_a", "ses_b"]) {
    const events = mapper.push(part(session))
    // No `session_started` here: on this wire a session is announced by its own
    // description frame, not by a part that happens to name it.
    assert.deepEqual(
      events.map((event) => event.payload.type),
      ["tool_call_started", "tool_call_completed"],
      session,
    )
    assert.ok(events.every((event) => event.sessionId === session), session)
  }
})

test("a transcript is one conversation, even when the stream is a bus", () => {
  // `/event` carries every session on the server. Folding them together merges
  // two conversations' turns; naming the session is how a consumer reads the
  // one it is showing.
  const events = mapOpencodeServerStream(sse("sse_printed"))
  const sessions = [...new Set(events.map((event) => event.sessionId))]
  assert.ok(sessions.length > 1, "the capture really does carry more than one session")

  const merged = buildTranscript(events)
  const one = buildTranscript(events, { sessionId: sessions[0] })
  assert.equal(merged.sessions.length, sessions.length)
  assert.equal(one.sessions.length, 1)
  assert.ok(one.turns.length < merged.turns.length)
  for (const turn of one.turns) {
    for (const item of turn.work) {
      if (!isToolGroup(item)) assert.equal(item.sessionId, sessions[0])
    }
  }
})
