#!/usr/bin/env node
/**
 * Measures what three representative consumers pay for the built package.
 *
 * The fixtures import from `@nessalabs/ui` exactly as an installed app would,
 * and are bundled against `packages/react/dist` — the real artifact, not the
 * source tree — with React external, minified and tree-shaken. The point is
 * not to predict any one app's output but to answer the question the package's
 * single broad entry keeps raising: does an app that wanted a Button pay for a
 * diagram renderer?
 *
 * Run it with `pnpm measure:consumers`. It prints the table either way and
 * exits non-zero when a budget is exceeded.
 */

import { gzipSync } from "node:zlib"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { access } from "node:fs/promises"

import { build, type Metafile } from "esbuild"

import { consumerBudgets } from "../consumer-budgets.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const packageRoot = path.join(root, "packages/react")
const distEntry = path.join(packageRoot, "dist/index.js")

interface Measurement {
  name: string
  /** JavaScript a browser fetches before first render. */
  bytes: number
  /** Stylesheet bytes the same bundle emits. */
  cssBytes: number
  gzipBytes: number
  /** The heaviest inputs, for a failure that needs explaining. */
  topInputs: { path: string; bytes: number }[]
}

/**
 * The ten biggest inputs across every chunk the fixture fetches.
 *
 * Across chunks, not just the entry: with splitting on, the entry holds little
 * more than the fixture itself and everything worth naming sits in the shared
 * chunks beside it.
 */
function topInputs(metafile: Metafile, reachable: Iterable<string>) {
  const totals = new Map<string, number>()
  for (const key of reachable) {
    for (const [file, value] of Object.entries(metafile.outputs[key]?.inputs ?? {})) {
      const name = file.replace(/^.*node_modules\//, "").replace(/^\.\.\/\.\.\//, "")
      totals.set(name, (totals.get(name) ?? 0) + value.bytesInOutput)
    }
  }
  return [...totals]
    .map(([file, bytes]) => ({ path: file, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)
}

/**
 * The chunks a browser fetches before it can render the fixture.
 *
 * Splitting is on and the walk follows `import-statement` edges only, because
 * that is the distinction the whole measurement turns on: the package defers
 * its heaviest renderers behind dynamic imports, and a bundle that inlined
 * them would report a Button-only app carrying a maths typesetter. It does
 * not — but only a measurement that respects the split can say so.
 *
 * What a dynamic chunk costs is a separate question, answered when a diagram
 * is actually on screen, and the rich-transcript fixture is where it is asked.
 */
function staticallyReachable(metafile: Metafile, entryKey: string): string[] {
  const seen = new Set<string>()
  const queue = [entryKey]
  while (queue.length) {
    const current = queue.shift()!
    if (seen.has(current)) continue
    seen.add(current)
    for (const imported of metafile.outputs[current]?.imports ?? []) {
      if (imported.kind === "import-statement" && !imported.external) {
        queue.push(imported.path)
      }
    }
  }
  return [...seen]
}

async function measure(name: string): Promise<Measurement> {
  const result = await build({
    entryPoints: [path.join(root, "validation/tools/consumer-fixtures", `${name}.tsx`)],
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
    treeShaking: true,
    splitting: true,
    outdir: path.join(root, "node_modules/.cache/nessa-consumer-measure", name),
    jsx: "automatic",
    // A host app brings its own React, so counting it here would bury the
    // number this is actually about.
    external: ["react", "react-dom", "react/jsx-runtime"],
    // Aliased at the package directory, not at its dist file. The difference
    // is not cosmetic: `sideEffects` and `exports` live in package.json, and a
    // bundler pointed straight at a file never reads them — so it must assume
    // every module has side effects and shake nothing. Aliasing at the file
    // reported a Button-only app carrying the entire package, a measurement
    // artifact that looks exactly like the defect this exists to detect.
    alias: { "@nessalabs/ui": packageRoot },
    // Fonts and images are separate requests a browser makes on demand, not
    // JavaScript bytes. `empty` keeps them out of the total without failing
    // the build the way an unconfigured loader does.
    loader: {
      ".woff": "empty",
      ".woff2": "empty",
      ".ttf": "empty",
      ".eot": "empty",
      ".svg": "empty",
      ".png": "empty",
    },
    metafile: true,
    write: false,
    logLevel: "silent",
  })
  const entryKey = Object.keys(result.metafile.outputs).find(
    (key) => result.metafile.outputs[key]?.entryPoint,
  )
  if (!entryKey) throw new Error(`${name} produced no entry chunk`)
  const reachable = new Set(staticallyReachable(result.metafile, entryKey))

  let bytes = 0
  let cssBytes = 0
  const buffers: Uint8Array[] = []
  for (const file of result.outputFiles) {
    const key = path.relative(root, file.path).split(path.sep).join("/")
    if (file.path.endsWith(".css")) {
      cssBytes += file.contents.byteLength
      continue
    }
    if (!reachable.has(key)) continue
    bytes += file.contents.byteLength
    buffers.push(file.contents)
  }
  return {
    name,
    bytes,
    cssBytes,
    gzipBytes: gzipSync(Buffer.concat(buffers)).byteLength,
    topInputs: topInputs(result.metafile, reachable),
  }
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

async function main() {
  try {
    await access(distEntry)
  } catch {
    process.stderr.write(
      `Build the package first: no artifact at ${path.relative(root, distEntry)}.\n` +
        "`pnpm build` produces it; `validate:full` does that before this step.\n",
    )
    process.exitCode = 1
    return
  }

  const failures: string[] = []
  process.stdout.write("Consumer bundle measurements (esbuild, minified, React external)\n\n")
  process.stdout.write(
    `${"fixture".padEnd(18)}${"js".padStart(12)}${"js gzip".padStart(12)}${"css".padStart(12)}${"  budget (gzip)".padEnd(18)}\n`,
  )

  for (const budget of consumerBudgets) {
    const measurement = await measure(budget.name)
    const over =
      measurement.bytes > budget.maximumBytes ||
      measurement.gzipBytes > budget.maximumGzipBytes
    process.stdout.write(
      `${budget.name.padEnd(18)}${kb(measurement.bytes).padStart(12)}${kb(measurement.gzipBytes).padStart(12)}` +
        `${kb(measurement.cssBytes).padStart(12)}` +
        `  ${kb(budget.maximumGzipBytes).padStart(10)} ${over ? "OVER" : "ok"}\n`,
    )
    if (over) {
      failures.push(
        `${budget.name} is ${kb(measurement.bytes)} / ${kb(measurement.gzipBytes)} gzip, ` +
          `over ${kb(budget.maximumBytes)} / ${kb(budget.maximumGzipBytes)}.\n` +
          `  ${budget.rationale}\n` +
          `  Heaviest inputs:\n` +
          measurement.topInputs
            .map((input) => `    ${kb(input.bytes).padStart(10)}  ${input.path}`)
            .join("\n"),
      )
    }
  }

  if (failures.length) {
    process.stdout.write(
      `\nFAIL consumer budgets — ${failures.length} of ${consumerBudgets.length} fixtures over budget.\n\n` +
        `${failures.join("\n\n")}\n\n` +
        "A budget failure means the import graph changed, not that a kilobyte was added.\n" +
        "Find what pulled the new inputs in; re-record the budget only once that is understood.\n",
    )
    process.exitCode = 1
    return
  }
  process.stdout.write(
    `\nPASS consumer budgets — ${consumerBudgets.length} fixtures within budget.\n`,
  )
}

await main()
