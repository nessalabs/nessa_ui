import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { compareSnapshots, unexpectedIgnored, validateFull } from "../full.ts"

test("full gate detects tracked and untracked path/content mutations", () => {
  const before = new Map([["tracked.ts", "one"], ["draft.ts", "draft"]])
  const after = new Map([["tracked.ts", "two"], ["created.ts", "new"]])
  assert.deepEqual(compareSnapshots(before, after), ["created created.ts", "modified tracked.ts", "removed draft.ts"])
})

test("full gate permits only enumerated new ignored build roots", () => {
  const before = new Set(["node_modules/"])
  const after = new Set(["node_modules/", "packages/react/dist/", "secret-cache/"])
  assert.deepEqual(unexpectedIgnored(before, after), ["secret-cache/"])
})

async function fixtureRepo(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nessa-full-"))
  execFileSync("git", ["init", "-q"], { cwd: directory })
  await writeFile(path.join(directory, ".gitignore"), "packages/react/dist/\ncache/\n")
  await writeFile(path.join(directory, "tracked.ts"), "tracked\n")
  await writeFile(path.join(directory, "draft.ts"), "draft\n")
  execFileSync("git", ["add", ".gitignore", "tracked.ts"], { cwd: directory })
  return directory
}

test("full gate outer finally reports tracked and untracked mutations even after command failure", async () => {
  const directory = await fixtureRepo()
  try {
    await assert.rejects(validateFull({
      repoRoot: directory,
      commands: [["fixture", []]],
      execute: async () => {
        await writeFile(path.join(directory, "tracked.ts"), "changed\n")
        await unlink(path.join(directory, "draft.ts"))
        await writeFile(path.join(directory, "created.ts"), "new\n")
        throw new Error("command failed")
      },
    }), (error: unknown) => error instanceof AggregateError && /failed and mutated/.test(error.message))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("full gate allows declared ignored build output replacement", async () => {
  const directory = await fixtureRepo()
  try {
    await validateFull({
      repoRoot: directory,
      commands: [["fixture", []]],
      execute: async () => {
        await mkdir(path.join(directory, "packages/react/dist"), { recursive: true })
        await writeFile(path.join(directory, "packages/react/dist/index.js"), "built")
      },
    })
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("full gate rejects newly created unexpected ignored roots", async () => {
  const directory = await fixtureRepo()
  try {
    await assert.rejects(validateFull({
      repoRoot: directory,
      commands: [["fixture", []]],
      execute: async () => {
        await mkdir(path.join(directory, "cache"))
        await writeFile(path.join(directory, "cache/value"), "hidden")
      },
    }), /created ignored path cache\//)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
