import * as React from "react"
import type { Preview } from "@storybook/react-vite"
import { CodeBlockProvider } from "@nessa-ui/react"

import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import { NessaDocsPage } from "./docs-page"
import "./preview.css"

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
