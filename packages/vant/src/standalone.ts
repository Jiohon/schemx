/**
 * @schemx/vant/standalone 入口
 *
 * 面向 uni-app 等保留 symlink 路径进行依赖预构建的消费环境。
 * 构建时会内联 @schemx/core、@schemx/vue 及其运行时依赖，
 * 但仍保持 vue、vant 为外部依赖，避免打包框架和 UI 库。
 *
 * @module @schemx/vant/standalone
 */

import "@/styles/index.scss"

/** 声明合并 side-effect：注册 Vant 渲染器类型到 SchemxRendererDefinition */
import "./types/schemx"

/** side-effect：将 Vant 渲染器注册到全局 rendererRegistry */
import "./renderers/defaultRenderers"

/** 重新导出 @schemx/vue（含 SchemxForm 默认导出） */
export { default } from "@schemx/vue"
export { default as SchemxForm } from "@schemx/vue"
export * from "@schemx/vue"

/** 重新导出 @schemx/core 的类型 */
export * from "@schemx/core"

/** 渲染器组件 */
export * from "./renderers"

export { default as Cell } from "@/components/Cell/index.vue"

/** 工具函数 */
export { getFieldProps, findTreeItem, getFileName } from "./utils"
export type { FindTreeItemResult } from "./utils"
