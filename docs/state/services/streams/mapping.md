---
id: "ui-mapping"
title: "Transport mapping"
kind: "contract"
status: "implemented"
summary: "Select a mapper for the actual transport, not just the provider's brand. The same provider can expose a one-way command stream, an interactive server protocol and an SDK with different event and permission behavior."
parent: "ui-streams"
sources:
  [
    "packages/agent-stream/src/contract.ts",
    "packages/agent-stream/src/transports.ts",
    "packages/agent-stream/src/events.ts",
    "packages/agent-stream/src/emitter.ts",
    "packages/agent-stream/src/json.ts",
    "packages/agent-stream/src/openai/agents/mapper.ts",
    "packages/agent-stream/src/codex/exec/mapper.ts",
    "packages/agent-stream/src/acp/mapper.ts",
    "packages/agent-stream/src/opencode/server/mapper.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Match the mapper to the wire

Select a mapper for the actual transport, not just the provider's brand. The same provider can expose a one-way command stream, an interactive server protocol and an SDK with different event and permission behavior.

| Namespace  | Implemented mapping surfaces                    |
| ---------- | ----------------------------------------------- |
| `claude`   | CLI stream, Agent SDK messages, Messages stream |
| `codex`    | exec JSON stream and app-server frames          |
| `cursor`   | CLI stream                                      |
| `opencode` | run stream and server bus                       |
| `acp`      | Agent Client Protocol frames                    |
| `openai`   | Agents SDK streamed objects/events              |

`AGENT_TRANSPORTS`, `transportOf` and `transportsOf` expose captured protocol provenance and support facts. A support value `null` means uncaptured/unknown, not false. Versions in these records describe the inspected capture, not whatever CLI happens to be installed today. Do not enable steering or permission controls solely because another transport from the same provider supports them.

Wire parsers narrow JSON values; mappers keep session, call and block correlation state and emit normalized events. Preserve raw payloads and sequence numbers. Timestamp may be absent and is not the ordering authority. Unknown or unreadable records have explicit handling in the provider mapper; a successful JSON parse alone does not validate every nested field. `parseJsonLine` requires a type-tagged object, while JSON-RPC object parsing must not require a `type` field.

EventSink numbers emitted events and retains session/call bookkeeping and stable block positions. Use a mapper for the intended stream lifetime and manage continuation sequence deliberately. Do not merge unrelated sessions into a single transcript without filtering; the opencode server bus can carry more than one session. A host owns reading lines, reconnects, credentials, child processes and durable storage.

OpenAI Agents SDK additionally accepts serializable objects through `map`. The host supplies a stable session/run ID and model when known, then calls `finish` after stream completion to express completion/interruption/error. These APIs normalize observations; they do not send an approval, interrupt the SDK run or call a tool. Nullable usage stays unknown rather than becoming a fabricated zero.

The executed provider fixture tests cover recorded and synthetic protocol shapes. They are not live integration runs against all current provider releases. [Transcript](transcript.md) explains how normalized events become a reading view.
