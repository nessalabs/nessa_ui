"use client"

/** @responsibility Re-exports the public surface of the FilePreview component system. */

export {
  detectFileKind,
  fileExtension,
  filePreviewAudioExtensions,
  filePreviewCsvExtensions,
  filePreviewDocxExtensions,
  filePreviewImageExtensions,
  filePreviewJsonExtensions,
  filePreviewMarkdownExtensions,
  filePreviewPdfExtensions,
  filePreviewPptxExtensions,
  filePreviewRawImageExtensions,
  filePreviewTextExtensions,
  filePreviewVideoExtensions,
  filePreviewXlsxExtensions,
  formatFileSize,
  type FilePreviewFile,
  type FilePreviewKind,
} from "./file-kind"
export { delimiterFor, parseDelimitedText } from "./delimited-text"
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
export { FilePreviewAudio } from "./file-preview-audio"
export { FilePreviewCsv } from "./file-preview-csv"
export { FilePreviewImage } from "./file-preview-image"
export { FilePreviewJson } from "./file-preview-json"
export { FilePreviewMarkdown } from "./file-preview-markdown"
export { FilePreviewPdf } from "./file-preview-pdf"
export { FilePreviewText } from "./file-preview-text"
export { FilePreviewTextLoading } from "./file-preview-loading"
export { FilePreviewVideo } from "./file-preview-video"
export { defaultFilePreviewRenderers } from "./file-preview-renderers"
export { useFileText, type FileTextState } from "./use-file-text"
