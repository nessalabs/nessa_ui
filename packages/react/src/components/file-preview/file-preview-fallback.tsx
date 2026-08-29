"use client"

/** @responsibility The FilePreview fallback surface: shown for unknown kinds and renderer failures, always keeping the file reachable via a download link. */

import * as React from "react"
import { Download, FileQuestion } from "lucide-react"

import { cn } from "@/lib/utils"
import type { FilePreviewFile } from "./file-kind"
import { useFilePreviewContext } from "./file-preview-context"

export interface FilePreviewFallbackProps extends React.ComponentProps<"div"> {
  /** Overrides the file from context; lets renderers reuse the fallback for their own error states. */
  file?: FilePreviewFile
  /** Message shown under the file name. Defaults to "No preview available". */
  message?: string
}

function FilePreviewFallback({
  file: fileProp,
  message = "No preview available",
  className,
  children,
  ...props
}: FilePreviewFallbackProps) {
  const context = useFilePreviewContext("FilePreviewFallback")
  const file = fileProp ?? context.file
  return (
    <div
      data-slot="file-preview-fallback"
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center",
        className,
      )}
      {...props}
    >
      <FileQuestion
        aria-hidden="true"
        className="size-8 text-muted-foreground"
      />
      {file?.name ? (
        <span className="nessa-text-3 max-w-full truncate font-medium text-foreground">
          {file.name}
        </span>
      ) : null}
      <span className="nessa-text-2 text-muted-foreground">{message}</span>
      {file ? (
        <a
          href={file.src}
          download={file.name}
          onClick={() => context.onDownload?.(file)}
          className="nessa-text-2 inline-flex min-h-6 items-center gap-1 rounded-md px-2 py-1 font-medium text-foreground underline underline-offset-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Download aria-hidden="true" className="size-3.5" />
          Download
        </a>
      ) : null}
      {children}
    </div>
  )
}

export { FilePreviewFallback }
