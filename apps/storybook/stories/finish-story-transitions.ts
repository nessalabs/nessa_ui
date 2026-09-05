/**
 * Flush pending styles and settle this story's finite CSS transitions before
 * asserting rendered end states. This avoids depending on compositor frame
 * delivery under parallel CI load and leaves no running CSS transitions behind.
 * Call inside the assertion's retry loop so later React commits are covered.
 */
export function finishStoryTransitions(canvasElement: HTMLElement) {
  for (const animation of canvasElement.getAnimations({ subtree: true })) {
    if (animation instanceof CSSTransition) animation.finish()
  }
}
