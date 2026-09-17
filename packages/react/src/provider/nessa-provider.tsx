"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  PortalContainerProvider,
  usePortalContainerHost,
} from "@/lib/portal-container"
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
 * It owns one element in the tree it is rendered into — the scope, carrying
 * the attributes — and one boxless sibling beside it, where the floating
 * layers opened inside it land. It does not touch `documentElement`, it does
 * not touch `body`, and it writes no layout rules — a design system that
 * reached for the document would be unable to appear twice on one page, or
 * inside a host that owns its own root.
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

  // Only an unsupplied `system` request listens. A controlled resolution is
  // the application's answer and Nessa must not second-guess it; an explicit
  // light or dark has nothing to follow.
  const followsSystem =
    mode === NessaColorMode.System && suppliedResolvedMode === undefined

  // The appearance `system` last resolved to. Seeded from the application's
  // value where there is one, so a server-rendered dark page hydrates dark
  // instead of flashing light on the way to the same answer.
  const [systemResolved, setSystemResolved] = React.useState<NessaResolvedColorMode>(
    suppliedResolvedMode ?? defaultResolvedMode ?? NessaColorMode.Light,
  )

  // The appearance actually committed, whatever produced it.
  //
  // Written in an effect rather than during render, so a concurrent render
  // that React throws away cannot leave its appearance behind as the
  // committed one. Read during render only by the handoff below, and only for
  // the value the last commit put on screen.
  const committedResolved = React.useRef<NessaResolvedColorMode>(
    mode === NessaColorMode.System
      ? (suppliedResolvedMode ?? defaultResolvedMode ?? NessaColorMode.Light)
      : mode,
  )

  // Entering unsupplied `system` hands over to what is on screen rather than
  // to the initial seed: the seed answers "what should the first paint be",
  // which is a different question from "what is on screen right now", and a
  // Dark page switching to `system` under a Dark OS would otherwise publish
  // Dark → Light → Dark and flash white on the way to the answer it already
  // had. `matchMedia` is sampled in the effect below, a commit later; until
  // then the committed appearance is a better answer than a stale seed.
  //
  // Adjusted during render, not in an effect. An effect runs after the commit,
  // so the wrong appearance would already be on the element and in context by
  // the time it could repair anything — the very transition being avoided.
  // Re-rendering from the render phase is React's own answer to exactly this:
  // the intermediate output is discarded rather than committed, so nothing
  // downstream ever sees the stale value.
  const [wasFollowingSystem, setWasFollowingSystem] = React.useState(followsSystem)
  if (followsSystem !== wasFollowingSystem) {
    setWasFollowingSystem(followsSystem)
    if (followsSystem && systemResolved !== committedResolved.current) {
      setSystemResolved(committedResolved.current)
    }
  }

  const resolvedMode: NessaResolvedColorMode =
    mode === NessaColorMode.System
      ? (suppliedResolvedMode ?? systemResolved)
      : mode

  React.useEffect(() => {
    committedResolved.current = resolvedMode
  }, [resolvedMode])

  React.useEffect(() => {
    if (!followsSystem || typeof window === "undefined" || !window.matchMedia) {
      return
    }
    const media = window.matchMedia(darkSchemeQuery)
    // Sampled synchronously as well as subscribed: between the render that
    // entered `system` and this effect the OS may already disagree with the
    // handoff, and waiting for a change event would leave the wrong appearance
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
  // Where floating layers land when nothing nearer owns one. A menu portalled
  // to the body leaves the scope entirely: its content keeps the semantic
  // class names but none of the `data-nessa-*` attributes those tokens are
  // declared on, so a picker opened inside a Dark provider on a Light page
  // renders light. Panels that own a boundary — a Sheet, a reading view —
  // still publish their own container nearer the layer and keep it, because
  // routing their layers out here would undo their inertness and focus
  // boundaries.
  const { container: layerHost, setContainer: setLayerHost } = usePortalContainerHost()

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
        <PortalContainerProvider container={layerHost}>
          {element}
          <NessaLayerHost
            theme={theme}
            resolvedMode={resolvedMode}
            scale={scale}
            ref={setLayerHost}
          />
        </PortalContainerProvider>
      </NessaColorModeContext.Provider>
    </NessaThemeContext.Provider>
  )
}

/** The `color-scheme` utility each resolved appearance carries. */
const layerColorSchemeClassName = {
  light: "scheme-light",
  dark: "scheme-dark",
} as const

/**
 * The element provider-level floating layers portal into.
 *
 * A sibling of the scope, not a child of it, because theme ownership and
 * clipping ownership are not the same job. The element a host hands the
 * provider is where that host puts its own `overflow: hidden`, its
 * `transform`, its flex row — all reasonable things to put on a page region,
 * and all things a menu must not inherit. Nested inside the scope, this host
 * would have made the provider's root the clipping and containing-block
 * ancestor of every layer opened in the tree: a transformed root turns a
 * fixed-position menu into its descendant and clips it, which is not
 * something adopting the provider should do to a page.
 *
 * It still carries the theme, because it sits inside nothing that could give
 * it one: the same `data-nessa-theme`, `data-nessa-mode` and
 * `data-nessa-scale` the scope writes, so a layer that reads its tokens here
 * reads the same answers as the content that opened it.
 *
 * `contents` keeps it from generating a box at all. An ordinary `div` is a
 * flex or grid item wherever the provider was mounted, so an empty layer host
 * would move a page's content by a gap's width without anything being open;
 * a boxless one introduces no layout, no stacking context and no containing
 * block, and leaves positioning exactly as it was.
 */
function NessaLayerHost({
  theme,
  resolvedMode,
  scale,
  ref,
}: {
  theme: NessaThemeName
  resolvedMode: NessaResolvedColorMode
  scale: NessaScale
  ref: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      // Boxless, and carrying the appearance the scope resolved: `contents`
      // so it lays nothing out, `scheme-*` so the scrollbars and controls of
      // a layer opened here agree with its tokens, exactly as they do inside
      // the scope itself.
      className={cn("contents", layerColorSchemeClassName[resolvedMode])}
      data-slot="nessa-layers"
      data-nessa-theme={theme}
      data-nessa-mode={resolvedMode}
      data-nessa-scale={scale}
      ref={ref}
    />
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
