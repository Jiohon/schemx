/**
 * @schemx/vant 入口
 *
 * Vant 渲染器适配包，基于 @schemx/core 的 Registry 机制
 * 提供 Vant 组件库的渲染器实现。
 *
 * 导入此包时，RendererDefinition 声明合并自动生效，
 * SchemxField 的 componentType 会包含所有 Vant 渲染器类型。
 *
 * @module @schemx/vant
 */

/** 声明合并 side-effect：注册 Vant 渲染器类型到 RendererDefinition */
import "./types/schemx.d"

/** 重新导出 @schemx/vue 的组件和 hooks */
export { default } from "@schemx/vue"
export { default as SchemaForm } from "@schemx/vue"
export {
  useForm,
  useField,
  useWatch,
  useEffect,
  useDependency,
  WithRemoteOptions,
} from "@schemx/vue"

/** 重新导出 @schemx/core 的类型 */
export * from "@schemx/core"

/** 渲染器组件 */
export * from "./renderers"

/** 工具函数 */
export { getFieldProps, findTreeItem, getFileName } from "./utils"
export type { FindTreeItemResult } from "./utils"

/** 渲染器注册 */
import "./renderers/defaultRenderers"
