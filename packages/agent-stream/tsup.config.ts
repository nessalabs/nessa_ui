import { defineConfig } from "tsup"

export default defineConfig({
  clean: false,
  dts: true,
  // The contract entry stops at the agent message; the fold ships behind its
  // own subpath so a host that only wants events never pulls it in. Named
  // keys, because the fold's source file sits beside `transcript.ts` and the
  // published name is what the exports map promises.
  entry: {
    index: "src/index.ts",
    transcript: "src/transcript-entry.ts",
  },
  format: ["esm"],
  minify: false,
  sourcemap: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
})
