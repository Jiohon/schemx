/**
 * useResolvedProps - 动态属性解析 Hook
 *
 * 将 schema 中的动态属性（visible、readonly、disabled、required、placeholder、componentProps）
 * 通过 debounced 批量解析器解析为最终的响应式状态。
 * 内部封装 reactive 状态 + batchResolveDynamicProp + useWatchFields。
 *
 * @module hooks/useResolvedProps
 */

import { reactive } from "vue"

import { useWatchFields } from "@/hooks/useWatch"
import { batchResolveDynamicProp, type DynamicPropEntry } from "@/utils"

import type { ComponentProps, NamePath } from "@schemx/core"

/**
 * 动态属性解析后的状态类型
 */
export interface ResolvedProps {
  [key: string]: unknown
  visible: boolean
  readonly: boolean
  disabled: boolean
  required: boolean
  placeholder: string
  componentProps: ComponentProps
}

/**
 * 动态属性条目配置
 *
 * 每个属性包含动态值（函数或静态值）和默认值。
 */
export type ResolvedPropEntries = {
  [K in keyof ResolvedProps]: DynamicPropEntry<ResolvedProps[K]>
}

/**
 * 解析 schema 中的动态属性，返回响应式状态对象。
 *
 * 监听依赖字段变化，通过 debounced 批量解析器统一解析所有动态属性，
 * 高频触发时只执行最后一次。
 *
 * @param dependencies - 依赖的字段路径数组
 * @param entries - 各动态属性的配置（value + defaultValue）
 *
 * @returns 响应式的解析结果对象
 *
 * @example
 * ```ts
 * const resolvedProps = useResolvedProps(
 *   dependencies,
 *   {
 *     visible:        { value: schema.visible, defaultValue: true },
 *     readonly:       { value: schema.readonly, defaultValue: false },
 *     disabled:       { value: schema.disabled, defaultValue: false },
 *     required:       { value: schema.required, defaultValue: !!schema.rules },
 *     placeholder:    { value: schema.placeholder, defaultValue: '请输入' },
 *     componentProps: { value: schema.componentProps, defaultValue: {} },
 *   }
 * )
 * ```
 */
export function useResolvedProps(
  dependencies: NamePath[],
  entries: ResolvedPropEntries
): ResolvedProps {
  const state = reactive<ResolvedProps>({
    visible: true,
    readonly: false,
    disabled: false,
    required: false,
    placeholder: "",
    componentProps: {} as ComponentProps,
  })

  const resolve = batchResolveDynamicProp<ResolvedProps>()

  useWatchFields(
    dependencies,
    (_payload, latestSnapshot) => {
      resolve(entries, latestSnapshot, (results) => {
        Object.assign(state, results)
      })
    },
    { immediate: true }
  )

  return state
}

export default useResolvedProps
