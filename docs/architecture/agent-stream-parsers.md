# Parsing coding-agent output streams

This document is a working guide for building a parser over a coding agent's
output stream, and a record of what a live Claude Code stream actually contains.
Everything asserted here was observed in a capture, and every capture named is
checked in under
`apps/storybook/stories/fixtures/agent-stream/`. The reference implementation is
`packages/agent-stream/src/`, and the Storybook story
**Composites/AgentStream** renders each capture next to its raw bytes.

If you are an agent asked to build one of these: read this file, then read the
fixtures. Do not design against remembered field names — the wire moves, and the
fixtures are what tell you where it moved to. One of the findings below
(`TodoWrite` becoming `TaskCreate`/`TaskUpdate`) was caught only because a
capture disagreed with the design.

> **Using the parser rather than changing it?** Read
> [`skills/agent-stream/SKILL.md`](../../skills/agent-stream/SKILL.md) instead —
> it is the task-shaped guide (entry points, live versus finished sessions,
> reading events, opening a delegated run's transcript, adding a provider).
> This document is the *why*: what the wire actually contains, and which of its
> shapes will mislead you.

## 0. What this library is, and what it is not

**The deliverable is the conversion: bytes in, structured events out.** Wire
decoding, normalization, the event contract, and the disk locators are the
product. A host builds its own transcript, its own sidebar, its own everything.

```
packages/agent-stream/src/
  contract.ts      the contract entry, stopping at the      ← "." export
                   agent message
  index.ts         contract + fold, for copied source       ← registry barrel only
  json.ts          JsonValue and the narrowing readers      ← shared
  events.ts        AgentEvent, AgentEventPayload, the       ← shared: THE CONTRACT
                   vocabularies every provider maps onto
  transports.ts    what each transport was observed to do   ← shared
  transcript/
    index.ts       the fold's own entry                     ← "./transcript" export
    fold.ts        one-shot fold                            ← shared, optional
    builder.ts     incremental fold                         ← shared, optional
  acp/             one protocol, three agents               ← protocol
    frame.ts       JSON-RPC line decoder (no `type` field)
    wire.ts        methods, updates, tool kinds
    mapping.ts / mapper.ts
  claude/
    stream/        `claude -p --output-format stream-json`  ← transport
      wire.ts      Claude Code's line shapes + vocabularies
      mapping.ts   Claude's kinds → contract kinds, as data
      mapper.ts    ClaudeStreamMapper
      capabilities.ts
    tools.ts / store.ts
  codex/
    exec/          `codex exec --json`
    app-server/    `codex app-server`
  opencode/
    run/           `opencode run --format json`
    server/        `opencode serve` SSE bus
    parts.ts       payload run and serve both carry
```

Three providers plus one shared protocol now exist, which is what turns the
layering from a claim into a measurement. Adding Codex cost **one** addition to
the shared contract — `file_edits`, for a capability Claude Code does not have
— and nothing else moved: the fold, the grouping, the delta machinery and every
component are reused untouched, and a test asserts the shared fold accepts
Codex events with no provider knowledge at all.

The Storybook story is a demo, not a shipped component.

`buildTranscript` and `TranscriptBuilder` are offered because turn boundaries,
tool-run grouping and pending-versus-abandoned are genuinely subtle and every
consumer would re-derive them — but they are a **helper, not a requirement**. A
host that wants a different shape reads the event log directly; nothing in the
mapper depends on the fold. The chat transcript in Storybook is a demonstration
that the events are sufficient to render from, and is not shipped as a
component.

### Why the payload vocabulary is shared, not per-provider

The obvious instinct is to make `payload.type` provider-specific — Claude's own
names for Claude's own events. Resist it. **The discriminator is the contract.**
A component switches on `payload.type`; if that vocabulary is Claude's, then a
Codex or ACP session needs its own components rather than merely its own mapper,
and the extensibility the layering exists for is gone.

Provider-specific vocabularies belong exactly one layer down, in each wire
module, where a name *should* be provider-shaped:

| layer | vocabulary | scope |
| --- | --- | --- |
| `claude/stream/wire.ts` | `ClaudeWireType`, `ClaudeSystemSubtype`, `ClaudeStreamFrameType`, `ClaudeContentDeltaType`, `ClaudeContentBlockType`, `ClaudeTaskType` | **per transport** |
| `events.ts` | `AgentEventType`, `TaskKind`, `PlanStepStatus`, `ToolKind` | **shared by all providers** |

The directory says which is which. A provider name may appear inside
`claude/` as often as it likes — that is the folder's whole job — and must not
appear in a shared module at all. `claude/stream/mapping.ts` is where the two meet:
`CLAUDE_TASK_KIND`, `CLAUDE_PLAN_STATUS` and `CLAUDE_EVENT_MAPPING` are lookup
tables from the provider's words to ours, written as **data rather than
control flow**, so the translation can be read at a glance and checked by the
compiler against the provider's own union.

Both are frozen objects with a derived union rather than TypeScript `enum`s. An
`enum` is a nominal type that does not survive JSON: a value read off the wire
could never *be* one without a cast, which defeats the point of naming it. The
`as const` object gives the same autocomplete and exhaustiveness checking, and
its values are the literals themselves — so `AgentEventType.ToolCallStarted`
and `"tool_call_started"` are interchangeable, and a `switch` over the union
still fails to compile when a variant is unhandled.

**Naming a provider's vocabulary must not close it.** The CLI adds subtypes
between releases, so `ClaudeSystemSubtype` is a checklist of what is *handled*,
never a claim about what exists — anything unlisted falls through to an
`unknown` event carrying its raw line.

## 1. Layer the parser in three

```
wire        line  →  tagged union            no state at all
mapper      wire  →  normalized event log    the only stateful piece
fold        log   →  turns, groups, runs     pure, re-runs on every render
```

The middle layer's output — a harness-agnostic `AgentEvent` — is the contract
components render against. Getting this boundary right is what lets a second
harness (Codex, an ACP-speaking agent) reuse every component by supplying a
different wire layer and mapper.

**Never let a component read the wire directly.** The wire's shape is a fact
about a CLI release; the event model is a fact about your product.

### The layering is a package boundary, not a convention

The three layers ship as `@nessa-ui/agent-stream`, which has no dependencies,
no peer dependencies, and no React. Its two entries cut the stack at the
contract:

| Entry | Layers | For |
| --- | --- | --- |
| `@nessa-ui/agent-stream` | wire + mapper | anything that wants the event log and draws its own shape |
| `@nessa-ui/agent-stream/transcript` | the fold | hosts that want the default turns-and-groups shape |

The shadcn registry is the exception, and deliberately so. It copies source, and
copied source has no exports map, so a registry consumer has exactly one
surface: `lib/agent-stream/index.ts`. That barrel re-exports both halves, which
is why `src/index.ts` exists separately from `src/contract.ts` — the published
package builds the contract, and the barrel is only ever copied. Splitting the
npm surface is a layering decision; deleting half the API from projects that
already installed the item would just be a break.

Splitting it this way is what makes the rule above enforceable rather than
advisory. While the parser lived inside `@nessa-ui/react`, reaching it meant
taking a `react >=19` peer dependency and a rendering tree — mermaid, katex,
react-markdown, radix — and every built module carried a `"use client"`
directive, so a Node process or a server component could not use the parser
its own architecture diagram said was framework-free.

`@nessa-ui/react` re-exports both entries, so a React host sees no change.

### What state the mapper actually needs

Small, and each piece earns its place:

| State | Why |
| --- | --- |
| `currentMessageId` | Stream frames address blocks by index *within the open message*, and the id arrives only on `message_start`. |
| committed block count per message id | Committed `assistant` lines carry **no index**; it is derived by counting. |
| `pathByCall` | Maps a tool call id to the agent path its children belong to, so nesting is a path rather than a flat id. |
| `seq` | The only ordering key. Most lines carry no timestamp. |
| plan steps | The incremental plan tools put a step's id in the tool *result*, not the call. |
| last `init` | A model change is only visible as a difference between two inits. |

## 2. What a Claude Code stream contains

Run with `--output-format stream-json --include-partial-messages --verbose`.
Four kinds of line arrive interleaved on one stdout:

1. **`stream_event`** — raw Anthropic SSE frames: `message_start`,
   `content_block_start` / `_delta` / `_stop`, `message_delta`, `message_stop`.
2. **`assistant` / `user`** — committed messages, and everything the CLI feeds
   back to the model (tool results, abort notices).
3. **`system`**, tagged by `subtype` — `init`, `status`, `task_started`,
   `task_progress`, `task_updated`, `task_notification`, `task_summary`,
   `thinking_tokens`, `hook_started`, `hook_response`, `post_turn_summary`,
   `background_tasks_changed`, `compact_boundary`, `permission_denied`.
4. **`result`** — the turn terminator, carrying usage, cost, `stop_reason`,
   `terminal_reason`, `permission_denials` and a per-model usage breakdown.

Plus `rate_limit_event`, and — only when the child was spawned with
`--permission-prompt-tool stdio` — `control_request`, the one line that
**blocks the agent until answered** on stdin. It is the sole duplex exchange on
an otherwise one-way wire.

### The stream is not one event per line, and must not be

In the `tools` capture, 43 lines produce 34 events. Every line that produces
none does so for a stated reason:

| Line | Why it maps to nothing |
| --- | --- |
| `message_start` | Its only payload is the id, which becomes the mapper's join key. |
| `message_delta`, `message_stop` | Terminal metadata `result` already carries. |
| `signature_delta` | A signature over a thinking block, not display content. |
| `rate_limit_event` with `status: "allowed"` | The steady state, reported constantly, with nothing to act on. |
| `task_summary` with no `detail` | Nothing to show. |

Keep that list closed and test it. A new entry appearing in it is a line the
parser has started dropping silently — which is the failure mode that matters,
because it looks like nothing at all.

## 3. The five things that are easy to get wrong

**Deltas vs. committed content.** Both arrive for the same content. Deltas are a
*preview*; the committed event for the same block supersedes them. The join key
is `{ messageId, index }`. Committed lines carry no index, and Claude Code emits
**one `assistant` line per content block** — several sharing one message id — so
you derive the index by counting blocks per id in arrival order. A wrong index
attaches streamed text to the wrong block and never errors.

**Deltas are optional.** Subagent output is not streamed. Codex streams nothing
of this shape. Every component must render correctly with zero deltas.

**`input_json_delta` is not parseable.** Fragments only form valid JSON once all
of them are concatenated. But `content_block_start` names the tool up front, so
a row can say "Editing…" while arguments are still arriving — a two-phase
affordance worth building for.

**Delegated work interleaves on the same stdout.** `parent_tool_use_id` is the
discriminator, and it equals the `call_id` of the spawning `tool_call_started`.
Resolve it *through the spawning call* so depth accumulates into a path
(`[outerCallId, innerCallId]`) rather than a flat id. Even if you only ever
observe one level, model it as a path — retrofitting depth after components read
a flat id is expensive, and Codex's equivalent field is already called
`agent_path`.

**Order by `seq`, never by time.** Most lines carry no `ts`. Use one monotonic
counter per session, shared by mapped lines and anything the app synthesizes,
seeded from the persisted log on resume — it is also the reconnect cursor.

## 4. Wire traps

Four of these are demonstrated by a checked-in fixture and four are not; the
unbacked ones are marked **(not in a fixture)** and were seen while building
against a live CLI rather than recorded. Treat a marked one as a caution, not
as evidence — and if you can capture it, do, because that is the difference
this document is built on.

- **`"iterations": null`** *(not in a fixture — every capture has an array)* — an explicit null, not an absent key. A reader that
  only handles absence fails the whole line, and since those lines are the
  replies to built-in commands, the commands appear to do nothing.
- **`stop_reason` can be null** on a `result` *(not in a fixture — the
  compaction capture's `result` says `end_turn`)*. Requiring it kills the turn
  terminator, and the session then sits on "in progress" forever.
- **`user` lines are two unrelated things** — the human's prompt (a bare string)
  and the CLI's own feedback (a block array). Discriminate by JSON type.
- **`isReplay` / `isSynthetic`** separate the CLI's bookkeeping from real
  conversation. Neither implies the other.
- **`<tool_use_error>` wrapping** on failed tool results is wire framing *(not
  in a fixture — `failing.jsonl` carries plain text with `is_error`)*;
  `is_error` already carries the fact. Strip only an exact whole-string wrap — a
  result that merely *mentions* the tag (a grep hit) must survive intact.
- **Interrupts** arrive as prose (`[Request interrupted by user…`) *(not in a
  fixture — headless cannot produce one)*. Matching
  prose is acceptable *here only* because `result.terminal_reason` carries the
  truth: a reworded notice costs one stray row, never a missed turn end.
- **Images arrive twice** — as an API image block and on the `tool_use_result`
  sidecar *(not in a fixture — no capture sent an image)*. Read one, archive to disk, carry a path. A session of screenshots is
  otherwise megabytes of base64 in the log.
- **A turn's `result` can arrive while background tasks are open.** "Idle" is
  `result` **and** an empty `background_tasks_changed`.

## 5. Findings that contradict the obvious design

These are the ones a from-memory design gets wrong.

### The plan tool is incremental now

`TodoWrite` published the whole list on every call. The current CLI uses
`TaskCreate { subject, description, activeForm }` and
`TaskUpdate { taskId, status }` — and **a step's id exists only in the tool
result text** (`"Task #2 created successfully"`). So the plan cannot be derived
from tool arguments alone: the mapper parks a creation on its call id, settles it
when the result arrives, and patches by id thereafter. Support both shapes; fall
back to creation order if the result wording moves.

### `init` is per turn, not per session — so "resumed" is not on the wire

A resumed process reuses the session id and replays none of the earlier turns.
A *workflow run emits two inits from one process*. So neither the session id nor
the init count can tell you a session was resumed — only the host, which chose
whether to pass `--resume`, knows. What the stream *can* prove is a **model
change**, as a difference between consecutive inits, which is exactly what
`--model` on a resume looks like. Report that; do not infer resumption.

### A workflow's agents write no events — but they are not invisible

Two separate facts, and conflating them costs you the whole feature.

**No event carries `parent_tool_use_id` for a workflow's agents.** Their
transcripts — the tool calls they make, the text they produce — never reach the
stream. So there is no way to expand a workflow agent and read its work, the way
a subagent can be expanded.

**But `task_progress` carries a structured board.** Alongside the flat
`description` (`"Greet: hola"`) and the accumulating `usage.total_tokens`, some
progress lines carry `workflow_progress`: a flat array mixing `workflow_phase`
and `workflow_agent` entries, where each agent names its phase by index. Per
agent it gives `label`, `model`, `state` (`start` → `done`), `agentId`,
`queuedAt` / `startedAt` / `durationMs`, `attempt`, `tokens`, `toolCalls`, a
`promptPreview` of what it was asked and a `resultPreview` of what it returned.

That is enough for a real progress board: phases in order, agents within them,
each with live state, cost and result. Rebuild the nesting the flat array
implies, and treat each array as a **full snapshot** — latest wins, and the array
rides on only *some* progress lines, so keep the last one you saw rather than
expecting one per update.

Three more things the multi-phase capture (`workflow_phases`) establishes:

- **Every phase is declared in the first snapshot**, before any of its agents
  exist. A three-phase run opens with three `workflow_phase` entries and two
  agents. So a board can show what is still to come instead of growing a phase
  at a time — render an agent-less phase as pending rather than hiding it.
- **`state` has at least three values** — `start`, `progress`, `done`. Treating
  it as a two-value flag mislabels every running agent.
- **An agent's `agentId` is absent until it actually starts.** A queued agent has
  a `label`, a `phaseIndex` and a `queuedAt` and nothing else, so identity for
  rendering must come from `index`, which is stable across snapshots.

The honest framing for a UI: a workflow's agents can be *watched*, not *read*.

**Draw the board as a row in its own right, not inside the `Workflow` call's
disclosure.** A workflow is a unit of work rather than an argument to a tool
call, and the board is the only view of its agents that exists — filing it one
expand deep under a row labelled "Orchestrated Workflow" hides the whole
feature. Keep the call's raw payload reachable underneath it.

By contrast a **subagent** (`task_type: "local_agent"`) does report its own
events, tagged with the spawning call id, so its work can be nested and expanded
— but it gets no board, and two further things are true of it:

- **A subagent's content is never streamed.** Every `stream_event` line in the
  captures is main-thread; a subagent emits committed `assistant` and `user`
  lines only. So its prose arrives in whole blocks and can never type itself
  out — its liveness has to come from `task_progress` instead. This is the
  concrete reason "deltas are optional" is a rule and not a nicety.
- **A subagent's final report is not one of its own events.** It arrives as the
  *spawning call's* tool result, on the main thread. A card built only from the
  run's events ends with its last tool call and no conclusion.

Both limits are limits *of the stream*. Section 6 covers where the full
transcripts actually live.

### Headless never echoes the prompt

`claude -p` opens with `init`; the prompt the user typed appears nowhere. The
host supplied it, so the host must render it. A transcript built only from the
stream is missing the half the reader wrote.

## 6. What the stream withholds, the disk keeps

Everything a delegated run refuses to put on the stream is written down. Under
`~/.claude/projects/<slug>/`, where `<slug>` is the working directory with every
non-alphanumeric character replaced by `-`:

```
<sessionId>.jsonl                                     the main conversation
<sessionId>/
  subagents/agent-<taskId>.jsonl                      a subagent's full transcript
  subagents/agent-<taskId>.meta.json                  agentType, description, toolUseId, spawnDepth
  subagents/workflows/<runId>/agent-<agentId>.jsonl   one workflow agent's full transcript
  subagents/workflows/<runId>/journal.jsonl           each agent's start and whole result
  workflows/<runId>.json                              the run record: script, phases, result, totals
  workflows/scripts/<name>-<runId>.js                 the script as executed
```

Three things make this usable rather than merely present:

- **The transcripts are the same line shapes the stream uses.** `user` and
  `assistant` lines with the familiar content blocks, marked `isSidechain: true`
  and carrying an `agentId`. The stream parser reads them unchanged — the only
  new line type is `attachment`, which falls through to `unknown` exactly as an
  unmodelled subtype should. No second parser, no second event model.
- **The wire hands you the keys.** A subagent's file is named by the `task_id`
  from `system/task_started`; a workflow agent's by the `agentId` from the
  progress board. Both are known the moment the run starts, so a UI can offer
  "open the transcript" while the run is still going.
- **`runId` is the one exception** — it never appears on the stream. Read the
  records in `<sessionId>/workflows/` and match their own `taskId` field against
  the `task_id` you saw.

The `.meta.json` sidecar also carries `toolUseId`, so a file can be matched back
to the row that spawned it without trusting the filename, and `spawnDepth`,
which is the disk's version of the agent path.

`store.ts` is the path contract as pure functions — no filesystem access, so it
runs in a browser as readily as in a host process. Reading the files is the
host's job (Node, Tauri, Electron); parsing what comes back is `mapClaudeStream`,
same as always.

Codex has the same disk story with a different shape: a spawned agent writes
nothing to the parent stream and is addressed by a *receiver thread id*, whose
rollout file uses a third vocabulary — `{type: response_item | event_msg |
session_meta, payload}` — that neither the live stream nor Claude's disk
transcripts share. "The same parser reads what comes back" is a Claude
property, not a general one.

**This changes what a UI can promise.** The stream alone supports "watch a
subagent, read its report". With the store, both a subagent and a workflow agent
can be opened and read in full — the fan-out stops being a black box.

### Hand the host a pointer, not a transcript

Do not inline a delegated run's conversation into the row that spawned it. It is
another chat stream and reads as one, so the parser's job ends at a pointer and
the shell opens it in its own surface:

```ts
const location = sessionLocationOf("~/.claude/projects", transcript.session)
const refs = collectTranscriptRefs(location, transcript.runs, runIdByTaskId)
```

`collectTranscriptRefs` returns one list covering the main conversation and
every delegated run, each entry carrying `kind`, `label`, `key`, the `callId`
that links it back to its row, and either a `path` or — when the path cannot be
built yet — `resolved: false` with a `blockedBy` naming what is missing. Two
things are routinely missing, and both are honest states rather than errors: an
agent that has not started has no id, and a workflow agent's `runId` has to be
matched off the records in `workflows/`. A ref that says why it is blocked is
worth more than a plausible path that resolves to nothing.

## 7. What the session tells you about itself

`system/init` is the whole capability advertisement, and it is what a composer's
pickers should be built from: `tools`, `mcp_servers` (with per-server `status`),
`slash_commands`, `terminal_slash_commands`, `skills`, `agents`, `plugins`,
`permissionMode`, `model`, `output_style`.

Two things to know before consuming it:

- **The tool list grows between inits.** Deferred tools load on demand, so merge
  across every `init` rather than replacing. What was absent from the first init
  is a tool that arrived late — worth surfacing as such.
- **MCP server names and tool prefixes disagree.** A server displayed as
  `example Mail` contributes `mcp__example_Mail__get_message`. Match by
  flattening both to the same alphabet, not by string equality.

`sessionCapabilities()` in the reference implementation does both, and classifies
each slash command as `skill`, `plugin` (`plugin:command`), `session`, or
`terminal` — the grouping a picker wants.

## 8. Folding the log for rendering

Above the event log sits a purely derived pass:

- **Turns** — prompt → work → `turn_completed`. A prompt typed *into* a running
  turn folds into it rather than opening a new one, and does not abandon the
  tool calls open in front of it.
- **Tool groups** — runs of ≥2 consecutive same-tool calls collapse to one row,
  counting *distinct targets* ("Edited 1 file", not 3).
- **Pending vs. abandoned** — a call with no result is pending only while a
  process could still produce one. With the process gone it is abandoned;
  drawing it as in-flight leaves a row shimmering forever.
- **`finalText` duplicates the last message.** `result.result` is a verbatim copy
  of the turn's last `assistant_text`; render one or the other, never both.
- **Carry a stable identity for every run and agent.** A delegated run has the
  harness's `taskId`, a workflow agent has an `agentId` once it starts and a
  stable `index` before that. Anything painted from identity — a seeded avatar,
  a colour — needs a key that survives a reload and a replay, and the label is
  not one: two agents in a fan-out can share it.
- **Keep an explicit set of payload types that draw a row.** What a collapse
  reveals, and what breaks a tool run, is a function of that set — and things
  that render elsewhere (the plan) must stay out of it, or a run of plan calls
  splits down the middle for no visible cause.

## 9. Speed, and the one thing that is actually slow

Measured on the checked-in captures (Node 22, M-series laptop):

| | cost |
| --- | --- |
| `parseWireLine` | ~0.98 µs/line — nearly all of it `JSON.parse` |
| `mapper.push` | **1.22 µs/line** end to end, so the mapper's own work is ~0.24 µs |
| Mapping a 50k-line session | 87 ms — ~575 lines/ms |
| `buildTranscript` over 43k events | 19 ms |

Per-line cost is a non-issue: a line takes about a microsecond to become
events, against milliseconds between lines. **The thing that is slow is folding
the whole log again for every line that arrives** — a linear fold run per event
over a log that grows per event is quadratic, and it is the shape a naive live
UI falls into.

Measured, same capture, per-line re-fold versus incremental:

| lines | re-fold everything | incremental | |
| --- | --- | --- | --- |
| 1,000 | 123 ms | 14 ms | 9× |
| 4,000 | 1,399 ms | 27 ms | 52× |
| 16,000 | 24,065 ms | 82 ms | **293×** |

Worst single line tells the same story from the user's side: the re-fold path
reaches 14.85 ms per line at 16k and keeps climbing, while the incremental path
stays flat. Over a 200,000-line session the incremental path holds **p50 5 µs,
p99 45 µs** per line, 1.6 s in total.

So the rule: **`buildTranscript` is for a persisted log you read once.
`TranscriptBuilder` is for a session that is still running.** Push new events,
snapshot when you render. `applyDeltas` takes the same shape: pass it your
running buffer and only the new events, since delta strings only ever grow.

There is **one fold implementation**: `buildTranscript` sorts, then delegates to
`TranscriptBuilder`. Two implementations of the same rules kept in agreement by
tests drift the first time someone patches one, and the drift shows up as a live
session disagreeing with the same session reloaded — the hardest class of bug to
see.

Two properties make the incremental path hold its shape:

- **Work is grouped as it arrives.** Re-running the tool-run grouping over the
  open turn on every frame is quadratic *within* a turn, and an autonomous turn
  with hundreds of calls is the ordinary case, not the tail.
- **A closed turn is assembled once.** It can never change, so it is never
  recomputed.

A **replayed** event is absorbed once and costs nothing — any at-least-once
transport re-sends its last chunk on reconnect, and making that fatal would
force a full re-fold precisely when the connection is flaky. An event arriving
from *before* everything seen is refused, because it would land in whichever
turn happened to be open, silently; a genuinely shuffled log is what
`buildTranscript` is for.

Snapshots hand back the builder's own append-only collections rather than
copies — copying a session's events per frame is the cost the class exists to
avoid — so a consumer memoizes on `transcript.revision`, which changes when the
content does. Anything still being written to (a run's own events) *is* copied.

## 10. opencode, and the version every one of these is true of

opencode is the third provider, and it has **three** wires of its own, not one.
All three are captured, and they disagree enough that treating them as one
would misdescribe every session read through the wrong one.

### How the transports are laid out in code

They are separate protocols, so they are separate modules, and only what is
genuinely shared sits between them:

```
opencode/
  parts.ts       the payload run and serve BOTH carry — the part shapes, the
                 tool vocabulary, and the emitter that turns a part into events
  mapping.ts     the shape every table is written in
  run/           `run --format json`: envelope DTOs, its table, its mapper
  server/        `serve` SSE bus: envelope DTOs, its table, its mapper
  store.ts       an exported session, read through the run mapper
  capabilities.ts  what the CLI's own listings answer

acp/             beside every agent, not inside one — Claude Code, Codex and
                 opencode all speak this protocol
  frame.ts       JSON-RPC line decoder (no `type` field)
  wire.ts        methods, updates, tool kinds
  mapping.ts / mapper.ts
```

`run` and `serve` genuinely share a payload — the server wraps the identical
`part` object in `message.part.updated` — and reading it twice would be two sets
of rules to disagree about one conversation. Their envelopes share nothing:
different names, different framing, different versions, different capabilities.

ACP shares neither. It is a different protocol with its own object model, so it
sits beside the agents rather than inside any one of them, and it needed a
weaker line decoder: the shared one insists on a `type` field, which every
stream wire has and no JSON-RPC frame does.

### What a transport can do is data

`transports.ts` states, per transport, whether it streams, names the model,
advertises capabilities, takes approvals, accepts steering, reports structured
edits, and whether its stream carries more than one session. A surface reads
that instead of knowing it, so a fourth provider is a new row rather than an
edit to every badge and empty state.

Each answer is **three-valued**. `false` is a fact — the relevant scenario was
captured and the wire said nothing. `null` means nobody has captured that
transport for it, and must not be drawn as a no. Codex's app-server is the
clearest case: a short session proved it streams, and in the same capture set
no approval policy was ever exercised, no command ran and no file changed — so
those three stay `null` while `streaming` is now `true`.

The same rule demotes claims this document used to make from documentation
rather than evidence. **Steering is `null` on every transport**: each
interactive one has a method for it, one of them advertises it in its
handshake, and no capture exercises a single mid-turn message.

### `opencode run --format json`

Three lines for a whole turn. A step opens, parts carry the answer, a step
finishes — and there is **no init line at all**: no model, no working
directory, no tool list, nothing. `SessionInfo` is therefore almost entirely
null here, which is what those nullable fields were for.

Four things this wire will mislead you about:

| What it looks like | What it is |
| --- | --- |
| Several `step_finish` lines | A tool loop finishes a step per call. Only a `stop` reason ends the turn. |
| A tool call `completed` | The *call* worked. A shell command that exited non-zero is still `completed`, with the failure only in `metadata.exit`. |
| A tool call `error` | The call never ran — it threw, or a permission rule refused it. |
| A turn with no ending | Unattended, opencode auto-rejects anything its rules ask about and the run then **stops**: no closing message, no terminator, exit 0. |

The two tool-status rows are the ones worth checking rather than believing, so
they were checked against opencode's own source. Its shell tool returns
normally whatever the command did — `return { title, metadata: { output, exit:
code, truncated }, output }` — and never throws on a non-zero exit, so the call
settles as `completed`. The `error` state is set by `failToolCall`, which runs
when the tool threw, was refused, or was aborted. Reading failure from the
status alone would call every failed build a success.

The shell tool is also a live example of why a wire is pinned to a build: it is
implemented as `shell.ts` but deliberately exposes the id `bash`, with its own
source noting the rename is planned for opencode 2.0. Both names are in the
vocabulary, mapped to the same kind.

Its delegations are the best of the three: the spawning call names the child's
own session id, and `opencode export <id>` returns that conversation with its
prompt, its tool calls, its tokens and its cost. Claude's subagent transcripts
have to be located on disk from a path contract; Codex names threads it never
lets you read. Only opencode hands the id over and answers to it — which is why
`task_started` now carries `transcriptId`, null for the other two.

### `opencode serve` — the bus, where it does stream

The one-way stream carries no partials at all. The headless server does: its
`GET /event` endpoint is an SSE stream, and one paragraph of prose arrived as
**254 `message.part.delta` frames**. The same bus also names the model, reports
the working directory and the build, and — unlike the unattended stream — holds
a permission ask open and publishes the answer.

Two things to design around. The endpoint is **server-wide**, not one session's:
a capture taken while two sessions ran carries both, so every event has to be
stamped with the session that produced it or a background run's work is filed
under the conversation someone is reading. And a session is announced by
`session.created` *without* a model — the `session.updated` that follows
immediately is the first line that describes it, which is why the mapper opens
a session on the update rather than on the creation.

### `opencode acp` — a conversation, not a stream

The third wire, and not another door onto the second: `opencode acp` speaks the
Agent Client Protocol over stdio. Frames travel **both ways**, and the one a
surface most has to handle comes *from* the agent — `session/request_permission`
blocks the tool until the client answers, offering the options it will accept
(`allow_once`, `allow_always`, `reject_once`). Answer it and the call proceeds;
this is the only opencode transport where an unattended run is not simply
refused.

It is also the best-described of the four wires in this document:

- **It states its own version, and names the agent behind it.** `initialize`
  replies with `agentInfo: { name, version }` and a negotiated
  `protocolVersion`. Two other wires stamp a build too — Claude's `system/init`
  carries `claude_code_version`, and opencode's bus puts `info.version` on
  `session.created` — but ACP is the only one that also says *which agent* is
  answering, which is what a single reader serving three of them needs.
- **It normalizes tool kinds itself** — `read`, `edit`, `execute`, `fetch` — so
  a call's kind is the protocol's word rather than a guess from a tool's name.
- **A call opens before it settles.** `tool_call` then `tool_call_update`. The
  server's bus republishes a running state too; the one-way stream is the only
  opencode wire that publishes calls already settled.
- **Prose and reasoning stream as separate kinds**, so nothing has to work out
  which block a chunk belongs to.
- **It reports the context window's size**, not just how much was used.
- **It publishes the slash commands** on the stream, and the model list in
  `session/new`'s reply.

What it does not do is multiplex: one connection is one conversation, where the
server's `/event` is a bus carrying every session at once.

| | `run --format json` | `serve` (SSE bus) | `acp` (JSON-RPC) |
| --- | --- | --- | --- |
| Streams tokens | no | yes | yes |
| Names the model | no | yes | yes |
| Approvals | auto-rejected, run ends | asked and answered | asked, and it blocks |
| Prompt on the wire | no | yes | **yes, in the request** |
| Session scope | one | every session on the server | one per connection |
| Client opens/resumes sessions | no | — | yes |
| Context window size | no | no | yes |
| States its own version | no | no | **yes** |

### What opencode does *not* do: compact

Claude compacts and says so; Codex compacts and says nothing. opencode appears
to do neither. Reading a generated corpus on the one-way stream pushed the
context to **232k against the model's own 200k window** — the size ACP reports —
across 28 steps, with no boundary of any kind on the wire, and the run ended on
an upstream 504 rather than on a summary. The `model_auto_compact_token_limit`
config exists but changed nothing on 1.18.25, whether passed with `-c` or
written into a project config.

So the honest reading is: **not observed**, and a surface built on opencode
should not assume a long session will be rescued. The capture is checked in as
`overflow.jsonl` because a turn that grows until the provider gives up is a
shape a consumer has to handle.

It also caught a parser bug worth naming: an `error` line nests its message at
`error.data.message`, itself a JSON string from whatever upstream refused.
Reading `error` as a string — which it never is — reported every failure as the
word "error".

Capabilities come from a fourth place for the first two: `opencode models` and
`opencode agent list` print them, and neither of those wires does. ACP answers
for itself.

### ACP: one protocol, three agents

This started as an opencode module and moved out, because it turned out not to
be an opencode thing at all. Claude Code and Codex both speak ACP through Zed's
adapters — `@zed-industries/claude-code-acp` and
`@agentclientprotocol/codex-acp` — and the *same reader* maps all three
captures without a change. That is the strongest evidence in this repository
that the contract is real rather than aspirational.

It also moves capability off the agent and onto the transport in a way that is
easy to state: Claude Code asks for permission over ACP without the stdio flag
its own stream needs, and Codex streams tokens over ACP where `exec --json`
sends none. Neither is a property of the agent.

Two practical notes. The Claude adapter refuses to start inside another Claude
Code session unless `CLAUDECODE` is unset. And an agent may extend the protocol
under `_meta` — Codex sends a `session_info_update` doing exactly that — so a
reader has to tolerate an extension rather than treat it as an unknown frame.

### Which version each of these is true of

None of these shapes is a published contract, and two of the three CLIs put no
version anywhere on the stream. Each provider therefore records the build its
description was read from, next to the command that produces it:

| Provider | Transport | Build | Command |
| --- | --- | --- | --- |
| Claude Code | stream-json | 2.1.251 | `claude -p --output-format stream-json …` |
| Claude Code | acp | adapter 0.16.2 | `npx @zed-industries/claude-code-acp` |
| codex-cli | exec | 0.144.1 | `codex exec --json` |
| codex-cli | app-server | 0.144.1 | `codex app-server` |
| codex-cli | acp | adapter 1.7.0 | `npx @agentclientprotocol/codex-acp` |
| opencode | run | 1.18.25 | `opencode run --format json` |
| opencode | serve | 1.18.25, **API 1.0.0** | `opencode serve → GET /event` |
| opencode | acp | 1.18.25, **protocol 1** | `opencode acp` |

Nine transports over six wires, because two of them are the same wire twice:
Claude's duplex mode is its own stream with stdin open, and ACP is one protocol
shared by three agents. The modules follow that exactly — `claude/stream/`,
`codex/exec/`, `codex/app-server/`, `opencode/run/`, `opencode/server/`, and
`acp/` beside them rather than inside any one agent.

Per *transport*, not per provider, because a provider can speak more than one
protocol and they version independently — opencode's server declares its own
`info.version` at `GET /doc`, which is on 1.0.0 while the CLI carrying it is on
1.18.x. Every transport's descriptor carries its provenance, so a consumer can
compare what it is reading against what was modelled. **When a capture is retaken against a newer build, update the
version and the date in the same commit as the fixtures.** If nothing changed,
that is itself worth recording. Claude Code is the only one that stamps its own
version on the wire (`system/init`), so it is the only one where the two can be
compared automatically.

## 11. Capturing your own fixtures

```bash
claude -p --output-format stream-json --include-partial-messages --verbose \
  --model sonnet "<prompt>" --allowed-tools Bash Read Write > capture.jsonl
```

Put the prompt **before** `--allowed-tools`: the flag is variadic and will
swallow it otherwise. Capture at least: plain text, tool calls, a failing tool, a
plan, a subagent, a workflow, a web search, and a resume with a different model.
Those eight are what the checked-in fixtures cover, and each one broke something
in the parser that the others did not.

Every shape this document describes for Claude's stream is now captured.
Compaction came last of them, and it is the one that cannot be produced by
asking: the window has to actually fill.

### Forcing a compaction

A deterministic corpus (`generate-corpus.mjs`, seeded, from the system word
list) is read file by file until the window overflows. Nothing is authored:

```bash
node generate-corpus.mjs ./corpus 15 24        # 15 files of ~24KB
claude -p "Read each file in full, one at a time. Reply with only the filename." \
  --output-format stream-json --include-partial-messages --verbose \
  --model haiku --autocompact 100000 --allowed-tools Read
```

`--autocompact` sets the window and accepts nothing below 100k, so a capture of
a real compaction is inherently large. Growth must also be *gradual*: a first
attempt read the repo's own largest source files, jumped tens of thousands of
tokens per read, and hit `"Prompt is too long"` without ever compacting. The
smaller the individual read, the more reliably the threshold is met rather than
overshot.

Its own tool results are 765KB of dictionary words, so the fixture elides the
generated bodies — in both places the CLI repeats them, the `tool_result`
content and the `tool_use_result.file.content` sidecar — and keeps every line,
field and count around them. The corpus is reproducible from the script above.

### What a boundary says

| Field | Meaning |
| --- | --- |
| `trigger` | `auto` when the window filled, `manual` when asked for |
| `pre_tokens` / `post_tokens` | 71.1k down to 9.3k on the first boundary here |
| `cumulative_dropped_tokens` | across the **session**, not the boundary — it keeps climbing |
| `duration_ms` | 17.5s and 22.3s here: compaction is a slow model call of its own |
| `preserved_messages` | the uuids that survived, reachable through `raw` |

Two consequences. Compaction removes history from the *model*, not from the
transcript — a consumer that trimmed its own view to match would delete what
the user is still reading. And it is not a failure: the run completes normally.

### Codex compacts too, and does not tell you

Codex has the same mechanism — `model_auto_compact_token_limit`, and
`PreCompact` / `PostCompact` hooks — but **`codex exec --json` publishes
nothing about it**. Forced with a 15k limit, the on-disk rollout records
`{"type":"context_compacted"}` and a `replacement_history` entry while the JSON
stream shows only a normal turn. *That run is not checked in: the rollout is a
third location, outside both the stream and this repository, so this paragraph
is a report rather than something a fixture proves.*

The consequence is visible in the transcript rather than announced: after
compacting, the agent read one file of ten, answered with that filename, and
ended the turn — the rest of the instruction had been summarised away. A
consumer on `exec` sees an agent that simply stopped early, with no way to know
why.

The app-server transport does better, though only on paper here: none of this
is in a checked-in capture, and the app-server fixture is a short session that
never compacts. Its schema declares a `ContextCompaction`
thread item, plus a `thread/compact/start` request so a client can compact on
demand — something Claude's stream offers no way to ask for. The item carries
`{id, type}` and nothing else: no token counts, no duration. So on Codex the
fact is available on one transport and absent on the other, and even where
present it is a marker rather than a measurement.

| | Claude (`stream-json`) | Codex (`exec --json`) | Codex (app-server) |
| --- | --- | --- | --- |
| Compaction announced | yes | **no** | yes |
| Token counts | yes | — | no |
| Client can trigger it | — | — | `thread/compact/start` |

Approvals were the last of these, and are now captured twice — once answered
allow, once answered deny. Getting them to happen at all took an explicit rule
in the sandbox's own settings:

```json
{ "permissions": { "ask": ["Bash(*)", "WebFetch(*)"], "defaultMode": "default" } }
```

Without an `ask` rule nothing escalates, which is why earlier attempts recorded
nothing no matter which permission mode was used. The capture immediately
corrected two things that had been written from the documented shape:

- The ask names its reason `decision_reason_type` (`"rule"` here), not
  `decision_reason`. Reading the documented name alone returned null.
- The reply's `behavior` — `allow` or `deny` — was not being read at all, so a
  decision recorded only that it had happened. A consumer cannot draw a
  refusal it cannot see.

What the exchange looks like, and what a consumer needs from it:

| Fact | Where it lands |
| --- | --- |
| The ask, with the exact input to be approved | `permission_requested` |
| Why the harness escalated | `reason` — `"rule"` |
| The answer, and its direction | `permission_decided.decision` |
| The refusal's stated reason | becomes the tool result's error text, verbatim |
| Refusals over the whole turn | `turn_completed.permissionDenials` |

Two consequences worth designing for. A declined tool is **not** a failed turn:
the result still reports success, and the agent explains itself in prose. And
neither control frame carries a timestamp, so ordering an approval against the
surrounding stream rests on `seq` alone — which is the reason `seq` and not `ts`
is the ordering key.
