import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import ts from "typescript"

import type { Finding } from "../framework/types.ts"

const execFileAsync = promisify(execFile)

export const governedSourcePaths = Object.freeze([
  "validation/contracts.ts",
  "validation/exceptions.ts",
  "validation/nessa/check-metadata.ts",
] as const)

export interface AmendmentRecord {
  id: string
  kind: string
  contractId: string
  baseRevision: string
  targets: readonly string[]
  beforeFingerprint: string | null
  afterFingerprint: string
  rationale: string
  compatibility: string
  migration: string
  supersedes: string | null
  source: string
}

export interface GovernedSnapshot {
  fingerprint: string
  targetFingerprints: Readonly<Record<string, string>>
}

function stringProperty(object: ts.ObjectLiteralExpression, name: string): string | null {
  const property = object.properties.find((candidate): candidate is ts.PropertyAssignment =>
    ts.isPropertyAssignment(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === name,
  )
  return property && ts.isStringLiteral(property.initializer) ? property.initializer.text : null
}

function nullableStringProperty(object: ts.ObjectLiteralExpression, name: string): string | null {
  return stringProperty(object, name)
}

function stringArrayProperty(object: ts.ObjectLiteralExpression, name: string): string[] {
  const property = object.properties.find((candidate): candidate is ts.PropertyAssignment =>
    ts.isPropertyAssignment(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === name,
  )
  if (!property || !ts.isArrayLiteralExpression(property.initializer) || !property.initializer.elements.every(ts.isStringLiteral)) throw new Error(`${name} must be an array of string literals`)
  const values = property.initializer.elements.map((entry) => (entry as ts.StringLiteral).text)
  if (new Set(values).size !== values.length) throw new Error(`${name} must not contain duplicates`)
  return values
}

function exportedConstDeclaration(file: ts.SourceFile, name: string): ts.VariableDeclaration {
  const statements = file.statements.filter((statement): statement is ts.VariableStatement =>
    ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0,
  )
  const matches = statements.flatMap((statement) => [...statement.declarationList.declarations])
    .filter((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name)
  if (matches.length !== 1 || !matches[0]!.initializer) throw new Error(`Exactly one exported const ${name} is required`)
  return matches[0]!
}

export function parseAmendmentRecords(source: string): AmendmentRecord[] {
  const file = ts.createSourceFile("amendments.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const declaration = exportedConstDeclaration(file, "amendments")
  let initializer: ts.Expression = declaration.initializer!
  while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer)) initializer = initializer.expression
  if (ts.isCallExpression(initializer) && ts.isPropertyAccessExpression(initializer.expression) && initializer.expression.expression.getText(file) === "Object" && initializer.expression.name.text === "freeze" && initializer.arguments.length === 1) initializer = initializer.arguments[0]!
  if (!ts.isArrayLiteralExpression(initializer)) throw new Error("Exported amendments ledger must be an array or Object.freeze(array)")
  const records: AmendmentRecord[] = []
  for (const element of initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) throw new Error("Every amendment ledger entry must be a direct object literal")
    const id = stringProperty(element, "id")
    const kind = stringProperty(element, "kind")
    const contractId = stringProperty(element, "contractId")
    const baseRevision = stringProperty(element, "baseRevision")
    const afterFingerprint = stringProperty(element, "afterFingerprint")
    if (!id || !kind || !contractId || !baseRevision || !afterFingerprint) throw new Error("Amendment ledger entry is missing a required literal field")
    records.push({
      id, kind, contractId, baseRevision,
      targets: stringArrayProperty(element, "targets"),
      beforeFingerprint: nullableStringProperty(element, "beforeFingerprint"),
      afterFingerprint,
      rationale: stringProperty(element, "rationale") ?? "",
      compatibility: stringProperty(element, "compatibility") ?? "",
      migration: stringProperty(element, "migration") ?? "",
      supersedes: nullableStringProperty(element, "supersedes"),
      source: element.getText(file),
    })
  }
  return records
}

function normalizeSource(source: string): string {
  return source.replaceAll("\r\n", "\n")
}

export function createGovernedSnapshot(sources: Readonly<Record<string, string>>): GovernedSnapshot {
  const targetFingerprints = Object.fromEntries(governedSourcePaths.map((filePath) => {
    const source = sources[filePath]
    if (source === undefined) throw new Error(`Missing governed source ${filePath}`)
    return [filePath, createHash("sha256").update(normalizeSource(source)).digest("hex")]
  }))
  const fingerprint = createHash("sha256").update(JSON.stringify(targetFingerprints)).digest("hex")
  return { fingerprint, targetFingerprints }
}

export function parseContractIds(source: string): Set<string> {
  const file = ts.createSourceFile("contracts.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const declaration = exportedConstDeclaration(file, "contracts")
  let initializer: ts.Expression = declaration.initializer!
  while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer)) initializer = initializer.expression
  if (ts.isCallExpression(initializer) && ts.isPropertyAccessExpression(initializer.expression) && initializer.expression.name.text === "freeze" && initializer.arguments.length === 1) initializer = initializer.arguments[0]!
  while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer)) initializer = initializer.expression
  if (!ts.isArrayLiteralExpression(initializer)) throw new Error("Exported contracts must be a direct array or Object.freeze(array)")
  const ids = new Set<string>()
  for (const element of initializer.elements) {
    if (!ts.isCallExpression(element) || !ts.isIdentifier(element.expression) || element.expression.text !== "contract" || !element.arguments[0] || !ts.isStringLiteral(element.arguments[0])) throw new Error("Every contract manifest entry must be a direct contract call with a literal ID")
    if (ids.has(element.arguments[0].text)) throw new Error(`Duplicate contract ID ${element.arguments[0].text}`)
    ids.add(element.arguments[0].text)
  }
  return ids
}

export function isValidBootstrapRecord(record: AmendmentRecord | undefined, snapshot: GovernedSnapshot, baseRevision: string, ledgerLength: number): boolean {
  return record?.id === "BOOTSTRAP-001" && record.kind === "bootstrap" && record.contractId === "GOV-003" && record.baseRevision === baseRevision &&
    record.beforeFingerprint === null && record.afterFingerprint === snapshot.fingerprint && record.supersedes === null &&
    [record.rationale, record.compatibility, record.migration].every((value) => value.trim().length > 0) &&
    JSON.stringify([...record.targets].sort()) === JSON.stringify([...governedSourcePaths].sort()) && ledgerLength === 1
}

function changedTargets(before: GovernedSnapshot, after: GovernedSnapshot): string[] {
  return governedSourcePaths.filter((filePath) => before.targetFingerprints[filePath] !== after.targetFingerprints[filePath])
}

export function compareGovernanceHistory(
  baseSources: Readonly<Record<string, string>>,
  baseAmendmentsSource: string,
  currentSources: Readonly<Record<string, string>>,
  currentAmendmentsSource: string,
  expectedBaseRevision?: string,
): string[] {
  const errors: string[] = []
  const beforeAmendments = parseAmendmentRecords(baseAmendmentsSource)
  const afterAmendments = parseAmendmentRecords(currentAmendmentsSource)
  for (const [index, before] of beforeAmendments.entries()) {
    const after = afterAmendments[index]
    if (!after || after.id !== before.id || after.source !== before.source) errors.push(`immutable amendment ${before.id} was changed, deleted, or reordered`)
  }
  const before = createGovernedSnapshot(baseSources)
  const after = createGovernedSnapshot(currentSources)
  const targets = changedTargets(before, after)
  const appended = afterAmendments.slice(beforeAmendments.length)
  const transitions = appended.filter((entry) => entry.kind === "transition")
  const retirements = appended.filter((entry) => entry.kind === "retirement")
  const baseContractIds = parseContractIds(baseSources["validation/contracts.ts"]!)
  const currentContractIds = parseContractIds(currentSources["validation/contracts.ts"]!)
  const knownContractIds = new Set([...baseContractIds, ...currentContractIds])
  const removedContractIds = new Set([...baseContractIds].filter((id) => !currentContractIds.has(id)))
  if (targets.length) {
    if (transitions.length !== 1) errors.push(`observed governed-source change requires exactly one appended transition, found ${transitions.length}`)
    const transition = transitions.find((entry) => entry.beforeFingerprint === before.fingerprint && entry.afterFingerprint === after.fingerprint)
    if (!transition) {
      errors.push(`governed sources changed without an appended amendment for ${before.fingerprint} -> ${after.fingerprint}`)
    } else {
      const declared = [...transition.targets].sort()
      if (JSON.stringify(declared) !== JSON.stringify([...targets].sort())) errors.push(`${transition.id} targets do not exactly match changed governed sources`)
      if (expectedBaseRevision && transition.baseRevision !== expectedBaseRevision) errors.push(`${transition.id} baseRevision does not match the compared base commit`)
      if (![transition.rationale, transition.compatibility, transition.migration].every((value) => value.trim().length > 0)) errors.push(`${transition.id} lacks rationale, compatibility, or migration evidence`)
    }
  }
  if (!targets.length && transitions.length) errors.push("transition amendment exists but the governed snapshot did not change")
  const ids = new Set<string>()
  for (const entry of afterAmendments) {
    if (ids.has(entry.id)) errors.push(`duplicate amendment id ${entry.id}`)
    if (["correction", "supersession"].includes(entry.kind) && (!entry.supersedes || !ids.has(entry.supersedes) || entry.supersedes === entry.id)) errors.push(`${entry.id} must supersede one earlier existing amendment`)
    if (knownContractIds.size && !knownContractIds.has(entry.contractId) && !afterAmendments.some((candidate) => candidate.kind === "retirement" && candidate.contractId === entry.contractId)) errors.push(`${entry.id} references unknown contract ${entry.contractId}`)
    ids.add(entry.id)
  }
  for (const removedId of removedContractIds) {
    const count = retirements.filter((entry) => entry.contractId === removedId).length
    if (count !== 1) errors.push(`removed contract ${removedId} requires exactly one retirement marker, found ${count}`)
  }
  for (const entry of retirements) {
    if (!removedContractIds.has(entry.contractId)) errors.push(`${entry.id} retires ${entry.contractId}, but that contract was not removed in this transition`)
    if (entry.targets.length !== 0) errors.push(`${entry.id} retirement marker must declare no changed targets; the snapshot transition owns them`)
  }
  const historicallyRetired = new Set(afterAmendments.filter((entry) => entry.kind === "retirement").map((entry) => entry.contractId))
  for (const retiredId of historicallyRetired) if (currentContractIds.has(retiredId)) errors.push(`retired contract ID ${retiredId} was reintroduced or recycled`)
  for (const entry of appended) {
    if (entry.kind === "bootstrap") errors.push(`second bootstrap ${entry.id} is forbidden`)
    if (!["transition", "retirement", "correction", "supersession", "bootstrap"].includes(entry.kind)) errors.push(`${entry.id} has unknown amendment kind ${entry.kind}`)
    if (![entry.rationale, entry.compatibility, entry.migration].every((value) => value.trim().length > 0)) errors.push(`${entry.id} lacks rationale, compatibility, or migration evidence`)
    if (expectedBaseRevision && ["transition", "retirement"].includes(entry.kind) && entry.baseRevision !== expectedBaseRevision) errors.push(`${entry.id} baseRevision does not match the compared base commit`)
    if (!/^[a-f0-9]{64}$/.test(entry.afterFingerprint) || (entry.beforeFingerprint !== null && !/^[a-f0-9]{64}$/.test(entry.beforeFingerprint))) errors.push(`${entry.id} has invalid canonical fingerprints`)
    if (["transition", "retirement"].includes(entry.kind) && (entry.beforeFingerprint !== before.fingerprint || entry.afterFingerprint !== after.fingerprint)) errors.push(`${entry.id} does not exactly bind the observed transition`)
    if (!["transition", "retirement", "bootstrap"].includes(entry.kind) && (entry.beforeFingerprint !== after.fingerprint || entry.afterFingerprint !== after.fingerprint || entry.targets.length !== 0)) errors.push(`${entry.id} correction/supersession must preserve the current snapshot and declare no changed targets`)
  }
  return errors
}

async function gitShow(repoRoot: string, revision: string, filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["show", `${revision}:${filePath}`], { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 })
    return stdout
  } catch {
    return null
  }
}

async function currentSources(repoRoot: string): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(governedSourcePaths.map(async (filePath) => [filePath, await readFile(path.join(repoRoot, filePath), "utf8")] as const)))
}

export async function governanceHistoryFinding(repoRoot: string, explicitBase?: string): Promise<Finding | null> {
  let base = explicitBase
  if (!base) {
    try { base = (await execFileAsync("git", ["rev-parse", "--verify", "origin/main"], { cwd: repoRoot })).stdout.trim() } catch { return null }
  }
  if (!base || /^0+$/.test(base)) {
    try { base = (await execFileAsync("git", ["rev-parse", "HEAD^"], { cwd: repoRoot })).stdout.trim() }
    catch { return { checkId: "governance-history", contractId: "GOV-003", state: "FAIL", severity: "error", message: "Base revision is missing; fetch full history and pass NESSA_VALIDATION_BASE_REF." } }
  }
  try { await execFileAsync("git", ["cat-file", "-e", `${base}^{commit}`], { cwd: repoRoot }) }
  catch { return { checkId: "governance-history", contractId: "GOV-003", state: "FAIL", severity: "error", message: `Base revision ${base} is unavailable; fetch full history.` } }

  const current = await currentSources(repoRoot)
  const amendmentsSource = await readFile(path.join(repoRoot, "validation/amendments.ts"), "utf8")
  const baseSources = Object.fromEntries(await Promise.all(governedSourcePaths.map(async (filePath) => [filePath, await gitShow(repoRoot, base!, filePath)] as const)))
  if (baseSources[governedSourcePaths[0]] === null) {
    const initialAmendments = parseAmendmentRecords(amendmentsSource)
    const bootstrap = initialAmendments[0]
    const snapshot = createGovernedSnapshot(current)
    const exactBase = (await execFileAsync("git", ["rev-parse", base], { cwd: repoRoot })).stdout.trim()
    const valid = isValidBootstrapRecord(bootstrap, snapshot, exactBase, initialAmendments.length)
    if (!valid) return { checkId: "governance-history", contractId: "GOV-003", state: "FAIL", severity: "error", message: "Base has no manifest and BOOTSTRAP-001 does not exactly bind the base revision, governed targets, and first snapshot." }
    return { checkId: "governance-history", contractId: "GOV-003", state: "REVIEW", severity: "notice", message: `BOOTSTRAP-001 governs the first manifest relative to ${exactBase.slice(0, 12)}.` }
  }
  if (Object.values(baseSources).some((value) => value === null)) return { checkId: "governance-history", contractId: "GOV-003", state: "FAIL", severity: "error", message: "Base governed snapshot is incomplete." }
  const baseAmendments = await gitShow(repoRoot, base, "validation/amendments.ts")
  if (baseAmendments === null) return { checkId: "governance-history", contractId: "GOV-003", state: "FAIL", severity: "error", message: "Base manifest exists without amendment history." }
  const exactBase = (await execFileAsync("git", ["rev-parse", base], { cwd: repoRoot })).stdout.trim()
  const errors = compareGovernanceHistory(baseSources as Record<string, string>, baseAmendments, current, amendmentsSource, exactBase)
  return errors.length
    ? { checkId: "governance-history", contractId: "GOV-003", state: "FAIL", severity: "error", message: errors.join("; "), repair: "Restore immutable history or append one exact transition amendment." }
    : { checkId: "governance-history", contractId: "GOV-003", state: "PASS", severity: "notice", message: "Governed-source fingerprints and append-only amendment history match the base revision." }
}
