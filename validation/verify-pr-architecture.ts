#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"

import { runCommand } from "./process.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const architectureOwner = "Varuas37"

interface PullRequest { number?: number; user: { login: string }; head: { sha: string } }
interface Review { user?: { login?: string }; state: string; commit_id?: string; submitted_at?: string }
interface CheckRun { id: number; name: string }

function argument(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

export function architectureDecision(pullRequest: PullRequest, reviews: readonly Review[]): { approved: boolean; summary: string } {
  const latestByUser = new Map<string, Review>()
  for (const review of [...reviews].sort((a, b) => (a.submitted_at ?? "") < (b.submitted_at ?? "") ? -1 : (a.submitted_at ?? "") > (b.submitted_at ?? "") ? 1 : 0)) {
    const login = review.user?.login
    if (login) latestByUser.set(login.toLowerCase(), review)
  }
  const currentApprovers = [...latestByUser.entries()]
    .filter(([, review]) => review.state === "APPROVED" && review.commit_id === pullRequest.head.sha)
    .map(([login]) => login)
  const author = pullRequest.user.login.toLowerCase()
  const owner = architectureOwner.toLowerCase()
  if (author === owner) {
    const independent = currentApprovers.find((login) => login !== author)
    return independent
      ? { approved: true, summary: `Owner-authored change has current independent approval from @${independent}.` }
      : { approved: false, summary: "Owner-authored change needs one non-author approval bound to the current head SHA." }
  }
  return currentApprovers.includes(owner)
    ? { approved: true, summary: `Non-owner-authored change has current architecture-owner approval from @${architectureOwner}.` }
    : { approved: false, summary: `Non-owner-authored change needs @${architectureOwner} approval bound to the current head SHA.` }
}

async function ghJson<T>(repo: string, endpoint: string): Promise<T> {
  const { stdout } = await runCommand("gh", ["api", `repos/${repo}/${endpoint}`], { cwd: root, capture: true })
  return JSON.parse(stdout) as T
}

async function ghPaginated<T>(repo: string, endpoint: string): Promise<T[]> {
  const { stdout } = await runCommand("gh", ["api", "--paginate", "--slurp", `repos/${repo}/${endpoint}`], { cwd: root, capture: true })
  const pages = JSON.parse(stdout) as T[][]
  return pages.flat()
}

async function ghCheckRuns(repo: string, sha: string): Promise<CheckRun[]> {
  const { stdout } = await runCommand("gh", ["api", "--paginate", "--slurp", `repos/${repo}/commits/${sha}/check-runs?check_name=architecture-conformance&per_page=100`], { cwd: root, capture: true })
  const pages = JSON.parse(stdout) as { check_runs: CheckRun[] }[]
  return pages.flatMap((page) => page.check_runs)
}

export function checkRunRequest(existing: CheckRun | undefined, pullRequest: PullRequest, approved: boolean, summary: string): { method: "POST" | "PATCH"; endpoint: string; body: string } {
  return {
    method: existing ? "PATCH" : "POST",
    endpoint: existing ? `check-runs/${existing.id}` : "check-runs",
    body: JSON.stringify({
      ...(existing ? {} : { name: "architecture-conformance", head_sha: pullRequest.head.sha }),
      status: "completed",
      conclusion: approved ? "success" : "failure",
      output: { title: approved ? "Architecture conformance approved" : "Architecture conformance approval required", summary },
    }),
  }
}

export function openPullNumbers(pulls: readonly PullRequest[]): number[] {
  return pulls.map((pull) => {
    if (!pull.number) throw new Error("Open pull request response omitted its number")
    return pull.number
  })
}

export async function verifyPrArchitecture(args = process.argv.slice(2)): Promise<void> {
  const repo = argument(args, "--repo") ?? process.env.GITHUB_REPOSITORY
  const pr = argument(args, "--pr")
  const allOpen = args.includes("--all-open")
  const publish = args.includes("--publish-check")
  if (!repo || (!allOpen && (!pr || !/^\d+$/.test(pr)))) throw new Error("--repo <owner/name> and either --pr <number> or --all-open are required")
  if (allOpen) {
    const pulls = await ghPaginated<PullRequest>(repo, "pulls?state=open&per_page=100")
    for (const number of openPullNumbers(pulls)) {
      await verifyPrArchitecture(["--repo", repo, "--pr", String(number), ...(publish ? ["--publish-check"] : [])])
    }
    return
  }
  const pullRequest = await ghJson<PullRequest>(repo, `pulls/${pr}`)
  const reviews = await ghPaginated<Review>(repo, `pulls/${pr}/reviews?per_page=100`)
  const decision = architectureDecision(pullRequest, reviews)

  if (publish) {
    const runs = await ghCheckRuns(repo, pullRequest.head.sha)
    const existing = runs.find((run) => run.name === "architecture-conformance")
    const request = checkRunRequest(existing, pullRequest, decision.approved, decision.summary)
    await runCommand("gh", ["api", `--method=${request.method}`, `repos/${repo}/${request.endpoint}`, "--input", "-"], {
      cwd: root,
      capture: true,
      input: request.body,
    })
  }
  process.stdout.write(`${decision.approved ? "PASS" : "REVIEW"} GOV-003 — ${decision.summary}\n`)
  if (!decision.approved) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPrArchitecture().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
