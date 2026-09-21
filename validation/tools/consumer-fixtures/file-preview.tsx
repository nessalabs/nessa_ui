/**
 * The consumer that shows one kind of file: image attachments, nothing else.
 *
 * It exists because FilePreview is where the question was first asked — does
 * an app that previews a JPEG pay for the Markdown renderer? — and the answer
 * turned out to be about the barrel rather than about FilePreview. This row
 * is what makes that visible: it sits within a couple of kilobytes of
 * `button-only`, because what either one fetches is the entry, not the
 * component it named.
 *
 * Keep it. When the rich-content surfaces move behind subpaths or dynamic
 * imports of their own, this is the row that will say whether previewing a
 * picture got cheaper.
 */
import { FilePreview } from "@nessalabs/ui"

export function App() {
  return (
    <FilePreview
      file={{
        src: "/attachments/team-photo.png",
        name: "team-photo.png",
        mimeType: "image/png",
        size: 1_234_567,
      }}
    />
  )
}
