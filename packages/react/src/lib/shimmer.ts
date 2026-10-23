"use client";

/** @responsibility The one shimmer: a highlight swept across live text, for a label that is still working or loading. Every component that shimmers text uses it, so the sweep has one speed, one paint and one reduced-motion rule. */

import * as React from "react";

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

/** Parses a CSS duration token value into milliseconds. */
function cssDurationInMilliseconds(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return value.trim().endsWith("ms") ? parsed : parsed * 1000;
}

/**
 * The sweep is painted with theme tokens — muted-foreground body,
 * foreground crest — so it reads in both schemes without `dark:` variants.
 * It applies only while the element carries `data-shimmer="true"`.
 */
const shimmerClasses =
  "data-[shimmer=true]:[background-image:linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_38%,var(--foreground)_50%,var(--muted-foreground)_62%,var(--muted-foreground)_100%)] data-[shimmer=true]:bg-[length:200%_100%] data-[shimmer=true]:bg-[position:150%_0] data-[shimmer=true]:bg-clip-text data-[shimmer=true]:[-webkit-background-clip:text] data-[shimmer=true]:text-transparent";

/**
 * Sweeps the highlight across the element `ref` is attached to while
 * `active`, once per `--nessa-motion-duration-ambient`, left to right. Under
 * reduced motion, or with an ambient duration of zero, nothing moves and
 * `shimmering` is false, so the text stays plain. Put `shimmerClasses` on
 * the element and set `data-shimmer` from `shimmering`.
 */
function useShimmer<T extends HTMLElement>(active: boolean) {
  const reducedMotion = useReducedMotion();
  const shimmering = active && !reducedMotion;
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || !shimmering) return;
    const duration = cssDurationInMilliseconds(
      getComputedStyle(node).getPropertyValue(
        "--nessa-motion-duration-ambient",
      ),
      3200,
    );
    if (duration === 0) return;
    // The highlight sits at the center of a double-width background, so
    // sliding the position from 150% to -50% carries it once across the
    // text per cycle, left to right.
    const animation = node.animate(
      [{ backgroundPosition: "150% 0" }, { backgroundPosition: "-50% 0" }],
      { duration, easing: "linear", iterations: Infinity },
    );
    return () => animation.cancel();
  }, [shimmering]);
  return { ref, shimmering };
}

export { shimmerClasses, useReducedMotion, useShimmer };
