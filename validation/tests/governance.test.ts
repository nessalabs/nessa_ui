import assert from "node:assert/strict"
import test from "node:test"

import { contracts } from "../contracts.ts"
import { parseNormativeIndex } from "../nessa/checks/governance.ts"
import { compareGovernanceHistory, createGovernedSnapshot, governedSourcePaths, isValidBootstrapRecord, parseAmendmentRecords, parseContractIds } from "../nessa/governance-history.ts"

const sources = (overrides: Partial<Record<(typeof governedSourcePaths)[number], string>> = {}) => ({
  "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "G", "doc#g", "enforced", "governance")]',
  "validation/exceptions.ts": "exceptions-v1",
  "validation/nessa/check-metadata.ts": "metadata-v1",
  ...overrides,
})

function amendment(id: string, kind: string, before: string | null, after: string, targets: readonly string[], supersedes: string | null = null): string {
  return `{ id: "${id}", kind: "${kind}", contractId: "GOV-003", baseRevision: "${"a".repeat(40)}", targets: ${JSON.stringify(targets)}, beforeFingerprint: ${before ? `"${before}"` : "null"}, afterFingerprint: "${after}", rationale: "why", compatibility: "impact", migration: "migrate", supersedes: ${supersedes ? `"${supersedes}"` : "null"} }`
}

const ledger = (...entries: string[]) => `export const amendments = [${entries.join(", ")}]`

test("normative index parser recognizes alphanumeric contract families", () => {
  const markdown = "## Normative contract index\n\n| ID | Invariant | Authority |\n| --- | --- | --- |\n| A11Y-001 | Contrast holds. | `#accessibility` |\n"
  assert.deepEqual(parseNormativeIndex(markdown), [{ id: "A11Y-001", title: "Contrast holds.", anchor: "#accessibility" }])
})

test("manifest IDs and governed fingerprint are stable", () => {
  assert.equal(new Set(contracts.map((entry) => entry.id)).size, contracts.length)
  assert.match(createGovernedSnapshot(sources()).fingerprint, /^[a-f0-9]{64}$/)
})

test("bootstrap acceptance requires canonical transition evidence", () => {
  const snapshot = createGovernedSnapshot(sources())
  const baseRevision = "a".repeat(40)
  const record = parseAmendmentRecords(ledger(amendment("BOOTSTRAP-001", "bootstrap", null, snapshot.fingerprint, governedSourcePaths)))[0]!
  assert.equal(isValidBootstrapRecord(record, snapshot, baseRevision, 1), true)
  assert.equal(isValidBootstrapRecord({ ...record, rationale: "" }, snapshot, baseRevision, 1), false)
  assert.equal(isValidBootstrapRecord({ ...record, supersedes: "AMEND-000" }, snapshot, baseRevision, 1), false)
  assert.equal(isValidBootstrapRecord({ ...record, contractId: "A11Y-001" }, snapshot, baseRevision, 1), false)
})

test("history rejects immutable rewrites and every unamended governed-source change", () => {
  const before = sources()
  const beforeHash = createGovernedSnapshot(before).fingerprint
  const baseLedger = ledger(amendment("BOOTSTRAP-001", "bootstrap", null, beforeHash, governedSourcePaths))
  const rewritten = baseLedger.replace("why", "changed")
  assert.match(compareGovernanceHistory(before, baseLedger, before, rewritten).join("\n"), /immutable amendment/)
  for (const [filePath, value] of [
    ["validation/contracts.ts", 'export const contracts = [contract("GOV-003", "changed", "doc#g", "enforced", "governance")]'],
    ["validation/exceptions.ts", "exception-added-or-broadened"],
    ["validation/nessa/check-metadata.ts", "input-or-global-narrowed"],
  ] as const) {
    assert.match(compareGovernanceHistory(before, baseLedger, sources({ [filePath]: value }), baseLedger).join("\n"), /without an appended amendment/)
  }
})

test("history reads only the exported amendment ledger and real contract manifest calls", () => {
  const before = sources({ "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "G", "doc#g", "enforced", "governance"), contract("X-001", "X", "doc#x", "enforced", "x")]' })
  const after = sources({ "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "G", "doc#g", "enforced", "governance")]\n// contract("X-001", "decoy")\nconst prose = `contract("X-001", "decoy")`' })
  const beforeHash = createGovernedSnapshot(before).fingerprint
  const afterHash = createGovernedSnapshot(after).fingerprint
  const bootstrap = amendment("BOOTSTRAP-001", "bootstrap", null, beforeHash, governedSourcePaths)
  const decoy = amendment("AMEND-002", "transition", beforeHash, afterHash, ["validation/contracts.ts"])
  assert.match(compareGovernanceHistory(before, ledger(bootstrap), after, `${ledger(bootstrap)}\nconst decoy = ${decoy}`).join("\n"), /without an appended amendment/)
  const transition = amendment("AMEND-002", "transition", beforeHash, afterHash, ["validation/contracts.ts"])
  assert.match(compareGovernanceHistory(before, ledger(bootstrap), after, ledger(bootstrap, transition)).join("\n"), /X-001 requires exactly one retirement marker/)
  assert.throws(() => parseAmendmentRecords(ledger(bootstrap).replace("export const", "const")), /exported const amendments/i)
  assert.throws(() => parseAmendmentRecords(ledger(bootstrap).replace('targets: [', 'targets: [extraTarget, ')), /array of string literals/i)
  assert.throws(() => parseContractIds('export const contracts = [contract("GOV-003"), ...extra]'), /direct contract call/i)
  assert.throws(() => parseContractIds('const contracts = [contract("GOV-003")]'), /exported const contracts/i)
})

test("history accepts only an exact target-bound before/after transition", () => {
  const before = sources()
  const after = sources({ "validation/exceptions.ts": "exceptions-v2" })
  const beforeHash = createGovernedSnapshot(before).fingerprint
  const afterHash = createGovernedSnapshot(after).fingerprint
  const bootstrap = amendment("BOOTSTRAP-001", "bootstrap", null, beforeHash, governedSourcePaths)
  const baseLedger = ledger(bootstrap)
  const valid = ledger(bootstrap, amendment("AMEND-002", "transition", beforeHash, afterHash, ["validation/exceptions.ts"]))
  assert.deepEqual(compareGovernanceHistory(before, baseLedger, after, valid), [])
  const broad = ledger(bootstrap, amendment("AMEND-002", "transition", beforeHash, afterHash, governedSourcePaths))
  assert.match(compareGovernanceHistory(before, baseLedger, after, broad).join("\n"), /targets do not exactly match/)
  const wrongBefore = ledger(bootstrap, amendment("AMEND-002", "transition", "b".repeat(64), afterHash, ["validation/exceptions.ts"]))
  assert.match(compareGovernanceHistory(before, baseLedger, after, wrongBefore).join("\n"), /without an appended amendment/)
})

test("history rejects a second bootstrap", () => {
  const before = sources()
  const fingerprint = createGovernedSnapshot(before).fingerprint
  const bootstrap = amendment("BOOTSTRAP-001", "bootstrap", null, fingerprint, governedSourcePaths)
  const base = ledger(bootstrap)
  const current = ledger(bootstrap, amendment("BOOTSTRAP-002", "bootstrap", fingerprint, fingerprint, []))
  assert.match(compareGovernanceHistory(before, base, before, current).join("\n"), /second bootstrap/)
})

test("history rejects duplicate transitions and invalid correction/supersession references", () => {
  const before = sources()
  const after = sources({ "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "changed", "doc#g", "enforced", "governance")]' })
  const beforeHash = createGovernedSnapshot(before).fingerprint
  const afterHash = createGovernedSnapshot(after).fingerprint
  const bootstrap = amendment("BOOTSTRAP-001", "bootstrap", null, beforeHash, governedSourcePaths)
  const transition = amendment("AMEND-002", "transition", beforeHash, afterHash, ["validation/contracts.ts"])
  assert.match(compareGovernanceHistory(before, ledger(bootstrap), after, ledger(bootstrap, transition, transition)).join("\n"), /exactly one|duplicate amendment/)
  const badCorrection = amendment("CORRECT-003", "correction", afterHash, afterHash, [], "MISSING")
  assert.match(compareGovernanceHistory(after, ledger(bootstrap, transition), after, ledger(bootstrap, transition, badCorrection)).join("\n"), /must supersede one earlier/)
  const validCorrection = amendment("CORRECT-003", "correction", afterHash, afterHash, [], "AMEND-002")
  assert.deepEqual(compareGovernanceHistory(after, ledger(bootstrap, transition), after, ledger(bootstrap, transition, validCorrection)), [])
})

test("history permits explicit retirement once and permanently rejects ID reuse", () => {
  const base = sources({ "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "G", "doc#g", "enforced", "governance"), contract("X-001", "X", "doc#x", "enforced", "x")]' })
  const retired = sources({ "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "G", "doc#g", "enforced", "governance")]' })
  const baseHash = createGovernedSnapshot(base).fingerprint
  const retiredHash = createGovernedSnapshot(retired).fingerprint
  const bootstrap = amendment("BOOTSTRAP-001", "bootstrap", null, baseHash, governedSourcePaths)
  const transition = amendment("AMEND-002", "transition", baseHash, retiredHash, ["validation/contracts.ts"])
  const retirement = amendment("RETIRE-003", "retirement", baseHash, retiredHash, []).replace('contractId: "GOV-003"', 'contractId: "X-001"')
  assert.deepEqual(compareGovernanceHistory(base, ledger(bootstrap), retired, ledger(bootstrap, transition, retirement)), [])
  assert.match(compareGovernanceHistory(retired, ledger(bootstrap, transition, retirement), base, ledger(bootstrap, transition, retirement)).join("\n"), /reintroduced or recycled/)
})

test("history supports one snapshot transition with a retirement marker for every removed contract", () => {
  const base = sources({ "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "G", "doc#g", "enforced", "governance"), contract("X-001", "X", "doc#x", "enforced", "x"), contract("Y-001", "Y", "doc#y", "enforced", "y")]' })
  const retired = sources({ "validation/contracts.ts": 'export const contracts = [contract("GOV-003", "G", "doc#g", "enforced", "governance")]' })
  const baseHash = createGovernedSnapshot(base).fingerprint
  const retiredHash = createGovernedSnapshot(retired).fingerprint
  const bootstrap = amendment("BOOTSTRAP-001", "bootstrap", null, baseHash, governedSourcePaths)
  const transition = amendment("AMEND-002", "transition", baseHash, retiredHash, ["validation/contracts.ts"])
  const retireX = amendment("RETIRE-003", "retirement", baseHash, retiredHash, []).replace('contractId: "GOV-003"', 'contractId: "X-001"')
  const retireY = amendment("RETIRE-004", "retirement", baseHash, retiredHash, []).replace('contractId: "GOV-003"', 'contractId: "Y-001"')
  assert.deepEqual(compareGovernanceHistory(base, ledger(bootstrap), retired, ledger(bootstrap, transition, retireX, retireY)), [])
  const duplicateX = amendment("RETIRE-005", "retirement", baseHash, retiredHash, []).replace('contractId: "GOV-003"', 'contractId: "X-001"')
  assert.match(compareGovernanceHistory(base, ledger(bootstrap), retired, ledger(bootstrap, transition, retireX, retireY, duplicateX)).join("\n"), /X-001 requires exactly one retirement marker, found 2/)
  const emptyEvidence = retireX.replace('rationale: "why"', 'rationale: ""')
  assert.match(compareGovernanceHistory(base, ledger(bootstrap), retired, ledger(bootstrap, transition, emptyEvidence, retireY)).join("\n"), /RETIRE-003 lacks rationale/)
  const wrongBase = retireX.replace("a".repeat(40), "b".repeat(40))
  assert.match(compareGovernanceHistory(base, ledger(bootstrap), retired, ledger(bootstrap, transition, wrongBase, retireY), "a".repeat(40)).join("\n"), /RETIRE-003 baseRevision/)
})
