"use client"

import * as React from "react"
import mermaid from "mermaid"
import { Hand, Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react"

import { cn } from "@/lib/utils"
import { CopyButton, useCodeBlockConfig, type CodeBlockMode } from "./code-block"

let renderSequence = 0
/**
 * Mermaid's initialize() mutates library-global config, so concurrent
 * diagrams with different themes could read each other's settings mid-render.
 * Every initialize+render pair is chained through this queue instead.
 */
let renderQueue: Promise<unknown> = Promise.resolve()

const MIN_SCALE = 0.2
const MAX_SCALE = 8
/** Fit-to-screen never scales a small diagram beyond this. */
const MAX_FIT_SCALE = 2
/** Breathing room around a fitted diagram, in pixels. */
const FIT_PADDING = 48

interface ViewerTransform {
  x: number
  y: number
  scale: number
}

/**
 * The active interaction tool in the fullscreen viewer. `pan` drags the
 * canvas; the union leaves room for future tools (selection, annotation)
 * without reshaping the viewer.
 */
type ViewerTool = "pan" | null

const viewerButtonClass =
  "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4"

/**
 * The fullscreen diagram viewer: a modal dialog for diagrams too large to
 * read inline. Drag-to-pan is active by default and the hand tool toggles
 * it, the wheel and toolbar zoom toward the cursor, and the tool strip is a
 * ViewerTool union so more interactions can slot in later. The dialog
 * element owns focus and the Escape key natively.
 */
function MermaidViewer({ svg, onClose }: { svg: string; onClose: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [view, setView] = React.useState<ViewerTransform>({ x: 48, y: 48, scale: 1 })
  // Panning is the expected default; the hand tool toggles it off for
  // future interactions that want the pointer for something else.
  const [tool, setTool] = React.useState<ViewerTool>("pan")
  const [dragging, setDragging] = React.useState(false)
  const dragState = React.useRef({ pointerId: 0, lastX: 0, lastY: 0 })
  const viewRef = React.useRef(view)
  viewRef.current = view

  // Scales the diagram to fit the stage (never past MAX_FIT_SCALE) and
  // centers it — the state the viewer opens in, and what Reset returns to.
  const fit = React.useCallback(() => {
    const stage = stageRef.current
    const content = contentRef.current
    if (!stage || !content) return
    const stageRect = stage.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const baseWidth = contentRect.width / viewRef.current.scale
    const baseHeight = contentRect.height / viewRef.current.scale
    if (baseWidth <= 0 || baseHeight <= 0) return
    const scale = Math.max(
      MIN_SCALE,
      Math.min(
        (stageRect.width - FIT_PADDING * 2) / baseWidth,
        (stageRect.height - FIT_PADDING * 2) / baseHeight,
        MAX_FIT_SCALE,
      ),
    )
    setView({
      scale,
      x: (stageRect.width - baseWidth * scale) / 2,
      y: (stageRect.height - baseHeight * scale) / 2,
    })
  }, [])

  React.useEffect(() => {
    dialogRef.current?.showModal()
    // Fit after the dialog has laid out so the measurements are real.
    const frame = requestAnimationFrame(fit)
    const stage = stageRef.current
    if (!stage) return () => cancelAnimationFrame(frame)
    // Zoom toward the cursor; a native non-passive listener is required to
    // preventDefault on wheel events. The factor scales with the wheel delta
    // (clamped per event) instead of a fixed step, so trackpads — which fire
    // many small-delta events per gesture — zoom at the same comfortable
    // rate as discrete mouse-wheel notches.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = Math.min(1.2, Math.max(1 / 1.2, Math.exp(-event.deltaY * 0.002)))
      const rect = stage.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      setView((current) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor))
        const applied = scale / current.scale
        return {
          scale,
          x: pointerX - (pointerX - current.x) * applied,
          y: pointerY - (pointerY - current.y) * applied,
        }
      })
    }
    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      cancelAnimationFrame(frame)
      stage.removeEventListener("wheel", onWheel)
    }
  }, [fit])

  const zoomBy = (factor: number) => {
    const stage = stageRef.current
    const rect = stage?.getBoundingClientRect()
    const centerX = rect === undefined ? 0 : rect.width / 2
    const centerY = rect === undefined ? 0 : rect.height / 2
    setView((current) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor))
      const applied = scale / current.scale
      return {
        scale,
        x: centerX - (centerX - current.x) * applied,
        y: centerY - (centerY - current.y) * applied,
      }
    })
  }

  return (
    <dialog
      ref={dialogRef}
      data-slot="mermaid-viewer"
      aria-label="Diagram viewer"
      onClose={onClose}
      className="h-dvh max-h-none w-dvw max-w-none bg-background p-0 text-foreground"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <span className="text-sm font-medium">Diagram</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Pan tool"
              aria-pressed={tool === "pan"}
              data-active={tool === "pan" ? "true" : undefined}
              className={cn(
                viewerButtonClass,
                "data-[active=true]:bg-muted data-[active=true]:text-foreground",
              )}
              onClick={() => setTool((current) => (current === "pan" ? null : "pan"))}
            >
              <Hand aria-hidden="true" />
            </button>
            <span aria-hidden="true" className="h-5 w-px bg-border" />
            <button
              type="button"
              aria-label="Zoom out"
              className={viewerButtonClass}
              onClick={() => zoomBy(1 / 1.25)}
            >
              <ZoomOut aria-hidden="true" />
            </button>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(view.scale * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              className={viewerButtonClass}
              onClick={() => zoomBy(1.25)}
            >
              <ZoomIn aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Reset view"
              className={viewerButtonClass}
              onClick={fit}
            >
              <RotateCcw aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Close viewer"
              className={viewerButtonClass}
              onClick={() => dialogRef.current?.close()}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          ref={stageRef}
          data-tool={tool ?? undefined}
          data-dragging={dragging ? "true" : undefined}
          className="relative flex-1 touch-none overflow-hidden data-[tool=pan]:cursor-grab data-[dragging=true]:cursor-grabbing"
          onPointerDown={(event) => {
            if (tool !== "pan" || event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            dragState.current = {
              pointerId: event.pointerId,
              lastX: event.clientX,
              lastY: event.clientY,
            }
            setDragging(true)
          }}
          onPointerMove={(event) => {
            if (!dragging || event.pointerId !== dragState.current.pointerId) return
            // Pan incrementally from the last pointer position rather than
            // from the pointer-down origin, so a wheel zoom mid-drag (which
            // retargets the translation toward the cursor) composes instead
            // of snapping back to the pre-zoom pan.
            const deltaX = event.clientX - dragState.current.lastX
            const deltaY = event.clientY - dragState.current.lastY
            dragState.current.lastX = event.clientX
            dragState.current.lastY = event.clientY
            setView((current) => ({
              ...current,
              x: current.x + deltaX,
              y: current.y + deltaY,
            }))
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <div
            ref={contentRef}
            className="absolute left-0 top-0 w-max origin-top-left [&_svg]:h-auto [&_svg]:max-w-none"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </dialog>
  )
}

export interface MermaidDiagramProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * The Mermaid source: flowcharts, sequence diagrams, state and class
   * diagrams, gantt charts — anything Mermaid parses.
   */
  chart: string
  /**
   * Which theme renders: `system` follows the OS scheme, `light` and `dark`
   * pin one. Falls back to the nearest CodeBlockProvider's mode, so diagrams
   * follow the same app-wide setting as code blocks.
   */
  mode?: CodeBlockMode
}

/**
 * A Mermaid diagram rendered to SVG — one component for every Mermaid
 * grammar, sequence diagrams included. While a diagram streams in, invalid
 * intermediate source keeps the last successful render on screen; until the
 * first successful parse the raw source shows muted. The expand control
 * opens a fullscreen viewer with drag-to-pan and wheel zoom for large
 * diagrams, the copy control copies the Mermaid source, and MessageMarkdown
 * composes this automatically for ```mermaid fences.
 */
function MermaidDiagram({ chart, mode, className, ...props }: MermaidDiagramProps) {
  const config = useCodeBlockConfig()
  const resolvedMode = mode ?? config.mode ?? "system"
  const [svg, setSvg] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  // Track the OS scheme live so `system` diagrams re-render when it flips,
  // matching how code blocks follow the scheme through Pierre.
  const [systemDark, setSystemDark] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  )
  React.useEffect(() => {
    if (resolvedMode !== "system" || typeof window === "undefined") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemDark(media.matches)
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [resolvedMode])
  const isDark =
    resolvedMode === "dark" || (resolvedMode === "system" && systemDark)

  React.useEffect(() => {
    let cancelled = false
    // Debounce until the source goes quiet: while a diagram streams in, the
    // chart changes on every animation frame and many prefixes parse
    // successfully, so rendering eagerly re-lays out the whole SVG dozens of
    // times — visible jitter, especially for sequence diagrams. Waiting for
    // a short pause renders once per lull instead, and a static chart (the
    // usual case outside streaming) only defers its first paint by the delay.
    const timer = window.setTimeout(() => {
      renderQueue = renderQueue
        .then(async () => {
          if (cancelled) return
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
            theme: isDark ? "dark" : "default",
            // Mermaid's stock dark edge-label background leaves label text
            // at 4.43:1 — just under WCAG AA. A darker backdrop clears the
            // threshold.
            themeVariables: isDark
              ? { edgeLabelBackground: "#1f1f1f" }
              : undefined,
          })
          const result = await mermaid.render(
            `nessa-mermaid-${++renderSequence}`,
            chart,
          )
          if (!cancelled) setSvg(result.svg)
        })
        .catch(() => {
          // Mid-stream source is often momentarily invalid; keep the
          // previous successful render rather than swapping to an error
          // state.
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [chart, isDark])

  return (
    <div
      data-slot="mermaid-diagram"
      className={cn(
        "group/copy relative min-w-0 max-w-full overflow-x-auto",
        className,
      )}
      {...props}
    >
      {svg === null ? (
        <pre className="overflow-x-auto whitespace-pre-wrap py-1 font-mono text-[0.8125em] text-muted-foreground">
          {chart}
        </pre>
      ) : (
        <div
          className="[&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {svg !== null && (
        <button
          type="button"
          aria-label="Expand diagram"
          onClick={() => setExpanded(true)}
          className="absolute right-11 top-0 flex size-7 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover/copy:opacity-100 group-focus-within/copy:opacity-100 [&_svg]:size-3.5"
        >
          <Maximize2 aria-hidden="true" />
        </button>
      )}
      <CopyButton text={chart} label="Copy diagram source" className="top-0" />
      {expanded && svg !== null && (
        <MermaidViewer svg={svg} onClose={() => setExpanded(false)} />
      )}
    </div>
  )
}

export { MermaidDiagram }
