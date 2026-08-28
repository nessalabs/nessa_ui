"use client"

/** @responsibility The PDF preview strategy: delegates rendering to the browser's built-in viewer with a download fallback. */

import * as React from "react"

import { FilePreviewFallback } from "./file-preview-fallback"
import type { FilePreviewRendererProps } from "./file-preview-context"

/**
 * Previews PDFs through the browser's built-in viewer via an object embed —
 * no PDF library. Chromium, WebView2, and WKWebView all render inline;
 * environments without an inline viewer (e.g. iOS Safari) get the object's
 * fallback children instead. Consumers needing full viewer control can swap
 * in their own renderer (e.g. pdf.js-based) through the `renderers` prop.
 */
function FilePreviewPdf({ file }: FilePreviewRendererProps) {
  return (
    <object
      data-slot="file-preview-pdf"
      data={file.src}
      type="application/pdf"
      aria-label={file.name ?? "PDF document"}
      className="h-full w-full"
    >
      <FilePreviewFallback message="This browser cannot preview PDFs inline" />
    </object>
  )
}

export { FilePreviewPdf }
