import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerAttachment,
  ChatComposerAttachments,
  ChatComposerFooter,
  ChatComposerInput,
  ChatComposerSubmit,
  ChatComposerTrigger,
  ModelPicker,
  ModelThinkingControl,
  SectionedListbox,
  type ChatComposerAttachmentKind,
  type ChatComposerBorderMode,
  type ModelPickerGroup,
  type ModelPickerValue,
} from "@nessa-ui/react"
import { Mic, Plus, Shield } from "lucide-react"

import { storyDocumentation } from "./story-documentation"
import {
  filterSlashSections,
  mentionSections,
  renderSlashItem,
  renderTeammate,
} from "./composer-demo-data"
import { KimiModelIcon } from "./icons/model/kimi-model-icon"
import { FastIcon, ThinkingIcon } from "./icons/nucleo"

function ModelAsset({ name, invert = false }: { name: string; invert?: boolean }) {
  // TODO(SRC-002): move this inversion variant to the provider-scoped theme selector when it lands.
  return (
    <img
      src={`/model-icons/${name}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={invert ? "size-4 dark:invert" : "size-4"}
    />
  )
}

const groups: ModelPickerGroup[] = [
  {
    id: "openai",
    label: "OpenAI",
    shortLabel: "OpenAI",
    icon: <ModelAsset name="openai" invert />,
    models: [
      {
        id: "sol",
        label: "5.6 Sol",
        icon: <ModelAsset name="openai" invert />,
      },
      {
        id: "terra",
        label: "5.6 Terra",
        icon: <ModelAsset name="openai" invert />,
      },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    shortLabel: "Kimi",
    icon: <KimiModelIcon />,
    models: [
      {
        id: "kimi-k3",
        label: "Kimi K3",
        icon: <KimiModelIcon />,
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    shortLabel: "Claude",
    icon: <ModelAsset name="claude-color" />,
    models: [
      {
        id: "sonnet",
        label: "Sonnet",
        icon: <ModelAsset name="claude-color" />,
      },
    ],
  },
]

const thinkingLevels = [
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

function ComposerExample({
  size = "default",
  loading = false,
  borderMode,
  composerWidth,
  composerMaxHeight,
  composerStyle,
  initialMessage = "",
}: {
  size?: "default" | "compact"
  loading?: boolean
  borderMode?: ChatComposerBorderMode
  composerWidth?: number
  composerMaxHeight?: number
  composerStyle?: React.CSSProperties
  initialMessage?: string
}) {
  const [message, setMessage] = React.useState(initialMessage)
  const [submitted, setSubmitted] = React.useState("")
  const [model, setModel] = React.useState<ModelPickerValue>({
    providerId: "openai",
    modelId: "sol",
  })
  const [fastMode, setFastMode] = React.useState(false)
  const [thinking, setThinking] = React.useState("light")

  return (
    <div
      data-slot="chat-composer-demo-frame"
      className="grid min-w-0 w-[min(60rem,calc(100vw-2rem))] gap-3 rounded-[2rem] bg-background p-2 sm:p-8"
    >
      {submitted ? (
        <p role="status" className="text-sm text-muted-foreground">
          Sent: {submitted}
        </p>
      ) : null}
      <ChatComposer
        borderMode={borderMode}
        width={composerWidth}
        maxHeight={composerMaxHeight}
        style={composerStyle}
        size={size}
        onSubmit={(event) => {
          event.preventDefault()
          if (!message.trim()) return
          setSubmitted(message.trim())
          setMessage("")
        }}
      >
        <ChatComposerInput
          maxHeight={composerMaxHeight === undefined ? undefined : 480}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Do anything"
        />
        <ChatComposerFooter>
          <ChatComposerActions>
            <ChatComposerAction aria-label="Add attachment" title="Add attachment">
              <Plus aria-hidden="true" />
            </ChatComposerAction>
            <ChatComposerAction aria-label="Configure access">
              <Shield aria-hidden="true" />
            </ChatComposerAction>
          </ChatComposerActions>
          <ChatComposerActions className="justify-end">
            <ModelPicker
              groups={groups}
              value={model}
              onValueChange={setModel}
            />
            <ModelThinkingControl
              icon={<ThinkingIcon className="size-[18px]" />}
              levels={thinkingLevels}
              value={thinking}
              onValueChange={setThinking}
              fastMode={{
                pressed: fastMode,
                onPressedChange: setFastMode,
                icon: ({ pressed }) => (
                  <FastIcon active={pressed} className="size-[18px]" />
                ),
              }}
            />
            <ChatComposerAction aria-label="Start voice input" title="Start voice input">
              <Mic aria-hidden="true" />
            </ChatComposerAction>
            <ChatComposerSubmit disabled={!message.trim()} loading={loading} />
          </ChatComposerActions>
        </ChatComposerFooter>
      </ChatComposer>
    </div>
  )
}

async function verifyComposerThemeSurfaces(
  canvasElement: HTMLElement,
) {
  const rootStyle = getComputedStyle(canvasElement.ownerDocument.documentElement)
  const frame = canvasElement.querySelector<HTMLElement>(
    '[data-slot="chat-composer-demo-frame"]',
  )!
  const composer = canvasElement.querySelector<HTMLElement>(
    '[data-slot="chat-composer"]',
  )!
  const input = canvasElement.querySelector<HTMLElement>(
    '[data-slot="chat-composer-input"]',
  )!

  await expect(getComputedStyle(frame).backgroundColor).toBe(
    rootStyle.getPropertyValue("--background").trim(),
  )
  await expect(getComputedStyle(composer).backgroundColor).toBe(
    rootStyle.getPropertyValue("--card").trim(),
  )
  await expect(getComputedStyle(input).backgroundColor).toBe("rgba(0, 0, 0, 0)")
}

const meta = {
  title: "Components/ChatComposer",
  component: ChatComposer,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A compound chat-entry surface built from input, footer, action, and submit primitives, plus opt-in attachment capabilities: a stacked attachments-row of pills, paste-to-attachment capture, and key-triggered menus (such as / and @) that anchor host-supplied content above the composer. Pair it with ChatComposerEditor for inline chip attachments, and compose it with ModelPicker or application-owned controls without moving message, upload, voice, or runtime state into the design system.",
      },
    },
  },
} satisfies Meta<typeof ChatComposer>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "Enter submits by default, while Shift+Enter inserts a line break. The host owns the message value and submit effect.",
  ),
  render: () => <ComposerExample />,
  play: async ({ canvasElement }) => {
    await verifyComposerThemeSurfaces(canvasElement)
    const canvas = within(canvasElement)
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const input = canvas.getByRole("textbox", { name: "Message" })
    await expect(composer).toHaveAttribute("data-border-mode", "none")
    await userEvent.click(input)
    await expect(getComputedStyle(composer).borderTopColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
    await userEvent.type(input, "Build the composer{enter}")
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Sent: Build the composer",
    )
    await expect(input).toHaveValue("")
    const body = within(canvasElement.ownerDocument.body)
    const thinkingControl = canvas.getByRole("button", {
      name: "Thinking level: Light",
    })
    const thinkingIcon = thinkingControl.querySelector("svg")!
    await expect(thinkingIcon.getBoundingClientRect().width).toBe(18)
    await userEvent.click(
      canvas.getByRole("button", { name: "Change model, currently 5.6 Sol" }),
    )
    await userEvent.click(body.getByRole("option", { name: /5\.6 Terra/ }))
    await expect(thinkingControl).toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "Fast mode" }),
    ).not.toBeInTheDocument()
    await userEvent.click(thinkingControl)
    const fastMode = body.getByRole("button", { name: "Fast mode" })
    await userEvent.click(fastMode)
    await expect(fastMode).toHaveAttribute("aria-pressed", "true")
    const slider = body.getByRole("slider", { name: "Thinking level" })
    slider.focus()
    await expect(slider).toHaveAttribute("aria-valuemin", "0")
    await expect(slider).toHaveAttribute("aria-valuemax", "4")
    await expect(slider).toHaveAttribute("aria-valuetext", "Light")
    await userEvent.keyboard("{ArrowRight}")
    await expect(slider).toHaveAttribute("aria-valuetext", "Medium")
    await userEvent.keyboard("{ArrowRight}")
    await expect(slider).toHaveAttribute("aria-valuetext", "High")
    await userEvent.keyboard("{ArrowRight}")
    await expect(slider).toHaveAttribute("aria-valuetext", "Extra High")
    await userEvent.keyboard("{ArrowRight}")
    await expect(slider).toHaveAttribute("aria-valuetext", "Ultra")
    const ultraStream = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="model-thinking-slider-ultra-stream"]',
    )!
    const track = ultraStream.closest<HTMLElement>(
      '[data-slot="model-thinking-slider-track"]',
    )!
    const range = ultraStream.closest<HTMLElement>(
      '[data-slot="model-thinking-slider-range"]',
    )!
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    if (reducedMotion) {
      await expect(ultraStream.getAnimations()).toHaveLength(0)
    } else {
      let animation: Animation | undefined
      await waitFor(() => {
        animation = ultraStream.getAnimations()[0]
        expect(animation).toBeDefined()
      })
      await waitFor(() => {
        const trackStyle = getComputedStyle(track)
        const trackContentWidth =
          track.getBoundingClientRect().width -
          Number.parseFloat(trackStyle.borderLeftWidth) -
          Number.parseFloat(trackStyle.borderRightWidth)
        expect(range.getBoundingClientRect().width).toBeGreaterThanOrEqual(
          trackContentWidth,
        )
      })
      animation!.pause()
      const timing = animation!.effect!.getTiming()
      const duration = Number(timing.duration)
      const streamPeriods = Array.from(
        ultraStream.querySelectorAll<HTMLElement>(
          '[data-slot="model-thinking-slider-ultra-stream-period"]',
        ),
      )
      await expect(streamPeriods).toHaveLength(2)
      await expect(streamPeriods[0]!.getBoundingClientRect().width).toBeCloseTo(
        range.getBoundingClientRect().width,
        1,
      )
      await expect(Number(timing.delay)).toBe(0)
      await expect(timing.iterations).toBe(Infinity)
      animation!.currentTime = duration * 0.2
      const rightPosition = ultraStream.getBoundingClientRect().left
      animation!.currentTime = duration * 0.7
      await expect(ultraStream.getBoundingClientRect().left).toBeLessThan(
        rightPosition,
      )
      animation!.play()
    }
  },
}

export const Compact: Story = {
  parameters: storyDocumentation(
    "Compact reduces vertical geometry for docked or floating chat surfaces while preserving the same slots and behavior.",
  ),
  render: () => <ComposerExample size="compact" />,
}

export const ConfiguredWidth: Story = {
  parameters: storyDocumentation(
    "width sets the preferred composer inline size while max-width preserves containment inside narrower hosts.",
  ),
  render: () => <ComposerExample composerWidth={560} />,
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer-demo-frame"]',
    )!
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const frameRect = frame.getBoundingClientRect()
    const composerRect = composer.getBoundingClientRect()

    await expect(composer.style.width).toBe("min(560px, 100%)")
    await expect(composerRect.width).toBe(560)
    await expect(composerRect.left).toBeGreaterThanOrEqual(frameRect.left)
    await expect(composerRect.right).toBeLessThanOrEqual(frameRect.right)
  },
}

export const ConfiguredWidthNarrow: Story = {
  parameters: {
    ...storyDocumentation(
      "A configured width remains preferred rather than mandatory, so max-width keeps the composer inside a 280px host.",
    ),
    ...responsiveViewport(280),
  },
  render: () => <ComposerExample composerWidth={560} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.ownerDocument.defaultView?.innerWidth).toBe(280)
    const frame = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer-demo-frame"]',
    )!
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const frameRect = frame.getBoundingClientRect()
    const composerRect = composer.getBoundingClientRect()

    await expect(composer.style.width).toBe("min(560px, 100%)")
    await expect(composerRect.width).toBeLessThanOrEqual(frameRect.width)
    await expect(composerRect.left).toBeGreaterThanOrEqual(frameRect.left)
    await expect(composerRect.right).toBeLessThanOrEqual(frameRect.right)
    await expect(composer.scrollWidth).toBeLessThanOrEqual(composer.clientWidth)
  },
}

export const WidthStylePrecedence: Story = {
  parameters: storyDocumentation(
    "Native style.width remains an escape hatch, while the dedicated numeric width prop takes precedence and supplies responsive containment.",
  ),
  render: () => (
    <div className="grid gap-3">
      <ComposerExample composerStyle={{ width: 420 }} />
      <ComposerExample composerWidth={560} composerStyle={{ width: 420 }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const composers = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="chat-composer"]',
      ),
    )

    await expect(composers[0]?.style.width).toBe("420px")
    await expect(composers[0]?.getBoundingClientRect().width).toBe(420)
    await expect(composers[1]?.style.width).toBe("min(560px, 100%)")
    await expect(composers[1]?.getBoundingClientRect().width).toBe(560)
  },
}

export const CappedHeight: Story = {
  parameters: storyDocumentation(
    "maxHeight caps the complete composer while the input becomes the scrolling region and the footer remains visible.",
  ),
  render: () => (
    <ComposerExample
      composerMaxHeight={180}
      initialMessage={Array.from(
        { length: 18 },
        (_, index) => `Line ${index + 1}`,
      ).join("\n")}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const footer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer-footer"]',
    )!
    const input = canvas.getByRole("textbox", { name: "Message" })
    const composerRect = composer.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()

    await expect(composerRect.height).toBeLessThanOrEqual(180)
    await expect(footerRect.bottom).toBeLessThanOrEqual(composerRect.bottom)
    await expect(input.scrollHeight).toBeGreaterThan(input.clientHeight)
    await expect(getComputedStyle(input).overflowY).toBe("auto")
  },
}

function cappedHeightFloorPlay(
  expectedViewportWidth?: 280 | 240,
): NonNullable<Story["play"]> {
  return async ({ canvasElement }) => {
    if (expectedViewportWidth !== undefined) {
      await expect(canvasElement.ownerDocument.defaultView?.innerWidth).toBe(
        expectedViewportWidth,
      )
    }
    const composers = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="chat-composer"]',
      ),
    )
    for (const composer of composers) {
      const footer = composer.querySelector<HTMLElement>(
        '[data-slot="chat-composer-footer"]',
      )!
      const composerRect = composer.getBoundingClientRect()
      const footerRect = footer.getBoundingClientRect()

      await expect(composerRect.height).toBeGreaterThan(40)
      await expect(footerRect.top).toBeGreaterThanOrEqual(composerRect.top)
      await expect(footerRect.bottom).toBeLessThanOrEqual(composerRect.bottom)
      await expect(composer.scrollHeight).toBeLessThanOrEqual(
        composer.clientHeight,
      )
      for (const action of footer.querySelectorAll<HTMLElement>("button")) {
        const actionRect = action.getBoundingClientRect()
        await expect(actionRect.top).toBeGreaterThanOrEqual(composerRect.top)
        await expect(actionRect.bottom).toBeLessThanOrEqual(composerRect.bottom)
        await expect(actionRect.left).toBeGreaterThanOrEqual(composerRect.left)
        await expect(actionRect.right).toBeLessThanOrEqual(composerRect.right)
      }
    }
  }
}

function CappedHeightFloorExample() {
  return (
    <div className="grid gap-3">
      <ComposerExample composerMaxHeight={40} />
      <ComposerExample composerMaxHeight={40} size="compact" />
    </div>
  )
}

export const CappedHeightFloors: Story = {
  parameters: storyDocumentation(
    "Caps below the footer-safe height yield to the footer's intrinsic size instead of clipping its controls.",
  ),
  render: () => <CappedHeightFloorExample />,
  play: cappedHeightFloorPlay(),
}

export const CappedHeightFloor280: Story = {
  parameters: {
    ...storyDocumentation(
      "At 280px, a cap below the intrinsic footer-safe height yields to the wrapped footer while the input row remains shrinkable.",
    ),
    ...responsiveViewport(280),
  },
  render: () => <CappedHeightFloorExample />,
  play: cappedHeightFloorPlay(280),
}

export const CappedHeightFloor240: Story = {
  parameters: {
    ...storyDocumentation(
      "At 240px, the intrinsic floor follows the footer's actual wrapped block-size so every action remains visible inside the composer.",
    ),
    ...responsiveViewport(240),
  },
  render: () => <CappedHeightFloorExample />,
  play: cappedHeightFloorPlay(240),
}

/* Retain the original broad story while narrow stories prove wrapping. */
export const FocusBorder: Story = {
  parameters: storyDocumentation(
    "borderMode focus reveals the composer border only while a descendant owns focus.",
  ),
  render: () => <ComposerExample borderMode="focus" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    await expect(getComputedStyle(composer).borderTopColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
    await userEvent.click(canvas.getByRole("textbox", { name: "Message" }))
    await expect(getComputedStyle(composer).borderTopColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    )
  },
}

export const AlwaysBorder: Story = {
  parameters: storyDocumentation(
    "borderMode always preserves the bordered surface treatment before and during interaction.",
  ),
  render: () => <ComposerExample borderMode="always" />,
  play: async ({ canvasElement }) => {
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    await expect(getComputedStyle(composer).borderTopColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    )
  },
}

export const KeyboardFocusWithoutBorder: Story = {
  parameters: storyDocumentation(
    "The default borderless composer keeps its outer border transparent and draws no box around the focused textarea — the caret is the input's focus indicator, since browsers apply :focus-visible to editable fields on pointer focus too. Action controls keep their visible focus outlines.",
  ),
  render: () => <ComposerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const input = canvas.getByRole("textbox", { name: "Message" })
    const attachment = canvas.getByRole("button", { name: "Add attachment" })

    await userEvent.tab()
    await expect(input).toHaveFocus()
    await expect(getComputedStyle(input).outlineStyle).toBe("none")
    await expect(getComputedStyle(input).borderTopWidth).toBe("0px")
    await expect(getComputedStyle(composer).borderTopColor).toBe(
      "rgba(0, 0, 0, 0)",
    )

    await userEvent.tab()
    await expect(attachment).toHaveFocus()
    await expect(getComputedStyle(attachment).outlineStyle).not.toBe("none")
    await expect(getComputedStyle(attachment).outlineWidth).not.toBe("0px")
    await expect(getComputedStyle(composer).borderTopColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
  },
}

function responsiveViewport(width: 400 | 320 | 280 | 240) {
  const viewportName = `composer-${width}`
  return {
    viewport: {
      defaultViewport: viewportName,
      options: {
        [viewportName]: {
          name: `Composer ${width}px`,
          styles: { width: `${width}px`, height: "700px" },
          type: "mobile" as const,
        },
      },
    },
  }
}

function responsivePlay(
  expectedViewportWidth: 400 | 320 | 280 | 240,
): NonNullable<Story["play"]> {
  return async ({ canvasElement }) => {
    await expect(canvasElement.ownerDocument.defaultView?.innerWidth).toBe(
      expectedViewportWidth,
    )
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const composerRect = composer.getBoundingClientRect()
    const frame = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer-demo-frame"]',
    )!
    const endActions = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="chat-composer-actions"]',
    )[1]!
    const endActionRect = endActions.getBoundingClientRect()
    const endControls = Array.from(endActions.children) as HTMLElement[]
    const firstControlRect = endControls[0]!.getBoundingClientRect()

    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
    await expect(composer.scrollWidth).toBeLessThanOrEqual(composer.clientWidth)
    await expect(endActions.scrollWidth).toBeLessThanOrEqual(
      endActions.clientWidth,
    )
    await expect(endActionRect.left).toBeGreaterThanOrEqual(composerRect.left)
    await expect(endActionRect.right).toBeLessThanOrEqual(composerRect.right)
    for (const control of composer.querySelectorAll<HTMLElement>(
      '[data-slot="model-picker-trigger"], [data-slot="model-fast-mode"], [data-slot="model-thinking-trigger"], [data-slot="chat-composer-submit"]',
    )) {
      const rect = control.getBoundingClientRect()
      await expect(rect.left).toBeGreaterThanOrEqual(composerRect.left)
      await expect(rect.right).toBeLessThanOrEqual(composerRect.right)
    }
    for (const control of endControls) {
      const rect = control.getBoundingClientRect()
      await expect(rect.top).toBeCloseTo(firstControlRect.top, 3)
      await expect(rect.bottom).toBeCloseTo(firstControlRect.bottom, 3)
    }
  }
}

export const Responsive400: Story = {
  parameters: {
    ...storyDocumentation(
      "At 400px, the frame yields decorative padding, action groups wrap as units, and the model trigger truncates before controls overflow.",
    ),
    ...responsiveViewport(400),
  },
  render: () => <ComposerExample />,
  play: responsivePlay(400),
}

export const NarrowCapabilities: Story = {
  parameters: {
    ...storyDocumentation(
      "At 320px, the frame yields decorative padding, action groups wrap as units, and the model trigger truncates before controls overflow.",
    ),
    ...responsiveViewport(320),
  },
  render: () => <ComposerExample />,
  play: responsivePlay(320),
}

export const Responsive280: Story = {
  parameters: {
    ...storyDocumentation(
      "At 280px, the frame yields decorative padding, action groups wrap as units, and the model trigger truncates before controls overflow.",
    ),
    ...responsiveViewport(280),
  },
  render: () => <ComposerExample />,
  play: responsivePlay(280),
}

export const Responsive240: Story = {
  parameters: {
    ...storyDocumentation(
      "At 240px, the frame yields decorative padding, action groups wrap as units, and the model trigger truncates before controls overflow.",
    ),
    ...responsiveViewport(240),
  },
  render: () => <ComposerExample />,
  play: responsivePlay(240),
}

export const Dark: Story = {
  parameters: storyDocumentation(
    "All surfaces and controls use semantic tokens and inherit dark mode from the consuming application.",
  ),
  render: () => <ComposerExample />,
  globals: { theme: "dark" },
  play: async ({ canvasElement }) =>
    verifyComposerThemeSurfaces(canvasElement),
}

export const Light: Story = {
  parameters: storyDocumentation(
    "Explicit Light mode resolves every demo and composer surface from the Light semantic palette without retaining a dark frame.",
  ),
  render: () => <ComposerExample />,
  globals: { theme: "light" },
  play: async ({ canvasElement }) =>
    verifyComposerThemeSurfaces(canvasElement),
}

export const Sending: Story = {
  parameters: storyDocumentation(
    "The submit primitive exposes a busy state without disabling the rest of the composer's independently owned controls.",
  ),
  render: () => <ComposerExample loading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.type(input, "Do not send{enter}")
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument()
    await expect(input).toHaveValue("Do not send")
    await expect(
      canvas.getByRole("button", { name: "Sending message" }),
    ).toBeDisabled()
  },
}

export const VisibleSubmitLabel: Story = {
  parameters: storyDocumentation(
    "Visible submit children provide their own accessible name unless the consumer explicitly supplies an aria-label.",
  ),
  render: () => (
    <ChatComposer className="min-h-0 w-72">
      <ChatComposerInput placeholder="Message" />
      <ChatComposerFooter>
        <span />
        <ChatComposerSubmit className="w-auto px-3">Send now</ChatComposerSubmit>
      </ChatComposerFooter>
    </ChatComposer>
  ),
  play: async ({ canvasElement }) => {
    const submit = within(canvasElement).getByRole("button", { name: "Send now" })
    await expect(submit).not.toHaveAttribute("aria-label")
  },
}

interface RowAttachment {
  id: string
  kind: ChatComposerAttachmentKind
  label: string
}

/**
 * Harness for the row-placement stories: hosts message, attachment, and
 * submitted state, stacks attachments as pills above the plain textarea
 * input, converts large pastes into pasted-text pills, and wires the `/` and
 * `@` trigger menus over the textarea surface.
 */
function RowComposerExample({
  initialAttachments = [],
  initialMessage = "",
  composerMaxHeight,
}: {
  initialAttachments?: RowAttachment[]
  initialMessage?: string
  composerMaxHeight?: number
}) {
  const [message, setMessage] = React.useState(initialMessage)
  const [attachments, setAttachments] =
    React.useState<RowAttachment[]>(initialAttachments)
  const [submitted, setSubmitted] = React.useState("")
  const nextId = React.useRef(0)

  const addAttachment = (kind: ChatComposerAttachmentKind, label: string) => {
    nextId.current += 1
    setAttachments((previous) => [
      ...previous,
      { id: `attachment-${nextId.current}`, kind, label },
    ])
  }
  const removeAttachment = (id: string) => {
    setAttachments((previous) =>
      previous.filter((attachment) => attachment.id !== id),
    )
  }

  return (
    <div
      data-slot="chat-composer-demo-frame"
      className="grid min-w-0 w-[min(60rem,calc(100vw-2rem))] gap-3 rounded-[2rem] bg-background p-2 sm:p-8"
    >
      {submitted ? (
        <p role="status" className="text-sm text-muted-foreground">
          Sent: {submitted}
        </p>
      ) : null}
      <ChatComposer
        maxHeight={composerMaxHeight}
        onSubmit={(event) => {
          event.preventDefault()
          if (!message.trim() && attachments.length === 0) return
          setSubmitted(
            [
              message.trim(),
              attachments.length > 0
                ? `(+${attachments.length} attachments)`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          )
          setMessage("")
          setAttachments([])
        }}
      >
        <ChatComposerAttachments>
          {attachments.map((attachment) => (
            <ChatComposerAttachment
              key={attachment.id}
              kind={attachment.kind}
              itemLabel={attachment.label}
              onRemove={() => removeAttachment(attachment.id)}
            >
              {attachment.label}
            </ChatComposerAttachment>
          ))}
        </ChatComposerAttachments>
        <ChatComposerInput
          maxHeight={composerMaxHeight === undefined ? undefined : 480}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onPasteAttachment={(text) =>
            addAttachment(
              "pasted-text",
              `Pasted text (${text.split("\n").length} lines)`,
            )
          }
          placeholder="Message, / for skills, @ to mention"
        />
        <ChatComposerTrigger trigger="/" label="Skills and plugins">
          {({ query, clearTrigger }) => (
            <SectionedListbox
              sections={filterSlashSections(query)}
              getItemId={(item) => item.id}
              renderItem={renderSlashItem}
              onValueChange={(_, item) => {
                clearTrigger()
                addAttachment(item.kind, item.label)
              }}
              listLabel="Skills and plugins"
              emptyMessage="No matching skills or plugins"
            />
          )}
        </ChatComposerTrigger>
        <ChatComposerTrigger trigger="@" label="Mention a teammate">
          {({ query, clearTrigger }) => (
            <SectionedListbox
              sections={mentionSections(query)}
              getItemId={(teammate) => teammate.id}
              renderItem={renderTeammate}
              onValueChange={(_, teammate) => {
                clearTrigger()
                addAttachment("mention", teammate.name)
              }}
              listLabel="Teammates"
              emptyMessage="No teammates found"
            />
          )}
        </ChatComposerTrigger>
        <ChatComposerFooter>
          <ChatComposerActions>
            <ChatComposerAction aria-label="Add attachment" title="Add attachment">
              <Plus aria-hidden="true" />
            </ChatComposerAction>
          </ChatComposerActions>
          <ChatComposerActions className="justify-end">
            <ChatComposerSubmit
              disabled={!message.trim() && attachments.length === 0}
            />
          </ChatComposerActions>
        </ChatComposerFooter>
      </ChatComposer>
    </div>
  )
}

export const Attachments: Story = {
  parameters: storyDocumentation(
    "The row placement option stacks attachments as atomic pills with kind-specific icons above the input. Trigger menus attach pills over the plain textarea too, the remove control deletes the whole pill, and Backspace at the start of the input removes the trailing pill without touching typed text.",
  ),
  render: () => (
    <RowComposerExample
      initialAttachments={[
        { id: "seed-skill", kind: "skill", label: "Skill Creator" },
        { id: "seed-plugin", kind: "plugin", label: "Linear" },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = canvasElement.ownerDocument.body
    const rootStyle = getComputedStyle(
      canvasElement.ownerDocument.documentElement,
    )
    const pills = () =>
      Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          '[data-slot="chat-composer-attachment"]',
        ),
      )
    await expect(pills()).toHaveLength(2)
    await expect(pills()[0]).toHaveAttribute("data-kind", "skill")
    await expect(pills()[1]).toHaveAttribute("data-kind", "plugin")
    for (const pill of pills()) {
      await expect(getComputedStyle(pill).backgroundColor).toBe(
        rootStyle.getPropertyValue("--accent").trim(),
      )
      await expect(pill.querySelector("svg")).not.toBeNull()
    }

    const input = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.type(input, "hello")
    await expect(input).toHaveValue("hello")

    const textarea = input as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(0, 0)
    await userEvent.keyboard("{Backspace}")
    await expect(pills()).toHaveLength(1)
    await expect(input).toHaveValue("hello")
    await expect(pills()[0]).toHaveAttribute("data-kind", "skill")

    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Skill Creator" }),
    )
    await expect(pills()).toHaveLength(0)
    await expect(input).toHaveValue("hello")

    // Trigger menus also work over the textarea surface: the token is
    // removed from the value and the selection lands as a pill.
    textarea.focus()
    textarea.setSelectionRange(5, 5)
    await userEvent.type(input, " /lin", {
      initialSelectionStart: 5,
      initialSelectionEnd: 5,
    })
    const panel = () =>
      body.querySelector<HTMLElement>(
        '[data-slot="chat-composer-trigger-panel"][data-trigger="/"]',
      )
    await waitFor(async () => expect(panel()).not.toBeNull())
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => expect(panel()).toBeNull())
    await expect(pills()).toHaveLength(1)
    await expect(pills()[0]).toHaveAttribute("data-kind", "plugin")
    await expect(input).toHaveValue("hello ")
  },
}

export const AttachmentsCappedHeight: Story = {
  parameters: storyDocumentation(
    "With maxHeight set, the attachments row caps its own height and scrolls when pills wrap, while the input remains the scrolling text region and the footer stays visible.",
  ),
  render: () => (
    <RowComposerExample
      composerMaxHeight={200}
      initialAttachments={[
        { id: "seed-1", kind: "skill", label: "Skill Creator" },
        { id: "seed-2", kind: "plugin", label: "Linear" },
        { id: "seed-3", kind: "skill", label: "Commit Helper" },
        { id: "seed-4", kind: "plugin", label: "Context Packs" },
        { id: "seed-5", kind: "mention", label: "Mira Chen" },
        { id: "seed-6", kind: "file", label: "release-notes.md" },
      ]}
      initialMessage={Array.from(
        { length: 18 },
        (_, index) => `Line ${index + 1}`,
      ).join("\n")}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const attachmentsRow = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer-attachments"]',
    )!
    const footer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer-footer"]',
    )!
    const input = canvas.getByRole("textbox", { name: "Message" })
    const composerRect = composer.getBoundingClientRect()
    const attachmentsRect = attachmentsRow.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    const inputRect = input.getBoundingClientRect()

    await expect(composerRect.height).toBeLessThanOrEqual(200)
    await expect(attachmentsRect.top).toBeGreaterThanOrEqual(composerRect.top)
    await expect(attachmentsRect.height).toBeGreaterThan(20)
    await expect(attachmentsRect.height).toBeLessThanOrEqual(96)
    await expect(inputRect.top).toBeGreaterThanOrEqual(attachmentsRect.bottom)
    await expect(inputRect.height).toBeGreaterThan(16)
    await expect(footerRect.bottom).toBeLessThanOrEqual(composerRect.bottom)
    await expect(input.scrollHeight).toBeGreaterThan(input.clientHeight)
    await expect(getComputedStyle(input).overflowY).toBe("auto")
  },
}
