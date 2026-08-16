import type * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
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
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
} from "@nessa-ui/react"
import { Folder, MoreHorizontal } from "lucide-react"

import { SidebarToggleIcon } from "./icons/sidebar-toggle-icon"
import {
  SidebarCatalogFrame,
  sidebarCatalogSidebarClassName,
  sidebarStoryDecorator,
} from "./sidebar-story-surface"
import { storyDocumentation } from "./story-documentation"

const menuDescriptions = {
  Menu:
    "SidebarMenu is the semantic list container. Its nested variant reuses the same list primitive and applies logical indentation to child items.",
  MenuItem:
    "SidebarMenuItem is the complete row API: button or link, icon, label, description, active styling, generic badge and action slots, collapsed icon, and optional nested menu.",
  MenuSkeleton:
    "SidebarMenuSkeleton is a list-item loading state that adapts icon and text placeholders across collapsed and expanded sidebars.",
  NestedMenu:
    "Nested navigation reuses SidebarMenu and SidebarMenuItem, preserving valid ul/li structure without a second submenu component family.",
} as const

interface MenuPrimitiveFrameProps {
  children: React.ReactNode
  description: string
}

function MenuPrimitiveFrame({
  children,
  description,
}: MenuPrimitiveFrameProps) {
  return (
    <SidebarCatalogFrame
      ariaLabel="Sidebar menu primitive example"
      groupLabel="Menu primitive"
      noteTitle="What this story isolates"
      description={description}
    >
      {children}
    </SidebarCatalogFrame>
  )
}

const meta = {
  title: "Components/Sidebar/Primitives/Menu",
  component: SidebarMenu,
  subcomponents: {
    SidebarMenuItem,
    SidebarMenuSkeleton,
  },
  tags: ["autodocs", "test"],
  decorators: [sidebarStoryDecorator],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A deliberately small sidebar menu API: one list, one composite item, and one loading item. Badge and Button remain generic components passed through SidebarMenuItem slots.",
      },
    },
  },
  globals: {
    theme: "dark",
  },
} satisfies Meta<typeof SidebarMenu>

export default meta

interface MenuStoryArgs {
  label: string
  rowCount: number
}

export const Menu: StoryObj<MenuStoryArgs> = {
  args: {
    label: "Menu row",
    rowCount: 3,
  },
  argTypes: {
    label: {
      control: "text",
      description: "Base label used for each example item.",
    },
    rowCount: {
      control: { type: "range", min: 1, max: 6, step: 1 },
      description: "Number of semantic list items rendered.",
    },
  },
  parameters: storyDocumentation(menuDescriptions.Menu),
  render: ({ label, rowCount }) => (
    <MenuPrimitiveFrame description={menuDescriptions.Menu}>
      <SidebarMenu>
        {Array.from({ length: rowCount }, (_, index) => (
          <SidebarMenuItem key={index}>{`${label} ${index + 1}`}</SidebarMenuItem>
        ))}
      </SidebarMenu>
    </MenuPrimitiveFrame>
  ),
}

type ItemSize = "sm" | "default" | "lg"
type ItemVariant = "default" | "outline"

interface MenuItemStoryArgs {
  badge: string
  description: string
  inset: boolean
  isActive: boolean
  label: string
  showAction: boolean
  showOnHover: boolean
  size: ItemSize
  variant: ItemVariant
}

export const MenuItem: StoryObj<MenuItemStoryArgs> = {
  args: {
    badge: "3",
    description: "Running validation checks",
    inset: false,
    isActive: false,
    label: "Building sidebar rows",
    showAction: true,
    showOnHover: false,
    size: "lg",
    variant: "default",
  },
  argTypes: {
    label: { control: "text", description: "Primary row label." },
    description: {
      control: "text",
      description: "Optional second line; use an empty value for a single-line row.",
    },
    badge: {
      control: "text",
      description: "Content passed to the generic Badge component; empty hides it.",
    },
    showAction: {
      control: "boolean",
      description: "Adds a generic icon Button through the trailing slot.",
    },
    showOnHover: {
      control: "boolean",
      description: "Hides the complete trailing region until hover or focus on fine pointers.",
    },
    isActive: { control: "boolean" },
    inset: { control: "boolean" },
    variant: { control: "inline-radio", options: ["default", "outline"] },
    size: { control: "inline-radio", options: ["sm", "default", "lg"] },
  },
  parameters: storyDocumentation(menuDescriptions.MenuItem),
  render: ({
    badge,
    description,
    inset,
    isActive,
    label,
    showAction,
    showOnHover,
    size,
    variant,
  }) => (
    <MenuPrimitiveFrame description={menuDescriptions.MenuItem}>
      <SidebarMenu>
        <SidebarMenuItem
          icon={<Folder />}
          description={description || undefined}
          badge={
            badge ? (
              <Badge variant="secondary" className="h-5 px-1.5">
                {badge}
              </Badge>
            ) : undefined
          }
          trailing={
            showAction ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Open row actions"
              >
                <MoreHorizontal />
              </Button>
            ) : undefined
          }
          showTrailingOnHover={showOnHover}
          isActive={isActive}
          inset={inset}
          size={size}
          variant={variant}
        >
          {label}
        </SidebarMenuItem>
      </SidebarMenu>
    </MenuPrimitiveFrame>
  ),
}

interface MenuSkeletonStoryArgs {
  showIcon: boolean
}

export const MenuSkeleton: StoryObj<MenuSkeletonStoryArgs> = {
  args: {
    showIcon: true,
  },
  argTypes: {
    showIcon: {
      control: "boolean",
      description: "Shows an icon placeholder in the second loading row.",
    },
  },
  parameters: storyDocumentation(menuDescriptions.MenuSkeleton),
  render: ({ showIcon }) => (
    <SidebarProvider defaultOpen={false} className="h-80 min-h-80">
      <Sidebar
        data-sidebar-catalog
        collapsible={SidebarCollapsible.Icon}
        aria-label="Loading navigation"
        className={sidebarCatalogSidebarClassName}
      >
        <SidebarHeader>
          <SidebarTrigger>
            <SidebarToggleIcon />
          </SidebarTrigger>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuSkeleton data-testid="menu-skeleton" />
                <SidebarMenuSkeleton
                  data-testid="icon-menu-skeleton"
                  showIcon={showIcon}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="p-6">
        <div
          data-sidebar-story-note
          className="max-w-xl rounded-xl border border-border bg-card p-4 text-card-foreground"
        >
          <p className="text-sm font-medium">Collapsed and expanded loading rows</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Text-only skeletons hide while icon skeletons preserve the compact rail.
          </p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const skeleton = canvas.getByTestId("menu-skeleton")
    const iconSkeleton = canvas.getByTestId("icon-menu-skeleton")
    const trigger = canvas.getByRole("button", { name: "Toggle sidebar" })

    await expect(
      trigger.querySelector('[data-nucleo-icon="sidebar-right"]'),
    ).toBeVisible()
    await expect(
      skeleton.querySelector('[data-sidebar="menu-skeleton-icon"]'),
    ).toBeNull()
    await expect(skeleton.children[0]).not.toBeVisible()
    await expect(iconSkeleton.children[0]).toBeVisible()
    await expect(iconSkeleton.children[1]).not.toBeVisible()
    for (const row of [skeleton, iconSkeleton]) {
      await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
    }

    await userEvent.click(trigger)
    await expect(
      trigger.querySelector('[data-nucleo-icon="sidebar-left"]'),
    ).toBeVisible()
    await expect(skeleton.children[0]).toBeVisible()
    await expect(iconSkeleton.children[0]).toBeVisible()
    await expect(iconSkeleton.children[1]).toBeVisible()
    for (const row of [skeleton, iconSkeleton]) {
      const text = row.querySelector<HTMLElement>(
        '[data-sidebar="menu-skeleton-text"]',
      )!
      const width = Number.parseFloat(
        text.style.getPropertyValue("--skeleton-width"),
      )
      await expect(width).toBeGreaterThanOrEqual(50)
      await expect(width).toBeLessThanOrEqual(89)
      await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
    }
  },
}

interface NestedMenuStoryArgs {
  activeChild: boolean
  childLabel: string
  parentLabel: string
}

export const NestedMenu: StoryObj<NestedMenuStoryArgs> = {
  args: {
    activeChild: true,
    childLabel: "Active nested item",
    parentLabel: "Project",
  },
  argTypes: {
    parentLabel: { control: "text", description: "Parent row label." },
    childLabel: { control: "text", description: "Nested row label." },
    activeChild: {
      control: "boolean",
      description: "Applies the active state to the nested row.",
    },
  },
  parameters: storyDocumentation(menuDescriptions.NestedMenu),
  render: ({ activeChild, childLabel, parentLabel }) => (
    <MenuPrimitiveFrame description={menuDescriptions.NestedMenu}>
      <SidebarMenu>
        <SidebarMenuItem
          icon={<Folder />}
          submenu={
            <SidebarMenu nested>
              <SidebarMenuItem asChild>
                <a href="#nested-default">Default nested item</a>
              </SidebarMenuItem>
              <SidebarMenuItem asChild isActive={activeChild}>
                <a href="#nested-active">{childLabel}</a>
              </SidebarMenuItem>
            </SidebarMenu>
          }
        >
          {parentLabel}
        </SidebarMenuItem>
      </SidebarMenu>
    </MenuPrimitiveFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nestedItem = canvas.getByRole("link", {
      name: "Active nested item",
    })
    const nestedMenu = nestedItem.closest<HTMLElement>(
      '[data-slot="sidebar-menu"]',
    )!
    const label = nestedItem.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-item-label"]',
    )!

    await userEvent.hover(nestedItem)
    await expect(nestedItem).toBeVisible()
    await expect(nestedItem.getBoundingClientRect().left).toBeCloseTo(
      nestedMenu.getBoundingClientRect().left,
      0,
    )
    await expect(nestedItem.getBoundingClientRect().right).toBeCloseTo(
      nestedMenu.getBoundingClientRect().right,
      0,
    )
    await expect(label.getBoundingClientRect().left).toBeGreaterThan(
      nestedItem.getBoundingClientRect().left,
    )
  },
}
