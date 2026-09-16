import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

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
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 gap-1.5 px-3 nessa-text-2",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/**
 * The action primitive.
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
        className={cn(buttonVariants({ variant, size, className }))}
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
