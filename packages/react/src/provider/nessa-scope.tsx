"use client"

import * as React from "react"
import { Slot } from "radix-ui"

/**
 * The parts a Nessa root and a nested theme scope share: what they put on
 * their element, and how they decide which element that is.
 *
 * Both render exactly one element carrying `data-nessa-*` attributes, and
 * both let a host supply that element with `asChild` rather than adding a
 * wrapper to a tree that already has a root. Keeping the mechanics here means
 * the two cannot drift on ownership rules — whose className wins, whose
 * attributes win, what happens to a style a host also set.
 */

/**
 * The finite set of UI sizes, as a preset rather than an arbitrary multiplier.
 * A number a host could type freely would make every component's geometry a
 * per-application question.
 */
export const NessaScale = {
  Smaller: "90",
  Small: "95",
  Default: "100",
  Large: "105",
  Larger: "110",
  Largest: "125",
} as const

export type NessaScale = (typeof NessaScale)[keyof typeof NessaScale]

/** Theme names are open strings: a host may publish its own. */
export type NessaThemeName = string

export interface NessaThemeState {
  theme: NessaThemeName
  scale: NessaScale
}

/** Theme identity, for the few surfaces that need to know which theme they are in. */
export const NessaThemeContext = React.createContext<NessaThemeState | null>(null)

export interface NessaScopeOwnProps {
  scale?: NessaScale
  className?: string
  style?: React.CSSProperties
  ref?: React.Ref<HTMLElement>
}

/**
 * Either Nessa renders its own element, or the host hands one over.
 *
 * `asChild` takes exactly one element, which is a type-level constraint
 * rather than advice: text has no attributes to carry, and two children would
 * leave the scope's identity ambiguous.
 */
export type NessaRootElementProps =
  | { asChild: true; children: React.ReactElement }
  | { asChild?: false; children?: React.ReactNode }

/** The attributes a scope owns, with anything undefined dropped. */
export function applyScopeProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  )
}

interface ScopeElementOptions {
  asChild?: boolean
  children?: React.ReactNode
  ref?: React.Ref<HTMLElement>
  props: Record<string, unknown>
  scopeName: string
}

/**
 * Renders the scope's single element: Nessa's own `div`, or the host's child.
 *
 * @returns The element, with the scope's attributes applied last so they win.
 */
export function useNessaScopeElement({
  asChild,
  children,
  ref,
  props,
  scopeName,
}: ScopeElementOptions): React.ReactElement {
  useFragmentGuard(asChild, children, scopeName)
  useExistingScopeAttributeGuard(asChild, children, scopeName)
  if (asChild) {
    return (
      <Slot.Root {...props} ref={ref}>
        {children as React.ReactElement}
      </Slot.Root>
    )
  }
  return (
    <div {...props} ref={ref as React.Ref<HTMLDivElement>}>
      {children}
    </div>
  )
}

/**
 * A Fragment has no element to carry the scope, so `asChild` onto one
 * silently produces a tree with no theme at all — the failure looks like a
 * styling bug rather than a composition one.
 */
function useFragmentGuard(
  asChild: boolean | undefined,
  children: React.ReactNode,
  scopeName: string,
) {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || !asChild) return
    if (React.isValidElement(children) && children.type !== React.Fragment) return
    console.warn(
      `${scopeName} with \`asChild\` needs one element that renders a DOM node; a Fragment has nothing to put the scope's attributes on.`,
    )
  }, [asChild, children, scopeName])
}

/**
 * A child that already carries `data-nessa-*` is being overwritten, and the
 * host deserves to know which of the two values is going to win.
 */
function useExistingScopeAttributeGuard(
  asChild: boolean | undefined,
  children: React.ReactNode,
  scopeName: string,
) {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || !asChild) return
    if (!React.isValidElement(children)) return
    const childProps = children.props as Record<string, unknown>
    const existing = Object.keys(childProps).filter((key) =>
      key.startsWith("data-nessa-"),
    )
    if (!existing.length) return
    console.warn(
      `${scopeName} owns ${existing.join(", ")} and is replacing the value on its \`asChild\` child.`,
    )
  }, [asChild, children, scopeName])
}
