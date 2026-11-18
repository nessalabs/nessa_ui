"use client"

import * as React from "react"
import { createHtmlSession } from "@pierre/words"

import { cn } from "@/lib/utils"

import { CodeBlock } from "./code-block"
import {
  MarkdownSiteLink,
  MarkdownTableBody,
  MarkdownTableCell,
  MarkdownTableFrame,
  MarkdownTableHead,
  MarkdownTableHeader,
  MarkdownTableRow,
  MarkdownFadeWord,
  MarkdownProse,
} from "./message-markdown"

const MathBlock = React.lazy(() =>
  import("./math-block").then((module) => ({ default: module.MathBlock })),
)
const MermaidDiagram = React.lazy(() =>
  import("./mermaid-diagram").then((module) => ({ default: module.MermaidDiagram })),
)

/**
 * The elements a host may draw itself, by tag name. Each receives the
 * element's attributes as props (`className`, `href`, …) and its drawn
 * children. A fenced code block never reaches `code`: only inline code does.
 */
export type ReplyMarkdownComponents = Partial<
  Record<string, React.ComponentType<Record<string, unknown> & { children?: React.ReactNode }>>
>

export interface ReplyMarkdownProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The whole Markdown source so far, typically an agent's reply. */
  children: string
  /**
   * The reply is still arriving. While true, unfinished syntax at the end
   * (`**bol`, an open link, an open fence) is completed rather than shown
   * raw, an open ```mermaid fence keeps its diagram's placeholder up, and
   * newly arrived words fade in as they do in MessageMarkdown. Flip it off
   * when the reply completes: the fades go and the text is set as written.
   */
  streaming?: boolean
  /** Elements the host draws itself, by tag name. Keep the object stable. */
  components?: ReplyMarkdownComponents
  /**
   * Draws a run of prose text — never text inside code, a link, or maths —
   * so a host can set parts of it apart (a chat id as a pill). Return the
   * text unchanged for no change. Keep the function stable.
   */
  renderText?: (text: string) => React.ReactNode
}

/* ------------------------------------------------------------------------ */
/* Words' HTML, read into a small tree.                                     */
/* ------------------------------------------------------------------------ */

/**
 * One element of Words' output. Words writes a closed, regular subset of
 * HTML — it omits raw HTML from the source, quotes every attribute value
 * with `"`, and escapes text with five entities — so this reader handles
 * exactly that subset and no more. A maths `<svg>` is kept whole as `raw`.
 */
interface ReplyElement {
  tag: string
  attrs: Record<string, string>
  children: ReplyNode[]
  raw?: string
}
type ReplyNode = ReplyElement | string

const voidTags = new Set(["br", "hr", "img", "input"])

/** Elements whose whitespace-only text is layout noise, not content. */
const structuralTags = new Set([
  "",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "ul",
  "ol",
  "blockquote",
  "section",
])

function decodeText(value: string) {
  if (!value.includes("&")) return value
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (_, name: string) =>
    name === "amp"
      ? "&"
      : name === "lt"
        ? "<"
        : name === "gt"
          ? ">"
          : name === "quot"
            ? '"'
            : "'",
  )
}

/** Reads an opening tag's attributes, from just after its name to its `>`. */
function readAttributes(html: string, from: number, to: number) {
  const attrs: Record<string, string> = {}
  let at = from
  while (at < to) {
    const code = html.charCodeAt(at)
    if (code === 32 || code === 10 || code === 47) {
      at++
      continue
    }
    const start = at
    while (at < to && !/[\s=/]/.test(html[at])) at++
    const name = html.slice(start, at)
    let value = ""
    if (html[at] === "=" && html[at + 1] === '"') {
      const close = html.indexOf('"', at + 2)
      value = decodeText(html.slice(at + 2, close))
      at = close + 1
    }
    if (name) attrs[name] = value
  }
  return attrs
}

/** The top-level blocks of a run of Words' HTML. */
function readHtml(html: string): ReplyElement[] {
  const root: ReplyElement = { tag: "", attrs: {}, children: [] }
  const stack: ReplyElement[] = [root]
  let at = 0
  while (at < html.length) {
    const parent = stack[stack.length - 1]
    if (html.charCodeAt(at) !== 60) {
      let end = html.indexOf("<", at)
      if (end < 0) end = html.length
      const text = decodeText(html.slice(at, end))
      if (!(structuralTags.has(parent.tag) && text.trim() === "")) parent.children.push(text)
      at = end
      continue
    }
    if (html.startsWith("<!--", at)) {
      const end = html.indexOf("-->", at)
      at = end < 0 ? html.length : end + 3
      continue
    }
    if (html.startsWith("</", at)) {
      const end = html.indexOf(">", at)
      const tag = html.slice(at + 2, end)
      // Close up to the matching element; a stray closer closes nothing.
      for (let depth = stack.length - 1; depth > 0; depth--) {
        if (stack[depth].tag === tag) {
          stack.length = depth
          break
        }
      }
      at = end + 1
      continue
    }
    const end = html.indexOf(">", at)
    if (end < 0) break
    let nameEnd = at + 1
    while (nameEnd < end && !/[\s/]/.test(html[nameEnd])) nameEnd++
    const tag = html.slice(at + 1, nameEnd).toLowerCase()
    if (tag === "svg") {
      const close = html.indexOf("</svg>", at)
      const stop = close < 0 ? html.length : close + 6
      parent.children.push({
        tag,
        attrs: readAttributes(html, nameEnd, end),
        children: [],
        raw: html.slice(at, stop),
      })
      at = stop
      continue
    }
    const element: ReplyElement = {
      tag,
      attrs: readAttributes(html, nameEnd, end),
      children: [],
    }
    parent.children.push(element)
    if (!voidTags.has(tag) && html[end - 1] !== "/") stack.push(element)
    at = end + 1
  }
  return root.children.filter(
    (node): node is ReplyElement => typeof node !== "string",
  )
}

/* ------------------------------------------------------------------------ */
/* The tree, drawn with the kit's components.                               */
/* ------------------------------------------------------------------------ */

interface DrawContext {
  streaming: boolean
  components: ReplyMarkdownComponents | undefined
  renderText: ((text: string) => React.ReactNode) | undefined
  /** Prefixed to footnote ids, so two replies on one page do not collide. */
  idPrefix: string
}

function textOf(node: ReplyNode): string {
  return typeof node === "string" ? node : node.children.map(textOf).join("")
}

/** Code as a Markdown code span, fenced past any run of backticks it holds. */
function codeSpan(code: string) {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length))
  const fence = "`".repeat(longest + 1)
  const pad = longest > 0 ? " " : ""
  return `${fence}${pad}${code}${pad}${fence}`
}

/** A cell's content written back as Markdown, for the table's copy control. */
function inlineMarkdown(node: ReplyNode): string {
  if (typeof node === "string") return node.replace(/[\\`*_~[\]|<]/g, "\\$&")
  const inner = node.children.map(inlineMarkdown).join("")
  switch (node.tag) {
    case "strong":
      return `**${inner}**`
    case "em":
      return `*${inner}*`
    case "del":
      return `~~${inner}~~`
    case "code":
      // A pipe ends the cell even inside code, so it stays escaped there.
      return codeSpan(textOf(node).replace(/\|/g, "\\|"))
    case "img":
      return `![${(node.attrs.alt ?? "").replace(/[[\]|]/g, "\\$&")}](${node.attrs.src ?? ""})`
    case "a":
      return `[${inner}](${node.attrs.href ?? ""})`
    case "br":
      return "<br>"
    case "svg":
      return `$${node.attrs["aria-label"] ?? ""}$`
    default:
      return inner
  }
}

function rowsOf(table: ReplyElement): ReplyElement[] {
  const rows: ReplyElement[] = []
  const visit = (node: ReplyElement) => {
    for (const child of node.children) {
      if (typeof child === "string") continue
      if (child.tag === "tr") rows.push(child)
      else visit(child)
    }
  }
  visit(table)
  return rows
}

function cellsOf(row: ReplyElement) {
  return row.children.filter(
    (cell): cell is ReplyElement =>
      typeof cell !== "string" && (cell.tag === "th" || cell.tag === "td"),
  )
}

/** The table as GFM, rebuilt from its cells; Words keeps no source offsets. */
function tableMarkdown(table: ReplyElement) {
  const rows = rowsOf(table)
  if (rows.length === 0) return null
  const header = cellsOf(rows[0])
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`
  const rule = header.map((cell) => {
    const align = cell.attrs.align
    return align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---"
  })
  return [
    line(header.map((cell) => cell.children.map(inlineMarkdown).join("").trim())),
    line(rule),
    ...rows
      .slice(1)
      .map((row) => line(cellsOf(row).map((cell) => cell.children.map(inlineMarkdown).join("").trim()))),
  ].join("\n")
}

/** "Table: Film, Venue, Date" — a name per table, as MessageMarkdown gives. */
function tableLabel(table: ReplyElement) {
  const head = rowsOf(table)[0]
  const names = head ? cellsOf(head).map((cell) => textOf(cell).trim()).filter(Boolean) : []
  return names.length ? `Table: ${names.join(", ")}` : "Table"
}

function styleObject(style: string | undefined): React.CSSProperties | undefined {
  if (!style) return undefined
  const out: Record<string, string> = {}
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":")
    if (colon < 0) continue
    const name = declaration.slice(0, colon).trim()
    if (!name) continue
    out[name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] =
      declaration.slice(colon + 1).trim()
  }
  return out
}

/**
 * A link or image address safe to put on the page, or undefined. Words'
 * session keeps addresses as written (its own renderers check them later),
 * so the check is here: web, mail, phone and chat schemes, and addresses
 * with no scheme, pass; `javascript:`, `data:`, `vbscript:` and the rest do
 * not. Spaces and control characters inside a scheme are ignored first, as
 * a browser ignores them (`java\tscript:`).
 */
function safeUrl(url: string): string | undefined {
  // eslint-disable-next-line no-control-regex -- control characters are what is stripped
  const normalized = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, "")
  if (/^[\\/][\\/]/.test(normalized) || normalized.startsWith("\\")) return undefined
  const scheme = /^([^#/?:]*):/.exec(normalized)?.[1]
  if (scheme === undefined) return url
  return /^(https?|ftp|mailto|tel|xmpp)$/i.test(scheme) ? url : undefined
}

/** The ids Words gives footnotes and their references, made unique per reply. */
const footnoteId = /^fn(ref)?-/

/** React props for an element's attributes. */
function propsOf(element: ReplyElement, context: DrawContext) {
  const props: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(element.attrs)) {
    if (name === "class") props.className = value
    else if (name === "style") props.style = styleObject(value)
    else if (name === "align") props.style = { ...(props.style as object), textAlign: value }
    else if (name === "id" && footnoteId.test(value)) props.id = context.idPrefix + value
    else if (name === "href" && footnoteId.test(value.slice(1)) && value.startsWith("#"))
      props.href = `#${context.idPrefix}${value.slice(1)}`
    else if (name === "href" || name === "src") props[name] = safeUrl(value)
    else props[name] = value
  }
  return props
}

/** Splits a run of prose into per-word spans that fade in on mount. */
function fadeWords(text: string, keyBase: string): React.ReactNode[] {
  const tokens = text.match(/\S+\s*|\s+/g) ?? []
  return tokens.map((token, index) =>
    token.trim() === "" ? (
      token
    ) : (
      <MarkdownFadeWord key={`${keyBase}.${index}`}>{token}</MarkdownFadeWord>
    ),
  )
}

/**
 * How a run of text inside an element is drawn: `literal` text (code) is
 * never faded or transformed, and `link` text fades in but is never handed
 * to `renderText`, since a link already says what it is.
 */
type TextMode = "prose" | "link" | "literal"

function modeInside(tag: string, mode: TextMode): TextMode {
  if (mode === "literal" || tag === "code" || tag === "pre") return "literal"
  if (tag === "a") return "link"
  return mode
}

function drawText(text: string, key: string, mode: TextMode, context: DrawContext) {
  if (mode === "literal") return text
  const parts = mode === "prose" && context.renderText ? context.renderText(text) : text
  const list = Array.isArray(parts) ? parts : [parts]
  const out: React.ReactNode[] = []
  list.forEach((part, index) => {
    if (typeof part === "string") {
      if (context.streaming) out.push(...fadeWords(part, `${key}.${index}`))
      else out.push(part)
    } else if (React.isValidElement(part)) {
      out.push(React.cloneElement(part, { key: `${key}.${index}` }))
    } else out.push(part)
  })
  return out.length === 1 && typeof out[0] === "string" ? out[0] : out
}

/**
 * Where Words' display maths stands as a block of its own: at the top of the
 * reply, in a list item, or in a quote, where Words writes it with no
 * paragraph around it. Anywhere else (in a line of text, in emphasis, in a
 * link, in a table cell) it is drawn in the line; a paragraph that holds
 * nothing but one takes its place (see `drawElement`).
 */
const blockParents = new Set(["", "li", "blockquote", "section", "div"])

function drawChildren(
  children: ReplyNode[],
  key: string,
  mode: TextMode,
  context: DrawContext,
  parent: string,
): React.ReactNode[] {
  return children.map((child, index) => drawNode(child, `${key}.${index}`, mode, context, parent))
}

/** One node, under an element named `parent` ("" for the reply itself). */
function drawNode(
  node: ReplyNode,
  key: string,
  mode: TextMode,
  context: DrawContext,
  parent: string,
): React.ReactNode {
  if (typeof node === "string")
    return <React.Fragment key={key}>{drawText(node, key, mode, context)}</React.Fragment>
  if (isDisplayMath(node)) return drawMath(node, key, blockParents.has(parent))
  return drawElement(node, key, mode, context)
}

/** A fenced block: Mermaid through MermaidDiagram, the rest through CodeBlock. */
function drawFence(pre: ReplyElement, key: string, context: DrawContext) {
  const code = pre.children.find(
    (child): child is ReplyElement => typeof child !== "string" && child.tag === "code",
  )
  const source = code ? textOf(code).replace(/\n$/, "") : textOf(pre)
  const language = /language-(\S+)/.exec(code?.attrs.class ?? "")?.[1]
  if (language === "mermaid") {
    // Words marks a fence still waiting for its closer; until it closes the
    // diagram keeps its placeholder rather than redrawing on every line.
    const open = context.streaming && "data-markdown-incomplete" in pre.attrs
    return (
      <React.Suspense key={key} fallback={<pre className="my-3">{source}</pre>}>
        <MermaidDiagram chart={source} streaming={open} className="my-3" />
      </React.Suspense>
    )
  }
  return <CodeBlock key={key} code={source} language={language} className="my-3" />
}

/**
 * Whether Words marked this maths as a display block. Words marks every
 * `$$…$$` so, even one in the middle of a line; it is drawn as a block only
 * where it stands as a block (see `blockParents`), and in the line
 * otherwise, as MessageMarkdown's remark-math reads one-line `$$x$$`.
 */
function isDisplayMath(node: ReplyNode): node is ReplyElement {
  return (
    typeof node !== "string" &&
    node.tag === "svg" &&
    (node.attrs.style ?? "").includes("display:block")
  )
}

/**
 * Maths, drawn by MathBlock (KaTeX) from the TeX Words read, as
 * MessageMarkdown draws it. Words' own SVG is not used: it sets glyphs in the
 * system's maths font, and a system without one (Linux, most Windows) sets
 * them in the text face, letters overlapping. Until KaTeX loads, which it
 * does only for a reply with maths in it, the TeX shows as written.
 */
function drawMath(svg: ReplyElement, key: string, display = false) {
  const tex = (svg.attrs["aria-label"] ?? "").trim()
  return (
    <React.Suspense
      key={key}
      fallback={display ? <pre className="my-3">{tex}</pre> : <code>{tex}</code>}
    >
      <MathBlock tex={tex} inline={!display} className={display ? "my-3" : undefined} />
    </React.Suspense>
  )
}

function drawTable(table: ReplyElement, key: string, context: DrawContext) {
  const draw = (node: ReplyElement, at: string): React.ReactNode => {
    const children = node.children
      .filter((child): child is ReplyElement => typeof child !== "string")
      .map((child, index) => draw(child, `${at}.${index}`))
    const props = propsOf(node, context)
    switch (node.tag) {
      case "thead":
        return <MarkdownTableHeader key={at} {...props}>{children}</MarkdownTableHeader>
      case "tbody":
        return <MarkdownTableBody key={at} {...props}>{children}</MarkdownTableBody>
      case "tr":
        return <MarkdownTableRow key={at} {...props}>{children}</MarkdownTableRow>
      case "th":
        return (
          <MarkdownTableHead key={at} {...props}>
            {drawChildren(node.children, at, "prose", context, node.tag)}
          </MarkdownTableHead>
        )
      case "td":
        return (
          <MarkdownTableCell key={at} {...props}>
            {drawChildren(node.children, at, "prose", context, node.tag)}
          </MarkdownTableCell>
        )
      default:
        return null
    }
  }
  return (
    <MarkdownTableFrame key={key} label={tableLabel(table)} markdown={tableMarkdown(table)}>
      {table.children
        .filter((child): child is ReplyElement => typeof child !== "string")
        .map((child, index) => draw(child, `${key}.${index}`))}
    </MarkdownTableFrame>
  )
}

function drawElement(
  element: ReplyElement,
  key: string,
  mode: TextMode,
  context: DrawContext,
): React.ReactNode {
  const { tag } = element
  if (tag === "svg") return drawMath(element, key, false)
  if (tag === "pre") return drawFence(element, key, context)
  if (tag === "table") return drawTable(element, key, context)
  if (tag === "p") {
    // A display equation that is all of its paragraph takes the paragraph's
    // place: it is a block, and a block cannot sit in a <p>. Anywhere else
    // its maths is drawn in the line.
    const content = element.children.filter(
      (child) => !(typeof child === "string" && child.trim() === ""),
    )
    if (content.length === 1 && isDisplayMath(content[0]))
      return drawMath(content[0], key, true)
  }
  const props = propsOf(element, context)
  const Host = context.components?.[tag]
  if (tag === "input")
    return (
      <input
        key={key}
        type="checkbox"
        disabled
        readOnly
        checked={"checked" in element.attrs}
      />
    )
  if (voidTags.has(tag)) return React.createElement(Host ?? tag, { key, ...props })
  const inner = modeInside(tag, mode)
  // Code's text reaches a host component as one string, as react-markdown
  // gives it, so a host can read what the code says.
  const children =
    inner === "literal" && element.children.every((child) => typeof child === "string")
      ? [element.children.join("")]
      : drawChildren(element.children, key, inner, context, tag)
  // Spread, so a single child (code's text) arrives as itself, not a list.
  if (Host) return React.createElement(Host, { key, ...props }, ...children)
  if (tag === "a")
    return (
      <MarkdownSiteLink key={key} streaming={context.streaming} {...props}>
        {children}
      </MarkdownSiteLink>
    )
  return React.createElement(tag, { key, ...props }, ...children)
}

/**
 * One top-level block. A finished block keeps its tree object from one
 * update to the next, so React skips it while the reply's tail streams.
 */
const ReplyBlock = React.memo(function ReplyBlock({
  node,
  index,
  context,
}: {
  node: ReplyElement
  index: number
  context: DrawContext
}) {
  return <>{drawNode(node, String(index), "prose", context, "")}</>
})

/* ------------------------------------------------------------------------ */
/* The session: finished blocks parsed once, the tail on every update.       */
/* ------------------------------------------------------------------------ */

interface ReplyCache {
  session: ReturnType<typeof createHtmlSession>
  stableHtml: string
  stable: ReplyElement[]
}

function useReplyBlocks(source: string, streaming: boolean) {
  const cache = React.useRef<ReplyCache>(null)
  return React.useMemo(() => {
    cache.current ??= { session: createHtmlSession(), stableHtml: "", stable: [] }
    const state = cache.current
    // Completion guesses what the stream will send next, so a finished
    // reply never uses it.
    const update = state.session.render(source, { incomplete: streaming, math: true })
    if (update.stable !== state.stableHtml) {
      // Finished blocks only ever grow while text is appended, and each
      // ends on a block boundary, so the new part reads on its own. Any
      // other change (an edit, a late link definition) reads it all again.
      state.stable = update.stable.startsWith(state.stableHtml)
        ? [...state.stable, ...readHtml(update.stable.slice(state.stableHtml.length))]
        : readHtml(update.stable)
      state.stableHtml = update.stable
    }
    return { stable: state.stable, pending: readHtml(update.pending) }
  }, [source, streaming])
}

/**
 * Renders an agent's reply as Markdown with Words (`@pierre/words`), a
 * WebAssembly parser that keeps the blocks it has finished: while a reply
 * streams, each update parses only the unfinished tail, where a parser that
 * starts over (MessageMarkdown's) reparses the whole reply every chunk.
 *
 * It draws the same elements MessageMarkdown does, with the same styles:
 * fenced code through CodeBlock, ```mermaid fences through MermaidDiagram,
 * tables through the kit's Table with a copy control, links led by their
 * site's Favicon, maths (`$…$`, `$$…$$`) through MathBlock, and new words
 * fading in while it streams. Raw HTML in the source is never drawn.
 *
 * Unlike MessageMarkdown it takes no remark plugins: a host changes how
 * an element is drawn through `components`, and how prose text is drawn
 * through `renderText`. Fenced code, tables, maths and task boxes are always
 * the kit's own, so `components.pre`, `table`, `svg` and `input` are not used.
 *
 * Once a reply holds a footnote or link reference definition (`[^1]: …`,
 * `[x]: url`), any later text can change what came before it, so Words
 * parses the whole reply on each update from then on, as MessageMarkdown
 * does; the output stays right.
 */
function ReplyMarkdown({
  children,
  streaming = false,
  components,
  renderText,
  className,
  ...props
}: ReplyMarkdownProps) {
  const id = React.useId()
  const { stable, pending } = useReplyBlocks(children, streaming)
  const context = React.useMemo<DrawContext>(
    () => ({ streaming, components, renderText, idPrefix: `${id}-` }),
    [streaming, components, renderText, id],
  )
  return (
    <MarkdownProse
      data-slot="reply-markdown"
      // A task list's box sits on the text's baseline, a little off it.
      className={cn("[&_li>input]:mr-1.5 [&_li>input]:align-[-0.125em]", className)}
      {...props}
    >
      {stable.map((node, index) => (
        <ReplyBlock key={index} node={node} index={index} context={context} />
      ))}
      {pending.map((node, index) => (
        <ReplyBlock
          key={stable.length + index}
          node={node}
          index={stable.length + index}
          context={context}
        />
      ))}
    </MarkdownProse>
  )
}

export { ReplyMarkdown }
