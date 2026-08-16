import { defineConfig } from "tsup"

export default defineConfig({
  clean: false,
  dts: true,
  entry: ["src/index.ts"],
  external: ["react", "react-dom"],
  format: ["esm"],
  minify: false,
  // Rollup's tree-shake pass strips leading directives, so the client
  // boundary is re-stamped onto every built module afterwards.
  onSuccess: "node scripts/ensure-use-client.mjs",
  sourcemap: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
})
