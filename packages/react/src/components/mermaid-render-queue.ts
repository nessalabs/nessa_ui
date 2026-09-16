/**
 * The serialization every Mermaid render on a page shares, and the liveness
 * rules that keep one bad render from taking the rest down with it.
 *
 * Mermaid's `initialize()` mutates library-global config, so two diagrams
 * with different themes could read each other's settings mid-render. Every
 * initialize+render pair is chained through one queue instead.
 *
 * A queue is only as live as its slowest link, which is where the care goes.
 * A render that never settles cannot be cancelled — Mermaid offers no abort —
 * so two things have to be true at once: no later diagram may *wait* on it,
 * because one unsettled link strands every diagram behind it forever, and no
 * later diagram may *start* either, because starting one means calling
 * `initialize` and mutating the global config the stuck render is still
 * reading.
 *
 * Quarantine is the only move that satisfies both, and it lives here rather
 * than inside a component effect so that its lifetime is not tied to a
 * component's. A render outlives the diagram that asked for it.
 */

/** The outcome of asking the queue to run a render. */
export type QueuedRenderOutcome<Value> =
  /** The render finished in time. */
  | { status: "rendered"; value: Value }
  /** This render blew its deadline; the queue is now quarantined. */
  | { status: "timed-out" }
  /** An earlier render is still hung, so this one never started. */
  | { status: "quarantined" }
  /** The caller no longer wanted it by the time its turn came. */
  | { status: "cancelled" }
  /** The render itself threw — unparseable source, most often. */
  | { status: "failed"; error: unknown }

export interface RenderQueueClock {
  setTimeout: (handler: () => void, timeout: number) => number
  clearTimeout: (handle: number | undefined) => void
}

const defaultClock: RenderQueueClock = {
  setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout) as unknown as number,
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
}

/**
 * One queue. A module-level instance serializes the whole page; tests make
 * their own so they never inherit another test's quarantine.
 */
export class MermaidRenderQueue {
  #chain: Promise<unknown> = Promise.resolve()
  /**
   * The render that blew its deadline and is still, as far as this queue
   * knows, running. Held as the promise rather than a flag so that only the
   * render which raised the quarantine can lift it: a first render settling
   * late must not clear a quarantine a second one is still holding.
   */
  #quarantining: Promise<unknown> | null = null
  readonly #clock: RenderQueueClock

  constructor(clock: RenderQueueClock = defaultClock) {
    this.#clock = clock
  }

  /** Whether a hung render is currently blocking new work. */
  get quarantined() {
    return this.#quarantining !== null
  }

  /**
   * Runs one render in turn, bounded.
   *
   * The deadline is armed when the job *dequeues*, not when it is enqueued:
   * the queue is shared, so a reply with a dozen fences can leave the last
   * one waiting far longer than the timeout through no fault of its own, and
   * arming at enqueue time would fail it while it was merely waiting.
   *
   * The timeout bounds the **queue link**, not just the caller. Awaiting the
   * render alone would leave an unsettled link that no later diagram can get
   * past — the deadlock this class exists to prevent. Nothing a caller does
   * afterwards, including unmounting, can cancel that deadline; the job owns
   * it and clears it itself.
   *
   * Cancelling queued work and protecting active work are opposite needs, and
   * `stillWanted` is the line between them. It is asked once, at the moment
   * the job dequeues, and a caller that has gone away by then never runs at
   * all — no `initialize`, no render, and no turn taken from the diagram
   * behind it, which would otherwise wait on work nobody wanted and could be
   * quarantined by it. Once the render has begun the answer no longer
   * matters: the job is holding the global config either way, so it keeps its
   * deadline regardless of what its caller does next.
   *
   * @param start - Begins the render. Never called when the job is cancelled
   * or quarantined.
   * @param timeout - How long the dequeued render may run.
   * @param stillWanted - Asked at dequeue time. Returning false skips the job.
   * @returns What happened, for the caller to render.
   */
  run<Value>(
    start: () => Promise<Value>,
    timeout: number,
    stillWanted?: () => boolean,
  ): Promise<QueuedRenderOutcome<Value>> {
    const result = this.#chain.then(async (): Promise<QueuedRenderOutcome<Value>> => {
      if (stillWanted && !stillWanted()) return { status: "cancelled" }
      if (this.#quarantining) return { status: "quarantined" }
      let deadline: number | undefined
      const expiry = new Promise<"timed-out">((resolve) => {
        deadline = this.#clock.setTimeout(() => resolve("timed-out"), timeout)
      })
      let render: Promise<Value>
      try {
        render = start()
      } catch (error) {
        this.#clock.clearTimeout(deadline)
        return { status: "failed", error }
      }
      try {
        const raced = await Promise.race([render, expiry])
        if (raced === "timed-out") {
          this.#quarantining = render
          const lift = () => {
            if (this.#quarantining === render) this.#quarantining = null
          }
          // The stuck render still owns the global config until it proves
          // otherwise, so the quarantine lifts from the render's own
          // settlement rather than from a timer.
          void render.then(lift, lift)
          return { status: "timed-out" }
        }
        return { status: "rendered", value: raced }
      } catch (error) {
        return { status: "failed", error }
      } finally {
        this.#clock.clearTimeout(deadline)
      }
    })
    // The chain advances on the job's own settlement, never on the caller's,
    // so a caller that walked away cannot leave the queue holding the door.
    this.#chain = result.catch(() => {})
    return result
  }
}

/** The queue every diagram on the page shares. */
export const mermaidRenderQueue = new MermaidRenderQueue()
