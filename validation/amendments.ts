export interface Amendment {
  id: string
  kind: "bootstrap" | "transition" | "retirement" | "correction" | "supersession"
  contractId: string
  baseRevision: string
  targets: readonly string[]
  beforeFingerprint: string | null
  afterFingerprint: string
  rationale: string
  compatibility: string
  migration: string
  supersedes: string | null
  pullRequest: string | null
}

export const amendments: readonly Amendment[] = Object.freeze([
  {
    id: "BOOTSTRAP-001",
    kind: "bootstrap",
    contractId: "GOV-003",
    baseRevision: "e078dd491004795c99b37121471152e41bb17194",
    targets: [
      "validation/contracts.ts",
      "validation/exceptions.ts",
      "validation/nessa/check-metadata.ts",
    ],
    beforeFingerprint: null,
    afterFingerprint: "4beb348bbeaa1d82da83a9d49b58d2dbd69463569c9cb0c5779c47cb34f70ffe",
    rationale: "Introduces the first machine-readable Nessa contract manifest and validation gate.",
    compatibility: "No consumer runtime API changes; repository review governance becomes explicit.",
    migration: "All later transitions compare against this governed manifest and append new amendments.",
    supersedes: null,
    pullRequest: null,
  },
  {
    id: "AMEND-002",
    kind: "transition",
    contractId: "SRC-002",
    baseRevision: "41f9fe804cf4fc5dd887cb7642ac0bfa8d9a3e6e",
    targets: ["validation/exceptions.ts"],
    beforeFingerprint: "4beb348bbeaa1d82da83a9d49b58d2dbd69463569c9cb0c5779c47cb34f70ffe",
    afterFingerprint: "078a941c919a625be47f3abd40a1e61fdbc508b9b4c8206cc06104c1c518fe8a",
    rationale: "Retires the destructive Button dark-opacity exception after rendered accessibility checks proved that the override reduced text contrast below the required threshold.",
    compatibility: "Destructive Buttons now use the canonical opaque destructive token in both themes, preserving their public API while restoring accessible dark-mode contrast.",
    migration: "Consumers using the destructive Button variant receive the corrected semantic-token treatment automatically and do not need to change application code.",
    supersedes: null,
    pullRequest: null,
  },
])
