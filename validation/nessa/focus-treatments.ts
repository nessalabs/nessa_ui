export interface FocusTreatment {
  component: "button" | "badge" | "input"
  layer: "ring" | "border"
  state: string
  className: string
  darkClassName?: string
  light: { token: string; opacity: number }
  dark: { token: string; opacity: number }
}

export const focusTreatments = Object.freeze([
  {
    component: "button",
    layer: "ring",
    state: "focus-visible:non-destructive",
    className: "focus-visible:ring-ring/40",
    light: { token: "--ring", opacity: 0.4 },
    dark: { token: "--ring", opacity: 0.4 },
  },
  {
    component: "button",
    layer: "ring",
    state: "focus-visible:destructive",
    className: "focus-visible:ring-destructive/30",
    light: { token: "--destructive", opacity: 0.3 },
    dark: { token: "--destructive", opacity: 0.3 },
  },
  {
    component: "badge",
    layer: "ring",
    state: "focus-visible",
    className: "focus-visible:ring-ring/40",
    light: { token: "--ring", opacity: 0.4 },
    dark: { token: "--ring", opacity: 0.4 },
  },
  {
    component: "input",
    layer: "ring",
    state: "focus-visible:valid",
    className: "focus-visible:ring-ring/40",
    light: { token: "--ring", opacity: 0.4 },
    dark: { token: "--ring", opacity: 0.4 },
  },
  {
    component: "input",
    layer: "ring",
    state: "focus-visible:invalid",
    className: "aria-invalid:ring-destructive/20",
    darkClassName: "dark:aria-invalid:ring-destructive/40",
    light: { token: "--destructive", opacity: 0.2 },
    dark: { token: "--destructive", opacity: 0.4 },
  },
  { component: "button", layer: "border", state: "focus-visible:border", className: "focus-visible:border-ring", light: { token: "--ring", opacity: 1 }, dark: { token: "--ring", opacity: 1 } },
  { component: "badge", layer: "border", state: "focus-visible:border", className: "focus-visible:border-ring", light: { token: "--ring", opacity: 1 }, dark: { token: "--ring", opacity: 1 } },
  { component: "input", layer: "border", state: "focus-visible:border", className: "focus-visible:border-ring", light: { token: "--ring", opacity: 1 }, dark: { token: "--ring", opacity: 1 } },
  { component: "input", layer: "border", state: "aria-invalid:border", className: "aria-invalid:border-destructive", light: { token: "--destructive", opacity: 1 }, dark: { token: "--destructive", opacity: 1 } },
] satisfies readonly FocusTreatment[])

export const focusSurfaces = Object.freeze(["--background", "--card", "--popover"] as const)

// Width is geometry, not color. It is inventoried exactly here and remains
// review-owned by A11Y-003 while ring/border colors are measured by A11Y-002.
export const focusGeometryClasses = Object.freeze([
  { component: "button", className: "focus-visible:ring-[3px]" },
  { component: "badge", className: "focus-visible:ring-[3px]" },
  { component: "input", className: "focus-visible:ring-[3px]" },
] as const)
