/**
 * useDependency - 依赖计算 Hook
 *
 * 监听指定字段的变化，当依赖字段值改变时调用 renderer 函数
 * 返回动态生成的列配置。是 FormDependency 组件的 Hook 版本。
 *
 * @module hooks/useDependency
 */

import { type Ref, ref } from "vue"

import { SchemaFormInstance } from "@/types/instance"

import { useFormInstance } from "../useForm"
import { useSchemaWatchFields } from "../useSchemaWatch"

import type { FormValues, SchemaColumn, SchemaDependencyColumn } from "../../types"

/**
 * useDependency 返回值
 */
export interface UseDependencyReturn {
  /** 动态生成的列配置（响应式） */
  columns: Ref<SchemaColumn[]>
  /** 表单实例 */
  form: SchemaFormInstance
  /** 当前表单值（响应式） */
  values: Ref<FormValues>
}

/**
 * 监听依赖字段变化并动态生成列配置
 *
 * 订阅 `to` 指定的字段，当其值发生变化时调用 `renderer` 函数，
 * 将返回的列配置写入响应式 `columns`，驱动 UI 动态渲染。
 *
 * @param to - 要监听的依赖字段路径数组
 * @param renderer - 列配置生成函数，接收当前表单值和表单实例
 * @returns 响应式列配置、表单实例和当前表单值
 *
 * @example
 * ```ts
 * const { columns } = useDependency(
 *   ['country'],
 *   (values, form) => {
 *     if (values.country === 'CN') {
 *       return [{ name: 'province', componentType: 'picker', label: '省份' }]
 *     }
 *     return []
 *   }
 * )
 * ```
 */
export function useDependency(
  to: SchemaDependencyColumn["to"],
  renderer: SchemaDependencyColumn["renderer"]
): UseDependencyReturn {
  const form = useFormInstance()

  const columns = ref<SchemaColumn[]>([])
  const values = ref<FormValues>({})

  // 订阅依赖字段变化，触发响应式更新
  useSchemaWatchFields(
    to,
    async (payload, prevSnapshot, latestSnapshot) => {
      values.value = latestSnapshot

      if (renderer) {
        try {
          columns.value = await renderer(latestSnapshot, form)
        } catch (error) {
          throw new Error(String(error))
        }
      }
    },
    {
      inequality: true,
      immediate: true,
    }
  )

  return { columns, form, values }
}

export default useDependency
