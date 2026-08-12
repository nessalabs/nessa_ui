import type { Root } from "postcss"
import type { Root as SelectorRoot } from "postcss-selector-parser"
import type ts from "typescript"

export type CheckPhase = "source" | "artifacts"
export type FindingState =
  | "PASS"
  | "FAIL"
  | "EXCEPTION"
  | "PLANNED"
  | "REVIEW"
  | "SKIPPED"

export interface Finding {
  checkId: string
  contractId?: string
  state: FindingState
  severity: "error" | "notice"
  message: string
  authority?: string
  repair?: string
  path?: string
  line?: number
  column?: number
}

export interface FileIndex {
  readonly paths: readonly string[]
  match(patterns: readonly string[]): readonly string[]
  has(path: string): boolean
}

export interface CheckContext {
  readonly repoRoot: string
  readonly files: FileIndex
  readText(path: string): Promise<string>
  readJson<T = unknown>(path: string): Promise<T>
  parseCss(path: string): Promise<Root>
  parseSelector(selector: string): SelectorRoot
  parseTypeScript(path: string): Promise<ts.SourceFile>
  pass(message: string, options?: FindingOptions): Finding
  fail(message: string, options?: FindingOptions): Finding
  exception(message: string, options?: FindingOptions): Finding
  planned(message: string, options?: FindingOptions): Finding
  review(message: string, options?: FindingOptions): Finding
}

export interface OrchestratorContext extends CheckContext {
  runRepositoryCommand(
    command: string,
    args: readonly string[],
    options?: { cwd?: string; env?: NodeJS.ProcessEnv; capture?: boolean },
  ): Promise<{ stdout: string; stderr: string }>
}

export interface FindingOptions {
  contractId?: string
  authority?: string
  repair?: string
  path?: string
  line?: number
  column?: number
}

export interface CheckDefinition {
  id: string
  phase: CheckPhase
  inputs: readonly string[]
  dependsOn: readonly string[]
  global: boolean
  run(context: CheckContext): Promise<readonly Finding[]> | readonly Finding[]
}

export interface RunSelection {
  contracts?: readonly string[]
  changedSince?: string
}

export interface RunReport {
  schemaVersion: 1
  selection: {
    requestedContracts: readonly string[]
    changedSince: string | null
    executedChecks: readonly string[]
    dependencyChecks: readonly string[]
    globalChecks: readonly string[]
    skippedChecks: readonly { checkId: string; reason: string }[]
  }
  summary: Record<FindingState, number> & { exitCode: number }
  results: readonly Finding[]
}
