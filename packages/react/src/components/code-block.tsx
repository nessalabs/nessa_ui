"use client"

import * as React from "react"
import type {
  DiffsThemeNames,
  SupportedLanguages,
  ThemesType,
} from "@pierre/diffs"
import { Check, Copy } from "lucide-react"

import { composeEventHandler } from "@/lib/compose"
import { useOptionalNessaColorMode } from "@/provider/nessa-color-mode"
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
   * picked from by `mode`. Defaults to Nessa's own restrained "nessa-dark"
   * (dark) and Light+ (light). Pierre's own themes remain available by name.
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
 * Nessa's own dark syntax theme: a neutral near-black ground that sits flush
 * with the neutral dark palette, and a deliberately restrained token set —
 * calm periwinkle keywords, sage strings, one soft accent per role instead of
 * a rainbow. Every color is chosen to clear WCAG AA 4.5:1 on the ground and
 * on diff-wash rows, comments included, so the a11y gate never trips on
 * rendered code.
 */
const nessaDarkTheme = {
  name: "nessa-dark",
  type: "dark" as const,
  bg: "#101010",
  fg: "#e6e6e6",
  colors: {
    "editor.background": "#101010",
    "editor.foreground": "#e6e6e6",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#9aa3ad" },
    },
    {
      scope: ["string", "punctuation.definition.string"],
      settings: { foreground: "#9ecb9a" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character",
        "constant.other",
      ],
      settings: { foreground: "#d8b078" },
    },
    {
      scope: [
        "keyword",
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "entity.name.tag",
      ],
      settings: { foreground: "#a8b8f8" },
    },
    {
      scope: ["keyword.operator", "punctuation"],
      settings: { foreground: "#b0b6bd" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#cbb0f0" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: "#8fd1e3" },
    },
    {
      scope: [
        "support.type.property-name",
        "variable.other.property",
        "variable.other.object.property",
        "entity.other.attribute-name",
        "meta.object-literal.key",
      ],
      settings: { foreground: "#9fc6e9" },
    },
    {
      scope: ["variable", "variable.parameter", "meta.definition.variable"],
      settings: { foreground: "#e6e6e6" },
    },
    {
      scope: ["markup.heading"],
      settings: { foreground: "#e6e6e6", fontStyle: "bold" },
    },
    {
      scope: ["markup.inline.raw", "markup.raw.block"],
      settings: { foreground: "#c9d1d9" },
    },
  ],
}

/**
 * The highlighter, loaded the first time something actually renders code.
 *
 * Pierre's engine and the Shiki grammars under it are the heaviest thing this
 * package installs, and `@pierre/diffs` runs work at module scope, so a static
 * import of it is a side effect no bundler may drop. Held statically here it
 * reached every consumer — an app rendering a Button downloaded a syntax
 * highlighter — and it did so unconditionally once code-block landed in a
 * chunk shared with modules the entry needs. Behind a dynamic import it is
 * fetched by the code block that needs it, which is the treatment
 * message-markdown already gives KaTeX and Mermaid.
 *
 * The promise is memoised, so the custom theme is registered exactly once and
 * before anything can render with it: `File` is only reachable through this
 * loader, and `registerCustomTheme` runs before the loader resolves.
 */
let highlighter: Promise<{
  File: typeof import("@pierre/diffs/react").File
  preloadHighlighter: typeof import("@pierre/diffs").preloadHighlighter
  getSharedHighlighter: typeof import("@pierre/diffs").getSharedHighlighter
}> | null = null

/**
 * Every route to the highlighter goes through here, because registration is
 * not optional: `defaultCodeTheme` names "nessa-dark", and asking the engine
 * for a theme it was never handed fails. While the registration was a module
 * side effect of this file, importing anything from it was enough; now that
 * it travels with the dynamic import, a surface that loaded `@pierre/diffs`
 * on its own would race it. So ToolCallDiff and useCodeSyntax await this too,
 * and the theme is registered once for all three.
 */
/**
 * The rejections that mean "a module this boundary owns never arrived".
 *
 * Marked per error rather than recorded in a flag, because a flag answers the
 * wrong question. Asking "has any chunk ever failed?" lets one stale fetch
 * turn every later throw on the page — including the engine's own transient
 * incremental-update errors — into a silently degraded surface for the rest
 * of the session. Asking "is *this* the error a failed import threw?" keeps
 * the boundary to the one failure it can actually answer for.
 *
 * A WeakSet rather than a property on the error: some rejections are frozen,
 * and nothing here should mutate a value it did not create. React.lazy caches
 * its rejection and re-throws the same object on every later render, so the
 * mark survives as long as the failure does.
 */
const unarrivedModules = new WeakSet<object>()

/** Marks a rejection as a module that never arrived, then re-throws it. */
function rethrowAsUnarrived(error: unknown): never {
  if (typeof error === "object" && error !== null) unarrivedModules.add(error)
  throw error
}

function isUnarrivedModule(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && unarrivedModules.has(error)
  )
}

function loadHighlighter() {
  highlighter ??= Promise.all([
    import("@pierre/diffs"),
    import("@pierre/diffs/react"),
  ])
    .then(([diffs, react]) => {
      diffs.registerCustomTheme("nessa-dark", async () => nessaDarkTheme)
      return {
        File: react.File,
        preloadHighlighter: diffs.preloadHighlighter,
        getSharedHighlighter: diffs.getSharedHighlighter,
      }
    })
    .catch((error: unknown) => {
      // The memo is cleared before the rejection travels, so one bad moment —
      // a cold service worker, a captive portal, a dropped request during
      // `preloadCodeHighlighter` at boot — does not decide that this session
      // has no highlighter. The next caller starts a fresh attempt. What
      // cannot retry is a `React.lazy` that already rejected: React caches
      // that, which is what the boundary below is for.
      highlighter = null
      return rethrowAsUnarrived(error)
    })
  return highlighter
}

const LazyFile = React.lazy(() =>
  loadHighlighter().then((module) => ({ default: module.File })),
)

export interface LazyHighlighterBoundaryProps {
  /** Shown instead of the children once a render below has thrown. */
  fallback: React.ReactNode
  children: React.ReactNode
}

/**
 * Keeps a highlighter that never arrives inside the code surface.
 *
 * Fetching the engine is a network request, and a tab held open across a
 * deploy asks for a chunk whose hashed name is gone. Unhandled, that
 * rejection travels past the Suspense boundary and unmounts the host
 * application's React root — a whole app blanked by scrolling to a code
 * block. Every surface that renders through `loadHighlighter` wraps itself in
 * this and degrades to something that still shows the content.
 *
 * It handles that failure and only that failure. A boundary here catches
 * everything the subtree throws, and the engine throws from its own
 * incremental-update paths — which a streaming diff exercises on every token.
 * Latching on one of those would pin a component to plain text for the rest
 * of the session and swallow the completed, valid render that arrives a
 * moment later. So the fallback is shown only for a rejection marked as a
 * module that never arrived; anything else is re-thrown, reaching the host
 * exactly as it did before this boundary existed.
 *
 * Surfaces that defer a module of their own — ToolCallDiff fetches its diff
 * surface alongside the engine — mark their own load failures the same way,
 * through `rethrowAsUnarrived`. A boundary that only knew about the engine
 * would re-throw theirs and blank the application, which is the failure it
 * was built to prevent.
 *
 * That is also why there is no reset key. The failure it does keep cannot be
 * retried: `React.lazy` caches its rejection and `highlighter` never
 * reassigns a settled promise, so remounting on content change would cost a
 * remount per streamed token for a recovery that cannot happen.
 */
class LazyHighlighterBoundary extends React.Component<
  LazyHighlighterBoundaryProps,
  { error: unknown }
> {
  state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (this.state.error !== null) {
      if (!isUnarrivedModule(this.state.error)) throw this.state.error
      return this.props.fallback
    }
    return this.props.children
  }
}

/**
 * The default syntax theme pair: Nessa's own restrained near-black dark
 * theme, and Light+ — the bundled light theme with the highest minimum WCAG
 * contrast.
 */
export const defaultCodeTheme: ThemesType = {
  dark: "nessa-dark",
  light: "light-plus",
}

/**
 * Loads the syntax highlighter's themes and grammars ahead of the first
 * code block that needs them. Shiki resolves both lazily, on first render,
 * so a code surface that appears during a busy moment — a streamed message,
 * a route transition — pays that cost while the user is watching. An app
 * that knows it will render code can call this once at boot and move the
 * work to an idle moment; skipping it changes nothing but the timing.
 *
 * `langs` are the file types the app expects to render, and `theme`
 * defaults to the same pair CodeBlock itself uses. Resolves when the
 * highlighter is warm, and rejects if the load itself fails. Attach a handler
 * to that rejection: nothing downstream depends on the result — a failed
 * attempt is discarded, so the first code block to render simply tries again
 * — but an ignored rejection is still an unhandled one, and reaches whatever
 * the host has watching for those.
 */
export async function preloadCodeHighlighter(
  langs: readonly SupportedLanguages[],
  theme: DiffsThemeNames | ThemesType = defaultCodeTheme,
): Promise<void> {
  const themes =
    typeof theme === "string" ? [theme] : [theme.dark, theme.light]
  const { preloadHighlighter } = await loadHighlighter()
  await preloadHighlighter({ themes, langs: [...langs] })
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

/**
 * What `"system"` means when a Nessa provider is above this component.
 *
 * It means *the provider's* resolved appearance, not the operating system's.
 * Without this the two answer the same question separately: a host that put a
 * dark provider inside a light page would get dark surfaces with light code in
 * them, because the code block asked the OS and the OS said light. The point
 * of a resolved mode is that one answer reaches everything.
 *
 * Falls through to the old behavior when there is no provider, so adopting one
 * is not all-or-nothing.
 */
function useResolvedAppearance(mode: CodeBlockMode): CodeBlockMode {
  const nessa = useOptionalNessaColorMode()
  if (mode !== "system" || !nessa) return mode
  return nessa.resolvedMode
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
  onClick,
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
      // The host's handler is composed, not replaced: a spread `onClick`
      // would land after this one and silently turn the copy button into a
      // button that does not copy. A host that means to take the click over
      // says so with `preventDefault`.
      onClick={composeEventHandler(onClick, () => {
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
      })}
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
 * What a code block looks like while its highlighter is still arriving.
 *
 * The height approximates the block from its line count instead of being a
 * fixed bar, which keeps a short snippet from reserving a screenful. It is an
 * approximation and not a reservation: the cap at 24 lines, wrapped long
 * lines, and the optional file header all mean the real block can land taller
 * than the skeleton that stood in for it.
 */
function CodeBlockSkeleton({ code }: { code: string }) {
  const lines = Math.min(code.split("\n").length, 24)
  return (
    <div
      data-slot="code-block-skeleton"
      // Hidden rather than marked busy: a bare div with no role and no name
      // carries nothing for `aria-busy` to qualify, and a screen reader has
      // no use for an empty box. The code arrives as its own insertion.
      aria-hidden="true"
      className="w-full motion-safe:animate-pulse rounded-xl bg-muted/60"
      style={{ height: `calc(${lines} * 1.5rem + 1.5rem)` }}
    />
  )
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
  const requestedMode = mode ?? config.mode ?? "system"
  const resolved = {
    theme: theme ?? config.theme ?? defaultCodeTheme,
    mode: useResolvedAppearance(requestedMode),
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
        "group/copy relative min-w-0 max-w-full overflow-hidden rounded-xl nessa-text-3 leading-6",
        className,
      )}
      {...props}
    >
      {/*
        The engine arrives with the first code block on the page, so the
        first one waits on a fetch where later ones do not. The skeleton
        holds the block's own geometry rather than collapsing the layout,
        and the copy control stays outside the boundary: the code is already
        here, only its colouring is not.
      */}
      <LazyHighlighterBoundary
        fallback={
          <pre
            data-slot="code-block-plain"
            // Focusable because it scrolls: the degraded surface is the only
            // way to read the code once the engine is gone, and a keyboard
            // user must be able to reach the part of it that is off-screen.
            tabIndex={0}
            role="region"
            aria-label={filename ?? "Code"}
            className="w-full overflow-auto rounded-xl bg-muted/40 p-4 font-mono text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {code}
          </pre>
        }
      >
        <React.Suspense fallback={<CodeBlockSkeleton code={code} />}>
          <LazyFile file={file} options={options} />
        </React.Suspense>
      </LazyHighlighterBoundary>
      <CopyButton text={code} label="Copy code" />
    </div>
  )
}

export {
  CodeBlock,
  CodeBlockProvider,
  CopyButton,
  // Internal: the other code surfaces await the loader so the custom theme is
  // registered before they ask the engine for it, share the boundary that
  // keeps a failed fetch inside the component, and mark their own failed
  // imports so that boundary recognises them. None of the three is part of
  // the package's public API.
  LazyHighlighterBoundary,
  loadHighlighter,
  rethrowAsUnarrived,
  useCodeBlockConfig,
  useResolvedAppearance,
}
