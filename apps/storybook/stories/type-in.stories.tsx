import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { BloomField, TypeIn } from "@nessalabs/ui";

import { storyDocumentation } from "./story-documentation";

/** Waits for every letter to settle and the caret to leave. */
async function typedIn(canvasElement: HTMLElement) {
  const root = canvasElement.querySelector<HTMLElement>(
    '[data-slot="type-in"]',
  )!;
  await waitFor(() => expect(root).toHaveAttribute("data-typed", "true"), {
    timeout: 5000,
  });
  return root;
}

const meta = {
  title: "Primitives/TypeIn",
  component: TypeIn,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "Text that types itself in a key at a time, at an uneven, human pace, painted with one gradient across the whole word. Each letter lands with a small press and a flash that cools into its colour; a gradient caret leads, then blinks twice and leaves. Nothing loops, and `data-typed` marks the end. For a wordmark at a once-only moment, such as a first run. Under reduced motion the text is simply there.",
      },
    },
  },
  args: { text: "Nessa" },
} satisfies Meta<typeof TypeIn>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A dimmed Bloom field, the way the first run shows it. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid h-[320px] w-full max-w-[640px] place-items-center overflow-hidden rounded-2xl">
      <BloomField
        className="absolute inset-0"
        spread={1.12}
        fade={0.36}
        ambient={!navigator.webdriver}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export const Wordmark: Story = {
  parameters: storyDocumentation(
    "The first-run wordmark over the dimmed Bloom field. Press Replay to type it again.",
  ),
  render: (args) => <Replayable {...args} />,
  play: playWordmark,
};

function Replayable(args: React.ComponentProps<typeof TypeIn>) {
  const [round, setRound] = React.useState(0);
  return (
    <div className="flex flex-col items-start gap-3">
      <Stage>
        <TypeIn
          key={round}
          {...args}
          className="text-[88px] leading-none font-semibold tracking-[-0.05em] drop-shadow-[0_2px_10px_rgb(20_6_40/0.45)]"
        />
      </Stage>
      <button
        type="button"
        className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white"
        onClick={() => setRound((count) => count + 1)}
      >
        Replay
      </button>
    </div>
  );
}

async function playWordmark({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const root = await typedIn(canvasElement);
  await expect(canvas.getByText("Nessa")).toBeInTheDocument();
  const letters = root.querySelectorAll('[data-slot="type-in-letter"]');
  await expect(letters).toHaveLength(5);
  for (const letter of letters) {
    await expect(getComputedStyle(letter).opacity).toBe("1");
  }
  const caret = root.querySelector<HTMLElement>('[data-slot="type-in-caret"]')!;
  await expect(getComputedStyle(caret).opacity).toBe("0");
  await expect(root.getAnimations({ subtree: true })).toHaveLength(0);

  await userEvent.click(canvas.getByRole("button", { name: "Replay" }));
  const again = await typedIn(canvasElement);
  await expect(again.getAnimations({ subtree: true })).toHaveLength(0);
}

export const Waiting: Story = {
  args: { play: false },
  parameters: storyDocumentation(
    "Before `play` turns true the text keeps its space and shows nothing, so a host can lay out around it and start it on cue.",
  ),
  render: (args) => <OnCue {...args} />,
  play: playWaiting,
};

function OnCue(args: React.ComponentProps<typeof TypeIn>) {
  const [play, setPlay] = React.useState(Boolean(args.play));
  return (
    <div className="flex flex-col items-start gap-3">
      <Stage>
        <TypeIn
          {...args}
          play={play}
          className="text-[72px] leading-none font-semibold tracking-[-0.05em]"
        />
      </Stage>
      <button
        type="button"
        className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white"
        onClick={() => setPlay(true)}
      >
        Type
      </button>
    </div>
  );
}

async function playWaiting({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const root = canvasElement.querySelector<HTMLElement>(
    '[data-slot="type-in"]',
  )!;
  await expect(root).not.toHaveAttribute("data-typed");
  const first = root.querySelector('[data-slot="type-in-letter"]')!;
  await expect(getComputedStyle(first).opacity).toBe("0");
  await expect(root.getBoundingClientRect().width).toBeGreaterThan(100);
  await userEvent.click(canvas.getByRole("button", { name: "Type" }));
  await typedIn(canvasElement);
  await expect(getComputedStyle(first).opacity).toBe("1");
}

export const PlainLeadIn: Story = {
  args: {
    text: "Welcome to Nessa",
    plain: 11,
    delay: 0,
    colors: ["#e2457a", "#8d5ad8", "#4b6cf0"],
  },
  parameters: storyDocumentation(
    "`plain` keeps the opening in the text's own colour so the gradient lands on the name alone — the first-run welcome on its light pane. With `delay` at 0 the first key goes at once and the caret never blinks back to the start.",
  ),
  render: (args) => (
    <div className="rounded-2xl bg-white p-10 text-neutral-900">
      <TypeIn {...args} className="text-[40px] leading-none font-semibold tracking-[-0.035em]" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = await typedIn(canvasElement);
    const letters = [...root.querySelectorAll<HTMLElement>('[data-slot="type-in-letter"]')];
    await expect(letters).toHaveLength(16);
    await expect(letters.filter((letter) => letter.hasAttribute("data-painted"))).toHaveLength(5);
    await expect(letters[0]).not.toHaveAttribute("data-painted");
    await expect(root.getAnimations({ subtree: true })).toHaveLength(0);
  },
};
