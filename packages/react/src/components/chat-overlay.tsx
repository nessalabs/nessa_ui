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
}

/**
 * A view that takes over the transcript without disturbing the chat frame
 * around it: it fills its nearest positioned ancestor, so a host that
 * positions the transcript region — rather than the whole window — keeps its
 * tab strip and composer visible and usable while the overlay is open. That
 * is the difference from ChatAttachmentViewer, which owns its own grid and
 * back control; this is the bare surface for reading views such as pending
 * annotations, a previewed file, or one message's full text. Escape closes
 * it, focus is trapped inside while it is open and returns to the opener on
 * close, and the fade honors reduced motion.
 */
function ChatOverlay({
  onClose,
  label = "Conversation view",
  className,
  children,
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
  React.useEffect(() => {
    onCloseRef.current = onClose
  })
  const close = React.useCallback(() => onCloseRef.current(), [])
  const context = React.useMemo(() => ({ close }), [close])
  React.useEffect(() => {
    const node = ref.current
    const ownerDocument = node?.ownerDocument
    if (!node || !ownerDocument) return
    const opener =
      ownerDocument.activeElement instanceof HTMLElement
        ? ownerDocument.activeElement
        : null
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"))
    focusables()[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return
      const order = focusables()
      if (order.length === 0) return
      const first = order[0]!
      const last = order[order.length - 1]!
      const current = ownerDocument.activeElement
      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }
    ownerDocument.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => {
      ownerDocument.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      })
      opener?.focus()
    }
    // Mount-once by design; onClose flows through onCloseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <ChatOverlayContext.Provider value={context}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-slot="chat-overlay"
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
