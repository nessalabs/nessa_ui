import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

import { inspectGovernanceRules } from "../verify-github-governance.ts"
import { architectureDecision, checkRunRequest, openPullNumbers } from "../verify-pr-architecture.ts"

const conformingRules = [
  { type: "required_status_checks", parameters: { required_status_checks: [{ context: "Validation / full" }, { context: "architecture-conformance" }] } },
  { type: "pull_request", parameters: { required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_code_owner_review: false } },
]

test("active rule audit distinguishes complete and deadlocking governance", () => {
  assert.deepEqual(inspectGovernanceRules(conformingRules), [])
  assert.match(inspectGovernanceRules([{ ...conformingRules[1]!, parameters: { ...conformingRules[1]!.parameters, require_code_owner_review: true } }]).join("\n"), /deadlock/)
})

test("architecture publisher runs only trusted default-branch triggers and covers governed ownership", async () => {
  const workflow = await readFile(".github/workflows/architecture-review.yml", "utf8")
  assert.doesNotMatch(workflow, /^\s*pull_request_review:/m)
  assert.match(workflow, /^\s*workflow_run:/m)
  assert.match(workflow, /^\s*schedule:/m)
  const owners = await readFile(".github/CODEOWNERS", "utf8")
  for (const target of ["/README.md", "/.node-version", "/docs/plans/", "/validation/", "/.github/"]) assert.match(owners, new RegExp(`^${target.replaceAll("/", "\\/")} `, "m"))
})

test("owner-authored change needs one current independent approval", () => {
  const pullRequest = { user: { login: "Varuas37" }, head: { sha: "head" } }
  assert.equal(architectureDecision(pullRequest, []).approved, false)
  assert.equal(architectureDecision(pullRequest, [{ user: { login: "reviewer" }, state: "APPROVED", commit_id: "old" }]).approved, false)
  assert.equal(architectureDecision(pullRequest, [{ user: { login: "reviewer" }, state: "APPROVED", commit_id: "head" }]).approved, true)
})

test("latest review wins even after the first 100 review records", () => {
  const pullRequest = { user: { login: "Varuas37" }, head: { sha: "head" } }
  const reviews = [
    { user: { login: "reviewer" }, state: "APPROVED", commit_id: "head", submitted_at: "2026-01-01T00:00:00Z" },
    ...Array.from({ length: 99 }, (_, index) => ({ user: { login: `noise-${index}` }, state: "COMMENTED", commit_id: "head", submitted_at: `2026-01-02T00:${String(index).padStart(2, "0")}:00Z` })),
    { user: { login: "reviewer" }, state: "DISMISSED", commit_id: "head", submitted_at: "2026-01-03T00:00:00Z" },
  ]
  assert.equal(architectureDecision(pullRequest, reviews).approved, false)
})

test("all-open traversal retains pull requests beyond the first API page", () => {
  const pulls = Array.from({ length: 205 }, (_, index) => ({ number: index + 1, user: { login: "author" }, head: { sha: `head-${index}` } }))
  assert.equal(openPullNumbers(pulls).at(-1), 205)
})

test("check-run publication is head-bound on create and idempotent on update", () => {
  const pullRequest = { user: { login: "Varuas37" }, head: { sha: "head-123" } }
  const create = checkRunRequest(undefined, pullRequest, true, "approved")
  assert.equal(create.method, "POST")
  assert.deepEqual(JSON.parse(create.body).head_sha, "head-123")
  const update = checkRunRequest({ id: 42, name: "architecture-conformance" }, pullRequest, true, "approved")
  assert.equal(update.method, "PATCH")
  assert.equal(update.endpoint, "check-runs/42")
  assert.equal("head_sha" in JSON.parse(update.body), false)
})

test("non-owner-authored change requires current owner approval", () => {
  const pullRequest = { user: { login: "contributor" }, head: { sha: "head" } }
  assert.equal(architectureDecision(pullRequest, [{ user: { login: "reviewer" }, state: "APPROVED", commit_id: "head" }]).approved, false)
  assert.equal(architectureDecision(pullRequest, [{ user: { login: "Varuas37" }, state: "APPROVED", commit_id: "head" }]).approved, true)
})
