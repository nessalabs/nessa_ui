# Debugging interactive components

How to diagnose interaction bugs — scroll sync, animation timing, focus
behavior — in components that run their own animation engines. Read this
when a component's motion or highlight "looks wrong" and you need to know
what actually happened, or when building a new animated component.

## Prefer instrumented traces over screen recordings

Videos lose frames, alias repeating content (a dropped frame over repeated
paragraphs reads as a phantom direction reversal), and cannot show internal
state. A trace shows the real event sequence with millisecond timestamps:
what the scroll spy saw, when the engine retargeted, what velocity the
marker had, whether a settle landed mid-flight.

## The `debug` prop pattern

Components with animation engines expose a dev-only `debug` prop.
PageOutline (`packages/react/src/components/page-outline.tsx`) is the
reference implementation:

- Every meaningful event pushes one flat object into a bounded ring buffer
  (4000 entries): clicks (`ev: "click"`), scroll-spy passes with scroll
  position (`ev: "spy"`), settles (`ev: "settle"`), engine retargets
  (`ev: "target"`), and per-frame motion samples (`ev: "f"` with head
  position, gap to target, velocity).
- The buffer is published at `window.__nessaPageOutline[<instance id>]`
  together with a `snapshot()` of live engine state (head, target,
  velocity, active index, fold set, document visibility).
- Every call site is a single optional chain on a ref that is `null`
  unless `debug` is set, so the production cost is nil.
- Stories enable `debug` by default — the running Storybook is always
  traceable.

## Workflow

1. Reproduce the glitch in the running Storybook (a human doing the real
   gesture beats any synthetic reproduction — trackpad inertia, smooth
   scrolling, and focus behavior don't simulate faithfully).
2. Read the buffer from the browser console or an agent's JS bridge:

   ```js
   Object.values(window.__nessaPageOutline)[0].events
   ```

3. Correlate timestamps instead of describing what the animation looked
   like. A landing that overshoots and rings shows up as the head position
   oscillating around the target across consecutive `f` events; a spy that
   never fired shows as a missing `spy` event, not a guess.
4. The buffer persists after the tab is hidden or the pane is closed, so
   the trace of an interaction can be read later even though animation
   frames freeze in hidden documents.

## Adding the pattern to a new animated component

Wire the same shape:

- a `debug?: boolean` prop, documented as development tooling;
- one optional-chained trace call per meaningful event — state
  transitions, engine retargets, and a throttled motion sample; keep
  entries flat and small;
- a bounded ring buffer (trim from the front past ~4000 entries);
- a window handle keyed by the component's instance id, deleted on
  unmount, exposing `events` and a `snapshot()`.
