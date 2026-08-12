#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { runCommand } from "./process.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const expectedStatuses = ["Validation / full", "architecture-conformance"]

interface RepositoryRule {
  type: string
  parameters?: Record<string, unknown>
}

export function inspectGovernanceRules(rules: readonly RepositoryRule[]): string[] {
  const errors: string[] = []
  const statusRule = rules.find((rule) => rule.type === "required_status_checks")
  const statuses = ((statusRule?.parameters?.required_status_checks as { context?: string }[] | undefined) ?? []).map((entry) => entry.context)
  for (const status of expectedStatuses) if (!statuses.includes(status)) errors.push(`missing required status ${status}`)
  const pullRequestRule = rules.find((rule) => rule.type === "pull_request")
  const parameters = pullRequestRule?.parameters ?? {}
  if (Number(parameters.required_approving_review_count ?? 0) < 1) errors.push("at least one approving review is not required")
  if (parameters.dismiss_stale_reviews_on_push !== true) errors.push("stale approvals are not dismissed")
  if (parameters.require_code_owner_review === true) errors.push("sole-owner code-owner approval is enabled and can deadlock owner-authored PRs")
  return errors
}

export async function verifyGithubGovernance(args = process.argv.slice(2)): Promise<void> {
  const fixtureIndex = args.indexOf("--fixture")
  let rules: RepositoryRule[]
  if (fixtureIndex >= 0) {
    const fixturePath = args[fixtureIndex + 1]
    if (!fixturePath) throw new Error("--fixture requires a path")
    rules = JSON.parse(await readFile(path.resolve(root, fixturePath), "utf8")) as RepositoryRule[]
  } else {
    const { stdout } = await runCommand("gh", ["api", "repos/nessalabs/nessa_ui/rules/branches/main"], { cwd: root, capture: true })
    rules = JSON.parse(stdout) as RepositoryRule[]
  }
  const errors = inspectGovernanceRules(rules)
  if (errors.length) throw new Error(`Validation passes but merge protection is not confirmed:\n${errors.join("\n")}`)
  process.stdout.write("PASS GOV-003 — merge protection confirmed active.\n")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyGithubGovernance().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
