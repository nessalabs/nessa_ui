# Capturing the Claude SDK fixtures

The `.jsonl` files in `claude-messages/` and `claude-agent-sdk/` were produced
by the two scripts here, against a live API key. They are checked in for one
reason: **a fixture is only evidence if someone else can reproduce it.** A
capture whose provenance cannot be re-run is indistinguishable from a file
somebody wrote by hand to match the parser — and a parser designed against a
hand-written fixture is designed against nothing.

The CLI wires elsewhere in this directory need no script: they are a shell
redirect, and their commands are recorded in each wire module's provenance and
in [the skill](../../../../../../skills/agent-stream/SKILL.md). These two need
a script because both SDKs yield **objects**, not bytes, so something has to
serialize them.

## Running them

```sh
cd apps/storybook/stories/fixtures/agent-stream/capture
npm install @anthropic-ai/sdk @anthropic-ai/claude-agent-sdk
export ANTHROPIC_API_KEY=sk-ant-...        # never hardcode it in the scripts

node claude-messages.mjs   text   > ../claude-messages/text.jsonl
node claude-agent-sdk.mjs  tools  > ../claude-agent-sdk/tools.jsonl
```

Each script takes one scenario name and writes one JSON object per line,
exactly as the SDK yielded it. Nothing is reshaped — a field a capture script
renamed is a field the parser would be designed against wrongly.

| Script | Scenarios |
| --- | --- |
| `claude-messages.mjs` | `text` `thinking` `tools` `parallel` `search` `eager` `structured` `image` `truncated` `failing` |
| `claude-agent-sdk.mjs` | `printed` `tools` `todos` `subagent` `workflow` `phases` `failing` `websearch` `approval-allow` `approval-deny` `resume` |

The Agent SDK list mirrors the CLI fixtures scenario for scenario, using the
same prompts on purpose. Recording them differently would compare two different
conversations and call the difference a property of the transport.

The Messages API list is shorter, and that is a finding rather than a gap: that
wire has no plan tool, no subagents and no workflows to record.

## Four traps, each of which cost a capture

These are not hypothetical. Every one produced a plausible-looking file that
contained nothing of what it was supposed to demonstrate.

1. **A bare tool name in `allowedTools` auto-approves before `canUseTool` runs.**
   An approval capture taken that way holds a tool call and no approval. The SDK
   prints a warning about exactly this; heed it.
2. **An allow rule in your *own* settings shadows `canUseTool` silently.** `echo`
   is commonly covered, so an approval scenario built around it records nothing.
   Use a command no rule covers — these scripts use `rm` inside a throwaway
   sandbox — and assert the callback actually fired before trusting the file.
3. **Thinking needs `display: "summarized"`.** The default streams `thinking`
   blocks with empty text, which teaches a delta-joining parser nothing.
4. **The workflow tool is named `Workflow`.** Omit it from `allowedTools` and the
   run is refused: you capture a `permission_denied` line and no phase board.

## After re-capturing

Update `version` and `capturedOn` in the matching wire module's provenance in
the same commit — `claude/messages/wire.ts` and `claude/agent-sdk/index.ts`. If
nothing about the shapes changed, that is itself the finding worth recording.

Compaction is deliberately not captured here: its threshold is not configurable
on the Messages API, and the Agent SDK emits the same `compact_boundary` line
the CLI does, which `../compaction.jsonl` already covers.
