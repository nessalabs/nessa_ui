export interface ContrastPair {
  foreground: string
  background: string
  minimum: number
  role: "normal-text" | "required-boundary" | "focus-source"
  // Translucent wash composited over `background` before measuring, for text
  // that stays visible on hover surfaces such as bg-accent/50 over the card.
  overlay?: { token: string; opacity: number }
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
  { foreground: "--sidebar-foreground", background: "--sidebar", minimum: 4.5, role: "normal-text" },
  { foreground: "--sidebar-accent-foreground", background: "--sidebar-accent", minimum: 4.5, role: "normal-text" },
  { foreground: "--sidebar-ring", background: "--sidebar", minimum: 3, role: "focus-source" },
  { foreground: "--nessa-diff-addition", background: "--card", minimum: 4.5, role: "normal-text" },
  { foreground: "--nessa-diff-addition", background: "--card", overlay: { token: "--accent", opacity: 0.5 }, minimum: 4.5, role: "normal-text" },
  { foreground: "--nessa-diff-deletion", background: "--card", minimum: 4.5, role: "normal-text" },
  { foreground: "--nessa-diff-deletion", background: "--card", overlay: { token: "--accent", opacity: 0.5 }, minimum: 4.5, role: "normal-text" },
  { foreground: "--nessa-fast-mode-active", background: "--card", minimum: 4.5, role: "normal-text" },
  { foreground: "--nessa-fast-mode-active", background: "--background", minimum: 4.5, role: "normal-text" },
] satisfies readonly ContrastPair[])
