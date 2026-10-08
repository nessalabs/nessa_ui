"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { useNessaLayerScope, usePortalContainer } from "@/lib/portal-container"
import { cn } from "@/lib/utils"

import { Kbd } from "./kbd"

/** Whether a `TooltipProvider` is already above, so a lone Tooltip can supply its own. */
const TooltipProviderPresent = /* @__PURE__ */ React.createContext(false)

export interface TooltipProviderProps {
  /**
   * How long the pointer rests on a trigger before its tooltip opens, in ms.
   * @defaultValue 500
   */
  delayDuration?: number
  /**
   * How long after one tooltip closes the next opens at once, so moving
   * along a toolbar reads label after label without waiting each time.
   * @defaultValue 300
   */
  skipDelayDuration?: number
  children?: React.ReactNode
}

/**
 * Groups the tooltips inside it: the first waits `delayDuration`, and the
 * next one opened within `skipDelayDuration` opens at once. Put one around a
 * toolbar or a whole window. A `Tooltip` with no provider above it supplies
 * its own, so it works alone, just without the grouping.
 */
function TooltipProvider({
  delayDuration = 500,
  skipDelayDuration = 300,
  children,
}: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
      <TooltipProviderPresent.Provider value={true}>{children}</TooltipProviderPresent.Provider>
    </TooltipPrimitive.Provider>
  )
}

const keyGlyphs: Record<string, string> = {
  Meta: "⌘",
  Control: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Enter: "↩",
  Escape: "Esc",
  Backspace: "⌫",
  Delete: "⌦",
  Tab: "⇥",
  Space: "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
}

const keyWords: Record<string, string> = {
  Meta: "Win",
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Escape: "Esc",
  Space: "Space",
}

/**
 * Writes an `aria-keyshortcuts` value the way a key cap shows it: the
 * first shortcut only, as Apple glyphs run together (`Meta+Shift+P` →
 * `⌘⇧P`) or, with `platform: "other"`, as words joined by `+`
 * (`Ctrl+Shift+P`). Unknown keys pass through, single letters upper-cased.
 */
function formatShortcut(shortcut: string, platform: "apple" | "other" = "apple"): string {
  const first = shortcut.trim().split(/\s+/)[0] ?? ""
  const keys = first.split("+").filter(Boolean)
  const name = (key: string) => {
    const table = platform === "apple" ? keyGlyphs : keyWords
    if (Object.hasOwn(table, key)) return table[key]!
    return key.length === 1 ? key.toUpperCase() : key
  }
  return platform === "apple" ? keys.map(name).join("") : keys.map(name).join("+")
}

function currentPlatform(): "apple" | "other" {
  if (typeof navigator === "undefined") return "apple"
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "apple" : "other"
}

type TriggerProps = {
  label?: string
  shortcut?: string
  "aria-label"?: string
}

export interface TooltipProps
  extends Pick<
    React.ComponentProps<typeof TooltipPrimitive.Content>,
    "side" | "align" | "sideOffset" | "className"
  > {
  /**
   * The one element the tooltip describes — usually an icon-only Button.
   * It must accept a ref and forward pointer and focus events, as Button
   * does.
   */
  children: React.ReactElement
  /**
   * What the tooltip says. Defaults to the trigger's own `label` (or its
   * `aria-label`), so a Button's name and its tooltip are written once.
   */
  content?: React.ReactNode
  /**
   * The key that runs the action, in `aria-keyshortcuts` form
   * (`"Meta+K"`). Defaults to the trigger's own `shortcut`. Shown as a key
   * cap after the text.
   */
  shortcut?: string
  /** Whether the tooltip is open, for a host that controls it. */
  open?: boolean
  /** Whether the tooltip starts open, when it is not controlled. */
  defaultOpen?: boolean
  /** Called when the tooltip opens or closes. */
  onOpenChange?: (open: boolean) => void
  /** Overrides the provider's delay for this tooltip, in ms. */
  delayDuration?: number
  /**
   * Where the tooltip's layer mounts. Defaults to the nearest Nessa portal
   * container, else the body.
   */
  portalContainer?: HTMLElement | null
}

/**
 * A short label for a control, shown after the pointer rests on it or as
 * soon as keyboard focus reaches it, and hidden on Escape, on blur, or when
 * the pointer leaves. A touch screen never shows it: a tap is a press, not
 * a hover. It reads the trigger's `label` and `shortcut` when given none of
 * its own, so `<Tooltip><Button label="Search" shortcut="Meta+K" …>` names
 * the button, announces its shortcut, and shows both, from one place.
 *
 * The tooltip repeats the trigger's name; it does not replace it. The
 * trigger keeps its own accessible name, and the tooltip is wired to it as
 * a description. With nothing to say (no content, no label) it renders the
 * trigger alone.
 */
function Tooltip({
  children,
  content,
  shortcut,
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
  portalContainer,
  side,
  align,
  sideOffset = 6,
  className,
}: TooltipProps) {
  const hasProvider = React.useContext(TooltipProviderPresent)
  const container = usePortalContainer(portalContainer)
  const layerScope = useNessaLayerScope()
  const trigger = children.props as TriggerProps
  const text = content ?? trigger.label ?? trigger["aria-label"]
  const keys = shortcut ?? trigger.shortcut
  if (text === undefined || text === null || text === "") return children

  const tooltip = (
    <TooltipPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delayDuration={delayDuration}
    >
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal container={container}>
        <TooltipPrimitive.Content
          {...layerScope}
          data-slot="tooltip"
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          className={cn(
            "z-50 flex max-w-64 items-center gap-1.5 rounded-md bg-foreground px-2 py-1 font-sans nessa-text-2 text-background shadow-md",
            "origin-(--radix-tooltip-content-transform-origin) animate-nessa-enter",
            className,
          )}
        >
          <span data-slot="tooltip-text">{text}</span>
          {keys ? (
            <Kbd className="bg-background/15 text-background">
              {formatShortcut(keys, currentPlatform())}
            </Kbd>
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )

  return hasProvider ? tooltip : <TooltipProvider>{tooltip}</TooltipProvider>
}

export { Tooltip, TooltipProvider, formatShortcut }
