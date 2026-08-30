import assert from "node:assert/strict"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { defineCheck, validateGlob } from "../framework/define-check.ts"
import { createFileIndex } from "../framework/file-index.ts"
import { InMemoryCache } from "../framework/in-memory-cache.ts"
import { runChecks } from "../framework/runner.ts"
import { renderJson, renderText, sortFindings } from "../framework/reporter.ts"
import { runBounded } from "../framework/scheduler.ts"
import { collectArtifactPaths, combineChangedPaths, excludeDeletedPaths } from "../run.ts"

test("glob contract is POSIX-normalized, dot-aware, and rejects unsupported syntax", () => {
  const index = createFileIndex(["src\\nested\\a.ts", ".github/workflows/check.yml", "src/root.ts"])
  assert.deepEqual(index.match(["src/**/*.ts"]), ["src/nested/a.ts", "src/root.ts"])
  assert.deepEqual(index.match(["**/*.yml"]), [".github/workflows/check.yml"])
  assert.throws(() => validateGlob("+(src|test)/**"), /extglobs/)
  assert.throws(() => validateGlob("src/[abc"), /unbalanced/)
  assert.throws(() => validateGlob("!src/**"), /unsupported/)
})

test("the artifacts phase indexes every published package's dist, not only React's", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nessa-artifacts-"))
  try {
    await mkdir(path.join(root, "packages/react/dist"), { recursive: true })
    await mkdir(path.join(root, "packages/agent-stream/dist"), { recursive: true })
    await writeFile(path.join(root, "packages/react/dist/index.js"), "react")
    await writeFile(path.join(root, "packages/agent-stream/dist/index.js"), "parser")
    await writeFile(path.join(root, "packages/agent-stream/dist/transcript.js"), "fold")
    const paths = await collectArtifactPaths(root)
    assert.deepEqual(paths.sort(), [
      "packages/agent-stream/dist/index.js",
      "packages/agent-stream/dist/transcript.js",
      "packages/react/dist/index.js",
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("changed-path selection includes new untracked files deterministically", () => {
  assert.deepEqual(combineChangedPaths(["tracked.ts", "same.ts"], ["new.ts", "same.ts"]), ["new.ts", "same.ts", "tracked.ts"])
  assert.deepEqual(excludeDeletedPaths(["kept.ts", "deleted.ts", "new.ts"], ["deleted.ts"]), ["kept.ts", "new.ts"])
})

test("bounded scheduler preserves task order without exceeding concurrency", async () => {
  let active = 0
  let maximum = 0
  const results = await runBounded(Array.from({ length: 12 }, (_, index) => async () => {
    active += 1; maximum = Math.max(maximum, active)
    await new Promise((resolve) => setTimeout(resolve, (12 - index) % 3))
    active -= 1
    return index
  }), 3)
  assert.deepEqual(results, Array.from({ length: 12 }, (_, index) => index))
  assert.ok(maximum <= 3)
})

test("reporting is code-unit deterministic and preserves authority in text and JSON", () => {
  const findings = sortFindings([
    { checkId: "z", contractId: "B-001", state: "PASS", severity: "notice", message: "second", authority: "docs#b" },
    { checkId: "a", contractId: "A-001", state: "FAIL", severity: "error", message: "first", authority: "docs#a" },
  ])
  const report = { schemaVersion: 1 as const, selection: { requestedContracts: [], changedSince: null, executedChecks: [], dependencyChecks: [], globalChecks: [], skippedChecks: [] }, summary: { PASS: 1, FAIL: 1, EXCEPTION: 0, PLANNED: 0, REVIEW: 0, SKIPPED: 0, exitCode: 1 }, results: findings }
  assert.deepEqual(findings.map((finding) => finding.contractId), ["A-001", "B-001"])
  assert.match(renderText(report), /Authority: docs#a/)
  assert.equal(JSON.parse(renderJson(report)).results[0].authority, "docs#a")
})

test("runner respects dependencies and emits deterministic results", async () => {
  const events: string[] = []
  const first = defineCheck({
    id: "first",
    phase: "source",
    inputs: ["**/*.ts"],
    dependsOn: [],
    global: false,
    async run(context) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      events.push("first")
      return [context.pass("first")]
    },
  })
  const second = defineCheck({
    id: "second",
    phase: "source",
    inputs: ["**/*.ts"],
    dependsOn: ["first"],
    global: false,
    run(context) {
      events.push("second")
      return [context.pass("second")]
    },
  })
  const report = await runChecks({
    repoRoot: process.cwd(),
    files: createFileIndex(["a.ts"]),
    cache: new InMemoryCache(process.cwd()),
    checks: [second, first],
    phase: "source",
  })
  assert.deepEqual(events, ["first", "second"])
  assert.deepEqual(report.selection.executedChecks, ["first", "second"])
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.summary.exitCode, 0)
})

test("changed mode always retains global checks and dependency closure", async () => {
  const dependency = defineCheck({ id: "dependency", phase: "source", inputs: ["a.ts"], dependsOn: [], global: false, run: (context) => [context.pass("dependency")] })
  const selected = defineCheck({ id: "selected", phase: "source", inputs: ["b.ts"], dependsOn: ["dependency"], global: false, run: (context) => [context.pass("selected")] })
  const global = defineCheck({ id: "global", phase: "source", inputs: ["**"], dependsOn: [], global: true, run: (context) => [context.pass("global")] })
  const report = await runChecks({
    repoRoot: process.cwd(),
    files: createFileIndex(["a.ts", "b.ts", "c.ts"]),
    cache: new InMemoryCache(process.cwd()),
    checks: [dependency, selected, global],
    phase: "source",
    requestedCheckIds: ["selected", "global"],
    changedPaths: ["b.ts"],
  })
  assert.deepEqual(report.selection.executedChecks, ["dependency", "global", "selected"])
  assert.deepEqual(report.selection.dependencyChecks, ["dependency"])
  assert.deepEqual(report.selection.skippedChecks, [])

  const defaultRoots = await runChecks({
    repoRoot: process.cwd(), files: createFileIndex(["a.ts", "b.ts", "c.ts"]), cache: new InMemoryCache(process.cwd()),
    checks: [dependency, selected, global], phase: "source", changedPaths: ["b.ts"],
  })
  assert.deepEqual(defaultRoots.selection.executedChecks, ["dependency", "global", "selected"])
  assert.deepEqual(defaultRoots.selection.dependencyChecks, ["dependency"])
})

test("ordinary check context has no subprocess capability", () => {
  const source = defineCheck.toString()
  assert.ok(!source.includes("runRepositoryCommand"))
})

test("runner turns undeclared reads into a check failure", async () => {
  const check = defineCheck({
    id: "declared-only",
    phase: "source",
    inputs: ["allowed.ts"],
    dependsOn: [],
    global: false,
    async run(context) {
      await context.readText("not-declared.ts")
      return []
    },
  })
  const report = await runChecks({ repoRoot: process.cwd(), files: createFileIndex(["allowed.ts", "not-declared.ts"]), cache: new InMemoryCache(process.cwd()), checks: [check], phase: "source" })
  assert.equal(report.summary.FAIL, 1)
  assert.match(report.results[0]!.message, /undeclared input/)
})

test("one invocation memoizes normalized paths and parser results", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nessa-cache-"))
  try {
    await writeFile(path.join(directory, "fixture.css"), ".a { color: red }")
    const cache = new InMemoryCache(directory)
    assert.equal(cache.readText("fixture.css"), cache.readText("./fixture.css"))
    assert.equal(cache.parseCss("fixture.css"), cache.parseCss("./fixture.css"))
    const first = cache.parseSelector(".a")
    const second = cache.parseSelector(".a")
    assert.notEqual(first, second)
    assert.equal(first.toString(), second.toString())
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("framework import boundary contains no Nessa policy", async () => {
  const directory = path.resolve("validation/framework")
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".ts")) continue
    const source = await readFile(path.join(directory, name), "utf8")
    assert.doesNotMatch(source, /validation\/nessa|\.\.\/contracts|\.\.\/exceptions|nessa-ui|packages\/react/)
  }
})
