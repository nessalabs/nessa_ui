import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerEditor,
  ChatComposerFooter,
  ChatComposerSubmit,
  ChatComposerTrigger,
  SectionedListbox,
  type ChatComposerContent,
  type ChatComposerEditorHandle,
} from "@nessalabs/ui"
import { Plus } from "lucide-react"

import { storyDocumentation } from "./story-documentation"
import {
  filterSlashSections,
  mentionSections,
  renderSlashItem,
  renderTeammate,
  teammateAvatarSrc,
  teammates,
  type Teammate,
} from "./composer-demo-data"

/** Returns the inline chips currently rendered inside the story canvas. */
function chipsIn(canvasElement: HTMLElement): HTMLElement[] {
  return Array.from(
    canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="chat-composer-chip"]',
    ),
  )
}

/** Returns the open trigger panel for one trigger sequence, if any. */
function panelFor(canvasElement: HTMLElement, trigger: string) {
  return canvasElement.ownerDocument.body.querySelector<HTMLElement>(
    `[data-slot="chat-composer-trigger-panel"][data-trigger="${trigger}"]`,
  )
}

/**
 * Harness for the inline-chip stories: hosts submitted state and the hover
 * card, mirrors editor content for submit enablement, inserts chips from the
 * `/` and `@` trigger menus and from large pastes, and surfaces chip press
 * and hover actions.
 */
function InlineComposerExample() {
  const editorRef = React.useRef<ChatComposerEditorHandle>(null)
  const [content, setContent] = React.useState<ChatComposerContent>({
    text: "",
    parts: [],
  })
  const [submitted, setSubmitted] = React.useState("")
  const [pressedChip, setPressedChip] = React.useState("")
  const [hoverCard, setHoverCard] = React.useState<{
    teammate: Teammate
    left: number
    top: number
  } | null>(null)
  const nextId = React.useRef(0)

  const chipId = () => {
    nextId.current += 1
    return `chip-${nextId.current}`
  }
  const chipCount = content.parts.filter((part) => part.type === "chip").length
  const canSubmit = content.text.trim().length > 0 || chipCount > 0

  return (
    <div
      data-slot="chat-composer-demo-frame"
      className="grid min-w-0 w-[min(60rem,calc(100vw-2rem))] gap-3 rounded-[2rem] bg-background p-2 sm:p-8"
    >
      {submitted ? (
        <p role="status" className="text-sm text-muted-foreground">
          Sent: {submitted}
        </p>
      ) : null}
      {pressedChip ? (
        <p
          data-slot="chip-press-note"
          className="text-sm text-muted-foreground"
        >
          Chip pressed: {pressedChip}
        </p>
      ) : null}
      {hoverCard ? (
        <div
          data-slot="teammate-card"
          // Fixed and non-interactive: the card overlays the page anchored
          // to the chip, so appearing never shifts the composer's layout or
          // steals the hover from the chip underneath it.
          style={{ left: hoverCard.left, top: hoverCard.top - 8 }}
          className="pointer-events-none fixed z-50 flex w-fit -translate-y-full items-center gap-2.5 rounded-xl border border-border bg-popover px-3 py-2 font-sans text-popover-foreground shadow-md"
        >
          <img
            src={teammateAvatarSrc(hoverCard.teammate)}
            alt=""
            aria-hidden="true"
            className="size-8 rounded-full"
          />
          <span className="text-sm">
            <span className="font-medium">{hoverCard.teammate.name}</span>
            <span className="text-muted-foreground">
              {" "}
              {hoverCard.teammate.role}
            </span>
          </span>
        </div>
      ) : null}
      <ChatComposer
        onSubmit={(event) => {
          event.preventDefault()
          const current = editorRef.current?.getContent()
          if (!current || current.text.trim().length === 0) return
          const chips = current.parts.filter(
            (part) => part.type === "chip",
          ).length
          setSubmitted(
            [current.text.trim(), chips > 0 ? `(+${chips} chips)` : ""]
              .filter(Boolean)
              .join(" "),
          )
          editorRef.current?.clear()
        }}
      >
        <ChatComposerEditor
          ref={editorRef}
          placeholder="Message, / for skills, @ to mention"
          onContentChange={setContent}
          onChipPress={(chip) => setPressedChip(chip.label)}
          onChipHoverChange={(chip, element) => {
            const teammate =
              chip?.kind === "mention"
                ? teammates.find((entry) => entry.name === chip.label)
                : undefined
            if (!teammate || !element) {
              setHoverCard(null)
              return
            }
            const rect = element.getBoundingClientRect()
            setHoverCard({ teammate, left: rect.left, top: rect.top })
          }}
          onPasteAttachment={(text) =>
            editorRef.current?.insertChip({
              id: chipId(),
              kind: "pasted-text",
              label: `Pasted text (${text.split("\n").length} lines)`,
              className: "text-primary",
            })
          }
        />
        <ChatComposerTrigger trigger="/" label="Skills and plugins">
          {({ query, clearTrigger }) => (
            <SectionedListbox
              sections={filterSlashSections(query)}
              getItemId={(item) => item.id}
              renderItem={renderSlashItem}
              onValueChange={(_, item) => {
                clearTrigger()
                editorRef.current?.insertChip({
                  id: chipId(),
                  kind: item.kind,
                  label: item.label,
                  icon: item.icon,
                  className: "text-primary",
                })
              }}
              listLabel="Skills and plugins"
              emptyMessage="No matching skills or plugins"
            />
          )}
        </ChatComposerTrigger>
        <ChatComposerTrigger trigger="@" label="Mention a teammate">
          {({ query, clearTrigger }) => (
            <SectionedListbox
              sections={mentionSections(query)}
              getItemId={(teammate) => teammate.id}
              renderItem={renderTeammate}
              onValueChange={(_, teammate) => {
                clearTrigger()
                editorRef.current?.insertChip({
                  id: chipId(),
                  kind: "mention",
                  label: teammate.name,
                  icon: (
                    <img
                      src={teammateAvatarSrc(teammate)}
                      alt=""
                      draggable={false}
                      className="size-full rounded-full"
                    />
                  ),
                  className: "text-primary",
                })
              }}
              listLabel="Teammates"
              emptyMessage="No teammates found"
            />
          )}
        </ChatComposerTrigger>
        <ChatComposerFooter>
          <ChatComposerActions>
            <ChatComposerAction aria-label="Add attachment" title="Add attachment">
              <Plus aria-hidden="true" />
            </ChatComposerAction>
          </ChatComposerActions>
          <ChatComposerActions className="justify-end">
            <ChatComposerSubmit disabled={!canSubmit} />
          </ChatComposerActions>
        </ChatComposerFooter>
      </ChatComposer>
    </div>
  )
}

const meta = {
  title: "Conversation/ChatComposerEditor",
  component: ChatComposerEditor,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A rich chat-composer input where attachments are true inline chips: atomic non-editable tokens that flow with the text on its baseline and type metrics, carry kind or custom icons (including images), delete as a whole with Backspace, and surface press and hover actions. Pastes and drops land as plain text; large pastes route to the host as attachments. Composes with ChatComposer and ChatComposerTrigger in place of the plain textarea input.",
      },
    },
  },
} satisfies Meta<typeof ChatComposerEditor>

export default meta
type Story = StoryObj<typeof meta>

export const InlineAttachments: Story = {
  parameters: storyDocumentation(
    "Attachments render as atomic inline tokens — an icon plus colored text on the same baseline and type metrics as the message, with no pill surface — so \"talk to [Mira Chen] and then [Sasha Ortiz]\" keeps its meaning. Tokens carry custom icons (here avatar images) and custom classes, delete as a whole with Backspace, report presses through onChipPress, and report hover through onChipHoverChange — here a contact card. Chip press and hover are pointer affordances (the declared inline-text exception): the caret can never land inside a chip, and Backspace remains the keyboard path.",
  ),
  render: () => <InlineComposerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rootStyle = getComputedStyle(
      canvasElement.ownerDocument.documentElement,
    )
    const chips = () => chipsIn(canvasElement)
    const editor = canvas.getByRole("textbox", { name: "Message" })

    await userEvent.type(editor, "talk to @mi")
    await waitFor(async () => expect(panelFor(canvasElement, "@")).not.toBeNull())
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => expect(panelFor(canvasElement, "@")).toBeNull())
    await waitFor(async () => expect(chips()).toHaveLength(1))
    await expect(chips()[0]).toHaveTextContent(/Mira Chen$/)

    await userEvent.type(editor, "and then @sa")
    await waitFor(async () => expect(panelFor(canvasElement, "@")).not.toBeNull())
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => expect(panelFor(canvasElement, "@")).toBeNull())
    await waitFor(async () => expect(chips()).toHaveLength(2))
    await expect(chips()[1]).toHaveTextContent(/Sasha Ortiz$/)

    const editorStyle = getComputedStyle(editor)
    for (const chip of chips()) {
      const chipStyle = getComputedStyle(chip)
      // Tokens are plain inline text: no pill surface, and the same type
      // metrics and baseline as the surrounding message text.
      await expect(chipStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)")
      await expect(chipStyle.fontSize).toBe(editorStyle.fontSize)
      await expect(chipStyle.lineHeight).toBe(editorStyle.lineHeight)
      // The chips demonstrate custom chip classes via a token text color.
      await expect(chipStyle.color).toBe(
        rootStyle.getPropertyValue("--primary").trim(),
      )
    }
    // Mention chips demonstrate custom icons: an avatar image.
    await expect(chips()[0]!.querySelector("img")).not.toBeNull()
    // The chip renders inside a non-editable host outside the tab order —
    // the declared pointer-affordance exception; Backspace deletion is the
    // keyboard path.
    const host = chips()[0]!.closest<HTMLElement>(
      '[data-slot="chat-composer-chip-host"]',
    )!
    await expect(host.isContentEditable).toBe(false)
    await expect(host.hasAttribute("tabindex")).toBe(false)

    // Hovering a person chip surfaces the host's contact card.
    const card = () =>
      canvasElement.querySelector('[data-slot="teammate-card"]')
    await expect(card()).toBeNull()
    await userEvent.hover(chips()[0]!)
    await waitFor(async () => expect(card()).not.toBeNull())
    await expect(card()).toHaveTextContent("Mira Chen")
    await userEvent.unhover(chips()[0]!)
    await waitFor(async () => expect(card()).toBeNull())

    // Pressing a chip hands it to the host for actions.
    await userEvent.click(chips()[0]!)
    await expect(
      canvasElement.querySelector('[data-slot="chip-press-note"]'),
    ).toHaveTextContent("Chip pressed: Mira Chen")

    // Backspace directly after a chip removes the whole chip at once. (The
    // caret is placed explicitly because user-event's click on a
    // contenteditable leaves a whole-content selection.)
    const doc = canvasElement.ownerDocument
    const secondHost = chips()[1]!.closest<HTMLElement>(
      '[data-slot="chat-composer-chip-host"]',
    )!
    const afterSecond = secondHost.nextSibling as globalThis.Text
    editor.focus()
    const caretRange = doc.createRange()
    caretRange.setStart(afterSecond, 0)
    caretRange.collapse(true)
    doc.getSelection()!.removeAllRanges()
    doc.getSelection()!.addRange(caretRange)
    await userEvent.keyboard("{Backspace}")
    await waitFor(async () => expect(chips()).toHaveLength(1))
    await expect(chips()[0]).toHaveTextContent(/Mira Chen$/)
  },
}

export const PastedTextCapture: Story = {
  parameters: storyDocumentation(
    "onPasteAttachment captures pastes at or above pasteAttachmentMinLength instead of flooding the input — here the host inserts a pasted-text chip at the caret — while short pastes keep flowing in as plain text. All pastes land as plain text.",
  ),
  render: () => <InlineComposerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = canvas.getByRole("textbox", { name: "Message" })
    const chips = () => chipsIn(canvasElement)
    const longText = Array.from(
      { length: 40 },
      (_, index) => `const value${index} = compute(${index})`,
    ).join("\n")

    await userEvent.click(editor)
    await userEvent.paste(longText)
    await waitFor(async () => expect(chips()).toHaveLength(1))
    await expect(chips()[0]).toHaveAttribute("data-kind", "pasted-text")
    await expect(chips()[0]).toHaveTextContent("Pasted text (40 lines)")
    await expect((editor.textContent ?? "").length).toBeLessThan(80)

    await userEvent.paste("short snippet")
    await expect(editor).toHaveTextContent("short snippet")
    await expect(chips()).toHaveLength(1)
  },
}

export const SlashSkillMenu: Story = {
  parameters: storyDocumentation(
    "Typing the / trigger opens host-supplied menu content anchored above the composer — here a SectionedListbox of skills and plugins. Typing filters via the trigger query, Enter attaches the primary match as a chip and clears the token, and Escape dismisses the menu until the token changes. With no selectable option, Enter submits as usual.",
  ),
  render: () => <InlineComposerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rootStyle = getComputedStyle(
      canvasElement.ownerDocument.documentElement,
    )
    const panel = () => panelFor(canvasElement, "/")
    const chips = () => chipsIn(canvasElement)
    const editor = canvas.getByRole("textbox", { name: "Message" })

    await userEvent.type(editor, "/")
    await waitFor(async () => expect(panel()).not.toBeNull())
    await expect(getComputedStyle(panel()!).backgroundColor).toBe(
      rootStyle.getPropertyValue("--popover").trim(),
    )
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )!
    const composerRect = composer.getBoundingClientRect()
    const panelRect = panel()!.getBoundingClientRect()
    await expect(panelRect.width).toBeCloseTo(composerRect.width, 0)
    await expect(
      within(panel()!).getAllByRole("option").length,
    ).toBeGreaterThan(3)

    await userEvent.type(editor, "lin")
    await waitFor(async () =>
      expect(within(panel()!).getAllByRole("option")).toHaveLength(1),
    )
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => expect(panel()).toBeNull())
    await waitFor(async () => expect(chips()).toHaveLength(1))
    await expect(chips()[0]).toHaveAttribute("data-kind", "plugin")
    await expect(chips()[0]).toHaveTextContent(/^Linear$/)
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument()

    await userEvent.type(editor, "/")
    await waitFor(async () => expect(panel()).not.toBeNull())
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => expect(panel()).toBeNull())

    // The dismissal holds while the token is unchanged, and Enter submits
    // straight through it.
    await userEvent.type(editor, "zzz")
    await expect(panel()).toBeNull()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Sent: Linear /zzz (+1 chips)",
    )
    await waitFor(async () => expect(chips()).toHaveLength(0))

    // With the menu open but nothing selectable, Enter keeps submitting.
    await userEvent.type(editor, "/qqq")
    await waitFor(async () => expect(panel()).not.toBeNull())
    await expect(within(panel()!).queryAllByRole("option")).toHaveLength(0)
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => expect(panel()).toBeNull())
    await expect(canvas.getByRole("status")).toHaveTextContent("Sent: /qqq")
  },
}

export const MentionTrigger: Story = {
  parameters: storyDocumentation(
    "A second trigger on @ presents its own panel content mid-message — here a People listbox. ArrowDown moves focus into the options, Enter or Tab attaches the mention as a chip without the trigger text, and Backspace deletes the whole chip at once.",
  ),
  render: () => <InlineComposerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const panel = () => panelFor(canvasElement, "@")
    const chips = () => chipsIn(canvasElement)
    const editor = canvas.getByRole("textbox", { name: "Message" })

    await userEvent.type(editor, "Ping @mi")
    await waitFor(async () => expect(panel()).not.toBeNull())
    await waitFor(async () =>
      expect(within(panel()!).getAllByRole("option")).toHaveLength(1),
    )

    await userEvent.keyboard("{ArrowDown}")
    const option = within(panel()!).getByRole("option", { name: /Mira Chen/ })
    await expect(option).toHaveFocus()

    // Typing while an option holds focus redirects into the query and must
    // not dismiss the menu (the refocus is not an outside interaction).
    await userEvent.keyboard("r")
    await waitFor(async () => expect(editor).toHaveFocus())
    await expect(panel()).not.toBeNull()
    await waitFor(async () =>
      expect(within(panel()!).getAllByRole("option")).toHaveLength(1),
    )

    await userEvent.keyboard("{Enter}")

    await waitFor(async () => expect(panel()).toBeNull())
    await waitFor(async () => expect(chips()).toHaveLength(1))
    await expect(chips()[0]).toHaveAttribute("data-kind", "mention")
    await expect(chips()[0]).toHaveTextContent(/Mira Chen$/)
    await expect(editor).toHaveTextContent(/^Ping/)

    // Backspace deletes the trailing space, then the whole chip at once.
    await userEvent.keyboard("{Backspace}{Backspace}")
    await waitFor(async () => expect(chips()).toHaveLength(0))

    // Tab selects the highlighted option just like Enter.
    await userEvent.type(editor, "@no")
    await waitFor(async () => expect(panel()).not.toBeNull())
    await userEvent.keyboard("{Tab}")
    await waitFor(async () => expect(panel()).toBeNull())
    await waitFor(async () => expect(chips()).toHaveLength(1))
    await expect(chips()[0]).toHaveTextContent(/Noah Patel$/)
  },
}
