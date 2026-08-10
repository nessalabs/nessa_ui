import type { Preview } from "@storybook/react-vite"

import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
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

      return Story()
    },
  ],
}

export default preview
