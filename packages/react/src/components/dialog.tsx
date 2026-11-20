"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { X } from "lucide-react"

import { useComposedRefs } from "@/lib/compose"
import { useOpenerFocusReturn } from "@/lib/overlay-panel"
import {
  PortalContainerProvider,
  useNessaLayerScope,
  usePortalContainer,
  usePortalContainerHost,
} from "@/lib/portal-container"
import { observeSize } from "@/lib/size-observer"
import { cn, hasContent } from "@/lib/utils"

import { Button } from "./button"

/** How wide a dialog may grow before it stops and centers; `full` fills the window. */
type DialogSize = "sm" | "md" | "lg" | "full"

/**
 * Whether an element's content overflows it, kept current as either changes.
 * A scrolling region holding only text must take focus itself, or a keyboard
 * cannot scroll it: keys scroll the focused element's scrollers, and the
 * dialog's focus starts on the panel above the body.
 */
function useOverflows(node: HTMLElement | null) {
  const [overflows, setOverflows] = React.useState(false)
  React.useLayoutEffect(() => {
    if (!node) return
    // The 1px tolerance keeps a fractional content height from minting a
    // tab stop on a body that cannot actually scroll.
    const measure = () => setOverflows(node.scrollHeight - node.clientHeight > 1)
    measure()
    return observeSize(node, measure)
  }, [node])
  return overflows
}

const sizeClassName: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  full: "h-full max-w-none",
}

export interface DialogProps
  extends Omit<
    React.ComponentProps<typeof DialogPrimitive.Content>,
    "title" | "children" | "forceMount" | "asChild"
  > {
  /**
   * The dialog's heading, and its accessible name. Always rendered: a modal
   * dialog with no name is announced as "dialog" and nothing else.
   */
  title: React.ReactNode
  /** A line under the title: what the dialog is for. Announced with the dialog. */
  description?: React.ReactNode
  /**
   * The dialog's body. It scrolls on its own when the dialog would be taller
   * than the viewport, while the title and footer stay put.
   */
  children?: React.ReactNode
  /**
   * The actions along the bottom edge, end-aligned — usually a cancel
   * wrapped in `DialogClose` and the primary action last.
   */
  footer?: React.ReactNode
  /**
   * The control that opens the dialog, such as a Button. Optional: a host
   * that opens the dialog from state passes `open` instead, and focus still
   * returns to whatever was focused when it opened.
   */
  trigger?: React.ReactElement
  /** Whether the dialog is open, for a host that controls it. */
  open?: boolean
  /** Whether the dialog starts open, when it is not controlled. */
  defaultOpen?: boolean
  /** Called when the dialog asks to open or close. */
  onOpenChange?: (open: boolean) => void
  /**
   * The widest the panel grows: `sm` 24rem, `md` 28rem, `lg` 36rem, or
   * `full`, the whole window less its margin, for a workspace of its own,
   * such as a list beside what it opens (see `aside`). It is never wider
   * than the viewport less its margin.
   * @defaultValue "md"
   */
  size?: DialogSize
  /**
   * A column down the panel's start edge, full height, under the title and
   * description, which move into it: a list beside what the body shows.
   * It lays out its children as a column, so a last child can sit at its
   * foot with `mt-auto`. The body and footer take the rest of the width.
   */
  aside?: React.ReactNode
  /**
   * The element focus moves to when the dialog opens. By default the panel
   * itself takes focus, so a screen reader reads the title and description
   * before any control and no keystroke acts on the dialog by accident.
   */
  initialFocus?: React.RefObject<HTMLElement | null>
  /**
   * Renders the close button in the panel's top corner. Escape and a press
   * outside the panel close the dialog either way.
   * @defaultValue true
   */
  showCloseButton?: boolean
  /** Names the close button for assistive technology. @defaultValue "Close" */
  closeLabel?: string
  /**
   * Where focus goes on close when the control that opened the dialog is
   * gone by then — a row deleted by the dialog's own action — or when nothing
   * was focused at open and no trigger took focus back.
   */
  onReturnFocus?: () => void
  /**
   * Where the dialog's layer mounts. Defaults to the nearest Nessa portal
   * container, else the body. Inside a modal Sheet that is the sheet's own
   * container, which is what keeps the dialog usable: the sheet makes
   * everything outside itself inert. The dialog then stacks within the
   * sheet's layer; pass `null` for the body when it must escape it.
   */
  container?: HTMLElement | null
  /** Extends the dimmed layer behind the panel. */
  overlayClassName?: string
}

/**
 * A modal dialog: a titled panel centered over a dimmed page, with an
 * optional description, a body that scrolls on its own when tall, and a row
 * of footer actions.
 *
 * While it is open the rest of the page is out of reach — Tab stays inside
 * the panel, the page behind is hidden from assistive technology and does
 * not scroll, and the panel is announced as a modal dialog named by its
 * title. Escape, the close button, and a press outside the panel close it,
 * and focus returns to whatever opened it. Radix Dialog supplies the focus
 * trap, dismissal and ARIA wiring; this owns the layout and the focus
 * return, which Drawer shares.
 *
 * Menus, tooltips and pickers opened from inside the dialog portal into it,
 * so they stay inside the boundary it makes. The dialog itself portals into
 * the nearest Nessa portal container and carries the theme scope there.
 *
 * ```tsx
 * <Dialog
 *   trigger={<Button>Share</Button>}
 *   title="Share conversation"
 *   description="Choose who can open it."
 *   footer={
 *     <>
 *       <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
 *       <Button>Share</Button>
 *     </>
 *   }
 * >
 *   …
 * </Dialog>
 * ```
 */
function Dialog({
  title,
  description,
  children,
  footer,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  size = "md",
  aside,
  initialFocus,
  showCloseButton = true,
  closeLabel = "Close",
  onReturnFocus,
  container: containerProp,
  overlayClassName,
  className,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ref,
  ...props
}: DialogProps) {
  const container = usePortalContainer(containerProp)
  const layerScope = useNessaLayerScope()
  // The dialog owns where its own floating layers land, as a Sheet does: a
  // menu portalled to the body would sit outside the boundary this dialog
  // traps focus in and hides the rest of the page from.
  const layers = usePortalContainerHost()
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const composedRef = useComposedRefs(panelRef, ref)
  const focusReturn = useOpenerFocusReturn(onReturnFocus)
  const [bodyNode, setBodyNode] = React.useState<HTMLDivElement | null>(null)
  const bodyScrolls = useOverflows(bodyNode)
  const hasDescription = hasContent(description)
  const hasFooter = hasContent(footer)
  const hasAside = hasContent(aside)
  const full = size === "full"
  // In the aside when there is one, else across the top.
  const header = (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-1 px-5 pt-5 pb-3",
        showCloseButton && !hasAside && "pr-14",
        hasAside && "px-4 pt-4.5",
      )}
    >
      <DialogPrimitive.Title
        data-slot="dialog-title"
        className="m-0 nessa-text-5 font-semibold text-foreground"
      >
        {title}
      </DialogPrimitive.Title>
      {hasDescription ? (
        <DialogPrimitive.Description
          data-slot="dialog-description"
          className="m-0 nessa-text-4 text-muted-foreground"
        >
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  )

  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger !== undefined ? (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      ) : null}
      <DialogPrimitive.Portal container={container}>
        {/*
          The panel sits inside the overlay, which centers it with flex rather
          than a transform: a transform would become the containing block of
          every fixed-position menu the panel portals into itself, and pin
          those menus to the panel instead of the viewport.
        */}
        <DialogPrimitive.Overlay
          {...layerScope}
          data-slot="dialog-overlay"
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs",
            full && "sm:p-8",
            overlayClassName,
          )}
        >
          <DialogPrimitive.Content
            ref={composedRef}
            data-slot="dialog"
            data-size={size}
            // Radix makes the page behind inert to assistive technology with
            // `aria-hidden` but does not declare it; the dialog says so too.
            aria-modal="true"
            // With no description, the panel is described by nothing. Radix
            // before react-dialog 1.1.20 (inside this package's `radix-ui`
            // range) points `aria-describedby` at its description id either
            // way, naming an element that does not exist, and warns; an
            // explicit `undefined` is its documented opt-out. A consumer's own
            // `aria-describedby`, spread below, still wins.
            {...(hasDescription ? null : { "aria-describedby": undefined })}
            onOpenAutoFocus={(event) => {
              // Read before focus moves, while the opener still holds it.
              const panel = panelRef.current
              focusReturn.capture(panel)
              onOpenAutoFocus?.(event)
              if (event.defaultPrevented) return
              event.preventDefault()
              initialFocus?.current?.focus()
              // A target that would not take focus — disabled while it
              // loads, say — must not leave focus behind the dialog.
              if (!panel?.contains(panel.ownerDocument.activeElement)) panel?.focus()
            }}
            onCloseAutoFocus={(event) => {
              onCloseAutoFocus?.(event)
              focusReturn.release(event)
            }}
            className={cn(
              "flex max-h-full w-full flex-col rounded-xl font-sans outline-none",
              sizeClassName[size],
              // The panel takes focus on open, so a keyboard open carries an
              // indicator. The opener's modality decides, since a container
              // focused by script matches `:focus-visible` after a click too.
              focusReturn.keyboardOpened &&
                "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              className,
            )}
            {...props}
          >
            <PortalContainerProvider container={layers.container}>
              {/*
                The surface, not the panel, carries the entrance. It scales,
                and an element with a scale is the containing block of every
                fixed-position descendant; the layers container below is the
                panel's child, beside the surface, so a menu opened while the
                entrance runs is still placed against the viewport.
              */}
              <div
                data-slot="dialog-surface"
                data-aside={hasAside || undefined}
                className={cn(
                  "relative flex min-h-0 shrink flex-col rounded-[inherit] border border-hairline bg-card text-card-foreground shadow-xl animate-nessa-enter",
                  full && "h-full",
                  hasAside && "grid grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] overflow-hidden",
                )}
              >
                {hasAside ? (
                  <div
                    data-slot="dialog-aside"
                    className="flex min-h-0 flex-col border-e border-hairline bg-sidebar"
                  >
                    {header}
                    <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">{aside}</div>
                  </div>
                ) : (
                  header
                )}
                <div
                  data-slot="dialog-main"
                  className={cn("flex min-h-0 min-w-0 flex-col", hasAside && "pt-3", full && "flex-1")}
                >
                  <div
                    ref={setBodyNode}
                    data-slot="dialog-body"
                    data-scrolls={bodyScrolls || undefined}
                    // In the tab order only while it scrolls, so a keyboard can
                    // read past the fold of a body that holds no control.
                    tabIndex={bodyScrolls ? 0 : undefined}
                    className={cn(
                      "min-h-0 flex-1 overflow-y-auto px-5 py-2 outline-none",
                      // Inset: the surface clips nothing, but an outset outline
                      // would cross the header and footer it sits between.
                      "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      !hasFooter && "pb-5",
                      hasAside && "px-8",
                    )}
                  >
                    {children}
                  </div>
                  {hasFooter ? (
                    <div
                      data-slot="dialog-footer"
                      className={cn(
                        "flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 pt-3 pb-5",
                        hasAside && "border-t border-hairline px-8 pt-3 pb-3.5",
                      )}
                    >
                      {footer}
                    </div>
                  ) : null}
                </div>
                {showCloseButton ? (
                  <DialogPrimitive.Close asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={closeLabel}
                      data-slot="dialog-close-button"
                      className="absolute top-3 right-3 size-8 text-muted-foreground"
                    >
                      <X />
                    </Button>
                  </DialogPrimitive.Close>
                ) : null}
              </div>
            </PortalContainerProvider>
            {/*
              Where the dialog's own menus, popovers and tooltips land. Last in
              the panel, so they paint above it; it draws and occupies nothing,
              since Radix positions each layer in a fixed wrapper of its own.
            */}
            <div ref={layers.setContainer} data-slot="dialog-layers" />
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * A control that closes the enclosing dialog — a footer's Cancel or Done.
 * Use `asChild` to project it onto a Button.
 */
function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

export { Dialog, DialogClose, type DialogSize }
