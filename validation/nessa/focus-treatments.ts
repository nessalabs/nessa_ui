const sidebarFocusComponents = Object.freeze([
  { component: "sidebar/sidebar-group", count: 1 },
  { component: "sidebar/sidebar-menu", count: 1 },
  { component: "sidebar/sidebar-trigger", count: 1 },
] as const)

type FocusComponent =
  | "button"
  | "badge"
  | "input"
  | (typeof sidebarFocusComponents)[number]["component"]

export interface FocusTreatment {
  component: FocusComponent
  layer: "ring" | "border" | "outline"
  state: string
  className: string
  darkClassName?: string
  count?: number
  surfaces?: readonly string[]
  light: { token: string; opacity: number }
  dark: { token: string; opacity: number }
}

export const focusTreatments: readonly FocusTreatment[] = Object.freeze([
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
  ...sidebarFocusComponents.map(({ component, count }) => ({
    component,
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-sidebar-ring",
    count,
    surfaces: ["--sidebar"],
    light: { token: "--sidebar-ring", opacity: 1 },
    dark: { token: "--sidebar-ring", opacity: 1 },
  } as const)),
])

export const focusSurfaces = Object.freeze(["--background", "--card", "--popover"] as const)

// Width is geometry, not color. It is inventoried exactly here and remains
// review-owned by A11Y-003 while ring/border colors are measured by A11Y-002.
export const focusGeometryClasses = Object.freeze([
  { component: "button", className: "focus-visible:ring-[3px]" },
  { component: "badge", className: "focus-visible:ring-[3px]" },
  { component: "input", className: "focus-visible:ring-[3px]" },
  ...sidebarFocusComponents.flatMap(({ component, count }) => [
    { component, className: "focus-visible:outline-2", count },
    { component, className: "focus-visible:outline-offset-2", count },
  ] as const),
] as const)
