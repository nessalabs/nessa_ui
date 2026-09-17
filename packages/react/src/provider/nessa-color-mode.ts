"use client"

import * as React from "react"

/**
 * What a host asks Nessa to look like, and what Nessa resolved that to.
 *
 * The two are not the same value, and keeping them apart is the whole point.
 * `System` is a *request* — it means "follow the operating system" — and it
 * never reaches the DOM. What reaches the DOM is the resolution: light or
 * dark, never system. A DOM contract that could say "system" would leave
 * every selector asking a second question.
 */
export const NessaColorMode = {
  Light: "light",
  Dark: "dark",
  System: "system",
} as const

export type NessaColorMode =
  (typeof NessaColorMode)[keyof typeof NessaColorMode]

/** The two appearances a scope can actually be in. */
export type NessaResolvedColorMode =
  | typeof NessaColorMode.Light
  | typeof NessaColorMode.Dark

export interface NessaColorModeState {
  /** What was asked for, which may be `system`. */
  mode: NessaColorMode
  /** What that resolved to. Never `system`. */
  resolvedMode: NessaResolvedColorMode
  setMode: (mode: NessaColorMode) => void
}

/**
 * The resolved mode, published to everything inside a provider.
 *
 * `null` rather than a default state: a component reading this outside a
 * provider has a real problem — it is about to style itself against a mode
 * nobody chose — and a plausible-looking default would hide that.
 */
export const NessaColorModeContext =
  React.createContext<NessaColorModeState | null>(null)

/** The media query the `system` request follows. */
export const darkSchemeQuery = "(prefers-color-scheme: dark)"

/**
 * Reads the enclosing provider's requested and resolved mode.
 *
 * Components that only need to *look* right need none of this — that is what
 * the tokens are for. This is for the few that render something themselves in
 * one appearance or the other: a syntax highlighter choosing a theme, a
 * diagram renderer picking its palette.
 *
 * @throws When used outside a `NessaProvider`.
 */
export function useNessaColorMode(): NessaColorModeState {
  const state = React.useContext(NessaColorModeContext)
  if (!state) {
    throw new Error(
      "useNessaColorMode must be used inside a NessaProvider. Wrap the tree in <NessaProvider> so there is a resolved mode to read.",
    )
  }
  return state
}

/**
 * The resolved mode, or null outside a provider.
 *
 * For components that must keep working without one. A code block in an
 * application that has not adopted the provider still has to pick a syntax
 * theme, and throwing at it would make adoption all-or-nothing.
 */
export function useOptionalNessaColorMode(): NessaColorModeState | null {
  return React.useContext(NessaColorModeContext)
}
