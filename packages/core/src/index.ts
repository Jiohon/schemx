/**
 * core 模块统一导出
 *
 * 聚合 Validator、RendererRegistry、RulesRegistry 等核心模块的公开 API。
 *
 * @module core
 */

export {
  Validator,
  createValidator,
  type ValidateResult,
  type ValidateError,
  type FieldError,
} from "./validator"

export {
  createRendererRegistry,
  type RendererRegistry,
  type RegistryOptions,
  type RendererMap,
} from "./registry"

export { createForm, type CreateFormOptions } from "./createForm"
export { createForm as createFormInstance } from "./createForm"
export { defineSchemas, type DefineSchemasApi } from "./defineSchemas"

export {
  createLifecycle,
  createLifecycleBus,
  type LifecycleBus,
  type LifecycleHooks,
  type LifecycleListener,
} from "./lifecycle"

export type {
  ViewNode,
  FieldViewNode,
  ContainerViewNode,
  FieldViewProps,
  FieldViewState,
} from "./view"

export { createField, type SchemxFieldInstance } from "./createField"

export {
  createEffect,
  type CleanupFn,
  type EffectCallback,
  type CreateEffectReturn,
} from "./createEffect"

export {
  createWatch,
  createWatchField,
  createWatchFields,
  createWatchAll,
  type WatchFieldCallback,
  type WatchFieldsCallback,
  type WatchAllCallback,
  type CreateWatchOptions,
  type CreateWatchReturn,
} from "./createWatch"

export {
  createRulesRegistry,
  type RulesRegistry,
  type RuleRegistryOptions,
  type RuleFactory,
  type RuleEntry,
  type RuleEntryMap,
} from "./registry"

export {
  isBaseSchema,
  isGroupSchema,
  isDependencySchema,
  isBaseResolvedSchema,
  isGroupResolvedSchema,
  getByPath,
  setByPath,
  collectObjectPathsByLeaf,
} from "./utils"

export type {
  Value,
  Values,
  Dynamic,
  NamePath,
  DeepReadonly,
  CSSProperties,
  ValidationTrigger,
  SchemxInstance,
  SchemxProps,
  SchemxGlobalContext,
  SchemxRuleDefinition,
  SchemxRuleDefinitionKey,
  SchemxRuleBuiltinKey,
  SchemxRules,
  SchemxRendererKey,
  SchemxRendererDefinition,
  SchemxFieldDefinition,
  SchemxGroupFieldDefinition,
  SchemxBaseComponentProps,
  SchemxComponentProps,
  SchemxBase,
  SchemxGroupField,
  SchemxBaseField,
  SchemxResolvedField,
  SchemxDependencyField,
  SchemxField,
  SchemxFormItemProps,
  SchemxDependencies,
  SchemxConditionFn,
  SchemxDependenciesStaticProps,
  SchemxDictionary,
  SchemxWithDictionary,
} from "./types"
