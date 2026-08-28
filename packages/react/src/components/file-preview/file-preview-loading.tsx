"use client"

/** @responsibility Shared loading skeleton for the text-based preview renderers, so their fetch state looks identical. */

import * as React from "react"

import { cn } from "@/lib/utils"

/** Pulse skeleton shown while a text-based renderer fetches its contents. */
function FilePreviewTextLoading({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="file-preview-text-loading"
      aria-busy="true"
      className={cn("h-full w-full p-4", className)}
      {...props}
    >
      <div
        aria-hidden="true"
        className="h-full w-full animate-pulse rounded-lg bg-muted/60"
      />
    </div>
  )
}

export { FilePreviewTextLoading }
