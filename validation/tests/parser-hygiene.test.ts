import assert from "node:assert/strict"
import test from "node:test"

import { ownsNarrowing } from "../nessa/checks/parser-hygiene.ts"

test("PARSE-003 exempts the shared readers and every decoder boundary, at any depth", () => {
  // The readers themselves use `typeof` — that is the point of putting them in
  // one module rather than scattering them.
  assert.equal(ownsNarrowing("packages/agent-stream/src/json.ts"), true)

  // One-level and nested transports are the same boundary. A one-segment regex
  // would accept only the first of these and reject every real nested wire.
  for (const filePath of [
    "packages/agent-stream/src/acp/wire.ts",
    "packages/agent-stream/src/acp/frame.ts",
    "packages/agent-stream/src/claude/stream/wire.ts",
    "packages/agent-stream/src/codex/exec/wire.ts",
    "packages/agent-stream/src/codex/app-server/wire.ts",
    "packages/agent-stream/src/opencode/run/wire.ts",
    "packages/agent-stream/src/opencode/server/wire.ts",
  ]) {
    assert.equal(ownsNarrowing(filePath), true, filePath)
  }
})

test("PARSE-003 does not exempt mappers, mapping tables, or the fold", () => {
  for (const filePath of [
    "packages/agent-stream/src/events.ts",
    "packages/agent-stream/src/acp/mapper.ts",
    "packages/agent-stream/src/claude/stream/mapper.ts",
    "packages/agent-stream/src/claude/stream/mapping.ts",
    "packages/agent-stream/src/codex/exec/mapper.ts",
    "packages/agent-stream/src/opencode/parts.ts",
    "packages/agent-stream/src/transcript/fold.ts",
    "packages/react/src/lib/agent-stream/src/json.ts",
    "packages/agent-stream/src/json.test.ts",
  ]) {
    assert.equal(ownsNarrowing(filePath), false, filePath)
  }
})
