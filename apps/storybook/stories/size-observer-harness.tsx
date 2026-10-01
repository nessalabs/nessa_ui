import * as React from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Button, cn } from "@nessalabs/ui"

/**
 * A story `beforeEach` that replaces `ResizeObserver` with one that never
 * reports, and restores the real one afterwards. It reproduces, in every
 * engine, what WebKit does to resizes caused by a web font or a content
 * change: nothing. A story run under it proves a component still measures
 * through the shared size observer's other triggers.
 */
export function silenceResizeObserver() {
  const real = window.ResizeObserver
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  return () => {
    window.ResizeObserver = real
  }
}

/**
 * Tells the document a web font finished loading, as `document.fonts` does
 * when one lands.
 */
export function announceFontLoaded(canvasElement: HTMLElement) {
  canvasElement.ownerDocument.fonts.dispatchEvent(new Event("loadingdone"))
}

/** Resolves after the browser has run `count` animation frames. */
export async function frames(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

/**
 * Resolves once the document's fonts have finished loading and every
 * measurement that scheduled has run, so a play test's next change is the
 * only thing left to measure for. Web fonts load lazily, and one landing
 * mid-test is a real measurement the test did not cause.
 */
export async function settleMeasurements(canvasElement: HTMLElement) {
  await canvasElement.ownerDocument.fonts.ready
  await frames(2)
}

/**
 * A frame a story can widen (or narrow, with `startWide`) with a button,
 * around a component that sizes itself to it. Resizing it changes nothing
 * inside the component, so with resize reports silenced only the size
 * observer's font trigger can tell it.
 */
export function WidenableFrame({
  className,
  children,
  startWide = false,
  narrowClassName = "w-80",
  wideClassName = "w-[32rem]",
}: {
  className?: string
  children: React.ReactNode
  startWide?: boolean
  narrowClassName?: string
  wideClassName?: string
}) {
  const [wide, setWide] = React.useState(startWide)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setWide((value) => !value)}>
        {wide ? "Narrow the frame" : "Widen the frame"}
      </Button>
      <div
        data-testid="frame"
        className={cn(wide ? wideClassName : narrowClassName, className)}
      >
        {children}
      </div>
    </div>
  )
}

/** The widest `width` an SVG in the frame was given: the chart, not an icon. */
export function drawnWidth(canvasElement: HTMLElement) {
  const svgs = within(canvasElement)
    .getByTestId("frame")
    .querySelectorAll("svg[width]")
  return Math.max(
    0,
    ...Array.from(svgs, (svg) => Number(svg.getAttribute("width")) || 0),
  )
}

/**
 * The play test for a component inside {@link WidenableFrame} with resize
 * reports silenced: it measures at all, and once the frame widens and a web
 * font lands, `width` grows to follow.
 */
export async function expectFollowsFrame(
  canvasElement: HTMLElement,
  width: () => number = () => drawnWidth(canvasElement),
) {
  await waitFor(() => expect(width()).toBeGreaterThan(0))
  await settleMeasurements(canvasElement)
  const before = width()
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Widen the frame" }),
  )
  announceFontLoaded(canvasElement)
  await waitFor(() => expect(width()).toBeGreaterThan(before))
}

/**
 * Host content that grows on its own state: a disclosure that reveals more
 * lines. Opening it commits only this component, so the component it sits
 * inside sees no render of its own; with resize reports silenced, only the
 * size observer's content trigger can tell that its content grew. Phrasing
 * content, so it can sit in a paragraph, a `pre` or a list item.
 */
export function GrowingNote({ lines = 16 }: { lines?: number }) {
  const [open, setOpen] = React.useState(false)
  return (
    <span className="block">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Show the full note
      </Button>
      {open
        ? Array.from({ length: lines }, (_, index) => (
            <span key={index} className="block">
              Note line {index + 1}
            </span>
          ))
        : null}
    </span>
  )
}

/**
 * The play test for a scroll region holding a {@link GrowingNote}, with
 * resize reports silenced: the region fits and takes no tab stop, and once
 * the note opens past the region's cap, it becomes keyboard-reachable.
 */
export async function expectOverflowFollowsContent(
  canvasElement: HTMLElement,
  region: () => HTMLElement | null,
) {
  await waitFor(() => expect(region()).not.toBeNull())
  await settleMeasurements(canvasElement)
  await expect(region()!.scrollHeight).toBeLessThanOrEqual(
    region()!.clientHeight + 1,
  )
  await expect(region()).not.toHaveAttribute("tabindex", "0")
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Show the full note" }),
  )
  await waitFor(() =>
    expect(region()!.scrollHeight).toBeGreaterThan(region()!.clientHeight + 1),
  )
  await waitFor(() => expect(region()).toHaveAttribute("tabindex", "0"))
}

/**
 * The play test for a scroll region inside a {@link WidenableFrame} that
 * starts wide, with resize reports silenced: the region fits and takes no
 * tab stop, and once the frame narrows, its text rewraps past the cap and a
 * web font lands, it becomes keyboard-reachable.
 */
export async function expectOverflowFollowsFrame(
  canvasElement: HTMLElement,
  region: () => HTMLElement | null,
) {
  await waitFor(() => expect(region()).not.toBeNull())
  await settleMeasurements(canvasElement)
  await expect(region()!.scrollHeight).toBeLessThanOrEqual(
    region()!.clientHeight + 1,
  )
  await expect(region()).not.toHaveAttribute("tabindex", "0")
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Narrow the frame" }),
  )
  await waitFor(() =>
    expect(region()!.scrollHeight).toBeGreaterThan(region()!.clientHeight + 1),
  )
  announceFontLoaded(canvasElement)
  await waitFor(() => expect(region()).toHaveAttribute("tabindex", "0"))
}
