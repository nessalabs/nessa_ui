/** @responsibility Locates the transcripts Claude Code writes to disk, which is where a delegated run's own conversation lives. */

import { asNumber, asRecord, asString } from "../json"
import type { JsonValue } from "./stream/wire"

/**
 * Where one session's files live.
 *
 * Pure path arithmetic, no filesystem access: this module runs in the browser
 * as readily as in a host process, and reading the files is the host's job.
 */
export interface SessionLocation {
  /** Usually `~/.claude/projects`. */
  readonly projectsDir: string
  /** The session's working directory, which is what the project folder is named after. */
  readonly cwd: string
  /** From `system/init`, and stable across a resume. */
  readonly sessionId: string
}

/**
 * The project folder's name, derived from the working directory.
 *
 * Every character that cannot appear in a flat folder name becomes `-`, so
 * `/tmp/my_app` becomes `-tmp-my-app`. The rule is inferred from observed
 * directories rather than documented, so a host that can list `projectsDir`
 * should prefer matching an existing folder over trusting this.
 */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-")
}

/**
 * Whether an id from the wire can be used as one path segment.
 *
 * These ids are built into paths a host then reads, and they arrive from a
 * process this library does not control — so `..` or a slash in a session or
 * task id would address a file outside the session's own directory. Anything
 * that is not a plain segment is refused rather than escaped, because a
 * transcript that needs escaping is not a transcript this contract can name.
 */
export function isAddressableId(id: string): boolean {
  return id.length > 0 && !id.includes("/") && !id.includes("\\") && id !== "." && id !== ".."
}

/** The folder holding every session for this working directory. */
export function projectDir(location: SessionLocation): string {
  return `${location.projectsDir}/${projectSlug(location.cwd)}`
}

/** The main conversation's own log — the same shapes the stream carries, minus the deltas. */
export function sessionTranscriptPath(location: SessionLocation): string {
  return `${projectDir(location)}/${location.sessionId}.jsonl`
}

/** The per-session folder holding everything the session spawned. */
export function sessionDir(location: SessionLocation): string {
  return `${projectDir(location)}/${location.sessionId}`
}

/**
 * A subagent's full transcript, named by the `task_id` the wire already gave
 * you on `system/task_started`.
 *
 * This is the conversation the stream refuses to carry: the subagent's prompt,
 * every tool call it made, and its final message — all in the same line shapes
 * the stream uses, so the same parser reads it.
 */
export function subagentTranscriptPath(location: SessionLocation, taskId: string): string {
  return `${sessionDir(location)}/subagents/agent-${taskId}.jsonl`
}

/** A subagent's metadata sidecar, which names the tool call that spawned it. */
export function subagentMetaPath(location: SessionLocation, taskId: string): string {
  return `${sessionDir(location)}/subagents/agent-${taskId}.meta.json`
}

/** The folder of workflow run records. Each file is `<runId>.json`. */
export function workflowsDir(location: SessionLocation): string {
  return `${sessionDir(location)}/workflows`
}

/**
 * One workflow run's record: its script, phases, per-agent progress, result and
 * totals.
 *
 * Keyed by `runId`, which is **not on the wire** — the stream reports a
 * `task_id` instead. Read the records in [`workflowsDir`] and match on their
 * own `taskId` field; [`workflowRunTaskId`] pulls it out.
 */
export function workflowRunPath(location: SessionLocation, runId: string): string {
  return `${workflowsDir(location)}/${runId}.json`
}

/** One workflow agent's full transcript, named by the `agentId` from the progress board. */
export function workflowAgentTranscriptPath(
  location: SessionLocation,
  runId: string,
  agentId: string,
): string {
  return `${sessionDir(location)}/subagents/workflows/${runId}/agent-${agentId}.jsonl`
}

/** A workflow run's journal: one line per agent start and result, in completion order. */
export function workflowJournalPath(location: SessionLocation, runId: string): string {
  return `${sessionDir(location)}/subagents/workflows/${runId}/journal.jsonl`
}

/** What a subagent's `.meta.json` says. */
export interface SubagentMeta {
  readonly agentType: string | null
  readonly description: string | null
  /** The spawning tool call's id — the same `callId` the stream reported. */
  readonly toolUseId: string | null
  /** How deep the run sits. `1` is a subagent of the main thread. */
  readonly spawnDepth: number | null
}

export function parseSubagentMeta(json: string): SubagentMeta | null {
  let decoded: unknown
  try {
    decoded = JSON.parse(json)
  } catch {
    return null
  }
  const meta = asRecord(decoded as JsonValue)
  return {
    agentType: asString(meta.agentType),
    description: asString(meta.description),
    toolUseId: asString(meta.toolUseId),
    spawnDepth: asNumber(meta.spawnDepth),
  }
}

/** The `task_id` a workflow run record names, for matching a record to a run seen on the stream. */
export function workflowRunTaskId(json: string): string | null {
  try {
    return asString(asRecord(JSON.parse(json) as JsonValue).taskId)
  } catch {
    return null
  }
}

/** One line of a workflow's journal. */
export interface WorkflowJournalEntry {
  readonly type: string
  readonly agentId: string
  /** Present on a `result` line: what that agent returned, whole rather than previewed. */
  readonly result: JsonValue | null
}

/**
 * Reads a workflow's journal.
 *
 * The board on the stream previews each agent's result; this carries it in
 * full, which is what a host reaches for when a preview is not enough and the
 * agent's own transcript is more than the reader asked for.
 */
export function parseWorkflowJournal(text_: string): readonly WorkflowJournalEntry[] {
  const entries: WorkflowJournalEntry[] = []
  for (const line of text_.split("\n")) {
    if (line.trim().length === 0) continue
    let decoded: unknown
    try {
      decoded = JSON.parse(line)
    } catch {
      continue
    }
    const entry = asRecord(decoded as JsonValue)
    const agentId = asString(entry.agentId)
    if (agentId === null) continue
    entries.push({ type: asString(entry.type) ?? "unknown", agentId, result: entry.result ?? null })
  }
  return entries
}

/**
 * A pointer to one conversation on disk.
 *
 * The unit a host opens: enough to name the thing in a list, find its bytes,
 * and — when the path cannot be built yet — say what is missing instead of
 * silently producing a path that resolves to nothing.
 */
export interface TranscriptRef {
  readonly kind: "session" | "subagent" | "workflow_agent"
  /** What to call it in a list of open transcripts. */
  readonly label: string
  /** The id this transcript is addressed by: a `task_id` or an `agentId`. */
  readonly key: string
  /** The spawning tool call, where one exists, so a ref links back to its row. */
  readonly callId: string | null
  /** Absolute path, or null when [`resolved`](Self::resolved) is false. */
  readonly path: string | null
  /** False when something must be looked up before the path can be built. */
  readonly resolved: boolean
  /** What the host has to do to resolve it. Null once resolved. */
  readonly blockedBy: string | null
}

/** Derives a session's location from its own `init`, so a host supplies only the projects directory. */
export function sessionLocationOf(
  projectsDir: string,
  session: { readonly cwd: string | null; readonly sessionId: string },
): SessionLocation | null {
  // The project folder is named after the working directory, so a session that
  // never reported one cannot be addressed on disk. Null says that plainly
  // rather than building a path rooted at an empty string.
  if (session.cwd === null || session.cwd === "") return null
  // An id that is not a plain path segment cannot name a folder, and building
  // one anyway would hand a host a path outside the projects directory.
  if (!isAddressableId(session.sessionId)) return null
  return { projectsDir, cwd: session.cwd, sessionId: session.sessionId }
}

/** Where a subagent's conversation lives. Always resolvable: the wire gave the `task_id` up front. */
export function subagentTranscriptRef(
  location: SessionLocation,
  run: { readonly taskId: string | null; readonly callId: string; readonly label: string | null },
): TranscriptRef {
  if (run.taskId === null) {
    return {
      kind: "subagent",
      label: run.label ?? "Subagent",
      key: run.callId,
      callId: run.callId,
      path: null,
      resolved: false,
      blockedBy: "no task id yet — the run has not reported task_started",
    }
  }
  if (!isAddressableId(run.taskId)) {
    return {
      kind: "subagent",
      label: run.label ?? "Subagent",
      key: run.callId,
      callId: run.callId,
      path: null,
      resolved: false,
      blockedBy: "the task id is not a path segment, so it cannot name a file",
    }
  }
  return {
    kind: "subagent",
    label: run.label ?? "Subagent",
    key: run.taskId,
    callId: run.callId,
    path: subagentTranscriptPath(location, run.taskId),
    resolved: true,
    blockedBy: null,
  }
}

/**
 * Where one workflow agent's conversation lives.
 *
 * `runId` is the catch: it is never on the stream, so a caller that has not
 * matched a record in [`workflowsDir`] gets an unresolved ref naming exactly
 * that, rather than a plausible path that leads nowhere.
 */
export function workflowAgentTranscriptRef(
  location: SessionLocation,
  runId: string | null,
  agent: { readonly agentId: string | null; readonly label: string; readonly index: number },
  callId: string | null = null,
): TranscriptRef {
  const key = agent.agentId
  if (key === null) {
    return {
      kind: "workflow_agent",
      label: agent.label,
      key: String(agent.index),
      callId,
      path: null,
      resolved: false,
      blockedBy: "the agent has not started, so it has no id yet",
    }
  }
  if (runId === null) {
    return {
      kind: "workflow_agent",
      label: agent.label,
      key,
      callId,
      path: null,
      resolved: false,
      blockedBy: `run id unknown — read ${workflowsDir(location)} and match a record whose taskId is this run's`,
    }
  }
  return {
    kind: "workflow_agent",
    label: agent.label,
    key,
    callId,
    path: workflowAgentTranscriptPath(location, runId, key),
    resolved: true,
    blockedBy: null,
  }
}

/**
 * Every conversation this session produced, as pointers.
 *
 * One list, main thread included, so a host can render a switcher over "the
 * transcripts in play" without knowing which kind of run produced each.
 * Workflow agents come back unresolved unless their run id is supplied — the
 * ref says so rather than guessing.
 */
export function collectTranscriptRefs(
  location: SessionLocation,
  runs: readonly {
    readonly kind: string
    readonly taskId: string | null
    readonly callId: string
    readonly label: string | null
    readonly phases: readonly { readonly agents: readonly { readonly agentId: string | null; readonly label: string; readonly index: number }[] }[]
  }[],
  /** Workflow run ids by the `task_id` the stream reported, when the host has read the records. */
  runIdByTaskId: ReadonlyMap<string, string> = new Map(),
): readonly TranscriptRef[] {
  const refs: TranscriptRef[] = [
    {
      kind: "session",
      label: "Main conversation",
      key: location.sessionId,
      callId: null,
      path: sessionTranscriptPath(location),
      resolved: true,
      blockedBy: null,
    },
  ]

  for (const run of runs) {
    if (run.kind === "workflow") {
      const runId = run.taskId === null ? null : (runIdByTaskId.get(run.taskId) ?? null)
      for (const phase of run.phases) {
        for (const agent of phase.agents) {
          refs.push(workflowAgentTranscriptRef(location, runId, agent, run.callId))
        }
      }
      continue
    }
    // Only an agent has a transcript at this path. A background shell or a
    // run of another kind has none, and offering one as `resolved` sends a
    // host to open a file that was never written.
    if (run.kind !== "agent") continue
    refs.push(subagentTranscriptRef(location, run))
  }

  return refs
}
