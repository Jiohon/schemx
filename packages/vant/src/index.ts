/**
 * @schemx/vant 入口
 *
 * Vant 渲染器适配包，基于 @schemx/core 的 Registry 机制
 * 提供 Vant 组件库的渲染器实现。
 *
 * @module @schemx/vant
 */

/** 渲染器组件 */
export * from "./renderers"

/** 渲染器注册工具 */
export {
  registerDefaultRenderers,
  hasAllDefaultRenderers,
  getMissingDefaultRenderers,
  DEFAULT_RENDERER_TYPES,
  type DefaultRendererType,
  type RendererRegistrationConfig,
} from "./renderers/defaultRenderers"

/** 工具函数 */
export { getFieldProps, findTreeItem, getFileName } from "./utils"
export type { FindTreeItemResult } from "./utils"
