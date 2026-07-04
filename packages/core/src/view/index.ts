/**
 * View 模块统一导出。
 *
 * 提供 ViewSchema 类型、computed viewState、订阅和 runtime adapter 工具。
 *
 * @module core/view
 */
export { subscribeViewSchemas } from "./subscribeViewSchemas"

export {
  createRuntimeViewState,
  createRootRuntimeViewState,
  updateRuntimeViewState,
  deleteRuntimeViewState,
  readRootViewSchemas,
  type FieldNodeViewState,
  type GroupViewState,
  type DependencyViewState,
  type RootViewState,
} from "./createViewState"

export type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
  SchemxRendererKey as ViewRendererKey,
} from "./types"
