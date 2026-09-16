"use client"

import * as React from "react"

/**
 * Where a floating layer — a menu, a popover, a tooltip — puts its content.
 *
 * Portalling to the body is the right default for a layer on the page, and
 * the wrong one for a layer opened from inside a panel that owns a boundary.
 * A modal Sheet makes everything outside itself inert; a menu its own trigger
 * opened would land outside, be inerted by the very panel that raised it, and
 * arrive somewhere the panel's tab order and dismissal know nothing about.
 * Nothing about the menu is wrong in that picture — it simply portalled past
 * the boundary it belongs to.
 *
 * So the boundary says where. A panel that owns one mounts a container inside
 * itself and publishes it here; every Nessa floating layer reads it and
 * portals there instead of the body. The layer is then a descendant of the
 * panel, which is what makes the rest fall out for free: it is inside the
 * inert exemption because it is inside the panel, it paints above the panel's
 * own content because it is mounted after it, and focus moving into it is
 * focus that never left.
 *
 * A layer with no panel above it reads `null` and portals to the body, which
 * is the behavior everything had before this existed.
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null)

export interface PortalContainerProviderProps {
  /** The element floating layers below this point portal into. */
  container: HTMLElement | null
  children?: React.ReactNode
}

/**
 * Publishes a container to every floating layer rendered inside it.
 *
 * A panel provides this from the element it actually owns, which is why the
 * value is an element rather than a ref: the container mounts on the same
 * commit as the panel, and a ref read during render would still be null on
 * the render where the first layer could open.
 */
function PortalContainerProvider({
  container,
  children,
}: PortalContainerProviderProps) {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  )
}

/**
 * The container this floating layer should portal into.
 *
 * @param explicit - A container the caller passed. It wins outright, including
 * an explicit `null`, which is how a caller says "the body, whatever panel I
 * am inside" — a layer that must escape its panel's boundary on purpose.
 * `undefined` means the caller expressed no preference and inherits.
 * @returns The container, or null for the body.
 */
function usePortalContainer(
  explicit?: HTMLElement | null,
): HTMLElement | null {
  const inherited = React.useContext(PortalContainerContext)
  return explicit !== undefined ? explicit : inherited
}

/**
 * The container element a panel owns, and the node to render for it.
 *
 * Returned as state rather than a ref so that publishing it re-renders the
 * layers below: a ref would still read null on the commit where a layer first
 * asks, and that layer would portal to the body for the rest of its life.
 */
function usePortalContainerHost() {
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  return { container, setContainer }
}

export { PortalContainerProvider, usePortalContainer, usePortalContainerHost }
