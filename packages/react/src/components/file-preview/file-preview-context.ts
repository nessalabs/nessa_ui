"use client"

/** @responsibility Shared context wiring for the FilePreview compound parts. */

import * as React from "react"

import type { FilePreviewFile, FilePreviewKind } from "./file-kind"

/** Props every renderer receives from FilePreviewContent. */
export interface FilePreviewRendererProps {
  file: FilePreviewFile
  kind: FilePreviewKind
}

/** A preview strategy for one file kind. */
export type FilePreviewRenderer = React.ComponentType<FilePreviewRendererProps>

/**
 * Maps file kinds to renderers. Keys beyond the built-in union are allowed so
 * consumers can register new kinds (paired with a custom `kind` prop) without
 * a library change.
 */
export type FilePreviewRendererMap = Partial<
  Record<FilePreviewKind | (string & {}), FilePreviewRenderer>
>

export interface FilePreviewContextValue {
  /** The resolved file, after any blob has become an object URL. Null while a blob's URL is still being created. */
  file: FilePreviewFile | null
  kind: FilePreviewKind | (string & {})
  /** The renderer resolved for `kind`, already falling back for unknown kinds. */
  renderer: FilePreviewRenderer
  onDownload?: (file: FilePreviewFile) => void
}

export const FilePreviewContext =
  React.createContext<FilePreviewContextValue | null>(null)

export function useFilePreviewContext(
  consumer: string,
): FilePreviewContextValue {
  const context = React.useContext(FilePreviewContext)
  if (!context) {
    throw new Error(`${consumer} must be rendered inside a FilePreview.`)
  }
  return context
}
