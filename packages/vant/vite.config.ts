import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      outDir: "dist",
      tsconfigPath: "tsconfig.build.json",
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "schemxVant",
      formats: ["es", "cjs"],
      fileName: (format) => {
        if (format === "es") return "index.mjs"
        return "index.cjs"
      },
    },
    rollupOptions: {
      external: ["vue", "vant", "@schemx/core", "@schemx/vue", "classnames", "dayjs"],
      output: {
        globals: {
          vue: "Vue",
          vant: "Vant",
          "@schemx/core": "schemxCore",
        },
        exports: "named",
      },
    },
    sourcemap: true,
    minify: "terser",
  },
})
