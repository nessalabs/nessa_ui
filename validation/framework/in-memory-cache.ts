import { readFile } from "node:fs/promises"
import path from "node:path"

import postcss, { type Root } from "postcss"
import selectorParser, { type Root as SelectorRoot } from "postcss-selector-parser"
import ts from "typescript"
import { normalizeRepoPath } from "./file-index.ts"

export class InMemoryCache {
  readonly #repoRoot: string
  readonly #text = new Map<string, Promise<string>>()
  readonly #json = new Map<string, Promise<unknown>>()
  readonly #css = new Map<string, Promise<Root>>()
  readonly #typescript = new Map<string, Promise<ts.SourceFile>>()
  readonly #selectors = new Map<string, SelectorRoot>()

  constructor(repoRoot: string) {
    this.#repoRoot = repoRoot
  }

  readText(filePath: string): Promise<string> {
    const key = normalizeRepoPath(filePath)
    let value = this.#text.get(key)
    if (!value) {
      value = readFile(path.join(this.#repoRoot, key), "utf8")
      this.#text.set(key, value)
    }
    return value
  }

  readJson<T>(filePath: string): Promise<T> {
    const key = normalizeRepoPath(filePath)
    let value = this.#json.get(key)
    if (!value) {
      value = this.readText(key).then((text) => JSON.parse(text) as unknown)
      this.#json.set(key, value)
    }
    return value as Promise<T>
  }

  parseCss(filePath: string): Promise<Root> {
    const key = normalizeRepoPath(filePath)
    let value = this.#css.get(key)
    if (!value) {
      value = this.readText(key).then((text) => postcss.parse(text, { from: key }))
      this.#css.set(key, value)
    }
    return value
  }

  parseSelector(selector: string): SelectorRoot {
    let value = this.#selectors.get(selector)
    if (!value) {
      value = selectorParser().astSync(selector)
      this.#selectors.set(selector, value)
    }
    return value.clone()
  }

  parseTypeScript(filePath: string): Promise<ts.SourceFile> {
    const key = normalizeRepoPath(filePath)
    let value = this.#typescript.get(key)
    if (!value) {
      value = this.readText(key).then((text) =>
        ts.createSourceFile(
          key,
          text,
          ts.ScriptTarget.ES2022,
          true,
          key.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        ),
      )
      this.#typescript.set(key, value)
    }
    return value
  }
}
