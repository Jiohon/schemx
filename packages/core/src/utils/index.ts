/**
 * 工具函数统一导出
 *
 * @module utils
 */

/** column 列配置工具 */
export { isBaseColumn, isGroupColumn, isDependencyColumn, isNestedColumn } from "./column"

/** 动态属性解析 */
export { type DynamicProp, resolveDynamicProp } from "./dynamic"

/** 校验触发工具 */
export { shouldValidateOn } from "./validation"

/** 路径工具 */
export { getByPath, setByPath, collectObjectPaths, pickByPaths } from "./path"

/** 异步工具 */
export { withLock } from "./async"

/** 单例工具 */
export { createStrictSingleton } from "./single"

/** 插槽工具 */
export {
  isCamelCase,
  isKebabCase,
  isLowerCase,
  camelToKebab,
  kebabToCamel,
  normalizeToKebab,
  normalizeToCamel,
  resolveSlot,
  extractChildSlots,
} from "./slot"
