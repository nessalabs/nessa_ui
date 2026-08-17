"use client"

import * as React from "react"
import { File } from "@pierre/diffs/react"
import type {
  DiffsThemeNames,
  SupportedLanguages,
  ThemesType,
} from "@pierre/diffs"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

export type CodeBlockMode = "system" | "light" | "dark"

/**
 * Appearance shared by every code block. Set once with CodeBlockProvider to
 * theme all code surfaces — direct CodeBlock uses and the fenced blocks
 * MessageMarkdown renders — from one place; any CodeBlock prop still
 * overrides per instance.
 */
export interface CodeBlockConfig {
  /**
   * The syntax theme: a single Shiki theme name, or a `{ dark, light }` pair
   * picked from by `mode`. Defaults to Catppuccin Mocha (dark) and Light+
   * (light), the strongest WCAG-contrast performers among the bundled
   * themes. Pierre's own themes remain available by name.
   */
  theme?: DiffsThemeNames | ThemesType
  /**
   * Which side of the theme pair renders: `system` follows the OS scheme,
   * `light` and `dark` pin one side. Hosts that resolve their own color mode
   * pass it here so code blocks follow the app instead of the OS.
   */
  mode?: CodeBlockMode
  /** Show line numbers in the gutter. Off by default. */
  lineNumbers?: boolean
  /** Wrap long lines instead of scrolling horizontally. */
  wrap?: boolean
}

/**
 * The default syntax theme pair, chosen by measuring WCAG contrast across
 * every bundled Shiki theme: Catppuccin Mocha is the only dark theme whose
 * every token color — comments included, the usual offender — clears the AA
 * 4.5:1 threshold, and Light+ has the highest minimum contrast of any light
 * theme.
 */
const defaultCodeTheme: ThemesType = {
  dark: "catppuccin-mocha",
  light: "light-plus",
}

const CodeBlockContext = React.createContext<CodeBlockConfig>({})

/**
 * Reads the shared code appearance from the nearest CodeBlockProvider. Other
 * code surfaces — MermaidDiagram, custom renderers — use this to follow the
 * same app-wide mode and theming as code blocks.
 */
function useCodeBlockConfig(): CodeBlockConfig {
  return React.useContext(CodeBlockContext)
}

export interface CodeBlockProviderProps extends CodeBlockConfig {
  children?: React.ReactNode
}

/**
 * Provides the shared code appearance for a subtree — typically the app root,
 * so one theme choice applies to every code block, including those rendered
 * inside MessageMarkdown.
 */
function CodeBlockProvider({
  children,
  theme,
  mode,
  lineNumbers,
  wrap,
}: CodeBlockProviderProps) {
  const parent = React.useContext(CodeBlockContext)
  const value = React.useMemo(
    () => ({
      theme: theme ?? parent.theme,
      mode: mode ?? parent.mode,
      lineNumbers: lineNumbers ?? parent.lineNumbers,
      wrap: wrap ?? parent.wrap,
    }),
    [lineNumbers, mode, parent, theme, wrap],
  )
  return (
    <CodeBlockContext.Provider value={value}>
      {children}
    </CodeBlockContext.Provider>
  )
}

/**
 * The floating copy control shared by Nessa's rendered content surfaces. It
 * copies `text` and flips to a check mark for a moment as feedback. Reveal is
 * hover/focus-driven via the `group/copy` parent set by the owning surface.
 */
function CopyButton({
  text,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  /** The exact text placed on the clipboard. */
  text: string
  /** Accessible name for the control, e.g. "Copy code". */
  label: string
}) {
  const [copied, setCopied] = React.useState(false)
  const resetTimer = React.useRef<number>(undefined)
  React.useEffect(() => () => window.clearTimeout(resetTimer.current), [])
  return (
    <button
      type="button"
      data-slot="copy-button"
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        // Clipboard access is absent in insecure contexts and writes can be
        // denied; only show the copied state once the write actually landed.
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true)
            window.clearTimeout(resetTimer.current)
            resetTimer.current = window.setTimeout(() => setCopied(false), 2000)
          })
          .catch(() => {})
      }}
      className={cn(
        "absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover/copy:opacity-100 group-focus-within/copy:opacity-100 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  )
}

export interface CodeBlockProps
  extends Omit<React.ComponentProps<"div">, "children">,
    CodeBlockConfig {
  /** The source code to render. */
  code: string
  /** Language for syntax highlighting, e.g. "tsx". Inferred from `filename` when omitted. */
  language?: string
  /** When set, renders Pierre's file header above the code. */
  filename?: string
}

/**
 * A syntax-highlighted code block backed by Pierre's rendering engine
 * (Shiki-based highlighting with dark and light themes). Standalone it
 * renders any snippet; MessageMarkdown composes it automatically for fenced
 * code. Appearance resolves from props first, then the nearest
 * CodeBlockProvider, then defaults, so hosts theme every code surface from
 * one place.
 */
function CodeBlock({
  code,
  language,
  filename,
  theme,
  mode,
  lineNumbers,
  wrap,
  className,
  ...props
}: CodeBlockProps) {
  const config = React.useContext(CodeBlockContext)
  const resolved = {
    theme: theme ?? config.theme ?? defaultCodeTheme,
    mode: mode ?? config.mode ?? "system",
    lineNumbers: lineNumbers ?? config.lineNumbers ?? false,
    wrap: wrap ?? config.wrap ?? false,
  }
  const file = React.useMemo(
    () => ({
      name: filename ?? `snippet.${language ?? "txt"}`,
      contents: code,
      ...(language !== undefined && {
        lang: language as SupportedLanguages,
      }),
    }),
    [code, filename, language],
  )
  const options = React.useMemo(
    () => ({
      disableFileHeader: filename === undefined,
      disableLineNumbers: !resolved.lineNumbers,
      overflow: resolved.wrap ? ("wrap" as const) : ("scroll" as const),
      themeType: resolved.mode,
      ...(resolved.theme !== undefined && { theme: resolved.theme }),
    }),
    [filename, resolved.lineNumbers, resolved.mode, resolved.theme, resolved.wrap],
  )
  return (
    <div
      data-slot="code-block"
      className={cn(
        "group/copy relative min-w-0 max-w-full overflow-hidden rounded-xl text-[0.8125rem] leading-6",
        className,
      )}
      {...props}
    >
      <File file={file} options={options} />
      <CopyButton text={code} label="Copy code" />
    </div>
  )
}

export { CodeBlock, CodeBlockProvider, CopyButton, useCodeBlockConfig }
