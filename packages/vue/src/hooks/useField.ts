/**
 * useField - 字段控制 Hook
 *
 * 基于 core 层的 {@link createField} 实现，
 * 通过 subscribe 回调将 Signal 变化桥接到 Vue 响应式系统。
 *
 * @module hooks/useField
 *
 * @remarks
 * core 层的 createField 封装了所有框架无关的字段操作逻辑，
 * useField 只负责：
 * 1. 从 Vue context 中获取 form 实例
 * 2. 创建 shallowRef 容器
 * 3. 通过 subscribe 将 Signal 变化同步到 shallowRef
 * 4. 包装 computed 只读状态
 * 5. 管理 onUnmounted 生命周期清理
 */

import { computed, onUnmounted, shallowRef } from "vue"

import { createField } from "@schemx/core"

import { FieldInstance } from "@/types/field"

import { useFormInstance } from "./useForm"

import type { NamePath, SchemxInstance, Value, Values } from "@schemx/core"

/**
 * useField 针对 (form, name) 的缓存条目
 *
 * 通过引用计数确保同一 (form, name) 的多次 useField 调用
 * 共享同一份 shallowRef 和 effect 桥接，避免重复订阅。
 *
 * @typeParam T - 表单值类型
 */
interface FieldHookCacheEntry<T extends Values = Values> {
  /** 当前活跃的引用计数，归零时释放 dispose 并从缓存中移除 */
  refCount: number
  /** 共享的字段控制器实例（含 Vue Ref 包装） */
  result: FieldInstance<T>
  /** 取消 Signal effect 订阅并清理资源 */
  dispose: () => void
}

/** 模块级缓存：form 实例 → 字段名 → 缓存条目 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fieldHookCache = new WeakMap<any, Map<string, FieldHookCacheEntry>>()

/**
 * 序列化字段名为缓存 key
 */
function serializeName(name: NamePath): string {
  return Array.isArray(name) ? name.join(".") : String(name)
}

/**
 * 创建字段 hook 的响应式状态
 *
 * 从 createField 生成 FieldInstance，创建 shallowRef 容器
 * 并通过 field.effect 将 Signal 变化桥接到 Vue 响应式系统。
 */
function createFieldHook<T extends Values = Values>(
  form: SchemxInstance<T>,
  name: NamePath<T>
) {
  const field = createField(form, name)

  const fieldValue = shallowRef<Value>(field.getValue())
  const fieldError = shallowRef<string[] | undefined>(field.getError())
  const fieldPending = shallowRef<boolean>(field.isPending())

  const dispose = field.effect(() => {
    fieldValue.value = field.getValue()
    fieldError.value = field.getError()

    fieldPending.value = field.isPending()
  })

  const error = computed(() => fieldError.value)

  const dirty = computed(() => {
    void fieldValue.value

    return field.isTouched()
  })

  const pending = computed(() => fieldPending.value)

  const result = {
    value: fieldValue,
    error,
    dirty,
    pending,
    ...field,
    getValue: () => fieldValue.value,
  }

  return { result, dispose }
}

/**
 * 获取单个字段的控制能力
 *
 * 通过 core 层 createField 提供字段操作方法，
 * 通过 subscribe 回调桥接 Signal 变化到 Vue shallowRef。
 *
 * @param name - 字段名（支持嵌套路径，如 'user.address.city'）
 * @returns 字段状态和操作方法
 *
 * @example
 * ```typescript
 * const field = useField('username')
 *
 * // 响应式值（在 computed/watchEffect/template 中自动追踪）
 * field.getValue()
 *
 * // 响应式错误
 * field.error.value   // string[] | undefined
 *
 * // 响应式脏状态
 * field.dirty.value   // boolean
 *
 * // 响应式操作中状态
 * field.pending.value  // boolean
 *
 * // 写入值
 * field.setValue('new value')
 *
 * // 校验
 * const result = await field.validate()
 * ```
 */
export const useField = <T extends Values = Values>(name: NamePath<T>) => {
  const form = useFormInstance<T>()

  const key = serializeName(name)

  let formCache = fieldHookCache.get(form)

  if (!formCache) {
    formCache = new Map()
    fieldHookCache.set(form, formCache)
  }

  let entry = formCache.get(key)

  if (entry) {
    entry.refCount++
  } else {
    const { result, dispose } = createFieldHook<T>(form, name)

    entry = {
      refCount: 1,
      result,
      dispose,
    }

    formCache.set(key, entry)
  }

  onUnmounted(() => {
    if (--entry.refCount <= 0) {
      entry.dispose()
      formCache.delete(key)
    }
  })

  return entry.result
}

export default useField
