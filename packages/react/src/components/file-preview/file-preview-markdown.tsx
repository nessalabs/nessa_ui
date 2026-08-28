"use client"

/** @responsibility The Markdown preview strategy: fetches the file's text and delegates rendering to MessageMarkdown. */

import * as React from "react"

import { MessageMarkdown } from "../message-markdown"
import { FilePreviewFallback } from "./file-preview-fallback"
import { FilePreviewTextLoading } from "./file-preview-loading"
import { useFileText } from "./use-file-text"
import type { FilePreviewRendererProps } from "./file-preview-context"

/** Previews Markdown through the library's own MessageMarkdown renderer. */
function FilePreviewMarkdown({ file }: FilePreviewRendererProps) {
  const state = useFileText(file.src)
  if (state.status === "loading") return <FilePreviewTextLoading />
  if (state.status === "error") {
    return <FilePreviewFallback message="File contents failed to load" />
  }
  return (
    <div
      data-slot="file-preview-markdown"
      className="h-full w-full overflow-auto p-4"
    >
      <MessageMarkdown>{state.text}</MessageMarkdown>
    </div>
  )
}

export { FilePreviewMarkdown }
