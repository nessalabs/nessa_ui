import * as React from "react"

/**
 * The two ways a component that owns internal behavior has to share an
 * element and an event with the host that mounted it.
 *
 * Both exist because the naive spellings are silently wrong rather than
 * loudly wrong. `<div ref={mine} {...props} />` looks like it keeps `mine` —
 * in React 19 `ref` is an ordinary prop, so the spread replaces it and every
 * effect reading `mine.current` sees `null` forever. `onClick={ours}` before
 * `{...props}` looks like it keeps `ours` — the host's handler replaces it,
 * and the component's own behavior disappears with no error anywhere.
 */

/**
 * The cleanup a React 19 callback ref may return. React calls it instead of
 * re-invoking the ref with `null`, so a composed ref that swallowed it would
 * leak whatever the host set up.
 */
type RefCleanup = ReturnType<React.RefCallback<unknown>>

/**
 * Feeds one element to every ref given, so a component's private ref and the
 * host's public one both resolve.
 *
 * Accepts object refs, callback refs, and the `undefined`/`null` a component
 * receives when the host passed nothing. A callback ref that returns a
 * cleanup gets that cleanup run when the element detaches: the composed
 * callback returns its own cleanup, which is the React 19 signal that the
 * legacy `ref(null)` call must not also happen.
 *
 * @param refs - The refs to feed, in the order they should be written.
 * @returns One ref callback serving all of them.
 */
export function composeRefs<Element>(
  ...refs: readonly (React.Ref<Element> | undefined)[]
): React.RefCallback<Element> {
  return (element) => {
    // Indexed by position in `refs`, not appended: a callback ref's cleanup
    // has to come back to *that* ref, and an array that only grew for the
    // callback refs would shift every later one onto the wrong owner as soon
    // as an object ref appeared before it.
    const cleanups = new Array<RefCleanup>(refs.length)
    refs.forEach((ref, index) => {
      if (typeof ref === "function") cleanups[index] = ref(element)
      else if (ref) ref.current = element
    })
    return () => {
      // Reverse order, so a ref set up after another is torn down before it,
      // exactly as nested effects unwind.
      for (let index = refs.length - 1; index >= 0; index -= 1) {
        const ref = refs[index]
        const cleanup = cleanups[index]
        if (typeof ref === "function") {
          // A ref that returned no cleanup is still on the legacy contract
          // and expects the detach call it would otherwise have received.
          if (typeof cleanup === "function") cleanup()
          else ref(null)
        } else if (ref) {
          ref.current = null
        }
      }
    }
  }
}

/**
 * A stable composed ref callback for a component that must not re-attach the
 * element on every render. The identity changes only when the host's ref
 * does, which is the only change that can make the composition wrong.
 *
 * @param refs - The refs to feed, in the order they should be written.
 * @returns A memoized ref callback serving all of them.
 */
export function useComposedRefs<Element>(
  ...refs: readonly (React.Ref<Element> | undefined)[]
): React.RefCallback<Element> {
  // The spread is the dependency list: a component's own `useRef` object is
  // stable, so in practice this recomputes only when the host swaps its ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => composeRefs(...refs), refs)
}

/**
 * Runs the host's handler first and the component's own behavior after,
 * unless the host called `preventDefault`.
 *
 * The host goes first because it is the one that may want to cancel: a
 * component whose behavior ran before the host saw the event cannot be
 * stopped. `preventDefault` is the opt-out rather than a bespoke prop so
 * that suppressing built-in behavior reads the same on every component.
 *
 * @param theirs - The handler the host passed, if any.
 * @param ours - The component's own behavior.
 * @returns One handler running both.
 */
export function composeEventHandler<E extends { defaultPrevented: boolean }>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
) {
  return (event: E) => {
    theirs?.(event)
    if (!event.defaultPrevented) ours(event)
  }
}
