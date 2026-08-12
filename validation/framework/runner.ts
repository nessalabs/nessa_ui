import type { CheckContext, CheckDefinition, Finding, FindingOptions, RunReport } from "./types.ts"
import type { InMemoryCache } from "./in-memory-cache.ts"
import { runBounded } from "./scheduler.ts"
import { sortFindings } from "./reporter.ts"
import { compareCodeUnits } from "./reporter.ts"

interface RunnerOptions {
  repoRoot: string
  files: CheckContext["files"]
  cache: InMemoryCache
  checks: readonly CheckDefinition[]
  phase: "source" | "artifacts"
  requestedCheckIds?: readonly string[]
  changedPaths?: readonly string[]
  changedSince?: string
  concurrency?: number
  additionalFindings?: readonly Finding[]
}

function createFinding(checkId: string, state: Finding["state"], message: string, options: FindingOptions = {}): Finding {
  return { checkId, state, severity: state === "FAIL" ? "error" : "notice", message, ...options }
}

function dependenciesFor(checks: Map<string, CheckDefinition>, roots: readonly string[]): Set<string> {
  const selected = new Set<string>()
  function visit(id: string): void {
    if (selected.has(id)) return
    const check = checks.get(id)
    if (!check) throw new Error(`Unknown check dependency: ${id}`)
    selected.add(id)
    for (const dependency of check.dependsOn) visit(dependency)
  }
  for (const root of roots) visit(root)
  return selected
}

export async function runChecks(options: RunnerOptions): Promise<RunReport> {
  const phaseChecks = options.checks.filter((check) => check.phase === options.phase)
  const byId = new Map(phaseChecks.map((check) => [check.id, check]))
  if (byId.size !== phaseChecks.length) throw new Error("Duplicate check id")
  const requested = options.requestedCheckIds?.length ? [...options.requestedCheckIds] : [...byId.keys()]
  const selected = dependenciesFor(byId, requested)
  const changedSet = options.changedPaths ? new Set(options.changedPaths) : null
  const skippedChecks: { checkId: string; reason: string }[] = []

  const affectedRoots = changedSet
    ? [...selected].filter((id) => {
        const check = byId.get(id)!
        if (check.global) return true
        const inputs = new Set(options.files.match(check.inputs))
        return [...changedSet].some((filePath) => inputs.has(filePath))
      })
    : [...selected]
  const runnableIds = dependenciesFor(byId, affectedRoots)
  const dependencyChecks = [...runnableIds].filter((id) => !affectedRoots.includes(id)).sort(compareCodeUnits)

  const runnable = phaseChecks.filter((check) => {
    if (!selected.has(check.id)) return false
    if (!runnableIds.has(check.id)) {
      skippedChecks.push({ checkId: check.id, reason: "no declared inputs changed" })
      return false
    }
    return true
  })

  async function execute(check: CheckDefinition): Promise<Finding[]> {
      const declaredPaths = new Set(options.files.match(check.inputs))
      const assertDeclared = (filePath: string): void => {
        if (!declaredPaths.has(filePath)) throw new Error(`${check.id} read undeclared input ${filePath}`)
      }
      const context: CheckContext = {
        repoRoot: options.repoRoot,
        files: options.files,
        readText: (filePath) => { assertDeclared(filePath); return options.cache.readText(filePath) },
        readJson: (filePath) => { assertDeclared(filePath); return options.cache.readJson(filePath) },
        parseCss: (filePath) => { assertDeclared(filePath); return options.cache.parseCss(filePath) },
        parseSelector: (selector) => options.cache.parseSelector(selector),
        parseTypeScript: (filePath) => { assertDeclared(filePath); return options.cache.parseTypeScript(filePath) },
        pass: (message, findingOptions) => createFinding(check.id, "PASS", message, findingOptions),
        fail: (message, findingOptions) => createFinding(check.id, "FAIL", message, findingOptions),
        exception: (message, findingOptions) => createFinding(check.id, "EXCEPTION", message, findingOptions),
        planned: (message, findingOptions) => createFinding(check.id, "PLANNED", message, findingOptions),
        review: (message, findingOptions) => createFinding(check.id, "REVIEW", message, findingOptions),
      }
      try {
        return [...(await check.run(context))]
      } catch (error) {
        return [context.fail(`Check crashed: ${error instanceof Error ? error.message : String(error)}`)]
      }
  }

  const batches: Finding[][] = []
  const completed = new Set<string>()
  const remaining = new Map(runnable.map((check) => [check.id, check]))
  while (remaining.size) {
    const ready = [...remaining.values()].filter((check) => check.dependsOn.every((dependency) => completed.has(dependency) || !remaining.has(dependency)))
    if (!ready.length) throw new Error(`Cyclic check dependency among: ${[...remaining.keys()].join(", ")}`)
    const wave = await runBounded(ready.map((check) => () => execute(check)), options.concurrency)
    batches.push(...wave)
    for (const check of ready) {
      remaining.delete(check.id)
      completed.add(check.id)
    }
  }

  const findings = sortFindings([...batches.flat(), ...(options.additionalFindings ?? [])])
  const counts = { PASS: 0, FAIL: 0, EXCEPTION: 0, PLANNED: 0, REVIEW: 0, SKIPPED: skippedChecks.length }
  for (const finding of findings) counts[finding.state] += 1
  return {
    schemaVersion: 1,
    selection: {
      requestedContracts: [],
      changedSince: options.changedSince ?? null,
      executedChecks: runnable.map((check) => check.id).sort(),
      dependencyChecks,
      globalChecks: runnable.filter((check) => check.global).map((check) => check.id).sort(),
      skippedChecks: skippedChecks.sort((a, b) => compareCodeUnits(a.checkId, b.checkId)),
    },
    summary: { ...counts, exitCode: counts.FAIL > 0 ? 1 : 0 },
    results: findings,
  }
}
