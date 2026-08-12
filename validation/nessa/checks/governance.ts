import { amendments } from "../../amendments.ts"
import { activationProbes, contracts } from "../../contracts.ts"
import { defineCheck } from "../../framework/define-check.ts"
import { checkMetadata } from "../check-metadata.ts"
import { createGovernedSnapshot, governedSourcePaths } from "../governance-history.ts"
import { slugifyHeading } from "../source-scan.ts"

const registeredChecks = new Set(Object.keys(checkMetadata))

interface IndexRow {
  id: string
  title: string
  anchor: string
}

export function parseNormativeIndex(markdown: string): IndexRow[] {
  const heading = "## Normative contract index"
  const start = markdown.indexOf(heading)
  if (start < 0) return []
  const rest = markdown.slice(start + heading.length)
  const end = rest.search(/^## /m)
  const section = end < 0 ? rest : rest.slice(0, end)
  return section
    .split("\n")
    .map((line) => line.match(/^\| ([A-Z0-9]+-\d{3}) \| (.+) \| `(#[-a-z0-9]+)` \|$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ id: match[1]!, title: match[2]!, anchor: match[3]! }))
}

export const governanceCheck = defineCheck({
  id: "governance",
  ...checkMetadata.governance,
  async run(context) {
    const findings = []
    const markdown = await context.readText("docs/architecture/design-system-contract.md")
    const readme = await context.readText("README.md")
    const codeowners = await context.readText(".github/CODEOWNERS")
    const governedSources = Object.fromEntries(await Promise.all(governedSourcePaths.map(async (filePath) => [filePath, await context.readText(filePath)] as const)))
    const currentFingerprint = createGovernedSnapshot(governedSources).fingerprint
    const rows = parseNormativeIndex(markdown)
    const rowById = new Map(rows.map((row) => [row.id, row]))
    const contractById = new Map(contracts.map((entry) => [entry.id, entry]))
    const headingPositions = new Map<string, number>()
    for (const match of markdown.matchAll(/^#{2,4} (.+)$/gm)) headingPositions.set(`#${slugifyHeading(match[1]!)}`, match.index)
    const headings = new Set(headingPositions.keys())

    if (rows.length !== contracts.length || rowById.size !== rows.length || contractById.size !== contracts.length) {
      findings.push(context.fail("Normative index and manifest must contain the same unique contract IDs.", {
        contractId: "GOV-001",
        repair: "Add/remove the matching Markdown row and typed manifest entry together.",
      }))
    }
    for (const entry of contracts) {
      const row = rowById.get(entry.id)
      const anchor = `#${entry.authority.split("#")[1] ?? ""}`
      if (!row || row.title !== entry.title || row.anchor !== anchor || !headings.has(anchor)) {
        findings.push(context.fail(`Manifest/index mismatch for ${entry.id}.`, {
          contractId: "GOV-001",
          authority: entry.authority,
          repair: "Keep ID, title, and a real normative heading anchor identical in both sources.",
        }))
      }
      const roadmapStart = markdown.indexOf("## Non-normative adoption roadmap")
      const verificationStart = markdown.indexOf("## Verification infrastructure")
      const anchorPosition = headingPositions.get(anchor) ?? -1
      if (roadmapStart >= 0 && verificationStart > roadmapStart && anchorPosition >= roadmapStart && anchorPosition < verificationStart) {
        findings.push(context.fail(`${entry.id} authority points into the non-normative roadmap.`, { contractId: "GOV-001", authority: entry.authority }))
      }
      if (entry.state === "enforced" && (!entry.check || !registeredChecks.has(entry.check))) {
        findings.push(context.fail(`${entry.id} is enforced without a registered checker.`, { contractId: "GOV-001" }))
      }
      if (entry.state === "planned") {
        const paths = entry.activationProbe ? activationProbes[entry.activationProbe as keyof typeof activationProbes] : null
        if (!paths) {
          findings.push(context.fail(`${entry.id} is planned without a registered activation probe.`, { contractId: "GOV-001" }))
        } else if (paths.some((filePath) => context.files.has(filePath))) {
          findings.push(context.fail(`${entry.id} activation surface exists while the contract is still planned.`, {
            contractId: entry.id,
            repair: "Promote the contract to enforced and add its real checker in this change.",
          }))
        } else {
          findings.push(context.planned(`${entry.id} awaits ${paths.join(" or ")}.`, { contractId: entry.id, authority: entry.authority }))
        }
      }
      if (entry.state === "review-required") {
        if (!entry.reviewEvidence) findings.push(context.fail(`${entry.id} lacks review evidence instructions.`, { contractId: "GOV-001" }))
        else findings.push(context.review(entry.reviewEvidence, { contractId: entry.id, authority: entry.authority }))
      }
    }
    if (!readme.includes("docs/architecture/design-system-contract.md")) {
      findings.push(context.fail("README does not link the core contract.", { contractId: "GOV-001", path: "README.md" }))
    }
    for (const ownedPath of ["/packages/react/", "/apps/storybook/", "/registry.json", "/public/r/", "/validation/", "/docs/architecture/", "/docs/plans/", "/README.md", "/.node-version", "/package.json", "/pnpm-lock.yaml", "/pnpm-workspace.yaml", "/tsconfig.base.json", "/.github/"]) {
      if (!codeowners.split("\n").some((line) => line.trim().startsWith(`${ownedPath} `))) findings.push(context.fail(`CODEOWNERS omits governed path ${ownedPath}.`, { contractId: "GOV-003", path: ".github/CODEOWNERS" }))
    }
    if (!markdown.includes("may not silently weaken") && !markdown.includes("cannot silently override")) {
      findings.push(context.fail("Core contract lost its no-silent-override rule.", { contractId: "GOV-002" }))
    }
    if (amendments[0]?.id !== "BOOTSTRAP-001" || amendments[0].kind !== "bootstrap") {
      findings.push(context.fail("Immutable BOOTSTRAP-001 must remain the first amendment.", { contractId: "GOV-003" }))
    }
    const amendmentIds = new Set<string>()
    for (const [index, amendment] of amendments.entries()) {
      if (amendmentIds.has(amendment.id)) findings.push(context.fail(`Duplicate amendment ID ${amendment.id}.`, { contractId: "GOV-003" }))
      if (index > 0 && amendment.kind === "bootstrap") findings.push(context.fail(`Second bootstrap ${amendment.id} is forbidden.`, { contractId: "GOV-003" }))
      if (![amendment.rationale, amendment.compatibility, amendment.migration].every((value) => value.trim())) findings.push(context.fail(`${amendment.id} lacks required transition evidence.`, { contractId: "GOV-003" }))
      if (amendment.targets.some((target) => !governedSourcePaths.includes(target as (typeof governedSourcePaths)[number]))) findings.push(context.fail(`${amendment.id} names an unknown governed target.`, { contractId: "GOV-003" }))
      if (amendment.kind !== "retirement" && !contracts.some((entry) => entry.id === amendment.contractId) && !amendments.some((entry) => entry.kind === "retirement" && entry.contractId === amendment.contractId)) findings.push(context.fail(`${amendment.id} references unknown contract ${amendment.contractId}.`, { contractId: "GOV-003" }))
      if (["correction", "supersession"].includes(amendment.kind) && (!amendment.supersedes || !amendmentIds.has(amendment.supersedes))) findings.push(context.fail(`${amendment.id} must reference an earlier amendment.`, { contractId: "GOV-003" }))
      amendmentIds.add(amendment.id)
    }
    const retiredIds = new Set(amendments.filter((entry) => entry.kind === "retirement").map((entry) => entry.contractId))
    for (const entry of contracts) if (retiredIds.has(entry.id)) findings.push(context.fail(`Retired contract ID ${entry.id} was reintroduced or recycled.`, { contractId: "GOV-003" }))
    if (amendments.at(-1)?.afterFingerprint !== currentFingerprint) {
      findings.push(context.fail("Latest amendment fingerprint does not match the current governed snapshot.", {
        contractId: "GOV-003",
        repair: `Append an exact transition ending at ${currentFingerprint}; never rewrite earlier amendments.`,
      }))
    }
    if (!findings.some((finding) => finding.state === "FAIL")) {
      findings.push(context.pass("Contract index, manifest, states, probes, and bootstrap amendment are coherent.", { contractId: "GOV-001" }))
    }
    return findings
  },
})
