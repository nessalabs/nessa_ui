"use client"

/** @responsibility The FilePreview root and chrome: resolves the file source and kind, picks the renderer from the registry, and provides Header/Content compound parts. */

import * as React from "react"
import { Download } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  detectFileKind,
  formatFileSize,
  type FilePreviewFile,
  type FilePreviewKind,
} from "./file-kind"
import {
  FilePreviewContext,
  useFilePreviewContext,
  type FilePreviewContextValue,
  type FilePreviewRendererMap,
} from "./file-preview-context"
import { FilePreviewFallback } from "./file-preview-fallback"

// FilePreviewFallback spreads extra props onto its div, so it cannot serve as
// a renderer directly — the renderer contract's `kind` prop would land on the
// DOM as a bogus attribute.
const fallbackRenderer = ({ file }: { file: FilePreviewFile }) => (
  <FilePreviewFallback file={file} />
)
import { defaultFilePreviewRenderers } from "./file-preview-renderers"

export interface FilePreviewProps extends React.ComponentProps<"div"> {
  /** The file to preview, described by URL plus optional metadata. Exactly one of `file` and `blob` must be set. */
  file?: FilePreviewFile
  /** A File or Blob to preview; an object URL is created and revoked internally. */
  blob?: File | Blob
  /** Overrides kind detection — required when registering renderers for custom kinds. */
  kind?: FilePreviewKind | (string & {})
  /** Extra or replacement renderers, merged over the built-in registry. */
  renderers?: FilePreviewRendererMap
  /** Called when the download link is activated. */
  onDownload?: (file: FilePreviewFile) => void
}

function useObjectUrl(blob: File | Blob | undefined): string | null {
  const [entry, setEntry] = React.useState<{
    blob: File | Blob
    url: string
  } | null>(null)
  React.useEffect(() => {
    if (!blob) {
      setEntry(null)
      return
    }
    const url = URL.createObjectURL(blob)
    setEntry({ blob, url })
    return () => URL.revokeObjectURL(url)
  }, [blob])
  // On a blob swap the state still holds the previous blob's (soon revoked)
  // URL for one render; report null so that frame shows the skeleton instead
  // of pairing the new blob's metadata with the old image.
  return entry && entry.blob === blob ? entry.url : null
}

function FilePreview({
  file: fileProp,
  blob,
  kind: kindProp,
  renderers,
  onDownload,
  className,
  children,
  ...props
}: FilePreviewProps) {
  if (process.env.NODE_ENV !== "production") {
    if ((fileProp && blob) || (!fileProp && !blob)) {
      console.warn("FilePreview expects exactly one of `file` or `blob`.")
    }
  }

  const objectUrl = useObjectUrl(blob)
  const file = React.useMemo<FilePreviewFile | null>(() => {
    if (fileProp) return fileProp
    if (blob && objectUrl) {
      return {
        src: objectUrl,
        name: blob instanceof File ? blob.name : undefined,
        mimeType: blob.type || undefined,
        size: blob.size,
      }
    }
    return null
  }, [fileProp, blob, objectUrl])

  const kind = kindProp ?? (file ? detectFileKind(file) : "unknown")
  const mergedRenderers = React.useMemo(
    () => ({ ...defaultFilePreviewRenderers, ...renderers }),
    [renderers],
  )
  const renderer = mergedRenderers[kind] ?? fallbackRenderer

  const contextValue = React.useMemo<FilePreviewContextValue>(
    () => ({ file, kind, renderer, onDownload }),
    [file, kind, renderer, onDownload],
  )

  return (
    <FilePreviewContext.Provider value={contextValue}>
      <div
        data-slot="file-preview"
        data-kind={kind}
        role="group"
        aria-label={file?.name ?? "File preview"}
        className={cn(
          "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <FilePreviewHeader />
            <FilePreviewContent />
          </>
        )}
      </div>
    </FilePreviewContext.Provider>
  )
}

export interface FilePreviewHeaderProps extends React.ComponentProps<"div"> {}

/** File name, formatted size, and a download link. Renders its children after the name block for extra actions. */
function FilePreviewHeader({
  className,
  children,
  ...props
}: FilePreviewHeaderProps) {
  const { file, onDownload } = useFilePreviewContext("FilePreviewHeader")
  return (
    <div
      data-slot="file-preview-header"
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-border px-3 py-2",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="nessa-text-3 truncate font-medium text-foreground">
          {file?.name ?? "Untitled file"}
        </span>
        {file?.size !== undefined ? (
          <span className="nessa-text-1 text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
        ) : null}
      </div>
      {children}
      {file ? (
        <a
          href={file.src}
          download={file.name}
          aria-label={`Download ${file.name ?? "file"}`}
          onClick={() => onDownload?.(file)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Download aria-hidden="true" className="size-4" />
        </a>
      ) : null}
    </div>
  )
}

export interface FilePreviewContentProps extends React.ComponentProps<"div"> {}

/** Hosts the renderer resolved for the file's kind. */
function FilePreviewContent({
  className,
  children,
  ...props
}: FilePreviewContentProps) {
  const { file, kind, renderer: Renderer } =
    useFilePreviewContext("FilePreviewContent")
  return (
    <div
      data-slot="file-preview-content"
      aria-busy={!children && !file ? true : undefined}
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
      {...props}
    >
      {children ??
        (file ? (
          <Renderer file={file} kind={kind as FilePreviewKind} />
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full animate-pulse bg-muted/50"
          />
        ))}
    </div>
  )
}

export { FilePreview, FilePreviewContent, FilePreviewHeader }
