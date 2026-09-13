import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ContactChoices,
  MessageApproval,
  MessageDigest,
  type MessageApprovalStatus,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Conversation/MessageActions",
  component: MessageApproval,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Three surfaces for an agent acting on someone\u2019s messages, in the order they appear in a conversation. **ContactChoices** asks which of several same-named people was meant. **MessageApproval** is the confirmation before the message goes: recipient, the app it travels over, the draft \u2014 editable in place by default, so a wrong date is fixed here rather than in another round trip \u2014 and the two decisions, with a status line taking the actions\u2019 place once `status` resolves. **MessageDigest** is the reading half: what the agent found in an inbox, drawn as a mail app draws it, quiet tiles by default and buttons the moment `onValueChange` says a row can be opened. Every one of them measures its own container rather than the viewport, so the same element works docked in a narrow rail \u2014 where the approval\u2019s actions stack with **Send** on top \u2014 and in a full-width panel, with no size prop to keep in sync. Delivery, selection, ordering, and filtering all stay with the host.",
      },
    },
  },
} satisfies Meta<typeof MessageApproval>

export default meta
type ApprovalStory = StoryObj<typeof meta>
type ChoicesStory = StoryObj<typeof ContactChoices>
type DigestStory = StoryObj<typeof MessageDigest>

const DRAFT =
  "The Watchtower review moved to Sunday, September 6. Does that still work for you?"

export const ReadyToSend: ApprovalStory = {
  parameters: storyDocumentation(
    "The resting request: who it goes to, the app it goes over, the draft, and the decision. The draft is a live field — correcting it is the common case, so it does not wait to be switched on. The play test reads the card the way a person does: the recipient's name, the channel under it, the draft text, and two live actions.",
  ),
  args: {
    recipient: "Peter Parker",
    channel: "Messages",
    message: DRAFT,
  },
  render: (args) => (
    <div className="max-w-md">
      <MessageApproval {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Ready to send it?")).toBeVisible()
    await expect(canvas.getByText("Peter Parker")).toBeVisible()
    await expect(canvas.getByText("Messages")).toBeVisible()
    await expect(
      canvas.getByRole("textbox", { name: "Message to Peter Parker" }),
    ).toHaveValue(DRAFT)
    await expect(canvas.getByRole("button", { name: "Send" })).toBeEnabled()
    await expect(canvas.getByRole("button", { name: "Cancel" })).toBeEnabled()
    // A Messages card wears the iMessage mark, and it stays decoration:
    // "Messages" is already written under the name for assistive tech.
    const badge = canvasElement.querySelector(
      '[data-slot="contact-avatar-badge"]',
    )
    await expect(badge).toBeTruthy()
    await expect(badge).toHaveAttribute("aria-hidden", "true")
  },
}

export const EditableDraft: ApprovalStory = {
  parameters: storyDocumentation(
    "The draft field grows with its text, so a correction happens here rather than in a second round trip. It carries no focus ring: the caret already shows where focus is, and because browsers match `:focus-visible` on editable fields for pointer focus too, an outline here would read as a permanent border around the message — the same call ChatComposer's textarea makes. Enter breaks the line — a message is multi-line content — while ⌘/Ctrl+Enter sends and Escape cancels. The play test edits the date, sends with the keyboard, and checks the text the host received is the edited one, not the draft the card mounted with.",
  ),
  args: { recipient: "Diana Prince", message: DRAFT },
  render: (args) => {
    const EditableCard = () => {
      const [sent, setSent] = React.useState<string | null>(null)
      return (
        <div className="flex max-w-md flex-col gap-3">
          <MessageApproval {...args} onSend={setSent} />
          <p data-testid="sent" className="nessa-text-2 text-muted-foreground">
            {sent ?? "Nothing sent yet"}
          </p>
        </div>
      )
    }
    return <EditableCard />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole("textbox", {
      name: "Message to Diana Prince",
    })
    await userEvent.clear(field)
    await userEvent.type(field, "Launch moved to Monday, September 7.")
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}")
    await waitFor(() =>
      expect(canvas.getByTestId("sent")).toHaveTextContent(
        "Launch moved to Monday, September 7.",
      ),
    )
  },
}

export const SendingThroughToSent: ApprovalStory = {
  parameters: storyDocumentation(
    "The host owns delivery, and `status` is how the card follows it. While `sending` both actions stay put but inert — the decision is taken, and the card must not offer it twice — and the send action carries a spinner. Once the host reports `sent` the actions come down entirely and a status line takes their place, because there is nothing left to decide. The play test presses Send and waits for the status line, having first proved the actions went inert rather than disappearing.",
  ),
  args: { recipient: "Clark Kent", channel: "Messages", message: DRAFT },
  render: (args) => {
    const DeliveringCard = () => {
      const [status, setStatus] = React.useState<MessageApprovalStatus>("pending")
      // A real host awaits its transport; the story resolves on the next
      // microtask so the play test never leaves a timer running behind it.
      const send = () => {
        setStatus("sending")
        void Promise.resolve().then(() => setStatus("sent"))
      }
      return (
        <div className="max-w-md">
          <MessageApproval {...args} status={status} onSend={send} />
        </div>
      )
    }
    return <DeliveringCard />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Send" }))
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="message-approval-status"]'),
      ).toHaveTextContent("Sent"),
    )
    await expect(canvas.queryByRole("button", { name: "Cancel" })).toBeNull()
    // The live region was mounted before the outcome landed, so the text
    // arrives as a mutation inside it rather than as a new region.
    await expect(canvas.getByRole("status")).toHaveTextContent("Sent")
  },
}

export const CouldNotSend: ApprovalStory = {
  parameters: storyDocumentation(
    "A failed dispatch is still a resolved request: the actions are gone, and the card says so in the destructive role rather than looking like it is still waiting for a decision. Retrying is the host's — it re-renders the card as `pending` with the same draft. The play test checks the status line is announced and that nothing remains pressable.",
  ),
  args: {
    recipient: "Barbara Gordon",
    channel: "Messages",
    message: DRAFT,
    status: "failed",
  },
  render: (args) => (
    <div className="max-w-md">
      <MessageApproval {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("status")).toHaveTextContent("Couldn't send")
    await expect(canvas.queryByRole("button")).toBeNull()
  },
}

export const ApprovalInANarrowRail: ApprovalStory = {
  parameters: storyDocumentation(
    "The same card in a 17rem rail. Below 20rem of **container** width — not viewport width, so a docked card in a wide window adapts too — the actions stack, and Send sits on top: the choice the person came for is the one under their thumb. The play test compares the two buttons' positions rather than the class that produced them, and proves the recipient's name truncates instead of pushing the card wider.",
  ),
  args: {
    recipient: "Bartholomew Allen-Wayne-Prince-Kent",
    channel: "Messages",
    message: DRAFT,
  },
  render: (args) => (
    <div className="w-[17rem]">
      <MessageApproval {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const send = canvas.getByRole("button", { name: "Send" })
    const cancel = canvas.getByRole("button", { name: "Cancel" })
    await waitFor(() =>
      expect(send.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        cancel.getBoundingClientRect().top,
      ),
    )
    const name = canvas.getByText("Bartholomew Allen-Wayne-Prince-Kent")
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-slot="message-approval"]',
    )
    await expect(card!.scrollWidth).toBeLessThanOrEqual(card!.clientWidth)
  },
}

export const LongDraft: ApprovalStory = {
  parameters: storyDocumentation(
    "`editable={false}` hands the draft to the host outright: it renders as read-only text, and that is the one form of the field that draws a focus ring, because it has no caret to show focus with. Past the card's height cap it scrolls inside itself instead of stretching the card down the page — and, because a scrolling region has to be reachable without a mouse, it takes a tab stop exactly while it overflows. This card goes over Mail rather than iMessage, so the avatar wears Apple's Mail mark instead — the badge follows the `channel` the card was actually given. The play test proves the field scrolls and is focusable.",
  ),
  args: {
    recipient: "Selina Kyle",
    channel: "Mail",
    editable: false,
    message: Array.from(
      { length: 8 },
      (_, index) =>
        `Paragraph ${index + 1}: the revised Watchtower plan, the rota deadline, and everything still waiting on a reply.`,
    ).join("\n\n"),
  },
  render: (args) => (
    <div className="max-w-md">
      <MessageApproval {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const field = canvasElement.querySelector<HTMLElement>(
      '[data-slot="message-approval-message"]',
    )
    expect(field).toBeTruthy()
    await waitFor(() =>
      expect(field!.scrollHeight).toBeGreaterThan(field!.clientHeight + 1),
    )
    await waitFor(() => expect(field!.tabIndex).toBe(0))
  },
}

export const AChannelWithNoMark: ApprovalStory = {
  parameters: storyDocumentation(
    "The badge is only ever drawn for a channel this module actually ships a mark for — today iMessage and Mail, both of them trademarks. A card going over anything else wears no badge at all rather than a borrowed logo, because a wrong mark claims something untrue about where the message is going. Hosts that have their own artwork pass `channelIcon`. The play test proves nothing was badged.",
  ),
  args: {
    recipient: "Kara Zor-El",
    channel: "Signal",
    message: DRAFT,
  },
  render: (args) => (
    <div className="max-w-md">
      <MessageApproval {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Signal")).toBeVisible()
    await expect(
      canvasElement.querySelector('[data-slot="contact-avatar-badge"]'),
    ).toBeNull()
  },
}

/** Two people who really do share a name — the reason the question exists. */
const BRUCES = [
  { id: "bruce-mobile", name: "Bruce Wayne", detail: "Mobile · (212) 555‑0147" },
  {
    id: "bruce-work",
    name: "Bruce Wayne",
    detail: "Work · bruce@wayne-enterprises.example",
  },
]

export const WhichBruce: ChoicesStory = {
  parameters: storyDocumentation(
    "Two contacts with the same name and nothing else to separate them — the question the agent has to ask before it can address anything. The play test chooses the second row and checks the list now marks it current, and only it.",
  ),
  args: {
    title: "Which Bruce should I address the message to?",
    contacts: BRUCES,
  },
  render: (args) => {
    const PickingList = () => {
      const [value, setValue] = React.useState<string | null>(null)
      return (
        <div className="max-w-md">
          <ContactChoices {...args} value={value} onValueChange={setValue} />
        </div>
      )
    }
    return <PickingList />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: /bruce@wayne-enterprises/ }))
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /bruce@wayne-enterprises/ })).toHaveAttribute(
        "aria-current",
        "true",
      ),
    )
    await expect(
      canvas.getByRole("button", { name: /\(212\) 555‑0147/ }),
    ).not.toHaveAttribute("aria-current")
  },
}

export const MarkupTitle: ChoicesStory = {
  parameters: storyDocumentation(
    "A title made of markup rather than a plain string still names the list: the list points at the title element with `aria-labelledby` instead of copying its text, so emphasis, links, or a localized fragment all reach assistive technology intact. The play test asks for the list by the question it asks.",
  ),
  args: {
    title: (
      <>
        Which <strong>Bruce</strong> should I address the message to?
      </>
    ),
    contacts: BRUCES,
  },
  render: (args) => (
    <div className="max-w-md">
      <ContactChoices {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("list", {
        name: "Which Bruce should I address the message to?",
      }),
    ).toBeVisible()
  },
}

export const ContactsWithDetail: ChoicesStory = {
  parameters: storyDocumentation(
    "When the contacts differ by something the person can actually recognize, `detail` says so on a second line — and, because it is ordinary row content rather than decoration, it is part of each row's accessible name. The play test names a row by its detail alone, which is what a screen-reader user would have to do.",
  ),
  args: {
    title: "Which Peter did you mean?",
    contacts: [
      { id: "peter-mobile", name: "Peter Parker", detail: "Mobile · (718) 555‑0134" },
      {
        id: "peter-work",
        name: "Peter Parker",
        detail: "Work · parker@daily-bugle.example",
      },
      { id: "peter-home", name: "Peter Parker", detail: "Home · (718) 555‑0188" },
    ],
  },
  render: (args) => (
    <div className="max-w-md">
      <ContactChoices {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: /parker@daily-bugle/ }),
    ).toBeVisible()
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3)
  },
}

export const ContactChoicesInANarrowRail: ChoicesStory = {
  parameters: storyDocumentation(
    "The picker in a 16rem rail: names and details truncate on one line each, so the rows keep their shape instead of growing tall enough to push the question off screen. The play test proves the long name is actually clipped rather than wrapped.",
  ),
  args: {
    title: "Who should I message?",
    contacts: [
      {
        id: "long",
        name: "Bartholomew Allen-Wayne-Prince-Kent",
        detail: "Work · bartholomew.allen@central-city.example",
      },
      { id: "short", name: "Kara Zor-El", detail: "Mobile · (415) 555‑0120" },
    ],
  },
  render: (args) => (
    <div className="w-[16rem]">
      <ContactChoices {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByText("Bartholomew Allen-Wayne-Prince-Kent")
    await waitFor(() =>
      expect(name.scrollWidth).toBeGreaterThan(name.clientWidth),
    )
    // One line: the clip is what keeps the row's shape, not a wrap that
    // would push the question off the top of a rail.
    const lineHeight = Number.parseFloat(getComputedStyle(name).lineHeight)
    await expect(name.getBoundingClientRect().height).toBeLessThan(
      lineHeight * 2,
    )
  },
}

export const ThroughToTheDraft: ChoicesStory = {
  parameters: storyDocumentation(
    "The whole exchange: the agent asks which Bruce, the person answers, and the draft it addresses follows in the same column. The picker keeps the answer on screen — checked and `aria-current` — rather than collapsing, so the person can still see what they chose while they read the message it produced. The play test walks the two steps and checks the draft names the contact that was picked.",
  ),
  args: {
    title: "Which Bruce should I address the message to?",
    contacts: BRUCES,
  },
  render: (args) => {
    const Conversation = () => {
      const [value, setValue] = React.useState<string | null>(null)
      const chosen = BRUCES.find((contact) => contact.id === value)
      return (
        <div className="flex max-w-md flex-col gap-4">
          <ContactChoices {...args} value={value} onValueChange={setValue} />
          {chosen ? (
            <MessageApproval
              recipient={chosen.name}
              message={DRAFT}
            />
          ) : null}
        </div>
      )
    }
    return <Conversation />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: /\(212\) 555‑0147/ }))
    await waitFor(() =>
      expect(canvas.getByText("Ready to send it?")).toBeVisible(),
    )
    await expect(
      canvas.getByRole("group", { name: "Ready to send it?" }),
    ).toHaveTextContent("Bruce Wayne")
  },
}

export const NoMatches: ChoicesStory = {
  parameters: storyDocumentation(
    "Nobody matched. The picker says so in place of the list rather than rendering an empty box; what happens next — asking for a different name, offering to search — is the host's.",
  ),
  args: {
    title: "Which Bruce should I address the message to?",
    contacts: [],
  },
  render: (args) => (
    <div className="max-w-md">
      <ContactChoices {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No matching contacts")).toBeVisible()
    await expect(canvas.queryByRole("list")).toBeNull()
  },
}

const INBOX = [
  {
    id: "revised",
    sender: "Lois Lane",
    subject: "Watchtower review — new date",
    preview:
      "One correction to my earlier note: the Watchtower review has moved to Sunday, September 6. The 3:00 PM rota deadline is unchanged. Please reply to confirm the new date.",
    timestamp: "8:42 AM",
    unread: true,
  },
  {
    id: "checklist",
    sender: "Lois Lane",
    subject: "Watchtower review — checklist",
    preview:
      "The Watchtower review is planned for Friday, September 4. Before then, please read the draft rota and send me your edits by 3:00 PM today. We are in the Metropolis room.",
    timestamp: "8:15 AM",
    unread: true,
  },
  {
    id: "catering",
    sender: "Alfred Pennyworth",
    subject: "Gala headcount",
    preview:
      "The caterer needs the final gala headcount by noon tomorrow. I have 42 guests confirmed and 6 invitations still awaiting a response. No action is needed from you unless the total changes.",
    timestamp: "8:50 AM",
  },
]

export const InboxSummary: DigestStory = {
  parameters: storyDocumentation(
    "Three messages an agent pulled while summarizing a thread. With no `onValueChange` the rows are tiles, not buttons — nothing here claims to open anything. Unread rides the bottom corner of the sender's avatar — the slot a channel mark sits in, where the eye already looks — rather than a leading column of its own, which would cost every row that indent for a mark most rows do not carry. The play test proves the rows are inert, that each unread row carries the word *Unread* in its text rather than leaning on the blue dot (which is hidden from assistive technology), and that the dot is drawn on the avatar of exactly the unread rows.",
  ),
  args: { title: "Here's what I found about the Watchtower review", messages: INBOX },
  render: (args) => (
    <div className="max-w-xl">
      <MessageDigest {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("button")).toBeNull()
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3)
    const unread = canvasElement.querySelectorAll('[data-unread="true"]')
    await expect(unread).toHaveLength(2)
    for (const row of unread) {
      await expect(row.textContent).toContain("Unread.")
      await expect(
        row.querySelector('[data-slot="contact-avatar-unread"]'),
      ).toHaveAttribute("data-corner", "bottom")
    }
    // And nowhere else: a read row's avatar carries no dot.
    await expect(
      canvasElement.querySelectorAll('[data-slot="contact-avatar-unread"]'),
    ).toHaveLength(2)
    await expect(canvas.getByText("8:42 AM")).toBeVisible()
  },
}

export const OpenableRows: DigestStory = {
  parameters: storyDocumentation(
    "`onValueChange` is the difference between a citation and a list: every row becomes a button, and the one the host opened is `aria-current`. The play test opens the catering thread and checks the digest marks it, and only it.",
  ),
  args: { title: "Messages about the Watchtower review", messages: INBOX },
  render: (args) => {
    const OpenableDigest = () => {
      const [value, setValue] = React.useState<string | null>(null)
      return (
        <div className="max-w-xl">
          <MessageDigest {...args} value={value} onValueChange={setValue} />
        </div>
      )
    }
    return <OpenableDigest />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: /Gala headcount/ }))
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: /Gala headcount/ }),
      ).toHaveAttribute("aria-current", "true"),
    )
    await expect(
      canvas.getByRole("button", { name: /Watchtower review — checklist/ }),
    ).not.toHaveAttribute("aria-current")
  },
}

export const OneLinePreviews: DigestStory = {
  parameters: storyDocumentation(
    "`previewLines` trades depth for density. At one line the digest reads as an index — useful when the agent is citing eight messages rather than three. The play test measures the preview's height against a two-line row to prove the clamp is real and not just a class on the element.",
  ),
  args: {
    title: "Everything from this week",
    messages: INBOX,
    previewLines: 1,
  },
  render: (args) => (
    <div className="max-w-xl">
      <MessageDigest {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const preview = canvasElement.querySelector<HTMLElement>(
      '[data-slot="message-digest-preview"]',
    )
    expect(preview).toBeTruthy()
    await waitFor(() =>
      expect(preview!.scrollHeight).toBeGreaterThan(preview!.clientHeight),
    )
    const lineHeight = Number.parseFloat(
      getComputedStyle(preview!).lineHeight,
    )
    await expect(preview!.clientHeight).toBeLessThan(lineHeight * 2)
  },
}

export const DigestInANarrowRail: DigestStory = {
  parameters: storyDocumentation(
    "The digest in a 16rem rail. The timestamp keeps the end of the sender line — it is the first thing someone scans for — while the sender truncates to make room, and the preview still clamps rather than running the tile down the rail. The play test proves the timestamp stayed on the sender's line rather than wrapping beneath it.",
  ),
  args: { title: "Recent", messages: INBOX },
  render: (args) => (
    <div className="w-[16rem]">
      <MessageDigest {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sender = canvasElement.querySelector<HTMLElement>(
      '[data-slot="message-digest-sender"]',
    )
    const timestamp = canvas.getByText("8:42 AM")
    expect(sender).toBeTruthy()
    await waitFor(() =>
      expect(timestamp.getBoundingClientRect().top).toBeLessThan(
        sender!.getBoundingClientRect().bottom,
      ),
    )
    await expect(sender!.scrollWidth).toBeGreaterThanOrEqual(
      sender!.clientWidth,
    )
  },
}

export const NothingFound: DigestStory = {
  parameters: storyDocumentation(
    "An empty search is an answer too. The digest says so in place of the list; offering to search again is the host's.",
  ),
  args: { title: "Messages about the Watchtower review", messages: [] },
  render: (args) => (
    <div className="max-w-xl">
      <MessageDigest {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No messages")).toBeVisible()
    await expect(canvas.queryByRole("list")).toBeNull()
  },
}
