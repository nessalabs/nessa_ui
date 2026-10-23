"use client";

import * as React from "react";
import { ChevronRight, Layers, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { ToolCallDiff } from "./tool-call";

/** @responsibility Draws a run of an agent's tool calls as one line that opens into a waterfall: each call on a shared time axis, the earlier ones folded, one call's input, output, and diff at a time. */

/**
 * Where one tool call is. `pending` and `running` are live; `completed`,
 * `failed`, and `stopped` are settled. A call the turn ended under before it
 * settled is `stopped` — the host knows that, the trace does not guess it.
 */
export type ToolTraceStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

/** The run as a whole: still working, finished, or ended by a failure. */
export type ToolTraceStatus = "running" | "complete" | "error";

export interface ToolTraceDiff {
  /** The file's path, shown in the diff's header and used to pick a language. */
  filename: string;
  /** The file before the call. Empty for a file the call created. */
  from: string;
  /** The file after the call. */
  to: string;
  language?: string;
}

export interface ToolTraceStep {
  /** Stable across updates: it keeps a call's open card open as it changes. */
  id: string;
  /** What the call did, in a word or two: "Read", "Ran", "Edited". */
  label: string;
  /** What it did it to: a path, a command, a pattern. Drawn in mono, truncated. */
  detail?: string;
  /** The call's own glyph, at 14px. Running, failed, and stopped calls draw their state instead. */
  icon?: React.ReactNode;
  status: ToolTraceStepStatus;
  /**
   * Draws the call's bar stronger. For the calls that change things or take
   * time — commands and edits — so they stand out among quick reads.
   */
  strong?: boolean;
  /** When the call started, in Unix milliseconds. Without it the call has no bar. */
  startedAtMs?: number;
  /** When it settled, in Unix milliseconds. A running call's bar grows to now. */
  endedAtMs?: number;
  /** Lines the call added, for an edit. */
  added?: number;
  /** Lines the call removed, for an edit. */
  removed?: number;
  /** What the call changed. Gives its card a Diff tab, first and chosen once it settles. */
  diff?: ToolTraceDiff;
  /**
   * What the call was given. A JSON object's text is drawn as one row per
   * argument; any other text is drawn as it is.
   */
  input?: string;
  /** What the call gave back, as text. */
  output?: string;
}

export interface ToolTraceProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  steps: readonly ToolTraceStep[];
  /**
   * The run's state, exposed as `data-status`. While `running` the line reads
   * "Working", shimmers, and the trace keeps time; `error` tints the summary
   * destructive. Defaults to `complete`.
   */
  status?: ToolTraceStatus;
  /** Controlled open state; pair with `onOpenChange`. */
  open?: boolean;
  /** Initial open state when uncontrolled. Closed by default. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The line's text once the run settled. Defaults to "Ran N tools". */
  summary?: React.ReactNode;
  /**
   * How many settled calls stay in view before the earlier ones fold into one
   * row. Running calls always show. Defaults to 4, or 3 while running.
   */
  keep?: number;
  /**
   * The time to draw against, in Unix milliseconds. Pass it to freeze the
   * trace — in a test, a story, or a host that owns the clock. Without it, a
   * running trace reads the clock about four times a second, and a settled
   * one does not read it at all.
   */
  now?: number;
}

const live = (step: ToolTraceStep) =>
  step.status === "running" || step.status === "pending";

/** "0.4s", "12s", "3m 05s". */
function formatDuration(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, "0")}s`;
}

/** "0:00", "12:07": a point on the axis, from the run's start. */
function formatOffset(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Where a call's bar runs, or nothing for a call with no start. A call with
 * no end yet runs to `now` while live and stops where it started otherwise.
 * Wall-clock times can step backwards; an end before the start is the start.
 */
function spanOf(step: ToolTraceStep, now: number) {
  if (step.startedAtMs === undefined) return null;
  const start = step.startedAtMs;
  const end = step.endedAtMs ?? (live(step) ? now : start);
  return { start, end: Math.max(start, end) };
}

function useClock(running: boolean, fixed: number | undefined) {
  const [now, setNow] = React.useState(() => fixed ?? Date.now());
  React.useEffect(() => {
    if (fixed !== undefined || !running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [fixed, running]);
  return fixed ?? now;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return value.trim().endsWith("ms") ? parsed : parsed * 1000;
}

const shimmerClasses =
  "data-[shimmer=true]:[background-image:linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_38%,var(--foreground)_50%,var(--muted-foreground)_62%,var(--muted-foreground)_100%)] data-[shimmer=true]:bg-[length:200%_100%] data-[shimmer=true]:bg-[position:150%_0] data-[shimmer=true]:bg-clip-text data-[shimmer=true]:[-webkit-background-clip:text] data-[shimmer=true]:text-transparent";

/** Text with a highlight sweeping across it while `active`; plain under reduced motion. */
function Shimmer({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const shimmering = active && !reducedMotion;
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || !shimmering) return;
    const duration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue(
        "--nessa-motion-duration-ambient",
      ),
      3200,
    );
    if (duration === 0) return;
    const animation = node.animate(
      [{ backgroundPosition: "150% 0" }, { backgroundPosition: "-50% 0" }],
      { duration, easing: "linear", iterations: Infinity },
    );
    return () => animation.cancel();
  }, [shimmering]);
  return (
    <span
      ref={ref}
      data-shimmer={shimmering ? "true" : undefined}
      className={cn(shimmerClasses, className)}
    >
      {children}
    </span>
  );
}

/** A call still working: a small ring with an accent head. Still under reduced motion. */
function Working() {
  return (
    <span
      aria-hidden="true"
      className="size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-muted-foreground/30 border-t-(--nessa-chat-accent-ink) [animation-duration:800ms] motion-reduce:animate-none"
    />
  );
}

const barTone = (step: ToolTraceStep) =>
  step.status === "failed"
    ? "bg-destructive"
    : live(step)
      ? "bg-(--nessa-chat-accent)"
      : step.status === "stopped"
        ? "bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--muted-foreground)_45%,transparent)_0_2px,transparent_2px_4px)]"
        : step.strong
          ? "bg-muted-foreground/70"
          : "bg-muted-foreground/35";

/**
 * The whole run in 64px: one sliver per call, as wide as it took. A call
 * shorter than half a percent of the run still gets a sliver.
 */
function MiniBar({
  steps,
  now,
}: {
  steps: readonly ToolTraceStep[];
  now: number;
}) {
  const spans = steps.map((step) => spanOf(step, now));
  const starts = spans.flatMap((span) => (span ? [span.start] : []));
  const ends = spans.flatMap((span) => (span ? [span.end] : []));
  if (starts.length === 0) return null;
  const total = Math.max(1, Math.max(...ends) - Math.min(...starts));
  return (
    <span
      aria-hidden="true"
      data-slot="tool-trace-mini-bar"
      className="flex h-[5px] w-16 shrink-0 items-stretch gap-px overflow-hidden"
    >
      {steps.map((step, index) => {
        const span = spans[index];
        const length = span ? span.end - span.start : 0;
        return (
          <span
            key={step.id}
            className={cn("min-w-px rounded-[1px]", barTone(step))}
            style={{ flexGrow: Math.max(length, total / 200), flexBasis: 0 }}
          />
        );
      })}
    </span>
  );
}

/** A JSON object as one row per argument; anything else as it was given. */
function Input({ text }: { text: string }) {
  const entries = React.useMemo(() => {
    try {
      const value: unknown = JSON.parse(text);
      if (value === null || typeof value !== "object" || Array.isArray(value))
        return null;
      return Object.entries(value as Record<string, unknown>);
    } catch {
      return null;
    }
  }, [text]);
  if (!entries) return <pre className={paneTextClassName}>{text}</pre>;
  if (entries.length === 0)
    return <p className="nessa-text-2 text-muted-foreground">No arguments</p>;
  return (
    <dl className="grid grid-cols-[minmax(4.5rem,max-content)_minmax(0,1fr)] gap-x-2.5 gap-y-1 font-mono nessa-text-2">
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-foreground/85">
            {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

const paneTextClassName =
  "m-0 whitespace-pre-wrap [overflow-wrap:anywhere] font-mono nessa-text-2 text-muted-foreground";

type Pane = "diff" | "input" | "output";

/** The panes a call has, Diff first. */
function panesOf(step: ToolTraceStep): Pane[] {
  return [
    ...(step.diff ? (["diff"] as const) : []),
    ...(step.input !== undefined ? (["input"] as const) : []),
    ...(step.output !== undefined || live(step) ? (["output"] as const) : []),
  ];
}

/**
 * One call's details, continuing its row as one card. Every pane has the same
 * height; longer content scrolls inside it, so moving between tabs or calls
 * never moves the transcript.
 */
function StepDetails({
  step,
  now,
  pane,
  onPaneChange,
}: {
  step: ToolTraceStep;
  now: number;
  pane: Pane | undefined;
  onPaneChange: (pane: Pane) => void;
}) {
  const panes = panesOf(step);
  const chosen =
    pane && panes.includes(pane)
      ? pane
      : step.diff && !live(step)
        ? "diff"
        : panes.includes("output") && step.output
          ? "output"
          : panes[0];
  const span = spanOf(step, now);
  const lines = step.output ? step.output.split("\n").length : 0;
  const facts = live(step)
    ? span
      ? `running · ${formatDuration(span.end - span.start)}`
      : "running"
    : [
        step.status === "failed"
          ? "failed"
          : step.status === "stopped"
            ? "stopped"
            : undefined,
        span ? formatDuration(span.end - span.start) : undefined,
        chosen === "output" && lines
          ? `${lines} line${lines === 1 ? "" : "s"}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · ");
  const tabLabel: Record<Pane, string> = {
    diff: "Diff",
    input: "Input",
    output: "Output",
  };
  return (
    <div
      data-slot="tool-trace-details"
      className="flex min-w-0 flex-col gap-2.5 border-t border-border px-2.5 pt-2 pb-2.5"
    >
      <Tabs
        value={chosen}
        onValueChange={(value) => onPaneChange(value as Pane)}
        className="gap-2.5"
      >
        <TabsList
          variant="pill"
          aria-label={`${step.label} details`}
          className="w-fit [&>[data-slot=tabs-trigger]]:min-h-6 [&>[data-slot=tabs-trigger]]:px-2 [&>[data-slot=tabs-trigger]]:nessa-text-2"
        >
          {panes.map((name) => (
            <TabsTrigger key={name} value={name}>
              {tabLabel[name]}
            </TabsTrigger>
          ))}
        </TabsList>
        {panes.map((name) => (
          <TabsContent
            key={name}
            value={name}
            data-slot="tool-trace-pane"
            className="h-38 flex-none overflow-auto overscroll-contain [scrollbar-width:thin] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:[animation-duration:var(--nessa-motion-duration-fast)]"
          >
            {name === "diff" && step.diff ? (
              <ToolCallDiff
                from={step.diff.from}
                to={step.diff.to}
                filename={step.diff.filename}
                language={step.diff.language}
              />
            ) : name === "input" ? (
              <Input text={step.input ?? ""} />
            ) : step.output ? (
              <pre
                className={cn(
                  paneTextClassName,
                  step.status === "failed" && "text-destructive",
                )}
              >
                {step.output}
              </pre>
            ) : (
              <p className="nessa-text-2 text-muted-foreground">
                {live(step) ? "Nothing yet" : "No output"}
              </p>
            )}
          </TabsContent>
        ))}
      </Tabs>
      {facts ? (
        <p className="m-0 flex flex-wrap items-center gap-2 font-mono nessa-text-1 text-muted-foreground tabular-nums">
          {chosen === "diff" &&
          (step.added !== undefined || step.removed !== undefined) ? (
            <Delta added={step.added} removed={step.removed} />
          ) : null}
          <span>{facts}</span>
        </p>
      ) : null}
    </div>
  );
}

function Delta({ added, removed }: { added?: number; removed?: number }) {
  return (
    <span className="inline-flex gap-1 font-mono nessa-text-1 font-medium tabular-nums whitespace-nowrap">
      {added !== undefined ? (
        <ins className="text-(--nessa-diff-addition) no-underline">
          +{added}
        </ins>
      ) : null}
      {removed ? (
        <del className="text-(--nessa-diff-deletion) no-underline">
          −{removed}
        </del>
      ) : null}
    </span>
  );
}

const rowClassName =
  "grid w-full min-h-7 cursor-pointer items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-1.5 text-start font-sans nessa-text-2 text-muted-foreground outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:bg-foreground/(--nessa-state-hover) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none disabled:cursor-default disabled:hover:bg-transparent";

/** The columns every row and the axis share: glyph, what, bar, time. */
const columns = (timed: boolean) =>
  timed
    ? "[grid-template-columns:14px_minmax(0,1fr)_minmax(80px,32%)_58px]"
    : "[grid-template-columns:14px_minmax(0,1fr)_auto]";

function StepRow({
  step,
  now,
  domain,
  timed,
  open,
  detailsId,
  onToggle,
}: {
  step: ToolTraceStep;
  now: number;
  domain: { start: number; end: number };
  timed: boolean;
  open: boolean;
  detailsId: string;
  onToggle: () => void;
}) {
  const span = spanOf(step, now);
  const width = Math.max(1, domain.end - domain.start);
  const left = span ? Math.max(span.start, domain.start) : 0;
  const glyph =
    step.status === "failed" ? (
      <X className="size-3.5 text-destructive" />
    ) : step.status === "stopped" ? (
      <Minus className="size-3.5" />
    ) : live(step) ? (
      <Working />
    ) : (
      step.icon
    );
  const meta =
    step.status === "stopped" ? (
      <span className="rounded-[5px] bg-muted px-1.5 py-0.5 font-mono nessa-text-1 text-muted-foreground">
        stopped
      </span>
    ) : span && (timed || live(step)) ? (
      <span className="font-mono nessa-text-1 text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDuration(span.end - span.start)}
      </span>
    ) : step.added !== undefined || step.removed !== undefined ? (
      <Delta added={step.added} removed={step.removed} />
    ) : null;
  const disclosable = panesOf(step).length > 0;
  return (
    <button
      type="button"
      data-slot="tool-trace-step"
      data-status={step.status}
      aria-expanded={disclosable ? open : undefined}
      aria-controls={disclosable && open ? detailsId : undefined}
      disabled={!disclosable}
      onClick={onToggle}
      className={cn(
        rowClassName,
        columns(timed),
        live(step) && "text-foreground",
        step.status === "failed" && "text-destructive",
        open && "rounded-none hover:bg-foreground/(--nessa-state-hover)",
      )}
    >
      <span
        aria-hidden="true"
        className="flex items-center justify-center text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5"
      >
        {glyph}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <Shimmer active={live(step)} className="shrink-0 whitespace-nowrap">
          {step.label}
        </Shimmer>
        {step.detail ? (
          <span
            className={cn(
              "min-w-0 truncate font-mono nessa-text-1",
              step.status === "failed"
                ? "text-destructive"
                : "text-muted-foreground",
              step.status === "stopped" && "line-through",
            )}
          >
            {step.detail}
          </span>
        ) : null}
      </span>
      {timed ? (
        <span
          aria-hidden="true"
          className="relative h-3.5 border-s border-border [background-image:repeating-linear-gradient(90deg,transparent_0_calc(25%-1px),color-mix(in_oklab,var(--border)_55%,transparent)_calc(25%-1px)_25%)]"
        >
          {span ? (
            <span
              data-slot="tool-trace-bar"
              className={cn(
                "absolute top-1 h-1.5 min-w-[3px] rounded-[3px]",
                barTone(step),
              )}
              style={{
                left: `${((left - domain.start) / width) * 100}%`,
                width: `${(Math.max(0, span.end - left) / width) * 100}%`,
              }}
            />
          ) : null}
        </span>
      ) : null}
      <span className="flex items-center justify-end gap-1.5">{meta}</span>
    </button>
  );
}

/**
 * A run of an agent's tool calls as one quiet line — a tools glyph, "Ran 6
 * tools", a small bar of the whole run, and how long it took — that opens
 * into a waterfall. Each call is a row on a time axis shared with the others;
 * the earlier calls fold into one row once there are more than a few, and
 * the axis then spans only what is shown, so a twelve-minute turn still
 * reads. Clicking a call opens its card in place: Diff for an edit, then
 * Input and Output, at a fixed height. One card is open at a time.
 *
 * While `running` the line reads "Working" and the trace keeps time. Calls
 * without times (saved before the host kept them) are listed without bars,
 * and a run with no times at all drops the time column.
 */
function ToolTrace({
  steps,
  status = "complete",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  summary,
  keep,
  now: nowProp,
  className,
  ...props
}: ToolTraceProps) {
  const running = status === "running";
  const now = useClock(running, nowProp);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [card, setCard] = React.useState<string | null>(null);
  const [panes, setPanes] = React.useState<ReadonlyMap<string, Pane>>(
    () => new Map(),
  );
  const [showEarlier, setShowEarlier] = React.useState(false);
  const bodyId = React.useId();
  const detailsId = React.useId();

  // Running calls always show; the settled ones before the last `keep` fold,
  // unless that would hide only one.
  const kept = keep ?? (running ? 3 : 4);
  const settled = steps.filter((step) => !live(step));
  let folded = settled.slice(0, Math.max(0, settled.length - kept));
  if (folded.length < 2) folded = [];
  const foldedIds = new Set(folded.map((step) => step.id));
  const shown = showEarlier
    ? steps
    : steps.filter((step) => !foldedIds.has(step.id));

  const spans = steps.map((step) => spanOf(step, now));
  const timed = spans.some(Boolean);
  const runStart = Math.min(
    ...spans.flatMap((span) => (span ? [span.start] : [])),
  );
  const runEnd = running
    ? now
    : Math.max(...spans.flatMap((span) => (span ? [span.end] : [])));
  const shownSpans = shown.flatMap((step) => {
    const span = spanOf(step, now);
    return span ? [span] : [];
  });
  const domain = shownSpans.length
    ? {
        start: Math.min(...shownSpans.map((span) => span.start)),
        end: running
          ? Math.max(
              now,
              Math.min(...shownSpans.map((span) => span.start)) + 1000,
            )
          : Math.max(...shownSpans.map((span) => span.end)),
      }
    : { start: 0, end: 1 };
  const foldedSpans = folded.flatMap((step) => {
    const span = spanOf(step, now);
    return span ? [span] : [];
  });

  const failed = steps.filter((step) => step.status === "failed").length;
  const line = running
    ? "Working"
    : (summary ?? `Ran ${steps.length} tool${steps.length === 1 ? "" : "s"}`);
  const trailing =
    !running && failed ? (
      <span className="whitespace-nowrap text-destructive">
        {failed} failed
      </span>
    ) : timed ? (
      <span className="font-mono nessa-text-1 tabular-nums whitespace-nowrap text-muted-foreground">
        {formatDuration(runEnd - runStart)}
      </span>
    ) : null;

  return (
    <div
      data-slot="tool-trace"
      data-status={status}
      data-open={open ? "true" : "false"}
      aria-busy={running || undefined}
      className={cn(
        "flex w-full min-w-0 flex-col gap-1.5 font-sans",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        data-slot="tool-trace-line"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className="group/tool-trace-line -ms-2 flex w-fit max-w-full min-w-0 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border-0 bg-transparent px-2 py-0.5 font-sans nessa-text-2 text-muted-foreground outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:bg-foreground/(--nessa-state-hover) hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <Layers
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0",
            running
              ? "text-(--nessa-chat-accent-ink)"
              : "text-muted-foreground",
          )}
        />
        <Shimmer
          active={running}
          className={cn(
            "font-medium whitespace-nowrap",
            status === "error" && "text-destructive",
          )}
        >
          {line}
        </Shimmer>
        <MiniBar steps={steps} now={now} />
        {trailing}
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] group-aria-expanded/tool-trace-line:rotate-90 motion-reduce:transition-none"
        />
      </button>
      <div
        data-slot="tool-trace-body"
        className="grid grid-rows-[0fr] transition-[grid-template-rows] [transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)] data-[open=true]:grid-rows-[1fr] motion-reduce:transition-none"
        data-open={open ? "true" : "false"}
      >
        {/* Kept mounted while closed so it can fold away; inert, so nothing
            in it takes focus or is read out until it opens. */}
        <div
          id={bodyId}
          inert={!open}
          className="-mx-1.5 min-h-0 overflow-hidden px-1.5"
        >
          <div className="flex flex-col gap-px">
            {folded.length ? (
              <button
                type="button"
                data-slot="tool-trace-earlier"
                aria-expanded={showEarlier}
                onClick={() => setShowEarlier((value) => !value)}
                className={cn(rowClassName, "flex hover:text-foreground")}
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "size-3 shrink-0 transition-transform [transition-duration:var(--nessa-motion-duration-fast)] motion-reduce:transition-none",
                    showEarlier && "rotate-90",
                  )}
                />
                <span>
                  {showEarlier
                    ? `Hide ${folded.length} earlier`
                    : `${folded.length} earlier`}
                </span>
                {foldedSpans.length ? (
                  <span className="ms-auto font-mono nessa-text-1 tabular-nums">
                    {formatOffset(
                      Math.min(...foldedSpans.map((span) => span.start)) -
                        runStart,
                    )}
                    –
                    {formatOffset(
                      Math.max(...foldedSpans.map((span) => span.end)) -
                        runStart,
                    )}
                  </span>
                ) : null}
              </button>
            ) : null}
            {shown.map((step) => {
              const isOpen = card === step.id;
              // The row keeps one parent whether or not its card is open, so
              // opening it does not remount the row and drop its focus.
              return (
                <div
                  key={step.id}
                  id={isOpen ? detailsId : undefined}
                  data-slot={isOpen ? "tool-trace-card" : undefined}
                  className={cn(
                    isOpen &&
                      "my-px overflow-hidden rounded-lg bg-card shadow-[inset_0_0_0_1px_var(--border)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:[animation-duration:var(--nessa-motion-duration-normal)]",
                  )}
                >
                  <StepRow
                    step={step}
                    now={now}
                    domain={domain}
                    timed={timed}
                    open={isOpen}
                    detailsId={detailsId}
                    // One card at a time: opening one closes the last.
                    onToggle={() => setCard(isOpen ? null : step.id)}
                  />
                  {isOpen ? (
                    <StepDetails
                      step={step}
                      now={now}
                      pane={panes.get(step.id)}
                      onPaneChange={(pane) =>
                        setPanes((current) =>
                          new Map(current).set(step.id, pane),
                        )
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          {timed && shownSpans.length ? (
            <div
              aria-hidden="true"
              data-slot="tool-trace-axis"
              className={cn(
                "grid gap-2.5 px-1.5 pt-0.5 font-mono nessa-text-1 text-muted-foreground tabular-nums",
                columns(true),
              )}
            >
              <span />
              <span />
              <span className="flex justify-between">
                <span>{formatOffset(domain.start - runStart)}</span>
                <span>
                  {formatOffset((domain.start + domain.end) / 2 - runStart)}
                </span>
                <span>{formatOffset(domain.end - runStart)}</span>
              </span>
              <span />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { ToolTrace, formatDuration as formatToolTraceDuration };
