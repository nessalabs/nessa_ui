import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  ChatOverlay,
  ChatOverlayBack,
  ChatOverlayBody,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetAction,
  SheetBody,
  SheetClose,
  SheetExpand,
  SheetHandle,
  SheetHeader,
  SheetTitle,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

function SheetExample({
  action = false,
}: {
  action?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative h-80 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background">
      <button
        type="button"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-3 py-1.5 font-sans nessa-text-3 text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setOpen(true)}
      >
        Open sheet
      </button>
      {open ? (
        <Sheet label="Queued" onClose={() => setOpen(false)}>
          <SheetHandle />
          <SheetHeader>
            <SheetExpand />
            <SheetTitle>Queued</SheetTitle>
            {action ? (
              <SheetAction>Done</SheetAction>
            ) : (
              <SheetClose className="col-start-3 justify-self-end" />
            )}
          </SheetHeader>
          <SheetBody>
            <p className="m-0 font-sans nessa-text-4 text-foreground">
              Two follow-ups are waiting behind the current run.
            </p>
          </SheetBody>
        </Sheet>
      ) : null}
    </div>
  )
}

const meta = {
  title: "Shell/Sheet",
  component: Sheet,
  tags: ["autodocs", "test"],
  args: {
    onClose: () => undefined,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A bottom sheet that rises over its nearest positioned ancestor: a modal dialog with a backdrop, a grab bar, a header of close or expand plus a centered title and optional Done, and a scrolling body. The drawer lifts a short way from the bottom on open; dragging the grab bar up (or SheetExpand) interpolates height into a filled extra-details surface over the same ancestor, and dragging down or Minimize recedes it. Escape, the backdrop, SheetClose, and SheetAction all dismiss it. Focus moves into the panel on open and returns to the opener on close; siblings it covers go inert. Pass modal={false} for a contained extra-details surface that leaves surrounding chrome reachable.",
      },
    },
  },
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  parameters: storyDocumentation(
    "Open the sheet from the host button. Expand fills the ancestor; the circular close control and Escape both dismiss it, and focus returns to the opener.",
  ),
  render: () => <SheetExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    const dialog = canvas.getByRole("dialog", { name: "Queued" })
    await expect(dialog).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Queued" })).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole("button", { name: "Close" }))
    await waitFor(() =>
      expect(
        canvas.queryByRole("dialog", { name: "Queued" }),
      ).not.toBeInTheDocument(),
    )
    await expect(canvas.getByRole("button", { name: "Open sheet" })).toHaveFocus()
  },
}

export const ExpandToggle: Story = {
  parameters: storyDocumentation(
    "SheetExpand grows the drawer into a filled extra-details surface over the same ancestor; Minimize recedes it. Dragging the grab bar stretches the panel in place the way a phone's bottom sheet does: the bottom edge stays pinned to the frame, the height follows the pointer one-for-one, and the body takes its filled layout for the whole drag so content arrives under the pointer rather than on release. Releasing past the threshold settles into expanded, minimized, or dismissed; releasing short of it returns the panel to where it started. Escape and Done still dismiss.",
  ),
  render: () => {
    function ExpandExample() {
      const [open, setOpen] = React.useState(false)
      return (
        <div className="relative h-80 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background">
          <button
            type="button"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-3 py-1.5 font-sans nessa-text-3 text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={() => setOpen(true)}
          >
            Open sheet
          </button>
          {open ? (
            <Sheet label="Queued" onClose={() => setOpen(false)}>
              <SheetHandle />
              <SheetHeader>
                <SheetExpand />
                <SheetTitle>Queued</SheetTitle>
                <SheetAction>Done</SheetAction>
              </SheetHeader>
              <SheetBody>
                <p className="m-0 font-sans nessa-text-4 text-foreground">
                  Two follow-ups are waiting behind the current run.
                </p>
              </SheetBody>
            </Sheet>
          ) : null}
        </div>
      )
    }
    return <ExpandExample />
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    const dialog = canvas.getByRole("dialog", { name: "Queued" })
    await waitFor(() => expect(dialog).toBeVisible())
    await expect(dialog).toHaveAttribute("aria-modal", "true")
    await expect(dialog).toHaveAttribute("data-expanded", "false")
    // The geometry, not just the attribute: the panel is interpolated by a
    // script animation that leaves inline sizing behind while it runs, so a
    // sheet can report itself expanded while still pinned at the height it
    // was expanding from.
    const panel = canvasElement.querySelector<HTMLElement>(
      "[data-slot=sheet-panel]",
    )!
    const frame = dialog.parentElement!
    const filled = () =>
      Math.abs(
        panel.getBoundingClientRect().height -
          frame.getBoundingClientRect().height,
      ) < 1
    await expect(filled()).toBe(false)
    // The button transition is the drag's motion without the pointer: the
    // panel has to actually travel between the two heights. The expanded
    // panel is `flex-1`, and `flex-basis` outranks an animated `height` on a
    // column flex item — so a panel that lands correct can still have sat at
    // zero for the whole transition and snapped at the end. The end state
    // alone cannot catch that, which is why the mid-flight sizes are read.
    const bodyPanel = canvasElement.querySelector<HTMLElement>(
      "[data-slot=sheet-body]",
    )!
    const collapsedHeight = panel.getBoundingClientRect().height
    const frameHeight = frame.getBoundingClientRect().height
    const flight: Array<{ height: number; body: number; bottomGap: number }> = []
    const originalAnimate = Element.prototype.animate
    // Sample real WAAPI geometry while the expand animation is being created.
    // Timer-based samples can all arrive after the animation has ended on a
    // busy runner. Seeking the native animation still detects flex-basis
    // overriding height, body collapse, or a detached bottom edge.
    Element.prototype.animate = function sampleFlight(keyframes, options) {
      const animation = originalAnimate.call(this, keyframes, options)
      if (this === panel) {
        try {
          animation.pause()
          const duration = Number(animation.effect!.getTiming().duration)
          for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
            animation.currentTime = duration * fraction
            const box = panel.getBoundingClientRect()
            flight.push({
              height: box.height,
              body: bodyPanel.getBoundingClientRect().height,
              bottomGap: Math.abs(frame.getBoundingClientRect().bottom - box.bottom),
            })
          }
        } finally {
          animation.currentTime = 0
          animation.play()
        }
      }
      return animation
    }
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Expand" }))
    } finally {
      Element.prototype.animate = originalAnimate
    }
    const inFlight = flight.filter(
      (step) => step.height > collapsedHeight + 5 && step.height < frameHeight - 5,
    )
    await expect(inFlight.length).toBeGreaterThan(0)
    // The body grows with the panel, and the panel keeps its bottom edge on
    // the frame — the same two properties the drag holds.
    await expect(inFlight.every((step) => step.body > 0)).toBe(true)
    await expect(inFlight.every((step) => step.bottomGap < 1)).toBe(true)
    await expect(dialog).toHaveAttribute("data-expanded", "true")
    await waitFor(() => expect(filled()).toBe(true))
    // The settle clears the sizing it held a moment after the panel reaches
    // full height, so this waits rather than sampling on the same tick.
    await waitFor(() => expect(panel.getAttribute("style")).toBeFalsy())
    await userEvent.click(canvas.getByRole("button", { name: "Minimize" }))
    await expect(dialog).toHaveAttribute("data-expanded", "false")
    await waitFor(() => expect(filled()).toBe(false))

    // An animation that never settles. A document that is not being rendered
    // — a background tab, a hidden pane — never advances its timeline, so the
    // interpolation never finishes and its promise never resolves. The panel
    // must still end up filled: the inline height and `flex-grow: 0` written
    // for the interpolation are cleared on a timer, not on the promise.
    const realAnimate = Element.prototype.animate
    Element.prototype.animate = function stalled() {
      return { finished: new Promise(() => {}), cancel() {} } as unknown as Animation
    }
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Expand" }))
      await waitFor(() => expect(filled()).toBe(true))
      await expect(panel.getAttribute("style")).toBeFalsy()
    } finally {
      Element.prototype.animate = realAnimate
    }
    await userEvent.click(canvas.getByRole("button", { name: "Minimize" }))
    await waitFor(() => expect(filled()).toBe(false))
    const grab = canvasElement.querySelector<HTMLElement>(
      "[data-slot=sheet-handle]",
    )!
    const grabY = grab.getBoundingClientRect().top + 4
    const dragGrab = (pointerId: number, endY: number) => {
      fireEvent.pointerDown(grab, {
        pointerId,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientY: grabY,
      })
      fireEvent.pointerMove(grab, {
        pointerId,
        pointerType: "touch",
        isPrimary: true,
        buttons: 1,
        clientY: endY,
      })
      // clientY 0 on release is the real-device / synthetic miss that
      // used to read as an upward fling. Settle from the last move.
      fireEvent.pointerUp(grab, {
        pointerId,
        pointerType: "touch",
        button: 0,
        clientY: 0,
      })
    }
    // Mid-drag, the panel is stretched rather than lifted: its height tracks
    // the pointer one-for-one and its bottom edge stays pinned to the frame,
    // and the body grows with it so content fills the surface under the
    // pointer instead of arriving on release.
    const frameBottom = () => frame.getBoundingClientRect().bottom
    const body = canvasElement.querySelector<HTMLElement>(
      "[data-slot=sheet-body]",
    )!
    // The settle clears the inline sizing it held; sampling before that lands
    // measures a panel still on its way home.
    await waitFor(() => expect(panel.getAttribute("style")).toBeFalsy())
    const restingHeight = panel.getBoundingClientRect().height
    const restingBody = body.getBoundingClientRect().height
    const pressY = grab.getBoundingClientRect().top + 4
    fireEvent.pointerDown(grab, {
      pointerId: 9,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientY: pressY,
    })
    fireEvent.pointerMove(grab, {
      pointerId: 9,
      pointerType: "touch",
      isPrimary: true,
      buttons: 1,
      clientY: pressY - 40,
    })
    await waitFor(() =>
      expect(
        Math.round(panel.getBoundingClientRect().height - restingHeight),
      ).toBe(40),
    )
    await expect(
      Math.abs(panel.getBoundingClientRect().bottom - frameBottom()),
    ).toBeLessThan(1)
    await expect(
      Math.round(body.getBoundingClientRect().height - restingBody),
    ).toBe(40)
    fireEvent.pointerUp(grab, {
      pointerId: 9,
      pointerType: "touch",
      button: 0,
      clientY: 0,
    })
    await waitFor(() => expect(filled()).toBe(false))

    dragGrab(1, grabY - 80)
    await expect(dialog).toHaveAttribute("data-expanded", "true")
    dragGrab(2, grabY + 80)
    await expect(dialog).toHaveAttribute("data-expanded", "false")
    dragGrab(3, grabY + 80)
    await waitFor(() =>
      expect(
        canvas.queryByRole("dialog", { name: "Queued" }),
      ).not.toBeInTheDocument(),
    )
  },
}

export const DoneAction: Story = {
  parameters: storyDocumentation(
    "A trailing Done control is the other header dismiss pattern — the queue sheet uses it instead of a close glyph.",
  ),
  render: () => <SheetExample action />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    await expect(canvas.getByRole("dialog", { name: "Queued" })).toBeVisible()
    const closing = canvas.getByRole("dialog", { name: "Queued" })
    await userEvent.click(canvas.getByRole("button", { name: "Done" }))
    // The sheet outlives its own dismissal: the panel slides out before the
    // host is told to unmount it, so it is still present, marked closing, and
    // no longer taking presses.
    await expect(closing).toHaveAttribute("data-closing", "true")
    await expect(closing).toBeInTheDocument()
    // Still covering while it plays: the panel is up until the slide ends.
    await expect(canvas.getByRole("button", { name: "Open sheet" })).toHaveAttribute("inert")
    await waitFor(() =>
      expect(
        canvas.queryByRole("dialog", { name: "Queued" }),
      ).not.toBeInTheDocument(),
    )
    // Released with the dismissal itself, not a task later when the unmount
    // cleanup happens to flush.
    await expect(canvas.getByRole("button", { name: "Open sheet" })).not.toHaveAttribute("inert")
  },
}

function SheetWithPortalledMenu() {
  const [open, setOpen] = React.useState(false)
  const [chosen, setChosen] = React.useState("none")
  return (
    <div className="relative h-80 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background">
      <div className="p-4">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 font-sans nessa-text-4"
          onClick={() => setOpen(true)}
        >
          Open sheet
        </button>
        <p className="mt-2 font-mono nessa-text-2 text-muted-foreground" data-testid="chosen">
          chosen: {chosen}
        </p>
      </div>
      {open ? (
        <Sheet onClose={() => setOpen(false)} label="Run settings">
          <SheetHandle />
          <SheetHeader>
            <SheetClose className="col-start-1 justify-self-start" />
            <SheetTitle className="col-start-2">Run settings</SheetTitle>
          </SheetHeader>
          <SheetBody className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Model</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setChosen("fast")}>Fast</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setChosen("deep")}>Deep</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SheetBody>
        </Sheet>
      ) : null}
    </div>
  )
}

export const PortalledLayerInsideSheet: Story = {
  parameters: storyDocumentation(
    "A menu opened from inside a modal sheet portals into a container the sheet owns rather than to the body, so it is a descendant of the sheet that raised it. That is what keeps it working: it sits inside the boundary the sheet made inert instead of being disabled by it, and it paints above the panel. Being a descendant is also why the sheet has to recognize it as a layer rather than treat its items as sheet content — while the menu holds focus it owns the keystrokes, including Tab, and only the innermost owner moves focus.",
  ),
  render: () => <SheetWithPortalledMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    const sheet = await canvas.findByRole("dialog", { name: "Run settings" })

    // The sheet is modal, so what it covers really is inert.
    await expect(sheet).toHaveAttribute("aria-modal", "true")

    await userEvent.click(within(sheet).getByRole("button", { name: "Model" }))
    const menu = await body.findByRole("menu")

    // The menu belongs to the sheet, so it is *in* the sheet: it portalled
    // into the container the sheet owns rather than to the body. Everything
    // else follows from that — it cannot be swept up by the sheet's own
    // inertness, it paints above the panel, and focus entering it is focus
    // that never left the boundary.
    await expect(sheet.contains(menu)).toBe(true)
    await expect(menu.closest('[data-slot="sheet-layers"]')).not.toBeNull()
    await expect(menu.closest("[inert]")).toBeNull()
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true))

    // Tab belongs to the menu while the menu is up. Being inside the sheet is
    // what makes this the interesting case: the sheet must recognize the menu
    // as a layer of its own rather than treat its items as sheet content.
    await userEvent.keyboard("{ArrowDown}")
    await expect(menu.contains(document.activeElement)).toBe(true)

    // And the layer still works end to end.
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(canvas.getByTestId("chosen")).not.toHaveTextContent("chosen: none"),
    )
    // Closing the menu leaves the sheet in charge again.
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull())
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true))
  },
}

/** Document order of the things Tab can land on inside the sheet. */
function tabbableWithinSheet(sheet: HTMLElement) {
  return Array.from(
    sheet.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"),
  ).filter((element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled)
}

function SheetWithNonmodalOverlay() {
  const [open, setOpen] = React.useState(false)
  const [reading, setReading] = React.useState(false)
  return (
    <div className="relative h-80 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] bg-background">
      <div className="p-4">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 font-sans nessa-text-4"
          onClick={() => setOpen(true)}
        >
          Open sheet
        </button>
        <button type="button" className="ml-2 rounded-md border border-border px-3 py-2 font-sans nessa-text-4">
          Outside the sheet
        </button>
      </div>
      {open ? (
        <Sheet onClose={() => setOpen(false)} label="Run settings">
          <SheetHandle />
          <SheetHeader>
            <SheetClose className="col-start-1 justify-self-start" />
            <SheetTitle className="col-start-2">Run settings</SheetTitle>
          </SheetHeader>
          <SheetBody className="p-4">
            <Button size="sm" onClick={() => setReading(true)}>Read transcript</Button>
          </SheetBody>
          {/* The reading view fills the panel, the way a transcript-scoped
              overlay does in a real host. */}
          {reading ? (
            <ChatOverlay onClose={() => setReading(false)} label="Transcript">
              <ChatOverlayBack onClick={() => setReading(false)}>Back</ChatOverlayBack>
              {/* Deliberately the last tabbable thing in the sheet: the case
                  that matters is Tab leaving the *end* of the nested view. */}
              <ChatOverlayBody className="p-4">
                <Button size="sm" data-testid="last-control">Last control</Button>
              </ChatOverlayBody>
            </ChatOverlay>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  )
}

export const NonmodalOverlayInsideSheet: Story = {
  parameters: storyDocumentation(
    "A ChatOverlay is a `role=\"dialog\"` that deliberately does not trap Tab. Nested inside a modal Sheet it is still the Sheet's to contain: a panel defers only to a surface that actually owns focus, never to one that merely looks like it does, or Tab would leave the modal entirely.",
  ),
  render: () => <SheetWithNonmodalOverlay />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open sheet" }))
    const sheet = await canvas.findByRole("dialog", { name: "Run settings" })
    await userEvent.click(within(sheet).getByRole("button", { name: "Read transcript" }))
    const overlay = await within(sheet).findByRole("dialog", { name: "Transcript" })

    // The view fades in, and an assertion taken mid-fade is an assertion
    // about a frame rather than about the composition. Wait for the value the
    // test actually depends on — the view being fully drawn — rather than for
    // "no animations", which a fade that has not started yet also satisfies.
    await waitFor(() =>
      expect(getComputedStyle(overlay).opacity).toBe("1"),
    )

    // The premise: a nested dialog that claims no modality and traps nothing.
    await expect(overlay).not.toHaveAttribute("aria-modal")

    // The last control really is last: nothing inside the sheet follows it,
    // so a Tab the sheet fails to contain leaves the modal for good.
    const last = canvas.getByTestId("last-control")
    const order = tabbableWithinSheet(sheet)
    await expect(order.at(-1)).toBe(last)

    last.focus()
    await userEvent.tab()
    await expect(document.body).not.toHaveFocus()
    await expect(sheet.contains(document.activeElement)).toBe(true)

    // And the same going backwards off the front of the sheet.
    order[0]!.focus()
    await userEvent.tab({ shift: true })
    await expect(document.body).not.toHaveFocus()
    await expect(sheet.contains(document.activeElement)).toBe(true)
  },
}
