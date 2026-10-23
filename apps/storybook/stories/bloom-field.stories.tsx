import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { BloomField, type BloomFieldLight } from "@nessalabs/ui";

import { storyDocumentation } from "./story-documentation";

/**
 * True under the test runner. The field drifts forever by design, so a play
 * test turns the drift off: once every value arrives it stops drawing and
 * nothing is left running for the next story.
 */
function underTest() {
  return typeof navigator !== "undefined" && Boolean(navigator.webdriver);
}

/** Waits for the field to report that every value has arrived. */
async function settled(canvasElement: HTMLElement) {
  const field = canvasElement.querySelector<HTMLElement>(
    '[data-slot="bloom-field"]',
  )!;
  await waitFor(() => expect(field).toHaveAttribute("data-settled", "true"), {
    timeout: 5000,
  });
  return field;
}

const meta = {
  title: "Primitives/BloomField",
  component: BloomField,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A WebGL field of soft colour blooms. `spread` takes it from one small orb (about 0.1) to filling the surface (1) to flooding past it (1.3). It can hold up to three `lights` — one per choice on offer — that brighten when pointed at and when chosen, lean toward a `tint`, and send a ring of light through itself when `ripple` changes. Every value is a number to jump or a tween to travel; `data-settled` says when they have all arrived. Under reduced motion values jump and nothing drifts.",
      },
    },
  },
  args: {
    ambient: !underTest(),
  },
} satisfies Meta<typeof BloomField>;

export default meta;
type Story = StoryObj<typeof meta>;

const frame = "h-[360px] w-full max-w-[640px] rounded-2xl";

export const Default: Story = {
  argTypes: {
    spread: { control: { type: "range", min: 0.05, max: 1.4, step: 0.01 } },
    fade: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
    speed: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
  },
  parameters: storyDocumentation(
    "The field at rest, filling its frame. Drag `spread` down to gather it into an orb, or past 1 to flood it.",
  ),
  render: (args) => <BloomField {...args} className={frame} />,
  play: async ({ canvasElement }) => {
    const field = await settled(canvasElement);
    await expect(field).toHaveAttribute("aria-hidden", "true");
    await expect(field.querySelector("canvas")).not.toBeNull();
  },
};

type Phase = "waiting" | "flood" | "gather";

const opening: Record<Phase, React.ComponentProps<typeof BloomField>> = {
  waiting: { spread: 0.12, fade: 0.9 },
  flood: { spread: { to: 1.3, duration: 1400, easing: "out" }, fade: 1 },
  gather: {
    spread: 1.3,
    fade: { to: 0.32, duration: 1300 },
  },
};

/**
 * The first-run opening it was made for: a small orb waits, floods the screen
 * when woken, then dims back so a window can stand in front of it.
 */
function Opening(props: React.ComponentProps<typeof BloomField>) {
  const [phase, setPhase] = React.useState<Phase>("waiting");
  const next: Record<Phase, Phase> = {
    waiting: "flood",
    flood: "gather",
    gather: "waiting",
  };
  const label: Record<Phase, string> = {
    waiting: "Wake",
    flood: "Gather",
    gather: "Again",
  };
  return (
    <div className="flex flex-col items-start gap-3">
      <BloomField
        {...props}
        {...opening[phase]}
        className={frame}
        data-phase={phase}
      />
      <button
        type="button"
        className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white"
        onClick={() => setPhase(next[phase])}
      >
        {label[phase]}
      </button>
    </div>
  );
}

export const WakeAndFlood: Story = {
  parameters: storyDocumentation(
    "Press Wake: the orb floods past the frame over 1.4 s. Gather dims it back to a third so a window can sit in front. Each step is just new prop values.",
  ),
  render: (args) => <Opening {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await settled(canvasElement);
    await expect(field).toHaveAttribute("data-phase", "waiting");
    await userEvent.click(canvas.getByRole("button", { name: "Wake" }));
    await expect(field).toHaveAttribute("data-phase", "flood");
    await settled(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Gather" }));
    await settled(canvasElement);
    await expect(field).toHaveAttribute("data-phase", "gather");
  },
};

const agents = [
  { name: "Claude", x: 0.64, y: 0.34, color: "#f09a4a" },
  { name: "Codex", x: 0.82, y: 0.54, color: "#4b6cf0" },
  { name: "OpenCode", x: 0.68, y: 0.73, color: "#e2457a" },
] as const;

/**
 * One light per agent. Pointing at a choice lifts its light; choosing it
 * lifts it further and tints the wash; Summon sends a ring from it.
 */
function AgentLights(props: React.ComponentProps<typeof BloomField>) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [chosen, setChosen] = React.useState<number | null>(null);
  const [ripple, setRipple] = React.useState(0);
  const lights: BloomFieldLight[] = agents.map((agent, index) => ({
    x: agent.x,
    y: agent.y,
    color: agent.color,
    emphasis: chosen === index ? 2 : hovered === index ? 1 : 0,
  }));
  const picked = chosen === null ? undefined : agents[chosen];
  return (
    <div className="flex flex-col items-start gap-3">
      <BloomField
        {...props}
        className={frame}
        lights={lights}
        tint={picked?.color}
        tintAmount={{ to: picked ? 0.55 : 0, duration: 300, easing: "out" }}
        ripple={ripple}
        rippleX={picked?.x}
        rippleY={picked?.y}
        data-chosen={picked?.name ?? ""}
        data-hovered={hovered === null ? "" : agents[hovered].name}
      />
      <div className="flex gap-2" role="radiogroup" aria-label="Agent">
        {agents.map((agent, index) => (
          <button
            key={agent.name}
            type="button"
            role="radio"
            aria-checked={chosen === index}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm aria-checked:bg-neutral-900 aria-checked:text-white"
            onPointerEnter={() => setHovered(index)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => setChosen(index)}
          >
            {agent.name}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-40"
          disabled={chosen === null}
          onClick={() => setRipple((count) => count + 1)}
        >
          Summon
        </button>
      </div>
    </div>
  );
}

export const Lights: Story = {
  args: { spread: 0.9, x: 0.72, fade: 0.8 },
  parameters: storyDocumentation(
    "Three agent lights. Point at a name to lift its light, choose it to tint the wash toward it, then Summon to send a ring of light from it. Under reduced motion there is no ring.",
  ),
  render: (args) => <AgentLights {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await settled(canvasElement);
    await userEvent.hover(canvas.getByRole("radio", { name: "Codex" }));
    // Hover commits at its own priority; wait for it before waiting on the
    // field, or the earlier "settled" passes for this one.
    await waitFor(() => expect(field).toHaveAttribute("data-hovered", "Codex"));
    await settled(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Codex" }));
    await expect(field).toHaveAttribute("data-chosen", "Codex");
    await settled(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Summon" }));
    // The ring runs for two seconds; settling again means it finished and
    // nothing is left drawing.
    await settled(canvasElement);
    await userEvent.unhover(canvas.getByRole("radio", { name: "Codex" }));
    await waitFor(() => expect(field).toHaveAttribute("data-hovered", ""));
    await settled(canvasElement);
  },
};

export const Glow: Story = {
  args: { clear: 1, spread: 0.35 },
  parameters: storyDocumentation(
    "With `clear` at 1 the ground is see-through, so the blooms lie on the page behind as a glow. Tween it back to 0 and the field becomes a surface again — the first-run opening does both.",
  ),
  render: (args) => (
    <div className="grid h-[360px] w-full max-w-[640px] place-items-center rounded-2xl bg-[linear-gradient(160deg,#dfeee9,#90a3b8)]">
      <BloomField {...args} className="size-full" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const field = await settled(canvasElement);
    // The field paints nothing of its own behind the canvas.
    await expect(getComputedStyle(field).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    // And what the canvas draws lets the page through: read its next frame
    // straight after the draw, before the browser clears the buffer.
    const canvas = field.querySelector("canvas")!;
    const gl = canvas.getContext("webgl")!;
    const draw = gl.drawArrays.bind(gl);
    const frame = new Promise<{ corner: number; middle: number }>((resolve) => {
      gl.drawArrays = (mode, first, count) => {
        draw(mode, first, count);
        gl.drawArrays = draw;
        const alpha = (x: number, y: number) => {
          const pixel = new Uint8Array(4);
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          return pixel[3];
        };
        resolve({
          corner: alpha(0, 0),
          middle: alpha(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1),
        });
      };
    });
    // A new size is what makes a settled field draw again.
    field.parentElement!.style.width = "639px";
    const { corner, middle } = await frame;
    await expect(corner).toBeLessThan(64);
    await expect(middle).toBeGreaterThan(corner);
  },
};
