import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { Button, ChatBubble, ChatComposerInput, ChatComposerEditor, MessageMarkdown, ChatComposer, ChatComposerFooter, ChatComposerSubmit, ChatComposerTrigger, SectionedListbox, ChatComposerMarkdownEditor, type ChatComposerEditorHandle } from "@nessalabs/ui"
import { storyDocumentation } from "./story-documentation"

const meta = { title: "Conversation/ChatComposerMarkdownEditor", component: ChatComposerMarkdownEditor, tags: ["autodocs", "test"], parameters: { layout: "padded" } } satisfies Meta<typeof ChatComposerMarkdownEditor>
export default meta
type Story = StoryObj<typeof meta>

/** Exposes the serialized draft to demonstrate live formatting and Markdown submission. */
function MarkdownShortcutsExample() {
  const editor = React.useRef<ChatComposerEditorHandle>(null)
  const [draft, setDraft] = React.useState("")
  const [submitted, setSubmitted] = React.useState("")
  return (
    <div className="w-full max-w-[40rem] mx-auto space-y-4">
      <ChatComposer onSubmit={(event) => {
        event.preventDefault()
        setSubmitted(editor.current?.getContent().text ?? "")
        editor.current?.clear()
      }}>
        <ChatComposerMarkdownEditor className="h-60" ref={editor} onContentChange={(content) => setDraft(content.text)} placeholder="Type - then Space for a list" />
      </ChatComposer>
      <div hidden={!draft} className="space-y-2">
        <p className="text-muted-foreground nessa-text-4">Markdown output</p>
        <pre data-testid="markdown-draft" className="whitespace-pre-wrap">{draft}</pre>
      </div>
      <div hidden={!submitted} className="space-y-2">
        <p className="text-muted-foreground nessa-text-4">Submitted Markdown</p>
        <pre data-testid="markdown-submitted" className="whitespace-pre-wrap">{submitted}</pre>
      </div>
    </div>
  )
}

export const MarkdownShortcuts: Story = {
  parameters: storyDocumentation("Choose ChatComposerMarkdownEditor for live Markdown formatting, parsed Markdown paste, and Markdown submission. Headings, lists, quotes, bold, italic, strike, links, inline code and fenced code format in place. Enter after a heading starts a plain paragraph. Lists continue until an empty item is exited; Mod+Enter submits. Chips retain their original payloads. Choose ChatComposerEditor when plain editing is preferred."),
  render: () => <MarkdownShortcutsExample />,
}

export const ListBackspace: Story = {
  parameters: storyDocumentation("Backspace on an empty list item removes one level of indentation without moving to a previous line."),
  render: () => <MarkdownShortcutsExample />,
  play: async ({ canvasElement }) => {
    const editor = within(canvasElement).getByRole("textbox", { name: "Message" })
    await userEvent.click(editor)
    await userEvent.keyboard("Jello{Shift>}{Enter}{/Shift}- {Backspace}")
    await expect(editor.lastElementChild?.tagName).toBe("P")
    await expect(editor.lastElementChild?.textContent).toBe("")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await userEvent.keyboard("Jello{Shift>}{Enter}{/Shift}- 1{Enter}2{Enter}{Backspace}")
    await expect(editor.querySelectorAll("li")).toHaveLength(2)
    await expect(editor.lastElementChild?.tagName).toBe("P")
    await expect(editor.lastElementChild?.textContent).toBe("")
    await userEvent.keyboard("same line")
    await expect(editor.lastElementChild).toHaveTextContent("same line")
    await expect(editor.firstElementChild).toHaveTextContent("Jello")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
  },
}

export const LiveFormatting: Story = {
  parameters: storyDocumentation("The standalone Markdown editor formats headings, bold, italic, strike, code and links as you type. Enter after a heading starts one plain paragraph with marks cleared. Code blocks and lists keep their own editing keys; Mod+Enter sends Markdown. Consumers choose this editor or the plain ChatComposerEditor inside the same composer slots."),
  render: () => <MarkdownShortcutsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.click(editor)
    await expect(editor).toHaveAttribute("data-empty", "true")
    await userEvent.keyboard("- ")
    await expect(editor.querySelector("ul li")).not.toBeNull()
    await expect(editor).toHaveAttribute("data-empty", "false")
    await expect(getComputedStyle(editor, "::before").content).toBe("none")
    await userEvent.keyboard("{Enter}")
    await expect(editor.querySelector("ul")).toBeNull()
    await expect(editor).toHaveAttribute("data-empty", "true")
    await userEvent.keyboard("# Hello{Enter}plain **bold** *italic* ~~gone~~ `code` [[site](https://example.com)")
    await expect(editor.querySelector("h1")).toHaveTextContent("Hello")
    await expect(editor.querySelectorAll("p")).toHaveLength(1)
    await expect(editor.querySelector("p")).toHaveTextContent("plain")
    await expect(editor.querySelector("strong")).toHaveTextContent("bold")
    await expect(editor.querySelector("em")).toHaveTextContent("italic")
    await expect(editor.querySelector("s")).toHaveTextContent("gone")
    await expect(editor.querySelector("code")).toHaveTextContent("code")
    await expect(editor.querySelector("a")).toHaveAttribute("href", "https://example.com")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await expect(canvas.getByTestId("markdown-submitted")).toHaveTextContent("# Hello")
    await expect(canvas.getByTestId("markdown-submitted")).toHaveTextContent("**bold**")
    await expect(canvas.getByTestId("markdown-submitted")).toHaveTextContent("[site](https://example.com)")
    await userEvent.keyboard("~~~js{Enter}const answer = 42;{Enter}next")
    await waitFor(() => expect(editor.querySelector("pre code")).toHaveTextContent("const answer = 42;\nnext", { normalizeWhitespace: false }))
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await expect(canvas.getByTestId("markdown-submitted")).toHaveTextContent("```js")
    await userEvent.keyboard("~~~c++{Enter}")
    const codePaste = new DataTransfer()
    codePaste.setData("text/plain", "**literal**\n- code")
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: codePaste, bubbles: true, cancelable: true }))
    await expect(editor.querySelector("pre code")?.textContent).toBe("**literal**\n- code")
    await expect(editor.querySelector("strong")).toBeNull()
    await expect(editor.querySelector("pre code")).toHaveClass("language-c++")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await userEvent.keyboard("- first{Enter}second{Enter}{Enter}plain")
    await expect(editor.querySelectorAll("li")).toHaveLength(2)
    await expect(editor.querySelectorAll("p")).toHaveLength(3)
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await expect(editor.textContent).toBe("")
    await userEvent.keyboard("# Heading{Shift>}{Enter}{/Shift}plain")
    await expect(editor.querySelector("h1")).toHaveTextContent("Heading")
    await expect(editor.querySelector("p")).toHaveTextContent("plain")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await userEvent.keyboard("## Hello{Enter}paragraph{Shift>}{Enter}{/Shift}- first")
    await expect(editor.querySelector("ul li")).toHaveTextContent("first")
    await expect(editor.querySelector("p")).toHaveTextContent("paragraph")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
  },
}

/** Exercises parsed drafts, chip payloads and changing textbox metadata through public props. */
function StructuredDraftExample() {
  const editor = React.useRef<ChatComposerEditorHandle>(null)
  const [draft, setDraft] = React.useState("")
  const [required, setRequired] = React.useState(false)
  const [pressed, setPressed] = React.useState("")
  return <div className="w-full max-w-[40rem] mx-auto space-y-4">
    <ChatComposer submitOnEnter={false}>
      <ChatComposerMarkdownEditor className="h-60" ref={editor} id="structured-draft" onChipPress={() => setPressed(required ? "required" : "optional")} aria-required={required} aria-describedby={required ? "draft-help" : undefined} onContentChange={(content) => setDraft(content.text)} style={{ paddingTop: 8 }} />
    </ChatComposer>
    <div className="flex flex-wrap gap-2">
    <Button onClick={() => { editor.current?.clear(); editor.current?.insertText("# Draft\n\n- [x] Reviewed\n- [ ] Pending\n\n| Name | State |\n| --- | --- |\n| UI | Ready |\n\nEnd ") }}>Load Markdown draft</Button>
    <Button onClick={() => editor.current?.insertChip({ id: "pasted-source", label: "Pasted text", kind: "pasted-text", textValue: "raw\n  **untouched**\n<source>" })}>Insert pasted chip</Button>
    <Button onClick={() => setRequired((value) => !value)}>Toggle required</Button>
    </div>
    <p id="draft-help">Describe your request.</p>
    <output data-testid="chip-callback">{pressed}</output>
    <pre data-testid="structured-source" className="whitespace-pre-wrap">{draft}</pre>
  </div>
}

export const StructuredDraft: Story = {
  parameters: storyDocumentation("Load a Markdown draft with task lists and a table, insert a pasted-text chip without changing its payload, and update accessible textbox metadata. The same imperative handle restores drafts and reports Markdown to the host."),
  render: () => <StructuredDraftExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Load Markdown draft" }))
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await expect(editor.querySelector("h1")).toHaveTextContent("Draft")
    await expect(editor.querySelectorAll("input[type=checkbox]")).toHaveLength(2)
    await expect(editor.querySelector("input[type=checkbox]")).toBeChecked()
    await expect(editor.querySelector("table")).toHaveTextContent("Ready")
    await userEvent.click(canvas.getByRole("button", { name: "Insert pasted chip" }))
    await expect(editor.querySelector("[data-chip-id]")).toHaveTextContent("Pasted text")
    await expect(canvas.getByTestId("structured-source")).toHaveTextContent("raw\n  **untouched**\n<source>", { normalizeWhitespace: false })
    await expect(canvasElement.querySelectorAll("#structured-draft")).toHaveLength(1)
    await userEvent.click(canvas.getByRole("button", { name: "Toggle required" }))
    await expect(editor).toHaveAttribute("aria-required", "true")
    await userEvent.click(editor.querySelector('[data-slot="chat-composer-chip"]')!)
    await expect(canvas.getByTestId("chip-callback")).toHaveTextContent("required")
    await expect(editor).toHaveAttribute("aria-describedby", "draft-help")
    await userEvent.click(canvas.getByRole("button", { name: "Toggle required" }))
    await expect(editor).toHaveAttribute("aria-required", "false")
    await expect(editor).not.toHaveAttribute("aria-describedby", "draft-help")
    await expect(editor.parentElement).toHaveStyle({ paddingTop: "8px" })
    await userEvent.click(editor)
    // Select through the editor keymap so its document selection is current
    // before copying; a DOM-only range waits on selectionchange delivery.
    const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "Meta" : "Control"
    await userEvent.keyboard(`{${modifier}>}a{/${modifier}}`)
    const clipboard = new DataTransfer()
    editor.dispatchEvent(new ClipboardEvent("copy", { clipboardData: clipboard, bubbles: true, cancelable: true }))
    await expect(clipboard.getData("text/plain")).toContain("raw\n  **untouched**\n<source>")
    await expect(clipboard.getData("text/plain")).toContain("# Draft")
  },
}

/** Restores a saved draft when the asynchronous editor handle becomes available. */
function RestoredDraftExample() {
  const [editor, setEditor] = React.useState<ChatComposerEditorHandle | null>(null)
  React.useEffect(() => {
    if (!editor) return
    editor.clear()
    editor.insertText("## Restored draft\n\nSaved **formatting**")
  }, [editor])
  return <ChatComposer className="w-full max-w-[40rem] mx-auto"><ChatComposerMarkdownEditor className="h-60" ref={setEditor} /></ChatComposer>
}

export const RestoredDraft: Story = {
  parameters: storyDocumentation("The handle is null until the editor mounts. A stable callback ref lets hosts restore saved Markdown when it becomes ready, including during client hydration. Once mounted, the handle stays stable while typing."),
  render: () => <RestoredDraftExample />,
  play: async ({ canvasElement }) => {
    const editor = await within(canvasElement).findByRole("textbox", { name: "Message" })
    await waitFor(() => expect(editor.querySelector("h2")).toHaveTextContent("Restored draft"))
    await expect(editor.querySelector("strong")).toHaveTextContent("formatting")
    await userEvent.click(editor)
    await userEvent.keyboard(" updated")
    await expect(editor).toHaveTextContent("updated")
  },
}

/** Demonstrates the opt-in editor with the ordinary composer's footer and height cap. */
function NormalComposerExample() {
  const [editor, setEditor] = React.useState<ChatComposerEditorHandle | null>(null)
  const [submitted, setSubmitted] = React.useState("")
  React.useEffect(() => {
    editor?.insertText(Array.from({ length: 20 }, (_, i) => `Paragraph **${i + 1}**`).join("\n\n"))
  }, [editor])
  return <div className="mx-auto w-full max-w-[40rem] space-y-4">
    <ChatComposer maxHeight={180} onSubmit={(event) => {
      event.preventDefault()
      setSubmitted(editor?.getContent().text ?? "")
      editor?.clear()
    }}>
      <ChatComposerMarkdownEditor ref={setEditor} />
      <ChatComposerFooter><span>Markdown enabled</span><ChatComposerSubmit /></ChatComposerFooter>
    </ChatComposer>
    <pre data-testid="normal-submitted" className="whitespace-pre-wrap">{submitted}</pre>
  </div>
}

export const NormalComposer: Story = {
  parameters: storyDocumentation("Use ChatComposerMarkdownEditor inside the normal ChatComposer with its standard footer and submit button. The complete composer respects maxHeight while the editor scrolls and the footer remains visible."),
  render: () => <NormalComposerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await waitFor(() => expect(editor).toHaveTextContent("Paragraph 20"))
    const composer = editor.closest("form")!
    const footer = composer.querySelector('[data-slot="chat-composer-footer"]')!
    await expect(composer.getBoundingClientRect().height).toBeLessThanOrEqual(180)
    await expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(composer.getBoundingClientRect().bottom)
    await expect(editor.scrollHeight).toBeGreaterThan(editor.clientHeight)
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }))
    await expect(canvas.getByTestId("normal-submitted")).toHaveTextContent("**20**")
    await expect(editor.textContent).toBe("")
    await waitFor(() => expect(composer.getBoundingClientRect().height).toBeLessThan(180))
  },
}

/** Keeps menu selection separate from message submission across editor implementations. */
function MarkdownMentionExample() {
  const [events, setEvents] = React.useState<string[]>([])
  return <div className="mx-auto w-full max-w-[40rem] space-y-4">
    <ChatComposer onSubmit={(event) => { event.preventDefault(); setEvents((values) => [...values, "submitted"]) }}>
      <ChatComposerMarkdownEditor placeholder="Mention with @" />
      <ChatComposerTrigger trigger="@" label="People">
        {({ clearTrigger }) => <SectionedListbox
          sections={[{ id: "people", label: "People", items: [{ id: "ada", label: "Ada" }] }]}
          getItemId={(item) => item.id} renderItem={(item) => item.label} listLabel="People"
          onValueChange={() => { clearTrigger(); setEvents((values) => [...values, "selected"]) }}
        />}
      </ChatComposerTrigger>
    </ChatComposer>
    <output data-testid="mention-events">{events.join(",")}</output>
  </div>
}

export const MentionMenu: Story = {
  parameters: storyDocumentation("The shared mention menu handles Enter before the Markdown editor: choosing a person never submits the unfinished draft."),
  render: () => <MarkdownMentionExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("textbox", { name: "Message" }))
    await userEvent.keyboard("@a")
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: "Ada" })
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByTestId("mention-events")).toHaveTextContent(/^selected$/)
  },
}

export const CodeBlocks: Story = {
  parameters: storyDocumentation("Start an editable code block immediately with three backticks and choose its language from the header. Pasting a complete fenced block also creates a code surface. Code stays literal inside the block and submits as fenced Markdown."),
  render: () => <MarkdownShortcutsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = canvas.getByRole("textbox", { name: "Message" })
    await userEvent.click(editor)
    await userEvent.keyboard("```")
    await expect(editor.querySelector("pre code")).not.toBeNull()
    await userEvent.click(canvas.getByRole("button", { name: "Code language: Plain text" }))
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.type(page.getByRole("textbox", { name: "Search languages" }), "python")
    await userEvent.click(page.getByRole("option", { name: "Python" }))
    await expect(editor.querySelector("pre code")).toHaveClass("language-python")
    await userEvent.click(editor.querySelector("pre code")!)
    await userEvent.keyboard("<ChatComposer />{Shift>}{Enter}{/Shift}second line")
    await expect(editor.querySelector("pre code")?.textContent).toBe("<ChatComposer />\nsecond line")
    await waitFor(() => expect(editor.querySelector("pre code")).toHaveTextContent("<ChatComposer />"))
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    const clipboard = new DataTransfer()
    clipboard.setData("text/plain", "```tsx\n<ChatComposer />\n```")
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }))
    await waitFor(() => expect(editor.querySelector("pre code")).toHaveTextContent("<ChatComposer />"))
    await waitFor(() => {
      const tokens = [...editor.querySelectorAll("pre code .nessa-code-token")]
      expect(tokens.length).toBeGreaterThan(0)
      expect(new Set(tokens.map((token) => getComputedStyle(token).color)).size).toBeGreaterThan(1)
      const codeSurface = editor.querySelector<HTMLElement>('[data-slot="code-editor"]')!
      const composer = editor.closest<HTMLElement>('[data-slot="chat-composer"]')!
      expect(getComputedStyle(codeSurface).backgroundColor).not.toBe(getComputedStyle(composer).backgroundColor)
    })
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await expect(canvas.getByTestId("markdown-submitted")).toHaveTextContent("```tsx")
    await expect(canvas.getByTestId("markdown-submitted")).toHaveTextContent("<ChatComposer />")
  },
}


export const ConsistentTypography: Story = {
  parameters: storyDocumentation("Message text, plain inputs, and both editors share the same body typography in regular and compact composers."),
  render: () => <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
    <ChatBubble><MessageMarkdown>Message body text</MessageMarkdown></ChatBubble>
    {(["default", "compact"] as const).map((size) => <React.Fragment key={size}>
      <ChatComposer size={size}><ChatComposerInput aria-label={`${size} input`} defaultValue="Message body text" /></ChatComposer>
      <ChatComposer size={size}><ChatComposerEditor aria-label={`${size} plain editor`} /></ChatComposer>
      <ChatComposer size={size}><ChatComposerMarkdownEditor aria-label={`${size} Markdown editor`} defaultContent={{ text: "Message body text", parts: [] }} /></ChatComposer>
    </React.Fragment>)}
  </div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const message = canvasElement.querySelector('[data-slot="message-markdown"] p')!
    const expected = getComputedStyle(message).fontSize
    const editors = canvas.getAllByRole("textbox")
    expect(editors).toHaveLength(6)
    for (const editor of editors) expect(getComputedStyle(editor).fontSize).toBe(expected)
  },
}

/** Demonstrates host cancellation before native editor handlers receive an event. */
function CanceledEventsExample() {
  const [cancel, setCancel] = React.useState(true)
  const [submits, setSubmits] = React.useState(0)
  const [attachments, setAttachments] = React.useState(0)
  const [callbacks, setCallbacks] = React.useState(0)
  const onEvent = (event: React.SyntheticEvent) => {
    setCallbacks((value) => value + 1)
    if (cancel) event.preventDefault()
  }
  return <div className="w-full max-w-[40rem] mx-auto space-y-4">
    <Button onClick={() => setCancel((value) => !value)}>{cancel ? "Allow events" : "Cancel events"}</Button>
    <ChatComposer onSubmit={(event) => { event.preventDefault(); setSubmits((value) => value + 1) }}>
      <ChatComposerMarkdownEditor defaultContent={{ text: "Original", parts: [] }}
        onKeyDown={onEvent} onPaste={onEvent} onDrop={onEvent}
        onPasteAttachment={() => setAttachments((value) => value + 1)} pasteAttachmentMinLength={20} />
    </ChatComposer>
    <output data-testid="canceled-events-counts">{submits}:{attachments}:{callbacks}</output>
  </div>
}

export const CanceledEvents: Story = {
  parameters: storyDocumentation("Host keyboard, paste, and drop callbacks can preventDefault to preserve the draft and suppress submission or attachment callbacks."),
  render: () => <CanceledEventsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByRole("textbox", { name: "Message" })
    await waitFor(() => expect(editor).toHaveTextContent("Original"))
    const initial = editor.innerHTML
    const paste = (text: string) => {
      const data = new DataTransfer()
      data.setData("text/plain", text)
      editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
    }
    const drop = () => {
      const data = new DataTransfer()
      data.setData("text/plain", "Dropped")
      const rect = editor.getBoundingClientRect()
      editor.dispatchEvent(new DragEvent("drop", { dataTransfer: data, clientX: rect.x + 8, clientY: rect.y + 8, bubbles: true, cancelable: true }))
    }
    await userEvent.click(editor)
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    paste("Pasted")
    paste("A long pasted attachment that must be canceled")
    drop()
    await expect(editor.innerHTML).toBe(initial)
    await expect(canvas.getByTestId("canceled-events-counts")).toHaveTextContent("0:0:6")
    await userEvent.click(canvas.getByRole("button", { name: "Allow events" }))
    paste("Pasted")
    await expect(editor).toHaveTextContent("Pasted")
    drop()
    await expect(editor).toHaveTextContent("Dropped")
    paste("A long pasted attachment that is now allowed")
    await userEvent.click(editor)
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await expect(canvas.getByTestId("canceled-events-counts")).toHaveTextContent("1:1:")
  },
}
