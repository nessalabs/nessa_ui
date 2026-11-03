---
id: "ui-messages"
title: "Message rendering"
kind: "contract"
status: "implemented"
summary: "Message arranges an avatar and content for a supplied participant. MessageMarkdown renders supplied Markdown with element overrides; CodeBlock, MathBlock and MermaidDiagram handle their own content formats. The host chooses the message order and what is final."
parent: "ui-chat"
sources:
  [
    "packages/react/src/components/message.tsx",
    "packages/react/src/components/message-markdown.tsx",
    "packages/react/src/components/message-scroller.tsx",
    "packages/react/src/components/message-actions/index.ts",
    "packages/react/src/components/code-block.tsx",
    "packages/react/src/components/math-block.tsx",
    "packages/react/src/components/generating-surface.tsx",
    "packages/agent-stream/src/transcript/fold.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Read messages and streaming output

Message arranges an avatar and content for a supplied participant. MessageMarkdown renders supplied Markdown with element overrides; CodeBlock, MathBlock and MermaidDiagram handle their own content formats. The host chooses the message order and what is final.

Use MessageScroller to keep a reader at the live edge while following new content and to offer a return to the newest content after they move away. A scroll position is a reading choice, not evidence that the agent completed. MessageActions, ChatBubbles, TranscriptDivider and SelectionTooltip expose actions or reading affordances for supplied content. GeneratingSurface and LoadingText announce progress the host asks them to show; their animation does not measure backend liveness.

CodeBlockProvider supplies shared code appearance with per-block overrides. Mermaid diagrams require the [shared renderer queue](mermaid.md), whose timeout fallback preserves source text. A syntax or rendering failure is a display failure; it does not prove the agent's surrounding operation failed.

When consuming normalized deltas, treat them as previews for a block and let committed content supersede them rather than appending both as separate answers. The [transcript fold](../streams/transcript.md) groups tools and removes the closing duplicate answer in its returned turns. A host rendering raw events instead must implement that presentation policy itself.
