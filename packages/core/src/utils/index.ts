/**
 * 工具函数统一导出
 *
 * @module utils
 */

/** schema 列配置工具 */
export { isBaseSchema, isGroupSchema, isDependencySchema, findSchema } from "./schema"

/** 路径工具 */
export { getByPath, setByPath, collectObjectPathsByLeaf } from "./path"

/** 异步工具 */
export { withLock } from "./async"

/** 对象 diff 工具 */
export { diff } from "./diff"

/** 单例工具 */
export { createStrictSingleton } from "./single"
