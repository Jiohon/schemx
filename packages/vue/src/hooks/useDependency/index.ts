/**
 * useDependency - 依赖计算 Hook
 *
 * 监听指定字段的变化，当依赖字段值改变时调用 renderer 函数
 * 返回动态生成的列配置。是 FormDependency 组件的 Hook 版本。
 *
 * @module hooks/useDependency
 */

import { ref } from "vue"
import type { Ref } from "vue"

import { useFormInstance } from "../useForm"
import { useWatchFields } from "../useWatch"

import type { FormValues, SchemaDependencyField, SchemaField } from "@schemx/core"
import type { SchemxInstance } from "@schemx/core"

/**
 * useDependency 返回值
 */
export interface UseDependencyReturn {
  /** 动态生成的列配置（响应式） */
  schemas: Ref<SchemaField[]>
  /** 表单实例 */
  form: SchemxInstance
  /** 当前表单值（响应式） */
  values: Ref<FormValues>
}

/**
 * 监听依赖字段变化并动态生成列配置
 *
 * 订阅 `to` 指定的字段，当其值发生变化时调用 `renderer` 函数，
 * 将返回的列配置写入响应式 `schemas`，驱动 UI 动态渲染。
 *
 * @param to - 要监听的依赖字段路径数组
 * @param renderer - 列配置生成函数，接收当前表单值和表单实例
 * @returns 响应式列配置、表单实例和当前表单值
 *
 * @example
 * ```ts
 * const { schemas } = useDependency(
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
  to: SchemaDependencyField["to"],
  renderer: SchemaDependencyField["renderer"]
): UseDependencyReturn {
  const form = useFormInstance()

  const schemas = ref<SchemaField[]>([])
  const values = ref<FormValues>({})

  // 订阅依赖字段变化，触发响应式更新
  useWatchFields(
    to,
    async (currentValues, latestSnapshot) => {
      values.value = latestSnapshot

      if (renderer) {
        try {
          schemas.value = await renderer(latestSnapshot, form)
        } catch (error) {
          throw new Error(String(error))
        }
      }
    },
    {
      inequality: true,
    }
  )

  return { schemas, form, values }
}

export default useDependency
