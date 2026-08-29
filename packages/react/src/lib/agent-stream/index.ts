/** @responsibility Re-exports the agent stream parser: the shared contract, the shared folds, and the providers that feed them. */

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
  parseJsonLines,
  shortenPath,
  type JsonLineResult,
  type JsonValue,
} from "./json"

// ---------- optional folds over the contract ----------
export { TranscriptBuilder } from "./builder"
export {
  GROUP_MIN,
  applyDeltas,
  assembleTurn,
  buildTranscript,
  groupTools,
  isCompacting,
  isToolGroup,
  previewOf,
  rendersRow,
  runKey,
  type DelegatedRun,
  type DeltaBuffers,
  type ToolGroup,
  type Transcript,
  type Turn,
  type WorkItem,
} from "./transcript"

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
export * as claude from "./claude"
export * as codex from "./codex"
<<<<<<< HEAD
export * as opencode from "./opencode"
=======
>>>>>>> origin/main

// The two entry points are also exported flat, because reaching for a parser by
// name is the common case and `claude.ClaudeStreamMapper` stutters.
export { ClaudeStreamMapper, mapClaudeStream } from "./claude/mapper"
export { CodexStreamMapper, mapCodexStream } from "./codex/mapper"
<<<<<<< HEAD
export { OpencodeStreamMapper, mapOpencodeStream } from "./opencode/mapper"
=======
>>>>>>> origin/main
