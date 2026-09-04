import type * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Badge,
  Button,
  Sidebar,
  SidebarCollapsible,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarVariant,
} from "@nessalabs/ui"
import { Folder, MoreHorizontal } from "lucide-react"

import {
  SidebarCatalogFrame,
  sidebarCatalogSidebarClassName,
  sidebarStoryDecorator,
  sidebarStoryRailClassName,
} from "./sidebar-story-surface"
import { storyDocumentation } from "./story-documentation"

const compositionDescriptions = {
  RichChatRow:
    "SidebarMenuItem combines its label, description, generic Badge, and generic Button slots without exposing internal layout components.",
  NestedNavigation:
    "A nested SidebarMenu reuses the same composite item while preserving valid list semantics.",
  HoverActions:
    "Hover actions remain discoverable by pointer or focus and stay visible on touch-oriented devices.",
  LogicalDirection:
    "Logical padding and trailing alignment mirror in right-to-left layouts without changing the composition API.",
  RailBehavior:
    "SidebarRail preserves a full-height edge target that toggles the Sidebar without adding another visible row.",
  InsetVariant:
    "The inset variant keeps the Sidebar flush on the shell surface while SidebarInset floats the workspace as a rounded panel.",
} as const

interface CompositionFrameProps {
  children: React.ReactNode
  description: string
}

function CompositionFrame({ children, description }: CompositionFrameProps) {
  return (
    <SidebarCatalogFrame
      ariaLabel="Sidebar composition example"
      groupLabel="Composition"
      noteTitle="What the primitives build together"
      wrapChildrenInMenu
      description={description}
    >
      {children}
    </SidebarCatalogFrame>
  )
}

const meta = {
  title: "Shell/Sidebar/Compositions",
  component: Sidebar,
  tags: ["autodocs", "test"],
  decorators: [sidebarStoryDecorator],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Purposeful combinations of public Sidebar primitives. These patterns demonstrate assembly and behavior without introducing additional runtime components.",
      },
    },
  },
  globals: {
    theme: "dark",
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const RichChatRow: Story = {
  parameters: storyDocumentation(compositionDescriptions.RichChatRow),
  render: () => (
    <CompositionFrame description={compositionDescriptions.RichChatRow}>
      <SidebarMenuItem
        data-testid="rich-chat-row"
        size="lg"
        description="Running validation checks"
        badge={<Badge variant="secondary">3</Badge>}
        trailing={
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Open row actions"
          >
            <MoreHorizontal />
          </Button>
        }
      >
        Building sidebar rows
      </SidebarMenuItem>
    </CompositionFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const storyRoot = canvasElement.querySelector<HTMLElement>(
      "[data-sidebar-story-root]",
    )!
    const sidebar = canvasElement.querySelector<HTMLElement>(
      "[data-sidebar-catalog]",
    )!
    const button = canvas.getByTestId("rich-chat-row")
    const row = button.closest<HTMLElement>('[data-slot="sidebar-menu-item"]')!
    const description = row.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-item-description"]',
    )!
    const trailing = row.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-item-trailing"]',
    )!

    await expect(storyRoot.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      innerHeight,
    )
    await expect(getComputedStyle(storyRoot).backgroundColor).toBe(
      getComputedStyle(sidebar).backgroundColor,
    )
    await expect(getComputedStyle(sidebar).borderRightColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
    await expect(button).toHaveAttribute("data-size", "lg")
    await expect(description).toBeVisible()
    await expect(description.scrollHeight).toBeLessThanOrEqual(
      description.clientHeight,
    )
    await expect(description.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      button.getBoundingClientRect().bottom,
    )
    await expect(
      button.querySelector('[data-slot="sidebar-menu-item-content"]')!
        .getBoundingClientRect().right,
    ).toBeLessThanOrEqual(trailing.getBoundingClientRect().left)
  },
}

export const NestedNavigation: Story = {
  parameters: storyDocumentation(
    compositionDescriptions.NestedNavigation,
  ),
  render: () => (
    <CompositionFrame description={compositionDescriptions.NestedNavigation}>
      <SidebarMenuItem
        icon={<Folder />}
        submenu={
          <SidebarMenu nested>
            <SidebarMenuItem asChild isActive>
              <a href="#nested-conversation">Nested conversation</a>
            </SidebarMenuItem>
          </SidebarMenu>
        }
      >
        Project
      </SidebarMenuItem>
    </CompositionFrame>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: "Nested conversation",
    })
    const menu = link.closest<HTMLElement>('[data-slot="sidebar-menu"]')!
    const label = link.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-item-label"]',
    )!

    await expect(link.getBoundingClientRect().left).toBeCloseTo(
      menu.getBoundingClientRect().left,
      0,
    )
    await expect(link.getBoundingClientRect().right).toBeCloseTo(
      menu.getBoundingClientRect().right,
      0,
    )
    await expect(label.getBoundingClientRect().left).toBeGreaterThan(
      link.getBoundingClientRect().left,
    )
  },
}

export const HoverActions: Story = {
  parameters: storyDocumentation(compositionDescriptions.HoverActions),
  render: () => (
    <CompositionFrame description={compositionDescriptions.HoverActions}>
      <SidebarMenuItem
        data-testid="hover-action-row"
        showTrailingOnHover
        trailing={
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Open conversation actions"
          >
            <MoreHorizontal />
          </Button>
        }
      >
        Conversation with actions
      </SidebarMenuItem>
    </CompositionFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const control = canvas.getByTestId("hover-action-row")
    const row = control.closest<HTMLElement>('[data-slot="sidebar-menu-item"]')!
    const action = canvas.getByRole("button", {
      name: "Open conversation actions",
    })
    const trailing = action.parentElement!
    const hasFineHover = matchMedia("(hover: hover) and (pointer: fine)").matches

    if (hasFineHover) {
      await expect(action).not.toBeVisible()
      await expect(trailing).toHaveClass(
        "[@media(hover:hover)_and_(pointer:fine)]:group-hover/menu-item:opacity-100",
      )
      action.focus()
      await expect(action).toHaveFocus()
      await waitFor(() => expect(action).toBeVisible())
    } else {
      await expect(matchMedia("(hover: none)").matches).toBe(true)
      await expect(matchMedia("(pointer: coarse)").matches).toBe(true)
      await expect(getComputedStyle(trailing).opacity).toBe("1")
      await expect(getComputedStyle(trailing).pointerEvents).toBe("auto")
      await expect(action).toBeVisible()
    }
  },
}

export const LogicalDirection: Story = {
  parameters: storyDocumentation(
    compositionDescriptions.LogicalDirection,
  ),
  render: () => (
    <div dir="rtl">
      <CompositionFrame description={compositionDescriptions.LogicalDirection}>
        <SidebarMenuItem
          data-testid="rtl-rich-row"
          size="lg"
          description="نشاط حديث"
          badge={<Badge variant="secondary">2</Badge>}
          trailing={
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="فتح إجراءات الصف"
            >
              <MoreHorizontal />
            </Button>
          }
        >
          محادثة المشروع
        </SidebarMenuItem>
        <SidebarMenuItem
          icon={<Folder />}
          submenu={
            <SidebarMenu nested>
              <SidebarMenuItem asChild>
                <a href="#rtl-nested-conversation">محادثة متداخلة</a>
              </SidebarMenuItem>
            </SidebarMenu>
          }
        >
          مشروع
        </SidebarMenuItem>
      </CompositionFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByTestId("rtl-rich-row")
    const row = control.closest<HTMLElement>('[data-slot="sidebar-menu-item"]')!
    const badge = row.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-item-badge"]',
    )!
    const action = within(row).getByRole("button", { name: "فتح إجراءات الصف" })
    const nestedLink = within(canvasElement).getByRole("link", {
      name: "محادثة متداخلة",
    })
    const nestedMenu = nestedLink.closest<HTMLElement>(
      '[data-slot="sidebar-menu"]',
    )!
    const nestedLabel = nestedLink.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-item-label"]',
    )!

    await expect(getComputedStyle(row).direction).toBe("rtl")
    await expect(action.getBoundingClientRect().right).toBeLessThanOrEqual(
      badge.getBoundingClientRect().left,
    )
    await expect(nestedLink.getBoundingClientRect().left).toBeCloseTo(
      nestedMenu.getBoundingClientRect().left,
      0,
    )
    await expect(nestedLink.getBoundingClientRect().right).toBeCloseTo(
      nestedMenu.getBoundingClientRect().right,
      0,
    )
    await expect(nestedLabel.getBoundingClientRect().right).toBeLessThan(
      nestedLink.getBoundingClientRect().right,
    )
  },
}

export const RailBehavior: Story = {
  parameters: storyDocumentation(compositionDescriptions.RailBehavior),
  render: () => (
    <SidebarProvider
      keyboardShortcut={{ key: "b", modifier: "mod" }}
      className="h-80 min-h-80"
    >
      <Sidebar
        data-sidebar-catalog
        collapsible={SidebarCollapsible.Icon}
        className={sidebarCatalogSidebarClassName}
        aria-label="Rail composition navigation"
      >
        <SidebarHeader>Rail composition</SidebarHeader>
        <SidebarRail className={sidebarStoryRailClassName} />
      </Sidebar>
      <SidebarInset className="items-center justify-center">
        Full-height edge toggle
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvas.getByLabelText("Rail composition navigation")
    const rail = canvas.getByRole("button", { name: "Toggle sidebar" })

    await userEvent.click(rail)
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await userEvent.keyboard("{Control>}b{/Control}")
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
  },
}

export const InsetVariant: Story = {
  parameters: storyDocumentation(compositionDescriptions.InsetVariant),
  render: () => (
    <SidebarProvider className="h-80 min-h-80">
      <Sidebar
        data-sidebar-catalog
        variant={SidebarVariant.Inset}
        collapsible={SidebarCollapsible.None}
        className={sidebarCatalogSidebarClassName}
        aria-label="Inset variant navigation"
      >
        <SidebarHeader>Inset variant</SidebarHeader>
      </Sidebar>
      <SidebarInset className="items-center justify-center">
        Floating workspace panel
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvas.getByLabelText("Inset variant navigation")
    const inset = canvasElement.querySelector<HTMLElement>(
      '[data-slot="sidebar-inset"]',
    )!

    await expect(sidebar).toHaveAttribute("data-variant", "inset")

    if (matchMedia("(min-width: 48rem)").matches) {
      const insetStyle = getComputedStyle(inset)
      await expect(insetStyle.borderTopLeftRadius).not.toBe("0px")
      await expect(insetStyle.marginLeft).toBe("0px")
      await expect(insetStyle.marginRight).toBe("8px")
      await expect(getComputedStyle(sidebar).backgroundColor).toBe(
        "rgba(0, 0, 0, 0)",
      )
    }
  },
}
