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
async function expectClosed(content: HTMLElement) {
  await waitFor(() => expect(rowOf(content)).not.toHaveAttribute("data-swipe"));
  await expect(content.style.translate).toBe("");
  await waitFor(() => expect(getComputedStyle(content).translate).toBe("none"));
}

export const ArchiveAndDelete: Story = {
  parameters: storyDocumentation(
    "A plain list whose rows reveal Archive and Delete. A two-finger trackpad swipe, a drag, or ContextMenu / Shift+F10 opens a row; a long deliberate swipe past 60% of the row archives it as it slides out. Delete is destructive: it never runs from a swipe, and pressing it asks to be confirmed first.",
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

    // A long, deliberate two-finger drag arms Archive and commits it when
    // the fingers stop; the host removes the row.
    const audit = canvas.getByRole("button", { name: /^repo audit/i });
    wheel(audit, [
      3,
      6,
      9,
      ...Array.from({ length: 30 }, (_, index) => (index % 2 ? 9 : 11)),
    ]);
    await waitFor(() => expect(rowOf(audit)).toHaveAttribute("data-armed"));
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
    const trayWidth = () => tray().getBoundingClientRect().width;
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

    // Scrolling the page around the list closes the row.
    const page = canvas.getByTestId("page");
    page.scrollTop = 40;
    await waitFor(() => expect(page.scrollTop).toBeGreaterThan(0));
    await expectClosed(notes);

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
    wheel(audit, [
      3,
      6,
      9,
      ...Array.from({ length: 30 }, (_, at) => (at % 2 ? 9 : 11)),
    ]);
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
