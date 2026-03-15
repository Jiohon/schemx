/**
 * createDependency - 依赖计算纯函数
 *
 * 从 `hooks/useDependency` 提取的核心逻辑，不依赖任何 UI 框架。
 * 监听指定字段的变化，当依赖字段值改变时调用 renderer 函数，
 * 将动态生成的列配置通过 onChange 回调传出。
 *
 * 与 `useDependency` 的区别：
 * - 不依赖 Vue 的 `inject`（通过参数传入 form 实例）
 * - 不依赖 Vue 的 `onUnmounted`（返回 unsubscribe 由调用方管理生命周期）
 * - 内部使用 `createWatchFields`（纯函数版本）替代 `useWatchFields`
 *
 * @module core/createDependency
 *
 * @example
 * ```ts
 * import { createFormInstance, createDependency } from '@schemx/core'
 *
 * const form = createFormInstance({ initialValues: { country: 'CN' } })
 *
 * const { unsubscribe } = createDependency({
 *   form,
 *   to: ['country'],
 *   renderer: (values, form) => {
 *     if (values.country === 'CN') {
 *       return [{ name: 'province', component: 'picker', label: '省份' }]
 *     }
 *     return []
 *   },
 *   onChange: (schemas) => {
 *     console.log('动态列配置已更新:', schemas)
 *   },
 * })
 *
 * // 不再需要时取消订阅
 * unsubscribe()
 * ```
 */

import { createWatchFields } from "./createWatch"

import type { FormValues, NamePath, SchemaField, SchemxFormInstance } from "./types"

/**
 * createDependency 选项
 *
 * @typeParam T - 表单值类型，默认为 {@link FormValues}
 */
export interface CreateDependencyOptions<T extends FormValues> {
  /** 表单实例 */
  form: SchemxFormInstance<T>
  /** 依赖的字段路径数组 */
  to: NamePath<T>[]
  /**
   * 列配置生成函数
   *
   * 当依赖字段值变化时调用，接收当前表单值快照和表单实例，
   * 返回动态生成的列配置数组（支持异步）。
   *
   * @param values - 当前表单值快照
   * @param form - 表单实例
   * @returns 列配置数组或 Promise
   */
  renderer: (
    values: T,
    form: SchemxFormInstance<T>
  ) => SchemaField<T>[] | Promise<SchemaField<T>[]>
  /**
   * 列配置变更时的回调
   *
   * renderer 执行完成后，将生成的列配置传给此回调，
   * 由调用方决定如何消费（如更新 UI、写入响应式状态等）。
   *
   * @param schemas - 动态生成的列配置数组
   */
  onChange: (schemas: SchemaField<T>[]) => void
}

/**
 * createDependency 返回值
 */
export interface CreateDependencyReturn {
  /** 取消订阅函数，调用后停止监听依赖字段变化 */
  unsubscribe: () => void
}

/**
 * 创建依赖计算（纯函数版本）
 *
 * 监听 `to` 指定的字段变化，当依赖字段值改变时调用 `renderer` 生成列配置，
 * 并通过 `onChange` 回调传出。内部使用 `createWatchFields` 实现订阅，
 * 返回 `unsubscribe` 函数由调用方管理生命周期。
 *
 * @param options - 依赖计算选项
 * @returns 包含 unsubscribe 取消订阅函数的对象
 *
 * @example
 * ```ts
 * const { unsubscribe } = createDependency({
 *   form,
 *   to: ['country'],
 *   renderer: (values, form) => {
 *     if (values.country === 'CN') {
 *       return [{ name: 'province', component: 'picker', label: '省份' }]
 *     }
 *     return []
 *   },
 *   onChange: (schemas) => {
 *     // 处理动态列配置
 *   },
 * })
 * ```
 */
export function createDependency<T extends FormValues = FormValues>(
  options: CreateDependencyOptions<T>
): CreateDependencyReturn {
  const { form, to, renderer, onChange } = options

  const unsubscribe = createWatchFields<T>(
    form,
    to,
    async (_payload, _prevSnapshot, latestSnapshot) => {
      if (renderer) {
        try {
          const schemas = await renderer(latestSnapshot, form)
          onChange(schemas)
        } catch (error) {
          throw new Error(String(error))
        }
      }
    },
    { inequality: true, immediate: true }
  )

  return { unsubscribe }
}
