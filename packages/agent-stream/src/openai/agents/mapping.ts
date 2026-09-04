/** @responsibility States which OpenAI Agents SDK event becomes which normalized event. */

import { AgentEventType } from "../../events"
import type { MappingEntry } from "../../mapping"
import { asString } from "../../json"
import type { JsonValue } from "../../json"
import { OpenAIAgentsEventType, OpenAIAgentsRunItemName } from "./wire"

export type OpenAIAgentsWireKind = string

export const OPENAI_AGENTS_EVENT_MAPPING: Readonly<Record<OpenAIAgentsWireKind, MappingEntry>> = Object.freeze({
  [OpenAIAgentsEventType.RawModel]: {
    emits: [AgentEventType.SessionStarted, AgentEventType.Delta],
    note: "response_started opens the session; later raw model events provide text previews and response-level usage",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.MessageOutputCreated}`]: {
    emits: [AgentEventType.AssistantText], note: "the committed assistant message supersedes raw text deltas",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.ToolCalled}`]: {
    emits: [AgentEventType.ToolCallStarted, AgentEventType.TaskStarted], note: "a function, hosted, computer, shell, patch, MCP, or configured agent tool opened",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.ToolOutput}`]: {
    emits: [AgentEventType.ToolCallCompleted, AgentEventType.TaskCompleted], note: "the SDK executed a tool and, for a configured agent tool, completed its delegated run",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.ToolSearchCalled}`]: {
    emits: [AgentEventType.ToolCallStarted], note: "deferred tool discovery opened",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.ToolSearchOutputCreated}`]: {
    emits: [AgentEventType.ToolCallCompleted], note: "deferred tool discovery produced definitions",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.ReasoningItemCreated}`]: {
    emits: [AgentEventType.Reasoning], note: "the SDK publishes a committed reasoning item",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.CompactionItemCreated}`]: {
    emits: [AgentEventType.ContextCompacted], note: "the SDK exposes an encrypted compaction boundary, not token counts",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.HandoffRequested}`]: {
    emits: [AgentEventType.ToolCallStarted], note: "a handoff call requested replacement of the active agent; it is not a nested run",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.HandoffOccurred}`]: {
    emits: [AgentEventType.ToolCallCompleted], note: "the runtime completed the active-agent transfer; agent_updated identifies the replacement",
  },
  [`${OpenAIAgentsEventType.RunItem}/${OpenAIAgentsRunItemName.ToolApprovalRequested}`]: {
    emits: [AgentEventType.PermissionRequested], note: "the run paused with a tool interruption",
  },
  [OpenAIAgentsEventType.AgentUpdated]: {
    emits: [AgentEventType.StatusChanged], note: "the active agent changed, usually after a handoff",
  },
})

export function openAIAgentsWireKind(event: Record<string, JsonValue | undefined>): OpenAIAgentsWireKind {
  const type = asString(event.type) ?? "unknown"
  const name = asString(event.name)
  return name === null ? type : `${type}/${name}`
}

export function openAIAgentsMappingFor(event: Record<string, JsonValue | undefined>): MappingEntry | null {
  const kind = openAIAgentsWireKind(event)
  if (kind === OpenAIAgentsEventType.RawModel) return OPENAI_AGENTS_EVENT_MAPPING[kind] ?? null
  return OPENAI_AGENTS_EVENT_MAPPING[kind] ?? null
}

export function openAIToolKind(name: string, rawType: string): "shell" | "file_edit" | "search" | "web" | "mcp" | "subagent" | "other" {
  const value = `${rawType} ${name}`.toLowerCase()
  if (value.includes("shell") || value.includes("command")) return "shell"
  if (value.includes("patch") || value.includes("edit")) return "file_edit"
  if (value.includes("web")) return "web"
  if (value.includes("search")) return "search"
  if (value.includes("mcp")) return "mcp"
  return "other"
}
