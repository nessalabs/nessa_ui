/** @responsibility Re-exports everything specific to reading Codex, so a consumer takes the provider — and the transport it is on — in one import. */

// ---------- `codex exec --json` ----------
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
} from "./exec/mapping"
export { CodexStreamMapper, mapCodexStream } from "./exec/mapper"
export * from "./exec/wire"

// ---------- `codex app-server` ----------
export {
  CODEX_APP_SERVER_PROVENANCE,
  CodexAppServerItemType,
  CodexAppServerNotification,
  CodexAppServerRequest,
  parseCodexAppServer,
  parseCodexAppServerLine,
  type CodexAppServerFrame,
  type CodexAppServerParseResult,
} from "./app-server/wire"
export {
  CODEX_APP_SERVER_MAPPING,
  codexAppServerKind,
  codexAppServerMappingFor,
} from "./app-server/mapping"
export { CodexAppServerMapper, mapCodexAppServerStream } from "./app-server/mapper"
export {
  CODEX_CAPABILITY_METHODS,
  codexCapabilities,
  type CodexCapabilityMethod,
} from "./app-server/capabilities"
