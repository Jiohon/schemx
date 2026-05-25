/**
 * View 模块统一导出。
 *
 * 提供 ViewNode 类型、投影、订阅和 adapter 工具。
 *
 * @module core/view
 */

export {
  createViewAdapterBridge,
  validateNamePath,
  type RendererRegistry,
  type ViewAdapter,
} from "./adapter"

export { projectViewTree } from "./projectViewTree"

export { subscribeViewTree } from "./subscribeViewTree"

export type {
  ContainerViewNode,
  FieldViewNode,
  FieldViewProps,
  FieldViewState,
  SchemxRendererKey as ViewRendererKey,
  ViewNode,
  ViewNodeType,
} from "./types"

export { createViewRevision, type ViewRevision } from "./viewRevision"
