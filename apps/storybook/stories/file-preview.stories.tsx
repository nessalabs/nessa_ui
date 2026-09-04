import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"
import {
  FilePreview,
  FilePreviewContent,
  FilePreviewHeader,
  type FilePreviewRendererProps,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Files/FilePreview",
  component: FilePreview,
  tags: ["autodocs", "test"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A composable file previewer built around a renderer registry: the root detects the file's kind (MIME type first, extension fallback) and delegates rendering to the strategy registered for that kind. Images render through a script-inert img element with loading and error states; PDFs render through the browser's built-in viewer via an object embed with a download fallback for environments without an inline viewer; unknown kinds fall back to a surface that keeps the file reachable through a download link. Consumers override built-in renderers or register whole new kinds through the renderers prop — no library change needed. Sources can be plain URLs (file) or a File/Blob (blob), whose object URL lifecycle is managed internally.",
      },
    },
  },
} satisfies Meta<typeof FilePreview>

export default meta
type Story = StoryObj<typeof meta>

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#e4e4e7"/><circle cx="240" cy="160" r="90" fill="#71717a"/></svg>`
const svgSrc = `data:image/svg+xml;utf8,${encodeURIComponent(sampleSvg)}`

const minimalPdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f
trailer<</Size 4/Root 1 0 R>>
%%EOF`
const pdfSrc = `data:application/pdf;base64,${btoa(minimalPdf)}`


/**
 * Syntax highlighting loads Shiki's themes and grammars on first use, and
 * the whole suite races that one cold start. Storybook warms it at boot
 * (see .storybook/preview.ts), so this deadline is the backstop for a run
 * that starts before the warm-up lands — the same budget CodeBlock's own
 * stories give the same work. It is a deadline, not a delay: the wait ends
 * as soon as the text appears.
 */
const highlights = { timeout: 15000 } as const

export const ImagePreview: Story = {
  parameters: storyDocumentation(
    "A raster image with header chrome: file name, formatted size, and a download link. The image renderer keeps the picture contained inside the content box.",
  ),
  render: () => (
    <FilePreview
      file={{
        src: svgSrc,
        name: "team-photo.png",
        mimeType: "image/png",
        size: 1_234_567,
      }}
      className="h-80 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const image = await canvas.findByRole("img", { name: "team-photo.png" })
    await waitFor(() => expect(image).toBeVisible())
    // The settled contract, whichever way the source arrives: once the image
    // has decoded the skeleton is gone and the picture is painted rather than
    // held transparent. A source that decodes before React attaches its load
    // listener has to reach the same state by the renderer reading the
    // element itself — that path is a server-rendered mount, which this
    // client-only canvas cannot stage.
    await waitFor(async () => {
      await expect(image.closest('[data-slot="file-preview-image"]')).not.toHaveAttribute(
        "aria-busy",
      )
      await expect(getComputedStyle(image).opacity).toBe("1")
    })
    await expect(
      canvasElement.querySelector('[data-slot="file-preview-image-skeleton"]'),
    ).toBeNull()
    await expect(canvas.getByText("team-photo.png")).toBeVisible()
    await expect(canvas.getByText("1.2 MB")).toBeVisible()
    const download = canvas.getByRole("link", {
      name: "Download team-photo.png",
    })
    await expect(download).toHaveAttribute("href", svgSrc)
  },
}

export const SvgPreview: Story = {
  parameters: storyDocumentation(
    "SVG sources render through the same img-based renderer, which keeps any scripts inside the SVG inert.",
  ),
  render: () => (
    <FilePreview
      file={{ src: svgSrc, name: "diagram.svg", mimeType: "image/svg+xml" }}
      className="h-80 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const image = await canvas.findByRole("img", { name: "diagram.svg" })
    await waitFor(() => expect(image).toBeVisible())
    const root = canvasElement.querySelector('[data-slot="file-preview"]')
    await expect(root).toHaveAttribute("data-kind", "image")
  },
}

export const PdfPreview: Story = {
  parameters: storyDocumentation(
    "PDFs delegate to the browser's built-in viewer through an object embed — Chromium, WebView2, and WKWebView all render inline, and environments without an inline viewer see the embed's download fallback instead.",
  ),
  render: () => (
    <FilePreview
      file={{
        src: pdfSrc,
        name: "quarterly-report.pdf",
        mimeType: "application/pdf",
        size: 84_500,
      }}
      className="h-96 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    // Scope to the header: browsers without an inline PDF viewer also render
    // the embed's fallback, which repeats the file name.
    const header = within(
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="file-preview-header"]',
      )!,
    )
    await expect(header.getByText("quarterly-report.pdf")).toBeVisible()
    await expect(header.getByText("85 KB")).toBeVisible()
    const embed = canvasElement.querySelector('[data-slot="file-preview-pdf"]')
    await expect(embed).toHaveAttribute("type", "application/pdf")
    await expect(embed).toHaveAttribute("aria-label", "quarterly-report.pdf")
  },
}

export const UnknownFileFallback: Story = {
  parameters: storyDocumentation(
    "A file with no registered renderer falls back to a surface that names the file and keeps it reachable through a download link.",
  ),
  render: () => (
    <FilePreview
      file={{ src: "/files/archive.zip", name: "archive.zip", size: 9_000_000 }}
      className="h-72 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No preview available")).toBeVisible()
    const links = canvas.getAllByRole("link")
    for (const link of links) {
      await expect(link).toHaveAttribute("href", "/files/archive.zip")
    }
  },
}

function PlainTextRenderer({ file }: FilePreviewRendererProps) {
  return (
    <pre
      data-slot="file-preview-text"
      className="h-full w-full overflow-auto bg-muted/30 p-4 font-mono nessa-text-2 text-foreground"
    >
      Custom text renderer for {file.name}
    </pre>
  )
}

export const CustomRenderer: Story = {
  parameters: storyDocumentation(
    "The registry is open: registering a renderer under a new kind (here \"text\", paired with the kind prop) delegates that file type to consumer code without any library change. The same mechanism overrides the built-in image or pdf strategies.",
  ),
  render: () => (
    <FilePreview
      file={{ src: "/files/notes.txt", name: "notes.txt", size: 2_300 }}
      kind="text"
      renderers={{ text: PlainTextRenderer }}
      className="h-72 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(/Custom text renderer for/),
    ).toBeVisible()
    const root = canvasElement.querySelector('[data-slot="file-preview"]')
    await expect(root).toHaveAttribute("data-kind", "text")
  },
}

export const ImageError: Story = {
  parameters: storyDocumentation(
    "A source that fails to load surfaces the fallback with an error message and a download link, instead of a broken image glyph.",
  ),
  render: () => (
    <FilePreview
      file={{ src: "data:image/png;base64,AAAA", name: "missing.png" }}
      className="h-72 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(canvas.getByText(/Image failed to load/)).toBeVisible()
    })
  },
}

export const ComposedParts: Story = {
  parameters: storyDocumentation(
    "Explicit children opt into composition: the header takes extra action content, and the content part hosts the resolved renderer wherever it is placed.",
  ),
  render: () => (
    <FilePreview
      file={{ src: svgSrc, name: "cover.png", mimeType: "image/png" }}
      className="h-80 w-[28rem]"
    >
      <FilePreviewHeader>
        <span className="nessa-text-1 rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
          Draft
        </span>
      </FilePreviewHeader>
      <FilePreviewContent />
    </FilePreview>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Draft")).toBeVisible()
    const image = await canvas.findByRole("img", { name: "cover.png" })
    await waitFor(() => expect(image).toBeVisible())
  },
}

// The sample deliberately has no h1: the storybook docs check requires the
// docs page's last visible h1 (the component title) to sit in the initial
// viewport, and a story-rendered h1 further down the page breaks that.
const sampleMarkdown = `## Release notes

Version **2.4** ships the renderer registry.

- Images and PDFs
- CSV tables
`
const markdownSrc = `data:text/markdown;utf8,${encodeURIComponent(sampleMarkdown)}`

const sampleJson = JSON.stringify({ name: "nessa", stable: true, downloads: 4821 })
const jsonSrc = `data:application/json;utf8,${encodeURIComponent(sampleJson)}`

const sampleCsv = `city,country,population
Kathmandu,Nepal,845767
Reykjavik,Iceland,139875`
const csvSrc = `data:text/csv;utf8,${encodeURIComponent(sampleCsv)}`

const sampleCode = `export function greet(name: string): string {
  return \`hello \${name}\`
}`
const codeSrc = `data:text/plain;utf8,${encodeURIComponent(sampleCode)}`

export const MarkdownPreview: Story = {
  parameters: storyDocumentation(
    "Markdown files delegate to the library's own MessageMarkdown renderer, so previews match how markdown looks everywhere else in the app.",
  ),
  render: () => (
    <FilePreview
      file={{ src: markdownSrc, name: "RELEASE.md", mimeType: "text/markdown" }}
      className="h-96 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(
        canvas.getByRole("heading", { name: "Release notes" }),
      ).toBeVisible()
    })
    const root = canvasElement.querySelector('[data-slot="file-preview"]')
    await expect(root).toHaveAttribute("data-kind", "markdown")
  },
}

export const JsonPreview: Story = {
  parameters: storyDocumentation(
    "JSON files parse and delegate to JsonTree; contents that fail to parse still show as raw text through CodeBlock instead of erroring out.",
  ),
  render: () => (
    <FilePreview
      file={{ src: jsonSrc, name: "package.json" }}
      className="h-96 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(canvas.getByText(/nessa/)).toBeVisible()
    })
    await expect(
      canvasElement.querySelector('[data-slot="file-preview-json"]'),
    ).not.toBeNull()
  },
}

export const CsvPreview: Story = {
  parameters: storyDocumentation(
    "CSV and TSV files parse through a small RFC 4180 parser and delegate to the Table kit, with the first row as a sticky header.",
  ),
  render: () => (
    <FilePreview
      file={{ src: csvSrc, name: "cities.csv" }}
      className="h-96 w-[32rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(
        canvas.getByRole("columnheader", { name: "population" }),
      ).toBeVisible()
    })
    await expect(canvas.getByRole("cell", { name: "Kathmandu" })).toBeVisible()
  },
}

const tallCsv = [
  "index,value",
  ...Array.from({ length: 60 }, (_, i) => `${i + 1},${(i + 1) * 10}`),
].join("\n")
const tallCsvSrc = `data:text/csv;utf8,${encodeURIComponent(tallCsv)}`

export const CsvPreviewTall: Story = {
  parameters: storyDocumentation(
    "A delimited file taller than the host's box scrolls inside the table shell — the body scrolls under the sticky header row instead of clipping at the shell edge.",
  ),
  render: () => (
    <FilePreview
      file={{ src: tallCsvSrc, name: "readings.csv" }}
      className="h-80 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(
        canvas.getByRole("cell", { name: "600" }),
      ).toBeInTheDocument()
    })
    // The regression this guards: percentage caps resolving against an
    // auto-height frame left the container unscrollable and rows clipped.
    const container = canvasElement.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    )!
    await waitFor(async () => {
      await expect(container.scrollHeight).toBeGreaterThan(
        container.clientHeight,
      )
    })
    container.scrollTop = container.scrollHeight
    await waitFor(async () => {
      await expect(container.scrollTop).toBeGreaterThan(0)
    })
  },
}

export const CodePreview: Story = {
  parameters: storyDocumentation(
    "Text and code files delegate to CodeBlock with the file extension as the language, so code previews get syntax highlighting for free.",
  ),
  render: () => (
    <FilePreview
      file={{ src: codeSrc, name: "greet.ts" }}
      className="h-96 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    // Two waits, not one: the renderer mounts when its fetch resolves, and
    // Pierre highlights into the <diffs-container> shadow root afterwards.
    // Splitting them says which stage hung when one does.
    await waitFor(async () => {
      await expect(
        canvasElement.querySelector('[data-slot="file-preview-text"]'),
      ).not.toBeNull()
    }, highlights)
    await waitFor(async () => {
      const shadowText = canvasElement
        .querySelector('[data-slot="file-preview-text"]')
        ?.querySelector("diffs-container")?.shadowRoot?.textContent
      await expect(shadowText).toContain("greet")
    }, highlights)
    const root = canvasElement.querySelector('[data-slot="file-preview"]')
    await expect(root).toHaveAttribute("data-kind", "text")
  },
}

export const AudioPreview: Story = {
  parameters: storyDocumentation(
    "Audio files delegate playback to the browser's native audio element with its built-in controls.",
  ),
  render: () => (
    <FilePreview
      file={{
        // A minimal silent WAV so the native element loads instead of
        // tripping the error fallback.
        src: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=",
        name: "interview.wav",
        size: 4_100_000,
      }}
      className="h-72 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const audio = canvasElement.querySelector("audio")
    await expect(audio).not.toBeNull()
    await expect(audio).toHaveAttribute("controls")
    await expect(audio).toHaveAttribute("aria-label", "interview.wav")
  },
}

export const OfficeFallback: Story = {
  parameters: storyDocumentation(
    "Office formats (docx, xlsx, pptx) are detected but detection-only: browsers cannot render them natively, so they reach the fallback with the right identity, and apps with a conversion pipeline register their own renderer for those kinds.",
  ),
  render: () => (
    <FilePreview
      file={{ src: "/files/report.docx", name: "report.docx", size: 240_000 }}
      className="h-72 w-[28rem]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No preview available")).toBeVisible()
    const root = canvasElement.querySelector('[data-slot="file-preview"]')
    await expect(root).toHaveAttribute("data-kind", "docx")
  },
}
