/**
 * @responsibility Pure RFC 4180-style delimited-text parsing for the CSV
 * preview renderer. No React here so the logic stays unit-testable.
 */

/**
 * Parses delimited text into rows of fields. Handles quoted fields, escaped
 * quotes ("") inside them, delimiters and newlines within quotes, and both
 * LF and CRLF line endings. A trailing newline does not produce an empty row.
 */
export function parseDelimitedText(
  text: string,
  delimiter: "," | "\t" = ",",
): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  // Tracks a quoted field on the current row, so a file whose last row is a
  // lone "" still flushes as one empty field at EOF.
  let sawQuote = false
  let index = 0

  const endField = () => {
    row.push(field)
    field = ""
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
    sawQuote = false
  }

  while (index < text.length) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      field += char
      index += 1
      continue
    }
    if (char === '"' && field === "") {
      inQuotes = true
      sawQuote = true
      index += 1
      continue
    }
    if (char === delimiter) {
      endField()
      index += 1
      continue
    }
    if (char === "\n" || char === "\r") {
      endRow()
      index += char === "\r" && text[index + 1] === "\n" ? 2 : 1
      continue
    }
    field += char
    index += 1
  }
  if (field !== "" || sawQuote || row.length > 0) endRow()
  return rows
}

/** Picks the delimiter for a file: tab for .tsv (or a tab-separated MIME), comma otherwise. */
export function delimiterFor(input: {
  name?: string
  mimeType?: string
}): "," | "\t" {
  if (input.mimeType?.split(";", 1)[0].trim().toLowerCase() ===
    "text/tab-separated-values")
    return "\t"
  return /\.tsv$/i.test(input.name ?? "") ? "\t" : ","
}
