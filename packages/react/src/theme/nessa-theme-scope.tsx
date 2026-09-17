"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useNessaColorMode } from "@/provider/nessa-color-mode"
import {
  NessaThemeContext,
  applyScopeProps,
  useNessaScopeElement,
  type NessaRootElementProps,
  type NessaScale,
  type NessaThemeName,
} from "@/provider/nessa-scope"

/**
 * A nested region with its own theme, its own scale, or both.
 *
 * It re-emits the resolved mode onto its own element, which is what makes
 * nesting work at all: every dark token selector matches an attribute on the
 * *nearest* scope rather than on any dark ancestor, so a theme scope inside a
 * dark root is not silently dark by inheritance. It is whatever the mode
 * resolves to, recorded where the selectors can see it.
 *
 * A scale-only scope needs no mode attribute — it changes sizes, not colours —
 * so it does not emit one and does not re-anchor the mode selectors.
 */

/**
 * At least one of theme or scale, because a scope that changes neither is a
 * `div` and should be written as one.
 */
type NessaThemeScopeSelection =
  | { theme: NessaThemeName; scale?: NessaScale }
  | { theme?: never; scale: NessaScale }

export type NessaThemeScopeProps = NessaThemeScopeSelection &
  NessaRootElementProps & {
    className?: string
    style?: React.CSSProperties
    ref?: React.Ref<HTMLElement>
  }

function NessaThemeScope({
  theme,
  scale,
  className,
  style,
  ref,
  children,
  asChild,
}: NessaThemeScopeProps) {
  // Throws outside a provider, deliberately. A theme scope with no resolved
  // mode to re-emit would anchor its dark selectors to nothing, and the
  // failure would show up as a region that ignores dark mode rather than as
  // a missing provider.
  const { resolvedMode } = useNessaColorMode()
  const parent = React.useContext(NessaThemeContext)
  const state = React.useMemo(
    () => ({
      theme: theme ?? parent?.theme ?? "default",
      // Absolute, not multiplied: a nested scope that scaled its parent's
      // scale would compound, and two 110% scopes would land somewhere nobody
      // chose.
      scale: scale ?? parent?.scale ?? ("100" as NessaScale),
    }),
    [parent?.scale, parent?.theme, scale, theme],
  )

  const element = useNessaScopeElement({
    asChild,
    children,
    ref,
    props: applyScopeProps({
      "data-nessa-theme": theme,
      // Only a theme-bearing scope re-anchors the mode selectors. A
      // scale-only scope changes no colours, so emitting the attribute would
      // add a selector boundary for nothing.
      "data-nessa-mode": theme === undefined ? undefined : resolvedMode,
      "data-nessa-scale": scale,
      className: cn(className),
      style,
    }),
    scopeName: "NessaThemeScope",
  })

  return (
    <NessaThemeContext.Provider value={state}>{element}</NessaThemeContext.Provider>
  )
}

/** Reads the enclosing theme scope's identity. */
function useNessaTheme() {
  const state = React.useContext(NessaThemeContext)
  if (!state) {
    throw new Error(
      "useNessaTheme must be used inside a NessaProvider or NessaThemeScope.",
    )
  }
  return state
}

export { NessaThemeScope, useNessaTheme }
