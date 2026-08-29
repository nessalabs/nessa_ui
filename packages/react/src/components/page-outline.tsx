"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * One entry in the outline: a stable anchor id, the text shown in the rail,
 * and its depth in the heading hierarchy (0 for top-level sections).
 */
export interface PageOutlineItemData {
  /** Anchor id of the section this entry points at. */
  id: string
  /** The label rendered in the outline row. */
  label: React.ReactNode
  /** Hierarchy depth, 0-based; deeper entries indent and jog the rail. */
  depth: number
}

/**
 * The live state of the marker riding the rail, published every animation
 * frame onto the custom-marker group as CSS custom properties and data
 * attributes (`--page-outline-speed`, `data-traveling`, `data-direction`) so
 * a host marker can style itself without a per-frame React render.
 */
export interface PageOutlineMarkerState {
  /** Arc-length speed in px per frame; 0 at rest. */
  speed: number
  /** 1 when the last travel was downward, -1 upward. */
  direction: 1 | -1
  /** True while the marker is in flight between rows. */
  traveling: boolean
}

export interface PageOutlineProps
  extends Omit<React.ComponentProps<"nav">, "onSelect"> {
  /**
   * The sections to list. Omit this and pass `contentRef` instead to derive
   * entries from the headings rendered inside that element — the shape a
   * markdown renderer produces.
   */
  items?: PageOutlineItemData[]
  /**
   * An element whose headings become the outline when `items` is omitted.
   * Headings are matched by `headingSelector`, depths come from the heading
   * levels present, and headings without an `id` are assigned a slug so the
   * outline can scroll to them. The element is watched for mutations, so a
   * streaming markdown surface keeps the outline current.
   */
  contentRef?: React.RefObject<HTMLElement | null>
  /** Which elements count as headings when scraping `contentRef`. */
  headingSelector?: string
  /**
   * The scrollable ancestor the sections live in. Defaults to the window.
   * The outline listens to it for scroll-spy and scrolls it on row clicks.
   */
  scrollContainerRef?: React.RefObject<HTMLElement | null>
  /**
   * Distance in px from the top of the scroll container to the reading
   * line: the topmost section whose heading has crossed it is active.
   */
  scrollOffset?: number
  /** Controlled active section id; omit to let the scroll spy drive it. */
  activeId?: string
  /** Fires whenever the active section changes, spy-driven or clicked. */
  onActiveChange?: (id: string) => void
  /**
   * `none` keeps every entry visible with depth clamped into the rail's
   * columns. `auto` folds entries deeper than the second level away except
   * inside the branch the reader has settled in — nothing folds or unfolds
   * mid-scroll, only where the reader comes to rest — and rows hiding
   * folded descendants carry a count.
   */
  collapse?: "none" | "auto"
  /** How many rail columns deep the geometry renders before clamping. */
  maxVisibleDepth?: number
  /**
   * A custom marker that replaces the built-in comet pulse. Rendered inside
   * the rail's SVG in a group the outline translates and rotates along the
   * path each frame, so draw it centered on `0,0` pointing toward positive
   * y — an `<image>` of a car works as well as any SVG shape.
   */
  marker?: React.ReactNode
  /** Fires when a row is clicked, after the outline scrolls to the section. */
  onSelect?: (id: string) => void
  /** Accessible label for a fold count badge, given the hidden row count. */
  getHiddenLabel?: (count: number) => string
  /**
   * Development tooling: records clicks, spy passes, settles, retargets,
   * and engine motion into a ring buffer published at
   * `window.__nessaPageOutline[<instance id>]`, with a `snapshot()` of the
   * live engine state — so a glitch can be reproduced once and read back
   * as data instead of described or screen-recorded. No-op unless set.
   */
  debug?: boolean
}

/* ---------------------------------------------------------------------------
 * Rail geometry constants. The rail jogs one column per depth level; columns
 * are wide enough that each jog keeps a straight run between its two corner
 * arcs — narrower columns made the corners read as kinks.
 * ------------------------------------------------------------------------- */
const COLUMN_WIDTH = 14
const COLUMN_X0 = 6
const LABEL_X0 = 26
const LABEL_INDENT = 15
const JOG_RADIUS = 6
const SETTLE_DELAY_MS = 220
const PULSE_MAX_SPEED = 3.6
const PULSE_ACCEL = 0.022
const SPY_HYSTERESIS_PX = 8
const FOLD_TRANSITION_MS = 360

/** Depth clamped into the rail's renderable columns. */
function railColumn(depth: number, maxVisibleDepth: number) {
  return Math.min(depth, maxVisibleDepth - 1)
}

function columnX(column: number) {
  return COLUMN_X0 + column * COLUMN_WIDTH
}

/**
 * Indices of the ancestor chain above `index`, shallowest first, resolved
 * from the flat item list by walking upward through decreasing depths.
 */
function ancestorsOf(items: PageOutlineItemData[], index: number): number[] {
  const chain: number[] = []
  let want = items[index]!.depth - 1
  for (let i = index - 1; i >= 0 && want >= 0; i--) {
    if (items[i]!.depth === want) {
      chain.unshift(i)
      want--
    }
  }
  return chain
}

/**
 * The fold set for the given open anchors — normally the entry the reader
 * has settled on, plus, right after a click, the entry they chose: entries
 * deeper than the second level fold unless their parent is an anchor or one
 * of an anchor's ancestors, so only those branches stay open.
 */
function foldedIndices(
  items: PageOutlineItemData[],
  anchorIndices: number[],
): Set<number> {
  const open = new Set<number>()
  for (const anchor of anchorIndices) {
    for (const ancestor of ancestorsOf(items, anchor)) open.add(ancestor)
    open.add(anchor)
  }
  const out = new Set<number>()
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.depth <= 1) continue
    let parent = -1
    for (let k = i - 1; k >= 0; k--) {
      if (items[k]!.depth === items[i]!.depth - 1) {
        parent = k
        break
      }
    }
    if (parent === -1 || !open.has(parent)) out.add(i)
  }
  return out
}

/**
 * Counts of folded rows attributed to their nearest visible ancestor, so a
 * row hiding a branch can say how much is under it without double counting.
 */
function hiddenCounts(
  items: PageOutlineItemData[],
  folded: Set<number>,
): Map<number, number> {
  const counts = new Map<number, number>()
  for (const index of folded) {
    const chain = ancestorsOf(items, index)
    for (let k = chain.length - 1; k >= 0; k--) {
      const ancestor = chain[k]!
      if (!folded.has(ancestor)) {
        counts.set(ancestor, (counts.get(ancestor) ?? 0) + 1)
        break
      }
    }
  }
  return counts
}

/** Slug used when a scraped heading has no id of its own. */
function slugify(text: string, taken: Set<string>) {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  let slug = base
  let n = 2
  while (taken.has(slug)) slug = `${base}-${n++}`
  taken.add(slug)
  return slug
}

/**
 * Everything the animation loop touches, held in one ref so the 60fps work
 * happens as attribute writes instead of React renders.
 */
interface RailEngine {
  rowCenters: { index: number; x: number; y: number }[]
  totalLength: number
  geometryDirty: boolean
  headLength: number | null
  targetLength: number
  /** Signed velocity in arc px per ms; continuous across retargets. */
  velocity: number
  lastTickAt: number
  speed: number
  direction: 1 | -1
  raf: number | null
  settleUntil: number
  retargetPending: boolean
  stopVerified: boolean
  targetIndex: number
}

/**
 * A scroll-spy section outline drawn along a rail that jogs to trace the
 * heading hierarchy, with a comet pulse — or a host-supplied marker — that
 * travels the rail, corners and all, to the section being read. Sections
 * come from `items` or are derived from the headings of any rendered
 * content (`contentRef`), which is what makes a markdown surface work
 * without the outline knowing anything about markdown. The root fills the
 * box its host provides and scrolls its own rows when the box is shorter
 * than the list.
 */
export function PageOutline({
  items: itemsProp,
  contentRef,
  headingSelector = "h1, h2, h3, h4, h5, h6",
  scrollContainerRef,
  scrollOffset = 96,
  activeId: activeIdProp,
  onActiveChange,
  collapse = "none",
  maxVisibleDepth = 3,
  marker,
  onSelect,
  debug = false,
  getHiddenLabel = (count) =>
    count === 1 ? "1 hidden subsection" : `${count} hidden subsections`,
  className,
  ...props
}: PageOutlineProps) {
  const rawId = React.useId()
  const svgId = React.useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, ""), [rawId])

  const [scrapedItems, setScrapedItems] = React.useState<PageOutlineItemData[]>([])
  const items = itemsProp ?? scrapedItems

  const [spyActiveId, setSpyActiveId] = React.useState<string | undefined>()
  const activeId = activeIdProp ?? spyActiveId ?? items[0]?.id
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  )

  const [settledIndex, setSettledIndex] = React.useState(0)
  /**
   * The branch opened by a direct click, before the settle catches up. A
   * click is explicit intent, so its branch expands immediately — but only
   * additively: closing the branches the reader left still waits for the
   * settle, because closures shift rows under the pointer.
   */
  const [clickedOpenIndex, setClickedOpenIndex] = React.useState<number | null>(
    null,
  )
  const settle = React.useCallback((index: number) => {
    traceRef.current?.({ ev: "settle", index })
    setSettledIndex(index)
    setClickedOpenIndex(null)
  }, [])
  const folded = React.useMemo(() => {
    if (collapse !== "auto" || items.length === 0) return new Set<number>()
    const anchors = [Math.min(settledIndex, items.length - 1)]
    if (clickedOpenIndex !== null && clickedOpenIndex < items.length) {
      anchors.push(clickedOpenIndex)
    }
    return foldedIndices(items, anchors)
  }, [collapse, items, settledIndex, clickedOpenIndex])
  const counts = React.useMemo(() => hiddenCounts(items, folded), [items, folded])

  // The row that carries the visible highlight. When the active section's
  // own row is folded away, the pulse pins to its nearest visible ancestor —
  // and the bold must sit on that same row, or the label and the marker
  // visibly disagree until the fold settles.
  const highlightIndex = React.useMemo(() => {
    if (items.length === 0 || !folded.has(activeIndex)) return activeIndex
    const chain = ancestorsOf(items, activeIndex)
    for (let k = chain.length - 1; k >= 0; k--) {
      if (!folded.has(chain[k]!)) return chain[k]!
    }
    return activeIndex
  }, [items, folded, activeIndex])

  const rowsRef = React.useRef<HTMLDivElement | null>(null)
  const railRef = React.useRef<SVGPathElement | null>(null)
  const pulseRef = React.useRef<SVGPathElement | null>(null)
  const pulseMidStopRef = React.useRef<SVGStopElement | null>(null)
  const gradientRef = React.useRef<SVGLinearGradientElement | null>(null)
  const markerGroupRef = React.useRef<SVGGElement | null>(null)

  const engineRef = React.useRef<RailEngine>({
    rowCenters: [],
    totalLength: 0,
    geometryDirty: true,
    headLength: null,
    targetLength: 0,
    velocity: 0,
    lastTickAt: 0,
    speed: 0,
    direction: 1,
    raf: null,
    settleUntil: 0,
    retargetPending: true,
    stopVerified: false,
    targetIndex: -1,
  })
  const activeIndexRef = React.useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const itemsRef = React.useRef(items)
  itemsRef.current = items
  const foldedRef = React.useRef(folded)
  foldedRef.current = folded

  /** Dev-only event ring buffer; null unless `debug` — every call site is
   * a single optional-chain, so the production cost is nil. */
  const traceBufferRef = React.useRef<Record<string, unknown>[]>([])
  const traceRef = React.useRef<((entry: Record<string, unknown>) => void) | null>(
    null,
  )
  traceRef.current = debug
    ? (entry) => {
        const buffer = traceBufferRef.current
        buffer.push({ t: Math.round(performance.now()), ...entry })
        if (buffer.length > 4000) buffer.splice(0, buffer.length - 4000)
      }
    : null

  /**
   * Resolves a section id inside the outline's own scope — the content
   * element when one is given, else the scroll container, else the
   * document. A bare `document.getElementById` breaks the moment two
   * outlines over the same ids share a page (Storybook's docs page renders
   * every story at once): each outline would spy on the first document's
   * headings and sit visibly out of sync with its own content.
   */
  const findSection = React.useCallback(
    (id: string): HTMLElement | null => {
      const scope: ParentNode =
        contentRef?.current ?? scrollContainerRef?.current ?? document
      return scope.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    },
    [contentRef, scrollContainerRef],
  )

  /* ------------------------------------------------------------------ *
   * Deriving items from rendered content. Watched for mutations so a
   * streaming surface keeps the outline current.
   * ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (itemsProp || !contentRef) return
    const host = contentRef.current
    if (!host) return
    const scrape = () => {
      const headings = Array.from(
        host.querySelectorAll<HTMLElement>(headingSelector),
      )
      const levels = headings.map((h) =>
        /^h[1-6]$/i.test(h.tagName) ? Number(h.tagName.slice(1)) : 2,
      )
      const minLevel = levels.length ? Math.min(...levels) : 1
      const taken = new Set<string>()
      setScrapedItems(
        headings.map((heading, i) => {
          if (!heading.id) heading.id = slugify(heading.textContent ?? "", taken)
          else taken.add(heading.id)
          return {
            id: heading.id,
            label: heading.textContent ?? "",
            depth: levels[i]! - minLevel,
          }
        }),
      )
    }
    scrape()
    const observer = new MutationObserver(scrape)
    observer.observe(host, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [itemsProp, contentRef, headingSelector])

  /* ------------------------------------------------------------------ *
   * The rail engine: one rAF loop measuring live row geometry, drawing
   * the path, and walking the pulse (or the host marker) along it.
   * ------------------------------------------------------------------ */
  const reducedMotionRef = React.useRef(false)
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => {
      reducedMotionRef.current = query.matches
    }
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  const kick = React.useCallback(
    (settleMs = 0, retarget = false) => {
      const engine = engineRef.current
      engine.settleUntil = Math.max(
        engine.settleUntil,
        performance.now() + settleMs,
      )
      if (retarget) engine.retargetPending = true

      const measure = () => {
        const rows = rowsRef.current
        const rail = railRef.current
        if (!rows || !rail) return
        const base = rows.getBoundingClientRect().top
        const centers: RailEngine["rowCenters"] = []
        const children = rows.children
        for (let i = 0; i < children.length; i++) {
          const rect = children[i]!.getBoundingClientRect()
          if (rect.height <= 2) continue
          const item = itemsRef.current[i]
          if (!item) continue
          centers.push({
            index: i,
            x: columnX(railColumn(item.depth, maxVisibleDepth)),
            y: rect.top - base + rect.height / 2,
          })
        }
        engine.rowCenters = centers
        if (centers.length === 0) {
          rail.setAttribute("d", "")
          engine.totalLength = 0
          return
        }
        const half =
          (children[centers[0]!.index] as HTMLElement).getBoundingClientRect()
            .height / 2
        let d = `M${centers[0]!.x} ${centers[0]!.y - half}`
        for (let k = 0; k < centers.length; k++) {
          const x = centers[k]!.x
          if (k === centers.length - 1) {
            d += ` L${x} ${centers[k]!.y + half}`
            break
          }
          const nx = centers[k + 1]!.x
          if (nx === x) continue
          const mid = (centers[k]!.y + centers[k + 1]!.y) / 2
          const dir = nx > x ? 1 : -1
          const r = Math.min(
            JOG_RADIUS,
            Math.abs(centers[k + 1]!.y - centers[k]!.y) / 2,
            Math.abs(nx - x) / 2,
          )
          d += ` L${x} ${mid - r}`
          d += ` Q${x} ${mid} ${x + dir * r} ${mid}`
          d += ` L${nx - dir * r} ${mid}`
          d += ` Q${nx} ${mid} ${nx} ${mid + r}`
        }
        rail.setAttribute("d", d)
        pulseRef.current?.setAttribute("d", d)
        engine.totalLength = rail.getTotalLength()
        engine.geometryDirty = false
      }

      const lengthForY = (targetY: number) => {
        const rail = railRef.current!
        let lo = 0
        let hi = engine.totalLength
        for (let k = 0; k < 22; k++) {
          const mid = (lo + hi) / 2
          if (rail.getPointAtLength(mid).y < targetY) lo = mid
          else hi = mid
        }
        return (lo + hi) / 2
      }

      const retargetNow = (now: number) => {
        // Resolve the target with the SAME rule the render uses for the
        // bold row (the React folded set), not from measured heights: a
        // row mid-fold still reports a height for most of its transition,
        // so a height-based fallback disagrees with the highlight for the
        // whole 360ms — bold on the ancestor, pulse still on the folding
        // row. One rule, shared by both, ends that class of divergence.
        let index = activeIndexRef.current
        if (foldedRef.current.has(index)) {
          const chain = ancestorsOf(itemsRef.current, index)
          for (let k = chain.length - 1; k >= 0; k--) {
            if (!foldedRef.current.has(chain[k]!)) {
              index = chain[k]!
              break
            }
          }
        }
        let target = engine.rowCenters.find((row) => row.index === index)
        if (!target) {
          // Not measurable yet (a just-unfolded row in its first frames):
          // fall back through visible ancestors rather than aborting.
          const chain = ancestorsOf(itemsRef.current, index)
          for (let k = chain.length - 1; k >= 0 && !target; k--) {
            target = engine.rowCenters.find((row) => row.index === chain[k])
          }
        }
        if (!target || engine.totalLength === 0) return
        const want = lengthForY(target.y)
        if (engine.headLength === null || reducedMotionRef.current) {
          engine.headLength = engine.targetLength = want
          engine.velocity = 0
          engine.targetIndex = target.index
          return
        }
        // Just move the target. The follower below is velocity-continuous,
        // so a retarget never resets any motion state — restarting an
        // eased tween per retarget was what starved the pulse during fast
        // scrolling: every restart re-entered the ease-in dead zone at
        // zero velocity while the bold row kept jumping ahead.
        if (Math.abs(want - engine.targetLength) > 0.5) {
          traceRef.current?.({ ev: "target", index: target.index, len: Math.round(want) })
        }
        engine.targetIndex = target.index
        engine.targetLength = want
      }

      const tick = (now: number) => {
        if (engine.headLength === null) return false
        const dt = engine.lastTickAt
          ? Math.min(48, now - engine.lastTickAt)
          : 16
        engine.lastTickAt = now
        const gap = engine.targetLength - engine.headLength
        if (Math.abs(gap) < 0.5 && Math.abs(engine.velocity) < 0.05) {
          engine.headLength = engine.targetLength
          engine.velocity = 0
          engine.speed = 0
          return false
        }
        // Trapezoidal motion toward a target that is free to move every
        // frame: accelerate toward the gap, cruise at VMAX, and start
        // braking when the remaining gap equals the stopping distance —
        // so it lands decisively instead of decaying asymptotically, and
        // a mid-flight retarget merely reshapes the remaining profile.
        const dir = gap > 0 ? 1 : -1
        const stopping =
          (engine.velocity * engine.velocity) / (2 * PULSE_ACCEL)
        const braking =
          engine.velocity * dir > 0 && Math.abs(gap) <= stopping
        engine.velocity += (braking ? -dir : dir) * PULSE_ACCEL * dt
        engine.velocity = Math.max(
          -PULSE_MAX_SPEED,
          Math.min(PULSE_MAX_SPEED, engine.velocity),
        )
        const previous = engine.headLength
        engine.headLength += engine.velocity * dt
        // Any crossing of the target within a step IS the landing. The
        // guard used to require the braking flag, but after an overshoot
        // the velocity points away from the target, braking reads false,
        // and the follower rings around the target (±3px for ~100ms —
        // a visible dither, worst at the jogs where arc wiggle becomes
        // sideways motion). A 1-D follower has no legitimate crossing:
        // moving away from the target can never trip this test.
        if ((engine.targetLength - engine.headLength) * dir <= 0) {
          engine.headLength = engine.targetLength
          engine.velocity = 0
        }
        engine.speed = Math.abs(engine.headLength - previous)
        if (engine.velocity !== 0 && Math.abs(engine.speed) > 0.01) {
          engine.direction = engine.velocity > 0 ? 1 : -1
        }
        traceRef.current?.({
          ev: "f",
          h: Math.round(engine.headLength),
          g: Math.round(engine.targetLength - engine.headLength),
          v: Math.round(engine.velocity * 100) / 100,
        })
        return true
      }

      const draw = () => {
        const rail = railRef.current
        if (!rail || engine.totalLength === 0 || engine.headLength === null) {
          return
        }
        const head = Math.min(engine.totalLength, Math.max(0, engine.headLength))
        const traveling = engine.speed > 0.15

        const markerGroup = markerGroupRef.current
        if (markerGroup) {
          // A host marker rides the rail directly: translated to the head
          // and rotated to the path tangent so it banks through the jogs.
          const before = rail.getPointAtLength(Math.max(0, head - 2))
          const after = rail.getPointAtLength(
            Math.min(engine.totalLength, head + 2),
          )
          const point = rail.getPointAtLength(head)
          const angle =
            (Math.atan2(after.y - before.y, after.x - before.x) * 180) /
              Math.PI -
            90
          markerGroup.setAttribute(
            "transform",
            `translate(${point.x} ${point.y}) rotate(${angle})`,
          )
          markerGroup.style.setProperty(
            "--page-outline-speed",
            engine.speed.toFixed(2),
          )
          markerGroup.setAttribute(
            "data-traveling",
            traveling ? "true" : "false",
          )
          markerGroup.setAttribute(
            "data-direction",
            engine.direction > 0 ? "down" : "up",
          )
          return
        }

        // The built-in marker: a single soft gradient streak drawn as a
        // dash window on a copy of the rail's own path — geometrically
        // incapable of leaving the rail or cutting a corner. At rest it
        // sits centered on the marked row, fading out at both ends; in
        // flight it grows with speed and its bright point shifts toward
        // the leading edge, so travel reads as the gradient itself moving
        // down the line.
        const restLength = 26
        const length = traveling
          ? Math.min(restLength + engine.speed * 4.5, 96)
          : restLength
        let from: number
        let to: number
        let brightOffset: number
        if (!traveling) {
          from = head - length / 2
          to = head + length / 2
          brightOffset = 50
        } else if (engine.direction > 0) {
          from = head - length
          to = head + 8
          brightOffset = 82
        } else {
          from = head - 8
          to = head + length
          brightOffset = 18
        }

        const pulse = pulseRef.current
        if (pulse) {
          const segment = Math.max(0.5, to - from)
          pulse.setAttribute(
            "stroke-dasharray",
            `${segment} ${engine.totalLength + segment}`,
          )
          pulse.setAttribute("stroke-dashoffset", String(-from))
        }
        const gradient = gradientRef.current
        if (gradient) {
          // Anchor the gradient to the streak itself — anchored to the
          // whole rail, any short window of it is one flat colour.
          const clamp = (value: number) =>
            Math.max(0, Math.min(engine.totalLength, value))
          const start = rail.getPointAtLength(clamp(from))
          const end = rail.getPointAtLength(clamp(to))
          gradient.setAttribute("x1", String(start.x))
          gradient.setAttribute("y1", String(start.y))
          gradient.setAttribute("x2", String(end.x))
          gradient.setAttribute("y2", String(end.y))
        }
        pulseMidStopRef.current?.setAttribute("offset", `${brightOffset}%`)
      }

      const frame = (now: number) => {
        const settling = now < engine.settleUntil
        if (engine.geometryDirty || settling) measure()
        if (engine.geometryDirty || settling || engine.retargetPending) {
          retargetNow(now)
          engine.retargetPending = false
        }
        const moving = tick(now)
        draw()
        if (moving || settling) {
          engine.stopVerified = false
          engine.raf = requestAnimationFrame(frame)
        } else if (!engine.stopVerified) {
          // One last measure before parking: if row geometry moved during
          // the flight (a fold finishing, content reflow), the tween's
          // destination is stale and the pulse would rest one row off the
          // highlighted label. Re-derive the target from fresh geometry and
          // keep flying if it disagrees.
          engine.stopVerified = true
          measure()
          engine.retargetPending = true
          retargetNow(now)
          engine.retargetPending = false
          if (
            engine.headLength !== null &&
            Math.abs(engine.targetLength - engine.headLength) > 0.5
          ) {
            engine.raf = requestAnimationFrame(frame)
          } else {
            draw()
            engine.raf = null
          }
        } else {
          engine.raf = null
        }
      }
      if (engine.raf === null) {
        engine.lastTickAt = 0
        engine.raf = requestAnimationFrame(frame)
      }
    },
    [maxVisibleDepth],
  )

  // Geometry changes: items or fold membership changed shape.
  React.useEffect(() => {
    engineRef.current.geometryDirty = true
    kick(collapse === "auto" ? FOLD_TRANSITION_MS : 0, true)
  }, [items, folded, kick, collapse])

  // The pulse follows the active row immediately, even while folds wait —
  // and the outline's own scroller keeps that row in view, nearest-edge, so
  // a long outline inside a short box tracks the reader on its own.
  const listScrollerRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    kick(0, true)
    const scroller = listScrollerRef.current
    const row = rowsRef.current?.children[highlightIndex] as
      | HTMLElement
      | undefined
    if (!scroller || !row) return
    const margin = 12
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    let next: number | null = null
    if (top < scroller.scrollTop + margin) next = top - margin
    else if (bottom > scroller.scrollTop + scroller.clientHeight - margin) {
      next = bottom - scroller.clientHeight + margin
    }
    if (next !== null) {
      scroller.scrollTo({
        top: next,
        behavior: reducedMotionRef.current ? "auto" : "smooth",
      })
    }
  }, [activeIndex, highlightIndex, kick])

  React.useEffect(() => {
    const engine = engineRef.current
    const rows = rowsRef.current
    const onResize = () => {
      engine.geometryDirty = true
      kick(0, true)
    }
    const observer = new ResizeObserver(onResize)
    if (rows) observer.observe(rows)
    // Everything the SVG shows is painted from requestAnimationFrame, and
    // browsers freeze rAF entirely in hidden documents — so any state that
    // changes while hidden (a settle timer, streaming content) leaves the
    // rail and pulse stale until a frame runs. Remeasure and retarget the
    // moment the document is visible again.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      engine.geometryDirty = true
      kick(0, true)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisible)
      if (engine.raf !== null) cancelAnimationFrame(engine.raf)
      engine.raf = null
    }
  }, [kick])

  /* ------------------------------------------------------------------ *
   * Scroll spy: the topmost section whose heading crossed the reading
   * line is active. Folding is settled separately — nothing opens or
   * closes until the reader comes to rest.
   * ------------------------------------------------------------------ */
  const settleTimerRef = React.useRef<number | undefined>(undefined)
  /**
   * While a click-initiated smooth scroll is in flight, the spy is held
   * off: without this, the flight's own scroll events walk the highlight
   * through every intermediate heading and re-arm settle timers mid-flight,
   * so folds reshape under the pointer and the bold and the pulse visibly
   * disagree the whole way. The lock releases when the section reaches the
   * container top, or at the deadline for a scroll that cannot get there.
   */
  const navigationLockRef = React.useRef<{
    id: string
    index: number
    deadline: number
  } | null>(null)
  const lastSpyIndexRef = React.useRef<number | null>(null)
  const announcedIdRef = React.useRef<string | undefined>(undefined)
  const spyRef = React.useRef<(() => void) | null>(null)
  React.useEffect(() => {
    const container = scrollContainerRef?.current ?? null
    const target: EventTarget = container ?? window
    const spy = () => {
      const currentItems = itemsRef.current
      if (currentItems.length === 0) return
      const lineTop = container
        ? container.getBoundingClientRect().top + scrollOffset
        : scrollOffset
      const lock = navigationLockRef.current
      if (lock) {
        const element = findSection(lock.id)
        const containerTop = container
          ? container.getBoundingClientRect().top
          : 0
        const arrived =
          element &&
          Math.abs(element.getBoundingClientRect().top - containerTop) < 12
        if (!arrived && performance.now() < lock.deadline) {
          // Still in flight: keep pushing the fold settle out so a long
          // scroll cannot reshape the rows mid-travel — it fires once,
          // after the last flight event.
          window.clearTimeout(settleTimerRef.current)
          settleTimerRef.current = window.setTimeout(() => {
            settle(lock.index)
          }, SETTLE_DELAY_MS)
          return
        }
        navigationLockRef.current = null
      }
      let next = 0
      for (let i = 0; i < currentItems.length; i++) {
        const element = findSection(currentItems[i]!.id)
        if (!element) continue
        if (element.getBoundingClientRect().top <= lineTop) next = i
        else break
      }
      // Hysteresis: momentum scrolling and smooth-scroll settling emit
      // long streams of sub-pixel scroll events, and a boundary that
      // oscillates across the reading line would flip the bold every
      // event while the pulse is forever mid-flight after it. Only cross
      // over once the boundary heading is clearly past the line.
      const previousIndex = lastSpyIndexRef.current
      if (
        previousIndex !== null &&
        Math.abs(next - previousIndex) === 1 &&
        previousIndex < currentItems.length
      ) {
        const boundary = findSection(
          currentItems[next > previousIndex ? next : previousIndex]!.id,
        )
        if (boundary) {
          const distance = Math.abs(
            boundary.getBoundingClientRect().top - lineTop,
          )
          if (distance < SPY_HYSTERESIS_PX) next = previousIndex
        }
      }
      lastSpyIndexRef.current = next
      const nextId = currentItems[next]!.id
      traceRef.current?.({
        ev: "spy",
        next,
        y: Math.round(container ? container.scrollTop : window.scrollY),
      })
      setSpyActiveId((previous) => (previous === nextId ? previous : nextId))
      if (announcedIdRef.current !== nextId) {
        announcedIdRef.current = nextId
        onActiveChange?.(nextId)
      }
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = window.setTimeout(() => {
        settle(next)
      }, SETTLE_DELAY_MS)
    }
    spyRef.current = spy
    spy()
    // Coalesce scroll bursts to one spy pass per frame: the spy measures
    // every section heading, and a fast fling delivers several events per
    // frame — measuring on each is pure layout thrash that lengthens
    // frames exactly when the pulse most needs them.
    let queued = 0
    const onScroll = () => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        spy()
      })
    }
    target.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      target.removeEventListener("scroll", onScroll)
      if (queued) cancelAnimationFrame(queued)
      spyRef.current = null
      window.clearTimeout(settleTimerRef.current)
    }
  }, [scrollContainerRef, scrollOffset, onActiveChange, items.length, findSection, settle])

  React.useEffect(() => {
    if (!debug) return
    const host = window as unknown as {
      __nessaPageOutline?: Record<string, unknown>
    }
    host.__nessaPageOutline = host.__nessaPageOutline ?? {}
    host.__nessaPageOutline[svgId] = {
      events: traceBufferRef.current,
      snapshot: () => ({
        head: engineRef.current.headLength,
        target: engineRef.current.targetLength,
        velocity: engineRef.current.velocity,
        targetIndex: engineRef.current.targetIndex,
        activeIndex: activeIndexRef.current,
        folded: [...foldedRef.current],
        visibility: document.visibilityState,
      }),
    }
    return () => {
      delete host.__nessaPageOutline?.[svgId]
    }
  }, [debug, svgId])

  const lockReleaseTimerRef = React.useRef<number | undefined>(undefined)
  const select = (id: string, index: number) => {
    navigationLockRef.current = { id, index, deadline: performance.now() + 1200 }
    traceRef.current?.({ ev: "click", id })
    // Scroll the intended scroller explicitly. scrollIntoView scroll-chains
    // through EVERY scrollable ancestor, and Chromium animates them
    // sequentially — on a scrollable page that reads as the flight landing
    // and then a second flight starting on its own.
    const element = findSection(id)
    const container = scrollContainerRef?.current ?? null
    if (element) {
      const behavior: ScrollBehavior = reducedMotionRef.current
        ? "auto"
        : "smooth"
      if (container) {
        container.scrollTo({
          top:
            element.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop,
          behavior,
        })
      } else {
        window.scrollTo({
          top: element.getBoundingClientRect().top + window.scrollY,
          behavior,
        })
      }
    }
    setSpyActiveId(id)
    lastSpyIndexRef.current = index
    if (announcedIdRef.current !== id) {
      announcedIdRef.current = id
      onActiveChange?.(id)
    }
    onSelect?.(id)
    // The lock's deadline is otherwise only checked lazily inside the spy;
    // a target that cannot reach the container top produces no trailing
    // scroll events, so release it on a timer and re-run the spy once.
    window.clearTimeout(lockReleaseTimerRef.current)
    lockReleaseTimerRef.current = window.setTimeout(() => {
      if (navigationLockRef.current?.id === id) {
        navigationLockRef.current = null
        spyRef.current?.()
      }
    }, 1250)
    // Folds re-settle once, after the flight — flipping them at the moment
    // of the click reshapes the rows under the pointer. The spy re-arms
    // this timer per scroll event after the lock releases, so a scroll that
    // does happen supersedes the fallback.
    // The clicked branch opens NOW — a click is explicit intent — while
    // closures of the branches left behind wait for the settle below.
    setClickedOpenIndex(index)
    window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settle(index)
    }, 450)
  }

  return (
    <nav
      data-slot="page-outline"
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col font-sans",
        className,
      )}
      {...props}
    >
      <div ref={listScrollerRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient
                ref={gradientRef}
                id={`${svgId}-pulse`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2="60"
              >
                <stop
                  offset="0%"
                  stopColor="var(--page-outline-pulse-from, var(--foreground))"
                  stopOpacity="0"
                />
                <stop
                  ref={pulseMidStopRef}
                  offset="50%"
                  stopColor="var(--page-outline-pulse-to, var(--foreground))"
                  stopOpacity="1"
                />
                <stop
                  offset="100%"
                  stopColor="var(--page-outline-pulse-from, var(--foreground))"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <path
              ref={railRef}
              data-slot="page-outline-rail"
              fill="none"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-[var(--page-outline-rail,var(--border))]"
            />
            {marker == null ? (
              <path
                ref={pulseRef}
                data-slot="page-outline-pulse"
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                stroke={`url(#${svgId}-pulse)`}
                className="motion-safe:animate-pulse"
              />
            ) : (
              <g
                ref={markerGroupRef}
                data-slot="page-outline-marker"
                data-traveling="false"
                data-direction="down"
              >
                {marker}
              </g>
            )}
          </svg>
          <div ref={rowsRef} data-slot="page-outline-rows">
            {items.map((item, index) => {
              const isFolded = folded.has(index)
              const hidden = counts.get(index) ?? 0
              const isActive = index === highlightIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  data-slot="page-outline-row"
                  data-depth={item.depth}
                  data-active={isActive || undefined}
                  data-folded={isFolded || undefined}
                  aria-current={isActive ? "location" : undefined}
                  aria-hidden={isFolded || undefined}
                  tabIndex={isFolded ? -1 : undefined}
                  onClick={() => select(item.id, index)}
                  onMouseDown={(event) => {
                    // Focus-on-mousedown makes the browser instantly scroll
                    // every ancestor to reveal the button; a row partially
                    // clipped inside the sticky aside would lurch the whole
                    // content pane at the moment of the click. Keyboard
                    // focus is unaffected.
                    event.preventDefault()
                  }}
                  style={
                    {
                      "--nessa-page-outline-indent": `${
                        LABEL_X0 +
                        railColumn(item.depth, maxVisibleDepth) * LABEL_INDENT
                      }px`,
                    } as React.CSSProperties
                  }
                  className={cn(
                    // The height leg of the transition matches FOLD_TRANSITION_MS.
                    "flex h-[30px] w-full cursor-pointer items-center gap-2 overflow-hidden border-0 bg-transparent pl-[var(--nessa-page-outline-indent)] pr-2 text-left nessa-text-2 text-muted-foreground outline-none [transition:color_160ms_ease,height_360ms_cubic-bezier(0.22,1,0.36,1),opacity_180ms_ease] hover:text-foreground/75 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[active]:font-semibold data-[active]:text-foreground data-[folded]:pointer-events-none data-[folded]:h-0 data-[folded]:opacity-0",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {hidden > 0 && !isFolded ? (
                    <span
                      data-slot="page-outline-count"
                      className="flex-none rounded-full border border-border px-[5px] nessa-text-1 font-medium tabular-nums text-muted-foreground/75 transition-opacity"
                    >
                      <span aria-hidden="true">{hidden}</span>
                      <span className="sr-only">{getHiddenLabel(hidden)}</span>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
