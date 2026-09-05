import { test } from "node:test"
import assert from "node:assert/strict"
import { layoutGitHistory, type GitCommit } from "./git-history-layout"

/** Builds minimal commits for topology assertions. */
function commit(hash: string, parents: string[] = []): GitCommit {
  return { hash, parents, subject: hash, author: "Test", date: "2026-09-04T00:00:00Z" }
}
test("linear history stays in a single lane and closes at the root", () => {
  const { rows, lanes } = layoutGitHistory([commit("a", ["b"]), commit("b", ["c"]), commit("c")])
  assert.equal(lanes, 1)
  assert.deepEqual(rows.map((row) => row.lane), [0, 0, 0])
  assert.deepEqual(rows[2]!.edges, [])
})
test("merge lanes meet their actual parent and preserve unrelated lanes", () => {
  const { rows, lanes } = layoutGitHistory([commit("m", ["a", "b"]), commit("a", ["r"]), commit("b", ["r"]), commit("r")])
  assert.equal(lanes, 2)
  assert.deepEqual(rows[0]!.edges, [{ from: 0, to: 0 }, { from: 0, to: 1 }])
  assert.deepEqual(rows[1]!.edges, [{ from: 0, to: 0 }, { from: 1, to: 1 }])
  assert.deepEqual(rows[2]!.edges, [{ from: 1, to: 0 }, { from: 0, to: 0 }])
  assert.deepEqual(rows[3]!.incoming, [0])
})
test("octopus merges, disconnected roots and truncated parents remain valid", () => {
  const { rows, lanes } = layoutGitHistory([commit("m", ["a", "b", "c"]), commit("unrelated"), commit("a", ["missing"]), commit("b", ["missing"]), commit("c", ["missing"])])
  assert.equal(lanes, 4)
  assert.equal(rows[1]!.lane, 3)
  assert.ok(rows.every((row) => row.edges.every((edge) => edge.to >= 0)))
})
test("rejects duplicate IDs and parent-before-child input", () => {
  assert.throws(() => layoutGitHistory([commit("a"), commit("a")]), /Duplicate/)
  assert.throws(() => layoutGitHistory([commit("a"), commit("b", ["a"])]), /topological/)
  assert.deepEqual(layoutGitHistory([]), { rows: [], lanes: 1 })
})
