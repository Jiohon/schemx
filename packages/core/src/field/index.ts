/**
 * Field 模块统一导出。
 *
 * 提供字段模型、字段索引、动态依赖、dependency slot 和字段运行态。
 *
 * @module core/field
 */

export {
  FIELD_DEPENDENCIES_PROP_KEYS,
  createDependenciesEffect,
  type CreateDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  getDependencySlot,
  hasDependencySlot,
  createDependencyEffect,
  type CreateDependencyEffectOptions,
  type DependencyEffectSlot,
} from "./dependencyEffect"

export {
  createFieldModel,
  createFieldModelFromRuntimeState,
  updateFieldModel,
  type FieldModel,
  type FieldModelSnapshot,
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

export {
  createFieldRuntimeState,
  setFieldStaticSchema,
  setFieldDynamicOverrides,
  resetFieldDynamicOverrides,
  type CreateFieldRuntimeStateOptions,
  type DynamicOverrideMeta,
  type FieldDynamicOverrideKey,
  type FieldDynamicOverrides,
  type FieldEffectiveSchema,
  type FieldRuntimeDiagnostics,
  type FieldRuntimeState,
} from "./runtimeState"
