export interface ContrastPair {
  foreground: string
  background: string
  minimum: number
  role: "normal-text" | "required-boundary" | "focus-source"
}

export const contrastMatrix = Object.freeze([
  { foreground: "--foreground", background: "--background", minimum: 4.5, role: "normal-text" },
  { foreground: "--card-foreground", background: "--card", minimum: 4.5, role: "normal-text" },
  { foreground: "--popover-foreground", background: "--popover", minimum: 4.5, role: "normal-text" },
  { foreground: "--primary-foreground", background: "--primary", minimum: 4.5, role: "normal-text" },
  { foreground: "--secondary-foreground", background: "--secondary", minimum: 4.5, role: "normal-text" },
  { foreground: "--muted-foreground", background: "--muted", minimum: 4.5, role: "normal-text" },
  { foreground: "--accent-foreground", background: "--accent", minimum: 4.5, role: "normal-text" },
  { foreground: "--destructive-foreground", background: "--destructive", minimum: 4.5, role: "normal-text" },
  { foreground: "--input", background: "--background", minimum: 3, role: "required-boundary" },
  { foreground: "--border", background: "--background", minimum: 3, role: "required-boundary" },
  { foreground: "--ring", background: "--background", minimum: 3, role: "focus-source" },
  { foreground: "--ring", background: "--card", minimum: 3, role: "focus-source" },
  { foreground: "--ring", background: "--popover", minimum: 3, role: "focus-source" },
] satisfies readonly ContrastPair[])
