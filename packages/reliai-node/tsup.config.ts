import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    auto: "src/auto.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  treeshake: true,
});
