"use client"

import * as React from "react"
import { getSharedHighlighter } from "@pierre/diffs"
import {
  defaultCodeTheme,
  useCodeBlockConfig,
  useResolvedAppearance,
  type CodeBlockMode,
} from "./code-block"

/** One UTF-16 token range with colors from the shared light and dark code themes. */
export interface CodeSyntaxToken {
  offset: number
  content: string
  light: string
  dark: string
}

/** Shared foreground/background pairs for readable code in either forced theme. */
export interface CodeSyntaxColors {
  light: { foreground: string; background: string }
  dark: { foreground: string; background: string }
}

/**
 * Tokenizes code with the same lazily loaded Shiki instance as CodeBlock.
 * Returns null while loading, for plain/unknown languages, or after a load error;
 * Drafts above 10,000 UTF-16 characters render as plain text to bound synchronous
 * tokenization and decoration work; editing remains available without highlighting. Results never belong to
 * stale code, language, or themes. Only colors are returned, preserving editing
 * geometry regardless of theme font styling. Mode follows CodeBlockProvider.
 */
export function useCodeSyntax(code: string, language: string): {
  tokens: readonly CodeSyntaxToken[] | null
  mode: CodeBlockMode
  colors: CodeSyntaxColors | null
} {
  const config = useCodeBlockConfig()
  const resolvedMode = useResolvedAppearance(config.mode ?? "system")
  const theme = config.theme ?? defaultCodeTheme
  const light = typeof theme === "string" ? theme : theme.light
  const dark = typeof theme === "string" ? theme : theme.dark
  const [result, setResult] = React.useState<{ code: string; language: string; light: string; dark: string; tokens: readonly CodeSyntaxToken[] } | null>(null)
  const [palette, setPalette] = React.useState<{ light: string; dark: string; colors: CodeSyntaxColors } | null>(null)
  React.useEffect(() => {
    let canceled = false
    void getSharedHighlighter({ themes: [...new Set([light, dark])], langs: [] }).then(async (highlighter) => {
      if (canceled) return
      setPalette((current) => current?.light === light && current.dark === dark ? current : {
        light, dark,
        colors: {
          light: { foreground: highlighter.getTheme(light).fg, background: highlighter.getTheme(light).bg },
          dark: { foreground: highlighter.getTheme(dark).fg, background: highlighter.getTheme(dark).bg },
        },
      })
      if (!code || code.length > 10_000 || !language || language === "text" || language === "plaintext") return
      await getSharedHighlighter({ themes: [], langs: [language] })
      if (canceled) return
      const tokens = highlighter.codeToTokensWithThemes(code, { lang: language, themes: { light, dark } }).flatMap((line) => line.map((token) => ({
        offset: token.offset,
        content: token.content,
        light: token.variants.light?.color ?? highlighter.getTheme(light).fg,
        dark: token.variants.dark?.color ?? highlighter.getTheme(dark).fg,
      })))
      if (!canceled) setResult({ code, language, light, dark, tokens })
    }).catch(() => { if (!canceled) setResult(null) })
    return () => { canceled = true }
  }, [code, language, light, dark])
  return {
    tokens: result?.code === code && result.language === language && result.light === light && result.dark === dark ? result.tokens : null,
    // The same resolver CodeBlock uses, not a second answer to the same
    // question. A CodeEditor left at "system" reads the OS while the CodeBlock
    // beside it reads the provider, and the two render in different
    // appearances inside one scope.
    mode: resolvedMode,
    colors: palette?.light === light && palette.dark === dark ? palette.colors : null,
  }
}
