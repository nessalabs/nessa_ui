"use client"

/** @responsibility The audio preview strategy: delegates playback to the browser's native audio element, with the fallback surface on load failure. */

import * as React from "react"
import { Music } from "lucide-react"

import { FilePreviewFallback } from "./file-preview-fallback"
import type { FilePreviewRendererProps } from "./file-preview-context"

/** Previews audio through the native element with its built-in controls. */
function FilePreviewAudio({ file }: FilePreviewRendererProps) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [file.src])
  if (failed) {
    return <FilePreviewFallback message="Audio failed to load" />
  }
  return (
    <div
      data-slot="file-preview-audio"
      className="flex h-full w-full flex-col items-center justify-center gap-4 p-6"
    >
      <Music aria-hidden="true" className="size-8 text-muted-foreground" />
      <audio
        src={file.src}
        controls
        preload="metadata"
        aria-label={file.name ?? "Audio preview"}
        onError={() => setFailed(true)}
        className="w-full max-w-md"
      />
    </div>
  )
}

export { FilePreviewAudio }
