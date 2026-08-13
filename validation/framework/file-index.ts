import path from "node:path"

import { Minimatch } from "minimatch"

import { GLOB_OPTIONS } from "./define-check.ts"
import type { FileIndex } from "./types.ts"

export function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replaceAll(path.sep, "/").replace(/^\.\//, "")
}

export function createFileIndex(inputPaths: readonly string[]): FileIndex {
  const paths = Object.freeze(
    [...new Set(inputPaths.map(normalizeRepoPath).filter(Boolean))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0),
  )
  const pathSet = new Set(paths)

  return {
    paths,
    has(filePath) {
      return pathSet.has(normalizeRepoPath(filePath))
    },
    match(patterns) {
      const matchers = patterns.map((pattern) => new Minimatch(pattern, GLOB_OPTIONS))
      return paths.filter((filePath) => matchers.some((matcher) => matcher.match(filePath)))
    },
  }
}
