import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AccessRequest, type AccessRequestState } from "@nessalabs/ui";

import { storyDocumentation } from "./story-documentation";

const grants = [
  "Agents can now run any command",
  "Agents can change settings without asking",
  "You can undo this in Settings, Access",
];

const meta = {
  title: "Conversation/AccessRequest",
  component: AccessRequest,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A red card asking to raise what agents may do — full access, or changing settings without asking. It says what is asked and why, offers a destructive Approve beside Not now, and once approved lists in plain lines what the person allowed. The host raises the access, reports a refusal through `failure`, and holds Approve with `held` while it can't.",
      },
    },
  },
  args: {
    title: "Allow full access in this chat?",
    reason:
      "I need to install the toolchain, which runs commands outside the project.",
    grants,
    onApprove: fn(),
    onDecline: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[min(26rem,calc(100vw-2rem))]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccessRequest>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Lets a clicked button's colour change end, so nothing runs past the test.
 * Two frames first, so a transition the click started has begun and is
 * counted, not missed as "nothing running".
 */
async function settle(canvasElement: HTMLElement) {
  for (let frame = 0; frame < 2; frame++)
    await new Promise((resolve) => requestAnimationFrame(resolve));
  await Promise.allSettled(
    canvasElement.getAnimations({ subtree: true }).map((each) => each.finished),
  );
  await waitFor(
    () =>
      expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0),
    { timeout: 5000 },
  );
}

export const Asking: Story = {
  parameters: storyDocumentation(
    "What the agent asks and why, with Approve and Not now. Not now turns it down.",
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("region", {
      name: "Allow full access in this chat?",
    });
    await expect(card).toHaveAttribute("data-state", "asking");
    await expect(card).toHaveTextContent("install the toolchain");
    // What it allows is said once it is approved, not before.
    await expect(
      canvasElement.querySelector("[data-slot=access-request-grants]"),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Not now" }));
    await expect(args.onDecline).toHaveBeenCalledTimes(1);
    await expect(args.onApprove).not.toHaveBeenCalled();
    await settle(canvasElement);
  },
};

/** A host that raises the access on Approve, the way an app does. */
function ApproveExample({ refuse }: { refuse?: boolean }) {
  const [state, setState] = React.useState<AccessRequestState>("asking");
  const [failure, setFailure] = React.useState<string>();
  return (
    <AccessRequest
      title="Allow full access in this chat?"
      reason="I need to install the toolchain, which runs commands outside the project."
      grants={grants}
      state={state}
      {...(failure ? { failure } : {})}
      onApprove={() => {
        setState("approving");
        setFailure(undefined);
        queueMicrotask(() => {
          if (refuse) {
            setState("asking");
            setFailure("Access didn’t change. The connection dropped.");
          } else setState("approved");
        });
      }}
      onDecline={() => {}}
    />
  );
}

export const Approved: Story = {
  parameters: storyDocumentation(
    "Approve raises the access; the actions go and the card lists what was allowed. Focus was on Approve, so the card takes it and is read with what was allowed.",
  ),
  render: () => <ApproveExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    const list = await waitFor(() => canvas.getByRole("list"));
    await expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(grants);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    const card = canvas.getByRole("region", {
      name: "Allow full access in this chat?",
    });
    await waitFor(() => expect(card).toHaveFocus());
    await expect(card).toHaveAccessibleDescription(grants.join(" "));
    await settle(canvasElement);
  },
};

export const Refused: Story = {
  parameters: storyDocumentation(
    "When the access did not change, the card says why and offers Approve again.",
  ),
  render: () => <ApproveExample refuse />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    await expect(await canvas.findByText(/Access didn’t change/)).toBeVisible();
    const status = canvas.getByRole("status");
    await expect(status).toHaveTextContent("Access didn’t change.");
    const approve = canvas.getByRole("button", { name: "Approve" });
    await expect(approve).not.toHaveAttribute("aria-disabled");
    // Approve says why it did not take, and kept focus through the attempt.
    await expect(approve).toHaveAccessibleDescription(
      "Access didn’t change. The connection dropped.",
    );
    await expect(approve).toHaveFocus();
    await settle(canvasElement);
  },
};

export const Held: Story = {
  args: { held: "You can approve once the agent stops." },
  parameters: storyDocumentation(
    "While the host can't raise the access — the agent is at work — Approve is held and the card says when it can be pressed.",
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const approve = canvas.getByRole("button", { name: "Approve" });
    await expect(approve).toHaveAttribute("aria-disabled", "true");
    await expect(approve).toHaveAccessibleDescription(
      "You can approve once the agent stops.",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "once the agent stops",
    );
    await expect(
      canvas.getByRole("button", { name: "Not now" }),
    ).not.toHaveAttribute("aria-disabled");
    // A held Approve does nothing, even from the keyboard.
    approve.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onApprove).not.toHaveBeenCalled();
  },
};

export const HeldAfterFailure: Story = {
  args: {
    failure: "Access didn’t change. The connection dropped.",
    held: "You can approve once the agent stops.",
  },
  parameters: storyDocumentation(
    "A failure and a hold together say both, so a held Approve always says why.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole("status");
    await expect(status).toHaveTextContent("The connection dropped.");
    await expect(status).toHaveTextContent("once the agent stops");
  },
};

export const Approving: Story = {
  args: { state: "approving" },
  parameters: storyDocumentation(
    "While the access is being raised both actions wait and the card is busy.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("region");
    await expect(card).toHaveAttribute("aria-busy", "true");
    for (const button of canvas.getAllByRole("button"))
      await expect(button).toHaveAttribute("aria-disabled", "true");
  },
};
