"use client"

/** @responsibility The CSV/TSV preview strategy: fetches and parses the delimited text, delegating rendering to the Table kit with the first row as the header. */

import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table"
import { delimiterFor, parseDelimitedText } from "./delimited-text"
import { FilePreviewFallback } from "./file-preview-fallback"
import { FilePreviewTextLoading } from "./file-preview-loading"
import { useFileText } from "./use-file-text"
import type { FilePreviewRendererProps } from "./file-preview-context"

/** Previews delimited text through the library's Table kit. */
function FilePreviewCsv({ file }: FilePreviewRendererProps) {
  const state = useFileText(file.src)
  const rows = React.useMemo(
    () =>
      state.status === "loaded"
        ? parseDelimitedText(state.text, delimiterFor(file))
        : [],
    // delimiterFor reads only name and mimeType, so an inline file object
    // does not re-parse every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, file.name, file.mimeType],
  )
  if (state.status === "loading") return <FilePreviewTextLoading />
  if (state.status === "error") {
    return <FilePreviewFallback message="File contents failed to load" />
  }
  const [header, ...body] = rows
  if (!header) {
    return <FilePreviewFallback message="The file is empty" />
  }
  return (
    <div data-slot="file-preview-csv" className="h-full w-full overflow-auto">
      <Table containerLabel={file.name ?? "Delimited file preview"}>
        <TableHeader sticky>
          <TableRow>
            {header.map((column, index) => (
              <TableHead key={index}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {body.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {header.map((_, cellIndex) => (
                <TableCell key={cellIndex}>{row[cellIndex] ?? ""}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { FilePreviewCsv }
