---
name: agent-stream
description: Parse a coding agent's output stream (Claude Code `--output-format stream-json`) into structured events, and render or query them. Use when building a chat transcript, activity feed, run inspector, composer picker, or anything else that consumes an agent CLI's stdout — or when adding support for a second agent provider.
---

# Parsing an agent's output stream

`@nessa-ui/agent-stream` is a framework-free parser at
`packages/agent-stream/src/`. It turns an agent CLI's bytes into a
normalized event log, and optionally folds that log into renderable turns.

The package has no dependencies and no peer dependencies — a Node process or a
non-React host can consume it. `@nessa-ui/react` re-exports the whole surface,
so an existing React host needs no change; new code should import from
`@nessa-ui/agent-stream` directly.

This file is deliberately short on specifics. **Signatures and field names
change; the sources below are always current, and this is not.**

| Question | Read |
| --- | --- |
| What can I call? | `packages/agent-stream/src/index.ts` — the contract and providers, stopping at the agent message |
| Where is the fold? | `packages/agent-stream/src/transcript/` — imported as `@nessa-ui/agent-stream/transcript` |
| What is in an event? | `events.ts` — the contract, with every payload variant documented |
| How do I actually use it? | `agent-stream.test.ts` — executable examples against real captures |
| Why is the wire like this? | [docs/architecture/agent-stream-parsers.md](../../docs/architecture/agent-stream-parsers.md) |
| What does the data look like? | `apps/storybook/stories/fixtures/agent-stream/*.jsonl`, and `codex/` beside it |
| What does it look like rendered? | Storybook → Composites → AgentStream |

## The shape of the thing

Three layers, one direction:

```
wire        line  →  tagged union          per provider, no state
mapper      wire  →  normalized events     per provider, the only stateful part
fold        log   →  turns, runs, plan     shared, optional
```

**Your job is the UI; the parser's job ends at structured events.** That
boundary is the package's shape, not just advice: the main entry stops at the
event log, and the fold ships behind `@nessa-ui/agent-stream/transcript`. The
folds exist because turn boundaries and tool-run grouping are subtle enough that
every consumer would re-derive them — but they are a convenience, not a
requirement. Read the event log directly if you want a different shape. The
Storybook story is a demo, not a shipped component.

## Choosing an entry point

- **A finished log** — map the text, fold it once.
- **A running process** — construct a mapper and an incremental builder, push
  lines as they arrive, and take a snapshot per *frame*, not per event.

Re-folding the whole log on every arriving line is a linear fold run per event
over a log that grows per event. That is the one mistake that makes a long
session crawl, and it is why the incremental builder exists.

Whether a process is still running is **not** derivable from the events, so the
fold takes it as an argument: while live, a tool call with no result is
*pending*; once the process is gone, the same call is *abandoned*. That is the
difference between a shimmering row and a dead one.

Snapshots hand back append-only collections whose identity deliberately does not
change — copying a session's events per frame is the cost the design avoids — so
memoize on the revision counter the snapshot carries, not on object identity.

## Rules that bite

- **Order by sequence, never by timestamp.** Most lines carry no time.
- **A streamed delta is a preview**, superseded by the committed event for the
  same block. Deltas are optional — delegated runs stream none — so anything you
  build must render correctly without them.
- **Unknown events are normal.** The CLI adds line kinds between releases; they
  arrive as an explicit unknown payload with the raw line attached. Never crash,
  and prefer showing nothing to guessing.
- **Agent identity is a path, not an id.** The main conversation is the empty
  path; each further element is the tool call that spawned the next level down.
- **Never invent data to fill a field.** Usage counters are nullable precisely
  so a provider that reports only a total cannot claim zero input tokens.
- **A wire is only true of a build.** Every provider records the CLI version its
  shapes were read from; check it before trusting a field, and update it in the
  same commit as any recapture.
- **One provider can have several wires.** opencode streams nothing on its
  one-way stream and a token at a time on its server bus, so "does this agent
  stream" is a question about the transport, not the agent. Ask
  `transportOf(provider, transport)` rather than hardcoding it, and treat `null`
  as "nobody captured this", which is not the same as "no".
- **Separate protocols get separate modules.** A provider folder holds the
  payload its transports share and one subfolder per wire; only what is
  genuinely identical is shared.
- **Compaction removes history from the model, not from the transcript.** Keep
  drawing what was already drawn; mark the boundary instead of trimming to it.
  A compacted run is not a failed one, and one provider does not announce it at
  all — never infer "no boundary" from a silent stream.
- **An approval is a conversation, not a broadcast.** One line asks and blocks;
  the answer goes back on the input stream. Record which way it was answered —
  a decision that says only "answered" cannot be drawn. A refused tool fails,
  but the turn does not.

## Delegated work has three visibility levels

| | streamed | events readable | full transcript |
| --- | --- | --- | --- |
| Main thread | yes | yes | yes |
| Subagent | no | yes | on disk |
| Workflow agent | no | no | on disk |

Conflating these produces a UI that lies. A workflow's agents can be *watched*
through the progress board it republishes, not *read*. A subagent's final report
is not among its own events — it arrives as the spawning call's tool result.

Every delegated conversation is written to disk, and the wire hands you the keys
to find it. The store module is pure path arithmetic; **your host does the file
reading**, and the same parser reads what comes back. When a path cannot be
built yet, the pointer says what is missing rather than guessing.

## Adding a provider

A provider is a folder; nothing else moves. Give it its own wire shapes and
vocabularies, a mapping table stating **as data** which of its line kinds
becomes which normalized event (including the kinds that deliberately become
nothing, with the reason), and a mapper implementing the shared mapper
interface. Export it namespaced, never flat — two star-exports sharing a name
silently elide the symbol.

`claude/` and `codex/` are two worked examples. Copy their shape, not their
vocabulary — and read both before assuming a rule generalizes: what looks like
a property of agents is often a property of the one you started with.

Three contracts are enforced by `pnpm validate`, so the check will tell you if
you drift: no TypeScript enums for wire vocabularies (an enum is nominal and
cannot survive JSON), exported vocabularies frozen at runtime, and every wire
value narrowed through the shared readers rather than by hand.

## Capturing fixtures

```bash
claude -p --output-format stream-json --include-partial-messages --verbose \
  --model sonnet "<prompt>" --allowed-tools Bash Read Write > capture.jsonl
```

Put the prompt **before** `--allowed-tools`; the flag is variadic and swallows
it otherwise. Design against captures, never against remembered field names —
the wire moves, and a fixture is what tells you where it moved to.

opencode's one-way stream is `opencode run --format json`; its streaming wire is
the SSE bus at `GET /event` on `opencode serve`. Root the sandbox in a git repo
first, or every write lands outside the project root and is auto-rejected.

To capture an approval, the sandbox needs a settings file that escalates
something, or nothing will ever ask. Run with `--input-format stream-json` and
`--permission-prompt-tool stdio`, then write the answer back on stdin.

```json
{ "permissions": { "ask": ["Bash(*)"], "defaultMode": "default" } }
```

To capture a compaction, fill the window with generated files rather than
authored text, and grow it in small steps — a read big enough to overshoot the
threshold ends the run with "Prompt is too long" instead of compacting.
