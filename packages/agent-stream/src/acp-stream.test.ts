/** @responsibility Proves the Agent Client Protocol reader against real captures from all four agents that speak it. */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { ACP_MAPPING, acpMappingFor } from "./acp/mapping"
import { AcpMapper, mapAcpStream } from "./acp/mapper"
import { parseAcp, parseAcpLine } from "./acp/frame"
import { ACP_PROTOCOL_VERSION } from "./acp/wire"

import { asRecord, asString } from "./json"
import { applyDeltas, buildTranscript, previewOf } from "./transcript/fold"
import { transportOf } from "./transports"

const FIXTURES = fileURLToPath(new URL("../../../apps/storybook/stories/fixtures/agent-stream/", import.meta.url))

/**
 * Every ACP capture, and which agent produced it.
 *
 * The protocol is the point: one reader, several agents, and the same events out.
 * opencode and Cursor speak it natively; Claude Code and Codex through adapters.
 */
const CAPTURES = [
  { agent: "opencode", name: "opencode/acp_printed" },
  { agent: "opencode", name: "opencode/acp_tools" },
  { agent: "opencode", name: "opencode/acp_permission" },
  { agent: "opencode", name: "opencode/acp_plan" },
  { agent: "opencode", name: "opencode/acp_subagent" },
  { agent: "opencode", name: "opencode/acp_websearch" },
  { agent: "claude", name: "acp/claude_tools" },
  { agent: "codex", name: "acp/codex_tools" },
  { agent: "cursor", name: "acp/cursor_printed" },
  { agent: "cursor", name: "acp/cursor_tools" },
] as const

function acp(name: string): string {
  return readFileSync(`${FIXTURES}${name}.jsonl`, "utf8")
}

const ACP_NAMES = CAPTURES.map((capture) => capture.name)

/**
 * The third transport.
 *
 * `opencode acp` is not another door onto the server's bus — it is the Agent
 * Client Protocol over stdio, a conversation rather than a stream. These
 * captures are real sessions driven by a client that answered what the agent
 * asked back.
 */

test("every ACP frame decodes, although none of them carries a `type`", () => {
  for (const name of ACP_NAMES) {
    const results = parseAcp(acp(name))
    assert.ok(results.length > 0, name)
    // The shared line decoder insists on a `type`, which every stream wire has
    // and no JSON-RPC frame does. Using it here would reject the whole capture.
    for (const result of results) assert.equal(result.ok, true, `${name}: ${result.ok ? "" : result.reason}`)
  }
})

test("ACP frames travel both ways, and the client's own are part of the record", () => {
  const events = mapAcpStream(acp("opencode/acp_tools"))
  // The prompt is on the wire here — carried in the client's request — where
  // neither other opencode transport echoes it at all.
  const prompts = events.filter((event) => event.payload.type === "user_message")
  assert.equal(prompts.length, 1)
  assert.match((prompts[0]!.payload as { text: string }).text, /acp-notes\.txt/)

  // And the turn ends on the *reply* to that request, not on a broadcast.
  const finished = events.flatMap((event) => (event.payload.type === "turn_completed" ? [event.payload] : []))
  assert.equal(finished.length, 1)
  assert.equal(finished[0]!.stopReason, "end_turn")
  assert.ok((finished[0]!.usage?.totalTokens ?? 0) > 0)
})

test("ACP streams both prose and reasoning, and keeps them apart", () => {
  const events = mapAcpStream(acp("opencode/acp_tools"))
  const deltas = events.filter((event) => event.payload.type === "delta")
  assert.ok(deltas.length > 20, "the answer really did arrive a chunk at a time")

  // The protocol separates a thought from a message, so nothing has to guess
  // which block a chunk belongs to — they land on different blocks.
  const blocks = new Set(
    deltas.map((event) => {
      const payload = event.payload as { block: { messageId: string; index: number } }
      return `${payload.block.messageId}:${payload.block.index}`
    }),
  )
  assert.ok(blocks.size >= 2)

  // Folded, the chunks assemble into the answer — ACP publishes no committed
  // message, so this fold is the only place the text exists whole.
  const buffers = applyDeltas(events)
  const assembled = [...blocks].map((key) => {
    const [messageId, index] = key.split(":")
    return previewOf(buffers, { messageId: messageId!, index: Number(index) }) ?? ""
  })
  assert.ok(assembled.some((text) => text.length > 10))
})

test("a tool call opens before it settles, which only this transport shows", () => {
  const events = mapAcpStream(acp("opencode/acp_tools"))
  const started = events.flatMap((event) => (event.payload.type === "tool_call_started" ? [event.payload] : []))
  const completed = events.flatMap((event) => (event.payload.type === "tool_call_completed" ? [event.payload] : []))
  assert.equal(started.length, 2)
  assert.equal(completed.length, 2)

  // The kind comes from the protocol, not from a tool's name: ACP normalizes it
  // so a client renders the call the same way whichever agent it is talking to.
  assert.deepEqual(
    started.map((payload) => payload.kind),
    ["file_edit", "shell"],
  )
  // An `in_progress` update is not a result. Settling on it would close a row
  // that is still running.
  assert.ok(completed.every((payload) => payload.result.isError === false))
})

test("the agent asks the client for permission, and lists the answers it will accept", () => {
  const events = mapAcpStream(acp("opencode/acp_permission"))
  const asks = events.flatMap((event) => (event.payload.type === "permission_requested" ? [event.payload] : []))
  assert.equal(asks.length, 1)
  const ask = asks[0]!
  assert.ok(ask.callId.startsWith("call_"))
  // The options are the agent's, not a surface's invention — offering wording
  // it never listed would send back an option it cannot honour.
  assert.match(ask.description ?? "", /Allow once/)
  assert.match(ask.description ?? "", /Reject/)
  // And the ask names every path the call would touch.
  const call = asRecord(ask.input as never)
  assert.ok(Array.isArray(call.locations))
})


test("every ACP frame kind the captures contain is declared in its own table", () => {
  for (const name of ACP_NAMES) {
    for (const result of parseAcp(acp(name))) {
      if (!result.ok) continue
      const frame = result.line as { method?: string; params?: { update?: { sessionUpdate?: string } } }
      if (frame.method === undefined) continue
      const update = frame.params?.update?.sessionUpdate
      const kind = update === undefined ? frame.method : `${frame.method}/${update}`
      assert.notEqual(acpMappingFor(kind), null, `${name}: ${kind} is not in ACP_MAPPING`)
    }
  }
})

test("opencode's plan is a tool call on ACP, not the protocol's plan update", () => {
  // ACP defines a `plan` update and opencode never sends one: the todo list
  // arrives as a `todowrite` call, with the list on the call's *input* while it
  // is still running. Waiting for a result would drop every update.
  const frames = parseAcp(acp("opencode/acp_plan"))
  const kinds = new Set(
    frames.flatMap((result) =>
      result.ok ? [((result.line as { params?: { update?: { sessionUpdate?: string } } }).params?.update?.sessionUpdate ?? "")] : [],
    ),
  )
  assert.ok(!kinds.has("plan"), "opencode does not use ACP's own plan update")

  const events = mapAcpStream(acp("opencode/acp_plan"))
  const plans = events.flatMap((event) => (event.payload.type === "plan_updated" ? [event.payload.steps] : []))
  assert.ok(plans.length > 1, "the list is republished as steps complete")
  assert.ok(plans[plans.length - 1]!.every((step) => step.status === "completed"))
})

test("a call's kind prefers opencode's tool name over ACP's coarser one", () => {
  // ACP's vocabulary is deliberately small — `task` arrives as `think`,
  // `todowrite` and `websearch` both as `other` — which is right for a client
  // that knows nothing about the agent behind it. Here we do know.
  const events = mapAcpStream(acp("opencode/acp_subagent"))
  const delegation = events.find((event) => event.payload.type === "tool_call_started")!
  assert.equal((delegation.payload as { kind: string; name: string }).name, "task")
  assert.equal((delegation.payload as { kind: string }).kind, "subagent")

  // ACP renames the call mid-flight (`task` → the description). The opening
  // name must stick, or `task_completed` never fires.
  const completed = events.flatMap((event) =>
    event.payload.type === "task_completed" ? [event.payload] : [],
  )
  assert.equal(completed.length, 1)
  assert.notEqual(completed[0]!.summary, null)

  const search = mapAcpStream(acp("opencode/acp_websearch")).find(
    (event) => event.payload.type === "tool_call_started",
  )!
  assert.equal((search.payload as { kind: string }).kind, "web")
})


/**
 * The reason this module sits beside the agents rather than inside one.
 *
 * ACP is a protocol, not a product: opencode and Cursor speak it natively, and
 * Claude Code and Codex speak it through Zed's adapters. One reader serves all
 * four, and that claim is only worth making if it is checked against all four.
 */
test("one reader, four agents, the same events out", () => {
  const byAgent = new Map<string, Set<string>>()
  for (const { agent, name } of CAPTURES) {
    const events = mapAcpStream(acp(name))
    assert.ok(events.length > 0, name)
    const kinds = byAgent.get(agent) ?? new Set<string>()
    for (const event of events) kinds.add(event.payload.type)
    byAgent.set(agent, kinds)
  }
  assert.deepEqual([...byAgent.keys()].sort(), ["claude", "codex", "cursor", "opencode"])

  // The shapes every agent produced, whichever product was behind the socket.
  for (const [agent, kinds] of byAgent) {
    for (const required of ["session_started", "user_message", "turn_completed"]) {
      assert.ok(kinds.has(required), `${agent} produced no ${required}`)
    }
  }
  // Tool captures exist for every agent except Cursor's printed-only fixture;
  // every agent that has a tools capture must open a call.
  for (const agent of ["claude", "codex", "cursor", "opencode"]) {
    const toolsCapture = CAPTURES.find((capture) => capture.agent === agent && capture.name.includes("tools"))
    assert.notEqual(toolsCapture, undefined, agent)
    assert.ok(byAgent.get(agent)!.has("tool_call_started"), `${agent} tools produced no tool_call_started`)
  }
})

test("each agent that stamps agentInfo names itself in the handshake", () => {
  // The one wire of the five that states what it is talking to. Every other
  // transport needs a constant maintained by hand. Cursor's initialize omits
  // agentInfo today — it authenticates instead — so it is absent here rather
  // than forced into a placeholder.
  const named = new Map<string, string>()
  for (const { agent, name } of CAPTURES) {
    for (const result of parseAcp(acp(name))) {
      if (!result.ok) continue
      const info = asRecord(asRecord(result.line.result).agentInfo)
      const title = asString(info.title) ?? asString(info.name)
      if (title !== null) named.set(agent, `${title} ${asString(info.version) ?? ""}`.trim())
    }
  }
  assert.equal(named.get("opencode"), "OpenCode 1.18.25")
  assert.match(named.get("claude") ?? "", /^Claude Code /)
  assert.match(named.get("codex") ?? "", /^Codex /)
  assert.equal(named.has("cursor"), false)
})

test("Claude, Codex, Cursor and opencode reach ACP as a real transport", () => {
  // Claude's own stream only asks for permission with a special flag, and
  // Codex's exec stream never streams a token. Both do here, which is why
  // capability belongs to the transport rather than to the agent.
  const claude = mapAcpStream(acp("acp/claude_tools"))
  assert.ok(claude.some((event) => event.payload.type === "permission_requested"))

  const codex = mapAcpStream(acp("acp/codex_tools"))
  assert.ok(codex.filter((event) => event.payload.type === "delta").length > 20)

  const cursor = mapAcpStream(acp("acp/cursor_tools"))
  assert.ok(cursor.some((event) => event.payload.type === "permission_requested"))
  assert.ok(cursor.filter((event) => event.payload.type === "delta").length > 20)

  // Edit paths named on an open `tool_call` (Claude/Codex) or mid-flight
  // update (Cursor) must still surface as `file_edits` when the call settles.
  for (const name of ["acp/claude_tools", "acp/codex_tools", "acp/cursor_tools"]) {
    const edits = mapAcpStream(acp(name)).filter((event) => event.payload.type === "file_edits")
    assert.ok(edits.length >= 1, `${name} emitted no file_edits`)
  }

  for (const provider of ["claude", "codex", "cursor", "opencode"]) {
    const transport = transportOf(provider, "acp")
    assert.notEqual(transport, null, `${provider} has no acp transport`)
    // Streaming is captured for all four.
    assert.equal(transport!.supports.streaming, true, provider)
  }
  // Approvals are captured for three of them. Codex's session never asked for
  // one, so its answer is unrecorded rather than a no — the distinction the
  // tri-state exists to keep.
  assert.equal(transportOf("claude", "acp")?.supports.approvals, true)
  assert.equal(transportOf("opencode", "acp")?.supports.approvals, true)
  assert.equal(transportOf("cursor", "acp")?.supports.approvals, true)
  assert.equal(transportOf("codex", "acp")?.supports.approvals, null)
  assert.equal(mapAcpStream(acp("acp/codex_tools")).filter((event) => event.payload.type === "permission_requested").length, 0)
})

/**
 * A table may only promise what something has seen.
 *
 * ACP's table is the one most tempted into fiction: the protocol declares more
 * than any single agent uses, and four agents use different parts of it.
 */
const ACP_UNEXERCISED: ReadonlyMap<string, string> = new Map([
  ["session/load", "resuming a session; the captures all open a new one"],
  ["session/cancel", "needs a turn interrupted by the client"],
  ["session/set_mode", "no capture switched the agent's mode"],
  ["session/set_model", "no capture switched model mid-session"],
  ["session/update/user_message_chunk", "every capture's client sent the prompt itself, so none was echoed back"],
  ["session/update/plan", "the protocol's own plan update, which opencode does not use — it sends a todowrite call instead"],
  ["session/update/current_mode_update", "follows a set_mode nobody sent"],
])

test("every ACP row the captures never reach is acknowledged as unexercised", () => {
  const seen = new Set<string>()
  for (const name of ACP_NAMES) {
    for (const result of parseAcp(acp(name))) {
      if (!result.ok) continue
      const frame = result.line as { method?: string; params?: { update?: { sessionUpdate?: string } } }
      if (frame.method === undefined) continue
      const update = frame.params?.update?.sessionUpdate
      seen.add(update === undefined ? frame.method : `${frame.method}/${update}`)
    }
  }
  const declared = Object.keys(ACP_MAPPING)
  assert.deepEqual(
    declared.filter((kind) => !seen.has(kind) && !ACP_UNEXERCISED.has(kind)).sort(),
    [],
    "a table row no fixture exercises must be listed in ACP_UNEXERCISED",
  )
  for (const kind of ACP_UNEXERCISED.keys()) {
    assert.ok(!seen.has(kind), `${kind} is listed as unexercised but a fixture reaches it`)
    assert.ok(declared.includes(kind), `${kind} is listed as unexercised but is not a row in the table`)
  }
})

test("an answered permission ask retires, so nothing renders a prompt that is already settled", () => {
  // The reply is a bare JSON-RPC response naming an `optionId`; only the ask's
  // own option list says whether that id allows or refuses. Without joining the
  // two the ask never retired and a surface showed a blocking prompt for the
  // rest of the session.
  for (const name of ["opencode/acp_permission", "acp/claude_tools", "acp/cursor_tools"]) {
    const events = mapAcpStream(acp(name))
    const asks = events.flatMap((event) => (event.payload.type === "permission_requested" ? [event.payload] : []))
    const decided = events.flatMap((event) => (event.payload.type === "permission_decided" ? [event.payload] : []))
    assert.ok(asks.length >= 1, name)
    assert.equal(decided.length, asks.length, name)
    for (let i = 0; i < asks.length; i++) {
      assert.equal(decided[i]!.requestId, asks[i]!.requestId, name)
      // Every capture here was answered by allowing the call.
      assert.equal(decided[i]!.decision, "allow", name)
    }
    assert.equal(buildTranscript(events).pendingAsks.length, 0, name)
  }
})

test("Cursor's ACP shell and edit quirks reach the contract", () => {
  // Cursor puts shell stdout/stderr on `rawOutput`, reports failure as a
  // non-zero exit under `status: completed`, and names edit paths on a
  // mid-flight update (or a terminal `diff` block) rather than on the settle.
  const events = mapAcpStream(acp("acp/cursor_tools"))
  const completed = events.flatMap((event) =>
    event.payload.type === "tool_call_completed" ? [event.payload] : [],
  )
  const failed = completed.find((payload) => payload.result.isError)
  assert.ok(failed, "expected a non-zero shell exit to mark isError")
  assert.match(failed.result.text, /No such file or directory/)
  const ok = completed.find((payload) => /\/tmp\/cursor-acp-capture\/notes\.txt/.test(payload.result.text))
  assert.ok(ok, "expected stdout from rawOutput on a successful shell")
  assert.equal(ok.result.isError, false)
  const edits = events.flatMap((event) => (event.payload.type === "file_edits" ? [event.payload] : []))
  const edit = edits.flatMap((payload) => payload.edits).find((entry) => entry.path.endsWith("notes.txt"))
  assert.ok(edit)
  assert.equal(edit.change, "add")
  // Cursor ships mangled `++ b/…` headers in newText; the contract gets a
  // real unified create hunk, not those remnant lines.
  assert.ok(edit.unifiedDiff?.startsWith("--- /dev/null\n+++ b/"))
  assert.equal(
    edit.unifiedDiff?.split("\n").some((line) => line.startsWith("++ b/")),
    false,
  )
  assert.equal(ok.result.text.split("\n").some((line) => line.startsWith("++ b/")), false)
})

test("edit paths survive when locations and the terminal diff arrive on different frames", () => {
  const mapper = new AcpMapper()
  const mid = JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId: "s",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "c-loc",
        kind: "edit",
        locations: [{ path: "/tmp/only-mid.txt" }],
      },
    },
  })
  const terminal = JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId: "s",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "c-loc",
        kind: "edit",
        status: "completed",
        content: [],
      },
    },
  })
  mapper.push(mid)
  const remembered = mapper.push(terminal).flatMap((event) =>
    event.payload.type === "file_edits" ? [...event.payload.edits] : [],
  )
  assert.deepEqual(
    remembered.map((edit) => edit.path),
    ["/tmp/only-mid.txt"],
  )

  // Claude/Codex name the path (and often the diff) on an open `tool_call`
  // frame; the completed update is empty.
  const fromOpen = new AcpMapper()
  fromOpen.push(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "s",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "c-open",
          kind: "edit",
          title: "Edit",
          status: "pending",
          locations: [{ path: "/tmp/open-frame.txt" }],
          content: [{ type: "diff", path: "/tmp/open-frame.txt", oldText: "-- /dev/null", newText: "x\n" }],
        },
      },
    }),
  )
  const openSettled = fromOpen
    .push(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: "s",
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: "c-open",
            status: "completed",
            content: [],
          },
        },
      }),
    )
    .flatMap((event) => (event.payload.type === "file_edits" ? [...event.payload.edits] : []))
  assert.deepEqual(
    openSettled.map((edit) => edit.path),
    ["/tmp/open-frame.txt"],
  )
  assert.equal(openSettled[0]!.change, "add")
  assert.equal(
    openSettled[0]!.unifiedDiff,
    ["--- /dev/null", "+++ b/tmp/open-frame.txt", "@@ -0,0 +1,1 @@", "+x"].join("\n"),
  )

  const diffOnly = new AcpMapper()
  const opened = JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId: "s",
      update: { sessionUpdate: "tool_call", toolCallId: "c-diff", kind: "edit", title: "Edit File", status: "pending" },
    },
  })
  const settled = JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId: "s",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "c-diff",
        status: "completed",
        content: [{ type: "diff", path: "/tmp/only-diff.txt", oldText: "-- /dev/null", newText: "hello\n" }],
      },
    },
  })
  diffOnly.push(opened)
  const fromDiff = diffOnly.push(settled).flatMap((event) =>
    event.payload.type === "file_edits" ? [...event.payload.edits] : [],
  )
  assert.equal(fromDiff.length, 1)
  assert.equal(fromDiff[0]!.path, "/tmp/only-diff.txt")
  assert.equal(fromDiff[0]!.change, "add")
  assert.equal(
    fromDiff[0]!.unifiedDiff,
    ["--- /dev/null", "+++ b/tmp/only-diff.txt", "@@ -0,0 +1,1 @@", "+hello"].join("\n"),
  )

  // An in-place edit with only mangled headers and no real before-blob must
  // not invent a fake unified diff consumers would try to parse.
  const updateOnly = new AcpMapper()
  updateOnly.push(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "s",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "c-upd",
          kind: "edit",
          title: "Edit File",
          status: "pending",
        },
      },
    }),
  )
  const updated = updateOnly
    .push(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: "s",
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: "c-upd",
            status: "completed",
            content: [
              {
                type: "diff",
                path: "/tmp/edited.txt",
                oldText: "-- a//tmp/edited.txt",
                newText: "++ b//tmp/edited.txt\nchanged\n",
              },
            ],
          },
        },
      }),
    )
    .flatMap((event) => (event.payload.type === "file_edits" ? [...event.payload.edits] : []))
  assert.equal(updated.length, 1)
  assert.equal(updated[0]!.change, "update")
  assert.equal(updated[0]!.unifiedDiff, null)
})

test("a reply is matched by shape as well as id, because both directions number their own", () => {
  // JSON-RPC over a bidirectional pipe has two independent id spaces, and the
  // captures prove they collide: the agent's ask uses id 0 while the client
  // counts from 1. Keying a permission answer on the id alone read a prompt's
  // own reply as one — swallowing the turn's ending and leaving the real ask
  // outstanding for ever.
  const frames = [
    { jsonrpc: "2.0", id: 3, method: "session/prompt", params: { sessionId: "s", prompt: [{ type: "text", text: "hi" }] } },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "session/request_permission",
      params: { sessionId: "s", toolCall: { toolCallId: "c1" }, options: [{ optionId: "once", kind: "allow_once", name: "Allow" }] },
    },
    { jsonrpc: "2.0", id: 3, result: { stopReason: "end_turn" } },
  ]
    .map((frame) => JSON.stringify(frame))
    .join("\n")

  assert.deepEqual(
    mapAcpStream(frames).map((event) => event.payload.type),
    ["user_message", "permission_requested", "turn_completed"],
  )
})

test("the answer's meaning comes from the option's kind, not its id", () => {
  // An agent names its options whatever it likes — the captures use `once`,
  // `always` and `reject` — so only the kind says which way one goes.
  const frames = [
    {
      jsonrpc: "2.0",
      id: 7,
      method: "session/request_permission",
      params: {
        sessionId: "s",
        toolCall: { toolCallId: "c1" },
        options: [{ optionId: "allow-looking-id", kind: "reject_once", name: "No" }],
      },
    },
    { jsonrpc: "2.0", id: 7, result: { outcome: { outcome: "selected", optionId: "allow-looking-id" } } },
  ]
    .map((frame) => JSON.stringify(frame))
    .join("\n")

  const decided = mapAcpStream(frames).flatMap((event) =>
    event.payload.type === "permission_decided" ? [event.payload] : [],
  )
  assert.equal(decided.length, 1)
  assert.equal(decided[0]!.decision, "deny")
})

test("absent usage stays absent, and reasoning cost survives the protocol", () => {
  // Claude's adapter closes a turn with `{stopReason}` and no usage at all.
  // Building an all-null Usage there made "nothing was reported" look like
  // "reported, all unknown" — and only on this wire, so a consumer checking
  // `usage !== null` drew an empty panel for ACP sessions alone.
  const claude = mapAcpStream(acp("acp/claude_tools")).flatMap((event) =>
    event.payload.type === "turn_completed" ? [event.payload.usage] : [],
  )
  assert.deepEqual(claude, [null])

  // Codex's reports it, and calls reasoning `thoughtTokens` — a name that has
  // to be read or the cost shows on `exec` and vanishes here.
  const codex = mapAcpStream(acp("acp/codex_tools")).flatMap((event) =>
    event.payload.type === "turn_completed" ? [event.payload.usage] : [],
  )
  assert.equal(codex.length, 1)
  assert.notEqual(codex[0], null)
  assert.equal(codex[0]!.totalTokens, 22790)
  assert.equal(codex[0]!.reasoningTokens, 0)
})
