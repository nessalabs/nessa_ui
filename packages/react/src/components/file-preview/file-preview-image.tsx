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
  const imageRef = React.useRef<HTMLImageElement | null>(null)
  // A cached, inline, or instantly failing source settles before React
  // attaches the load/error listeners, so read the element's own state
  // rather than waiting for an event that has already fired.
  const readSettledState = React.useCallback((node: HTMLImageElement | null) => {
    imageRef.current = node
    if (node?.complete) setStatus(node.naturalWidth > 0 ? "loaded" : "error")
  }, [])
  // Reset per src so a swapped file goes back through the loading state. The
  // settled read happens here too: this effect runs after the ref callback,
  // so resetting unconditionally would undo it and leave a settled image
  // hidden behind its skeleton forever.
  React.useEffect(() => {
    const node = imageRef.current
    if (node?.complete) {
      setStatus(node.naturalWidth > 0 ? "loaded" : "error")
      return
    }
    setStatus("loading")
  }, [file.src])

  if (status === "error") {
    // Covers both a dead source and a format this engine cannot decode
    // (e.g. HEIC outside WebKit).
    return (
      <FilePreviewFallback message="Image failed to load or isn't supported by this browser" />
    )
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
