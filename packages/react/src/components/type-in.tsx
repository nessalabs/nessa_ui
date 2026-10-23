"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

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

/**
 * The gaps between keys, in milliseconds, repeated for longer text. Uneven on
 * purpose: even gaps read as a machine, these read as a person.
 */
const typeInGaps = Object.freeze([150, 95, 160, 110, 135] as const);

/** The default paint: the Bloom palette, lifted so it reads on a dark field. */
const typeInColors = Object.freeze([
  "#ffc08a",
  "#ff8ab4",
  "#e3b2ff",
  "#c0a2ff",
  "#9db4ff",
] as const);

/** How long the caret blinks before the first key, and each blink after. */
const BLINK_MS = 250;
/** How long a letter takes to cool from its flash into its colour. */
const COOL_MS = 260;
/** How long a letter takes to settle from its key press. */
const PRESS_MS = 90;

export interface TypeInProps extends Omit<
  React.ComponentProps<"span">,
  "children"
> {
  /** What is typed. Plain text: it is also what assistive technology reads. */
  text: string;
  /**
   * Whether it types. Before it does, the text keeps its space and shows
   * nothing; when this turns true it types from the start. Defaults to true.
   */
  play?: boolean;
  /** Milliseconds the caret blinks before the first key. Defaults to 500. */
  delay?: number;
  /** Milliseconds between keys, repeated for longer text. */
  gaps?: readonly number[];
  /** CSS colours spread across the whole text, left to right. */
  colors?: readonly string[];
  /** Whether a caret leads the typing, then blinks twice and leaves. Defaults to true. */
  caret?: boolean;
  /** Called once the last letter has settled and the caret has gone. */
  onTyped?: () => void;
}

/**
 * Text that types itself in, a key at a time, painted with one gradient that
 * runs across the whole text. Each letter lands with a small press and a
 * flash of light that cools into its colour, and a gradient caret leads the
 * way, then blinks twice and leaves. Made for a wordmark at a moment that
 * happens once, such as a first run; it is not for running copy.
 *
 * Nothing loops: every animation ends, and `data-typed` is set once they
 * have, which is what a test should wait on. Under reduced motion the text is
 * there at once, with no caret. The letters are hidden from assistive
 * technology, which reads `text` once.
 */
function TypeIn({
  text,
  play = true,
  delay = 500,
  gaps = typeInGaps,
  colors = typeInColors,
  caret = true,
  onTyped,
  className,
  ...props
}: TypeInProps) {
  const reducedMotion = useReducedMotion();
  const root = React.useRef<HTMLSpanElement>(null);
  const caretRef = React.useRef<HTMLSpanElement>(null);
  const typed = React.useRef(onTyped);
  typed.current = onTyped;
  const letters = React.useMemo(() => [...text], [text]);
  const gapKey = gaps.join(",");
  const gradient = `linear-gradient(90deg, ${colors.join(", ")})`;

  // Paint each letter with its own slice of one gradient, so the colour runs
  // across the text instead of starting over in every letter. Measured again
  // whenever the text changes size, such as when its font arrives.
  React.useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const paint = () => {
      const spans = [
        ...host.querySelectorAll<HTMLElement>("[data-slot=type-in-letter]"),
      ];
      const first = spans[0]?.offsetLeft ?? 0;
      const last = spans.at(-1);
      const width = last ? last.offsetLeft + last.offsetWidth - first : 0;
      for (const span of spans) {
        span.style.backgroundSize = `${Math.max(1, width)}px 100%`;
        span.style.backgroundPosition = `${first - span.offsetLeft}px 0`;
      }
    };
    paint();
    if (typeof ResizeObserver === "undefined") return;
    const resize = new ResizeObserver(paint);
    resize.observe(host);
    return () => resize.disconnect();
  }, [letters, gradient]);

  React.useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const spans = [
      ...host.querySelectorAll<HTMLElement>("[data-slot=type-in-letter]"),
    ];
    const bar = caretRef.current;
    host.removeAttribute("data-typed");
    const finish = () => {
      host.setAttribute("data-typed", "true");
      typed.current?.();
    };
    if (!play) {
      for (const span of spans) span.style.opacity = "0";
      if (bar) bar.style.opacity = "0";
      return;
    }
    // Without Web Animations (an old engine), or asked to stay still, the
    // text is simply there.
    if (reducedMotion || typeof host.animate !== "function") {
      for (const span of spans) span.style.opacity = "";
      if (bar) bar.style.opacity = "0";
      finish();
      return;
    }

    const steps = gapKey
      .split(",")
      .map(Number)
      .filter((gap) => gap >= 0);
    const at: number[] = [];
    letters.forEach((_, index) => {
      at.push(
        index === 0
          ? delay
          : at[index - 1] + (steps[(index - 1) % steps.length] ?? 120),
      );
    });
    const typedAt = (at.at(-1) ?? delay) + COOL_MS;
    const running: Animation[] = [];

    spans.forEach((span, index) => {
      span.style.opacity = "";
      running.push(
        span.animate(
          [
            {
              opacity: 0,
              transform: "translateY(0.012em)",
              filter: "brightness(2.4)",
            },
            {
              opacity: 1,
              transform: "translateY(0.012em)",
              filter: "brightness(2.4)",
              offset: 0.001,
            },
            {
              opacity: 1,
              transform: "translateY(0)",
              offset: PRESS_MS / COOL_MS,
            },
            { opacity: 1, transform: "translateY(0)", filter: "brightness(1)" },
          ],
          {
            duration: COOL_MS,
            delay: at[index],
            easing: "cubic-bezier(0.2, 0, 0, 1)",
            fill: "backwards",
          },
        ),
      );
    });

    if (bar && caret) {
      // The caret jumps to just after each letter as it lands: a blink
      // before the first key, then two after the last, then it leaves.
      const first = spans[0]?.offsetLeft ?? 0;
      const edge = (index: number) => {
        const span = spans[index];
        return span ? span.offsetLeft + span.offsetWidth : first;
      };
      const total = typedAt + BLINK_MS * 4;
      const frames: Keyframe[] = [];
      const mark = (time: number, left: number, opacity: number) =>
        frames.push({
          offset: Math.min(1, time / total),
          left: `${left}px`,
          opacity,
          easing: "step-end",
        });
      mark(0, first, 1);
      mark(BLINK_MS, first, 0);
      if (delay > BLINK_MS * 2) mark(BLINK_MS * 2, first, 1);
      spans.forEach((_, index) => mark(at[index], edge(index), 1));
      const end = edge(spans.length - 1);
      mark(typedAt, end, 0);
      mark(typedAt + BLINK_MS, end, 1);
      mark(typedAt + BLINK_MS * 2, end, 0);
      mark(typedAt + BLINK_MS * 3, end, 1);
      frames.push({ offset: 1, left: `${end}px`, opacity: 0 });
      frames.sort((a, b) => (a.offset as number) - (b.offset as number));
      running.push(bar.animate(frames, { duration: total }));
    }

    let live = true;
    Promise.all(running.map((animation) => animation.finished)).then(
      () => {
        if (live) finish();
      },
      () => {},
    );
    return () => {
      live = false;
      for (const animation of running) animation.cancel();
    };
  }, [play, reducedMotion, letters, delay, gapKey, caret]);

  return (
    <span
      ref={root}
      data-slot="type-in"
      className={cn(
        "relative inline-flex items-baseline whitespace-pre",
        className,
      )}
      {...props}
      style={
        {
          "--nessa-type-in-paint": gradient,
          "--nessa-type-in-caret": gradient.replace("90deg", "180deg"),
          ...props.style,
        } as React.CSSProperties
      }
    >
      <span className="sr-only">{text}</span>
      {letters.map((letter, index) => (
        <span
          key={index}
          aria-hidden="true"
          data-slot="type-in-letter"
          className="inline-block bg-clip-text bg-no-repeat text-transparent [-webkit-background-clip:text] [background-image:var(--nessa-type-in-paint)]"
          style={{ opacity: play ? undefined : 0 }}
        >
          {letter}
        </span>
      ))}
      {caret && (
        <span
          ref={caretRef}
          aria-hidden="true"
          data-slot="type-in-caret"
          className="pointer-events-none absolute top-1/2 h-[0.86em] w-[0.07em] -translate-y-1/2 translate-x-[0.06em] rounded-[0.04em] opacity-0 [background-image:var(--nessa-type-in-caret)]"
          style={{ left: 0 }}
        />
      )}
    </span>
  );
}

export { TypeIn, typeInColors, typeInGaps };
