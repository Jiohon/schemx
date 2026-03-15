/**
 * core 模块统一导出
 *
 * 聚合 FormStore、Subscriber、Validator、RendererRegistry、SchemaRegistry 五个核心模块的公开 API。
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

// Subscriber - 发布订阅
export {
  Subscriber,
  createSubscriber,
  type FieldSubscribeCallback,
  type GlobalSubscribeCallback,
} from "./subscriber"

// Validator - 校验
export {
  Validator,
  createValidator,
  type RulesMap,
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
  type SingleFieldCallback,
  type MultiFieldCallback,
  type GlobalCallback,
  type useWatchOptions,
  type CreateWatchReturn,
} from "./createWatch"

// createDependency - 依赖计算纯函数
export {
  createDependency,
  type CreateDependencyOptions,
  type CreateDependencyReturn,
} from "./createDependency"

// RulesRegistry - 校验schema注册
export {
  RulesRegistry,
  rulesRegistry,
  createLocalSchemaRegistry,
  defineSchema,
  defineSchemas,
  type SchemaRegistryOptions,
  type SchemaMap,
  type SchemaFactory,
  type SchemaEntry,
  type SchemaEntryMap,
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
