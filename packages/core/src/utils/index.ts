/**
 * 工具函数统一导出
 *
 * @module utils
 */

/** schema 列配置工具 */
export { isBaseSchema, isGroupSchema, isDependencySchema } from "./schema"

/** 动态属性解析 */
export { type Dynamic, resolveDynamicProp } from "./dynamic"

/** 校验触发工具 */
export { shouldValidateOn } from "./validation"

/** 路径工具 */
export {
  getByPath,
  setByPath,
  collectObjectPaths,
  collectObjectPathsByLeaf,
  pickByPaths,
} from "./path"

/** 异步工具 */
export { withLock } from "./async"

/** 单例工具 */
export { createStrictSingleton } from "./single"

/** 批量调度器 */
export {
  createBatchScheduler,
  type BatchScheduler,
  type BatchSchedulerOptions,
} from "../scheduler"

/** 命名转换工具 */
export {
  isCamelCase,
  isKebabCase,
  isLowerCase,
  camelToKebab,
  kebabToCamel,
  normalizeToKebab,
  normalizeToCamel,
} from "./naming"
