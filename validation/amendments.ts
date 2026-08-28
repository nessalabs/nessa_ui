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
  {
    id: "AMEND-003",
    kind: "transition",
    contractId: "A11Y-002",
    baseRevision: "a969e1a073043d0d34d1476deb0749697d7af435",
    targets: ["validation/nessa/check-metadata.ts"],
    beforeFingerprint: "078a941c919a625be47f3abd40a1e61fdbc508b9b4c8206cc06104c1c518fe8a",
    afterFingerprint: "8cb616c48a66a3e3008059733cd6d1857c9f04e349cd5916058d2f921d902a0f",
    rationale: "Extends focus-treatment accessibility scanning to composite components (packages/react/src/composites) so composed surfaces such as the AppShell dock resize separator are measured by the same A11Y-002 evidence gate as the primitives, and corrects the storybook-coverage input declaration to the files that check actually reads (the package index and story files) now that coverage derives from public module exports.",
    compatibility: "Strictly widens accessibility validation coverage and tightens Storybook coverage to every component and composite module the package index exports, including directory modules the previous file-glob loop silently skipped; lib modules remain outside story coverage, and there are no consumer runtime API changes and no weakening of any existing requirement.",
    migration: "New composite components must register their focus treatments in validation/nessa/focus-treatments.ts exactly as component primitives already do, and every component or composite module exported from packages/react/src/index.ts must ship a matching Storybook story file.",
    supersedes: null,
    pullRequest: null,
  },
  {
    id: "AMEND-004",
    kind: "transition",
    contractId: "INT-001",
    baseRevision: "f792709798fc10e4923f52077ed096611a7850e5",
    targets: ["validation/contracts.ts", "validation/nessa/check-metadata.ts"],
    beforeFingerprint: "8cb616c48a66a3e3008059733cd6d1857c9f04e349cd5916058d2f921d902a0f",
    afterFingerprint: "f1496eff9e0b91537ee5aa395e43704e81623c50f1f5338fb472c282e7b4d435",
    rationale: "Adds an enforced interaction-stability check for ModelPicker so hover and focus previews cannot move the option hit-target surface that produced them.",
    compatibility: "Adds validation and Storybook evidence for a new component family without weakening existing AppShell, SplitView, theme, registry, or accessibility requirements.",
    migration: "ModelPicker implementations keep preview-dependent content out of option-flow geometry and maintain the focused narrow-viewport interaction story.",
    supersedes: null,
    pullRequest: null,
  },
  {
    id: "AMEND-005",
    kind: "transition",
    contractId: "A11Y-002",
    baseRevision: "074c6de966fa2c603d1e6eec3dd7bc37bab4e077",
    targets: ["validation/exceptions.ts"],
    beforeFingerprint: "f1496eff9e0b91537ee5aa395e43704e81623c50f1f5338fb472c282e7b4d435",
    afterFingerprint: "22709c0ab698f9ec6303b75205b58bedad282f42f2557a1afa522ad90ea50549",
    rationale: "Re-fingerprints the ledgered focus-contrast exceptions after the core palette moved from blue-tinted tokens to the neutral shadcn scale; every excepted combination still fails its required ratio for the same reason, only the measured token and surface values changed.",
    compatibility: "No exception is added or removed and no requirement weakens; the same subtle focus-tint failures remain ledgered with their measurements updated to the neutral palette.",
    migration: "None for consumers; hosts overriding theme tokens keep their own responsibility for focus contrast on custom surfaces.",
    supersedes: null,
    pullRequest: null,
  },
  {
    id: "AMEND-006",
    kind: "transition",
    contractId: "STYLE-001",
    baseRevision: "a4234b050c36fecdb30c7c476521f5e6ea421d73",
    targets: ["validation/contracts.ts", "validation/exceptions.ts", "validation/nessa/check-metadata.ts"],
    beforeFingerprint: "22709c0ab698f9ec6303b75205b58bedad282f42f2557a1afa522ad90ea50549",
    afterFingerprint: "88ec1fcc7779ddc6b69f4fe00202fdad75ae67f1cbcb4220679ad70c90d8a186",
    rationale: "Adds three enforced styling-discipline contracts (STYLE-001 semantic-color-only class surfaces, STYLE-002 frozen stacking scale, STYLE-003 inline-style computed-geometry allowlist) with a new style-discipline checker, making token bypasses and unaudited inline styling structurally visible instead of convention-guarded; the checker covers .ts and .tsx class surfaces, named colors, paint arbitrary properties, dynamic style keys, and literal-color custom properties.",
    compatibility: "Strictly adds validation with no consumer runtime API changes; every existing off-scale stacking utility and out-of-allowlist inline style property is preserved verbatim as an exact ledgered occurrence, so no rendered output changes.",
    migration: "New code uses semantic token utilities for color, the z-0..z-50 scale for layering, and custom properties plus the geometry allowlist for runtime-computed inline styles; ledgered occurrences shrink toward zero under their recorded removal conditions and may never grow without an explicit amendment.",
    supersedes: null,
    pullRequest: null,
  },
])
