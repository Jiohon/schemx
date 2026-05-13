/**
 * core 模块统一导出
 *
 * 聚合 FormStore、Validator、RendererRegistry、RulesRegistry 四个核心模块的公开 API。
 *
 * @module core
 */

// FormStore - 纯状态管理
export {
  FormStore,
  createFormStore,
  type FormStoreState,
  type FormStoreOptions,
  type FormStorePendingField,
} from "./store"

// Validator - 校验
export {
  Validator,
  createValidator,
  type ValidateResult,
  type ValidateError,
  type FieldError,
} from "./validator"

// RendererRegistry - 渲染器注册
export {
  createRendererRegistry,
  type RendererRegistry,
  type RegistryOptions,
  type RendererMap,
} from "./registry"

// createForm - 表单实例工厂
export { createForm, type CreateFormOptions } from "./createForm"
export { createForm as createFormInstance } from "./createForm"

// createField - 单字段控制器
export { createField, type SchemxFieldInstance } from "./createField"

// createEffect - 底层通用 reactive effect
export {
  createEffect,
  type CleanupFn,
  type EffectCallback,
  type CreateEffectReturn,
} from "./createEffect"

// createWatch - 纯函数版本的字段监听
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

// RulesRegistry - 校验规则注册
export {
  createRulesRegistry,
  type RulesRegistry,
  type RuleRegistryOptions,
  type RuleFactory,
  type RuleEntry,
  type RuleEntryMap,
} from "./registry"

// Utils - 工具函数
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

// Types - 类型定义
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
  SchemxBuiltinRules,
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
  SchemxInternalHooks,
  SchemxDictionary,
  SchemxWithDictionary,
} from "./types"
