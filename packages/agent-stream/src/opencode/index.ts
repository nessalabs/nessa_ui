/** @responsibility Re-exports everything specific to reading opencode, so a consumer takes the provider — and the transport it is on — in one import. */

// The payload both transports carry, and the vocabulary for reading one.
export {
  OPENCODE_PLAN_STATUS,
  OPENCODE_TASK_KIND,
  OPENCODE_TOOL_KIND,
  OpencodeFinishReason,
  OpencodePartType,
  OpencodeToolName,
  OpencodeToolStatus,
  opencodePlanStatus,
  opencodeToolKind,
  type OpencodePart,
  type OpencodeStepFinishPart,
  type OpencodeStepStartPart,
  type OpencodeTextPart,
  type OpencodeTokens,
  type OpencodeToolPart,
} from "./parts"
export { type OpencodeMappingEntry, type OpencodeWireKind } from "./mapping"

// ---------- `opencode run --format json` ----------
export {
  OPENCODE_RUN_PROVENANCE,
  OpencodeRunType,
  parseOpencodeLine,
  parseOpencodeLines,
  type OpencodeParseFailure,
  type OpencodeParseResult,
  type OpencodeParseSuccess,
  type OpencodeRawLine,
  type OpencodeRunLine,
} from "./run/wire"
export { OPENCODE_RUN_MAPPING, opencodeMappingFor, opencodeWireKind } from "./run/mapping"
export { OpencodeRunMapper, mapOpencodeStream } from "./run/mapper"

// ---------- `opencode serve` ----------
export {
  OPENCODE_SERVER_PROVENANCE,
  OpencodeDeltaField,
  OpencodeServerEventType,
  isOpencodeServerEvent,
  parseOpencodeSse,
  parseOpencodeSseLine,
} from "./server/wire"
export { OPENCODE_SERVER_MAPPING } from "./server/mapping"
export { OpencodeServerMapper, mapOpencodeServerStream } from "./server/mapper"

// ---------- capabilities and stored sessions ----------
export {
  OPENCODE_CAPABILITY_COMMANDS,
  opencodeCapabilities,
  type OpencodeCapabilityCommand,
  type OpencodeCapabilityListings,
} from "./capabilities"
export {
  opencodeExportCommand,
  parseOpencodeExport,
  type OpencodeExport,
  type OpencodeExportInfo,
} from "./store"
