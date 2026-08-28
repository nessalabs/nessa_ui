import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Badge,
  Button,
  ClaudeStreamMapper,
  claude,
  mapClaudeStream,
  JsonTree,
  Message,
  MessageAvatar,
  MessageBubble,
  MessageContent,
  MessageHeader,
  MessageMarkdown,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport,
  MermaidDiagram,
  RandomAvatar,
  SegmentedControl,
  SegmentedControlOption,
  TaskList,
  TaskListItem,
  ToolCall,
  ToolCallContent,
  ToolCallTabs,
  ToolCallTrigger,
  applyDeltas,
  TranscriptBuilder,
  isToolGroup,
  previewOf,
  type AgentEvent,
  type DelegatedRun,
  type PlanStep,
  type DeltaBuffers,
  type ToolKind,
  type WorkflowAgentProgress,
  type Transcript,
  type WorkItem,
} from "@nessa-ui/react"

import {
  BashIcon,
  EditIcon,
  GlobeIcon,
  SearchIcon,
  ThinkingIcon,
  TodoIcon,
} from "./icons/nucleo"
import { storyDocumentation } from "./story-documentation"

// Real `claude -p --output-format stream-json --include-partial-messages`
// captures, one per scenario, recorded from Sonnet against a throwaway
// directory. Everything below is parsed from these bytes — nothing in this file
// is authored transcript data.
import failing from "./fixtures/agent-stream/failing.jsonl?raw"
import printed from "./fixtures/agent-stream/printed.jsonl?raw"
import resumeOne from "./fixtures/agent-stream/resume_turn1.jsonl?raw"
import resumeTwo from "./fixtures/agent-stream/resume_turn2.jsonl?raw"
import subagent from "./fixtures/agent-stream/subagent.jsonl?raw"
import todos from "./fixtures/agent-stream/todos.jsonl?raw"
import tools from "./fixtures/agent-stream/tools.jsonl?raw"
import websearch from "./fixtures/agent-stream/websearch.jsonl?raw"
import workflow from "./fixtures/agent-stream/workflow.jsonl?raw"
import workflowPhases from "./fixtures/agent-stream/workflow_phases.jsonl?raw"
// The transcripts the *stream* refuses to carry, read back from the files
// Claude Code writes under ~/.claude/projects. Keyed by the ids the stream does
// give: a subagent by its `task_id`, a workflow agent by its `agentId`.
import diskSubagent from "./fixtures/agent-stream/disk_subagent_a37fefefbc61e13e3.jsonl?raw"
import diskWorkflowAgent from "./fixtures/agent-stream/disk_workflow_agent_a35ea63276cd501aa.jsonl?raw"

interface Capture {
  readonly id: string
  readonly label: string
  readonly blurb: string
  /**
   * What was actually typed. Carried here because `claude -p` never echoes the
   * prompt back onto the stream — a headless turn opens with `init`, so the
   * host is the only thing that knows what it asked for, and a transcript that
   * showed nothing would be missing the half the reader wrote.
   */
  readonly prompt: string
  readonly source: string
}

const CAPTURES: readonly Capture[] = [
  { id: "printed", label: "Plain text", blurb: "One streamed message and nothing else — the delta path with no tools in the way.", prompt: "Print exactly: hello world. Do not use any tools.", source: printed },
  { id: "tools", label: "Tools", blurb: "Write, read and a shell command: three calls, three results, one reasoning block.", prompt: "Create a file notes.txt containing three lines of text, then read it back, then run 'wc -l notes.txt'. Keep it brief.", source: tools },
  { id: "todos", label: "Plan", blurb: "The incremental plan tools — TaskCreate and TaskUpdate — folded into one checklist.", prompt: "Use your todo list to plan and then do these three steps: create a.txt with 'a', create b.txt with 'b', then run 'ls *.txt'. Track each step in your todos.", source: todos },
  { id: "subagent", label: "Subagent", blurb: "An Explore subagent, its own events filed under the call that spawned it.", prompt: "Use the Explore subagent to find out what files are in this directory, then tell me what it found in one line.", source: subagent },
  { id: "workflow", label: "Workflow", blurb: "Three parallel agents behind one Workflow call: no inner transcripts, but a full phase-and-agent board with state, cost and results.", prompt: "Use a workflow to run three agents in parallel, each printing a different greeting (hello, hola, bonjour), then summarize what they returned. Keep it tiny.", source: workflow },
  { id: "phases", label: "Multi-phase workflow", blurb: "Three phases, four agents. Every phase is declared up front, so the ones not reached yet render as pending rather than appearing late.", prompt: "Use a workflow with THREE phases: 'Greet' runs two agents in parallel (hello, hola); 'Translate' runs one (bonjour); 'Summarize' lists all three.", source: workflowPhases },
  { id: "failing", label: "Failed tool", blurb: "A command that exits non-zero, with the wire's error framing stripped off.", prompt: "Run the command 'cat /nonexistent/definitely-missing-file' and then tell me what happened in one sentence.", source: failing },
  { id: "websearch", label: "Web search", blurb: "Server-side tools, whose results arrive as structured blocks rather than text.", prompt: "Search the web for the current version of the TypeScript compiler and tell me in one line.", source: websearch },
  { id: "resume", label: "Resume + model swap", blurb: "Two processes, one session id: a second init, and a model change derived from it.", prompt: "Remember the number 47. Create marker.txt containing it. Then, resumed on Haiku: what number did I ask you to remember?", source: `${resumeOne}\n${resumeTwo}` },
]

const LINES = new Map(CAPTURES.map((capture) => [capture.id, capture.source.split("\n").filter((line) => line.trim().length > 0)]))

interface LiveState {
  readonly events: readonly AgentEvent[]
  /**
   * How many events each line produced.
   *
   * The counts are the point of the raw pane: the stream is deliberately not
   * one event per line — `message_start` is state for the mapper,
   * `message_stop` repeats what `result` already says, a steady-state rate
   * limit has nothing to act on — and a view that only showed totals would
   * leave "where did nine lines go" unanswerable.
   */
  readonly produced: readonly number[]
  readonly transcript: Transcript
  readonly previews: DeltaBuffers
}

/**
 * Feeds a capture the way a host feeds a live process.
 *
 * The mapper, the fold and the delta buffer are all *appended to* rather than
 * rebuilt: re-reading the whole log on every arriving line is a fold per event
 * over a log that grows per event, which is quadratic and is what makes a long
 * session crawl. Only a seek backwards — a replay, or a different capture —
 * rebuilds, because that is the one case where the accumulated state describes
 * something that is no longer true.
 */
function useLiveTranscript(captureId: string, count: number, live: boolean): LiveState {
  const state = React.useRef<{
    captureId: string
    count: number
    mapper: ClaudeStreamMapper
    builder: TranscriptBuilder
    buffers: Map<string, string>
    events: AgentEvent[]
    produced: number[]
  } | null>(null)

  const lines = LINES.get(captureId) ?? []
  let current = state.current
  if (current === null || current.captureId !== captureId || current.count > count) {
    current = {
      captureId,
      count: 0,
      mapper: new ClaudeStreamMapper(),
      builder: new TranscriptBuilder(),
      buffers: new Map(),
      events: [],
      produced: [],
    }
    state.current = current
  }

  for (let index = current.count; index < count; index += 1) {
    const mapped = current.mapper.push(lines[index]!)
    current.produced.push(mapped.length)
    current.events.push(...mapped)
    current.builder.push(mapped)
    applyDeltas(mapped, current.buffers)
  }
  current.count = count

  return {
    events: current.events,
    produced: current.produced,
    transcript: current.builder.snapshot({ live }),
    previews: current.buffers,
  }
}

/**
 * On-disk transcripts, by the id the stream reports.
 *
 * A host reaches these through the path contract in `store.ts`; the story ships
 * two of them as fixtures so the expanded views are real rather than mocked.
 */
const DISK_TRANSCRIPTS: Readonly<Record<string, string>> = {
  a37fefefbc61e13e3: diskSubagent,
  a35ea63276cd501aa: diskWorkflowAgent,
}

function diskTranscript(id: string | null): readonly AgentEvent[] | null {
  if (id === null) return null
  const source = DISK_TRANSCRIPTS[id]
  return source === undefined ? null : mapClaudeStream(source)
}

/**
 * How a row asks the panel to open a transcript.
 *
 * A delegated run's conversation is not a detail of the row that spawned it —
 * it is another chat stream, and it reads as one. So the row carries a pointer
 * and the panel does the reading, which is also what a real host does: the row
 * knows a path, the shell owns the surface.
 */
const OpenTranscript = React.createContext<(ref: claude.TranscriptRef) => void>(() => {})

const TOOL_ICONS: Partial<Record<ToolKind, React.ReactNode>> = {
  shell: <BashIcon />,
  file_edit: <EditIcon />,
  file_read: <EditIcon />,
  search: <SearchIcon />,
  web: <GlobeIcon />,
  plan: <TodoIcon />,
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function planStatus(step: PlanStep): "todo" | "active" | "done" {
  if (step.status === "completed") return "done"
  return step.status === "in_progress" ? "active" : "todo"
}

function ToolRow({ event, transcript }: { event: AgentEvent; transcript: Transcript }) {
  if (event.payload.type !== "tool_call_started") return null
  const call = event.payload
  const result = transcript.resultByCallId.get(call.callId)
  const abandoned = transcript.abandonedCallIds.has(call.callId)
  const run = transcript.runByCallId.get(call.callId)
  const status = result === undefined ? (abandoned ? "error" : "running") : result.isError ? "error" : "complete"

  const payload = (
    <ToolCall status={status}>
      <ToolCallTrigger icon={TOOL_ICONS[call.kind]}>{`${call.name} call`}</ToolCallTrigger>
      <ToolCallContent>
        <ToolCallTabs
          input={<pre className="overflow-x-auto text-xs">{pretty(call.input)}</pre>}
          output={
            result === undefined ? (
              <p className="text-muted-foreground text-xs">Still running.</p>
            ) : (
              <pre className="overflow-x-auto text-xs">{result.text.slice(0, 4000)}</pre>
            )
          }
        />
      </ToolCallContent>
    </ToolCall>
  )

  // A workflow's board is the point of the row, so it is the row.
  if (run !== undefined && run.kind === "workflow") return <RunCard run={run} call={payload} />

  // A subagent reads as one delegated actor: an avatar pill naming it and how
  // far along it is, opening onto its own work. Unlike a workflow its events
  // are readable, so the disclosure is the right gesture — it is the summary
  // that should be the row, not the tool call's arguments.
  if (run !== undefined && run.kind === "agent") {
    const steps = run.events.filter((event) => event.payload.type === "tool_call_started").length
    return (
      <ToolCall status={status}>
        <ToolCallTrigger
          icon={
            <RandomAvatar
              seed={runSeed(run)}
              name={run.label ?? "subagent"}
              busy={!run.done}
              className="size-5"
            />
          }
          meta={run.done ? `${steps} ${steps === 1 ? "step" : "steps"}` : (run.status ?? "working")}
        >
          {run.label ?? "Subagent"}
          {run.description === null ? null : <span className="text-muted-foreground">{` · ${run.description}`}</span>}
        </ToolCallTrigger>
        <ToolCallContent>
          <RunCard run={run} call={payload} report={result?.text} header={false} />
        </ToolCallContent>
      </ToolCall>
    )
  }

  return (
    <ToolCall status={status}>
      <ToolCallTrigger
        icon={TOOL_ICONS[call.kind]}
        meta={run === undefined ? undefined : run.done ? "delegated" : (run.status ?? "delegated")}
      >
        {`${claude.toolVerb(call.name, result === undefined && !abandoned)} ${call.title}`}
      </ToolCallTrigger>
      <ToolCallContent>
        <ToolCallTabs
          input={<pre className="overflow-x-auto text-xs">{pretty(call.input)}</pre>}
          output={
            result === undefined ? (
              <p className="text-muted-foreground text-xs">{abandoned ? "No result — the process ended first." : "Still running."}</p>
            ) : (
              <pre className="overflow-x-auto text-xs">{result.text.slice(0, 4000)}</pre>
            )
          }
        />
        {run === undefined ? null : <RunCard run={run} />}
      </ToolCallContent>
    </ToolCall>
  )
}

/**
 * A delegated run drawn as its own row.
 *
 * A workflow is a unit of work rather than an argument to a tool call, so it is
 * not filed inside the `Workflow` call's disclosure — burying a board of agents
 * one expand deep in a row labelled "Orchestrated Workflow" hides the only view
 * of them there is. The call's own payload stays reachable underneath.
 */
function RunCard({
  run,
  call,
  report,
  header = true,
}: {
  run: DelegatedRun
  call?: React.ReactNode
  /**
   * What the run handed back.
   *
   * It arrives as the *spawning call's* tool result, not among the run's own
   * events — a subagent never emits its final report to the stream as its own
   * message — so a card built only from `run.events` ends without a conclusion.
   */
  report?: string
  /** Off when the row's own trigger already names the run, so it is not said twice. */
  header?: boolean
}) {
  const calls = run.events.filter((event) => event.payload.type === "tool_call_started")
  const transcriptRef = useRunRef(run)
  const agentRefs = useAgentRefs(run)
  const rows = run.phases.reduce((count, phase) => count + phase.agents.length, 0) || calls.length
  const [open, setOpen] = React.useState(true)
  // Whether the reader has taken a position. Once they have, the run finishing
  // must not overrule them — an auto-collapse that reopens or re-closes what
  // someone just set is the worst version of this behaviour.
  const chosen = React.useRef(false)

  React.useEffect(() => {
    // A fan-out is worth watching while it runs and worth folding once it is
    // over: the answer is below it, and a finished board is a lot of rows to
    // scroll past. Small runs stay open — folding three rows saves nothing and
    // costs a click.
    if (!run.done || chosen.current || rows < AUTO_COLLAPSE_ROWS) return
    setOpen(false)
  }, [run.done, rows])

  const collapsed = header && !open
  const { anchorRef, capture } = useAnchoredToggle(open)

  return (
    <div className="border-border rounded-2xl border p-3" data-testid={`run-${run.kind}`}>
      {header ? (
        // A finished fan-out is a lot of rows to scroll past on the way to the
        // answer, so the card folds — open while it matters, foldable once it
        // does not.
        <button
          type="button"
          ref={anchorRef as React.Ref<HTMLButtonElement>}
          onClick={() => {
            chosen.current = true
            capture()
            setOpen((current) => !current)
          }}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          {/*
            A run gets a painted identity rather than an icon, seeded by the
            harness's own handle so it is stable across reloads and across a
            replay. A workflow seeds the group form with every agent's label,
            which paints the whole fan-out as one picture; `busy` carries the
            liveness the status text also states.
          */}
          <RandomAvatar
            seed={runSeed(run)}
            name={run.label ?? run.kind}
            busy={!run.done}
            className="size-6"
          />
          <Badge variant="secondary">{run.kind}</Badge>
          <span className="text-sm">{run.label ?? run.description ?? "Delegated run"}</span>
          <span className="text-muted-foreground ml-auto text-xs">
            {collapsed ? `${rows} ${rows === 1 ? "agent" : "agents"} · ` : ""}
            {run.done ? "done" : (run.status ?? "working")}
          </span>
          <span aria-hidden className="text-muted-foreground text-xs">
            {open ? "▾" : "▸"}
          </span>
        </button>
      ) : null}
      {collapsed ? null : (
      <>
      {run.phases.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {run.phases.map((phase) => (
            <div key={phase.index}>
              <p className="text-muted-foreground mb-1 text-xs uppercase">
                {`Phase ${phase.index} · ${phase.title}`}
                {phase.agents.length === 0
                  ? " · not started"
                  : ` · ${phase.agents.filter((agent) => agent.state === "done").length}/${phase.agents.length}`}
              </p>
              {/*
                Deliberately not a TaskList. Its rows carry the Checkbox's own
                stroke, which reads as "you can tick this" — true of a plan the
                reader owns, wrong for an agent whose state is reported to them
                and cannot be changed. These are status rows: the avatar carries
                identity and liveness, and the state is a word.
              */}
              <ul className="-mx-1 flex flex-col" aria-label={`${phase.title} agents`}>
                {phase.agents.map((agent) => (
                  <li key={agent.index}>
                    <AgentRow
                      label={agent.label}
                      seed={agent.agentId ?? `${phase.title}:${agent.label}`}
                      busy={agent.state !== "done"}
                      meta={agentMeta(agent)}
                      state={agentState(agent)}
                      transcript={agentRefs.find((ref) => ref.key === agent.agentId) ?? null}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : run.events.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">This run has reported nothing yet.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <ul className="text-muted-foreground space-y-1 text-xs">
            {calls.map((event) => (
              <li key={event.id}>{event.payload.type === "tool_call_started" ? `${event.payload.name} · ${event.payload.title}` : null}</li>
            ))}
          </ul>
          {/*
            A subagent's prose arrives committed rather than streamed, so it is
            rendered whole — there is never a delta to type it out with.
          */}
          {run.events
            .filter((event) => event.payload.type === "assistant_text")
            .map((event) => (
              <MessageBubble key={event.id} variant="plain" className="text-xs">
                <MessageMarkdown>{event.payload.type === "assistant_text" ? event.payload.text : ""}</MessageMarkdown>
              </MessageBubble>
            ))}
        </div>
      )}
      {transcriptRef === null ? null : (
        <div className="-mx-1 mt-3">
          <AgentRow
            label={`${run.label ?? "Subagent"} · transcript`}
            seed={run.taskId ?? run.callId}
            busy={!run.done}
            meta=""
            state=""
            transcript={transcriptRef}
          />
        </div>
      )}
      {report === undefined || report.trim() === "" ? null : (
        <div className="border-border mt-3 border-t pt-3">
          <p className="text-muted-foreground mb-1 text-xs uppercase">Reported back</p>
          <MessageMarkdown className="text-xs">{report}</MessageMarkdown>
        </div>
      )}
      {call === undefined ? null : <div className="mt-3">{call}</div>}
      </>
      )}
    </div>
  )
}

function WorkRow({ item, transcript, previews }: { item: WorkItem; transcript: Transcript; previews: DeltaBuffers }) {
  if (isToolGroup(item)) {
    return (
      <ToolCall status="complete">
        <ToolCallTrigger icon={TOOL_ICONS[item.calls[0]?.payload.type === "tool_call_started" ? item.calls[0].payload.kind : "other"]}>
          {item.target ?? `${item.name} × ${item.calls.length}`}
        </ToolCallTrigger>
        <ToolCallContent>
          <ul className="space-y-1 text-xs">
            {item.calls.map((call) => (
              <li key={call.id}>{call.payload.type === "tool_call_started" ? call.payload.title : null}</li>
            ))}
          </ul>
        </ToolCallContent>
      </ToolCall>
    )
  }

  const payload = item.payload
  if (payload.type === "tool_call_started") return <ToolRow event={item} transcript={transcript} />
  if (payload.type === "reasoning") {
    return (
      <ToolCall status="complete">
        <ToolCallTrigger icon={<ThinkingIcon />}>Thought for a moment</ToolCallTrigger>
        <ToolCallContent>
          <p className="text-muted-foreground text-xs whitespace-pre-wrap">{payload.text}</p>
        </ToolCallContent>
      </ToolCall>
    )
  }
  if (payload.type === "assistant_text") {
    const text = previewOf(previews, payload.block) ?? payload.text
    return (
      <Message from="assistant">
        <MessageContent className="max-w-full">
          <MessageBubble variant="plain">
            <MessageMarkdown>{text}</MessageMarkdown>
          </MessageBubble>
        </MessageContent>
      </Message>
    )
  }
  if (payload.type === "user_message") {
    return (
      <Message from="user">
        <MessageContent>
          <MessageBubble variant="muted">{payload.text}</MessageBubble>
        </MessageContent>
      </Message>
    )
  }
  if (payload.type === "error") {
    return <p className="text-destructive text-xs">{payload.message}</p>
  }
  return null
}

function TranscriptView({ transcript, previews, prompt }: { transcript: Transcript; previews: DeltaBuffers; prompt: string }) {
  const session = transcript.session
  // A model change is the one session-level shift the stream actually proves;
  // "resumed" is not on the wire at all, so nothing here claims it.
  const swap = transcript.events.find((event) => event.payload.type === "model_changed")
  const modelSwap = swap === undefined || swap.payload.type !== "model_changed" ? null : swap.payload.to
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{session?.model ?? "no session yet"}</Badge>
        {session === null ? null : <Badge variant="secondary">{session.permissionMode}</Badge>}
        {transcript.sessions.length > 1 ? <Badge variant="outline">{transcript.sessions.length} inits</Badge> : null}
        {modelSwap === null ? null : <Badge variant="outline">{`model → ${modelSwap}`}</Badge>}
        {transcript.usage === null ? null : (
          <span className="text-muted-foreground text-xs">
            {transcript.usage.totalTokens?.toLocaleString() ?? "—"} tokens
          </span>
        )}
      </div>

      {transcript.plan.length === 0 ? null : (
        <TaskList aria-label="Agent plan" className="border-border rounded-xl border p-3">
          {transcript.plan.map((step) => (
            <TaskListItem key={step.id ?? step.content} status={planStatus(step)}>
              {step.content}
            </TaskListItem>
          ))}
        </TaskList>
      )}

      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport className="px-1">
          <MessageScrollerContent aria-label="Agent transcript">
            <Message from="user">
              <MessageAvatar fallback="You" alt="You" />
              <MessageContent>
                <MessageHeader>host-supplied — headless never echoes the prompt</MessageHeader>
                <MessageBubble variant="muted">{prompt}</MessageBubble>
              </MessageContent>
            </Message>
            {transcript.turns.map((turn) => (
              <div key={turn.key} className="flex flex-col gap-3 py-2">
                {turn.prompt === null || turn.prompt.payload.type !== "user_message" ? null : (
                  <Message from="user">
                    <MessageAvatar fallback="You" alt="You" />
                    <MessageContent>
                      <MessageBubble variant="muted">{turn.prompt.payload.text}</MessageBubble>
                    </MessageContent>
                  </Message>
                )}
                {turn.work.map((item) => (
                  <WorkRow key={isToolGroup(item) ? item.key : item.id} item={item} transcript={transcript} previews={previews} />
                ))}
                {turn.finalText === null ? null : (
                  <Message from="assistant">
                    <MessageAvatar fallback="C" alt="Claude" />
                    <MessageContent className="max-w-full">
                      <MessageHeader>
                        {turn.completed === null ? "streaming" : `${turn.toolCalls} tool calls`}
                      </MessageHeader>
                      <MessageBubble variant="plain" streaming={turn.completed === null}>
                        <MessageMarkdown>{turn.finalText}</MessageMarkdown>
                      </MessageBubble>
                    </MessageContent>
                  </Message>
                )}
              </div>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </div>
  )
}

/** The raw side: the bytes as they arrived, and the events they became, selectable against each other. */
function CapabilitiesView({ capabilities }: { capabilities: claude.SessionCapabilities | null }) {
  if (capabilities === null) return <p className="text-muted-foreground text-xs">No init line yet.</p>
  const bySource = (source: string) => capabilities.commands.filter((command) => command.source === source)
  return (
    <div className="flex flex-col gap-3 text-xs">
      <Section title={`Slash commands (${capabilities.commands.length})`}>
        {(["skill", "plugin", "session", "terminal"] as const).map((source) =>
          bySource(source).length === 0 ? null : (
            <div key={source} className="mb-2">
              <p className="text-muted-foreground mb-1 uppercase">{source}</p>
              <div className="flex flex-wrap gap-1">
                {bySource(source).map((command) => (
                  <Badge key={command.name} variant="secondary">{`/${command.name}`}</Badge>
                ))}
              </div>
            </div>
          ),
        )}
      </Section>
      <Section title={`MCP servers (${capabilities.mcpServers.length})`}>
        <ul className="space-y-1">
          {capabilities.mcpServers.map((server) => (
            <li key={server.name} className="flex items-center gap-2">
              <Badge variant={server.connected ? "default" : "outline"}>{server.status}</Badge>
              <span>{server.name}</span>
              <span className="text-muted-foreground ml-auto">{server.tools.length} tools</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Subagents (${capabilities.agents.length})`}>
        <div className="flex flex-wrap gap-1">
          {capabilities.agents.map((agent) => (
            <Badge key={agent} variant="outline">{agent}</Badge>
          ))}
        </div>
      </Section>
      <Section title={`Tools (${capabilities.tools.length})`}>
        <p className="text-muted-foreground mb-1">
          {capabilities.tools.filter((tool) => tool.deferred).length} arrived in a later init — deferred tools loading on demand.
        </p>
        <div className="flex flex-wrap gap-1">
          {capabilities.tools.slice(0, 40).map((tool) => (
            <Badge key={tool.name} variant={tool.deferred ? "secondary" : "outline"}>
              {tool.name}
            </Badge>
          ))}
        </div>
      </Section>
    </div>
  )
}

/**
 * What a run's painting is seeded from.
 *
 * The harness's own ids where they exist, so the same run paints the same
 * picture on every reload. A workflow passes every agent's id as a set, which
 * is the group form — membership is the identity, so the picture changes when
 * the fan-out does and not when it merely reorders.
 */
function runSeed(run: DelegatedRun): string | readonly string[] {
  if (run.phases.length === 0) return run.taskId ?? run.label ?? run.callId
  const agents = run.phases.flatMap((phase) => phase.agents.map((agent) => agent.agentId ?? agent.label))
  return agents.length === 0 ? (run.taskId ?? run.callId) : agents
}

/**
 * Keeps one element where it is on screen across a layout change.
 *
 * The transcript scroller follows the live edge, so growing a card pulls the
 * viewport down and the card's own header slides up — the expansion reads as
 * happening *upward*, away from the control the reader just clicked. Measuring
 * the header before and after the toggle and correcting the scroll by the
 * difference pins it in place, so the card opens downward from a header that
 * has not moved.
 *
 * Corrected again on the next frame because the scroller re-pins on its own
 * ResizeObserver, which fires after this effect.
 */
function useAnchoredToggle(open: boolean) {
  const anchorRef = React.useRef<HTMLElement | null>(null)
  const topRef = React.useRef<number | null>(null)

  const capture = React.useCallback(() => {
    topRef.current = anchorRef.current?.getBoundingClientRect().top ?? null
  }, [])

  React.useLayoutEffect(() => {
    const anchor = anchorRef.current
    const before = topRef.current
    topRef.current = null
    if (anchor === null || before === null) return

    let scroller = anchor.parentElement
    while (scroller !== null) {
      const overflow = getComputedStyle(scroller).overflowY
      if (overflow === "auto" || overflow === "scroll") break
      scroller = scroller.parentElement
    }
    if (scroller === null) return

    const correct = () => {
      const after = anchorRef.current?.getBoundingClientRect().top
      if (after === undefined) return
      scroller.scrollTop += after - before
    }
    correct()
    const frame = requestAnimationFrame(correct)
    return () => cancelAnimationFrame(frame)
  }, [open])

  return { anchorRef, capture }
}

/**
 * How many rows a finished run folds itself at.
 *
 * Four is where a board stops being glanceable and starts being scrolled past.
 */
const AUTO_COLLAPSE_ROWS = 4

/** The pointer to a run's own transcript, built from the session's own `init`. */
function useRunRef(run: DelegatedRun): claude.TranscriptRef | null {
  const { location, runIds } = React.useContext(TranscriptLocation)
  if (location === null || run.kind === "workflow") return null
  return claude.collectTranscriptRefs(location, [run], runIds).find((ref) => ref.kind === "subagent") ?? null
}

/** Pointers to every agent inside a workflow run. */
function useAgentRefs(run: DelegatedRun): readonly claude.TranscriptRef[] {
  const { location, runIds } = React.useContext(TranscriptLocation)
  if (location === null || run.kind !== "workflow") return []
  return claude.collectTranscriptRefs(location, [run], runIds).filter((ref) => ref.kind === "workflow_agent")
}

const TranscriptLocation = React.createContext<{
  location: ReturnType<typeof claude.sessionLocationOf> | null
  runIds: ReadonlyMap<string, string>
}>({ location: null, runIds: new Map() })

/**
 * One agent, as a row that opens its conversation.
 *
 * The row *is* the affordance — a separate "open" button beside every agent
 * turns a board into a toolbar, and the thing the reader wants to click is the
 * agent itself. A run whose transcript cannot be addressed yet stays a plain
 * row rather than a dead button, with the reason on hover.
 */
function AgentRow({
  label,
  seed,
  busy,
  meta,
  state,
  transcript,
}: {
  label: string
  seed: string
  busy: boolean
  meta: string
  state: string
  transcript: claude.TranscriptRef | null
}) {
  const open = React.useContext(OpenTranscript)
  const openable = transcript !== null && transcript.resolved

  const body = (
    <>
      <RandomAvatar seed={seed} name={label} busy={busy} className="size-4 shrink-0 self-center" />
      <span className="text-muted-foreground min-w-0 truncate">{label}</span>
      <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">{meta}</span>
      {state === "" ? null : <span className="text-muted-foreground shrink-0 text-xs">{state}</span>}
    </>
  )

  if (!openable) {
    return (
      <div
        className="flex items-baseline gap-2 rounded-lg px-1 py-1 text-sm"
        title={transcript?.blockedBy ?? undefined}
      >
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => open(transcript)}
      title={transcript.path ?? undefined}
      className="hover:bg-muted flex w-full items-baseline gap-2 rounded-lg px-1 py-1 text-left text-sm transition-colors"
      data-testid="open-transcript"
    >
      {body}
    </button>
  )
}

/**
 * A token count at a glance.
 *
 * Exact figures are noise in a row that exists to be scanned — the reader wants
 * "about sixteen thousand", and the exact number is in the payload for anyone
 * who needs it.
 */
function compactTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}K`
  return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
}

/** What an agent cost, once there is anything to say. */
function agentMeta(agent: WorkflowAgentProgress): string {
  if (agent.tokens === null) return ""
  return `${compactTokens(agent.tokens)} · ${Math.round((agent.durationMs ?? 0) / 100) / 10}s`
}

/**
 * The agent's state as a word.
 *
 * The wire's own vocabulary is `start`, `progress`, `done` — `start` covers
 * both queued and running, and the two are told apart by whether the agent has
 * an id yet, which is the only thing that changes when it actually begins.
 */
function agentState(agent: WorkflowAgentProgress): string {
  if (agent.state === "done") return "done"
  if (agent.state === "progress") return "running"
  return agent.agentId === null ? "queued" : "running"
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border rounded-xl border p-3">
      <h3 className="mb-2 font-medium">{title}</h3>
      {children}
    </section>
  )
}

function InspectorView({
  captureId,
  count,
  events,
  produced,
  opened,
  onCloseTranscript,
}: {
  captureId: string
  count: number
  events: readonly AgentEvent[]
  produced: readonly number[]
  opened: claude.TranscriptRef | null
  onCloseTranscript: () => void
}) {
  const [pane, setPane] = React.useState<"raw" | "events" | "capabilities">("raw")
  const capabilities = React.useMemo(() => claude.sessionCapabilities(events), [events])
  const [selected, setSelected] = React.useState(0)
  const lines = (LINES.get(captureId) ?? []).slice(0, count)
  const line = lines[Math.min(selected, Math.max(lines.length - 1, 0))]
  const decoded = line === undefined ? null : (JSON.parse(line) as unknown)
  const selectedEvent = events[Math.min(selected, Math.max(events.length - 1, 0))]

  // An opened transcript takes the panel over: it is a different conversation,
  // not another view of this one.
  if (opened !== null) return <OpenedTranscript ref_={opened} onClose={onCloseTranscript} />

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SegmentedControl aria-label="Inspector pane" value={pane} onValueChange={(value) => setPane(value as "raw" | "events" | "capabilities")}>
        <SegmentedControlOption value="raw">Raw wire ({lines.length})</SegmentedControlOption>
        <SegmentedControlOption value="events">Events ({events.length})</SegmentedControlOption>
        <SegmentedControlOption value="capabilities">Capabilities</SegmentedControlOption>
      </SegmentedControl>

      {pane === "capabilities" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <CapabilitiesView capabilities={capabilities} />
        </div>
      ) : pane === "raw" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <ul className="border-border h-40 shrink-0 overflow-auto rounded-xl border p-1 font-mono text-xs" data-testid="raw-lines">
            {lines.map((entry, index) => {
              const parsed = JSON.parse(entry) as { type?: string; subtype?: string; event?: { type?: string } }
              const label = parsed.subtype ?? parsed.event?.type ?? ""
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => setSelected(index)}
                    className={`w-full truncate rounded px-2 py-0.5 text-left ${index === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                  >
                    <span className="text-muted-foreground">{String(index).padStart(3, "0")}</span> {parsed.type}
                    {label === "" ? "" : ` · ${label}`}
                    <span className={`ml-2 ${(produced[index] ?? 0) === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                      {`→ ${produced[index] ?? 0}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-muted-foreground text-xs">
            {`→ n is how many events the line produced. ${produced.filter((entry) => entry === 0).length} of ${produced.length} produce none: message_start is the mapper's join key, message_stop and message_delta repeat what result carries, signature_delta signs a thinking block, and a steady-state rate limit has nothing to act on.`}
          </p>
          <div className="border-border min-h-0 flex-1 overflow-auto rounded-xl border p-3">
            {decoded === null ? null : <JsonTree value={decoded} collapsible defaultExpandedDepth={2} />}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <ul className="border-border h-40 shrink-0 overflow-auto rounded-xl border p-1 font-mono text-xs" data-testid="parsed-events">
            {events.map((event, index) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setSelected(index)}
                  className={`w-full truncate rounded px-2 py-0.5 text-left ${index === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">{String(event.seq).padStart(3, "0")}</span> {event.payload.type}
                  {event.agentPath.length === 0 ? "" : ` · depth ${event.agentPath.length}`}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-border min-h-0 flex-1 overflow-auto rounded-xl border p-3">
            {selectedEvent === undefined ? null : <JsonTree value={selectedEvent.payload} collapsible defaultExpandedDepth={3} />}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One delegated run's conversation, opened as its own chat stream.
 *
 * Rendered from the file the pointer names, with the same components the main
 * transcript uses — a subagent's conversation is a conversation, and giving it
 * a lesser surface than the main thread is a choice, not a constraint.
 */
function OpenedTranscript({ ref_, onClose }: { ref_: claude.TranscriptRef; onClose: () => void }) {
  const source = ref_.path === null ? null : DISK_TRANSCRIPTS[ref_.key]
  const events = source === undefined || source === null ? null : mapClaudeStream(source)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="opened-transcript">
      <div className="flex items-center gap-2">
        <RandomAvatar seed={ref_.key} name={ref_.label} className="size-6" />
        <span className="text-sm font-medium">{ref_.label}</span>
        <Badge variant="secondary">{ref_.kind.replace("_", " ")}</Badge>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
      <code className="text-muted-foreground truncate text-xs">{ref_.path}</code>

      {events === null ? (
        <p className="text-muted-foreground text-xs">
          This story ships two transcripts as fixtures; a host would read the file above off disk and parse it with the same
          mapper.
        </p>
      ) : (
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport className="px-1">
            <MessageScrollerContent aria-label={`${ref_.label} transcript`}>
              {events.map((event) => {
                const payload = event.payload
                if (payload.type === "user_message") {
                  return (
                    <Message key={event.id} from="user">
                      <MessageAvatar fallback="↳" alt="Delegated prompt" />
                      <MessageContent>
                        <MessageBubble variant="muted">{payload.text}</MessageBubble>
                      </MessageContent>
                    </Message>
                  )
                }
                if (payload.type === "tool_call_started") {
                  return (
                    <ToolCall key={event.id} status="complete">
                      <ToolCallTrigger icon={TOOL_ICONS[payload.kind]}>{payload.title}</ToolCallTrigger>
                      <ToolCallContent>
                        <pre className="overflow-x-auto text-xs">{pretty(payload.input)}</pre>
                      </ToolCallContent>
                    </ToolCall>
                  )
                }
                if (payload.type === "assistant_text") {
                  return (
                    <Message key={event.id} from="assistant">
                      <MessageAvatar fallback="A" alt={ref_.label} />
                      <MessageContent className="max-w-full">
                        <MessageBubble variant="plain">
                          <MessageMarkdown>{payload.text}</MessageMarkdown>
                        </MessageBubble>
                      </MessageContent>
                    </Message>
                  )
                }
                return null
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      )}
    </div>
  )
}

function Explorer({ initialCapture = "tools", autoplay = false }: { initialCapture?: string; autoplay?: boolean }) {
  const [captureId, setCaptureId] = React.useState(initialCapture)
  const lines = LINES.get(captureId) ?? []
  const [count, setCount] = React.useState(autoplay ? 0 : lines.length)
  const [playing, setPlaying] = React.useState(autoplay)

  React.useEffect(() => {
    const next = LINES.get(captureId)?.length ?? 0
    setCount(autoplay ? 0 : next)
    setPlaying(autoplay)
  }, [captureId, autoplay])

  React.useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current >= lines.length) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 60)
    return () => window.clearInterval(timer)
  }, [playing, lines.length])

  // `live` while the player is still feeding lines: an unfinished call is
  // pending, not abandoned, and the difference is the shimmer on its row.
  const { events, produced, transcript, previews } = useLiveTranscript(captureId, count, count < lines.length)
  const capture = CAPTURES.find((entry) => entry.id === captureId)
  const [opened, setOpened] = React.useState<claude.TranscriptRef | null>(null)
  React.useEffect(() => setOpened(null), [captureId])

  const session = transcript.session
  const location = React.useMemo(
    () => (session === null ? null : claude.sessionLocationOf("~/.claude/projects", session)),
    [session],
  )
  // A host reads these off the workflow records on disk; the story supplies the
  // one it has so the workflow pointers resolve instead of staying blocked.
  const runIds = React.useMemo(
    () => new Map([["wcvm6lph1", "wf_61e7b0c3-6ad"], ["wgrnznfzq", "wf_c3f21d31-ec9"]]),
    [],
  )

  return (
    <TranscriptLocation.Provider value={{ location, runIds }}>
    <OpenTranscript.Provider value={setOpened}>
    <div className="border-border bg-background flex h-[42rem] w-full flex-col gap-3 rounded-3xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl aria-label="Capture" value={captureId} onValueChange={setCaptureId}>
          {CAPTURES.map((entry) => (
            <SegmentedControlOption key={entry.id} value={entry.id}>
              {entry.label}
            </SegmentedControlOption>
          ))}
        </SegmentedControl>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setCount(0); setPlaying(true) }}>
            Replay
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCount((current) => Math.min(current + 1, lines.length))}>
            Step
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setCount(lines.length) }}>
            End
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums" data-testid="progress">
            {count}/{lines.length} lines
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{capture?.blurb}</p>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border-border min-h-0 overflow-hidden rounded-2xl border p-3">
          <TranscriptView transcript={transcript} previews={previews} prompt={capture?.prompt ?? ""} />
        </div>
        <div className="border-border min-h-0 rounded-2xl border p-3">
          <InspectorView
            captureId={captureId}
            count={count}
            events={events}
            produced={produced}
            opened={opened}
            onCloseTranscript={() => setOpened(null)}
          />
        </div>
      </div>
    </div>
    </OpenTranscript.Provider>
    </TranscriptLocation.Provider>
  )
}

const meta = {
  title: "Composites/AgentStream",
  component: Explorer,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The agent stream parser, driven by real `claude -p --output-format stream-json` captures. Left is the transcript drawn from parsed events with Message, ToolCall, TaskList and MessageMarkdown; right is the same bytes unparsed — every wire line and every event it became, selectable against each other through JsonTree. The player feeds lines one at a time so the delta path, the shimmer on an unfinished call and the plan filling in all happen the way they do against a live process.",
      },
    },
  },
} satisfies Meta<typeof Explorer>

export default meta
type Story = StoryObj<typeof meta>

export const Explore: Story = {
  parameters: storyDocumentation(
    "Every captured scenario, fully parsed. Switch captures to see what each shape produces: tool calls pairing with their results, an Explore subagent's own work filed under the call that spawned it, a Workflow that reports progress and nothing else, and a resumed session whose second init is where a model change is visible at all.",
  ),
  args: { initialCapture: "tools" },
}

export const Replay: Story = {
  parameters: storyDocumentation(
    "The same parser fed one line at a time. Streamed deltas render as a preview until the committed event for the same block supersedes them, and a tool call with no result yet shimmers rather than reading as failed — the distinction the transcript's `live` flag draws.",
  ),
  args: { initialCapture: "todos", autoplay: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Assert the player is actually advancing…
    await waitFor(async () => {
      await expect(canvas.getByTestId("progress")).toHaveTextContent(/[1-9]\d*\/\d+ lines/)
    })
    // …then stop it. The runner shares one browser across every story file,
    // and a story that leaves a timer ticking keeps re-rendering — and keeps
    // taking main-thread time — for the rest of the run, which shows up as a
    // *different* file's animation-settling assertion reading a mid-flight
    // value on a slower machine.
    await userEvent.click(canvas.getByRole("button", { name: "End" }))
    await waitFor(async () => {
      const progress = canvas.getByTestId("progress").textContent ?? ""
      const [seen, total] = progress.split("/")
      await expect(seen?.trim()).toBe(total?.replace(" lines", "").trim())
    })
  },
}

export const Delegation: Story = {
  parameters: storyDocumentation(
    "A subagent and a workflow side by side, and the two are visible in different ways. The subagent's events are filed under its spawning call and can be read. A workflow's agents write no events at all — but `task_progress` carries a structured board of phases and agents, so each one still shows its state, model, tokens, duration and the preview of what it returned. Watchable, not readable.",
  ),
  args: { initialCapture: "subagent" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The pill is the row; its body — the run's own work, and the pointer to
    // the conversation on disk — is what expanding it reveals. Asserting the
    // body without opening it would assert on a closed disclosure.
    const pill = await canvas.findByRole("button", { name: /Explore/ })
    await userEvent.click(pill)
    await waitFor(async () => {
      await expect(canvas.getByTestId("run-agent")).toBeInTheDocument()
    })
    await expect(canvas.getByTestId("open-transcript")).toBeInTheDocument()
  },
}

/**
 * How the layers relate.
 *
 * Drawn as a class diagram because the shape that matters is *which type each
 * layer owns* — a second harness is a new pair of wire types and a mapper, and
 * nothing to the right of `AgentEvent` moves.
 */
const STRUCTURE = `classDiagram
    direction LR

    class WireEvent {
        <<claude/wire.ts>>
        +system
        +stream_event
        +assistant / user
        +result
        +control_request
        parseWireLine(line) WireParseResult
    }

    class ClaudeStreamMapper {
        <<claude/mapper.ts>>
        -currentMessageId
        -committedBlocks Map
        -pathByCall Map
        -planSteps
        -seq
        +push(line) AgentEvent[]
    }

    class AgentEvent {
        <<events.ts — shared>>
        +id
        +sessionId
        +seq
        +agentPath string[]
        +payload AgentEventPayload
        +raw
    }

    class AgentEventPayload {
        <<27 variants — shared>>
        +assistant_text
        +tool_call_started
        +delta
        +task_progress
        +workflow_progress
        +plan_updated
        +unknown
    }

    class TranscriptBuilder {
        <<builder.ts — shared>>
        -closedTurns
        -runs Map
        +push(events)
        +snapshot(live) Transcript
    }

    class Transcript {
        +turns Turn[]
        +runs DelegatedRun[]
        +resultByCallId Map
        +plan PlanStep[]
        +pendingAsks
    }

    class SessionStore {
        <<claude/store.ts>>
        +subagentTranscriptPath()
        +workflowAgentTranscriptPath()
        +collectTranscriptRefs() TranscriptRef[]
    }

    class CodexMapper {
        <<codex/ — not built>>
        +push(line) AgentEvent[]
    }

    class AcpMapper {
        <<acp/ — not built>>
        +push(notification) AgentEvent[]
    }

    WireEvent --> ClaudeStreamMapper : decoded, no state
    ClaudeStreamMapper --> AgentEvent : emits
    AgentEvent *-- AgentEventPayload
    AgentEvent --> TranscriptBuilder : appended
    TranscriptBuilder --> Transcript : snapshot per frame
    SessionStore ..> AgentEvent : keys read off task_started
    SessionStore ..> ClaudeStreamMapper : disk transcripts reuse it
    CodexMapper ..> AgentEvent : same contract
    AcpMapper ..> AgentEvent : same contract
`

/**
 * What one arriving line does.
 *
 * The sequence is where the two rules that are easy to get wrong become
 * visible: a delta is a preview the committed event supersedes, and the fold
 * is appended to rather than recomputed.
 */
const FLOW = `sequenceDiagram
    autonumber
    participant CLI as claude -p stdout
    participant Wire as parseWireLine
    participant Map as ClaudeStreamMapper
    participant Build as TranscriptBuilder
    participant UI as Transcript view
    participant Disk as ~/.claude/projects

    CLI->>Wire: stream_event / message_start
    Wire->>Map: WireEvent, no state held
    Note over Map: message_start only records<br/>the message id, so it emits nothing
    Map--)Build: no event

    CLI->>Wire: stream_event / content_block_delta
    Wire->>Map: frame
    Map->>Build: delta with block and text
    Build->>UI: preview text for that block

    CLI->>Wire: assistant, one committed block
    Wire->>Map: message with a single content block
    Note over Map: the block index is derived by<br/>counting blocks per message id
    Map->>Build: assistant_text with the same block
    Build->>UI: committed text supersedes the preview

    CLI->>Wire: system / task_started
    Wire->>Map: subagent spawned
    Map->>Build: task_started with taskId and callId
    Build->>UI: run row plus a transcript pointer

    UI->>Disk: read subagents/agent-taskId.jsonl
    Disk->>Map: same line shapes, same parser
    Map->>UI: the delegated conversation

    CLI->>Wire: result
    Wire->>Map: turn terminator
    Map->>Build: turn_completed
    Note over Build: the turn closes and is assembled<br/>once, never recomputed
    Build->>UI: snapshot
`

export const Architecture: Story = {
  parameters: storyDocumentation(
    "How the parser is put together, and where a second harness plugs in. The class diagram shows which type each layer owns: the wire layer is stateless and disposable, the mapper holds the only state, and everything to the right of AgentEvent is harness-agnostic — so Codex or an ACP agent is a new wire type and a new mapper, and no component changes. The sequence shows one line's journey, including the two rules that are easy to get wrong: a delta is a preview the committed event supersedes, and the fold is appended to rather than recomputed.",
  ),
  args: {},
  render: () => (
    <div className="flex w-full flex-col gap-8 p-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Layers, and what each one owns</h3>
        <p className="text-muted-foreground text-sm">
          One direction of dependency. A harness that speaks a different wire supplies the two boxes on the left; the contract and
          everything past it is shared.
        </p>
        <MermaidDiagram chart={STRUCTURE} className="w-full" />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">One line, end to end</h3>
        <p className="text-muted-foreground text-sm">
          Including the lines that produce no event at all, which is most of what makes the counts in the raw pane not match.
        </p>
        <MermaidDiagram chart={FLOW} className="w-full" />
      </section>
    </div>
  ),
}
