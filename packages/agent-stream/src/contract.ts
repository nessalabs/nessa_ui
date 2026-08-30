/** @responsibility Re-exports the agent stream parser: the shared contract and the providers that feed it, stopping at the agent message. */

// ---------- the contract every provider maps onto ----------
export {
  AgentEventType,
  FileChange,
  PlanStepStatus,
  TaskKind,
  isEvent,
  isMainThread,
  pathKey,
  type AgentEvent,
  type AgentEventPayload,
  type AgentStreamMapper,
  type AgentPath,
  type BlockRef,
  type DeltaPayload,
  type FileEdit,
  type MapperOptions,
  type PlanStep,
  type SessionInfo,
  type WireProvenance,
  type ToolKind,
  type ToolResult,
  type TurnStatus,
  type Usage,
  type WorkflowAgentProgress,
  type WorkflowPhaseProgress,
} from "./events"
export {
  unreportedCapabilities,
  type AgentCapabilities,
  type CapabilityCommand,
  type CapabilityHook,
  type CapabilityModel,
  type CapabilityPlugin,
  type CapabilityPluginSource,
  type CapabilityServer,
  type CapabilitySkill,
  type CapabilityTool,
  type CommandSource,
} from "./capabilities"
export {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asOneOf,
  asRecord,
  asString,
  asStrings,
  parseJsonLine,
  parseJsonObjectLine,
  parseJsonLines,
  shortenPath,
  type JsonLineResult,
  type JsonValue,
} from "./json"

export { type MappingEntry, type WireKind } from "./mapping"
export { EventSink } from "./emitter"
export {
  AGENT_TRANSPORTS,
  transportOf,
  transportsOf,
  type ProviderDescriptor,
  type Supported,
  type TransportDescriptor,
  type TransportSupport,
} from "./transports"

// ---------- providers ----------
/**
 * Namespaced, not flattened.
 *
 * A provider's surface is full of names a second provider wants too —
 * `parseWireLine`, `toolKind`, `SessionCapabilities`, `TranscriptRef`. Two
 * star-exports sharing a name silently elide the symbol, so flattening would
 * make adding `codex/` a breaking change to this module's public API: exactly
 * the "nothing else moves" claim the layering exists to keep.
 */
export * as acp from "./acp"
export * as claude from "./claude"
export * as codex from "./codex"
export * as opencode from "./opencode"

// Mapper classes and their one-shot helpers are also exported flat, because
// reaching for a parser by name is the common case and `claude.ClaudeStreamMapper`
// stutters.
export { ClaudeStreamMapper, mapClaudeStream } from "./claude"
export { CodexAppServerMapper, CodexStreamMapper, mapCodexAppServerStream, mapCodexStream } from "./codex"
export { AcpMapper, mapAcpStream } from "./acp"
export {
  OpencodeRunMapper,
  OpencodeServerMapper,
  mapOpencodeServerStream,
  mapOpencodeStream,
} from "./opencode"
