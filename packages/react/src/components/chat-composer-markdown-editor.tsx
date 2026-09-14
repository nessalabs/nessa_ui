"use client"

import * as React from "react"
import { Extension, Node, textblockTypeInputRule, type NodeViewProps, type Editor, type JSONContent } from "@tiptap/core"
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { useCodeSyntax, type CodeSyntaxToken } from "./code-editor-syntax"
import CodeBlock from "@tiptap/extension-code-block"
import StarterKit from "@tiptap/starter-kit"
import { Markdown } from "@tiptap/markdown"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { TableKit } from "@tiptap/extension-table"
import Image from "@tiptap/extension-image"
import { cn } from "@/lib/utils"
import { CodeEditor } from "./code-editor"
import { ChatComposerChipView } from "./chat-composer-editor-chip"
import { ChatComposerContext, requestComposerSubmit, scanTriggerToken, type ChatComposerInputAdapter } from "./chat-composer"
import type { ChatComposerChip, ChatComposerContent, ChatComposerEditorHandle, ChatComposerEditorProps } from "./chat-composer-editor"

/** An empty structured block already has visible formatting; only plain input needs a hint. */
function showsPlaceholder(editor: Editor): boolean {
  const { doc } = editor.state
  return doc.childCount === 1 && doc.firstChild?.type.name === "paragraph" && doc.firstChild.content.size === 0
}

const MarkdownChipCallbacks = React.createContext<Pick<ChatComposerEditorProps, "onChipPress" | "onChipHoverChange" | "disabled">>({})

function MarkdownChipView({ node }: NodeViewProps) {
  const callbacks = React.useContext(MarkdownChipCallbacks)
  return <NodeViewWrapper as="span" contentEditable={false} data-chip-id={node.attrs.chip.id}>
    <ChatComposerChipView chip={node.attrs.chip} onPress={callbacks.onChipPress} onHoverChange={callbacks.onChipHoverChange} />
  </NodeViewWrapper>
}

const codeSyntaxKey = new PluginKey("composerCodeSyntax")

/** Colors immutable code nodes without replacing editable DOM or changing draft content. */
function codeSyntaxPlugin() {
  const cache = new WeakMap<ProseMirrorNode, readonly CodeSyntaxToken[]>()
  return new Plugin({
    key: codeSyntaxKey,
    state: {
      init: () => 0,
      apply(tr, version) {
        const update = tr.getMeta(codeSyntaxKey) as { node: ProseMirrorNode; tokens: readonly CodeSyntaxToken[] | null } | undefined
        if (!update) return version
        if (update.tokens) cache.set(update.node, update.tokens)
        else cache.delete(update.node)
        return version + 1
      },
    },
    props: {
      decorations(state) {
        const decorations: Decoration[] = []
        state.doc.descendants((node, pos) => {
          if (node.type.name !== "codeBlock") return
          for (const token of cache.get(node) ?? []) {
            if (!token.content.length) continue
            decorations.push(Decoration.inline(pos + 1 + token.offset, pos + 1 + token.offset + token.content.length, {
              class: "nessa-code-token",
              style: `--code-light:${token.light};--code-dark:${token.dark}`,
            }))
          }
          return false
        })
        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}

/** Keeps editable code in ProseMirror while the language label stays outside the draft. */
function MarkdownCodeView({ node, editor, updateAttributes }: NodeViewProps) {
  const { tokens } = useCodeSyntax(node.textContent, node.attrs.language || "text")
  React.useEffect(() => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(codeSyntaxKey, { node, tokens }).setMeta("addToHistory", false))
  }, [editor, node, tokens])
  const { disabled } = React.useContext(MarkdownChipCallbacks)
  return <NodeViewWrapper data-slot="chat-composer-code-block" className="my-2">
    <CodeEditor language={node.attrs.language || "text"} disabled={disabled}
      onLanguageChange={(language) => updateAttributes({ language: language === "text" ? "" : language })}>
      <pre className="m-0 min-h-14 bg-transparent!"><NodeViewContent<"code"> as="code" className={node.attrs.language ? `language-${node.attrs.language}` : undefined} /></pre>
    </CodeEditor>
  </NodeViewWrapper>
}

/** Props shared with the plain editor, with Markdown parsing and serialization semantics. */
export interface ChatComposerMarkdownEditorProps extends ChatComposerEditorProps {
  /** Initial Markdown draft and ordered chips, restored once on mount without adding spaces. Remount to edit a different draft. */
  defaultContent?: ChatComposerContent
  /** Layout and presentation classes for the editor container. */
  className?: string
  /** React styles for the editor container, including dimensions and spacing. */
  style?: React.CSSProperties
}

/**
 * Structured live Markdown input for ChatComposer or PillComposer. Supports headings,
 * inline formatting, links, lists, task lists, quotes, tables and fenced code.
 * Typing three backticks creates a code block immediately; its header selects the language.
 * The shared handle inserts/parses Markdown and emits Markdown draft text with ordered
 * chip payloads. insertText preserves focus; call focus() explicitly to begin typing.
 * Shift+Enter starts a new paragraph in ordinary text, enabling block shortcuts.
 * Enter after headings starts an unformatted paragraph; lists/code
 * retain their editing keys. Mod+Enter submits. Large pastes still use the host's
 * attachment callback. The plain ChatComposerEditor remains independently usable.
 * HTML events run on the container (currentTarget); use the handle for draft content.
 * Paste/drop/key callbacks run before editor defaults and may preventDefault().
 * id, ARIA and keyboard/input attributes belong to the inner textbox.
 */
export function ChatComposerMarkdownEditor(props: ChatComposerMarkdownEditorProps) {
  const context = React.useContext(ChatComposerContext)
  const latest = React.useRef({ props, context })
  latest.current = { props, context }
  const extensions = React.useMemo(() => [
    StarterKit.configure({ codeBlock: false, trailingNode: false, link: { openOnClick: false, markdownLinks: true }, hardBreak: { keepMarks: false } }),
    CodeBlock.extend({
      addProseMirrorPlugins() { return [...(this.parent?.() ?? []), codeSyntaxPlugin()] },
      addInputRules() {
        return [...(this.parent?.() ?? []), textblockTypeInputRule({ find: /^```$/, type: this.type })]
      },
      addNodeView: () => ReactNodeViewRenderer(MarkdownCodeView),
    }),
    Markdown,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit,
    Image,
    Node.create({
      name: "composerChip", group: "inline", inline: true, atom: true,
      addAttributes: () => ({ chip: { default: null }, token: { default: null } }),
      // Never adopt chip identities from pasted HTML or Markdown.
      parseHTML: () => [],
      renderHTML: ({ node }) => ["span", { "data-chip-id": node.attrs.chip.id }, node.attrs.chip.label],
      renderMarkdown: (node) => node.attrs?.token ?? node.attrs?.chip.textValue ?? node.attrs?.chip.label ?? "",
      addNodeView: () => ReactNodeViewRenderer(MarkdownChipView),
    }),
    Extension.create({
      name: "composerKeys", priority: 1100,
      addKeyboardShortcuts() {
        const submit = () => { requestComposerSubmit(this.editor.view.dom.closest("form")); return true }
        const splitHeading = () => this.editor.chain().splitBlock({ keepMarks: false }).command(({ tr, dispatch }) => {
                if (dispatch) tr.setBlockType(tr.selection.from, tr.selection.to, this.editor.schema.nodes.paragraph).setStoredMarks([])
                return true
              }).run()
        const startCodeBlock = () => {
          const { empty, $from } = this.editor.state.selection
          const fence = /^(?:```|~~~)([^\s`~]*)$/.exec($from.parent.textContent)
          if (!empty || !fence || $from.parent.type.name !== "paragraph" || $from.parentOffset !== $from.parent.content.size) return false
          return this.editor.chain().deleteRange({ from: $from.start(), to: $from.end() }).setCodeBlock({ language: fence[1] }).run()
        }
        return {
          Backspace: () => {
            const { empty, $from } = this.editor.state.selection
            if (!empty || $from.parentOffset !== 0 || $from.depth < 2) return false
            const itemDepth = $from.depth - 1
            const itemType = $from.node(itemDepth).type.name
            if ((itemType !== "listItem" && itemType !== "taskItem") || $from.index(itemDepth) !== 0) return false
            // Outdent in place before input-rule undo can restore the Markdown marker.
            return this.editor.commands.liftListItem(itemType)
          },
          "Mod-Enter": submit,
          "Ctrl-Enter": submit,
          Enter: () => {
            const { $from } = this.editor.state.selection
            if (startCodeBlock()) return true
            if ($from.parent.type.name === "heading") {
              return splitHeading()
            }
            if ($from.parent.type.name === "codeBlock" || $from.depth > 1) return false
            if (latest.current.context.submitOnEnter) return submit()
            return this.editor.chain().splitBlock({ keepMarks: false }).unsetAllMarks().run()
          },
          "Shift-Enter": () => {
            if (startCodeBlock()) return true
            const { $from } = this.editor.state.selection
            if ($from.parent.type.name === "codeBlock") return this.editor.commands.insertContent("\n")
            if ($from.parent.type.name === "heading") return splitHeading()
            // Block shortcuts must see a paragraph start, not text after a hard break.
            if ($from.depth === 1 && $from.parent.type.name === "paragraph") {
              return this.editor.chain().splitBlock({ keepMarks: false }).unsetAllMarks().run()
            }
            return this.editor.chain().setHardBreak().unsetAllMarks().run()
          },
        }
      },
    }),
  ], [])
  const editor = useEditor({
    extensions, immediatelyRender: false,
    editable: !props.disabled,
    editorProps: {
      clipboardTextSerializer: (slice) => readContent({ type: "doc", content: slice.content.toJSON() }).text,
      handleDOMEvents: {
        keydown: (view, event) => {
          // Escape belongs to the surrounding pane/dialog rather than node selection.
          if (event.key === "Escape" && !event.isComposing) return true
          const { empty, from, $from } = view.state.selection
          if (event.isComposing || event.key !== "Backspace" || !empty || from !== 1 || $from.parent.type.name !== "paragraph") return false
          const removers = view.dom.closest("form")?.querySelectorAll<HTMLButtonElement>('[data-slot="chat-composer-attachments"] [data-slot="chat-composer-attachment-remove"]')
          const trailing = removers?.item(removers.length - 1)
          if (!trailing) return false
          event.preventDefault()
          if (!event.repeat) trailing.click()
          return true
        },
      },
      handlePaste: (_view, event) => {
        const { onPasteAttachment, pasteAttachmentMinLength = 500, onPasteFiles } = latest.current.props
        const text = event.clipboardData?.getData("text/plain") ?? ""
        if (text && _view.state.selection.$from.parent.type.name === "codeBlock") {
          _view.dispatch(_view.state.tr.insertText(text))
          return true
        }
        if (text && onPasteAttachment && text.length >= pasteAttachmentMinLength) onPasteAttachment(text)
        else if (text) editorRef.current?.commands.insertContent(text, { contentType: "markdown" })
        else onPasteFiles?.(Array.from(event.clipboardData?.files ?? []))
        return true
      },
      handleDrop: (view, event) => {
        if (event.dataTransfer?.files.length) return true
        if (view.dragging) return false
        const text = event.dataTransfer?.getData("text/plain")
        if (!text) return true
        const current = editorRef.current
        const point = current?.view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (point) current?.commands.setTextSelection(point.pos)
        if (current?.state.selection.$from.parent.type.name === "codeBlock") current.view.dispatch(current.state.tr.insertText(text))
        else current?.commands.insertContent(text, { contentType: "markdown" })
        return true
      },
    },
    onUpdate: ({ editor: current }) => {
      current.view.dom.dataset.empty = String(showsPlaceholder(current))
      latest.current.props.onContentChange?.(readContent())
    },
  })
  const editorRef = React.useRef(editor)
  editorRef.current = editor

  const initialContent = React.useRef(props.defaultContent)
  const initialized = React.useRef(false)
  React.useLayoutEffect(() => {
    if (!editor?.markdown || initialized.current) return
    initialized.current = true
    const content = initialContent.current
    if (!content) return
    const chips = new Map<string, ChatComposerContent["parts"][number]>()
    const prefix = `nessachip${crypto.randomUUID().replaceAll("-", "")}x`
    const source = content.parts.length ? content.parts.map((part, index) => {
      if (part.type === "text") return part.text
      const token = `${prefix}${index}z`
      chips.set(token, part)
      return token
    }).join("") : content.text
    const pattern = new RegExp(`${prefix}\\d+z`, "g")
    const restore = (node: JSONContent): JSONContent[] => {
      if (node.type === "text" && node.text) {
        const nodes: JSONContent[] = []
        let offset = 0
        for (const match of node.text.matchAll(pattern)) {
          const part = chips.get(match[0])
          if (part?.type !== "chip") continue
          if (match.index > offset) nodes.push({ ...node, text: node.text.slice(offset, match.index) })
          nodes.push({ type: "composerChip", attrs: { chip: part.chip }, marks: node.marks })
          offset = match.index + match[0].length
        }
        if (offset < node.text.length) nodes.push({ ...node, text: node.text.slice(offset) })
        return nodes
      }
      return [{ ...node, ...(node.content ? { content: node.content.flatMap(restore) } : {}) }]
    }
    editor.chain().setContent(restore(editor.markdown.parse(source))[0], { emitUpdate: false }).command(({ tr }) => { tr.setMeta("addToHistory", false); return true }).run()
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  }, [editor])

  /** Serializes through the Markdown schema, retaining ordered chip parts and raw payloads. */
  function readContent(document?: JSONContent): ChatComposerContent {
    const current = editorRef.current
    if (!current?.markdown) return { text: "", parts: [] }
    const chips = new Map<string, ChatComposerChip>()
    const doc = document ?? current.getJSON()
    const visit = (node: JSONContent) => {
      if (node.type === "composerChip" && node.attrs) {
        const token = `NESSACHIP${crypto.randomUUID().replaceAll("-", "")}END`
        chips.set(token, node.attrs.chip)
        node.type = "text"
        node.text = token
        delete node.attrs
      }
      node.content?.forEach(visit)
    }
    visit(doc)
    const markdown = current.markdown.serialize(doc)
    const parts: ChatComposerContent["parts"] = []
    const tokens = /NESSACHIP[a-f0-9]+END/g
    let offset = 0
    for (const match of markdown.matchAll(tokens)) {
      const chip = chips.get(match[0])
      if (!chip) continue
      if (match.index > offset) parts.push({ type: "text", text: markdown.slice(offset, match.index) })
      parts.push({ type: "chip", chip: { ...chip, textValue: chip.textValue ?? chip.label } })
      offset = match.index + match[0].length
    }
    if (offset < markdown.length) parts.push({ type: "text", text: markdown.slice(offset) })
    return { text: parts.map((part) => part.type === "text" ? part.text : part.chip.textValue).join(""), parts }
  }

  React.useImperativeHandle<ChatComposerEditorHandle | null, ChatComposerEditorHandle | null>(props.ref, () => editor ? ({
    focus: () => { editor?.commands.focus() },
    clear: () => { editor?.commands.clearContent() },
    insertText: (text) => { if (!latest.current.props.disabled) editor?.commands.insertContent(text, { contentType: "markdown" }) },
    insertChip: (chip) => { if (!latest.current.props.disabled) editor?.chain().focus().insertContent([{ type: "composerChip", attrs: { chip } }, { type: "text", text: " " }]).run() },
    getContent: readContent,
  }) : null, [editor])

  React.useLayoutEffect(() => {
    if (!editor) return
    const token = (trigger: string) => {
      const { empty, $from, from } = editor.state.selection
      if (!empty || !$from.parent.isTextblock) return null
      const text = $from.parent.textBetween(0, $from.parentOffset, "", "\ufffc")
      const found = scanTriggerToken(text, text.length, trigger)
      return found ? { start: from - text.length + found.start, query: found.query } : null
    }
    const adapter: ChatComposerInputAdapter = {
      element: editor.view.dom,
      readToken: (trigger) => { const value = token(trigger); return value ? { key: String(value.start), query: value.query } : null },
      hasTokenAnchor: (trigger, key) => { const start = Number(key); return start >= 0 && start + trigger.length <= editor.state.doc.content.size && editor.state.doc.textBetween(start, start + trigger.length) === trigger },
      replaceToken: (trigger, replacement) => { const found = token(trigger); if (found) editor.chain().focus().insertContentAt({ from: found.start, to: editor.state.selection.from }, replacement ? { type: "text", text: replacement } : []).run() },
      insertText: (text) => { editor.chain().focus().insertContent({ type: "text", text }).run() },
      deleteBackward: () => { editor.commands.focus(); editor.view.dom.ownerDocument.execCommand("delete") },
    }
    context.registerInput(adapter)
    return () => context.registerInput(null)
  }, [editor, context.registerInput])

  const { defaultContent: _defaultContent, className, style, maxHeight = 240, scrollbar = false, disabled, placeholder, "aria-label": label, ref: _ref, onContentChange: _change, onChipPress: _press, onChipHoverChange: _hover, onPasteAttachment: _pasteAttachment, pasteAttachmentMinLength: _minPaste, onPasteFiles: _files, onPaste, onDrop, onKeyDown, onPasteCapture, onDropCapture, onKeyDownCapture, ...rest } = props
  const textboxKeys = new Set(["id", "title", "tabIndex", "spellCheck", "autoCapitalize", "autoCorrect", "autoComplete", "inputMode", "lang", "dir"])
  const textboxAttributes = Object.fromEntries(Object.entries(rest).filter(([key]) => key.startsWith("aria-") || key.startsWith("data-") || textboxKeys.has(key)).map(([key, value]) => [key.toLowerCase(), value == null ? "" : String(value)]))
  const containerProps = Object.fromEntries(Object.entries(rest).filter(([key]) => !key.startsWith("aria-") && !key.startsWith("data-") && !textboxKeys.has(key)))
  const attributesKey = JSON.stringify(textboxAttributes)
  const cap = context.constrained ? (style?.maxHeight ?? (context.composerMaxHeight === undefined ? maxHeight : undefined)) : maxHeight
  React.useLayoutEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled, false)
    editor.setOptions({ editorProps: { attributes: {
      ...JSON.parse(attributesKey),
      "data-slot": "chat-composer-editor", role: "textbox", "aria-label": label ?? "Message", "aria-multiline": "true", "aria-disabled": String(!!disabled),
      "data-placeholder": placeholder ?? "", "data-empty": String(showsPlaceholder(editor)),
      class: cn("relative [&[data-empty=true]]:before:absolute [&[data-empty=true]]:before:pointer-events-none [&[data-empty=true]]:before:text-muted-foreground [&[data-empty=true]]:before:content-[attr(data-placeholder)] min-w-0 w-full overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent px-1 py-1 font-sans nessa-text-4 text-foreground outline-none",
        "[&_p]:min-h-[1lh] [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h1]:text-[1.428571em] [&_h2]:text-[1.285714em] [&_h3]:text-[1.142857em] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:font-mono [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:whitespace-pre-wrap [&_pre_code]:block [&_pre_code]:bg-transparent [&_pre_code]:rounded-none [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:gap-2",
        !scrollbar && "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden", context.constrained ? "min-h-0 max-h-full" : "min-h-14", disabled && "cursor-not-allowed opacity-50"),
    } } })
    const dom = editor.view.dom
    dom.style.maxHeight = "inherit"
    dom.style.height = "100%"
  }, [editor, disabled, label, placeholder, context.constrained, context.size, scrollbar, attributesKey])
  const chipCallbacks = React.useMemo(() => ({ onChipPress: props.onChipPress, onChipHoverChange: props.onChipHoverChange, disabled: props.disabled }), [props.onChipPress, props.onChipHoverChange, props.disabled])
  return <MarkdownChipCallbacks.Provider value={chipCallbacks}><EditorContent editor={editor} data-slot="chat-composer-markdown-editor" className={cn("min-w-0 flex-1", context.constrained && "min-h-0 overflow-hidden", className)} style={{ maxHeight: cap, ...style }} {...containerProps} onPasteCapture={(event) => { onPasteCapture?.(event); if (!event.defaultPrevented) onPaste?.(event) }} onDropCapture={(event) => { onDropCapture?.(event); if (!event.defaultPrevented) onDrop?.(event) }} onKeyDownCapture={(event) => { onKeyDownCapture?.(event); if (!event.defaultPrevented) onKeyDown?.(event) }} /></MarkdownChipCallbacks.Provider>
}
