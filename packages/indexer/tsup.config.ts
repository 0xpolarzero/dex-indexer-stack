import { defineConfig } from "tsup";

export default defineConfig({
  entry: { bin: "bin/index.ts" },
  outDir: "dist",
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  minify: true,
  tsconfig: "tsconfig.build.json",
});
