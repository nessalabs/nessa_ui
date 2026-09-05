import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { writeFileSync } from "node:fs"

// Explicit local capture, never runs in the browser or during builds.
const repository = process.argv[2] ?? fileURLToPath(new URL("../../..", import.meta.url))
const git = (...args) => execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trimEnd()
const fields = git("log", "--all", "--topo-order", "-n", "300", "--format=%H%x00%P%x00%s%x00%an%x00%aI%x00%D%x00").split("\0")
const commits = []
for (let index = 0; index + 5 < fields.length; index += 6) {
  const [hash, parents, subject, author, date, refs] = fields.slice(index, index + 6)
  commits.push({ hash: hash.trim(), parents: parents ? parents.split(" ") : [], subject, author, date, refs: refs ? refs.split(", ") : [] })
}
const details = {}
for (const commit of commits) {
  const [email, body] = git("show", "-s", "--format=%ae%x00%b", commit.hash).split("\0")
  const args = commit.parents.length ? ["diff", commit.parents[0], commit.hash] : ["diff-tree", "--root", "--no-commit-id", commit.hash]
  const statuses = git(...args, "-r", "--no-renames", "--name-status", "-z").split("\0")
  const statusByPath = new Map()
  for (let i = 0; i + 1 < statuses.length; i += 2) statusByPath.set(statuses[i + 1], statuses[i])
  const files = git(...args, "-r", "--no-renames", "--numstat", "-z").split("\0").filter(Boolean).map((record) => {
    const first = record.indexOf("\t")
    const second = record.indexOf("\t", first + 1)
    const added = record.slice(0, first)
    const removed = record.slice(first + 1, second)
    const path = record.slice(second + 1)
    return { path, status: statusByPath.get(path) ?? "M", additions: added === "-" ? null : Number(added), deletions: removed === "-" ? null : Number(removed) }
  })
  details[commit.hash] = { email, body, files, comparisonLabel: commit.parents.length ? "Compared with first parent · renames shown as delete/add" : "Initial commit · compared with empty tree" }
}
const snapshot = { capturedAt: new Date().toISOString(), head: git("rev-parse", "HEAD"), command: "git log --all --topo-order -n 300", commits, details }
writeFileSync(new URL("../stories/fixtures/git-history.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n")
console.log(`Captured ${commits.length} commits from local Git.`)
