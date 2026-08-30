import { defineConfig } from "tsup"

export default defineConfig({
  clean: false,
  dts: true,
  // The contract entry stops at the agent message; the fold ships behind its
  // own subpath so a host that only wants events never pulls it in. Named
  // keys, because the output name is what the exports map promises and what a
  // registry consumer imports as `lib/agent-stream/transcript`.
  entry: {
    index: "src/contract.ts",
    transcript: "src/transcript/index.ts",
  },
  format: ["esm"],
  minify: false,
  sourcemap: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
})
