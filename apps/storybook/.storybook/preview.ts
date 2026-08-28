import * as React from "react"
import type { Preview } from "@storybook/react-vite"
import { CodeBlockProvider, preloadCodeHighlighter } from "@nessa-ui/react"

import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import { NessaDocsPage } from "./docs-page"
import "./preview.css"

// Shiki loads its themes and grammars lazily, on the first CodeBlock that
// renders. Under the parallel test run that cold start is the slowest part
// of any code story, and every browser instance pays it while racing the
// rest of the suite. Warming it once per instance, as the page boots, takes
// the load off the stories themselves — CodeBlock's own default pair, plus
// the languages the stories actually render.
void preloadCodeHighlighter([
  "ts",
  "tsx",
  "js",
  "json",
  "bash",
  "css",
  "md",
  "txt",
]).catch(() => {
  // A failed warm-up is not a failed story: highlighting still loads on
  // demand, just as it did before.
})

const preview: Preview = {
  parameters: {
    a11y: {
      test: "error",
    },
    backgrounds: {
      disable: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      page: NessaDocsPage,
    },
    layout: "centered",
  },
  globalTypes: {
    theme: {
      description: "Nessa UI color theme",
      defaultValue: "light",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals.theme === "dark"
      document.documentElement.classList.toggle("dark", isDark)

      // Provide the resolved color mode to every code surface, exactly like
      // a host app wiring its own mode into CodeBlockProvider at the root.
      return React.createElement(
        CodeBlockProvider,
        { mode: isDark ? "dark" : "light" },
        Story(),
      )
    },
  ],
}

export default preview
