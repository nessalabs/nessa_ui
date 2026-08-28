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

const inlinePaintRationale = "Runtime-computed paint (generated gradients, shimmer text, avatar blending) predates semantic paint tokens for this surface."
const inlineGeometryRationale = "Runtime-measured spacing or layering has no utility form because its value is computed from live geometry."
const inlineMotionRationale = "Runtime-supplied motion timing (a consumer-controlled duration prop, dnd-kit's sortable transition) predates semantic motion-state tokens for these surfaces."
const inlineRemoval = "Route through a --nessa-* custom property plus a utility when the owning surface's semantic tokens land."
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
  style("STYLE-003", "packages/react/src/composites/app-shell/app-shell-drag.tsx", "visibility", 1, inlineGeometryRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/workflow-canvas/workflow-canvas.tsx", "backgroundImage", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/workflow-canvas/workflow-canvas.tsx", "backgroundSize", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/workflow-canvas/workflow-canvas.tsx", "backgroundPosition", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/workflow-canvas/workflow-canvas-edge.tsx", "strokeWidth", 1, inlineGeometryRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/tool-call.tsx", "color", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/tool-call.tsx", "--diffs-dark-addition-color", 1, "Third-party diff-renderer theming bridge deliberately deepens Pierre's dark-row addition green with a fixed value.", "Replace with a --nessa-diff-* dark-surface token when the diff token set covers renderer theming."),
  style("STYLE-003", "packages/react/src/components/tool-call.tsx", "backgroundImage", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/tool-call.tsx", "backgroundSize", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/tool-call.tsx", "backgroundPosition", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/tool-call.tsx", "backgroundClip", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/tool-call.tsx", "WebkitBackgroundClip", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/random-avatar.tsx", "mixBlendMode", 3, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/random-avatar.tsx", "isolation", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/model-capability-controls.tsx", "filter", 3, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/model-capability-controls.tsx", "boxShadow", 2, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/model-capability-controls.tsx", "backgroundImage", 2, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/model-capability-controls.tsx", "backgroundColor", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/model-capability-controls.tsx", "background", 2, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/message.tsx", "transitionDuration", 1, inlineMotionRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/kanban/kanban.tsx", "paddingInlineEnd", 1, inlineGeometryRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/kanban/kanban-column.tsx", "paddingBottom", 1, inlineGeometryRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/generating-surface.tsx", "color", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/generating-surface.tsx", "background", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/generating-surface.tsx", "backgroundImage", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/generating-surface.tsx", "backgroundSize", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/generating-surface.tsx", "backgroundPosition", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/generating-surface.tsx", "backgroundClip", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/generating-surface.tsx", "WebkitBackgroundClip", 1, inlinePaintRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/gantt-chart/gantt-chart-grid.tsx", "paddingInlineStart", 1, inlineGeometryRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/event-calendar.tsx", "zIndex", 1, inlineGeometryRationale, inlineRemoval),
  style("STYLE-003", "packages/react/src/components/composer-queue.tsx", "transition", 1, inlineMotionRationale, inlineRemoval),
] satisfies readonly ValidationException[])
