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

export interface StyleException {
  kind: "style"
  contractId: "STYLE-002" | "STYLE-003"
  path: string
  needle: string
  maximumOccurrences: number
  rationale: string
  removalCondition: string
}

export type ValidationException = OccurrenceException | ContrastException | FocusContrastException | StyleException

const focusRationale = "Current shadcn-derived translucent focus treatment predates Nessa semantic focus-state tokens."
const focusRemoval = "Remove with the semantic focus/invalid token migration before provider stabilization."

const style = (
  contractId: "STYLE-002" | "STYLE-003",
  path: string,
  needle: string,
  maximumOccurrences: number,
  rationale: string,
  removalCondition: string,
): StyleException => ({ kind: "style", contractId, path, needle, maximumOccurrences, rationale, removalCondition })

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
    kind: "contrast",
    contractId: "A11Y-001",
    mode: "light",
    foreground: "--input",
    background: "--background",
    requiredRatio: 3,
    expectedForegroundValue: "oklch(0.922 0 0)",
    expectedBackgroundValue: "oklch(1 0 0)",
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
    expectedForegroundValue: "oklch(0.922 0 0)",
    expectedBackgroundValue: "oklch(1 0 0)",
    rationale: "The current Light surface/control boundary predates the canonical accessible palette.",
    removalCondition: "Raise required Light boundaries to 3:1 during canonical theme migration.",
  },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:non-destructive", mode: "light", token: "--ring", opacity: 0.4, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:non-destructive", mode: "light", token: "--ring", opacity: 0.4, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:non-destructive", mode: "light", token: "--ring", opacity: 0.4, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "badge", state: "focus-visible", mode: "light", token: "--ring", opacity: 0.4, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "badge", state: "focus-visible", mode: "light", token: "--ring", opacity: 0.4, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "badge", state: "focus-visible", mode: "light", token: "--ring", opacity: 0.4, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:valid", mode: "light", token: "--ring", opacity: 0.4, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:valid", mode: "light", token: "--ring", opacity: 0.4, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:valid", mode: "light", token: "--ring", opacity: 0.4, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.556 0 0)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "light", token: "--destructive", opacity: 0.3, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.577 0.235 27.325)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "light", token: "--destructive", opacity: 0.3, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.577 0.235 27.325)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "light", token: "--destructive", opacity: 0.3, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.577 0.235 27.325)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "dark", token: "--destructive", opacity: 0.3, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.704 0.187 22.216)", expectedSurfaceValue: "oklch(0.145 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "dark", token: "--destructive", opacity: 0.3, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.704 0.187 22.216)", expectedSurfaceValue: "oklch(0.205 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "button", state: "focus-visible:destructive", mode: "dark", token: "--destructive", opacity: 0.3, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.704 0.187 22.216)", expectedSurfaceValue: "oklch(0.205 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:invalid", mode: "light", token: "--destructive", opacity: 0.2, surface: "--background", requiredRatio: 3, expectedTokenValue: "oklch(0.577 0.235 27.325)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:invalid", mode: "light", token: "--destructive", opacity: 0.2, surface: "--card", requiredRatio: 3, expectedTokenValue: "oklch(0.577 0.235 27.325)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  { kind: "focus-contrast", contractId: "A11Y-002", component: "input", state: "focus-visible:invalid", mode: "light", token: "--destructive", opacity: 0.2, surface: "--popover", requiredRatio: 3, expectedTokenValue: "oklch(0.577 0.235 27.325)", expectedSurfaceValue: "oklch(1 0 0)", rationale: focusRationale, removalCondition: focusRemoval },
  style("STYLE-003", "packages/react/src/components/event-calendar.tsx", "zIndex", 1, "Overlapping event segments compute a continuous per-column layer (30 + column) inside the day cell's own stacking context.", "Restructure segment layering onto the frozen scale (e.g. render-order layering) when the calendar's overlap model is next revised."),
] satisfies readonly ValidationException[])
