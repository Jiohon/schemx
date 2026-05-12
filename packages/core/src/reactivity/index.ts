/**
 * 响应式模块。
 *
 * 提供细粒度响应式能力，包括 signal、effect 和批量更新。
 * 这是 SchemaForm 运行时的基础层，支撑字段状态、依赖追踪和动态属性计算。
 *
 * @module core/reactivity
 */

// Signal：响应式值容器
export { createSignal, type ReactiveSignal, type ReadonlyReactiveSignal } from "./signal"

// Effect：响应式副作用
export { createReactiveEffect, type ReactiveEffectDispose } from "./effect"

// 批量更新：合并多次更新为单次通知
export { batchUpdates } from "./batch"

// 响应式 Map：支持响应式追踪的 Map 结构
export { ReactiveMap } from "./reactiveMap"
