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
 * ## What the first measurement found
 *
 * `button-only` and `picker` come out within a kilobyte of each other, at
 * ~712 kB minified and ~186 kB gzipped. They should not: one is a single
 * control and the other is a popover with a listbox. The reason is in the
 * built artifact — `dist/index.js` statically re-exports `MermaidDiagram`
 * from a chunk that does `import mermaid from "mermaid"` at module scope, and
 * Mermaid does not declare itself side-effect free, so no bundler may drop it.
 * Around 390 kB of the 712 is Mermaid and its dependencies (marked, dompurify,
 * roughjs), reaching an app that renders a Button.
 *
 * So the concern the review raised is real and now has a number on it. The
 * budgets below are deliberately recorded at *today's* values rather than at
 * an aspirational target: the point of this file is to catch the next
 * regression, and a budget nothing meets catches nothing. Loading Mermaid on
 * demand — as the Markdown renderers already are — should move `button-only`
 * and `picker` sharply down, and that is the change these numbers justify
 * rather than assume.
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
}

export const consumerBudgets: readonly ConsumerBudget[] = Object.freeze([
  {
    name: "button-only",
    rationale:
      "An app that wanted one control. If the barrel leaks, it leaks here first — and it does: see the note above.",
    maximumBytes: 760_000,
    maximumGzipBytes: 195_000,
  },
  {
    name: "picker",
    rationale:
      "Radix, a portalled popover and the listbox engine, with none of the rich-content stack.",
    maximumBytes: 760_000,
    maximumGzipBytes: 195_000,
  },
  {
    name: "rich-transcript",
    rationale:
      "Markdown, highlighting, maths and diagrams: the ceiling, and what a subpath split would be keeping the others away from.",
    maximumBytes: 1_150_000,
    maximumGzipBytes: 310_000,
  },
] satisfies readonly ConsumerBudget[])
