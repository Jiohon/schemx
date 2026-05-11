/**
 * Runtime engines.
 *
 * 这里集中导出具体 runtime 执行器。`runtime/engine.ts` 仍是 RuntimeEngine
 * 装配入口；本目录只放 field、dynamic prop、dependency、validation 等
 * 具体执行模块。
 *
 * @module core/engine
 */

export type {
  DynamicPropEngineMountResult,
  DynamicPropEngineOptions,
  EngineContext,
  EngineDispose,
  EngineMountResult,
  EnginePendingChangeHandler,
  EngineTreeChangeHandler,
} from "./types"
export {
  FIELD_DEPENDENCY_PROP_KEYS,
  createDynamicPropResolver,
} from "./dynamicPropEngine"
export {
  createDependencyEngine,
  type DependencyEngineMountResult,
  type DependencyEngineOptions,
} from "./dependencyEngine"
export {
  createFieldEngine,
  type FieldEngine,
  type FieldEngineOptions,
} from "./fieldEngine"
export {
  createValidationEngine,
  type ValidationEngine,
} from "./validationEngine"
