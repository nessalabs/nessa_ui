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
])
