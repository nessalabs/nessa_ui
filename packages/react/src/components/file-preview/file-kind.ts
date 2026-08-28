/**
 * @responsibility Pure file-kind detection and size formatting for FilePreview.
 * No React here so the logic stays unit-testable and reusable outside the DOM.
 */

/**
 * The preview strategies FilePreview ships with. Consumers can register
 * renderers for additional kinds (e.g. "video") without widening this union;
 * the renderer map accepts arbitrary string keys.
 */
export type FilePreviewKind = "image" | "pdf" | "unknown"

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

/** Extensions treated as images, lowercase without the dot. */
export const filePreviewImageExtensions: readonly string[] = [
  "apng",
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]

/** Extensions treated as PDFs, lowercase without the dot. */
export const filePreviewPdfExtensions: readonly string[] = ["pdf"]

function kindFromMimeType(mimeType: string): FilePreviewKind {
  // Strip parameters ("application/pdf; version=1.7") before matching.
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase()
  if (normalized.startsWith("image/")) return "image"
  if (normalized === "application/pdf") return "pdf"
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

function kindFromExtension(extension: string): FilePreviewKind {
  if (filePreviewImageExtensions.includes(extension)) return "image"
  if (filePreviewPdfExtensions.includes(extension)) return "pdf"
  return "unknown"
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
  // A data: URL carries its media type inline; its payload can contain dots,
  // so it must never reach the extension path.
  if (input.src?.startsWith("data:")) {
    const mediaType = mimeTypeOfDataUrl(input.src)
    return mediaType ? kindFromMimeType(mediaType) : "unknown"
  }
  for (const candidate of [input.name, input.src]) {
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
