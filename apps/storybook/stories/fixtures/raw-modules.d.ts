/** Vite's `?raw` suffix hands a file's text to the importer; the compiler needs telling. */
declare module "*.jsonl?raw" {
  const content: string
  export default content
}

/** The same, for the plain-text listings opencode's CLI prints. */
declare module "*.txt?raw" {
  const content: string
  export default content
}

/** And for a JSON fixture read as text, where a reader parses it itself. */
declare module "*.json?raw" {
  const content: string
  export default content
}
