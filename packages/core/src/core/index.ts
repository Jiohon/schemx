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

// SchemaRegistry - 校验schema注册
export {
  SchemaRegistry,
  schemaRegistry,
  createLocalSchemaRegistry,
  defineSchema,
  defineSchemas,
  type SchemaRegistryOptions,
  type SchemaMap,
  type SchemaFactory,
  type SchemaEntry,
  type SchemaEntryMap,
} from "./schemaRegistry"
