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
} from "./store"

// SignalMap - 响应式键值存储
export { SignalMap } from "./signal"

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
  RendererRegistry,
  rendererRegistry,
  createLocalRendererRegistry,
  defineRenderer,
  defineRenderers,
  type RegistryOptions,
  type RendererMap,
} from "./registry/rendererRegistry"

// createFormInstance - 表单实例工厂
export { createFormInstance, type CreateFormInstanceOptions } from "./createForm"

// createEffect - 底层通用 Signal effect
export {
  createEffect,
  type CleanupFn,
  type EffectCallback,
  type CreateEffectReturn,
} from "./createEffect"

// createWatch - 纯函数版本的字段监听
export {
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
  RulesRegistry,
  rulesRegistry,
  createLocalRuleRegistry,
  defineRule,
  defineRules,
  type RuleRegistryOptions,
  type RuleFactory,
  type RuleEntry,
  type RuleEntryMap,
} from "./registry/rulesRegistry"

// Utils - 工具函数
export {
  isBaseSchema,
  isGroupSchema,
  isDependencySchema,
  getByPath,
  setByPath,
  collectObjectPaths,
  collectObjectPathsByLeaf,
  pickByPaths,
} from "./utils"

// BatchScheduler - 批量调度器
export {
  createBatchScheduler,
  type BatchScheduler,
  type BatchSchedulerOptions,
} from "./scheduler"

// Types - 类型定义
export type {
  Value,
  FormValues,
  NamePath,
  ValidationTrigger,
  SchemxInstance,
  SchemxProps,
  GlobalContext,
  CustomRules,
  BuiltinRules,
  SchemxRules,
  RendererType,
  CustomRenderer,
  CustomField,
  BaseComponentProps,
  ComponentProps,
  SchemaBase,
  SchemxGroupField,
  SchemxDependencyField,
  SchemxBaseField,
  SchemxField,
  FormItemProps,
  DeepNamePath,
  DeepReadonly,
  CSSProperties,
} from "./types"
