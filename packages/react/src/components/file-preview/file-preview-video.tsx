"use client"

/** @responsibility The video preview strategy: delegates playback to the browser's native video element, with the fallback surface on load failure. */

import * as React from "react"

import { FilePreviewFallback } from "./file-preview-fallback"
import type { FilePreviewRendererProps } from "./file-preview-context"

/** Previews video through the native element with its built-in controls. */
function FilePreviewVideo({ file }: FilePreviewRendererProps) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [file.src])
  if (failed) {
    return <FilePreviewFallback message="Video failed to load" />
  }
  return (
    <div
      data-slot="file-preview-video"
      className="flex h-full w-full items-center justify-center bg-muted/30"
    >
      {/* Captions ship with the media stream when present; a preview surface
          has no sidecar track to offer. */}
      <video
        src={file.src}
        controls
        preload="metadata"
        aria-label={file.name ?? "Video preview"}
        onError={() => setFailed(true)}
        className="max-h-full max-w-full"
      />
    </div>
  )
}

export { FilePreviewVideo }
