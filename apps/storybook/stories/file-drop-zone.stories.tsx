import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, waitFor, within } from "storybook/test"
import {
  Button,
  ChatComposer,
  ChatComposerAction,
  ChatComposerActions,
  ChatComposerAttachment,
  ChatComposerAttachments,
  ChatComposerFooter,
  ChatComposerInput,
  ChatComposerSubmit,
  FileDropZone,
  type FileDropRejection,
} from "@nessa-ui/react"
import { ImagePlus, Paperclip } from "lucide-react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Components/FileDropZone",
  component: FileDropZone,
  tags: ["autodocs", "test"],
  // Every story renders its own host, so the required callback is only here
  // to satisfy the component's argument type.
  args: { onFiles: () => {} },
  parameters: {
    docs: {
      description: {
        component:
          "A wrapper that turns whatever it contains into a file drop target. Drag files or folders anywhere over the wrapped subtree and the zone hands the host a filtered File list through onFiles; the host stores them as attachments and renders them however it likes. The zone owns only the drag protocol: depth-counted enter and leave bookkeeping so nested children cannot flicker the state, dropEffect and the preventDefault that stops the browser from navigating to the file, recursive folder expansion through the directory-entry API, the accept, maxSize, maxFiles, and multiple rules with every refusal reported through onRejectedFiles. It holds no file state of its own, and it draws nothing: the drag affordance belongs to the children, which can be a function of the live drag state, and the root always mirrors that state as data-dragging. asChild goes further and merges the whole protocol onto the child element, so wrapping a component adds no DOM at all — that is how ChatComposer takes its drops. The zone stays a plain region and owns no controls: dropping is a pointer gesture, so the keyboard path to the same files is a browse control the host renders and wires to the same handler.",
      },
    },
  },
} satisfies Meta<typeof FileDropZone>

export default meta
type Story = StoryObj<typeof meta>

/** Builds a real File the drag tests can put on a DataTransfer. */
function makeFile(name: string, type: string, bytes = 64) {
  return new File([new Uint8Array(bytes)], name, { type })
}

/**
 * Dispatches one real DragEvent. Constructing the event directly is what
 * carries the DataTransfer: fireEvent assigns onto the event object, and
 * `dataTransfer` is a read-only accessor, so the payload never arrives.
 */
function drag(target: Element, type: string, dataTransfer: DataTransfer) {
  target.dispatchEvent(
    new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }),
  )
}

/** Builds a DataTransfer carrying the given files. */
function transferOf(files: File[]) {
  const dataTransfer = new DataTransfer()
  for (const file of files) dataTransfer.items.add(file)
  // A constructed DataTransfer stays effectAllowed "none" — the browser
  // refuses writes to it outside a real drag — so dropEffect is not
  // observable from these tests and is deliberately never asserted.
  return dataTransfer
}

/** Drops the given files onto an element through the real drag events. */
function dropFiles(target: Element, files: File[]) {
  const dataTransfer = transferOf(files)
  drag(target, "dragenter", dataTransfer)
  drag(target, "dragover", dataTransfer)
  drag(target, "drop", dataTransfer)
}

/**
 * Dispatches a drop carrying a stubbed DataTransfer. A constructed
 * DataTransfer exposes no filesystem entries, so this is the only way to
 * exercise folder expansion: the zone reads `types`, `files`, and
 * `items[].webkitGetAsEntry()`, and a plain object satisfying that shape
 * reaches the handler through the native event.
 */
function dropStub(
  target: Element,
  items: { file: File; entry: unknown | null }[],
) {
  const dataTransfer = {
    types: ["Files"],
    dropEffect: "none",
    files: items.map((item) => item.file),
    items: items.map((item) => ({
      kind: "file",
      webkitGetAsEntry: () => item.entry,
    })),
  }
  const event = new Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer })
  target.dispatchEvent(event)
}

/** A stub file entry that resolves to `file`. */
function fileEntry(file: File) {
  return {
    isFile: true,
    isDirectory: false,
    file: (onSuccess: (resolved: File) => void) => onSuccess(file),
  }
}

/** A stub directory entry that reads `children` in one batch, then ends. */
function folderEntry(children: unknown[]) {
  return {
    isFile: false,
    isDirectory: true,
    createReader: () => {
      let read = false
      return {
        readEntries: (onSuccess: (batch: unknown[]) => void) => {
          // Mark the batch consumed BEFORE handing it over: the reader is
          // re-entered from inside this callback, and a real browser's
          // async readEntries would have settled by then.
          const batch = read ? [] : children
          read = true
          onSuccess(batch)
        },
      }
    },
  }
}

interface Attachment {
  id: string
  name: string
}

/** Story-local host state: the attachments a composer has collected. */
function ComposerHost() {
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const nextId = React.useRef(0)
  const browseRef = React.useRef<HTMLInputElement>(null)
  const [announcement, setAnnouncement] = React.useState("")
  // One drop can both attach and refuse, and onFiles fires before
  // onRejectedFiles: an announcement that REPLACES the previous one would
  // tell the reader only about the failure. Both halves accumulate, and
  // the drop's own effect clears what the last drop said.
  const announce = (line: string) =>
    setAnnouncement((current) => (current ? `${current}. ${line}` : line))
  const attach = (files: File[]) => {
    setAnnouncement("")
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${(nextId.current += 1)}`,
        name: file.name,
      })),
    ])
    // The zone announces the drag; what the files BECAME is the host's to
    // say, and it is the half a keyboard user can actually reach.
    announce(`${files.length} ${files.length === 1 ? "file" : "files"} attached`)
  }
  const refuse = (rejections: FileDropRejection[]) => {
    // A refusal is also something the files became, and the reader who
    // cannot see the missing pill is the one who needs to hear it.
    const reasons: Record<FileDropRejection["reason"], string> = {
      type: "the wrong kind of file",
      size: "too large",
      count: "over the limit",
      folder: "a folder",
    }
    announce(
      rejections
        .map(({ file, reason }) => `${file.name} was not attached: ${reasons[reason]}`)
        .join(". "),
    )
  }
  return (
    <ChatComposer
      className="w-[min(32rem,calc(100vw-2rem))]"
      fileDrop={{
        label: "Drop files to attach",
        accept: "image/*,.pdf,.txt,.md",
        maxSize: 10 * 1024 * 1024,
        onFiles: attach,
        onRejectedFiles: refuse,
      }}
    >
      <ChatComposerAttachments>
        {attachments.map((attachment) => (
          <ChatComposerAttachment
            key={attachment.id}
            kind="file"
            itemLabel={attachment.name}
            onRemove={() =>
              setAttachments((current) =>
                current.filter((item) => item.id !== attachment.id),
              )
            }
          >
            {attachment.name}
          </ChatComposerAttachment>
        ))}
      </ChatComposerAttachments>
      <ChatComposerInput placeholder="Ask anything, or drop a file" />
      <ChatComposerFooter>
        <ChatComposerActions>
          {/* Dropping is a pointer gesture, so the keyboard path to the
              same attachments is the host's job — the composer pairs the
              capability with a real control. */}
          <ChatComposerAction
            aria-label="Attach files"
            title="Attach files"
            onClick={() => browseRef.current?.click()}
          >
            <Paperclip aria-hidden="true" />
          </ChatComposerAction>
        </ChatComposerActions>
        <ChatComposerSubmit aria-label="Send message" />
      </ChatComposerFooter>
      <p data-testid="announcement" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <input
        ref={browseRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md"
        className="hidden"
        onChange={(event) => {
          attach(Array.from(event.target.files ?? []))
          event.target.value = ""
        }}
      />
    </ChatComposer>
  )
}

export const ComposerAttachments: Story = {
  parameters: storyDocumentation(
    "The flagship composition: a composer taking the zone through its fileDrop prop, so a file dropped anywhere over it — the input, the footer, the attachment row — becomes an attachment pill. The zone merges onto the composer's own form, adding no element and no chrome: the drag shows as the composer lighting its border, the way focus does. Dropping is a pointer gesture, so the host pairs it with a keyboard-reachable attach button feeding the same handler. The play test asserts the border really repaints on dragenter, drops two files, removes one, and checks that both what was attached and what was refused reach a live region — the half of the story a reader cannot see the pills for.",
  ),
  render: () => <ComposerHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Merged onto the form under asChild, the zone keeps no element and no
    // data-slot of its own: the composer form IS the drop target.
    const zone = canvasElement.querySelector<HTMLElement>(
      '[data-slot="chat-composer"]',
    )
    await expect(zone).not.toBeNull()

    // A drag over the composer lights its border the way focus does.
    const resting = getComputedStyle(zone!).borderColor
    const hovering = transferOf([makeFile("screenshot.png", "image/png")])
    drag(zone!, "dragenter", hovering)
    await waitFor(async () => {
      await expect(zone!).toHaveAttribute("data-dragging", "true")
      await expect(getComputedStyle(zone!).borderColor).not.toBe(resting)
    })
    drag(zone!, "dragleave", hovering)

    dropFiles(zone!, [
      makeFile("architecture.pdf", "application/pdf"),
      makeFile("screenshot.png", "image/png"),
    ])
    await waitFor(async () => {
      await expect(canvas.getByText("architecture.pdf")).toBeVisible()
      await expect(canvas.getByText("screenshot.png")).toBeVisible()
    })
    // The drop resets the drag state, so the border stops lighting.
    await expect(zone!.hasAttribute("data-dragging")).toBe(false)
    await fireEvent.click(canvas.getByRole("button", { name: "Remove screenshot.png" }))
    await waitFor(async () => {
      await expect(canvas.queryByText("screenshot.png")).toBeNull()
    })
    // The pointer gesture is not the only way in: the attach control is a
    // real button a keyboard reaches, and the outcome is announced.
    const attach = canvas.getByRole("button", { name: "Attach files" })
    await expect(attach).toBeVisible()
    attach.focus()
    await expect(attach).toHaveFocus()
    await expect(canvas.getByTestId("announcement")).toHaveTextContent(
      "2 files attached",
    )
    // A mixed drop announces BOTH halves: onFiles and onRejectedFiles fire
    // for the same drop, and a replacing announcement would report only the
    // refusal to the reader who cannot see the pill row.
    dropFiles(zone!, [
      makeFile("notes.md", "text/markdown"),
      makeFile("archive.zip", "application/zip"),
    ])
    await waitFor(async () => {
      await expect(canvas.getByTestId("announcement")).toHaveTextContent(
        "archive.zip was not attached: the wrong kind of file",
      )
    })
    await expect(canvas.getByTestId("announcement")).toHaveTextContent(
      "1 file attached",
    )
  },
}

/** Story-local host state: a gallery with its own browse control. */
function GalleryHost() {
  const [names, setNames] = React.useState<string[]>([])
  const browseRef = React.useRef<HTMLInputElement>(null)
  const add = (files: File[]) =>
    setNames((current) => [...current, ...files.map((file) => file.name)])
  return (
    <div className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
      <FileDropZone accept="image/*" onFiles={add}>
        {({ isDragging }) => (
          <div
            data-testid="gallery"
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center [transition-property:color,background-color,border-color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none"
            style={{
              borderColor: isDragging ? "var(--ring)" : "var(--border)",
              backgroundColor: isDragging ? "var(--accent)" : "transparent",
            }}
          >
            <ImagePlus aria-hidden="true" className="size-5 text-muted-foreground" />
            <span className="nessa-text-4 font-medium text-foreground">
              Drop images here
            </span>
            {/* The browse path is a real button of the host's own: the zone
                stays a region, so the content inside it — including this
                control — keeps its own semantics. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => browseRef.current?.click()}
            >
              Choose images
            </Button>
            <input
              ref={browseRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                add(Array.from(event.target.files ?? []))
                event.target.value = ""
              }}
            />
          </div>
        )}
      </FileDropZone>
      <ul data-testid="gallery-files" className="nessa-text-2 text-foreground">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  )
}

export const BrowseOrDrop: Story = {
  parameters: storyDocumentation(
    "An empty-state gallery that draws its own drag affordance: the zone renders nothing, and the function child styles the dashed frame from the live isDragging flag. The zone stays a plain region — dropping is a pointer gesture with no keyboard equivalent, so the keyboard path is a real button the host owns, feeding the same handler. The play test drags over a nested child and asserts the state survives the child's own dragleave, which is the bug a naive single-flag implementation ships with.",
  ),
  render: () => <GalleryHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const zone = canvasElement.querySelector<HTMLElement>(
      '[data-slot="file-drop-zone"]',
    )!
    const inner = canvas.getByTestId("gallery")
    // A region, not a control: the button inside it keeps its own role.
    await expect(zone).not.toHaveAttribute("role")
    await expect(canvas.getByRole("button", { name: "Choose images" })).toBeVisible()

    const restingBorder = getComputedStyle(inner).borderColor
    const dataTransfer = transferOf([makeFile("photo.png", "image/png")])
    drag(zone, "dragenter", dataTransfer)
    await waitFor(async () => {
      await expect(zone).toHaveAttribute("data-dragging", "true")
    })
    // The frame really repaints: the drag colors are computed, not just classed.
    await waitFor(async () => {
      await expect(getComputedStyle(inner).borderColor).not.toBe(restingBorder)
    })
    // Crossing into a child fires enter on the child and leave on the zone's
    // previous target; the depth counter must keep the zone active.
    drag(inner, "dragenter", dataTransfer)
    drag(zone, "dragleave", dataTransfer)
    await expect(zone).toHaveAttribute("data-dragging", "true")
    drag(inner, "dragleave", dataTransfer)
    await waitFor(async () => {
      await expect(zone.hasAttribute("data-dragging")).toBe(false)
    })
    drag(zone, "drop", dataTransfer)
    await waitFor(async () => {
      await expect(canvas.getByTestId("gallery-files")).toHaveTextContent(
        "photo.png",
      )
    })
  },
}

/** Story-local host state: accepted names beside the refusals and their reasons. */
function RulesHost() {
  const [accepted, setAccepted] = React.useState<string[]>([])
  const [rejected, setRejected] = React.useState<FileDropRejection[]>([])
  const reasons: Record<FileDropRejection["reason"], string> = {
    type: "not an image",
    size: "over 1 MB",
    count: "over the 2-file limit",
    folder: "a folder, not a file",
  }
  return (
    <div className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
      <FileDropZone
        accept="image/*"
        maxFiles={2}
        maxSize={1024 * 1024}
        label="Drop up to 2 images"
        onFiles={(files) => setAccepted(files.map((file) => file.name))}
        onRejectedFiles={setRejected}
        className="rounded-xl border border-border p-6"
      >
        <p className="nessa-text-4 text-foreground">Drop up to 2 images, 1 MB each.</p>
      </FileDropZone>
      <ul data-testid="accepted" className="nessa-text-2 text-foreground">
        {accepted.map((name) => (
          <li key={name}>Attached {name}</li>
        ))}
      </ul>
      <ul data-testid="rejected" className="nessa-text-2 text-destructive">
        {rejected.map(({ file, reason }) => (
          <li key={file.name}>
            {file.name} — {reasons[reason]}
          </li>
        ))}
      </ul>
    </div>
  )
}

export const AcceptAndLimits: Story = {
  parameters: storyDocumentation(
    "The rules the zone applies before the host ever sees a file: accept filters by type or extension, maxSize caps each file, and maxFiles caps the drop. Nothing is refused silently — every refusal arrives through onRejectedFiles with the rule that caused it, so the host can say why. The play test drops four files and asserts each lands on the side its rule dictates.",
  ),
  render: () => <RulesHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const zone = canvasElement.querySelector<HTMLElement>(
      '[data-slot="file-drop-zone"]',
    )!
    dropFiles(zone, [
      makeFile("one.png", "image/png"),
      makeFile("notes.txt", "text/plain"),
      makeFile("huge.png", "image/png", 2 * 1024 * 1024),
      makeFile("two.jpg", "image/jpeg"),
      makeFile("three.gif", "image/gif"),
    ])
    await waitFor(async () => {
      await expect(canvas.getByTestId("accepted")).toHaveTextContent("Attached one.png")
    })
    const accepted = canvas.getByTestId("accepted")
    await expect(accepted).toHaveTextContent("Attached two.jpg")
    await expect(accepted).not.toHaveTextContent("notes.txt")
    const rejected = canvas.getByTestId("rejected")
    await expect(rejected).toHaveTextContent("notes.txt — not an image")
    await expect(rejected).toHaveTextContent("huge.png — over 1 MB")
    await expect(rejected).toHaveTextContent("three.gif — over the 2-file limit")
  },
}

/** Story-local host state: a disabled zone that records any delivery. */
function DisabledHost() {
  const [delivered, setDelivered] = React.useState<string[]>([])
  return (
    <FileDropZone
      disabled
      onFiles={(files) => setDelivered(files.map((file) => file.name))}
      overlay={
        <div
          data-testid="disabled-overlay"
          className="flex size-full items-center justify-center rounded-xl border-2 border-dashed border-ring bg-background/90 nessa-text-4 text-foreground"
        >
          Drop to attach
        </div>
      }
      className="w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border p-6"
    >
      <p className="nessa-text-4 text-muted-foreground">
        Uploads are paused while the message is sending.
      </p>
      <p data-testid="delivered" className="nessa-text-2 text-foreground">
        {delivered.join(", ")}
      </p>
    </FileDropZone>
  )
}

export const Disabled: Story = {
  parameters: storyDocumentation(
    "A zone that refuses drops while the host is busy or read-only: the overlay it would otherwise show stays away, a drop that lands anyway delivers nothing, and the drag reports dropEffect none so the pointer shows the no-drop cursor. The play test asserts the first two against a zone that really does carry an overlay, so both would fail if the disabled guard were removed; the cursor is left untested because a synthetic DataTransfer refuses dropEffect writes outside a real drag. A disabled zone also claims nothing, so a zone wrapping this one still takes the drop.",
  ),
  render: () => <DisabledHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const zone = canvasElement.querySelector<HTMLElement>(
      '[data-slot="file-drop-zone"]',
    )!
    await expect(zone).toHaveAttribute("data-disabled", "true")
    const dataTransfer = transferOf([makeFile("photo.png", "image/png")])
    drag(zone, "dragenter", dataTransfer)
    drag(zone, "dragover", dataTransfer)
    await expect(zone.hasAttribute("data-dragging")).toBe(false)
    await expect(canvas.queryByTestId("disabled-overlay")).toBeNull()
    drag(zone, "drop", dataTransfer)
    await expect(canvas.getByTestId("delivered")).toHaveTextContent("")
  },
}

/** Story-local host state: an outer page zone around an inner card zone. */
function NestedHost() {
  const [outer, setOuter] = React.useState<string[]>([])
  const [inner, setInner] = React.useState<string[]>([])
  const [own, setOwn] = React.useState<string[]>([])
  return (
    <FileDropZone
      onFiles={(files) => setOuter((c) => [...c, ...files.map((f) => f.name)])}
      className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border border-dashed border-border p-6"
    >
      <p className="nessa-text-2 text-muted-foreground">
        Page: {outer.length === 0 ? "nothing" : outer.join(", ")}
      </p>
      <FileDropZone
        onFiles={(files) => setInner((c) => [...c, ...files.map((f) => f.name)])}
        className="rounded-xl border border-border p-4 data-[dragging]:border-ring"
      >
        <p data-testid="card" className="nessa-text-4 text-foreground">
          Card: {inner.length === 0 ? "nothing" : inner.join(", ")}
        </p>
      </FileDropZone>
      {/* A drop target of the host's own, not a zone: it owns its region
          by stopping propagation, the documented escape hatch. */}
      <div
        data-testid="own-target"
        className="rounded-xl border border-border p-4"
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOwn(Array.from(event.dataTransfer.files).map((file) => file.name))
        }}
      >
        Mine: {own.length === 0 ? "nothing" : own.join(", ")}
      </div>
      <p data-testid="page" className="nessa-text-2 text-muted-foreground">
        {outer.join(", ")}
      </p>
    </FileDropZone>
  )
}

export const NestedZones: Story = {
  parameters: storyDocumentation(
    "Zones nest, and the innermost one owns the drop: a file dropped on the card attaches to the card alone, never to the page zone around it as well. Each drag event is claimed by the first zone to see it, so ancestors neither double-deliver nor double-count their enter and leave depth. A drop target the host writes itself is not a zone and cannot be claimed, so it owns its region by stopping propagation — and because a drop is never followed by a dragleave, the zone reads that drop in the capture phase, which no descendant can stop, so its drag state cannot be stranded on. The play test covers all three: the card, the page, and the host's own target.",
  ),
  render: () => <NestedHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    dropFiles(canvas.getByTestId("card"), [makeFile("photo.png", "image/png")])
    await waitFor(async () => {
      await expect(canvas.getByTestId("card")).toHaveTextContent("photo.png")
    })
    await expect(canvas.getByTestId("page")).toHaveTextContent("")
    // The page zone still takes what is dropped on the page itself.
    dropFiles(canvas.getByTestId("page"), [makeFile("notes.pdf", "application/pdf")])
    await waitFor(async () => {
      await expect(canvas.getByTestId("page")).toHaveTextContent("notes.pdf")
    })
    await expect(canvas.getByTestId("card")).not.toHaveTextContent("notes.pdf")

    // The host's own target keeps its drop, and leaves the zone dark
    // rather than lit forever — the drop it swallowed still reset the
    // enter it could not swallow.
    const ownTarget = canvas.getByTestId("own-target")
    const transfer = transferOf([makeFile("mine.png", "image/png")])
    drag(ownTarget, "dragenter", transfer)
    drag(ownTarget, "dragover", transfer)
    drag(ownTarget, "drop", transfer)
    await waitFor(async () => {
      await expect(ownTarget).toHaveTextContent("mine.png")
    })
    await expect(canvas.getByTestId("page")).not.toHaveTextContent("mine.png")
    const zone = canvasElement.querySelector<HTMLElement>(
      '[data-slot="file-drop-zone"]',
    )!
    await waitFor(async () => {
      await expect(zone.hasAttribute("data-dragging")).toBe(false)
    })
  },
}

/** Story-local host state: what a folder drop produced, in order. */
function FolderHost() {
  const [accepted, setAccepted] = React.useState<string[]>([])
  const [rejected, setRejected] = React.useState<FileDropRejection[]>([])
  return (
    <div className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
      <FileDropZone
        maxFiles={2}
        onFiles={(files) => setAccepted(files.map((file) => file.name))}
        onRejectedFiles={setRejected}
        className="rounded-xl border border-border p-6"
      >
        <p className="nessa-text-4 text-foreground">
          Drop a folder — up to 2 files.
        </p>
      </FileDropZone>
      <p data-testid="folder-accepted" className="nessa-text-2 text-foreground">
        {accepted.join(", ")}
      </p>
      <p data-testid="folder-rejected" className="nessa-text-2 text-destructive">
        {rejected.map((entry) => `${entry.file.name}: ${entry.reason}`).join(", ")}
      </p>
    </div>
  )
}

export const Folders: Story = {
  parameters: storyDocumentation(
    "Dropped folders are walked to their files, and the files hold the folder's place in the drop rather than trailing behind every loose file — which is what maxFiles cuts along. A folder that turns out to be empty is reported back as a folder rejection, so a drop that produces nothing still tells the host why. The play test drives the real entry API with stubbed directory entries, the only way to reach this path from a browser test.",
  ),
  render: () => <FolderHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const zone = canvasElement.querySelector<HTMLElement>(
      '[data-slot="file-drop-zone"]',
    )!
    const inside = [makeFile("one.png", "image/png"), makeFile("two.png", "image/png")]
    dropStub(zone, [
      // A folder first, then a loose file and an empty folder.
      {
        file: makeFile("photos", "", 0),
        entry: folderEntry(inside.map(fileEntry)),
      },
      { file: makeFile("cover.png", "image/png"), entry: fileEntry(makeFile("cover.png", "image/png")) },
      { file: makeFile("empty", "", 0), entry: folderEntry([]) },
    ])
    await waitFor(async () => {
      // Drop order, not folders-last: the folder's two files take the
      // budget because the folder was dropped first.
      await expect(canvas.getByTestId("folder-accepted")).toHaveTextContent(
        "one.png, two.png",
      )
    })
    await expect(canvas.getByTestId("folder-accepted")).not.toHaveTextContent(
      "cover.png",
    )
    const rejected = canvas.getByTestId("folder-rejected")
    await expect(rejected).toHaveTextContent("cover.png: count")
    // The empty folder is reported rather than swallowed, and never as a file.
    await expect(rejected).toHaveTextContent("empty: folder")
  },
}
