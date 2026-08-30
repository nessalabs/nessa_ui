"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

/** Parses a CSS duration token value into milliseconds. */
function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.trim().endsWith("ms") ? parsed : parsed * 1000
}

/**
 * How many open overlays are covering each element. Views stack — a passage's
 * source document opens over the annotations that quoted it — and whichever
 * closes first must not uncover content the survivor is still drawn over, so
 * coverage is released on the last one out rather than the first.
 * Elements a host inerted itself never enter the map, and so are never
 * un-inerted by an overlay closing.
 */
const coverCounts = new WeakMap<HTMLElement, number>()

const ChatOverlayContext = React.createContext<{ close: () => void }>({
  close: () => {},
})

/** Reads the enclosing overlay's close handler, for custom dismiss controls. */
function useChatOverlay() {
  return React.useContext(ChatOverlayContext)
}

export interface ChatOverlayProps extends React.ComponentProps<"div"> {
  /** Dismisses the overlay; Escape and ChatOverlayBack both call it. */
  onClose: () => void
  /** The accessible name of the dialog. */
  label?: string
  /**
   * Puts focus back where it belongs on close, when the control that opened
   * the overlay is gone by then — a chip that hides while its view is open,
   * a message that scrolled out of a virtualized list. The overlay returns
   * focus to its opener whenever that element is still in the document, and
   * calls this instead when it is not.
   */
  onReturnFocus?: () => void
}

/**
 * A view that takes over the transcript without disturbing the chat frame
 * around it: it fills its nearest positioned ancestor, so a host that
 * positions the transcript region — rather than the whole window — keeps its
 * tab strip and composer visible and usable while the overlay is open. That
 * is the difference from ChatAttachmentViewer, which owns its own grid and
 * back control; this is the bare surface for reading views such as pending
 * annotations, a previewed file, or one message's full text.
 *
 * It is deliberately not a modal dialog. Focus moves into the view when it
 * opens and returns to the control that opened it on close, but Tab is not
 * trapped and nothing outside is hidden — the tab strip and composer beside
 * it stay in use, which is the whole point of taking over the transcript
 * rather than the window. ChatAttachmentViewer is the modal sibling, for
 * views that should take everything. What it does cover, it covers
 * completely: the siblings it is drawn over go inert while it is open, so
 * nothing behind it takes focus or a pointer.
 *
 * Escape closes the view from inside it, after any control that stops the
 * keystroke first has had it, and the fade honors reduced motion.
 */
function ChatOverlay({
  onClose,
  label = "Conversation view",
  onReturnFocus,
  className,
  children,
  onKeyDown,
  ...props
}: ChatOverlayProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof node.animate !== "function") return
    if (window.matchMedia(reducedMotionQuery).matches) return
    const duration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue("--nessa-motion-duration-fast"),
      160,
    )
    if (duration === 0) return
    const animation = node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
      easing: "ease-out",
    })
    return () => animation.cancel()
    // The fade runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The close callback is read through a ref so the focus-management effect
  // can run once on mount: hosts pass inline closures, and keying the effect
  // on their identity would re-capture the opener and yank focus back to the
  // first control on every parent render.
  const onCloseRef = React.useRef(onClose)
  const onReturnFocusRef = React.useRef(onReturnFocus)
  React.useEffect(() => {
    onCloseRef.current = onClose
    onReturnFocusRef.current = onReturnFocus
  })
  const close = React.useCallback(() => onCloseRef.current(), [])
  const context = React.useMemo(() => ({ close }), [close])
  React.useEffect(() => {
    const node = ref.current
    const ownerDocument = node?.ownerDocument
    if (!node || !ownerDocument) return
    // The view takes over the reading area, so focus moves into it — but it
    // does not trap Tab: the chat around it stays reachable, which is the
    // whole point of taking over the transcript rather than the window.
    const opener =
      ownerDocument.activeElement instanceof HTMLElement
        ? ownerDocument.activeElement
        : null
    // The view itself is the fallback focus target, so a reading view with
    // no controls of its own still answers Escape.
    const firstControl = node.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ;(firstControl ?? node).focus()
    // The view covers its parent's other children, so while it is open they
    // are inert: nothing behind it takes focus, a pointer, or a screen
    // reader's attention. Siblings that are dialogs themselves are left
    // alone, as is anything the host had already inerted — the count below
    // tracks only coverage the overlays applied, so only that is undone.
    const parent = node.parentElement
    const covered = new Set<HTMLElement>()
    const release = (sibling: HTMLElement) => {
      covered.delete(sibling)
      const count = (coverCounts.get(sibling) ?? 1) - 1
      if (count > 0) return coverCounts.set(sibling, count)
      coverCounts.delete(sibling)
      sibling.removeAttribute("inert")
    }
    const coverSiblings = () => {
      // A sibling React has unmounted is no longer covered by anything.
      for (const sibling of covered) if (!sibling.isConnected) release(sibling)
      for (const sibling of parent?.children ?? []) {
        if (sibling === node || !(sibling instanceof HTMLElement)) continue
        if (sibling.getAttribute("role") === "dialog") continue
        if (covered.has(sibling)) continue
        const count = coverCounts.get(sibling)
        if (count === undefined && sibling.hasAttribute("inert")) continue
        coverCounts.set(sibling, (count ?? 0) + 1)
        sibling.setAttribute("inert", "")
        covered.add(sibling)
      }
    }
    coverSiblings()
    // Hosts mount things behind an open view — a card, a banner — and those
    // are covered too rather than becoming a reachable hole behind it.
    const observer = parent ? new MutationObserver(coverSiblings) : null
    if (parent && observer) observer.observe(parent, { childList: true })
    return () => {
      observer?.disconnect()
      // Uncovering runs before focus returns, so focus is never handed to an
      // element that is still inert.
      for (const sibling of [...covered]) release(sibling)
      // A control that is gone cannot take focus back; hosts that hide the
      // opener while the view is open say where focus should land instead.
      if (opener?.isConnected) opener.focus()
      else onReturnFocusRef.current?.()
    }
    // Mount-once by design; the callbacks flow through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape is handled on the overlay itself, in the bubble phase, so a
  // control inside it that stops the event — an inline editor — cancels its
  // own state without closing the view. A layer that dismisses from its own
  // document listener without stopping the event (Radix menus and popovers
  // do this) closes the view along with itself, so a host nesting one should
  // stop the keystroke in its own handler.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The host's handler runs first and can claim the keystroke.
    onKeyDown?.(event)
    if (event.key !== "Escape" || event.defaultPrevented) return
    event.preventDefault()
    onCloseRef.current()
  }

  return (
    <ChatOverlayContext.Provider value={context}>
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        data-slot="chat-overlay"
        // Focusable as a last resort: clicking the view's own text keeps
        // focus inside it, so Escape still works after a stray click.
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "absolute inset-0 z-20 flex flex-col rounded-[inherit] bg-background font-sans",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ChatOverlayContext.Provider>
  )
}

/**
 * The overlay's scrolling content region. It fills the space above whatever
 * the overlay pins underneath — typically ChatOverlayBack — and hides its
 * scrollbar, matching the transcript it replaces. Hosts set the layout
 * through className, so the same region holds a column of messages, a
 * wrapping grid of tiles, or one full-bleed document.
 */
function ChatOverlayBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-overlay-body"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-2 text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  )
}

/**
 * The overlay's way out, spelled out rather than drawn as an arrow: a quiet
 * centered link under the content. It closes the enclosing overlay, so hosts
 * pass no handler.
 */
function ChatOverlayBack({
  className,
  children = "Back to chat",
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { close } = useChatOverlay()
  return (
    <button
      type="button"
      data-slot="chat-overlay-back"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) close()
      }}
      className={cn(
        "mx-auto shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-3 py-1.5 font-sans nessa-text-2 font-medium text-(--nessa-chat-accent) outline-none hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** A centered caption under the overlay's content, e.g. a file name. */
function ChatOverlaySummary({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="chat-overlay-summary"
      className={cn(
        "shrink-0 text-center font-sans nessa-text-2 text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { ChatOverlay, ChatOverlayBack, ChatOverlayBody, ChatOverlaySummary, useChatOverlay }
