/**
 * The one recipe every Nessa menu row is drawn from. Dropdown and context
 * menus are separate Radix primitives, but a person reads them as the same
 * thing, so their geometry lives here once rather than drifting apart in two
 * files.
 *
 *   ┌─ xl radius ────────────────────────────────────┐
 *   │ 5px                                             │
 *   │   ╭─ lg radius highlight ────────────────────╮  │
 *   │   │ 10px [icon] 10px Item words    ✓  ⌘K 10px│  │  30px row, 13px text
 *   │   ╰──────────────────────────────────────────╯  │
 *   │   ─────────── hairline, 5px above/below ──────  │
 *   └─────────────────────────────────────────────────┘
 *
 * A leading icon is any `svg` placed first in the item. The check for a
 * checkbox or radio item sits at the trailing end, before any shortcut, so
 * the leading column always holds the item's own icon.
 */

/** Padding inside the floating menu card, shared by root and submenus. */
export const menuSurfacePaddingClassName = "p-1.25"

/**
 * One row: plain, checkbox, radio, or submenu trigger. Its focus outline is
 * not part of the recipe: each menu component declares its own, where the
 * focus-treatment inventory reads it.
 */
export const menuItemClassName =
  "relative flex min-h-7.5 cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1 font-sans nessa-text-3 text-popover-foreground outline-none transition-colors [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-9 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground"

/**
 * Added to checkbox and radio items: a shortcut that follows the trailing
 * check sits just after it, instead of splitting the free space with it.
 */
export const menuCheckableItemClassName =
  "[&>[data-slot$='menu-shortcut']]:ml-0"

/** The trailing slot the check is drawn in; it keeps its width when empty. */
export const menuItemIndicatorClassName =
  "pointer-events-none order-1 ml-auto flex size-3.5 shrink-0 items-center justify-center text-popover-foreground"

/** The check itself, for both checkbox and radio items. */
export const menuItemCheckClassName = "size-3.5 text-current"

/** A non-interactive section heading. */
export const menuLabelClassName =
  "px-2.5 pt-1.5 pb-1 font-sans nessa-text-2 font-medium text-muted-foreground data-[inset]:pl-9"

/** The hairline between groups. */
export const menuSeparatorClassName = "mx-1.5 my-1.25 h-px bg-border"

/** A muted shortcut, number, or count at the row's trailing end. */
export const menuShortcutClassName =
  "order-2 ml-auto pl-1 font-sans nessa-text-3 tabular-nums tracking-wide text-muted-foreground"

/** The chevron a submenu trigger ends with. */
export const menuSubTriggerChevronClassName = "order-2 ml-auto size-3.5"
