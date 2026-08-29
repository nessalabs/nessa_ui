/** @responsibility Reads a session opencode exported to JSON, including the child session a delegation names. */

import type { AgentEvent } from "../events"
import { asArray, asNumber, asRecord, asString } from "../json"
import type { JsonValue } from "../json"
import { OpencodePartType } from "./parts"
import { OpencodeRunMapper } from "./run/mapper"
import { OpencodeRunType } from "./run/wire"

/**
 * What an exported session says about itself.
 *
 * This is the half a delegated run's own stream never carries: which agent it
 * ran as, which model it used, and what it cost. A parent's stream names only
 * the child's session id — everything else lives here.
 */
export interface OpencodeExportInfo {
  readonly sessionId: string
  /** The session this was spawned from, for a subagent. */
  readonly parentId: string | null
  readonly title: string | null
  /** The agent it ran as: `explore`, `general`, or whatever the install defines. */
  readonly agent: string | null
  readonly model: string | null
  readonly directory: string | null
  /** The build that wrote the export, which opencode records where its stream does not. */
  readonly version: string | null
  /** Summed across the session's messages, since opencode reports both per message. */
  readonly totalTokens: number | null
  readonly totalCostUsd: number | null
}

export interface OpencodeExport {
  readonly info: OpencodeExportInfo
  readonly events: readonly AgentEvent[]
}

/**
 * The line an exported part would have been, had it arrived on the stream.
 *
 * An export is the same parts in a different envelope: `messages[].parts[]`
 * holds exactly the `step-start`, `text`, `reasoning`, `tool` and `step-finish`
 * shapes `run --format json` publishes one at a time. Rebuilding the line and
 * handing it to the same mapper is what keeps an opened transcript and a live
 * one identical — a second reader would be a second set of rules to disagree
 * with.
 */
const LINE_TYPE: Readonly<Record<string, string>> = Object.freeze({
  [OpencodePartType.StepStart]: OpencodeRunType.StepStart,
  [OpencodePartType.StepFinish]: OpencodeRunType.StepFinish,
  [OpencodePartType.Text]: OpencodeRunType.Text,
  [OpencodePartType.Reasoning]: OpencodeRunType.Reasoning,
  [OpencodePartType.Tool]: OpencodeRunType.ToolUse,
})

/**
 * Reads `opencode export <sessionID>` output.
 *
 * The CLI prints a status line before the JSON, so the document is found rather
 * than assumed to start at byte zero — a reader that assumed it would fail on
 * the real command's real output.
 */
export function parseOpencodeExport(text: string): OpencodeExport | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  let document: JsonValue
  try {
    document = JSON.parse(text.slice(start)) as JsonValue
  } catch {
    return null
  }

  const root = asRecord(document)
  const info = asRecord(root.info)
  const sessionId = asString(info.id)
  if (sessionId === null) return null

  const mapper = new OpencodeRunMapper()
  const events: AgentEvent[] = []
  let totalTokens: number | null = null
  let totalCost: number | null = null

  for (const entry of asArray(root.messages)) {
    const message = asRecord(entry)
    const messageInfo = asRecord(message.info)
    const role = asString(messageInfo.role)

    const tokens = asNumber(asRecord(messageInfo.tokens).total)
    if (tokens !== null) totalTokens = (totalTokens ?? 0) + tokens
    const cost = asNumber(messageInfo.cost)
    if (cost !== null) totalCost = (totalCost ?? 0) + cost

    for (const partEntry of asArray(message.parts)) {
      const part = asRecord(partEntry)
      const partType = asString(part.type)
      if (partType === null) continue

      // The prompt is a text part on a user message. On the live stream a user
      // message never appears at all — the host is the only thing that knows
      // what it asked — so an export is the one place the question is readable,
      // and dropping it would open a transcript that starts mid-answer.
      if (role === "user") {
        if (partType !== OpencodePartType.Text) continue
        const prompt = asString(part.text)
        if (prompt === null || prompt === "") continue
        events.push(
          ...mapper.map({
            type: "user_message",
            sessionID: sessionId,
            timestamp: asNumber(asRecord(messageInfo.time).created) ?? undefined,
            part: { ...part, text: prompt },
          } as never),
        )
        continue
      }

      const lineType = LINE_TYPE[partType]
      if (lineType === undefined) continue
      events.push(
        ...mapper.map({
          type: lineType,
          sessionID: sessionId,
          // A part's own start where it has one. A tool part times its call
          // inside `state`, and a step-finish is not timed at all, so some
          // exported events carry no timestamp — `seq` is the ordering key
          // here as everywhere.
          timestamp:
            asNumber(asRecord(part.time).start) ??
            asNumber(asRecord(asRecord(part.state).time).start) ??
            undefined,
          part: partEntry,
        } as never),
      )
    }
  }

  return {
    info: {
      sessionId,
      parentId: asString(info.parentID),
      title: asString(info.title),
      agent: asString(info.agent),
      model: asString(asRecord(info.model).id),
      directory: asString(info.directory),
      version: asString(info.version),
      totalTokens,
      totalCostUsd: totalCost,
    },
    events,
  }
}

/**
 * The command that reads a delegated run's transcript.
 *
 * Stated here so a host does not have to guess at it: opencode is the only one
 * of the three whose child transcripts are addressable from the parent's own
 * stream, and this is the whole of what it takes to fetch one.
 */
export function opencodeExportCommand(sessionId: string): string {
  return `opencode export ${sessionId}`
}
