"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { useComposedRefs } from "@/lib/compose"
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

/** Apple writes modifiers in one order whatever order they were typed in. */
const appleModifierOrder = ["Control", "Alt", "Shift", "Meta"]

/**
 * Writes an `aria-keyshortcuts` value the way a key cap shows it: the
 * first shortcut only, as Apple glyphs run together in Apple's modifier
 * order (`Meta+Shift+P` → `⇧⌘P`) or, with `platform: "other"`, as words
 * joined by `+` (`Ctrl+Shift+P`). Unknown keys pass through, single
 * letters upper-cased.
 */
function formatShortcut(shortcut: string, platform: "apple" | "other" = "apple"): string {
  const first = shortcut.trim().split(/\s+/)[0] ?? ""
  let keys = first.split("+").filter(Boolean)
  if (platform === "apple") {
    const rank = (key: string) => {
      const index = appleModifierOrder.indexOf(key)
      return index === -1 ? appleModifierOrder.length : index
    }
    keys = [...keys].sort((a, b) => rank(a) - rank(b))
  }
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

/**
 * How the person last interacted: by key, or by pointer. Focus that follows
 * a key is keyboard focus; focus that follows a pointer press — a click that
 * closed a menu, a tap — is not, whatever the browser's own heuristic says
 * about focus moved by script. One listener pair per document, installed by
 * the first tooltip. It starts at "pointer": a press that happened before
 * the listener existed (the click that opened a panel holding the first
 * tooltip) must not count as keyboard, and every real keyboard focus is
 * preceded by a keydown the listener does see.
 */
const lastModality = new WeakMap<Document, "keyboard" | "pointer">()

function trackModality(doc: Document) {
  if (lastModality.has(doc)) return
  lastModality.set(doc, "pointer")
  doc.addEventListener("keydown", () => lastModality.set(doc, "keyboard"), true)
  doc.addEventListener("pointerdown", () => lastModality.set(doc, "pointer"), true)
}

type TriggerProps = {
  label?: string
  shortcut?: string
  "aria-label"?: string
  "aria-keyshortcuts"?: string
  "aria-describedby"?: string
}

export interface TooltipProps
  extends Pick<
      React.ComponentProps<typeof TooltipPrimitive.Content>,
      "side" | "align" | "sideOffset" | "className"
    >,
    Omit<React.ComponentPropsWithRef<"button">, "children" | "content" | "className"> {
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
 * Keyboard focus opens it; focus that arrives any other way — returned
 * by a closing menu, or following a tap — does not, so a pointer or touch
 * person never sees a tooltip they did not hover for.
 *
 * The tooltip repeats the trigger's name; it does not replace it. The
 * trigger keeps its own accessible name. Text taken from the trigger is
 * not announced again as a description (the name already says it, and the
 * shortcut is announced through `aria-keyshortcuts`, which the tooltip adds
 * when only it was given one); `content` of the tooltip's own is announced
 * as the trigger's description. With nothing to say it never opens.
 *
 * Inside another `asChild` trigger, put the Tooltip inside it —
 * `<DropdownMenuTrigger asChild><Tooltip><Button …/></Tooltip></DropdownMenuTrigger>`:
 * any other prop the Tooltip receives (the menu's handlers, `ref`,
 * `aria-expanded`, `data-state`) reaches the trigger after the tooltip's
 * own, so the menu's open state stays on the button.
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
  ref: forwardedRef,
  ...triggerProps
}: TooltipProps) {
  const hasProvider = React.useContext(TooltipProviderPresent)
  const container = usePortalContainer(portalContainer)
  const layerScope = useNessaLayerScope()
  const trigger = children.props as TriggerProps
  const ownText = content !== undefined && content !== null && content !== ""
  // The trigger's accessible name wins, as it does on Button, so what the
  // tooltip shows is what assistive technology reads.
  const text = ownText ? content : (trigger["aria-label"] ?? trigger.label)
  // The key shown is the key announced: the tooltip's own, else the
  // trigger's explicit `aria-keyshortcuts`, else its `shortcut` — the same
  // precedence Button gives the attribute.
  const keys = shortcut ?? trigger["aria-keyshortcuts"] ?? trigger.shortcut
  const textId = React.useId()
  const hasText = text !== undefined && text !== null && text !== ""
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const composedRef = useComposedRefs(triggerRef, forwardedRef)
  // A mouse (not a touch) resting on the trigger: the one pointer case that
  // earns a tooltip, read from pointer events rather than `:hover`, which a
  // tapped element keeps on touch screens.
  const mouseOver = React.useRef(false)
  // Set for the length of a focus event, so an open request made from it is
  // judged as focus (keyboard only) and never as hover.
  const focusing = React.useRef(false)
  const [ownOpen, setOwnOpen] = React.useState(defaultOpen ?? false)
  const isOpen = hasText && (open ?? ownOpen)
  React.useEffect(() => {
    if (triggerRef.current) trackModality(triggerRef.current.ownerDocument)
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (next) {
      if (!hasText) return
      // Radix opens on any focus and on hover. A focus open needs a key
      // before it — focus a menu hands back after a click, or a tap, earns
      // nothing even with the mouse resting on the trigger; a hover open
      // needs a mouse (not a touch) over the trigger.
      const element = triggerRef.current
      const byKeyboard = element !== null && lastModality.get(element.ownerDocument) === "keyboard"
      if (focusing.current ? !byKeyboard : !mouseOver.current) return
    }
    if (open === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }

  // One tree whatever there is to say, so a trigger that gains or loses its
  // label while focused is never remounted.
  const tooltip = (
    <TooltipPrimitive.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      delayDuration={delayDuration}
    >
      <TooltipPrimitive.Trigger
        asChild
        // Radix's own description link is replaced: text taken from the
        // trigger is its name already and is not linked at all; the
        // tooltip's own text is linked below, composed with the trigger's.
        {...{ "aria-describedby": undefined }}
        // Props from an outer `asChild` trigger (a menu's) land after the
        // tooltip's own, so its `data-state` and handlers win.
        {...triggerProps}
        ref={composedRef}
        onPointerEnter={(event) => {
          triggerProps.onPointerEnter?.(event)
          mouseOver.current = event.pointerType !== "touch"
        }}
        onPointerMove={(event) => {
          triggerProps.onPointerMove?.(event)
          mouseOver.current = event.pointerType !== "touch"
        }}
        onPointerLeave={(event) => {
          triggerProps.onPointerLeave?.(event)
          mouseOver.current = false
        }}
        // Runs before Radix's own focus handler, which asks to open.
        onFocus={(event) => {
          triggerProps.onFocus?.(event)
          focusing.current = true
          queueMicrotask(() => {
            focusing.current = false
          })
        }}
      >
        {
          // Written on the child, as a slotted child's own prop wins the
          // merge: the key announced is the key shown (`keys`, Tooltip
          // first), and the tooltip's own text describes the trigger
          // alongside any description it already has.
          keys !== undefined || ownText
            ? React.cloneElement(children as React.ReactElement<TriggerProps>, {
                ...(keys !== undefined ? { "aria-keyshortcuts": keys } : null),
                ...(ownText
                  ? {
                      "aria-describedby":
                        [trigger["aria-describedby"], isOpen ? textId : undefined]
                          .filter(Boolean)
                          .join(" ") || undefined,
                    }
                  : null),
              })
            : children
        }
      </TooltipPrimitive.Trigger>
      {hasText ? (
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
            <span id={textId} data-slot="tooltip-text">{text}</span>
            {keys ? (
              <Kbd className="bg-background/15 text-background">
                {formatShortcut(keys, currentPlatform())}
              </Kbd>
            ) : null}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      ) : null}
    </TooltipPrimitive.Root>
  )

  return hasProvider ? tooltip : <TooltipProvider>{tooltip}</TooltipProvider>
}

export { Tooltip, TooltipProvider, formatShortcut }
