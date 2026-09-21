/** @responsibility Pins the single route to the syntax highlighter, which no browser test can see. */

import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const components = path.dirname(fileURLToPath(import.meta.url))

const read = (name: string) => readFile(path.join(components, name), "utf8")

/**
 * Strips the ways a file can name a package without reaching it at runtime:
 * comments and JSDoc (these files explain the rule they follow, and saying
 * the package's name is not importing it), `import type` declarations,
 * `typeof import("…")` in a type position, and an import whose every named
 * specifier carries the inline `type` modifier. What is left is a value
 * reference, which is what registers module-scope work.
 */
function valueReferences(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/import type[^;]*?from\s*["'][^"']+["']/g, "")
    .replace(/typeof import\(["'][^"']+["']\)/g, "")
    .replace(/import\s*\{([^}]*)\}\s*from\s*["'][^"']+["']/g, (match, specifiers: string) => {
      const named = specifiers
        .split(",")
        .map((one) => one.trim())
        .filter(Boolean)
      return named.length > 0 && named.every((one) => /^type\s/.test(one))
        ? ""
        : match
    })
}

/**
 * Why this is a source check rather than a rendered one.
 *
 * `defaultCodeTheme` names "nessa-dark", a theme Pierre only knows about
 * because `registerCustomTheme` was called for it. That registration used to
 * be a module side effect of code-block, so importing anything from the file
 * was enough; it now travels with the dynamic import inside `loadHighlighter`,
 * and a surface that reaches `@pierre/diffs` on its own can win the race and
 * ask for a theme the engine has never been handed — which throws rather than
 * falling back. Reaching it directly also puts the engine back in the entry
 * chunk, which is the weight `validation/consumer-budgets.ts` records.
 *
 * Storybook cannot catch a regression of either: `.storybook/preview.ts` calls
 * `preloadCodeHighlighter` at boot, so the theme is registered for every story
 * no matter how the component asks for it. What holds the invariant is the
 * shape of the imports — who may name the package, and how — so that is what
 * is asserted, down to static versus dynamic.
 */
test("only code-block reaches @pierre/diffs, so the custom theme is always registered first", async () => {
  for (const file of ["tool-call.tsx", "code-editor-syntax.ts", "code-editor.tsx"]) {
    const source = valueReferences(await read(file))
    assert.ok(
      !/@pierre\/diffs/.test(source),
      `${file} reaches @pierre/diffs at runtime; route it through loadHighlighter() in code-block instead.`,
    )
  }
  // Two modules may name it, and each on its own terms. code-block reaches it
  // only through a dynamic import, inside the loader that registers the
  // theme; the diff surface may import it statically because it is itself
  // only ever reached through that loader.
  const codeBlock = valueReferences(await read("code-block.tsx"))
  assert.match(
    codeBlock,
    /import\("@pierre\/diffs"\)/,
    "code-block must fetch @pierre/diffs, not import it.",
  )
  assert.doesNotMatch(
    codeBlock,
    /from "@pierre\/diffs/,
    "code-block holds a static import of @pierre/diffs again, which puts the engine back in every consumer's first paint.",
  )
  // The registration has to sit inside the loader. Anywhere else in the file
  // it is a module side effect again, which is the thing being undone.
  const loader = codeBlock.slice(codeBlock.indexOf("function loadHighlighter"))
  assert.match(
    loader.slice(0, loader.indexOf("\n}")),
    /registerCustomTheme\(\s*"nessa-dark"/,
    "loadHighlighter must register the custom theme before it resolves.",
  )
  assert.match(valueReferences(await read("tool-call-diff-surface.tsx")), /@pierre\/diffs/)
  assert.match(
    valueReferences(await read("tool-call.tsx")),
    /import\("\.\/tool-call-diff-surface"\)/,
    "the diff surface must stay behind a dynamic import, or its static import of the engine becomes everyone's.",
  )
  // Both deferring surfaces await the loader, which is what orders the
  // registration ahead of the first render that needs it.
  for (const file of ["tool-call.tsx", "code-editor-syntax.ts"]) {
    assert.match(valueReferences(await read(file)), /loadHighlighter\(\)/)
  }
})

/**
 * The guard's own guard.
 *
 * A source check is only worth the file it lives in if it fails on the thing
 * it names, so the shapes it must catch — and the type-only shapes it must
 * not — are asserted directly rather than trusted.
 */
test("the highlighter guard catches every runtime route and no type-only one", () => {
  const caught = [
    'import { parseDiffFromFile } from "@pierre/diffs"',
    "import { getSharedHighlighter } from '@pierre/diffs'",
    'import "@pierre/diffs"',
    'import { FileDiff } from "@pierre/diffs/react"',
    'const { File } = await import("@pierre/diffs/react")',
    'export { parseDiffFromFile } from "@pierre/diffs"',
    'import {\n  parseDiffFromFile,\n} from "@pierre/diffs"',
  ]
  for (const source of caught) {
    assert.match(valueReferences(source), /@pierre\/diffs/, source)
  }
  const allowed = [
    'import type { ThemesType } from "@pierre/diffs"',
    'import { type ThemesType, type DiffsThemeNames } from "@pierre/diffs"',
    'let f: typeof import("@pierre/diffs").preloadHighlighter',
    "// route it through loadHighlighter, never @pierre/diffs directly",
    "/** `@pierre/diffs` runs work at module scope. */",
  ]
  for (const source of allowed) {
    assert.doesNotMatch(valueReferences(source), /@pierre\/diffs/, source)
  }
})
