const sidebarFocusComponents = Object.freeze([
  // The group's action and a row's action share one recipe, so their outline
  // is declared once in the module that owns it rather than in each.
  { component: "sidebar/sidebar-action", count: 1 },
  // The row control and a collapsible row's separate disclosure.
  { component: "sidebar/sidebar-menu", count: 2 },
  { component: "sidebar/sidebar-trigger", count: 1 },
] as const)

const composerFocusComponents = Object.freeze([
  // The source-document link and the badge that opens a sent message's
  // annotations; the thread's reply and discard controls are ChatMessageActions.
  { component: "chat-annotations", count: 2 },
  // The five transcript controls, plus a message's hover action and the
  // clamped bubble that opens its full text.
  { component: "chat-bubbles", count: 7 },
  { component: "chat-composer", count: 3 },
  // Only the back link. ChatOverlay does not trap focus; surrounding
  // chrome stays in the tab order. Its content is the host's own.
  { component: "chat-overlay", count: 1 },
  // The chip, the collapsed-count control, and the discard-all button.
  { component: "chat-tray", count: 3 },
  { component: "code-block", count: 1 },
  { component: "composer-access-mode", count: 2 },
  { component: "composer-queue", count: 7 },
  { component: "mermaid-diagram", count: 6 },
  { component: "message", count: 5 },
  { component: "message-scroller", count: 2 },
  { component: "model-capability-controls", count: 3 },
  { component: "model-picker", count: 2 },
  // Only the options carry a focus outline. Like the composer textarea, the
  // search field draws none: browsers match :focus-visible on editable fields
  // for pointer focus too, so an outline there would box the row permanently.
  { component: "searchable-listbox", count: 1 },
  { component: "sectioned-listbox", count: 1 },
  { component: "tool-call", count: 3 },
  // The label is the only target; the rules either side are decoration.
  { component: "transcript-divider", count: 1 },
  // Close and Expand share the circular recipe; Done is the trailing pill.
  { component: "sheet", count: 3 },
  // The disclosing cue, the details trigger, and the named-task card.
  { component: "agent-activity", count: 3 },
  // Each circular action is one target; the title and rows are not controls.
  { component: "agent-details", count: 1 },
  // The conversation row. The search field is an Input and draws its own ring.
  { component: "conversation-history", count: 1 },
] as const)

type FocusComponent =
  | "button"
  | "badge"
  | "input"
  | "conversation-rail"
  | "event-calendar"
  | "gantt-chart/gantt-chart-grid"
  | "radar-chart/radar-chart"
  | "file-diff-list"
  | "chat-tabs"
  | "tabs"
  | "file-preview/file-preview"
  | "file-preview/file-preview-fallback"
  | "kanban/kanban-card"
  | "kanban/kanban-column"
  | "questionnaire"
  | "reference"
  | "json-tree"
  | "selection-tooltip"
  | "tool-approval"
  | "checkbox"
  | "dropdown-menu"
  | "pagination"
  | "page-outline"
  | "price-chart/price-chart"
  | "table/table"
  | "table/table-toolbar"
  | "split-view/split-view-separator"
  | "workflow-canvas/workflow-canvas"
  | "workflow-canvas/workflow-canvas-node"
  | "app-shell/app-shell-dock"
  | (typeof composerFocusComponents)[number]["component"]
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
    className: "aria-invalid:ring-(--nessa-invalid-ring)",
    light: { token: "--destructive", opacity: 0.2 },
    dark: { token: "--destructive", opacity: 0.4 },
  },
  // The questionnaire choice indicator is a native input styled in place; it
  // takes the standard full-strength outline treatment.
  {
    component: "questionnaire",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The tab control and the panel, which Radix makes a focus stop so a
  // reader arriving from the tab lands on the content.
  {
    component: "tabs",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 2,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  { component: "button", layer: "border", state: "focus-visible:border", className: "focus-visible:border-ring", light: { token: "--ring", opacity: 1 }, dark: { token: "--ring", opacity: 1 } },
  { component: "badge", layer: "border", state: "focus-visible:border", className: "focus-visible:border-ring", light: { token: "--ring", opacity: 1 }, dark: { token: "--ring", opacity: 1 } },
  { component: "input", layer: "border", state: "focus-visible:border", className: "focus-visible:border-ring", light: { token: "--ring", opacity: 1 }, dark: { token: "--ring", opacity: 1 } },
  { component: "input", layer: "border", state: "aria-invalid:border", className: "aria-invalid:border-destructive", light: { token: "--destructive", opacity: 1 }, dark: { token: "--destructive", opacity: 1 } },
  ...composerFocusComponents.map(({ component, count }) => ({
    component,
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  } as const)),
  {
    component: "reference",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 6,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "conversation-rail",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The tab trigger sits inside the horizontally scrolling tablist, so its
  // outline draws inset to survive the overflow clipping; the new-tab
  // control shares the treatment for consistency. (The close affordance is
  // pointer-only and carries no focus treatment.)
  {
    component: "chat-tabs",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 2,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "page-outline",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "event-calendar",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 5,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "gantt-chart/gantt-chart-grid",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 8,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The axis label is the spoke's keyboard handle: a spoke is not something
  // a keyboard can point at, so focusing the label probes the axis. The
  // series outlines carry their own treatment on the hit stroke instead —
  // a transparent stroke that becomes the ring when focused.
  {
    component: "radar-chart/radar-chart",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The task-list splitter follows the SplitView separator's treatment:
  // a full-strength ring with no offset, on the hairline itself.
  {
    component: "gantt-chart/gantt-chart-grid",
    layer: "ring",
    state: "focus-visible",
    className: "focus-visible:ring-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "file-diff-list",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 3,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The header download link sits in a padded header row and the fallback's
  // download link sits on a padded empty-state surface, so both keep the
  // standard outset outline.
  {
    component: "file-preview/file-preview",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The chart's scrub cursor covers the whole plot and its clear control sits
  // in the corner its two scales leave, so both outlines draw inset — an
  // outset ring would fall outside the panel that clips it.
  {
    component: "price-chart/price-chart",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 2,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "file-preview/file-preview-fallback",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "selection-tooltip",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 3,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The column drag handle sits in the column header, clear of any
  // clipping region, so it keeps the standard outset outline.
  {
    component: "kanban/kanban-column",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // Kanban cards live inside scrollable column lists, so their outline
  // draws inset like other scroll-region children.
  {
    component: "kanban/kanban-card",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The canvas viewport draws its outline inset because it clips its own
  // content; the node and its connection handles float freely and keep the
  // standard outset offset.
  {
    component: "workflow-canvas/workflow-canvas",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "workflow-canvas/workflow-canvas-node",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 3,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "json-tree",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "tool-approval",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 2,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "table/table",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 2,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The three toolbar triggers share one `tableControlVariants` recipe, so
  // the outline is declared — and counted — once.
  {
    component: "table/table-toolbar",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The box is a native input styled in place, like the questionnaire
  // choice indicator; it takes the standard full-strength outline.
  {
    component: "checkbox",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  // The shared item recipe is referenced by the plain, checkbox, radio, and
  // sub-trigger items.
  {
    component: "dropdown-menu",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 4,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "pagination",
    layer: "outline",
    state: "focus-visible",
    className: "focus-visible:outline-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "split-view/split-view-separator",
    layer: "ring",
    state: "focus-visible",
    className: "focus-visible:ring-ring",
    count: 1,
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
  {
    component: "app-shell/app-shell-dock",
    layer: "ring",
    state: "focus-visible",
    className: "focus-visible:ring-ring",
    count: 1,
    surfaces: ["--sidebar"],
    light: { token: "--ring", opacity: 1 },
    dark: { token: "--ring", opacity: 1 },
  },
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
  { component: "questionnaire", className: "focus-visible:outline-2", count: 1 },
  { component: "questionnaire", className: "focus-visible:outline-offset-2", count: 1 },
  // The tab's outline draws inset: a horizontal strip scrolls, which clips
  // both axes, so an outset ring would be cut off at top and bottom. The
  // panel is not in that strip and keeps the standard outset offset.
  { component: "tabs", className: "focus-visible:outline-2", count: 2 },
  { component: "tabs", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "tabs", className: "focus-visible:outline-offset-2", count: 1 },
  ...composerFocusComponents.flatMap(({ component, count }) => [
    { component, className: "focus-visible:outline-2", count },
    { component, className: "focus-visible:outline-offset-2", count },
  ] as const),
  ...sidebarFocusComponents.flatMap(({ component, count }) => [
    { component, className: "focus-visible:outline-2", count },
    { component, className: "focus-visible:outline-offset-2", count },
  ] as const),
  // The scrollable list region draws its outline inset so the card's
  // overflow clipping cannot swallow it; the row action and toggle buttons
  // sit inside padded rows and keep the standard outset offset.
  { component: "chat-tabs", className: "focus-visible:outline-2", count: 2 },
  { component: "chat-tabs", className: "focus-visible:-outline-offset-2", count: 2 },
  { component: "file-diff-list", className: "focus-visible:outline-2", count: 3 },
  { component: "file-diff-list", className: "focus-visible:outline-offset-2", count: 2 },
  { component: "file-diff-list", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "file-preview/file-preview", className: "focus-visible:outline-2", count: 1 },
  { component: "file-preview/file-preview", className: "focus-visible:outline-offset-2", count: 1 },
  { component: "file-preview/file-preview-fallback", className: "focus-visible:outline-2", count: 1 },
  { component: "file-preview/file-preview-fallback", className: "focus-visible:outline-offset-2", count: 1 },
  // The pager buttons and the scrollable excerpt region sit at the card
  // edge, so their outlines draw inset like file-diff-list's list region;
  // chip and links keep the outset offset.
  { component: "reference", className: "focus-visible:outline-2", count: 6 },
  { component: "reference", className: "focus-visible:outline-offset-2", count: 3 },
  { component: "reference", className: "focus-visible:-outline-offset-2", count: 3 },
  // Every selection-tooltip outline draws inset: the shelf is a clipping
  // scroll region, and an outset outline on its items or on the shelf itself
  // would be swallowed at the overflow edge.
  { component: "selection-tooltip", className: "focus-visible:outline-2", count: 3 },
  { component: "selection-tooltip", className: "focus-visible:-outline-offset-2", count: 3 },
  // The fold toggles routinely sit inside clipping scroll regions (the
  // tool-approval payload, say), so their lone outline draws inset.
  { component: "json-tree", className: "focus-visible:outline-2", count: 1 },
  { component: "json-tree", className: "focus-visible:-outline-offset-2", count: 1 },
  // The command payload is a scroll region at the card edge, so its outline
  // draws inset like the other clipping scroll surfaces; the scope-menu
  // items sit on the padded popover and keep the standard outset offset.
  { component: "tool-approval", className: "focus-visible:outline-2", count: 2 },
  { component: "tool-approval", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "tool-approval", className: "focus-visible:outline-offset-2", count: 1 },
  // Every event-calendar outline draws inset: the day and week surfaces sit
  // inside the scrolling time grid and month cells clip their overflow, so
  // an outset outline would be swallowed at the region edges.
  { component: "event-calendar", className: "focus-visible:outline-2", count: 5 },
  { component: "event-calendar", className: "focus-visible:-outline-offset-2", count: 5 },
  // Every gantt-chart outline draws inset: the bars, collapse toggles, and
  // the scroll region itself all sit inside the scrolling timeline, so an
  // outset outline would be swallowed at the region edges.
  { component: "gantt-chart/gantt-chart-grid", className: "focus-visible:outline-2", count: 8 },
  { component: "gantt-chart/gantt-chart-grid", className: "focus-visible:-outline-offset-2", count: 8 },
  // The radar's axis label draws inset for the same reason: it sits against
  // the plot edge, where an outset outline would be clipped by the gutter.
  { component: "radar-chart/radar-chart", className: "focus-visible:outline-2", count: 1 },
  { component: "radar-chart/radar-chart", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "gantt-chart/gantt-chart-grid", className: "focus-visible:ring-2", count: 1 },
  { component: "gantt-chart/gantt-chart-grid", className: "focus-visible:ring-offset-0", count: 1 },
  { component: "price-chart/price-chart", className: "focus-visible:outline-2", count: 2 },
  { component: "price-chart/price-chart", className: "focus-visible:-outline-offset-2", count: 2 },
  { component: "conversation-rail", className: "focus-visible:outline-2", count: 1 },
  { component: "conversation-rail", className: "focus-visible:outline-offset-2", count: 1 },
  // The page-outline rows sit inside their own scrolling region, so the
  // outline draws inset — an outset ring would be swallowed at its edges.
  { component: "page-outline", className: "focus-visible:outline-2", count: 1 },
  { component: "page-outline", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "kanban/kanban-card", className: "focus-visible:outline-2", count: 1 },
  { component: "kanban/kanban-column", className: "focus-visible:outline-2", count: 1 },
  { component: "kanban/kanban-column", className: "focus-visible:outline-offset-2", count: 1 },
  { component: "kanban/kanban-card", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "workflow-canvas/workflow-canvas", className: "focus-visible:outline-2", count: 1 },
  { component: "workflow-canvas/workflow-canvas", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "workflow-canvas/workflow-canvas-node", className: "focus-visible:outline-2", count: 3 },
  { component: "workflow-canvas/workflow-canvas-node", className: "focus-visible:outline-offset-2", count: 3 },
  // The sort button sits in a padded header cell and keeps the outset
  // offset; the scroll container is focusable so its off-screen rows and
  // columns stay reachable, and draws inset because the shell clips its
  // corners.
  { component: "table/table", className: "focus-visible:outline-2", count: 2 },
  { component: "table/table", className: "focus-visible:outline-offset-2", count: 1 },
  { component: "table/table", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "table/table-toolbar", className: "focus-visible:outline-2", count: 1 },
  { component: "table/table-toolbar", className: "focus-visible:outline-offset-2", count: 1 },
  { component: "checkbox", className: "focus-visible:outline-2", count: 1 },
  { component: "checkbox", className: "focus-visible:outline-offset-2", count: 1 },
  // Menu items draw inset: the content surface clips its overflow, so an
  // outset outline would land on (or past) the padding edge.
  { component: "dropdown-menu", className: "focus-visible:outline-2", count: 4 },
  { component: "dropdown-menu", className: "focus-visible:-outline-offset-2", count: 4 },
  // Page buttons routinely sit inside a clipping table shell, so their lone
  // outline draws inset.
  { component: "pagination", className: "focus-visible:outline-2", count: 1 },
  { component: "pagination", className: "focus-visible:-outline-offset-2", count: 1 },
  { component: "split-view/split-view-separator", className: "focus-visible:ring-2", count: 1 },
  { component: "split-view/split-view-separator", className: "focus-visible:ring-offset-0", count: 1 },
  { component: "app-shell/app-shell-dock", className: "focus-visible:ring-2", count: 1 },
  { component: "app-shell/app-shell-dock", className: "focus-visible:ring-offset-0", count: 1 },
] as const)
