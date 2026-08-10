import { defineConfig } from "tsup"

export default defineConfig({
  clean: false,
  dts: true,
  entry: ["src/index.ts"],
  external: ["react", "react-dom"],
  format: ["esm"],
  minify: false,
  sourcemap: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
})

