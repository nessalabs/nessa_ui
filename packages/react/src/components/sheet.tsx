"use client"

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

/** Parses a CSS duration token value into milliseconds. */
function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

const SheetContext = React.createContext<{ close: () => void }>({
  close: () => {},
})

/** Reads the enclosing sheet's close handler, for custom dismiss controls. */
function useSheet() {
  return React.useContext(SheetContext)
}

export interface SheetProps extends React.ComponentProps<"div"> {
  /** Dismisses the sheet; the backdrop, Escape, and SheetClose all call it. */
  onClose: () => void
  /** The accessible name of the dialog. */
  label?: string
  /**
   * Puts focus back where it belongs on close, when the control that opened
   * the sheet is gone by then. The sheet returns focus to its opener whenever
   * that element is still in the document, and calls this instead when it is
   * not.
   */
  onReturnFocus?: () => void
}

/**
 * A bottom sheet that rises over its nearest positioned ancestor — typically
 * a chat window — without leaving that frame. It is a modal dialog: the
 * backdrop and Escape dismiss it, focus moves into the panel on open and
 * returns to the opener on close, and the siblings it covers go inert so
 * nothing behind it takes a pointer or a keystroke.
 *
 * Compose the panel from SheetHandle, SheetHeader, SheetTitle, SheetClose,
 * SheetAction, and SheetBody. The sheet draws the chrome and owns dismissal;
 * the host owns what the panel shows.
 */
function Sheet({
  onClose,
  label = "Sheet",
  onReturnFocus,
  className,
  children,
  onKeyDown,
  ...props
}: SheetProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  const onReturnFocusRef = React.useRef(onReturnFocus)
  React.useEffect(() => {
    onCloseRef.current = onClose
    onReturnFocusRef.current = onReturnFocus
  })
  const close = React.useCallback(() => onCloseRef.current(), [])
  const context = React.useMemo(() => ({ close }), [close])

  React.useEffect(() => {
    const panel = panelRef.current
    if (!panel || typeof panel.animate !== "function") return
    if (window.matchMedia(reducedMotionQuery).matches) return
    const duration = cssDurationInMilliseconds(
      getComputedStyle(panel).getPropertyValue("--nessa-motion-duration-fast"),
      160,
    )
    if (duration === 0) return
    const animation = panel.animate(
      [
        { opacity: 0, translate: "0 12%" },
        { opacity: 1, translate: "0 0" },
      ],
      { duration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    )
    return () => animation.cancel()
  }, [])

  React.useEffect(() => {
    const node = ref.current
    const ownerDocument = node?.ownerDocument
    if (!node || !ownerDocument) return
    const opener =
      ownerDocument.activeElement instanceof HTMLElement
        ? ownerDocument.activeElement
        : null
    const firstControl = node.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ;(firstControl ?? node).focus()

    const parent = node.parentElement
    const covered = new Set<HTMLElement>()
    const release = (sibling: HTMLElement) => {
      covered.delete(sibling)
      sibling.removeAttribute("inert")
    }
    for (const sibling of parent?.children ?? []) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue
      if (sibling.getAttribute("role") === "dialog") continue
      if (sibling.hasAttribute("inert")) continue
      sibling.setAttribute("inert", "")
      covered.add(sibling)
    }
    return () => {
      for (const sibling of [...covered]) release(sibling)
      if (opener?.isConnected) opener.focus()
      else onReturnFocusRef.current?.()
    }
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.key !== "Escape" || event.defaultPrevented) return
    event.preventDefault()
    onCloseRef.current()
  }

  return (
    <SheetContext.Provider value={context}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-slot="sheet"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "absolute inset-0 z-30 flex flex-col justify-end font-sans",
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          data-slot="sheet-backdrop"
          onClick={close}
          className="absolute inset-0 bg-foreground/40"
        />
        <div
          ref={panelRef}
          data-slot="sheet-panel"
          className="relative z-10 flex max-h-[85%] min-h-0 w-full flex-col rounded-t-3xl bg-background shadow-[0_-8px_32px] shadow-black/20"
        >
          {children}
        </div>
      </div>
    </SheetContext.Provider>
  )
}

/** The grab bar that marks the panel as a sheet. Decorative. */
function SheetHandle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="sheet-handle"
      className={cn("flex shrink-0 justify-center pt-2", className)}
      {...props}
    >
      <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
    </div>
  )
}

export interface SheetHeaderProps extends React.ComponentProps<"div"> {}

/**
 * The sheet's title row. Hosts place SheetClose, SheetTitle, and SheetAction
 * as children; the row is a three-slot grid so a lone title stays centered
 * whether or not the side controls are present.
 */
function SheetHeader({ className, ...props }: SheetHeaderProps) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 px-3 pb-1 pt-1",
        className,
      )}
      {...props}
    />
  )
}

export interface SheetTitleProps extends React.ComponentProps<"h2"> {}

/** The sheet's heading, centered in the header. */
function SheetTitle({ className, ...props }: SheetTitleProps) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn(
        "col-start-2 m-0 min-w-0 truncate text-center font-sans nessa-text-5 font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  )
}

const sheetControlClassName =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-muted text-foreground outline-none transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3.5"

/**
 * The circular dismiss control. Closes the enclosing sheet, so hosts pass
 * no handler unless they need to intercept the click.
 */
function SheetClose({
  className,
  children,
  onClick,
  "aria-label": ariaLabel = "Close",
  ...props
}: React.ComponentProps<"button">) {
  const { close } = useSheet()
  return (
    <button
      type="button"
      data-slot="sheet-close"
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) close()
      }}
      className={cn(sheetControlClassName, "col-start-1", className)}
      {...props}
    >
      {children ?? <X aria-hidden="true" />}
    </button>
  )
}

/**
 * A trailing header control — typically "Done". Closes the enclosing sheet
 * unless the click is cancelled.
 */
function SheetAction({
  className,
  children = "Done",
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { close } = useSheet()
  return (
    <button
      type="button"
      data-slot="sheet-action"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) close()
      }}
      className={cn(
        "col-start-3 inline-flex h-8 min-w-8 cursor-pointer items-center justify-center justify-self-end rounded-full border-0 bg-transparent px-1.5 font-sans nessa-text-3 font-semibold text-(--nessa-chat-accent) outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * The sheet's scrolling body. It fills the space under the header and hides
 * its scrollbar, matching the transcript it rises over.
 */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-6 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetAction,
  SheetBody,
  SheetClose,
  SheetHandle,
  SheetHeader,
  SheetTitle,
  useSheet,
}
