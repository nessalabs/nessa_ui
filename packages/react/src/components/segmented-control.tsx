"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { flushSync } from "react-dom"

import { useComposedRefs } from "@/lib/compose"
import { observeSize, type SizeChangeCause } from "@/lib/size-observer"
import { cn } from "@/lib/utils"

import { Button } from "./button"

type SegmentedControlVariant = NonNullable<
  VariantProps<typeof segmentedShellVariants>["variant"]
>

interface SegmentedControlContextValue {
  value: string | null
  setValue: (value: string) => void
  variant: SegmentedControlVariant
}

const SegmentedControlContext =
  React.createContext<SegmentedControlContextValue | null>(null)

/**
 * Creates the class names for the bordered strip a set of compact choices
 * sits in.
 *
 * Shared with `TabsList`'s pill presentation, which renders the same shell:
 * two strips a reader sees as one control should not be painted from two
 * literals that drift apart. Exported as a variants function rather than a
 * class constant so it stays statically validatable in the consuming module,
 * the way `popoverSurfaceVariants` is.
 *
 * @returns The composed class-name string for a segmented strip.
 */
const segmentedShellVariants = cva(
  "flex items-center gap-0.5 rounded-lg",
  {
    variants: {
      variant: {
        /** The default strip: a bordered pill holding its options. */
        outlined: "border border-border p-0.5",
        /**
         * No strip at all — the options sit directly on the surface behind
         * them. For a row of choices that is already framed by its container,
         * such as a chart's own control bar.
         */
        bare: "",
        /**
         * A translucent track the selected option's lens slides along. The
         * track is a faint tint of the foreground with a hairline edge, and
         * blurs whatever it floats over; the lens itself is drawn by the
         * control, not by this shell.
         *
         * The track also names the lens's paint: the page's own background
         * on a light scheme, a lifted tint of the foreground on a dark one,
         * so the chosen option always reads as the brightest thing on the
         * track. The lens and, until the lens is placed, the pressed option
         * both paint from it.
         */
        glass: [
          "relative isolate w-fit gap-0 rounded-full bg-foreground/[0.045] p-0.5 inset-ring inset-ring-foreground/[0.07] backdrop-blur-xl backdrop-saturate-150",
          "[--nessa-segmented-lens:light-dark(var(--background),color-mix(in_oklab,var(--foreground)_15%,transparent))]",
        ],
      },
    },
    defaultVariants: { variant: "outlined" },
  },
)

/**
 * The lens: the lifted fill, a hairline rim, and a one-pixel specular edge
 * along its top that only shows where the fill is dark enough to need it.
 * The transparent border draws nothing until forced colours replace it, which
 * is what keeps the selection visible when backgrounds are stripped. Its box
 * is the pressed option's, measured, so it follows whatever padding the track
 * is given.
 */
const glassLensClassName = cn(
  "pointer-events-none absolute left-0 top-0 z-0 box-border rounded-full border border-transparent bg-(--nessa-segmented-lens)",
  "shadow-xs inset-ring inset-ring-foreground/[0.06] inset-shadow-[0_1px_0_light-dark(transparent,color-mix(in_oklab,var(--foreground)_12%,transparent))]",
  // It glides only between options. Placement on mount, on resize, and when
  // the options change lands at once: a lens that chased a resizing track
  // would read as lag, not motion. The duration and easing utilities feed the
  // transition utility's own variables, so the tokens reach the glide however
  // the variants around it resolve.
  "transition-none duration-(--nessa-motion-duration-slow) ease-(--nessa-motion-easing-standard) motion-safe:data-[animate]:transition-[transform,width,height]",
)

/** Why the lens was placed: the development trace records it. */
type LensCause = "mount" | "value" | SizeChangeCause

/**
 * What a placement did to the lens, for the development trace: `placed` and
 * `glide` move it (at once, or animated), `kept` leaves it where it already
 * is, and `cleared` and `none` mean no option is pressed.
 */
type LensOutcome = "placed" | "glide" | "kept" | "cleared" | "none"

interface LensGeometry {
  x: number
  y: number
  width: number
  height: number
  animate: boolean
}

/**
 * `useLayoutEffect` on the client, `useEffect` on the server: the lens must be
 * placed before the first paint, and warning about that during SSR does not
 * help.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

const optionSelector = '[data-slot="segmented-control-option"]'

/** The options that belong to this track, not to a control nested inside it. */
function ownOptions(track: Element) {
  return Array.from(
    track.querySelectorAll<HTMLElement>(optionSelector),
  ).filter(
    (option) => option.closest('[data-slot="segmented-control"]') === track,
  )
}

/**
 * Where the pressed option sits inside the track, in the track's own
 * untransformed pixels, or `null` when no option is pressed. Bounding
 * rectangles keep the subpixel widths text produces, which rounded `offset*`
 * values would lose. An ancestor's scale shows as the rendered width parting
 * from the layout width, and is divided back out — but only past a whole
 * pixel, because `offsetWidth` is itself rounded and a sub-pixel difference is
 * that rounding, not a transform. The vertical offset comes from layout
 * instead: a held option is nudged down a pixel by a transform, and a
 * placement taken mid-press must not keep that nudge after it is released.
 */
function measurePressed(track: HTMLElement) {
  const pressed = ownOptions(track).find(
    (option) => option.getAttribute("aria-pressed") === "true",
  )
  if (!pressed) return null
  const trackBox = track.getBoundingClientRect()
  const box = pressed.getBoundingClientRect()
  const scaled =
    track.offsetWidth > 0 && Math.abs(trackBox.width - track.offsetWidth) >= 1
  const ratio = scaled ? trackBox.width / track.offsetWidth : 1
  return {
    x: (box.left - trackBox.left) / ratio - track.clientLeft,
    y:
      pressed.offsetParent === track
        ? pressed.offsetTop
        : (box.top - trackBox.top) / ratio - track.clientTop,
    width: box.width / ratio,
    height: box.height / ratio,
  }
}

/** Whether two measurements put the lens in the same place. */
function sameGeometry(
  a: Omit<LensGeometry, "animate">,
  b: Omit<LensGeometry, "animate">,
) {
  return (
    Math.abs(a.x - b.x) < 0.01 &&
    Math.abs(a.y - b.y) < 0.01 &&
    Math.abs(a.width - b.width) < 0.01 &&
    Math.abs(a.height - b.height) < 0.01
  )
}

type SegmentedControlTraceHost = {
  __nessaSegmentedControl?: Record<string, unknown>
}

export interface SegmentedControlProps
  extends Omit<React.ComponentProps<"div">, "onChange">,
    VariantProps<typeof segmentedShellVariants> {
  /** Controlled selected option value. */
  value?: string
  /** Initial selected option when uncontrolled. */
  defaultValue?: string
  /** Fires with the newly selected option value. */
  onValueChange?: (value: string) => void
  /**
   * Development tooling for the `glass` lens: records every selection, every
   * placement (its cause — mount, value, resize, options — what it did —
   * placed, glide, kept, cleared — and the geometry), and the lens's own
   * transitions running, ending, or being cancelled, into a ring buffer
   * published at `window.__nessaSegmentedControl[<instance id>]` with a
   * `snapshot()` of the live lens. So "did a resize cut the glide short?" is
   * read from the trace rather than from a recording. No-op unless set.
   */
  debug?: boolean
}

/**
 * A compact single-choice switcher: a row of pressed/unpressed buttons, the
 * pattern used for view and scale toggles across Nessa's toolbars. One option
 * is always selected; choosing another moves the pressed state and fires
 * `onValueChange`. Give the group an `aria-label` naming the choice it
 * controls. Each option is its own tab stop and is chosen with Enter or Space,
 * in every variant.
 *
 * The `outlined` default draws the bordered pill the toolbars use; `bare`
 * drops the strip for a row already framed by its container, such as the
 * range tabs inside a chart's own control bar. `glass` sets the options on a
 * translucent track and carries the selection on a lens that slides between
 * them. The lens is measured from the pressed option before first paint and
 * again whenever the track or an option resizes, the options change, or
 * their direction, class or style on the control changes, so
 * labels of any width land exactly; it glides only when the selection moves
 * and holds still under `prefers-reduced-motion`. A glass control is not
 * meant to be nested inside another one's track.
 */
function SegmentedControl({
  className,
  variant,
  value: valueProp,
  defaultValue,
  onValueChange,
  debug = false,
  ref: forwardedRef,
  children,
  ...props
}: SegmentedControlProps) {
  const resolvedVariant: SegmentedControlVariant = variant ?? "outlined"
  const glass = resolvedVariant === "glass"
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    string | null
  >(defaultValue ?? null)
  const value = valueProp !== undefined ? valueProp : uncontrolledValue

  const instanceId = React.useId()
  const trackRef = React.useRef<HTMLDivElement>(null)
  const composedRef = useComposedRefs(trackRef, forwardedRef)
  const [lens, setLens] = React.useState<LensGeometry | null>(null)
  // The placement logic's own record of the lens, written with every state
  // update it makes: two placements in one batch (mount and value on the
  // first layout pass) must see each other, which rendered state cannot.
  const lensRef = React.useRef<LensGeometry | null>(null)

  /** Dev-only event ring buffer; null unless `debug`, so every call site is
   * a single optional chain. */
  const traceBufferRef = React.useRef<Record<string, unknown>[]>([])
  const traceRef = React.useRef<
    ((entry: Record<string, unknown>) => void) | null
  >(null)
  traceRef.current = debug
    ? (entry) => {
        const buffer = traceBufferRef.current
        buffer.push({ t: Math.round(performance.now()), ...entry })
        if (buffer.length > 4000) buffer.splice(0, buffer.length - 4000)
      }
    : null

  const placeLens = React.useCallback((cause: LensCause) => {
    const track = trackRef.current
    if (!track) return
    const measured = measurePressed(track)
    const previous = lensRef.current
    let next: LensGeometry | null
    let outcome: LensOutcome
    if (!measured) {
      next = null
      outcome = previous ? "cleared" : "none"
    } else if (previous && sameGeometry(previous, measured)) {
      // Unchanged geometry keeps the running glide: a resize observer's
      // first report arrives just after a selection starts moving the lens,
      // and treating it as a placement would cut the glide short.
      next = previous
      outcome = "kept"
    } else {
      const animate = cause === "value" && previous !== null
      next = { ...measured, animate }
      outcome = animate ? "glide" : "placed"
    }
    traceRef.current?.({ ev: "place", cause, outcome, ...measured })
    if (next === previous) return
    lensRef.current = next
    if (cause !== "mount" && cause !== "value") {
      // An observer reports inside the frame it measured, so the lens has to
      // move in that frame too. A default-priority update would render in a
      // later task and let this frame paint the lens where it used to be —
      // one frame behind for as long as the track keeps resizing.
      flushSync(() => setLens(next))
    } else {
      // Called from a layout effect, which already commits before paint.
      setLens(next)
    }
  }, [])

  // The observers belong to the track, not to a selection: they follow the
  // geometry the lens depends on for as long as the control is glass.
  useIsomorphicLayoutEffect(() => {
    const track = trackRef.current
    if (!glass || !track) {
      lensRef.current = null
      setLens(null)
      return
    }
    placeLens("mount")
    // A track can hold its size while one option grows and its neighbour
    // shifts, so the options are followed as well as the track. Options can
    // also move without any box changing size — a `dir` flip mirrors them, a
    // class or style change can reorder them — and a web font landing changes
    // their widths where WebKit reports no resize at all (seen in CI: a lens
    // 82px wide over a 77.6px option). The shared observer covers all of it.
    return observeSize(track, placeLens, { boxes: ownOptions })
  }, [glass, placeLens])

  // The pressed state is committed to the options before this runs, so the
  // measurement reads the newly chosen option.
  useIsomorphicLayoutEffect(() => {
    if (glass) placeLens("value")
  }, [glass, value, placeLens])

  React.useEffect(() => {
    if (!debug) return
    const host = window as unknown as SegmentedControlTraceHost
    host.__nessaSegmentedControl = host.__nessaSegmentedControl ?? {}
    host.__nessaSegmentedControl[instanceId] = {
      events: traceBufferRef.current,
      snapshot: () => ({
        lens: lensRef.current,
        track: trackRef.current?.getBoundingClientRect().width ?? null,
        visibility: document.visibilityState,
      }),
    }
    // The lens's own transitions, so a glide that was cut short reads as a
    // `transitioncancel` rather than as a guess from a recording.
    const track = trackRef.current
    const onTransition = (event: TransitionEvent) => {
      const target = event.target as Element | null
      if (target?.getAttribute("data-slot") !== "segmented-control-lens") return
      traceRef.current?.({
        ev: event.type,
        property: event.propertyName,
        elapsed: Math.round(event.elapsedTime * 1000),
      })
    }
    const kinds = ["transitionrun", "transitionend", "transitioncancel"] as const
    for (const kind of kinds) track?.addEventListener(kind, onTransition)
    return () => {
      for (const kind of kinds) track?.removeEventListener(kind, onTransition)
      delete host.__nessaSegmentedControl?.[instanceId]
    }
  }, [debug, instanceId])

  const setValue = React.useCallback(
    (next: string) => {
      traceRef.current?.({ ev: "select", value: next })
      if (valueProp === undefined) setUncontrolledValue(next)
      onValueChange?.(next)
    },
    [valueProp, onValueChange],
  )

  const context = React.useMemo(
    () => ({ value, setValue, variant: resolvedVariant }),
    [value, setValue, resolvedVariant],
  )

  return (
    <SegmentedControlContext.Provider value={context}>
      <div
        ref={composedRef}
        role="group"
        data-slot="segmented-control"
        data-variant={resolvedVariant}
        data-lens={glass ? (lens ? "placed" : "pending") : undefined}
        className={cn(
          segmentedShellVariants({ variant }),
          glass && "group/segmented-control",
          className,
        )}
        {...props}
      >
        {glass && lens ? (
          <span
            aria-hidden="true"
            data-slot="segmented-control-lens"
            data-animate={lens.animate ? "" : undefined}
            className={glassLensClassName}
            style={{
              width: lens.width,
              height: lens.height,
              transform: `translate(${lens.x}px, ${lens.y}px)`,
            }}
          />
        ) : null}
        {children}
      </div>
    </SegmentedControlContext.Provider>
  )
}

/**
 * A glass option paints no selection of its own once the lens is placed: it
 * sits above the lens, turns to the foreground when pressed, and takes a
 * quiet tint on hover only while it is not the chosen one.
 *
 * Its background does not transition, and the pending fill below is only a
 * fill, with no shadow: it is removed in the same frame the lens is placed,
 * and any fade there would lay a second, fading pill over the lens on every
 * mount.
 */
const glassOptionClassName = cn(
  "relative z-10 rounded-full px-3 text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:text-foreground not-aria-pressed:hover:bg-foreground/[0.04]",
  "transition-[color,box-shadow,transform] duration-(--nessa-motion-duration-fast) ease-(--nessa-motion-easing-standard)",
  // Until the lens is placed — on a server render, before any script — the
  // pressed option wears the lens's paint itself, so selection never depends
  // on a measurement having happened.
  "group-data-[lens=pending]/segmented-control:aria-pressed:bg-(--nessa-segmented-lens)",
)

export interface SegmentedControlOptionProps
  extends Omit<React.ComponentProps<typeof Button>, "value"> {
  /** The value this option selects. */
  value: string
}

/**
 * One choice inside a `SegmentedControl`. Renders as a small button whose
 * pressed state tracks the group's value.
 */
function SegmentedControlOption({
  className,
  value,
  onClick,
  ...props
}: SegmentedControlOptionProps) {
  const context = React.useContext(SegmentedControlContext)
  if (!context) {
    throw new Error(
      "SegmentedControlOption must be used within a SegmentedControl.",
    )
  }
  const selected = context.value === value
  const glass = context.variant === "glass"

  return (
    <Button
      data-slot="segmented-control-option"
      variant={selected && !glass ? "secondary" : "ghost"}
      size="sm"
      className={cn("h-7", glass && glassOptionClassName, className)}
      aria-pressed={selected}
      onClick={(domEvent) => {
        onClick?.(domEvent)
        if (!domEvent.defaultPrevented) context.setValue(value)
      }}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedControlOption, segmentedShellVariants }
