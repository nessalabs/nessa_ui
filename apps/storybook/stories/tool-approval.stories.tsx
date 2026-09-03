import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerFooter,
  ChatComposerInput,
  ChatComposerSubmit,
  ToolApproval,
  ToolApprovalAction,
  ToolApprovalActionMenu,
  ToolApprovalActionMenuItem,
  ToolApprovalActions,
  ToolApprovalCommand,
  ToolApprovalDescription,
  ToolApprovalHeader,
  ToolApprovalHeading,
  ToolApprovalIcon,
  ToolApprovalTitle,
  ToolCall,
  ToolCallTrigger,
} from "@nessa-ui/react"
import { Plus, RotateCcw } from "lucide-react"

import { storyDocumentation } from "./story-documentation"
import { BashIcon } from "./icons/nucleo"

/**
 * Story-only scaffolding, deliberately outside the product surface: puts a
 * demo back to its pending state. Every play test that resolves a card ends
 * by pressing it, so opening a story always lands on a live request you can
 * click through yourself rather than on the flow's aftermath.
 */
function ResetDemo({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex justify-center">
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw aria-hidden="true" />
        Reset demo
      </Button>
    </div>
  )
}

/**
 * Waits for a restored card to finish its entrance, so the post-play axe
 * sweep measures settled colors rather than a mid-fade frame.
 */
async function settledCard(canvasElement: HTMLElement) {
  let card: HTMLElement | null = null
  await waitFor(() => {
    card = canvasElement.querySelector<HTMLElement>('[data-slot="tool-approval"]')
    expect(card).not.toBeNull()
    expect(card!.getAnimations()).toHaveLength(0)
  })
  return card!
}

/** The request header every story shares so the surfaces compare 1:1. */
function ApprovalHeader() {
  return (
    <ToolApprovalHeader>
      <ToolApprovalIcon>
        <BashIcon />
      </ToolApprovalIcon>
      <ToolApprovalHeading>
        <ToolApprovalTitle>Run command</ToolApprovalTitle>
        <ToolApprovalDescription>
          Claude wants to run a command in nessa-ui
        </ToolApprovalDescription>
      </ToolApprovalHeading>
    </ToolApprovalHeader>
  )
}

type DockedDecision =
  | { kind: "allowed"; scope: "once" | "session" | "always" }
  | { kind: "denied" }

const grantNotes = {
  once: null,
  session: "Bash is allowed for the rest of this session.",
  always: "Bash is now always allowed — future runs won't ask.",
} as const

/**
 * The flagship interaction and the intended host pattern for resolution:
 * the host stores the decision, hands its kind to the card as `resolution`
 * (the card goes inert and plays its exit), and swaps in the follow-up —
 * running tool row, grant note, or denied note — from `onExited`.
 */
function DockedApprovalExample() {
  const [decision, setDecision] = React.useState<DockedDecision | null>(null)
  const [exited, setExited] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const frameRef = React.useRef<HTMLDivElement>(null)
  const resolved = decision !== null && exited
  // The exiting card went inert and released focus, so the host re-homes it
  // where the person continues: the composer input.
  React.useEffect(() => {
    if (!resolved) return
    frameRef.current?.querySelector("textarea")?.focus()
  }, [resolved])
  return (
    <div className="grid min-w-0 gap-2">
      <div
        ref={frameRef}
        className="grid w-[min(44rem,calc(100vw-2rem))] min-w-0 gap-3 rounded-[2rem] bg-background p-2 sm:p-6"
      >
      {resolved && decision.kind === "allowed" && (
        <>
          <ToolCall status="running">
            <ToolCallTrigger icon={<BashIcon />} meta="pnpm vitest run">
              Running tests
            </ToolCallTrigger>
          </ToolCall>
          {grantNotes[decision.scope] && (
            <p role="status" className="text-sm text-muted-foreground">
              {grantNotes[decision.scope]}
            </p>
          )}
        </>
      )}
      {resolved && decision.kind === "denied" && (
        <p role="status" className="text-sm text-muted-foreground">
          Denied — Claude will suggest another way.
        </p>
      )}
      {!resolved && (
        <ToolApproval
          resolution={decision?.kind ?? null}
          onExited={() => setExited(true)}
        >
          <ApprovalHeader />
          <ToolApprovalCommand>
            pnpm vitest run --project=storybook
          </ToolApprovalCommand>
          <ToolApprovalActions>
            <ToolApprovalAction
              variant="ghost"
              onClick={() => setDecision({ kind: "denied" })}
            >
              Deny
            </ToolApprovalAction>
            <ToolApprovalActionMenu label="Always allow">
              <ToolApprovalActionMenuItem
                description="Keeps applying in future sessions"
                onSelect={() =>
                  setDecision({ kind: "allowed", scope: "always" })
                }
              >
                Always allow
              </ToolApprovalActionMenuItem>
              <ToolApprovalActionMenuItem
                description="Resets when this session ends"
                onSelect={() =>
                  setDecision({ kind: "allowed", scope: "session" })
                }
              >
                Allow for this session
              </ToolApprovalActionMenuItem>
            </ToolApprovalActionMenu>
            <ToolApprovalAction
              variant="default"
              onClick={() => setDecision({ kind: "allowed", scope: "once" })}
            >
              Allow once
            </ToolApprovalAction>
          </ToolApprovalActions>
        </ToolApproval>
      )}
      <ChatComposer
        size="compact"
        onSubmit={(event) => {
          event.preventDefault()
          setMessage("")
        }}
      >
        <ChatComposerInput
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Reply to Claude"
        />
        <ChatComposerFooter>
          <ChatComposerActions>
            <ChatComposerAction aria-label="Add attachment" title="Add attachment">
              <Plus aria-hidden="true" />
            </ChatComposerAction>
          </ChatComposerActions>
          <ChatComposerActions className="justify-end">
            <ChatComposerSubmit disabled={!message.trim()} />
          </ChatComposerActions>
        </ChatComposerFooter>
      </ChatComposer>
      </div>
      <ResetDemo
        onReset={() => {
          setDecision(null)
          setExited(false)
        }}
      />
    </div>
  )
}

const meta = {
  title: "Agents/Tools/ToolApproval",
  component: ToolApproval,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A tool-permission request card: an agent wants to run something and the person decides before it does. One composable request — ToolApprovalHeader with an icon and a heading stack of title plus description, a ToolApprovalCommand payload showing exactly what the tool is about to run (wrapping long commands, scrolling past a built-in height cap, and pretty-printing structured inputs via its `json` prop), and a ToolApprovalActions row of ToolApprovalAction buttons — renders on three surfaces chosen by `variant`: `docked` sits full-width directly above the chat composer, `floating` is a compact free-standing panel that also serves narrow viewports, and `notch` drops from the top display edge with a square top and rounded bottom corners. The card mounts with a token-driven entrance animation and is announced to assistive tech as a named group. Resolution is host-driven: set `resolution` (allowed or denied) when a choice is made — the card goes inert and plays the variant's exit motion — and unmount it from `onExited`, swapping in whatever follows.",
      },
    },
  },
} satisfies Meta<typeof ToolApproval>

export default meta
type Story = StoryObj<typeof meta>

export const ComposerDocked: Story = {
  parameters: storyDocumentation(
    "The primary surface: the approval card docked directly above the composer, so the decision happens where the conversation already is, with the command panel showing exactly what the tool wants to run. Deny is the quiet ghost action and Allow once the primary; Always allow opens the scope menu — always, or just this session — each choice carrying a description that makes the grant's reach explicit before it is given. Every action shares one geometry, so weight is read from variant alone. This story deliberately leaves the request live so it can be clicked through by hand: its play test inspects the pending presentation, the size parity, and the scope menu. AllowFlow and DeniedFlow carry the resolution outcomes.",
  ),
  render: () => <DockedApprovalExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval"]',
    )!
    await expect(card).toHaveAttribute("data-variant", "docked")
    await expect(canvas.getByRole("group", { name: "Tool approval request" })).toBe(
      card,
    )
    // The docked card reads as a rounded-2xl surface with a real border.
    const cardStyle = getComputedStyle(card)
    await expect(Number.parseFloat(cardStyle.borderTopLeftRadius)).toBe(16)
    await expect(cardStyle.borderTopStyle).toBe("solid")
    // A short payload wraps without overflowing, so it never mints a tab stop.
    const command = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval-command"]',
    )!
    const commandStyle = getComputedStyle(command)
    await expect(commandStyle.whiteSpace).toBe("pre-wrap")
    await expect(command).not.toHaveAttribute("tabindex")
    // Every action shares one geometry — weight is carried by variant, never
    // by one choice being physically larger than its neighbours.
    const actions = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="tool-approval-action"], [data-slot="tool-approval-action-menu-trigger"]',
      ),
    )
    await expect(actions).toHaveLength(3)
    const heights = new Set(
      actions.map((action) => Math.round(action.getBoundingClientRect().height)),
    )
    await expect(heights.size).toBe(1)
    const fontSizes = new Set(
      actions.map((action) => getComputedStyle(action).fontSize),
    )
    await expect(fontSizes.size).toBe(1)
    // Always allow fans out into explicit scopes before granting anything.
    // The scope text is a real aria description, not part of the name.
    await userEvent.click(canvas.getByRole("button", { name: "Always allow" }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByRole("menuitem", {
        name: "Allow for this session",
        description: "Resets when this session ends",
      }),
    ).toBeVisible()
    await expect(
      body.getByRole("menuitem", {
        name: "Always allow",
        description: "Keeps applying in future sessions",
      }),
    ).toBeVisible()
    // Dismiss the menu rather than granting: this story stays live so the
    // whole decision can be clicked through by hand.
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(
        body.queryByRole("menuitem", { name: "Allow for this session" }),
      ).toBeNull(),
    )
    await expect(card.isConnected).toBe(true)
    await expect(card).not.toHaveAttribute("data-resolution")
    // The composer stays usable alongside the pending request.
    await expect(canvas.getByRole("textbox", { name: "Message" })).toBeEnabled()
    await settledCard(canvasElement)
  },
}

export const AllowFlow: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "What granting looks like end to end on the docked surface: choosing a scope sets `resolution`, the card goes inert and plays its sink-and-fade exit, and the host's `onExited` swaps in the running ToolCall row plus a note naming the grant's reach, then re-homes focus into the composer — the exiting card released it. The play test grants for the session, asserts the handoff and the focus move, then presses the story's Reset demo scaffolding so the story is left on a live request you can run yourself.",
  ),
  render: () => <DockedApprovalExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Always allow" }))
    const body = within(canvasElement.ownerDocument.body)
    const sessionGrant = await body.findByRole("menuitem", {
      name: "Allow for this session",
      description: "Resets when this session ends",
    })
    await userEvent.click(sessionGrant)
    // The card leaves, handing off to the running row and the scope note.
    // (The resolved-inert presentation itself is pinned deterministically in
    // the ExitFrameHold story — reading this card mid-exit would race its
    // unmount.)
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="tool-approval"]'),
      ).toBeNull(),
    )
    await expect(
      canvas.getByRole("button", { name: /Running tests/ }),
    ).toBeVisible()
    await expect(
      canvas.getByText("Bash is allowed for the rest of this session."),
    ).toBeVisible()
    // The composer stayed mounted, and the host re-homed focus into it —
    // the exiting card went inert and released it.
    const input = canvas.getByRole("textbox", { name: "Message" })
    await expect(input).toBeEnabled()
    await waitFor(() => expect(input).toHaveFocus())
    // Leave the story on a live request so it can be clicked through by
    // hand; clearing the resolution also proves the reset path restores the
    // card rather than stranding it.
    await userEvent.click(canvas.getByRole("button", { name: "Reset demo" }))
    await settledCard(canvasElement)
  },
}

export const DeniedFlow: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The other side of the decision on the same docked surface: Deny resolves the card the same way — inert, sink-and-fade exit — and the host's `onExited` swaps in a quiet denied note instead of a tool row, leaving the composer ready for the person to redirect. The play test denies the request and asserts the card leaves and the note arrives.",
  ),
  render: () => <DockedApprovalExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Deny" }))
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="tool-approval"]'),
      ).toBeNull(),
    )
    await expect(
      canvas.getByText("Denied — Claude will suggest another way."),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: /Running tests/ }),
    ).not.toBeInTheDocument()
    // Leave the story on a live request for hands-on exploration.
    await userEvent.click(canvas.getByRole("button", { name: "Reset demo" }))
    await settledCard(canvasElement)
  },
}

export const ResolvedHistory: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "A card MOUNTED already resolved — restored transcript history. No entrance plays, no exit plays, `onExited` never fires: the card stands as a readable record, fully present to assistive tech, with `data-resolution` exposed for host styling. History renders the outcome note in place of live action buttons — a record offers nothing to press. The play test asserts the card persists, is NOT inert, keeps its accessible group name, and reports zero exit calls.",
  ),
  render: function ResolvedHistoryExample() {
    const [exitCalls, setExitCalls] = React.useState(0)
    return (
      <div className="grid w-[min(44rem,calc(100vw-2rem))] min-w-0 gap-3 rounded-[2rem] bg-background p-2 sm:p-6">
        <ToolApproval
          resolution="allowed"
          onExited={() => setExitCalls((count) => count + 1)}
        >
          <ApprovalHeader />
          <ToolApprovalCommand>
            pnpm vitest run --project=storybook
          </ToolApprovalCommand>
          <p className="text-sm text-muted-foreground">
            Allowed once · ran in 42s
          </p>
        </ToolApproval>
        <p className="text-sm text-muted-foreground">
          onExited calls: <span data-slot="exit-call-count">{exitCalls}</span>
        </p>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval"]',
    )!
    await expect(card).toHaveAttribute("data-resolution", "allowed")
    // History stays readable: not inert, still an accessible named group.
    await expect(card).not.toHaveAttribute("inert")
    await expect(
      canvas.getByRole("group", { name: "Tool approval request" }),
    ).toBe(card)
    // Mounted-resolved is static: no motion, no onExited, ever.
    await expect(card.getAnimations()).toHaveLength(0)
    await expect(
      canvasElement.querySelector('[data-slot="exit-call-count"]'),
    ).toHaveTextContent("0")
    await expect(card.isConnected).toBe(true)
  },
}

export const ExitFrameHold: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The resolved-inert contract, pinned deterministically: a pending card resolves WITHOUT an `onExited` unmount, so it plays its exit and holds the final frame. From that moment the card is inert — no pointer, no keyboard, gone from the accessibility tree — so a held Enter or stray click can never grant twice, and nothing invisible stays announced. The interactive stories only assert flow outcomes, since reading a card mid-exit races its unmount; this story is where the mid-flight guarantees live. The play test resolves the card and asserts inertness, unfocusable controls, and the held frame.",
  ),
  render: function ExitFrameHoldExample() {
    const [resolution, setResolution] = React.useState<"allowed" | null>(null)
    return (
      <div className="grid min-w-0 gap-2">
        <div className="grid w-[min(44rem,calc(100vw-2rem))] min-w-0 gap-3 rounded-[2rem] bg-background p-2 sm:p-6">
        <ToolApproval resolution={resolution}>
          <ApprovalHeader />
          <ToolApprovalCommand>
            pnpm vitest run --project=storybook
          </ToolApprovalCommand>
          <ToolApprovalActions>
            <ToolApprovalAction variant="ghost">Deny</ToolApprovalAction>
            <ToolApprovalAction
              variant="default"
              onClick={() => setResolution("allowed")}
            >
              Allow once
            </ToolApprovalAction>
          </ToolApprovalActions>
        </ToolApproval>
        {resolution !== null && (
          <p className="text-sm text-muted-foreground">
            Resolved and held at its exit state — the card is still mounted
            above, invisible and inert. Reset to bring it back.
          </p>
        )}
        </div>
        <ResetDemo onReset={() => setResolution(null)} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval"]',
    )!
    const allowOnce = canvas.getByRole("button", { name: "Allow once" })
    await userEvent.click(allowOnce)
    // The card never unmounts here, so these reads race nothing.
    await expect(card).toHaveAttribute("data-resolution", "allowed")
    await expect(card).toHaveAttribute("inert")
    // Inert removes the controls from the tab order entirely, so a held
    // Enter or stray click can never grant twice.
    allowOnce.focus()
    await expect(allowOnce).not.toHaveFocus()
    // Under motion, exactly one exit animation runs and settles into its
    // held final frame — the card ends invisible but mounted. Under reduced
    // motion no animation ever exists and the card simply stays put, inert.
    const reducedMotion = canvasElement.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    if (reducedMotion) {
      // No player runs, so the exit's end state applies instantly instead —
      // an inert card must never sit there looking live.
      await expect(card.getAnimations()).toHaveLength(0)
      await waitFor(() => expect(getComputedStyle(card).opacity).toBe("0"))
    } else {
      await waitFor(() => expect(card.getAnimations()).toHaveLength(1))
      await waitFor(() =>
        expect(card.getAnimations()[0]!.playState).toBe("finished"),
      )
      // fill: "forwards" holds the sink-and-fade destination.
      await expect(getComputedStyle(card).opacity).toBe("0")
    }
    await expect(card.isConnected).toBe(true)
    // Clearing the resolution cancels the held frame and brings the card
    // back — both the documented reset path and what leaves this story
    // visible and clickable rather than parked at opacity 0.
    await userEvent.click(canvas.getByRole("button", { name: "Reset demo" }))
    await waitFor(() => expect(getComputedStyle(card).opacity).toBe("1"))
    await expect(card).not.toHaveAttribute("inert")
    await expect(canvas.getByRole("button", { name: "Allow once" })).toBeVisible()
  },
}

export const FloatingPanel: Story = {
  parameters: storyDocumentation(
    "The compact free-standing panel for hosts that surface approvals as a floating window rather than in the transcript. It is deliberately tighter than a desktop permission dialog — capped at 24rem, one command line, three actions — so it reads as a card, not a modal takeover. The play test pins the width cap and the panel's elevation shadow with computed styles.",
  ),
  render: () => (
    <div className="flex h-80 w-[min(44rem,calc(100vw-2rem))] items-center justify-center rounded-[2rem] border border-border bg-muted/40 p-4">
      <ToolApproval variant="floating">
        <ApprovalHeader />
        <ToolApprovalCommand>
          pnpm vitest run --project=storybook
        </ToolApprovalCommand>
        <ToolApprovalActions>
          <ToolApprovalAction variant="ghost">Deny</ToolApprovalAction>
          <ToolApprovalActionMenu label="Always allow">
            <ToolApprovalActionMenuItem description="Keeps applying in future sessions">
              Always allow
            </ToolApprovalActionMenuItem>
            <ToolApprovalActionMenuItem description="Resets when this session ends">
              Allow for this session
            </ToolApprovalActionMenuItem>
          </ToolApprovalActionMenu>
          <ToolApprovalAction variant="default">
            Allow once
          </ToolApprovalAction>
        </ToolApprovalActions>
      </ToolApproval>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval"]',
    )!
    await expect(card).toHaveAttribute("data-variant", "floating")
    await expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(384)
    const style = getComputedStyle(card)
    await expect(style.boxShadow).not.toBe("none")
    await expect(Number.parseFloat(style.borderTopLeftRadius)).toBe(16)
    // Settle the entrance so the post-play axe sweep measures the card's
    // resting colors rather than a mid-fade frame.
    await settledCard(canvasElement)
  },
}

export const LinkAction: Story = {
  parameters: storyDocumentation(
    "An action rendered as something other than a button: `asChild` hands the styling to the child element, so a request that should link somewhere — the policy behind the permission, a doc — keeps the row's shape without pretending to be a button. The child owns the whole content, and no stray `type` attribute lands on the anchor. The play test asserts the rendered anchor, its href, the absent type, and that it matches its button sibling's height.",
  ),
  render: () => (
    <div className="flex w-[min(44rem,calc(100vw-2rem))] items-center justify-center rounded-[2rem] border border-border bg-muted/40 p-6">
      <ToolApproval variant="floating">
        <ApprovalHeader />
        <ToolApprovalCommand>
          pnpm vitest run --project=storybook
        </ToolApprovalCommand>
        <ToolApprovalActions>
          <ToolApprovalAction asChild variant="ghost">
            <a href="https://example.com/permissions">Why is this asked?</a>
          </ToolApprovalAction>
          <ToolApprovalAction variant="default">
            Allow once
          </ToolApprovalAction>
        </ToolApprovalActions>
      </ToolApproval>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByRole("link", { name: "Why is this asked?" })
    await expect(link.tagName).toBe("A")
    await expect(link).toHaveAttribute("href", "https://example.com/permissions")
    // type="button" belongs to real buttons only; slotting must not leak it.
    await expect(link).not.toHaveAttribute("type")
    // The slotted child keeps the action's own styling.
    await expect(link).toHaveAttribute("data-slot", "tool-approval-action")
    // The slotted link matches its button sibling's geometry exactly.
    const allowOnce = canvas.getByRole("button", { name: "Allow once" })
    await expect(
      Math.round(link.getBoundingClientRect().height),
    ).toBe(Math.round(allowOnce.getBoundingClientRect().height))
    await settledCard(canvasElement)
  },
}

export const MobileSheet: Story = {
  parameters: storyDocumentation(
    "The floating variant answering a phone viewport, carrying a full structured tool input: the payload scrolls inside its height cap instead of pushing the actions off screen, and the actions restack into a full-width column — plain className overrides on ToolApprovalActions, no separate mobile component. The choice set stays at three so it never overwhelms: Allow once on top, Always allow opening the two scopes (always versus this session) as a trigger-width sheet-like menu, Deny last. The play test asserts the column restack, opens the scope menu, and checks the payload's scroll overflow from computed styles.",
  ),
  render: () => (
    <div className="flex w-[23.4375rem] max-w-full flex-col justify-end gap-3 rounded-[2.5rem] border border-border bg-background p-3 pt-24">
      <ToolApproval variant="floating" className="w-full">
        <ApprovalHeader />
        <ToolApprovalCommand json={structuredInput} label="Tool input" />
        <ToolApprovalActions className="flex-col-reverse items-stretch">
          <ToolApprovalAction variant="ghost" size="default">
            Deny
          </ToolApprovalAction>
          <ToolApprovalActionMenu
            label="Always allow"
            size="default"
            contentClassName="w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            <ToolApprovalActionMenuItem description="Keeps applying in future sessions">
              Always allow
            </ToolApprovalActionMenuItem>
            <ToolApprovalActionMenuItem description="Resets when this session ends">
              Allow for this session
            </ToolApprovalActionMenuItem>
          </ToolApprovalActionMenu>
          <ToolApprovalAction variant="default" size="default">
            Allow once
          </ToolApprovalAction>
        </ToolApprovalActions>
      </ToolApproval>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval"]',
    )!
    const actions = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval-actions"]',
    )!
    // Let the entrance settle so later measurements (and the post-play axe
    // sweep) see the card at rest, not mid-fade. The entrance animates the
    // card node itself, so descendants' incidental hover transitions are
    // deliberately out of scope here.
    await waitFor(() => expect(card.getAnimations()).toHaveLength(0))
    await expect(getComputedStyle(actions).flexDirection).toBe("column-reverse")
    const allowOnce = canvas.getByRole("button", { name: "Allow once" })
    const deny = canvas.getByRole("button", { name: "Deny" })
    // Buttons stretch to the card's content width, primary visually on top.
    const cardStyle = getComputedStyle(card)
    const contentWidth =
      card.getBoundingClientRect().width -
      Number.parseFloat(cardStyle.paddingLeft) -
      Number.parseFloat(cardStyle.paddingRight) -
      Number.parseFloat(cardStyle.borderLeftWidth) -
      Number.parseFloat(cardStyle.borderRightWidth)
    await expect(allowOnce.getBoundingClientRect().width).toBeCloseTo(
      contentWidth,
      0,
    )
    // Three choices stack: once on top, the scoped grant trigger, deny last.
    const always = canvas.getByRole("button", { name: "Always allow" })
    await expect(allowOnce.getBoundingClientRect().top).toBeLessThan(
      always.getBoundingClientRect().top,
    )
    await expect(always.getBoundingClientRect().top).toBeLessThan(
      deny.getBoundingClientRect().top,
    )
    // The scopes stay one tap away, spelled out with their reach.
    await userEvent.click(always)
    const body = within(canvasElement.ownerDocument.body)
    const sessionGrant = await body.findByRole("menuitem", {
      name: /Allow for this session/,
    })
    await expect(sessionGrant).toHaveTextContent("Resets when this session ends")
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(
        body.queryByRole("menuitem", { name: /Allow for this session/ }),
      ).toBeNull(),
    )
    // The structured payload overflows its cap and scrolls on the phone too.
    const command = canvas.getByRole("region", { name: "Tool input" })
    await expect(getComputedStyle(command).overflowY).toBe("auto")
    await waitFor(() =>
      expect(command.scrollHeight).toBeGreaterThan(command.clientHeight),
    )
    await waitFor(() => expect(command).toHaveAttribute("tabindex", "0"))
  },
}

const longCommand = `set -euo pipefail

export NODE_ENV=test
export STORYBOOK_DISABLE_TELEMETRY=1

pnpm --filter @nessa-ui/react build
pnpm build:registry
pnpm validate

for project in storybook chromium-touch chromium-reduced-motion; do
  pnpm --filter @nessa-ui/storybook exec vitest run \\
    --project="$project" \\
    --reporter=verbose \\
    --coverage.enabled \\
    --coverage.reporter=text-summary
done

pnpm --filter @nessa-ui/storybook test:docs
git status --short`

export const LongCommand: Story = {
  parameters: storyDocumentation(
    "Agents rarely ask to run one tidy line. Past the built-in height cap the command panel scrolls instead of stretching the card, lines keep wrapping so nothing hides off the right edge, and the region gains a tab stop with an inset focus outline only while it actually overflows — a short payload never mints one. The play test asserts the cap, the live scroll overflow, the keyboard reachability, and the wrapped lines from computed styles.",
  ),
  render: () => (
    <div className="w-[min(44rem,calc(100vw-2rem))] rounded-[2rem] bg-background p-2 sm:p-6">
      <ToolApproval>
        <ApprovalHeader />
        <ToolApprovalCommand>{longCommand}</ToolApprovalCommand>
        <ToolApprovalActions>
          <ToolApprovalAction variant="ghost">Deny</ToolApprovalAction>
          <ToolApprovalAction>Always allow</ToolApprovalAction>
          <ToolApprovalAction variant="default">
            Allow once
          </ToolApprovalAction>
        </ToolApprovalActions>
      </ToolApproval>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const command = canvas.getByRole("region", { name: "Command input" })
    const style = getComputedStyle(command)
    // Capped at max-h-48 (12rem) with real overflow behind it.
    await expect(Number.parseFloat(style.maxHeight)).toBe(192)
    await expect(style.overflowY).toBe("auto")
    await expect(style.whiteSpace).toBe("pre-wrap")
    await waitFor(() =>
      expect(command.scrollHeight).toBeGreaterThan(command.clientHeight),
    )
    // Overflow earns the region its tab stop and inset focus outline.
    await waitFor(() => expect(command).toHaveAttribute("tabindex", "0"))
    command.focus()
    await expect(command).toHaveFocus()
    await expect(command.textContent).toContain("git status --short")
    await settledCard(canvasElement)
  },
}

const structuredInput = {
  tool: "http_request",
  method: "POST",
  url: "https://api.nessa.dev/v1/registry/publish",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
  },
  body: {
    item: "tool-approval",
    channel: "canary",
    dryRun: true,
  },
  timeoutMs: 30000,
}

export const StructuredJsonInput: Story = {
  parameters: storyDocumentation(
    "A structured tool input passed through the `json` prop: objects (or JSON strings, parsed first) render through the JsonTree component — muted keys, emphasized values, real JSON punctuation — so the person can actually read what the tool is about to receive. Fold toggles stay off here (`jsonCollapsible` opts in) because an approval surface owes the person the whole payload. The play test asserts the JsonTree render, the key/value color split, and that no toggles exist.",
  ),
  render: () => (
    <div className="flex w-[min(44rem,calc(100vw-2rem))] items-center justify-center rounded-[2rem] border border-border bg-muted/40 p-6">
      <ToolApproval variant="floating">
        <ToolApprovalHeader>
          <ToolApprovalIcon>
            <BashIcon />
          </ToolApprovalIcon>
          <ToolApprovalHeading>
            <ToolApprovalTitle>Call http_request</ToolApprovalTitle>
            <ToolApprovalDescription>
              Claude wants to publish to the canary channel
            </ToolApprovalDescription>
          </ToolApprovalHeading>
        </ToolApprovalHeader>
        <ToolApprovalCommand json={structuredInput} label="Tool input" />
        <ToolApprovalActions>
          <ToolApprovalAction variant="ghost">Deny</ToolApprovalAction>
          <ToolApprovalAction variant="default">
            Allow once
          </ToolApprovalAction>
        </ToolApprovalActions>
      </ToolApproval>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const command = canvas.getByRole("region", { name: "Tool input" })
    // The payload renders as a JsonTree with the whole structure visible.
    const tree = command.querySelector<HTMLElement>('[data-slot="json-tree"]')!
    await expect(tree.textContent).toContain('"tool": "http_request"')
    await expect(tree.textContent).toContain('"accept"')
    const keys = tree.querySelectorAll<HTMLElement>(
      '[data-slot="json-tree-key"]',
    )
    await expect(keys.length).toBe(11)
    // Keys tint muted while values keep the foreground emphasis.
    await expect(getComputedStyle(keys[0]!).color).not.toBe(
      getComputedStyle(command).color,
    )
    // No fold toggles on a consent surface: the person sees everything.
    await expect(within(command).queryAllByRole("button")).toHaveLength(0)
    await settledCard(canvasElement)
  },
}

/** A stylized top-of-display frame: menu bar, camera-housing notch, wallpaper. */
function NotchFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-t-2xl border border-border bg-background">
      {/* Menu bar and housing sit above the drop layer so the card slides
          out from behind the bezel instead of painting over it. */}
      <div className="relative z-10 flex h-7 items-center justify-between bg-sidebar px-3 text-xs text-sidebar-foreground">
        <span className="font-medium">Finder</span>
        <span>Fri Aug 22 9:41 AM</span>
      </div>
      <div className="h-[26rem] w-full bg-gradient-to-b from-muted to-background" />
      {/* The camera housing itself: literal black, like the hardware bezel. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 z-10 h-7 w-44 -translate-x-1/2 rounded-b-xl bg-black"
      />
      <div className="absolute inset-x-0 top-7 z-0 flex justify-center">
        {children}
      </div>
    </div>
  )
}

export const NotchDrop: Story = {
  tags: ["reduced-motion"],
  parameters: storyDocumentation(
    "The general-purpose drop-down: the same card hanging from the display's camera housing, for hosts that surface approvals as a system-wide affordance rather than inside the app window — here carrying a full multi-line command that scrolls inside its cap, so even a long request keeps the drop-down compact. The notch variant squares its top edge (no top border, no top radius) so it meets the bezel flush, rounds the bottom corners generously, and slides down from behind the edge on mount — the menu bar and housing sit on a higher layer so the card emerges from underneath them; resolving slides it back up behind the same edge before the host unmounts it. The story frames it in a dark scheme scope since the surrounding hardware is black. The play test asserts the asymmetric geometry, the payload's scroll overflow, and horizontal centering after the entrance settles, then allows the request and asserts the card retreats.",
  ),
  render: function NotchApprovalExample() {
    const [resolution, setResolution] = React.useState<
      "allowed" | "denied" | null
    >(null)
    const [exited, setExited] = React.useState(false)
    return (
      <div className="grid min-w-0 gap-2">
        <NotchFrame>
          {!exited && (
          <ToolApproval
            variant="notch"
            resolution={resolution}
            onExited={() => setExited(true)}
          >
            <ApprovalHeader />
            <ToolApprovalCommand>{longCommand}</ToolApprovalCommand>
            <ToolApprovalActions>
              <ToolApprovalAction
                variant="ghost"
                onClick={() => setResolution("denied")}
              >
                Deny
              </ToolApprovalAction>
              <ToolApprovalActionMenu label="Always allow">
                <ToolApprovalActionMenuItem
                  description="Keeps applying in future sessions"
                  onSelect={() => setResolution("allowed")}
                >
                  Always allow
                </ToolApprovalActionMenuItem>
                <ToolApprovalActionMenuItem
                  description="Resets when this session ends"
                  onSelect={() => setResolution("allowed")}
                >
                  Allow for this session
                </ToolApprovalActionMenuItem>
              </ToolApprovalActionMenu>
              <ToolApprovalAction
                variant="default"
                onClick={() => setResolution("allowed")}
              >
                Allow
              </ToolApprovalAction>
            </ToolApprovalActions>
          </ToolApproval>
          )}
        </NotchFrame>
        <ResetDemo
          onReset={() => {
            setResolution(null)
            setExited(false)
          }}
        />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-slot="tool-approval"]',
    )!
    await expect(card).toHaveAttribute("data-variant", "notch")
    // Let any entrance animation settle so the geometry reads are stable.
    await waitFor(() => expect(card.getAnimations()).toHaveLength(0))
    const style = getComputedStyle(card)
    await expect(Number.parseFloat(style.borderTopLeftRadius)).toBe(0)
    await expect(Number.parseFloat(style.borderTopRightRadius)).toBe(0)
    await expect(
      Number.parseFloat(style.borderBottomLeftRadius),
    ).toBeGreaterThanOrEqual(20)
    await expect(Number.parseFloat(style.borderTopWidth)).toBe(0)
    await expect(Number.parseFloat(style.borderBottomWidth)).toBeGreaterThan(0)
    // A long command scrolls inside its cap so the drop-down stays compact.
    const command = within(canvasElement).getByRole("region", {
      name: "Command input",
    })
    await waitFor(() =>
      expect(command.scrollHeight).toBeGreaterThan(command.clientHeight),
    )
    await waitFor(() => expect(command).toHaveAttribute("tabindex", "0"))
    // The bezel housing paints above the drop layer, so the card slides out
    // from behind it rather than over it.
    const housing = canvasElement.querySelector<HTMLElement>(".bg-black")!
    const dropLayer = card.parentElement!
    await expect(
      Number.parseInt(getComputedStyle(housing).zIndex, 10),
    ).toBeGreaterThan(Number.parseInt(getComputedStyle(dropLayer).zIndex, 10) || 0)
    // Centered under the housing.
    const frame = card.closest<HTMLElement>(".dark")!
    const cardRect = card.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    await expect(
      Math.abs(
        cardRect.left + cardRect.width / 2 - (frameRect.left + frameRect.width / 2),
      ),
    ).toBeLessThan(1)
    // Allowing retreats the card back up behind the bezel, then it unmounts.
    // (No mid-exit reads here — they would race the unmount.)
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Allow" }))
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="tool-approval"]'),
      ).toBeNull(),
    )
    // Leave the notch holding a live request so the drop can be watched and
    // dismissed by hand.
    await userEvent.click(canvas.getByRole("button", { name: "Reset demo" }))
    await settledCard(canvasElement)
  },
}
