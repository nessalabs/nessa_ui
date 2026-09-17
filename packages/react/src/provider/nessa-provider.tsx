"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  NessaColorMode,
  NessaColorModeContext,
  darkSchemeQuery,
  type NessaColorModeState,
  type NessaResolvedColorMode,
} from "./nessa-color-mode"
import {
  NessaScale,
  NessaThemeContext,
  applyScopeProps,
  useNessaScopeElement,
  type NessaRootElementProps,
  type NessaScopeOwnProps,
  type NessaThemeName,
} from "./nessa-scope"

/**
 * The root of a Nessa tree: one element carrying the theme, the resolved
 * appearance, and the scale, and one context publishing the mode to whatever
 * inside needs to render in it.
 *
 * It owns exactly one DOM element and nothing else. It does not touch
 * `documentElement`, it does not touch `body`, and it writes no layout rules —
 * a design system that reached for the document would be unable to appear
 * twice on one page, or inside a host that owns its own root.
 *
 * `data-nessa-mode` is the contract every dark token selector matches, and it
 * is always `light` or `dark`. A `system` *request* stays in React state; what
 * the DOM records is what it resolved to. That is what lets a light scope sit
 * inside a dark one and resolve independently: the selector matches the
 * nearest scope's own attribute rather than any dark ancestor.
 */

export type NessaControlledColorMode = {
  mode: NessaColorMode
  /**
   * The appearance the application resolved `system` to, typically from a
   * server-rendered cookie. Supplying it means Nessa registers no media
   * listener at all and takes the application's word.
   */
  resolvedMode?: NessaResolvedColorMode
  onModeChange: (mode: NessaColorMode) => void
  defaultMode?: never
  defaultResolvedMode?: never
}

export type NessaUncontrolledColorMode = {
  mode?: never
  resolvedMode?: never
  defaultMode?: NessaColorMode
  /**
   * What `system` renders as on the server and the first client render,
   * before `matchMedia` can be consulted. An initial-state input only:
   * changing it later does nothing, and re-entering `system` never reuses it.
   */
  defaultResolvedMode?: NessaResolvedColorMode
  onModeChange?: (mode: NessaColorMode) => void
}

export type NessaProviderProps = NessaScopeOwnProps &
  NessaRootElementProps &
  (NessaControlledColorMode | NessaUncontrolledColorMode) & {
    theme?: NessaThemeName
  }

function NessaProvider({
  theme = "default",
  scale = NessaScale.Default,
  className,
  style,
  ref,
  children,
  asChild,
  ...colorMode
}: NessaProviderProps) {
  const {
    mode: controlledMode,
    resolvedMode: suppliedResolvedMode,
    defaultMode,
    defaultResolvedMode,
    onModeChange,
    // Read through one permissive shape rather than the discriminated union.
    // Intersecting the two would give `onModeChange` a type that is both
    // optional and required and callable as neither; the union's job is to
    // stop a *caller* mixing controlled and uncontrolled props, and it has
    // already done that by the time the props are here.
  } = colorMode as {
    mode?: NessaColorMode
    resolvedMode?: NessaResolvedColorMode
    defaultMode?: NessaColorMode
    defaultResolvedMode?: NessaResolvedColorMode
    onModeChange?: (mode: NessaColorMode) => void
  }

  const isControlled = controlledMode !== undefined
  const [uncontrolledMode, setUncontrolledMode] = React.useState<NessaColorMode>(
    defaultMode ?? NessaColorMode.System,
  )
  const mode = isControlled ? controlledMode : uncontrolledMode

  // The appearance `system` last resolved to. Seeded from the application's
  // value where there is one, so a server-rendered dark page hydrates dark
  // instead of flashing light on the way to the same answer.
  const [systemResolved, setSystemResolved] = React.useState<NessaResolvedColorMode>(
    suppliedResolvedMode ?? defaultResolvedMode ?? NessaColorMode.Light,
  )

  const resolvedMode: NessaResolvedColorMode =
    mode === NessaColorMode.System
      ? (suppliedResolvedMode ?? systemResolved)
      : mode

  // Only an unsupplied `system` request listens. A controlled resolution is
  // the application's answer and Nessa must not second-guess it; an explicit
  // light or dark has nothing to follow.
  const followsSystem =
    mode === NessaColorMode.System && suppliedResolvedMode === undefined
  React.useEffect(() => {
    if (!followsSystem || typeof window === "undefined" || !window.matchMedia) {
      return
    }
    const media = window.matchMedia(darkSchemeQuery)
    // Sampled synchronously as well as subscribed: between the render that
    // entered `system` and this effect the OS may already disagree with the
    // seed, and waiting for a change event would leave the wrong appearance
    // on screen until the user changed their mind.
    setSystemResolved(media.matches ? NessaColorMode.Dark : NessaColorMode.Light)
    // A generation, so an event queued before a mode change cannot commit
    // after it. Leaving `system` invalidates the listener on the way out;
    // without this a late event would drag an explicit Light back to Dark.
    let current = true
    const onChange = (event: MediaQueryListEvent) => {
      if (!current) return
      setSystemResolved(event.matches ? NessaColorMode.Dark : NessaColorMode.Light)
    }
    media.addEventListener("change", onChange)
    return () => {
      current = false
      media.removeEventListener("change", onChange)
    }
  }, [followsSystem])

  const setMode = React.useCallback(
    (next: NessaColorMode) => {
      if (!isControlled) setUncontrolledMode(next)
      onModeChange?.(next)
    },
    [isControlled, onModeChange],
  )

  const colorModeState = React.useMemo<NessaColorModeState>(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode, setMode],
  )
  const themeState = React.useMemo(() => ({ theme, scale }), [scale, theme])

  useControlledModeWarning(isControlled)
  useResolutionPropWarning(mode, suppliedResolvedMode, defaultResolvedMode)

  const element = useNessaScopeElement({
    asChild,
    children,
    ref,
    props: applyScopeProps({
      "data-nessa-root": "",
      "data-nessa-theme": theme,
      "data-nessa-mode": resolvedMode,
      "data-nessa-scale": scale,
      className: cn(className),
      // Nessa keeps ownership of `color-scheme` even when a host supplies
      // styles: it is what makes form controls, scrollbars and the canvas
      // itself agree with the tokens, and a scope whose controls disagree
      // with its surface reads as broken rather than as themed.
      style: { ...style, colorScheme: resolvedMode },
    }),
    scopeName: "NessaProvider",
  })

  return (
    <NessaThemeContext.Provider value={themeState}>
      <NessaColorModeContext.Provider value={colorModeState}>
        {element}
      </NessaColorModeContext.Provider>
    </NessaThemeContext.Provider>
  )
}

/** Warns once when a host switches between controlled and uncontrolled mode. */
function useControlledModeWarning(isControlled: boolean) {
  const initial = React.useRef(isControlled)
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (initial.current === isControlled) return
    const was = initial.current
    initial.current = isControlled
    console.warn(
      `NessaProvider changed from ${was ? "controlled" : "uncontrolled"} to ${isControlled ? "controlled" : "uncontrolled"} mode. Pick one for the life of the provider: supply \`mode\` with \`onModeChange\`, or supply neither.`,
    )
  }, [isControlled])
}

/**
 * Warns when a resolution prop is supplied alongside an explicit mode, where
 * it means nothing and is almost always a mistaken attempt to force an
 * appearance.
 */
function useResolutionPropWarning(
  mode: NessaColorMode,
  resolvedMode: NessaResolvedColorMode | undefined,
  defaultResolvedMode: NessaResolvedColorMode | undefined,
) {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (mode === NessaColorMode.System) return
    if (resolvedMode === undefined && defaultResolvedMode === undefined) return
    console.warn(
      `NessaProvider ignores \`resolvedMode\`/\`defaultResolvedMode\` while \`mode\` is "${mode}": they only answer what "system" resolves to. Set \`mode\` itself to force an appearance.`,
    )
  }, [defaultResolvedMode, mode, resolvedMode])
}

export { NessaProvider }
