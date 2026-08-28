"use client"

/** @responsibility Shared text-fetching hook for the text-based preview renderers (text, markdown, json, csv). */

import * as React from "react"

export type FileTextState =
  | { status: "loading"; text: null }
  | { status: "loaded"; text: string }
  | { status: "error"; text: null }

/**
 * Fetches a file's contents as text, aborting stale requests when the src
 * changes or the consumer unmounts. Works for http(s), object URLs, and
 * data: URLs alike, since fetch handles all three.
 */
export function useFileText(src: string): FileTextState {
  const [state, setState] = React.useState<FileTextState>({
    status: "loading",
    text: null,
  })
  React.useEffect(() => {
    const controller = new AbortController()
    setState({ status: "loading", text: null })
    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.text()
      })
      .then((text) => {
        // abort() cannot reject an already-settled chain, so a stale
        // response that resolved before the src changed is dropped here.
        if (!controller.signal.aborted) setState({ status: "loaded", text })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        void error
        setState({ status: "error", text: null })
      })
    return () => controller.abort()
  }, [src])
  return state
}
