"use client"

import * as React from "react"
import { Badge } from "../badge"
import { Button } from "../button"
import { VirtualList } from "../virtual-list"
import { cn } from "@/lib/utils"
import { layoutGitHistory, type GitCommit } from "./git-history-layout"

export { layoutGitHistory, type GitCommit, type GitGraphRow } from "./git-history-layout"

export interface GitHistoryProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  commits: readonly GitCommit[]
  /** CSS colors or variables assigned cyclically to graph lanes. Omitted or empty uses Nessa theme-aware chart colors. Choose colors that contrast with the surface. */
  palette?: readonly string[]
  /** Mount only visible rows by default. Disable for browser find or complete accessibility traversal. */
  virtualize?: boolean
  /** Fixed row height in CSS pixels, at least 32. Defaults to 56; rows below 48 use single-line compact metadata. Increase for larger fonts. */
  rowHeight?: number
  /** Scroll viewport height in CSS pixels. Defaults to 448. */
  height?: number
  /** Development-only VirtualList scroll/commit trace. */
  debug?: boolean
  selectedHash?: string
  onSelect?: (commit: GitCommit) => void
  /** Replaces the default empty-state message. */
  emptyMessage?: React.ReactNode
}

/** Displays host-supplied topological Git history with responsive metadata and parent-derived graph lanes. Narrow containers use two-line descriptions; full metadata columns appear at 48rem. Git access and selection state belong to the host. */
export function GitHistory({ commits, virtualize = true, rowHeight = 56, height = 448, selectedHash, onSelect, debug = false, palette, emptyMessage = "No commits to display.", className, ...props }: GitHistoryProps) {
  if (!Number.isFinite(rowHeight) || rowHeight < 32) throw new RangeError("GitHistory rowHeight must be at least 32 CSS pixels.")
  const graph = React.useMemo(() => layoutGitHistory(commits), [commits])
  const graphWidth = Math.max(44, graph.lanes * 10 + 20)
  const columns = "grid grid-cols-[min(22cqw,var(--nessa-git-width))_minmax(0,1fr)] @[48rem]:grid-cols-[min(22cqw,var(--nessa-git-width))_minmax(0,1fr)_140px_120px_76px]"
  return (
    <div {...props} data-slot="git-history" className={cn("@container min-w-0 overflow-hidden rounded-lg border border-border bg-background font-sans nessa-text-3 text-foreground", className)}>
      <div style={{ "--nessa-git-width": `${graphWidth}px` } as React.CSSProperties}>
        <div aria-hidden="true" className={cn(columns, "border-b border-border bg-muted py-2 text-muted-foreground")}>
          <span className="pl-3">Graph</span><span>Commit history</span><span className="hidden @[48rem]:block">Date (UTC)</span><span className="hidden @[48rem]:block">Author</span><span className="hidden @[48rem]:block">Commit</span>
        </div>
        {commits.length === 0 ? <div role="status" className="p-6 text-muted-foreground">{emptyMessage}</div> : (
          <VirtualList aria-label="Git commit history" debug={debug} items={commits} getKey={(commit) => commit.hash} height={height} rowHeight={rowHeight} virtualize={virtualize}>
            {(commit, index) => {
              const row = graph.rows[index]!
              const x = (lane: number) => 14 + lane * 10
              const color = (lane: number) => palette?.length ? palette[lane % palette.length]! : `var(--nessa-chart-series-${lane % 8 + 1}-strong)`
              const date = new Date(commit.date)
              const dateLabel = Number.isNaN(date.getTime()) ? "Unknown date" : date.toISOString().slice(0, 16).replace("T", " ")
              const title = [commit.subject, commit.author, dateLabel + " UTC", commit.hash, ...(commit.refs ?? [])].join(" · ")
              return <div className={cn(columns, "h-full items-center hover:bg-muted", selectedHash === commit.hash && "bg-accent")}>
                <svg aria-hidden="true" className="block h-full w-full" viewBox={`0 0 ${graphWidth} ${rowHeight}`} preserveAspectRatio="none">
                  {row.incoming.map((lane) => <path key={`in-${lane}`} d={`M ${x(lane)} 0 V ${rowHeight / 2}`} stroke={color(lane)} strokeWidth={2} fill="none" />)}
                  {row.edges.map((edge) => <path key={`${edge.from}-${edge.to}`} d={`M ${x(edge.from)} ${rowHeight / 2} C ${x(edge.from)} ${rowHeight}, ${x(edge.to)} ${rowHeight / 2}, ${x(edge.to)} ${rowHeight}`} stroke={color(edge.to)} strokeWidth={2} fill="none" />)}
                  <circle cx={x(row.lane)} cy={rowHeight / 2} r={commit.parents.length > 1 ? 5 : 3.5} fill={color(row.lane)} />
                  {commit.parents.length > 1 && <circle cx={x(row.lane)} cy={rowHeight / 2} r={2} fill="var(--nessa-color-background, var(--background))" />}
                </svg>
                <div className="flex h-full min-w-0 flex-col justify-center gap-1 py-1 pr-3" title={title}>
                  <div className={cn("flex min-h-0 min-w-0 items-center gap-2", rowHeight < 48 && "h-full")}>
                    {onSelect ? <Button variant="ghost" className="h-full min-h-6 min-w-0 shrink flex-1 justify-start px-0 py-0 font-normal nessa-text-3" aria-pressed={selectedHash === commit.hash} onClick={() => onSelect(commit)} title={title}><span className="truncate">{commit.subject}</span></Button> : <span className="min-w-0 flex-1 truncate">{commit.subject}</span>}
                    {!!commit.refs?.length && <Badge variant="outline" className="max-w-[35%] shrink justify-start truncate nessa-text-1" title={commit.refs.join(", ")}>{commit.refs[0]}{commit.refs.length > 1 ? ` +${commit.refs.length - 1}` : ""}</Badge>}
                  </div>
                  {rowHeight >= 48 && <div className="flex min-w-0 items-center gap-2 truncate nessa-text-2 text-muted-foreground @[48rem]:hidden"><span className="truncate">{commit.author}</span><span className="shrink-0">{dateLabel.slice(0, 10)}</span><code className="shrink-0">{commit.hash.slice(0, 7)}</code></div>}
                  <span className="sr-only">{commit.parents.length > 1 ? "Merge commit. " : ""}Parents: {commit.parents.join(", ") || "none"}. References: {commit.refs?.join(", ") || "none"}.{rowHeight < 48 ? ` ${commit.author}, ${dateLabel}, ${commit.hash}` : ""}</span>
                </div>
                <time className="hidden truncate text-muted-foreground @[48rem]:block" dateTime={Number.isNaN(date.getTime()) ? undefined : commit.date}>{dateLabel}</time>
                <span className="hidden truncate pr-3 text-muted-foreground @[48rem]:block" title={commit.author}>{commit.author}</span>
                <code className="hidden truncate text-muted-foreground @[48rem]:block" title={commit.hash}>{commit.hash.slice(0, 7)}</code>
              </div>
            }}
          </VirtualList>
        )}
      </div>
    </div>
  )
}
