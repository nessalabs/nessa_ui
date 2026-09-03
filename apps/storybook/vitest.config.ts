import path from "node:path"
import { fileURLToPath } from "node:url"

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          // Async surfaces (Shiki highlighting, Mermaid rendering) can take
          // several seconds when the full suite runs in parallel.
          testTimeout: 30000,
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [
              { browser: "chromium", name: "chromium-fine-pointer" },
              {
                browser: "chromium",
                name: "chromium-touch",
                provider: playwright({
                  contextOptions: { hasTouch: true },
                }),
              },
            ],
          },
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
            tags: { include: ["reduced-motion"] },
          }),
        ],
        test: {
          name: "storybook-reduced-motion",
          // Same budget as the main project. Playground-scale stories in
          // this project already wait out token-duration fades (4s each);
          // the default 15s is shorter than those waits plus the stream.
          testTimeout: 30000,
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [
              {
                browser: "chromium",
                name: "chromium-reduced-motion",
                provider: playwright({
                  contextOptions: { reducedMotion: "reduce" },
                }),
              },
            ],
          },
        },
      },
    ],
  },
})
