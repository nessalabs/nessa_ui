"use client"

/** @responsibility The image preview strategy: renders every image type through a plain img element with loading and error states. */

import * as React from "react"

import { cn } from "@/lib/utils"
import { FilePreviewFallback } from "./file-preview-fallback"
import type { FilePreviewRendererProps } from "./file-preview-context"

/**
 * Previews all image types with a plain img element, which keeps SVG sources
 * script-inert. Shows a pulse skeleton while loading and the fallback when
 * the source fails to decode.
 */
function FilePreviewImage({ file }: FilePreviewRendererProps) {
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">(
    "loading",
  )
  // Reset per src so a swapped file goes back through the loading state.
  React.useEffect(() => setStatus("loading"), [file.src])
  // A cached or instantly failing source can settle before React attaches the
  // load/error listeners, so read the element's own state on mount too.
  const readSettledState = React.useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setStatus(node.naturalWidth > 0 ? "loaded" : "error")
  }, [])

  if (status === "error") {
    return <FilePreviewFallback message="Image failed to load" />
  }
  return (
    <div
      data-slot="file-preview-image"
      aria-busy={status === "loading" || undefined}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
    >
      {status === "loading" ? (
        <div
          data-slot="file-preview-image-skeleton"
          aria-hidden="true"
          className="absolute inset-4 animate-pulse rounded-lg bg-muted"
        />
      ) : null}
      <img
        ref={readSettledState}
        src={file.src}
        alt={file.name ?? "Image preview"}
        draggable={false}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(
          "max-h-full max-w-full object-contain",
          status === "loading" && "opacity-0",
        )}
      />
    </div>
  )
}

export { FilePreviewImage }
