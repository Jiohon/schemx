/**
 * useDependencies - 依赖属性解析 Hook
 *
 * 根据 {@link SchemxDependencies} 配置，监听共享的 triggerFields，
 * 当任一触发字段变化时，执行所有已配置的条件函数并更新响应式状态。
 * trigger 优先于其他属性执行，异常独立捕获。
 *
 * @module hooks/useDependencies
 */

import { reactive } from "vue"

import { debounce } from "es-toolkit"

import { useWatchFields } from "@/hooks/useWatch"
import { resolvePropertyCondition } from "@/utils"

import type {
  SchemxDependencies,
  SchemxDependenciesStaticProps,
  SchemxInstance,
  Values,
} from "@schemx/core"

/** 默认 debounce 等待时间（毫秒），约一帧 */
const DEBOUNCE_WAIT = 16

/**
 * SchemxDependencies 中可配置的条件函数属性键集合（不含 triggerFields）
 */
export const DEPENDENCY_CONDITION_KEYS = [
  "componentProps",
  "placeholder",
  "required",
  "readonly",
  "disabled",
  "visible",
  "trigger",
  "rules",
] as const

/**
 * 可解析的属性键（不含 triggerFields 和 trigger）
 *
 * 用于约束 defaults 对象的键值范围。
 */
type SchemxDependenciesConditionKey = Exclude<
  (typeof DEPENDENCY_CONDITION_KEYS)[number],
  "trigger"
>

/**
 * 可解析属性键集合（不含 trigger）
 */
const RESOLVABLE_KEYS = DEPENDENCY_CONDITION_KEYS.filter(
  (k): k is SchemxDependenciesConditionKey => k !== "trigger"
)

/**
 * 解析 schema 中的动态属性，返回响应式状态对象。
 *
 * 所有条件函数共享同一个 triggerFields，当任一触发字段变化时：
 * 1. trigger 与属性条件函数并行执行
 * 2. trigger 异常独立捕获，不影响属性解析
 * 3. 更新响应式状态
 *
 * @param dependencies - 结构化依赖配置对象，为 undefined 时直接使用静态默认值
 * @param defaults - 静态默认值对象
 *
 * @returns 响应式的解析结果对象
 *
 * @example
 * ```ts
 * const resolved = useDependencies(
 *   {
 *     triggerFields: ['province', 'country'],
 *     visible: (values) => !!values.province,
 *     disabled: (values) => values.country === 'overseas',
 *   },
 *   {
 *     visible: true,
 *     readonly: false,
 *     disabled: false,
 *     required: false,
 *     placeholder: '请输入',
 *     componentProps: {},
 *     rules: []
 *   }
 * )
 * ```
 */
export function useDependencies<T extends Values = Values>(
  form: SchemxInstance<T>,
  dependencies: SchemxDependencies<T> | undefined,
  defaults: SchemxDependenciesStaticProps<T>
): SchemxDependenciesStaticProps<T> {
  const state = reactive<SchemxDependenciesStaticProps<T>>({ ...defaults })

  if (
    dependencies == null ||
    dependencies == undefined ||
    dependencies.triggerFields.length === 0
  ) {
    return state as SchemxDependenciesStaticProps<T>
  }

  const { triggerFields, trigger, ...configured } = dependencies

  // 收集已配置的可解析属性
  const configuredProps = RESOLVABLE_KEYS.filter(
    (key) => configured[key as keyof typeof configured]
  )

  // 无任何条件函数且无 trigger 时，直接返回
  if (configuredProps.length === 0 && trigger == null) {
    return state as SchemxDependenciesStaticProps<T>
  }

  const debouncedResolve = debounce(async (formValues: T) => {
    // trigger 与属性解析并行执行，trigger 异常独立捕获不影响属性解析
    let triggerTask = undefined

    if (trigger) {
      triggerTask = Promise.resolve(trigger(formValues, form)).catch((error: unknown) => {
        console.error("[schemx] trigger 执行错误:", error)
      })
    }

    const propsTask = configuredProps.map(async (key) => {
      const condition = dependencies[key]

      if (condition == null) return defaults[key]

      return resolvePropertyCondition(
        form,
        condition,
        formValues,
        defaults[key as keyof SchemxDependenciesStaticProps]
      )
    })

    const [, results] = await Promise.all([triggerTask, Promise.all(propsTask)])

    // 批量更新状态
    configuredProps.forEach((key, i) => {
      ;(state as Record<string, unknown>)[key] = results[i]
    })
  }, DEBOUNCE_WAIT)

  useWatchFields(
    triggerFields,
    (_payload, latestSnapshot) => {
      debouncedResolve(latestSnapshot)
    },
    { immediate: true }
  )

  return state as SchemxDependenciesStaticProps<T>
}

export default useDependencies
