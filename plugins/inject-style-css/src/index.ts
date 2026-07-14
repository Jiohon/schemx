import { posix } from "node:path"

import type { Plugin } from "vite"

/** CSS 注入插件的配置。 */
export interface InjectStyleCssOptions {
  /** 构建产物中的 CSS 文件名。 */
  styleFileName?: string
}

/**
 * 将构建产物中的 CSS asset 以相对路径注入 ESM 入口。
 */
export function injectStyleCss(options: InjectStyleCssOptions = {}): Plugin {
  const { styleFileName = "style.css" } = options

  return {
    name: "schemx:inject-style-css",
    generateBundle: {
      order: "post",
      handler(_outputOptions, bundle) {
        const styleAsset = Object.values(bundle).find(
          (output) =>
            output.type === "asset" &&
            (output.fileName === styleFileName ||
              posix.basename(output.fileName) === styleFileName)
        )

        if (!styleAsset) return

        for (const output of Object.values(bundle)) {
          if (
            output.type !== "chunk" ||
            !output.isEntry ||
            !output.fileName.endsWith(".mjs")
          ) {
            continue
          }

          const relativePath = posix.relative(
            posix.dirname(output.fileName),
            styleAsset.fileName
          )
          const importPath = relativePath.startsWith(".")
            ? relativePath
            : `./${relativePath}`
          const importStatement = `import "${importPath}";\n`

          if (!output.code.includes(importStatement.trim())) {
            output.code = importStatement + output.code
          }
        }
      },
    },
  }
}
