import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"
import {
  CodeBlock,
  CodeBlockProvider,
  MessageMarkdown,
  type CodeBlockMode,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

function CodeFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-background p-6">
      {children}
    </div>
  )
}

/**
 * Pierre renders into a <diffs-container> custom element with an open shadow
 * root, so the rendered code is read through shadowRoot rather than the
 * light-DOM textContent.
 */
function renderedCode(block: Element): string {
  return (
    block.querySelector("diffs-container")?.shadowRoot?.textContent ?? ""
  )
}

const sampleCode = `interface StreamState {
  text: string
  staticLength: number
  done: boolean
}

export function useReveal(text: string): StreamState {
  // Pace the reveal to the incoming stream.
  const [state, setState] = React.useState<StreamState>({
    text,
    staticLength: text.length,
    done: true,
  })
  return state
}`

const meta = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A syntax-highlighted code block backed by Pierre's Shiki-based rendering engine. Standalone it renders any snippet with dark and light theme support, an optional file header, line numbers, and line wrapping; MessageMarkdown composes it automatically for fenced code. Appearance resolves from props first, then the nearest CodeBlockProvider, then defaults — so a host sets its code theme once at the root and every code surface in the app follows, exactly like the app's light and dark mode.",
      },
    },
  },
} satisfies Meta<typeof CodeBlock>

export default meta

interface PlaygroundArgs {
  code: string
  language: string
  filename: string
  lineNumbers: boolean
  wrap: boolean
  mode: CodeBlockMode
}

export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    code: sampleCode,
    language: "tsx",
    filename: "",
    lineNumbers: false,
    wrap: false,
    mode: "dark",
  },
  argTypes: {
    code: { control: "text", description: "The source code to render." },
    language: {
      control: "select",
      options: ["tsx", "ts", "python", "rust", "go", "sql", "json", "bash", "text"],
      description: "Language for syntax highlighting.",
    },
    filename: {
      control: "text",
      description: "When set, shows Pierre's file header above the code.",
    },
    lineNumbers: { control: "boolean", description: "Show gutter line numbers." },
    wrap: {
      control: "boolean",
      description: "Wrap long lines instead of scrolling horizontally.",
    },
    mode: {
      control: "select",
      options: ["system", "light", "dark"],
      description:
        "Which side of the theme pair renders; hosts pass their resolved color mode.",
    },
  },
  parameters: storyDocumentation(
    "The standalone code surface: pass code and a language and Pierre highlights it through Shiki. filename adds the file header, lineNumbers adds a gutter, wrap trades horizontal scrolling for soft-wrapped lines, and mode pins the dark or light side of the theme pair — hosts that resolve their own color mode pass it here so code follows the app, not the OS.",
  ),
  render: ({ code, language, filename, lineNumbers, wrap, mode }) => (
    <CodeFrame>
      <CodeBlock
        code={code}
        language={language}
        filename={filename === "" ? undefined : filename}
        lineNumbers={lineNumbers}
        wrap={wrap}
        mode={mode}
      />
    </CodeFrame>
  ),
  play: async ({ canvasElement }) => {
    const block = canvasElement.querySelector('[data-slot="code-block"]')!
    await expect(block).toBeTruthy()
    // Highlighting is async: wait for the source to render, then for Shiki
    // to produce colored token spans inside the shadow root. Theme and
    // grammar loads are lazy, so give cold runs extra headroom.
    await waitFor(
      () => expect(renderedCode(block)).toMatch(/interface StreamState/),
      { timeout: 15000 },
    )
    await waitFor(() => {
      const shadow = block.querySelector("diffs-container")!.shadowRoot!
      expect(shadow.querySelectorAll("span").length).toBeGreaterThan(0)
    })
  },
}

interface ProviderArgs {
  themeDark: string
  themeLight: string
  mode: CodeBlockMode
}

const providerMarkdown = `The provider themes fenced markdown code too:

\`\`\`ts
const answer: number = 42
\`\`\`
`

export const AppWideTheme: StoryObj<ProviderArgs> = {
  args: {
    themeDark: "catppuccin-mocha",
    themeLight: "catppuccin-latte",
    mode: "dark",
  },
  argTypes: {
    themeDark: {
      control: "select",
      options: [
        "catppuccin-mocha",
        "pierre-dark",
        "github-dark",
        "vitesse-dark",
        "nord",
        "dracula",
      ],
      description: "Shiki theme used when the dark side renders.",
    },
    themeLight: {
      control: "select",
      options: [
        "light-plus",
        "catppuccin-latte",
        "pierre-light",
        "github-light",
        "vitesse-light",
        "solarized-light",
      ],
      description: "Shiki theme used when the light side renders.",
    },
    mode: {
      control: "select",
      options: ["system", "light", "dark"],
      description: "The app's resolved color mode, applied to every block below.",
    },
  },
  parameters: storyDocumentation(
    "App-wide code theming: CodeBlockProvider is set once — in a real app at the root — and every code surface below it follows, including fenced code inside MessageMarkdown. Change the theme or mode controls and both blocks update together; any individual CodeBlock prop still overrides per instance. This is the same pattern hosts use to keep code theming in lockstep with their light and dark mode.",
  ),
  render: ({ themeDark, themeLight, mode }) => (
    <CodeBlockProvider theme={{ dark: themeDark, light: themeLight }} mode={mode}>
      <CodeFrame>
        <CodeBlock
          code={'export const greeting = "Hello from the provider!"'}
          language="ts"
        />
        <MessageMarkdown>{providerMarkdown}</MessageMarkdown>
      </CodeFrame>
    </CodeBlockProvider>
  ),
  play: async ({ canvasElement }) => {
    // Both the direct CodeBlock and the fenced block inside MessageMarkdown
    // resolve their appearance from the same provider.
    const blocks = canvasElement.querySelectorAll('[data-slot="code-block"]')
    await expect(blocks.length).toBe(2)
    await waitFor(
      () => expect(renderedCode(blocks[0]!)).toMatch(/Hello from the provider/),
      { timeout: 15000 },
    )
    await waitFor(
      () => expect(renderedCode(blocks[1]!)).toMatch(/answer/),
      { timeout: 15000 },
    )
  },
}
