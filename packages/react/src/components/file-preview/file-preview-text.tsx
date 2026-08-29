"use client"

/** @responsibility The text/code preview strategy: fetches the file's text and delegates rendering to CodeBlock, using the extension as the language. */

import * as React from "react"

import { CodeBlock } from "../code-block"
import { fileExtension } from "./file-kind"
import { FilePreviewFallback } from "./file-preview-fallback"
import { FilePreviewTextLoading } from "./file-preview-loading"
import { useFileText } from "./use-file-text"
import type { FilePreviewRendererProps } from "./file-preview-context"

/**
 * Previews plain text and code through CodeBlock, so code files get syntax
 * highlighting from their extension for free.
 */
function FilePreviewText({ file }: FilePreviewRendererProps) {
  const state = useFileText(file.src)
  if (state.status === "loading") return <FilePreviewTextLoading />
  if (state.status === "error") {
    return <FilePreviewFallback message="File contents failed to load" />
  }
  return (
    <div
      data-slot="file-preview-text"
      className="h-full w-full overflow-auto p-3"
    >
      <CodeBlock
        code={state.text}
        language={fileExtension(file) ?? "txt"}
        lineNumbers
      />
    </div>
  )
}

export { FilePreviewText }
