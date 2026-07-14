import { resolve } from "path"
import type { PluginOption } from "vite"
import dts from "vite-plugin-dts"
import { visualizer } from "rollup-plugin-visualizer"

interface PackagePluginOptions {
  analyze: boolean
}

export function createVitePlugins({ analyze }: PackagePluginOptions): PluginOption[] {
  return [
    dts({
      include: ["src/**/*.ts"],
      outDir: "dist",
      rollupTypes: true,
    }),
    analyze &&
      visualizer({
        filename: resolve(__dirname, "dist/analyze.html"),
        gzipSize: true,
        brotliSize: true,
        open: false,
        template: "treemap",
        title: "@schemx/core bundle analysis",
      }),
  ].filter(Boolean) as PluginOption[]
}
