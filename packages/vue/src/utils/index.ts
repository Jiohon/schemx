/**
 * 工具函数统一导出
 *
 * @module utils
 */

/** 动态属性解析 */
export {
  type DynamicProp,
  type DynamicPropEntry,
  resolveDynamicProp,
  resolveDynamicPropBatch,
} from "./dynamic"

/** 校验触发工具 */
export { shouldValidateOn } from "./validation"

/** 路径工具 */
export { getByPath, setByPath } from "./path"

/** 插槽工具 */
export { resolveSlot, extractChildSlots } from "./slot"
