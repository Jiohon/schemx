/**
 * Store 类型兼容导出。
 *
 * 保留历史模块路径，统一从 `store.ts` 重新导出 Store 相关公共 API。
 *
 * @module core/store/formStore
 */

export { createStore as createFormStore } from "./store"
export type { Store as FormStore, StoreOptions, StorePending, StoreState } from "./store"
