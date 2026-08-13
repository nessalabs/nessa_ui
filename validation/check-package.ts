#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"

import { runCommand } from "./process.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

interface PackFile { path: string }
interface PackResult { files: PackFile[] }

export async function checkPackage(): Promise<void> {
  const { stdout } = await runCommand("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: path.join(root, "packages/react"),
    capture: true,
  })
  const result = (JSON.parse(stdout) as PackResult[])[0]
  if (!result) throw new Error("PKG-003 npm pack returned no manifest")
  const paths = new Set(result.files.map((file) => file.path))
  const required = [
    "dist/index.js",
    "dist/index.js.map",
    "dist/index.d.ts",
    "dist/styles.css",
    "dist/theme.css",
    "dist/app.css",
    "README.md",
    "LICENSE",
    "package.json",
  ]
  for (const filePath of required) {
    if (!paths.has(filePath)) throw new Error(`PKG-003 tarball omits ${filePath}`)
  }
  const unintended = [...paths].filter((filePath) => filePath.startsWith("src/") || filePath.includes("pnpm-lock") || filePath.includes("workspace"))
  if (unintended.length) throw new Error(`PKG-003 tarball includes unintended files: ${unintended.join(", ")}`)
  process.stdout.write(`PASS PKG-003 [check-package] — tarball manifest contains ${paths.size} intentional files.\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPackage().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
