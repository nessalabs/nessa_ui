"use client"

/** @responsibility Re-exports the public surface of the FilePreview component system. */

export {
  detectFileKind,
  filePreviewImageExtensions,
  filePreviewPdfExtensions,
  formatFileSize,
  type FilePreviewFile,
  type FilePreviewKind,
} from "./file-kind"
export {
  useFilePreviewContext,
  type FilePreviewContextValue,
  type FilePreviewRenderer,
  type FilePreviewRendererMap,
  type FilePreviewRendererProps,
} from "./file-preview-context"
export {
  FilePreview,
  FilePreviewContent,
  FilePreviewHeader,
  type FilePreviewContentProps,
  type FilePreviewHeaderProps,
  type FilePreviewProps,
} from "./file-preview"
export {
  FilePreviewFallback,
  type FilePreviewFallbackProps,
} from "./file-preview-fallback"
export { FilePreviewImage } from "./file-preview-image"
export { FilePreviewPdf } from "./file-preview-pdf"
export { defaultFilePreviewRenderers } from "./file-preview-renderers"
