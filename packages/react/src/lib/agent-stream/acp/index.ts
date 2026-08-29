/** @responsibility Re-exports the Agent Client Protocol reader, which is one protocol shared by every agent that speaks it. */

export {
  ACP_TOOL_NAME,
  ACP_PROTOCOL_VERSION,
  AcpMethod,
  AcpPermissionKind,
  AcpToolKind,
  AcpToolStatus,
  AcpUpdate,
  type AcpFrame,
} from "./wire"
export { parseAcp, parseAcpLine, type AcpParseResult, type AcpRawFrame } from "./frame"
export { ACP_MAPPING, ACP_TOOL_KIND, acpMappingFor, acpToolKind, acpToolKindByName } from "./mapping"
export { AcpMapper, mapAcpStream } from "./mapper"
