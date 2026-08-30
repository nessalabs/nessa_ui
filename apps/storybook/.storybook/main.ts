import path from "node:path"
import { fileURLToPath } from "node:url"

import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const dirname = path.dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    defaultName: "Documentation",
  },
  viteFinal(config) {
    config.plugins = [...(config.plugins ?? []), tailwindcss()]
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(dirname, "../../../packages/react/src"),
      "@nessa-ui/react": path.resolve(
        dirname,
        "../../../packages/react/src/index.ts",
      ),
      // Ordered, not alphabetical: a Vite string alias is a prefix
      // replacement, so the bare package name would also swallow the subpath
      // and resolve it to `index.ts/transcript`. The longer key goes first.
      "@nessa-ui/agent-stream/transcript": path.resolve(
        dirname,
        "../../../packages/agent-stream/src/transcript/index.ts",
      ),
      "@nessa-ui/agent-stream": path.resolve(
        dirname,
        "../../../packages/agent-stream/src/contract.ts",
      ),
    }
    return config
  },
}

export default config
