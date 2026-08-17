import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerFooter,
  ChatComposerInput,
  ChatComposerSubmit,
} from "@nessa-ui/react"
import { Mic, Plus } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/ChatComposer",
  component: ChatComposer,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "ChatComposer is the compound message-entry surface: a growing text input above a footer of composable action buttons and a submit control. The pieces are independent — hosts arrange actions, pickers, and the submit button freely — and the whole form stays controlled by the application. Enter submits (configurable), Shift+Enter inserts a newline, and maxHeight caps growth with the input scrolling inside.",
      },
    },
  },
} satisfies Meta<typeof ChatComposer>

export default meta
type Story = StoryObj<typeof meta>

function ComposerExample({
  size,
  maxHeight,
}: {
  size?: "default" | "compact"
  maxHeight?: number
}) {
  const [message, setMessage] = React.useState("")
  const [sent, setSent] = React.useState<string | null>(null)

  return (
    <div className="grid w-[28rem] max-w-full gap-3">
      {sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          Sent: {sent}
        </p>
      ) : null}
      <ChatComposer
        borderMode="always"
        size={size}
        maxHeight={maxHeight}
        onSubmit={(event) => {
          event.preventDefault()
          if (!message.trim()) return
          setSent(message.trim())
          setMessage("")
        }}
      >
        <ChatComposerInput
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Message the agent…"
        />
        <ChatComposerFooter>
          <ChatComposerActions>
            <ChatComposerAction aria-label="Add attachment" title="Add attachment">
              <Plus aria-hidden="true" />
            </ChatComposerAction>
          </ChatComposerActions>
          <ChatComposerActions className="justify-end">
            <ChatComposerAction aria-label="Start voice input" title="Start voice input">
              <Mic aria-hidden="true" />
            </ChatComposerAction>
            <ChatComposerSubmit disabled={!message.trim()} />
          </ChatComposerActions>
        </ChatComposerFooter>
      </ChatComposer>
    </div>
  )
}

export const Default: Story = {
  parameters: storyDocumentation(
    "The standard arrangement: input, an attachment action, voice input, and submit. Type a message and press Enter or the submit button.",
  ),
  render: () => <ComposerExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await canvas.findByPlaceholderText("Message the agent…")

    await userEvent.type(input, "Ship the drag vertical")
    await userEvent.keyboard("{Enter}")

    await waitFor(async () => {
      const status = await canvas.findByRole("status")
      expect(status.textContent).toContain("Ship the drag vertical")
    })
  },
}

export const Compact: Story = {
  parameters: storyDocumentation(
    "The compact size fits tight surfaces such as workspace panes and popovers.",
  ),
  render: () => <ComposerExample size="compact" />,
}

export const ConstrainedHeight: Story = {
  parameters: storyDocumentation(
    "maxHeight caps how tall the composer can grow; longer drafts scroll inside the input instead of expanding the surface.",
  ),
  render: () => <ComposerExample maxHeight={160} />,
}
