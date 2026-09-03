import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  expect,
  fireEvent,
  userEvent,
  waitFor,
  within,
} from "storybook/test"
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  type DrawerSide,
} from "@nessa-ui/react"
import { Building2, Mail, Move3d, Phone, Sparkles } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Shell/Drawer",
  component: Drawer,
  // The sizing, resizing, and close-affordance contract lives on
  // DrawerContent, so autodocs must document the parts, not just the root.
  subcomponents: {
    DrawerContent,
    DrawerHeader,
    DrawerBody,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription,
  },
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A modal panel anchored to one edge of the viewport — the layer other Nessa components are composed onto for a record's detail view, a filter panel, or a form. Radix Dialog supplies the focus trap, Escape and outside-press dismissal, and the aria wiring; Nessa supplies the surface, the edge slide on the motion tokens, and the sizing contract. The panel slides in from its side and holds that transition on the way out, so closing is animated rather than cut. Size is a CSS length along the drawer's own axis, controlled with size or left to defaultSize, and resizable adds a drag- and keyboard-operable handle on the inner edge between minSize and maxSize.",
      },
    },
  },
} satisfies Meta<typeof Drawer>

export default meta
type Story = StoryObj<typeof meta>

const fieldClassName =
  "flex items-center justify-between gap-4 py-2 nessa-text-4"
const labelClassName =
  "flex items-center gap-2 text-muted-foreground [&_svg]:size-4"

function ContactFields() {
  return (
    <div className="flex flex-col divide-y divide-border">
      <div className={fieldClassName}>
        <span className={labelClassName}>
          <Mail />
          Email
        </span>
        <span>sara.mendez@example.com</span>
      </div>
      <div className={fieldClassName}>
        <span className={labelClassName}>
          <Sparkles />
          Status
        </span>
        <Badge variant="secondary">Out of office</Badge>
      </div>
      <div className={fieldClassName}>
        <span className={labelClassName}>
          <Building2 />
          Company
        </span>
        <span>Acme Inc.</span>
      </div>
      <div className={fieldClassName}>
        <span className={labelClassName}>
          <Phone />
          Phone
        </span>
        <span>+48 840 482 409</span>
      </div>
    </div>
  )
}

export const SidePanel: Story = {
  // The one component that reads its own transition duration back from CSS
  // and branches on 0ms belongs in the reduced-motion project.
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The default drawer: anchored right, 28rem wide, with a pinned header, a scrolling body, and a footer of actions. The play test opens it, proves it is a real modal dialog named by its title at the default width that takes focus onto the panel itself, then closes it — asserting the exit is animated rather than cut, and that focus returns to the control that opened it. It then reopens with a click that never focuses the trigger, the case Safari, Firefox and programmatic opens produce, and proves focus still comes back.",
  ),
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open contact</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Sara Mendez</DrawerTitle>
          <DrawerDescription>
            Product owner at Acme Inc., last active five minutes ago.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <ContactFields />
          <div className="flex flex-col gap-2">
            <h3 className="nessa-text-4 font-medium">Linked conversations</h3>
            {["Product design — feedback request", "Web development — project update", "Contract renewal"].map(
              (title) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-background p-3 nessa-text-4"
                >
                  {title}
                </div>
              ),
            )}
          </div>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DrawerClose>
          <Button>Save contact</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    const trigger = canvas.getByRole("button", { name: "Open contact" })
    await userEvent.click(trigger)
    const drawer = await body.findByRole("dialog", { name: "Sara Mendez" })

    // The panel itself takes focus, so the drawer is announced by name and
    // description before any control, and no keystroke acts by accident.
    await waitFor(async () => {
      await expect(drawer).toHaveFocus()
    })

    // The panel is anchored to the right edge at the default 28rem.
    await waitFor(async () => {
      const box = drawer.getBoundingClientRect()
      await expect(Math.round(box.width)).toBe(448)
      await expect(Math.round(box.right)).toBe(
        canvasElement.ownerDocument.documentElement.clientWidth,
      )
      // Fully arrived: the closed offset has been transitioned away.
      await expect(getComputedStyle(drawer).translate).toBe("none")
    })

    await userEvent.click(body.getByRole("button", { name: "Close" }))
    // The exit is animated, not cut: while the panel still runs a non-zero
    // transition it is both mounted and already moving off its open position.
    // Under reduced motion there is no transition to observe, and the only
    // correct behaviour is the immediate unmount asserted below.
    if (Number.parseFloat(getComputedStyle(drawer).transitionDuration) > 0) {
      await expect(drawer.isConnected).toBe(true)
      await expect(getComputedStyle(drawer).translate).not.toBe("none")
    }
    await waitFor(async () => {
      await expect(drawer.isConnected).toBe(false)
    })
    // Focus goes back where it came from rather than onto the body.
    await expect(trigger).toHaveFocus()

    // Opened without the trigger ever taking focus — Safari and Firefox do
    // not focus a button on click, and a programmatic or `defaultOpen` open
    // has nothing focused either. The drawer must not claim a restore it
    // cannot perform: Radix's own trigger restore has to run instead.
    trigger.blur()
    await expect(document.activeElement).toBe(canvasElement.ownerDocument.body)
    fireEvent.click(trigger)
    const reopened = await body.findByRole("dialog", { name: "Sara Mendez" })
    await waitFor(async () => {
      await expect(reopened).toHaveFocus()
    })
    await userEvent.click(body.getByRole("button", { name: "Close" }))
    await waitFor(async () => {
      await expect(reopened.isConnected).toBe(false)
    })
    await expect(trigger).toHaveFocus()
  },
}

export const Resizable: Story = {
  parameters: storyDocumentation(
    "A drawer the reader can widen: resizable puts an ARIA window-splitter handle on the inner edge, operable by drag and by keyboard, and clamped between minSize and maxSize. The play test drives it both ways — an arrow step, End for the maximum, then a pointer drag and a drag that overshoots the minimum — and asserts the rendered width and the reported aria-valuenow move together, since the handle reports the size layout actually resolved rather than the size that was requested. A double-click restores defaultSize, and a drawer dismissed mid-drag ends the gesture with it, so the next one does not resize on a hover.",
  ),
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open resizable</Button>
      </DrawerTrigger>
      <DrawerContent
        resizable
        defaultSize="24rem"
        minSize="20rem"
        maxSize="34rem"
      >
        <DrawerHeader>
          <DrawerTitle>Filters</DrawerTitle>
          <DrawerDescription>
            Drag the left edge, or focus it and use the arrow keys.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <ContactFields />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole("button", { name: "Open resizable" }))
    const drawer = await body.findByRole("dialog", { name: "Filters" })
    const handle = body.getByRole("separator", { name: "Resize drawer" })

    await waitFor(async () => {
      await expect(handle).toHaveAttribute("aria-valuenow", "384")
      await expect(handle).toHaveAttribute("aria-valuemin", "320")
      await expect(handle).toHaveAttribute("aria-valuemax", "544")
    })

    // The documented target-size exception, pinned: the handle's pointer
    // target is the 12px strip it claims to be, and it lies wholly inside
    // the panel, where a miss cannot reach the dismissing overlay.
    const target = handle.getBoundingClientRect()
    const panel = drawer.getBoundingClientRect()
    await expect(Math.round(target.width)).toBe(12)
    await expect(target.left).toBeGreaterThanOrEqual(panel.left - 0.5)
    await expect(target.right).toBeLessThanOrEqual(panel.right + 0.5)

    handle.focus()
    await expect(handle).toHaveFocus()

    // Away from the right edge grows a right-anchored drawer.
    await userEvent.keyboard("{ArrowLeft}")
    await waitFor(async () => {
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(400)
      await expect(handle).toHaveAttribute("aria-valuenow", "400")
    })

    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}")
    await waitFor(async () => {
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(464)
    })

    await userEvent.keyboard("{Home}")
    await waitFor(async () => {
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(320)
    })

    // Enter is the keyboard's route back to defaultSize.
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => {
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(384)
    })

    await userEvent.keyboard("{End}")
    await waitFor(async () => {
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(544)
    })

    // Dragging the handle away from the anchored edge grows the panel, and
    // the drag is clamped by minSize rather than following the pointer.
    const dragBy = async (distance: number) => {
      const from = handle.getBoundingClientRect().left
      const to = from + distance
      await userEvent.pointer([
        {
          keys: "[MouseLeft>]",
          target: handle,
          coords: { clientX: from, clientY: 200 },
        },
        { target: handle, coords: { clientX: to, clientY: 200 } },
        {
          keys: "[/MouseLeft]",
          target: handle,
          coords: { clientX: to, clientY: 200 },
        },
      ])
    }
    // Toward the anchored edge shrinks a right drawer.
    await dragBy(200)
    await waitFor(async () => {
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(344)
      await expect(handle).toHaveAttribute("aria-valuenow", "344")
    })
    await dragBy(900)
    await waitFor(async () => {
      // minSize is 20rem: the drag stops there instead of following the pointer.
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(320)
    })

    // Double-clicking the handle restores defaultSize.
    await userEvent.dblClick(handle)
    await waitFor(async () => {
      await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(384)
    })

    // Dismissing mid-drag unmounts the handle while it still holds the
    // pointer, so no pointer event can end the gesture. The drawer must end
    // it anyway: otherwise the next drawer resizes on hover, from the origin
    // of a press it never saw.
    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: handle,
      coords: { clientX: handle.getBoundingClientRect().left, clientY: 200 },
    })
    await userEvent.keyboard("{Escape}")
    await userEvent.pointer({ keys: "[/MouseLeft]" })
    await waitFor(async () => {
      await expect(drawer.isConnected).toBe(false)
    })

    await userEvent.click(canvas.getByRole("button", { name: "Open resizable" }))
    const reopened = await body.findByRole("dialog", { name: "Filters" })
    const reopenedHandle = body.getByRole("separator", {
      name: "Resize drawer",
    })
    const settled = Math.round(reopened.getBoundingClientRect().width)
    await userEvent.pointer({
      target: reopenedHandle,
      coords: {
        clientX: reopenedHandle.getBoundingClientRect().left - 120,
        clientY: 300,
      },
    })
    await expect(Math.round(reopened.getBoundingClientRect().width)).toBe(
      settled,
    )

    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(reopened.isConnected).toBe(false)
    })
  },
}

export const Sides: Story = {
  parameters: storyDocumentation(
    "Every edge from one panel, with resizing on a switch: side moves the drawer and its slide follows the edge it is anchored to, while size measures width on the left and right and height on the top and bottom. Resizable puts the handle on whichever edge faces the page, so the same toggle works from all four. This one is controlled — the host owns the open state, the edge, and the toggle — and hides the built-in close affordance in favour of its own footer action. The play test opens all four in turn and asserts each panel is flush against the edge it was given, then turns resizing on and drives the handle from the keyboard.",
  ),
  render: function ControlledSides() {
    const [side, setSide] = React.useState<DrawerSide>("right")
    const [open, setOpen] = React.useState(false)
    const [resizable, setResizable] = React.useState(false)
    const sides: DrawerSide[] = ["left", "right", "top", "bottom"]
    return (
      <Drawer side={side} open={open} onOpenChange={setOpen}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {sides.map((edge) => (
              <Button
                key={edge}
                variant="outline"
                className="capitalize"
                onClick={() => {
                  setSide(edge)
                  setOpen(true)
                }}
              >
                From {edge}
              </Button>
            ))}
          </div>
          <Button
            variant={resizable ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={resizable}
            onClick={() => setResizable((current) => !current)}
          >
            <Move3d />
            Resizable
          </Button>
        </div>
        <DrawerContent
          defaultSize="18rem"
          showCloseButton={false}
          resizable={resizable}
        >
          <DrawerHeader className="pr-4">
            <DrawerTitle>Share this view</DrawerTitle>
            <DrawerDescription>
              Anyone with the link can read the report.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <ContactFields />
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const view = canvasElement.ownerDocument.documentElement

    // Each edge in turn: the panel spans the edge it is anchored to, is
    // flush against it, and is 18rem deep on its own axis.
    const edges = [
      { name: "left", flush: (box: DOMRect) => Math.round(box.left) === 0 },
      {
        name: "right",
        flush: (box: DOMRect) => Math.round(box.right) === view.clientWidth,
      },
      { name: "top", flush: (box: DOMRect) => Math.round(box.top) === 0 },
      {
        name: "bottom",
        flush: (box: DOMRect) => Math.round(box.bottom) === view.clientHeight,
      },
    ] as const

    for (const edge of edges) {
      await userEvent.click(
        canvas.getByRole("button", { name: `From ${edge.name}` }),
      )
      const drawer = await body.findByRole("dialog", { name: "Share this view" })
      await expect(drawer).toHaveAttribute("data-side", edge.name)

      const horizontal = edge.name === "left" || edge.name === "right"
      await waitFor(async () => {
        const box = drawer.getBoundingClientRect()
        await expect(Math.round(horizontal ? box.width : box.height)).toBe(288)
        await expect(Math.round(horizontal ? box.height : box.width)).toBe(
          horizontal ? view.clientHeight : view.clientWidth,
        )
        await expect(edge.flush(box)).toBe(true)
      })

      // The built-in affordance is off; the host's own action closes it.
      await expect(body.queryByRole("button", { name: "Close" })).toBeNull()
      // Resizing is off until the toggle says otherwise, on every edge.
      await expect(body.queryByRole("separator")).toBeNull()
      await userEvent.click(body.getByRole("button", { name: "Done" }))
      await waitFor(async () => {
        await expect(drawer.isConnected).toBe(false)
      })
      // Nothing here is a DrawerTrigger, so Radix has no trigger to restore
      // to: the drawer has to put focus back on the opener itself.
      await expect(
        canvas.getByRole("button", { name: `From ${edge.name}` }),
      ).toHaveFocus()
    }

    // The toggle adds the handle to the edge facing the page — here the
    // bottom of a top sheet, where the splitter is horizontal and moving it
    // down is what grows the panel.
    await userEvent.click(canvas.getByRole("button", { name: "Resizable" }))
    await userEvent.click(canvas.getByRole("button", { name: "From top" }))
    const sheet = await body.findByRole("dialog", { name: "Share this view" })
    const handle = body.getByRole("separator", { name: "Resize drawer" })
    await expect(handle).toHaveAttribute("aria-orientation", "horizontal")

    await waitFor(async () => {
      await expect(handle).toHaveAttribute("aria-valuenow", "288")
    })
    handle.focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(async () => {
      await expect(Math.round(sheet.getBoundingClientRect().height)).toBe(304)
      await expect(handle).toHaveAttribute("aria-valuenow", "304")
    })

    await userEvent.click(body.getByRole("button", { name: "Done" }))
    await waitFor(async () => {
      await expect(sheet.isConnected).toBe(false)
    })
  },
}

export const OpenerRemoved: Story = {
  parameters: storyDocumentation(
    "The drawer returns focus to whatever opened it, which usually needs no thought — but a drawer whose own action deletes the row that opened it has nowhere to return to, and focus would land on the document body. onReturnFocus is the escape hatch: the host says where focus belongs when the opener is gone. The play test opens the drawer from a row, deletes that row from inside the drawer, and asserts focus lands on the host's fallback rather than on the body.",
  ),
  render: function OpenerRemovedExample() {
    const [rows, setRows] = React.useState(["Sara Mendez", "Jin Park"])
    const [openRow, setOpenRow] = React.useState<string | null>(null)
    const listRef = React.useRef<HTMLButtonElement>(null)
    return (
      <div className="flex w-72 flex-col gap-2">
        <Button ref={listRef} variant="ghost" size="sm" className="self-start">
          Add contact
        </Button>
        {rows.map((row) => (
          <Button
            key={row}
            variant="outline"
            className="justify-start"
            onClick={() => setOpenRow(row)}
          >
            {row}
          </Button>
        ))}
        <Drawer
          open={openRow !== null}
          onOpenChange={(next) => {
            if (!next) setOpenRow(null)
          }}
        >
          <DrawerContent
            onReturnFocus={() => listRef.current?.focus()}
            showCloseButton={false}
          >
            <DrawerHeader className="pr-4">
              <DrawerTitle>{openRow ?? "Contact"}</DrawerTitle>
              <DrawerDescription>
                Deleting this contact removes the row that opened this drawer.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <ContactFields />
            </DrawerBody>
            <DrawerFooter>
              <Button
                variant="destructive"
                onClick={() => {
                  setRows((current) => current.filter((row) => row !== openRow))
                  setOpenRow(null)
                }}
              >
                Delete contact
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole("button", { name: "Sara Mendez" }))
    const drawer = await body.findByRole("dialog", { name: "Sara Mendez" })

    await userEvent.click(
      body.getByRole("button", { name: "Delete contact" }),
    )
    await waitFor(async () => {
      await expect(drawer.isConnected).toBe(false)
    })

    // The row that opened the drawer is gone, so the host's fallback owns
    // where focus lands — not the document body.
    await expect(canvas.queryByRole("button", { name: "Sara Mendez" })).toBeNull()
    await expect(canvas.getByRole("button", { name: "Add contact" })).toHaveFocus()
  },
}
