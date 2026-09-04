import type * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Sidebar,
  SidebarCollapsible,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@nessalabs/ui"
import { Plus } from "lucide-react"

import { SidebarToggleIcon } from "./icons/sidebar-toggle-icon"
import {
  SidebarCatalogFrame,
  sidebarCatalogSidebarClassName,
  sidebarStoryDecorator,
  sidebarStoryRailClassName,
  type SidebarCatalogFrameProps,
} from "./sidebar-story-surface"
import { storyDocumentation } from "./story-documentation"

const primitiveDescriptions = {
  ProviderSidebarAndInset:
    "SidebarProvider coordinates controlled or uncontrolled state, application-defined shell sizing, focus, mobile portals, and an optional keyboard shortcut while Sidebar and SidebarInset establish the navigation and workspace regions.",
  Header:
    "SidebarHeader anchors controls or identity at the logical start of the sidebar.",
  Content:
    "SidebarContent owns the flexible, vertically scrollable middle region.",
  Group:
    "SidebarGroup combines an optional label and action with one related content region.",
  Footer:
    "SidebarFooter anchors account or settings affordances at the logical end.",
  Trigger:
    "SidebarTrigger changes provider state; its icon can reflect the current side, and the provider can expose the same action through an exact application-defined shortcut whose omitted modifiers are false and whose matched event is prevented by default.",
  Rail:
    "SidebarRail provides the full-height edge target for toggling without adding another visible row.",
} as const

type PrimitiveFrameProps = Omit<
  SidebarCatalogFrameProps,
  "ariaLabel" | "groupLabel" | "noteTitle" | "wrapChildrenInMenu"
>

function PrimitiveFrame(props: PrimitiveFrameProps) {
  return (
    <SidebarCatalogFrame
      ariaLabel="Sidebar primitive example"
      noteTitle="Primitive responsibility"
      {...props}
    />
  )
}

const meta = {
  title: "Shell/Sidebar/Primitives",
  component: Sidebar,
  subcomponents: {
    SidebarProvider,
    SidebarInset,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarFooter,
    SidebarTrigger,
    SidebarRail,
  },
  tags: ["autodocs", "test"],
  decorators: [sidebarStoryDecorator],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The public Sidebar building blocks in one structural catalog. Use the nested Menu catalog for isolated row primitives, then move to Compositions to see purposeful combinations.",
      },
    },
  },
  globals: {
    theme: "dark",
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

interface ProviderStoryArgs {
  collapsedWidth: number
  expandedWidth: number
}

export const ProviderSidebarAndInset: StoryObj<ProviderStoryArgs> = {
  args: {
    collapsedWidth: 4,
    expandedWidth: 18,
  },
  argTypes: {
    expandedWidth: {
      control: { type: "range", min: 12, max: 30, step: 0.5 },
      description:
        "Application-owned expanded width in rem units; the library default is 17.",
    },
    collapsedWidth: {
      control: { type: "range", min: 2.5, max: 8, step: 0.25 },
      description:
        "Application-owned collapsed width in rem units; the library default is 3.5.",
    },
  },
  parameters: storyDocumentation(
    primitiveDescriptions.ProviderSidebarAndInset,
  ),
  render: ({ collapsedWidth, expandedWidth }) => (
    <SidebarProvider
      collapsedSidebarWidth={`${collapsedWidth}rem`}
      sidebarWidth={`${expandedWidth}rem`}
      className="h-80 min-h-80"
    >
      <Sidebar
        data-sidebar-catalog
        collapsible={SidebarCollapsible.Icon}
        className={`${sidebarCatalogSidebarClassName} p-4`}
        aria-label="Application navigation"
      >
        <SidebarTrigger>
          <SidebarToggleIcon />
        </SidebarTrigger>
      </Sidebar>
      <SidebarInset className="items-center justify-center">
        Inset workspace
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvasElement.querySelector<HTMLElement>(
      '[data-sidebar-catalog]',
    )!
    const trigger = canvas.getByRole("button", { name: "Toggle sidebar" })

    await expect(sidebar.getBoundingClientRect().width).toBe(288)
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        ctrlKey: true,
        bubbles: true,
      }),
    )
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        metaKey: true,
        bubbles: true,
      }),
    )
    await expect(sidebar).toHaveAttribute("data-state", "expanded")

    await userEvent.click(trigger)
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await waitFor(() =>
      expect(sidebar.getBoundingClientRect().width).toBeCloseTo(64, 0),
    )
    await userEvent.click(trigger)
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
  },
}

export const Header: Story = {
  parameters: storyDocumentation(primitiveDescriptions.Header),
  render: () => (
    <PrimitiveFrame description={primitiveDescriptions.Header}>
      <SidebarHeader>Header</SidebarHeader>
    </PrimitiveFrame>
  ),
}

export const Content: Story = {
  parameters: storyDocumentation(primitiveDescriptions.Content),
  render: () => (
    <PrimitiveFrame description={primitiveDescriptions.Content}>
      <SidebarContent className="p-4">Scrollable content</SidebarContent>
    </PrimitiveFrame>
  ),
}

export const Group: Story = {
  parameters: storyDocumentation(primitiveDescriptions.Group),
  render: () => (
    <PrimitiveFrame description={primitiveDescriptions.Group}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction aria-label="Add project">
            <Plus />
          </SidebarGroupAction>
          <SidebarGroupContent className="text-sm text-sidebar-foreground/70">
            Group content
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </PrimitiveFrame>
  ),
}

export const Footer: Story = {
  parameters: storyDocumentation(primitiveDescriptions.Footer),
  render: () => (
    <PrimitiveFrame description={primitiveDescriptions.Footer}>
      <SidebarContent />
      <SidebarFooter>Footer</SidebarFooter>
    </PrimitiveFrame>
  ),
}

export const Trigger: Story = {
  parameters: storyDocumentation(primitiveDescriptions.Trigger),
  render: () => (
    <PrimitiveFrame
      collapsible={SidebarCollapsible.Icon}
      description={primitiveDescriptions.Trigger}
      keyboardShortcut={{ key: "b", modifier: "mod", shiftKey: true }}
    >
      <SidebarHeader>
        <SidebarTrigger>
          <SidebarToggleIcon />
        </SidebarTrigger>
      </SidebarHeader>
    </PrimitiveFrame>
  ),
  play: async ({ canvasElement }) => {
    const sidebar = canvasElement.querySelector<HTMLElement>(
      '[data-slot="sidebar"]',
    )!

    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        ctrlKey: true,
        bubbles: true,
      }),
    )
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        altKey: true,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    )
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    )
    await expect(sidebar).toHaveAttribute("data-state", "expanded")

    const matchingShortcut = new KeyboardEvent("keydown", {
      key: "b",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(matchingShortcut)
    await expect(matchingShortcut.defaultPrevented).toBe(true)
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    )
    await waitFor(() =>
      expect(sidebar).toHaveAttribute("data-state", "expanded"),
    )
  },
}

export const Rail: Story = {
  parameters: storyDocumentation(primitiveDescriptions.Rail),
  render: () => (
    <PrimitiveFrame
      collapsible={SidebarCollapsible.Icon}
      description={primitiveDescriptions.Rail}
    >
      <SidebarHeader>Rail target</SidebarHeader>
      <SidebarRail className={sidebarStoryRailClassName} />
    </PrimitiveFrame>
  ),
  play: async ({ canvasElement }) => {
    const rail = within(canvasElement).getByRole("button", {
      name: "Toggle sidebar",
    })
    const railStyles = getComputedStyle(rail)
    const guideStyles = getComputedStyle(rail, "::after")
    const railWidth = rail.getBoundingClientRect().width
    const guideWidth = Number.parseFloat(guideStyles.width)
    const guideLeft = Number.parseFloat(guideStyles.left)

    await expect(railWidth).toBe(12)
    await expect(railStyles.opacity).toBe("1")
    await expect(railStyles.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    await expect(guideWidth).toBe(1)
    await expect(guideLeft).toBeCloseTo(railWidth / 2, 5)
    await expect(guideStyles.translate).toBe("-50%")
    await expect(guideStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    await expect(guideStyles.pointerEvents).toBe("none")
  },
}
