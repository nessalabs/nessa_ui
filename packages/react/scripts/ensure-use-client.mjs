// Re-stamps the React client boundary onto built modules. Rollup's
// tree-shake pass drops leading directives, so the directive is prepended
// here, after the build, to the entrypoint and every split chunk.
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const distDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
)
const directivePattern = /^\s*["']use client["'];?/

const entries = await readdir(distDirectory)

for (const entry of entries) {
  if (!entry.endsWith(".js")) continue

  const filePath = path.join(distDirectory, entry)
  const source = await readFile(filePath, "utf8")

  if (!directivePattern.test(source)) {
    await writeFile(filePath, `"use client";\n${source}`)
  }
}
