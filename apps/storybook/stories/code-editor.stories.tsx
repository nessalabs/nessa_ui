import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { CodeBlockProvider, CodeEditor } from "@nessalabs/ui"
import { storyDocumentation } from "./story-documentation"

const meta = { title: "Inputs/CodeEditor", component: CodeEditor, tags: ["autodocs", "test"], parameters: { layout: "padded" } } satisfies Meta<typeof CodeEditor>
export default meta
type Story = StoryObj<typeof meta>

/** Keeps code and language controlled, demonstrating form-safe picker interaction. */
function PlaygroundExample() {
  const [value, setValue] = React.useState("const greeting = 'hello'")
  const [language, setLanguage] = React.useState("javascript")
  const [submissions, setSubmissions] = React.useState(0)
  return <form className="w-full max-w-2xl space-y-3" onSubmit={(event) => { event.preventDefault(); setSubmissions((count) => count + 1) }}>
    <CodeEditor value={value} onValueChange={setValue} language={language} onLanguageChange={setLanguage} />
    <output data-testid="submissions">{submissions}</output>
  </form>
}

export const Playground: Story = {
  // Cross-engine: contenteditable input handling and caret behavior.
  tags: ["cross-engine"],
  parameters: storyDocumentation("An editable code surface with a searchable language picker and shared Shiki syntax colors. Code and language are controlled independently, and changing language preserves code. Supply children to replace the textarea with an editor-owned content view; the language header stays non-editable."),
  render: () => <PlaygroundExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Code" })
    await userEvent.clear(input)
    await userEvent.type(input, "print('hello'){Enter}print('world')")
    await expect(input).toHaveValue("print('hello')\nprint('world')")
    await userEvent.click(canvas.getByRole("button", { name: "Code language: JavaScript" }))
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.type(page.getByRole("textbox", { name: "Search languages" }), "python")
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await expect(canvas.getByRole("button", { name: "Code language: Python" })).toBeVisible()
    await expect(input).toHaveValue("print('hello')\nprint('world')")
    await expect(canvas.getByTestId("submissions")).toHaveTextContent("0")
    const highlight = canvasElement.querySelector<HTMLElement>('[data-slot="code-editor-highlight"]')!
    // Shiki loads and compiles a grammar to colour Python, and how long that
    // takes is an engine's business rather than the component's: Firefox under
    // a parallel run needs several times what Chromium does, which the default
    // one-second budget does not cover. The assertion is the same end state;
    // only the patience is engine-shaped.
    await waitFor(
      () => expect(highlight.querySelectorAll(".nessa-code-token").length).toBeGreaterThan(0),
      { timeout: 15000 },
    )
    await expect(new Set(Array.from(highlight.querySelectorAll(".nessa-code-token"), (token) => getComputedStyle(token).color)).size).toBeGreaterThan(1)
    await expect(highlight).toHaveAttribute("aria-hidden", "true")
    await expect(highlight.textContent).toBe("print('hello')\nprint('world')")
    await expect(canvas.getAllByRole("textbox")).toHaveLength(1)
    await userEvent.click(input)
    ;(input as HTMLTextAreaElement).setSelectionRange(0, 5)
    await userEvent.keyboard("repr")
    await waitFor(
      () => expect(highlight.textContent).toBe("repr('hello')\nprint('world')"),
      { timeout: 15000 },
    )
    await expect(input).toHaveValue("repr('hello')\nprint('world')")
    await expect((input as HTMLTextAreaElement).selectionStart).toBe(4)
  },
}

export const Disabled: Story = {
  parameters: storyDocumentation("Disabled code editors prevent text edits and language changes. A custom child editor must also receive its own disabled or read-only state."),
  args: { value: "SELECT * FROM notes;", language: "sql", disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("textbox", { name: "Code" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Code language: SQL" })).toBeDisabled()
  },
}


export const ForcedThemes: Story = {
  parameters: storyDocumentation("Forced light and dark modes pair syntax colors with their theme foreground, background, and caret. A custom syntax theme supplies its own surface colors. Consumer textarea backgrounds remain visible below the highlighting layer."),
  render: () => <div className="space-y-4">
    <div data-testid="forced-dark"><CodeBlockProvider mode="dark"><CodeEditor language="javascript" value="const answer = 42" /></CodeBlockProvider></div>
    <div data-testid="forced-light" className="dark"><CodeBlockProvider mode="light"><CodeEditor language="javascript" value="const answer = 42" /></CodeBlockProvider></div>
    <div data-testid="custom-theme"><CodeBlockProvider mode="dark" theme="light-plus"><CodeEditor language="javascript" value="const answer = 42" textareaProps={{ className: "bg-background", style: { backgroundColor: "white" } }} /></CodeBlockProvider></div>
  </div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const [name, background, foreground] of [["forced-dark", "color(srgb 0.163451 0.163451 0.163451)", "rgb(230, 230, 230)"], ["forced-light", "color(srgb 0.95 0.95 0.95)", "rgb(0, 0, 0)"], ["custom-theme", "rgb(255, 255, 255)", "rgb(0, 0, 0)"]] as const) {
      const root = canvas.getByTestId(name).querySelector<HTMLElement>('[data-slot="code-editor"]')!
      const input = root.querySelector<HTMLTextAreaElement>("textarea")!
      await waitFor(() => expect(getComputedStyle(root).backgroundColor).toBe(background))
      const header = root.querySelector<HTMLElement>('[data-slot="code-editor-header"]')!
      expect(getComputedStyle(header).backgroundColor).toBe(name === "forced-light" ? "color(srgb 0.92 0.92 0.92)" : background)
      await expect(getComputedStyle(root).color).toBe(foreground)
      await expect(getComputedStyle(input).caretColor).toBe(foreground)
      const overlay = root.querySelector<HTMLElement>('[data-slot="code-editor-highlight"]')!
      await waitFor(() => expect(overlay.querySelectorAll(".nessa-code-token").length).toBeGreaterThan(0))
      await expect(getComputedStyle(overlay).zIndex).toBe("10")
      await expect(overlay).toHaveAttribute("aria-hidden", "true")
      await userEvent.click(input)
      await userEvent.keyboard("{Control>}a{/Control}")
      await waitFor(() => expect(getComputedStyle(overlay).visibility).toBe("hidden"))
    }
  },
}

/** Exercises the large-draft fallback and recovery to highlighted editing. */
function LargeDraftExample() {
  const [value, setValue] = React.useState("const answer = 42\n".repeat(1000))
  return <CodeEditor language="javascript" value={value} onValueChange={setValue} />
}

export const LargeDraft: Story = {
  parameters: storyDocumentation("Drafts above 10,000 characters remain editable as plain text to keep synchronous highlighting work bounded. Shorter drafts resume syntax highlighting."),
  render: () => <LargeDraftExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Code" })
    const overlay = canvasElement.querySelector<HTMLElement>('[data-slot="code-editor-highlight"]')!
    expect(input).toHaveValue("const answer = 42\n".repeat(1000))
    expect(overlay.querySelectorAll(".nessa-code-token")).toHaveLength(0)
    expect(getComputedStyle(overlay).visibility).toBe("hidden")
    await userEvent.clear(input)
    await userEvent.type(input, "const short = 1")
    await waitFor(() => expect(overlay.querySelectorAll(".nessa-code-token").length).toBeGreaterThan(0))
    expect(input).toHaveValue("const short = 1")
  },
}
