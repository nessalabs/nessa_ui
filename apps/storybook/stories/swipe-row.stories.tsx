import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Archive, Trash2 } from "lucide-react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { SwipeRow, SwipeRowGroup, type SwipeRowAction } from "@nessalabs/ui";

import { storyDocumentation } from "./story-documentation";

interface Item {
  id: string;
  title: string;
  detail: string;
}

const inbox: readonly Item[] = [
  { id: "notes", title: "Release notes", detail: "Draft for Thursday" },
  { id: "audit", title: "Repo audit", detail: "Composer call sites mapped" },
  {
    id: "tokens",
    title: "Motion token audit",
    detail: "Every settle reads the token",
  },
  {
    id: "panel",
    title: "Panel layout",
    detail: "Messages under the tab strip",
  },
];

// Archive is the primary action: a full swipe commits it. Delete is
// destructive, so it only ever runs from a deliberate, confirmed press.
const actions: readonly SwipeRowAction[] = [
  { id: "archive", label: "Archive", icon: <Archive /> },
  { id: "delete", label: "Delete", icon: <Trash2 />, tone: "destructive" },
];

interface ListExampleProps {
  /** The desktop host's configuration: mouse drags and right-clicks are its own. */
  host?: boolean;
}

function ListExample({ host = false }: ListExampleProps) {
  const [items, setItems] = React.useState(inbox);
  const [log, setLog] = React.useState<readonly string[]>([]);
  const record = (entry: string) => setLog((entries) => [...entries, entry]);
  const onAction = (item: Item) => (actionId: string) => {
    record(`${actionId}:${item.id}`);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  };
  const rowClassName =
    "flex w-full min-w-0 flex-col items-start gap-0.5 rounded-xl border-0 bg-transparent px-3 py-2.5 text-start hover:bg-accent transition-colors outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const content = (item: Item) => (
    <>
      <span className="font-sans nessa-text-4 font-semibold text-foreground">
        {item.title}
      </span>
      <span className="font-sans nessa-text-2 text-muted-foreground">
        {item.detail}
      </span>
    </>
  );
  return (
    <div className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      <div className="rounded-[2rem] bg-background p-4">
        {host ? (
          <SwipeRowGroup asChild debug>
            <div
              role="listbox"
              aria-label="Inbox"
              className="flex max-h-80 flex-col overflow-y-auto"
            >
              {items.map((item) => (
                <SwipeRow
                  key={item.id}
                  value={item.id}
                  name={item.title}
                  actions={actions}
                  mouseDrag={false}
                  openOnContextMenu={false}
                  onAction={onAction(item)}
                >
                  <div
                    role="option"
                    aria-selected="false"
                    tabIndex={0}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      record(`menu:${item.id}`);
                    }}
                    className={rowClassName}
                  >
                    {content(item)}
                  </div>
                </SwipeRow>
              ))}
            </div>
          </SwipeRowGroup>
        ) : (
          <SwipeRowGroup asChild debug>
            <ul
              aria-label="Inbox"
              className="m-0 flex max-h-80 list-none flex-col overflow-y-auto p-0"
            >
              {items.map((item) => (
                <SwipeRow
                  key={item.id}
                  as="li"
                  value={item.id}
                  name={item.title}
                  actions={actions}
                  onAction={onAction(item)}
                >
                  <button
                    type="button"
                    onClick={() => record(`open:${item.id}`)}
                    className={rowClassName}
                  >
                    {content(item)}
                  </button>
                </SwipeRow>
              ))}
            </ul>
          </SwipeRowGroup>
        )}
      </div>
      <output
        aria-label="Events"
        className="min-h-5 px-4 font-sans nessa-text-1 text-muted-foreground"
      >
        {log.join(", ")}
      </output>
    </div>
  );
}

const meta = {
  title: "Primitives/SwipeRow",
  component: SwipeRow,
  tags: ["autodocs", "test"],
  args: {
    value: "notes",
    name: "Release notes",
    actions,
    children: <button type="button">Release notes</button>,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A list row whose actions reveal the way Mail's do: swipe it toward its leading edge with touch, pen, a mouse, or a two-finger trackpad swipe, or open them from the keyboard. SwipeRowGroup around the list keeps one row open at a time and speaks confirmation prompts. The row's own focusable element is its child and keeps its own semantics.",
      },
    },
  },
} satisfies Meta<typeof SwipeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sends horizontal wheel deltas to an element, as a trackpad would. */
function wheel(target: HTMLElement, deltas: readonly number[]) {
  return deltas.map((deltaX) => {
    const event = new WheelEvent("wheel", {
      deltaX,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  });
}

function rowOf(content: HTMLElement) {
  return content.closest<HTMLElement>("[data-slot=swipe-row]")!;
}

/** The row has settled closed and carries no transform. */
/**
 * Drags an element sideways with the mouse, `dx` pixels in 10 px moves,
 * and lets go: a drag ends with a real release, so it may commit.
 */
function drag(target: HTMLElement, dx: number, pointerId = 21) {
  const box = target.getBoundingClientRect();
  const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
  const mouse = { pointerId, pointerType: "mouse", isPrimary: true };
  fireEvent.pointerDown(target, { ...mouse, button: 0, buttons: 1, clientX: x, clientY: y });
  const steps = Math.ceil(Math.abs(dx) / 10);
  for (let step = 1; step <= steps; step += 1) {
    fireEvent.pointerMove(target, {
      ...mouse,
      buttons: 1,
      clientX: x + (dx * step) / steps,
      clientY: y,
    });
  }
  fireEvent.pointerUp(target, { ...mouse, button: 0, clientX: x + dx, clientY: y });
}

async function expectClosed(content: HTMLElement) {
  // The settle runs on the motion token and ends on its transition, which
  // a loaded runner can hold past waitFor's default second.
  await waitFor(() => expect(rowOf(content)).not.toHaveAttribute("data-swipe"), {
    timeout: 5000,
  });
  await expect(content.style.translate).toBe("");
  await waitFor(() => expect(getComputedStyle(content).translate).toBe("none"));
}

export const ArchiveAndDelete: Story = {
  parameters: storyDocumentation(
    "A plain list whose rows reveal Archive and Delete. A two-finger trackpad swipe, a drag, or ContextMenu / Shift+F10 opens a row; a drag past 60% of the row archives it as it slides out. A trackpad swipe never archives: it opens the row at most. Delete is destructive: it never runs from a swipe, and pressing it asks to be confirmed first.",
  ),
  render: () => <ListExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return;
    const canvas = within(canvasElement);
    const log = canvas.getByRole("status", { name: "Events" });
    const notes = canvas.getByRole("button", { name: /^release notes/i });

    // A two-finger swipe opens the row: every sideways event is claimed, and
    // the row rests open once the fingers stop.
    const opening = wheel(notes, [40, 40, 40]);
    await expect(opening.every((event) => event.defaultPrevented)).toBe(true);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    await expect(
      canvas.getByRole("group", { name: "Actions for Release notes" }),
    ).toBeVisible();
    await expect(notes.style.translate).not.toBe("");
    // The swipe did not open the item underneath.
    await expect(log).toHaveTextContent("");

    // Delete asks for confirmation, and the prompt is spoken.
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete Release notes" }),
    );
    const confirm = canvas.getByRole("button", {
      name: "Confirm: Delete Release notes",
    });
    await expect(confirm).toHaveTextContent("Confirm");
    await expect(
      canvasElement.querySelector("[data-slot=swipe-row-group-status]"),
    ).toHaveTextContent("Confirm: Delete Release notes");
    await expect(log).toHaveTextContent("");
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: /^release notes/i }),
      ).not.toBeInTheDocument(),
    );
    await expect(log).toHaveTextContent("delete:notes");

    // A long two-finger swipe opens the row and no more; a drag past 60% of
    // the row archives it as it slides out, and the host removes the row.
    const audit = canvas.getByRole("button", { name: /^repo audit/i });
    wheel(audit, [
      3,
      6,
      9,
      ...Array.from({ length: 30 }, (_, index) => (index % 2 ? 9 : 11)),
    ]);
    await waitFor(() =>
      expect(rowOf(audit)).toHaveAttribute("data-swipe", "open"),
    );
    await expect(rowOf(audit)).not.toHaveAttribute("data-armed");
    await expect(log).toHaveTextContent("delete:notes");
    await closeWithEscape(audit);
    drag(audit, -Math.round(rowOf(audit).getBoundingClientRect().width * 0.9));
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: /^repo audit/i }),
      ).not.toBeInTheDocument(),
    );
    await expect(log).toHaveTextContent("delete:notes, archive:audit");

    // From the keyboard: Shift+F10 opens the actions on the first one, and
    // Escape closes them and returns focus.
    const tokens = canvas.getByRole("button", { name: /^motion token audit/i });
    tokens.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Archive Motion token audit" }),
      ).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    await expect(tokens).toHaveFocus();
    await expectClosed(tokens);

    // Nothing is left displaced or waiting to settle.
    for (const item of within(
      canvas.getByRole("list", { name: "Inbox" }),
    ).getAllByRole("button")) {
      await expectClosed(item);
    }
  },
};

export const DesktopHost: Story = {
  parameters: storyDocumentation(
    "`mouseDrag={false}` and `openOnContextMenu={false}`, for a host whose rows are listbox options it drags with the mouse and gives its own context menu. A mouse press starts nothing and a right-click reaches the host untouched; a two-finger trackpad swipe still reveals the actions.",
  ),
  render: () => <ListExample host />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return;
    const canvas = within(canvasElement);
    const log = canvas.getByRole("status", { name: "Events" });
    const notes = canvas.getByRole("option", { name: /^release notes/i });

    // A mouse drag is the host's: the row does not move, and the press
    // carries on to the host unprevented.
    const rect = notes.getBoundingClientRect();
    const [x, y] = [rect.left + rect.width / 2, rect.top + rect.height / 2];
    const mouse = { pointerId: 1, pointerType: "mouse", isPrimary: true };
    const press = new PointerEvent("pointerdown", {
      ...mouse,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    });
    notes.dispatchEvent(press);
    await expect(press.defaultPrevented).toBe(false);
    fireEvent.pointerMove(notes, {
      ...mouse,
      buttons: 1,
      clientX: x - 200,
      clientY: y,
    });
    fireEvent.pointerUp(notes, {
      ...mouse,
      button: 0,
      clientX: x - 200,
      clientY: y,
    });
    await expect(rowOf(notes)).not.toHaveAttribute("data-swipe");
    await expect(notes.style.translate).toBe("");

    // A right-click is the host's context menu, not the row's actions.
    fireEvent.contextMenu(notes);
    await expect(log).toHaveTextContent("menu:notes");
    await expect(
      canvas.queryByRole("group", { name: "Actions for Release notes" }),
    ).not.toBeInTheDocument();
    await expect(rowOf(notes)).not.toHaveAttribute("data-swipe");
    await expect(notes).not.toHaveAttribute("aria-keyshortcuts");

    // A two-finger trackpad swipe still opens the row.
    wheel(notes, [40, 40, 40]);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    // Pressing the open row with the mouse closes it.
    notes.dispatchEvent(
      new PointerEvent("pointerdown", {
        ...mouse,
        button: 0,
        buttons: 1,
        bubbles: true,
      }),
    );
    await expectClosed(notes);
    await expect(log).toHaveTextContent(/^menu:notes$/);

    // Open, the tray is a pointer surface only: the host's context menu is
    // the keyboard and assistive-technology route to the same actions, so
    // no group of buttons appears inside the listbox and focus stays out.
    // The story ends here, open and settled, so the accessibility check
    // that runs after it sees the listbox with a tray showing.
    notes.focus();
    wheel(notes, [40, 40, 40]);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    const tray = rowOf(notes).querySelector<HTMLElement>(
      "[data-slot=swipe-row-actions]",
    )!;
    await expect(tray).toHaveAttribute("aria-hidden", "true");
    await expect(
      canvas.queryByRole("group", { name: "Actions for Release notes" }),
    ).toBeNull();
    const trayButtons = Array.from(tray.querySelectorAll("button"));
    await expect(trayButtons).toHaveLength(2);
    for (const button of trayButtons) await expect(button.tabIndex).toBe(-1);
    await expect(notes).toHaveFocus();
    // A press on a pointer-only action leaves focus on the option; it is
    // let go outside the tray, so nothing runs and the row stays open.
    await userEvent.pointer({ keys: "[MouseLeft>]", target: trayButtons[0]! });
    await expect(notes).toHaveFocus();
    await userEvent.pointer({ keys: "[/MouseLeft]", target: log });
    await expect(rowOf(notes)).toHaveAttribute("data-swipe", "open");
    await expect(log).toHaveTextContent(/^menu:notes$/);
  },
};

/** One timed wheel event: its horizontal delta and the gap before it, in ms. */
type TimedWheel = readonly [deltaX: number, gapMs: number];

/**
 * Sends horizontal wheel deltas to an element at the pace a trackpad does,
 * so the row reads them with their real timestamps. A trackpad's events
 * carry the time the hardware made them; a synthetic event carries the time
 * it was sent. So each gap is measured from the previous event: a timer
 * takes most of it and a short wait in place the rest, so a busy machine
 * firing timers late only stretches a gap, never bunches events together.
 */
async function wheelTimed(target: HTMLElement, events: readonly TimedWheel[]) {
  let last = performance.now();
  for (const [deltaX, gap] of events) {
    await new Promise((done) => setTimeout(done, Math.max(0, gap - 4)));
    while (performance.now() < last + gap) {
      // At most a few milliseconds.
    }
    target.dispatchEvent(
      new WheelEvent("wheel", { deltaX, bubbles: true, cancelable: true }),
    );
    last = performance.now();
  }
}

/** Fingers on the trackpad, one delta per 120 Hz frame. */
const fingers = (deltas: readonly number[]): TimedWheel[] =>
  deltas.map((delta) => [delta, 8]);

/** A light two-finger flick: about 90 px of accelerating finger travel. */
const lightFlick = fingers([1, 3, 7, 12, 18, 22, 24]);

/**
 * macOS inertia as WebKit delivers it: whole pixels at 60 Hz, holding a
 * near-flat pace for its first frames and then decaying to nothing.
 */
function inertia(from = 26): TimedWheel[] {
  const plateau = [0, 0, 1, 0, 1, 1, 2, 1, 2, 3, 2, 3, 4, 4, 5, 4, 5, 6];
  const tail: TimedWheel[] = plateau.map((drop, index) => [
    from - drop,
    index ? 16 : 24,
  ]);
  for (let delta = from - 6; delta >= 1; delta = Math.floor(delta * 0.94)) {
    tail.push([delta, 16]);
  }
  return tail;
}

/**
 * Two light flicks as CI runners delivered them to the row, replayed
 * exactly: deltas and the gaps between them, in ms. Their inertia arrived
 * as a long, nearly even plateau, which no reading of the deltas can tell
 * from fingers held on the trackpad (nessa_ui#141, Linux and WebKit).
 */
const ciFlicks: readonly (readonly TimedWheel[])[] = [
  [
  [1, 8], [3, 8], [7, 19], [12, 12], [18, 8], [22, 14], [24, 8], [26, 27],
  [26, 17], [25, 20], [26, 17], [25, 17], [25, 27], [24, 20], [25, 32], [24,
  36], [23, 16], [24, 16], [23, 19], [22, 31], [22, 18], [21, 17], [22, 17],
  [21, 20], [20, 19], [20, 26], [18, 18], [16, 17], [15, 22], [14, 35], [13,
  27], [12, 42], [11, 19], [10, 22], [9, 16], [8, 26], [7, 29], [6, 21], [5,
  18], [4, 16], [3, 17], [2, 18], [1, 16]
  ],
  [
  [1, 8], [3, 8], [7, 19], [12, 8], [18, 14], [22, 9], [24, 8], [26, 24],
  [26, 16], [25, 16], [26, 18], [25, 21], [25, 19], [24, 17], [25, 16], [24,
  16], [23, 16], [24, 16], [23, 16], [22, 18], [22, 17], [21, 16], [22, 18],
  [21, 20], [20, 16], [20, 16], [18, 16], [16, 18], [15, 17]
  ],
];

/** The rows' debug trace (the story's group runs in `debug`). */
function traceEvents(row: HTMLElement): Record<string, unknown>[] {
  const registry = (
    row.ownerDocument.defaultView as unknown as {
      __nessaSwipeRows?: Record<string, { events: Record<string, unknown>[] }>;
    }
  ).__nessaSwipeRows;
  return Object.values(registry ?? {}).flatMap((handle) => handle.events);
}

/**
 * Records whether the row ever armed or committed a full swipe while `run`
 * went on: drawn armed, however briefly, or traced releasing into a commit.
 */
async function watchArmed(row: HTMLElement, run: () => Promise<void>) {
  let armed = row.hasAttribute("data-armed");
  const observer = new MutationObserver(() => {
    armed ||= row.hasAttribute("data-armed");
  });
  observer.observe(row, { attributes: true, attributeFilter: ["data-armed"] });
  const before = traceEvents(row).length;
  try {
    await run();
  } finally {
    observer.disconnect();
  }
  // One gesture runs at a time, so whatever armed meanwhile was this row.
  const seen = traceEvents(row).slice(before);
  lastWatch = JSON.stringify({
    width: Math.round(row.getBoundingClientRect().width),
    trace: seen,
  });
  return (
    armed ||
    seen.some((entry) => entry.ev === "release" && entry.kind === "commit")
  );
}

/** What the last `watchArmed` saw: the row's width and its trace, said when an assertion fails. */
let lastWatch = "";

/** Closes an open row from its content with Escape and waits for it to rest. */
async function closeWithEscape(content: HTMLElement) {
  content.focus();
  await userEvent.keyboard("{Escape}");
  await expectClosed(content);
}

export const TrackpadSwipes: Story = {
  tags: ["cross-engine", "reduced-motion"],
  parameters: storyDocumentation(
    "Two-finger trackpad swipes, sent at a trackpad's pace. A short swipe springs back; a medium one rests open with the tray attached to the row. No trackpad swipe arms or archives — not a light flick whose inertia carries on long after the fingers lift, not the flicks CI runners delivered as a near-even plateau, not a second flick landing on an open row, not a long deliberate drag: browsers cannot tell fingers from inertia, so a trackpad swipe opens the tray at most, and Archive is one press away.",
  ),
  render: () => <ListExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return;
    const canvas = within(canvasElement);
    const log = canvas.getByRole("status", { name: "Events" });
    const notes = canvas.getByRole("button", { name: /^release notes/i });

    // A short, slow nudge springs back and does nothing.
    const nudgeArmed = await watchArmed(rowOf(notes), () =>
      wheelTimed(
        notes,
        [1, 2, 3, 3, 2, 2, 1].map((delta): TimedWheel => [delta, 16]),
      ),
    );
    await expect(nudgeArmed, lastWatch).toBe(false);
    await expectClosed(notes);

    // Inertia alone — a tail left over from a gesture that ended elsewhere,
    // arriving after a pause — never opens, arms, or commits the row.
    await new Promise((done) => setTimeout(done, 200));
    const tailArmed = await watchArmed(rowOf(notes), () =>
      wheelTimed(notes, inertia(22).slice(6)),
    );
    await expect(tailArmed, lastWatch).toBe(false);
    await expectClosed(notes);
    await expect(log).toHaveTextContent("");

    // A light flick: its inertia travels several times the row, yet the
    // row never arms and rests open once the deltas turn out to be inertia.
    const flickArmed = await watchArmed(rowOf(notes), () =>
      wheelTimed(notes, [...lightFlick, ...inertia()]),
    );
    await expect(flickArmed, lastWatch).toBe(false);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    await expect(log).toHaveTextContent("");
    await closeWithEscape(notes);

    // The same flick, its inertia delivered unevenly 30 to 40 ms apart, as a
    // slow machine delivers it: still inertia, still never arms.
    const slowArmed = await watchArmed(rowOf(notes), () =>
      wheelTimed(notes, [
        ...lightFlick,
        ...inertia().map(([delta], index): TimedWheel => [delta, 30 + ((index * 7) % 11)]),
      ]),
    );
    await expect(slowArmed, lastWatch).toBe(false);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    await expect(log).toHaveTextContent("");
    await closeWithEscape(notes);

    // The flicks CI runners delivered, replayed as they arrived: never armed.
    for (const flick of ciFlicks) {
      const ciArmed = await watchArmed(rowOf(notes), () => wheelTimed(notes, flick));
      await expect(ciArmed, lastWatch).toBe(false);
      await waitFor(() =>
        expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
      );
      await expect(log).toHaveTextContent("");
      await closeWithEscape(notes);
    }

    // Two flicks back to back, the second landing while the first's inertia
    // is still arriving: they do not merge into a full swipe.
    const audit = canvas.getByRole("button", { name: /^repo audit/i });
    const backToBackArmed = await watchArmed(rowOf(audit), () =>
      wheelTimed(audit, [
        ...lightFlick,
        ...inertia().slice(0, 10),
        [1, 40],
        ...lightFlick.slice(1),
        ...inertia(),
      ]),
    );
    await expect(backToBackArmed, lastWatch).toBe(false);
    await waitFor(() =>
      expect(rowOf(audit)).toHaveAttribute("data-swipe", "open"),
    );
    await expect(log).toHaveTextContent("");
    await closeWithEscape(audit);

    // A medium, steady swipe rests open, and the tray rides attached to the
    // content's trailing edge: no gap between the row and its actions.
    const tokens = canvas.getByRole("button", { name: /^motion token audit/i });
    await wheelTimed(tokens, fingers([2, 4, 6, 9, 7, 9, 7, 9, 7, 9, 7, 9, 7, 9, 7]));
    await waitFor(() =>
      expect(rowOf(tokens)).toHaveAttribute("data-swipe", "open"),
    );
    const tray = rowOf(tokens).querySelector<HTMLElement>(
      "[data-slot=swipe-row-actions]",
    )!;
    const tiles = Array.from(tray.querySelectorAll("button"));
    await waitFor(() => {
      const contentEdge = tokens.getBoundingClientRect().right;
      const tileEdges = tiles.map((tile) => tile.getBoundingClientRect());
      const leading = Math.min(...tileEdges.map((tile) => tile.left));
      expect(Math.abs(leading - contentEdge)).toBeLessThanOrEqual(1);
      // The tiles meet one another, and reach the row's own edge, where the
      // row clips them.
      const sorted = [...tileEdges].sort((a, b) => a.left - b.left);
      for (const [index, tile] of sorted.slice(1).entries()) {
        expect(Math.abs(tile.left - sorted[index]!.right)).toBeLessThanOrEqual(1);
      }
      expect(sorted.at(-1)!.right).toBeGreaterThanOrEqual(
        rowOf(tokens).getBoundingClientRect().right - 1,
      );
    });
    await expect(log).toHaveTextContent("");
    await closeWithEscape(tokens);

    // Not even a long, deliberate two-finger drag arms Archive: it rests
    // open, held at the tray, and Archive is one press away.
    const panel = canvas.getByRole("button", { name: /^panel layout/i });
    const panelRow = rowOf(panel);
    const deliberateArmed = await watchArmed(panelRow, () =>
      wheelTimed(panel, [
        ...fingers([3, 6, 9]),
        ...Array.from({ length: 44 }, (_, index): TimedWheel => [
          index % 2 ? 9 : 11,
          8,
        ]),
      ]),
    );
    await expect(deliberateArmed, lastWatch).toBe(false);
    await waitFor(() =>
      expect(panelRow).toHaveAttribute("data-swipe", "open"),
    );
    await expect(log).toHaveTextContent("");
    await userEvent.click(
      canvas.getByRole("button", { name: "Archive Panel layout" }),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: /^panel layout/i }),
      ).not.toBeInTheDocument(),
    );
    await expect(log).toHaveTextContent("archive:panel");

    // Nothing is left displaced or waiting to settle.
    for (const item of within(
      canvas.getByRole("list", { name: "Inbox" }),
    ).getAllByRole("button")) {
      await expectClosed(item);
    }
  },
};

function AncestorScrollExample() {
  const [held, setHeld] = React.useState<"both" | "archive" | "none">("both");
  const [suffix, setSuffix] = React.useState("");
  const [keys, setKeys] = React.useState(true);
  const [pressed, setPressed] = React.useState("");
  const [acted, setActed] = React.useState("");
  const shown = {
    both: actions,
    archive: actions.slice(0, 1),
    none: [],
  }[held];
  return (
    <div className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      <div className="flex gap-3 font-sans nessa-text-2 text-foreground">
        <button type="button" onClick={() => setHeld("both")}>
          Both actions
        </button>
        <button type="button" onClick={() => setHeld("archive")}>
          Archive only
        </button>
        <button type="button" onClick={() => setHeld("none")}>
          No actions
        </button>
        <button type="button" onClick={() => setSuffix((now) => `${now}'`)}>
          New ids
        </button>
        <button type="button" onClick={() => setKeys((now) => !now)}>
          {keys ? "Pointer only" : "Keys too"}
        </button>
        <output data-testid="pressed">{pressed}</output>
        <output data-testid="acted">{acted}</output>
        <output data-testid="generation">{suffix.length}</output>
      </div>
      <div
        data-testid="page"
        className="max-h-48 overflow-y-auto rounded-[2rem] bg-background p-4"
      >
        <SwipeRowGroup asChild>
          <ul aria-label="Inbox" className="m-0 flex list-none flex-col p-0">
            {inbox.map((item) => (
              <SwipeRow
                key={item.id}
                as="li"
                value={item.id + suffix}
                name={item.title}
                actions={shown}
                openOnContextMenu={keys}
                onAction={(action, details) =>
                  setActed(
                    `${action} ${item.title} @${suffix.length}${details.hadFocus ? " with focus" : ""}`,
                  )
                }
              >
                <button
                  type="button"
                  onClick={() => setPressed(item.title)}
                  className="w-full rounded-xl border-0 bg-transparent px-3 py-6 text-start font-sans nessa-text-4 text-foreground"
                >
                  {item.title}
                </button>
              </SwipeRow>
            ))}
          </ul>
        </SwipeRowGroup>
      </div>
    </div>
  );
}

export const AncestorScroll: Story = {
  parameters: storyDocumentation(
    "The list does not scroll itself; the page around it does. Scrolling that ancestor moves the open row, so it closes. An open row whose actions or size change is measured again, so its tray fits what it now holds, and an action taken away while focused hands focus to the row.",
  ),
  render: () => <AncestorScrollExample />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.ownerDocument.defaultView?.navigator.webdriver) return;
    const canvas = within(canvasElement);
    const notes = canvas.getByRole("button", { name: /^release notes/i });
    const tray = () =>
      rowOf(notes).querySelector<HTMLElement>("[data-slot=swipe-row-actions]")!;

    wheel(notes, [40, 40, 40]);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    // Each action takes a slot as wide as the row is tall.
    const slot = rowOf(notes).getBoundingClientRect().height;
    // The tray's uncovered strip: how far the content has slid from the
    // row's own edge, in either writing direction.
    const trayWidth = () =>
      Math.abs(
        notes.getBoundingClientRect().left -
          rowOf(notes).getBoundingClientRect().left,
      );
    await waitFor(() =>
      expect(Math.abs(trayWidth() - 2 * slot)).toBeLessThanOrEqual(1),
    );

    // Down to one action while open: the tray narrows to fit it. The host
    // changes them without a press, which would close the row by itself.
    fireEvent.click(canvas.getByRole("button", { name: "Archive only" }));
    await waitFor(() =>
      expect(tray().querySelectorAll("button")).toHaveLength(1),
    );
    await waitFor(() =>
      expect(Math.abs(trayWidth() - slot)).toBeLessThanOrEqual(1),
    );
    await expect(rowOf(notes)).toHaveAttribute("data-swipe", "open");

    // The open row grows taller: its one slot, and so the tray, grow with it.
    notes.style.paddingBlock = "2.5rem";
    const taller = () => rowOf(notes).getBoundingClientRect().height;
    await waitFor(() => expect(taller()).toBeGreaterThan(slot + 10));
    await waitFor(() =>
      expect(Math.abs(trayWidth() - taller())).toBeLessThanOrEqual(1),
    );

    // A locale that flips the writing direction on an ancestor while the
    // row is open, changing nothing in the row itself: the content slides
    // toward the new leading edge, uncovering the tray at the new trailing
    // one.
    const list = canvas.getByRole("list", { name: "Inbox" });
    const before = parseFloat(notes.style.translate);
    await expect(before).toBeLessThan(0);
    // Once the growth above has finished moving anything, so that nothing
    // but the flip itself could have the row measured again.
    await waitFor(() =>
      expect(rowOf(notes).getAnimations({ subtree: true })).toHaveLength(0),
    );
    list.dir = "rtl";
    await waitFor(() =>
      expect(parseFloat(notes.style.translate)).toBeGreaterThan(0),
    );
    list.dir = "ltr";
    await waitFor(() =>
      expect(parseFloat(notes.style.translate)).toBeLessThan(0),
    );

    // A scroll the page makes by itself — here, revealing the tray's
    // confirm button the way WebKit and automation do just before pressing
    // it — leaves the row open and its confirmation standing. The host
    // gives Delete back without a press, which would close the row.
    fireEvent.click(canvas.getByRole("button", { name: "Both actions" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete Release notes" }),
    );
    const confirm = canvas.getByRole("button", {
      name: "Confirm: Delete Release notes",
    });
    // Well after the swipe and the press, so nothing the viewer did is
    // still scrolling.
    await new Promise((done) => setTimeout(done, 1100));
    const page = canvas.getByTestId("page");
    page.scrollTop = 40;
    await waitFor(() => expect(page.scrollTop).toBeGreaterThan(0));
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    await expect(rowOf(notes)).toHaveAttribute("data-swipe", "open");
    await expect(confirm).toBeInTheDocument();
    await expect(confirm).toHaveAccessibleName("Confirm: Delete Release notes");
    // Escape backs out of the confirmation without closing the row.
    confirm.focus();
    await userEvent.keyboard("{Escape}");
    await expect(rowOf(notes)).toHaveAttribute("data-swipe", "open");

    // The viewer scrolling the page around the list from the keyboard, with
    // focus on the row's content, moves the row and closes it.
    notes.focus();
    await userEvent.keyboard("{PageUp}");
    page.scrollTop = 0;
    await waitFor(() => expect(page.scrollTop).toBe(0));
    await expectClosed(notes);

    // So does a wheel.
    wheel(notes, [40, 40, 40]);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    await new Promise((done) => setTimeout(done, 1100));
    page.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, bubbles: true }));
    page.scrollTop = 40;
    await waitFor(() => expect(page.scrollTop).toBeGreaterThan(0));
    await expectClosed(notes);
    page.scrollTop = 0;

    // Actions taken away mid-press let the press go: a drag that carries on
    // past the slop afterwards opens nothing, and once the actions are back
    // the row is still closed.
    const audit = canvas.getByRole("button", { name: /^repo audit/i });
    fireEvent.click(canvas.getByRole("button", { name: "Both actions" }));
    const box = audit.getBoundingClientRect();
    const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
    const mouse = { pointerId: 7, pointerType: "mouse", isPrimary: true };
    fireEvent.pointerDown(audit, {
      ...mouse,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
    });
    fireEvent.pointerMove(audit, {
      ...mouse,
      buttons: 1,
      clientX: x - 2,
      clientY: y,
    });
    fireEvent.click(canvas.getByRole("button", { name: "No actions" }));
    fireEvent.pointerMove(audit, {
      ...mouse,
      buttons: 1,
      clientX: x - 160,
      clientY: y,
    });
    fireEvent.pointerUp(audit, {
      ...mouse,
      button: 0,
      clientX: x - 160,
      clientY: y,
    });
    fireEvent.click(canvas.getByRole("button", { name: "Both actions" }));
    await expectClosed(audit);

    // An action taken away while focus is on it hands focus to the row's
    // content, not to the page: Delete, then the whole tray.
    const actionsOf = () =>
      rowOf(audit).querySelectorAll<HTMLButtonElement>(
        "[data-slot=swipe-row-actions] button",
      );
    audit.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await waitFor(() =>
      expect(rowOf(audit)).toHaveAttribute("data-swipe", "open"),
    );
    await waitFor(() => expect(actionsOf()).toHaveLength(2));
    actionsOf()[1].focus();
    await expect(actionsOf()[1]).toHaveFocus();
    fireEvent.click(canvas.getByRole("button", { name: "Archive only" }));
    await waitFor(() => expect(audit).toHaveFocus());
    actionsOf()[0].focus();
    await expect(actionsOf()[0]).toHaveFocus();
    fireEvent.click(canvas.getByRole("button", { name: "No actions" }));
    await waitFor(() => expect(audit).toHaveFocus());
    // The row it was open on renders its content untouched: no slide left.
    await waitFor(() => expect(audit.style.translate).toBe(""));
    fireEvent.click(canvas.getByRole("button", { name: "Both actions" }));
    await expectClosed(audit);

    // A row given a new value mid-swipe is still the same row: the group no
    // longer holds it open under its old value, so its swipe comes to rest
    // closed, not stuck where the gesture was.
    wheel(audit, [40, 40, 40]);
    fireEvent.click(canvas.getByRole("button", { name: "New ids" }));
    await expectClosed(audit);

    // A press under the slop when the value changes lets the press go: the
    // drag that carries on past the slop opens nothing under the old value,
    // so the next press in the list is the list's, not an outside press.
    const pressBox = audit.getBoundingClientRect();
    const [px, py] = [
      pressBox.left + pressBox.width / 2,
      pressBox.top + pressBox.height / 2,
    ];
    fireEvent.pointerDown(audit, {
      ...mouse,
      button: 0,
      buttons: 1,
      clientX: px,
      clientY: py,
    });
    fireEvent.pointerMove(audit, {
      ...mouse,
      buttons: 1,
      clientX: px - 2,
      clientY: py,
    });
    fireEvent.click(canvas.getByRole("button", { name: "New ids" }));
    fireEvent.pointerMove(audit, {
      ...mouse,
      buttons: 1,
      clientX: px - 160,
      clientY: py,
    });
    fireEvent.pointerUp(audit, {
      ...mouse,
      button: 0,
      clientX: px - 160,
      clientY: py,
    });
    await expectClosed(audit);
    await userEvent.click(notes);
    await waitFor(() =>
      expect(canvas.getByTestId("pressed")).toHaveTextContent("Release notes"),
    );

    // A tray made the pointer's alone while an action holds focus gives
    // focus to the content before it hides.
    audit.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await waitFor(() => expect(actionsOf()[0]).toHaveFocus());
    fireEvent.click(canvas.getByRole("button", { name: "Pointer only" }));
    await waitFor(() => expect(audit).toHaveFocus());
    fireEvent.click(canvas.getByRole("button", { name: "Keys too" }));
    await userEvent.keyboard("{Escape}");
    await expectClosed(audit);

    // A row opened from the keyboard whose value changes closes, and the
    // action that held focus hands it to the content.
    audit.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await waitFor(() => expect(actionsOf()[0]).toHaveFocus());
    fireEvent.click(canvas.getByRole("button", { name: "New ids" }));
    await waitFor(() => expect(audit).toHaveFocus());
    await expectClosed(audit);

    // A full swipe already chosen is owed though the value changes while
    // the row slides out.
    drag(audit, -Math.round(rowOf(audit).getBoundingClientRect().width * 0.9));
    await waitFor(() =>
      expect(rowOf(audit)).toHaveAttribute("data-swipe", "committing"),
    );
    // It goes to the callback of the row it was chosen on, not the one the
    // row's new value brings.
    const chosenOn = canvas.getByTestId("generation").textContent;
    fireEvent.click(canvas.getByRole("button", { name: "New ids" }));
    await waitFor(() =>
      expect(canvas.getByTestId("acted")).toHaveTextContent(
        new RegExp(`^archive Repo audit @${chosenOn}$`),
      ),
    );
    await expectClosed(audit);

    // A tray sliding shut takes no focus: a quick Tab cannot land in it.
    audit.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await waitFor(() => expect(actionsOf()[0]).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await expect(audit).toHaveFocus();
    await expect(actionsOf()).toHaveLength(2);
    for (const button of actionsOf()) {
      button.focus();
      await expect(button).not.toHaveFocus();
    }
    await expectClosed(audit);

    // A press that does not focus its button, with focus elsewhere on the
    // page, says the row did not hold focus.
    wheel(notes, [40, 40, 40]);
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    const outside = canvas.getByRole("button", { name: "New ids" });
    outside.focus();
    canvas.getByRole("button", { name: /^archive release notes$/i }).click();
    await waitFor(() =>
      expect(canvas.getByTestId("acted")).toHaveTextContent(
        /^archive Release notes @\d+$/,
      ),
    );
    await expect(outside).toHaveFocus();
    await expectClosed(notes);

    // What changes while the row slides open is measured once it rests: a
    // later look at the row finds nothing left to correct.
    wheel(notes, [40, 40, 40]);
    await waitFor(() => expect(rowOf(notes)).toHaveAttribute("data-swipe"));
    const padding = notes.style.paddingBlock;
    notes.style.paddingBlock = "3.5rem";
    await waitFor(() =>
      expect(rowOf(notes)).toHaveAttribute("data-swipe", "open"),
    );
    const rested = notes.style.translate;
    await expect(parseFloat(rested)).toBeLessThan(0);
    notes.dataset.looked = "again";
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    await expect(notes.style.translate).toBe(rested);
    notes.style.paddingBlock = padding;
    delete notes.dataset.looked;
    await userEvent.click(canvas.getByRole("button", { name: "Both actions" }));
    await expectClosed(notes);
  },
};
