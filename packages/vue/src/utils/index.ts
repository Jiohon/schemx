/**
 * 工具函数统一导出
 *
 * @module utils
 */

/** 动态属性解析 */
export {
  type DynamicPropEntry,
  resolveDynamicProp,
  batchResolveDynamicProp,
} from "./dynamic"

/** 校验触发工具 */
export { shouldValidateOn } from "./validation"

/** 插槽工具 */
export { resolveSlot, extractChildSlots } from "./slot"

export { diff } from "./diff"

/** 依赖对象解析工具 */
export { resolvePropertyCondition } from "./dependency"
