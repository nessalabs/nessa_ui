/** @responsibility Re-exports everything specific to reading Codex, so a consumer takes the provider in one import. */

export {
  CODEX_EVENT_MAPPING,
  CODEX_FILE_CHANGE,
  CODEX_TASK_KIND,
  CODEX_TOOL_KIND,
  codexFileChange,
  codexMappingFor,
  codexPlanStatus,
  codexToolKind,
  codexWireKind,
  type CodexMappingEntry,
  type CodexWireKind,
} from "./mapping"
export {
  CODEX_CAPABILITY_METHODS,
  codexCapabilities,
  type CodexCapabilityMethod,
} from "./capabilities"
export { CodexStreamMapper, mapCodexStream } from "./mapper"
// The whole wire surface, so a consumer holding a `CodexWireEvent` can name
// every arm it narrows to. A hand-kept list drifts — this one already had.
export * from "./wire"
