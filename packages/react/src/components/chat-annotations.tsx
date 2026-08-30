"use client"

import * as React from "react"
import { Pencil, X } from "lucide-react"

import {
  ChatBubble,
  ChatBubbleEditor,
  ChatMessage,
  ChatMessageAction,
  ChatMessageQuote,
} from "./chat-bubbles"
import { cn } from "@/lib/utils"

const chatAnnotationsFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

export interface ChatAnnotation {
  /** Identifies the annotation across edits and removals. */
  id: string
  /** The passage the reader lifted out of a document. */
  text: string
  /**
   * The reader's notes on that passage, oldest first. Several are ordinary:
   * one is written when the passage is first commented on, and more are added
   * later from the conversation.
   */
  comments?: string[]
  /** Names the document the passage came from, e.g. `SKILL.md`. */
  sourceLabel?: string
  /**
   * The host's identifier for that document. Nothing here reads it — it
   * rides along so the host can answer `onOpenSource` without keeping a
   * second map from annotations to what they were lifted out of.
   */
  sourceId?: string
}

/**
 * Reads a whole annotation as a short conversation: the lifted passage is the
 * document's message and the reader's comments are their replies. That is the
 * point of the component — an annotation is not metadata bolted to a chat, it
 * is the same shape as the chat around it.
 *
 * Passing `onSelect` makes the passage the target for the next comment;
 * `onEditComment` lets a comment be rewritten in place; and `onRemove` offers
 * the discard control. A view that omits all three — the read-only record of
 * annotations already sent — renders the same thread without affordances.
 * `children` replaces the passage's rendering, so a host can put a markdown
 * renderer in the bubble instead of plain text.
 */
export interface ChatAnnotationThreadProps
  extends Omit<React.ComponentProps<"div">, "children" | "onSelect"> {
  annotation: ChatAnnotation
  /** Marks this annotation as the one a follow-up comment attaches to. */
  selected?: boolean
  /** Selects (or deselects) this annotation. Also makes the passage pressable. */
  onSelect?: () => void
  /** Discards the annotation. Omit in read-only views. */
  onRemove?: () => void
  /** Opens the document the passage came from. Needs `sourceLabel` to show. */
  onOpenSource?: () => void
  /** Rewrites one comment, by its index in `comments`. Omit in read-only views. */
  onEditComment?: (index: number, text: string) => void
  /** Replaces the passage's plain text, e.g. with a markdown renderer. */
  children?: React.ReactNode
}

function ChatAnnotationThread({
  annotation,
  selected = false,
  onSelect,
  onRemove,
  onOpenSource,
  onEditComment,
  className,
  children,
  ...props
}: ChatAnnotationThreadProps) {
  return (
    <div
      data-slot="chat-annotation-thread"
      data-selected={selected || undefined}
      className={cn("flex items-start gap-2", className)}
      {...props}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1 rounded-2xl p-1 transition-colors",
          selected && "bg-(--nessa-chat-accent)/10",
        )}
      >
        <ChatMessage tone="received" className="max-w-full">
          <ChatBubble
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect}
            onKeyDown={
              onSelect
                ? (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    onSelect()
                  }
                : undefined
            }
            className={cn(
              "px-4 py-2.5",
              onSelect && cn("cursor-pointer", chatAnnotationsFocusClassName),
            )}
          >
            {children ?? annotation.text}
          </ChatBubble>
          {annotation.sourceLabel && onOpenSource ? (
            <button
              type="button"
              data-slot="chat-annotation-source"
              onClick={onOpenSource}
              className={cn(
                "self-start rounded-full border-0 bg-transparent px-1 py-0 font-sans nessa-text-1 text-(--nessa-chat-accent) hover:underline",
                chatAnnotationsFocusClassName,
              )}
            >
              {annotation.sourceLabel}
            </button>
          ) : null}
        </ChatMessage>
        {annotation.comments?.map((comment, index) => (
          <ChatMessage
            key={index}
            tone="sent"
            className="max-w-full self-end"
            animateIn={false}
          >
            <ChatAnnotationComment
              text={comment}
              onSave={
                onEditComment ? (next) => onEditComment(index, next) : undefined
              }
            />
          </ChatMessage>
        ))}
      </div>
      {onRemove ? (
        <span className="mt-1.5 shrink-0">
          <ChatMessageAction
            aria-label="Discard annotation"
            title="Discard annotation"
            onClick={onRemove}
          >
            <X aria-hidden="true" />
          </ChatMessageAction>
        </span>
      ) : null}
    </div>
  )
}

/**
 * One comment inside a thread. With `onSave` it reveals an edit control on
 * hover and swaps into the in-bubble editor when pressed; without one it is a
 * plain sent bubble.
 */
function ChatAnnotationComment({
  text,
  onSave,
}: {
  text: string
  onSave?: (text: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  if (editing && onSave) {
    return (
      <ChatBubbleEditor
        aria-label="Edit comment"
        defaultValue={text}
        onSave={(next) => {
          onSave(next)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }
  return (
    <span className="group/comment flex max-w-full items-center gap-1 self-end">
      {onSave ? (
        <ChatMessageAction
          aria-label="Edit comment"
          title="Edit comment"
          onClick={() => setEditing(true)}
          className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/comment:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Pencil aria-hidden="true" />
        </ChatMessageAction>
      ) : null}
      <ChatBubble>{text}</ChatBubble>
    </span>
  )
}

/** A column of annotation threads, named for assistive technology. */
function ChatAnnotationList({
  className,
  "aria-label": ariaLabel = "Annotations",
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-annotation-list"
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

export interface ChatAnnotationBadgeProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /** How many annotations the message carries. */
  count: number
  /** Opens the annotations. Without it the badge is a plain label. */
  onOpen?: () => void
}

/**
 * The whole set of annotations a sent message carries, compressed into one
 * quote chip. A message that spilled every lifted passage into the transcript
 * would bury the conversation it belongs to; this keeps the message one
 * message and hands the detail to a reading view.
 */
function ChatAnnotationBadge({
  count,
  onOpen,
  className,
  ...props
}: ChatAnnotationBadgeProps) {
  return (
    <ChatMessageQuote
      data-slot="chat-annotation-badge"
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={
        onOpen
          ? (event) => {
              event.stopPropagation()
              onOpen()
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              event.stopPropagation()
              onOpen()
            }
          : undefined
      }
      className={cn(
        onOpen &&
          cn(
            "cursor-pointer hover:bg-accent",
            chatAnnotationsFocusClassName,
          ),
        className,
      )}
      {...props}
    >
      {count === 1 ? "1 annotation" : `${count} annotations`}
    </ChatMessageQuote>
  )
}

export {
  ChatAnnotationBadge,
  ChatAnnotationComment,
  ChatAnnotationList,
  ChatAnnotationThread,
}
