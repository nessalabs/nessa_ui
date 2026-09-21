"use client"

import * as React from "react"
import type { DiffsThemeNames, ThemesType } from "@pierre/diffs"
import { ChevronRight, FileText } from "lucide-react"
import { Collapsible, Tabs } from "radix-ui"

import { cn } from "@/lib/utils"
import {
  LazyHighlighterBoundary,
  loadHighlighter,
  rethrowAsUnarrived,
  useCodeBlockConfig,
  type CodeBlockConfig,
} from "./code-block"

/**
 * Pierre's diff engine, fetched by the first diff rendered rather than
 * imported by the barrel. `@pierre/diffs` runs work at module scope, so a
 * static import of it is a side effect no bundler may drop, and holding one
 * here put a syntax highlighter in the first paint of every app that imports
 * anything from this package. The parse travels with the renderer — see
 * tool-call-diff-surface.
 */
const ToolCallDiffSurface = React.lazy(() =>
  // The loader comes along so the custom theme is registered before the diff
  // renders with it; it resolves from the same modules this import fetches,
  // so awaiting both costs nothing beyond the one fetch.
  //
  // Either leg can fail, and this one is its own hashed chunk: a deploy can
  // remove it while the engine's chunks are still reachable. Both rejections
  // are marked the same way, so the boundary recognises a diff surface that
  // never arrived instead of re-throwing it into the host application.
  Promise.all([import("./tool-call-diff-surface"), loadHighlighter()])
    .then(([module]) => ({ default: module.ToolCallDiffSurface }))
    .catch(rethrowAsUnarrived),
)

/**
 * The lifecycle of a tool call: `running` while the tool executes (the trigger
 * label shimmers), `complete` once it finished, and `error` when it failed
 * (the label tints destructive).
 */
export type ToolCallStatus = "running" | "complete" | "error"

const ToolCallStatusContext = React.createContext<ToolCallStatus>("complete")

export interface ToolCallProps extends React.ComponentProps<"div"> {
  /** Controlled expanded state; pair with `onOpenChange`. */
  open?: boolean
  /** Initial expanded state when uncontrolled. Collapsed by default. */
  defaultOpen?: boolean
  /** Called when the trigger toggles the expanded state. */
  onOpenChange?: (open: boolean) => void
  /**
   * The call's lifecycle state, exposed as `data-status` for host styling.
   * While `running` the row is `aria-busy` and the trigger label shimmers;
   * `error` tints the label destructive. Defaults to `complete`.
   */
  status?: ToolCallStatus
}

/**
 * One tool invocation in an agent transcript: a compact disclosure row whose
 * trigger names the tool and whose content reveals the call's details —
 * typically ToolCallTabs for input and output, ToolCallDiff for an edit, or
 * ToolCallFile chips for touched files. Expansion is uncontrolled by default
 * and host-controlled via `open`/`onOpenChange`.
 */
function ToolCall({
  open,
  defaultOpen,
  onOpenChange,
  status = "complete",
  className,
  ...props
}: ToolCallProps) {
  return (
    <ToolCallStatusContext.Provider value={status}>
      <Collapsible.Root
        data-slot="tool-call"
        data-status={status}
        aria-busy={status === "running" || undefined}
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        className={cn(
          "group/tool-call flex w-full min-w-0 flex-col font-sans",
          className,
        )}
        {...props}
      />
    </ToolCallStatusContext.Provider>
  )
}

/** Matches the reduced-motion media query used across Nessa motion surfaces. */
const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

/** Returns the live, server-safe reduced-motion preference. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

/** Parses a CSS duration token value into milliseconds. */
function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

/**
 * The moving highlight is painted with theme tokens — muted-foreground body,
 * foreground crest — so it reads in both schemes without `dark:` variants.
 */
const toolCallShimmerClasses =
  "data-[shimmer=true]:[background-image:linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_38%,var(--foreground)_50%,var(--muted-foreground)_62%,var(--muted-foreground)_100%)] data-[shimmer=true]:bg-[length:200%_100%] data-[shimmer=true]:bg-[position:150%_0] data-[shimmer=true]:bg-clip-text data-[shimmer=true]:[-webkit-background-clip:text] data-[shimmer=true]:text-transparent"

/**
 * Renders the trigger label, sweeping a highlight across the text while
 * active. The gradient is clipped to the glyphs so the label stays real,
 * selectable text; with reduced motion (or once settled) it renders as plain
 * muted text.
 */
function ToolCallShimmer({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const shimmering = active && !reducedMotion
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || !shimmering) return
    const duration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue("--nessa-motion-duration-ambient"),
      3200,
    )
    if (duration === 0) return
    // The highlight sits at the center of a double-width background, so
    // sliding the position from 150% to -50% carries it once across the text
    // per cycle, left to right.
    const animation = node.animate(
      [{ backgroundPosition: "150% 0" }, { backgroundPosition: "-50% 0" }],
      { duration, easing: "linear", iterations: Infinity },
    )
    return () => animation.cancel()
  }, [shimmering])
  return (
    <span
      ref={ref}
      data-slot="tool-call-shimmer"
      data-shimmer={shimmering ? "true" : undefined}
      className={cn("min-w-0 truncate text-left", toolCallShimmerClasses)}
    >
      {children}
    </span>
  )
}

export interface ToolCallTriggerProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  /**
   * The tool's glyph, rendered leading the label. The trigger owns sizing and
   * color, so pass the bare icon element — hosts typically map their own tool
   * names to icons and pass the match here.
   */
  icon?: React.ReactNode
  /** The tool name or activity text, e.g. "Read" or "Searching the web". */
  children?: React.ReactNode
  /**
   * Muted trailing detail beside the label — a file path, an argument
   * summary, or a duration such as "1m 23s".
   */
  meta?: React.ReactNode
}

/**
 * The always-visible summary row: icon, label, optional meta, and a chevron
 * that tracks the expanded state. While the call is `running` the label
 * shimmers; when it `error`ed the label tints destructive. Renders a real
 * button wired to the disclosure, so `aria-expanded` stays correct.
 */
function ToolCallTrigger({
  icon,
  meta,
  className,
  children,
  ...props
}: ToolCallTriggerProps) {
  const status = React.useContext(ToolCallStatusContext)
  return (
    <Collapsible.Trigger
      data-slot="tool-call-trigger"
      className={cn(
        "flex w-fit min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 nessa-text-4 text-muted-foreground outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
        "group-data-[status=error]/tool-call:text-destructive",
        className,
      )}
      {...props}
    >
      {icon != null && (
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center [&_svg]:size-3.5"
        >
          {icon}
        </span>
      )}
      <ToolCallShimmer active={status === "running"}>{children}</ToolCallShimmer>
      {meta != null && (
        <span className="min-w-0 truncate nessa-text-2 font-normal text-muted-foreground">
          {meta}
        </span>
      )}
      <ChevronRight
        aria-hidden="true"
        className="size-3.5 shrink-0 transition-transform [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] group-data-[state=open]/tool-call:rotate-90 motion-reduce:transition-none"
      />
    </Collapsible.Trigger>
  )
}

export interface ToolCallContentProps extends React.ComponentProps<"div"> {}

/**
 * The revealed detail area, indented under the trigger with a connector rail
 * so nested surfaces read as part of the call. Compose any content: the
 * common shapes are ToolCallTabs, ToolCallDiff, and ToolCallFile rows.
 */
function ToolCallContent({ className, ...props }: ToolCallContentProps) {
  return (
    <Collapsible.Content
      data-slot="tool-call-content"
      className={cn(
        "relative mt-1.5 flex min-w-0 flex-col items-start gap-2 pb-1 pl-7",
        "before:absolute before:bottom-1 before:left-[0.6875rem] before:top-0 before:w-px before:bg-border",
        className,
      )}
      {...props}
    />
  )
}

/**
 * A string payload renders as preformatted monospace text; anything else —
 * a CodeBlock, MessageMarkdown, custom nodes — renders as passed.
 */
function toolCallPanelContent(content: React.ReactNode) {
  if (typeof content !== "string") return content
  return (
    <pre className="whitespace-pre-wrap break-words font-mono nessa-text-2 leading-5 text-foreground">
      {content}
    </pre>
  )
}

export interface ToolCallTabsProps
  extends Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "dir"> {
  /** The call's input payload. Strings render preformatted; nodes render as passed. */
  input?: React.ReactNode
  /** The call's output payload. Strings render preformatted; nodes render as passed. */
  output?: React.ReactNode
  /** Tab label for the input pane. Defaults to "Input". */
  inputLabel?: React.ReactNode
  /** Tab label for the output pane. Defaults to "Output". */
  outputLabel?: React.ReactNode
  /** Which pane shows first. Defaults to the first pane provided. */
  defaultTab?: "input" | "output"
  /**
   * Extra classes for both panes — most usefully a `max-h-*` utility to
   * change the default `max-h-64` cap that keeps long payloads scrolling
   * inside the pane instead of stretching the transcript.
   */
  panelClassName?: string
}

/**
 * The default expanded body of a tool call: the input and output payloads as
 * a small tab pair. Either pane may be omitted — a call still streaming, say,
 * has no output yet — and the tab list simply shrinks to what exists.
 */
function ToolCallTabs({
  input,
  output,
  inputLabel = "Input",
  outputLabel = "Output",
  defaultTab,
  panelClassName,
  className,
  ...props
}: ToolCallTabsProps) {
  const panes = [
    ...(input != null ? [{ value: "input", label: inputLabel, content: input }] : []),
    ...(output != null
      ? [{ value: "output", label: outputLabel, content: output }]
      : []),
  ]
  if (panes.length === 0) return null
  return (
    <Tabs.Root
      data-slot="tool-call-tabs"
      defaultValue={
        defaultTab != null && panes.some((pane) => pane.value === defaultTab)
          ? defaultTab
          : panes[0]!.value
      }
      className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}
      {...props}
    >
      <Tabs.List
        data-slot="tool-call-tabs-list"
        aria-label="Tool call payload"
        className="flex w-fit items-center gap-1"
      >
        {panes.map((pane) => (
          <Tabs.Trigger
            key={pane.value}
            value={pane.value}
            className="rounded-md px-2 py-0.5 nessa-text-2 font-medium text-muted-foreground outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=active]:bg-muted data-[state=active]:text-foreground motion-reduce:transition-none"
          >
            {pane.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {/* Both panes stay mounted, stacked in one grid cell, so the region
          keeps the taller pane's height and switching tabs never reflows the
          transcript around it. The inactive pane is visibility-hidden, which
          also drops it from the tab order and accessibility tree. */}
      <div className="grid w-full min-w-0">
        {panes.map((pane) => (
          <Tabs.Content
            key={pane.value}
            value={pane.value}
            forceMount
            data-slot="tool-call-tab-panel"
            className={cn(
              "col-start-1 row-start-1 max-h-64 w-full min-w-0 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3 outline-none data-[state=inactive]:invisible",
              panelClassName,
            )}
          >
            {toolCallPanelContent(pane.content)}
          </Tabs.Content>
        ))}
      </div>
    </Tabs.Root>
  )
}

/**
 * The default syntax theme pair, mirroring CodeBlock's defaults so tool-call
 * diffs match every other code surface.
 */
/**
 * How tall to hold the region open while Pierre's engine is on its way.
 *
 * A unified diff is roughly the changed lines of both sides plus context, so
 * the larger side is the closer guess than either alone. Capped so a
 * thousand-line rewrite reserves a screenful rather than a scrollbar of
 * empty pulse.
 */
function diffSkeletonLines(from: string, to: string): number {
  const lines = Math.max(from.split("\n").length, to.split("\n").length)
  return Math.min(Math.max(lines, 3), 24)
}

const defaultDiffTheme: ThemesType = {
  dark: "nessa-dark",
  light: "light-plus",
}

export interface ToolCallDiffProps
  extends Omit<React.ComponentProps<"div">, "children">,
    CodeBlockConfig {
  /** The file contents before the edit. */
  from: string
  /** The file contents after the edit. */
  to: string
  /** The edited file's path; names the diff header and infers the language. */
  filename?: string
  /** Overrides the language inferred from `filename`, e.g. "tsx". */
  language?: string
  /** Unified single-column or split side-by-side layout. Defaults to `unified`. */
  diffStyle?: "unified" | "split"
}

/**
 * An edit shown as a diff — deletions and additions computed from the before
 * and after contents, syntax-highlighted by Pierre's engine. Appearance
 * resolves from props, then the nearest CodeBlockProvider, then defaults,
 * like CodeBlock — except lines wrap by default, because transcript columns
 * are narrow and a scrolling code region is keyboard-inaccessible.
 */
function ToolCallDiff({
  from,
  to,
  filename,
  language,
  diffStyle = "unified",
  theme,
  mode,
  lineNumbers,
  wrap,
  className,
  style,
  ...props
}: ToolCallDiffProps) {
  const config = useCodeBlockConfig()
  const resolved = {
    theme: theme ?? config.theme ?? defaultDiffTheme,
    mode: mode ?? config.mode ?? "system",
    lineNumbers: lineNumbers ?? config.lineNumbers ?? false,
    wrap: wrap ?? config.wrap ?? true,
  }
  const name = filename ?? `edit.${language ?? "txt"}`
  const options = React.useMemo(
    () => ({
      diffStyle,
      disableFileHeader: filename === undefined,
      disableLineNumbers: !resolved.lineNumbers,
      overflow: resolved.wrap ? ("wrap" as const) : ("scroll" as const),
      themeType: resolved.mode,
      ...(resolved.theme !== undefined && {
        theme: resolved.theme as DiffsThemeNames | ThemesType,
      }),
    }),
    [
      diffStyle,
      filename,
      resolved.lineNumbers,
      resolved.mode,
      resolved.theme,
      resolved.wrap,
    ],
  )
  return (
    <div
      data-slot="tool-call-diff"
      className={cn(
        "w-full min-w-0 max-w-full overflow-hidden rounded-xl nessa-text-3 leading-6",
        className,
      )}
      // Custom properties inherit through Pierre's shadow root. The dark
      // addition green is deepened from Pierre's #5ecc71 (the
      // --nessa-diff-dark-addition token), and the dark row washes carry a
      // stronger share of the change color than Pierre's 80/20 mix so added
      // and deleted lines read clearly green and red on the near-black
      // ground; hosts can override any of these via style or the theme.
      style={
        {
          "--diffs-dark-addition-color": "var(--nessa-diff-dark-addition)",
          "--diffs-bg-addition-override":
            "light-dark(color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-addition-base)), color-mix(in lab, var(--diffs-bg) 68%, var(--diffs-addition-base)))",
          "--diffs-bg-deletion-override":
            "light-dark(color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-deletion-base)), color-mix(in lab, var(--diffs-bg) 76%, var(--diffs-deletion-base)))",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {/*
        The engine arrives with the first diff on screen: the skeleton holds
        the region open until it does, and if it never does the edited file
        still reads as plain text rather than taking the transcript with it.
      */}
      <LazyHighlighterBoundary
        fallback={
          <div data-slot="tool-call-diff-plain" className="w-full">
            {/*
              A diff is not its after-state, and this surface cannot show the
              difference any more: say so, rather than letting a file listing
              pass for a review of what changed.
            */}
            <p className="nessa-text-2 px-1 pb-2 text-muted-foreground">
              The diff could not be loaded. Showing {name} after the edit.
            </p>
            <pre
              // Focusable because it scrolls: this is the only remaining way
              // to read the edit, and a keyboard user must reach the part of
              // it that is off-screen.
              tabIndex={0}
              role="region"
              aria-label={`${name} after the edit`}
              className="w-full overflow-auto rounded-xl bg-muted/40 p-4 font-mono text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {to}
            </pre>
          </div>
        }
      >
        <React.Suspense
          fallback={
            <div
              data-slot="tool-call-diff-skeleton"
              aria-hidden="true"
              // Sized from the edit rather than a fixed bar, so a long edit
              // does not open a 96px gap and then shove the transcript down
              // when the real diff lands. An approximation, not a
              // reservation: hunks, wrapping and the file header all move it.
              style={{ height: `calc(${diffSkeletonLines(from, to)} * 1.5rem + 1.5rem)` }}
              className="w-full motion-safe:animate-pulse rounded-xl bg-muted/60"
            />
          }
        >
          <ToolCallDiffSurface
            from={from}
            to={to}
            name={name}
            {...(language !== undefined && { language })}
            options={options}
          />
        </React.Suspense>
      </LazyHighlighterBoundary>
    </div>
  )
}

export interface ToolCallFileProps
  extends Omit<React.ComponentProps<"button">, "name"> {
  /** The file's path, rendered monospace as the chip's text. */
  name: string
  /** Leading glyph; defaults to a document icon. */
  icon?: React.ReactNode
  /** Muted trailing detail, e.g. "142 lines" or "+27 -10". */
  meta?: React.ReactNode
}

/**
 * A file the call touched, as a compact chip. Passing `onClick` renders it as
 * a button — the host wires whatever opening or revealing action it wants —
 * while without `onClick` it is a plain, non-interactive reference.
 */
function ToolCallFile({
  name,
  icon,
  meta,
  className,
  onClick,
  ...props
}: ToolCallFileProps) {
  const interactive = onClick != null
  const chipClassName = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 nessa-text-2 text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
    interactive &&
      "cursor-pointer transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:border-ring/40 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
    className,
  )
  const content = (
    <>
      <span aria-hidden="true" className="flex shrink-0 items-center">
        {icon ?? <FileText />}
      </span>
      <span className="min-w-0 truncate font-mono">{name}</span>
      {meta != null && (
        <span className="shrink-0 text-muted-foreground">{meta}</span>
      )}
    </>
  )
  if (interactive) {
    return (
      <button
        type="button"
        data-slot="tool-call-file"
        onClick={onClick}
        className={cn(chipClassName, "outline-none")}
        {...props}
      >
        {content}
      </button>
    )
  }
  return (
    <span
      data-slot="tool-call-file"
      className={chipClassName}
      {...(props as React.ComponentProps<"span">)}
    >
      {content}
    </span>
  )
}

export {
  ToolCall,
  ToolCallContent,
  ToolCallDiff,
  ToolCallFile,
  ToolCallTabs,
  ToolCallTrigger,
}
