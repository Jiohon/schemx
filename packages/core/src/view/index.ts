/**
 * View 模块统一导出。
 *
 * 提供 ViewSchema 类型、构建、订阅、view graph 和 adapter 工具。
 *
 * @module core/view
 */
export { subscribeViewSchemas } from "./subscribeViewSchemas"

export {
  createRuntimeViewState,
  createRootRuntimeViewState,
  updateRuntimeViewState,
  deleteRuntimeViewState,
} from "./createViewState"

export {
  createChildrenViewState,
  createFieldNodeViewState,
  createGroupViewState,
  createDependencyViewState,
  createRootViewState,
  readRuntimeNodeView,
  readRootViewSchemas,
  type FieldNodeViewState,
  type GroupViewState,
  type DependencyViewState,
  type RootViewState,
} from "./viewGraph"

export type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
  SchemxRendererKey as ViewRendererKey,
} from "./types"
