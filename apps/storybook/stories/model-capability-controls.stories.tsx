import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  ModelFastMode,
  ModelThinkingControl,
  ModelThinkingSlider,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"
import { FastIcon, ThinkingIcon } from "./icons/nucleo"

const levels = [
  { value: "light", label: "Light", description: "Quick, focused reasoning" },
  { value: "medium", label: "Medium", description: "Balanced speed and depth" },
  { value: "high", label: "High", description: "More deliberate reasoning" },
  {
    value: "extra-high",
    label: "Extra High",
    description: "Deep, extended reasoning",
  },
  {
    value: "ultra",
    label: "Ultra",
    description: "Maximum extended reasoning",
    accent: "ultra" as const,
  },
]
const reorderedUltraLevels = [levels[0]!, levels[4]!, levels[1]!]
const nonUltraLevels = [levels[0]!, levels[1]!]
const singleUltraLevel = [levels[4]!]
const reducedMotionQuery = "(prefers-reduced-motion: reduce)"
const fastStreamSpeedMultiplier = 1.7

function cssTimeInMilliseconds(value: string) {
  const numeric = Number.parseFloat(value)
  return value.trim().endsWith("ms") ? numeric : numeric * 1000
}

function releaseActivePointer(element: HTMLElement) {
  const pointerId = Number(element.getAttribute("data-active-pointer-id"))
  fireEvent.pointerUp(element, { pointerId })
}

async function verifyUltraStream(canvasElement: HTMLElement) {
  const stream = canvasElement.querySelector<HTMLElement>(
    '[data-slot="model-thinking-slider-ultra-stream"]',
  )!
  const periods = Array.from(
    stream.querySelectorAll<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream-period"]',
    ),
  )
  const track = canvasElement.querySelector<HTMLElement>(
    '[data-slot="model-thinking-slider-track"]',
  )!
  const range = canvasElement.querySelector<HTMLElement>(
    '[data-slot="model-thinking-slider-range"]',
  )!
  const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches
  await expect(periods).toHaveLength(2)
  if (reducedMotion) {
    await expect(stream.getAnimations()).toHaveLength(0)
    await expect(periods[0]!.getBoundingClientRect().width).toBeCloseTo(
      range.getBoundingClientRect().width,
      1,
    )
    return
  }

  let animation: Animation | undefined
  await waitFor(() => {
    animation = stream.getAnimations()[0]
    expect(animation).toBeDefined()
  })
  const timing = animation!.effect!.getTiming()
  const duration = Number(timing.duration)
  animation!.pause()
  animation!.currentTime = 0
  const ambientDuration = cssTimeInMilliseconds(
    getComputedStyle(stream)
      .getPropertyValue("--nessa-motion-duration-ambient")
      .trim(),
  )
  const trackRect = track.getBoundingClientRect()
  const rangeRect = range.getBoundingClientRect()
  const streamRect = stream.getBoundingClientRect()
  const firstPeriodRect = periods[0]!.getBoundingClientRect()
  const secondPeriodRect = periods[1]!.getBoundingClientRect()

  await expect(Number(timing.delay)).toBe(0)
  await expect(timing.iterations).toBe(Infinity)
  await expect(timing.easing).toBe("linear")
  await expect(duration).toBeCloseTo(ambientDuration, 1)
  await expect(animation!.playbackRate).toBeCloseTo(1 / 0.27, 2)
  await expect(stream).toHaveAttribute("data-energy", "1.00")
  await expect(streamRect.left).toBeCloseTo(rangeRect.left, 1)
  await expect(streamRect.width).toBeCloseTo(rangeRect.width * 2, 1)
  await expect(firstPeriodRect.width).toBeCloseTo(rangeRect.width, 1)
  await expect(secondPeriodRect.left).toBeCloseTo(firstPeriodRect.right, 1)
  await expect(getComputedStyle(periods[0]!).backgroundImage).toBe(
    getComputedStyle(periods[1]!).backgroundImage,
  )
  await expect(getComputedStyle(periods[0]!).backgroundImage).toMatch(
    /^linear-gradient\(90deg, (?:transparent|rgba\(0, 0, 0, 0\)) 0%,[\s\S]*(?:transparent|rgba\(0, 0, 0, 0\)) 100%\)$/,
  )
  await expect(streamRect.top).toBeGreaterThanOrEqual(trackRect.top)
  await expect(streamRect.bottom).toBeLessThanOrEqual(trackRect.bottom)
  animation!.currentTime = duration * 0.2
  const rightPosition = stream.getBoundingClientRect().left
  animation!.currentTime = duration * 0.7
  const leftPosition = stream.getBoundingClientRect().left
  await expect(leftPosition).toBeLessThan(rightPosition)
  animation!.currentTime = duration * 0.5
  await expect(getComputedStyle(stream).filter).toContain("saturate(1.7)")
  await expect(getComputedStyle(stream).filter).toContain("brightness(1.22)")
  animation!.currentTime = duration * 0.9999
  await expect(periods[1]!.getBoundingClientRect().left).toBeCloseTo(
    rangeRect.left,
    0,
  )
  await expect(stream.style.opacity).toBe("1")
  animation!.play()
}

function CapabilityExample() {
  const [fast, setFast] = React.useState(false)
  const [thinking, setThinking] = React.useState("light")
  const [checkpoint, setCheckpoint] = React.useState("none")

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 text-card-foreground">
      <ModelThinkingControl
        icon={<ThinkingIcon className="size-4.5" />}
        levels={levels}
        value={thinking}
        onValueChange={setThinking}
        onCheckpoint={(level, index) =>
          setCheckpoint(`${index}:${level.label}`)
        }
        fastMode={{
          pressed: fast,
          onPressedChange: setFast,
          icon: ({ pressed }) => (
            <FastIcon active={pressed} className="size-4.5" />
          ),
          streamSpeedMultiplier: fastStreamSpeedMultiplier,
        }}
      />
      <output data-testid="checkpoint-output" className="sr-only">
        {checkpoint}
      </output>
    </div>
  )
}

function RtlSliderExample() {
  const [value, setValue] = React.useState("light")
  return (
    <div
      dir="rtl"
      className="w-72 rounded-xl border border-border bg-popover p-3"
    >
      <ModelThinkingSlider
        dir="rtl"
        levels={levels}
        value={value}
        onValueChange={setValue}
      />
    </div>
  )
}

function RtlComposedControlExample() {
  const [value, setValue] = React.useState("medium")
  return (
    <div dir="rtl">
      <ModelThinkingControl
        icon={<ThinkingIcon className="size-4.5" />}
        dir="rtl"
        levels={levels}
        value={value}
        onValueChange={setValue}
        defaultOpen
      />
    </div>
  )
}

function MutableCatalogSliderExample() {
  const [catalog, setCatalog] = React.useState(levels)
  const [value, setValue] = React.useState("ultra")
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCatalog(nonUltraLevels)}
        >
          Shrink catalog
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCatalog([...levels].reverse())}
        >
          Reorder catalog
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCatalog(levels)}
        >
          Reset catalog
        </Button>
      </div>
      <div className="w-72 rounded-xl border border-border bg-popover p-3">
        <ModelThinkingSlider
          levels={catalog}
          value={value}
          onValueChange={setValue}
        />
      </div>
    </div>
  )
}

function LiveMotionPreferenceExample() {
  const [ready, setReady] = React.useState(false)
  const [motionReduced, setMotionReduced] = React.useState(false)
  const controllerRef = React.useRef<{
    setReducedMotion: (matches: boolean) => void
  } | null>(null)

  React.useLayoutEffect(() => {
    const originalMatchMedia = window.matchMedia.bind(window)
    let matches = originalMatchMedia(reducedMotionQuery).matches
    setMotionReduced(matches)
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const query = {
      media: reducedMotionQuery,
      onchange: null as ((event: MediaQueryListEvent) => void) | null,
      get matches() {
        return matches
      },
      addEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (type === "change") listeners.add(listener)
      },
      removeEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (type === "change") listeners.delete(listener)
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList

    window.matchMedia = (value) =>
      value === reducedMotionQuery ? query : originalMatchMedia(value)
    controllerRef.current = {
      setReducedMotion(nextMatches) {
        matches = nextMatches
        setMotionReduced(nextMatches)
        const event = { matches, media: reducedMotionQuery } as MediaQueryListEvent
        query.onchange?.(event)
        for (const listener of listeners) listener(event)
      },
    }
    setReady(true)

    return () => {
      controllerRef.current = null
      window.matchMedia = originalMatchMedia
    }
  }, [])

  if (!ready) return null

  return (
    <div
      className="space-y-3"
      style={
        motionReduced
          ? undefined
          : ({
              "--nessa-motion-duration-slow": "300ms",
              "--nessa-motion-duration-ambient": "3.2s",
            } as React.CSSProperties)
      }
    >
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => controllerRef.current?.setReducedMotion(true)}
        >
          Reduce motion
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => controllerRef.current?.setReducedMotion(false)}
        >
          Allow motion
        </Button>
      </div>
      <div className="w-72 rounded-xl border border-border bg-popover p-3">
        <ModelThinkingSlider
          levels={levels}
          value="ultra"
          onValueChange={() => undefined}
        />
      </div>
    </div>
  )
}

const meta = {
  title: "Conversation/ModelCapabilityControls",
  component: ModelThinkingControl,
  tags: ["autodocs", "test", "reduced-motion"],
  args: { levels },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Independent composer controls for model capabilities. Render Fast only for models that support it and Thinking only when the selected model declares ordered thinking levels.",
      },
    },
  },
} satisfies Meta<typeof ModelThinkingControl>

export default meta
type Story = StoryObj<typeof meta>

export const ComposerControls: Story = {
  parameters: storyDocumentation(
    "Fast is an immediate toggle. Thinking opens a compact, ordered slider without changing ModelPicker geometry.",
  ),
  render: () => <CapabilityExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Thinking level: Light" }),
    )
    const body = within(canvasElement.ownerDocument.body)
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-thinking-content"]',
    )!
    const contentRect = content.getBoundingClientRect()
    await expect(contentRect.width).toBeLessThanOrEqual(272)
    await expect(contentRect.height).toBeLessThanOrEqual(110)
    const fast = body.getByRole("button", { name: "Fast mode" })
    const slider = body.getByRole("slider", { name: "Thinking level" })
    const checkpointOutput = canvas.getByTestId("checkpoint-output")
    const levelLabel = content.querySelector<HTMLElement>(
      '[data-slot="model-thinking-level-label"]',
    )!
    const track = content.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const stream = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream"]',
    )!
    const liquid = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-liquid"]',
    )!
    const constantFillGradient = getComputedStyle(liquid).backgroundImage
    const ultraShader = content.querySelector<HTMLElement>(
      '[data-slot="model-thinking-ultra-shader"]',
    )!
    await expect(ultraShader).toHaveAttribute("data-active", "false")
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      reducedMotionQuery,
    ).matches
    let streamAnimationBeforeFast: Animation | undefined
    let playbackRateBeforeFast = 0
    if (!reducedMotion) {
      await waitFor(() => {
        streamAnimationBeforeFast = stream.getAnimations()[0]
        expect(streamAnimationBeforeFast).toBeDefined()
      })
      playbackRateBeforeFast = streamAnimationBeforeFast!.playbackRate
    }
    await userEvent.click(fast)
    await expect(fast).toHaveAttribute("aria-pressed", "true")
    if (!reducedMotion) {
      await waitFor(() =>
        expect(stream.getAnimations()[0]!.playbackRate).toBeCloseTo(
          playbackRateBeforeFast * fastStreamSpeedMultiplier,
          2,
        ),
      )
      await expect(stream.getAnimations()[0]).toBe(streamAnimationBeforeFast)
    }
    const trackRect = track.getBoundingClientRect()
    const thumbRect = slider.getBoundingClientRect()
    const thumbTravel = trackRect.width - thumbRect.width
    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: track,
      coords: {
        clientX: trackRect.left + thumbRect.width / 2 + 0.6 / 4 * thumbTravel,
        clientY: trackRect.top + trackRect.height / 2,
      },
    })
    await waitFor(() => expect(levelLabel).toHaveTextContent("Medium"))
    await expect(checkpointOutput).toHaveTextContent("1:Medium")
    await expect(slider).toHaveAttribute("aria-valuetext", "Light to Medium")
    fireEvent.blur(canvasElement.ownerDocument.defaultView!)
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    fast.focus()
    await userEvent.tab()
    await expect(slider).toHaveFocus()
    await userEvent.keyboard("{Home}")
    await expect(getComputedStyle(slider).outlineStyle).not.toBe("none")
    await expect(levelLabel).toHaveTextContent("Light")
    const stages = [
      { label: "Light", energy: 0 },
      { label: "Medium", energy: 0.18 },
      { label: "High", energy: 0.36 },
      { label: "Extra High", energy: 0.54 },
      { label: "Ultra", energy: 1 },
    ]
    let previousOpacity = -1
    let previousPlaybackRate = 0
    for (const [index, stage] of stages.entries()) {
      if (index > 0) await userEvent.keyboard("{ArrowRight}")
      await expect(slider).toHaveAttribute("aria-valuetext", stage.label)
      await expect(stream).toHaveAttribute("data-energy", stage.energy.toFixed(2))
      const opacity = Number.parseFloat(getComputedStyle(stream).opacity)
      await expect(opacity).toBeGreaterThan(previousOpacity)
      previousOpacity = opacity
      if (!reducedMotion) {
        let animation: Animation | undefined
        await waitFor(() => {
          animation = stream.getAnimations()[0]
          expect(animation).toBeDefined()
        })
        await expect(animation!.playbackRate).toBeGreaterThan(
          previousPlaybackRate,
        )
        previousPlaybackRate = animation!.playbackRate
      }
    }
    await expect(checkpointOutput).toHaveTextContent("4:Ultra")
    await expect(getComputedStyle(liquid).backgroundImage).toBe(
      constantFillGradient,
    )
    await expect(ultraShader).toHaveAttribute("data-active", "true")
    await waitFor(() => expect(getComputedStyle(ultraShader).opacity).toBe("1"))
    await expect(getComputedStyle(ultraShader).boxShadow).not.toBe("none")
  },
}

export const ThinkingOnly: Story = {
  parameters: storyDocumentation(
    "Capability-aware composition omits Fast entirely when the selected model does not support it.",
  ),
  args: {
    levels,
    defaultValue: "high",
  },
}

export const SliderPrimitive: Story = {
  parameters: storyDocumentation(
    "The thick slider is independently consumable. Pointer dragging remains continuous between soft checkpoint detents, while keyboard input stays discrete and the energy fill preserves a reduced-motion fallback.",
  ),
  render: () => {
    const [value, setValue] = React.useState("light")
    return (
      <div className="w-72 rounded-xl border border-border bg-popover p-3">
        <ModelThinkingSlider
          levels={levels}
          value={value}
          onValueChange={setValue}
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = canvas.getByRole("slider", { name: "Thinking level" })
    const range = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-range"]',
    )!
    const track = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const liquid = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-liquid"]',
    )!
    const current = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-current"]',
    )!
    const flare = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-flare"]',
    )!
    const ultraStream = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream"]',
    )!
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    const thumbStyle = getComputedStyle(slider)
    const thumbRect = slider.getBoundingClientRect()
    await expect(thumbStyle.cursor).toBe("grab")

    await expect(liquid.getBoundingClientRect().width).toBeCloseTo(
      range.getBoundingClientRect().width,
      1,
    )
    await expect(getComputedStyle(liquid).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    )
    await expect(current).toBeInTheDocument()
    await expect(flare).toBeInTheDocument()
    await expect(ultraStream).toBeInTheDocument()
    await expect(
      canvasElement.querySelector('[data-slot="model-thinking-slider-wave"]'),
    ).not.toBeInTheDocument()
    await expect(thumbRect.width).toBeCloseTo(thumbRect.height, 1)
    await expect(Number.parseFloat(thumbStyle.borderRadius)).toBeGreaterThanOrEqual(
      thumbRect.width / 2,
    )
    await userEvent.pointer({ keys: "[MouseLeft>]", target: slider })
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "true"))
    const blurredPointerId = Number(
      slider.getAttribute("data-active-pointer-id"),
    )
    fireEvent.pointerDown(slider, {
      button: 0,
      isPrimary: false,
      pointerId: 999,
    })
    fireEvent.pointerUp(canvasElement.ownerDocument.defaultView!, {
      pointerId: 999,
    })
    await expect(slider).toHaveAttribute("data-dragging", "true")
    fireEvent.blur(canvasElement.ownerDocument.defaultView!)
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    fireEvent.pointerMove(slider, {
      clientX: slider.getBoundingClientRect().right,
      pointerId: blurredPointerId,
    })
    await expect(slider).toHaveAttribute("aria-valuetext", "Light")
    fireEvent.pointerUp(slider, { pointerId: blurredPointerId })
    await userEvent.pointer({ keys: "[MouseLeft>]", target: slider })
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "true"))
    await expect(getComputedStyle(slider).cursor).toBe("grabbing")
    await waitFor(() =>
      expect(slider.getBoundingClientRect().width).toBeCloseTo(
        thumbRect.width * 1.1,
        1,
      ),
    )
    releaseActivePointer(slider)
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    await expect(getComputedStyle(slider).cursor).toBe("grab")
    await userEvent.pointer({ keys: "[MouseLeft>]", target: slider })
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "true"))
    fireEvent.blur(canvasElement.ownerDocument.defaultView!)
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    await expect(getComputedStyle(slider).cursor).toBe("grab")
    await waitFor(() =>
      expect(slider.getBoundingClientRect().width).toBeCloseTo(
        thumbRect.width,
        1,
      ),
    )
    const trackRect = track.getBoundingClientRect()
    const thumbTravel = trackRect.width - thumbRect.width
    const xForPosition = (position: number) =>
      trackRect.left + thumbRect.width / 2 + (position / 4) * thumbTravel
    const dragY = trackRect.top + trackRect.height / 2
    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: track,
      coords: { clientX: xForPosition(1.6), clientY: dragY },
    })
    await waitFor(() => {
      const position = Number(slider.getAttribute("data-position"))
      expect(position).toBeGreaterThan(1.4)
      expect(position).toBeLessThan(1.8)
    })
    await expect(slider).toHaveAttribute("data-detent", "false")
    await expect(slider).toHaveAttribute("aria-valuetext", "Medium to High")
    fireEvent.blur(canvasElement.ownerDocument.defaultView!)
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    await expect(slider).toHaveAttribute("aria-valuetext", "High")
    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: track,
      coords: { clientX: xForPosition(1.94), clientY: dragY },
    })
    await waitFor(() => expect(slider).toHaveAttribute("data-position", "2.00"))
    await expect(slider).toHaveAttribute("data-detent", "true")
    await expect(slider).toHaveAttribute("aria-valuetext", "High")
    fireEvent.blur(canvasElement.ownerDocument.defaultView!)
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    await expect(slider).toHaveAttribute("aria-valuetext", "High")
    if (reducedMotion) {
      await expect(getComputedStyle(range).transitionDuration).toBe("0s")
      await expect(thumbStyle.transitionProperty).toBe("none")
    } else {
      const rootStyle = getComputedStyle(canvasElement.ownerDocument.documentElement)
      const slowDuration = rootStyle
        .getPropertyValue("--nessa-motion-duration-slow")
        .trim()
      const fastDuration = rootStyle
        .getPropertyValue("--nessa-motion-duration-fast")
        .trim()
      const standardEasing = rootStyle
        .getPropertyValue("--nessa-motion-easing-standard")
        .trim()
      const emphasizedEasing = rootStyle
        .getPropertyValue("--nessa-motion-easing-emphasized")
        .trim()
      for (const token of [
        "--nessa-thinking-fill-base",
        "--nessa-thinking-fill-current",
        "--nessa-thinking-fill-highlight",
      ]) {
        await expect(rootStyle.getPropertyValue(token).trim()).not.toBe("")
      }
      await expect(getComputedStyle(range).transitionProperty).toBe("all")
      await expect(getComputedStyle(range).transitionDuration).toBe("0s")
      await expect(
        cssTimeInMilliseconds(thumbStyle.transitionDuration),
      ).toBe(cssTimeInMilliseconds(fastDuration))
      await expect(thumbStyle.transitionTimingFunction).toBe(standardEasing)
      await expect(emphasizedEasing).not.toBe("")
      await expect(slowDuration).not.toBe("")
    }
    const rightBefore = range.style.right
    const lightFillGradient = getComputedStyle(liquid).backgroundImage
    const sequenceBeforeEnd = Number(liquid.dataset.motionSequence ?? 0)
    slider.focus()
    await userEvent.keyboard("{End}")
    await expect(range.style.right).not.toBe(rightBefore)
    await waitFor(() =>
      expect(range.getBoundingClientRect().width).toBeCloseTo(
        track.clientWidth,
        1,
      ),
    )
    await waitFor(() => expect(liquid.dataset.motionDirection).toBe("up"))
    await expect(liquid.dataset.motionSequence).toBe(
      String(sequenceBeforeEnd + 1),
    )
    await expect(liquid.getAnimations()).toHaveLength(0)
    await expect(getComputedStyle(liquid).filter).toBe("none")
    await expect(getComputedStyle(liquid).backgroundImage).toBe(
      lightFillGradient,
    )
    if (reducedMotion) {
      await expect(liquid.getAnimations({ subtree: true })).toHaveLength(0)
      await userEvent.keyboard("{Home}")
      await expect(slider).toHaveAttribute("aria-valuetext", "Light")
      await expect(range.getBoundingClientRect().width).toBeLessThanOrEqual(1)
    } else {
      let upwardAnimations: Animation[] = []
      await waitFor(() => {
        upwardAnimations = liquid.getAnimations({ subtree: true })
        expect(upwardAnimations).toHaveLength(4)
      })
      const upwardTransientAnimations = upwardAnimations.filter(
        (animation) => animation.effect?.getTiming().iterations !== Infinity,
      )
      await expect(upwardTransientAnimations).toHaveLength(3)
      for (const animation of upwardAnimations) {
        const duration = Number(animation.effect?.getTiming().duration ?? 0)
        animation.currentTime = duration * 0.25
      }
      await expect(Number.parseFloat(getComputedStyle(current).opacity)).toBeGreaterThan(
        0.14,
      )
      await expect(getComputedStyle(current).transform).not.toBe("none")
      await expect(Number.parseFloat(getComputedStyle(flare).opacity)).toBeGreaterThan(0)
      const sheenOpacity = Number.parseFloat(
        getComputedStyle(ultraStream).opacity,
      )
      await expect(sheenOpacity).toBeGreaterThanOrEqual(0.7)
      await expect(sheenOpacity).toBeLessThanOrEqual(1)
      await expect(getComputedStyle(ultraStream).transform).not.toBe("none")
      await expect(liquid.getBoundingClientRect().width).toBeCloseTo(
        range.getBoundingClientRect().width,
        1,
      )

      await userEvent.keyboard("{Home}")
      await waitFor(() => expect(liquid.dataset.motionDirection).toBe("down"))
      await expect(liquid.dataset.motionSequence).toBe(
        String(sequenceBeforeEnd + 2),
      )
      await expect(slider).toHaveAttribute("aria-valuetext", "Light")
      await expect(range.getBoundingClientRect().width).toBeLessThanOrEqual(1)
      await waitFor(() =>
        expect(
          upwardTransientAnimations.every(
            (animation) => animation.playState === "idle",
          ),
        ).toBe(true),
      )
      await expect(liquid.getAnimations({ subtree: true })).toHaveLength(4)
    }
  },
}

export const LocalizedSliderValueText: Story = {
  parameters: storyDocumentation(
    "Consumers can localize both detent and between-detent slider announcements without changing the visual catalog labels.",
  ),
  render: () => {
    const [value, setValue] = React.useState("light")
    return (
      <div className="w-72 rounded-xl border border-border bg-popover p-3">
        <ModelThinkingSlider
          levels={levels}
          value={value}
          onValueChange={setValue}
          getValueText={(lower, upper) =>
            lower?.value === upper?.value
              ? `Niveau ${lower?.label ?? "indisponible"}`
              : `${lower?.label ?? "indisponible"} vers ${upper?.label ?? "indisponible"}`
          }
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole("slider", {
      name: "Thinking level",
    })
    const track = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    await expect(slider).toHaveAttribute("aria-valuetext", "Niveau Light")
    const trackRect = track.getBoundingClientRect()
    const thumbWidth = slider.getBoundingClientRect().width
    const x =
      trackRect.left + thumbWidth / 2 + (1.6 / 4) * (trackRect.width - thumbWidth)
    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: track,
      coords: { clientX: x, clientY: trackRect.top + trackRect.height / 2 },
    })
    await waitFor(() =>
      expect(slider).toHaveAttribute("aria-valuetext", "Medium vers High"),
    )
    fireEvent.blur(canvasElement.ownerDocument.defaultView!)
  },
}

export const SliderSizes: Story = {
  parameters: storyDocumentation(
    "The slider defaults to the proportional 30px small treatment, while size=\"md\" preserves the original 36px geometry.",
  ),
  render: () => (
    <div className="grid w-72 gap-4 rounded-xl border border-border bg-popover p-3">
      <div data-testid="small-slider">
        <ModelThinkingSlider
          levels={levels}
          value="high"
          onValueChange={() => undefined}
        />
      </div>
      <div data-testid="medium-slider">
        <ModelThinkingSlider
          levels={levels}
          value="high"
          onValueChange={() => undefined}
          size="md"
        />
      </div>
      <div data-testid="composed-control">
        <ModelThinkingControl
          icon={<ThinkingIcon className="size-4.5" />}
          levels={levels}
          value="high"
          open
          sliderSize="md"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const small = within(canvas.getByTestId("small-slider"))
    const medium = within(canvas.getByTestId("medium-slider"))
    const smallThumb = small.getByRole("slider", { name: "Thinking level" })
    const mediumThumb = medium.getByRole("slider", { name: "Thinking level" })
    const smallRoot = smallThumb.closest<HTMLElement>(
      '[data-slot="model-thinking-slider"]',
    )!
    const mediumRoot = mediumThumb.closest<HTMLElement>(
      '[data-slot="model-thinking-slider"]',
    )!
    const smallTrack = smallRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const mediumTrack = mediumRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const smallLiquid = smallRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-liquid"]',
    )!
    const mediumLiquid = mediumRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-liquid"]',
    )!
    const smallCurrent = smallRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-current"]',
    )!
    const mediumCurrent = mediumRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-current"]',
    )!
    const smallFlare = smallRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-flare"]',
    )!
    const mediumFlare = mediumRoot.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-flare"]',
    )!
    const proportionalRatio = 30 / 36
    const blurRadius = (element: HTMLElement) =>
      Number.parseFloat(
        getComputedStyle(element).filter.match(/blur\(([\d.]+)px\)/)?.[1] ??
          "0",
      )
    const relativeEffectGeometry = (
      effect: HTMLElement,
      surface: HTMLElement,
    ) => {
      const effectRect = effect.getBoundingClientRect()
      const surfaceRect = surface.getBoundingClientRect()
      return {
        insetTop: surfaceRect.top - effectRect.top,
        offsetLeft: surfaceRect.left - effectRect.left,
      }
    }

    await expect(smallRoot).toHaveAttribute("data-size", "sm")
    await expect(mediumRoot).toHaveAttribute("data-size", "md")
    await expect(smallRoot.getBoundingClientRect().height).toBeCloseTo(30, 1)
    await expect(smallTrack.getBoundingClientRect().height).toBeCloseTo(30, 1)
    await expect(smallThumb.getBoundingClientRect().width).toBeCloseTo(30, 1)
    await expect(mediumRoot.getBoundingClientRect().height).toBeCloseTo(36, 1)
    await expect(mediumTrack.getBoundingClientRect().height).toBeCloseTo(36, 1)
    await expect(mediumThumb.getBoundingClientRect().width).toBeCloseTo(36, 1)
    for (const [smallPart, mediumPart] of [
      [smallCurrent, mediumCurrent],
      [smallFlare, mediumFlare],
    ] as const) {
      await expect(
        smallPart.getBoundingClientRect().width /
          mediumPart.getBoundingClientRect().width,
      ).toBeCloseTo(proportionalRatio, 2)
    }
    for (const [smallPart, mediumPart] of [
      [smallCurrent, mediumCurrent],
      [smallFlare, mediumFlare],
    ] as const) {
      await expect(blurRadius(smallPart) / blurRadius(mediumPart)).toBeCloseTo(
        proportionalRatio,
        2,
      )
    }
    const smallCurrentPosition = relativeEffectGeometry(
      smallCurrent,
      smallLiquid,
    )
    const mediumCurrentPosition = relativeEffectGeometry(
      mediumCurrent,
      mediumLiquid,
    )
    for (const [smallValue, mediumValue] of [
      [smallCurrentPosition.insetTop, mediumCurrentPosition.insetTop],
      [smallCurrentPosition.offsetLeft, mediumCurrentPosition.offsetLeft],
    ]) {
      // Transformed effect bounds are sub-pixel rounded by Chromium;
      // one decimal still distinguishes proportional geometry from a fixed value.
      await expect(smallValue / mediumValue).toBeCloseTo(proportionalRatio, 1)
    }
    await expect(
      Number.parseFloat(getComputedStyle(smallTrack).borderRadius) /
        Number.parseFloat(getComputedStyle(mediumTrack).borderRadius),
    ).toBeCloseTo(proportionalRatio, 2)

    const smallRestingWidth = smallThumb.getBoundingClientRect().width
    await userEvent.pointer({ keys: "[MouseLeft>]", target: smallThumb })
    await waitFor(() =>
      expect(smallThumb.getBoundingClientRect().width).toBeCloseTo(
        smallRestingWidth * 1.1,
        1,
      ),
    )
    releaseActivePointer(smallThumb)

    const mediumRestingWidth = mediumThumb.getBoundingClientRect().width
    await userEvent.pointer({ keys: "[MouseLeft>]", target: mediumThumb })
    await waitFor(() =>
      expect(mediumThumb.getBoundingClientRect().width).toBeCloseTo(
        mediumRestingWidth * 1.1,
        1,
      ),
    )
    releaseActivePointer(mediumThumb)

    const composedContent = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-thinking-content"]',
    )!
    await waitFor(() => expect(composedContent).toBeInTheDocument())
    await expect(
      composedContent.querySelector('[data-slot="model-thinking-slider"]'),
    ).toHaveAttribute("data-size", "md")
  },
}

export const RtlSoftDetents: Story = {
  parameters: storyDocumentation(
    "RTL mirrors pointer geometry and horizontal keyboard movement while retaining the same continuous drag and soft checkpoint contract.",
  ),
  render: () => <RtlSliderExample />,
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole("slider", {
      name: "Thinking level",
    })
    const track = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const trackRect = track.getBoundingClientRect()
    const y = trackRect.top + trackRect.height / 2

    await expect(getComputedStyle(slider).direction).toBe("rtl")
    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: track,
      coords: {
        clientX: trackRect.left + 1,
        clientY: y,
      },
    })
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuetext", "Ultra"))
    await expect(slider).toHaveAttribute("data-detent", "true")
    await verifyUltraStream(canvasElement)
    fireEvent.blur(canvasElement.ownerDocument.defaultView!)
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    await expect(slider).toHaveAttribute("aria-valuetext", "Ultra")

    const ultraCenter =
      slider.getBoundingClientRect().left + slider.getBoundingClientRect().width / 2
    slider.focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(slider).toHaveAttribute("aria-valuetext", "Extra High")
    const extraHighCenter =
      slider.getBoundingClientRect().left + slider.getBoundingClientRect().width / 2
    await expect(extraHighCenter).toBeGreaterThan(ultraCenter)
    await userEvent.keyboard("{PageDown}")
    await expect(slider).toHaveAttribute("aria-valuetext", "High")
  },
}

export const RtlComposedControl: Story = {
  parameters: storyDocumentation(
    "The composed control forwards explicit RTL direction through its portaled content and into slider geometry and keyboard navigation.",
  ),
  render: () => <RtlComposedControlExample />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const slider = await body.findByRole("slider", { name: "Thinking level" })
    const label = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-thinking-level-label"]',
    )!
    const beforeCenter =
      slider.getBoundingClientRect().left + slider.getBoundingClientRect().width / 2

    await expect(getComputedStyle(slider).direction).toBe("rtl")
    await expect(label).toHaveTextContent("Medium")
    slider.focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(label).toHaveTextContent("Light")
    const afterCenter =
      slider.getBoundingClientRect().left + slider.getBoundingClientRect().width / 2
    await expect(afterCenter).toBeGreaterThan(beforeCenter)
  },
}

export const CatalogChangesDuringDrag: Story = {
  parameters: storyDocumentation(
    "Changing the ordered levels catalog cancels an active pointer preview before stale positions, labels, or bounds can leak into the new catalog.",
  ),
  render: () => <MutableCatalogSliderExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    let slider = canvas.getByRole("slider", { name: "Thinking level" })

    await expect(slider).toHaveAttribute("aria-valuenow", "4")
    await userEvent.pointer({ keys: "[MouseLeft>]", target: slider })
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "true"))
    const staleShrinkSlider = slider
    const shrinkPointerId = Number(
      slider.getAttribute("data-active-pointer-id"),
    )
    fireEvent.click(canvas.getByRole("button", { name: "Shrink catalog" }))
    slider = canvas.getByRole("slider", { name: "Thinking level" })
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    await expect(slider).toHaveAttribute("aria-valuemax", "1")
    await expect(Number(slider.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(1)
    await expect(slider).toHaveAttribute("aria-valuetext", "Light")
    fireEvent.pointerMove(staleShrinkSlider, {
      clientX: staleShrinkSlider.getBoundingClientRect().right,
      pointerId: shrinkPointerId,
    })
    await expect(slider).toHaveAttribute("aria-valuetext", "Light")
    fireEvent.pointerUp(staleShrinkSlider, { pointerId: shrinkPointerId })

    slider.focus()
    await expect(slider).toHaveFocus()
    fireEvent.click(canvas.getByRole("button", { name: "Reset catalog" }))
    slider = canvas.getByRole("slider", { name: "Thinking level" })
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "4"))
    await expect(slider).toHaveFocus()
    await userEvent.pointer({ keys: "[MouseLeft>]", target: slider })
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "true"))
    const staleReorderSlider = slider
    const reorderPointerId = Number(
      slider.getAttribute("data-active-pointer-id"),
    )
    fireEvent.click(canvas.getByRole("button", { name: "Reorder catalog" }))
    slider = canvas.getByRole("slider", { name: "Thinking level" })
    await waitFor(() => expect(slider).toHaveAttribute("data-dragging", "false"))
    await expect(slider).toHaveAttribute("aria-valuenow", "0")
    await expect(slider).toHaveAttribute("aria-valuetext", "Ultra")
    fireEvent.pointerUp(staleReorderSlider, { pointerId: reorderPointerId })
  },
}

export const LightSlider: Story = {
  parameters: storyDocumentation(
    "The compact slider remains fully token-driven in explicit Light mode.",
  ),
  globals: { theme: "light" },
  render: () => (
    <div
      data-testid="light-slider-frame"
      className="w-72 rounded-xl border border-border bg-popover p-3"
    >
      <ModelThinkingSlider
        levels={levels}
        value="ultra"
        onValueChange={() => undefined}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rootStyle = getComputedStyle(canvasElement.ownerDocument.documentElement)
    const wrapper = within(canvasElement).getByTestId("light-slider-frame")
    const track = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const thumb = within(canvasElement).getByRole("slider", {
      name: "Thinking level",
    })
    await expect(getComputedStyle(wrapper).backgroundColor).toBe(
      rootStyle.getPropertyValue("--popover").trim(),
    )
    await expect(getComputedStyle(track).backgroundColor).toBe(
      rootStyle.getPropertyValue("--muted").trim(),
    )
    await expect(getComputedStyle(thumb).backgroundColor).toBe(
      rootStyle.getPropertyValue("--foreground").trim(),
    )
  },
}

export const UltraStrength: Story = {
  parameters: storyDocumentation(
    "Ultra keeps a constant violet-to-cyan fill gradient while a restrained, reduced-motion-safe sheen moves continuously from right to left.",
  ),
  render: () => {
    const [value, setValue] = React.useState("ultra")
    return (
      <div className="w-72 rounded-xl border border-border bg-popover p-3">
        <ModelThinkingSlider
          levels={reorderedUltraLevels}
          value={value}
          onValueChange={setValue}
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => verifyUltraStream(canvasElement),
}

export const UltraStrengthWide: Story = {
  parameters: storyDocumentation(
    "The continuous Ultra energy stream covers the complete range even when the public slider is substantially wider than the compact composer treatment.",
  ),
  render: () => (
    <div className="w-[32rem] rounded-xl border border-border bg-popover p-3">
      <ModelThinkingSlider
        levels={levels}
        value="ultra"
        onValueChange={() => undefined}
      />
    </div>
  ),
  play: async ({ canvasElement }) => verifyUltraStream(canvasElement),
}

const streamSpeedBoundaryCases = [
  { name: "maximum-finite", multiplier: Number.MAX_VALUE, expected: 4 },
  { name: "not-a-number", multiplier: Number.NaN, expected: 1 },
  { name: "positive-infinity", multiplier: Number.POSITIVE_INFINITY, expected: 1 },
  { name: "zero", multiplier: 0, expected: 1 },
  { name: "negative", multiplier: -1, expected: 1 },
]

export const StreamSpeedBoundaries: Story = {
  parameters: storyDocumentation(
    "The reusable stream-speed input clamps extreme finite values and safely falls back for non-finite or non-positive values.",
  ),
  render: () => (
    <div className="space-y-2">
      {streamSpeedBoundaryCases.map(({ name, multiplier }) => (
        <div key={name} data-stream-speed-case={name} className="w-72">
          <ModelThinkingSlider
            levels={levels}
            value="ultra"
            onValueChange={() => undefined}
            streamSpeedMultiplier={multiplier}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      reducedMotionQuery,
    ).matches
    for (const { name, expected } of streamSpeedBoundaryCases) {
      const wrapper = canvasElement.querySelector<HTMLElement>(
        `[data-stream-speed-case="${name}"]`,
      )!
      const stream = wrapper.querySelector<HTMLElement>(
        '[data-slot="model-thinking-slider-ultra-stream"]',
      )!
      if (reducedMotion) {
        await expect(stream.getAnimations()).toHaveLength(0)
        continue
      }
      await waitFor(() => expect(stream.getAnimations()).toHaveLength(1))
      const playbackRate = stream.getAnimations()[0]!.playbackRate
      await expect(Number.isFinite(playbackRate)).toBe(true)
      await expect(playbackRate).toBeCloseTo(expected / 0.27, 2)
    }
  },
}

export const NonUltraLast: Story = {
  parameters: storyDocumentation(
    "A non-Ultra last level carries substantial ordinal tension but remains slower and quieter than an explicitly accented Ultra launch.",
  ),
  render: () => (
    <div className="w-72 rounded-xl border border-border bg-popover p-3">
      <ModelThinkingSlider
        levels={nonUltraLevels}
        value="medium"
        onValueChange={() => undefined}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole("slider", {
      name: "Thinking level",
    })
    const liquid = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-liquid"]',
    )!
    const stream = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream"]',
    )!
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      reducedMotionQuery,
    ).matches
    const rootStyle = getComputedStyle(canvasElement.ownerDocument.documentElement)
    await expect(slider).toHaveAttribute("aria-valuetext", "Medium")
    await expect(getComputedStyle(liquid).backgroundColor).toBe(
      rootStyle.getPropertyValue("--nessa-thinking-fill-base").trim(),
    )
    await expect(stream).toHaveAttribute("data-energy", "0.72")
    await expect(Number.parseFloat(getComputedStyle(stream).opacity)).toBeLessThan(1)
    if (reducedMotion) {
      await expect(stream.getAnimations()).toHaveLength(0)
    } else {
      let animation: Animation | undefined
      await waitFor(() => {
        animation = stream.getAnimations()[0]
        expect(animation).toBeDefined()
      })
      await expect(animation!.playbackRate).toBeLessThan(1 / 0.27)
    }
  },
}

export const SingleUltra: Story = {
  parameters: storyDocumentation(
    "A single explicitly accented Ultra level still owns the Ultra stream even though it has no ordinal siblings.",
  ),
  render: () => (
    <div className="w-72 rounded-xl border border-border bg-popover p-3">
      <ModelThinkingSlider
        levels={singleUltraLevel}
        value="ultra"
        onValueChange={() => undefined}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole("slider", {
      name: "Thinking level",
    })
    const track = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const range = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-range"]',
    )!
    const liquid = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-liquid"]',
    )!
    const stream = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream"]',
    )!
    const firstStreamPeriod = stream.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream-period"]',
    )!
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    await expect(range.getBoundingClientRect().width).toBeCloseTo(
      track.clientWidth,
      1,
    )
    await expect(liquid.getBoundingClientRect().width).toBeGreaterThan(0)
    await expect(firstStreamPeriod.getBoundingClientRect().width).toBeCloseTo(
      range.getBoundingClientRect().width,
      1,
    )
    await expect(slider).toHaveAttribute("aria-disabled", "true")
    await expect(slider).toHaveAttribute("aria-valuemin", "0")
    await expect(slider).toHaveAttribute("aria-valuemax", "0")
    await expect(slider).toHaveAttribute("aria-valuenow", "0")
    await expect(slider).toHaveAttribute("aria-valuetext", "Ultra")
    if (reducedMotion) {
      await expect(stream.getAnimations()).toHaveLength(0)
    } else {
      await waitFor(() => expect(stream.getAnimations()).toHaveLength(1))
    }
  },
}

export const LiveReducedMotionPreference: Story = {
  parameters: storyDocumentation(
    "An active Ultra stream stops immediately when reduced motion is enabled and resumes only when motion is allowed again.",
  ),
  render: () => <LiveMotionPreferenceExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const stream = canvasElement.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream"]',
    )!

    if (stream.getAnimations().length === 0) {
      await userEvent.click(canvas.getByRole("button", { name: "Allow motion" }))
    }
    await waitFor(() => expect(stream.getAnimations()).toHaveLength(1))
    await expect(stream.getAnimations()[0]!.playbackRate).toBeCloseTo(
      1 / 0.27,
      2,
    )

    await userEvent.click(canvas.getByRole("button", { name: "Reduce motion" }))
    await waitFor(() => expect(stream.getAnimations()).toHaveLength(0))

    await userEvent.click(canvas.getByRole("button", { name: "Allow motion" }))
    await waitFor(() => expect(stream.getAnimations()).toHaveLength(1))
    await expect(stream.getAnimations()[0]!.playbackRate).toBeCloseTo(
      1 / 0.27,
      2,
    )
  },
}

export const EmptySlider: Story = {
  parameters: storyDocumentation(
    "An empty disabled slider cannot enter its dragging visual state.",
  ),
  render: () => (
    <div className="w-72 rounded-xl border border-border bg-popover p-3">
      <ModelThinkingSlider
        levels={[]}
        value=""
        onValueChange={() => undefined}
        unavailableText="Indisponible"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole("slider", {
      name: "Thinking level",
    })
    await expect(slider).toHaveAttribute("data-disabled")
    await expect(slider).toHaveAttribute("aria-disabled", "true")
    await expect(slider).toHaveAttribute("aria-valuemin", "0")
    await expect(slider).toHaveAttribute("aria-valuemax", "0")
    await expect(slider).toHaveAttribute("aria-valuenow", "0")
    await expect(slider).toHaveAttribute("aria-valuetext", "Indisponible")
    await expect(getComputedStyle(slider).pointerEvents).toBe("none")
    await expect(getComputedStyle(slider).cursor).toBe("default")
    await expect(slider).toHaveAttribute("data-dragging", "false")
    await expect(slider.getBoundingClientRect().width).toBe(30)
  },
}

export const FastOnly: Story = {
  parameters: storyDocumentation(
    "Fast remains available as a standalone fallback for models that support Fast but expose no thinking levels.",
  ),
  render: () => {
    const [fast, setFast] = React.useState(false)
    const [consumerClicks, setConsumerClicks] = React.useState(0)
    const [submitted, setSubmitted] = React.useState(false)
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setSubmitted(true)
        }}
      >
        <ModelFastMode
          aria-label="Accelerated mode"
          icon={({ pressed }) => (
            <FastIcon active={pressed} className="size-4.5" />
          )}
          pressed={fast}
          onPressedChange={setFast}
          onClick={() => setConsumerClicks((count) => count + 1)}
        />
        <output>{`clicks:${consumerClicks};submitted:${submitted}`}</output>
      </form>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const fast = canvas.getByRole("button", { name: "Accelerated mode" })
    const icon = fast.querySelector<SVGElement>("svg")!
    const inactiveColor = getComputedStyle(fast).color
    await expect(icon).toHaveAttribute("fill", "currentColor")
    await expect(icon).toHaveAttribute("data-nucleo-icon", "fast")
    const hitTarget = fast.getBoundingClientRect()
    const tokenProbe = canvasElement.ownerDocument.createElement("span")
    tokenProbe.style.color = "var(--nessa-fast-mode-active)"
    canvasElement.append(tokenProbe)
    const expectedActiveColor = getComputedStyle(tokenProbe).color
    tokenProbe.remove()
    await expect(hitTarget.width).toBeGreaterThanOrEqual(32)
    await expect(hitTarget.height).toBeGreaterThanOrEqual(32)
    await expect(
      fast.querySelector('[data-slot="model-fast-mode-surface"]'),
    ).not.toBeInTheDocument()
    await expect(getComputedStyle(fast).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
    await userEvent.hover(fast)
    await expect(getComputedStyle(fast).color).toBe(inactiveColor)
    await expect(getComputedStyle(fast).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
    await userEvent.unhover(fast)
    await userEvent.click(fast)
    await expect(fast).toHaveAttribute("aria-pressed", "true")
    await expect(icon).toHaveAttribute("data-active", "true")
    await waitFor(() =>
      expect(getComputedStyle(icon).scale).not.toBe("none"),
    )
    await expect(fast).toHaveAttribute("type", "button")
    await waitFor(() => expect(icon).toHaveAttribute("fill", "currentColor"))
    await waitFor(() =>
      expect(getComputedStyle(fast).color).toBe(expectedActiveColor),
    )
    await expect(getComputedStyle(fast).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
    await userEvent.unhover(fast)
    const activeColor = getComputedStyle(fast).color
    await userEvent.hover(fast)
    await expect(getComputedStyle(fast).color).toBe(activeColor)
    await expect(getComputedStyle(fast).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
    await expect(canvas.getByText("clicks:1;submitted:false")).toBeVisible()
    await userEvent.click(fast)
    await expect(icon).toHaveAttribute("data-active", "false")
    await waitFor(() => expect(getComputedStyle(icon).scale).toBe("none"))
    await waitFor(() => expect(icon).toHaveAttribute("fill", "currentColor"))
    await waitFor(() => expect(getComputedStyle(fast).color).toBe(inactiveColor))
    await expect(canvas.getByText("clicks:2;submitted:false")).toBeVisible()
  },
}

export const UnavailableThinking: Story = {
  parameters: storyDocumentation(
    "An empty thinking catalog stays closed even when a controlled host requests open state.",
  ),
  args: { levels: [], open: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "Thinking levels unavailable" }),
    ).toBeDisabled()
    await expect(
      canvasElement.ownerDocument.querySelector(
        '[data-slot="model-thinking-content"]',
      ),
    ).not.toBeInTheDocument()
  },
}

export const UncontrolledAvailabilityTransition: Story = {
  parameters: storyDocumentation(
    "An uncontrolled open control closes when its catalog becomes unavailable and stays closed when levels return.",
  ),
  render: () => {
    const [availableLevels, setAvailableLevels] = React.useState(levels)
    const [openChanges, setOpenChanges] = React.useState<string[]>([])
    return (
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAvailableLevels([])}>
          Remove levels
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAvailableLevels(levels)}>
          Restore levels
        </Button>
        <ModelThinkingControl
          levels={availableLevels}
          defaultOpen
          onOpenChange={(open) =>
            setOpenChanges((changes) => [...changes, String(open)])
          }
        />
        <output>{openChanges.join(",")}</output>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ownerDocument = canvasElement.ownerDocument

    await expect(
      ownerDocument.querySelector('[data-slot="model-thinking-content"]'),
    ).toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "Remove levels" }))
    await waitFor(() =>
      expect(
        ownerDocument.querySelector('[data-slot="model-thinking-content"]'),
      ).not.toBeInTheDocument(),
    )
    await expect(canvas.getByText("false")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Restore levels" }))
    await expect(
      ownerDocument.querySelector('[data-slot="model-thinking-content"]'),
    ).not.toBeInTheDocument()
    await expect(canvas.getByText("false")).toBeVisible()
  },
}
