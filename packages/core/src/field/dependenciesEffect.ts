/**
 * Field dependencies - 字段级动态呈现态派生。
 *
 * 根据 descriptor.dynamicProps 监听 triggerFields，并把解析结果写入
 * FieldRuntimeState.dynamicOverrides。
 * 该模块不修改 descriptor/schema。
 *
 * @module core/field/dependencies
 */

import { createSignalEffect } from "../reactivity"
import { createAbortableTaskRunner } from "../scheduler/abortableTaskRunner"

import { type FieldRuntimeState, setFieldDynamicOverrides } from "./runtimeState"

import type { FieldDescriptor } from "../descriptor"
import type { Scope } from "../node"
import type { SchemxContext } from "../schemxContext"
import type {
  SchemxConditionFn,
  SchemxDependencies,
  SchemxFormApi,
  SchemxResolvedBaseField,
  Values,
} from "../types"

/**
 * 支持动态配置的字段呈现态键列表。
 */
/**
 * 可通过 dependencies 动态配置的字段属性 key 列表。
 *
 * 这些属性可以在运行时根据 trigger 字段值动态计算，
 * 覆盖静态 schema 中对应的值。
 */
export const FIELD_DEPENDENCIES_PROP_KEYS = [
  "componentProps",
  "placeholder",
  "required",
  "readonly",
  "readonlyPlaceholder",
  "disabled",
  "visible",
  "rules",
] as const

type DependenciesPropKey = (typeof FIELD_DEPENDENCIES_PROP_KEYS)[number]

/**
 * dependencies 动态属性解析结果类型。
 *
 * 从 FIELD_DEPENDENCIES_PROP_KEYS 中选取非空值 key，
 * 其中 rules 单独处理（不与其它 key 共用类型约束）。
 *
 * @typeParam TValues - 表单值类型
 */
export type DependenciesResolvedProps<TValues extends Values> = Partial<
  Pick<SchemxResolvedBaseField<TValues>, Exclude<DependenciesPropKey, "rules">> & {
    rules?: SchemxResolvedBaseField<TValues>["rules"]
  }
>

/**
 * 创建字段 dependencies effect 的运行时依赖。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateDependenciesEffectOptions<TValues extends Values = Values> {
  /**
   * 当前 form 实例运行时上下文。
   */
  context: SchemxContext<TValues>
  /**
   * 字段 descriptor，提供静态 schema、validation 和 dependencies 配置。
   */
  descriptor: Readonly<FieldDescriptor<TValues>>
  /**
   * 字段运行态（Signal Graph 阶段），dependencies 结果会写入 dynamicOverrides。
   */
  runtimeState: FieldRuntimeState<TValues>
  /**
   * 当前 effect 所属的资源作用域。
   */
  scope: Scope
}

/**
 * 创建字段级 dependencies effect。
 *
 * @param options - dependencies effect 所需的 descriptor、runtimeState 和运行时上下文。
 */
export function createDependenciesEffect<TValues extends Values = Values>(
  options: CreateDependenciesEffectOptions<TValues>
): void {
  const { context, descriptor, runtimeState, scope } = options

  const { formApi, scheduler } = context

  const dynamicProps = descriptor.dynamicProps

  const dependencies = dynamicProps?.dependencies

  const triggerFields = dynamicProps?.triggerFields

  if (dependencies == null || triggerFields == null || triggerFields.length === 0) {
    return
  }

  const taskRunner = createAbortableTaskRunner<DependenciesResolvedProps<TValues>>({
    scope,
    scheduler,
    run: () => resolveDependencies(dependencies, formApi),
    onSuccess: (resolvedProps) => {
      setFieldDynamicOverrides(runtimeState, resolvedProps, {
        source: "dependencies",
        triggerFields,
      })
    },
    onError: (error) => {
      console.error("[schemx] dependencies 执行错误:", error)
    },
  })

  const dispose = createSignalEffect(() => {
    // 读取 trigger 字段值以建立响应式依赖；字段值变化时 effect 会重新执行。
    void formApi.getValues([...triggerFields])

    void taskRunner.run()
  })

  scope.add(() => {
    dispose()
  })
}

/**
 * 解析单个字段的 dependencies 配置。
 */
async function resolveDependencies<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  formApi: SchemxFormApi<TValues>
): Promise<DependenciesResolvedProps<TValues>> {
  const values = formApi.getValues() as TValues

  const [resolvedProps] = await Promise.all([
    resolveDependenciesProps(dependencies, values, formApi),
    runDependenciesTrigger(dependencies, values, formApi),
  ])

  return resolvedProps
}

/**
 * 执行 dependencies.trigger 副作用。
 */
async function runDependenciesTrigger<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  values: TValues,
  formApi: SchemxFormApi<TValues>
): Promise<void> {
  if (!dependencies.trigger) {
    return
  }

  try {
    await dependencies.trigger(values, formApi)
  } catch (error) {
    console.error("[schemx] trigger 执行错误:", error)
  }
}

/**
 * 解析 dependencies 中显式配置的动态属性。
 */
async function resolveDependenciesProps<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  values: TValues,
  formApi: SchemxFormApi<TValues>
): Promise<DependenciesResolvedProps<TValues>> {
  const entries = await Promise.all(
    FIELD_DEPENDENCIES_PROP_KEYS.filter((key) => dependencies[key] != null).map(
      async (key) => {
        const condition = dependencies[key] as SchemxConditionFn<TValues, unknown>
        const value = await resolveCondition(formApi, condition, values, undefined)

        return [key, value] as const
      }
    )
  )

  return Object.fromEntries(entries) as DependenciesResolvedProps<TValues>
}

/**
 * 执行单个动态属性条件函数。
 */
async function resolveCondition<TValues extends Values, TValue>(
  formApi: SchemxFormApi<TValues>,
  condition: SchemxConditionFn<TValues, TValue>,
  formValues: TValues,
  defaultValue: TValue | undefined
): Promise<TValue | undefined> {
  try {
    const result = await condition(formValues, formApi)

    return result ?? defaultValue
  } catch (error) {
    console.error("[schemx] 解析动态属性时发生错误:", error)

    return defaultValue
  }
}
