/**
 * Field runtime 基础设施。
 *
 * 这里保存字段状态、resolved props 和 field lifecycle 相关基础设施。
 * 具体执行逻辑归入 `engine/`，因此本目录不应 import `engine/*`。
 *
 * @module core/field
 */

export type {
  FieldLifecycleEvent,
  FieldLifecycleEventType,
  FieldLifecycleListener,
} from "./types"
export {
  applyFieldRuntimeProps,
  createFieldRuntime,
  getStaticFieldResolvedProps,
  readFieldRuntimeProps,
  resolveRuntimeFieldDefaults,
} from "./fieldRuntime"
export { createFieldLifecycle, type FieldLifecycleBus } from "./fieldLifecycle"
