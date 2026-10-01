import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Button, cn } from "@nessalabs/ui"

import { observeSize, useMeasuredSize } from "@/lib/size-observer"

import {
  announceFontLoaded,
  frames,
  settleMeasurements,
  silenceResizeObserver,
} from "./size-observer-harness"
import { storyDocumentation } from "./story-documentation"

/**
 * A measured box whose width its frame sets and whose height its text sets,
 * with the size it last measured printed outside it. The count of
 * measurements is printed too, outside the box, so printing it is not itself
 * a change to the box's content.
 */
function SizeObserverDemo() {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const size = useMeasuredSize(boxRef)
  const [lines, setLines] = React.useState(1)
  const [wide, setWide] = React.useState(false)
  const [measurements, setMeasurements] = React.useState(0)
  React.useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    return observeSize(box, () => setMeasurements((count) => count + 1))
  }, [])
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setLines((count) => count + 1)}>
          Add a line
        </Button>
        <Button variant="outline" onClick={() => setWide((value) => !value)}>
          {wide ? "Narrow the frame" : "Widen the frame"}
        </Button>
      </div>
      <div className={cn(wide ? "w-80" : "w-60")} data-testid="frame">
        <div
          ref={boxRef}
          data-testid="box"
          className="rounded-md border border-border p-3 nessa-text-4 text-foreground"
        >
          {Array.from({ length: lines }, (_, index) => (
            <p key={index}>Line {index + 1}</p>
          ))}
        </div>
      </div>
      <p className="nessa-text-2 text-muted-foreground">
        Measured:{" "}
        <output data-testid="size">
          {size ? `${size.width} × ${size.height}` : "nothing yet"}
        </output>
        {" · "}Measurements: <output data-testid="count">{measurements}</output>
      </p>
    </div>
  )
}

const meta = {
  title: "Foundation/SizeObserver",
  component: SizeObserverDemo,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The one owner of when an element's size may have changed. `observeSize(element, onChange)` reports a box resize in the frame it is laid out, and a content change or a web font finishing its load once on the next frame, however many arrive; it returns the function that stops it. `useMeasuredSize(ref)` keeps an element's content-box size current through it. The content and font triggers exist because WebKit does not always report those resizes to a `ResizeObserver`, so a component that measures text or content subscribes here instead of wiring its own observers.",
      },
    },
  },
} satisfies Meta<typeof SizeObserverDemo>

export default meta
type Story = StoryObj<typeof meta>

/** The size the demo last measured, as `[width, height]`. */
function printedSize(canvasElement: HTMLElement) {
  const text = within(canvasElement).getByTestId("size").textContent ?? ""
  const match = /(\d+) × (\d+)/.exec(text)
  return match ? [Number(match[1]), Number(match[2])] : null
}

/** The size the box actually has, measured the way the hook measures it. */
function actualSize(canvasElement: HTMLElement) {
  const box = within(canvasElement).getByTestId("box")
  const css = getComputedStyle(box)
  return [
    Math.round(
      box.clientWidth -
        Number.parseFloat(css.paddingLeft) -
        Number.parseFloat(css.paddingRight),
    ),
    Math.round(
      box.clientHeight -
        Number.parseFloat(css.paddingTop) -
        Number.parseFloat(css.paddingBottom),
    ),
  ]
}

export const WithoutResizeReports: Story = {
  tags: ["cross-engine"],
  parameters: storyDocumentation(
    "The box measured with a `ResizeObserver` that never reports, which is what WebKit does to a resize a font or a content change causes. Adding a line still re-measures, because the box's content changed; widening its frame does not, since nothing inside the box changed, until a web font finishes loading and the font trigger measures again. Once settled, no measurement keeps running.",
  ),
  beforeEach: silenceResizeObserver,
  render: () => <SizeObserverDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(printedSize(canvasElement)).toEqual(actualSize(canvasElement)),
    )
    await settleMeasurements(canvasElement)
    const [, oneLine] = printedSize(canvasElement)!

    // Content: a new line is measured with no resize report at all.
    await userEvent.click(canvas.getByRole("button", { name: "Add a line" }))
    await waitFor(() => {
      expect(printedSize(canvasElement)).toEqual(actualSize(canvasElement))
      expect(printedSize(canvasElement)![1]).toBeGreaterThan(oneLine!)
    })

    // A box resize nothing inside the box caused goes unseen here...
    await userEvent.click(canvas.getByRole("button", { name: "Widen the frame" }))
    await frames(3)
    const [stale] = printedSize(canvasElement)!
    await expect(actualSize(canvasElement)[0]).toBeGreaterThan(stale!)

    // ...until a web font lands, which is measured for: once, and then
    // nothing keeps measuring, since measuring does not feed itself.
    const count = () => Number(canvas.getByTestId("count").textContent)
    await settleMeasurements(canvasElement)
    const before = count()
    announceFontLoaded(canvasElement)
    await waitFor(() => {
      expect(printedSize(canvasElement)).toEqual(actualSize(canvasElement))
      expect(count()).toBe(before + 1)
    })
    await frames(4)
    await expect(count()).toBe(before + 1)
  },
}
