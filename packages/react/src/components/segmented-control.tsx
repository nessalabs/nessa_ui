"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { useComposedRefs } from "@/lib/compose"
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
 * is what keeps the selection visible when backgrounds are stripped.
 */
const glassLensClassName = cn(
  "pointer-events-none absolute inset-y-0.5 left-0 z-0 box-border rounded-full border border-transparent bg-(--nessa-segmented-lens)",
  "shadow-xs inset-ring inset-ring-foreground/[0.06] inset-shadow-[0_1px_0_light-dark(transparent,color-mix(in_oklab,var(--foreground)_12%,transparent))]",
  // It glides only between options. Placement on mount, on resize, and when
  // the options change lands at once: a lens that chased a resizing track
  // would read as lag, not motion.
  "transition-none motion-safe:data-[animate]:transition-[transform,width] [transition-duration:var(--nessa-motion-duration-slow)] [transition-timing-function:var(--nessa-motion-easing-standard)]",
)

/** Why the lens was placed: the development trace records it. */
type LensCause = "mount" | "value" | "resize" | "options"

interface LensGeometry {
  x: number
  width: number
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
function ownOptions(track: HTMLElement) {
  return Array.from(
    track.querySelectorAll<HTMLElement>(optionSelector),
  ).filter(
    (option) => option.closest('[data-slot="segmented-control"]') === track,
  )
}

/**
 * Where the pressed option sits inside the track, in the track's own
 * untransformed pixels. Bounding rectangles keep the subpixel widths text
 * produces, which rounded `offset*` values would lose; dividing by the
 * track's rendered-to-layout ratio takes back any scale an ancestor applies.
 */
function measurePressed(track: HTMLElement) {
  const pressed = ownOptions(track).find(
    (option) => option.getAttribute("aria-pressed") === "true",
  )
  if (!pressed) return null
  const trackBox = track.getBoundingClientRect()
  const box = pressed.getBoundingClientRect()
  const scale =
    track.offsetWidth > 0 ? trackBox.width / track.offsetWidth : 1
  const ratio = scale > 0 ? scale : 1
  return {
    x: (box.left - trackBox.left) / ratio - track.clientLeft,
    width: box.width / ratio,
  }
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
   * Development tooling for the `glass` lens: records every placement (its
   * cause — mount, value, resize, options — and the geometry it landed on)
   * and every selection into a ring buffer published at
   * `window.__nessaSegmentedControl[<instance id>]`, with a `snapshot()` of
   * the live lens. No-op unless set.
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
 * again whenever the track or an option resizes or the options change, so
 * labels of any width land exactly; it glides only when the selection moves
 * and holds still under `prefers-reduced-motion`.
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
  const lensRef = React.useRef(lens)
  lensRef.current = lens

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
    traceRef.current?.({ ev: "measure", cause, ...(measured ?? { x: null }) })
    setLens((previous) => {
      if (!measured) return null
      // Unchanged geometry keeps the running glide: a resize observer's
      // first report arrives just after a selection starts moving the lens,
      // and treating it as a placement would cut the glide short.
      if (
        previous &&
        Math.abs(previous.x - measured.x) < 0.01 &&
        Math.abs(previous.width - measured.width) < 0.01
      ) {
        return previous
      }
      return {
        ...measured,
        animate: cause === "value" && previous !== null,
      }
    })
  }, [])

  // The observers belong to the track, not to a selection: they follow the
  // geometry the lens depends on for as long as the control is glass.
  useIsomorphicLayoutEffect(() => {
    const track = trackRef.current
    if (!glass || !track) {
      setLens(null)
      return
    }
    placeLens("mount")
    // A track can hold its size while one option grows and its neighbour
    // shifts, so the options are observed as well as the track.
    const resizeObserver = new ResizeObserver(() => placeLens("resize"))
    const observeOptions = () => {
      resizeObserver.disconnect()
      resizeObserver.observe(track)
      for (const option of ownOptions(track)) resizeObserver.observe(option)
    }
    observeOptions()
    const mutationObserver = new MutationObserver(() => {
      observeOptions()
      placeLens("options")
    })
    mutationObserver.observe(track, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
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
    return () => {
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
              transform: `translateX(${lens.x}px)`,
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
 */
const glassOptionClassName = cn(
  "relative z-10 rounded-full px-3 text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:text-foreground not-aria-pressed:hover:bg-foreground/[0.05]",
  "transition-[color,background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)]",
  // Until the lens is placed — on a server render, before any script — the
  // pressed option wears the lens's paint itself, so selection never depends
  // on a measurement having happened.
  "group-data-[lens=pending]/segmented-control:aria-pressed:bg-(--nessa-segmented-lens) group-data-[lens=pending]/segmented-control:aria-pressed:shadow-xs",
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
