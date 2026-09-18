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
/**
 * The theme a floating layer carries with it.
 *
 * The layer's own element wears these, wherever it lands. That is the half of
 * the problem the container does not solve: a menu portalled to the body keeps
 * its semantic class names but leaves behind the `data-nessa-*` attributes the
 * tokens those names read are declared on, so a picker opened inside a Dark
 * provider on a Light page renders light.
 *
 * Carrying the theme is deliberately not the same as moving the layer.
 * Relocating it under the scope would theme it by ancestry and, in the same
 * move, hand the scope's `overflow`, `transform` and layout to a menu that
 * wants none of them. These attributes travel instead; where the layer lands
 * stays the container's question.
 */
export interface NessaLayerScope {
  "data-nessa-theme"?: string
  "data-nessa-mode"?: string
  "data-nessa-scale"?: string
}

interface PortalContainerState {
  container: HTMLElement | null
  scope: NessaLayerScope
}

const emptyLayerScope: NessaLayerScope = {}

const PortalContainerContext = React.createContext<PortalContainerState>({
  container: null,
  scope: emptyLayerScope,
})

export interface PortalContainerProviderProps {
  /** The element floating layers below this point portal into. */
  container: HTMLElement | null
  /**
   * The theme layers below this point carry. Omitted by a panel, which owns
   * where its layers land but not what they look like: the scope it is
   * itself inside is already the right answer, and inherits.
   */
  scope?: NessaLayerScope
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
  scope,
  children,
}: PortalContainerProviderProps) {
  const inherited = React.useContext(PortalContainerContext)
  const inheritedScope = inherited.scope
  const value = React.useMemo(
    () => ({ container, scope: scope ?? inheritedScope }),
    [container, inheritedScope, scope],
  )
  return (
    <PortalContainerContext.Provider value={value}>
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
  const { container } = React.useContext(PortalContainerContext)
  return explicit !== undefined ? explicit : container
}

/**
 * The attributes this floating layer puts on its own element.
 *
 * Spread onto the element the layer actually draws — the content, not the
 * portal — so the tokens resolve there however far from the scope it landed.
 * Empty outside a provider, where there is no theme to carry and the layer
 * behaves exactly as it did before one existed.
 */
function useNessaLayerScope(): NessaLayerScope {
  return React.useContext(PortalContainerContext).scope
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

export {
  PortalContainerProvider,
  useNessaLayerScope,
  usePortalContainer,
  usePortalContainerHost,
}
