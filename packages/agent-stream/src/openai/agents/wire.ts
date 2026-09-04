/** @responsibility Describes and decodes the JSON shape yielded by the OpenAI Agents SDK stream. */

import type { WireProvenance } from "../../events"
import { parseJsonObjectLine } from "../../json"
import type { JsonLineResult, JsonValue } from "../../json"

export const OPENAI_AGENTS_PROVENANCE: WireProvenance = Object.freeze({
  cli: "@openai/agents",
  version: "0.17.0",
  command: "for await (const event of await run(agent, input, { stream: true }))",
  capturedOn: "2026-09-04",
})

export const OpenAIAgentsEventType = Object.freeze({
  RawModel: "raw_model_stream_event",
  RunItem: "run_item_stream_event",
  AgentUpdated: "agent_updated_stream_event",
} as const)

export const OpenAIAgentsRunItemName = Object.freeze({
  MessageOutputCreated: "message_output_created",
  HandoffRequested: "handoff_requested",
  HandoffOccurred: "handoff_occurred",
  ToolSearchCalled: "tool_search_called",
  ToolSearchOutputCreated: "tool_search_output_created",
  ToolCalled: "tool_called",
  ToolOutput: "tool_output",
  ReasoningItemCreated: "reasoning_item_created",
  CompactionItemCreated: "compaction_item_created",
  ToolApprovalRequested: "tool_approval_requested",
} as const)

export const OpenAIRawModelEventType = Object.freeze({
  ResponseStarted: "response_started",
  OutputTextDelta: "output_text_delta",
  ResponseDone: "response_done",
  Model: "model",
} as const)

export interface OpenAIAgentsWireEvent {
  readonly type: string
  readonly [key: string]: JsonValue | undefined
}

export type OpenAIAgentsParseResult = JsonLineResult

/**
 * The SDK yields objects, not SSE frames. `push()` consumes their JSON form so
 * captures remain portable and the package stays independent of the SDK.
 */
export function parseOpenAIAgentsLine(line: string): OpenAIAgentsParseResult {
  return parseJsonObjectLine(line)
}

export function parseOpenAIAgentsLines(text: string): readonly OpenAIAgentsParseResult[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseOpenAIAgentsLine)
}
