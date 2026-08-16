import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  SplitView,
  SplitViewOrientation,
  SplitViewPanel,
  SplitViewSeparator,
  type SplitViewLayout,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/SplitView",
  component: SplitView,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "SplitView arranges panels along one axis with accessible, keyboard-operable separators between them. The group is persistence-free: it renders the layout it is given (controlled) or keeps a transient one locally (uncontrolled), reports every change through onLayoutChange, and announces settled gestures through onLayoutCommit so applications can persist layouts without the components ever owning storage. Panel constraints accept percentages or pixels and are re-resolved whenever the group resizes.",
      },
    },
  },
} satisfies Meta<typeof SplitView>

export default meta
type Story = StoryObj<typeof meta>

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function StoryFrame({
  children,
  tall = false,
}: {
  children: React.ReactNode
  tall?: boolean
}) {
  return (
    <div
      className={`${tall ? "h-80" : "h-56"} w-full overflow-hidden rounded-lg border border-border bg-background`}
    >
      {children}
    </div>
  )
}

export const TwoPanels: Story = {
  parameters: storyDocumentation(
    "The minimal composition: two panels and one separator. Drag the separator, or focus it and press the arrow keys, Home, or End.",
  ),
  render: () => (
    <StoryFrame>
      <SplitView>
        <SplitViewPanel id="two-start">
          <PanelLabel>Start</PanelLabel>
        </SplitViewPanel>
        <SplitViewSeparator />
        <SplitViewPanel id="two-end">
          <PanelLabel>End</PanelLabel>
        </SplitViewPanel>
      </SplitView>
    </StoryFrame>
  ),
}

export const Vertical: Story = {
  parameters: storyDocumentation(
    "Stack panels with the vertical orientation; separators become horizontal rows and respond to the up and down arrow keys.",
  ),
  render: () => (
    <StoryFrame tall>
      <SplitView orientation={SplitViewOrientation.Vertical}>
        <SplitViewPanel id="vertical-top">
          <PanelLabel>Top</PanelLabel>
        </SplitViewPanel>
        <SplitViewSeparator />
        <SplitViewPanel id="vertical-bottom">
          <PanelLabel>Bottom</PanelLabel>
        </SplitViewPanel>
      </SplitView>
    </StoryFrame>
  ),
}

export const NestedGroups: Story = {
  parameters: storyDocumentation(
    "Nest a SplitView inside a panel to split in both axes. Each group owns its own layout, so nesting composes without configuration.",
  ),
  render: () => (
    <StoryFrame tall>
      <SplitView>
        <SplitViewPanel id="nested-side" minSize="120px" maxSize="50%">
          <PanelLabel>Navigator</PanelLabel>
        </SplitViewPanel>
        <SplitViewSeparator />
        <SplitViewPanel id="nested-main">
          <SplitView orientation={SplitViewOrientation.Vertical}>
            <SplitViewPanel id="nested-editor">
              <PanelLabel>Editor</PanelLabel>
            </SplitViewPanel>
            <SplitViewSeparator />
            <SplitViewPanel id="nested-console" minSize="64px">
              <PanelLabel>Console</PanelLabel>
            </SplitViewPanel>
          </SplitView>
        </SplitViewPanel>
      </SplitView>
    </StoryFrame>
  ),
}

export const CollapsiblePanel: Story = {
  parameters: storyDocumentation(
    "A collapsible panel snaps closed once a drag passes the halfway point below its minimum size, and snaps open the same way. Press Enter on the separator to toggle the collapse from the keyboard.",
  ),
  render: () => (
    <StoryFrame>
      <SplitView>
        <SplitViewPanel
          id="collapsible-rail"
          collapsible
          collapsedSize="48px"
          minSize="160px"
          maxSize="40%"
          defaultSize="25%"
          className="data-collapsed:bg-muted"
        >
          <PanelLabel>Rail</PanelLabel>
        </SplitViewPanel>
        <SplitViewSeparator />
        <SplitViewPanel id="collapsible-content">
          <PanelLabel>Content</PanelLabel>
        </SplitViewPanel>
      </SplitView>
    </StoryFrame>
  ),
}

function ControlledExample() {
  const [layout, setLayout] = React.useState<SplitViewLayout>({
    "controlled-start": 30,
    "controlled-end": 70,
  })
  const [committed, setCommitted] = React.useState(0)

  return (
    <div className="flex flex-col gap-3">
      <StoryFrame>
        <SplitView
          layout={layout}
          onLayoutChange={(next) => setLayout(next)}
          onLayoutCommit={() => setCommitted((count) => count + 1)}
        >
          <SplitViewPanel id="controlled-start">
            <PanelLabel>{layout["controlled-start"].toFixed(1)}%</PanelLabel>
          </SplitViewPanel>
          <SplitViewSeparator />
          <SplitViewPanel id="controlled-end">
            <PanelLabel>{layout["controlled-end"].toFixed(1)}%</PanelLabel>
          </SplitViewPanel>
        </SplitView>
      </StoryFrame>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span data-testid="committed-count">Settled gestures: {committed}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setLayout({ "controlled-start": 30, "controlled-end": 70 })
          }
        >
          Reset layout
        </Button>
      </div>
    </div>
  )
}

export const Controlled: Story = {
  parameters: storyDocumentation(
    "The application owns the layout: state lives outside, every change flows through onLayoutChange, and onLayoutCommit marks moments worth persisting. This is the integration the design-system contract prescribes for durable layouts.",
  ),
  render: () => <ControlledExample />,
}

export const KeyboardResize: Story = {
  parameters: storyDocumentation(
    "Separators implement the ARIA window-splitter pattern: focus one and resize with the arrow keys. The reported value range accounts for every neighboring constraint.",
  ),
  render: () => (
    <StoryFrame>
      <SplitView>
        <SplitViewPanel id="keyboard-start">
          <PanelLabel>Start</PanelLabel>
        </SplitViewPanel>
        <SplitViewSeparator aria-label="Resize keyboard demo panels" />
        <SplitViewPanel id="keyboard-end">
          <PanelLabel>End</PanelLabel>
        </SplitViewPanel>
      </SplitView>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const separator = await canvas.findByRole("separator", {
      name: "Resize keyboard demo panels",
    })

    await waitFor(() =>
      expect(separator).toHaveAttribute("aria-valuenow", "50"),
    )

    separator.focus()
    await userEvent.keyboard("{ArrowRight}")

    await waitFor(() =>
      expect(separator).toHaveAttribute("aria-valuenow", "55"),
    )

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")

    await waitFor(() =>
      expect(separator).toHaveAttribute("aria-valuenow", "45"),
    )

    await userEvent.keyboard("{Home}")

    await waitFor(() => expect(separator).toHaveAttribute("aria-valuenow", "0"))
  },
}

export const PointerResize: Story = {
  parameters: storyDocumentation(
    "Pointer resizing captures the pointer on the separator itself and measures every move against the gesture's starting layout, so clamped drags never drift.",
  ),
  render: () => (
    <StoryFrame>
      <SplitView>
        <SplitViewPanel id="pointer-start" minSize="10%">
          <PanelLabel>Start</PanelLabel>
        </SplitViewPanel>
        <SplitViewSeparator aria-label="Resize pointer demo panels" />
        <SplitViewPanel id="pointer-end" minSize="10%">
          <PanelLabel>End</PanelLabel>
        </SplitViewPanel>
      </SplitView>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const separator = await canvas.findByRole("separator", {
      name: "Resize pointer demo panels",
    })

    await waitFor(() =>
      expect(separator).toHaveAttribute("aria-valuenow", "50"),
    )

    const from = separator.getBoundingClientRect()
    const startX = from.x + from.width / 2
    const startY = from.y + from.height / 2

    separator.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: startX,
        clientY: startY,
      }),
    )
    separator.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: startX + 80,
        clientY: startY,
      }),
    )
    separator.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: startX + 80,
        clientY: startY,
      }),
    )

    await waitFor(() => {
      const valueNow = Number(separator.getAttribute("aria-valuenow"))
      expect(valueNow).toBeGreaterThan(50)
    })

    const startPanel = canvasElement.querySelector<HTMLElement>("#pointer-start")
    expect(startPanel).not.toBeNull()
    await waitFor(() =>
      expect(
        Number.parseFloat(getComputedStyle(startPanel!).flexGrow),
      ).toBeGreaterThan(50),
    )
  },
}
