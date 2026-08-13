#!/usr/bin/env node
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { runCommand } from "./process.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function jsonFiles(directory: string): Promise<string[]> {
  return (await readdir(directory)).filter((name) => name.endsWith(".json")).sort()
}

export async function checkRegistry(): Promise<void> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "nessa-registry-"))
  try {
    await runCommand("pnpm", ["exec", "shadcn", "build", "registry.json", "--output", temporary], { cwd: root, capture: true })
    const expected = await jsonFiles(path.join(root, "public/r"))
    const actual = await jsonFiles(temporary)
    if (expected.join("\n") !== actual.join("\n")) {
      throw new Error(`REG-001 registry file set drifted\nexpected=${expected.join(",")}\nactual=${actual.join(",")}`)
    }
    for (const name of expected) {
      const [committed, generated] = await Promise.all([
        readFile(path.join(root, "public/r", name), "utf8"),
        readFile(path.join(temporary, name), "utf8"),
      ])
      if (committed.replaceAll("\r\n", "\n") !== generated.replaceAll("\r\n", "\n")) {
        throw new Error(`REG-001 generated ${name} differs from public/r/${name}`)
      }
    }
    process.stdout.write(`PASS REG-001 [check-registry] — ${expected.length} registry artifacts reproduce exactly.\n`)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkRegistry().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
