"use client"

/** @responsibility Renders a flow (Sankey) diagram — node bars, proportional ribbons, and labels — that fills its host's box, with hover emphasis and controllable link selection. Geometry comes from flow-chart-layout. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  computeFlowChartLayout,
  flowChartCenterlinePath,
  flowChartRibbonPath,
  type FlowChartAlign,
  type FlowChartLayout,
  type FlowChartLayoutIssue,
  type FlowChartLayoutNode,
} from "./flow-chart-layout"

/** A flow endpoint. */
export interface FlowChartNode {
  /** Unique id links refer to. */
  id: string
  /** Text shown beside the node bar. Defaults to the id. */
  label?: string
  /**
   * Optional CSS color for the bar and the ribbons leaving it. Omitted,
   * nodes cycle through the chart's `palette`.
   */
  color?: string
}

/**
 * The design system's categorical chart ramp, in slot order: blue, orange,
 * aqua, sand, rose, moss, violet, sky. Node bars take a slot in input order and a
 * slot always means the same entity, so a slice arriving or overtaking
 * another never repaints the ones already on screen.
 *
 * The ramp has two steps per slot, and a component takes the one its mark
 * calls for: a ribbon is a large translucent area, so it takes the pale fill step. Both are tokens, so each theme carries
 * its own pair — a pale tint on the light surface, a deep one on the dark.
 * The slot ORDER is the colour-vision-deficiency safety mechanism:
 * neighbouring slots are the pairs a reader compares, and this order is the
 * one that clears the separation gates in both themes. Reordering it, or
 * generating a ninth hue, breaks that guarantee.
 */
export const flowChartPalette: readonly string[] = Object.freeze([
  "var(--nessa-chart-series-1)",
  "var(--nessa-chart-series-2)",
  "var(--nessa-chart-series-3)",
  "var(--nessa-chart-series-4)",
  "var(--nessa-chart-series-5)",
  "var(--nessa-chart-series-6)",
  "var(--nessa-chart-series-7)",
  "var(--nessa-chart-series-8)",
])

/** A weighted flow between two nodes. */
export interface FlowChartLink {
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
export interface FlowChartNodeContext {
  node: FlowChartNode
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

/** Properties accepted by the FlowChart. */
export interface FlowChartProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  nodes: readonly FlowChartNode[]
  links: readonly FlowChartLink[]
  /** Pixel width of each node bar. */
  nodeWidth?: number
  /** Minimum vertical gap between bars in a column. */
  nodeGap?: number
  /** Ribbon bend, 0 (straight taper) to 1 (full S curve). */
  curvature?: number
  /** Column placement: "justify" (default), "left", "right", or "center". */
  align?: FlowChartAlign
  /**
   * Crossing-minimization passes over each column's node order (d3-style
   * barycenter relaxation). 0 (default) keeps the input order.
   */
  iterations?: number
  /** Flow direction: columns left-to-right (default) or top-to-bottom. */
  orientation?: "horizontal" | "vertical"
  /**
   * How ribbons take color: "source" (default) inherits the source node's
   * tint, "target" the target's, and "gradient" blends source into target
   * along the ribbon.
   */
  linkColor?: "source" | "target" | "gradient"
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
  renderNodeDetail?: (context: FlowChartNodeContext) => React.ReactNode
  /** Accessible name for a link. Defaults to "source to target, value". */
  linkLabel?: (link: FlowChartLink) => string
  /**
   * Tints nodes cycle through in input order; a node's own `color` wins.
   * Pass null for the all-neutral wash.
   */
  palette?: readonly string[] | null
  /** Called as the pointer enters or leaves a ribbon. */
  onHoveredLinkChange?: (
    linkId: string | null,
    link: FlowChartLink | null,
  ) => void
  /**
   * Arbitrary content floated beside the pointer while a ribbon or bar is
   * hovered — a stat line, a Card, anything. Return null to skip a
   * particular hover.
   */
  renderHoverDetail?: (hover: FlowChartHoverContext) => React.ReactNode
  /**
   * Called whenever the set of tolerated data problems changes — dropped
   * links waiting on absent nodes, duplicate nodes, cycle repairs — and
   * once after the first layout to establish the initial state. While
   * data streams in, transient issues come and go; once the stream
   * settles, an empty array is the definitive "everything rendered"
   * signal and anything else is a data error worth surfacing.
   */
  onLayoutIssues?: (issues: FlowChartLayoutIssue[]) => void
  /** Controlled selected link ids; empty for no selection. */
  selectedLinkIds?: readonly string[]
  /** Initial selection when uncontrolled. */
  defaultSelectedLinkIds?: readonly string[]
  /**
   * Called when the selection changes. A plain click (or Enter or Space)
   * selects just that link; with Command or Ctrl held it toggles the link
   * into the existing selection instead.
   */
  onSelectedLinksChange?: (
    linkIds: string[],
    links: FlowChartLink[],
  ) => void
}

/** What the pointer is over when hover detail is rendered. */
export type FlowChartHoverContext =
  | {
      kind: "link"
      linkId: string
      link: FlowChartLink
      source: FlowChartNode
      target: FlowChartNode
    }
  | { kind: "node"; node: FlowChartNode; context: FlowChartNodeContext }

/** Emphasis a bar, ribbon, or label is drawn with. */
type FlowChartEmphasis = "rest" | "active" | "dim"

function linkIdOf(link: FlowChartLink): string {
  return link.id ?? `${link.source}→${link.target}`
}

function useMeasuredBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = React.useState<{ width: number; height: number } | null>(
    null,
  )
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
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
  "cursor-pointer fill-[var(--nessa-flow-chart-color,var(--muted-foreground))] opacity-15 outline-none",
  // `d` is a transitionable presentation attribute, so streamed data
  // updates morph ribbons instead of snapping them.
  "transition-[opacity,d] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "hover:opacity-35",
  "data-[emphasis=active]:opacity-55 data-[emphasis=dim]:opacity-[0.06] data-[emphasis=dim]:hover:opacity-25",
  // Tinted ribbons run their own ramp, well above the neutral wash: a hue has
  // to be identifiable to be worth having, where the gray only has to suggest
  // a path. The resting alpha is the tightest of the four numbers — a Sankey
  // stacks many ribbons over each other, so too high and an overlap reads as
  // one blot, while too low disappears on the dark surface, where alpha over
  // near-black loses far more than the same alpha over white.
  "data-[tinted=true]:opacity-45 data-[tinted=true]:hover:opacity-70",
  "data-[tinted=true]:data-[emphasis=active]:opacity-90 data-[tinted=true]:data-[emphasis=dim]:opacity-15 data-[tinted=true]:data-[emphasis=dim]:hover:opacity-40",
  "focus-visible:stroke-ring focus-visible:stroke-2",
)

const BAR_CLASSES = cn(
  "fill-[var(--nessa-flow-chart-color,var(--muted-foreground))] opacity-45",
  "transition-[opacity,x,y,width,height] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=active]:fill-[var(--nessa-flow-chart-color,var(--foreground))] data-[emphasis=active]:opacity-100 data-[emphasis=dim]:opacity-30",
  // The bars are small, solid, and never overlap, so they carry the pigment
  // at close to full strength — they are where the tint is read from.
  "data-[tinted=true]:opacity-90 data-[tinted=true]:data-[emphasis=active]:opacity-100 data-[tinted=true]:data-[emphasis=dim]:opacity-35",
)

const LABEL_CLASSES = cn(
  "pointer-events-none absolute flex -translate-y-1/2 flex-col justify-center",
  "nessa-text-3 leading-tight text-muted-foreground",
  "transition-[color,top,left] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=active]:font-medium data-[emphasis=active]:text-foreground",
)

/**
 * A flow diagram: node bars in columns joined by ribbons whose thickness is
 * proportional to the flow they carry. The chart fills the box the host
 * gives it on both axes. Ribbons are keyboard-focusable buttons; hovering a
 * ribbon or bar isolates the connected flow, and clicking (or Enter or
 * Space) selects a link so the isolation sticks — with Command or Ctrl
 * held, further links toggle into the selection. Selection is
 * host-controllable through `selectedLinkIds`; Escape or a background
 * click clears it. Node bars take soft tints from the palette and every
 * ribbon inherits its source's tint.
 */
function FlowChart({
  nodes,
  links,
  nodeWidth = 12,
  nodeGap = 20,
  curvature = 0.7,
  align = "justify",
  iterations = 0,
  orientation = "horizontal",
  linkColor = "source",
  labelWidth = 132,
  formatValue = (value) => String(value),
  renderNodeDetail,
  linkLabel,
  palette = flowChartPalette,
  onHoveredLinkChange,
  renderHoverDetail,
  onLayoutIssues,
  selectedLinkIds,
  defaultSelectedLinkIds,
  onSelectedLinksChange,
  className,
  ...props
}: FlowChartProps) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const box = useMeasuredBox(plotRef)

  const [hovered, setHovered] = React.useState<
    { kind: "link"; id: string } | { kind: "node"; id: string } | null
  >(null)
  // Keyboard focus isolates a flow exactly like hover, so Tabbing through
  // the ribbons reads the same as sweeping them with the pointer.
  const [focusedLinkId, setFocusedLinkId] = React.useState<string | null>(null)
  const highlighted =
    hovered ??
    (focusedLinkId !== null
      ? ({ kind: "link", id: focusedLinkId } as const)
      : null)
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<
    readonly string[]
  >(defaultSelectedLinkIds ?? [])
  const selection = selectedLinkIds ?? uncontrolledSelection
  const selectionSet = React.useMemo(() => new Set(selection), [selection])

  // Duplicate ids keep their FIRST occurrence, matching the layout's own
  // dedupe — labels, tints, and hover detail must describe the node the
  // geometry was computed from.
  const uniqueNodes = React.useMemo(() => {
    const seen = new Set<string>()
    const result: FlowChartNode[] = []
    for (const node of nodes) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      result.push(node)
    }
    return result
  }, [nodes])
  const nodeById = React.useMemo(
    () => new Map(uniqueNodes.map((node) => [node.id, node])),
    [uniqueNodes],
  )
  const linkIds = React.useMemo(() => links.map(linkIdOf), [links])
  const linkById = React.useMemo(() => {
    const map = new Map<string, FlowChartLink>()
    links.forEach((link, index) => {
      if (!map.has(linkIds[index])) map.set(linkIds[index], link)
    })
    return map
  }, [links, linkIds])

  const vertical = orientation === "vertical"
  const gradientId = React.useId().replace(/:/g, "")
  // Layout runs in flow space: `width` is the flow axis, `height` the
  // cross axis. Vertical charts swap the box into that space and swap
  // back at render time.
  const layout: FlowChartLayout | null = React.useMemo(() => {
    if (!box || box.width <= 0 || box.height <= 0) return null
    return computeFlowChartLayout({
      nodes,
      links,
      width: vertical ? box.height : box.width,
      height: vertical ? box.width : box.height,
      nodeWidth,
      nodeGap,
      align,
      iterations,
    })
  }, [box, nodes, links, nodeWidth, nodeGap, align, iterations, vertical])

  // Report tolerated data problems whenever their set changes — including
  // the change back to none, which is the "stream rendered cleanly" signal.
  const onLayoutIssuesRef = React.useRef(onLayoutIssues)
  onLayoutIssuesRef.current = onLayoutIssues
  const issuesKey = layout
    ? layout.issues
        .map(
          (issue) =>
            `${issue.kind}@${issue.linkIndex ?? ""}@${issue.nodeId ?? ""}:${issue.message}`,
        )
        .join("\n")
    : null
  React.useEffect(() => {
    if (issuesKey === null || !layout) return
    onLayoutIssuesRef.current?.(layout.issues)
    // The layout object changes identity every resize; only a changed
    // issue set should re-notify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuesKey])

  // A node takes the slot at its own input position, and an explicit colour
  // occupies that slot rather than skipping it: a counter that advanced only
  // on un-coloured nodes would re-slot — and repaint — every node after any
  // one of them gained a colour.
  const colorOf = React.useMemo(() => {
    const colors = new Map<string, string>()
    uniqueNodes.forEach((node, index) => {
      if (node.color) colors.set(node.id, node.color)
      else if (palette && palette.length > 0) {
        colors.set(node.id, palette[index % palette.length])
      }
    })
    return colors
  }, [uniqueNodes, palette])

  const applySelection = (next: string[]) => {
    if (selectedLinkIds === undefined) setUncontrolledSelection(next)
    const chosen = new Set(next)
    onSelectedLinksChange?.(
      next,
      links.filter((link) => chosen.has(linkIdOf(link))),
    )
  }

  /**
   * A plain activation selects just this link (or clears a lone
   * selection of it); an additive one — Command or Ctrl held — toggles
   * the link within the existing selection.
   */
  const activateLink = (link: FlowChartLink, additive: boolean) => {
    const id = linkIdOf(link)
    if (additive) {
      applySelection(
        selectionSet.has(id)
          ? selection.filter((candidate) => candidate !== id)
          : [...selection, id],
      )
      return
    }
    applySelection(
      selection.length === 1 && selection[0] === id ? [] : [id],
    )
  }

  // One pass over the links derives every element's emphasis: links carry
  // their own state, and a node is active exactly when an active link
  // touches it (or it is highlighted itself).
  const { linkEmphasisByIndex, nodeEmphasisById } = React.useMemo(() => {
    const linkMap = new Map<number, FlowChartEmphasis>()
    const nodeMap = new Map<string, FlowChartEmphasis>()
    if (!layout) return { linkEmphasisByIndex: linkMap, nodeEmphasisById: nodeMap }
    const engaged = highlighted !== null || selection.length > 0
    const activeNodes = new Set<string>()
    for (const link of layout.links) {
      const id = linkIds[link.index]
      let emphasis: FlowChartEmphasis
      if (selectionSet.has(id)) emphasis = "active"
      else if (highlighted?.kind === "link") {
        emphasis = highlighted.id === id ? "active" : "dim"
      } else if (highlighted?.kind === "node") {
        emphasis =
          link.source === highlighted.id || link.target === highlighted.id
            ? "active"
            : "dim"
      } else {
        emphasis = selection.length > 0 ? "dim" : "rest"
      }
      linkMap.set(link.index, emphasis)
      if (emphasis === "active") {
        activeNodes.add(link.source)
        activeNodes.add(link.target)
      }
    }
    for (const node of layout.nodes) {
      nodeMap.set(
        node.id,
        !engaged
          ? "rest"
          : (highlighted?.kind === "node" && highlighted.id === node.id) ||
              activeNodes.has(node.id)
            ? "active"
            : "dim",
      )
    }
    return { linkEmphasisByIndex: linkMap, nodeEmphasisById: nodeMap }
  }, [layout, linkIds, selectionSet, selection.length, highlighted])

  const defaultLinkLabel = (link: FlowChartLink) => {
    const sourceLabel = nodeById.get(link.source)?.label ?? link.source
    const targetLabel = nodeById.get(link.target)?.label ?? link.target
    return `${sourceLabel} to ${targetLabel}, ${formatValue(link.value)}`
  }

  const nodeContext = (node: FlowChartLayoutNode): FlowChartNodeContext => ({
    node: nodeById.get(node.id)!,
    value: node.value,
    inValue: node.inValue,
    outValue: node.outValue,
    column: node.column,
    columnCount: layout!.columnCount,
    columnTotal: layout!.columnTotals[node.column],
  })

  // Geometry-derived strings are stable between interaction renders.
  const ribbonPaths = React.useMemo(
    () =>
      layout
        ? layout.links.map((link) =>
            flowChartRibbonPath(link, curvature, vertical),
          )
        : [],
    [layout, curvature, vertical],
  )

  // The hover-detail card follows the pointer imperatively: routing raw
  // pointer coordinates through React state would re-render every ribbon
  // per mousemove just to move a floating card.
  const hoverDetailRef = React.useRef<HTMLDivElement>(null)
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const positionHoverDetail = React.useCallback(() => {
    const element = hoverDetailRef.current
    const point = lastPointerRef.current
    if (!element || !point || !box) return
    // Flip away from the pointer near the plot's far edges so the card
    // stays inside the chart.
    const flipX = point.x > box.width / 2
    const flipY = point.y > box.height / 2
    element.style.left = `${point.x + (flipX ? -12 : 12)}px`
    element.style.top = `${point.y + (flipY ? -12 : 12)}px`
    element.style.transform = `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`
  }, [box])

  const gradientDefs = React.useMemo(() => {
    if (!layout || linkColor !== "gradient") return null
    return (
      <defs>
        {layout.links.map((layoutLink) => {
          const sourceTint = colorOf.get(layoutLink.source)
          const targetTint = colorOf.get(layoutLink.target)
          return (
            <linearGradient
              key={layoutLink.index}
              id={`${gradientId}-${layoutLink.index}`}
              gradientUnits="userSpaceOnUse"
              x1={vertical ? 0 : layoutLink.sourceX}
              y1={vertical ? layoutLink.sourceX : 0}
              x2={vertical ? 0 : layoutLink.targetX}
              y2={vertical ? layoutLink.targetX : 0}
            >
              <stop
                offset="0"
                stopColor={sourceTint}
                className={
                  sourceTint ? undefined : "[stop-color:var(--muted-foreground)]"
                }
              />
              <stop
                offset="1"
                stopColor={targetTint}
                className={
                  targetTint ? undefined : "[stop-color:var(--muted-foreground)]"
                }
              />
            </linearGradient>
          )
        })}
      </defs>
    )
  }, [layout, linkColor, colorOf, vertical, gradientId])

  const hoverDetail =
    renderHoverDetail && hovered && layout
      ? (() => {
          if (hovered.kind === "link") {
            const link = linkById.get(hovered.id)
            if (!link) return null
            return renderHoverDetail({
              kind: "link",
              linkId: hovered.id,
              link,
              source: nodeById.get(link.source)!,
              target: nodeById.get(link.target)!,
            })
          }
          const layoutNode = layout.nodes.find(
            (candidate) => candidate.id === hovered.id,
          )
          if (!layoutNode) return null
          return renderHoverDetail({
            kind: "node",
            node: nodeById.get(hovered.id)!,
            context: nodeContext(layoutNode),
          })
        })()
      : null

  return (
    <div
      data-slot="flow-chart"
      // The host names the chart through aria-label, which a role-less
      // generic element may not carry. "group" permits the name and, unlike
      // "img", leaves the focusable ribbons inside reachable.
      role="group"
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 font-sans text-foreground",
        className,
      )}
      {...props}
      // Spread first, then compose: a host that passes its own onKeyDown
      // would otherwise replace this one and silently lose Escape-to-clear.
      onKeyDown={(event) => {
        props.onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === "Escape" && selection.length > 0) {
          event.stopPropagation()
          applySelection([])
        }
      }}
    >
      <div
        ref={plotRef}
        className={cn(
          "relative min-h-0 min-w-0 flex-1",
          vertical
            ? "my-(--nessa-flow-chart-label-width)"
            : "mx-(--nessa-flow-chart-label-width)",
        )}
        style={
          {
            "--nessa-flow-chart-label-width": `${labelWidth > 0 ? labelWidth : 0}px`,
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
              if (
                event.target === event.currentTarget &&
                selection.length > 0
              ) {
                applySelection([])
              }
            }}
            onPointerMove={
              renderHoverDetail
                ? (event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    lastPointerRef.current = {
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                    }
                    positionHoverDetail()
                  }
                : undefined
            }
          >
            {gradientDefs}
            {layout.links.map((layoutLink, renderIndex) => {
              const link = links[layoutLink.index]
              const id = linkIds[layoutLink.index]
              // The ribbon's paint: its anchor node's tint, or a gradient
              // blending source into target. Either lands in the same
              // custom property the fill classes read.
              const anchorTint = colorOf.get(
                linkColor === "target" ? link.target : link.source,
              )
              const tinted =
                linkColor === "gradient"
                  ? colorOf.has(link.source) || colorOf.has(link.target)
                  : anchorTint !== undefined
              const paint =
                linkColor === "gradient"
                  ? `url(#${gradientId}-${layoutLink.index})`
                  : anchorTint
              return (
                <path
                  // Parallel links between the same pair share the default
                  // id, so the input index keeps keys unique regardless.
                  key={`${id}#${layoutLink.index}`}
                  data-slot="flow-chart-link"
                  data-link-id={id}
                  data-tinted={tinted ? "true" : "false"}
                  data-emphasis={linkEmphasisByIndex.get(layoutLink.index)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectionSet.has(id)}
                  aria-label={(linkLabel ?? defaultLinkLabel)(link)}
                  d={ribbonPaths[renderIndex]}
                  className={RIBBON_CLASSES}
                  style={
                    paint
                      ? ({ "--nessa-flow-chart-color": paint } as React.CSSProperties)
                      : undefined
                  }
                  onFocus={() => setFocusedLinkId(id)}
                  onBlur={() =>
                    setFocusedLinkId((previous) =>
                      previous === id ? null : previous,
                    )
                  }
                  onPointerEnter={() => {
                    setHovered({ kind: "link", id })
                    onHoveredLinkChange?.(id, link)
                  }}
                  onPointerLeave={() => {
                    setHovered((previous) =>
                      previous?.kind === "link" && previous.id === id
                        ? null
                        : previous,
                    )
                    onHoveredLinkChange?.(null, null)
                  }}
                  onClick={(event) =>
                    activateLink(link, event.metaKey || event.ctrlKey)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      activateLink(link, event.metaKey || event.ctrlKey)
                    }
                  }}
                />
              )
            })}
            {/* A selected flow keeps a distinct mark — a centerline
                stroke — so it stays readable while other flows hover. */}
            {layout.links.map((layoutLink) =>
              selectionSet.has(linkIds[layoutLink.index]) ? (
                <path
                  key={`centerline-${layoutLink.index}`}
                  data-slot="flow-chart-centerline"
                  aria-hidden="true"
                  d={flowChartCenterlinePath(layoutLink, vertical)}
                  className="pointer-events-none fill-none stroke-foreground opacity-60 stroke-[1.5]"
                  strokeLinecap="round"
                />
              ) : null,
            )}
            {layout.nodes.map((node) => (
              <rect
                key={node.id}
                data-slot="flow-chart-node"
                data-node-id={node.id}
                data-tinted={colorOf.has(node.id) ? "true" : "false"}
                data-emphasis={nodeEmphasisById.get(node.id)}
                aria-hidden="true"
                x={vertical ? node.y : node.x}
                y={vertical ? node.x : node.y}
                width={vertical ? Math.max(node.height, 1) : node.width}
                height={vertical ? node.width : Math.max(node.height, 1)}
                rx={Math.min(4, node.width / 2)}
                className={BAR_CLASSES}
                style={
                  colorOf.has(node.id)
                    ? ({
                        "--nessa-flow-chart-color": colorOf.get(node.id),
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
              // Vertical labels always read inline (they sit above or
              // below a bar, where stacking would collide with ribbons);
              // horizontal labels read inline only at the sinks.
              const inline = vertical ? true : last
              // Flow-space coordinates: node.x runs along the flow axis,
              // node.y across it. Horizontal charts label into the side
              // gutters; vertical ones into the top/bottom gutters,
              // centered on the bar.
              const barCross = node.y + Math.max(node.height, 1) / 2
              const style: React.CSSProperties = vertical
                ? {
                    left: barCross,
                    top: first ? node.x - 8 : node.x + node.width + 8,
                    maxWidth: Math.max(labelWidth, 96),
                  }
                : {
                    top: barCross,
                    width: labelWidth - 8,
                    left: first ? node.x - labelWidth : node.x + node.width + 8,
                    // Middle-column labels overlay the ribbons beside
                    // their bar; only the outer columns get the reserved
                    // gutters.
                    maxWidth: first || last ? undefined : labelWidth - 8,
                  }
              return (
                <div
                  key={node.id}
                  data-slot="flow-chart-label"
                  data-emphasis={nodeEmphasisById.get(node.id)}
                  className={cn(
                    LABEL_CLASSES,
                    first ? "items-end text-right" : "items-start text-left",
                    // Inline labels read "Browsing · 22%"; stacked ones
                    // put the name over the detail.
                    inline && "flex-row items-baseline gap-1",
                    vertical &&
                      cn(
                        "-translate-x-1/2 items-center text-center",
                        first ? "-translate-y-full" : "translate-y-0",
                      ),
                  )}
                  style={style}
                >
                  <span className="max-w-full truncate">
                    {input.label ?? input.id}
                  </span>
                  {detail == null ? null : (
                    <span className="nessa-text-2 shrink-0 truncate">
                      {inline ? <>&middot; {detail}</> : detail}
                    </span>
                  )}
                </div>
              )
            })
          : null}
        {hoverDetail != null ? (
          <div
            ref={(element) => {
              hoverDetailRef.current = element
              // Position immediately on mount so the card never flashes
              // at a stale spot before the next pointer move.
              if (element) positionHoverDetail()
            }}
            data-slot="flow-chart-hover-detail"
            className="pointer-events-none absolute w-max"
            style={{ left: -9999, top: 0 }}
          >
            {hoverDetail}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { FlowChart, linkIdOf as flowChartLinkId }
