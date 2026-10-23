"use client";

import * as React from "react";
import { ChevronRight, Layers, Minus, X } from "lucide-react";

import { shimmerClasses, useShimmer } from "@/lib/shimmer";
import { cn } from "@/lib/utils";

import { DiffStat } from "./file-diff-list";
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
  /** The file's path; picks the diff's language. The call's row names the file, so the diff shows no header. */
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

/** A live call in words: a queued call is waiting, not yet running. */
const liveWord = (step: ToolTraceStep) =>
  step.status === "pending" ? "waiting" : "running";

/** "0.4s", "12s", "3m 05s". */
function formatDuration(ms: number) {
  // Round first, then choose the form, so 9.96s reads "10s", not "10.0s",
  // and 59.6s reads "1m 00s", not "60s".
  const tenths = Math.round(Math.max(0, ms) / 100) / 10;
  if (tenths < 10) return `${tenths.toFixed(1)}s`;
  const whole = Math.round(Math.max(0, ms) / 1000);
  if (whole < 60) return `${whole}s`;
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

/**
 * The time a trace draws against. A host's `fixed` time wins. Otherwise a
 * running trace reads the clock about four times a second once it has
 * mounted; before that, and on the server, it draws against the latest time
 * its own calls name, which the server and the first client render agree on.
 */
function useClock(running: boolean, fixed: number | undefined, latest: number) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (fixed !== undefined || !running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [fixed, running]);
  return fixed ?? (running && now !== null ? Math.max(now, latest) : latest);
}

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
  const { ref, shimmering } = useShimmer<HTMLSpanElement>(active);
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
function Working({ paused = false }: { paused?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-muted-foreground/30 border-t-(--nessa-chat-accent-ink) [animation-duration:var(--nessa-motion-duration-ambient)] motion-reduce:animate-none",
        // Nothing turns where nobody can see it.
        paused && "animate-none",
      )}
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
 * The whole run in 64px: each call a sliver where it fell on the run's time,
 * as wide as it took, at least a pixel. Positioned rather than laid side by
 * side, so a run of hundreds of calls still spans the whole bar.
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
  const start = Math.min(...starts);
  const total = Math.max(1, Math.max(...ends) - start);
  return (
    <span
      aria-hidden="true"
      data-slot="tool-trace-mini-bar"
      className="relative h-[5px] w-16 shrink-0 overflow-hidden"
    >
      {steps.map((step, index) => {
        const span = spans[index];
        if (!span) return null;
        return (
          <span
            key={step.id}
            className={cn(
              "absolute inset-y-0 min-w-px rounded-full",
              barTone(step),
            )}
            style={{
              left: `${((span.start - start) / total) * 100}%`,
              width: `${((span.end - span.start) / total) * 100}%`,
            }}
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
    // Every call can say what it gave back, if only that it gave nothing.
    "output",
  ];
}

/**
 * One call's details, continuing its row as one card. Every pane has the same
 * height; longer content scrolls inside it, so moving between tabs or calls
 * never moves the transcript.
 */
function StepDetails({
  id,
  step,
  now,
  pane,
  onPaneChange,
}: {
  id: string;
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
        : step.output || live(step) || step.input === undefined
          ? "output"
          : "input";
  const span = spanOf(step, now);
  // A trailing newline ends the last line; it does not start another.
  const lines = step.output
    ? step.output.replace(/\n$/, "").split("\n").length
    : 0;
  const facts = live(step)
    ? span
      ? `${liveWord(step)} · ${formatDuration(span.end - span.start)}`
      : liveWord(step)
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
      id={id}
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
              // No file header: the call's own row names the file just
              // above, and in a pane this short the header would only take
              // a line from the edit.
              <ToolCallDiff
                from={step.diff.from}
                to={step.diff.to}
                filename={step.diff.filename}
                fileHeader={false}
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
            <DiffStat
              additions={step.added ?? 0}
              deletions={step.removed ?? 0}
              className="nessa-text-1"
            />
          ) : null}
          <span>{facts}</span>
        </p>
      ) : null}
    </div>
  );
}

const rowClassName =
  "grid w-full min-h-7 cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-1.5 text-start font-sans nessa-text-2 text-muted-foreground outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] hover:bg-foreground/(--nessa-state-hover) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

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
  shown,
  detailsId,
  onToggle,
}: {
  step: ToolTraceStep;
  now: number;
  domain: { start: number; end: number };
  timed: boolean;
  open: boolean;
  /** The trace is open, so the row is on screen; a folded trace's rows keep still. */
  shown: boolean;
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
      <Working paused={!shown} />
    ) : (
      step.icon
    );
  const meta =
    step.status === "stopped" ? (
      <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono nessa-text-1 text-muted-foreground">
        stopped
      </span>
    ) : span && (timed || live(step)) ? (
      <span className="font-mono nessa-text-1 text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDuration(span.end - span.start)}
      </span>
    ) : step.added !== undefined || step.removed !== undefined ? (
      <DiffStat
        additions={step.added ?? 0}
        deletions={step.removed ?? 0}
        className="nessa-text-1"
      />
    ) : null;
  return (
    <button
      type="button"
      data-slot="tool-trace-step"
      data-step-id={step.id}
      data-status={step.status}
      aria-expanded={open}
      aria-controls={open ? detailsId : undefined}
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
        <Shimmer
          active={live(step) && shown}
          className="shrink-0 whitespace-nowrap"
        >
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
        {step.status === "failed" || live(step) ? (
          // The glyph and colour say this to the eye; say it to the ear.
          <span className="sr-only">
            {step.status === "failed" ? ", failed" : `, ${liveWord(step)}`}
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
                "absolute top-1 h-1.5 min-w-[3px] rounded-full",
                barTone(step),
              )}
              style={{
                left: `${((left - domain.start) / width) * 100}%`,
                width: `${(Math.max(0, Math.min(span.end, domain.end) - left) / width) * 100}%`,
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
  const latest = Math.max(
    0,
    ...steps.flatMap((step) => [step.startedAtMs ?? 0, step.endedAtMs ?? 0]),
  );
  const now = useClock(running, nowProp, latest);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [chosenCard, setCard] = React.useState<string | null>(null);
  // A card stays open only while its call is still in the run: a host that
  // reuses the trace for another run does not find a card already open.
  const card = steps.some((step) => step.id === chosenCard) ? chosenCard : null;
  // The tab chosen in the open card; another card opens on its own default.
  const [chosenPane, setPane] = React.useState<{
    id: string;
    pane: Pane;
  } | null>(null);
  const [showEarlierChosen, setShowEarlier] = React.useState(false);
  // The row a keyboard is on. Like the open card, it never folds away under
  // the person: a run that keeps settling calls would otherwise unmount it
  // and drop focus to the page.
  const [focused, setFocused] = React.useState<string | null>(null);
  const bodyId = React.useId();
  const detailsId = React.useId();

  // Running calls always show. Settled calls past the last `keep` fold, from
  // the start of the run up to the first live call, so the fold row only ever
  // sits above calls that came after it. Folding a single call would hide
  // nothing worth a row. While the earlier calls are hidden, the fold also
  // stops short of a row someone holds — its open card, or keyboard focus —
  // so a call settling never folds that row away. While they are shown the
  // fold ignores what is held: opening or leaving a row never changes it.
  const kept = keep ?? (running ? 3 : 4);
  const foldable = steps.filter((step) => !live(step)).length - kept;
  let folded: ToolTraceStep[] = [];
  for (const step of steps) {
    if (folded.length >= foldable || live(step)) break;
    if (!showEarlierChosen && (step.id === card || step.id === focused)) break;
    folded.push(step);
  }
  if (folded.length < 2) folded = [];
  const foldedIds = new Set(folded.map((step) => step.id));
  // With nothing folded there is nothing to show; the next fold starts closed.
  const showEarlier = showEarlierChosen && folded.length > 0;
  if (showEarlierChosen && folded.length === 0) setShowEarlier(false);
  const shown = showEarlier
    ? steps
    : steps.filter((step) => !foldedIds.has(step.id));

  const spans = steps.map((step) => spanOf(step, now));
  const timed = spans.some(Boolean);
  const runStart = Math.min(
    ...spans.flatMap((span) => (span ? [span.start] : [])),
  );
  // Wall-clock times from another machine can run ahead of this one's: an end
  // past `now` widens the run rather than spilling out of it.
  const runEnd = Math.max(
    running ? now : 0,
    ...spans.flatMap((span) => (span ? [span.end] : [])),
  );
  const shownSpans = shown.flatMap((step) => {
    const span = spanOf(step, now);
    return span ? [span] : [];
  });
  const domain = shownSpans.length
    ? {
        start: Math.min(...shownSpans.map((span) => span.start)),
        end: Math.max(
          running ? now : 0,
          running
            ? Math.min(...shownSpans.map((span) => span.start)) + 1000
            : 0,
          ...shownSpans.map((span) => span.end),
        ),
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
          <div
            className="flex flex-col gap-px"
            onFocus={(event) =>
              setFocused(
                event.target.closest<HTMLElement>("[data-step-id]")?.dataset
                  .stepId ?? null,
              )
            }
            onBlur={(event) => {
              // A window going to the background keeps its focused row: the
              // person comes back to it. Only focus leaving the rows lets go.
              if (!event.currentTarget.ownerDocument.hasFocus()) return;
              if (event.currentTarget.contains(event.relatedTarget)) return;
              setFocused(null);
            }}
          >
            {folded.length ? (
              <button
                type="button"
                data-slot="tool-trace-earlier"
                aria-expanded={showEarlier}
                onClick={() => {
                  // Hiding the earlier calls closes a card among them, so the
                  // fold is the same with or without one open.
                  if (showEarlier && card !== null && foldedIds.has(card))
                    setCard(null);
                  setShowEarlier(!showEarlier);
                }}
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
                    shown={open}
                    detailsId={detailsId}
                    // One card at a time: opening one closes the last.
                    onToggle={() => setCard(isOpen ? null : step.id)}
                  />
                  {isOpen ? (
                    <StepDetails
                      id={detailsId}
                      step={step}
                      now={now}
                      pane={
                        chosenPane?.id === step.id ? chosenPane.pane : undefined
                      }
                      onPaneChange={(pane) => setPane({ id: step.id, pane })}
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
