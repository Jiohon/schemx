/**
 * core 模块统一导出
 *
 * 聚合 FormStore、Validator、RendererRegistry、SchemaRegistry 四个核心模块的公开 API。
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
export { SignalMap } from "./signalMap"

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
} from "./rendererRegistry"

// createFormInstance - 表单实例工厂
export { createFormInstance, type CreateFormInstanceOptions } from "./createForm"

// createWatch - 纯函数版本的字段监听
export {
  createWatchField,
  createWatchFields,
  createWatchAll,
  type WatchFieldCallback,
  type WatchFieldsCallback,
  type WatchAllCallback,
  type useWatchOptions,
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
} from "./rulesRegistry"

// requestProvider - 全局请求器管理与解析
export {
  _setGlobalRequest,
  _getGlobalRequest,
  _clearGlobalRequest,
  resolveRequester,
  type RequestFn,
  type HasRequest,
} from "./requestProvider"

// Utils - 工具函数
export { isBaseSchema, isGroupSchema, isDependencySchema } from "./utils"

// BatchScheduler - 批量调度器
export {
  createBatchScheduler,
  type BatchScheduler,
  type BatchSchedulerOptions,
} from "./utils/batchScheduler"

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
  Rules,
  RendererType,
  CustomRendererMap,
  BaseComponentProps,
  ComponentProps,
  SchemaBase,
  SchemaGroupField,
  SchemaDependencyField,
  SchemaBaseField,
  SchemaField,
  FormItemProps,
  DeepNamePath,
  DeepReadonly,
  CSSProperties,
} from "./types"
