#!/usr/bin/env node
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { runCommand } from "./process.ts"

const execFileAsync = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const allowedNewIgnored = ["packages/react/dist/", "apps/storybook/storybook-static/"]

async function gitList(repoRoot: string, args: readonly string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", [...args, "-z"], { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 })
  return stdout.split("\0").filter(Boolean).sort()
}

async function sourceSnapshot(repoRoot: string): Promise<Map<string, string>> {
  const [indexedPaths, deletedPaths] = await Promise.all([
    gitList(repoRoot, ["ls-files", "--cached", "--others", "--exclude-standard"]),
    gitList(repoRoot, ["ls-files", "--deleted"]),
  ])
  const deleted = new Set(deletedPaths)
  const paths = indexedPaths.filter((filePath) => !deleted.has(filePath))
  const entries = await Promise.all(paths.map(async (filePath) => {
    const content = await readFile(path.join(repoRoot, filePath))
    return [filePath, createHash("sha256").update(content).digest("hex")] as const
  }))
  return new Map(entries)
}

async function ignoredRoots(repoRoot: string): Promise<Set<string>> {
  return new Set(await gitList(repoRoot, ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"]))
}

export function compareSnapshots(before: Map<string, string>, after: Map<string, string>): string[] {
  const changes: string[] = []
  for (const [filePath, digest] of before) {
    if (!after.has(filePath)) changes.push(`removed ${filePath}`)
    else if (after.get(filePath) !== digest) changes.push(`modified ${filePath}`)
  }
  for (const filePath of after.keys()) if (!before.has(filePath)) changes.push(`created ${filePath}`)
  return changes.sort()
}

export function unexpectedIgnored(before: ReadonlySet<string>, after: ReadonlySet<string>, allowedPrefixes = allowedNewIgnored): string[] {
  return [...after].filter((entry) => !before.has(entry) && !allowedPrefixes.some((prefix) => entry.startsWith(prefix) || prefix.startsWith(entry))).sort()
}

export interface FullValidationOptions {
  repoRoot?: string
  commands?: readonly (readonly [string, readonly string[]])[]
  execute?: (command: string, args: readonly string[], cwd: string) => Promise<void>
}

export async function validateFull(options: FullValidationOptions = {}): Promise<void> {
  const repoRoot = options.repoRoot ?? root
  const before = await sourceSnapshot(repoRoot)
  const ignoredBefore = await ignoredRoots(repoRoot)
  let failure: unknown
  try {
    const commands = options.commands ?? [
      ["pnpm", ["validate"]],
      ["pnpm", ["validate:contracts:test"]],
      ["pnpm", ["typecheck"]],
      ["pnpm", ["test"]],
      ["pnpm", ["test:unit"]],
      ["pnpm", ["validate:artifacts"]],
      ["pnpm", ["check:registry"]],
      ["pnpm", ["check:package"]],
      ["pnpm", ["check:storybook-docs"]],
    ]
    for (const [command, args] of commands) {
      if (options.execute) await options.execute(command, args, repoRoot)
      else await runCommand(command, args, { cwd: repoRoot })
    }
  } catch (error) {
    failure = error
  } finally {
    const after = await sourceSnapshot(repoRoot)
    const ignoredAfter = await ignoredRoots(repoRoot)
    const mutations = compareSnapshots(before, after)
    for (const entry of unexpectedIgnored(ignoredBefore, ignoredAfter)) mutations.push(`created ignored path ${entry}`)
    if (mutations.length) {
      const mutationError = new Error(`Full validation mutated protected repository content:\n${mutations.join("\n")}`)
      if (!failure) failure = mutationError
      else failure = new AggregateError([failure, mutationError], "Full validation failed and mutated protected content")
    }
  }
  if (failure) throw failure
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateFull().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
