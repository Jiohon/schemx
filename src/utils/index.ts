/**
 * 工具函数统一导出
 *
 * @module utils
 */

/** createWatch 纯函数版本（类型由 hooks/useWatch 统一导出） */
export {
  createWatchField,
  createWatchFields,
  createWatchAll,
  type CreateWatchReturn,
} from "../hooks/useWatch/createWatch"

/** Schema 列配置工具 */
export {
  isBaseColumn,
  isGroupColumn,
  isDependencyColumn,
  isNestedColumn,
  getInitialValuesFromColumns,
} from "./schema"

/** 动态属性解析 */
export { resolveDynamicProp, resolveDynamicPropByBoolean } from "./dynamic"

/** 校验触发工具 */
export { shouldValidateOn } from "./validation"

/** 路径工具 */
export { getByPath, setByPath, collectObjectPaths, pickByPaths } from "./path"

/** 异步工具 */
export { withLock } from "./async"

/** 单例工具 */
export { createStrictSingleton } from "./single"
