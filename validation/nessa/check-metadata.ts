import type { CheckPhase } from "../framework/types.ts"

interface CheckMetadata {
  phase: CheckPhase
  inputs: readonly string[]
  dependsOn: readonly string[]
  global: boolean
}

export const checkMetadata = Object.freeze({
  governance: { phase: "source", inputs: ["README.md", ".node-version", ".github/CODEOWNERS", "docs/architecture/design-system-contract.md", "docs/plans/**/*.md", "validation/contracts.ts", "validation/amendments.ts", "validation/exceptions.ts", "validation/nessa/check-metadata.ts", "validation/nessa/checks/**/*.ts"], dependsOn: [], global: true },
  "css-ownership": { phase: "source", inputs: ["packages/react/src/*.css", "packages/react/package.json"], dependsOn: [], global: false },
  "theme-parity": { phase: "source", inputs: ["packages/react/src/theme.css", "registry.json", "public/r/nessa-base.json"], dependsOn: [], global: false },
  "registry-parity": { phase: "source", inputs: ["registry.json", "public/r/*.json", "packages/react/src/**/*.{ts,tsx}"], dependsOn: ["theme-parity"], global: false },
  "source-boundaries": { phase: "source", inputs: ["packages/react/src/**/*.{ts,tsx,css}"], dependsOn: [], global: false },
  "style-discipline": { phase: "source", inputs: ["packages/react/src/**/*.tsx", "validation/exceptions.ts"], dependsOn: [], global: false },
  "storybook-coverage": { phase: "source", inputs: ["packages/react/src/index.ts", "apps/storybook/stories/**/*.stories.tsx"], dependsOn: [], global: false },
  "interaction-stability": { phase: "source", inputs: ["packages/react/src/components/model-picker.tsx", "packages/react/src/components/searchable-listbox.tsx", "apps/storybook/stories/model-picker.stories.tsx"], dependsOn: [], global: false },
  "package-artifacts": { phase: "source", inputs: ["packages/react/package.json", "packages/react/{README.md,LICENSE}"], dependsOn: [], global: false },
  accessibility: { phase: "source", inputs: ["packages/react/src/theme.css", "packages/react/src/components/**/*.tsx", "packages/react/src/composites/**/*.tsx", "validation/exceptions.ts", "validation/nessa/{contrast-matrix,focus-treatments}.ts"], dependsOn: ["theme-parity"], global: false },
  "package-artifacts-built": { phase: "artifacts", inputs: ["packages/react/dist/**/*"], dependsOn: [], global: false },
} satisfies Record<string, CheckMetadata>)
