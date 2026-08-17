"use client"

import * as React from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { cn } from "@/lib/utils"
import { CodeBlock, CopyButton } from "./code-block"
import { MathBlock } from "./math-block"
import { MermaidDiagram } from "./mermaid-diagram"

export interface MessageMarkdownProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The markdown source, typically an assistant reply. */
  children: string
  /** Per-element renderer overrides forwarded to react-markdown. */
  components?: Components
  /**
   * While true, newly arrived prose fades in with the same animation
   * MessageStreamText uses, so streamed markdown and streamed plain text
   * feel identical. Code, math, and diagram content is never animated. Flip
   * it off when the reply completes and the animation wrappers disappear,
   * leaving plain DOM.
   */
  streaming?: boolean
}

interface FadeHastNode {
  type: string
  tagName?: string
  value?: string
  children?: FadeHastNode[]
  properties?: Record<string, unknown>
}

/** Content whose internal text must never be split into animation spans. */
const fadeSkipTags = new Set(["code", "pre", "svg", "math", "style", "script"])

/**
 * The same mount-fade MessageStreamText applies per character, at word
 * granularity so long documents stay light: each newly mounted span starts
 * transparent and fades in, and the trailing word keeps filling inside its
 * still-fading span as characters arrive.
 */
const fadeSpanClass =
  "opacity-100 transition-opacity duration-1000 ease-out starting:opacity-0 motion-reduce:transition-none"

/**
 * Rehype plugin that wraps prose text in per-word spans which fade in on
 * mount. React reconciles the growing tree by position, so appended words
 * animate while text already on screen stays untouched; when the streaming
 * tail reparses into a new structure (a word gaining emphasis, a line
 * becoming a list item), that subtree remounts and re-fades once — the same
 * behavior as any mount-animation renderer. Whitespace-only text nodes stay
 * unwrapped: tables in particular are padded with newline nodes between rows
 * and cells, and wrapping those would inject spans directly inside <tr>.
 */
function rehypeStreamFade() {
  const splitTextNodes = (node: FadeHastNode) => {
    if (node.type === "element" && fadeSkipTags.has(node.tagName ?? "")) return
    if (node.children === undefined) return
    const next: FadeHastNode[] = []
    for (const child of node.children) {
      if (
        child.type === "text" &&
        typeof child.value === "string" &&
        child.value.trim() !== ""
      ) {
        const tokens = child.value.match(/\S+\s*|\s+/g) ?? []
        for (const token of tokens) {
          if (token.trim() === "") {
            next.push({ type: "text", value: token })
          } else {
            next.push({
              type: "element",
              tagName: "span",
              properties: { className: fadeSpanClass },
              children: [{ type: "text", value: token }],
            })
          }
        }
      } else {
        splitTextNodes(child)
        next.push(child)
      }
    }
    node.children = next
  }
  return splitTextNodes
}

const streamingRehypePlugins = [rehypeStreamFade]
const staticRehypePlugins: never[] = []

/** Pulls the source text and language out of a fenced code block's <code>. */
function extractFencedCode(
  node: React.ReactNode,
): { code: string; language: string | undefined; isMath: boolean } | null {
  if (!React.isValidElement(node)) return null
  const { className, children } = node.props as {
    className?: string
    children?: React.ReactNode
  }
  if (typeof children !== "string") return null
  const language = /language-(\S+)/.exec(className ?? "")?.[1]
  return {
    code: children.replace(/\n$/, ""),
    language,
    isMath: (className ?? "").includes("math-display"),
  }
}

/**
 * Carries the current markdown source to renderers that need to slice it —
 * the table copy control — without recreating renderer functions per render.
 */
const MarkdownSourceContext = React.createContext("")

type PreProps = React.ComponentProps<"pre"> & { node?: unknown }

/**
 * Routes fenced code to the specialized surfaces: MathBlock for `$$…$$`
 * math, MermaidDiagram for ```mermaid fences (sequence diagrams included),
 * CodeBlock for everything else. Defined at module scope so its identity is
 * stable across renders — while a reply streams, the block components update
 * in place instead of remounting on every chunk, which would flicker between
 * source text and rendered output.
 */
function MarkdownPre({ node: _node, children, ...rest }: PreProps) {
  const fenced = extractFencedCode(children)
  if (fenced === null) return <pre {...rest}>{children}</pre>
  if (fenced.isMath) return <MathBlock tex={fenced.code} className="my-3" />
  if (fenced.language === "mermaid") {
    return <MermaidDiagram chart={fenced.code} className="my-3" />
  }
  return (
    <CodeBlock code={fenced.code} language={fenced.language} className="my-3" />
  )
}

type CodeProps = React.ComponentProps<"code"> & { node?: unknown }

function MarkdownCode({ node: _node, className, children, ...rest }: CodeProps) {
  if ((className ?? "").includes("math-inline") && typeof children === "string") {
    return <MathBlock inline tex={children} />
  }
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  )
}

type TableProps = React.ComponentProps<"table"> & {
  node?: { position?: { start: { offset?: number }; end: { offset?: number } } }
}

/** Wraps tables with a copy control that copies their markdown source. */
function MarkdownTable({ node, children, ...rest }: TableProps) {
  const source = React.useContext(MarkdownSourceContext)
  const start = node?.position?.start.offset
  const end = node?.position?.end.offset
  const markdown =
    start !== undefined && end !== undefined ? source.slice(start, end) : null
  if (markdown === null) return <table {...rest}>{children}</table>
  return (
    <span className="group/copy relative block w-fit max-w-full">
      <table {...rest}>{children}</table>
      <CopyButton
        text={markdown}
        label="Copy table"
        className="right-0 top-0"
      />
    </span>
  )
}

const defaultComponents: Components = {
  pre: MarkdownPre,
  code: MarkdownCode,
  table: MarkdownTable,
}

/**
 * Renders assistant markdown inside a message: GitHub-flavored markdown plus
 * TeX math (`$…$` inline, `$$…$$` display) rendered through MathBlock,
 * fenced code highlighted through CodeBlock, and ```mermaid fences drawn
 * through MermaidDiagram — all styled with Nessa tokens and following the
 * nearest CodeBlockProvider, so the host's code theme and color mode apply
 * app-wide. Code, tables, and display math each carry a copy control that
 * copies their original markdown source. Compose it inside a plain
 * MessageBubble; while a reply streams, keep passing the partial source with
 * `streaming` set and the latest complete blocks render while newly arrived
 * prose fades in with the same animation MessageStreamText uses.
 */
function MessageMarkdown({
  children,
  components,
  streaming = false,
  className,
  ...props
}: MessageMarkdownProps) {
  return (
    <div
      data-slot="message-markdown"
      className={cn(
        // whitespace-normal guards against inheriting pre-wrap from a
        // MessageBubble, which would render the newlines between markdown
        // blocks as extra blank lines on top of the block margins.
        "min-w-0 max-w-full whitespace-normal text-sm leading-6 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:my-3",
        "[&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-semibold",
        "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li]:pl-1",
        // The :not guards keep inline-code and fallback <pre> styling away
        // from the DOM rendered by the code, math, and diagram surfaces.
        "[&_code:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:rounded-md [&_code:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:bg-muted [&_code:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:px-1.5 [&_code:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:py-0.5 [&_code:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:font-mono [&_code:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:text-[0.8125em]",
        "[&_pre:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:my-3 [&_pre:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:overflow-x-auto [&_pre:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:rounded-xl [&_pre:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:bg-muted [&_pre:not([data-slot=code-block]_*,[data-slot=math-block]_*,[data-slot=mermaid-diagram]_*)]:p-3",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2",
        "[&_table]:my-3 [&_table]:block [&_table]:w-fit [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5",
        "[&_hr]:my-4 [&_hr]:border-border",
        "[&_img]:max-w-full [&_img]:rounded-xl",
        "[&_.katex-display]:my-0 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1",
        className,
      )}
      {...props}
    >
      <MarkdownSourceContext.Provider value={children}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={streaming ? streamingRehypePlugins : staticRehypePlugins}
          components={{ ...defaultComponents, ...components }}
        >
          {children}
        </ReactMarkdown>
      </MarkdownSourceContext.Provider>
    </div>
  )
}

export { MessageMarkdown }
