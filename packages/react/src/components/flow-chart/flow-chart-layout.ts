/** @responsibility Pure flow-diagram (Sankey) geometry: assigns nodes to columns, scales heights to flow values, stacks columns to fill the box, allocates link slots along each node, and draws ribbon paths. No React, no DOM. */

/** A flow endpoint supplied by the host. */
export interface FlowChartNodeInput {
  /** Unique id links refer to. */
  id: string
}

/** A weighted flow between two nodes. */
export interface FlowChartLinkInput {
  /** Id of the node the flow leaves. */
  source: string
  /** Id of the node the flow enters. */
  target: string
  /** Magnitude of the flow. Non-positive links are ignored. */
  value: number
}

/** How nodes without outgoing flow choose their column. */
export type FlowChartAlign = "left" | "justify"

/** Inputs the layout is computed from. */
export interface FlowChartLayoutOptions {
  nodes: readonly FlowChartNodeInput[]
  links: readonly FlowChartLinkInput[]
  /** Pixel width of the area the diagram fills. */
  width: number
  /** Pixel height of the area the diagram fills. */
  height: number
  /** Pixel width of each node bar. */
  nodeWidth: number
  /** Minimum vertical gap between stacked nodes in a column. */
  nodeGap: number
  /**
   * "justify" (default) pushes nodes without outgoing links into the last
   * column; "left" keeps every node at the earliest column its inputs allow.
   */
  align?: FlowChartAlign
}

/** A positioned node bar. */
export interface FlowChartLayoutNode {
  id: string
  /** Zero-based column, left to right. */
  column: number
  x: number
  y: number
  width: number
  height: number
  /** Flow through the node: max of incoming and outgoing sums. */
  value: number
  /** Sum of incoming link values. */
  inValue: number
  /** Sum of outgoing link values. */
  outValue: number
}

/** A positioned ribbon between two node bars. */
export interface FlowChartLayoutLink {
  /** Index into the original `links` input. */
  index: number
  source: string
  target: string
  value: number
  /** Top edge of the ribbon where it leaves the source bar. */
  sourceY: number
  /** Top edge of the ribbon where it enters the target bar. */
  targetY: number
  /** Right edge of the source bar. */
  sourceX: number
  /** Left edge of the target bar. */
  targetX: number
  /** Ribbon thickness in pixels. */
  thickness: number
}

/**
 * A data problem the layout tolerated instead of failing on. Transient
 * while data streams in; whatever remains once the stream settles is a
 * real data error the host should surface.
 */
export interface FlowChartLayoutIssue {
  kind: "unknown-endpoint" | "self-link" | "duplicate-node" | "cycle"
  /** Human-readable summary of what was dropped or repaired. */
  message: string
  /** Index into the input `links` array, for link-scoped issues. */
  linkIndex?: number
  /** Offending node id, for node-scoped issues. */
  nodeId?: string
}

/** The computed diagram geometry. */
export interface FlowChartLayout {
  nodes: FlowChartLayoutNode[]
  links: FlowChartLayoutLink[]
  columnCount: number
  /** Sum of node values per column, in column order. */
  columnTotals: number[]
  /**
   * Everything the layout dropped or repaired to render this frame —
   * empty when the data was fully consistent.
   */
  issues: FlowChartLayoutIssue[]
}

interface NodeState {
  id: string
  order: number
  column: number
  inValue: number
  outValue: number
  value: number
}

/**
 * Longest-path column assignment over the link graph. Tolerant by design so
 * the chart survives partial, mid-stream data: callers pass pre-sanitized
 * nodes and links, and nodes trapped in a cycle fall back to one
 * deterministic input-order pass instead of failing.
 */
function assignColumns(
  nodes: readonly FlowChartNodeInput[],
  links: readonly FlowChartLinkInput[],
  issues: FlowChartLayoutIssue[],
): Map<string, number> {
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  for (const node of nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
    indegree.set(node.id, 0)
  }
  for (const link of links) {
    outgoing.get(link.source)!.push(link.target)
    incoming.get(link.target)!.push(link.source)
    indegree.set(link.target, indegree.get(link.target)! + 1)
  }

  const columns = new Map<string, number>()
  const queue: string[] = []
  for (const node of nodes) {
    if (indegree.get(node.id) === 0) {
      columns.set(node.id, 0)
      queue.push(node.id)
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!
    const depth = columns.get(id)!
    for (const next of outgoing.get(id)!) {
      // A node still waiting on cyclic predecessors keeps the deepest
      // column its resolved predecessors imply.
      columns.set(next, Math.max(columns.get(next) ?? 0, depth + 1))
      const remaining = indegree.get(next)! - 1
      indegree.set(next, remaining)
      if (remaining === 0) queue.push(next)
    }
  }
  // Nodes inside a cycle never drain from Kahn's queue. Place each in one
  // input-order pass after its already-placed predecessors — deterministic,
  // and the ribbons that close the loop simply flow backwards.
  const placed = new Set(columns.keys())
  for (const node of nodes) {
    if (placed.has(node.id)) continue
    issues.push({
      kind: "cycle",
      nodeId: node.id,
      message: `node ${node.id} sits in a cycle; placed by input order`,
    })
    let depth = 0
    for (const previous of incoming.get(node.id)!) {
      if (placed.has(previous)) {
        depth = Math.max(depth, (columns.get(previous) ?? 0) + 1)
      }
    }
    columns.set(node.id, depth)
    placed.add(node.id)
  }
  return columns
}

/**
 * Computes the full diagram geometry for one box size. Columns are spread
 * across the width; each column's node stack is scaled by the tightest
 * column and stretched vertically so every column fills the height, with
 * the slack shared evenly between its gaps.
 */
export function computeFlowChartLayout(options: FlowChartLayoutOptions): FlowChartLayout {
  const { links, nodeWidth, nodeGap } = options
  const width = Math.max(options.width, nodeWidth)
  const height = Math.max(options.height, 0)
  const align = options.align ?? "justify"

  // Tolerate partial, mid-stream data instead of failing: duplicate node
  // ids keep their first occurrence, and links that are non-positive,
  // self-referential, or waiting on a node that has not arrived yet are
  // simply not laid out this frame.
  const issues: FlowChartLayoutIssue[] = []
  const seen = new Set<string>()
  const nodes: FlowChartNodeInput[] = []
  for (const node of options.nodes) {
    if (seen.has(node.id)) {
      issues.push({
        kind: "duplicate-node",
        nodeId: node.id,
        message: `node ${node.id} appears more than once; kept the first`,
      })
      continue
    }
    seen.add(node.id)
    nodes.push(node)
  }
  const activeLinks: Array<FlowChartLinkInput & { index: number }> = []
  links.forEach((link, index) => {
    if (link.value <= 0) return
    if (link.source === link.target) {
      issues.push({
        kind: "self-link",
        linkIndex: index,
        message: `link ${link.source} targets itself; dropped`,
      })
      return
    }
    if (!seen.has(link.source) || !seen.has(link.target)) {
      issues.push({
        kind: "unknown-endpoint",
        linkIndex: index,
        message: `link ${link.source} → ${link.target} references a node not (yet) present; dropped`,
      })
      return
    }
    activeLinks.push({ ...link, index })
  })

  const columns = assignColumns(nodes, activeLinks, issues)

  const states = new Map<string, NodeState>()
  nodes.forEach((node, order) => {
    states.set(node.id, {
      id: node.id,
      order,
      column: columns.get(node.id) ?? 0,
      inValue: 0,
      outValue: 0,
      value: 0,
    })
  })
  for (const link of activeLinks) {
    states.get(link.source)!.outValue += link.value
    states.get(link.target)!.inValue += link.value
  }
  for (const state of states.values()) {
    state.value = Math.max(state.inValue, state.outValue)
  }

  let columnCount = 0
  for (const state of states.values()) {
    columnCount = Math.max(columnCount, state.column + 1)
  }
  if (align === "justify" && columnCount > 1) {
    for (const state of states.values()) {
      if (state.outValue === 0) state.column = columnCount - 1
    }
  }

  const byColumn: NodeState[][] = Array.from({ length: columnCount }, () => [])
  for (const state of states.values()) {
    byColumn[state.column].push(state)
  }
  for (const column of byColumn) {
    column.sort((a, b) => a.order - b.order)
  }

  // The tightest column sets the value-to-pixel scale so every column fits.
  let scale = Infinity
  for (const column of byColumn) {
    const total = column.reduce((sum, node) => sum + node.value, 0)
    if (total <= 0) continue
    const available = height - nodeGap * (column.length - 1)
    scale = Math.min(scale, Math.max(available, 0) / total)
  }
  if (!Number.isFinite(scale)) scale = 0

  const columnGap =
    columnCount > 1 ? (width - nodeWidth * columnCount) / (columnCount - 1) : 0

  const positioned = new Map<string, FlowChartLayoutNode>()
  const columnTotals: number[] = []
  byColumn.forEach((column, columnIndex) => {
    const total = column.reduce((sum, node) => sum + node.value, 0)
    columnTotals.push(total)
    const stack = total * scale
    // Share the leftover height evenly among the gaps so the column fills
    // the box; a lone node centers instead.
    const slack = Math.max(height - stack - nodeGap * (column.length - 1), 0)
    const gap =
      column.length > 1 ? nodeGap + slack / (column.length - 1) : nodeGap
    let y = column.length > 1 ? 0 : slack / 2
    const x = columnIndex * (nodeWidth + columnGap)
    for (const node of column) {
      const nodeHeight = node.value * scale
      positioned.set(node.id, {
        id: node.id,
        column: columnIndex,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        value: node.value,
        inValue: node.inValue,
        outValue: node.outValue,
      })
      y += nodeHeight + gap
    }
  })

  // Slot links along each bar, ordered by the counterpart bar's vertical
  // position so ribbons fan out without gratuitous crossings.
  const outCursor = new Map<string, number>()
  const inCursor = new Map<string, number>()
  const bySourceOrder = [...activeLinks].sort((a, b) => {
    const ay = positioned.get(a.target)!.y - positioned.get(b.target)!.y
    return ay !== 0 ? ay : a.index - b.index
  })
  const sourceY = new Map<number, number>()
  for (const link of bySourceOrder) {
    const bar = positioned.get(link.source)!
    const offset = outCursor.get(link.source) ?? 0
    sourceY.set(link.index, bar.y + offset)
    outCursor.set(link.source, offset + link.value * scale)
  }
  const byTargetOrder = [...activeLinks].sort((a, b) => {
    const ay = positioned.get(a.source)!.y - positioned.get(b.source)!.y
    return ay !== 0 ? ay : a.index - b.index
  })
  const targetY = new Map<number, number>()
  for (const link of byTargetOrder) {
    const bar = positioned.get(link.target)!
    const offset = inCursor.get(link.target) ?? 0
    targetY.set(link.index, bar.y + offset)
    inCursor.set(link.target, offset + link.value * scale)
  }

  const layoutLinks: FlowChartLayoutLink[] = activeLinks.map((link) => {
    const source = positioned.get(link.source)!
    const target = positioned.get(link.target)!
    return {
      index: link.index,
      source: link.source,
      target: link.target,
      value: link.value,
      sourceY: sourceY.get(link.index)!,
      targetY: targetY.get(link.index)!,
      sourceX: source.x + source.width,
      targetX: target.x,
      thickness: link.value * scale,
    }
  })

  return {
    nodes: [...positioned.values()],
    links: layoutLinks,
    columnCount,
    columnTotals,
    issues,
  }
}

/**
 * SVG path for a link's filled ribbon. `curvature` in [0, 1] moves the
 * bezier control points from the bar edges (0, straight taper) toward the
 * horizontal midpoint (1, the classic S curve).
 */
export function flowChartRibbonPath(
  link: FlowChartLayoutLink,
  curvature: number,
): string {
  const { sourceX, targetX, sourceY, targetY } = link
  // Ribbons thinner than a hairline stay visible.
  const thickness = Math.max(link.thickness, 1)
  const c0 = sourceX + (targetX - sourceX) * 0.5 * curvature
  const c1 = targetX - (targetX - sourceX) * 0.5 * curvature
  const s0 = sourceY
  const s1 = sourceY + thickness
  const t0 = targetY
  const t1 = targetY + thickness
  return [
    `M ${sourceX} ${s0}`,
    `C ${c0} ${s0} ${c1} ${t0} ${targetX} ${t0}`,
    `L ${targetX} ${t1}`,
    `C ${c1} ${t1} ${c0} ${s1} ${sourceX} ${s1}`,
    "Z",
  ].join(" ")
}

/**
 * SVG path for the ribbon's center line — the emphasis stroke drawn along a
 * selected link.
 */
export function flowChartCenterlinePath(link: FlowChartLayoutLink): string {
  const { sourceX, targetX, sourceY, targetY } = link
  const thickness = Math.max(link.thickness, 1)
  const mid = (sourceX + targetX) / 2
  const s = sourceY + thickness / 2
  const t = targetY + thickness / 2
  return `M ${sourceX} ${s} C ${mid} ${s} ${mid} ${t} ${targetX} ${t}`
}
