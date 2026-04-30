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

import { useFormInstance } from "./useForm"

import type { NamePath, Value, Values } from "@schemx/core"

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
  const field = createField(form, name)

  /** 字段当前值（响应式容器） */
  const fieldValue = shallowRef<Value>(field.getValue())

  /** 字段错误信息（响应式容器） */
  const fieldError = shallowRef<string[] | undefined>(field.getError())

  /** 字段操作中状态（响应式容器） */
  const fieldPending = shallowRef<boolean>(field.isPending())

  /**
   * 通过 field.effect 分别桥接 value / error / pending 的 Signal 变化到 Vue shallowRef，
   * 每个 effect 只追踪自己关心的 Signal，保持精确依赖追踪。
   */
  const disposeValueEffect = field.effect(() => {
    fieldValue.value = field.getValue()
  })

  const disposeErrorEffect = field.effect(() => {
    fieldError.value = field.getError()
  })

  const disposePendingEffect = field.effect(() => {
    fieldPending.value = field.isPending()
  })

  onUnmounted(() => {
    disposeValueEffect()
    disposeErrorEffect()
    disposePendingEffect()
  })

  /**
   * 字段错误信息（响应式，只读）
   *
   * @example
   * ```typescript
   * field.error.value // => ['用户名不能为空'] 或 undefined
   * ```
   */
  const error = computed(() => fieldError.value)

  /**
   * 值是否与初始值不同（响应式）
   *
   * @example
   * ```typescript
   * field.dirty.value // => true（值已修改）
   * ```
   */
  const dirty = computed(() => {
    // 触发对 fieldValue 的依赖追踪
    void fieldValue.value

    return field.isTouched()
  })

  /**
   * 值未被修改（dirty 的反义，响应式）
   *
   * @example
   * ```typescript
   * field.pristine.value // => true（值未修改）
   * ```
   */
  const pristine = computed(() => !dirty.value)

  /**
   * 字段是否处于操作中（响应式）
   *
   * @example
   * ```typescript
   * field.pending.value // => true（上传中）
   * ```
   */
  const pending = computed(() => fieldPending.value)

  return {
    // 响应式状态
    error,
    dirty,
    pristine,
    pending,
    form,
    // core 层方法透传
    ...field,
    // getValue 覆盖为读 shallowRef（保持 Vue 响应式追踪）
    getValue: () => fieldValue.value,
  }
}

export default useField
