"use client"

/** @responsibility The half of ToolCallDiff that needs Pierre's engine: parsing the two file versions into a diff and rendering it. Split out so the engine is fetched by the first diff on screen rather than imported by everything the barrel exports. */

import * as React from "react"
import { parseDiffFromFile } from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import type { SupportedLanguages } from "@pierre/diffs"

export interface ToolCallDiffSurfaceProps {
  from: string
  to: string
  name: string
  language?: string
  options: React.ComponentProps<typeof FileDiff>["options"]
}

/**
 * Parses and renders one diff.
 *
 * The parse lives here rather than in ToolCallDiff because it is the other
 * half of the same dependency: `parseDiffFromFile` and `FileDiff` both come
 * from `@pierre/diffs`, and splitting them would leave the caller holding a
 * static import of the package this module exists to defer.
 */
function ToolCallDiffSurface({
  from,
  to,
  name,
  language,
  options,
}: ToolCallDiffSurfaceProps) {
  const fileDiff = React.useMemo(() => {
    const lang =
      language !== undefined ? (language as SupportedLanguages) : undefined
    return parseDiffFromFile(
      { name, contents: from, ...(lang !== undefined && { lang }) },
      { name, contents: to, ...(lang !== undefined && { lang }) },
    )
  }, [from, language, name, to])
  return <FileDiff fileDiff={fileDiff} options={options} />
}

export { ToolCallDiffSurface }
