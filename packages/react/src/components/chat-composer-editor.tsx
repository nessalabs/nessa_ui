"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

import {
  ChatComposerAttachmentIcon,
  ChatComposerContext,
  requestComposerSubmit,
  scanTriggerToken,
  type ChatComposerAttachmentKind,
  type ChatComposerInputAdapter,
} from "./chat-composer"

/** One chip in a ChatComposerEditor: identity, label, and presentation. */
export interface ChatComposerChip {
  id: string
  /** The visible chip label; also the default plain-text serialization. */
  label: string
  /** Selects the built-in leading icon and is exposed as `data-kind` for styling. */
  kind?: ChatComposerAttachmentKind
  /** Replaces the kind's built-in leading icon; any node works, e.g. an avatar `<img>`. */
  icon?: React.ReactNode
  /** Serialized into plain-text content in place of the chip. Defaults to the label. */
  textValue?: string
  /** Extends the chip's classes, e.g. a custom text color. */
  className?: string
}

/** One run of a ChatComposerEditor's content: plain text or an atomic chip. */
export type ChatComposerContentPart =
  | { type: "text"; text: string }
  | {
      type: "chip"
      chip: {
        id: string
        label: string
        kind?: ChatComposerAttachmentKind
        textValue: string
      }
    }

/** A ChatComposerEditor's serialized content. */
export interface ChatComposerContent {
  /** The plain-text serialization; each chip contributes its textValue. */
  text: string
  parts: ChatComposerContentPart[]
}

/** The imperative surface of a ChatComposerEditor. */
export interface ChatComposerEditorHandle {
  focus: () => void
  /** Empties the editor and reports the empty content. */
  clear: () => void
  /** Inserts an atomic chip at the caret, followed by a space. */
  insertChip: (chip: ChatComposerChip) => void
  /** Inserts plain text at the caret. */
  insertText: (text: string) => void
  getContent: () => ChatComposerContent
}

/**
 * Serializes the editor DOM into text and parts. Chip hosts carry their data
 * as attributes, so content restored by browser undo still serializes;
 * `isKnownChip` rejects hosts the editor never created (for example markup
 * dropped in from outside), which serialize as their visible text instead.
 * Block elements contribute a newline boundary so multi-line DOM the flatten
 * pass has not visited yet keeps its line structure.
 */
function serializeEditorContent(
  root: HTMLElement,
  isKnownChip?: (id: string) => boolean,
): ChatComposerContent {
  const parts: ChatComposerContentPart[] = []
  let text = ""
  const pushText = (value: string) => {
    if (!value) return
    text += value
    const last = parts[parts.length - 1]
    if (last?.type === "text") last.text += value
    else parts.push({ type: "text", text: value })
  }
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText((node as Text).data)
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (
      node.dataset.chipId !== undefined &&
      (isKnownChip?.(node.dataset.chipId) ?? true)
    ) {
      const chip = {
        id: node.dataset.chipId,
        label: node.dataset.chipLabel ?? "",
        kind: node.dataset.kind as ChatComposerAttachmentKind | undefined,
        textValue: node.dataset.chipText ?? node.dataset.chipLabel ?? "",
      }
      parts.push({ type: "chip", chip })
      text += chip.textValue
      return
    }
    if (node.tagName === "BR") {
      pushText("\n")
      return
    }
    if (/^(DIV|P|LI|BLOCKQUOTE)$/.test(node.tagName) && text.length > 0 && !text.endsWith("\n")) {
      pushText("\n")
    }
    node.childNodes.forEach(visit)
  }
  root.childNodes.forEach(visit)
  return { text, parts }
}

interface EditorToken {
  node: Text
  start: number
  caret: number
  query: string
}

/** Reads the trigger token under an editor caret within its text node. */
function readEditorToken(
  root: HTMLElement,
  trigger: string,
): EditorToken | null {
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null
  }
  const node = selection.anchorNode
  if (!(node instanceof Text) || node.parentNode !== root) return null
  const caret = selection.anchorOffset
  const scan = scanTriggerToken(node.data, caret, trigger)
  return scan ? { node, start: scan.start, caret, query: scan.query } : null
}

/**
 * Builds the trigger adapter over a chip-capable editor root. Token anchors
 * are keyed by text-node identity rather than childNodes position, so
 * insertions elsewhere in the editor cannot silently re-point a recorded
 * Escape dismissal at a different node.
 */
function createEditorAdapter(root: HTMLElement): ChatComposerInputAdapter {
  let anchorSequence = 0
  const anchors = new Map<string, { node: Text; start: number }>()
  const anchorKey = (node: Text, start: number) => {
    for (const [key, entry] of anchors) {
      if (!entry.node.isConnected) {
        anchors.delete(key)
        continue
      }
      if (entry.node === node && entry.start === start) return key
    }
    anchorSequence += 1
    const key = `anchor-${anchorSequence}`
    anchors.set(key, { node, start })
    return key
  }
  return {
    element: root,
    readToken: (trigger) => {
      const token = readEditorToken(root, trigger)
      return token
        ? { key: anchorKey(token.node, token.start), query: token.query }
        : null
    },
    hasTokenAnchor: (trigger, key) => {
      const entry = anchors.get(key)
      return (
        entry !== undefined &&
        entry.node.isConnected &&
        entry.node.parentNode === root &&
        entry.node.data.startsWith(trigger, entry.start)
      )
    },
    replaceToken: (trigger, replaceWith) => {
      root.focus()
      const token = readEditorToken(root, trigger)
      if (!token) return
      const doc = root.ownerDocument
      const selection = doc.getSelection()
      if (!selection) return
      const range = doc.createRange()
      range.setStart(token.node, token.start)
      range.setEnd(token.node, token.caret)
      selection.removeAllRanges()
      selection.addRange(range)
      if (replaceWith) doc.execCommand("insertText", false, replaceWith)
      else doc.execCommand("delete")
    },
    insertText: (text) => {
      root.focus()
      root.ownerDocument.execCommand("insertText", false, text)
    },
    deleteBackward: () => {
      root.focus()
      root.ownerDocument.execCommand("delete")
    },
  }
}

/**
 * Renders one editor chip's visual content inside its non-editable host.
 * The chip is plain inline text — an icon aligned to the type baseline plus
 * the label — so it inherits the editor's font metrics and sits on the same
 * baseline as the surrounding message text.
 */
function ChatComposerChipView({
  chip,
  onPress,
  onHoverChange,
}: {
  chip: ChatComposerChip
  onPress?: (chip: ChatComposerChip) => void
  onHoverChange?: (
    chip: ChatComposerChip | null,
    element: HTMLElement | null,
  ) => void
}) {
  return (
    <span
      data-slot="chat-composer-chip"
      data-kind={chip.kind}
      onClick={onPress ? () => onPress(chip) : undefined}
      onMouseEnter={
        onHoverChange
          ? (event) => onHoverChange(chip, event.currentTarget)
          : undefined
      }
      onMouseLeave={onHoverChange ? () => onHoverChange(null, null) : undefined}
      className={cn(
        "select-none whitespace-nowrap",
        onPress && "cursor-pointer",
        chip.className,
      )}
    >
      <ChatComposerAttachmentIcon
        kind={chip.kind}
        icon={chip.icon}
        className="mr-1 size-3.5 align-[-0.125em]"
      />
      {chip.label}
    </span>
  )
}

interface ChipMount {
  key: number
  chip: ChatComposerChip
  host: HTMLElement
}

export interface ChatComposerEditorProps
  extends Omit<React.ComponentProps<"div">, "children" | "onChange" | "ref"> {
  ref?: React.Ref<ChatComposerEditorHandle>
  placeholder?: string
  disabled?: boolean
  /** Caps the editor's height in CSS pixels before it scrolls; the composer's own maxHeight takes over when set. Defaults to 240. */
  maxHeight?: number
  /** Reports the serialized content after every edit, chip insertion, or chip removal. */
  onContentChange?: (content: ChatComposerContent) => void
  /**
   * Receives a chip when the user presses it, so the host can offer actions.
   * Chip press and hover are pointer affordances on inline text — the
   * declared inline-text exception to the interactive target contract —
   * so hosts must keep an equivalent keyboard path to the same actions
   * (chips remain keyboard-deletable via Backspace).
   */
  onChipPress?: (chip: ChatComposerChip) => void
  /**
   * Receives the hovered chip and its element on pointer enter, and
   * `(null, null)` on leave, so the host can anchor hover surfaces such as a
   * contact card or preview.
   */
  onChipHoverChange?: (
    chip: ChatComposerChip | null,
    element: HTMLElement | null,
  ) => void
  /**
   * Receives pasted plain text at least `pasteAttachmentMinLength` characters
   * long instead of inserting it, so the host can insert a chip (via the
   * editor handle) or store it elsewhere. Shorter pastes insert as plain
   * text. Omit to keep every paste inline.
   */
  onPasteAttachment?: (text: string) => void
  /** The minimum pasted-text length that `onPasteAttachment` captures. Defaults to 500. */
  pasteAttachmentMinLength?: number
  /**
   * Receives files from a paste or drop that carried no plain text (for
   * example a copied screenshot), so the host can attach them. Without it,
   * file payloads are ignored; text content is never affected.
   */
  onPasteFiles?: (files: readonly File[]) => void
}

/**
 * Renders a rich message input where attachments are true inline chips:
 * atomic non-editable islands that flow with the text, keep their position in
 * the sentence, delete as a whole on Backspace, and surface press actions via
 * `onChipPress`. Text editing, IME, and selection stay native contenteditable
 * behavior; chips are inserted through the imperative handle (typically after
 * a ChatComposerTrigger selection). Enter submits per the composer's
 * submitOnEnter (line break otherwise); Shift+Enter always inserts a line
 * break. Pastes and drops land as plain text. Chip insertion sits outside the
 * browser's text undo stack: undo restores a chip's host and the editor
 * re-adopts it, but interleaved undo ordering is not transactional.
 */
function ChatComposerEditor({
  className,
  style,
  placeholder,
  disabled = false,
  maxHeight = 240,
  onContentChange,
  onChipPress,
  onChipHoverChange,
  onPasteAttachment,
  pasteAttachmentMinLength = 500,
  onPasteFiles,
  onKeyDown,
  onPaste,
  onDrop,
  onInput,
  ref,
  "aria-label": ariaLabel,
  ...props
}: ChatComposerEditorProps) {
  const { constrained, registerInput, size, submitOnEnter } =
    React.useContext(ChatComposerContext)
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(
    null,
  )
  // Every chip ever inserted, kept as tombstones: browser undo can restore a
  // deleted chip host, and serialization only trusts hosts recorded here.
  const knownChipsRef = React.useRef(new Map<string, ChatComposerChip>())
  const mountSequence = React.useRef(0)
  const [mounts, setMounts] = React.useState<ChipMount[]>([])
  const onContentChangeRef = React.useRef(onContentChange)
  React.useEffect(() => {
    onContentChangeRef.current = onContentChange
  })

  const adapter = React.useMemo(
    () => (rootElement ? createEditorAdapter(rootElement) : null),
    [rootElement],
  )
  // Layout-effect registration keeps unregister-then-register ordering when a
  // host swaps between the editor and the textarea input in one commit.
  React.useLayoutEffect(() => {
    registerInput(adapter)
    return () => registerInput(null)
  }, [adapter, registerInput])

  /** Returns whether a chip id was created by this editor (or survives as an undo tombstone). */
  const isKnownChip = React.useCallback(
    (id: string) => knownChipsRef.current.has(id),
    [],
  )

  /** Reports serialized content to the host; skips the walk when nobody listens. */
  const emitChange = React.useCallback(() => {
    if (!rootElement || !onContentChangeRef.current) return
    onContentChangeRef.current(serializeEditorContent(rootElement, isKnownChip))
  }, [isKnownChip, rootElement])

  /**
   * Rebuilds the flat Text | chip | <br> child list the editor guarantees:
   * browsers wrap lines in <div>/<p> blocks on native edits and multi-line
   * insertText, which would otherwise break token reading, atomic chip
   * deletion, and serialization. Preserves the caret across the rebuild.
   */
  const flattenBlocks = React.useCallback(() => {
    const root = rootElement
    if (!root) return
    let needsFlatten = false
    for (let child = root.firstChild; child; child = child.nextSibling) {
      if (child instanceof Text) continue
      if (
        child instanceof HTMLElement &&
        (child.dataset.chipId !== undefined || child.tagName === "BR")
      ) {
        continue
      }
      needsFlatten = true
      break
    }
    if (!needsFlatten) return
    const doc = root.ownerDocument
    const selection = doc.getSelection()
    const saved =
      selection &&
      selection.rangeCount > 0 &&
      selection.anchorNode &&
      root.contains(selection.anchorNode)
        ? { node: selection.anchorNode, offset: selection.anchorOffset }
        : null
    const flat: Node[] = []
    const visit = (node: Node) => {
      if (node instanceof Text) {
        flat.push(node)
        return
      }
      if (!(node instanceof HTMLElement)) return
      if (node.dataset.chipId !== undefined || node.tagName === "BR") {
        flat.push(node)
        return
      }
      // A block wrapper marks a line boundary before its content.
      if (flat.length > 0) flat.push(doc.createElement("br"))
      Array.from(node.childNodes).forEach(visit)
    }
    Array.from(root.childNodes).forEach(visit)
    root.replaceChildren(...flat)
    if (selection) {
      const range = doc.createRange()
      if (saved && saved.node.isConnected && root.contains(saved.node)) {
        const max =
          saved.node instanceof Text
            ? saved.node.data.length
            : saved.node.childNodes.length
        range.setStart(saved.node, Math.min(saved.offset, max))
      } else {
        range.selectNodeContents(root)
        range.collapse(false)
      }
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, [rootElement])

  /**
   * Prunes portal mounts whose host left the DOM and re-adopts known chip
   * hosts that returned (browser undo restores them as static clones): the
   * restored host is emptied and a fresh portal takes over its rendering.
   */
  const reconcileMounts = React.useCallback(() => {
    const root = rootElement
    if (!root) return
    if (
      mounts.length === 0 &&
      !root.querySelector("[data-chip-id]")
    ) {
      return
    }
    let changed = false
    const connected = mounts.filter((mount) => {
      const ok = mount.host.isConnected
      if (!ok) changed = true
      return ok
    })
    const mountedHosts = new Set(connected.map((mount) => mount.host))
    const adopted: ChipMount[] = []
    root.querySelectorAll<HTMLElement>("[data-chip-id]").forEach((host) => {
      if (mountedHosts.has(host)) return
      const chip = knownChipsRef.current.get(host.dataset.chipId ?? "")
      if (!chip) return
      host.replaceChildren()
      mountSequence.current += 1
      adopted.push({ key: mountSequence.current, chip, host })
      changed = true
    })
    if (changed) setMounts([...connected, ...adopted])
  }, [mounts, rootElement])

  /** Collapses browser-left `<br>` remnants so the CSS :empty placeholder shows. */
  const normalizeEmpty = React.useCallback(() => {
    const root = rootElement
    if (!root || root.childNodes.length === 0 || root.childNodes.length > 2) {
      return
    }
    const first = root.firstChild
    if (first instanceof Text && first.data !== "") return
    if (root.textContent === "" && !root.querySelector("[data-chip-id]")) {
      root.replaceChildren()
    }
  }, [rootElement])

  /** Finds the chip host directly before the collapsed caret, if any. */
  const chipBeforeCaret = React.useCallback(() => {
    const root = rootElement
    if (!root) return null
    const selection = root.ownerDocument.getSelection()
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return null
    }
    const { anchorNode, anchorOffset } = selection
    let candidate: Node | null = null
    if (anchorNode === root) {
      candidate = root.childNodes[anchorOffset - 1] ?? null
    } else if (
      anchorNode instanceof Text &&
      anchorNode.parentNode === root &&
      anchorOffset === 0
    ) {
      candidate = anchorNode.previousSibling
    }
    return candidate instanceof HTMLElement &&
      candidate.dataset.chipId !== undefined
      ? candidate
      : null
  }, [rootElement])

  /**
   * Creates the chip's non-editable host at the caret (replacing any
   * selection), appends a trailing space, moves the caret after it, and
   * registers the chip for portal rendering and serialization.
   */
  const insertChip = React.useCallback(
    (chip: ChatComposerChip) => {
      const root = rootElement
      if (!root || disabled) return
      knownChipsRef.current.set(chip.id, chip)
      const doc = root.ownerDocument
      const host = doc.createElement("span")
      host.setAttribute("data-slot", "chat-composer-chip-host")
      host.setAttribute("data-chip-id", chip.id)
      host.setAttribute("data-chip-label", chip.label)
      host.setAttribute("data-chip-text", chip.textValue ?? chip.label)
      if (chip.kind) host.setAttribute("data-kind", chip.kind)
      host.contentEditable = "false"
      root.focus()
      const selection = doc.getSelection()
      let range: Range
      if (
        selection &&
        selection.rangeCount > 0 &&
        root.contains(selection.getRangeAt(0).startContainer)
      ) {
        range = selection.getRangeAt(0)
        range.deleteContents()
      } else {
        range = doc.createRange()
        range.selectNodeContents(root)
        range.collapse(false)
      }
      range.insertNode(host)
      const space = doc.createTextNode(" ")
      host.after(space)
      range.setStartAfter(space)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
      mountSequence.current += 1
      setMounts((previous) => [
        ...previous.filter((mount) => mount.host.isConnected),
        { key: mountSequence.current, chip, host },
      ])
      emitChange()
    },
    [disabled, emitChange, rootElement],
  )

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => rootElement?.focus(),
      clear: () => {
        rootElement?.replaceChildren()
        setMounts([])
        emitChange()
      },
      insertChip,
      insertText: (text: string) => {
        if (!disabled) adapter?.insertText(text)
      },
      getContent: () =>
        rootElement
          ? serializeEditorContent(rootElement, isKnownChip)
          : { text: "", parts: [] },
    }),
    [adapter, disabled, emitChange, insertChip, isKnownChip, rootElement],
  )

  /** Inserts a line break with a Range fallback where execCommand("insertLineBreak") is unsupported (Firefox). */
  const insertLineBreak = React.useCallback(() => {
    const root = rootElement
    if (!root) return
    const doc = root.ownerDocument
    if (doc.execCommand("insertLineBreak")) return
    const selection = doc.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer)) return
    range.deleteContents()
    const lineBreak = doc.createElement("br")
    range.insertNode(lineBreak)
    range.setStartAfter(lineBreak)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    root.dispatchEvent(new Event("input", { bubbles: true }))
  }, [rootElement])

  return (
    <>
      <div
        ref={setRootElement}
        data-slot="chat-composer-editor"
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? "Message"}
        aria-disabled={disabled || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={cn(
          // Like ChatComposerInput, the editor carries no border or focus
          // outline: the caret indicates focus and the composer's borderMode
          // owns any surface treatment.
          "min-w-0 w-full overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent px-1 py-1 font-sans nessa-text-5 leading-6 text-foreground outline-none",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          constrained ? "min-h-0 max-h-full" : "min-h-14",
          size === "compact" && !constrained && "min-h-10 nessa-text-4 leading-5",
          size === "compact" && constrained && "nessa-text-4 leading-5",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        style={{
          ...style,
          maxHeight: constrained ? style?.maxHeight : maxHeight,
        }}
        onInput={(event) => {
          onInput?.(event)
          if (!(event.nativeEvent as InputEvent).isComposing) {
            flattenBlocks()
            normalizeEmpty()
          }
          reconcileMounts()
          emitChange()
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || event.nativeEvent.isComposing) return
          if (event.key === "Backspace") {
            const chip = chipBeforeCaret()
            if (chip) {
              // A chip deletes as a whole per fresh press; key auto-repeat
              // stops at a chip instead of plowing through it.
              event.preventDefault()
              if (!event.repeat) {
                chip.remove()
                reconcileMounts()
                emitChange()
              }
              return
            }
          }
          if (event.key === "Enter" && (event.shiftKey || !submitOnEnter)) {
            // Handled here so the browser never splits lines into <div>
            // blocks; flattenBlocks still guards edits that bypass this.
            event.preventDefault()
            insertLineBreak()
            return
          }
          if (event.key === "Enter" && submitOnEnter && !event.shiftKey) {
            event.preventDefault()
            requestComposerSubmit(event.currentTarget.closest("form"))
          }
        }}
        onPaste={(event) => {
          onPaste?.(event)
          if (event.defaultPrevented) return
          // Always intercept so pasted content lands as plain text.
          event.preventDefault()
          const text = event.clipboardData.getData("text/plain")
          if (!text) {
            const files = Array.from(event.clipboardData.files)
            if (files.length > 0) onPasteFiles?.(files)
            return
          }
          if (onPasteAttachment && text.length >= pasteAttachmentMinLength) {
            onPasteAttachment(text)
            return
          }
          event.currentTarget.ownerDocument.execCommand(
            "insertText",
            false,
            text,
          )
        }}
        onDrop={(event) => {
          onDrop?.(event)
          if (event.defaultPrevented) return
          // Drops bypass the paste handler; intercept them the same way so
          // rich HTML (or markup posing as a chip host) never enters the DOM.
          event.preventDefault()
          const files = Array.from(event.dataTransfer.files)
          if (files.length > 0) {
            onPasteFiles?.(files)
            return
          }
          const text = event.dataTransfer.getData("text/plain")
          if (!text) return
          const root = event.currentTarget
          const doc = root.ownerDocument
          root.focus()
          const dropRange = doc.caretRangeFromPoint?.(
            event.clientX,
            event.clientY,
          )
          const selection = doc.getSelection()
          if (dropRange && selection && root.contains(dropRange.startContainer)) {
            selection.removeAllRanges()
            selection.addRange(dropRange)
          }
          doc.execCommand("insertText", false, text)
        }}
        {...props}
      />
      {mounts.map((mount) =>
        createPortal(
          <ChatComposerChipView
            chip={mount.chip}
            onPress={onChipPress}
            onHoverChange={onChipHoverChange}
          />,
          mount.host,
          `chip-${mount.key}`,
        ),
      )}
    </>
  )
}

export { ChatComposerEditor }
