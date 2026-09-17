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
            tags: { include: ["cross-engine"] },
          }),
        ],
        test: {
          // Every engine the package claims support for, on the stories whose
          // behavior is engine-shaped rather than engine-agnostic.
          //
          // It is a separate project, not extra instances on the main one,
          // because the two answer different questions. The Chromium project
          // asks whether a component behaves; this one asks whether the
          // *engine* agrees — focus order, `:focus-visible` matching, event
          // ordering, transition and animation events, `inert`, scroll
          // anchoring. Running all thousand-odd stories three times over would
          // cost an hour to re-confirm a thousand answers that do not vary by
          // engine, and the ones that do would be lost in the noise.
          //
          // A story earns the `cross-engine` tag by depending on something an
          // engine implements in its own way. Rendering a card does not — and
          // neither does measuring one. A story asserting exact pixel geometry
          // is calibrated to the fonts and layout of the engine and platform
          // it was written on, so tagging it claims every engine lays out
          // identically to the subpixel, which is not true and not what this
          // project is asking.
          name: "storybook-cross-engine",
          testTimeout: 30000,
          // Run through `pnpm test:cross-engine`, not as part of `pnpm test`.
          // Vitest runs projects concurrently, and this one brings two more
          // engines: five browser instances at once contend badly enough to
          // wedge the whole run — measured at 0% CPU across every engine,
          // still alive, 26 minutes in. The root scripts name their projects
          // so the two suites never share a machine. Separately they cost
          // about 2m40s and 3m10s.
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [
              { browser: "firefox", name: "firefox" },
              { browser: "webkit", name: "webkit" },
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
