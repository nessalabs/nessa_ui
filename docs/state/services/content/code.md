---
id: "ui-code"
title: "Code and Git views"
kind: "contract"
status: "implemented"
summary: "CodeBlock displays supplied code; CodeEditor edits text and controlled language selection. FileDiffList, GitHistory and GitCommitDetails display supplied changes and commit metadata. They do not run Git or read a repository by themselves."
parent: "ui-content"
sources:
  [
    "packages/react/src/components/code-block.tsx",
    "packages/react/src/components/code-editor.tsx",
    "packages/react/src/components/file-diff-list.tsx",
    "packages/react/src/components/git-history/index.tsx",
    "packages/react/src/components/git-commit-details.tsx",
    "packages/react/src/components/tool-call.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Inspect code files and Git history

CodeBlock displays supplied code; CodeEditor edits text and controlled language selection. FileDiffList, GitHistory and GitCommitDetails display supplied changes and commit metadata. They do not run Git or read a repository by themselves.

A host supplies stable commit IDs, graph data and selection callbacks. GitHistory computes lanes and can window its rows; disabling virtualization helps browser Find and full traversal. GitCommitDetails distinguishes unavailable/binary line counts from a real zero and reports selected files/resources to the host. A resource click still requires an application route or loader.

ToolCall can show a diff using a renderer loaded when needed, avoiding a heavy syntax engine in every initial component import. JsonTree displays structured values. File previews route text through code rendering where appropriate; malformed content can fall back independently from the host operation that produced it.

Editors can lose local unsaved state when the host unmounts them, especially inside the default active-only WindowDeck. Store the authoritative draft above such views and define save, conflict and recovery behavior in the application. This library supplies no filesystem transaction or autosave guarantee.
