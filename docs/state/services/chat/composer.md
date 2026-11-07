---
id: "ui-composer"
title: "Drafts and attachments"
kind: "contract"
status: "implemented"
summary: "ChatComposer is a form whose input and footer slots can be composed independently. Submit hands control to the host; it does not create a durable message, upload files or clear a successful draft by itself."
parent: "ui-chat"
sources:
  [
    "packages/react/src/components/chat-composer.tsx",
    "packages/react/src/components/chat-composer-editor.tsx",
    "packages/react/src/components/chat-composer-markdown-editor.tsx",
    "packages/react/src/components/file-drop-zone.tsx",
    "packages/react/src/components/chat-tray.tsx",
    "packages/react/src/components/chat-annotations.tsx",
    "packages/react/src/components/pill-composer.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Collect a draft and attachments

ChatComposer is a form whose input and footer slots can be composed independently. Submit hands control to the host; it does not create a durable message, upload files or clear a successful draft by itself.

The plain input, chip-capable ChatComposerEditor and ChatComposerMarkdownEditor expose editing operations used by trigger menus. A trigger reads the token at a collapsed caret, tracks its anchor, then replaces that token when the host chooses a result. Rich input preserves the distinction between visible chips and their text serialization. CodeEditor is a separate code-editing surface, not a chat transport.

`fileDrop` merges FileDropZone into the form and filters by accepted type, size and count. The host receives Files and creates its own attachments. Without that prop, the composer takes no attachments but still cancels file drops over itself to prevent browser navigation. Directory expansion and rejection are explicit FileDropZone options; rejected entries carry type, size, count or folder reasons. A partial accepted set is not an uploaded set.

The host must provide a keyboard-accessible attach control reaching the same handler and announce what the files became. The composer announces drag feedback only. ChatComposerAttachment, ChatTray and ChatAnnotations display host data and actions; removal callbacks do not delete remote bytes. Large paste handling is another callback boundary, so define whether your host turns it into text, an attachment or a refusal.

The composer measures footer/attachment chrome when height is constrained so the input can scroll without hiding controls. PillComposer offers a compact presentation. None of these components promises to restore an unsaved draft after unmount or reload; keep durable draft and attachment state above the view.
