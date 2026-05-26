/**
 * Field 模块统一导出。
 *
 * 提供字段模型、字段索引、动态依赖和 dependency slot。
 *
 * @module core/field
 */

export {
  FIELD_DEPENDENCY_PROP_KEYS,
  createDependenciesEffect,
  type CreateDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  getDependencySlot,
  hasDependencySlot,
  createDependencyEffect,
  mountDependencyEffect,
  type DependencyEffectSlot,
} from "./dependencyEffect"

export {
  createFieldModel,
  getFieldModelResource,
  mountFieldModel,
  updateFieldModel,
  type FieldModel,
} from "./model"

export {
  createFieldRegistry,
  type FieldRegistry,
  type FieldRegistryEntry,
} from "./registry"

export {
  createValidationEffect,
  type CreateValidationEffectOptions,
  type ValidationModel,
} from "./validationEffect"
