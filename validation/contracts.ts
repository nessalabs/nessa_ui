export type ContractState = "enforced" | "planned" | "review-required"

export interface ContractEntry {
  id: string
  title: string
  authority: string
  state: ContractState
  check: string | null
  activationProbe: string | null
  reviewEvidence: string | null
}

const contract = (
  id: string,
  title: string,
  authority: string,
  state: ContractState,
  check: string | null,
  activationProbe: string | null = null,
  reviewEvidence: string | null = null,
): ContractEntry => ({ id, title, authority, state, check, activationProbe, reviewEvidence })

export const contracts = Object.freeze([
  contract("GOV-001", "Contract index and machine manifest remain bidirectionally complete.", "docs/architecture/design-system-contract.md#governance-and-change-conformance", "enforced", "governance"),
  contract("GOV-002", "Implementation plans and code cannot silently override this contract.", "docs/architecture/design-system-contract.md#governance-and-change-conformance", "enforced", "governance"),
  contract("GOV-003", "Contract weakening requires an explicit reviewed amendment and migration evidence.", "docs/architecture/design-system-contract.md#governance-and-change-conformance", "enforced", "governance"),
  contract("CSS-001", "Token-only CSS is import-free and owns no reset or body styling.", "docs/architecture/design-system-contract.md#low-specificity-and-named-cascade-layers", "enforced", "css-ownership"),
  contract("CSS-002", "Default component CSS excludes Preflight and body ownership.", "docs/architecture/design-system-contract.md#low-specificity-and-named-cascade-layers", "enforced", "css-ownership"),
  contract("CSS-003", "Application CSS is the sole Preflight and body-baseline opt-in.", "docs/architecture/design-system-contract.md#low-specificity-and-named-cascade-layers", "enforced", "css-ownership"),
  contract("CSS-004", "Package CSS exports and cascade layers preserve the frozen ownership order.", "docs/architecture/design-system-contract.md#low-specificity-and-named-cascade-layers", "planned", null, "canonical-token-source"),
  contract("TOKEN-001", "Package and registry use one canonical Light/Dark semantic token chain.", "docs/architecture/design-system-contract.md#one-live-token-chain-for-package-and-registry", "planned", null, "canonical-token-source"),
  contract("TOKEN-002", "Nessa supplies font stacks while applications own font delivery.", "docs/architecture/design-system-contract.md#typography-font-delivery-and-responsive-behavior", "enforced", "theme-parity"),
  contract("TOKEN-003", "Every current package and registry Light/Dark token projection remains exactly equal.", "docs/architecture/design-system-contract.md#one-live-token-chain-for-package-and-registry", "enforced", "theme-parity"),
  contract("REG-001", "Committed registry artifacts are deterministic reproductions of the registry source.", "docs/architecture/design-system-contract.md#deterministic-generated-artifacts", "enforced", "registry-parity"),
  contract("REG-002", "Registry item source content matches canonical component source.", "docs/architecture/design-system-contract.md#one-live-token-chain-for-package-and-registry", "enforced", "registry-parity"),
  contract("REG-003", "Registry dependencies include the matching Nessa base and required utilities.", "docs/architecture/design-system-contract.md#registry-topology", "enforced", "registry-parity"),
  contract("SRC-001", "Library runtime never mutates the host document or owns persistence.", "docs/architecture/design-system-contract.md#simplified-color-mode-api", "enforced", "source-boundaries"),
  contract("SRC-002", "Nessa-owned visual behavior does not depend on compiler-global dark variants.", "docs/architecture/design-system-contract.md#exact-meaning-of-data-nessa-mode", "enforced", "source-boundaries"),
  contract("SRC-003", "Copied registry components never reference private Nessa aliases directly.", "docs/architecture/design-system-contract.md#private-component-aliases", "enforced", "source-boundaries"),
  contract("STORY-001", "Every public component module has living Storybook docs and test coverage.", "docs/architecture/design-system-contract.md#verification-infrastructure", "enforced", "storybook-coverage"),
  contract("STORY-002", "Input stories preserve explicit accessible names and error associations.", "docs/architecture/design-system-contract.md#accessibility-and-rendering-invariants", "enforced", "storybook-coverage"),
  contract("INT-001", "ModelPicker previews cannot move its model-option hit-target surface.", "docs/architecture/design-system-contract.md#interaction-geometry-stability", "enforced", "interaction-stability"),
  contract("PKG-001", "The React package declares its supported React runtime floor.", "docs/architecture/design-system-contract.md#root-exports-and-build-shape", "enforced", "package-artifacts"),
  contract("PKG-002", "CSS exports and side effects preserve the package distribution contract.", "docs/architecture/design-system-contract.md#root-exports-and-build-shape", "enforced", "package-artifacts"),
  contract("PKG-003", "Published artifacts are freshly built and contain required code, CSS, docs, and license.", "docs/architecture/design-system-contract.md#root-exports-and-build-shape", "enforced", "package-artifacts"),
  contract("A11Y-001", "Canonical Light/Dark token pairs meet the frozen WCAG contrast thresholds.", "docs/architecture/design-system-contract.md#accessibility-and-rendering-invariants", "enforced", "accessibility"),
  contract("A11Y-002", "Effective focus and invalid treatments meet non-text contrast or use exact transitional exceptions.", "docs/architecture/design-system-contract.md#accessibility-and-rendering-invariants", "enforced", "accessibility"),
  contract("A11Y-003", "Target size, zoom, reflow, focus geometry, and forced-colors evidence require review until browser gates land.", "docs/architecture/design-system-contract.md#accessibility-and-rendering-invariants", "review-required", null, null, "Reviewer confirms current Storybook/browser evidence does not regress target size, zoom, reflow, focus geometry, or forced colors."),
  contract("A11Y-004", "Valid wider-gamut contrast requires color-managed browser evidence until automated support lands.", "docs/architecture/design-system-contract.md#accessibility-and-rendering-invariants", "review-required", null, null, "When a canonical pair is outside sRGB, attach color-managed browser contrast evidence for Light and Dark."),
  contract("PROVIDER-001", "Provider, scope, mode, SSR, wrapper, and context boundaries activate together under their frozen contract.", "docs/architecture/design-system-contract.md#simplified-color-mode-api", "planned", null, "provider-surface"),
  contract("ICON-001", "Semantic icons activate only with a real consuming component and frozen resolution/accessibility ownership.", "docs/architecture/design-system-contract.md#real-icon-consumer-before-api-stability", "planned", null, "icon-consumer-surface"),
] satisfies readonly ContractEntry[])

export const activationProbes = Object.freeze({
  "canonical-token-source": ["packages/react/src/styles/tokens.ts"],
  "provider-surface": [
    "packages/react/src/provider/nessa-provider.tsx",
    "packages/react/src/theme/nessa-theme-scope.tsx",
  ],
  "icon-consumer-surface": [
    "packages/react/src/components/accordion.tsx",
    "packages/react/src/icons/use-icon.ts",
  ],
} satisfies Record<string, readonly string[]>)
