#!/usr/bin/env node
import { execFile } from "node:child_process"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { performance } from "node:perf_hooks"

import { contracts } from "./contracts.ts"
import { createFileIndex } from "./framework/file-index.ts"
import { InMemoryCache } from "./framework/in-memory-cache.ts"
import { renderJson, renderText } from "./framework/reporter.ts"
import { runChecks } from "./framework/runner.ts"
import type { CheckPhase, RunReport } from "./framework/types.ts"
import { nessaChecks } from "./nessa/checks/index.ts"
import { governanceHistoryFinding } from "./nessa/governance-history.ts"
import { checkMetadata } from "./nessa/check-metadata.ts"

const execFileAsync = promisify(execFile)
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

interface CliOptions {
  phase: CheckPhase
  format: "text" | "json"
  contracts: string[]
  changedSince?: string
  list: boolean
  explain?: string
  profile: boolean
}

function parseArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = { phase: "source", format: "text", contracts: [], list: false, profile: false }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === "--") continue
    if (argument === "--list") options.list = true
    else if (argument === "--profile") options.profile = true
    else if (argument.startsWith("--phase=")) options.phase = argument.slice(8) as CheckPhase
    else if (argument === "--phase") options.phase = args[++index] as CheckPhase
    else if (argument.startsWith("--format=")) options.format = argument.slice(9) as "text" | "json"
    else if (argument === "--format") options.format = args[++index] as "text" | "json"
    else if (argument === "--contract") options.contracts.push(args[++index] ?? "")
    else if (argument.startsWith("--contract=")) options.contracts.push(argument.slice(11))
    else if (argument === "--changed-since") options.changedSince = args[++index]
    else if (argument.startsWith("--changed-since=")) options.changedSince = argument.slice(16)
    else if (argument === "--explain") options.explain = args[++index]
    else if (argument.startsWith("--explain=")) options.explain = argument.slice(10)
    else throw new Error(`Unknown validation option: ${argument}`)
  }
  if (!(["source", "artifacts"] as const).includes(options.phase)) throw new Error(`Invalid phase: ${options.phase}`)
  if (!(["text", "json"] as const).includes(options.format)) throw new Error(`Invalid format: ${options.format}`)
  return options
}

async function gitPaths(args: readonly string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", [...args, "-z"], { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 })
  return stdout.split("\0").filter(Boolean)
}

export function combineChangedPaths(diffPaths: readonly string[], untrackedPaths: readonly string[]): string[] {
  return [...new Set([...diffPaths, ...untrackedPaths])].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

export function excludeDeletedPaths(indexedPaths: readonly string[], deletedPaths: readonly string[]): string[] {
  const deleted = new Set(deletedPaths)
  return indexedPaths.filter((filePath) => !deleted.has(filePath))
}

async function artifactPaths(): Promise<string[]> {
  const root = path.join(repoRoot, "packages/react/dist")
  const result: string[] = []
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else result.push(path.relative(repoRoot, absolute).replaceAll(path.sep, "/"))
    }
  }
  await walk(root)
  return result
}

export async function runValidation(args = process.argv.slice(2)): Promise<RunReport | null> {
  const options = parseArgs(args)
  if (options.list) {
    for (const entry of contracts) process.stdout.write(`${entry.id}\t${entry.state}\t${entry.title}\n`)
    return null
  }
  if (options.explain) {
    const entry = contracts.find((candidate) => candidate.id === options.explain)
    if (!entry) throw new Error(`Unknown contract: ${options.explain}`)
    process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`)
    return null
  }
  const requestedCheckIds = options.contracts.map((id) => {
    const entry = contracts.find((candidate) => candidate.id === id)
    if (!entry) throw new Error(`Unknown contract: ${id}`)
    if (!entry.check) throw new Error(`${id} is ${entry.state} and has no executable check`)
    return entry.check
  })
  const paths = options.phase === "source"
    ? excludeDeletedPaths(
        await gitPaths(["ls-files", "--cached", "--others", "--exclude-standard"]),
        await gitPaths(["ls-files", "--deleted"]),
      )
    : await artifactPaths()
  const changedPaths = options.changedSince
    ? combineChangedPaths(
        await gitPaths(["diff", "--name-only", options.changedSince, "--"]),
        await gitPaths(["ls-files", "--others", "--exclude-standard"]),
      )
    : undefined
  const started = performance.now()
  const historyFinding = options.phase === "source"
    ? await governanceHistoryFinding(repoRoot, process.env.NESSA_VALIDATION_BASE_REF)
    : null
  const actualCheckIds = new Set(nessaChecks.map((check) => check.id))
  const metadataIssues = nessaChecks.flatMap((check) => {
    const expected = checkMetadata[check.id as keyof typeof checkMetadata]
    return !expected || JSON.stringify({ phase: check.phase, inputs: check.inputs, dependsOn: check.dependsOn, global: check.global }) !== JSON.stringify(expected)
      ? [`Registered check ${check.id} does not exactly match canonical check metadata.`]
      : []
  })
  const registrationFindings = options.phase === "source"
    ? [...contracts.filter((entry) => entry.state === "enforced" && entry.check && !actualCheckIds.has(entry.check)).map((entry) => ({
        checkId: "governance-registration",
        contractId: entry.id,
        state: "FAIL" as const,
        severity: "error" as const,
        message: `${entry.id} names unregistered check ${entry.check}.`,
      })), ...metadataIssues.map((message) => ({ checkId: "governance-registration", contractId: "GOV-001", state: "FAIL" as const, severity: "error" as const, message }))]
    : []
  const report = await runChecks({
    repoRoot,
    files: createFileIndex(paths),
    cache: new InMemoryCache(repoRoot),
    checks: nessaChecks,
    phase: options.phase,
    requestedCheckIds,
    changedPaths,
    changedSince: options.changedSince,
    additionalFindings: [...(historyFinding ? [historyFinding] : []), ...registrationFindings],
  })
  const authorityByContract = new Map(contracts.map((entry) => [entry.id, entry.authority]))
  const hydratedReport: RunReport = {
    ...report,
    selection: { ...report.selection, requestedContracts: options.contracts },
    results: report.results.map((finding) => ({ ...finding, authority: finding.authority ?? (finding.contractId ? authorityByContract.get(finding.contractId) : undefined) })),
  }
  process.stdout.write(options.format === "json" ? renderJson(hydratedReport) : `${renderText(hydratedReport)}\n`)
  if (options.profile) process.stderr.write(`Validation profile: ${(performance.now() - started).toFixed(1)}ms, ${paths.length} indexed files\n`)
  return hydratedReport
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runValidation().then((report) => {
    if (report) process.exitCode = report.summary.exitCode
  }).catch((error) => {
    process.stderr.write(`Validation failed to start: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
