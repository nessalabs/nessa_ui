export function countOccurrences(source: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let cursor = 0
  while ((cursor = source.indexOf(needle, cursor)) !== -1) {
    count += 1
    cursor += needle.length
  }
  return count
}

export function slugifyHeading(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}
