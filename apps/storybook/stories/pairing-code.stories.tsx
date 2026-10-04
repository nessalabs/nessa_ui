import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, waitFor, within } from "storybook/test"
import { Button, PairingCode, type PairingCodeProps } from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/PairingCode",
  component: PairingCode,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A one-use pairing code shown large, for typing into another device, with how long it has left. It counts down once a second while `open` and stops at expiry, so it leaves no timer running once there is nothing to count; `onExpire` fires once when that happens. The host sets `used` or `cancelled`; `expired` is worked out from `expiresAt`. A code that can no longer be used is struck through and dimmed. Only a change of state is announced to assistive technology, never the ticking countdown. `describe` rewords the line under the code.",
      },
    },
  },
  args: { code: "K7PX4QM2", expiresAt: 0, onExpire: fn() },
} satisfies Meta<typeof PairingCode>

export default meta
type Story = StoryObj<typeof meta>

/** A code that expires `ms` after it first renders. */
function Expiring({ ms, ...props }: Omit<PairingCodeProps, "expiresAt"> & { ms: number }) {
  const [expiresAt] = React.useState(() => Date.now() + ms)
  return <PairingCode expiresAt={expiresAt} {...props} />
}

function status(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>("[data-slot=pairing-code-status]")!
}

export const CountsDownAndExpires: Story = {
  parameters: storyDocumentation(
    "A code two seconds from expiry. The play test proves it counts down, then expires on its own: struck through, announced once, and `onExpire` called once — after which nothing is left ticking.",
  ),
  render: (args) => (
    <Expiring
      ms={2000}
      code={args.code}
      onExpire={args.onExpire}
      actions={
        <Button size="sm" variant="outline">
          Copy code
        </Button>
      }
    />
  ),
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector<HTMLElement>("[data-slot=pairing-code]")!
    await expect(root).toHaveAttribute("data-state", "open")
    await waitFor(() =>
      expect(status(canvasElement)).toHaveTextContent(/^Expires in 0:0[12]$/),
    )
    await expect(within(canvasElement).getByRole("group")).toHaveAccessibleName(
      "Pairing code K 7 P X 4 Q M 2",
    )
    await waitFor(() => expect(root).toHaveAttribute("data-state", "expired"), { timeout: 4000 })
    await expect(status(canvasElement)).toHaveTextContent("This code has expired")
    await expect(
      canvasElement.querySelector("[data-slot=pairing-code-announcement]"),
    ).toHaveTextContent("This code has expired")
    await expect(args.onExpire).toHaveBeenCalledTimes(1)
  },
}

export const Used: Story = {
  parameters: storyDocumentation(
    "A code a device has entered. The play test proves it is struck through and does not count down.",
  ),
  render: (args) => <PairingCode code={args.code} expiresAt={Date.now() + 60_000} state="used" />,
  play: async ({ canvasElement }) => {
    await expect(status(canvasElement)).toHaveTextContent("This code has been used")
    const value = canvasElement.querySelector<HTMLElement>("[data-slot=pairing-code-value]")!
    await expect(getComputedStyle(value).textDecorationLine).toContain("line-through")
  },
}

export const Cancelled: Story = {
  parameters: storyDocumentation("A code the owner withdrew."),
  render: (args) => (
    <PairingCode code={args.code} expiresAt={Date.now() + 60_000} state="cancelled" />
  ),
  play: async ({ canvasElement }) => {
    await expect(status(canvasElement)).toHaveTextContent("This code was cancelled")
  },
}

export const Reworded: Story = {
  parameters: storyDocumentation(
    "`describe` replaces the line under the code, for translation or a host's own wording. The code is shown already expired; the play test also proves `onExpire` is not called and nothing is announced for it.",
  ),
  render: (args) => (
    <PairingCode
      code={args.code}
      expiresAt={0}
      onExpire={args.onExpire}
      describe={(state) => (state === "expired" ? "Get a new code to keep linking" : state)}
    />
  ),
  play: async ({ canvasElement, args }) => {
    await waitFor(() =>
      expect(status(canvasElement)).toHaveTextContent("Get a new code to keep linking"),
    )
    // Shown already expired, it never expired while shown: no callback and
    // nothing announced; the status line is read as ordinary text.
    await expect(args.onExpire).not.toHaveBeenCalled()
    await expect(
      canvasElement.querySelector("[data-slot=pairing-code-announcement]"),
    ).toHaveTextContent(/^$/)
    await expect(status(canvasElement)).not.toHaveAttribute("aria-hidden")
  },
}
