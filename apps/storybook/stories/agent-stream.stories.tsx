import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Badge,
  Button,
  ClaudeStreamMapper,
  ClaudeMessagesMapper,
  CodexStreamMapper,
  CursorStreamMapper,
  AcpMapper,
  CodexAppServerMapper,
  OpencodeRunMapper,
  OpencodeServerMapper,
  OpenAIAgentsMapper,
  AGENT_TRANSPORTS,
  claude,
  codex,
  opencode,
  transportOf,
  transportsOf,
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
  FileDiffCard,
  FileDiffCardHeader,
  FileDiffCardHeading,
  FileDiffCardIcon,
  FileDiffCardTitle,
  FileDiffList,
  FileDiffListItem,
  FileDiffPath,
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
  TranscriptDivider,
  applyDeltas,
  isCompacting,
  unreportedCapabilities,
  TranscriptBuilder,
  isToolGroup,
  previewOf,
  type AgentEvent,
  type AgentEventPayload,
  type DelegatedRun,
  type PlanStep,
  type DeltaBuffers,
  type FileEdit,
  type ToolKind,
  type WorkflowAgentProgress,
  type AgentCapabilities,
  type JsonValue,
  type Supported,
  type Transcript,
  type TransportDescriptor,
  type WorkItem,
} from "@nessalabs/ui"

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
import approvalAllow from "./fixtures/agent-stream/approval_allow.jsonl?raw"
import opencodeFailing from "./fixtures/agent-stream/opencode/failing.jsonl?raw"
import opencodePrinted from "./fixtures/agent-stream/opencode/printed.jsonl?raw"
import opencodeRejected from "./fixtures/agent-stream/opencode/rejected.jsonl?raw"
import opencodeResumeOne from "./fixtures/agent-stream/opencode/resume_turn1.jsonl?raw"
import opencodeResumeTwo from "./fixtures/agent-stream/opencode/resume_turn2.jsonl?raw"
import opencodeSubagent from "./fixtures/agent-stream/opencode/subagent.jsonl?raw"
import opencodeTodos from "./fixtures/agent-stream/opencode/todos.jsonl?raw"
import opencodeTools from "./fixtures/agent-stream/opencode/tools.jsonl?raw"
import compaction from "./fixtures/agent-stream/compaction.jsonl?raw"
import approvalDeny from "./fixtures/agent-stream/approval_deny.jsonl?raw"
import printed from "./fixtures/agent-stream/printed.jsonl?raw"
import resumeOne from "./fixtures/agent-stream/resume_turn1.jsonl?raw"
import resumeTwo from "./fixtures/agent-stream/resume_turn2.jsonl?raw"
import subagent from "./fixtures/agent-stream/subagent.jsonl?raw"
import todos from "./fixtures/agent-stream/todos.jsonl?raw"
import tools from "./fixtures/agent-stream/tools.jsonl?raw"
import websearch from "./fixtures/agent-stream/websearch.jsonl?raw"
import workflow from "./fixtures/agent-stream/workflow.jsonl?raw"
import workflowPhases from "./fixtures/agent-stream/workflow_phases.jsonl?raw"
// The same scenario matrix, recorded through the Claude Agent SDK's `query()`.
// Same prompts as above on purpose: recording them differently would compare
// two conversations and call the difference a property of the transport.
import sdkApprovalAllow from "./fixtures/agent-stream/claude-agent-sdk/approval-allow.jsonl?raw"
import sdkApprovalDeny from "./fixtures/agent-stream/claude-agent-sdk/approval-deny.jsonl?raw"
import sdkFailing from "./fixtures/agent-stream/claude-agent-sdk/failing.jsonl?raw"
import sdkPhases from "./fixtures/agent-stream/claude-agent-sdk/phases.jsonl?raw"
import sdkPrinted from "./fixtures/agent-stream/claude-agent-sdk/printed.jsonl?raw"
import sdkResume from "./fixtures/agent-stream/claude-agent-sdk/resume.jsonl?raw"
import sdkSubagent from "./fixtures/agent-stream/claude-agent-sdk/subagent.jsonl?raw"
import sdkTodos from "./fixtures/agent-stream/claude-agent-sdk/todos.jsonl?raw"
import sdkTools from "./fixtures/agent-stream/claude-agent-sdk/tools.jsonl?raw"
import sdkWebsearch from "./fixtures/agent-stream/claude-agent-sdk/websearch.jsonl?raw"
import sdkWorkflow from "./fixtures/agent-stream/claude-agent-sdk/workflow.jsonl?raw"
// The raw Messages API, which is a different wire rather than the same one in
// a different envelope — hence a different, smaller scenario list: it has no
// plan tool, no subagents and no workflows to record.
import msgEager from "./fixtures/agent-stream/claude-messages/eager.jsonl?raw"
import msgFailing from "./fixtures/agent-stream/claude-messages/failing.jsonl?raw"
import msgImage from "./fixtures/agent-stream/claude-messages/image.jsonl?raw"
import msgParallel from "./fixtures/agent-stream/claude-messages/parallel.jsonl?raw"
import msgSearch from "./fixtures/agent-stream/claude-messages/search.jsonl?raw"
import msgStructured from "./fixtures/agent-stream/claude-messages/structured.jsonl?raw"
import msgText from "./fixtures/agent-stream/claude-messages/text.jsonl?raw"
import msgThinking from "./fixtures/agent-stream/claude-messages/thinking.jsonl?raw"
import msgTools from "./fixtures/agent-stream/claude-messages/tools.jsonl?raw"
import msgTruncated from "./fixtures/agent-stream/claude-messages/truncated.jsonl?raw"
// The same scenario matrix recorded from `codex exec --json`.
import codexDelegate from "./fixtures/agent-stream/codex/delegate.jsonl?raw"
import codexFailing from "./fixtures/agent-stream/codex/failing.jsonl?raw"
import codexPatch from "./fixtures/agent-stream/codex/patch.jsonl?raw"
import codexPlan from "./fixtures/agent-stream/codex/plan.jsonl?raw"
import codexPrinted from "./fixtures/agent-stream/codex/printed.jsonl?raw"
import codexResumeOne from "./fixtures/agent-stream/codex/resume_turn1.jsonl?raw"
import codexResumeTwo from "./fixtures/agent-stream/codex/resume_turn2.jsonl?raw"
import codexTools from "./fixtures/agent-stream/codex/tools.jsonl?raw"
import codexWebsearch from "./fixtures/agent-stream/codex/websearch.jsonl?raw"

import cursorPrinted from "./fixtures/agent-stream/cursor/printed.jsonl?raw"
import cursorShell from "./fixtures/agent-stream/cursor/shell.jsonl?raw"
import cursorSubagent from "./fixtures/agent-stream/cursor/subagent.jsonl?raw"
import cursorTools from "./fixtures/agent-stream/cursor/tools.jsonl?raw"
import acpCursorPrinted from "./fixtures/agent-stream/acp/cursor_printed.jsonl?raw"
import acpCursorTools from "./fixtures/agent-stream/acp/cursor_tools.jsonl?raw"
// What the interactive app-server answers that the one-way stream never sends.
import codexAppServerCapabilities from "./fixtures/agent-stream/codex/appserver_capabilities.json"
import opencodeCliAgents from "./fixtures/agent-stream/opencode/cli_agents.txt?raw"
import opencodeExportSubagent from "./fixtures/agent-stream/opencode/export_subagent.json?raw"
import acpClaudeTools from "./fixtures/agent-stream/acp/claude_tools.jsonl?raw"
import acpCodexTools from "./fixtures/agent-stream/acp/codex_tools.jsonl?raw"
import codexAppServerTools from "./fixtures/agent-stream/codex/appserver_tools.jsonl?raw"
import opencodeAcpPermission from "./fixtures/agent-stream/opencode/acp_permission.jsonl?raw"
import opencodeAcpPlan from "./fixtures/agent-stream/opencode/acp_plan.jsonl?raw"
import opencodeAcpSubagent from "./fixtures/agent-stream/opencode/acp_subagent.jsonl?raw"
import opencodeAcpWebsearch from "./fixtures/agent-stream/opencode/acp_websearch.jsonl?raw"
import opencodeSsePlan from "./fixtures/agent-stream/opencode/sse_plan.jsonl?raw"
import opencodeSseSubagent from "./fixtures/agent-stream/opencode/sse_subagent.jsonl?raw"
import opencodeSseWebsearch from "./fixtures/agent-stream/opencode/sse_websearch.jsonl?raw"
import opencodeOverflow from "./fixtures/agent-stream/opencode/overflow.jsonl?raw"
import opencodeWebsearch from "./fixtures/agent-stream/opencode/websearch.jsonl?raw"
import opencodeAcpPrinted from "./fixtures/agent-stream/opencode/acp_printed.jsonl?raw"
import opencodeAcpTools from "./fixtures/agent-stream/opencode/acp_tools.jsonl?raw"
import opencodeSsePrinted from "./fixtures/agent-stream/opencode/sse_printed.jsonl?raw"
import opencodeSseTools from "./fixtures/agent-stream/opencode/sse_tools.jsonl?raw"
import opencodeCliModels from "./fixtures/agent-stream/opencode/cli_models.txt?raw"
import openaiAgentsTools from "./fixtures/agent-stream/openai-agents/tools.jsonl?raw"
import openaiAgentsControl from "./fixtures/agent-stream/openai-agents/control.jsonl?raw"
import openaiAgentsAgentTool from "./fixtures/agent-stream/openai-agents/agent-tool.jsonl?raw"
// The transcripts the *stream* refuses to carry, read back from the files
// Claude Code writes under ~/.claude/projects. Keyed by the ids the stream does
// give: a subagent by its `task_id`, a workflow agent by its `agentId`.
import diskSubagent from "./fixtures/agent-stream/disk_subagent_a37fefefbc61e13e3.jsonl?raw"
import diskWorkflowAgent from "./fixtures/agent-stream/disk_workflow_agent_a35ea63276cd501aa.jsonl?raw"

type ProviderId = "openai" | "claude" | "codex" | "cursor" | "opencode"

/**
 * What a provider is, and what it supports.
 *
 * The panes read `supports` rather than checking the id: a surface that a
 * provider cannot fill should be absent, not empty, and asking "does this
 * provider report capabilities" is a question a third provider answers for
 * itself without this file learning its name.
 */
interface Provider {
  readonly id: ProviderId
  readonly label: string
  readonly command: string
  /** The provider's own mapper, behind the shared interface. */
  /**
   * The provider's own mapper for one transport, behind the shared interface.
   *
   * Takes the transport because a provider can have more than one wire, and
   * opencode's two are different protocols — reading a bus capture with the
   * one-way mapper would decode every frame as unknown.
   */
  readonly createMapper: (transportId: string) => StoryMapper
  /**
   * Why some of this provider's lines produce no event.
   *
   * Owned here rather than branched on the id in the pane: written as an
   * if/else, a third provider silently inherits the second one's sentence and
   * the surface states something untrue about the stream it is showing.
   */
  readonly silentLinesNote: string
  /**
   * How you reach this agent, read from the library rather than restated here.
   *
   * A provider is not one wire, and what a wire can do is a fact about the
   * transport — so it lives with the parser that established it. A surface that
   * kept its own copy would drift from what was actually captured.
   */
  readonly transports: readonly TransportDescriptor[]
  readonly supports: {
    /** A phase-and-agent board for a fan-out. Not a property of any one wire. */
    readonly workflowBoard: boolean
    /** Delegated transcripts a host can open, however it addresses them. */
    readonly transcriptsOnDisk: boolean
  }
}

interface StoryMapper {
  push(line: string): readonly AgentEvent[]
  finish?(options?: { status?: "completed" | "interrupted" | "error" }): readonly AgentEvent[]
}

const PROVIDERS: Readonly<Record<ProviderId, Provider>> = {
  openai: {
    id: "openai",
    label: "OpenAI Agents SDK",
    command: "for await (const event of await run(agent, input, { stream: true }))",
    transports: transportsOf("openai")!.transports,
    createMapper: () => new OpenAIAgentsMapper({ sessionId: "storybook-openai", model: "gpt-test" }),
    silentLinesNote:
      "response_started opens the run and response_done contributes request usage; run-item events are authoritative for committed messages, executed tool results, handoffs, approvals, and compaction.",
    supports: { workflowBoard: false, transcriptsOnDisk: false },
  },
  claude: {
    id: "claude",
    label: "Claude Code",
    command: "claude -p --output-format stream-json --include-partial-messages",
    transports: transportsOf("claude")!.transports,
    createMapper: (transportId: string) =>
      transportId === "acp"
        ? new AcpMapper()
        : // The Messages API is the only Claude transport that is a different
          // wire; the Agent SDK is this same mapper reading objects, so it
          // needs no branch of its own here.
          transportId === "messages"
          ? new ClaudeMessagesMapper()
          : new ClaudeStreamMapper(),
    silentLinesNote:
      "message_start is the mapper's join key, message_stop and message_delta repeat what result carries, signature_delta signs a thinking block, and a steady-state rate limit has nothing to act on.",
    supports: { workflowBoard: true, transcriptsOnDisk: true },
  },
  codex: {
    id: "codex",
    label: "Codex",
    command: "codex exec --json",
    transports: transportsOf("codex")!.transports,
    createMapper: (transportId: string) =>
      transportId === "acp"
        ? new AcpMapper()
        : transportId === "app-server"
          ? new CodexAppServerMapper()
          : new CodexStreamMapper(),
    silentLinesNote:
      "turn.started is a bare marker, and an item that is reported whole on completion says nothing when it opens.",
    supports: { workflowBoard: false, transcriptsOnDisk: true },
  },
  cursor: {
    id: "cursor",
    label: "Cursor Agent",
    command: "agent -p --output-format stream-json --stream-partial-output",
    transports: transportsOf("cursor")!.transports,
    createMapper: (transportId: string) =>
      transportId === "acp" ? new AcpMapper() : new CursorStreamMapper(),
    silentLinesNote:
      "thinking/completed carries no text of its own — the deltas already built it — and a tool_call that this build has not named yet is left as unknown rather than guessed. On ACP, authenticate and available_commands_update are capability rather than conversation.",
    supports: { workflowBoard: false, transcriptsOnDisk: false },
  },
  opencode: {
    id: "opencode",
    label: "opencode",
    command: "opencode run --format json",
    transports: transportsOf("opencode")!.transports,
    createMapper: (transportId: string) =>
      // Two wires, two mappers: the bus is a different protocol, not the same
      // one with more on it.
      transportId === "serve"
        ? new OpencodeServerMapper()
        : transportId === "acp"
          ? new AcpMapper()
          : new OpencodeRunMapper(),
    silentLinesNote:
      "a step opening says only that a model call began, and the steps that finish mid-turn are the tool loop rather than the end of the answer — only the one that stops for its own sake closes the turn.",
    // Its delegated runs are the readable ones: the child session id is on the
    // wire and `opencode export <id>` reads it, where Claude's must be derived
    // and Codex's cannot be read at all.
    supports: { workflowBoard: false, transcriptsOnDisk: true },
  },
}

interface Capture {
  readonly provider: ProviderId
  /**
   * The transport this was recorded from, when it only exists on one.
   *
   * opencode streams tokens on its server bus and nothing at all on its
   * one-way stream, so a capture of one is not a capture of the other. Absent
   * means the recording is representative of every transport the provider has.
   */
  readonly transport?: string
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
  /** How the SDK run ended after the last captured iterator event. */
  readonly finishStatus?: "completed" | "interrupted" | "error"
  /** Agent.asTool names are indistinguishable from ordinary functions on the parent wire. */
  readonly agentToolNames?: readonly string[]
}

const CAPTURES: readonly Capture[] = [
  { provider: "openai", transport: "agents-sdk", id: "openai-tools", label: "Tool loop", blurb: "An exercised Agents SDK run: one model request asks for a function tool, the SDK executes it, then a second model request streams and commits the answer. Usage is accumulated across both requests.", prompt: "Look up the weather and answer with the result.", source: openaiAgentsTools },
  { provider: "openai", transport: "agents-sdk", id: "openai-agent-tool", label: "Agent as tool", blurb: "A coordinator invokes an agent exposed through agent.asTool(). The parent stream exposes an ordinary function call and final result, so host configuration identifies it as delegated work; the child's internal events are not forwarded on this stream.", prompt: "Ask the research agent about the weather, then report its result.", source: openaiAgentsAgentTool, agentToolNames: ["research_agent"] },
  { provider: "openai", transport: "agents-sdk", id: "openai-control", label: "Handoff + approval + compaction", blurb: "The runtime replaces the active agent with a specialist, pauses for tool approval, and publishes an opaque compaction boundary. A handoff is an agent switch, not a child run.", prompt: "Transfer this refund request to the specialist and perform the protected action.", source: openaiAgentsControl, finishStatus: "interrupted" },
  { provider: "claude", transport: "stream", id: "printed", label: "Plain text", blurb: "One streamed message and nothing else — the delta path with no tools in the way.", prompt: "Print exactly: hello world. Do not use any tools.", source: printed },
  { provider: "claude", transport: "stream", id: "tools", label: "Tools", blurb: "One shell command doing the whole job, its result, and a reasoning block — the model chained it rather than making three calls.", prompt: "Create a file notes.txt containing three lines of text, then read it back, then run 'wc -l notes.txt'. Keep it brief.", source: tools },
  { provider: "claude", transport: "stream", id: "todos", label: "Plan", blurb: "The incremental plan tools — TaskCreate and TaskUpdate — folded into one checklist.", prompt: "Use your todo list to plan and then do these three steps: create a.txt with 'a', create b.txt with 'b', then run 'ls *.txt'. Track each step in your todos.", source: todos },
  { provider: "claude", transport: "stream", id: "subagent", label: "Subagent", blurb: "An Explore subagent, its own events filed under the call that spawned it.", prompt: "Use the Explore subagent to find out what files are in this directory, then tell me what it found in one line.", source: subagent },
  { provider: "claude", transport: "stream", id: "workflow", label: "Workflow", blurb: "Three parallel agents behind one Workflow call: no inner transcripts, but a full phase-and-agent board with state, cost and results.", prompt: "Use a workflow to run three agents in parallel, each printing a different greeting (hello, hola, bonjour), then summarize what they returned. Keep it tiny.", source: workflow },
  { provider: "claude", transport: "stream", id: "phases", label: "Multi-phase workflow", blurb: "Three phases, four agents. Every phase is declared up front, so the ones not reached yet render as pending rather than appearing late.", prompt: "Use a workflow with THREE phases: 'Greet' runs two agents in parallel (hello, hola); 'Translate' runs one (bonjour); 'Summarize' lists all three.", source: workflowPhases },
  { provider: "claude", transport: "stream", id: "failing", label: "Failed tool", blurb: "A command that exits non-zero, with the wire's error framing stripped off.", prompt: "Run the command 'cat /nonexistent/definitely-missing-file' and then tell me what happened in one sentence.", source: failing },
  { provider: "claude", transport: "stream", id: "websearch", label: "Web search", blurb: "Server-side tools, whose results arrive as structured blocks rather than text.", prompt: "Search the web for the current version of the TypeScript compiler and tell me in one line.", source: websearch },
  { provider: "claude", transport: "stream", id: "approval-allow", label: "Approval — allowed", blurb: "The one place the wire is a conversation: the harness stops and asks, and nothing moves until an answer is written back. Recorded against a sandbox whose settings escalate the shell.", prompt: "Run the shell command `echo approved-and-ran` using the Bash tool, then tell me its output. (Answered: allow)", source: approvalAllow },
  { provider: "claude", transport: "stream", id: "approval-deny", label: "Approval — refused", blurb: "The same ask, answered no. The refusal text becomes the tool's error, and the turn still completes — a declined tool is not a failed run.", prompt: "The same prompt, answered: deny.", source: approvalDeny },
  { provider: "claude", transport: "stream", id: "compaction", label: "Context compaction", blurb: "The window fills and history is summarised away — twice. The transcript keeps everything; only the model forgets. Forced by reading a generated corpus on Haiku with a 100k window.", prompt: "Read fifteen generated files in full, one at a time, answering with only each filename.", source: compaction },
  { provider: "claude", transport: "stream", id: "resume", label: "Resume + model swap", blurb: "Two processes, one session id: a second init, and a model change derived from it.", prompt: "Remember the number 47. Create marker.txt containing it. Then, resumed on Haiku: what number did I ask you to remember?", source: `${resumeOne}\n${resumeTwo}` },
  // The Agent SDK: the same wire as `stream`, in-process as objects, recorded
  // scenario for scenario so the two can be compared rather than assumed equal.
  { provider: "claude", transport: "agent-sdk", id: "sdk-printed", label: "Plain text", blurb: "The same prompt through `query()`. Identical line kinds to the CLI's one-way stream — this transport is a delivery mechanism, not a different wire.", prompt: "Print exactly: hello world. Do not use any tools.", source: sdkPrinted },
  { provider: "claude", transport: "agent-sdk", id: "sdk-tools", label: "Tools", blurb: "Write, Read and Bash in one turn, arriving as objects rather than bytes. The mapper is the CLI's, unchanged.", prompt: "Create a file notes2.txt containing three lines of text, then read it back, then run 'wc -l notes2.txt'. Keep it brief.", source: sdkTools },
  { provider: "claude", transport: "agent-sdk", id: "sdk-todos", label: "Plan", blurb: "The incremental plan tools folded into one checklist, exactly as on the CLI.", prompt: "Use your todo list to plan and then do these three steps: create a.txt with 'a', create b.txt with 'b', then run 'ls *.txt'. Track each step in your todos.", source: sdkTodos },
  { provider: "claude", transport: "agent-sdk", id: "sdk-subagent", label: "Subagent", blurb: "A delegated run, its task lifecycle intact: the SDK emits the same task_started, task_progress and task_notification lines the CLI prints.", prompt: "Use the Explore subagent to find out what files are in this directory, then tell me what it found in one line.", source: sdkSubagent },
  { provider: "claude", transport: "agent-sdk", id: "sdk-workflow", label: "Workflow", blurb: "Three agents behind one Workflow call, with the full phase-and-agent board. The tool is named `Workflow`; without it in allowedTools the run is refused and the capture records a refusal instead.", prompt: "Use a workflow to run three agents in parallel, each printing a different greeting (hello, hola, bonjour), then summarize what they returned. Keep it tiny.", source: sdkWorkflow },
  { provider: "claude", transport: "agent-sdk", id: "sdk-phases", label: "Multi-phase workflow", blurb: "Three phases, four agents, declared up front — the same board the CLI publishes, reached through the SDK.", prompt: "Use a workflow with THREE phases: 'Greet' runs two agents in parallel (hello, hola); 'Translate' runs one (bonjour); 'Summarize' lists all three.", source: sdkPhases },
  { provider: "claude", transport: "agent-sdk", id: "sdk-failing", label: "Failed tool", blurb: "A non-zero exit, with the wire's error framing stripped off.", prompt: "Run the command 'cat /nonexistent/definitely-missing-file' and then tell me what happened in one sentence.", source: sdkFailing },
  { provider: "claude", transport: "agent-sdk", id: "sdk-websearch", label: "Web search", blurb: "Server-side search reached through the SDK; the results arrive as structured blocks, not text.", prompt: "Search the web for the current version of the TypeScript compiler and tell me in one line.", source: sdkWebsearch },
  { provider: "claude", transport: "agent-sdk", id: "sdk-approval-allow", label: "Approval — allowed", blurb: "The difference that matters. `canUseTool` is answered in-process, so nothing on this stream asks — there is no control request to see, only a call that ran.", prompt: "Delete notes.txt with `rm notes.txt`, then confirm. (Answered: allow)", source: sdkApprovalAllow },
  { provider: "claude", transport: "agent-sdk", id: "sdk-approval-deny", label: "Approval — refused", blurb: "The same ask, refused. The refusal is recoverable only after the fact: as a failed tool result, and in permission_denials on the final result line.", prompt: "The same prompt, answered: deny.", source: sdkApprovalDeny },
  { provider: "claude", transport: "agent-sdk", id: "sdk-resume", label: "Resume + model swap", blurb: "Two `query()` calls sharing a session id, the second on Haiku: a second init, and a model change derived from it.", prompt: "Remember the number 47. Create marker.txt containing it. Then, resumed on Haiku: what number did I ask you to remember?", source: sdkResume },
  // The Messages API. A shorter list on purpose: no plan tool, no subagents,
  // no workflows exist on this wire to record.
  { provider: "claude", transport: "messages", id: "msg-text", label: "Plain text", blurb: "The raw SSE frames with no CLI around them: message_start opens block indexing, deltas preview, and message_delta ends the turn.", prompt: "In two sentences, what is a newline-delimited JSON stream?", source: msgText },
  { provider: "claude", transport: "messages", id: "msg-thinking", label: "Thinking", blurb: "Adaptive thinking with summaries. The signature delta is carried for replay and deliberately contributes nothing to the rendered text — and this wire reports reasoning tokens, which Claude Code's does not.", prompt: "A farmer has 17 sheep; all but 9 run away. How many are left? Reason it through.", source: msgThinking },
  { provider: "claude", transport: "messages", id: "msg-tools", label: "Tools", blurb: "A call whose arguments arrive as fragments that are individually unparseable — the call is only whole at content_block_stop. Its result comes from the host, never from the stream.", prompt: "What is the weather in Oslo? Use the tool.", source: msgTools },
  { provider: "claude", transport: "messages", id: "msg-parallel", label: "Parallel tools", blurb: "Two calls in one message, each keeping its own id and arguments — the case that catches a mapper indexing blocks carelessly.", prompt: "Get both the weather and the local time for Oslo. Call both tools at once.", source: msgParallel },
  { provider: "claude", transport: "messages", id: "msg-eager", label: "Eager tool streaming", blurb: "`eager_input_streaming` starts the argument fragments earlier. Note the turn never completes: it ends on a tool_use stop, which hands control to the host rather than ending anything.", prompt: "What is the weather in Reykjavik? Use the tool.", source: msgEager },
  { provider: "claude", transport: "messages", id: "msg-search", label: "Web search", blurb: "Server-side tools, which are the one kind this wire resolves itself: no tool_result is ever sent back for one, so the stream completes them. Here web_search is called from inside code_execution — server tools nest.", prompt: "What is the newest release of the Zig programming language?", source: msgSearch },
  { provider: "claude", transport: "messages", id: "msg-failing", label: "Failed tool", blurb: "The host answers with is_error. The tool failed; the turn did not.", prompt: "What is the weather in Atlantis? Use the tool.", source: msgFailing },
  { provider: "claude", transport: "messages", id: "msg-structured", label: "Structured output", blurb: "A schema-constrained response. It is still ordinary text blocks on the wire — the constraint is in the request, which a parser never sees.", prompt: "Describe the Rust programming language.", source: msgStructured },
  { provider: "claude", transport: "messages", id: "msg-image", label: "Image prompt", blurb: "An image goes up in the request; the response wire is unchanged. What a parser can see is the usage it cost.", prompt: "What colour is this image? Answer in one word.", source: msgImage },
  { provider: "claude", transport: "messages", id: "msg-truncated", label: "Truncated", blurb: "max_tokens cut the turn off mid-sentence, and the stop reason says so rather than leaving it to be inferred.", prompt: "Write a long paragraph about the history of the semicolon.", source: msgTruncated },
  { provider: "claude", transport: "acp", id: "claude-acp", label: "Tools over ACP", blurb: "Claude Code through Zed's adapter. The same agent on a different protocol: it asks for permission over the wire without the stdio flag its own stream needs, and `session/new` advertises the models it can switch to.", prompt: "Create notes.txt with two lines, then run 'wc -l notes.txt'.", source: acpClaudeTools },

  // ---------- Codex ----------
  { provider: "codex", transport: "exec", id: "codex-printed", label: "Plain text", blurb: "One committed message. Codex streams nothing in this mode, which is why live preview has to be optional rather than assumed.", prompt: "Reply with exactly: hello world. Do not run any commands.", source: codexPrinted },
  { provider: "codex", transport: "exec", id: "codex-tools", label: "Tools", blurb: "A file write and a shell command, each an item that opens and settles — the item id is the call id.", prompt: "Create notes.txt with three lines of text, read it back, then run 'wc -l notes.txt'.", source: codexTools },
  { provider: "codex", transport: "exec", id: "codex-plan", label: "Plan", blurb: "The plan republished whole as steps complete, with no step ids — position in the list is the identity.", prompt: "Plan and then do three steps: create a.txt, create b.txt, then run 'ls *.txt'. Track your progress.", source: codexPlan },
  { provider: "codex", transport: "exec", id: "codex-patch", label: "File changes", blurb: "Structured edits: which files changed and how. Claude Code reports the same work only as opaque tool calls.", prompt: "Create greet.py with a function that prints hello, then modify it to take a name argument.", source: codexPatch },
  { provider: "codex", transport: "exec", id: "codex-delegate", label: "Spawned agent", blurb: "A spawned agent writes nothing to this stream; its transcript lives under the receiver thread id.", prompt: "Use a subagent to print three greetings, then summarize.", source: codexDelegate },
  { provider: "codex", transport: "exec", id: "codex-failing", label: "Failed command", blurb: "A non-zero exit code, so failure is a fact the wire states rather than something inferred from prose.", prompt: "Run 'cat /nonexistent/definitely-missing-file' and tell me what happened.", source: codexFailing },
  { provider: "codex", transport: "exec", id: "codex-websearch", label: "Web search", blurb: "A search item, which opens and settles like any other call.", prompt: "Search the web for the current version of the TypeScript compiler.", source: codexWebsearch },
  { provider: "codex", transport: "exec", id: "codex-resume", label: "Resume", blurb: "Two processes, one thread id — a resume is no more visible here than it is on Claude.", prompt: "Remember the number 47… then, resumed: what number did I ask you to remember?", source: `${codexResumeOne}\n${codexResumeTwo}` },

  { provider: "codex", transport: "app-server", id: "codex-appserver", label: "Tools", blurb: "The other Codex protocol. It carries the prompt in the client's own request and streams the answer as agentMessage deltas — neither of which `exec --json` does.", prompt: "Create notes.txt with two lines, then run 'wc -l notes.txt'.", source: codexAppServerTools },
  { provider: "codex", transport: "acp", id: "codex-acp", label: "Tools over ACP", blurb: "Codex through the ACP adapter, read by the same reader as Claude's and opencode's. Streams where exec does not, and reports its sandbox modes — read-only, auto, full-access.", prompt: "Create notes.txt with two lines, then run 'wc -l notes.txt'.", source: acpCodexTools },

  // ---------- cursor ----------
  { provider: "cursor", transport: "stream", id: "cursor-printed", label: "Plain text", blurb: "Timestamped assistant lines are text deltas; the final assistant line has no timestamp. Thinking streams the same way, then commits on thinking/completed.", prompt: "Reply with exactly the word hello and nothing else. Do not use tools.", source: cursorPrinted },
  { provider: "cursor", transport: "stream", id: "cursor-tools", label: "Tools", blurb: "Edit and Read arrive as camelCase tool envelopes that open and settle — and Edit publishes a unified diff on completion.", prompt: "Create a file named hello.txt containing the text hi. Then read it back and confirm.", source: cursorTools },
  { provider: "cursor", transport: "stream", id: "cursor-shell", label: "Shell + search", blurb: "A shell command reports its own exit code; Grep settles with structured match results.", prompt: "Run: echo hello-from-shell. Then search hello.txt for hi.", source: cursorShell },
  { provider: "cursor", transport: "stream", id: "cursor-subagent", label: "Spawned agent", blurb: "Task spawns a Cursor agent whose own events never reach this stream — the parent only sees the call open, then the child's final report on completion.", prompt: "Use the Task tool to spawn a quick explore subagent that lists workspace root files.", source: cursorSubagent },
  { provider: "cursor", transport: "acp", id: "cursor-acp-printed", label: "Plain text over ACP", blurb: "The same agent on ACP: authenticate with cursor_login, then session/new advertises models and modes. Chunks stream as agent_message_chunk / agent_thought_chunk.", prompt: "Reply with exactly the word hello and nothing else. Do not use tools.", source: acpCursorPrinted },
  { provider: "cursor", transport: "acp", id: "cursor-acp-tools", label: "Tools over ACP", blurb: "Approvals land as session/request_permission (allow-once / allow-always / reject-once). Edit updates name locations and carry a diff content block.", prompt: "Create notes.txt with two lines, then run wc -l notes.txt.", source: acpCursorTools },

  // ---------- opencode ----------
  { provider: "opencode", transport: "run", id: "oc-printed", label: "Plain text", blurb: "Three lines for a whole turn. No init, no deltas, no terminator of its own — a step opens, a part carries the answer, a step finishes.", prompt: "Reply with exactly: hello world. Do not use any tools.", source: opencodePrinted },
  { provider: "opencode", transport: "run", id: "oc-tools", label: "Tools", blurb: "Each call arrives settled: one line carrying the input it ran with and the result it produced, so a row opens and closes together.", prompt: "Create notes.txt with three lines, read it back, then run 'wc -l notes.txt'.", source: opencodeTools },
  { provider: "opencode", transport: "run", id: "oc-todos", label: "Plan", blurb: "The plan is a tool call — todowrite republishes the whole list, and the turn is six steps deep because a tool loop finishes a step per call.", prompt: "Use your todo list to plan and do three steps: create a.txt, create b.txt, then run 'ls *.txt'.", source: opencodeTodos },
  { provider: "opencode", transport: "run", id: "oc-subagent", label: "Subagent", blurb: "The one thing opencode does better than both others: the delegation names the child's own session id, and `opencode export` reads it.", prompt: "Use a subagent to find out what files are in this directory, then tell me what it found.", source: opencodeSubagent },
  { provider: "opencode", transport: "run", id: "oc-failing", label: "Failed command", blurb: "The trap in this wire: the call settles as completed because the tool worked, and the failure is only in metadata.exit.", prompt: "Run 'cat ./definitely-missing-file.txt' and tell me what happened.", source: opencodeFailing },
  { provider: "opencode", transport: "run", id: "oc-rejected", label: "Refused call", blurb: "Unattended, a permission rule auto-rejects — and then the run just ends. No closing message, no terminator: a turn that stops rather than finishes.", prompt: "Create a file at /etc/opencode-probe.txt, then tell me whether it worked.", source: opencodeRejected },
  { provider: "opencode", transport: "run", id: "oc-websearch", label: "Web search", blurb: "opencode's web search is an MCP tool that calls out to a third-party search service, so the result arrives as a search payload rather than as prose.", prompt: "Search the web for the current version of the TypeScript compiler and tell me in one line.", source: opencodeWebsearch },
  { provider: "opencode", transport: "run", id: "oc-overflow", label: "Context overrun", blurb: "28 steps reading a generated corpus until the context passed 232k against a 200k window. opencode never compacted — the run ended on an upstream error instead, which is the one thing Claude's compaction exists to avoid.", prompt: "Read every one of 32 generated files in full, one at a time, replying with only the filename.", source: opencodeOverflow },
  { provider: "opencode", transport: "run", id: "oc-resume", label: "Resume + model swap", blurb: "Two processes, one session id, and a different model on the second — which the wire never mentions, because it names a model only inside a delegation.", prompt: "Remember the number 47… then, resumed on another model: what number did I ask you to remember?", source: `${opencodeResumeOne}\n${opencodeResumeTwo}` },

  { provider: "opencode", transport: "serve", id: "oc-sse-printed", label: "Streamed answer", blurb: "The server's bus, where opencode does stream: 254 token deltas for one paragraph, each joinable to the part that supersedes it. Its `/event` endpoint is server-wide, so this capture carries a second session too.", prompt: "Write one paragraph of four sentences about the tide. Do not use tools.", source: opencodeSsePrinted },
  { provider: "opencode", transport: "serve", id: "oc-sse-tools", label: "Streamed + refused", blurb: "The same bus with a tool call: arguments stream as partial JSON, the session names its model, and a permission ask is held open and answered rather than auto-rejected.", prompt: "Create sse-notes.txt with two lines, then run 'wc -l sse-notes.txt'.", source: opencodeSseTools },
  { provider: "opencode", transport: "acp", id: "oc-acp-printed", label: "Plain text", blurb: "The Agent Client Protocol over stdio: a conversation, not a stream. Nine frames, and the client's own request is what carries the prompt. The one-way stream never echoes it; the bus repeats it back as a part.", prompt: "Reply with exactly: hello world. Do not use any tools.", source: opencodeAcpPrinted },
  { provider: "opencode", transport: "acp", id: "oc-acp-tools", label: "Tools", blurb: "Thoughts and prose stream as separate chunk kinds, and a call opens before it settles, the way the bus also republishes a running one. The kind is the protocol's, not a guess from a tool's name.", prompt: "Create acp-notes.txt with two lines, then run 'wc -l acp-notes.txt'.", source: opencodeAcpTools },
  { provider: "opencode", transport: "serve", id: "oc-sse-plan", label: "Plan", blurb: "The same todo list as the one-way stream, arriving as settled parts between the token deltas.", prompt: "Use your todo list to plan and do three steps: create a.txt, create b.txt, then run 'ls *.txt'.", source: opencodeSsePlan },
  { provider: "opencode", transport: "serve", id: "oc-sse-subagent", label: "Subagent", blurb: "A delegation on the bus — and because `/event` is server-wide, the child's own session publishes here too rather than being hidden behind the call.", prompt: "Use a subagent to find out what files are in this directory, then tell me what it found.", source: opencodeSseSubagent },
  { provider: "opencode", transport: "serve", id: "oc-sse-websearch", label: "Web search", blurb: "A search tool call, with its arguments streaming in as partial JSON before the results settle.", prompt: "Search the web for the current version of the TypeScript compiler.", source: opencodeSseWebsearch },
  { provider: "opencode", transport: "acp", id: "oc-acp-plan", label: "Plan", blurb: "ACP has a plan update of its own, but opencode does not use it: the todo list arrives as a `todowrite` tool call, and its list rides on the call's input while it is still running.", prompt: "Use your todo list to plan and do three steps: create a.txt, create b.txt, then run 'ls *.txt'.", source: opencodeAcpPlan },
  { provider: "opencode", transport: "acp", id: "oc-acp-subagent", label: "Subagent", blurb: "A delegation, which ACP labels with the protocol's own `think` kind. The child session id is named only inside the result text — the one place this wire puts it.", prompt: "Use a subagent to find out what files are in this directory, then tell me what it found.", source: opencodeAcpSubagent },
  { provider: "opencode", transport: "acp", id: "oc-acp-websearch", label: "Web search", blurb: "A search call, renamed by the agent as it goes: it opens as `websearch` and settles under the query it ran.", prompt: "Search the web for the current version of the TypeScript compiler.", source: opencodeAcpWebsearch },
  { provider: "opencode", transport: "acp", id: "oc-acp-permission", label: "Approval", blurb: "The agent asks the client for permission and blocks until answered, listing the options it will accept. Answered allow here, so the write went through.", prompt: "Create a file at /tmp/acp-outside-probe.txt, then tell me whether it worked. (Answered: allow once)", source: opencodeAcpPermission },
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
/**
 * What this provider can and cannot report.
 *
 * Shown rather than hidden because the differences are the interesting part:
 * a surface missing for Codex is missing because the wire does not carry it,
 * and a reader comparing the two should be able to see that without opening
 * the raw pane.
 */
function ProviderSupport({ provider, transport }: { provider: Provider; transport: TransportDescriptor }) {
  // Read from the transport descriptor rather than listed here: adding a
  // provider adds a row in the library, and this row follows without an edit.
  const features: readonly (readonly [string, Supported])[] = [
    ["streams tokens", transport.supports.streaming],
    ["names the model", transport.supports.namesModel],
    ["structured file edits", transport.supports.fileEdits],
    ["session capabilities", transport.supports.capabilities],
    ["approvals", transport.supports.approvals],
    ["steering", transport.supports.steering],
    ["shared bus, filter by session", transport.supports.sharedBus],
    // Still the provider's own, since neither is a property of the wire.
    ["workflow board", provider.supports.workflowBoard],
    ["transcripts on disk", provider.supports.transcriptsOnDisk],
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="provider-support">
      <code className="text-muted-foreground">{transport.command}</code>
      {features.map(([label, supported]) => (
        <Badge key={label} variant={supported === true ? "secondary" : "outline"} className={supported === true ? "" : "opacity-60"}>
          {/* Three states, because "nobody has captured this" is not the same
              answer as "it cannot". */}
          {supported === true ? label : supported === false ? `no ${label}` : `${label}: unrecorded`}
        </Badge>
      ))}
    </div>
  )
}

/** Whether a capture's transport publishes more than one session on one stream. */
function sharedBusCapture(captureId: string): boolean {
  const capture = CAPTURES.find((entry) => entry.id === captureId)
  if (capture === undefined) return false
  return transportOf(capture.provider, capture.transport ?? "")?.supports.sharedBus === true
}

/** What a fold looks like before its first event, on a bus whose session is not yet known. */
const EMPTY_TRANSCRIPT: Transcript = new TranscriptBuilder().snapshot()

/** Which provider a capture came from. */
function providerOf(captureId: string): ProviderId {
  return CAPTURES.find((entry) => entry.id === captureId)?.provider ?? "claude"
}

/**
 * The mapper a capture has to be read with.
 *
 * Taken from the capture rather than from whatever the toggle is showing: a
 * recording belongs to the wire it came from, and reading opencode's bus with
 * its one-way mapper would decode every frame as unknown.
 */
function mapperFor(captureId: string): StoryMapper {
  const capture = CAPTURES.find((entry) => entry.id === captureId)
  if (capture?.provider === "openai") {
    return new OpenAIAgentsMapper({ sessionId: "storybook-openai", model: "gpt-test", agentToolNames: capture.agentToolNames })
  }
  const provider = PROVIDERS[capture?.provider ?? "claude"]
  return provider.createMapper(capture?.transport ?? provider.transports[0]!.id)
}

function useLiveTranscript(captureId: string, count: number, live: boolean): LiveState {
  const state = React.useRef<{
    captureId: string
    count: number
    mapper: StoryMapper
    builder: TranscriptBuilder | null
    buffers: Map<string, string>
    events: AgentEvent[]
    produced: number[]
    finished: boolean
  } | null>(null)

  const lines = LINES.get(captureId) ?? []
  let current = state.current
  if (current === null || current.captureId !== captureId || current.count > count) {
    current = {
      captureId,
      count: 0,
      mapper: mapperFor(captureId),
      // On a bus the builder cannot be made until a session is known, because
      // a transcript is one conversation and the stream carries several.
      builder: sharedBusCapture(captureId) ? null : new TranscriptBuilder(),
      buffers: new Map(),
      events: [],
      produced: [],
      finished: false,
    }
    state.current = current
  }

  // Clamped to the capture that is actually loaded. `count` is state and the
  // capture can change under it — switching provider mid-playback leaves the
  // previous capture's line count in place for a render, and reading past the
  // end of the new one hands the mapper an undefined line.
  const target = Math.min(count, lines.length)
  for (let index = current.count; index < target; index += 1) {
    const line = lines[index]
    if (line === undefined) break
    const mapped = current.mapper.push(line)
    current.produced.push(mapped.length)
    current.events.push(...mapped)
    // The first session seen is the one being watched; the rest of the bus —
    // a subagent's own session, another window's work — is filtered out rather
    // than folded into this conversation.
    if (current.builder === null && mapped[0] !== undefined) {
      current.builder = new TranscriptBuilder({ sessionId: mapped[0].sessionId })
    }
    current.builder?.push(mapped)
    applyDeltas(mapped, current.buffers)
  }
  current.count = target

  if (target === lines.length && !current.finished && current.mapper.finish !== undefined) {
    const terminal = current.mapper.finish({ status: CAPTURES.find((entry) => entry.id === captureId)?.finishStatus })
    current.events.push(...terminal)
    current.builder?.push(terminal)
    current.finished = true
  }

  return {
    events: current.events,
    produced: current.produced,
    transcript: current.builder?.snapshot({ live }) ?? EMPTY_TRANSCRIPT,
    previews: current.buffers,
  }
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

/**
 * On-disk transcripts, by the id the stream reports.
 *
 * A host reaches these through the path contract in `store.ts`; the story ships
 * two of them as fixtures so the opened views are real rather than mocked.
 */
const DISK_TRANSCRIPTS: Readonly<Record<string, string>> = {
  a37fefefbc61e13e3: diskSubagent,
  a35ea63276cd501aa: diskWorkflowAgent,
}

/**
 * opencode's exported sessions, by the child session id its own stream names.
 *
 * Where Claude's have to be located on disk from a path contract, opencode
 * hands the id over on the spawning call — so a host runs one command and gets
 * the conversation. The story ships the answer that command returned.
 */
const OPENCODE_EXPORTS: Readonly<Record<string, string>> = {
  ses_fb47fb139ffeWc3UUbQebXLJ1h: opencodeExportSubagent,
}

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
    // The harness writes its own messages into the user's lane — after a
    // compaction it injects the summary as "This session is being continued…".
    // Drawing it as the user's words puts something in their mouth, and it is
    // machinery the divider above it already accounts for.
    if (payload.synthetic) return null
    return (
      <Message from="user">
        <MessageContent>
          <MessageBubble variant="muted">{payload.text}</MessageBubble>
        </MessageContent>
      </Message>
    )
  }
  // Edits are not drawn where they happen. A turn touches the same files
  // repeatedly and interleaves them with the calls that made them, so inline
  // rows read as noise between the steps; the turn's changed files are one
  // summary at the end, which is the question a reader actually has.
  if (payload.type === "file_edits") return null
  if (payload.type === "error") {
    return <p className="text-destructive text-xs">{payload.message}</p>
  }
  // A compaction is not a step the agent took — it happened *to* the
  // conversation — so it marks the transcript with a rule rather than taking a
  // card's weight beside the work it sits between.
  if (payload.type === "context_compacted") {
    const summary = compactionSummary(transcript, item.seq)
    return (
      <TranscriptDivider
        meta={compactionDetail(payload)}
        data-testid="compaction-boundary"
        detail={
          summary === null ? null : (
            <div className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-3 whitespace-pre-wrap">
              {summary}
            </div>
          )
        }
      >
        {payload.trigger === "manual" ? "Context compacted on request" : "Context compacted"}
      </TranscriptDivider>
    )
  }
  return null
}

/** Rounds a token count the way a reader reads it, not the way it is billed. */
function tokens(value: number | null): string | null {
  if (value === null) return null
  return value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value)
}

/**
 * What the boundary is worth saying out loud: how much smaller the window got,
 * and how long the agent was busy doing it. The cumulative figure is left to
 * the raw pane — it is a session total, and this row is about one moment.
 */
function compactionDetail(payload: Extract<AgentEventPayload, { type: "context_compacted" }>): string | null {
  const before = tokens(payload.preTokens)
  const after = tokens(payload.postTokens)
  const seconds = payload.durationMs === null ? null : `${Math.round(payload.durationMs / 1000)}s`
  const size = before !== null && after !== null ? `${before} → ${after} tokens` : null
  return [size, seconds].filter((part) => part !== null).join(" · ") || null
}

/**
 * The summary the agent carries forward in place of the history it dropped.
 *
 * The harness writes it into the user's lane as a synthetic message right
 * after the boundary. It is worth keeping — it is the only record of what
 * survived the drop — but not worth putting in the user's voice, so it hides
 * behind the marker rather than being drawn as something they said.
 */
function compactionSummary(transcript: Transcript, seq: number): string | null {
  for (const event of transcript.events) {
    if (event.seq <= seq) continue
    if (event.payload.type !== "user_message") continue
    return event.payload.synthetic ? event.payload.text : null
  }
  return null
}

/**
 * A turn's cost, at the precision it actually has.
 *
 * Two cents rounds to "$0.02", but a run on a free model costs exactly nothing
 * and must say so rather than being rounded into looking like a rounding error.
 */
function formatCost(usd: number): string {
  if (usd === 0) return "free"
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`
}

/** A field a provider left unset, so the surface can omit it rather than print a placeholder. */
function known(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === "" || value === "unknown" ? null : value
}

/**
 * Every file a turn touched, once.
 *
 * A turn can edit the same path several times; the reader wants the set of
 * files that changed, not a replay of each write, so the last change to a path
 * wins and the order follows first touch.
 */
function turnFileEdits(work: readonly WorkItem[]): readonly FileEdit[] {
  const byPath = new Map<string, FileEdit>()
  for (const item of work) {
    if (isToolGroup(item) || item.payload.type !== "file_edits") continue
    for (const edit of item.payload.edits) byPath.set(edit.path, edit)
  }
  return [...byPath.values()]
}

function TurnFileEdits({ edits }: { edits: readonly FileEdit[] }) {
  if (edits.length === 0) return null
  return (
    <FileDiffCard defaultExpanded itemCount={edits.length} data-testid="file-edits">
      <FileDiffCardHeader>
        <FileDiffCardIcon>
          <EditIcon />
        </FileDiffCardIcon>
        <FileDiffCardHeading>
          <FileDiffCardTitle>{`Changed ${edits.length} file${edits.length === 1 ? "" : "s"}`}</FileDiffCardTitle>
        </FileDiffCardHeading>
      </FileDiffCardHeader>
      <FileDiffList aria-label="Changed files">
        {edits.map((edit) => (
          <FileDiffListItem key={edit.path}>
            <FileDiffPath path={edit.path} />
            <Badge variant="outline" className="ml-auto">
              {edit.change}
            </Badge>
          </FileDiffListItem>
        ))}
      </FileDiffList>
    </FileDiffCard>
  )
}

function TranscriptView({
  transcript,
  previews,
  prompt,
  provider,
}: {
  transcript: Transcript
  previews: DeltaBuffers
  prompt: string
  provider: Provider
}) {
  const session = transcript.session
  // A model change is the one session-level shift the stream actually proves;
  // "resumed" is not on the wire at all, so nothing here claims it.
  const swap = transcript.events.find((event) => event.payload.type === "model_changed")
  const modelSwap = swap === undefined || swap.payload.type !== "model_changed" ? null : swap.payload.to
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Codex's thread line names no model or sandbox, so those badges are
            absent rather than reading "unknown" — the provider did not say. */}
        <Badge>{session === null ? "no session yet" : known(session.model) ?? provider.label}</Badge>
        {known(session?.permissionMode) === null ? null : (
          <Badge variant="secondary">{session!.permissionMode}</Badge>
        )}
        {transcript.sessions.length > 1 ? <Badge variant="outline">{transcript.sessions.length} inits</Badge> : null}
        {modelSwap === null ? null : <Badge variant="outline">{`model → ${modelSwap}`}</Badge>}
        {transcript.usage === null ? null : (
          <span className="text-muted-foreground text-xs">
            {transcript.usage.totalTokens?.toLocaleString() ?? "—"} tokens
            {/* Only where a provider priced the turn. Claude and opencode both
                do; Codex reports counts and no cost, and a "$0.00" invented for
                it would read as free rather than as unreported. */}
            {transcript.usage.totalCostUsd === undefined || transcript.usage.totalCostUsd === null
              ? null
              : ` · ${formatCost(transcript.usage.totalCostUsd)}`}
          </span>
        )}
      </div>

      {transcript.plan.length === 0 ? null : (
        <TaskList aria-label="Agent plan" className="border-border rounded-xl border p-3">
          {transcript.plan.map((step, index) => (
            <TaskListItem key={step.id ?? `step:${index}`} status={planStatus(step)}>
              {step.content}
            </TaskListItem>
          ))}
        </TaskList>
      )}

      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport className="px-1">
          <MessageScrollerContent aria-label="Agent transcript">
            {/* Only where the wire does not carry it. Most of these streams
                never echo the prompt, so the host is the only thing that knows
                what it asked — but ACP sends it in the client's own request,
                and printing both would show the question twice. */}
            {transcript.events.some((event) => event.payload.type === "user_message") ? null : (
              <Message from="user">
                <MessageAvatar fallback="You" alt="You" />
                <MessageContent>
                  <MessageHeader>host-supplied — headless never echoes the prompt</MessageHeader>
                  <MessageBubble variant="muted">{prompt}</MessageBubble>
                </MessageContent>
              </Message>
            )}
            {transcript.turns.map((turn) => (
              <div key={turn.key} className="flex flex-col gap-3 py-2">
                {turn.prompt === null || turn.prompt.payload.type !== "user_message" || turn.prompt.payload.synthetic ? null : (
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
                {/* Last in the turn: what changed on disk is the turn's
                    outcome, not a step within it. */}
                <TurnFileEdits edits={turnFileEdits(turn.work)} />
              </div>
            ))}
            {/* Bottom of the transcript, because it is happening now: the
                summary call can run for the better part of a minute, and a
                view that shows nothing for that long reads as hung. */}
            {isCompacting(transcript.events) ? (
              <TranscriptDivider pending data-testid="compacting">
                Compacting…
              </TranscriptDivider>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </div>
  )
}

/** The raw side: the bytes as they arrived, and the events they became, selectable against each other. */
/**
 * One capabilities pane for every provider.
 *
 * The shape is shared and every section is nullable, so a provider that cannot
 * report something leaves it null and the section is absent — no per-provider
 * branch here, and no empty list pretending to be an answer. Where the answers
 * come from stays each provider's business: Claude advertises itself on its
 * event stream, Codex answers a separate interactive channel.
 */
function CapabilitiesView({ capabilities }: { capabilities: AgentCapabilities | null }) {
  if (capabilities === null) return <p className="text-muted-foreground text-xs">Nothing advertised yet.</p>
  const unreported = unreportedCapabilities(capabilities)
  const commands = capabilities.commands

  return (
    <div className="flex flex-col gap-3 text-xs">
      {capabilities.models === null ? null : (
        <Section title={`Models (${capabilities.models.length})`}>
          <ul className="space-y-1">
            {capabilities.models.map((model) => (
              <li key={model.id} className="flex items-center gap-2">
                <Badge variant={model.isDefault ? "default" : "outline"}>{model.label}</Badge>
                <span className="text-muted-foreground min-w-0 truncate">{model.description}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {commands === null ? null : (
        <Section title={`Slash commands (${commands.length})`}>
          {(["skill", "plugin", "session", "terminal"] as const).map((source) => {
            const group = commands.filter((command) => command.source === source)
            if (group.length === 0) return null
            return (
              <div key={source} className="mb-2">
                <p className="text-muted-foreground mb-1 uppercase">{source}</p>
                <div className="flex flex-wrap gap-1">
                  {group.map((command) => (
                    <Badge key={command.name} variant="secondary">{`/${command.name}`}</Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </Section>
      )}

      {capabilities.skills === null ? null : (
        <Section title={`Skills (${capabilities.skills.length})`}>
          <div className="flex flex-wrap gap-1">
            {capabilities.skills.map((skill) => (
              <Badge key={skill.name} variant="secondary">{`/${skill.name}`}</Badge>
            ))}
          </div>
        </Section>
      )}

      {capabilities.mcpServers === null ? null : (
        <Section title={`MCP servers (${capabilities.mcpServers.length})`}>
          <ul className="space-y-1">
            {capabilities.mcpServers.map((server) => (
              <li key={server.name} className="flex items-center gap-2">
                <Badge variant={server.connected ? "default" : "outline"}>{server.status}</Badge>
                <span>{server.name}</span>
                <span className="text-muted-foreground ml-auto">{`${server.tools.length} tools`}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {capabilities.agents === null ? null : (
        <Section title={`Subagents (${capabilities.agents.length})`}>
          <div className="flex flex-wrap gap-1">
            {capabilities.agents.map((agent) => (
              <Badge key={agent} variant="outline">{agent}</Badge>
            ))}
          </div>
        </Section>
      )}

      {capabilities.tools === null ? null : (
        <Section title={`Tools (${capabilities.tools.length})`}>
          <p className="text-muted-foreground mb-1">
            {`${capabilities.tools.filter((tool) => tool.deferred).length} arrived in a later advertisement — deferred tools loading on demand.`}
          </p>
          <div className="flex flex-wrap gap-1">
            {capabilities.tools.slice(0, 40).map((tool) => (
              <Badge key={tool.name} variant={tool.deferred ? "secondary" : "outline"}>
                {tool.name}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {capabilities.pluginSources === null ? null : (
        <Section title={`Plugin sources (${capabilities.pluginSources.length})`}>
          <ul className="space-y-1">
            {capabilities.pluginSources.map((source) => (
              <li key={source.name} className="flex items-center gap-2">
                <span>{source.name}</span>
                {/* The catalogue's real size, not the sample the reply carried. */}
                <span className="text-muted-foreground ml-auto">{`${source.count.toLocaleString()} plugins`}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {capabilities.hooks === null ? null : (
        <Section title={`Hooks (${capabilities.hooks.length})`}>
          <div className="flex flex-wrap gap-1">
            {capabilities.hooks.map((hook, index) => (
              <Badge key={`${hook.event}-${index}`} variant="outline">{hook.event ?? "hook"}</Badge>
            ))}
          </div>
        </Section>
      )}

      {unreported.length === 0 ? null : (
        <p className="text-muted-foreground">
          {`Not reported here: ${unreported.join(", ")} — absent because this transport does not carry it, not because there is none.`}
        </p>
      )}
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

/**
 * The pointer to a run's own transcript.
 *
 * Two providers answer this differently and both answers are real: Claude's is
 * derived from a path contract against the session's `init`, and opencode's is
 * the child session id it printed on the spawning call. A run neither can
 * address stays null, which is what keeps "open this subagent" from being an
 * offer the surface cannot honour.
 */
function useRunRef(run: DelegatedRun): claude.TranscriptRef | null {
  const { location, runIds } = React.useContext(TranscriptLocation)
  if (run.kind === "workflow") return null
  if (run.transcriptId !== null) {
    return {
      kind: "subagent",
      label: run.label ?? run.description ?? "subagent",
      key: run.transcriptId,
      callId: run.callId,
      // Not a path: the command that fetches it. Nothing has to be looked up
      // first, which is exactly the difference from Claude's refs.
      path: opencode.opencodeExportCommand(run.transcriptId),
      resolved: true,
      blockedBy: null,
    }
  }
  if (location === null) return null
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
      <div className="flex items-baseline gap-2 rounded-lg px-1 py-1 text-sm">
        {body}
        {/* Visible, not a tooltip: a reason only a mouse can reach is a reason
            a keyboard or screen-reader user never learns. */}
        {transcript?.blockedBy === undefined || transcript.blockedBy === null ? null : (
          <span className="text-muted-foreground min-w-0 shrink truncate text-xs">{transcript.blockedBy}</span>
        )}
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
  transport,
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
  transport: TransportDescriptor
  opened: claude.TranscriptRef | null
  onCloseTranscript: () => void
}) {
  // Per pane, and reset with the capture: raw lines and events are
  // deliberately not one-to-one, so one shared index highlights row 12 of a
  // list the detail below is not showing.
  const [pane, setPane] = React.useState<"raw" | "events" | "capabilities">("raw")
  const [selectedByPane, setSelectedByPane] = React.useState<{ raw: number; events: number }>({ raw: 0, events: 0 })
  React.useEffect(() => setSelectedByPane({ raw: 0, events: 0 }), [captureId])
  const provider = PROVIDERS[providerOf(captureId)]
  // Only Claude advertises its commands, skills and servers; asking Codex's
  // events for them would answer null, and a pane that is always empty is
  // worse than a pane that is absent.
  // Claude advertises itself on the stream; Codex answers a different channel,
  // so its capabilities come from a captured app-server reply rather than from
  // the events. Same pane, two sources, and neither invents the other's.
  // Keyed on the event count, not on `events`: the live reader appends to one
  // array and hands the same object back, so a memo on its identity is computed
  // once — against whatever the log held on the first render. After a Replay
  // that was zero events, and the pane then read "nothing advertised" for good.
  const capabilities = React.useMemo(
    () => (transport.supports.capabilities && provider.id === "claude" ? claude.sessionCapabilities(events) : null),
    [events, events.length, provider.id, transport.supports.capabilities],
  )
  const codexCaps = React.useMemo(
    () =>
      transport.supports.capabilities && provider.id === "codex"
        ? codex.codexCapabilities(codexAppServerCapabilities as unknown as Record<string, JsonValue>)
        : null,
    [provider.id, transport.supports.capabilities],
  )
  // opencode answers on a third channel again: not the stream, not a server,
  // but its own CLI listings. Captured from `opencode models` and
  // `opencode agent list`, which is all a host has to build a picker from.
  const opencodeCaps = React.useMemo(
    () =>
      transport.supports.capabilities && provider.id === "opencode"
        ? opencode.opencodeCapabilities({ models: opencodeCliModels, agents: opencodeCliAgents })
        : null,
    [provider.id, transport.supports.capabilities],
  )
  const selected = pane === "events" ? selectedByPane.events : selectedByPane.raw
  const setSelected = (index: number) =>
    setSelectedByPane((current) => ({ ...current, [pane === "events" ? "events" : "raw"]: index }))
  const lines = (LINES.get(captureId) ?? []).slice(0, count)
  const line = lines[Math.min(selected, Math.max(lines.length - 1, 0))]
  const decoded = line === undefined ? null : (JSON.parse(line) as unknown)
  const selectedEvent = events[Math.min(selected, Math.max(events.length - 1, 0))]
  const shownPane = pane === "capabilities" && !transport.supports.capabilities ? "raw" : pane

  // An opened transcript takes the panel over: it is a different conversation,
  // not another view of this one.
  if (opened !== null) return <OpenedTranscript ref_={opened} onClose={onCloseTranscript} />

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SegmentedControl aria-label="Inspector pane" value={shownPane} onValueChange={(value) => setPane(value as "raw" | "events" | "capabilities")}>
        <SegmentedControlOption value="raw">Raw wire ({lines.length})</SegmentedControlOption>
        <SegmentedControlOption value="events">Events ({events.length})</SegmentedControlOption>
        {transport.supports.capabilities ? (
          <SegmentedControlOption value="capabilities">Capabilities</SegmentedControlOption>
        ) : null}
      </SegmentedControl>

      {shownPane === "capabilities" ? (
        // A scrolling region holding only chips has nothing focusable inside
        // it, so a keyboard user cannot reach the scroll. Naming it and making
        // it a tab stop is the treatment MessageScrollerViewport gives its own
        // viewport.
        <div
          className="focus-visible:outline-ring min-h-0 flex-1 overflow-auto outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          tabIndex={0}
          role="region"
          aria-label="Session capabilities"
        >
          {/* One pane, two sources: whichever the provider filled. */}
          <CapabilitiesView capabilities={capabilities ?? codexCaps ?? opencodeCaps} />
        </div>
      ) : shownPane === "raw" ? (
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
                    aria-current={index === selected}
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
            {`→ n is how many events the line produced. ${produced.filter((entry) => entry === 0).length} of ${produced.length} produce none: `}
            {provider.silentLinesNote}
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
                  aria-current={index === selected}
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
  // An exported opencode session is read by opencode's own reader, and a
  // Claude transcript on disk by Claude's. The view below is the same either
  // way: both arrive as the same events.
  const exported = OPENCODE_EXPORTS[ref_.key]
  const parsedExport = exported === undefined ? null : opencode.parseOpencodeExport(exported)
  const source = ref_.path === null ? null : DISK_TRANSCRIPTS[ref_.key]
  const events =
    parsedExport !== null ? parsedExport.events : source === undefined || source === null ? null : mapClaudeStream(source)

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
      {parsedExport === null ? null : (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {/* What the parent's stream could not say about its own delegation:
              which model ran it, and what it cost. */}
          {known(parsedExport.info.model) === null ? null : <Badge variant="outline">{parsedExport.info.model}</Badge>}
          {parsedExport.info.totalTokens === null ? null : <span>{parsedExport.info.totalTokens.toLocaleString()} tokens</span>}
          {parsedExport.info.totalCostUsd === null ? null : <span>{formatCost(parsedExport.info.totalCostUsd)}</span>}
        </div>
      )}

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
  const provider = PROVIDERS[providerOf(captureId)]
  const [transportId, setTransportId] = React.useState(provider.transports[0]!.id)
  const transport = provider.transports.find((entry) => entry.id === transportId) ?? provider.transports[0]!
  // A capture recorded from one transport is only offered on that transport:
  // opencode's token deltas exist on its server bus and nowhere else, so
  // listing them under the one-way stream would promise a stream that has none.
  const capturesFor = (transportId: string) =>
    CAPTURES.filter(
      (entry) => entry.provider === provider.id && (entry.transport === undefined || entry.transport === transportId),
    )

  /**
   * What this transport can show, and whether it is really its own.
   *
   * Two different situations, and conflating them is what made every Claude
   * transport render the same transcript. A transport with its own recordings
   * shows them. A transport with none — Claude's stdin-open mode, which no
   * capture exercises separately — *borrows* its provider's representative
   * ones, and the note below says so rather than passing them off as its own.
   *
   * The previous code did the borrowing by accident, by leaving `captureId`
   * pointing at whatever was selected before. That silently showed one
   * transport's bytes under another's name, including for transports that do
   * have their own captures.
   */
  const own = capturesFor(transport.id)
  const borrowed = own.length === 0
  const captures = borrowed ? capturesFor(provider.transports[0]!.id) : own

  /**
   * The capture actually on screen, resolved *through* that list rather than
   * read from `captureId`, so a selection cannot survive a switch that
   * invalidates it.
   */
  const selected = captures.find((entry) => entry.id === captureId) ?? captures[0]

  // Switching transport lands on a capture that transport actually has. A
  // recording belongs to the wire it came from, so keeping the old selection
  // would show one transport's bytes while the panel claimed the other's.
  const switchTransport = (next: string) => {
    if (next === transport.id) return
    setTransportId(next)
    const direct = capturesFor(next)
    const available = direct.length === 0 ? capturesFor(provider.transports[0]!.id) : direct
    if (!available.some((entry) => entry.id === captureId) && available[0] !== undefined) {
      setCaptureId(available[0].id)
    }
  }

  // Switching provider lands on that provider's first capture, so the two
  // sides are compared on the same scenario rather than on whatever the old
  // selection happened to be.
  const switchProvider = (next: string) => {
    // The control fires on the selected option too, so without this a click on
    // the provider already showing throws away the capture and transport.
    if (next === provider.id) return
    const first = CAPTURES.find((entry) => entry.provider === next)
    if (first !== undefined) setCaptureId(first.id)
    // A transport belongs to its provider, so the selection cannot survive the
    // switch — land on the new provider's first one.
    setTransportId(PROVIDERS[next as ProviderId].transports[0]!.id)
  }
  const lines = selected === undefined ? [] : (LINES.get(selected.id) ?? [])
  const [count, setCount] = React.useState(autoplay ? 0 : lines.length)
  const [playing, setPlaying] = React.useState(autoplay)

  // Keyed on the resolved capture: switching transport can change what is on
  // screen without `captureId` changing at all, and the replay has to follow
  // what is rendered rather than what was clicked.
  React.useEffect(() => {
    const next = selected === undefined ? 0 : (LINES.get(selected.id)?.length ?? 0)
    setCount(autoplay ? 0 : next)
    setPlaying(autoplay)
  }, [selected?.id, autoplay])

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
  const { events, produced, transcript, previews } = useLiveTranscript(
    selected?.id ?? captureId,
    count,
    count < lines.length,
  )
  const capture = selected
  const [opened, setOpened] = React.useState<claude.TranscriptRef | null>(null)
  React.useEffect(() => setOpened(null), [captureId])

  const session = transcript.session
  // Claude's store only: the path is built from a Claude session's cwd and its
  // own on-disk layout. Handing it a Codex thread produced a confident
  // `~/.claude/projects/...` path for a transcript that is not there, in a
  // format this parser could not read anyway.
  const location = React.useMemo(
    () => (session === null || provider.id !== "claude" ? null : claude.sessionLocationOf("~/.claude/projects", session)),
    [session, provider.id],
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
    {/*
      Height is fixed only where the two panes sit side by side. Below that
      breakpoint they stack, and pinning the shell to one screen would give each
      pane half of it — so the shell grows and the page scrolls instead.
    */}
    <div className="border-border bg-background flex w-full flex-col gap-3 rounded-3xl border p-3 sm:p-4 lg:h-[42rem]">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl aria-label="Provider" value={provider.id} onValueChange={switchProvider} className="shrink-0">
          {Object.values(PROVIDERS).map((entry) => (
            <SegmentedControlOption key={entry.id} value={entry.id}>
              {entry.label}
            </SegmentedControlOption>
          ))}
        </SegmentedControl>
        {/* Nine captures do not fit a phone. The row scrolls itself; the
            negative margin keeps the scroll edge off the control's focus ring. */}
        <div className="-mx-1 min-w-0 max-w-full overflow-x-auto px-1">
          <SegmentedControl aria-label="Capture" value={captureId} onValueChange={setCaptureId} className="w-max">
          {captures.map((entry) => (
            <SegmentedControlOption key={entry.id} value={entry.id}>
              {entry.label}
            </SegmentedControlOption>
          ))}
          </SegmentedControl>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
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
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl aria-label="Transport" value={transport.id} onValueChange={switchTransport} className="shrink-0">
          {provider.transports.map((entry) => (
            <SegmentedControlOption key={entry.id} value={entry.id}>
              {entry.label}
            </SegmentedControlOption>
          ))}
        </SegmentedControl>
        <ProviderSupport provider={provider} transport={transport} />
      </div>
      <p className="text-muted-foreground text-xs">
        {transport.note}
        {borrowed
          ? " No capture exercises this transport on its own, so the transcript below is the one-way recording; this row describes what this transport adds to it."
          : ""}
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border-border flex min-h-[26rem] flex-col overflow-hidden rounded-2xl border p-3 lg:min-h-0">
          <TranscriptView
            transcript={transcript}
            previews={previews}
            prompt={capture?.prompt ?? ""}
            provider={provider}
          />
        </div>
        <div className="border-border flex min-h-[26rem] flex-col rounded-2xl border p-3 lg:min-h-0">
          <InspectorView
            captureId={captureId}
            transport={transport}
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
  title: "Agents/AgentStream",
  component: Explorer,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The agent stream parser, driven by captured OpenAI Agents SDK, Claude Code, Codex, Cursor Agent, opencode, and ACP event streams. Left is the transcript drawn from normalized events with Message, ToolCall, TaskList and MessageMarkdown; right is the same JSON unparsed — every wire line and every event it became, selectable through JsonTree. The player feeds lines one at a time so deltas, pending calls, handoffs, approvals, and compaction happen in arrival order.",
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

    class ClaudeStream {
        <<claude/stream/wire.ts>>
        +ClaudeWireType
        +CLAUDE_STREAM_PROVENANCE 2.1.251
        parseWireLine(line)
    }
    class CodexExec {
        <<codex/exec/wire.ts>>
        +CodexWireType
        +CODEX_EXEC_PROVENANCE 0.144.1
        parseCodexLine(line)
    }
    class CursorStream {
        <<cursor/stream/wire.ts>>
        +CursorWireType
        +CURSOR_STREAM_PROVENANCE 2026.09.02-c22c1a3
        parseCursorLine(line)
    }
    class CodexAppServer {
        <<codex/app-server/wire.ts>>
        +CodexAppServerNotification
        +schema published by the CLI
        parseCodexAppServerLine(frame)
    }
    class OpencodeRun {
        <<opencode/run/wire.ts>>
        +OpencodeRunType
        +OPENCODE_RUN_PROVENANCE 1.18.25
        parseOpencodeLine(line)
    }
    class OpencodeServer {
        <<opencode/server/wire.ts>>
        +OpencodeServerEventType
        +API 1.0.0
        parseOpencodeSseLine(frame)
    }
    class Acp {
        <<acp/ — one protocol, four agents>>
        +AcpMethod
        +AcpUpdate
        +ACP_PROVENANCE protocol 1
        parseAcpLine(frame)
    }

    class OpencodeParts {
        <<opencode/parts.ts>>
        the payload run and serve both carry
        +OpencodePartType
        +OpencodeToolName
        toolEvents(sink, part) AgentEvent[]
    }
    class EventSink {
        <<emitter.ts — shared>>
        -seq
        -openedSessions
        -partIndex
        +build(payload) AgentEvent
        +blockOf(part) BlockRef
    }

    class Mappers {
        <<one per wire — the only stateful layer>>
        ClaudeStreamMapper
        CodexStreamMapper
        CodexAppServerMapper
        CursorStreamMapper
        OpencodeRunMapper
        OpencodeServerMapper
        AcpMapper
        +push(line) AgentEvent[]
    }
    class MappingTables {
        <<data, not code — one per wire>>
        CLAUDE_EVENT_MAPPING
        CODEX_EVENT_MAPPING
        CODEX_APP_SERVER_MAPPING
        CURSOR_EVENT_MAPPING
        OPENCODE_RUN_MAPPING
        OPENCODE_SERVER_MAPPING
        ACP_MAPPING
    }

    class AgentEvent {
        <<events.ts — the shared contract>>
        +id
        +sessionId
        +seq
        +ts
        +agentPath string[]
        +payload AgentEventPayload
        +raw
    }
    class AgentEventPayload {
        <<28 variants>>
        +assistant_text
        +delta
        +tool_call_started
        +tool_call_completed
        +plan_updated
        +task_started
        +permission_requested
        +context_compacted
        +unknown
    }

    class TransportDescriptor {
        <<transports.ts — 11 transports>>
        +id
        +provenance WireProvenance
        +supports TransportSupport
    }
    class TransportSupport {
        <<true | false | null>>
        +streaming
        +approvals
        +namesModel
        +sharedBus
        +sessionControl
        +contextWindow
    }

    class TranscriptBuilder {
        <<builder.ts — shared>>
        +push(events)
        +snapshot(live) Transcript
    }
    class Transcript {
        +turns Turn[]
        +runs DelegatedRun[]
        +plan PlanStep[]
    }
    class Stores {
        <<a delegated run's own transcript>>
        claude/store.ts — derived from a path
        opencode/store.ts — named by the wire
    }
    class Capabilities {
        <<what a picker needs, answered off-stream>>
        claude/stream — from init
        codex/app-server — from JSON-RPC replies
        opencode — from CLI listings
    }

    ClaudeStream --> Mappers
    CodexExec --> Mappers
    CodexAppServer --> Mappers
    CursorStream --> Mappers
    OpencodeRun --> Mappers
    OpencodeServer --> Mappers
    Acp --> Mappers
    OpencodeRun ..> OpencodeParts : same payload
    OpencodeServer ..> OpencodeParts : same payload
    EventSink <.. Mappers : numbering and sessions
    MappingTables ..> Mappers : declares what each may emit
    Mappers --> AgentEvent : emits
    AgentEvent *-- AgentEventPayload
    AgentEvent --> TranscriptBuilder : appended
    TranscriptBuilder --> Transcript : snapshot per frame
    TransportDescriptor *-- TransportSupport
    TransportDescriptor ..> Mappers : which one to read with
    Stores ..> AgentEvent : same events from a saved session
    Capabilities ..> TransportDescriptor
`

/**
 * The exchange only an interactive transport has.
 *
 * Four of the seven wires are one-way: bytes arrive and a surface renders
 * them. ACP is a conversation, and drawing it beside the one-way flow is the
 * clearest way to show why "does this agent support approvals" is a question
 * about the transport rather than the agent.
 */
const DUPLEX = `sequenceDiagram
    autonumber
    participant UI as Surface
    participant Map as AcpMapper
    participant Agent as Claude Code, Codex, Cursor or opencode

    UI->>Agent: session/prompt carrying the prompt text
    Note over Map: the client's own request is mapped —<br/>ACP is the one wire where what was<br/>asked is on the wire at all
    Agent--)Map: session/update agent_thought_chunk
    Map--)UI: delta, streamed reasoning
    Agent--)Map: session/update tool_call, status pending
    Map--)UI: tool_call_started, kind from the protocol

    Agent->>UI: session/request_permission
    Note over Agent,UI: the tool is blocked until answered,<br/>and the options offered are the agent's
    UI->>Agent: outcome selected, allow_once
    Agent--)Map: tool_call_update, status completed
    Map--)UI: tool_call_completed plus file_edits

    Agent->>UI: session/prompt reply — stopReason and usage
    Map--)UI: turn_completed
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

export const Providers: Story = {
  parameters: storyDocumentation(
    "The same views over a different agent. Switching provider swaps only the wire module and the mapper — the transcript, the tool rows, the plan and the raw inspector are the shared layer, unchanged. What differs is what each wire can say: the strip under the captures names it, and a surface a provider cannot fill is absent rather than empty. Codex reports structured file changes, which Claude Code does not; Claude advertises its commands, skills and MCP servers, which Codex does not.",
  ),
  args: { initialCapture: "codex-patch" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Codex reports which files changed and how, so the changed-file surface
    // is present…
    await waitFor(async () => {
      await expect(canvas.getByTestId("file-edits")).toBeInTheDocument()
    })
    // …and the capabilities pane, which needs a session advertisement Codex
    // does not send, is absent rather than empty.
    await expect(canvas.queryByRole("button", { name: "Capabilities" })).toBeNull()

    // Switching provider lands on that provider's own captures and restores
    // the surfaces its wire supports.
    await userEvent.click(canvas.getByRole("button", { name: "Claude Code" }))
    await waitFor(async () => {
      await expect(canvas.getByRole("button", { name: "Capabilities" })).toBeInTheDocument()
    })
    await expect(canvas.queryByTestId("file-edits")).toBeNull()
    await expect(canvas.getByTestId("provider-support")).toHaveTextContent("streams tokens")

    // Codex's second transport answers what its stream cannot: switching to the
    // app-server restores the capabilities pane the one-way stream has no data
    // for, and the support strip flips with it.
    await userEvent.click(canvas.getByRole("button", { name: "Codex" }))
    await waitFor(async () => {
      await expect(canvas.getByRole("button", { name: "app-server" })).toBeInTheDocument()
    })
    await expect(canvas.queryByRole("button", { name: "Capabilities" })).toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: "app-server" }))
    await userEvent.click(await canvas.findByRole("button", { name: "Capabilities" }))
    await expect(canvas.getByText(/Models \(\d+\)/)).toBeInTheDocument()
  },
}

export const OpenAI: Story = {
  parameters: storyDocumentation(
    "The OpenAI Agents SDK adapter over an exercised two-request function-tool loop. It distinguishes model-request completion from run completion, pairs the SDK's executed tool output with its call, and commits the streamed answer only once.",
  ),
  args: { initialCapture: "openai-tools" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "OpenAI Agents SDK" })).toBeInTheDocument()
    await expect(canvas.getByTestId("progress")).toHaveTextContent("8/8 lines")
    await expect(canvas.getByText("Sunny")).toBeInTheDocument()
    await expect(canvas.getByTestId("provider-support")).toHaveTextContent("streams tokens")

    await userEvent.click(canvas.getByRole("button", { name: "Agent as tool" }))
    await waitFor(async () => {
      await expect(canvas.getByText("The research agent reports sunny conditions.")).toBeInTheDocument()
      await expect(canvas.getByTestId("progress")).toHaveTextContent("8/8 lines")
    })

    await userEvent.click(canvas.getByRole("button", { name: "Handoff + approval + compaction" }))
    await waitFor(async () => {
      await expect(canvas.getByTestId("progress")).toHaveTextContent("6/6 lines")
    })
    await expect(canvas.getByTestId("compaction-boundary")).toHaveTextContent("Context compacted")
  },
}

/**
 * The capability table, rendered from the library rather than described.
 *
 * The point of moving this into `transports.ts` was that a surface should read
 * what a wire can do instead of knowing it; a story that hardcoded the same
 * grid would be the drift this exists to prevent.
 */
function TransportMatrix() {
  const features = [
    ["streams tokens", "streaming"],
    ["names the model", "namesModel"],
    ["session capabilities", "capabilities"],
    ["approvals", "approvals"],
    ["steering", "steering"],
    ["structured file edits", "fileEdits"],
    ["shared bus (filter by session)", "sharedBus"],
    ["client opens sessions", "sessionControl"],
    ["context window size", "contextWindow"],
  ] as const

  const columns = AGENT_TRANSPORTS.flatMap((provider) =>
    provider.transports.map((transport) => ({ provider, transport })),
  )

  return (
    // Scrollable on its own, so it needs to be reachable from the keyboard:
    // a region a mouse can pan and a keyboard cannot is unusable without one.
    <div
      className="border-border overflow-x-auto rounded-xl border"
      tabIndex={0}
      role="region"
      aria-label="What each transport was observed to report"
    >
      <table className="w-full border-collapse text-left nessa-text-2">
        <thead>
          <tr className="border-border border-b">
            <th className="text-muted-foreground p-2 font-medium">Transport</th>
            {columns.map(({ provider, transport }) => (
              <th key={`${provider.id}/${transport.id}`} className="p-2 font-medium whitespace-nowrap">
                <span className="text-muted-foreground">{provider.label}</span> {transport.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-border border-b">
            <td className="text-muted-foreground p-2">read from build</td>
            {columns.map(({ provider, transport }) => (
              <td key={`${provider.id}/${transport.id}`} className="text-muted-foreground p-2 whitespace-nowrap">
                {transport.provenance.version}
              </td>
            ))}
          </tr>
          {features.map(([label, key]) => (
            <tr key={key} className="border-border border-b last:border-0">
              <td className="text-muted-foreground p-2">{label}</td>
              {columns.map(({ provider, transport }) => {
                const value = transport.supports[key]
                return (
                  <td key={`${provider.id}/${transport.id}`} className="p-2">
                    {/* A dash is deliberately not a no: it says nobody has
                        captured this transport for this yet. */}
                    {value === true ? "yes" : value === false ? <span className="text-muted-foreground">no</span> : "—"}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const Architecture: Story = {
  parameters: storyDocumentation(
    "How the parser is put together, now that four agents and seven wires have been read. Each transport owns its own envelope types, its own mapping table and its own mapper — they are separate protocols with separate versions, and opencode alone speaks three. Only what is genuinely identical is shared: opencode's `run` and `serve` carry the same message parts, so those are read once. Everything to the right of AgentEvent is agent-agnostic, which is what makes a fifth provider a new column here and no change to any component. The three diagrams are the structure, one line's journey on a one-way wire, and the exchange only an interactive one has.",
  ),
  args: {},
  render: () => (
    <div className="flex w-full flex-col gap-8 p-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Layers, and what each one owns</h3>
        <p className="text-muted-foreground text-sm">
          One direction of dependency, and one box per wire — seven wires carrying eleven transports across four agents. A transport supplies its own
          envelope types, its own mapping table and its own mapper; everything from AgentEvent rightwards is shared and does not
          move. Only two things are shared further left, and both because they are genuinely the same: opencode&rsquo;s one-way
          stream and its server bus carry identical message parts, and ACP is one protocol that Claude Code, Codex, Cursor Agent and
          opencode all speak.
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

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">And the exchange only an interactive transport has</h3>
        <p className="text-muted-foreground text-sm">
          Four of the seven wires are one-way; the other three are conversations. ACP is the same conversation whichever agent is
          behind it —
          Claude Code, Codex, Cursor Agent and opencode all speak it, so one reader serves all four. The agent asks the client for permission
          and blocks until answered, which is why &ldquo;does this agent support approvals&rdquo; is a question about the
          transport rather than the agent. Cursor has no HTTP <code>serve</code> bus — ACP is that interactive wire.
        </p>
        <MermaidDiagram chart={DUPLEX} className="w-full" />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">What each transport was observed to report</h3>
        <p className="text-muted-foreground text-sm">
          Read from the library&rsquo;s own table rather than restated here, so this cannot drift from what the parsers know. A
          dash means nobody has captured that transport for it yet — which is not the same answer as no.
        </p>
        <TransportMatrix />
      </section>
    </div>
  ),
}
