"use client"

/** @responsibility The built-in kind→renderer registry. Each strategy lives in its own module; this file only assembles the default map. */

import { FilePreviewImage } from "./file-preview-image"
import { FilePreviewPdf } from "./file-preview-pdf"
import type { FilePreviewRendererMap } from "./file-preview-context"

/**
 * FilePreview merges consumer-provided renderers over this map, so entries
 * can be overridden or extended per use without touching the library.
 */
export const defaultFilePreviewRenderers: FilePreviewRendererMap = {
  image: FilePreviewImage,
  pdf: FilePreviewPdf,
}
