"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import { flushSync } from "react-dom"
import { cn } from "@/lib/utils"

export interface VirtualListProps<T> extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  ref?: React.Ref<HTMLElement>
  /** Native list semantics when composing li-based row primitives. Defaults to div. */
  as?: "div" | "ul"
  /** Merge row positioning and semantics into a single child that forwards DOM props. */
  itemAsChild?: boolean
  items: readonly T[]
  getKey: (item: T, index: number) => React.Key
  children: (item: T, index: number) => React.ReactNode
  /** Fixed row height in CSS pixels. Content must fit this height. Defaults to 40. */
  rowHeight?: number
  /** Scroll viewport height in CSS pixels. Defaults to 400. */
  height?: number
  /** Extra mounted rows on each side of the viewport. Defaults to 5. */
  overscan?: number
  /** Disable windowing to mount every row, retaining the same scroll surface. */
  virtualize?: boolean
  /** Development-only bounded scroll/commit trace at window.__nessaVirtualList, removed on unmount. */
  debug?: boolean
}

/** Renders a fixed-height, vertically windowed list with stable keys and list position semantics. Offscreen content is unmounted; keep durable row state in the host. */
export function VirtualList<T>({ items, getKey, children, rowHeight = 40, height = 400, overscan = 5, virtualize = true, debug = false, as: Component = "div", itemAsChild = false, className, style, onScroll, ref: forwardedRef, ...props }: VirtualListProps<T>) {
  if (!Number.isFinite(rowHeight) || rowHeight <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isInteger(overscan) || overscan < 0) {
    throw new RangeError("VirtualList requires positive finite dimensions and a nonnegative integer overscan.")
  }
  const ref = React.useRef<HTMLElement | null>(null)
  const traceId = React.useId()
  const trace = React.useRef<{ events: Record<string, number | string>[] } | null>(null)
  const committedRange = React.useRef({ start: 0, end: 0 })
  React.useEffect(() => {
    if (!debug) return
    const data = { events: [] as Record<string, number | string>[] }
    trace.current = data
    const host = window as typeof window & { __nessaVirtualList?: Record<string, unknown> }
    host.__nessaVirtualList ??= {}
    host.__nessaVirtualList[traceId] = { ...data, snapshot: () => ({ top: ref.current?.scrollTop, height: ref.current?.clientHeight, ...committedRange.current }) }
    return () => { delete host.__nessaVirtualList?.[traceId]; trace.current = null }
  }, [debug, traceId])
  React.useImperativeHandle(forwardedRef, () => ref.current!, [Component])
  const [top, setTop] = React.useState(0)
  const [viewport, setViewport] = React.useState(height)
  const [focusedKey, setFocusedKey] = React.useState<React.Key | null>(null)
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewport(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [Component])
  React.useLayoutEffect(() => { setTop(ref.current?.scrollTop ?? 0) }, [Component])
  const maximum = Math.max(0, items.length * rowHeight - viewport)
  React.useEffect(() => {
    if (ref.current && ref.current.scrollTop > maximum) ref.current.scrollTop = maximum
    setTop((value) => Math.min(value, maximum))
  }, [maximum])
  const start = virtualize ? Math.max(0, Math.floor(Math.min(top, maximum) / rowHeight) - overscan) : 0
  const end = virtualize ? Math.min(items.length, Math.ceil((Math.min(top, maximum) + viewport) / rowHeight) + overscan) : items.length
  React.useLayoutEffect(() => {
    committedRange.current = { start, end }
    if (trace.current) {
      trace.current.events.push({ ev: "commit", top, start, end, time: performance.now() })
      if (trace.current.events.length > 400) trace.current.events.splice(0, trace.current.events.length - 400)
    }
  }, [start, end, top])
  const indices = Array.from({ length: end - start }, (_, offset) => start + offset)
  const focusedIndex = focusedKey === null ? -1 : items.findIndex((item, index) => getKey(item, index) === focusedKey)
  if (virtualize && focusedIndex >= 0 && (focusedIndex < start || focusedIndex >= end)) indices.push(focusedIndex)
  indices.sort((a, b) => a - b)
  const Item = Component === "ul" ? "li" : "div"
  const Row = itemAsChild ? Slot.Root : Item
  return (
    <Component {...props} ref={(element: HTMLDivElement | HTMLUListElement | null) => { ref.current = element }} data-slot="virtual-list" role="list" tabIndex={0} className={cn("relative m-0 list-none overflow-auto p-0", className)} style={{ height, ...style }} onScroll={(event) => {
      const next = event.currentTarget.scrollTop
      if (trace.current) {
        trace.current.events.push({ ev: "scroll", top: next, start: committedRange.current.start, end: committedRange.current.end, time: performance.now() })
        if (trace.current.events.length > 400) trace.current.events.splice(0, trace.current.events.length - 400)
      }
      // Continuous React scroll updates can be deferred past the browser paint.
      // Commit the new window before returning from the scroll event.
      flushSync(() => setTop(next))
      onScroll?.(event)
    }}>
      <Item role="presentation" aria-hidden="true" className="pointer-events-none" style={{ height: items.length * rowHeight }} />
        {indices.map((index) => (
          <Row key={getKey(items[index]!, index)} role="listitem" aria-setsize={items.length} aria-posinset={index + 1} data-row-index={index}
            onFocusCapture={() => setFocusedKey(getKey(items[index]!, index))}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedKey(null) }}
            className="absolute inset-x-0" style={{ top: index * rowHeight, height: rowHeight }}>
            {children(items[index]!, index)}
          </Row>
        ))}
    </Component>
  )
}
