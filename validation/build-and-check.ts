#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"

import { runCommand } from "./process.ts"
import { runValidation } from "./run.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export async function buildAndCheck(): Promise<void> {
  await runCommand("pnpm", ["build"], { cwd: root })
  const report = await runValidation(["--phase=artifacts"])
  if (!report || report.summary.exitCode !== 0) throw new Error("Fresh package artifact validation failed")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildAndCheck().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
