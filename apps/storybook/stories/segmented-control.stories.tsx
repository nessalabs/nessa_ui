import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  SegmentedControl,
  SegmentedControlOption,
} from "@nessalabs/ui"

import { finishStoryTransitions } from "./finish-story-transitions"
import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A compact single-choice switcher: a bordered pill of pressed/unpressed buttons, the pattern Nessa's toolbars use for view and scale toggles (the GanttChart toolbar composes it for Day/Week/Month). One option is always selected, choosing another moves the pressed state and fires onValueChange, and the group takes an aria-label naming the choice it controls. The bare variant drops the strip, and the glass variant sets the options on a translucent track whose selection rides a sliding lens.",
      },
    },
  },
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

export const ViewSwitcher: Story = {
  parameters: storyDocumentation(
    "An uncontrolled switcher in its natural habitat: three view options with a default. The play test selects another option and proves the pressed state moved by aria-pressed and by computed background — the selected option paints the secondary surface while the rest stay transparent.",
  ),
  render: () => (
    <SegmentedControl aria-label="Calendar view" defaultValue="week">
      <SegmentedControlOption value="day">Day</SegmentedControlOption>
      <SegmentedControlOption value="week">Week</SegmentedControlOption>
      <SegmentedControlOption value="month">Month</SegmentedControlOption>
    </SegmentedControl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const week = canvas.getByRole("button", { name: "Week" })
    const month = canvas.getByRole("button", { name: "Month" })
    await expect(week).toHaveAttribute("aria-pressed", "true")
    await expect(month).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(month)
    await expect(month).toHaveAttribute("aria-pressed", "true")
    await expect(week).toHaveAttribute("aria-pressed", "false")
    await waitFor(async () => {
      const pressed = getComputedStyle(month).backgroundColor
      const idle = getComputedStyle(week).backgroundColor
      await expect(pressed).not.toBe("rgba(0, 0, 0, 0)")
      await expect(idle).not.toBe(pressed)
    })
  },
}

function ControlledDemo() {
  const [value, setValue] = React.useState("compact")
  return (
    <div className="flex flex-col items-center gap-3">
      <SegmentedControl
        aria-label="Density"
        value={value}
        onValueChange={setValue}
      >
        <SegmentedControlOption value="compact">Compact</SegmentedControlOption>
        <SegmentedControlOption value="comfortable">
          Comfortable
        </SegmentedControlOption>
      </SegmentedControl>
      <p className="text-xs text-muted-foreground">
        Density: <span data-testid="density-value">{value}</span>
      </p>
    </div>
  )
}

export const Controlled: Story = {
  parameters: storyDocumentation(
    "A controlled switcher whose host owns the value and mirrors it below. The play test clicks through both options and asserts the mirrored value tracks the selection.",
  ),
  render: () => <ControlledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Comfortable" }),
    )
    await expect(canvas.getByTestId("density-value")).toHaveTextContent(
      "comfortable",
    )
    await userEvent.click(canvas.getByRole("button", { name: "Compact" }))
    await expect(canvas.getByTestId("density-value")).toHaveTextContent(
      "compact",
    )
  },
}

export const Bare: Story = {
  parameters: storyDocumentation(
    "The `bare` shell: the same options with no strip around them, for a row already framed by its container — the range tabs inside a chart's control bar are the case it was added for. Selection reads from the pressed option alone, so the control still tells a person what is chosen without a border to sit in.",
  ),
  render: () => (
    <SegmentedControl
      variant="bare"
      aria-label="Chart range"
      defaultValue="1M"
    >
      {["1D", "1W", "1M", "1Y"].map((range) => (
        <SegmentedControlOption key={range} value={range} className="px-2.5">
          {range}
        </SegmentedControlOption>
      ))}
    </SegmentedControl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole("group", { name: "Chart range" })
    // No strip: the shell contributes no border of its own.
    await expect(getComputedStyle(group).borderTopWidth).toBe("0px")
    await expect(
      canvas.getByRole("button", { name: "1M" }),
    ).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(canvas.getByRole("button", { name: "1Y" }))
    await expect(
      canvas.getByRole("button", { name: "1Y" }),
    ).toHaveAttribute("aria-pressed", "true")
  },
}

/** The lens and the option it should be carrying, read from the rendered strip. */
function lensAndPressed(canvasElement: HTMLElement, name: string) {
  const group = within(canvasElement).getByRole("group", { name })
  const lens = group.querySelector<HTMLElement>(
    '[data-slot="segmented-control-lens"]',
  )
  const pressed = group.querySelector<HTMLElement>('[aria-pressed="true"]')
  return { group, lens, pressed }
}

/**
 * Asserts the lens covers the pressed option exactly. Both are measured in
 * the same engine, so this holds however the fonts lay out.
 */
async function expectLensOnPressed(canvasElement: HTMLElement, name: string) {
  const { lens, pressed } = lensAndPressed(canvasElement, name)
  await expect(lens).not.toBeNull()
  await expect(pressed).not.toBeNull()
  const lensBox = lens!.getBoundingClientRect()
  const pressedBox = pressed!.getBoundingClientRect()
  await expect(Math.abs(lensBox.left - pressedBox.left)).toBeLessThan(0.5)
  await expect(Math.abs(lensBox.width - pressedBox.width)).toBeLessThan(0.5)
}

function prefersReducedMotion(canvasElement: HTMLElement) {
  return canvasElement.ownerDocument.defaultView!.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches
}

export const Glass: Story = {
  // The glide is a CSS transition the engine runs, and the reduced-motion
  // project is where it must not.
  tags: ["cross-engine", "reduced-motion"],
  parameters: storyDocumentation(
    "The `glass` variant: the options sit on a translucent track and the selection rides a lens that glides to whichever option is chosen — lifted from the track by the page's own background in light, by a brighter tint in dark, with a hairline rim and a faint specular top edge. Hovering an unchosen option gives it a quiet tint. The API and keyboard are the other variants': each option is a tab stop chosen with Enter or Space. The play test proves the lens covers the pressed option on first paint, glides on a click (and lands, with nothing left running), and follows keyboard selection; under reduced motion it proves the lens is already on the new option the moment it is chosen, with no transition at all.",
  ),
  args: { debug: true },
  render: (args) => (
    <SegmentedControl
      {...args}
      variant="glass"
      aria-label="Run view"
      defaultValue="summary"
    >
      <SegmentedControlOption value="summary">Summary</SegmentedControlOption>
      <SegmentedControlOption value="timeline">Timeline</SegmentedControlOption>
      <SegmentedControlOption value="files">Files</SegmentedControlOption>
    </SegmentedControl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = "Run view"
    const reduced = prefersReducedMotion(canvasElement)
    const { group, lens } = lensAndPressed(canvasElement, name)
    await expect(group).toHaveAttribute("data-variant", "glass")
    await expect(group).toHaveAttribute("data-lens", "placed")
    // First paint: placed, not glided into place.
    await expect(lens).not.toHaveAttribute("data-animate")
    await expectLensOnPressed(canvasElement, name)

    const timeline = canvas.getByRole("button", { name: "Timeline" })
    await userEvent.click(timeline)
    await expect(timeline).toHaveAttribute("aria-pressed", "true")
    if (reduced) {
      // No glide at all: the lens is already where it belongs.
      await expect(getComputedStyle(lens!).transitionProperty).toBe("none")
      await expectLensOnPressed(canvasElement, name)
    } else {
      await expect(lens).toHaveAttribute("data-animate")
      await expect(
        lens!
          .getAnimations()
          .some(
            (animation) =>
              animation instanceof CSSTransition &&
              animation.transitionProperty === "transform",
          ),
      ).toBe(true)
      await waitFor(async () => {
        finishStoryTransitions(canvasElement)
        await expectLensOnPressed(canvasElement, name)
      })
    }

    // Keyboard: every option is a tab stop, Enter and Space choose.
    await userEvent.tab()
    const files = canvas.getByRole("button", { name: "Files" })
    await expect(files).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(files).toHaveAttribute("aria-pressed", "true")
    await waitFor(async () => {
      finishStoryTransitions(canvasElement)
      await expectLensOnPressed(canvasElement, name)
    })
    await userEvent.tab({ shift: true })
    await userEvent.tab({ shift: true })
    const summary = canvas.getByRole("button", { name: "Summary" })
    await expect(summary).toHaveFocus()
    await userEvent.keyboard(" ")
    await expect(summary).toHaveAttribute("aria-pressed", "true")
    await expect(timeline).toHaveAttribute("aria-pressed", "false")
    await waitFor(async () => {
      finishStoryTransitions(canvasElement)
      await expectLensOnPressed(canvasElement, name)
    })
    finishStoryTransitions(canvasElement)
  },
}

function GlassGeometryDemo() {
  const [wide, setWide] = React.useState(false)
  const [renamed, setRenamed] = React.useState(false)
  const [extra, setExtra] = React.useState(false)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={wide ? "w-96" : "w-72"} data-testid="glass-frame">
        <SegmentedControl
          debug
          variant="glass"
          aria-label="Range"
          defaultValue="week"
          className="w-full"
        >
          {extra ? (
            <SegmentedControlOption value="hour" className="flex-1">
              Hour
            </SegmentedControlOption>
          ) : null}
          <SegmentedControlOption value="day" className="flex-1">
            Day
          </SegmentedControlOption>
          <SegmentedControlOption value="week" className="flex-1">
            {renamed ? "This working week" : "Week"}
          </SegmentedControlOption>
          <SegmentedControlOption value="month" className="flex-1">
            Month
          </SegmentedControlOption>
        </SegmentedControl>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWide((value) => !value)}
        >
          {wide ? "Narrow" : "Widen"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRenamed((value) => !value)}
        >
          {renamed ? "Shorten label" : "Lengthen label"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExtra((value) => !value)}
        >
          {extra ? "Remove option" : "Add option"}
        </Button>
      </div>
    </div>
  )
}

export const GlassFollowsItsOptions: Story = {
  parameters: storyDocumentation(
    "The lens is measured from the chosen option, not assumed from the option count, so it keeps its place when the geometry under it changes: the track resizing, the chosen label growing, or an option arriving ahead of it. Those moves land at once rather than gliding — a lens chasing a resizing track reads as lag. Stories enable the `debug` trace, so `window.__nessaSegmentedControl` records each placement and its cause. The play test widens the track, lengthens the chosen label, and adds an option before it, asserting after each that the lens still covers the chosen option exactly and did not animate there.",
  ),
  render: () => <GlassGeometryDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = "Range"
    const lensOf = () =>
      lensAndPressed(canvasElement, name).lens as HTMLElement
    await expectLensOnPressed(canvasElement, name)
    const startWidth = lensOf().getBoundingClientRect().width

    await userEvent.click(canvas.getByRole("button", { name: "Widen" }))
    await waitFor(async () => {
      await expect(lensOf().getBoundingClientRect().width).toBeGreaterThan(
        startWidth,
      )
    })
    await expect(lensOf()).not.toHaveAttribute("data-animate")
    await expectLensOnPressed(canvasElement, name)

    await userEvent.click(
      canvas.getByRole("button", { name: "Lengthen label" }),
    )
    await expect(
      canvas.getByRole("button", { name: "This working week" }),
    ).toHaveAttribute("aria-pressed", "true")
    await waitFor(async () => {
      await expectLensOnPressed(canvasElement, name)
    })
    await expect(lensOf()).not.toHaveAttribute("data-animate")

    const before = lensOf().getBoundingClientRect().left
    await userEvent.click(canvas.getByRole("button", { name: "Add option" }))
    await expect(canvas.getByRole("button", { name: "Hour" })).toBeVisible()
    await waitFor(async () => {
      await expect(lensOf().getBoundingClientRect().left).not.toBeCloseTo(
        before,
        0,
      )
      await expectLensOnPressed(canvasElement, name)
    })
    await expect(lensOf()).not.toHaveAttribute("data-animate")
    finishStoryTransitions(canvasElement)
  },
}
