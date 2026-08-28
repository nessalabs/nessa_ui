import type { CheckDefinition } from "../../framework/types.ts"
import { accessibilityCheck } from "./accessibility.ts"
import { cssOwnershipCheck } from "./css-ownership.ts"
import { governanceCheck } from "./governance.ts"
import { interactionStabilityCheck } from "./interaction-stability.ts"
import { packageArtifactsBuiltCheck, packageArtifactsCheck } from "./package-artifacts.ts"
import { registryParityCheck } from "./registry-parity.ts"
import { sourceBoundariesCheck } from "./source-boundaries.ts"
import { storybookCoverageCheck } from "./storybook-coverage.ts"
import { styleDisciplineCheck } from "./style-discipline.ts"
import { themeParityCheck } from "./theme-parity.ts"

export const nessaChecks = Object.freeze([
  governanceCheck,
  cssOwnershipCheck,
  themeParityCheck,
  registryParityCheck,
  sourceBoundariesCheck,
  styleDisciplineCheck,
  storybookCoverageCheck,
  interactionStabilityCheck,
  packageArtifactsCheck,
  accessibilityCheck,
  packageArtifactsBuiltCheck,
] satisfies readonly CheckDefinition[])
