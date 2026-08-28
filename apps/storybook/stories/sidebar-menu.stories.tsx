import * as React from "react"
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
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
} from "@nessa-ui/react"
import { Folder, LoaderCircle, MoreHorizontal, Settings } from "lucide-react"

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
  NestedMenuGuides:
    "The guides variant of a nested SidebarMenu draws decorative branch lines from the parent row to each child, terminating in an elbow on the last row. Guides are presentation only: hierarchy stays in the nested list structure, and the logical-start offset retunes through --nessa-sidebar-guide-inset.",
  TrailingAction:
    "SidebarMenuAction is the trailing icon control on a row — settings, a kebab menu, a dismiss. Paired with a badge and showTrailingOnHover the two share one cell and swap, so revealing the action costs the reader neither width nor the row's resting count. The reveal answers hover and keyboard focus only: :focus-within would keep the row you last clicked revealed while you hover another, showing two rows' actions at once.",
  CollapsibleSubmenu:
    "A submenu becomes a disclosure through the collapsible prop. In row mode the parent row is the disclosure button; in chevron mode a separate control at the logical start toggles it so the row itself stays free to navigate. Open state is uncontrolled through defaultOpen or host-controlled through open and onOpenChange.",
} as const

/** Trailing spinner standing in for a host's own in-progress indicator. */
function RunningIndicator() {
  return (
    <LoaderCircle
      aria-hidden="true"
      className="size-3.5 animate-spin text-sidebar-foreground/50"
    />
  )
}

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


interface NestedMenuGuidesStoryArgs {
  guideColor: string
  guideInset: string
  guideWidth: string
  parentLabel: string
}

export const NestedMenuGuides: StoryObj<NestedMenuGuidesStoryArgs> = {
  args: {
    guideColor: "var(--color-sidebar-border)",
    guideInset: "1.25rem",
    guideWidth: "1px",
    parentLabel: "Record orchestration demo",
  },
  argTypes: {
    parentLabel: { control: "text", description: "Parent row label." },
    guideInset: {
      control: "text",
      description:
        "Logical-start offset of the branch guides, applied as --nessa-sidebar-guide-inset.",
    },
    guideWidth: {
      control: "text",
      description:
        "Guide line thickness, applied as --nessa-sidebar-guide-width.",
    },
    guideColor: {
      control: "text",
      description: "Guide line colour, applied as --nessa-sidebar-guide-color.",
    },
  },
  parameters: storyDocumentation(menuDescriptions.NestedMenuGuides),
  render: ({ guideColor, guideInset, guideWidth, parentLabel }) => (
    <MenuPrimitiveFrame description={menuDescriptions.NestedMenuGuides}>
      <SidebarMenu>
        <SidebarMenuItem
          isActive
          trailing={<RunningIndicator />}
          submenu={
            <SidebarMenu
              nested
              guides
              style={
                {
                  "--nessa-sidebar-guide-color": guideColor,
                  "--nessa-sidebar-guide-inset": guideInset,
                  "--nessa-sidebar-guide-width": guideWidth,
                } as React.CSSProperties
              }
            >
              <SidebarMenuItem
                size="sm"
                trailing={<RunningIndicator />}
                tooltip="Your only task is to spin up a worker and report back"
              >
                Your only task is to spin up a worker and report back
              </SidebarMenuItem>
              <SidebarMenuItem
                size="sm"
                trailing={<RunningIndicator />}
                tooltip="Greet the user. Write a short hello and stop."
              >
                Greet the user. Write a short hello and stop.
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
    const guidedMenu = canvasElement.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu"][data-guides="true"]',
    )!
    const rows = [
      ...guidedMenu.querySelectorAll<HTMLElement>(
        ':scope > [data-slot="sidebar-menu-item"]',
      ),
    ]
    await expect(rows).toHaveLength(2)

    // Every row draws the elbow; only a row with a row after it draws the
    // trunk that carries the line on to the next elbow.
    for (const row of rows) {
      const elbow = getComputedStyle(row, "::before")
      await expect(elbow.content).not.toBe("none")
      await expect(elbow.borderBottomStyle).toBe("solid")
      await expect(elbow.borderLeftStyle).toBe("solid")
    }
    await expect(getComputedStyle(rows[0], "::after").content).not.toBe("none")
    await expect(getComputedStyle(rows[1], "::after").content).toBe("none")

    // The spine runs the row's whole height and overshoots into the list's
    // row gap, so it meets the next elbow with no break at the elbow's
    // rounded corner.
    const spine = getComputedStyle(rows[0], "::after")
    await expect(spine.top).toBe("0px")
    await expect(Number.parseFloat(spine.height)).toBeGreaterThan(
      rows[0].getBoundingClientRect().height,
    )

    // Trailing content centres on its own row's midline whatever its height,
    // and a nested row's size never displaces its parent row's trailing.
    for (const row of [
      ...guidedMenu.closest<HTMLElement>('[data-slot="sidebar-menu-item"]')!
        .parentElement!.querySelectorAll<HTMLElement>(
          '[data-slot="sidebar-menu-item"]',
        ),
    ]) {
      const control = row.querySelector<HTMLElement>(
        '[data-slot="sidebar-menu-item-control"]',
      )!
      const spinner = row.querySelector<HTMLElement>(
        '[data-slot="sidebar-menu-item-trailing"] svg',
      )!
      const controlBox = control.getBoundingClientRect()
      const spinnerBox = spinner.getBoundingClientRect()
      await expect(spinnerBox.top + spinnerBox.height / 2).toBeCloseTo(
        controlBox.top + controlBox.height / 2,
        0,
      )
    }

    // The guides sit clear of the nested label, which keeps its indentation.
    const label = canvas
      .getByRole("button", { name: "Greet the user. Write a short hello and stop." })
      .querySelector<HTMLElement>('[data-slot="sidebar-menu-item-label"]')!
    const elbowEnd =
      guidedMenu.getBoundingClientRect().left +
      Number.parseFloat(getComputedStyle(rows[1], "::before").left) +
      Number.parseFloat(getComputedStyle(rows[1], "::before").width)
    await expect(label.getBoundingClientRect().left).toBeGreaterThan(elbowEnd)
  },
}

function CollapsibleSubmenuExample() {
  // The chevron-mode row is host-controlled to show the controlled path;
  // the row-mode one owns its own state through defaultOpen.
  const [reportsOpen, setReportsOpen] = React.useState(false)

  return (
    <SidebarMenu>
      <SidebarMenuItem
        collapsible="row"
        defaultOpen
        icon={<Folder />}
        submenu={
          <SidebarMenu nested guides>
            <SidebarMenuItem size="sm">Spin up a worker</SidebarMenuItem>
            <SidebarMenuItem size="sm">Greet the user</SidebarMenuItem>
          </SidebarMenu>
        }
      >
        Record orchestration demo
      </SidebarMenuItem>
      <SidebarMenuItem
        asChild
        collapsible="chevron"
        collapsibleLabel="Toggle reports"
        open={reportsOpen}
        onOpenChange={setReportsOpen}
        submenu={
          <SidebarMenu nested guides>
            <SidebarMenuItem size="sm">Weekly rollup</SidebarMenuItem>
            <SidebarMenuItem size="sm">Incident log</SidebarMenuItem>
          </SidebarMenu>
        }
      >
        <a href="#reports">Reports</a>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export const CollapsibleSubmenu: StoryObj = {
  parameters: storyDocumentation(menuDescriptions.CollapsibleSubmenu),
  render: () => (
    <MenuPrimitiveFrame description={menuDescriptions.CollapsibleSubmenu}>
      <CollapsibleSubmenuExample />
    </MenuPrimitiveFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Row mode: the row control is itself the disclosure.
    const parentRow = canvas.getByRole("button", {
      name: "Record orchestration demo",
    })
    await expect(parentRow).toHaveAttribute("aria-expanded", "true")
    await expect(
      canvas.getByRole("button", { name: "Spin up a worker" }),
    ).toBeVisible()

    await userEvent.click(parentRow)
    await expect(parentRow).toHaveAttribute("aria-expanded", "false")
    await expect(
      canvas.queryByRole("button", { name: "Spin up a worker" }),
    ).toBeNull()

    // A closed chevron points toward the inline end in BOTH directions.
    // The chevron is the row's first glyph, before any `icon`.
    // The disclosure names the element it controls, open or closed.
    const controlled = document.getElementById(
      parentRow.getAttribute("aria-controls")!,
    )
    await expect(controlled).not.toBeNull()

    // Chevron mode: the row keeps navigating, a separate control discloses.
    const reportsLink = canvas.getByRole("link", { name: "Reports" })
    await expect(reportsLink).not.toHaveAttribute("aria-expanded")
    const chevron = canvas.getByRole("button", { name: "Toggle reports" })
    await expect(chevron).toHaveAttribute("aria-expanded", "false")
    await expect(
      canvas.queryByRole("button", { name: "Weekly rollup" }),
    ).toBeNull()

    await userEvent.click(chevron)
    await expect(chevron).toHaveAttribute("aria-expanded", "true")
    const nestedRow = canvas.getByRole("button", { name: "Weekly rollup" })
    await expect(nestedRow).toBeVisible()

    // A "chevron" row reserves logical-start space for the disclosure, so
    // the two controls never overlap however wide the row is.
    await expect(
      Number.parseFloat(getComputedStyle(reportsLink).paddingInlineStart),
    ).toBeGreaterThanOrEqual(chevron.getBoundingClientRect().width)

    // Direction is asserted last: the row transitions `padding`, so flipping
    // `dir` animates `padding-inline-start` and would leave any assertion
    // after this one reading a mid-transition value.
    //
    // A closed chevron points toward the inline end in BOTH directions. The
    // chevron is the row's first glyph, before any `icon`, and its rotation
    // transitions, so computed style has to settle before each read.
    const chevronGlyph = parentRow.querySelector<HTMLElement>("svg")!
    await waitFor(async () => {
      await expect(getComputedStyle(chevronGlyph).rotate).toBe("-90deg")
    })
    const root = document.documentElement
    const previousDir = root.getAttribute("dir")
    try {
      root.setAttribute("dir", "rtl")
      await waitFor(async () => {
        await expect(getComputedStyle(chevronGlyph).rotate).toBe("90deg")
      })
    } finally {
      if (previousDir === null) root.removeAttribute("dir")
      else root.setAttribute("dir", previousDir)
    }
  },
}


export const TrailingAction: StoryObj = {
  parameters: storyDocumentation(menuDescriptions.TrailingAction),
  render: () => (
    <MenuPrimitiveFrame description={menuDescriptions.TrailingAction}>
      <SidebarMenu>
        {["eng-sidebar", "eng-tabs"].map((channel, index) => (
          <SidebarMenuItem
            key={channel}
            icon={<Folder />}
            badge={String(index === 0 ? 5 : 2)}
            showTrailingOnHover
            trailing={
              <SidebarMenuAction aria-label={`Settings for ${channel}`}>
                <Settings aria-hidden="true" />
              </SidebarMenuAction>
            }
          >
            {channel}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </MenuPrimitiveFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = canvas.getByRole("button", { name: "Settings for eng-sidebar" })
    const second = canvas.getByRole("button", { name: "Settings for eng-tabs" })
    const opacityOf = (element: HTMLElement) =>
      Number.parseFloat(getComputedStyle(element.parentElement!).opacity)

    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) {
      // Without a fine pointer there is nothing to reveal on: both actions
      // stay present, which is what keeps them reachable by touch.
      await expect(opacityOf(first)).toBe(1)
      await expect(opacityOf(second)).toBe(1)
      return
    }

    // Both actions rest hidden; the counts hold the trailing cell.
    await expect(opacityOf(first)).toBe(0)
    await expect(opacityOf(second)).toBe(0)

    // The regression this guards: clicking a row leaves focus inside it, and
    // a :focus-within reveal would keep that row's action showing while the
    // pointer moved on to another row. Keyed off :focus-visible, a mouse
    // click reveals nothing.
    await userEvent.click(canvas.getByRole("button", { name: "eng-sidebar" }))
    await expect(opacityOf(first)).toBe(0)
    await expect(opacityOf(second)).toBe(0)

    // Keyboard focus still reveals, and only for the row that holds it.
    first.focus()
    await waitFor(async () => {
      await expect(opacityOf(first)).toBe(1)
    })
    await expect(opacityOf(second)).toBe(0)
  },
}
