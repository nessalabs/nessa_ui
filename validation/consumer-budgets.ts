/**
 * What an installed consumer pays, and what it is allowed to pay.
 *
 * The package ships one JavaScript entry and installs a rich-content
 * dependency set — TipTap, Mermaid, KaTeX, Pierre — so the reasonable worry is
 * that an app wanting a Button pays for a diagram renderer. That worry has
 * been stated repeatedly and never measured. These budgets are the
 * measurement, recorded so a regression is a failing check rather than a
 * discovery six months later.
 *
 * Read them as *relative* evidence, not as a promise about any particular
 * app's output. They come from bundling each fixture against the real built
 * package with esbuild — minified, tree-shaken, React external — which is not
 * the same bundler a consumer runs. What carries across bundlers is the shape:
 * whether a Button-only app is in the tens of kilobytes or the hundreds, and
 * whether adding a picker moves it by a little or by a lot.
 *
 * The ceilings sit above the measured values with room for ordinary drift. A
 * failure means something changed the import graph — not that a kilobyte was
 * added — so the response is to look at *why* a fixture moved, then re-record.
 *
 * Gzip is summed per emitted chunk rather than measured over the chunks
 * concatenated: splitting means they are separately served resources, each
 * with its own compression stream, and compressing them together lets a later
 * chunk reuse an earlier one's dictionary in a way no transfer ever does.
 *
 * The JavaScript here is what a browser fetches before first render. It
 * excludes the renderers behind dynamic imports, and it excludes the
 * stylesheet an installed consumer imports by hand — `measure:consumers`
 * prints that separately, because it is a flat cost rather than a per-fixture
 * one.
 *
 * ## What the first measurement found, and why it was wrong
 *
 * The first recording had `button-only` and `picker` within a kilobyte of
 * each other at ~712 kB, and read that as the barrel leaking Mermaid into an
 * app that wanted one control. The leak is real. The number was not — and it
 * was not stable either: the same bug reported 407 kB once the package's
 * chunk order changed, which is what exposed it.
 *
 * `measure:consumers` picked its starting point with `find(output =>
 * output.entryPoint)`, and esbuild names every dynamically imported module an
 * entry point of its own. With splitting on there are hundreds of such
 * outputs, so the walk began at whichever chunk happened to come first in key
 * order — a leaf — and reported that leaf's closure for every fixture. All
 * four rows measured the same chunk, which is why they agreed, and why they
 * moved together whenever an unrelated change reshuffled the package's chunk
 * order. Selecting the output whose `entryPoint` *is* the fixture is the fix,
 * and every number in this file is re-recorded from it.
 *
 * A second way of failing open was in the same function: the emitted files
 * were keyed against the repository root while the metafile keys them against
 * the working directory. Run from anywhere else — a `pnpm --filter`, a CI
 * step with its own `working-directory` — every chunk missed the reachable
 * set, every fixture measured 0 kB, and the gate passed. Both halves now key
 * the same way.
 *
 * ## What the corrected measurement found
 *
 * Before this branch, an app that imported nothing but `Button` statically
 * fetched 1587.2 kB / 454.0 kB gzipped. It named one control; it received
 * Mermaid, KaTeX, TipTap, Shiki, Pierre's diff UI and react-markdown's
 * unified stack, because `dist/index.js` re-exports every one of those
 * surfaces and each does work at module scope.
 *
 * Counting each package's own files (not its dependencies, which is where the
 * earlier "~390 kB of Mermaid" went wrong): `mermaid` 423.7 kB, `katex`
 * 267.2 kB, `@tiptap` + `prosemirror` 411.5 kB, react-markdown's unified
 * stack 158.2 kB, Shiki 159 kB, `@pierre/diffs` 170 kB. Adding Mermaid's own
 * graph and sanitiser dependencies takes its share past 670 kB.
 *
 * ## What this branch moved
 *
 * The last two of those, and only those. `@pierre/diffs` runs work at module
 * scope, so a static import of it is a side effect no bundler may remove: it
 * now loads on demand in all three places that reached it — `CodeBlock`
 * renders Pierre's `File` through `React.lazy`, `ToolCallDiff` defers the
 * parse and the render together through `tool-call-diff-surface`, and
 * `useCodeSyntax` imports the highlighter inside the effect that already
 * awaited it. All three had to move together: a package imported statically
 * in one place and dynamically in another has its shared internals hoisted
 * into a chunk the entry imports, which is strictly worse than leaving it
 * static.
 *
 * | fixture | before | after |
 * | --- | --- | --- |
 * | `button-only` | 1587.2 kB / 454.0 gz | 1569.1 kB / 448.3 gz |
 * | `picker` | 1604.6 / 459.1 | 1586.4 / 453.3 |
 * | `file-preview` | 2100.4 / 602.5 | 1752.1 / 503.4 |
 * | `rich-transcript` | 2086.4 / 598.7 | 1738.1 / 499.6 |
 *
 * Shiki and Pierre leave the statically reachable set entirely, from ~159 kB
 * and ~170 kB to zero, in every fixture.
 *
 * ## What is still there, and what it would take
 *
 * Mermaid, KaTeX, TipTap and react-markdown, in every consumer, through the
 * barrel's static re-exports. The same treatment works on them and nothing
 * else does — but the order matters, and this branch learned that the
 * expensive way.
 *
 * Deferring a *consumer* of an eagerly-loaded module moves no weight and can
 * add some. FilePreview's kind→renderer registry was made lazy first, on the
 * reasoning that an app showing a JPEG should not carry the Markdown
 * renderer. Measured, it removed nothing: `file-preview/index.ts` re-exports
 * all eight renderers, so each module was reachable both statically and
 * dynamically, and a module in that position is hoisted into a chunk the
 * entry imports. Worse, the new dynamic chunks needed `CodeBlock`,
 * `MessageMarkdown`, `JsonTree` and `Table`, which forced those into shared
 * chunks the entry also imports — about 180 kB onto `button-only` and
 * `picker`, plus a third byte-identical copy of `katex.min.css`, to save
 * about 2 kB on the fixture it was written for.
 *
 * So the sequence is: defer what does module-scope work, verify it left the
 * static set, and only then defer the things that reach it. `MessageMarkdown`
 * and its react-markdown stack are next, and this file is where the answer
 * gets recorded.
 */

export interface ConsumerBudget {
  /** The fixture, under `validation/tools/consumer-fixtures`. */
  name: string
  /** What the fixture stands for, for whoever reads a failure. */
  rationale: string
  /** Ceiling for the minified bundle, in bytes. */
  maximumBytes: number
  /** Ceiling for the same bundle gzipped, which is what a browser downloads. */
  maximumGzipBytes: number
  /**
   * Ceiling for the stylesheets this fixture's JavaScript graph emits.
   *
   * Recorded because it moved and nothing noticed: `katex.min.css` is
   * imported at the module scope of every chunk that can reach MathBlock, so
   * each new chunk that can emits its own byte-identical 22.3 kB copy. A
   * consumer downloads every copy whose chunk it loads. The column was
   * printed from the first measurement and compared against nothing, which
   * is how a 50% increase passed a gate that exists to catch exactly that.
   */
  maximumCssBytes: number
}

export const consumerBudgets: readonly ConsumerBudget[] = Object.freeze([
  {
    name: "button-only",
    rationale:
      "An app that wanted one control. If the barrel leaks, it leaks here first — and it does: the whole rich-content stack, as the note above records.",
    maximumBytes: 1_650_000,
    maximumGzipBytes: 475_000,
    maximumCssBytes: 48_000,
  },
  {
    name: "picker",
    rationale:
      "Radix, a portalled popover and the listbox engine, and — through the barrel, not through anything it imports — the same rich-content stack every other fixture carries.",
    maximumBytes: 1_670_000,
    maximumGzipBytes: 480_000,
    maximumCssBytes: 48_000,
  },
  {
    name: "file-preview",
    rationale:
      "An app that previews one kind of file. It reads within a couple of kilobytes of button-only, which is the finding: what a consumer fetches is the barrel, not the component it named.",
    maximumBytes: 1_840_000,
    maximumGzipBytes: 530_000,
    maximumCssBytes: 48_000,
  },
  {
    name: "rich-transcript",
    rationale:
      "Markdown, highlighting, maths and diagrams — everything the barrel already hands the other three. It reads close to them, and that is the finding rather than the reassurance.",
    maximumBytes: 1_830_000,
    maximumGzipBytes: 525_000,
    maximumCssBytes: 48_000,
  },
] satisfies readonly ConsumerBudget[])
