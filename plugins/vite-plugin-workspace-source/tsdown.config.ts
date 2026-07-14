export default {
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["vite", "@vitejs/plugin-vue-jsx"],
}
