/**
 * useDependency - 依赖计算 hook
 *
 * 监听指定字段的变化，当依赖字段值改变时调用 renderer 函数
 * 返回动态生成的列配置。是 FormDependency 组件的 hook 版本。
 *
 * @module hooks/useDependency
 */

import { type Ref, ref } from "vue"

import { useFormContext } from "./useFormContext"
import { useWatchFields } from "./useWatch"

import type {
  FormValues,
  SchemaColumn,
  SchemaDependencyColumn,
  SchemaFormInstance,
} from "../types"

/**
 * useDependency 返回值
 */
export interface UseDependencyReturn {
  /** 动态生成的列配置 */
  columns: Ref<SchemaColumn[]>
  /** 表单实例 */
  form: SchemaFormInstance
  /** 当前表单值 */
  values: Ref<FormValues>
}

/**
 * 监听依赖字段变化并动态生成列配置
 *
 * @example
 * ```ts
 * const { columns } = useDependency({
 *   to: ['country'],
 *   renderer: (values, form, ) => {
 *     if (values.country === 'CN') {
 *       return [{ name: 'province', componentType: 'picker', label: '省份' }]
 *     }
 *     return []
 *   },
 * })
 * ```
 */
export function useDependency(
  to: SchemaDependencyColumn["to"],
  renderer: SchemaDependencyColumn["renderer"]
): UseDependencyReturn {
  const context = useFormContext()
  const form = context.form

  const columns = ref<SchemaColumn[]>([])
  const values = ref<FormValues>({})

  // 订阅依赖字段变化，触发响应式更新
  useWatchFields(
    to,
    async (values, _prevValue, _changedFields) => {
      values.value = values

      if (renderer) {
        try {
          columns.value = await renderer(values, form)

          form.registerRulesFromColumns(columns.value)
        } catch (error) {
          throw new Error(String(error))
        }
      }
    },
    {
      inequality: true,
    }
  )

  return { columns, form, values }
}

export default useDependency
