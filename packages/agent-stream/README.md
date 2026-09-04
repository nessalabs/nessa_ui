# @nessalabs/agent-stream

Parsers that normalize coding-agent CLI streams — Claude Code, Codex,
Cursor Agent, opencode, and ACP — onto one event contract.

No dependencies, no peer dependencies, no React. The package parses bytes into
data; drawing that data is somebody else's job.

## Installation

```sh
npm install @nessalabs/agent-stream
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
import { ClaudeStreamMapper, type AgentEvent } from "@nessalabs/agent-stream"

const mapper = new ClaudeStreamMapper()
for await (const line of lines) {
  const events: readonly AgentEvent[] = mapper.push(line)
}
```

The fold is optional and ships behind its own subpath, because grouping events
into turns and collapsing tool runs is a layout decision, not a parsing one.

```ts
import { buildTranscript, TranscriptBuilder } from "@nessalabs/agent-stream/transcript"

const transcript = buildTranscript(events)
```

Use `TranscriptBuilder` instead of `buildTranscript` for a live stream: it
applies one event at a time rather than re-folding the whole log.

## Providers

Provider surfaces are namespaced, not flattened — two providers want the same
names, and a star-export collision would make adding a third a breaking change.

```ts
import { acp, claude, codex, cursor, opencode } from "@nessalabs/agent-stream"
```

The mappers — and the `map*Stream` helpers that drive them over a whole
capture — are also exported flat, since reaching for a parser by name is the
common case: `ClaudeStreamMapper`, `CodexStreamMapper`, `CodexAppServerMapper`,
`CursorStreamMapper`, `OpencodeRunMapper`, `OpencodeServerMapper`, `AcpMapper`.

## React

`@nessalabs/ui` re-exports everything here, so an existing React host needs no
change. New code should import from this package directly.
