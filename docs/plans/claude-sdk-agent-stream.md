# Claude SDK support in `agent-stream`

Status: implemented against `@anthropic-ai/claude-agent-sdk` 0.3.260 (embedding
Claude Code 2.1.260) and `@anthropic-ai/sdk` 0.123.0 on 2026-09-04.

"Claude SDK" turned out to be two different wires, and the difference between
them is the whole story: one needed no parser at all, the other needed a new
one.

## Observed data

Twenty-one captures are checked in, taken with scripted runs against a live API
key: ten under `fixtures/agent-stream/claude-messages/` and eleven under
`fixtures/agent-stream/claude-agent-sdk/`.

The Agent SDK set deliberately mirrors the CLI fixtures scenario for scenario —
plain text, tools, plan, subagent, workflow, multi-phase workflow, failed tool,
web search, both approval outcomes, and resume-with-model-swap — using the same
prompts. Recording it any other way would compare two different conversations
and call the difference a property of the transport. It also gives the
Storybook explorer something to show per transport: before this, selecting a
transport with no captures of its own left the previous transport's transcript
on screen under the new transport's name.

The Messages API list is shorter, and that is a finding rather than a gap: it
has no plan tool, no subagents and no workflows to record.

### The Agent SDK yields Claude Code's wire

`query()` yields exactly the vocabulary the CLI prints, as objects:

```text
system/init      system/status    stream_event [message_start]
assistant        user             system/task_started
result/success   system/task_progress   system/task_notification
```

Running the existing `ClaudeStreamMapper` over all eleven captures produced
**zero unknown and zero error events** — including the subagent task lifecycle,
the workflow phase board, the incremental plan tools, and a resumed session's
model swap. There was nothing to write a parser for.

### The Messages API is a different wire entirely

Bare SSE frames, with no envelope, no `session_id`, and no line kinds of its
own:

```json
{"type":"message_start","message":{"id":"msg_01…","model":"claude-opus-5","usage":{…}}}
{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_01…","name":"get_weather"}}
{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"ci"}}
{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":89,"output_tokens_details":{"thinking_tokens":0}}}
```

| Frame | Discriminator | Meaning |
| --- | --- | --- |
| `message_start` | — | the only frame naming the model; opens block indexing |
| `content_block_start` | `content_block.type` | text, thinking, tool_use, server_tool_use, or a server tool's result |
| `content_block_delta` | `delta.type` | text, thinking, signature, or argument fragments |
| `content_block_stop` | *(mapper state)* | the block is whole — the only point a tool call is complete |
| `message_delta` | `delta.stop_reason` | the turn terminator, except on `tool_use` |

## Implemented mapping

| Shape | `AgentEvent` | Notes |
| --- | --- | --- |
| `message_start` | `session_started` / `model_changed` | host supplies the session id; the wire has none |
| `content_block_start` | `delta/block_start` | identity arrives once, up front, and every later frame carries only the index |
| text / thinking deltas | `delta/text` | previews, superseded at block stop |
| `input_json_delta` | `delta/input` | only the concatenation is valid JSON |
| `signature_delta` | *(nothing)* | base64 for replay; appending it would put it on screen |
| `content_block_stop` | `assistant_text` / `reasoning` / `tool_call_started` | a call is only whole here |
| `web_search_tool_result`, `code_execution_tool_result` | `tool_call_completed` | server tools answer on the stream |
| `message_delta` | `turn_completed` | usage merged with `message_start`'s half |
| `message_delta` @ `tool_use` | *(nothing)* | not a turn ending — see below |
| `recordToolResult()` | `tool_call_completed` | the host's half of the conversation |

Three decisions are worth stating because the obvious alternative is wrong:

- **A `tool_use` stop ends no turn.** It is the model handing control to the
  host mid-turn. Reporting it as a completed turn would split one turn into as
  many turns as it made tool calls.
- **Usage is merged across two frames.** `message_start` carries the input side
  and an output placeholder of 1; `message_delta` carries the real output count.
  Either alone understates the turn.
- **`reasoningTokens` is real here.** This wire reports
  `output_tokens_details.thinking_tokens`, which Claude Code's stream does not —
  so the figure is reported rather than nulled, and deliberately not added into
  the total the API already counts it in.

## Limits the host must own

- **Tool results never appear on the Messages API stream.** They live in the
  host's next request. Call `recordToolResult()` or every call stays pending
  forever. Server-side tools are the exception — they complete from the stream.
- **The Messages API stream advertises nothing.** No tools, no cwd, no
  permission mode; a composer picker cannot be built from it. `SessionInfo` is
  null and empty on purpose rather than backfilled from the request.
- **Neither wire carries a timestamp.** Events order by sequence only.
- **Agent SDK approvals are invisible.** `canUseTool` is answered in-process, so
  no permission line is written. A refusal is recoverable from the `is_error`
  tool result and from `permission_denials` on the `result` line. A surface
  waiting for `permission_requested` here waits forever.
- **Agent SDK previews are opt-in.** Without `includePartialMessages`, `query()`
  yields committed messages only.

## Re-capturing

The scripts are not checked in; they are short and their shape is recorded here.
Both write one JSON object per line, exactly as the SDK yields it. The Messages
API scenarios are `text`, `thinking`, `tools`, `parallel`, `search`, `eager`,
`structured`, `image`, `truncated`, and `failing`; the Agent SDK's are
`printed`, `tools`, `todos`, `subagent`, `workflow`, `phases`, `failing`,
`websearch`, `approval-allow`, `approval-deny`, and `resume`.

Four traps worth repeating, each of which cost a capture:

- Listing a bare tool name in `allowedTools` auto-approves it *before*
  `canUseTool` is consulted, so an approval capture taken that way contains no
  approval. The SDK warns; heed it.
- `display: "summarized"` is required to capture thinking text — the default
  streams thinking blocks with empty content, which teaches a parser nothing
  about the delta shapes it must join.
- An allow rule in the *developer's own* settings shadows `canUseTool` silently
  — `echo` is commonly covered, so an approval capture built around it records
  a tool call and no approval. Use a command no rule covers (`rm` inside the
  sandbox) and assert the callback actually fired.
- The workflow tool is named `Workflow`. Omitting it from `allowedTools` yields
  a `permission_denied` line and no workflow board at all.

Compaction is deliberately not captured here. Its threshold is not configurable
on the Messages API, and the Agent SDK emits the same `compact_boundary` line
the CLI does, which `fixtures/agent-stream/compaction.jsonl` already covers.
