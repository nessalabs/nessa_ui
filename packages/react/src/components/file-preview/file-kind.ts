/**
 * @responsibility Pure file-kind detection and size formatting for FilePreview.
 * No React here so the logic stays unit-testable and reusable outside the DOM.
 */

/**
 * The file kinds FilePreview detects. Every kind except the Office trio has a
 * built-in renderer; docx/xlsx/pptx are detection-only (browsers cannot render
 * Office formats natively) so they reach the fallback with the right identity,
 * and apps with a conversion pipeline register their own renderer for them.
 * Consumers can also register renderers for entirely new kinds without
 * widening this union; the renderer map accepts arbitrary string keys.
 */
export type FilePreviewKind =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "markdown"
  | "json"
  | "csv"
  | "text"
  | "docx"
  | "xlsx"
  | "pptx"
  | "raw"
  | "unknown"

/** A file source described by URL plus optional display metadata. */
export interface FilePreviewFile {
  /** URL of the file contents — remote, data:, or an object URL. */
  src: string
  /** Display name; also feeds extension-based kind detection. */
  name?: string
  /** MIME type; when present it wins over any extension. */
  mimeType?: string
  /** Size in bytes, shown formatted in the header. */
  size?: number
}

/**
 * Extensions treated as images, lowercase without the dot. HEIC/HEIF are
 * included even though only WebKit engines (Safari, WKWebView — e.g. Tauri
 * on Apple platforms) decode them natively; engines that cannot land on the
 * image renderer's error fallback rather than a broken glyph.
 */
export const filePreviewImageExtensions: readonly string[] = [
  "apng",
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpeg",
  "jpg",
  "jxl",
  "png",
  "svg",
  "webp",
]

/** Extensions treated as PDFs, lowercase without the dot. */
export const filePreviewPdfExtensions: readonly string[] = ["pdf"]

/** Extensions treated as video, lowercase without the dot. */
export const filePreviewVideoExtensions: readonly string[] = [
  "m4v",
  "mov",
  "mp4",
  "ogv",
  "webm",
]

/** Extensions treated as audio, lowercase without the dot. */
export const filePreviewAudioExtensions: readonly string[] = [
  "aac",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
]

/** Extensions treated as Markdown, lowercase without the dot. */
export const filePreviewMarkdownExtensions: readonly string[] = [
  "markdown",
  "md",
  "mdx",
]

/** Extensions treated as JSON, lowercase without the dot. */
export const filePreviewJsonExtensions: readonly string[] = [
  "geojson",
  "json",
]

/** Extensions treated as delimited tables, lowercase without the dot. */
export const filePreviewCsvExtensions: readonly string[] = ["csv", "tsv"]

/**
 * Extensions treated as plain text or code, lowercase without the dot. The
 * text renderer passes the extension to CodeBlock as the language, so code
 * files get syntax highlighting for free.
 */
export const filePreviewTextExtensions: readonly string[] = [
  "c",
  "cjs",
  "cpp",
  "css",
  "go",
  "h",
  "hpp",
  "html",
  "ini",
  "java",
  "js",
  "jsx",
  "log",
  "mjs",
  "py",
  "rb",
  "rs",
  "sh",
  "sql",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]

/**
 * Camera RAW extensions (detection-only; no browser engine decodes RAW, so
 * these reach the fallback with the right identity unless the app registers
 * a renderer backed by its own decoding pipeline).
 */
export const filePreviewRawImageExtensions: readonly string[] = [
  "arw",
  "cr2",
  "cr3",
  "dng",
  "nef",
  "orf",
  "raf",
  "rw2",
  "srw",
]

/** Word-processor extensions (detection-only; no built-in renderer). */
export const filePreviewDocxExtensions: readonly string[] = ["doc", "docx"]
/** Spreadsheet extensions (detection-only; no built-in renderer). */
export const filePreviewXlsxExtensions: readonly string[] = ["xls", "xlsx"]
/** Presentation extensions (detection-only; no built-in renderer). */
export const filePreviewPptxExtensions: readonly string[] = [
  "pps",
  "ppt",
  "pptx",
]

const officeMimeKinds: Readonly<Record<string, FilePreviewKind>> = {
  "application/msword": "docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "pptx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
}

// Camera RAW MIME types sit under image/* but no browser decodes them, so
// they must be caught before the image prefix match.
const rawImageMimeTypes: readonly string[] = [
  "image/x-adobe-dng",
  "image/x-canon-cr2",
  "image/x-canon-cr3",
  "image/x-fuji-raf",
  "image/x-nikon-nef",
  "image/x-olympus-orf",
  "image/x-panasonic-rw2",
  "image/x-samsung-srw",
  "image/x-sony-arw",
]

function kindFromMimeType(mimeType: string): FilePreviewKind {
  // Strip parameters ("application/pdf; version=1.7") before matching.
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase()
  if (rawImageMimeTypes.includes(normalized)) return "raw"
  if (normalized.startsWith("image/")) return "image"
  if (normalized === "application/pdf") return "pdf"
  if (normalized.startsWith("video/")) return "video"
  if (normalized.startsWith("audio/")) return "audio"
  if (normalized === "text/markdown") return "markdown"
  if (normalized === "application/json" || normalized.endsWith("+json"))
    return "json"
  if (
    normalized === "text/csv" ||
    normalized === "text/tab-separated-values"
  )
    return "csv"
  if (officeMimeKinds[normalized]) return officeMimeKinds[normalized]
  if (
    normalized.startsWith("text/") ||
    normalized === "application/xml" ||
    normalized === "application/javascript"
  )
    return "text"
  return "unknown"
}

function mimeTypeOfDataUrl(src: string): string | null {
  const match = src.match(/^data:([^;,]*)/i)
  return match ? match[1] : null
}

function extensionOf(value: string): string | null {
  // Strip query and hash so "photo.jpg?w=200#top" resolves to "jpg".
  const path = value.split(/[?#]/, 1)[0]
  const segment = path.split("/").pop() ?? ""
  const dot = segment.lastIndexOf(".")
  if (dot <= 0 || dot === segment.length - 1) return null
  return segment.slice(dot + 1).toLowerCase()
}

// Ordered specific-first: markdown/json/csv extensions must resolve to their
// own kinds before the broad text table gets a say.
const extensionKindTables: readonly (readonly [
  readonly string[],
  FilePreviewKind,
])[] = [
  // RAW before image: both are photos, but only one of them can render.
  [filePreviewRawImageExtensions, "raw"],
  [filePreviewImageExtensions, "image"],
  [filePreviewPdfExtensions, "pdf"],
  [filePreviewVideoExtensions, "video"],
  [filePreviewAudioExtensions, "audio"],
  [filePreviewMarkdownExtensions, "markdown"],
  [filePreviewJsonExtensions, "json"],
  [filePreviewCsvExtensions, "csv"],
  [filePreviewDocxExtensions, "docx"],
  [filePreviewXlsxExtensions, "xlsx"],
  [filePreviewPptxExtensions, "pptx"],
  [filePreviewTextExtensions, "text"],
]

function kindFromExtension(extension: string): FilePreviewKind {
  for (const [table, kind] of extensionKindTables) {
    if (table.includes(extension)) return kind
  }
  return "unknown"
}

/**
 * The extension of a file's name (preferred) or src pathname, lowercase —
 * what the text renderer hands CodeBlock as the language.
 */
export function fileExtension(input: {
  name?: string
  src?: string
}): string | null {
  for (const candidate of [input.name, input.src]) {
    if (!candidate || candidate.startsWith("data:")) continue
    const extension = extensionOf(candidate)
    if (extension) return extension
  }
  return null
}

/**
 * Resolves the preview kind for a file. The MIME type wins when it names a
 * known kind; generic types like application/octet-stream fall through to the
 * extension of the name, then of the src pathname.
 */
export function detectFileKind(input: {
  mimeType?: string
  name?: string
  src?: string
}): FilePreviewKind {
  if (input.mimeType) {
    const kind = kindFromMimeType(input.mimeType)
    if (kind !== "unknown") return kind
  }
  const isDataUrl = input.src?.startsWith("data:") ?? false
  if (isDataUrl) {
    // A data: URL carries its media type inline. A generic one still falls
    // through to the name below — but never to the src, whose payload can
    // contain dots that read as a bogus extension.
    const mediaType = mimeTypeOfDataUrl(input.src!)
    if (mediaType) {
      const kind = kindFromMimeType(mediaType)
      if (kind !== "unknown") return kind
    }
  }
  for (const candidate of [input.name, isDataUrl ? undefined : input.src]) {
    if (!candidate) continue
    const extension = extensionOf(candidate)
    if (!extension) continue
    const kind = kindFromExtension(extension)
    if (kind !== "unknown") return kind
  }
  return "unknown"
}

const fileSizeUnits = ["B", "KB", "MB", "GB", "TB"] as const

/** Formats a byte count for display, e.g. 1_234_567 → "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ""
  let value = bytes
  let unit = 0
  // Compare the rounded value so 999_999 bumps to "1.0 MB", not "1000 KB".
  while (Math.round(value) >= 1000 && unit < fileSizeUnits.length - 1) {
    value /= 1000
    unit += 1
  }
  if (unit === 0) return `${Math.round(value)} ${fileSizeUnits[0]}`
  const oneDecimal = value.toFixed(1)
  const rounded =
    Number(oneDecimal) >= 10 ? String(Math.round(value)) : oneDecimal
  return `${rounded} ${fileSizeUnits[unit]}`
}
