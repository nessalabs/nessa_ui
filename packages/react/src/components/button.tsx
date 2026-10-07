import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// The compact variants' interaction states: a solid outline in the ring
// colour instead of the translucent 3px ring, and fills read from the shared
// state tokens, so a compact control draws hover, press and focus exactly as
// an application's own controls built on the same tokens do. Selected
// (`aria-pressed`) and open (`data-state="open"`, a menu trigger) hold the
// hover fill and full ink.
const compactFocus =
  "focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-(length:--nessa-focus-outline-width) focus-visible:outline-offset-1 focus-visible:outline-ring"
const quietStates =
  "hover:bg-foreground/(--nessa-state-hover-strong) hover:text-foreground active:bg-foreground/(--nessa-state-press) aria-pressed:bg-foreground/(--nessa-state-hover-strong) aria-pressed:text-foreground data-[state=open]:bg-foreground/(--nessa-state-hover-strong) data-[state=open]:text-foreground"

// Icons default to 16px, but an icon that sets its own `size-*` keeps it —
// a plain `[&_svg]:size-4` descendant rule outranks a utility class on the
// child and would silently override the author. Note the opt-out matches
// `size-*` only: an icon sized with `h-*`/`w-*` still takes the default.
const buttonVariants = cva(
  "inline-flex box-border shrink-0 appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-md border-0 bg-transparent p-0 font-sans nessa-text-4 font-medium text-foreground no-underline transition-[color,background-color,border-color,box-shadow,transform] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/30",
        outline:
          "border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Compact variants, made for `shape="pill"` and the numeric sizes.
        // A quiet fill at rest that deepens on hover: a secondary action.
        tinted: cn(
          "bg-foreground/(--nessa-state-hover) text-foreground",
          quietStates,
          compactFocus,
        ),
        // No fill until hovered, in muted ink: a chip, a filter, a minor action.
        plain: cn("text-muted-foreground", quietStates, compactFocus),
        // A foreground fill with background ink: the one action that matters here.
        inverse: cn(
          "bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/85",
          compactFocus,
        ),
        // Destructive ink with a destructive tint on hover: removes or revokes.
        danger: cn(
          "text-destructive hover:bg-destructive/(--nessa-state-hover-strong) active:bg-destructive/(--nessa-state-press)",
          compactFocus,
        ),
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 gap-1.5 px-3 nessa-text-2",
        lg: "h-10 px-6",
        icon: "size-9",
        // A 28px square for toolbars, titlebars and rows, where 36px crowds
        // the line. Still clear of the 24px target-size floor.
        "icon-sm": "size-7",
        // Compact heights, named by their pixel height at the default scale.
        "30": "h-7.5 gap-1.5 px-2.5 nessa-text-3",
        "28": "h-7 gap-1.5 px-3 nessa-text-2",
        "26": "h-6.5 gap-1.5 px-3 nessa-text-2",
        "24": "h-6 gap-1 px-2.5 nessa-text-2 [&_svg:not([class*='size-'])]:size-3.5",
        "22": "h-5.5 gap-1 px-2 nessa-text-2 [&_svg:not([class*='size-'])]:size-3.5",
      },
      shape: {
        default: "",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * `"default"` keeps the theme's control radius; `"pill"` rounds the ends
   * fully. Compact variants (`tinted`, `plain`, `inverse`, `danger`) and the
   * numeric sizes are made for the pill, though any combination works.
   * @defaultValue "default"
   */
  shape?: VariantProps<typeof buttonVariants>["shape"]
}

/**
 * The action primitive.
 *
 * Two families share it. The standard variants (`default`, `secondary`,
 * `outline`, `ghost`, `destructive`, `link`) at `sm`/`default`/`lg` sizes
 * are the form and dialog actions. The compact variants (`tinted`, `plain`,
 * `inverse`, `danger`) at the numeric heights (`22`–`30`) with
 * `shape="pill"` are the dense controls of toolbars, rows and headers; they
 * draw hover, press and focus from the shared state tokens. A selected
 * compact control says so with `aria-pressed`; an open menu trigger with
 * `data-state="open"`, which Radix triggers set themselves.
 *
 * Two defaults are worth knowing, because both are places the native
 * behavior is a trap rather than a convenience:
 *
 * `type` defaults to `"button"`, not the HTML default of `"submit"`. A
 * button inside a form that opens a picker, toggles a panel, or removes a
 * row is not a submit control, and inheriting `submit` turns every one of
 * them into an accidental form submission that only shows up once somebody
 * puts the component in a form. Submit controls say `type="submit"`.
 *
 * With `asChild`, `disabled` still reaches the child, because a slotted
 * `<button>` has a real disabled state and taking it away would leave a
 * control that looks disabled and runs anyway. For a child that has no such
 * state — an `<a>`, a custom component — the button adds what ARIA and CSS
 * can: the child is announced as disabled, taken out of the tab order, and
 * made transparent to the pointer. That is not the same as inoperable, since
 * nothing stops programmatic focus followed by Enter, so prefer rendering no
 * link at all over a disabled one.
 *
 * What it deliberately does not do is wrap the child's own handlers. Slot
 * composition runs the child's handler *first*, so a guard added here would
 * execute after the action it was meant to prevent, and a blanket key guard
 * would eat Tab — navigation, not activation — along with it.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      shape,
      asChild = false,
      type,
      disabled,
      tabIndex,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot.Root : "button"
    // Everything this component decides is written after the spread, because
    // a prop it resolved is not a default to be overwritten by the same prop
    // arriving again — `type` and `disabled` are read out of props above and
    // folded in deliberately below.
    //
    // The `type` default belongs to the native branch alone: it is a fact
    // about the `<button>` this component renders, and a slotted child may
    // be an anchor or a component for which `type` means nothing. An
    // explicit `type` is always forwarded, through either branch — dropping
    // it under `asChild` would hand a slotted `<button>` straight back to the
    // native `submit` default this exists to avoid.
    return (
      <Comp
        {...props}
        className={cn(buttonVariants({ variant, size, shape, className }))}
        ref={ref}
        type={asChild ? type : (type ?? "button")}
        disabled={disabled}
        tabIndex={asChild && disabled ? -1 : tabIndex}
        {...(asChild && disabled
          ? { "aria-disabled": true, "data-disabled": true }
          : null)}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
