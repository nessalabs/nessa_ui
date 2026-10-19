"use client";

import * as React from "react";
import { Slot } from "radix-ui";

import { composeEventHandler, useComposedRefs } from "@/lib/compose";
import { observeSize } from "@/lib/size-observer";
import { cn } from "@/lib/utils";
import {
  actionNeedsConfirm,
  clampSwipeDisplacement,
  committableSwipeAction,
  presentedSwipeDisplacement,
  resolveSwipeAxis,
  settleSwipe,
  settleWheelSwipe,
  startWheelSwipe,
  stepWheelSwipe,
  swipeArmed,
  swipeDisplacement,
  swipeGeometry,
  swipeContentOpacity,
  swipeVelocity,
  wheelDeltaInPixels,
  wheelSwipeDisplacement,
  wheelSwipeIdleMs,
  type SwipeAxis,
  type SwipeCommitCandidate,
  type SwipeDirection,
  type SwipeGeometry,
  type SwipeRelease,
  type SwipeSample,
  type WheelSwipeTrack,
} from "./conversation-history-swipe";
import {
  SwipeRowGroupContext,
  type RowHandle,
  type SwipeRowGroupContextValue,
  type SwipeRowStore,
  type SwipeRowTraceEntry,
  type Trace,
} from "./swipe-row-context";

/** What a custom action face is drawn for. */
export interface SwipeRowActionState {
  /** The action is waiting for its confirming second press. */
  confirming: boolean;
  /** A full swipe past the commit threshold will run this action on release. */
  armed: boolean;
}

/** One action a row reveals when it is swiped or opened from the keyboard. */
export interface SwipeRowAction {
  /** Reported to `onAction`. Unique within one row's actions. */
  id: string;
  /**
   * The visible label. The action's accessible name is this label followed
   * by the row's `name` — "Archive Release notes" — so a list of identical
   * buttons still says which row each one acts on.
   */
  label: string;
  /** A decorative icon drawn above the label. */
  icon?: React.ReactNode;
  /**
   * `destructive` marks the action with the destructive token — a light
   * wash and a destructive icon, deepening while it asks to be confirmed.
   * A destructive action is never committed by a full swipe, even when it
   * comes first, and asks for confirmation unless `confirm` says otherwise.
   */
  tone?: SwipeCommitCandidate["tone"];
  /**
   * Whether pressing the action first asks for confirmation: the action
   * grows to fill the tray and reads `confirmLabel`, and only a second press
   * runs it. Escape, closing the row, or pressing elsewhere backs out.
   * Defaults to `true` for destructive actions and `false` otherwise. An
   * action that confirms never commits from a full swipe.
   */
  confirm?: boolean;
  /** The visible label while confirming. Defaults to "Confirm". */
  confirmLabel?: string;
  /**
   * Draws the action's content in place of the default icon and label.
   * The button, its colors, sizing, confirmation, and accessible name stay
   * the row's, so a custom face cannot lose the behavior. The content sits
   * inside a button, so it must not be interactive, and its visible text
   * should start with `label` (or `confirmLabel` while confirming) so the
   * words on screen are the words that name the button.
   */
  render?: (state: SwipeRowActionState) => React.ReactNode;
}

/** How an action reached the host. */
export interface SwipeRowActionDetails {
  /**
   * Whether focus was inside the row when the action ran — the host that
   * removes the row in response should move focus somewhere sensible.
   */
  hadFocus: boolean;
  /** A pressed (and, where asked, confirmed) button, or a full swipe. */
  via: "press" | "swipe";
}

/** How many trace entries the ring buffer keeps. */
const traceLimit = 4000;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Returns the live, server-safe reduced-motion preference. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

function createSwipeRowStore(traceRef: React.RefObject<Trace>): SwipeRowStore {
  let openId: string | null = null;
  const rows = new Map<string, RowHandle>();
  let active = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const setOpenId = (next: string | null) => {
    if (next === openId) return;
    openId = next;
    notify();
  };
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    openId: () => openId,
    active: () => active,
    setOpen: (value, open) => {
      traceRef.current?.({ ev: "open", row: value, open });
      setOpenId(open ? value : openId === value ? null : openId);
    },
    close: () => setOpenId(null),
    // Rows come and go by the thousand when a host refilters; only a change
    // someone reads is announced: the group becoming active or idle, or the
    // open row leaving.
    register: (value, handle) => {
      rows.set(value, handle);
      if (!active) {
        active = true;
        notify();
      }
      return () => {
        if (rows.get(value) === handle) rows.delete(value);
        const wasActive = active;
        active = rows.size > 0;
        // A row that leaves — unmounted, or its actions taken away — gives
        // up the open slot with it.
        const freed = openId === value;
        if (freed) openId = null;
        if (freed || active !== wasActive) notify();
      };
    },
    rows: () => rows,
  };
}

export interface SwipeRowGroupProps extends React.HTMLAttributes<HTMLElement> {
  ref?: React.Ref<HTMLElement>;
  /**
   * Merges the group's behavior into its single child instead of rendering
   * a `div` — put it around the list or scroll container the host already
   * has. The child must forward its ref and DOM props.
   */
  asChild?: boolean;
  /**
   * Names the group's parts: its status region is `<data-slot>-status`.
   * Defaults to `swipe-row-group`. Written on the group's own `div`; with
   * `asChild`, the host's element keeps its own `data-slot`.
   */
  "data-slot"?: string;
  /**
   * Development tooling: records row presses, axis decisions, drag samples,
   * trackpad inertia (`coast`, `resume`), releases, settles, confirmations,
   * and actions into a ring buffer published at
   * `window[debugGlobal][<instance id>]`, with a `snapshot()` of every row's
   * swipe state — so a gesture glitch can be reproduced once and read back
   * as data. No-op unless set.
   */
  debug?: boolean;
  /** The `window` property `debug` publishes under. Defaults to `__nessaSwipeRows`. */
  debugGlobal?: string;
  /**
   * Declares that the group's rows have actions, so its status region, its
   * listeners, and its overscroll containment are in place for the group's
   * whole life — on the server, and while it holds no rows at all (a search
   * that emptied the list). Without it they arrive with the first row that
   * has actions and leave with the last.
   */
  hasActions?: boolean;
}

/**
 * The list that owns a set of `SwipeRow`s: it decides which single row is
 * open. Opening a row closes the one that was open; a press anywhere outside
 * the open row, or a scroll that moves it, closes it, and a press inside the
 * group that closed a row is spent on closing — its click selects nothing.
 * It also owns the polite status region rows speak their confirmation
 * prompts through, rendered as the group element's next sibling so the
 * element's children stay exactly the host's (a `ul` keeps only `li`s).
 *
 * The group adds nothing — no listeners, no class, no status region — until
 * a row inside it has actions, or `hasActions` says they will. Then it marks
 * its element
 * `overscroll-x-contain`, so a sideways swipe that outruns a row cannot
 * become history navigation.
 */
function SwipeRowGroup({
  asChild = false,
  debug = false,
  debugGlobal = "__nessaSwipeRows",
  hasActions = false,
  "data-slot": slot = "swipe-row-group",
  className,
  children,
  ref,
  onClickCapture,
  onKeyDownCapture,
  ...props
}: SwipeRowGroupProps) {
  const instanceId = React.useId();
  const reducedMotion = useReducedMotion();

  // Dev-only event ring buffer. `trace` is null unless `debug`, so every
  // call site is one optional call and the production cost is nil.
  const traceBufferRef = React.useRef<SwipeRowTraceEntry[]>([]);
  const trace = React.useMemo<Trace>(
    () =>
      debug
        ? (entry) => {
            const buffer = traceBufferRef.current;
            buffer.push({ t: Math.round(performance.now()), ...entry });
            if (buffer.length > traceLimit)
              buffer.splice(0, buffer.length - traceLimit);
          }
        : null,
    [debug],
  );
  const traceRef = React.useRef<Trace>(trace);
  React.useLayoutEffect(() => {
    traceRef.current = trace;
  });
  const [store] = React.useState(() => createSwipeRowStore(traceRef));
  const rowsHaveActions = React.useSyncExternalStore(
    store.subscribe,
    store.active,
    () => false,
  );
  const active = hasActions || rowsHaveActions;

  // What the live region says; rows set it when an action asks to be
  // confirmed and clear it when that is resolved.
  const [announcement, setAnnouncement] = React.useState("");
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const composedRef = useComposedRefs(ref, setElement);
  // A press that closed an open row is spent on closing it: the click it
  // produces must not select whichever row it landed on.
  const swallowClickRef = React.useRef(false);

  const context = React.useMemo<SwipeRowGroupContextValue>(
    () => ({ store, trace, reducedMotion, announce: setAnnouncement }),
    [reducedMotion, store, trace],
  );

  React.useEffect(() => {
    if (!debug) return;
    const host = window as unknown as Record<
      string,
      Record<string, unknown> | undefined
    >;
    const registry = (host[debugGlobal] ??= {});
    registry[instanceId] = {
      events: traceBufferRef.current,
      snapshot: () => {
        const rows = Array.from(store.rows(), ([id, handle]) => ({
          id,
          element: handle.row(),
          content: handle.content(),
        }))
          .filter((row) => row.element !== null)
          .sort((a, b) =>
            a.element!.compareDocumentPosition(b.element!) &
            Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
          );
        return {
          openRowId: store.openId(),
          rows: rows.map((row) => ({
            id: row.id,
            swipe: row.element!.getAttribute("data-swipe"),
            armed: row.element!.hasAttribute("data-armed"),
            translate: row.content?.style.translate ?? "",
          })),
          // The rows' own document, which may be an iframe's.
          focused:
            (
              rows[0]?.element?.ownerDocument ?? document
            ).activeElement?.getAttribute("aria-label") ?? null,
        };
      },
    };
    return () => {
      delete host[debugGlobal]?.[instanceId];
    };
  }, [debug, debugGlobal, instanceId, store]);

  // A press outside the open row closes it. The group's own document
  // listens, so a list portalled into another one (an iframe) is heard.
  React.useEffect(() => {
    if (!active || !element) return;
    const ownerDocument = element.ownerDocument;
    const onPointerDown = (event: PointerEvent) => {
      const openId = store.openId();
      const target = eventNode(event, ownerDocument);
      const openRow = openId === null ? null : store.rows().get(openId)?.row();
      if (openId === null || (target && openRow?.contains(target))) {
        // The open row handles presses on itself: a tap closes it, a drag
        // moves it, and its action buttons run.
        swallowClickRef.current = false;
        return;
      }
      swallowClickRef.current = Boolean(target && element.contains(target));
      traceRef.current?.({ ev: "outside", closed: openId });
      store.close();
    };
    ownerDocument.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
  }, [active, element, store]);

  // A scroll that moves the open row closes it, wherever the scroller is:
  // the group itself, an ancestor or the page. Scroll events never reach
  // the scroller's descendants, so the document listens in the capture
  // phase. Scrolls inside the row — a browser revealing a focused action in
  // its clipped tray — do not close it.
  React.useEffect(() => {
    if (!active || !element) return;
    const ownerDocument = element.ownerDocument;
    const onScroll = (event: Event) => {
      const openId = store.openId();
      if (openId === null) return;
      const openRow = store.rows().get(openId)?.row();
      const target = eventNode(event, ownerDocument);
      if (!openRow || !target) return;
      if (openRow.contains(target) || !target.contains(openRow)) return;
      store.close();
    };
    ownerDocument.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      ownerDocument.removeEventListener("scroll", onScroll, { capture: true });
  }, [active, element, store]);

  const Comp = asChild ? Slot.Root : "div";
  return (
    <SwipeRowGroupContext.Provider value={context}>
      <Comp
        {...props}
        ref={composedRef}
        data-slot={asChild ? undefined : slot}
        className={cn(active && "overscroll-x-contain", className) || undefined}
        onKeyDownCapture={
          active
            ? composeEventHandler(onKeyDownCapture, () => {
                swallowClickRef.current = false;
              })
            : onKeyDownCapture
        }
        onClickCapture={
          active
            ? composeEventHandler(onClickCapture, (event) => {
                if (!swallowClickRef.current) return;
                swallowClickRef.current = false;
                event.preventDefault();
                event.stopPropagation();
              })
            : onClickCapture
        }
      >
        {children}
      </Comp>
      {active ? (
        // Mounted with the group (or its first row that has actions) and
        // empty until a row
        // has something to say, so assistive technology is already
        // listening when it speaks.
        <span role="status" data-slot={`${slot}-status`} className="sr-only">
          {announcement}
        </span>
      ) : null}
    </SwipeRowGroupContext.Provider>
  );
}

/**
 * A CSS time in milliseconds, or `null` when the value is not one. A bare
 * number is rejected: CSS requires a unit.
 */
function parseCssTime(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (trimmed.endsWith("ms")) return parsed;
  if (trimmed.endsWith("s")) return parsed * 1000;
  return null;
}

/**
 * How long a row takes to settle, read from the motion token the row's own
 * transition uses, so the wait and the movement agree — including the zero
 * the theme substitutes under reduced motion. A missing token makes the
 * transition invalid, which CSS treats as none, so it reads as zero too.
 */
function rowSettleDurationMs(row: Element) {
  const value = getComputedStyle(row).getPropertyValue(
    "--nessa-motion-duration-normal",
  );
  return parseCssTime(value) ?? 0;
}

/**
 * The node an event is aimed at, checked against its own document's realm:
 * a list portalled into an iframe gets that frame's nodes, which the outer
 * window's `Node` does not recognize.
 */
function eventNode(event: Event, ownerDocument: Document): Node | null {
  const NodeOfDocument = ownerDocument.defaultView?.Node ?? Node;
  return event.target instanceof NodeOfDocument ? event.target : null;
}

interface RowMeasurement {
  geometry: SwipeGeometry;
  direction: SwipeDirection;
}

/** The row's swipe geometry and writing direction, measured now. */
function measureRow(row: HTMLElement, actionCount: number): RowMeasurement {
  const { width, height } = row.getBoundingClientRect();
  return {
    geometry: swipeGeometry(width, height, actionCount),
    direction: getComputedStyle(row).direction === "rtl" ? "rtl" : "ltr",
  };
}

/**
 * How long a still touch or pen press takes to open a row's actions. A swipe
 * is a path gesture; this is the single-point way in for anyone who cannot
 * make one, including touch screen readers passing a double-tap-and-hold.
 */
const longPressMs = 500;

/** How many recent positions a pointer swipe keeps for its release speed. */
const swipeSampleLimit = 8;

/** The row's settle motion, shared by the row, its tray, and the tray's contents. */
const settleTransitionClassName =
  "[transition-duration:var(--nessa-motion-duration-normal)] [transition-timing-function:var(--nessa-motion-easing-standard)]";

// `outline-none` resets Tailwind's outline style to none, which the width
// utility would otherwise inherit and draw nothing; restore it on focus.
const actionFocusClassName =
  "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type SwipePhase = "tracking" | "settling" | "committing";

interface SwipeState {
  phase: SwipePhase;
  /** Displacement toward the leading edge, in pixels. */
  displacement: number;
  /**
   * The displacement a release here is judged at, when that is not where the
   * row is drawn: a wheel swipe is drawn where its deltas put it but judged
   * where the fingers left it, so inertia never arms or commits a row.
   */
  reach?: number;
}

interface PointerSwipe {
  pointerId: number;
  originX: number;
  originY: number;
  axis: SwipeAxis;
  /** The displacement the row had when the press landed. */
  start: number;
  /** Whether the row was open at the press, so a tap on it closes it. */
  wasOpen: boolean;
  geometry: SwipeGeometry;
  direction: SwipeDirection;
  samples: SwipeSample[];
}

interface WheelSwipe {
  /** Decided once the summed deltas cross the same slop a pointer uses. */
  axis: SwipeAxis;
  /** Summed pixel deltas while the axis is still undecided. */
  dx: number;
  dy: number;
  /**
   * The last horizontal delta while the axis was undecided, and whether
   * those deltas ever grew — so a gesture that is only inertia left over
   * from an earlier one is known as such from its first events.
   */
  pendingDelta: number;
  pendingGrew: boolean;
  /** The displacement the row had when the axis was decided. */
  start: number;
  /** The fingers' travel and the inertia's since then. */
  track: WheelSwipeTrack | null;
  geometry: SwipeGeometry | null;
  direction: SwipeDirection;
  /** When the last event of the gesture arrived, from `performance.now()`. */
  last: number;
}

const noOpenStore = () => () => {};
const closed = () => false;

/** The props a row merges into its content element. */
interface SwipeRowContentProps {
  ref?: React.Ref<HTMLElement>;
  className?: string;
  style?: React.CSSProperties;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  "aria-keyshortcuts"?: string;
}

export interface SwipeRowProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "children"
> {
  ref?: React.Ref<HTMLElement>;
  /** The wrapper element: `li` inside a `ul`, `div` (the default) elsewhere. */
  as?: "div" | "li";
  /**
   * Names the wrapper and, after it, its parts: the tray is
   * `<data-slot>-actions` and each action `<data-slot>-action`. Defaults to
   * `swipe-row`.
   */
  "data-slot"?: string;
  /**
   * Identifies the row within its group, which keeps one row open at a
   * time. Unique within the group.
   */
  value: string;
  /**
   * What the row is called in its actions' accessible names — "Archive
   * Release notes" — and in its tray's, "Actions for Release notes".
   */
  name: string;
  /**
   * The actions the row reveals, primary first. A row given no actions does
   * not swipe and renders its content untouched. Rows redraw when their
   * action objects change, so define each one once (outside render).
   */
  actions: readonly SwipeRowAction[];
  /**
   * Fires with the chosen action's id, from a pressed (and, where asked,
   * confirmed) action button or from a full swipe committing the primary
   * action — the latter once the row has slid out, even when the host
   * unmounted it mid-slide. The row stores nothing: removing or archiving
   * the item is the host's job.
   */
  onAction?: (actionId: string, details: SwipeRowActionDetails) => void;
  /**
   * Whether a mouse drag swipes the row. Defaults to `true`. Pass `false`
   * when a mouse drag on the row means something else to the host (dragging
   * it somewhere): a mouse press then starts nothing — no listeners, no
   * capture, no default prevented — except that pressing an open row,
   * outside its actions, closes it without its click selecting anything.
   * Trackpad two-finger swipes, touch, and pen still swipe.
   */
  mouseDrag?: boolean;
  /**
   * Whether the context-menu gesture — a right-click, the ContextMenu key,
   * or Shift+F10 — opens the row's actions. Defaults to `true`. Pass `false`
   * when the host shows its own context menu: the row then leaves the
   * `contextmenu` event and those keys entirely to the host, which owns the
   * keyboard and assistive-technology path to the same actions (offering
   * them in that menu, say). The revealed tray is then a pointer surface
   * only: it is `aria-hidden`, its buttons are out of the tab order and do
   * not take focus when pressed, and nothing moves focus into it — so a row
   * inside a `listbox` never puts a group of buttons inside the listbox.
   * A touch or pen long-press still opens the actions.
   */
  openOnContextMenu?: boolean;
  /**
   * The row's own focusable element — its button, option, or link. It
   * receives the slide (`translate`, a transition on `color`,
   * `background-color` and `translate`, merged over its own classes), the
   * row's keyboard handling (run after its own `onKeyDown`, skipped when
   * that prevents the default), `aria-keyshortcuts`, and the focus the row
   * returns when its actions close. It must forward its ref and these props.
   */
  children: React.ReactElement<SwipeRowContentProps>;
}

/**
 * One row whose actions reveal the way Mail's do, inside a `SwipeRowGroup`.
 * Swiping the row toward its leading edge — a touch or pen drag, a mouse
 * drag, or a two-finger horizontal trackpad swipe — slides its content and
 * uncovers the actions on the trailing edge; they ride in with the row at
 * full size and their labels fade in as they arrive. Let go past half the
 * tray and the row rests open; short of that it springs back. Swipe on past
 * at least 60% of the row (further when the tray is wide) and the primary
 * (first) action fills the tray; letting go there commits it as the row
 * slides out. On a trackpad only the fingers' own travel counts toward that:
 * the inertia that follows a flick can carry a row open, never into a
 * commit. A touch or pen long-press opens the actions without a swipe. A tap
 * on the open row closes it without selecting anything, and a swipe never
 * clicks the content it moves. A gesture that sets off vertically stays a
 * scroll.
 *
 * **Confirmation.** A destructive action — or any action with `confirm` —
 * does not run on its first press: it grows to fill the tray and reads
 * "Confirm" (`confirmLabel`), and a second press runs it. Escape, closing
 * the row, or pressing elsewhere backs out. A destructive action never
 * commits from a swipe, even when it is first; the row rests open instead.
 * The prompt is also spoken through the group's status region.
 *
 * **Keyboard.** Every action is a real button. On the focused content the
 * ContextMenu key or Shift+F10 opens the actions and focuses the first (a
 * right-click opens them the same way); Tab moves between them and Enter or
 * Space runs one (or asks to confirm it). Escape backs out of a
 * confirmation, then closes the actions and returns focus to the content;
 * tabbing out of the row closes them too.
 *
 * **Motion.** Settling runs on the motion tokens. Under reduced motion the
 * row does not slide: it jumps between closed and open as the gesture
 * crosses the same thresholds, and every action still works. A closed row
 * carries no transform.
 *
 * The wrapper carries `data-swipe` (`tracking`, `settling`,
 * `committing`, or `open`) while it is anything but closed, and
 * `data-armed` while a release would commit.
 */
function SwipeRow({
  as: Wrapper = "div",
  value: id,
  name,
  actions,
  onAction,
  mouseDrag = true,
  openOnContextMenu = true,
  children,
  ref,
  "data-slot": slotProp,
  className,
  onPointerDown: onPointerDownProp,
  onContextMenu: onContextMenuProp,
  onClickCapture: onClickCaptureProp,
  onBlur: onBlurProp,
  ...props
}: SwipeRowProps) {
  const slot = slotProp ?? "swipe-row";
  const hasActions = actions.length > 0;
  const committable = committableSwipeAction(actions);
  const group = React.useContext(SwipeRowGroupContext);
  if (hasActions && group === null) {
    throw new Error(
      "A SwipeRow with actions must be rendered inside a SwipeRowGroup.",
    );
  }
  const store = group?.store;
  const open = React.useSyncExternalStore(
    store?.subscribe ?? noOpenStore,
    store ? () => store.openId() === id : closed,
    closed,
  );
  const reducedMotion = group?.reducedMotion ?? false;
  const trace = group?.trace ?? null;
  const onAnnounce = group?.announce;

  const rowRef = React.useRef<HTMLElement>(null);
  const itemRef = React.useRef<HTMLElement>(null);
  const trayRef = React.useRef<HTMLDivElement>(null);
  // The tray action focus is on, until focus moves somewhere else of its
  // own; focus going nowhere is its button being removed.
  const trayFocusRef = React.useRef<HTMLElement | null>(null);
  const composedRowRef = useComposedRefs(ref, rowRef);
  const composedItemRef = useComposedRefs(itemRef, children.props.ref);

  const [swipe, setSwipe] = React.useState<SwipeState | null>(null);
  const [geometry, setGeometry] = React.useState<SwipeGeometry | null>(null);
  const [direction, setDirection] = React.useState<SwipeDirection>("ltr");
  // The action waiting for its confirming second press, if any.
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  /** Makes this row the group's open row, or frees the slot. */
  const onOpenChange = React.useCallback(
    (next: boolean) => store?.setOpen(id, next),
    [id, store],
  );
  const announce = React.useCallback(
    (message: string) => onAnnounce?.(message),
    [onAnnounce],
  );
  /** Reports an action to the host. */
  const act = React.useCallback(
    (actionId: string, details: SwipeRowActionDetails) => {
      latest.current.trace?.({
        ev: "action",
        row: id,
        action: actionId,
        via: details.via,
      });
      latest.current.onAction?.(actionId, details);
    },
    [id],
  );

  // Native listeners and timers read the newest values through refs, so they
  // attach once rather than on every drag step.
  const swipeRef = React.useRef<SwipeState | null>(null);
  const latest = React.useRef({
    actions,
    open,
    onAction,
    trace,
    confirming: false,
  });
  React.useLayoutEffect(() => {
    latest.current = {
      actions,
      open,
      onAction,
      trace,
      confirming: confirmingId !== null,
    };
  });

  const pointerRef = React.useRef<PointerSwipe | null>(null);
  const detachPointerRef = React.useRef<(() => void) | null>(null);
  const wheelRef = React.useRef<WheelSwipe | null>(null);
  const wheelTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const settleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // A press that became a swipe, or a tap that closed an open row, must not
  // also click the content when its click arrives.
  const swallowClickRef = React.useRef(false);
  const focusTrayRef = React.useRef(false);
  // A committed action still owed to the host while the row slides out.
  const pendingCommitRef = React.useRef<string | null>(null);
  const closedByBlurRef = React.useRef(false);

  // The group learns the row exists only while it has actions, so a list of
  // rows without any adds no listeners and no status region.
  React.useLayoutEffect(() => {
    if (!hasActions || !store) return;
    return store.register(id, {
      row: () => rowRef.current,
      content: () => itemRef.current,
    });
  }, [hasActions, id, store]);

  /** Sets the swipe state and the ref native handlers read it through. */
  const showSwipe = React.useCallback((next: SwipeState | null) => {
    swipeRef.current = next;
    setSwipe(next);
  }, []);

  const clearSettleTimer = React.useCallback(() => {
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }, []);

  const clearWheel = React.useCallback(() => {
    if (wheelTimerRef.current !== null) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = null;
    wheelRef.current = null;
  }, []);

  const endPointer = React.useCallback(() => {
    if (longPressTimerRef.current !== null)
      clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    detachPointerRef.current?.();
    detachPointerRef.current = null;
    pointerRef.current = null;
  }, []);

  // A gesture belongs to the row the group knows it as: one whose actions
  // are taken away, or whose value changes, mid-gesture lets the gesture go.
  // A pointer still under the slop, a wheel waiting out its idle time, or a
  // settle in flight would otherwise open a row under a value the group no
  // longer knows.
  const gestureIdRef = React.useRef(id);
  React.useLayoutEffect(() => {
    const sameRow = gestureIdRef.current === id;
    gestureIdRef.current = id;
    if (hasActions && sameRow) return;
    endPointer();
    clearWheel();
    clearSettleTimer();
    pendingCommitRef.current = null;
    if (swipeRef.current) showSwipe(null);
  }, [clearSettleTimer, clearWheel, endPointer, hasActions, id, showSwipe]);

  /**
   * Moves the row to `displacement` on the motion token, then runs `done`.
   * The wait is the token's own duration, so under reduced motion `done`
   * runs at once and nothing is left scheduled.
   */
  const settle = React.useCallback(
    (
      phase: "settling" | "committing",
      displacement: number,
      done: () => void,
    ) => {
      clearSettleTimer();
      showSwipe({ phase, displacement });
      const row = rowRef.current;
      const duration = row ? rowSettleDurationMs(row) : 0;
      latest.current.trace?.({
        ev: "settle",
        row: id,
        phase,
        to: Math.round(displacement),
        ms: duration,
      });
      const finish = () => {
        latest.current.trace?.({ ev: "settled", row: id, phase });
        done();
      };
      if (duration <= 0) {
        finish();
        return;
      }
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        finish();
      }, duration);
    },
    [clearSettleTimer, id, showSwipe],
  );

  /** Whether focus is anywhere inside this row right now. */
  const holdsFocus = React.useCallback(() => {
    const row = rowRef.current;
    return Boolean(row?.contains(row.ownerDocument.activeElement));
  }, []);

  /**
   * Carries out a release: claims or frees this row's place as the single
   * open row, settles it, and for a commit reports the action to the host
   * once the row has slid out.
   */
  const applyRelease = React.useCallback(
    (release: SwipeRelease, measured: SwipeGeometry) => {
      latest.current.trace?.({
        ev: "release",
        row: id,
        kind: release.kind,
        action: release.kind === "commit" ? release.actionId : null,
        at: Math.round(swipeRef.current?.displacement ?? 0),
      });
      if (release.kind === "closed") {
        onOpenChange(false);
        settle("settling", 0, () => showSwipe(null));
      } else if (release.kind === "open") {
        onOpenChange(true);
        settle("settling", measured.openWidth, () => showSwipe(null));
      } else {
        onOpenChange(true);
        pendingCommitRef.current = release.actionId;
        settle("committing", measured.rowWidth, () => {
          pendingCommitRef.current = null;
          showSwipe(null);
          onOpenChange(false);
          act(release.actionId, { hadFocus: holdsFocus(), via: "swipe" });
        });
      }
    },
    [act, holdsFocus, id, onOpenChange, settle, showSwipe],
  );

  /** Settles a release made at the row's current displacement. */
  const release = React.useCallback(
    (measured: SwipeGeometry, velocity: number, committable: string | null) => {
      applyRelease(
        settleSwipe({
          displacement: swipeRef.current?.displacement ?? 0,
          velocity,
          geometry: measured,
          committable,
        }),
        measured,
      );
    },
    [applyRelease],
  );

  /** Where a new gesture starts from: wherever the row is, or at rest. */
  const restingDisplacement = React.useCallback(
    (measured: SwipeGeometry) =>
      swipeRef.current?.displacement ??
      (latest.current.open ? measured.openWidth : 0),
    [],
  );

  /** Claims the single open slot and records what the gesture measures against. */
  const beginSwipe = React.useCallback(
    (measured: RowMeasurement) => {
      latest.current.trace?.({
        ev: "begin",
        row: id,
        open: Math.round(measured.geometry.openWidth),
        commit: Math.round(measured.geometry.commitWidth),
        dir: measured.direction,
      });
      clearSettleTimer();
      setGeometry(measured.geometry);
      setDirection(measured.direction);
      onOpenChange(true);
    },
    [clearSettleTimer, id, onOpenChange],
  );

  // Another row opening, a press elsewhere, or a scroll closes this one:
  // slide back from wherever it rests.
  const wasOpenRef = React.useRef(open);
  React.useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!wasOpen || open) return;
    // Only one row is open, so any prompt showing is this row's.
    if (latest.current.confirming) announce("");
    setConfirmingId(null);
    const current = swipeRef.current;
    if (current?.phase === "committing") return;
    if (current?.phase === "settling" && current.displacement === 0) return;
    if (pointerRef.current) endPointer();
    clearWheel();
    // A tray about to hide must not take focus with it — unless focus is
    // already leaving the row, which is what closed it.
    const tray = trayRef.current;
    const blurred = closedByBlurRef.current;
    closedByBlurRef.current = false;
    if (!blurred && tray?.contains(tray.ownerDocument.activeElement)) {
      itemRef.current?.focus({ preventScroll: true });
    }
    settle("settling", 0, () => showSwipe(null));
  }, [announce, clearWheel, endPointer, open, settle, showSwipe]);

  // An open row is measured again, size and writing direction both,
  // whenever what its tray is laid out from may have changed: its own size
  // or content (a narrowed column, a font that loaded, a locale's new text)
  // or how many actions it holds. A gesture in flight measures for itself.
  const actionCount = actions.length;
  React.useLayoutEffect(() => {
    const row = rowRef.current;
    if (!open || !row || actionCount === 0) return;
    const refit = () => {
      if (swipeRef.current) return;
      const measured = measureRow(row, actionCount);
      const next = measured.geometry;
      // The writing direction too: a locale that flips it moves the tray to
      // the other edge, and the content must slide toward it.
      setDirection(measured.direction);
      setGeometry((current) =>
        !current ||
        (current.rowWidth === next.rowWidth &&
          current.openWidth === next.openWidth &&
          current.commitWidth === next.commitWidth)
          ? current
          : next,
      );
    };
    refit();
    return observeSize(row, refit);
  }, [actionCount, open]);

  // An action taken away while it waited for confirmation takes the
  // confirmation with it; otherwise every remaining action would stay
  // stepped aside and inert.
  React.useLayoutEffect(() => {
    if (confirmingId === null) return;
    if (actions.some((action) => action.id === confirmingId)) return;
    trace?.({ ev: "confirm-lost", row: id, action: confirmingId });
    setConfirmingId(null);
    announce("");
  }, [actions, announce, confirmingId, id, trace]);

  // A tray that becomes the pointer's alone (`openOnContextMenu` turned off)
  // is hidden from the keys and assistive technology: focus on one of its
  // actions goes to the content first.
  React.useLayoutEffect(() => {
    if (openOnContextMenu) return;
    const tray = trayRef.current;
    if (tray?.contains(tray.ownerDocument.activeElement)) {
      itemRef.current?.focus({ preventScroll: true });
    }
  }, [openOnContextMenu]);

  // The one rule for focus in the tray: an action whose button goes while
  // focus is on it (taken away, confirming or not, or the whole tray with
  // it) hands focus to the content rather than letting it fall out of the
  // page. Only when nothing else took it meanwhile.
  React.useLayoutEffect(() => {
    const was = trayFocusRef.current;
    if (!was || was.isConnected) return;
    trayFocusRef.current = null;
    const ownerDocument = itemRef.current?.ownerDocument;
    const active = ownerDocument?.activeElement;
    if (!active || active === ownerDocument?.body || !active.isConnected) {
      itemRef.current?.focus({ preventScroll: true });
    }
  }, [actions]);

  // Opening from the keyboard hands focus to the first action once the tray
  // is visible, which is only true after the render that opened it.
  React.useLayoutEffect(() => {
    if (!open || !focusTrayRef.current) return;
    focusTrayRef.current = false;
    trayRef.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
  }, [open]);

  // Unmount only: a row whose value or callbacks change stays the same row,
  // mid-gesture included, so its teardown reads the newest of them by ref.
  const teardownRef = React.useRef(() => {});
  React.useLayoutEffect(() => {
    teardownRef.current = () => {
      endPointer();
      clearWheel();
      clearSettleTimer();
      // Committing is a decision the viewer already made; a row unmounted
      // mid-slide (the host refiltered the list) still reports it.
      // A row removed mid-confirmation takes its prompt with it.
      if (latest.current.confirming) announce("");
      const committed = pendingCommitRef.current;
      pendingCommitRef.current = null;
      if (committed !== null) act(committed, { hadFocus: false, via: "swipe" });
    };
  });
  React.useEffect(() => () => teardownRef.current(), []);

  // Horizontal trackpad scrolling swipes the row the way a two-finger swipe
  // does in Mail. React's wheel listener is passive and cannot cancel, so
  // this one is attached natively; a vertical wheel is never cancelled and
  // keeps scrolling the list.
  React.useEffect(() => {
    const row = rowRef.current;
    if (!row || !hasActions) return;
    /** Settles a wheel gesture, judged where the fingers left the row. */
    const releaseWheel = (gesture: WheelSwipe) => {
      if (!gesture.geometry || !gesture.track) return;
      applyRelease(
        settleWheelSwipe({
          track: gesture.track,
          start: gesture.start,
          geometry: gesture.geometry,
          committable: committableSwipeAction(latest.current.actions),
        }),
        gesture.geometry,
      );
    };
    // One timer per gesture, re-checked when it fires, rather than one
    // cleared and re-armed on every event of a 120 Hz scroll.
    const armIdle = () => {
      if (wheelTimerRef.current !== null) return;
      const check = () => {
        const gesture = wheelRef.current;
        const quiet = gesture
          ? performance.now() - gesture.last
          : wheelSwipeIdleMs;
        if (quiet < wheelSwipeIdleMs) {
          wheelTimerRef.current = setTimeout(check, wheelSwipeIdleMs - quiet);
          return;
        }
        clearWheel();
        // A coasting gesture was released when its inertia began; its end
        // only frees the row for the next one.
        if (gesture?.axis !== "x" || gesture.track?.phase !== "fingers") return;
        releaseWheel(gesture);
      };
      wheelTimerRef.current = setTimeout(check, wheelSwipeIdleMs);
    };
    const onWheel = (event: WheelEvent) => {
      let gesture = wheelRef.current;
      if (!gesture) {
        if (event.ctrlKey || pointerRef.current) return;
        if (swipeRef.current?.phase === "committing") return;
        gesture = {
          axis: "pending",
          dx: 0,
          dy: 0,
          pendingDelta: 0,
          pendingGrew: false,
          start: 0,
          track: null,
          geometry: null,
          direction: "ltr",
          last: 0,
        };
        wheelRef.current = gesture;
      }
      gesture.last = performance.now();
      armIdle();
      // A vertical gesture keeps scrolling the list for its whole life, and
      // costs nothing more than noting that it is still going.
      if (gesture.axis === "y") return;
      // Only page-based deltas need the row's width; reading it on every
      // event would force layout during ordinary scrolling.
      const pageSize =
        event.deltaMode === 2 ? row.getBoundingClientRect().width : 0;
      const deltaX = wheelDeltaInPixels(
        event.deltaX,
        event.deltaMode,
        pageSize,
      );
      if (gesture.axis === "pending") {
        // The axis is decided on summed travel, not on one event, so a
        // vertical scroll that opens with a pixel of sideways wobble stays
        // a scroll.
        gesture.dx += deltaX;
        gesture.dy += wheelDeltaInPixels(
          event.deltaY,
          event.deltaMode,
          pageSize,
        );
        if (deltaX !== 0) {
          gesture.pendingGrew ||=
            Math.sign(deltaX) === Math.sign(gesture.pendingDelta) &&
            Math.abs(deltaX) > Math.abs(gesture.pendingDelta);
          gesture.pendingDelta = deltaX;
        }
        gesture.axis = resolveSwipeAxis(gesture.dx, gesture.dy);
        if (gesture.axis !== "pending") {
          latest.current.trace?.({
            ev: "axis",
            row: id,
            via: "wheel",
            axis: gesture.axis,
          });
        }
        // Chrome only lets a page cancel the first event of a trackpad
        // sequence; the rest arrive uncancellable. So a gesture leaning
        // sideways is claimed before its axis is certain — otherwise the
        // swipe would also scroll ancestors or trigger history navigation.
        // A vertical-leaning event is never claimed, so scrolling survives.
        if (
          gesture.axis === "pending" &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        ) {
          event.preventDefault();
        }
        if (gesture.axis !== "x") return;
        const measured = measureRow(row, latest.current.actions.length);
        gesture.start = restingDisplacement(measured.geometry);
        gesture.geometry = measured.geometry;
        gesture.direction = measured.direction;
        // The travel that decided the axis counts toward the swipe.
        gesture.track = startWheelSwipe(
          wheelSwipeDisplacement(gesture.dx, gesture.direction),
          event.timeStamp,
          {
            previous: wheelSwipeDisplacement(
              gesture.pendingDelta,
              gesture.direction,
            ),
            grew: gesture.pendingGrew,
          },
        );
        beginSwipe(measured);
      } else if (gesture.track) {
        // The whole gesture is this row's, inertia included: nothing of it
        // may scroll an ancestor or navigate history.
        event.preventDefault();
        // Once committed, the rest of the inertia has nothing left to move;
        // and a press that took the row over during inertia owns it now.
        if (swipeRef.current?.phase === "committing" || pointerRef.current)
          return;
        const step = stepWheelSwipe(
          gesture.track,
          wheelSwipeDisplacement(deltaX, gesture.direction),
          event.timeStamp,
        );
        gesture.track = step.track;
        if (step.event === "ignore") return;
        if (step.event === "coast") {
          latest.current.trace?.({
            ev: "coast",
            row: id,
            reach: Math.round(gesture.start + step.track.reach),
            v: Math.round(step.track.velocity * 1000) / 1000,
          });
          releaseWheel(gesture);
          return;
        }
        if (step.event === "resume") {
          const measured = measureRow(row, latest.current.actions.length);
          gesture.start = restingDisplacement(measured.geometry);
          gesture.geometry = measured.geometry;
          latest.current.trace?.({
            ev: "resume",
            row: id,
            from: Math.round(gesture.start),
          });
          beginSwipe(measured);
        }
      }
      if (!gesture.geometry || !gesture.track) return;
      event.preventDefault();
      const canCommit = committableSwipeAction(latest.current.actions) !== null;
      showSwipe({
        phase: "tracking",
        displacement: clampSwipeDisplacement(
          gesture.start + gesture.track.travel,
          gesture.geometry,
          canCommit,
        ),
        reach: clampSwipeDisplacement(
          gesture.start + gesture.track.reach,
          gesture.geometry,
          canCommit,
        ),
      });
    };
    row.addEventListener("wheel", onWheel, { passive: false });
    return () => row.removeEventListener("wheel", onWheel);
  }, [
    applyRelease,
    beginSwipe,
    clearWheel,
    hasActions,
    id,
    restingDisplacement,
    showSwipe,
  ]);

  /** Whether fingers on a trackpad are swiping this row right now. */
  const wheelSwiping = () => wheelRef.current?.track?.phase === "fingers";

  // Not the overlay panels' useDragGesture: that one tracks a single axis and
  // captures the pointer at the press, where a row must wait to learn the
  // gesture's axis and hand vertical ones back to the list untouched.
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // Any press starts a fresh click: a flag left by a swipe whose finger
    // lifted without clicking must not eat this one.
    swallowClickRef.current = false;
    if (event.pointerType === "mouse" && !mouseDrag) {
      // A mouse press belongs to the host. Only a press on the open row's
      // content is spent on closing it, as a tap would be.
      if (
        open &&
        event.button === 0 &&
        !trayRef.current?.contains(event.target as Node) &&
        swipeRef.current?.phase !== "committing"
      ) {
        latest.current.trace?.({
          ev: "press",
          row: id,
          pointer: "mouse",
          open,
        });
        swallowClickRef.current = true;
        onOpenChange(false);
      }
      return;
    }
    if (pointerRef.current || wheelSwiping()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (swipeRef.current?.phase === "committing") return;
    if (trayRef.current?.contains(event.target as Node)) return;
    latest.current.trace?.({
      ev: "press",
      row: id,
      pointer: event.pointerType,
      open,
    });
    const row = event.currentTarget;
    const measured = measureRow(row, actions.length);
    const gesture: PointerSwipe = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      axis: "pending",
      start: restingDisplacement(measured.geometry),
      wasOpen: open,
      geometry: measured.geometry,
      direction: measured.direction,
      samples: [],
    };
    pointerRef.current = gesture;
    const ownerDocument = row.ownerDocument;

    const move = (moved: PointerEvent) => {
      if (
        pointerRef.current !== gesture ||
        moved.pointerId !== gesture.pointerId
      ) {
        return;
      }
      const dx = moved.clientX - gesture.originX;
      const dy = moved.clientY - gesture.originY;
      if (gesture.axis === "pending") {
        gesture.axis = resolveSwipeAxis(dx, dy);
        if (gesture.axis !== "pending") {
          latest.current.trace?.({
            ev: "axis",
            row: id,
            via: moved.pointerType,
            axis: gesture.axis,
          });
        }
        if (gesture.axis === "y") {
          endPointer();
          return;
        }
        if (gesture.axis === "pending") return;
        if (longPressTimerRef.current !== null)
          clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        swallowClickRef.current = true;
        try {
          row.setPointerCapture(gesture.pointerId);
        } catch {
          // Capture is optional; the document listeners are not. A
          // synthetic pointer (a play test) has no active pointer id.
        }
        beginSwipe(measured);
      }
      const displacement = clampSwipeDisplacement(
        gesture.start + swipeDisplacement(dx, gesture.direction),
        gesture.geometry,
        committableSwipeAction(latest.current.actions) !== null,
      );
      gesture.samples.push({ time: moved.timeStamp, displacement });
      if (gesture.samples.length > swipeSampleLimit) gesture.samples.shift();
      latest.current.trace?.({ ev: "f", row: id, d: Math.round(displacement) });
      showSwipe({ phase: "tracking", displacement });
    };

    const up = (released: PointerEvent) => {
      if (
        pointerRef.current !== gesture ||
        released.pointerId !== gesture.pointerId
      ) {
        return;
      }
      endPointer();
      if (gesture.axis === "x") {
        release(
          gesture.geometry,
          swipeVelocity(gesture.samples, released.timeStamp),
          committableSwipeAction(latest.current.actions),
        );
      } else if (gesture.wasOpen) {
        // A tap on an open row closes it, as in Mail, rather than opening
        // what is underneath.
        swallowClickRef.current = true;
        onOpenChange(false);
      }
    };

    const cancel = (cancelled: PointerEvent) => {
      if (
        pointerRef.current !== gesture ||
        cancelled.pointerId !== gesture.pointerId
      ) {
        return;
      }
      endPointer();
      if (gesture.axis !== "x") return;
      // The platform took the pointer back: rest at the nearer position,
      // and never commit from a gesture that did not end by letting go.
      release(gesture.geometry, 0, null);
    };

    if (event.pointerType !== "mouse" && !open) {
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (pointerRef.current !== gesture || gesture.axis !== "pending")
          return;
        // The finger is still down; the click it lifts into must not select.
        swallowClickRef.current = true;
        endPointer();
        latest.current.trace?.({ ev: "longpress", row: id });
        openActionsRef.current();
      }, longPressMs);
    }

    ownerDocument.addEventListener("pointermove", move);
    ownerDocument.addEventListener("pointerup", up);
    ownerDocument.addEventListener("pointercancel", cancel);
    detachPointerRef.current = () => {
      ownerDocument.removeEventListener("pointermove", move);
      ownerDocument.removeEventListener("pointerup", up);
      ownerDocument.removeEventListener("pointercancel", cancel);
    };
  };

  /**
   * Opens the row's actions without a swipe — from the ContextMenu key,
   * Shift+F10, a right-click, or a touch long-press — and focuses the first.
   */
  const openActions = () => {
    const row = rowRef.current;
    if (!row || !hasActions || pointerRef.current || wheelSwiping()) {
      return;
    }
    if (swipeRef.current?.phase === "committing") return;
    if (open) {
      // Already open, or settling open: finish there and move focus now,
      // since `open` will not change to do it.
      clearSettleTimer();
      showSwipe(null);
      if (openOnContextMenu) {
        trayRef.current
          ?.querySelector<HTMLButtonElement>("button")
          ?.focus({ preventScroll: true });
      }
      return;
    }
    // A pointer-only tray never takes focus; the host owns that route.
    focusTrayRef.current = openOnContextMenu;
    beginSwipe(measureRow(row, actions.length));
    showSwipe(null);
  };

  const openActionsRef = React.useRef(openActions);
  React.useLayoutEffect(() => {
    openActionsRef.current = openActions;
  });

  /** Closes the row's actions and returns focus to the content. */
  const closeActions = () => {
    if (confirmingId !== null) announce("");
    setConfirmingId(null);
    onOpenChange(false);
    // A pointer-only tray never held focus, so there is none to hand back.
    if (openOnContextMenu) itemRef.current?.focus({ preventScroll: true });
  };

  const rawDisplacement = swipe
    ? swipe.displacement
    : open && hasActions && geometry
      ? geometry.openWidth
      : 0;
  const displacement =
    geometry && swipe?.phase === "tracking"
      ? presentedSwipeDisplacement(rawDisplacement, geometry, reducedMotion)
      : rawDisplacement;
  const tracking = swipe?.phase === "tracking";
  const committing = swipe?.phase === "committing";
  const armed =
    committing ||
    (tracking &&
      geometry !== null &&
      swipeArmed(
        swipe.reach ?? swipe.displacement,
        geometry,
        committable !== null,
      ));
  const trayVisible = hasActions && (open || swipe !== null);
  // While confirming, the confirming action takes the tray the way the
  // primary action does when armed; the others step aside.
  const expandedId = armed ? committable : trayVisible ? confirmingId : null;
  const displaced = displacement > 0;
  const contentOpacity = geometry
    ? swipeContentOpacity(displacement, geometry)
    : 0;
  const swipeState = swipe?.phase ?? (open ? "open" : undefined);

  if (!hasActions) {
    return (
      <Wrapper
        {...props}
        ref={composedRowRef}
        data-slot={slot}
        className={className}
        onPointerDown={onPointerDownProp}
        onContextMenu={onContextMenuProp}
        onClickCapture={onClickCaptureProp}
        onBlur={onBlurProp}
      >
        {/* Still the row's content: focus handed back lands on it. */}
        {React.cloneElement(children, { ref: composedItemRef })}
      </Wrapper>
    );
  }

  const content = children.props;
  const contentChild = React.cloneElement(children, {
    ref: composedItemRef,
    "aria-keyshortcuts":
      [
        content["aria-keyshortcuts"],
        openOnContextMenu ? "ContextMenu Shift+F10" : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    onKeyDown: composeEventHandler(content.onKeyDown, (event) => {
      swallowClickRef.current = false;
      if (
        openOnContextMenu &&
        (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))
      ) {
        event.preventDefault();
        openActions();
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }
    }),
    style: displaced
      ? {
          ...content.style,
          translate: `${direction === "rtl" ? displacement : -displacement}px`,
        }
      : content.style,
    className: cn(
      content.className,
      "transition-[color,background-color,translate]",
      settleTransitionClassName,
      tracking && "transition-none",
      // Promote only the moving row: costly content repaints every frame
      // otherwise, and idle rows need no layer of their own.
      swipe !== null && "[will-change:translate]",
      // Slid open, the row is clipped at its own edges, so the content's
      // outline draws inside them.
      displaced && "focus-visible:-outline-offset-2",
    ),
  });

  return (
    <Wrapper
      {...props}
      ref={composedRowRef}
      data-slot={slot}
      data-swipe={swipeState}
      data-armed={armed || undefined}
      className={cn(
        className,
        "relative touch-pan-y touch-pinch-zoom select-none",
        // Clip only while displaced: at rest the content's focus outline
        // draws outside the row's box and must not be cut.
        displaced && "overflow-hidden",
      )}
      onPointerDown={composeEventHandler(onPointerDownProp, onPointerDown)}
      onContextMenu={
        openOnContextMenu
          ? composeEventHandler(onContextMenuProp, (event) => {
              // Held on the row, not the content: the Menu key's own
              // contextmenu arrives after keyup, by which time focus is on
              // an action, and must not open the native menu over the tray.
              event.preventDefault();
              if (itemRef.current?.contains(event.target as Node))
                openActions();
            })
          : onContextMenuProp
      }
      onClickCapture={composeEventHandler(onClickCaptureProp, (event) => {
        if (!swallowClickRef.current) return;
        swallowClickRef.current = false;
        // Only the content's click is spent on a swipe; an action button
        // pressed afterwards always runs.
        if (trayRef.current?.contains(event.target as Node)) return;
        event.preventDefault();
        event.stopPropagation();
      })}
      onBlur={composeEventHandler(onBlurProp, (event) => {
        // Tabbing out of an open row closes it. A blur with no destination
        // is a press on something unfocusable, which the group's
        // outside-press handling already covers.
        const next = event.relatedTarget;
        if (open && next && !event.currentTarget.contains(next)) {
          closedByBlurRef.current = true;
          onOpenChange(false);
        }
      })}
    >
      {contentChild}
      <div
        ref={trayRef}
        role="group"
        aria-label={`Actions for ${name}`}
        // A pointer surface only when the host owns the keyboard and
        // assistive-technology route (see `openOnContextMenu`).
        aria-hidden={openOnContextMenu ? undefined : "true"}
        data-slot={`${slot}-actions`}
        inert={committing || undefined}
        onFocus={(event) => {
          trayFocusRef.current = event.target;
        }}
        onBlur={(event) => {
          if (event.relatedTarget !== null) trayFocusRef.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          // The first Escape backs out of a confirmation; the next closes.
          if (confirmingId !== null) {
            setConfirmingId(null);
            announce("");
          } else closeActions();
        }}
        style={{ width: displacement }}
        className={cn(
          // The clip: exactly as wide as the row has moved, with no padding
          // of its own, so a closed or barely moved row shows nothing.
          "absolute inset-y-0 end-0 overflow-hidden transition-[width]",
          settleTransitionClassName,
          tracking && "transition-none",
          !trayVisible && "invisible",
          // The committed action is already on its way; nothing in the tray
          // may run a second time while the row slides out.
          committing && "pointer-events-none",
        )}
      >
        {trayVisible ? (
          <div
            style={{ width: Math.max(displacement, geometry?.openWidth ?? 0) }}
            className={cn(
              // Laid out at full size from the row's trailing edge, so the
              // actions slide in with the row and are uncovered rather than
              // squeezed. Past the resting width they stretch with it.
              // Reversed so the primary action sits at the trailing edge,
              // where a full swipe grows it, while staying first in the tab
              // order.
              "absolute inset-y-0 start-0 flex flex-row-reverse gap-1 p-1.5 transition-[width]",
              settleTransitionClassName,
              tracking && "transition-none",
            )}
          >
            {actions.map((action) => {
              const needsConfirm = actionNeedsConfirm(action);
              const confirming = confirmingId === action.id;
              const expanded = expandedId === action.id;
              const collapsed = expandedId !== null && !expanded;
              const confirmLabel = action.confirmLabel ?? "Confirm";
              return (
                <button
                  key={action.id}
                  type="button"
                  data-slot={`${slot}-action`}
                  data-tone={action.tone ?? "default"}
                  data-confirming={confirming || undefined}
                  // A collapsed action is out of sight, so it is out of
                  // reach too.
                  inert={collapsed || undefined}
                  tabIndex={openOnContextMenu ? undefined : -1}
                  // Pressing a pointer-only action must not pull focus into
                  // a tray assistive technology cannot see.
                  onMouseDown={
                    openOnContextMenu
                      ? undefined
                      : (event) => event.preventDefault()
                  }
                  aria-label={
                    confirming
                      ? `${confirmLabel}: ${action.label} ${name}`
                      : `${action.label} ${name}`
                  }
                  onClick={() => {
                    if (swipeRef.current?.phase === "committing") return;
                    if (needsConfirm && !confirming) {
                      setConfirmingId(action.id);
                      trace?.({ ev: "confirm", row: id, action: action.id });
                      // Focus stays put and only the name changes, which
                      // screen readers do not reliably speak; say it.
                      // The button's new name, so the words stay the
                      // host's (and translatable).
                      announce(`${confirmLabel}: ${action.label} ${name}`);
                      return;
                    }
                    // A keyboard-reachable action was pressed from inside
                    // the row; a pointer-only one says where focus is.
                    const hadFocus = openOnContextMenu || holdsFocus();
                    closeActions();
                    act(action.id, { hadFocus, via: "press" });
                  }}
                  className={cn(
                    // A transparent border is invisible until forced colors paint it,
                    // which is then the action's only visible edge.
                    "flex min-w-0 grow basis-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-transparent px-1 font-sans nessa-text-1 font-medium",
                    "transition-[flex-grow,opacity,color,background-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)]",
                    // Quiet surfaces, like a secondary button: the tray
                    // sits beside the row's text and must not outshout
                    // it. A destructive action is marked by a red wash
                    // and a red icon — its label stays in the foreground
                    // colour, which is what holds text contrast on the
                    // wash — and while it asks to be confirmed the wash
                    // deepens and gains a destructive edge.
                    action.tone !== "destructive"
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      : cn(
                          "text-foreground [&_svg]:text-destructive",
                          confirming
                            ? "border-destructive/60 bg-destructive/20 hover:bg-destructive/25"
                            : "bg-destructive/10 hover:bg-destructive/15",
                        ),
                    // The expanded action — armed by a full swipe, or
                    // waiting to be confirmed — takes the whole tray, so
                    // what happens next is plain before it happens.
                    collapsed && "grow-0 px-0 opacity-0",
                    actionFocusClassName,
                  )}
                >
                  <span
                    style={{ opacity: contentOpacity }}
                    className="flex min-w-0 max-w-full flex-col items-center gap-1"
                  >
                    {action.render ? (
                      action.render({ confirming, armed: armed && expanded })
                    ) : (
                      <>
                        {action.icon ? (
                          <span
                            aria-hidden="true"
                            className="flex shrink-0 [&_svg]:size-4"
                          >
                            {action.icon}
                          </span>
                        ) : null}
                        <span className="max-w-full truncate">
                          {confirming ? confirmLabel : action.label}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}

export { SwipeRow, SwipeRowGroup };
