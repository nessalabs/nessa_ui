export interface GitCommit {
  /** Full unique object ID. Supply commits in topological order, newest first. */
  hash: string
  parents: readonly string[]
  subject: string
  author: string
  /** ISO 8601 author timestamp. */
  date: string
  refs?: readonly string[]
}

export interface GitGraphRow {
  lane: number
  incoming: number[]
  edges: { from: number; to: number }[]
}

/** Computes graph lanes across the complete topological history before rows are windowed. Missing parents continue beyond the loaded history. Duplicate IDs or parents preceding children throw. */
export function layoutGitHistory(commits: readonly GitCommit[]): { rows: GitGraphRow[]; lanes: number } {
  const positions = new Map<string, number>()
  commits.forEach((commit, index) => {
    if (positions.has(commit.hash)) throw new Error(`Duplicate commit: ${commit.hash}`)
    positions.set(commit.hash, index)
  })
  let active: (string | null)[] = []
  let lanes = 1
  const rows = commits.map((commit, index) => {
    const parents = [...new Set(commit.parents)]
    for (const parent of parents) {
      if ((positions.get(parent) ?? Infinity) <= index) throw new Error("Git history must be in child-before-parent topological order.")
    }
    const incoming = active.flatMap((id, lane) => id === null ? [] : [lane])
    let lane = active.indexOf(commit.hash)
    if (lane < 0) {
      lane = active.indexOf(null)
      if (lane < 0) lane = active.length
      active[lane] = commit.hash
    }
    const before = [...active]
    active[lane] = null
    const edges: GitGraphRow["edges"] = []
    for (const parent of parents) {
      let target = active.indexOf(parent)
      if (target < 0) {
        target = active.indexOf(null)
        if (target < 0) target = active.length
        active[target] = parent
      }
      edges.push({ from: lane, to: target })
    }
    before.forEach((id, from) => {
      if (id !== null && from !== lane) edges.push({ from, to: active.indexOf(id) })
    })
    lanes = Math.max(lanes, active.length, lane + 1)
    while (active.length && active.at(-1) === null) active.pop()
    return { lane, incoming, edges }
  })
  return { rows, lanes }
}
