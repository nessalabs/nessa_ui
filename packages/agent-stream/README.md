# @nessa-ui/agent-stream

Parsers that normalize agent streams — OpenAI Agents SDK, Claude Code, the
Claude Agent SDK and Messages API, Codex, Cursor Agent, opencode, and ACP —
onto one event contract.

No dependencies, no peer dependencies, no React. The package parses bytes into
data; drawing that data is somebody else's job.

## Installation

```sh
npm install @nessa-ui/agent-stream
```

## The two entries

```
wire        line  →  tagged union            no state at all
mapper      wire  →  normalized event log    the only stateful piece
fold        log   →  turns, groups, runs     pure, re-runs on every render
```

The main entry stops at the normalized event log. A host that wants to draw its
own transcript takes `AgentEvent[]` and goes.

```ts
import { ClaudeStreamMapper, type AgentEvent } from "@nessa-ui/agent-stream"

const mapper = new ClaudeStreamMapper()
for await (const line of lines) {
  const events: readonly AgentEvent[] = mapper.push(line)
}
```

The fold is optional and ships behind its own subpath, because grouping events
into turns and collapsing tool runs is a layout decision, not a parsing one.

```ts
import { buildTranscript, TranscriptBuilder } from "@nessa-ui/agent-stream/transcript"

const transcript = buildTranscript(events)
```

Use `TranscriptBuilder` instead of `buildTranscript` for a live stream: it
applies one event at a time rather than re-folding the whole log.

## Providers

Provider surfaces are namespaced, not flattened — two providers want the same
names, and a star-export collision would make adding a third a breaking change.

```ts
import { acp, claude, codex, cursor, openai, opencode } from "@nessa-ui/agent-stream"
```

The mappers — and the `map*Stream` helpers that drive them over a whole
capture — are also exported flat, since reaching for a parser by name is the
common case: `ClaudeStreamMapper`, `CodexStreamMapper`, `CodexAppServerMapper`,
`CursorStreamMapper`, `OpencodeRunMapper`, `OpencodeServerMapper`, `AcpMapper`,
`OpenAIAgentsMapper`, `ClaudeAgentSdkMapper`, `ClaudeMessagesMapper`.

### OpenAI Agents SDK

The SDK yields objects rather than text frames. Serialize each event to keep
the parser dependency-free, then explicitly close the run after all SDK work
(including persistence and compaction hooks) has completed:

```ts
const mapper = new OpenAIAgentsMapper({ sessionId: runId, model: "gpt-5.4" })
const stream = await run(agent, input, { stream: true })

for await (const event of stream) consume(mapper.push(JSON.stringify(event)))
await stream.completed
consume(mapper.finish({
  status: stream.interruptions?.length ? "interrupted" : "completed",
}))
```

`finish()` is intentional: `response_done` ends one model request, but an agent
run can execute a tool and make another model request before it ends.

### Claude Agent SDK

`query()` yields Claude Code's own `stream-json` vocabulary as objects — the
same `system/init`, `assistant`, `result` and delegated-task lines, with the
same fields. So there is no second parser: `ClaudeAgentSdkMapper` delegates to
`ClaudeStreamMapper` and only adds the object seam.

```ts
const mapper = new ClaudeAgentSdkMapper()

for await (const message of query({
  prompt,
  // Without this the SDK yields committed messages only — no token previews.
  options: { includePartialMessages: true },
})) {
  consume(mapper.pushMessage(message))
}
```

**Approvals never appear on this stream.** `canUseTool` is answered in-process,
so there is no permission event to wait for; a refusal surfaces as a failed
tool result and in `permission_denials` on the turn's `result`.

### Messages API

The raw `client.messages.stream()` frames, with no CLI around them. Two things
follow from that, and both change how a host drives the mapper.

It is **one response, not a session** — nothing announces a session id, a model
list, or a tool list, so the host names the session. And it is **only half the
conversation**: tool results live in the host's next request and never appear
on the stream, so the host hands them back.

```ts
const mapper = new ClaudeMessagesMapper({ sessionId: conversationId })

const stream = client.messages.stream({ model, max_tokens, tools, messages })
for await (const event of stream) consume(mapper.map(event))

// The stream cannot report this: you ran the tool, so you report it.
consume(mapper.recordToolResult(callId, { content: output }))
```

A `tool_use` stop deliberately emits no `turn_completed` — the model is waiting
for that result, and the turn continues into the next request rather than
ending. Server-side tools (`web_search`, `code_execution`) are the exception
that needs nothing from the host: they complete from the stream itself.

## React

`@nessa-ui/react` re-exports everything here, so an existing React host needs no
change. New code should import from this package directly.
