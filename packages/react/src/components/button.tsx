import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// The compact variants' interaction states: a solid outline in the ring
// colour instead of the translucent 3px ring, and fills read from the shared
// state tokens, so a compact control draws hover, press and focus exactly as
// an application's own controls built on the same tokens do. On `tinted`
// and `plain`, selected (`aria-pressed`) and open (`data-state="open"`, a
// menu trigger) hold the hover fill and full ink; forced colours drop that
// fill, so there they draw a 1px system-colour outline instead.
const compactFocus =
  "focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-(length:--nessa-focus-outline-width) focus-visible:outline-offset-1 focus-visible:outline-ring"
// Each compact variant reads its inks and fills from custom properties a
// surface can set on any ancestor, so a window with translucent inks maps
// them once instead of overriding classes. Every property defaults to the
// kit's own value. Per variant: `--nessa-button-<variant>-ink`, `-rest`,
// `-hover` (also selected and open), `-press`; `plain` adds `-hover-ink`.
// `inverse`'s hover and press default to its (possibly mapped) rest fill,
// and `danger`'s to its ink, so mapping one property keeps the others in
// step.
const compactForcedColors =
  "forced-colors:aria-pressed:outline-1 forced-colors:aria-pressed:outline-solid forced-colors:aria-pressed:-outline-offset-1 forced-colors:data-[state=open]:outline-1 forced-colors:data-[state=open]:outline-solid forced-colors:data-[state=open]:-outline-offset-1"

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
        tinted: `bg-[color:var(--nessa-button-tinted-rest,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover),transparent))] text-[color:var(--nessa-button-tinted-ink,var(--foreground))] hover:text-[color:var(--nessa-button-tinted-ink,var(--foreground))] aria-pressed:text-[color:var(--nessa-button-tinted-ink,var(--foreground))] data-[state=open]:text-[color:var(--nessa-button-tinted-ink,var(--foreground))] hover:bg-[color:var(--nessa-button-tinted-hover,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] aria-pressed:bg-[color:var(--nessa-button-tinted-hover,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] data-[state=open]:bg-[color:var(--nessa-button-tinted-hover,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] active:bg-[color:var(--nessa-button-tinted-press,color-mix(in_oklab,var(--foreground)_var(--nessa-state-press),transparent))] ${compactForcedColors} ${compactFocus}`,
        // No fill until hovered, in muted ink: a chip, a filter, a minor action.
        plain: `text-[color:var(--nessa-button-plain-ink,var(--muted-foreground))] hover:bg-[color:var(--nessa-button-plain-hover,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] hover:text-[color:var(--nessa-button-plain-hover-ink,var(--foreground))] aria-pressed:bg-[color:var(--nessa-button-plain-hover,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] data-[state=open]:bg-[color:var(--nessa-button-plain-hover,color-mix(in_oklab,var(--foreground)_var(--nessa-state-hover-strong),transparent))] aria-pressed:text-[color:var(--nessa-button-plain-hover-ink,var(--foreground))] data-[state=open]:text-[color:var(--nessa-button-plain-hover-ink,var(--foreground))] active:bg-[color:var(--nessa-button-plain-press,color-mix(in_oklab,var(--foreground)_var(--nessa-state-press),transparent))] ${compactForcedColors} ${compactFocus}`,
        // A foreground fill with background ink: the one action that matters here.
        inverse: `bg-[color:var(--nessa-button-inverse-rest,var(--foreground))] text-[color:var(--nessa-button-inverse-ink,var(--background))] hover:bg-[color:var(--nessa-button-inverse-hover,color-mix(in_oklab,var(--nessa-button-inverse-rest,var(--foreground))_90%,transparent))] active:bg-[color:var(--nessa-button-inverse-press,color-mix(in_oklab,var(--nessa-button-inverse-rest,var(--foreground))_85%,transparent))] ${compactFocus}`,
        // Destructive ink with a destructive tint on hover: removes or revokes.
        danger: `text-[color:var(--nessa-button-danger-ink,var(--destructive))] hover:bg-[color:var(--nessa-button-danger-hover,color-mix(in_oklab,var(--nessa-button-danger-ink,var(--destructive))_var(--nessa-state-hover-strong),transparent))] active:bg-[color:var(--nessa-button-danger-press,color-mix(in_oklab,var(--nessa-button-danger-ink,var(--destructive))_var(--nessa-state-press),transparent))] ${compactFocus}`,
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
        // 22px sits under the 24px target-size floor, so it relies on the
        // spacing exception: keep 1px clear above and below it (a row of
        // pills side by side is fine), or use 24 where rows stack tightly.
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
      // Lets a long label wrap: the height becomes a minimum and the text
      // breaks anywhere it must, centred.
      wrap: {
        false: "",
        true: "h-auto whitespace-normal py-1 text-center [overflow-wrap:anywhere]",
      },
      // How a press reads: a 1px drop (the kit's default) or a slight shrink.
      press: {
        translate: "",
        scale: "active:translate-y-0 active:scale-[0.97]",
      },
    },
    compoundVariants: [
      { wrap: true, size: "default", className: "min-h-9" },
      { wrap: true, size: "sm", className: "min-h-8" },
      { wrap: true, size: "lg", className: "min-h-10" },
      { wrap: true, size: "30", className: "min-h-7.5" },
      { wrap: true, size: "28", className: "min-h-7" },
      { wrap: true, size: "26", className: "min-h-6.5" },
      { wrap: true, size: "24", className: "min-h-6 py-0.5" },
      { wrap: true, size: "22", className: "min-h-5.5 py-0.5" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
      wrap: false,
      press: "translate",
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
  /**
   * Lets a long label wrap onto more lines: the size's height becomes a
   * minimum. For text sizes, not the icon squares.
   * @defaultValue false
   */
  wrap?: boolean
  /**
   * How a press reads: `"translate"` drops the button 1px, `"scale"`
   * shrinks it slightly.
   * @defaultValue "translate"
   */
  press?: "translate" | "scale"
}

/**
 * The action primitive.
 *
 * Two families share it. The standard variants (`default`, `secondary`,
 * `outline`, `ghost`, `destructive`, `link`) at `sm`/`default`/`lg` sizes
 * are the form and dialog actions. The compact variants (`tinted`, `plain`,
 * `inverse`, `danger`) at the numeric heights (`22`–`30`) with
 * `shape="pill"` are the dense controls of toolbars, rows and headers; all
 * four take the 1.5px focus outline, and `tinted`, `plain` and `danger` draw
 * hover and press from the shared state tokens (`inverse` deepens its own
 * foreground fill). `tinted` and `plain` are the ones that toggle: a
 * selected one says so with `aria-pressed`, an open menu trigger with
 * `data-state="open"` (Radix triggers set it themselves), and both hold the
 * hover fill. `inverse` and `danger` are actions, with no selected look.
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
      wrap,
      press,
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
        className={cn(buttonVariants({ variant, size, shape, wrap, press, className }))}
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
