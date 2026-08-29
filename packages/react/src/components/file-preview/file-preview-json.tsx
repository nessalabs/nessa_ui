"use client"

/** @responsibility The JSON preview strategy: fetches and parses the file, delegating rendering to JsonTree — or to CodeBlock when the contents are not valid JSON. */

import * as React from "react"

import { CodeBlock } from "../code-block"
import { JsonTree } from "../json-tree"
import { FilePreviewFallback } from "./file-preview-fallback"
import { FilePreviewTextLoading } from "./file-preview-loading"
import { useFileText } from "./use-file-text"
import type { FilePreviewRendererProps } from "./file-preview-context"

/**
 * Previews JSON through the library's JsonTree. Contents that fail to parse
 * still show — as raw text through CodeBlock — instead of erroring out.
 */
function FilePreviewJson({ file }: FilePreviewRendererProps) {
  const state = useFileText(file.src)
  const parsed = React.useMemo(() => {
    if (state.status !== "loaded") return null
    try {
      return { ok: true as const, value: JSON.parse(state.text) as unknown }
    } catch {
      return { ok: false as const }
    }
  }, [state])
  if (state.status === "loading") return <FilePreviewTextLoading />
  if (state.status === "error") {
    return <FilePreviewFallback message="File contents failed to load" />
  }
  return (
    <div
      data-slot="file-preview-json"
      className="h-full w-full overflow-auto p-3"
    >
      {parsed?.ok ? (
        <JsonTree value={parsed.value} collapsible />
      ) : (
        <CodeBlock code={state.text} language="json" lineNumbers />
      )}
    </div>
  )
}

export { FilePreviewJson }
