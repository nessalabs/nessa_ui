import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Flag,
  ListChecks,
  Maximize2,
  RotateCcw,
  Plus,
  Radio,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react"
import {
  Button,
  WorkflowCanvas,
  WorkflowCanvasConnectionLine,
  WorkflowCanvasEdge,
  WorkflowCanvasEdges,
  WorkflowCanvasGrid,
  WorkflowCanvasNode,
  WorkflowCanvasNodeBody,
  WorkflowCanvasNodeHandle,
  WorkflowCanvasNodeToggle,
  WorkflowCanvasSurface,
  cn,
  useWorkflowCanvasEdgeGeometry,
  type WorkflowCanvasConnection,
  type WorkflowCanvasConnectionEnd,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Agents/WorkflowCanvas",
  component: WorkflowCanvas,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "WorkflowCanvas is a pannable, zoomable window onto a plane of nodes and edges. The canvas is infinite by default or confined by bounds; the viewport is controlled or uncontrolled and reported through onViewportChange. Nodes are plain containers that render any content — cards, forms, even a whole nested canvas — drag with the pointer, move with arrow keys, and anchor edges by id. Handles on node sides reveal on hover and focus (the default dot swaps for any custom indicator passed as children) and draw live connections that settle through onConnect. Edges auto-align by default — each one leaves and enters whichever facing sides connect its nodes most directly, re-routing live as nodes move; pin sides with sourceSide/targetSide or disable with autoAlign={false}. An edge with onClick becomes a focusable button with a generous hit area for selection; its line restyles through className, the pending line through the connectionLine slot, and useWorkflowCanvasEdgeGeometry backs fully custom edge components. Delete or Backspace on a focused node or edge reports through its onDelete; a connection released over empty canvas reports its drop point through onConnectEnd, ready for follow-up UI like a node palette; and WorkflowCanvasNodeToggle with WorkflowCanvasNodeBody folds any node — a whole nested subflow included — down to its header until it is wanted. A canvas nested inside another canvas' node presents read-only by default (pan, zoom, resize, and collapse only — no dragging, connecting, or deleting; readOnly={false} opts back in), and nesting is meant to stop at one level: represent deeper workflows as plain nodes whose open control navigates to that flow. Geometry lives in a per-node subscription store, so moving one node re-renders only that node and the edges attached to it; panning and zooming touch a single transform. That keeps interactions smooth with thousands of nodes on the plane.",
      },
    },
  },
} satisfies Meta<typeof WorkflowCanvas>

export default meta
type Story = StoryObj<typeof meta>

function StoryFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "h-[32rem] w-full overflow-hidden bg-background p-4",
        className,
      )}
    >
      <div className="h-full w-full overflow-hidden rounded-3xl border border-border">
        {children}
      </div>
    </div>
  )
}

const jobTones = {
  green: "bg-emerald-500/15 text-emerald-600",
  blue: "bg-sky-500/15 text-sky-600",
  purple: "bg-violet-500/15 text-violet-600",
  red: "bg-rose-500/15 text-rose-600",
  orange: "bg-orange-500/15 text-orange-600",
} as const

function JobCard({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: keyof typeof jobTones
  title: string
  description: string
}) {
  return (
    <div className="flex w-52 items-start gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          jobTones[tone],
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  )
}

function AllHandles() {
  return (
    <>
      <WorkflowCanvasNodeHandle side="top" />
      <WorkflowCanvasNodeHandle side="right" />
      <WorkflowCanvasNodeHandle side="bottom" />
      <WorkflowCanvasNodeHandle side="left" />
    </>
  )
}

interface BoardEdge {
  id: string
  source: string
  target: string
}

const boardJobs = [
  {
    id: "fetch",
    icon: Shuffle,
    tone: "green",
    title: "fetch",
    description: "Pull fresh records",
    position: { x: 60, y: 60 },
  },
  {
    id: "listen",
    icon: Radio,
    tone: "blue",
    title: "listen",
    description: "Wait for webhooks",
    position: { x: 60, y: 260 },
  },
  {
    id: "enrich",
    icon: Sparkles,
    tone: "purple",
    title: "enrich",
    description: "Add model context",
    position: { x: 380, y: 160 },
  },
  {
    id: "notify",
    icon: Bell,
    tone: "orange",
    title: "notify",
    description: "Ping the channel",
    position: { x: 660, y: 300 },
  },
] as const

function WorkflowBoardDemo() {
  const [nodes, setNodes] = React.useState<readonly (typeof boardJobs)[number][]>(
    boardJobs,
  )
  const [edges, setEdges] = React.useState<BoardEdge[]>([
    { id: "fetch-enrich", source: "fetch", target: "enrich" },
    { id: "listen-enrich", source: "listen", target: "enrich" },
    { id: "enrich-notify", source: "enrich", target: "notify" },
  ])
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(
    null,
  )

  const removeNode = (nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    )
  }

  return (
    <WorkflowCanvas
      aria-label="Automation workflow"
      onConnect={(connection) =>
        setEdges((current) => [
          ...current,
          {
            id: `${connection.source}-${connection.target}-${current.length}`,
            source: connection.source,
            target: connection.target,
          },
        ])
      }
    >
      <WorkflowCanvasGrid />
      <WorkflowCanvasSurface>
        <WorkflowCanvasEdges>
          {edges.map((edge) => (
            <WorkflowCanvasEdge
              key={edge.id}
              source={edge.source}
              target={edge.target}
              selected={selectedEdgeId === edge.id}
              aria-label={`Edge from ${edge.source} to ${edge.target}`}
              onClick={() =>
                setSelectedEdgeId((current) =>
                  current === edge.id ? null : edge.id,
                )
              }
              onDelete={() =>
                setEdges((current) =>
                  current.filter((candidate) => candidate.id !== edge.id),
                )
              }
            />
          ))}
        </WorkflowCanvasEdges>
        {nodes.map((job) => (
          <WorkflowCanvasNode
            key={job.id}
            nodeId={job.id}
            defaultPosition={job.position}
            selected={job.id === "enrich"}
            aria-label={`${job.title} job`}
            onDelete={() => removeNode(job.id)}
          >
            <JobCard
              icon={job.icon}
              tone={job.tone}
              title={job.title}
              description={job.description}
            />
            <AllHandles />
          </WorkflowCanvasNode>
        ))}
      </WorkflowCanvasSurface>
    </WorkflowCanvas>
  )
}

/**
 * Reads a transform into plain numbers. Browsers do not serialize
 * `style.transform` identically — Chromium keeps `translate(-48px, 0px)`
 * while Firefox drops the zero and writes `translate(-48px)` — so these
 * assertions compare numbers instead of the serialized string.
 *
 * @param transform - The element's inline transform.
 * @returns The translation and scale it encodes.
 */
function readTransform(transform: string | undefined) {
  const translate = /translate\((-?[\d.]+)px(?:,\s*(-?[\d.]+)px)?\)/.exec(
    transform ?? "",
  )
  const scale = /scale\(([\d.]+)\)/.exec(transform ?? "")

  return {
    x: Number(translate?.[1] ?? 0),
    y: Number(translate?.[2] ?? 0),
    zoom: scale ? Number(scale[1]) : 1,
  }
}

export const WorkflowBoard: Story = {
  parameters: storyDocumentation(
    "A small automation board at app fidelity: job cards as nodes over the dotted grid, auto-aligned edges taking the most direct route between cards, and handles revealing on hover and focus. Edges are selectable — click or focus one and press Enter — dragging from a handle onto another card records a new connection through onConnect, and Delete or Backspace on a focused node or edge removes it through onDelete.",
  ),
  render: () => (
    <StoryFrame>
      <WorkflowBoardDemo />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("application", { name: "Automation workflow" }),
    ).toBeVisible()
    await expect(canvas.getByRole("group", { name: "enrich job" })).toBeVisible()

    await waitFor(() => {
      const edges = canvasElement.querySelectorAll(
        '[data-slot="workflow-canvas-edge"]',
      )
      expect(edges).toHaveLength(3)
    })

    // Edges are focusable buttons; Enter toggles selection.
    const edge = canvas.getByRole("button", {
      name: "Edge from fetch to enrich",
    })

    edge.focus()
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(edge).toHaveAttribute("data-selected", "true")
    })

    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(edge).not.toHaveAttribute("data-selected")
    })

    // Delete removes the focused edge from consumer state.
    await userEvent.keyboard("{Delete}")

    await waitFor(() => {
      expect(
        canvasElement.querySelectorAll('[data-slot="workflow-canvas-edge"]'),
      ).toHaveLength(2)
    })

    // Delete removes a focused node, and the board prunes its edges.
    const listenNode = canvas.getByRole("group", { name: "listen job" })

    listenNode.focus()
    await userEvent.keyboard("{Delete}")

    await waitFor(() => {
      expect(
        canvas.queryByRole("group", { name: "listen job" }),
      ).toBeNull()
      expect(
        canvasElement.querySelectorAll('[data-slot="workflow-canvas-edge"]'),
      ).toHaveLength(1)
    })
  },
}

export const DragNode: Story = {
  parameters: storyDocumentation(
    "Dragging a node captures the pointer on the node itself and measures every move against the gesture's starting position, converted through the current zoom. The settled position is reported once through onPositionCommit, and the click that ends a drag never fires as an activation.",
  ),
  render: () => (
    <StoryFrame>
      <WorkflowCanvas aria-label="Drag demo canvas">
        <WorkflowCanvasGrid />
        <WorkflowCanvasSurface>
          <WorkflowCanvasEdges>
            <WorkflowCanvasEdge source="flag" target="validate" />
          </WorkflowCanvasEdges>
          <WorkflowCanvasNode
            nodeId="flag"
            defaultPosition={{ x: 80, y: 120 }}
            aria-label="flag job"
          >
            <JobCard
              icon={Flag}
              tone="red"
              title="flag"
              description="Mark exceptions"
            />
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="validate"
            defaultPosition={{ x: 420, y: 200 }}
            aria-label="validate job"
          >
            <JobCard
              icon={ListChecks}
              tone="blue"
              title="validate"
              description="Check the schema"
            />
          </WorkflowCanvasNode>
        </WorkflowCanvasSurface>
      </WorkflowCanvas>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const node = await canvas.findByRole("group", { name: "flag job" })
    const edge = canvasElement.querySelector(
      '[data-slot="workflow-canvas-edge-line"]',
    )
    const pathBefore = edge?.getAttribute("d")

    const rect = node.getBoundingClientRect()
    const startX = rect.x + rect.width / 2
    const startY = rect.y + rect.height / 2

    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: startX,
        clientY: startY,
      }),
    )
    node.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: startX + 96,
        clientY: startY + 48,
      }),
    )
    node.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: startX + 96,
        clientY: startY + 48,
      }),
    )

    await waitFor(() => {
      expect(getComputedStyle(node).transform).not.toBe("none")
      expect(readTransform(node.style.transform)).toMatchObject({
        x: 176,
        y: 168,
      })
    })

    // The edge re-rendered to follow its moved endpoint.
    await waitFor(() => {
      expect(edge?.getAttribute("d")).not.toBe(pathBefore)
    })
  },
}

function ConnectDemo() {
  const [edges, setEdges] = React.useState<WorkflowCanvasConnection[]>([])

  return (
    <WorkflowCanvas
      aria-label="Connect demo canvas"
      onConnect={(connection) => setEdges((current) => [...current, connection])}
    >
      <WorkflowCanvasGrid />
      <WorkflowCanvasSurface>
        <WorkflowCanvasEdges>
          {edges.map((edge, index) => (
            <WorkflowCanvasEdge
              key={index}
              source={edge.source}
              sourceSide={edge.sourceSide}
              target={edge.target}
              targetSide={edge.targetSide}
            />
          ))}
        </WorkflowCanvasEdges>
        <WorkflowCanvasNode
          nodeId="fetch"
          defaultPosition={{ x: 80, y: 140 }}
          aria-label="fetch job"
        >
          <JobCard
            icon={Shuffle}
            tone="green"
            title="fetch"
            description="Pull fresh records"
          />
          <WorkflowCanvasNodeHandle side="right" aria-label="Connect fetch output" />
        </WorkflowCanvasNode>
        <WorkflowCanvasNode
          nodeId="notify"
          defaultPosition={{ x: 460, y: 220 }}
          aria-label="notify job"
        >
          <JobCard
            icon={Bell}
            tone="orange"
            title="notify"
            description="Ping the channel"
          />
          <WorkflowCanvasNodeHandle side="left" aria-label="Connect notify input" />
        </WorkflowCanvasNode>
      </WorkflowCanvasSurface>
    </WorkflowCanvas>
  )
}

export const ConnectWithKeyboard: Story = {
  parameters: storyDocumentation(
    "The mouse-free path to the same connection gesture, for keyboard users: Tab to a node's handle and press Enter to arm a connection from it — the handle presses in, every handle on the canvas reveals, and no line is drawn yet because the free end has nowhere to be. Then Tab to a handle on another node and press Enter to complete it through onConnect, or press Escape (or click the background) to abandon it. Armed connections also cancel themselves if their source node is deleted, so nothing is ever left dangling.",
  ),
  render: () => (
    <StoryFrame>
      <div className="relative h-full w-full">
        <ConnectDemo />
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
          Tab to a handle · Enter starts · Enter on another node connects ·
          Esc cancels
        </div>
      </div>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sourceHandle = await canvas.findByRole("button", {
      name: "Connect fetch output",
    })
    const targetHandle = await canvas.findByRole("button", {
      name: "Connect notify input",
    })

    sourceHandle.focus()
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(sourceHandle).toHaveAttribute("aria-pressed", "true")
    })

    targetHandle.focus()
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const edge = canvasElement.querySelector(
        '[data-slot="workflow-canvas-edge"][data-source="fetch"][data-target="notify"]',
      )
      expect(edge).not.toBeNull()
    })
    await expect(sourceHandle).toHaveAttribute("aria-pressed", "false")
  },
}

export const ConnectWithPointer: Story = {
  parameters: storyDocumentation(
    "Dragging from a handle draws a live dashed connection line; releasing over another node settles the connection onto that node's nearest side and reports it through onConnect.",
  ),
  render: () => (
    <StoryFrame>
      <ConnectDemo />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sourceHandle = await canvas.findByRole("button", {
      name: "Connect fetch output",
    })
    const targetNode = await canvas.findByRole("group", { name: "notify job" })

    const from = sourceHandle.getBoundingClientRect()
    const to = targetNode.getBoundingClientRect()
    const startX = from.x + from.width / 2
    const startY = from.y + from.height / 2
    const endX = to.x + to.width / 2
    const endY = to.y + to.height / 2

    sourceHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: startX,
        clientY: startY,
      }),
    )

    sourceHandle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: endX,
        clientY: endY,
      }),
    )

    await waitFor(() => {
      expect(
        canvasElement.querySelector(
          '[data-slot="workflow-canvas-connection-line"]',
        ),
      ).not.toBeNull()
    })

    sourceHandle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: endX,
        clientY: endY,
      }),
    )

    await waitFor(() => {
      const edge = canvasElement.querySelector(
        '[data-slot="workflow-canvas-edge"][data-source="fetch"][data-target="notify"]',
      )
      expect(edge).not.toBeNull()
    })
    await expect(
      canvasElement.querySelector(
        '[data-slot="workflow-canvas-connection-line"]',
      ),
    ).toBeNull()
  },
}

export const PanAndZoom: Story = {
  parameters: storyDocumentation(
    "The focused canvas pans with the arrow keys and zooms with + and -; the whole plane moves through a single transform on the surface, so nodes never re-render while navigating.",
  ),
  render: () => (
    <StoryFrame>
      <WorkflowCanvas aria-label="Navigation demo canvas">
        <WorkflowCanvasGrid />
        <WorkflowCanvasSurface>
          <WorkflowCanvasNode
            nodeId="enrich"
            defaultPosition={{ x: 200, y: 160 }}
            aria-label="enrich job"
          >
            <JobCard
              icon={Sparkles}
              tone="purple"
              title="enrich"
              description="Add model context"
            />
          </WorkflowCanvasNode>
        </WorkflowCanvasSurface>
      </WorkflowCanvas>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const viewport = await canvas.findByRole("application", {
      name: "Navigation demo canvas",
    })
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="workflow-canvas-surface"]',
    )

    viewport.focus()
    await userEvent.keyboard("{ArrowRight}")

    await waitFor(() => {
      expect(readTransform(surface?.style.transform)).toMatchObject({
        x: -48,
        y: 0,
        zoom: 1,
      })
    })

    await userEvent.keyboard("=")

    await waitFor(() => {
      expect(surface?.style.transform).toContain("scale(1.2)")
    })

    // Two background pointers pinch-zoom around their midpoint, so touch
    // devices reach zoom without a wheel or a keyboard.
    const rect = viewport.getBoundingClientRect()
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    const zoomBefore = Number(
      /scale\(([\d.]+)\)/.exec(surface?.style.transform ?? "")?.[1],
    )

    for (const [pointerId, offset] of [
      [11, -50],
      [12, 50],
    ] as const) {
      viewport.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId,
          clientX: centerX + offset,
          clientY: centerY,
        }),
      )
    }

    // Spreading the fingers to twice their distance doubles the zoom.
    for (const [pointerId, offset] of [
      [11, -100],
      [12, 100],
    ] as const) {
      viewport.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId,
          clientX: centerX + offset,
          clientY: centerY,
        }),
      )
    }

    await waitFor(() => {
      const zoomAfter = Number(
        /scale\(([\d.]+)\)/.exec(surface?.style.transform ?? "")?.[1],
      )
      expect(zoomAfter).toBeGreaterThan(zoomBefore * 1.5)
    })

    for (const pointerId of [11, 12]) {
      viewport.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId }),
      )
    }

    // A pinch that also travels must keep the canvas point held between
    // the fingers under them. A symmetric pinch cannot catch an anchoring
    // mistake, because its midpoint never moves.
    const readViewport = () => readTransform(surface?.style.transform)

    const before = readViewport()
    const startMid = { x: centerX, y: centerY }
    const heldPoint = {
      x: (startMid.x - rect.x - before.x) / before.zoom,
      y: (startMid.y - rect.y - before.y) / before.zoom,
    }

    for (const [pointerId, offset] of [
      [21, -60],
      [22, 60],
    ] as const) {
      viewport.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId,
          clientX: centerX + offset,
          clientY: centerY,
        }),
      )
    }

    // Spread the fingers AND slide them: the midpoint travels +40px.
    for (const [pointerId, offset] of [
      [21, -50],
      [22, 130],
    ] as const) {
      viewport.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId,
          clientX: centerX + offset,
          clientY: centerY,
        }),
      )
    }

    await waitFor(() => {
      const after = readViewport()
      const heldNow = heldPoint.x * after.zoom + after.x + rect.x

      // The fingers now straddle centerX + 40, and the point they picked
      // up must still sit there.
      expect(Math.abs(heldNow - (centerX + 40))).toBeLessThan(1)
    })

    for (const pointerId of [21, 22]) {
      viewport.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId }),
      )
    }
  },
}

export const BoundedCanvas: Story = {
  parameters: storyDocumentation(
    "Bounds confine the canvas to a finite region: panning clamps so the window never leaves it, and dragged nodes stop at its edges. Omit bounds and the same canvas is infinite.",
  ),
  render: () => (
    <StoryFrame>
      <WorkflowCanvas
        aria-label="Bounded demo canvas"
        bounds={{ minX: 0, minY: 0, maxX: 4000, maxY: 3000 }}
      >
        <WorkflowCanvasGrid />
        <WorkflowCanvasSurface>
          <WorkflowCanvasNode
            nodeId="listen"
            defaultPosition={{ x: 120, y: 120 }}
            aria-label="listen job"
          >
            <JobCard
              icon={Radio}
              tone="blue"
              title="listen"
              description="Wait for webhooks"
            />
          </WorkflowCanvasNode>
        </WorkflowCanvasSurface>
      </WorkflowCanvas>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const viewport = await canvas.findByRole("application", {
      name: "Bounded demo canvas",
    })
    const surface = canvasElement.querySelector<HTMLElement>(
      '[data-slot="workflow-canvas-surface"]',
    )

    viewport.focus()
    // Panning left would reveal space beyond the bounds' origin, so the
    // viewport clamps in place.
    await userEvent.keyboard("{ArrowLeft}")

    await waitFor(() => {
      expect(readTransform(surface?.style.transform)).toMatchObject({
        x: 0,
        y: 0,
        zoom: 1,
      })
    })

    await userEvent.keyboard("{ArrowRight}")

    await waitFor(() => {
      expect(readTransform(surface?.style.transform)).toMatchObject({
        x: -48,
        y: 0,
        zoom: 1,
      })
    })
  },
}

function MiniStep({ label }: { label: string }) {
  return (
    <span className="block rounded-lg border border-border bg-background px-2 py-1 text-xs">
      {label}
    </span>
  )
}

function ToggleChevron() {
  return (
    <ChevronDown
      aria-hidden
      className="size-3.5 shrink-0 transition-transform [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none group-data-[collapsed=true]/workflow-node:-rotate-90"
    />
  )
}

const previewHomeViewport = { x: 0, y: 0, zoom: 1 }

function NestedWorkflowNode({
  onOpenDedupe,
  onMaximize,
}: {
  onOpenDedupe: () => void
  onMaximize: () => void
}) {
  // The preview viewport is controlled so the reset control can send it
  // home after any amount of panning and zooming.
  const [previewViewport, setPreviewViewport] =
    React.useState(previewHomeViewport)

  return (
    <WorkflowCanvasNode
      nodeId="subflow"
      defaultPosition={{ x: 320, y: 80 }}
      aria-label="Enrichment subflow"
      className={cn(
        // The card itself carries the native resize grip; the preview body
        // fills whatever space the card is given, so growing the card
        // grows the subflow view with it. Collapsing clears the grip's
        // inline height (the important arbitrary property outranks it) and
        // retires the grip until the card expands again.
        "flex h-80 min-h-40 w-96 min-w-72 resize flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm",
        "data-[collapsed=true]:[height:auto]! data-[collapsed=true]:min-h-0 data-[collapsed=true]:resize-none",
      )}
    >
      {/* The title stretch of the header is the toggle, so pressing the
          title folds the subflow too — not just the chevron; the maximize
          control beside it opens this subflow as its own workflow. */}
      <span className="flex h-6 w-full shrink-0 items-center gap-1">
        <WorkflowCanvasNodeToggle
          aria-label="Toggle enrichment subflow"
          className="h-6 min-w-0 flex-1 justify-between gap-2 px-1"
        >
          <span className="text-xs font-medium text-muted-foreground">
            Enrichment subflow
          </span>
          <ToggleChevron />
        </WorkflowCanvasNodeToggle>
        <button
          type="button"
          aria-label="Open enrichment workflow"
          className="flex size-5 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
          onClick={onMaximize}
        >
          <Maximize2 className="size-3" aria-hidden />
        </button>
      </span>
      <WorkflowCanvasNodeBody className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
        {/* The preview is editable by default here: readOnly={false} opts
            back in to dragging and connecting inside the nested canvas.
            Bounds keep panning and zooming within the stretch of plane the
            inner nodes occupy, so the preview can never wander into empty
            space, and the reset control returns the view home. */}
        <WorkflowCanvas
          aria-label="Enrichment subflow canvas"
          readOnly={false}
          bounds={{ minX: 0, minY: 0, maxX: 480, maxY: 300 }}
          minZoom={0.75}
          maxZoom={2}
          viewport={previewViewport}
          onViewportChange={setPreviewViewport}
        >
          <WorkflowCanvasGrid gridSize={16} />
          <WorkflowCanvasSurface>
            <WorkflowCanvasEdges>
              <WorkflowCanvasEdge source="inner-fetch" target="inner-clean" />
              <WorkflowCanvasEdge source="inner-fetch" target="inner-dedupe" />
              <WorkflowCanvasEdge source="inner-clean" target="inner-notify" />
              <WorkflowCanvasEdge source="inner-dedupe" target="inner-notify" />
            </WorkflowCanvasEdges>
            <WorkflowCanvasNode
              nodeId="inner-fetch"
              defaultPosition={{ x: 20, y: 70 }}
              aria-label="inner fetch job"
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm"
            >
              fetch
            </WorkflowCanvasNode>
            {/* A collapsible section keeps a complicated step organized:
                its detail rows fold away until they are wanted. */}
            <WorkflowCanvasNode
              nodeId="inner-clean"
              defaultPosition={{ x: 150, y: 20 }}
              defaultCollapsed
              aria-label="cleanup section"
              className="w-40 rounded-xl border border-border bg-card p-2 shadow-sm"
            >
              <WorkflowCanvasNodeToggle
                aria-label="Toggle cleanup section"
                className="h-5 w-full justify-between gap-1 px-1"
              >
                <span className="text-xs font-medium">cleanup</span>
                <ToggleChevron />
              </WorkflowCanvasNodeToggle>
              <WorkflowCanvasNodeBody className="mt-1.5 space-y-1.5">
                <MiniStep label="drop duplicates" />
                <MiniStep label="normalize casing" />
                <MiniStep label="strip tracking params" />
              </WorkflowCanvasNodeBody>
            </WorkflowCanvasNode>
            {/* Nesting stops at one level: a deeper workflow appears as a
                plain node whose open control hands navigation to the
                consumer instead of recursing another canvas. */}
            <WorkflowCanvasNode
              nodeId="inner-dedupe"
              defaultPosition={{ x: 140, y: 150 }}
              aria-label="dedupe subflow"
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm"
            >
              <span className="flex items-center gap-2">
                dedupe subflow
                <button
                  type="button"
                  aria-label="Open dedupe workflow"
                  className="flex size-5 cursor-pointer appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
                  onClick={onOpenDedupe}
                >
                  <Maximize2 className="size-3" aria-hidden />
                </button>
              </span>
            </WorkflowCanvasNode>
            <WorkflowCanvasNode
              nodeId="inner-notify"
              defaultPosition={{ x: 300, y: 80 }}
              aria-label="inner notify job"
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm"
            >
              notify
            </WorkflowCanvasNode>
          </WorkflowCanvasSurface>
        </WorkflowCanvas>
        <button
          type="button"
          aria-label="Reset subflow view"
          className="absolute bottom-1.5 left-1/2 flex h-5 -translate-x-1/2 cursor-pointer appearance-none items-center gap-1 rounded-md border border-border bg-card/90 px-1.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
          onClick={() => setPreviewViewport(previewHomeViewport)}
        >
          <RotateCcw className="size-2.5" aria-hidden />
          Reset view
        </button>
      </WorkflowCanvasNodeBody>
    </WorkflowCanvasNode>
  )
}

function DedupeWorkflow({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative h-full w-full">
      <WorkflowCanvas aria-label="Dedupe workflow canvas">
        <WorkflowCanvasGrid />
        <WorkflowCanvasSurface>
          <WorkflowCanvasEdges>
            <WorkflowCanvasEdge source="hash" target="compare" />
            <WorkflowCanvasEdge source="compare" target="discard" />
          </WorkflowCanvasEdges>
          <WorkflowCanvasNode
            nodeId="hash"
            defaultPosition={{ x: 80, y: 120 }}
            aria-label="hash job"
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
          >
            hash records
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="compare"
            defaultPosition={{ x: 340, y: 200 }}
            aria-label="compare job"
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
          >
            compare buckets
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="discard"
            defaultPosition={{ x: 620, y: 120 }}
            aria-label="discard job"
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
          >
            discard copies
          </WorkflowCanvasNode>
        </WorkflowCanvasSurface>
      </WorkflowCanvas>
      <div className="absolute top-3 left-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back to main workflow
        </Button>
      </div>
    </div>
  )
}

function EnrichmentWorkflow({
  onBack,
  onOpenDedupe,
}: {
  onBack: () => void
  onOpenDedupe: () => void
}) {
  return (
    <div className="relative h-full w-full">
      <WorkflowCanvas aria-label="Enrichment workflow canvas">
        <WorkflowCanvasGrid />
        <WorkflowCanvasSurface>
          <WorkflowCanvasEdges>
            <WorkflowCanvasEdge source="full-fetch" target="full-clean" />
            <WorkflowCanvasEdge source="full-fetch" target="full-dedupe" />
            <WorkflowCanvasEdge source="full-clean" target="full-notify" />
            <WorkflowCanvasEdge source="full-dedupe" target="full-notify" />
          </WorkflowCanvasEdges>
          <WorkflowCanvasNode
            nodeId="full-fetch"
            defaultPosition={{ x: 80, y: 180 }}
            aria-label="enrichment fetch job"
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
          >
            fetch
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="full-clean"
            defaultPosition={{ x: 320, y: 80 }}
            aria-label="enrichment cleanup job"
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
          >
            cleanup
          </WorkflowCanvasNode>
          {/* Still one level at a time: even in the maximized view, the
              deeper dedupe workflow stays a plain node whose maximize
              control navigates instead of nesting another canvas. */}
          <WorkflowCanvasNode
            nodeId="full-dedupe"
            defaultPosition={{ x: 320, y: 280 }}
            aria-label="enrichment dedupe subflow"
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
          >
            <span className="flex items-center gap-2">
              dedupe subflow
              <button
                type="button"
                aria-label="Open dedupe workflow"
                className="flex size-5 cursor-pointer appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
                onClick={onOpenDedupe}
              >
                <Maximize2 className="size-3" aria-hidden />
              </button>
            </span>
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="full-notify"
            defaultPosition={{ x: 600, y: 180 }}
            aria-label="enrichment notify job"
            className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
          >
            notify
          </WorkflowCanvasNode>
        </WorkflowCanvasSurface>
      </WorkflowCanvas>
      <div className="absolute top-3 left-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back to main workflow
        </Button>
      </div>
    </div>
  )
}

function NestedWorkflowDemo() {
  const [openFlow, setOpenFlow] = React.useState<
    "main" | "dedupe" | "enrichment"
  >("main")

  if (openFlow === "dedupe") {
    return <DedupeWorkflow onBack={() => setOpenFlow("main")} />
  }

  if (openFlow === "enrichment") {
    return (
      <EnrichmentWorkflow
        onBack={() => setOpenFlow("main")}
        onOpenDedupe={() => setOpenFlow("dedupe")}
      />
    )
  }

  return (
    <WorkflowCanvas aria-label="Host workflow canvas">
      <WorkflowCanvasGrid />
      <WorkflowCanvasSurface>
        <WorkflowCanvasEdges>
          <WorkflowCanvasEdge source="fetch" target="subflow" />
        </WorkflowCanvasEdges>
        <WorkflowCanvasNode
          nodeId="fetch"
          defaultPosition={{ x: 60, y: 140 }}
          aria-label="fetch job"
        >
          <JobCard
            icon={Shuffle}
            tone="green"
            title="fetch"
            description="Pull fresh records"
          />
        </WorkflowCanvasNode>
        <NestedWorkflowNode
          onOpenDedupe={() => setOpenFlow("dedupe")}
          onMaximize={() => setOpenFlow("enrichment")}
        />
      </WorkflowCanvasSurface>
    </WorkflowCanvas>
  )
}

export const NestedWorkflow: Story = {
  parameters: storyDocumentation(
    "Nodes host complete nested canvases, and nesting deliberately stops at one level: only one subflow canvas renders at a time, and anything deeper appears as a plain node whose maximize control navigates to that flow instead of recursing. A nested canvas detects its nesting and turns readOnly on by default; this demo passes readOnly={false} so the enrichment preview is fully editable — its inner nodes drag and connect in place. Every subflow carries a maximize control: the enrichment header's opens it as its own workflow, and the dedupe node inside does the same one level further, each view returning with a back button. The preview canvas is bounded to the stretch of plane its nodes occupy — panning and zooming can never wander into empty space — and a small reset control at its foot sends the view home. The title stretch of the header is the collapse toggle, so pressing the title folds the subflow, and the card itself carries a native resize grip — a press on the grip corner resizes instead of dragging, and the preview fills the card, growing in proportion as the card grows.",
  ),
  render: () => (
    <StoryFrame>
      <NestedWorkflowDemo />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const hostNode = await canvas.findByRole("group", {
      name: "Enrichment subflow",
    })
    const innerNode = await canvas.findByRole("group", {
      name: "inner fetch job",
    })
    const hostTransformBefore = hostNode.style.transform
    const innerTransformBefore = innerNode.style.transform
    const nestedCanvas = canvas.getByRole("application", {
      name: "Enrichment subflow canvas",
    })

    // The demo opts the preview back into editing, overriding the
    // read-only default a nested canvas would otherwise adopt — an
    // editable canvas carries no data-readonly stamp at all.
    await expect(nestedCanvas).not.toHaveAttribute("data-readonly")

    const surface = nestedCanvas.querySelector<HTMLElement>(
      '[data-slot="workflow-canvas-surface"]',
    )
    const surfaceTransformBefore = surface?.style.transform
    const rect = innerNode.getBoundingClientRect()
    const startX = rect.x + rect.width / 2
    const startY = rect.y + rect.height / 2

    innerNode.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: startX,
        clientY: startY,
      }),
    )
    innerNode.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: startX + 40,
        clientY: startY + 10,
      }),
    )
    innerNode.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: startX + 40,
        clientY: startY + 10,
      }),
    )

    // Dragging an editable inner node moves the node itself; the preview
    // viewport stays put, and the host node never moves.
    await waitFor(() => {
      expect(innerNode.style.transform).not.toBe(innerTransformBefore)
    })
    await expect(surface?.style.transform).toBe(surfaceTransformBefore)
    await expect(hostNode.style.transform).toBe(hostTransformBefore)

    // The preview is bounded — panning stays within the inner nodes'
    // stretch of plane — and the reset control sends the view home.
    nestedCanvas.focus()
    await userEvent.keyboard("{ArrowRight}")

    await waitFor(() => {
      expect(readTransform(surface?.style.transform)).toMatchObject({
        x: -48,
        y: 0,
        zoom: 1,
      })
    })

    await userEvent.click(
      canvas.getByRole("button", { name: "Reset subflow view" }),
    )

    await waitFor(() => {
      expect(readTransform(surface?.style.transform)).toMatchObject({
        x: 0,
        y: 0,
        zoom: 1,
      })
    })

    // The collapsed cleanup section opens on its toggle, revealing its rows.
    await expect(canvas.getByText("drop duplicates")).not.toBeVisible()
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle cleanup section" }),
    )
    await expect(canvas.getByText("drop duplicates")).toBeVisible()

    // Collapsing the whole subflow hides the nested canvas but keeps the
    // header (and the node itself) in place.
    const heightExpanded = hostNode.getBoundingClientRect().height

    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle enrichment subflow" }),
    )

    await waitFor(() => {
      const nestedCanvas = canvas.queryByRole("application", {
        name: "Enrichment subflow canvas",
      })
      expect(nestedCanvas).toBeNull()
      expect(hostNode.getBoundingClientRect().height).toBeLessThan(
        heightExpanded,
      )
    })

    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle enrichment subflow" }),
    )

    await waitFor(() => {
      expect(
        canvas.getByRole("application", { name: "Enrichment subflow canvas" }),
      ).toBeVisible()
    })

    // The subflow's own maximize control opens it as a full workflow —
    // still one canvas at a time — and the back control returns.
    await userEvent.click(
      canvas.getByRole("button", { name: "Open enrichment workflow" }),
    )

    await waitFor(() => {
      expect(
        canvas.getByRole("application", {
          name: "Enrichment workflow canvas",
        }),
      ).toBeVisible()
    })

    await userEvent.click(
      canvas.getByRole("button", { name: "Back to main workflow" }),
    )

    await waitFor(() => {
      expect(
        canvas.getByRole("application", { name: "Host workflow canvas" }),
      ).toBeVisible()
    })

    // A deeper workflow never recurses in place: its open control navigates
    // to that flow, and the back control returns.
    await userEvent.click(
      canvas.getByRole("button", { name: "Open dedupe workflow" }),
    )

    await waitFor(() => {
      expect(
        canvas.getByRole("application", { name: "Dedupe workflow canvas" }),
      ).toBeVisible()
    })

    await userEvent.click(
      canvas.getByRole("button", { name: "Back to main workflow" }),
    )

    await waitFor(() => {
      expect(
        canvas.getByRole("application", { name: "Host workflow canvas" }),
      ).toBeVisible()
    })
  },
}

function LabeledEdge({
  source,
  target,
  label,
}: {
  source: string
  target: string
  label: string
}) {
  const geometry = useWorkflowCanvasEdgeGeometry({ source, target })

  if (!geometry) {
    return null
  }

  return (
    <>
      <WorkflowCanvasEdge source={source} target={target} />
      <text
        x={geometry.midpoint.x}
        y={geometry.midpoint.y - 10}
        textAnchor="middle"
        className="fill-muted-foreground font-sans text-[11px]"
      >
        {label}
      </text>
    </>
  )
}

export const CustomEdgesAndHandles: Story = {
  parameters: storyDocumentation(
    "Every visual is replaceable: the edge line restyles through className, the pending connection line through the connectionLine slot on WorkflowCanvasEdges, the handle dot swaps for any custom indicator passed as children, and useWorkflowCanvasEdgeGeometry powers fully custom edge components — here, a midpoint label riding its edge.",
  ),
  render: () => (
    <StoryFrame>
      <WorkflowCanvas aria-label="Styled flow canvas">
        <WorkflowCanvasGrid />
        <WorkflowCanvasSurface>
          <WorkflowCanvasEdges
            connectionLine={
              <WorkflowCanvasConnectionLine className="stroke-sky-500 [stroke-dasharray:2_6]" />
            }
          >
            <WorkflowCanvasEdge
              source="fetch"
              target="enrich"
              className="stroke-sky-500 stroke-[3.5]"
            />
            <LabeledEdge source="enrich" target="notify" label="on success" />
          </WorkflowCanvasEdges>
          <WorkflowCanvasNode
            nodeId="fetch"
            defaultPosition={{ x: 60, y: 80 }}
            aria-label="fetch job"
          >
            <JobCard
              icon={Shuffle}
              tone="green"
              title="fetch"
              description="Pull fresh records"
            />
            <WorkflowCanvasNodeHandle
              side="right"
              aria-label="Add connection from fetch"
              className="size-5 rounded-full border border-border bg-card text-muted-foreground shadow-sm"
            >
              <Plus className="size-3" aria-hidden />
            </WorkflowCanvasNodeHandle>
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="enrich"
            defaultPosition={{ x: 380, y: 160 }}
            aria-label="enrich job"
          >
            <JobCard
              icon={Sparkles}
              tone="purple"
              title="enrich"
              description="Add model context"
            />
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="notify"
            defaultPosition={{ x: 80, y: 320 }}
            aria-label="notify job"
          >
            <JobCard
              icon={Bell}
              tone="orange"
              title="notify"
              description="Ping the channel"
            />
          </WorkflowCanvasNode>
        </WorkflowCanvasSurface>
      </WorkflowCanvas>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const handle = await canvas.findByRole("button", {
      name: "Add connection from fetch",
    })

    // The default dot gave way to the custom icon indicator.
    await expect(handle.querySelector("svg")).not.toBeNull()

    await waitFor(() => {
      const custom = canvasElement.querySelector<SVGPathElement>(
        '[data-source="fetch"] [data-slot="workflow-canvas-edge-line"]',
      )
      const standard = canvasElement.querySelector<SVGPathElement>(
        '[data-source="enrich"] [data-slot="workflow-canvas-edge-line"]',
      )

      expect(custom).not.toBeNull()
      expect(standard).not.toBeNull()
      expect(getComputedStyle(custom!).stroke).not.toBe(
        getComputedStyle(standard!).stroke,
      )
    })

    await expect(canvas.getByText("on success")).toBeVisible()
  },
}

export const AutoAlignedEdges: Story = {
  parameters: storyDocumentation(
    "Edges auto-align by default: each one leaves and enters whichever facing sides connect its nodes most directly, so a target moved to the other flank re-routes cleanly instead of looping the long way around. The second edge pins the static right-to-left routing with autoAlign={false} for comparison; explicit sourceSide/targetSide pins a single side the same way.",
  ),
  render: () => (
    <StoryFrame>
      <WorkflowCanvas aria-label="Auto-alignment demo canvas">
        <WorkflowCanvasGrid />
        <WorkflowCanvasSurface>
          <WorkflowCanvasEdges>
            <WorkflowCanvasEdge source="flag" target="validate" />
            <WorkflowCanvasEdge
              source="flag"
              target="validate"
              autoAlign={false}
              className="stroke-border/60 [stroke-dasharray:4_4]"
            />
          </WorkflowCanvasEdges>
          {/* The flag node sits to the RIGHT of its target, the case that
              used to route the long way around. */}
          <WorkflowCanvasNode
            nodeId="flag"
            defaultPosition={{ x: 460, y: 60 }}
            aria-label="flag job"
            className="w-40 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm"
          >
            flag
          </WorkflowCanvasNode>
          <WorkflowCanvasNode
            nodeId="validate"
            defaultPosition={{ x: 60, y: 200 }}
            aria-label="validate job"
            className="w-40 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm"
          >
            validate
          </WorkflowCanvasNode>
        </WorkflowCanvasSurface>
      </WorkflowCanvas>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const lines = canvasElement.querySelectorAll<SVGPathElement>(
        '[data-slot="workflow-canvas-edge-line"]',
      )
      expect(lines).toHaveLength(2)

      // Auto-aligned: flag is right of validate, so the edge leaves flag's
      // LEFT side (x = 460) and enters validate's RIGHT side (x = 60 + 160).
      const aligned = lines[0].getAttribute("d") ?? ""
      expect(aligned.startsWith("M 460,")).toBe(true)
      expect(/ 220,[-\d.]+$/.test(aligned)).toBe(true)

      // Pinned static routing: leaves flag's RIGHT side (x = 460 + 160) and
      // enters validate's LEFT side (x = 60), the long way around.
      const pinned = lines[1].getAttribute("d") ?? ""
      expect(pinned.startsWith("M 620,")).toBe(true)
      expect(/ 60,[-\d.]+$/.test(pinned)).toBe(true)
    })
  },
}

const paletteOptions = [
  { title: "validate", icon: ListChecks, tone: "blue" },
  { title: "flag", icon: Flag, tone: "red" },
  { title: "notify", icon: Bell, tone: "orange" },
] as const

interface DroppedJob {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  tone: keyof typeof jobTones
  position: { x: number; y: number }
}

function ConnectDropDemo() {
  const [nodes, setNodes] = React.useState<DroppedJob[]>([
    {
      id: "fetch",
      title: "fetch",
      icon: Shuffle,
      tone: "green",
      position: { x: 80, y: 140 },
    },
  ])
  const [edges, setEdges] = React.useState<BoardEdge[]>([])
  const [palette, setPalette] =
    React.useState<WorkflowCanvasConnectionEnd | null>(null)
  const [palettePosition, setPalettePosition] = React.useState({ x: 0, y: 0 })

  const openPalette = (end: WorkflowCanvasConnectionEnd) => {
    setPalette(end)
    // The palette lands just past the released line end, not under it.
    setPalettePosition({ x: end.point.x + 16, y: end.point.y - 16 })
  }

  const addFromPalette = (option: (typeof paletteOptions)[number]) => {
    if (!palette) {
      return
    }

    const id = `${option.title}-${nodes.length}`

    setNodes((current) => [
      ...current,
      {
        id,
        title: option.title,
        icon: option.icon,
        tone: option.tone,
        // The node materializes wherever the palette sits now, so dragging
        // the palette first repositions the node it will create.
        position: palettePosition,
      },
    ])
    setEdges((current) => [
      ...current,
      { id: `${palette.source}-${id}`, source: palette.source, target: id },
    ])
    setPalette(null)
  }

  return (
    <WorkflowCanvas
      aria-label="Palette drop canvas"
      onConnect={(connection) =>
        setEdges((current) => [
          ...current,
          {
            id: `${connection.source}-${connection.target}-${current.length}`,
            source: connection.source,
            target: connection.target,
          },
        ])
      }
      onConnectEnd={openPalette}
      onDismiss={() => setPalette(null)}
    >
      <WorkflowCanvasGrid />
      <WorkflowCanvasSurface>
        <WorkflowCanvasEdges>
          {edges.map((edge) => (
            <WorkflowCanvasEdge
              key={edge.id}
              source={edge.source}
              target={edge.target}
            />
          ))}
          {/* While the palette is open, a dashed preview shows where the
              chosen node will attach. */}
          {palette ? (
            <WorkflowCanvasEdge
              source={palette.source}
              target="palette"
              className="stroke-ring/60 [stroke-dasharray:6_4]"
            />
          ) : null}
        </WorkflowCanvasEdges>
        {nodes.map((job) => (
          <WorkflowCanvasNode
            key={job.id}
            nodeId={job.id}
            defaultPosition={job.position}
            aria-label={`${job.title} job`}
          >
            <JobCard
              icon={job.icon}
              tone={job.tone}
              title={job.title}
              description={
                job.id === "fetch" ? "Pull fresh records" : "Added from drop"
              }
            />
            <AllHandles />
          </WorkflowCanvasNode>
        ))}
        {palette ? (
          <WorkflowCanvasNode
            nodeId="palette"
            position={palettePosition}
            onPositionChange={setPalettePosition}
            aria-label="Add job palette"
            // The entrance eases the palette in (opacity + scale, never
            // transform) so it lands softly instead of popping.
            className="animate-nessa-enter w-52 rounded-2xl border-2 border-dashed border-ring/60 bg-popover p-3 shadow-lg"
          >
            <span className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Plus className="size-3.5 text-muted-foreground" aria-hidden />
                Add job
              </span>
              <button
                type="button"
                aria-label="Dismiss palette"
                className="flex size-5 cursor-pointer appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setPalette(null)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
            <span className="grid grid-cols-3 gap-1.5">
              {paletteOptions.map((option) => (
                <button
                  key={option.title}
                  type="button"
                  className="flex cursor-pointer appearance-none flex-col items-center gap-1 rounded-xl border-0 bg-muted/50 px-1 py-2 text-xs hover:bg-muted"
                  onClick={() => addFromPalette(option)}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-lg",
                      jobTones[option.tone],
                    )}
                  >
                    <option.icon className="size-3.5" aria-hidden />
                  </span>
                  {option.title}
                </button>
              ))}
            </span>
          </WorkflowCanvasNode>
        ) : null}
      </WorkflowCanvasSurface>
    </WorkflowCanvas>
  )
}

export const ConnectDropPalette: Story = {
  parameters: storyDocumentation(
    "Releasing a drawn connection over empty canvas reports the drop point through onConnectEnd, and what happens next is entirely the consumer's — here an Add-job palette lands just past the released line end, visibly distinct from real nodes (dashed accent border, raised popover surface, a dismiss control) so it reads as a chooser rather than a job. A dashed preview edge shows where the chosen node will attach; the palette itself drags like any node, and choosing an option creates the node wherever the palette sits and wires the connection to it. Walking away closes it: the canvas' onDismiss fires on a background press or on a dismiss shortcut — Escape by default, configurable through dismissKeys. Any component works in that role: a menu, a search field, a form.",
  ),
  render: () => (
    <StoryFrame>
      <ConnectDropDemo />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const handle = await canvas.findByRole("button", { name: "Connect right" })
    const canvasRoot = canvasElement.querySelector<HTMLElement>(
      '[data-slot="workflow-canvas"]',
    )!
    const rootRect = canvasRoot.getBoundingClientRect()
    const from = handle.getBoundingClientRect()
    const dropX = rootRect.x + 480
    const dropY = rootRect.y + 330

    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: from.x + from.width / 2,
        clientY: from.y + from.height / 2,
      }),
    )
    handle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: dropX,
        clientY: dropY,
      }),
    )
    handle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: dropX,
        clientY: dropY,
      }),
    )

    // Escape dismisses the palette; the same drag reopens it.
    await canvas.findByRole("group", { name: "Add job palette" })
    canvasRoot.focus()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      expect(canvas.queryByRole("group", { name: "Add job palette" })).toBeNull()
    })

    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: from.x + from.width / 2,
        clientY: from.y + from.height / 2,
      }),
    )
    handle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: dropX,
        clientY: dropY,
      }),
    )

    // Pressing the open background dismisses it too.
    await canvas.findByRole("group", { name: "Add job palette" })
    canvasRoot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: rootRect.x + 40,
        clientY: rootRect.y + 40,
      }),
    )
    canvasRoot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: rootRect.x + 40,
        clientY: rootRect.y + 40,
      }),
    )
    await waitFor(() => {
      expect(canvas.queryByRole("group", { name: "Add job palette" })).toBeNull()
    })

    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: from.x + from.width / 2,
        clientY: from.y + from.height / 2,
      }),
    )
    handle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: dropX,
        clientY: dropY,
      }),
    )

    // The palette appears beside the drop point, with a dashed preview edge
    // showing where the chosen node will attach.
    const paletteNode = await canvas.findByRole("group", {
      name: "Add job palette",
    })
    // The palette eases in (opacity 0 -> 1), so visibility settles when
    // its entrance animation completes.
    await waitFor(() => {
      expect(paletteNode).toBeVisible()
    })
    await waitFor(() => {
      expect(
        canvasElement.querySelector(
          '[data-slot="workflow-canvas-edge"][data-target="palette"]',
        ),
      ).not.toBeNull()
    })

    // The palette drags like any node before an option is chosen.
    const transformBefore = paletteNode.style.transform
    const paletteRect = paletteNode.getBoundingClientRect()
    const grabX = paletteRect.x + paletteRect.width / 2
    const grabY = paletteRect.y + 10

    paletteNode.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: grabX,
        clientY: grabY,
      }),
    )
    paletteNode.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: grabX + 60,
        clientY: grabY - 40,
      }),
    )
    paletteNode.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: grabX + 60,
        clientY: grabY - 40,
      }),
    )

    await waitFor(() => {
      expect(paletteNode.style.transform).not.toBe(transformBefore)
    })

    await userEvent.click(canvas.getByRole("button", { name: "validate" }))

    await waitFor(() => {
      expect(
        canvas.getByRole("group", { name: "validate job" }),
      ).toBeVisible()
      expect(
        canvasElement.querySelector(
          '[data-slot="workflow-canvas-edge"][data-source="fetch"]',
        ),
      ).not.toBeNull()
      expect(
        canvas.queryByRole("group", { name: "Add job palette" }),
      ).toBeNull()
    })
  },
}

const STRESS_COLUMNS = 40
const STRESS_COUNT = 1000
const STRESS_SPACING = 72
const HUB_EDGE_COUNT = 250

function StressField() {
  const nodes = React.useMemo(
    () =>
      Array.from({ length: STRESS_COUNT }, (_, index) => ({
        id: `cell-${index}`,
        x: 200 + (index % STRESS_COLUMNS) * STRESS_SPACING,
        y: 120 + Math.floor(index / STRESS_COLUMNS) * STRESS_SPACING,
      })),
    [],
  )

  return (
    <WorkflowCanvas
      aria-label="Stress field canvas"
      defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
      minZoom={0.1}
    >
      <WorkflowCanvasGrid />
      <WorkflowCanvasSurface>
        <WorkflowCanvasEdges>
          {nodes.slice(0, HUB_EDGE_COUNT).map((node) => (
            <WorkflowCanvasEdge
              key={node.id}
              source="hub"
              sourceSide="right"
              target={node.id}
            />
          ))}
        </WorkflowCanvasEdges>
        <WorkflowCanvasNode
          nodeId="hub"
          defaultPosition={{ x: 20, y: 400 }}
          aria-label="hub node"
          className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm"
        >
          hub
        </WorkflowCanvasNode>
        {nodes.map((node) => (
          <WorkflowCanvasNode
            key={node.id}
            nodeId={node.id}
            defaultPosition={{ x: node.x, y: node.y }}
            className="size-10 rounded-lg border border-border bg-card"
          />
        ))}
      </WorkflowCanvasSurface>
    </WorkflowCanvas>
  )
}

export const StressThousandNodes: Story = {
  parameters: storyDocumentation(
    "One thousand nodes and a hub carrying 250 edges. Geometry subscriptions keep the graph honest at this scale: dragging the hub re-renders the hub and its edges while the other 999 nodes stay untouched, and every edge keeps tracking its endpoints.",
  ),
  render: () => (
    <div className="h-[32rem] w-full">
      <StressField />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const hub = await canvas.findByRole("group", { name: "hub node" })

    await waitFor(() => {
      expect(
        canvasElement.querySelectorAll('[data-slot="workflow-canvas-node"]'),
      ).toHaveLength(STRESS_COUNT + 1)
      expect(
        canvasElement.querySelectorAll('[data-slot="workflow-canvas-edge"]'),
      ).toHaveLength(HUB_EDGE_COUNT)
    })

    const edge = canvasElement.querySelector(
      '[data-slot="workflow-canvas-edge-line"]',
    )
    const pathBefore = edge?.getAttribute("d")
    const rect = hub.getBoundingClientRect()
    const startX = rect.x + rect.width / 2
    const startY = rect.y + rect.height / 2

    hub.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: startX,
        clientY: startY,
      }),
    )
    hub.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: startX + 60,
        clientY: startY - 30,
      }),
    )
    hub.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: startX + 60,
        clientY: startY - 30,
      }),
    )

    // The gesture ran at zoom 0.5, so 60 screen pixels travel 120 canvas
    // units.
    await waitFor(() => {
      expect(readTransform(hub.style.transform)).toMatchObject({
        x: 140,
        y: 340,
      })
    })
    await waitFor(() => {
      expect(edge?.getAttribute("d")).not.toBe(pathBefore)
    })
  },
}
