"use client"

/** @responsibility Renders a flow (Sankey) diagram — node bars, proportional ribbons, and labels — that fills its host's box, with hover emphasis and controllable link selection. Geometry comes from sankey-chart-layout. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  computeSankeyLayout,
  sankeyCenterlinePath,
  sankeyRibbonPath,
  type SankeyAlign,
  type SankeyLayout,
  type SankeyLayoutLink,
  type SankeyLayoutNode,
} from "./sankey-chart-layout"

/** A flow endpoint. */
export interface SankeyChartNode {
  /** Unique id links refer to. */
  id: string
  /** Text shown beside the node bar. Defaults to the id. */
  label?: string
  /**
   * Optional CSS color for the bar and the ribbons leaving it. Omitted,
   * both draw in the neutral foreground wash.
   */
  color?: string
}

/** A weighted flow between two nodes. */
export interface SankeyChartLink {
  /**
   * Stable id for selection. Defaults to `${source}→${target}`, so parallel
   * links between the same pair need explicit ids.
   */
  id?: string
  source: string
  target: string
  value: number
}

/** Everything known about a node when a label or detail is rendered. */
export interface SankeyChartNodeContext {
  node: SankeyChartNode
  /** Flow through the node: max of incoming and outgoing sums. */
  value: number
  inValue: number
  outValue: number
  /** Zero-based column the node landed in. */
  column: number
  columnCount: number
  /** Sum of node values in this node's column. */
  columnTotal: number
}

/** Properties accepted by the SankeyChart. */
export interface SankeyChartProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  nodes: readonly SankeyChartNode[]
  links: readonly SankeyChartLink[]
  /** Pixel width of each node bar. */
  nodeWidth?: number
  /** Minimum vertical gap between bars in a column. */
  nodeGap?: number
  /** Ribbon bend, 0 (straight taper) to 1 (full S curve). */
  curvature?: number
  /** Column placement for nodes without outgoing flow. */
  align?: SankeyAlign
  /**
   * Width of the label gutters reserved left and right of the diagram.
   * Zero hides the labels entirely.
   */
  labelWidth?: number
  /** Formats a flow value wherever one is shown. */
  formatValue?: (value: number) => string
  /**
   * Second label line under a node's name — defaults to the formatted node
   * value. Return null to drop the line for that node.
   */
  renderNodeDetail?: (context: SankeyChartNodeContext) => React.ReactNode
  /** Accessible name for a link. Defaults to "source to target, value". */
  linkLabel?: (link: SankeyChartLink) => string
  /** Controlled selected link id; null for no selection. */
  selectedLinkId?: string | null
  /** Initial selection when uncontrolled. */
  defaultSelectedLinkId?: string | null
  /** Called when a link is selected (click, Enter, Space) or cleared. */
  onSelectedLinkChange?: (
    linkId: string | null,
    link: SankeyChartLink | null,
  ) => void
}

/** Emphasis a bar, ribbon, or label is drawn with. */
type SankeyEmphasis = "rest" | "active" | "dim"

function linkIdOf(link: SankeyChartLink): string {
  return link.id ?? `${link.source}→${link.target}`
}

function useMeasuredBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = React.useState<{ width: number; height: number } | null>(
    null,
  )
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1].contentRect
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      setBox((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return box
}

const RIBBON_CLASSES = cn(
  "cursor-pointer fill-[var(--nessa-sankey-color,var(--muted-foreground))] opacity-15 outline-none",
  "transition-opacity [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "hover:opacity-35",
  "data-[emphasis=active]:opacity-55 data-[emphasis=dim]:opacity-[0.06] data-[emphasis=dim]:hover:opacity-25",
  "focus-visible:stroke-ring focus-visible:stroke-2",
)

const BAR_CLASSES = cn(
  "fill-[var(--nessa-sankey-color,var(--muted-foreground))] opacity-45",
  "transition-opacity [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=active]:fill-[var(--nessa-sankey-color,var(--foreground))] data-[emphasis=active]:opacity-100 data-[emphasis=dim]:opacity-30",
)

const LABEL_CLASSES = cn(
  "pointer-events-none absolute flex -translate-y-1/2 flex-col justify-center",
  "nessa-text-3 leading-tight text-muted-foreground",
  "transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=active]:font-medium data-[emphasis=active]:text-foreground",
)

/**
 * A flow diagram: node bars in columns joined by ribbons whose thickness is
 * proportional to the flow they carry. The chart fills the box the host
 * gives it on both axes. Ribbons are keyboard-focusable buttons; hovering a
 * ribbon or bar emphasizes the connected flow, and clicking (or Enter or
 * Space) selects a link, drawing its centerline. Selection is
 * host-controllable through `selectedLinkId`; Escape or a background click
 * clears it.
 */
function SankeyChart({
  nodes,
  links,
  nodeWidth = 12,
  nodeGap = 12,
  curvature = 0.7,
  align = "justify",
  labelWidth = 132,
  formatValue = (value) => String(value),
  renderNodeDetail,
  linkLabel,
  selectedLinkId,
  defaultSelectedLinkId = null,
  onSelectedLinkChange,
  className,
  ...props
}: SankeyChartProps) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const box = useMeasuredBox(plotRef)

  const [hovered, setHovered] = React.useState<
    { kind: "link"; id: string } | { kind: "node"; id: string } | null
  >(null)
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState(
    defaultSelectedLinkId,
  )
  const selection =
    selectedLinkId !== undefined ? selectedLinkId : uncontrolledSelection

  const nodeById = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  )

  const layout: SankeyLayout | null = React.useMemo(() => {
    if (!box || box.width <= 0 || box.height <= 0) return null
    return computeSankeyLayout({
      nodes,
      links,
      width: box.width,
      height: box.height,
      nodeWidth,
      nodeGap,
      align,
    })
  }, [box, nodes, links, nodeWidth, nodeGap, align])

  const selectLink = (link: SankeyChartLink | null) => {
    const id = link ? linkIdOf(link) : null
    if (selectedLinkId === undefined) setUncontrolledSelection(id)
    onSelectedLinkChange?.(id, link)
  }

  const linkEmphasis = (link: SankeyLayoutLink): SankeyEmphasis => {
    const id = linkIdOf(links[link.index])
    if (selection === id) return "active"
    if (hovered?.kind === "link") {
      return hovered.id === id ? "active" : "dim"
    }
    if (hovered?.kind === "node") {
      return link.source === hovered.id || link.target === hovered.id
        ? "active"
        : "dim"
    }
    return selection !== null && selection !== undefined ? "dim" : "rest"
  }

  const nodeEmphasis = (node: SankeyLayoutNode): SankeyEmphasis => {
    const engaged =
      hovered !== null || (selection !== null && selection !== undefined)
    if (!engaged) return "rest"
    if (hovered?.kind === "node" && hovered.id === node.id) return "active"
    const touched = layout?.links.some(
      (link) =>
        (link.source === node.id || link.target === node.id) &&
        linkEmphasis(link) === "active",
    )
    return touched ? "active" : "dim"
  }

  const defaultLinkLabel = (link: SankeyChartLink) => {
    const sourceLabel = nodeById.get(link.source)?.label ?? link.source
    const targetLabel = nodeById.get(link.target)?.label ?? link.target
    return `${sourceLabel} to ${targetLabel}, ${formatValue(link.value)}`
  }

  const nodeContext = (node: SankeyLayoutNode): SankeyChartNodeContext => ({
    node: nodeById.get(node.id)!,
    value: node.value,
    inValue: node.inValue,
    outValue: node.outValue,
    column: node.column,
    columnCount: layout!.columnCount,
    columnTotal: layout!.columnTotals[node.column],
  })

  const selectedLayoutLink = layout?.links.find(
    (link) => linkIdOf(links[link.index]) === selection,
  )

  return (
    <div
      data-slot="sankey-chart"
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 font-sans text-foreground",
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selection != null) {
          event.stopPropagation()
          selectLink(null)
        }
      }}
      {...props}
    >
      <div
        ref={plotRef}
        className="mx-(--nessa-sankey-label-width) relative min-h-0 min-w-0 flex-1"
        style={
          {
            "--nessa-sankey-label-width": `${labelWidth > 0 ? labelWidth : 0}px`,
          } as React.CSSProperties
        }
      >
        {layout ? (
          <svg
            className="absolute inset-0 size-full overflow-visible"
            width={box!.width}
            height={box!.height}
            onPointerDown={(event) => {
              // A press on empty background clears the selection.
              if (event.target === event.currentTarget && selection != null) {
                selectLink(null)
              }
            }}
          >
            {layout.links.map((layoutLink) => {
              const link = links[layoutLink.index]
              const id = linkIdOf(link)
              const color = nodeById.get(link.source)?.color
              return (
                <path
                  key={id}
                  data-slot="sankey-chart-link"
                  data-link-id={id}
                  data-emphasis={linkEmphasis(layoutLink)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selection === id}
                  aria-label={(linkLabel ?? defaultLinkLabel)(link)}
                  d={sankeyRibbonPath(layoutLink, curvature)}
                  className={RIBBON_CLASSES}
                  style={
                    color
                      ? ({ "--nessa-sankey-color": color } as React.CSSProperties)
                      : undefined
                  }
                  onPointerEnter={() => setHovered({ kind: "link", id })}
                  onPointerLeave={() =>
                    setHovered((previous) =>
                      previous?.kind === "link" && previous.id === id
                        ? null
                        : previous,
                    )
                  }
                  onClick={() => selectLink(selection === id ? null : link)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      selectLink(selection === id ? null : link)
                    }
                  }}
                />
              )
            })}
            {selectedLayoutLink ? (
              <path
                data-slot="sankey-chart-centerline"
                aria-hidden="true"
                d={sankeyCenterlinePath(selectedLayoutLink)}
                className="pointer-events-none fill-none stroke-[var(--nessa-sankey-color,var(--foreground))] stroke-2"
                strokeLinecap="round"
                style={
                  nodeById.get(selectedLayoutLink.source)?.color
                    ? ({
                        "--nessa-sankey-color": nodeById.get(
                          selectedLayoutLink.source,
                        )!.color,
                      } as React.CSSProperties)
                    : undefined
                }
              />
            ) : null}
            {layout.nodes.map((node) => (
              <rect
                key={node.id}
                data-slot="sankey-chart-node"
                data-node-id={node.id}
                data-emphasis={nodeEmphasis(node)}
                aria-hidden="true"
                x={node.x}
                y={node.y}
                width={node.width}
                height={Math.max(node.height, 1)}
                rx={Math.min(3, node.width / 2)}
                className={BAR_CLASSES}
                style={
                  nodeById.get(node.id)?.color
                    ? ({
                        "--nessa-sankey-color": nodeById.get(node.id)!.color,
                      } as React.CSSProperties)
                    : undefined
                }
                onPointerEnter={() =>
                  setHovered({ kind: "node", id: node.id })
                }
                onPointerLeave={() =>
                  setHovered((previous) =>
                    previous?.kind === "node" && previous.id === node.id
                      ? null
                      : previous,
                  )
                }
              />
            ))}
          </svg>
        ) : null}
        {layout && labelWidth > 0
          ? layout.nodes.map((node) => {
              const input = nodeById.get(node.id)!
              const context = nodeContext(node)
              const detail = renderNodeDetail
                ? renderNodeDetail(context)
                : formatValue(node.value)
              const first = node.column === 0
              const last = node.column === layout.columnCount - 1
              return (
                <div
                  key={node.id}
                  data-slot="sankey-chart-label"
                  data-emphasis={nodeEmphasis(node)}
                  className={cn(
                    LABEL_CLASSES,
                    first ? "items-end text-right" : "items-start text-left",
                  )}
                  style={{
                    top: node.y + Math.max(node.height, 1) / 2,
                    width: labelWidth - 8,
                    left: first
                      ? node.x - labelWidth
                      : node.x + node.width + 8,
                    // Middle-column labels overlay the ribbons to the
                    // right of their bar; only the outer columns get the
                    // reserved gutters.
                    maxWidth: first || last ? undefined : labelWidth - 8,
                  }}
                >
                  <span className="max-w-full truncate">
                    {input.label ?? input.id}
                  </span>
                  {detail == null ? null : (
                    <span className="nessa-text-2 max-w-full truncate">
                      {detail}
                    </span>
                  )}
                </div>
              )
            })
          : null}
      </div>
    </div>
  )
}

export { SankeyChart, linkIdOf as sankeyChartLinkId }
