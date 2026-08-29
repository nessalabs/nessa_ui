/** @responsibility States, as data, which `opencode serve` SSE event becomes which normalized event. */

import { AgentEventType } from "../../events"
import type { OpencodeMappingEntry } from "../mapping"
import { OpencodeServerEventType } from "./wire"

/**
 * The server bus's own table.
 *
 * Separate from the one-way stream's because they are separate protocols with
 * separate versions, against the same contract on the other side. A kind
 * missing from here is a frame nobody decided about.
 */
export const OPENCODE_SERVER_MAPPING: Readonly<Record<string, OpencodeMappingEntry>> = Object.freeze({  [OpencodeServerEventType.SessionCreated]: {
    emits: [],
    note: "an id, a directory and a build, but no model and no agent — the update that follows immediately is the first line that describes the session",
  },
  [OpencodeServerEventType.SessionUpdated]: {
    emits: [AgentEventType.SessionStarted, AgentEventType.ModelChanged],
    note: "the init `run --format json` never sends: model, agent, working directory, version and the session's own permission rules. Republished on every change, so only a different model is an event after the first",
  },
  [OpencodeServerEventType.SessionStatus]: {
    emits: [AgentEventType.StatusChanged],
    note: "busy or idle, which is what says whether the agent is working",
  },
  [OpencodeServerEventType.SessionIdle]: {
    emits: [AgentEventType.TurnCompleted],
    note: "the turn's real terminator on this transport: the agent has stopped, whatever its last step said",
  },
  [OpencodeServerEventType.MessageUpdated]: {
    emits: [],
    note: "a message's running totals, republished as it grows; the step that finishes carries the same counts and closes something",
  },
  [OpencodeServerEventType.MessagePartUpdated]: {
    emits: [
      AgentEventType.UserMessage,
      AgentEventType.AssistantText,
      AgentEventType.Reasoning,
      AgentEventType.ToolCallStarted,
      AgentEventType.ToolCallCompleted,
      AgentEventType.PlanUpdated,
      AgentEventType.FileEdits,
      AgentEventType.TaskStarted,
      AgentEventType.TaskCompleted,
      AgentEventType.TurnCompleted,
    ],
    note: "a settled part, in exactly the shapes the one-way stream sends — so the same code reads both, and what it emits depends on which part arrived",
  },
  [OpencodeServerEventType.MessagePartDelta]: {
    emits: [AgentEventType.Delta],
    note: "the token stream: one chunk of a part's text, reasoning or arguments, superseded by the settled part",
  },
  [OpencodeServerEventType.TodoUpdated]: {
    emits: [AgentEventType.PlanUpdated],
    note: "the plan republished whole, as its own event rather than as a tool call — the one place this bus reports something the one-way stream only implies",
  },
  [OpencodeServerEventType.FileEdited]: {
    emits: [],
    note: "a file changed; the call that changed it already published the path, and reporting it twice would double every edit",
  },
  [OpencodeServerEventType.FileWatcherUpdated]: {
    emits: [],
    note: "the watcher noticing a change from outside the session, which is the editor's business rather than the transcript's",
  },
  [OpencodeServerEventType.PermissionAsked]: {
    emits: [AgentEventType.PermissionRequested],
    note: "the ask the one-way stream never makes — held open here rather than auto-rejected",
  },
  [OpencodeServerEventType.PermissionReplied]: {
    emits: [AgentEventType.PermissionDecided],
    note: "the answer, and which way it went",
  },
  [OpencodeServerEventType.ServerConnected]: {
    emits: [],
    note: "the stream is open; it says nothing about any session",
  },
  [OpencodeServerEventType.ServerHeartbeat]: {
    emits: [],
    note: "a keep-alive",
  },
  [OpencodeServerEventType.SessionDiff]: {
    emits: [],
    note: "the working tree against its snapshot; the file edits are already reported by the calls that made them",
  },
  [OpencodeServerEventType.PluginAdded]: {
    emits: [],
    note: "a plugin loaded, which belongs to capabilities rather than to the conversation",
  },
  [OpencodeServerEventType.CatalogUpdated]: {
    emits: [],
    note: "the model catalogue refreshed",
  },
  [OpencodeServerEventType.ReferenceUpdated]: {
    emits: [],
    note: "the reference index refreshed",
  },
  [OpencodeServerEventType.IntegrationUpdated]: {
    emits: [],
    note: "an integration's state changed",
  },
})
