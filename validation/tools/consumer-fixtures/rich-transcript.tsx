/**
 * The heaviest consumer: a transcript that renders everything.
 *
 * Markdown, syntax highlighting, maths and diagrams — the surfaces whose
 * dependencies dominate the install. This is the ceiling, and the one a
 * subpath split would be trying to keep the other two away from.
 */
import {
  ChatBubble,
  ChatMessage,
  CodeBlock,
  MathBlock,
  MermaidDiagram,
  Message,
  MessageMarkdown,
} from "@nessalabs/ui"

export function App() {
  return (
    <ChatMessage tone="received">
      <ChatBubble>
        <Message>
          <MessageMarkdown>{"# Title\n\nSome **text**."}</MessageMarkdown>
          <CodeBlock code="const a = 1" language="ts" />
          <MathBlock expression="a^2 + b^2 = c^2" />
          <MermaidDiagram chart="graph TD; A-->B;" />
        </Message>
      </ChatBubble>
    </ChatMessage>
  )
}
