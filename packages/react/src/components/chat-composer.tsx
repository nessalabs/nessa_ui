"use client"

import * as React from "react"
import { ArrowUp, LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface ChatComposerContextValue {
  composerMaxHeight: React.CSSProperties["maxHeight"] | undefined
  constrained: boolean
  submitOnEnter: boolean
  size: "default" | "compact"
}

const ChatComposerContext = React.createContext<ChatComposerContextValue>({
  composerMaxHeight: undefined,
  constrained: false,
  submitOnEnter: true,
  size: "default",
})

export type ChatComposerBorderMode = "none" | "focus" | "always"

/** A compound message-entry form with independently composable input and footer controls. */
export interface ChatComposerProps extends React.ComponentProps<"form"> {
  /** Controls when the root surface border is visible. Defaults to `none`. */
  borderMode?: ChatComposerBorderMode
  /** Sets the preferred width in CSS pixels while preserving host containment. */
  width?: number
  /**
   * Caps the complete composer height in CSS pixels; the message input scrolls
   * within the cap. Values below the composer's intrinsic footer-safe height
   * clamp to that height, including when the footer wraps responsively.
   */
  maxHeight?: number
  submitOnEnter?: boolean
  size?: "default" | "compact"
}

function ChatComposer({
  borderMode = "none",
  width,
  maxHeight,
  submitOnEnter = true,
  size = "default",
  className,
  children,
  style,
  ...props
}: ChatComposerProps) {
  const responsiveWidth =
    width === undefined ? undefined : `min(${width}px, 100%)`
  const requestedMaxHeight = maxHeight ?? style?.maxHeight
  const effectiveMaxHeight = requestedMaxHeight
  const context = React.useMemo(
    () => ({
      composerMaxHeight: effectiveMaxHeight,
      constrained: effectiveMaxHeight !== undefined,
      submitOnEnter,
      size,
    }),
    [effectiveMaxHeight, size, submitOnEnter],
  )

  return (
    <ChatComposerContext.Provider value={context}>
      <form
        data-slot="chat-composer"
        data-border-mode={borderMode}
        className={cn(
          "relative grid min-w-0 w-full max-w-full gap-3 rounded-3xl border border-transparent bg-card p-3 font-sans text-card-foreground shadow-sm transition-[border-color,box-shadow]",
          effectiveMaxHeight !== undefined &&
            "grid-rows-[minmax(0,1fr)_auto] overflow-hidden",
          borderMode === "focus" &&
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
          borderMode === "always" &&
            "border-border focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
          effectiveMaxHeight === undefined &&
            (size === "compact" ? "min-h-24" : "min-h-32"),
          size === "compact" && "gap-2 rounded-2xl p-2.5",
          className,
        )}
        style={{
          ...style,
          ...(responsiveWidth === undefined
            ? undefined
            : { width: responsiveWidth }),
          minHeight:
            effectiveMaxHeight === undefined
              ? style?.minHeight
              : "min-content",
          maxHeight: effectiveMaxHeight,
        }}
        {...props}
      >
        {children}
      </form>
    </ChatComposerContext.Provider>
  )
}

export interface ChatComposerInputProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number
}

const ChatComposerInput = React.forwardRef<
  HTMLTextAreaElement,
  ChatComposerInputProps
>(({ className, maxHeight = 240, onChange, onKeyDown, ...props }, forwardedRef) => {
  const { composerMaxHeight, constrained, size, submitOnEnter } =
    React.useContext(ChatComposerContext)
  const localRef = React.useRef<HTMLTextAreaElement | null>(null)
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      localRef.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )

  const resize = React.useCallback(() => {
    const textarea = localRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    textarea.style.overflowY =
      textarea.scrollHeight > textarea.clientHeight ? "auto" : "hidden"
  }, [maxHeight])

  React.useLayoutEffect(() => {
    resize()
    const textarea = localRef.current
    if (!textarea || typeof ResizeObserver === "undefined") return
    let previousWidth = textarea.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const nextWidth = textarea.getBoundingClientRect().width
      if (nextWidth === previousWidth) return
      previousWidth = nextWidth
      resize()
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [composerMaxHeight, props.value, props.defaultValue, resize])

  return (
    <textarea
      ref={setRef}
      data-slot="chat-composer-input"
      rows={1}
      aria-label="Message"
      className={cn(
        "min-w-0 w-full resize-none bg-transparent px-1 py-1 font-sans text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        constrained ? "min-h-0 max-h-full" : "min-h-14",
        size === "compact" && !constrained && "min-h-10 text-sm leading-5",
        size === "compact" && constrained && "text-sm leading-5",
        className,
      )}
      onChange={(event) => {
        resize()
        onChange?.(event)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (
          event.defaultPrevented ||
          !submitOnEnter ||
          event.key !== "Enter" ||
          event.shiftKey ||
          event.nativeEvent.isComposing
        ) {
          return
        }
        event.preventDefault()
        const form = event.currentTarget.form
        if (!form) return
        const submitters = Array.from(
          form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
            'button:not([type]), button[type="submit"], input[type="submit"], input[type="image"]',
          ),
        )
        const enabledSubmitter = submitters.find(
          (submitter) => !submitter.matches(":disabled"),
        )
        if (submitters.length > 0 && !enabledSubmitter) return
        form.requestSubmit(enabledSubmitter)
      }}
      {...props}
    />
  )
})
ChatComposerInput.displayName = "ChatComposerInput"

function ChatComposerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-composer-footer"
      className={cn(
        "flex min-w-0 flex-wrap items-end justify-between gap-2",
        className,
      )}
      {...props}
    />
  )
}

function ChatComposerActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-composer-actions"
      className={cn(
        "flex min-w-0 max-w-full flex-nowrap items-center gap-1",
        className,
      )}
      {...props}
    />
  )
}

export interface ChatComposerActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const ChatComposerAction = React.forwardRef<
  HTMLButtonElement,
  ChatComposerActionProps
>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="chat-composer-action"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground outline-none transition-[color,background-color,box-shadow,transform] hover:bg-accent hover:text-accent-foreground focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  ),
)
ChatComposerAction.displayName = "ChatComposerAction"

export interface ChatComposerSubmitProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
}

const ChatComposerSubmit = React.forwardRef<
  HTMLButtonElement,
  ChatComposerSubmitProps
>(({ className, loading = false, children, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="submit"
    data-slot="chat-composer-submit"
    aria-label={loading ? "Sending message" : "Send message"}
    aria-busy={loading || undefined}
    disabled={disabled || loading}
    className={cn(
      "inline-flex size-9 shrink-0 items-center justify-center rounded-full border-0 bg-primary p-0 text-primary-foreground shadow-xs outline-none transition-[color,background-color,box-shadow,transform] hover:bg-primary/90 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4",
      className,
    )}
    {...props}
  >
    {children ??
      (loading ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <ArrowUp aria-hidden="true" />
      ))}
  </button>
))
ChatComposerSubmit.displayName = "ChatComposerSubmit"

export {
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerFooter,
  ChatComposerInput,
  ChatComposerSubmit,
}
