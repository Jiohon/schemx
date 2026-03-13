import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { resolve } from "path"

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      outDir: "dist",
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SchemaFormVant",
      formats: ["es", "cjs"],
      fileName: (format) => {
        if (format === "es") return "index.mjs"
        return "index.cjs"
      },
    },
    rollupOptions: {
      external: ["vue", "vant", "@jonhn/schema-form-core"],
      output: {
        globals: {
          vue: "Vue",
          vant: "Vant",
          "@jonhn/schema-form-core": "SchemaFormCore",
        },
        exports: "named",
      },
    },
    sourcemap: true,
    minify: "terser",
  },
})
