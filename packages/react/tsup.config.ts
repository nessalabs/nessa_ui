import { defineConfig } from "tsup"

export default defineConfig({
  clean: false,
  dts: true,
  entry: ["src/index.ts"],
  // `@nessalabs/agent-stream` is a declared dependency, so tsup externalizes it
  // anyway; naming it here states the intent, because inlining it would put the
  // parser back inside the module tree that `ensure-use-client.mjs` stamps.
  external: ["react", "react-dom", "@nessalabs/agent-stream"],
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
