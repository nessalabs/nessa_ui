"use client"

/** @responsibility The built-in kind→renderer registry. Each strategy lives in its own module; this file only assembles the default map. */

import { FilePreviewAudio } from "./file-preview-audio"
import { FilePreviewCsv } from "./file-preview-csv"
import { FilePreviewImage } from "./file-preview-image"
import { FilePreviewJson } from "./file-preview-json"
import { FilePreviewMarkdown } from "./file-preview-markdown"
import { FilePreviewPdf } from "./file-preview-pdf"
import { FilePreviewText } from "./file-preview-text"
import { FilePreviewVideo } from "./file-preview-video"
import type { FilePreviewRendererMap } from "./file-preview-context"

/**
 * FilePreview merges consumer-provided renderers over this map, so entries
 * can be overridden or extended per use without touching the library.
 * The Office kinds (docx/xlsx/pptx) are deliberately absent: browsers cannot
 * render them natively, so they reach the fallback unless the app registers
 * its own renderer (e.g. one backed by a conversion pipeline).
 */
export const defaultFilePreviewRenderers: FilePreviewRendererMap = {
  image: FilePreviewImage,
  pdf: FilePreviewPdf,
  video: FilePreviewVideo,
  audio: FilePreviewAudio,
  markdown: FilePreviewMarkdown,
  json: FilePreviewJson,
  csv: FilePreviewCsv,
  text: FilePreviewText,
}
