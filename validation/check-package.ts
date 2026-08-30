#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"

import { runCommand } from "./process.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

interface PackFile { path: string }
interface PackResult { files: PackFile[] }

/**
 * Each publishable package and the artifacts its tarball must carry.
 *
 * The lists differ rather than being one shared constant: `@nessa-ui/react`
 * ships stylesheets, and `@nessa-ui/agent-stream` deliberately ships none —
 * it has no rendering to style. A shared list would have to be the union or
 * the intersection, and either one stops describing a real package.
 */
const PACKAGES: ReadonlyArray<{ directory: string; required: readonly string[] }> = [
  {
    directory: "packages/react",
    required: [
      "dist/index.js",
      "dist/index.js.map",
      "dist/index.d.ts",
      "dist/styles.css",
      "dist/theme.css",
      "dist/app.css",
      "README.md",
      "LICENSE",
      "package.json",
    ],
  },
  {
    directory: "packages/agent-stream",
    required: [
      "dist/index.js",
      "dist/index.js.map",
      "dist/index.d.ts",
      // The fold is a separate entry, so its absence is a broken subpath
      // export rather than a missing convenience.
      "dist/transcript.js",
      "dist/transcript.js.map",
      "dist/transcript.d.ts",
      "README.md",
      "LICENSE",
      "package.json",
    ],
  },
]

export async function checkPackage(): Promise<void> {
  for (const { directory, required } of PACKAGES) {
    const { stdout } = await runCommand("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: path.join(root, directory),
      capture: true,
    })
    const result = (JSON.parse(stdout) as PackResult[])[0]
    if (!result) throw new Error(`PKG-003 npm pack returned no manifest for ${directory}`)
    const paths = new Set(result.files.map((file) => file.path))
    for (const filePath of required) {
      if (!paths.has(filePath)) throw new Error(`PKG-003 ${directory} tarball omits ${filePath}`)
    }
    const unintended = [...paths].filter((filePath) => filePath.startsWith("src/") || filePath.includes("pnpm-lock") || filePath.includes("workspace"))
    if (unintended.length) throw new Error(`PKG-003 ${directory} tarball includes unintended files: ${unintended.join(", ")}`)
    process.stdout.write(`PASS PKG-003 [check-package] — ${directory} tarball manifest contains ${paths.size} intentional files.\n`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPackage().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
