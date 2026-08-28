/** Vite's `?raw` suffix hands a file's text to the importer; the compiler needs telling. */
declare module "*.jsonl?raw" {
  const content: string
  export default content
}
