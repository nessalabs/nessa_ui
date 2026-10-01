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
 * A frame a story can widen with a button, around a component that sizes
 * itself to it. Widening changes nothing inside the component, so with
 * resize reports silenced only the size observer's font trigger can tell it.
 */
export function WidenableFrame({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const [wide, setWide] = React.useState(false)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setWide((value) => !value)}>
        {wide ? "Narrow the frame" : "Widen the frame"}
      </Button>
      <div
        data-testid="frame"
        className={cn(wide ? "w-[32rem]" : "w-80", className)}
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
