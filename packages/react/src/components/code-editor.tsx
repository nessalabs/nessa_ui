"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { Popover } from "radix-ui"

import { usePortalContainer } from "@/lib/portal-container"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { PopoverSurface } from "./popover-surface"
import { SearchableListbox } from "./searchable-listbox"
import { useCodeSyntax } from "./code-editor-syntax"
import { useCodeBlockConfig } from "./code-block"

const codeSurfaceDarkModeClassName = "dark:[--nessa-code-background:var(--nessa-code-bg-dark)]"

/** One language offered by the code editor's searchable picker. Values must be unique. */
export interface CodeEditorLanguage {
  value: string
  label: string
}

const defaultLanguages: readonly CodeEditorLanguage[] = [
  { value: "text", label: "Plain text" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "go", label: "Go" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "jsx", label: "JSX" },
  { value: "kotlin", label: "Kotlin" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "tsx", label: "TSX" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
]

/** Configures an editable code surface and its controlled language selection. */
export interface CodeEditorProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** Current code for the built-in textarea. Ignored when children supplies an editor. */
  value?: string
  onValueChange?: (value: string) => void
  /** Selected language identifier. Unknown identifiers remain visible. Defaults to text. */
  language?: string
  onLanguageChange?: (language: string) => void
  /** Replaces the default language catalog. Values are searched alongside labels. */
  languages?: readonly CodeEditorLanguage[]
  /** Disables the picker and built-in textarea; custom children own their editing state. */
  disabled?: boolean
  /** Replaces only the editing area, for example with a framework-owned node content view. */
  children?: React.ReactNode
  /** Native textarea attributes, including its accessible name, rows, and placeholder. */
  textareaProps?: Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange" | "disabled">
}

/** Returns the stable selection value for one code language. */
function languageValue(language: CodeEditorLanguage) { return language.value }

/** Searches both human-readable names and fence identifiers. */
function languageKeywords(language: CodeEditorLanguage) { return [language.label, language.value] }

/**
 * Renders a responsive code surface with a searchable language picker and a
 * controlled native textarea with syntax colors from the shared code themes.
 * Children can replace the textarea while preserving the same chrome. The non-editable header can
 * be embedded in a structured editor's node view. Language changes never alter
 * code or submit a containing form. Unknown language values are preserved.
 */
export function CodeEditor({
  value = "",
  onValueChange,
  language = "text",
  onLanguageChange,
  languages = defaultLanguages,
  disabled = false,
  children,
  textareaProps,
  className,
  style,
  ...props
}: CodeEditorProps) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const overlayRef = React.useRef<HTMLPreElement | null>(null)
  const codeConfig = useCodeBlockConfig()
  // The default editor keeps its inset surface; explicit code themes retain their palette.
  const themedSurface = codeConfig.theme != null
  const syntax = useCodeSyntax(children == null ? value : "", language)
  const highlighted = syntax.tokens !== null && value.length > 0 && !selected
  React.useImperativeHandle(textareaProps?.ref, () => textareaRef.current!, [children])
  React.useLayoutEffect(() => {
    const textarea = textareaRef.current
    const overlay = overlayRef.current
    if (!textarea || !overlay) return
    const sync = () => {
      const css = getComputedStyle(textarea)
      // Copy computed metrics so consumer typography/spacing and resize handles
      // cannot move the colored glyphs away from the native caret.
      for (const property of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant", "fontFeatureSettings", "fontVariationSettings", "lineHeight", "letterSpacing", "wordSpacing", "tabSize", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "textAlign", "textIndent", "textTransform", "direction", "whiteSpace", "overflowWrap", "wordBreak"] as const) {
        overlay.style[property] = css[property]
      }
      overlay.style.width = `${textarea.clientWidth}px`
      overlay.style.height = `${textarea.clientHeight}px`
      overlay.style.left = `${textarea.offsetLeft + textarea.clientLeft}px`
      overlay.style.top = `${textarea.offsetTop + textarea.clientTop}px`
      overlay.scrollTop = textarea.scrollTop
      overlay.scrollLeft = textarea.scrollLeft
    }
    sync()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(sync)
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [value, syntax.tokens, textareaProps?.className, textareaProps?.style, children])
  const coloredText: React.ReactNode[] = []
  let offset = 0
  for (const token of syntax.tokens ?? []) {
    if (token.offset > offset) coloredText.push(value.slice(offset, token.offset))
    coloredText.push(<span key={token.offset} className="nessa-code-token" style={{ "--code-light": token.light, "--code-dark": token.dark } as React.CSSProperties}>{token.content}</span>)
    offset = token.offset + token.content.length
  }
  if (offset < value.length) coloredText.push(value.slice(offset))
  React.useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  // No prop of its own: a layer with no opinion belongs to whatever panel
  // it was opened from, and to the body when there is none.
  const portalContainer = usePortalContainer()
  const label = languages.find((item) => item.value === language)?.label ?? language
  return (
    <div data-slot="code-editor" data-code-mode={syntax.mode} className={cn(codeSurfaceDarkModeClassName, "min-w-0 w-full overflow-hidden rounded-lg caret-[var(--nessa-code-foreground)] bg-[var(--nessa-code-background)] text-[var(--nessa-code-foreground)] [--nessa-code-foreground:var(--nessa-code-fg-light)] [--nessa-code-background:var(--nessa-code-bg-light)] dark:[--nessa-code-foreground:var(--nessa-code-fg-dark)] data-[code-mode=light]:[--nessa-code-foreground:var(--nessa-code-fg-light)]! data-[code-mode=light]:[--nessa-code-background:var(--nessa-code-bg-light)]! data-[code-mode=dark]:[--nessa-code-foreground:var(--nessa-code-fg-dark)]! data-[code-mode=dark]:[--nessa-code-background:var(--nessa-code-bg-dark)]! [&_.nessa-code-token]:text-[var(--code-light)] dark:[&_.nessa-code-token]:text-[var(--code-dark)] [&[data-code-mode=light]_.nessa-code-token]:text-[var(--code-light)]! [&[data-code-mode=dark]_.nessa-code-token]:text-[var(--code-dark)]!", className)} style={{
      "--nessa-code-fg-light": syntax.colors?.light.foreground ?? "var(--foreground)",
      "--nessa-code-fg-dark": syntax.colors?.dark.foreground ?? "var(--foreground)",
      "--nessa-code-bg-light": themedSurface ? syntax.colors?.light.background ?? "var(--muted)" : syntax.colors ? `color-mix(in srgb, ${syntax.colors.light.foreground} 5%, ${syntax.colors.light.background})` : "var(--muted)",
      "--nessa-code-header-light": themedSurface ? syntax.colors?.light.background ?? "var(--muted)" : syntax.colors ? `color-mix(in srgb, ${syntax.colors.light.foreground} 8%, ${syntax.colors.light.background})` : "var(--muted)",
      "--nessa-code-bg-dark": themedSurface ? syntax.colors?.dark.background ?? "var(--muted)" : syntax.colors ? `color-mix(in srgb, ${syntax.colors.dark.foreground} 12%, ${syntax.colors.dark.background})` : "var(--muted)",
      ...style,
    } as React.CSSProperties} {...props}>
      <div data-slot="code-editor-header" data-code-mode={syntax.mode} contentEditable={false} className={cn(codeSurfaceDarkModeClassName, "flex items-center justify-between border-b border-border px-2 py-1 bg-[var(--nessa-code-background)] [--nessa-code-background:var(--nessa-code-header-light)] data-[code-mode=light]:[--nessa-code-background:var(--nessa-code-header-light)]! data-[code-mode=dark]:[--nessa-code-background:var(--nessa-code-bg-dark)]!")}>
        <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-inherit hover:text-inherit hover:bg-transparent" disabled={disabled} aria-label={`Code language: ${label}`}>
              {label}<ChevronDown aria-hidden="true" />
            </Button>
          </Popover.Trigger>
          <Popover.Portal container={portalContainer}>
            <PopoverSurface asChild>
              <Popover.Content aria-label="Choose code language" align="start" className="z-50 w-64 max-w-[var(--radix-popover-content-available-width)] overflow-hidden outline-none" onKeyDown={(event) => event.stopPropagation()}>
                <SearchableListbox
                  items={languages}
                  getItemId={languageValue}
                  getItemKeywords={languageKeywords}
                  value={language}
                  onValueChange={(next) => { onLanguageChange?.(next); setOpen(false) }}
                  searchPlaceholder="Search languages"
                  listLabel="Code languages"
                  emptyMessage="No matching languages"
                  renderItem={(item, { selected }) => <span className="flex w-full items-center justify-between gap-2">{item.label}{selected && <Check aria-hidden="true" className="size-4" />}</span>}
                />
              </Popover.Content>
            </PopoverSurface>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {children ?? (
        <div className={cn("relative min-w-0", disabled && "opacity-50")}>
        <pre ref={overlayRef} data-slot="code-editor-highlight" aria-hidden="true" className={cn("pointer-events-none absolute z-10 m-0 box-border overflow-hidden border-0 bg-transparent", !highlighted && "invisible")}>{coloredText}{value.endsWith("\n") ? " " : null}</pre>
        <textarea
          {...textareaProps}
          ref={textareaRef}
          data-slot="code-editor-input"
          aria-label={textareaProps?.["aria-label"] ?? "Code"}
          rows={textareaProps?.rows ?? 6}
          spellCheck={textareaProps?.spellCheck ?? false}
          value={value}
          onChange={(event) => onValueChange?.(event.target.value)}
          disabled={disabled}
          onSelect={(event) => {
            setSelected(event.currentTarget.selectionStart !== event.currentTarget.selectionEnd)
            textareaProps?.onSelect?.(event)
          }}
          onScroll={(event) => {
            if (overlayRef.current) {
              overlayRef.current.scrollTop = event.currentTarget.scrollTop
              overlayRef.current.scrollLeft = event.currentTarget.scrollLeft
            }
            textareaProps?.onScroll?.(event)
          }}
          style={textareaProps?.style}
          className={cn("relative block min-w-0 w-full resize-y bg-transparent p-3 font-mono nessa-text-4 caret-[var(--nessa-code-foreground)] selection:bg-accent selection:text-foreground selection:[-webkit-text-fill-color:var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed", textareaProps?.className, highlighted && "text-transparent [-webkit-text-fill-color:transparent] selection:[-webkit-text-fill-color:var(--foreground)]")}
        />
        </div>
      )}
    </div>
  )
}
