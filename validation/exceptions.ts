export interface OccurrenceException {
  kind: "occurrence"
  contractId: string
  path: string
  needle: string
  maximumOccurrences: number
  rationale: string
  removalCondition: string
}

export interface ContrastException {
  kind: "contrast"
  contractId: "A11Y-001"
  mode: "light" | "dark"
  foreground: string
  background: string
  requiredRatio: number
  expectedForegroundValue: string
  expectedBackgroundValue: string
  rationale: string
  removalCondition: string
}

export interface FocusContrastException {
  kind: "focus-contrast"
  contractId: "A11Y-002"
  component: string
  state: string
  mode: "light" | "dark"
  token: string
  opacity: number
  surface: "--background" | "--card" | "--popover"
  requiredRatio: number
  expectedTokenValue: string
  expectedSurfaceValue: string
  rationale: string
  removalCondition: string
}

export type ValidationException = OccurrenceException | ContrastException | FocusContrastException

const focusRationale = "Current shadcn-derived translucent focus treatment predates Nessa semantic focus-state tokens."
const focusRemoval = "Remove with the semantic focus/invalid token migration before provider stabilization."

export const exceptions = Object.freeze([
  {
    kind: "occurrence",
    contractId: "SRC-002",
    path: "packages/react/src/styles.css",
    needle: "@custom-variant dark",
    maximumOccurrences: 1,
    rationale: "Transitional shadcn compatibility declaration predates scoped resolved-mode tokens.",
    removalCondition: "Remove when provider-scoped mode selectors and semantic state tokens land.",
  },
  {
    kind: "occurrence",
    contractId: "SRC-002",
    path: "packages/react/src/components/button.tsx",
    needle: "dark:bg-destructive/70",
    maximumOccurrences: 1,
    rationale: "Existing destructive variant still carries its shadcn dark override.",
    removalCondition: "Replace with a semantic destructive token during canonical theme generation.",
  },
  {
    kind: "occurrence",
    contractId: "SRC-002",
    path: "packages/react/src/components/input.tsx",
    needle: "dark:aria-invalid:ring-destructive/40",
    maximumOccurrences: 1,
    rationale: "Existing invalid state still carries its shadcn dark override.",
    removalCondition: "Replace with a semantic invalid-focus token during canonical theme generation.",
  },
  {
    kind: "contrast",
    contractId: "A11Y-001",
    mode: "light",
    foreground: "--input",
    background: "--background",
    requiredRatio: 3,
    expectedForegroundValue: "oklch(0.86 0.022 255)",
    expectedBackgroundValue: "oklch(0.985 0.006 255)",
    rationale: "The current Light input boundary predates the canonical accessible control palette.",
    removalCondition: "Raise the Light input boundary to 3:1 during canonical theme migration.",
  },
  {
    kind: "contrast",
    contractId: "A11Y-001",
    mode: "light",
    foreground: "--border",
    background: "--background",
    requiredRatio: 3,
    expectedForegroundValue: "oklch(0.885 0.018 255)",
    expectedBackgroundValue: "oklch(0.985 0.006 255)",
    rationale: "The current Light surface/control boundary predates the canonical accessible palette.",
    removalCondition: "Raise required Light boundaries to 3:1 during canonical theme migration.",
  },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:non-destructive", mode: "light", token: "--ring", opacity: 0.4, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(0.985 0.006 255)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:non-destructive", mode: "light", token: "--ring", opacity: 0.4, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:non-destructive", mode: "light", token: "--ring", opacity: 0.4, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "badge", state: "focus-visible", mode: "light", token: "--ring", opacity: 0.4, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(0.985 0.006 255)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "badge", state: "focus-visible", mode: "light", token: "--ring", opacity: 0.4, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "badge", state: "focus-visible", mode: "light", token: "--ring", opacity: 0.4, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:valid", mode: "light", token: "--ring", opacity: 0.4, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(0.985 0.006 255)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:valid", mode: "light", token: "--ring", opacity: 0.4, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:valid", mode: "light", token: "--ring", opacity: 0.4, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "light", token: "--destructive", opacity: 0.3, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.58 0.22 27)", expectedSurfaceValue: "oklch(0.985 0.006 255)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "light", token: "--destructive", opacity: 0.3, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.58 0.22 27)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "light", token: "--destructive", opacity: 0.3, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.58 0.22 27)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "dark", token: "--destructive", opacity: 0.3, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.69 0.19 25)", expectedSurfaceValue: "oklch(0.155 0.025 258)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "dark", token: "--destructive", opacity: 0.3, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.69 0.19 25)", expectedSurfaceValue: "oklch(0.195 0.03 258)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "dark", token: "--destructive", opacity: 0.3, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.69 0.19 25)", expectedSurfaceValue: "oklch(0.195 0.03 258)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:invalid", mode: "light", token: "--destructive", opacity: 0.2, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.58 0.22 27)", expectedSurfaceValue: "oklch(0.985 0.006 255)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:invalid", mode: "light", token: "--destructive", opacity: 0.2, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.58 0.22 27)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:invalid", mode: "light", token: "--destructive", opacity: 0.2, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.58 0.22 27)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
] satisfies readonly ValidationException[])
