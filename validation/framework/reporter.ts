import type { Finding, FindingState, RunReport } from "./types.ts"

const STATE_ORDER: Record<FindingState, number> = {
  FAIL: 0,
  EXCEPTION: 1,
  REVIEW: 2,
  PLANNED: 3,
  PASS: 4,
  SKIPPED: 5,
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((left, right) =>
    compareCodeUnits(left.contractId ?? "", right.contractId ?? "") ||
    compareCodeUnits(left.checkId, right.checkId) ||
    STATE_ORDER[left.state] - STATE_ORDER[right.state] ||
    compareCodeUnits(left.path ?? "", right.path ?? "") ||
    compareCodeUnits(left.message, right.message),
  )
}

export function renderText(report: RunReport): string {
  const lines = report.results.map((finding) => {
    const location = finding.path
      ? ` ${finding.path}${finding.line ? `:${finding.line}${finding.column ? `:${finding.column}` : ""}` : ""}`
      : ""
    const contract = finding.contractId ? ` ${finding.contractId}` : ""
    const repair = finding.repair ? `\n    Repair: ${finding.repair}` : ""
    const authority = finding.authority ? `\n    Authority: ${finding.authority}` : ""
    return `${finding.state}${contract} [${finding.checkId}]${location} — ${finding.message}${authority}${repair}`
  })
  const summary = Object.entries(report.summary)
    .filter(([key]) => key !== "exitCode")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ")
  lines.push(`Summary: ${summary}`)
  return lines.join("\n")
}

export function renderJson(report: RunReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
