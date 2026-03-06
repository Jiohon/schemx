/**
 * core 模块统一导出
 *
 * 聚合 FormStore、Subscriber、Validator、Registry 四个核心模块的公开 API。
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
  Registry,
  globalRegistry,
  createLocalRegistry,
  type RegistryOptions,
  type RendererMap,
} from "./registry"
