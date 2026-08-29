/** @responsibility Re-exports everything specific to reading opencode, so a consumer takes the provider in one import. */

export {
  OPENCODE_EVENT_MAPPING,
  OPENCODE_PLAN_STATUS,
  OPENCODE_TASK_KIND,
  OPENCODE_TOOL_KIND,
  opencodeMappingFor,
  opencodePlanStatus,
  opencodeToolKind,
  opencodeWireKind,
  type OpencodeMappingEntry,
  type OpencodeWireKind,
} from "./mapping"
export {
  OPENCODE_CAPABILITY_COMMANDS,
  opencodeCapabilities,
  type OpencodeCapabilityCommand,
  type OpencodeCapabilityListings,
} from "./capabilities"
export { OpencodeStreamMapper, mapOpencodeStream } from "./mapper"
export {
  opencodeExportCommand,
  parseOpencodeExport,
  type OpencodeExport,
  type OpencodeExportInfo,
} from "./store"
// The whole wire surface, so a consumer holding an `OpencodeWireEvent` can name
// every arm it narrows to. A hand-kept list drifts — Codex's already had.
export * from "./wire"
